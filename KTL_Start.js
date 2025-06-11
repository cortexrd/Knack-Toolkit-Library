//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();

/* ktlVersion:
 *  - 'x,y,z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version, which is the latest "experimental" code
 *  - if 'beta', will use /Prod/KTL-beta.js version, which is the candidate for next release
*/

var callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = '') {
    const KTL_LATEST_JS_VERSION = '0.32.4';
    const KTL_LATEST_CSS_VERSION = '0.7.15';

    var cssVersion = KTL_LATEST_CSS_VERSION;
    var prodFolder = 'Prod/';
    var ktlSvr = 'https://ctrnd.s3.amazonaws.com/'; //CDN is Cortex R&D Inc server.
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.KnackApp = _KnackApp;
    callback = _callback;
    ktlVersion = (ktlVersion ? ktlVersion : KTL_LATEST_JS_VERSION);
    const lsShortName = Knack.app.attributes.name.substr(0, 6).replace(/ /g, '') + '_' + app_id.substr(-4, 4) + '_';

    //Used to bypass KTL completely, typically to troubleshoot and isolate an issue.  Used with the KTL Developer Tools popup.
    const bypassKtl = (sessionStorage.getItem(lsShortName + 'bypassKtl') !== null);
    if (bypassKtl) {
        callback();
        return;
    }

    let ktlCode = localStorage.getItem(lsShortName + 'ktlCode') || 'prod';

    //Cleanup legacy and update to new naming: remoteDev -> dev
    const legacyRemoteDev = (localStorage.getItem(lsShortName + 'remoteDev') === 'true');
    if (legacyRemoteDev) {
        localStorage.removeItem(lsShortName + 'remoteDev');
        ktlCode = 'dev';
        localStorage.setItem(lsShortName + 'ktlCode', ktlCode);
    }

    //Cleanup legacy and update to new naming: dev -> local
    const legacyDev = localStorage.getItem(lsShortName + 'dev');
    if (legacyDev !== null) {
        localStorage.removeItem(lsShortName + 'dev');
        ktlCode = 'local';
        localStorage.setItem(lsShortName + 'ktlCode', ktlCode);
    }

    if (['dev', 'beta'].includes(ktlCode) || /^\d.*\./.test(ktlCode))
        ktlVersion = ktlCode;

    if (ktlCode === 'local') {
        ktlVersion = '';
        cssVersion = '';
        prodFolder = '';
        fullCode = 'full';
        ktlSvr = 'http://localhost:3000/';

        function checkFileExists(url) {
            return new Promise((resolve, reject) => {
                fetch(url, { method: 'HEAD' })
                    .then(response => resolve(response.ok))
                    .catch(() => resolve(false));
            });
        }

        var fileName = localStorage.getItem(lsShortName + 'fileName');
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
            delete KnackApp;

            if (typeof window.ktlReady === 'function')
                delete window.ktlReady;

            LazyLoad.js([`${appJsFile}`], () => {
                if (typeof window.ktlReady !== 'function') {
                    var srcFileName = prompt(`Can't find source file with ktlReady:\n\n${appJsFile}\n\nWhat is file name (without .js)?\n\nLeave empty for none.`, Knack.app.attributes.name);
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
        fullCode = 'full';
        cssVersion = ktlVersion;
    }

    //Append this to end of filename to force loading new code without requiring Ctrl+F5.
    let bypassCacheSuffix = ktlCode !== 'local' ? `?v=${new Date().getTime()}` : '';

    var cssFile = ktlSvr + 'Lib/KTL/' + prodFolder + (cssVersion ? 'KTL-' + cssVersion : 'KTL') + '.css' + bypassCacheSuffix;
    var ktlFile = ktlSvr + 'Lib/KTL/' + prodFolder + (ktlVersion ? 'KTL-' + ktlVersion : 'KTL') + (fullCode === 'full' ? '' : '.min') + '.js' + bypassCacheSuffix;

    LazyLoad.css([`${cssFile}`], () => {
        LazyLoad.js([`${ktlFile}`], () => {
            if (typeof Ktl === 'function') {
                LazyLoad.js([ktlSvr + 'Lib/KTL/KTL_Defaults' + ((ktlVersion === 'dev' || ktlVersion === 'beta') ? '-' + ktlVersion : '') + '.js'], () => {
                    if (typeof KnackApp === 'function') {
                        KnackApp($, { ktlVersion: ktlVersion, lsShortName: lsShortName });
                    } else
                        alert('Error - KnackApp not found.');

                    callback();
                })
            } else {
                if (ktlCode === 'local') {
                    alert('KTL not found');
                } else {
                    localStorage.setItem(lsShortName + 'ktlCode', 'prod');
                    location.reload(true);
                }
            }
        })
    });
}
