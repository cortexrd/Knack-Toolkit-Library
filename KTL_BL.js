//KTL Bootloader, second stage: Prod and Dev modes switcher.
//window.ktlStart = window.performance.now();
window.lsShortName = Knack.app.attributes.name.substr(0, 6).replaceAll(' ', '') + '_' + app_id.substr(-4, 4) + '_';
var ktlSvr = 'https://ctrnd.com/'; //CDN is Cortex R&D Inc server.
var callback;
var KnackApp;
var ktlVersion = '';
function loadKtl($, _callback, _KnackApp, _ktlVersion = '', _fullCode = '') {
    window.$ = $;
    window.jQuery = $; //For BlockUI
    callback = _callback;
    KnackApp = _KnackApp;
    ktlVersion = _ktlVersion;

    var prod = (localStorage.getItem(window.lsShortName + 'dev') === null);
    if (!prod) {
        ktlVersion = '';
        var fileName = localStorage.getItem(window.lsShortName + 'fileName');
        !fileName && (fileName = Knack.app.attributes.name);
        ktlSvr = 'http://localhost:3000/';
        var appUrl = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
        appUrl = encodeURI(appUrl);
        LazyLoad.js([appUrl], () => { })
    }

    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js']);
    LazyLoad.js(['https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js']);
    LazyLoad.css([ktlSvr + 'Lib/KTL/KTL.css'], () => { });
    var ktlFile = ktlSvr + 'Lib/KTL/KTL' + (ktlVersion ? '-' + ktlVersion : '') + (_fullCode === 'full' ? '' : '.min') + '.js';
    //console.log('ktlFile =', ktlFile);
    LazyLoad.js([ktlFile], () => {
        if (typeof Ktl === 'function') {
            if (prod) {
                if (typeof KnackApp === 'function')
                    KnackApp($, {});
                else
                    LazyLoad.js([ktlSvr + 'Lib/KTL/KTL_KnackApp.js'], () => {
                        console.log('Loaded default KnackApp.');
                        KnackApp($, {});
                    });
            } else { //Dev mode
                if (typeof KnackApp === 'function')
                    KnackApp($, { hostname: ktlSvr });
                else {
                    var fileName = prompt('Error - Cannot find KnackApp file.\nWhat is file name (without .js)?');
                    localStorage.setItem(window.lsShortName + 'fileName', fileName);
                    location.reload(true);
                }
            }

            callback();
        } else
            if (confirm('Error - can\'t load KTL.  Do you want to switch to Production?')) {
                localStorage.removeItem(window.lsShortName + 'dev');
                location.reload(true);
            }
    })
}

