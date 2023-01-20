/* KTL Bootloader
 * See documentation on github:  https://github.com/cortexrd/Knack-Toolkit-Library
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license GPLv3
 * 2019-2023
 */

var start = window.performance.now();
KnackInitAsync = function ($, callback) {
    window.$ = $;
    window.LazyLoad = LazyLoad;
    window.lsShortName = Knack.app.attributes.name.substr(0, 6).replaceAll(' ', '') + '_' + app_id.substr(-4, 4) + '_';
    var ktlSvr = 'https://ctrnd.com/'; //CDN is Cortex R&D Inc server.
    var appName = Knack.app.attributes.name;
    var appPath = 'KnackApps/' + appName + '/'; //Must match the folder structure as descripbed in the documentation.
    var ktlPath = 'Lib/KTL/';
    LazyLoad.css([ktlSvr + ktlPath + 'KTL.css'], () => { });
    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js']);
    LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.blockUI/2.70/jquery.blockUI.min.js']);
    LazyLoad.js(['https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js']);
    var prod = (localStorage.getItem(window.lsShortName + 'dev') === null);
    if (!prod) {
        ktlSvr = 'http://localhost:3000/';
        var appUrl = ktlSvr + appPath + appName + '.js';
        appUrl = encodeURI(appUrl.trim());
        LazyLoad.js([appUrl], () => { })
    }

    LazyLoad.js([ktlSvr + ktlPath + 'KTL.min.js'], () => {
        if (typeof Ktl === 'function') {
            if (prod) {
                if (typeof KnackApp === 'function')
                    KnackApp($, { hostname: 'ACB' });
                else {
                    if (confirm('Error - Can\'t find Knack application...\nSwitch to development mode?'))
                        localStorage.setItem(window.lsShortName + 'dev', '');
                    location.reload(true);
                }
            } else { //Dev mode
                if (typeof KnackApp === 'function')
                    KnackApp($, { hostname: ktlSvr });
                else {
                    alert('Error - Cannot find Knack Dev application.\nReverting to Production version.');
                    localStorage.removeItem(window.lsShortName + 'dev');
                    location.reload(true);
                }
            }

            var end = window.performance.now();
            console.log(`KTL Loading time: ${end - start} ms`);
            callback();
        } else
            if (confirm('Error - can\'t load KTL.  Do you want to retry?'))
                location.reload(true);
    })
};

////////////////  End of Bootloader  /////////////////////


