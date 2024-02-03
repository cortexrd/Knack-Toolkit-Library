//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();

/* ktlVersion:
 *  - 'x,y,z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version, which is the latest "experimental" code
*/

var callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = '') {
    const KTL_LATEST_JS_VERSION = '0.22.16';
    const KTL_LATEST_CSS_VERSION = '0.6.7';

    var cssVersion = KTL_LATEST_CSS_VERSION;
    var prodFolder = 'Prod/';
    var ktlSvr = 'https://ctrnd.s3.amazonaws.com/'; //CDN is Cortex R&D Inc server.
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.KnackApp = _KnackApp;
    callback = _callback;
    ktlVersion = (ktlVersion ? ktlVersion : KTL_LATEST_JS_VERSION);
    const lsShortName = Knack.app.attributes.name.substr(0, 6).replace(/ /g, '') + '_' + app_id.substr(-4, 4) + '_';

    //Used to bypass KTL completely, typically to troubleshoot and isolate an issue.  Used with the Knack Dev Tools popup.
    const bypassKtl = (sessionStorage.getItem(lsShortName + 'bypassKtl') !== null);
    if (bypassKtl) {
        callback();
        return;
    }

    //Debug this specific device, if it has the remoteDev entry in localStorage.
    if (localStorage.getItem(lsShortName + 'remoteDev') === 'true')
        ktlVersion = 'dev';

    const localDevMode = (localStorage.getItem(lsShortName + 'dev') !== null);
    if (localDevMode) {
        ktlVersion = '';
        cssVersion = '';
        prodFolder = '';
        fullCode = 'full';
        ktlSvr = 'http://localhost:3000/';

        var fileName = localStorage.getItem(lsShortName + 'fileName');
        if (fileName !== 'NO_APP_FILE') {
            !fileName && (fileName = Knack.app.attributes.name);
            var appUrl = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
            appUrl = encodeURI(appUrl);

            delete KnackApp;

            if (typeof window.ktlReady === 'function')
                delete window.ktlReady;

            LazyLoad.js([appUrl], () => {
                if (typeof window.ktlReady !== 'function') {
                    var srcFileName = prompt(`Can't find source file with ktlReady:\n\n${appUrl}\n\nWhat is file name (without .js)?\n\nLeave empty for none.`, Knack.app.attributes.name);
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

    if (ktlVersion === 'dev') {
        fullCode = 'full';
        cssVersion = 'dev';
    }

    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js']);
    LazyLoad.js(['https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js']); //Docs: https://github.com/SortableJS/Sortable#readme
    var cssFile = ktlSvr + 'Lib/KTL/' + prodFolder + (cssVersion ? 'KTL-' + cssVersion : 'KTL') + '.css';
    var ktlFile = ktlSvr + 'Lib/KTL/' + prodFolder + (ktlVersion ? 'KTL-' + ktlVersion : 'KTL') + (fullCode === 'full' ? '' : '.min') + '.js';

    LazyLoad.css([cssFile], () => {
        LazyLoad.js([ktlFile], () => {
            if (typeof Ktl === 'function') {
                LazyLoad.js([ktlSvr + 'Lib/KTL/KTL_Defaults' + (ktlVersion === 'dev' ? '-dev' : '') + '.js'], () => {
                    if (typeof KnackApp === 'function') {
                        KnackApp($, { ktlVersion: ktlVersion, lsShortName: lsShortName });
                    } else
                        alert('Error - KnackApp not found.');

                    callback();
                })
            } else {
                if (localDevMode) {
                    alert('KTL not found');
                } else {
                    localStorage.removeItem(lsShortName + 'dev'); //JIC
                    location.reload(true);
                }
            }
        })
    });
}
