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
    rl.question('[1] Merge  [2] Minify  [3] Upload  [X] Exit\n> ', function (op) {
        console.log('op =', op);
        if (op === '1') {
            runScript('.\\Lib\\KTL\\NodeJS\\NodeJS_ACB_MergeFiles.js', ['-ktlpath=.\\Lib\\KTL', '-filename=.\\Lib\\KTL\\KTL_KnackApp'],
                function (err) {
                    if (err) {
                        console.log('Error during merge:\n', err, '\n\n');
                        //throw err;
                        loop();
                    } else {
                        console.log('\x1b[32m%s\x1b[0m', 'Merge complete\n');
                        loop();
                    }
                }
            );
        } else if (op === '2') {
            minify(fullPathName)
                .then(function () {
                    console.log('MINIFY COMPLETE - RESOLVED');
                    loop();
                })
                .catch(function (reason) { console.log('\x1b[31m%s\x1b[0m', reason); })
        } else if (op === '3') {
            upload()
                .then(function () { loop(); })
                .catch(function (reason) { console.log('\x1b[31m%s\x1b[0m', reason); })
        } else if (op.toLowerCase() === 'x') {
            rl.close();
            process.exit(code = 0)
            //break;
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
        const minifiedOutput = fileName + '.min.js';
        console.log('minifiedOutput =', minifiedOutput);
        var result = UglifyJS.minify(code, {
            //No source maps for now - too buggy.
            //    sourceMap: {
            //        filename: minifiedOutput,
            //        url: 'KTL.min.js.map',
            //        root: 'https://ctrnd.com/Lib/KTL',
            //    }
        })
        if (result.error) { //Runtime error, or `undefined` if no error
            reject(result.error);
        } else {
            fs.writeFileSync(minifiedOutput, result.code);
            //fs.writeFileSync(minifiedOutput + '.map', result.map);
            console.log('\x1b[32m%s\x1b[0m', 'Minification complete\n');
            resolve();
        }
    })
}

function upload() {
    return new Promise(function (resolve, reject) {
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
