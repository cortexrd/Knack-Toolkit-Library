/* KTL Bootloader
 * See documentation on github:  https://github.com/cortexrd/Knack-Toolkit-Library
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license GPLv3
 * 2019-2023
 */
window.ktlStart = window.performance.now();
KnackInitAsync = function ($, callback) {
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.LazyLoad = LazyLoad;
    window.lsShortName = Knack.app.attributes.name.substr(0, 6).replaceAll(' ', '') + '_' + app_id.substr(-4, 4) + '_';
    var ktlSvr = 'https://ctrnd.com/'; //CDN is Cortex R&D Inc server.
    var prod = (localStorage.getItem(window.lsShortName + 'dev') === null);
    if (!prod) {
        var fileName = localStorage.getItem(window.lsShortName + 'fileName');
        !fileName && (fileName = Knack.app.attributes.name);
        ktlSvr = 'http://localhost:3000/';
        var appUrl = ktlSvr + 'KnackApps/' + fileName + '/' + fileName + '.js';
        appUrl = encodeURI(appUrl);
        LazyLoad.js([appUrl], () => { })
    }

    LazyLoad.css([ktlSvr + 'Lib/KTL/KTL.css'], () => { });
    LazyLoad.js([ktlSvr + 'Lib/KTL/KTL.js'], () => {
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
                    var fileName = prompt('Error - Cannot find Knack Dev application.\nWhat is file name (without .js)?');
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
};

////////////////  End of Bootloader  /////////////////////
