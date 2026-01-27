//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();

/* ktlVersion:
 *  - 'x,y,z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version, which is the latest "experimental" code
 *  - if 'beta', will use /Prod/KTL-beta.js version, which is the candidate for next release
*/

let callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = 'min', noCacheBust = false) {
    const KTL_LATEST_JS_VERSION = '0.39.0';
    const KTL_LATEST_CSS_VERSION = '0.11.0';

    let cssVersion = KTL_LATEST_CSS_VERSION;
    let prodFolder = 'Prod/';
    let ktlSvr = 'https://ctrnd.s3.amazonaws.com/'; //CDN is Cortex R&D Inc server.
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.KnackApp = _KnackApp;
    callback = _callback;
    const lsShortName = Knack.app.attributes.name.substr(0, 6).replace(/ /g, '') + '_' + app_id.substr(-4, 4) + '_';

    //Used to bypass KTL completely, typically to troubleshoot and isolate an issue.  Used with the KTL Developer Tools popup.
    const bypassKtl = (sessionStorage.getItem(lsShortName + 'bypassKtl') !== null);
    if (bypassKtl) {
        callback();
        return;
    }

    let ktlCode = localStorage.getItem(lsShortName + 'ktlCode');

    if (ktlCode === null || ktlCode === 'prod') {
        ktlVersion = (ktlVersion ? ktlVersion : KTL_LATEST_JS_VERSION);
    } else if (['dev', 'beta'].includes(ktlCode) || /^\d.*\./.test(ktlCode)) {
        ktlVersion = ktlCode; //Use 'dev', 'beta', or specific version.
    }

    if (ktlCode === 'local') {
        ktlVersion = '';
        cssVersion = '';
        prodFolder = '';
        fullCode = 'forcefull';
        ktlSvr = 'http://localhost:3000/';

        function checkFileExists(url) {
            return new Promise((resolve, reject) => {
                fetch(url, { method: 'HEAD' })
                    .then(response => resolve(response.ok))
                    .catch(() => resolve(false));
            });
        }

        let fileName = localStorage.getItem(lsShortName + 'fileName');
        if (fileName !== 'NO_APP_FILE') {
            !fileName && (fileName = Knack.app.attributes.name);
            let appJsFile = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
            appJsFile = encodeURI(appJsFile);

            //Replace CSS from Builder by local file, if it exists.
            let appCSSFile = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.css';
            appCSSFile = encodeURI(appCSSFile);
            checkFileExists(appCSSFile).then(exists => {
                if (exists) {
                    // Replace CSS from Builder by local file
                    const cssText = document.querySelector('#kn-custom-css');
                    if (cssText) {
                        cssText.textContent = '';
                    } else {
                        const cssFile = document.querySelector('link[href*="main.css"]');
                        if (cssFile)
                            cssFile.disabled = true;
                    }
                    LazyLoad.css([`${appCSSFile}`]);
                }
            });

            //Replace JAVASCRIPT from Builder by local file.
            delete window.KnackApp;

            if (typeof window.ktlReady === 'function')
                delete window.ktlReady;

            LazyLoad.js([`${appJsFile}`], () => {
                if (typeof window.ktlReady !== 'function') {
                    let srcFileName = prompt(`Can't find source file with ktlReady:\n\n${appJsFile}\n\nWhat is file name (without .js)?\n\nLeave empty for none.`, Knack.app.attributes.name);
                    if (srcFileName === null) {
                        localStorage.removeItem(lsShortName + 'dev');
                        alert('Reverting to Prod mode.');
                        location.reload(true);
                    } else if (srcFileName !== '') {
                        localStorage.setItem(lsShortName + 'fileName', srcFileName);
                        location.reload(true);
                    } else
                        localStorage.setItem(lsShortName + 'fileName', 'NO_APP_FILE');
                }
            })
        }
    }

    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js']);
    LazyLoad.js(['https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js']); //Docs: https://github.com/SortableJS/Sortable#readme

    if (ktlVersion === 'dev' || ktlVersion === 'beta') {
        fullCode = 'forcefull';
        cssVersion = ktlVersion;
    }

    function loadFilesAndRunApp() {
        //Append this to end of filename to force loading new code without requiring Ctrl+F5.
        let bypassCacheSuffix = (!noCacheBust && ktlCode !== 'local') ? `?v=${new Date().getTime()}` : '';

        let cssFile = ktlSvr + 'Lib/KTL/' + prodFolder + (cssVersion ? 'KTL-' + cssVersion : 'KTL') + '.css' + bypassCacheSuffix;
        let ktlFile = ktlSvr + 'Lib/KTL/' + prodFolder + (ktlVersion ? 'KTL-' + ktlVersion : 'KTL') + (fullCode === 'forcefull' ? '' : '.min') + '.js' + bypassCacheSuffix;

        LazyLoad.css([`${cssFile}`], () => {
            LazyLoad.js([`${ktlFile}`], () => {
                if (typeof Ktl === 'function') {
                    LazyLoad.js([ktlSvr + 'Lib/KTL/KTL_Defaults' + ((ktlVersion === 'dev' || ktlVersion === 'beta') ? '-' + ktlVersion : '') + '.js'], () => {
                        if (typeof window?.KnackApp === 'function') {
                            window.KnackApp($, { ktlVersion: ktlVersion, lsShortName: lsShortName });
                        } else
                            alert('Error - KnackApp not found.');

                        callback();
                    })
                } else {
                    if (ktlCode === 'local') {
                        alert('KTL not found');
                    } else {
                        //Use case when numbered version doesn't exist anymore due to AWS archives monthly cleanup.
                        //Reload KTL one more time, but with latest prod version.
                        ktlVersion = KTL_LATEST_JS_VERSION;
                        loadFilesAndRunApp();
                    }
                }
            })
        });
    }

    loadFilesAndRunApp();
}
