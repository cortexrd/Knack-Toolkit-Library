//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();
window.lsShortName = Knack.app.attributes.name.substr(0, 6).replaceAll(' ', '') + '_' + app_id.substr(-4, 4) + '_';
var callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = '') {
    const KTL_LATEST_VERSION = '0.7.0';
    var prodFolder = 'Prod/';
    var ktlSvr = 'https://ctrnd.com/'; //CDN is Cortex R&D Inc server.
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.KnackApp = _KnackApp;
    callback = _callback;
    ktlVersion = (ktlVersion ? ktlVersion : KTL_LATEST_VERSION);
    var prod = (localStorage.getItem(window.lsShortName + 'dev') === null);
    if (!prod) {
        ktlVersion = '';
        prodFolder = '';
        var fileName = localStorage.getItem(window.lsShortName + 'fileName');
        !fileName && (fileName = Knack.app.attributes.name);
        ktlSvr = 'http://localhost:3000/';
        var appUrl = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
        appUrl = encodeURI(appUrl);
        if (typeof KnackApp === 'function')
            delete KnackApp;
        LazyLoad.js([appUrl], () => { })
    }

    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js']);
    LazyLoad.js(['https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js']);
    LazyLoad.css([ktlSvr + 'Lib/KTL/KTL.css'], () => { });
    var ktlFile = ktlSvr + 'Lib/KTL/' + prodFolder + (ktlVersion ? 'KTL-' + ktlVersion : 'KTL') + (fullCode === 'full' ? '' : '.min') + '.js';
    LazyLoad.js([ktlFile], () => {
        if (typeof Ktl === 'function') {
            if (prod) {
                if (typeof KnackApp === 'function') {
                    KnackApp($, {});
                    callback();
                } else
                    LazyLoad.js([ktlSvr + 'Lib/KTL/KTL_KnackApp.js'], () => {
                        console.log('Loaded default KnackApp.');
                        KnackApp($, {});
                        callback();
                    });
            } else { //Dev mode
                if (typeof KnackApp === 'function') {
                    KnackApp($, { hostname: ktlSvr });
                    callback();
                } else {
                    var fileName = prompt('Error - Cannot find KnackApp file.\nWhat is file name (without .js)?');
                    localStorage.setItem(window.lsShortName + 'fileName', fileName);
                    location.reload(true);
                }
            }
        } else {
            if (confirm('Error - can\'t locate KTL file:\n' + ktlFile + '\n\nDo you want to switch to Production?')) {
                localStorage.removeItem(window.lsShortName + 'dev');
                location.reload(true);
            }
        }
    })
}

