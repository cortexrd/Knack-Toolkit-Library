//This is a small utility I've created to merge some Javascript files quickly.
//Modify the file names/paths to match your needs.

const fs = require('fs');

var fileName = ''; //Required, must include the .js extension and have no spaces.
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

var mergedFile = fileName.replace('.js', '') + '_ACB.js'; //Output file.

function mergeFiles(mergedFile, filesToMerge = []) {
    if (!fileName) {
        console.log('\n\nERROR: filename must be specified, with its .js extension.');
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

    console.log('filename =', fileName);
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

        var data = '';
        for (var index = 0; index < filesToMerge.length; index++) {
            var fileToMerge = filesToMerge[index];
            console.log('Merging file', fileToMerge);
            data = fs.readFileSync(fileToMerge, 'utf8');

            if (index === 0) { //Bootloader
                if (appName)
                    data = data.replace("var appName = Knack.app.attributes.name;", "var appName = '" + appName + "';");
                if (fileName)
                    data = data.replace("var fileName = appName + '.js';", "var fileName = '" + fileName + "';");
            }

            fs.appendFileSync(mergedFile, data);
        }
    }

}


mergeFiles(mergedFile, [
    ktlPath + '\\KTLBootloader.js', //Order is important!
    ktlPath + '\\ktl.js',
    (fileName || (appName ? (appName + '.js') : ''))

]);

console.log('\nOutput merged file =', mergedFile);
