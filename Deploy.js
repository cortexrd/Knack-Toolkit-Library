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

runScript('.\\Lib\\KTL\\NodeJS\\NodeJS_ACB_MergeFiles.js', ['-ktlpath=.\\Lib\\KTL', '-filename=.\\Lib\\KTL\\KTL_KnackApp'],
    function (err) {
        if (err) throw err;
        console.log('\x1b[32m%s\x1b[0m', 'Merge complete');

        rl.question('Do you want to minify (y/n) ?', function (minifyYes) {
            if (minifyYes === 'y') {
                minify(fullPathName)
                    .then(function () {
                        upload();
                    })
                    .catch(function (reason) {
                        console.log('\x1b[31m%s\x1b[0m', reason);
						})
            } else {
                upload();
            }
        });
    }
);

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
        console.log('Exit code', code);
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
            sourceMap: {
                filename: minifiedOutput,
                url: 'KTL.min.js.map',
                root: 'https://ctrnd.com/Lib/KTL',
            }
        })

        if (result.error) { //Runtime error, or `undefined` if no error
            reject(result.error);
        } else {
            fs.writeFileSync(minifiedOutput, result.code);
            fs.writeFileSync(minifiedOutput + '.map', result.map);
            console.log('\x1b[32m%s\x1b[0m', 'Minification complete');
            resolve();
        }
    })
}

function upload(file) {
    rl.question('Do you want to upload (y/n) ?', function (upload) {
        if (upload === 'y') {
            var ftp = childProcess.spawn('cmd.exe', ['/k', 'C:\\code\\FTP\\WinSCP.bat']);

            ftp.stdout.on('data', function (data) {
                console.log(data.toString().replace('\n', ''));
                if (data.includes('Error')) {
                    console.log('\x1b[31m%s\x1b[0m', '\nError'); //RED color
                    console.log('\x1b[0m');
                    ftp.kill();
                } else if (data.includes('No session.')) {
                    ftp.kill();
                }
            });

            ftp.stderr.on('data', function (data) {
                console.log('\x1b[31m%s\x1b[0m', 'stderr: ' + data);
                ftp.kill();
            });

            ftp.on('exit', function (code) {
                //TODO:  have better output on error.  Currently, code is always undefined.
                //console.log('Child process exited with code ' + code);
                process.exit(code = 0)
            });
        }

        rl.close();
    });
}
