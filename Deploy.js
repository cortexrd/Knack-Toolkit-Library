const fs = require('fs');
const readline = require("readline");
const childProcess = require('child_process');
const UglifyJS = require("C:\\code\\NodeJS\\node_modules\\uglify-js");

const filePath = 'C:\\code\\Lib\\KTL\\';
const fileName = 'KTL';
const fileExt = '.js';
const fullPathName = filePath + fileName + fileExt;

console.log('fullPathName =', fullPathName);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

process.chdir('c:\\code');
console.clear();
loop();

function loop() {
    rl.question('[1] Minify  [2] Upload  [3] Merge  [X] Exit\n> ', function (op) {
        console.log('op =', op);
        if (op === '1') {
            minify(fullPathName)
                .then(function () {
                    console.log('MINIFY COMPLETE - RESOLVED');
                    loop();
                })
                .catch(function (reason) { console.log('\x1b[31m%s\x1b[0m', reason); })
        } else if (op === '2') {
            upload()
                .then(function () { loop(); })
                .catch(function (reason) { console.log('\x1b[31m%s\x1b[0m', reason); })
        } else if (op === '3') {
            runScript('.\\Lib\\KTL\\NodeJS\\NodeJS_MergeFiles.js', ['-ktlpath=.\\Lib\\KTL', '-filename=.\\Lib\\KTL\\KTL_KnackApp'],
                function (err) {
                    if (err) {
                        console.log('Error during merge:\n', err, '\n\n');
                        loop();
                    } else {
                        console.log('\x1b[32m%s\x1b[0m', 'Merge complete\n');
                        loop();
                    }
                }
            );
        } else if (op.toLowerCase() === 'x') {
            rl.close();
            process.exit(code = 0)
        }
    })
}

function runScript(scriptPath, args, callback) {
    //Keep track of whether callback has been invoked to prevent multiple invocations
    var invoked = false;

    var process = childProcess.fork(scriptPath, args);

    //Listen for errors as they may prevent the exit event from firing
    process.on('error', function (err) {
        if (invoked) return;
        invoked = true;
        callback(err);
    });

    //Execute the callback once the process has finished running
    process.on('exit', function (code) {
        if (invoked) return;
        invoked = true;
        var err = code === 0 ? null : new Error('exit code ' + code);
        callback(err);
    });
}

function minify(file) {
    return new Promise(function (resolve, reject) {
        process.chdir('c:\\code\\Lib\\KTL');
        var code = fs.readFileSync(file, 'utf8');
        var startIdx = code.search(/const KTL_VERSION = \'[^;]+;/);
        var endIdx = code.indexOf(';', startIdx);
        var version = code.substring(startIdx, endIdx);
        version = version.split('=')[1].replaceAll(/[' ]/g, "");
        console.log('JS Version found:', version);
        const minifiedOutput = fileName + '-' + version + '.min.js';
        console.log('Minified output file: ', minifiedOutput);

        rl.question('Create Source Maps? (y/[n])\n> ', function (op) {
            var srcMapOpt = {};
            if (op.toLowerCase() === 'y')
                srcMapOpt = {
                    sourceMap: {
                        filename: minifiedOutput,
                        url: 'KTL-' + version + '.min.js.map',
                        root: 'https://ctrnd.com/Lib/KTL/Prod',
                    }
                }

            var result = UglifyJS.minify(code, srcMapOpt)
            if (result.error) { //Runtime error, or `undefined` if no error
                reject(result.error);
            } else {
                fs.writeFileSync(minifiedOutput, result.code);
                if (result.map)
                    fs.writeFileSync(minifiedOutput + '.map', result.map);
                console.log('\x1b[32m%s\x1b[0m', 'Minification complete\n');
                resolve();
            }
        })
    })
}

function upload() {
    return new Promise(function (resolve, reject) {
        //Copy JS file as versioned Prod.
        const jsPathName = filePath + fileName + '.js';
        var code = fs.readFileSync(jsPathName, 'utf8');
        var startIdx = code.search(/const KTL_VERSION = \'[^;]+;/);
        var endIdx = code.indexOf(';', startIdx);
        var version = code.substring(startIdx, endIdx);
        version = version.split('=')[1].replaceAll(/[' ]/g, "");
        console.log('JS Version found:', version);
        const jsProd = fileName + '-' + version + '.js';
        console.log('JS output file: ', jsProd);
        fs.copyFile(jsPathName, filePath + jsProd, (err) => {
            if (err) throw err;
            console.log('\x1b[32m%s\x1b[0m', 'Copied ' + jsProd + ' successfully\n');
        });

        //Copy CSS file as versioned Prod.
        const cssPathName = filePath + fileName + '.css';
        code = fs.readFileSync(cssPathName, 'utf8');
        version = code.match(/KTL CSS version: [\d.]+/);
        version = version[0].match(/[\d.]+/)[0];
        console.log('CSS version found:', version);
        const cssProd = fileName + '-' + version + '.css';
        console.log('CSS output file: ', cssProd);
        fs.copyFile(cssPathName, filePath + cssProd, (err) => {
            if (err) throw err;
            console.log('\x1b[32m%s\x1b[0m', 'Copied ' + cssProd + ' successfully\n');
        });

        var ftp = childProcess.spawn('cmd.exe', ['/k', 'C:\\code\\FTP\\WinSCP.bat']);
        ftp.stdout.on('data', function (data) {
            if (data.includes('Error')) {
                console.log('\x1b[31m%s\x1b[0m', '\nError: ' + data); //RED color
                ftp.exitCode = 1;
                ftp.kill('SIGINT');
            } else if (data.includes('No session.')) {
                ftp.kill();
            } else {
                console.log(data.toString().replace('\n', ''));
            }
        });

        ftp.stderr.on('data', function (data) {
            console.log('\x1b[31m%s\x1b[0m', 'stderr: ' + data);
            ftp.kill();
        });

        ftp.on('exit', function (code, signal) {
            if (code)
                console.log('\x1b[31m%s\x1b[0m', 'Upload incomplete\n');
            else
                console.log('\x1b[32m%s\x1b[0m', 'Upload complete\n');

            resolve();
        });
    })
}
