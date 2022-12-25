//This utility will merge the KTL and your custom Javascript and CSS files into two ACB files.
//Modify the file names/paths to match your needs.
//Version 1.0

const fs = require('fs');

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
    if (!fileName || fileName.includes('.')) {
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

    console.log('ext =', ext);

    if (ext !== 'js' && ext !== 'css') {
        console.log('\n\nERROR: extension must be js or css, without the dot.');
        return;
    }



    const mergedFile = fileName + '_ACB.' + ext;
    fileName += '.' + ext;

    console.log('filename =', fileName);
    console.log('ktlPath =', ktlPath);
    console.log('appname =', appName ? appName : 'Same as Knack');

    if (filesToMerge.length) {
        try {
            if (fs.existsSync(mergedFile))
                fs.truncateSync(mergedFile, 0);

            if (!fs.existsSync(fileName)) {
                console.log('\n\nERROR: ' + fileName + ' - File not found.');
                return;
            }
        } catch (err) {
            console.error(err)
        }

        filesToMerge.push(fileName);
        console.log('filesToMerge =', filesToMerge);

        var data = '';
        for (var index = 0; index < filesToMerge.length; index++) {
            var fileToMerge = filesToMerge[index];
            console.log('Merging file', fileToMerge);
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
            console.log('\nMerged file =', mergedFile);
        }
    }

}


mergeFiles(fileName, 'js', [
    ktlPath + '\\KTL_Bootloader.js', //Order is important!
    ktlPath + '\\KTL.js'
]);

mergeFiles(fileName, 'css', [
    ktlPath + '\\KTL.css'
]);

