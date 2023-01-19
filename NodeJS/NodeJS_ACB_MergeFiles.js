//This utility will merge the KTL's Bootloader and your custom Javascript into an ACB file.
//Modify the file name and path to match your needs, if you deviate from the recommended defaults.
//Version 1.0

const fs = require('fs');
const path = require("path");

var fileName = ''; //Required, without extension and no spaces.
var ktlPath = '..\\..\\Lib\\KTL'; //Optional, used when calling from a directory other than KnackApps.  If omitted, will use same default as per docs.

process.argv.forEach(function (val, index, array) {
    if (val.includes('-filename=')) {
        fileName = val.replace('-filename=', '');
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

    console.log('STARTING MERGE...........');

    if (ext !== 'js' && ext !== 'css') {
        console.log('\x1b[31m%s\x1b[0m', '\n\nERROR: extension must be js or css, without the dot.');
        return;
    }


    var folder = process.cwd();
    console.log('Folder =', folder);

    const mergedFile = fileName + '_ACB.' + ext;
    fileName += '.' + ext;

    console.log('Extension:\t', ext);
    console.log('Filename:\t', fileName);
    console.log('ktlPath:\t%s\n', ktlPath);

    if (filesToMerge.length) {
        try {
            if (fs.existsSync(mergedFile))
                fs.truncateSync(mergedFile, 0);
        } catch (err) {
            console.error(err)
        }

        filesToMerge.push(fileName);
        console.log('\x1b[36m%s\x1b[0m', 'filesToMerge = ' + JSON.stringify(filesToMerge, null, 4) + '\n');

        var data = '';
        for (var index = 0; index < filesToMerge.length; index++) {
            var fileToMerge = filesToMerge[index];
            console.log('Merging file\t', fileToMerge);

            if (!fs.existsSync(fileToMerge)) {
                console.log('\x1b[31m%s\x1b[0m', '\n\nERROR: ' + fileToMerge + ' - File not found.');
                return;
            }

            data = fs.readFileSync(fileToMerge, 'utf8');
            fs.appendFileSync(mergedFile, data);
        }

        try {
            var absolutePath = path.resolve(mergedFile);
            const stats = fs.statSync(absolutePath)
            console.log('\x1b[36m%s\x1b[0m', '\nMerged file:\t ' + absolutePath);
            console.log('\x1b[33m%s\x1b[0m', 'File size:\t ' + stats.size + ' bytes\n');
            console.log('\x1b[32m%s\x1b[0m', 'Operation completed successfully');
        } catch (err) {
			console.log('\x1b[31m%s\x1b[0m', '\nERROR occurred while merging files!');
            console.log('\x1b[31m%s\x1b[0m', err);
        }
    }
}

console.clear();
mergeFiles(fileName, 'js', [ktlPath + '\\KTL_Bootloader.js']);
