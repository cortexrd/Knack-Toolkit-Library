//This utility will merge the KTL and your custom Javascript and CSS files into two ACB files.
//Modify the file names/paths to match your needs.
//Version 1.0

const fs = require('fs');
const path = require("path");

var fileName = ''; //Required, without extension and no spaces.
var appName = ''; //Optional, must and have no spaces.  If omitted, will use same as Knack app.
var ktlPath = '..\\..\\Lib\\KTL'; //Optional, used when calling from a directory other than KnackApps.  If omitted, will use same default as per docs.

process.argv.forEach(function (val, index, array) {
    if (val.includes('-filename=')) {
        fileName = val.replace('-filename=', '');
    } else if (val.includes('-appname=')) {
        appName = val.replace('-appname=', '');
    } else if (val.includes('-ktlpath=')) {
        ktlPath = val.replace('-ktlpath=', '');
    }
});

function mergeFiles(fileName = '', ext = '', filesToMerge = []) {
    if (!fileName || fileName.includes('.js') || fileName.includes('.css')) {
        console.log('\n\nERROR: filename must be specified, without extension.');
        return;
    }

    if (fileName.includes(' ')) {
        console.log('\n\nERROR: filename can\'t have spaces.');
        return;
    }

    if (appName.includes(' ')) {
        console.log('\n\nERROR: appname can\'t have spaces.');
        return;
    }

    console.log('STARTING MERGE...........');

    if (ext !== 'js' && ext !== 'css') {
        console.log('\n\nERROR: extension must be js or css, without the dot.');
        return;
    }


    var folder = process.cwd();
    console.log('folder =', folder);

    const mergedFile = fileName + '_ACB.' + ext;
    fileName += '.' + ext;

    console.log('extension:\t', ext);
    console.log('filename:\t', fileName);
    console.log('ktlPath:\t', ktlPath);
    console.log('appname:\t', appName ? appName : 'Same as Knack');

    if (filesToMerge.length) {
        try {
            if (fs.existsSync(mergedFile))
                fs.truncateSync(mergedFile, 0);
        } catch (err) {
            console.log('222', err);
            console.error(err)
        }

        filesToMerge.push(fileName);
        console.log('filesToMerge =', filesToMerge);

        var data = '';
        for (var index = 0; index < filesToMerge.length; index++) {
            var fileToMerge = filesToMerge[index];
            console.log('Merging file\t', fileToMerge);

            if (!fs.existsSync(fileToMerge)) {
                if (ext === 'css') //css can be omitted legitimately, when not needed.
                    continue;
                else {
                    console.log('\n\nERROR: ' + fileToMerge + ' - File not found.');
                    return;
                }
            }

            data = fs.readFileSync(fileToMerge, 'utf8');

            if (ext === 'js') {
                if (index === 0) { //Bootloader
                    if (appName)
                        data = data.replace("var appName = Knack.app.attributes.name;", "var appName = '" + appName + "';");
                    if (fileName)
                        data = data.replace("var fileName = appName + '.js';", "var fileName = '" + fileName + "';");
                }

            }

            fs.appendFileSync(mergedFile, data);
        }

        try {
            var absolutePath = path.resolve(mergedFile);
            const stats = fs.statSync(absolutePath)
            console.log('\x1b[36m%s\x1b[0m', '\nMerged file:\t ' + absolutePath);
            console.log('\x1b[33m%s\x1b[0m', 'File size:\t ' + stats.size + ' bytes\n\n');
        } catch (err) {
            console.log(err)
        }
    }
}

console.clear();

mergeFiles(fileName, 'js', [
    ktlPath + '\\KTL_Bootloader.js', //Order is important!
    ktlPath + '\\KTL.js'
]);

mergeFiles(fileName, 'css', [
    ktlPath + '\\KTL.css'
]);

console.log('Press any key to exit');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', process.exit.bind(process, 0));
