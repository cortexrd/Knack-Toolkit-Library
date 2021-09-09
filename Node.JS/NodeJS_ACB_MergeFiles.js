//This is a small utility I've created to merge some Javascript files quickly.
//Modify the file names/paths to match your needs.

const fs = require('fs');

var mergedFile = 'ACB_MyApp.js';
function mergeFiles(mergedFile, filesToMerge = []) {
    if (filesToMerge.length) {
        for (var index = 0; index < filesToMerge.length; index++) {
            var fileToMerge = filesToMerge[index];
            console.log('fileToMerge =', fileToMerge);//$$$

            var data = fs.readFileSync(fileToMerge);
            fs.appendFileSync(mergedFile, data);
        }
    }
}

mergeFiles(mergedFile, [
    '.\\Lib\\KTL\\KnackBootloader.js',
    '.\\Lib\\KTL\\KnackToolkitLibrary.js',
    '.\\Lib\\KTL\\KTLSetup.js'
 	]);
