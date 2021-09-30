//KTL Bootloader
/**
 * This offers you the option of loading all your libraries and your app code from separate files.
 * A big advantage of this is that you can work directly from your local hard drive
 * during the development phase, which speeds up significatly each
 * save/refresh iteration cycle.
 * To do so, you need ot install NodeJS as a file server on port 3000. * 
 * 
 * See documentation for more details.
 * */
KnackInitAsync = function ($, callback) {
    window.$ = $;
    window.LazyLoad = LazyLoad;

    var svrURL = 'http://localhost:3000/';
    var appPath = 'KnackApps/';
    var appName = Knack.app.attributes.name;
    var ktlPath = 'Lib/KTL/';
    var ktlUrl = '';

    //Assume ACB mode by default, unless KnackApp function is not found.  Then keep testing other locations.
    if (typeof (KnackApp) === 'function') {
        localStorage.removeItem(appName + '_svrURL');
        localStorage.removeItem(appName + '_appPath');
        localStorage.removeItem(appName + '_ktlPath');
        svrURL = '';
        runApp();
    } else {
        //The App does the first pass of detecting the code location so the iFrameWnd doesn't have to do it again.
        //This also prevents repeated net::ERR_CONNECTION_REFUSED errors due to iFrameWnd refreshing periodically.
        if (!window.self.frameElement) {
            LazyLoad.js([svrURL + appPath + appName + '.js'], () => {
                if (typeof (KnackApp) === 'function') {
                    runApp();
                } else {
                    //Put your favorite CDN and set paths accordingly
                    svrURL = 'https://ctrnd.com/';
                    appPath = 'KnackApps/';
                    LazyLoad.js([svrURL + appPath + appName + '.js'], () => {
                        if (typeof (KnackApp) === 'function') {
                            ktlPath = 'jsLibs/KTL/';
                        } else {
                            localStorage.removeItem(appName + '_svrURL');
                            localStorage.removeItem(appName + '_appPath');
                            localStorage.removeItem(appName + '_ktlPath');
                            svrURL = '';
                        }
                        runApp();
                    })
                }
            })
        } else { //iframe
            svrURL = localStorage.getItem(appName + '_svrURL');
            appPath = localStorage.getItem(appName + '_appPath');
            ktlPath = localStorage.getItem(appName + '_ktlPath');
            svrURL && LazyLoad.js([svrURL + appPath + appName + '.js'], () => { runApp(); })
        }
    }

    function runApp() {
        var lib = new libLoader();
        lib.insertLibrary('blockUI', 'https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js'); // Comes from here:  http://malsup.com/jquery/block/
        lib.insertLibrary('Sortable', 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js'); // Comes from here:  https://github.com/SortableJS/Sortable

        if (svrURL) {
            localStorage.setItem(appName + '_svrURL', svrURL);
            localStorage.setItem(appName + '_appPath', appPath);
            localStorage.setItem(appName + '_ktlPath', ktlPath);
            ktlUrl = svrURL + ktlPath + 'ktl.js';
            lib.insertLibrary('ktl', ktlUrl);
            LazyLoad.css([svrURL + ktlPath + 'ktl.css'], () => { });
        }

        lib.loadLibrary('jquery', 'blockUI', 'Sortable', 'ktl', function () {
            if (typeof (KnackApp) === 'function') {
                KnackApp($, {
                    local: ktlUrl.includes('localhost') ? 'local' : '',
                });
                callback();
            } else
                alert('Error - Cannot find Knack application...');
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







