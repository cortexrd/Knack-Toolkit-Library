//KTL Bootloader
/**
 * This offers you the option of loading all your libraries and your app code from separate files.
 * A big advantage of this is that you can work directly from your local hard drive
 * during the development phase, which speeds up significatly each
 * save/refresh iteration cycle.
 * To do so, you need to install NodeJS and run a simple file server script on port 3000. * 
 * 
 * See documentation for more details on github:  https://github.com/cortexrd/Knack-Toolkit-Library
 * 
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license GPLv3
 * 2019-2022
 * */

KnackInitAsync = function ($, callback) {
    window.$ = $;
    window.LazyLoad = LazyLoad;

    //Two options when using local file server: 
    // 1) Basic file server on localhost.  This is simple and only allows testing on your development workstation - which is ok 99% of the time.
    // 2) Secure SSL file server.  This allows you to test on other devices connected to your LAN.  You will need to find your development workstation's IP.
    var svrURL = 'http://localhost:3000/'; //Basic server
    //var svrURL = 'https://192.168.1.106:3000/'; //SSL server

    //This is the actual Knack app name, used by the bootloader only, in local storage to store paths and other stuff.
    var lsAppName = Knack.app.attributes.name;

    //This is the name from the developer's standpoint: folder name and potentially the .js file name.
    //Spaces are not allowed (yet), due to a limitation of the basic file server (NodeJS_FileServer.js).
    var appName = Knack.app.attributes.name;

    //Must match the folder structure as descripbed in the documentation.
    var appPath = 'KnackApps/' + appName + '/';

    //By default, fileName is the same as your App's name.
    //But you can change it by passing a command-line parameter -filename=MyFile.js to the NodeJS_ACB_MergeFiles.js script.
    var fileName = appName + '.js';

    var ktlPath = 'Lib/KTL/';
    var ktlUrl = '';

    //If lsAppName_dev exists, run development code.  If does not exist, run prod code.
    //This is to avoid error 404 not found in console output when using CLS mode, and faster startup time.
    var prod = (localStorage.getItem(lsAppName + '_dev') === null);

    //Assume Prod ACB mode by default.
    if (prod) {
        if (typeof KnackApp === 'function') { //ACB Prod
            localStorage.removeItem(lsAppName + '_svrURL');
            localStorage.removeItem(lsAppName + '_appPath');
            localStorage.removeItem(lsAppName + '_ktlPath');
            svrURL = '';
            runApp();
        } else {
            if (confirm('Error - Cannot find Knack application...\nSwitch to development mode?'))
                localStorage.setItem(lsAppName + '_dev', '');
            location.reload(true);
        }
    } else {
        if (typeof KnackApp === 'function') //First, wipe any existing production code from memory.
            delete KnackApp;

        if (typeof KnackApp === 'function') { //This happens on some servers - under investigation with Knack support, ticket #166218.
            alert('\nERROR - operation "delete KnackApp" has failed.\nCLS mode will not work unless you delete all code after "End of Bootloader" in the Javascript pane.');
            location.reload(true);
        }

        //The App does a first pass of detecting and saving the code location, so the iFrameWnd doesn't have to do it again.
        //This also prevents repeated net::ERR_CONNECTION_REFUSED errors due to iFrameWnd refreshing periodically.
        if (!window.self.frameElement) { //CLS development mode
            if (fileName.includes(' ')) {
                alert('Filename can\'t have spaces');
                return;
            }

            LazyLoad.js([svrURL + appPath + fileName], () => {
                if (typeof KnackApp === 'function') {
                    runApp();
                } else {
                    //Put your favorite CDN and set paths accordingly
                    svrURL = 'https://ctrnd.com/';
                    appPath = 'KnackApps/';
                    LazyLoad.js([svrURL + appPath + fileName], () => {
                        if (typeof KnackApp === 'function') { //CDN Dev
                            ktlPath = 'jsLibs/KTL/';
                        } else { //ACB Prod
                            localStorage.removeItem(lsAppName + '_svrURL');
                            localStorage.removeItem(lsAppName + '_appPath');
                            localStorage.removeItem(lsAppName + '_ktlPath');
                            svrURL = '';
                        }
                        runApp();
                    })
                }
            })
        } else { //iframe
            svrURL = localStorage.getItem(lsAppName + '_svrURL');
            appPath = localStorage.getItem(lsAppName + '_appPath');
            ktlPath = localStorage.getItem(lsAppName + '_ktlPath');
            svrURL && LazyLoad.js([svrURL + appPath + fileName], () => { runApp(); })
        }
    }

    function runApp() {
        var lib = new libLoader();
        lib.insertLibrary('blockUI', 'https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js'); // Comes from here:  http://malsup.com/jquery/block/
        lib.insertLibrary('Sortable', 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js'); // Comes from here:  https://github.com/SortableJS/Sortable

        if (svrURL) {
            localStorage.setItem(lsAppName + '_svrURL', svrURL);
            localStorage.setItem(lsAppName + '_appPath', appPath);
            localStorage.setItem(lsAppName + '_ktlPath', ktlPath);
            ktlUrl = svrURL + ktlPath + 'ktl.js';
            lib.insertLibrary('ktl', ktlUrl);
            LazyLoad.css([svrURL + ktlPath + 'ktl.css'], () => { });
        }

        lib.loadLibrary('jquery', 'blockUI', 'Sortable', 'ktl', function () {
            if (prod) {
                if (typeof KnackApp === 'function')
                    KnackApp($, { hostname: 'ACB' });
                else
                    alert('Error - Cannot find Knack application...');
            } else {
                if (typeof KnackApp === 'function')
                    KnackApp($, { hostname: svrURL });
                else {
                    alert('Error - Cannot find Knack Dev application.\nReverting to Production version.');
                    if (typeof KnackApp === 'function')
                        KnackApp($, { hostname: svrURL });
                }
            }

            callback();
        });
    }
};

/**
 * Lib Loader manages all libraries required by the app.
 * 
 * Credits:
 * This code has been borrowed from Soluntech
 * with their kind authorization - thanks to them :)
 * 
 * Luis Miguel Bula Mora <info@soluntech.com>
 * Soluntech - 2017
 * www.soluntech.com
 * */
var libLoader = function () {
    this.jQuery = window.$;

    this.libraries = {
        jquery: {
            url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js',
            loaded: false,
            objectName: 'jQuery'
        }
    };

    // Check compatibility
    this.assert(Knack || window.Knack, 'Error, this library only run on Knack applications');
    this.assert(this.jQuery, 'Error, jQuery instance is required');
};

Object.defineProperty(libLoader.prototype, '$', {
    get: function () {
        return window.jQuery || this.jQuery || window.$;
    }
});

libLoader.prototype.assert = function (cond, message) {
    if (!cond) {
        throw new Error(message);
    }
};

libLoader.prototype.load = function (libs, callback) {
    var self = this;
    LazyLoad.js(libs, function () {
        callback.call(self);
    });
};

libLoader.prototype.loadLibrary = function () {
    var args = Array.prototype.slice.call(arguments);
    var callback = args.pop();
    var libs = [];
    var _library;
    var self = this;

    args.forEach(function (library) {
        _library = self.libraries[library];
        if (_library && !_library.loaded) {
            _library.loaded = true;
            libs.push(_library.url);
        }
    });

    if (!libs.length) {
        return callback.call(this);
    }

    this.load(libs, callback);
};

libLoader.prototype.libraryIsLoaded = function (libraryName) {
    var library = this.libraries[libraryName];
    if (!library)
        return false;
    else
        return library.loaded;
};

libLoader.prototype.insertLibrary = function (libraryName, url) {
    var library = this.libraries[libraryName];
    if (library) {
        return;
    }

    this.libraries[libraryName] = {
        url: url,
        loaded: false
    };
};

libLoader.prototype.librariesRequired = function () {
    var args = Array.prototype.slice.call(arguments);
    var self = this;
    var library;

    args.forEach(function (libraryName) {
        library = self.libraries[libraryName];
        self.assert(library, 'Library "' + libraryName + '" doesn\'t exist');
        self.assert(window[library.objectName], 'Library "' + libraryName + '" is required');
    });
};

////////////////  End of Bootloader  /////////////////////


