//KTL and App Starter.  Also enables switching between Prod and Dev modes.
//window.ktlStart = window.performance.now();

/* ktlVersion:
 *  - 'x,y,z' will use that specific Prod version.
 *  - if empty, will use the latest Prod version from KTL_LATEST_JS_VERSION.
 *  - if 'dev', will use /Prod/KTL-dev.js version, which is same as dev, copied by FTP.  See C:\code\FTP\WinSCP_Script.txt
*/

var callback;
function loadKtl($, _callback, _KnackApp, ktlVersion = '', fullCode = '') {
    const KTL_LATEST_JS_VERSION = '0.10.20';
    const KTL_LATEST_CSS_VERSION = '0.2.8';

    //Extract all keywords form app structure.
    for (var i = 0; i < Knack.scenes.models.length; i++) {
        var scn = Knack.scenes.models[i];
        var views = scn.views;
        for (var j = 0; j < views.models.length; j++) {
            var view = views.models[j];
            if (view) {
                var keywords = {};
                var attr = view.attributes;
                var title = attr.title;
                var cleanedUpTitle = title;
                var firstKeywordIdx;
                if (title) {
                    firstKeywordIdx = title.toLowerCase().search(/(?:^|\s)(_[a-zA-Z0-9]\w*)/m);
                    if (firstKeywordIdx >= 0) {
                        cleanedUpTitle = title.substring(0, firstKeywordIdx);
                        parseKeywords(keywords, title.substring(firstKeywordIdx).trim());
                    }
                }

                var description = attr.description;
                var cleanedUpDescription = description;
                if (description) {
                    firstKeywordIdx = description.toLowerCase().search(/(?:^|\s)(_[a-zA-Z0-9]\w*)/m);
                    if (firstKeywordIdx >= 0) {
                        cleanedUpDescription = description.substring(0, firstKeywordIdx);
                        parseKeywords(keywords, description.substring(firstKeywordIdx).trim());
                    }
                }

                //Only write once - first time, when not yet existing.
                !attr.orgTitle && (attr.orgTitle = attr.title);
                !attr.keywords && (attr.keywords = keywords);

                attr.title = cleanedUpTitle;
                attr.description = cleanedUpDescription;
            }
        }
    }

    function parseKeywords(keywords, strToParse) {
        var kwAr = [];
        if (strToParse && strToParse !== '') {
            var kwAr = strToParse.split(/(?:^|\s)(_[a-zA-Z0-9_]{2,})/gm);
            kwAr.splice(0, 1);
            for (var i = 0; i < kwAr.length; i++) {
                kwAr[i] = kwAr[i].trim();
                parseParams(kwAr[i], i);
            }
        }

        function parseParams(kwString, kwIdx) {
            var kw = [];
            if (kwAr[i].startsWith('_')) {
                keywords[kwAr[i].toLowerCase()] = [];
                return;
            } else if (kwAr[i].startsWith('='))
                kw = kwString.split('=');

            var params = [];
            if (kw.length > 1) {
                params = kw[1].split(',');
                params.forEach((param, idx) => {
                    params[idx] = param.trim();
                })
            }

            keywords[kwAr[kwIdx - 1].toLowerCase()] = params;
        }
    }

    this.parseKeywords = parseKeywords;

    var cssVersion = KTL_LATEST_CSS_VERSION;
    var prodFolder = 'Prod/';
    var ktlSvr = 'https://ctrnd.com/'; //CDN is Cortex R&D Inc server.
    window.$ = $;
    window.jQuery = $; //For BlockUI
    window.KnackApp = _KnackApp;
    callback = _callback;
    ktlVersion = (ktlVersion ? ktlVersion : KTL_LATEST_JS_VERSION);
    const lsShortName = Knack.app.attributes.name.substr(0, 6).replace(/ /g, '') + '_' + app_id.substr(-4, 4) + '_';

    //Debug this specific device, if it has the remoteDev entry in localStorage.
    if (localStorage.getItem(lsShortName + 'remoteDev') === 'true')
        ktlVersion = 'dev';

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
        if (typeof KnackApp === 'function') {
            delete KnackApp;
            KnackApp = undefined; //Required for those account where the delete doesn't work.
        }
        LazyLoad.js([appUrl], () => { })
    }

    if (ktlVersion === 'dev') {
        fullCode = 'full';
        cssVersion = 'dev';
    }

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
                        //console.log('Loaded default KnackApp.');
                        KnackApp($, { ktlVersion: ktlVersion, lsShortName: lsShortName });
                        callback();
                    });
            } else { //Dev mode
                if (typeof KnackApp === 'function') {
                    KnackApp($, { hostname: ktlSvr, ktlVersion: ktlVersion, lsShortName: lsShortName });
                    callback();
                } else {
                    var fileName = prompt('Error - Cannot find KnackApp file:\n' + appUrl + '\nWhat is file name (without .js)?');
                    if (fileName) {
                        localStorage.setItem(lsShortName + 'fileName', fileName);
                        location.reload(true);
                    } else {
                        localStorage.removeItem(lsShortName + 'dev'); //JIC
                        alert('Reverting to Prod mode.');
                        location.reload(true);
                    }
                }
            }
        } else {
            if (prod) {
                if (typeof Android !== 'undefined')
                    alert("Error - can't locate KTL file:\n" + ktlFile);

                console.log("Error - can't locate KTL file:\n" + ktlFile);
                localStorage.removeItem(lsShortName + 'dev'); //JIC
                location.reload(true);
            }
        }
    })
}

