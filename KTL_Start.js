//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();

/* ktlVersion:
 *  - 'x,y,z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version, which is same as dev, copied by FTP.  See C:\code\FTP\WinSCP_Script.txt
*/

var callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = '') {
    const KTL_LATEST_JS_VERSION = '0.7.9';
    const KTL_LATEST_CSS_VERSION = '0.2.1';


    var cssVersion = KTL_LATEST_CSS_VERSION;
    var prodFolder = 'Prod/';
    var ktlSvr = 'https://ctrnd.com/'; //CDN is Cortex R&D Inc server.
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.KnackApp = _KnackApp;
    callback = _callback;
    ktlVersion = (ktlVersion ? ktlVersion : KTL_LATEST_JS_VERSION);
    const lsShortName = Knack.app.attributes.name.substr(0, 6).replace(/ /g, '_') + '_' + app_id.substr(-4, 4) + '_';
    var prod = (localStorage.getItem(lsShortName + 'dev') === null);
    if (!prod) {
        ktlVersion = '';
        cssVersion = '';
        prodFolder = '';
        fullCode = 'full';
        var fileName = localStorage.getItem(lsShortName + 'fileName');
        !fileName && (fileName = Knack.app.attributes.name);
        ktlSvr = 'http://localhost:3000/';
        var appUrl = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
        appUrl = encodeURI(appUrl);
        if (typeof KnackApp === 'function')
            delete KnackApp;
        LazyLoad.js([appUrl], () => { })
    }

    if (ktlVersion === 'dev')
        cssVersion = 'dev';

    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js']);
    LazyLoad.js(['https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js']);
    var cssFile = ktlSvr + 'Lib/KTL/' + prodFolder + (cssVersion ? 'KTL-' + cssVersion : 'KTL') + '.css';
    var ktlFile = ktlSvr + 'Lib/KTL/' + prodFolder + (ktlVersion ? 'KTL-' + ktlVersion : 'KTL') + (fullCode === 'full' ? '' : '.min') + '.js';

    LazyLoad.css([cssFile], () => { });
    LazyLoad.js([ktlFile], () => {
        if (typeof Ktl === 'function') {
            if (prod) {
                if (typeof KnackApp === 'function') {
                    KnackApp($, { ktlVersion: ktlVersion, lsShortName: lsShortName });
                    callback();
                } else
                    LazyLoad.js([ktlSvr + 'Lib/KTL/KTL_KnackApp.js'], () => {
                        console.log('Loaded default KnackApp.');
                        KnackApp($, { ktlVersion: ktlVersion, lsShortName: lsShortName });
                        callback();
                    });
            } else { //Dev mode
                if (typeof KnackApp === 'function') {
                    KnackApp($, { hostname: ktlSvr, ktlVersion: ktlVersion, lsShortName: lsShortName });
                    callback();
                } else {
                    var fileName = prompt('Error - Cannot find KnackApp file.\nWhat is file name (without .js)?');
                    localStorage.setItem(lsShortName + 'fileName', fileName);
                    location.reload(true);
                }
            }
        } else {
            if (prod) {
                console.log("Error - can't locate KTL file:\n" + ktlFile);
                localStorage.removeItem(lsShortName + 'dev'); //JIC
                location.reload(true);
            }
        }
    })
}

