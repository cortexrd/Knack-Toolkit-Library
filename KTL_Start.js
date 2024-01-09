//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();

/* ktlVersion:
 *  - 'x,y,z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version, which is same as dev, copied by FTP.  See C:\code\FTP\WinSCP_Script.txt
*/

var callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = '') {
    const KTL_LATEST_JS_VERSION = '0.21.1';
    const KTL_LATEST_CSS_VERSION = '0.6.0';

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
        var fileName = localStorage.getItem(lsShortName + 'fileName');
        !fileName && (fileName = Knack.app.attributes.name);
        ktlSvr = 'http://localhost:3000/';
        var appUrl = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
        appUrl = encodeURI(appUrl);

        delete KnackApp; //JIC, for users before the transition.  To be deleted in a few weeks.  Today: May 30, 2023.

        if (typeof window.ktlReady === 'function')
            delete window.ktlReady;

        LazyLoad.js([appUrl], () => {
            if (typeof window.ktlReady !== 'function') {
                var srcFileName = prompt('Error - Cannot find source file with ktlReady:\n' + appUrl + '\nWhat is file name (without .js)?', Knack.app.attributes.name);
                if (srcFileName) {
                    localStorage.setItem(lsShortName + 'fileName', srcFileName);
                    location.reload(true);
                } else {
                    localStorage.removeItem(lsShortName + 'dev'); //JIC
                    alert('Reverting to Prod mode.');
                    location.reload(true);
                }
            }
        })
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
