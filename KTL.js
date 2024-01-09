/**
 * Knack Toolkit Library (ktl) - Javascript
 * See documentation for more details on github:  https://github.com/cortexrd/Knack-Toolkit-Library
 *
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license MIT
 * 2019-2023
 * */

const IFRAME_WND_ID = 'iFrameWnd';
window.IFRAME_WND_ID = IFRAME_WND_ID;

const TEN_SECONDS_DELAY = 10000;
const ONE_MINUTE_DELAY = 60000;
const FIVE_MINUTES_DELAY = ONE_MINUTE_DELAY * 5;
const ONE_HOUR_DELAY = ONE_MINUTE_DELAY * 60;
const SUMMARY_WAIT_TIMEOUT = 10000;
const KNACK_RECORD_LENGTH = 24;

function Ktl($, appInfo) {
    if (window.ktl)
        return window.ktl;

    const KTL_VERSION = '0.21.1';
    const APP_KTL_VERSIONS = window.APP_VERSION + ' - ' + KTL_VERSION;
    window.APP_KTL_VERSIONS = APP_KTL_VERSIONS;

    const APP_ROOT_NAME = appInfo.lsShortName;
    window.APP_ROOT_NAME = APP_ROOT_NAME;

    const LOCAL_SERVER_PORT = '3000';

    var ktl = this;

    //KEC stands for "KTL Event Code".  Next:  KEC_1026

    //window.ktlParserStart = window.performance.now();
    //Parser step 1 : Add view keywords.
    //Extract all keywords from view titles and descriptions, and cleanup view titles and descriptions.
    var ktlKeywords = {};
    window.ktlKeywords = ktlKeywords;
    for (var t = 0; t < Knack.scenes.models.length; t++) {
        var scn = Knack.scenes.models[t];
        var views = scn.views;
        for (var v = 0; v < views.models.length; v++) {
            let view = views.models[v];
            if (view) {
                var viewKwObj = {};
                var attr = view.attributes;

                var title = attr.title;

                if (attr.type === 'rich_text' && attr.content)
                    title = attr.content.replace('<p>_', ' _');

                var cleanedUpTitle = title;
                var firstKeywordIdx;
                if (title) {
                    firstKeywordIdx = title.toLowerCase().search(/(?:^|\s)(_[a-zA-Z0-9]\w*)/m);
                    if (firstKeywordIdx >= 0) {
                        cleanedUpTitle = title.substring(0, firstKeywordIdx);
                        var keywordsToParse = title.substring(firstKeywordIdx).trim();

                        if (attr.type === 'rich_text') {
                            //Remove line breaks and paragraphs after first kw found.
                            keywordsToParse = keywordsToParse.replace(/<\/?p>|<br\s*\/?>/gi, ' ').trim();

                            //Decode all special HTML characters to plain text. Ex: &gt to >
                            keywordsToParse = $('<p/>').html(keywordsToParse).text();
                        }

                        extractKeywords(keywordsToParse, viewKwObj);
                    }
                }

                var description = attr.description;
                var cleanedUpDescription = description;
                if (description) {
                    firstKeywordIdx = description.toLowerCase().search(/(?:^|\s)(_[a-zA-Z0-9]\w*)/m);
                    if (firstKeywordIdx >= 0) {
                        cleanedUpDescription = description.substring(0, firstKeywordIdx);
                        extractKeywords(description.substring(firstKeywordIdx).trim(), viewKwObj);
                    }
                }

                attr.orgTitle = attr.title; //Can probably be removed - not really used anymore.
                if (!$.isEmptyObject(viewKwObj)) {
                    ktlKeywords[view.id] = viewKwObj;

                    //Add scene keywords.
                    if (viewKwObj._km || viewKwObj._kbs || viewKwObj._zoom || viewKwObj._nswd)
                        ktlKeywords[scn.attributes.key] = viewKwObj;
                    else if (viewKwObj._footer)
                        ktlKeywords.ktlAppFooter = Knack.scenes.getByKey(view.attributes.scene.key).attributes.slug;
                }

                if (attr.type === 'rich_text' && (title && !title.includes('_ol')))
                    attr.content = cleanedUpTitle;
                else
                    attr.title = cleanedUpTitle;

                attr.description = cleanedUpDescription;
            }
        }
    }

    //Add field keywords.
    const objects = Knack.objects.models;
    for (var o = 0; o < objects.length; o++) {
        var obj = objects[o];
        var fields = obj.attributes.fields;
        for (f = 0; f < fields.length; f++) {
            const fieldId = fields[f].key;
            const field = Knack.fields[fieldId];
            var fieldDesc = field.attributes && field.attributes.meta && field.attributes.meta.description;
            if (fieldDesc) {
                fieldDesc = fieldDesc.replace(/(\r\n|\n|\r)|<[^>]*>/gm, ' ').replace(/ {2,}/g, ' ').trim();
                var fieldKwObj = extractKeywords(fieldDesc);
                if (!$.isEmptyObject(fieldKwObj))
                    ktlKeywords[fieldId] = fieldKwObj;
            }
        }
    }

    //window.ktlParserEnd = window.performance.now();
    //console.log(`KTL parser took ${Math.trunc(window.ktlParserEnd - window.ktlParserStart)} ms`);

    //Parser step 2 : Separate each keyword from its parameters and parse the parameters.
    function extractKeywords(strToParse = '', keywords = {}) {
        const strSplit = strToParse.split(/(?:^|\s)(_[a-zA-Z0-9_]{2,})/gm);
        strSplit.splice(0, 1);
        for (let i = 0; i < strSplit.length; i++) {
            strSplit[i] = strSplit[i].trim().replace(/\u200B/g, ''); //u200B is a "zero width space".  Caught that once during a copy/paste!
            if (strSplit[i].startsWith('_')) {
                const key = strSplit[i].toLowerCase();
                if (!keywords[key])
                    keywords[key] = [];

                if (i <= strSplit.length && strSplit[i + 1].trim().startsWith('=')) {
                    const paramsStr = parseParameters(strSplit[i + 1].trim().slice(1).trim());
                    keywords[key].push(paramsStr);
                }
            }
        }

        return keywords;
    }

    //Parser step 3 : Parse all sets of parameters for a given keyword - those after the equal sign and separated by commas.
    function parseParameters(keywordString = '') {
        let paramStr = keywordString.replace(/(\/a>)[\s\S]*/, '$1');
        let params = [];
        let options = {};

        if (!paramStr.startsWith('['))
            paramStr = '[' + paramStr + ']';

        const paramGroups = parseKeywordParamGroups(paramStr) || [];
        extractParamsAndOptions(paramGroups, params, options);

        const parameters = { params: params };

        if (paramStr)
            parameters.paramStr = paramStr;

        if (!$.isEmptyObject(options))
            parameters.options = options;

        return parameters;
    }

    function parseKeywordParamGroups(kwGroups = '') {
        const cleanedStr = kwGroups.trim().replace(/\s*\[\s*/g, '[').replace(/\s*\]\s*/g, ']'); //Remove spaces around square brackets.
        const elements = cleanedStr.split('],[');

        return elements.map(element => element.replace('[', '').replace(']', ''));
    }

    function extractParamsAndOptions(paramGroups = [], params = {}, options = {}) {
        paramGroups.forEach(group => {
            const firstParam = group.split(',')[0].trim();
            if (['ktlRoles', 'ktlRefVal', 'ktlTarget', 'ktlCond'].includes(firstParam)) {
                const pattern = /[^,]*,\s*(.*)/; // Regular expression pattern to match everything after the first word, comma, and possible spaces.
                const groupParams = group.match(pattern);
                if (groupParams && groupParams.length >= 2)
                    options[firstParam] = groupParams[1].trim();
                else
                    console.error(`Error parsing keywords : Empty Parameter Configuration [${group}]`);
            } else {
                params.push(group.split(',').map(param => param.trim()));
            }
        });
    }

    //This is for early notifications of DOM changes.
    //Prevents spurious GUI updates (flickering).
    //Also used to track summary updates since they are asychronous and often delayed.
    var observer = null;
    var headerProcessed = false;
    if (!observer) {
        observer = new MutationObserver((mutations) => {
            mutations.forEach(mutRec => {
                if (!ktl.scenes.isiFrameWnd()) {
                    if (!headerProcessed) {
                        headerProcessed = true;
                        if (ktl.core.isKiosk()) {
                            if (!document.querySelector('.ktlKioskMode'))
                                ktl.core.kioskMode(true);
                        } else
                            ktl.core.kioskMode(false);
                    }

                    const knView = mutRec.target.closest('.kn-view');
                    var viewId = (knView && knView.id);
                    if (viewId) {
                        var viewObj = Knack.views[viewId];
                        if (viewObj && typeof viewObj.model === 'object') {
                            if (viewId && (mutRec.target.localName === 'tbody' || mutRec.target.localName === 'div')) {
                                var keywords = ktlKeywords[viewId];
                                if (keywords) {
                                    //Pre-render keyword processing.
                                    keywords._zoom && ktl.views.applyZoomLevel(viewId, keywords);
                                    keywords._dr && ktl.views.numDisplayedRecords(viewId, keywords);
                                    ktl.fields.hideFields(viewId, keywords);

                                    if (mutRec.addedNodes.length && mutRec.removedNodes.length) { //Filter out to eliminate redundant processing.
                                        if (!ktl.core.isKiosk())
                                            keywords._km && ktl.core.kioskMode(true);
                                        keywords._hc && ktl.views.hideColumns(Knack.views[viewId].model.view, keywords);
                                        keywords._rc && ktl.views.removeColumns(Knack.views[viewId].model.view, keywords);
                                        keywords._cls && ktl.views.addRemoveClass(viewId, keywords);
                                        keywords._style && ktl.views.setStyle(viewId, keywords);
                                    }
                                }
                            }
                        }
                    }

                    ktl.scenes.getCfg().processMutation && ktl.scenes.getCfg().processMutation(mutRec); //App's callback.
                } else {
                    if (!headerProcessed) {
                        headerProcessed = true;
                        $('#kn-app-header,.knHeader').addClass('ktlDisplayNone');
                    }
                }
            });
        })

        observer.observe(document.querySelector('.kn-content'), {
            childList: true,
            subtree: true,
        });
    }

    const numericFieldTypes = ['number', 'currency', 'sum', 'min', 'max', 'average', 'equation'];

    /**
    * Exposed constant strings
    *  @constant
    */
    this.const = {
        //Local Storage constants
        LS_USER_PREFS: 'USER_PREFS',
        LS_VIEW_DATES: 'VIEW_DATES',

        LS_LOGIN: 'LOGIN',
        LS_ACTIVITY: 'ACTIVITY',
        LS_NAVIGATION: 'NAVIGATION',
        LS_INFO: 'INF',
        LS_DEBUG: 'DBG',
        LS_WRN: 'WRN',
        LS_APP_ERROR: 'APP_ERR',
        LS_SERVER_ERROR: 'SVR_ERR',
        LS_CRITICAL: 'CRI',

        LS_LAST_ERROR: 'LAST_ERROR',
        LS_SYSOP_MSG_UNREAD: 'SYSOP_MSG_UNREAD', //Maybe too app-specific

        //Wait Selector constants
        WAIT_SEL_IGNORE: 0,
        WAIT_SEL_LOG_WARN: 1,
        WAIT_SEL_LOG_ERROR: 2,
        WAIT_SEL_ALERT: 3,
        WAIT_SELECTOR_SCAN_SPD: 100,

        MSG_APP: 'MSG_APP',
    }

    //jQuery extensions - BEGIN
    //Searches a selector for text like : contains, but with an exact match, and after a spaces trim.
    $.expr[':'].textEquals = function (el, i, m) {
        let searchText = m[3];
        let match = $(el).text().replace('*', '').trim().match('^' + searchText + '$'); //Remove * for Required fields.
        return match && match.length > 0;
    }

    //Checks is selected element is visible or off screen.
    $.expr.filters.offscreen = function (el) {
        var rect = el.getBoundingClientRect();
        return (
            (rect.x + rect.width) < 0
            || (rect.y + rect.height) < 0
            || (rect.x > window.innerWidth || rect.y > window.innerHeight)
        );
    };

    $.fn.bindFirst = function (name, fn) {
        var elem, handlers, i, _len;
        this.bind(name, fn);
        for (i = 0, _len = this.length; i < _len; i++) {
            elem = this[i];
            if (!!jQuery._data(elem).events) {
                handlers = jQuery._data(elem).events[name.split('.')[0]];
                handlers.unshift(handlers.pop());
            }
        }
    };

    $.fn.replaceClass = function (pFromClass, pToClass) {
        return this.removeClass(pFromClass).addClass(pToClass);
    };

    //jQuery extensions - END

    /**
        * Core functions
        * @param  {} function(
        */
    this.core = (function () {
        var dndOrgX, dndOrgY, dndFromX, dndFromY, dndToX, dndToY;

        window.addEventListener("resize", (event) => {
            ktl.core.sortMenu(); //To resize menu and prevent overflowing out of screen bottom when Sticky is used.
        });


        var cfg = {
            //Let the App do the settings.  See function ktl.core.setCfg in KTL_Defaults.js file.
        };

        var isKiosk = null;
        var timedPopupEl = null;
        var timedPopupTimer = null;
        var progressWnd = null;

        $(document).on('click', function (e) {
            //Context menu removal.
            var contextMenu = $('.menuDiv');
            if (contextMenu.length > 0) {
                contextMenu.remove();
                ktl.views.autoRefresh();
            }
        })

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.developerNames && (cfg.developerNames = cfgObj.developerNames);
                cfgObj.developerEmail && (cfg.developerEmail = cfgObj.developerEmail);
                cfgObj.devOptionsPin && (cfg.devOptionsPin = cfgObj.devOptionsPin);
                cfgObj.devDebugCode && (cfg.devDebugCode = cfgObj.devDebugCode);
                cfgObj.isKiosk && (isKiosk = cfgObj.isKiosk);
                cfgObj.virtualKeyboard && (virtualKeyboard = cfgObj.virtualKeyboard);

                if (cfgObj.popupStyle !== undefined) {
                    if (!cfg.popupStyle)
                        cfg.popupStyle = {};
                    for (let key in cfgObj.popupStyle) {
                        cfg.popupStyle[key] = cfgObj.popupStyle[key];
                    }
                }

                if (cfgObj.tooltipStyles !== undefined) {
                    if (!cfg.tooltipStyles)
                        cfg.tooltipStyles = {};
                    for (let key in cfgObj.tooltipStyles) {
                        cfg.tooltipStyles[key] = cfgObj.tooltipStyles[key];
                        document.documentElement.style.setProperty(`--${key}`, cfg.tooltipStyles[key]);
                    }
                }

                //Read the config from the Javascript pane, if exists.
                //This one is different.  We want to give the user specific control over each flag from the Builder.
                if (cfgObj.enabled !== undefined) {
                    if (!cfg.enabled)
                        cfg.enabled = {};
                    for (let key in cfgObj.enabled) {
                        cfg.enabled[key] = cfgObj.enabled[key];
                    }
                }

                if (typeof ktlFeatures === 'object' && !$.isEmptyObject(ktlFeatures)) {
                    for (let key in ktlFeatures) {
                        cfg.enabled[key] = ktlFeatures[key];
                    }
                }
            },

            getCfg: function () {
                return cfg;
            },

            // Generic Knack API call function.
            // BTW, you can use connected records by enclosing your recId param in braces.  Ex: [myRecId]
            knAPI: function (viewId = null, recId = null, apiData = {}, requestType = '', viewsToRefresh = [], showSpinner = true) {
                return new Promise(function (resolve, reject) {
                    requestType = requestType.toUpperCase();
                    if (viewId === null || /*recId === null || @@@ can be null for post req*/ /*data === null ||*/
                        !(requestType === 'PUT' || requestType === 'GET' || requestType === 'POST' || requestType === 'DELETE')) {
                        reject(new Error('Called knAPI with invalid parameters: view = ' + viewId + ', recId = ' + recId + ', reqType = ' + requestType));
                        return;
                    }

                    const sceneKey = ktl.scenes.getSceneKeyFromViewId(viewId);
                    if (!sceneKey) {
                        const error = 'knAPI error: invalid sceneKey';
                        if (ktl.account.isDeveloper())
                            alert(error);
                        return reject(new Error(error));
                    }

                    var apiURL = 'https://api.knack.com/v1/pages/';
                    if (Knack.app.attributes.account.settings.hipaa.enabled === true && Knack.app.attributes.account.settings.hipaa.region === 'us-govcloud')
                        apiURL = 'https://usgc-api.knack.com/v1/pages/';
                    apiURL += sceneKey + '/views/' + viewId + '/records/';

                    if (recId) apiURL += recId;

                    //TODO: Support GET requests with filter.

                    showSpinner && Knack.showSpinner();

                    //console.log('apiURL =', apiURL);
                    //console.log('knAPI - viewId: ', viewId, ', recId:', recId, ', requestType', requestType);

                    $.ajax({
                        url: apiURL,
                        type: requestType,
                        crossDomain: true,
                        retryLimit: 4, //Make this configurable by app,
                        headers: {
                            'Authorization': Knack.getUserToken(),
                            'X-Knack-Application-Id': Knack.application_id,
                            'X-Knack-REST-API-Key': 'knack',
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*.knack.com',
                        },
                        data: JSON.stringify(apiData),
                        success: function (data) {
                            showSpinner && Knack.hideSpinner();
                            if (viewsToRefresh.length === 0)
                                resolve(data);
                            else {
                                ktl.views.refreshViewArray(viewsToRefresh).then(function () {
                                    resolve(data);
                                })
                            }
                        },
                        error: function (response /*jqXHR*/) {
                            //Example of the data format in response:
                            //{ "readyState": 4, "responseText": "{\"errors\":[\"Invalid Record Id\"]}", "status": 400, "statusText": "Bad Request" }

                            ktl.log.clog('purple', 'knAPI error:');
                            console.log('retries:', this.retryLimit, '\nresponse:', response);

                            if (this.retryLimit-- > 0) {
                                var ajaxParams = this; //Backup 'this' otherwise this will become the Window object in the setTimeout.
                                setTimeout(function () {
                                    $.ajax(ajaxParams);
                                }, 500);
                                return;
                            } else { //All retries have failed, log this.
                                showSpinner && Knack.hideSpinner();

                                response.caller = 'knAPI';
                                response.viewId = viewId;

                                //Process critical failures by forcing a logout or hard reset.
                                ktl.wndMsg.ktlProcessServerErrors({
                                    reason: 'KNACK_API_ERROR',
                                    status: response.status,
                                    statusText: response.statusText,
                                    caller: response.caller,
                                    viewId: response.viewId,
                                });

                                reject(response);
                            }
                        },
                    });
                });
            },

            isKiosk: function () {
                var sessionKiosk = (ktl.storage.lsGetItem('KIOSK', false, true) === 'true');
                return sessionKiosk || (isKiosk ? isKiosk() : false);
            },

            //Param is selector string and optionally if we want to put back a hidden element as it was.
            hideSelector: function (sel = '', show = false) {
                sel && ktl.core.waitSelector(sel)
                    .then(() => {
                        if (show)
                            $(sel).removeClass('ktlHidden');
                        else
                            $(sel).addClass('ktlHidden');
                    })
                    .catch(() => { ktl.log.clog('purple', 'hideSelector failed waiting for selector: ' + sel); });
            },

            //Param: sel is a string, not the jquery object.
            waitSelector: function (sel = '', timeout = 5000, is = '', outcome = ktl.const.WAIT_SEL_IGNORE, scanSpd = ktl.const.WAIT_SELECTOR_SCAN_SPD) {
                return new Promise(function (resolve, reject) {
                    if (selIsValid(sel)) {
                        resolve();
                        return;
                    }

                    var intervalId = setInterval(function () {
                        if (selIsValid(sel)) {
                            clearTimeout(failsafe);
                            clearInterval(intervalId);
                            resolve();
                            return;
                        }
                    }, scanSpd);

                    var failsafe = setTimeout(function () {
                        clearInterval(intervalId);
                        if (outcome === ktl.const.WAIT_SEL_LOG_WARN) {
                            ktl.log.addLog(ktl.const.LS_WRN, 'kEC_1011 - waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);
                        } else if (outcome === ktl.const.WAIT_SEL_LOG_ERROR) {
                            ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1001 - waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);
                        } else if (outcome === ktl.const.WAIT_SEL_ALERT && ktl.core.getCfg().developerNames.includes(Knack.getUserAttributes().name))
                            alert('waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);

                        reject(sel);
                    }, timeout);

                    function selIsValid(sel) {
                        var testSel = $(sel);
                        if (is !== '')
                            testSel = $(sel).is(':' + is);
                        return (testSel === true || testSel.length > 0);
                    }
                });
            },

            waitAndReload: function (delay = 5000) {
                setTimeout(function () {
                    location.reload(true);
                }, delay);
            },

            //Drag n drop, classic method but doesn't work on some devices like the Raspberry PI 4 with a touch screen.
            //Preferred method is enableSortableDrag.
            enableDragElement: function (element, callback = () => { }) {
                let lastX = 0, lastY = 0;

                if (document.getElementById(element.id + "header")) {
                    // if present, the header is where you move the DIV from:
                    document.getElementById(element.id + "header").addEventListener('mousedown', dragMouseDown);
                    document.getElementById(element.id + "header").addEventListener('touchstart', dragMouseDown);
                } else {
                    // otherwise, move the DIV from anywhere inside the DIV:
                    element.onmousedown = dragMouseDown;
                    element.ontouchstart = dragMouseDown;
                }

                function dragMouseDown(event) {
                    event = event || window.event;
                    event.preventDefault();
                    lastX = event.clientX;
                    lastY = event.clientY;

                    document.addEventListener('mouseup', closeDragElement);
                    document.addEventListener('touchend', closeDragElement);

                    document.onmousemove = elementDrag;
                    document.addEventListener('touchmove', elementDrag/*, { passive: false }*/);
                }

                function elementDrag(event) {
                    event = event || window.event;
                    event.preventDefault();

                    const clientX = event.clientX || event.touches[0].clientX;
                    const clientY = event.clientY || event.touches[0].clientY;

                    const x = lastX - clientX;
                    const y = lastY - clientY;
                    lastX = clientX;
                    lastY = clientY;

                    const position = {
                        left: (element.offsetLeft - x),
                        top: (element.offsetTop - y)
                    };
                    element.style.left = position.left + "px";
                    element.style.top = position.top + "px";

                    callback(position);
                }

                function closeDragElement() {
                    document.onmouseup = null;
                    document.onmousemove = null;
                    document.ontouchmove = null;
                    document.ontouchend = null;
                    document.ontouchstart = null;
                }
            },

            //Drag n drop using the Sortable library.
            //TODO: make all moved object visible, not just handle.
            enableSortableDrag: function (element, callback = () => { }) {
                if (!element) return;

                new Sortable(element, {
                    handle: '.ktlDevToolsHeader',
                    animation: 150,
                    sort: false,

                    onStart: function (evt) {
                        evt.item.style.cursor = 'grabbing';
                        const rect = evt.target.getBoundingClientRect();
                        dndOrgX = rect.x;
                        dndOrgY = rect.y;
                        dndFromX = evt.originalEvent.x;
                        dndFromY = evt.originalEvent.y;
                    },

                    onEnd: function (evt) {
                        evt.item.style.cursor = 'grab';
                        dndToX = evt.originalEvent.x || evt.originalEvent.changedTouches[0].screenX;
                        dndToY = evt.originalEvent.y || evt.originalEvent.changedTouches[0].screenY;
                        let deltaX = dndToX - dndFromX;
                        let deltaY = dndToY - dndFromY;
                        const position = {
                            left: (dndOrgX + deltaX),
                            top: (dndOrgY + deltaY)
                        };

                        element.style.left = position.left + 'px';
                        element.style.top = position.top + 'px';
                        callback(position);
                    },
                });
            },

            splitUrl: function (url) {
                var urlParts = {};
                var indexParams = url.indexOf('?');
                if (indexParams === -1)
                    urlParts.path = url;
                else
                    urlParts.path = url.substring(0, indexParams);

                var params = {};
                var pairs = url.substring(url.indexOf('?') + 1).split('&');

                for (var i = 0; i < pairs.length; i++) {
                    if (!pairs[i])
                        continue;
                    var pair = pairs[i].split('=');
                    if (typeof (pair[1]) !== 'undefined')
                        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }

                urlParts.params = params;

                return urlParts;
            },

            // Returns Top Menu, Menu and Link.
            getMenuInfo: function () {
                var linkStr = window.location.href;
                var topMenuStr = '';
                var topMenu = '';
                var menuStr = '';
                var pageStr = Knack.scenes._byId[Knack.router.current_scene].attributes.name;

                var menuElem = document.querySelector('#app-menu-list .is-active');
                if (ktl.core.isKiosk()) {
                    topMenuStr = 'Kiosk Mode - no menu'; //For some reason, Kiosk's Menu have many entries.
                } else {
                    menuElem && (topMenu = (menuElem.closest('.kn-dropdown-menu') || menuElem.closest('.kn-dropdown-menu') || document.querySelector('#kn-app-menu li.is-active')));
                    if (topMenu) {
                        topMenuStr = topMenu.innerText;
                        menuStr = menuElem.textContent;

                        //Special case for Apple devices, where all menus are included.  Must cleanup and keep only first one.
                        if (topMenuStr.length >= 13 && topMenuStr.substr(0, 13) === '\n            ') {
                            var array = topMenuStr.split('\n            ');
                            topMenuStr = array[1];
                        }
                    }
                }

                return { topmenu: topMenuStr.trim(), menu: menuStr.trim(), page: pageStr.trim(), link: linkStr.trim() };
            },

            isHex: function (str) {
                var regexp = /^[0-9a-fA-F]+$/;
                if (regexp.test(str))
                    return true;
                else
                    return false;
            },

            isIPFormat: function (ipAddress) {
                const ipRegex = /^([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/;
                return ipRegex.test(ipAddress);
            },

            //Used to generate a clean element ID from any string.  Ex: from a button's text.
            getCleanId: function (text = '') {
                return text.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"); //Any character other than a-z or 0-9, replace by underscore.
            },

            getSubstringPosition: function (string, subString, nthOccurence) {
                if (string === null || string === undefined || subString === null || subString === undefined || nthOccurence === null || nthOccurence < 1)
                    return -1;
                else
                    return string.split(subString, nthOccurence).join(subString).length;
            },

            addZero: function (i, numDigits = 2, withMilliseconds = false) {
                if (numDigits < 2 || numDigits > 3) {
                    ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1004 - Called addZero with invalid numDigits');
                    return 0; //@@@ TODO: improve error handling.
                }
                if (i < 10)
                    i = '0' + i;
                if (numDigits === 3 && withMilliseconds && i < 100)
                    i = '0' + i;
                return i;
            },

            getFormattedCurrentDateTime(dateFormat = 'mm/dd/yyyy') {
                const currentDate = new Date();
                const day = String(currentDate.getDate()).padStart(2, '0');
                const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Month is zero-based
                const year = String(currentDate.getFullYear());
                const hours = String(currentDate.getHours()).padStart(2, '0');
                const minutes = String(currentDate.getMinutes()).padStart(2, '0');
                const seconds = String(currentDate.getSeconds()).padStart(2, '0');

                let result = '';

                if (dateFormat === 'dd/mm/yyyy') {
                    result += `${day}/${month}/${year}`;
                } else // Default Knack format
                    result += `${month}/${day}/${year}`;

                result += ` ${hours}:${minutes}:${seconds}`;

                return result;
            },

            //Currently supports 2 and 3 digits only.  Needs better error handling.
            //Returns string in format:  mm/dd/yyyy HH:MM:SS.mmm
            getCurrentDateTime: function (withDate = true, withSeconds = true, withMilliseconds = true, useUTC = false) {
                var date = '';
                var today = new Date();
                var time = '';

                if (useUTC) {
                    if (withDate)
                        date = ktl.core.addZero(today.getUTCMonth() + 1) + '/' + ktl.core.addZero(today.getUTCDate()) + '/' + today.getUTCFullYear();

                    time = ktl.core.addZero(today.getUTCHours()) + ':' + ktl.core.addZero(today.getUTCMinutes());
                    if (withSeconds)
                        time += ':' + ktl.core.addZero(today.getUTCSeconds());
                    if (withMilliseconds)
                        time += ':' + ktl.core.addZero(today.getUTCMilliseconds(), 3, withMilliseconds);
                } else {
                    if (withDate)
                        date = ktl.core.addZero(today.getMonth() + 1) + '/' + ktl.core.addZero(today.getDate()) + '/' + today.getFullYear();

                    time = ktl.core.addZero(today.getHours()) + ':' + ktl.core.addZero(today.getMinutes());
                    if (withSeconds) {
                        time += ':' + ktl.core.addZero(today.getSeconds());
                        if (withMilliseconds)
                            time += ':' + ktl.core.addZero(today.getMilliseconds(), 3, withMilliseconds);
                    }
                }

                return date + ' ' + time;
            },

            dateInPast: function (thisDate, refDate = new Date()) {
                if ((!isNaN(thisDate) && !isNaN(refDate)) && (thisDate.setHours(0, 0, 0, 0) < refDate.setHours(0, 0, 0, 0)))
                    return true;
                return false;
            },

            //Params must be strings.
            isMoreRecent: function (thisDate, refDate = new Date()) {
                thisDate = new Date(thisDate);
                refDate = refDate ? new Date(refDate) : refDate;
                if ((!isNaN(thisDate) && !isNaN(refDate)) && (thisDate > refDate))
                    return true;
                return false;
            },

            // Selects all text from an element.
            // Omit el param to de-select.
            selectElementContents: function (el = null) {
                var body = document.body, range, sel;

                if (document.createRange && window.getSelection) {
                    sel = window.getSelection();
                    sel.removeAllRanges();

                    if (el === null) return;  // If el is null, remove selection and exit the function

                    // Call helper function to replace <a> tags with their text content
                    replaceLinksWithText(el);

                    range = document.createRange();
                    try {
                        range.selectNodeContents(el);
                        sel.addRange(range);
                    } catch (e) {
                        range.selectNode(el);
                        sel.addRange(range);
                    }
                } else if (body.createTextRange) {
                    if (el === null) {
                        document.selection.empty(); // For IE, remove selection and exit function if el is null
                        return;
                    }

                    // Call helper function to replace <a> tags with their text content
                    replaceLinksWithText(el);

                    range = body.createTextRange();
                    range.moveToElementText(el);
                    range.select();
                }

                // Helper function to replace <a> tags with their text content
                function replaceLinksWithText(el) {
                    var links = el.getElementsByTagName('a');
                    for (var i = links.length - 1; i >= 0; i--) {
                        var link = links[i];
                        var text = document.createTextNode(link.textContent);
                        link.parentNode.replaceChild(text, link);
                    }
                }
            },

            timedPopup: function (msg, status = 'success', duration = 2000, style) {
                if (timedPopupEl)
                    ktl.core.removeTimedPopup();

                if (!progressWnd) {
                    timedPopupEl = document.createElement('div');
                    var popupStyle = 'position:fixed;top:20%;left:50%;margin-right:-50%;transform:translate(-50%,-50%);min-width:300px;min-height:50px;line-height:50px;font-size:large;text-align:center;font-weight:bold;border-radius:25px;padding-left:25px;padding-right:25px;white-space:pre;z-index:3000';
                    if (style)
                        popupStyle = style;

                    popupStyle += ktl.core.getCfg().popupStyle[status];

                    timedPopupEl.setAttribute('style', popupStyle);

                    timedPopupEl.innerHTML = msg;
                    timedPopupTimer = setTimeout(function () {
                        ktl.core.removeTimedPopup();
                    }, duration);
                    document.body.appendChild(timedPopupEl);
                }
            },

            removeTimedPopup: function () {
                clearTimeout(timedPopupTimer);
                if (timedPopupEl) {
                    timedPopupEl.parentNode.removeChild(timedPopupEl);
                    timedPopupEl = null;
                }
            },

            infoPopup: function (style) {
                var el = (document.querySelector('#kn-modeless-wnd') || ((el = document.createElement('div')) && document.body.appendChild(el)));

                //Default style, that can be modified or incremented by parameter.
                var popupStyle = 'position:fixed;top:20%;left:50%;margin-right:-50%;transform:translate(-50%,-50%);min-width:300px;min-height:50px;line-height:50px;font-size:large;text-align:center;font-weight:bold;border-radius:25px;padding-left:25px;padding-right:25px;background-color:#81b378;border:5px solid #294125;white-space:pre;z-index:10';
                if (style)
                    popupStyle = style;

                el.id = 'kn-modeless-wnd';
                el.setAttribute('style', popupStyle);
                progressWnd = el;
            },

            //TODO:  convert to use HTML for better control and formatting.
            setInfoPopupText: function (txt = '') {
                if (progressWnd && txt)
                    progressWnd.innerText = txt;
            },

            removeInfoPopup: function () {
                if (progressWnd) {
                    progressWnd.parentNode.removeChild(progressWnd);
                    progressWnd = null;
                }
            },

            //To insert a node after an existing one, but as sibling, not as a child.
            //Note: Do not confuse with jquery's version that has the same name!
            insertAfter: function (newNode, referenceNode) {
                if (!newNode || !referenceNode) return;
                referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
            },

            //Ensures that the context menu follows the mouse, but without overflowing outside of window.
            setContextMenuPostion: function (e, contextMenu) {
                var mousePos = {};
                var menuPos = {};
                var menuSize = {};
                menuSize.x = contextMenu.outerWidth();
                menuSize.y = contextMenu.outerHeight();

                mousePos.x = e.clientX || e.touches[0].clientX;
                mousePos.y = e.clientY || e.touches[0].clientY;

                if (mousePos.x + menuSize.x > $(window).width())
                    menuPos.x = mousePos.x - menuSize.x;
                else
                    menuPos.x = mousePos.x;

                if (mousePos.y + menuSize.y > $(window).height())
                    menuPos.y = mousePos.y - menuSize.y;
                else
                    menuPos.y = mousePos.y;

                return menuPos;
            },

            getObjectIdByName: function (objectName = '') {
                if (!objectName) return;
                var objects = Knack.objects.models;
                for (var i = 0; i < objects.length; i++) {
                    if (objects[i].attributes.name === objectName)
                        return objects[i].attributes.key;
                }
            },

            getFieldIdByName: function (fieldName = '', objectId = '') {
                if (!objectId || !fieldName) return;
                var fields = Knack.objects._byId[objectId].fields.models;
                for (var i = 0; i < fields.length; i++) {
                    if (fields[i].attributes.name === fieldName)
                        return fields[i].attributes.key;
                }
            },

            //pageUrl is also called a slug.  It's what you find in the scene's Settings / Page URL field in the Builder.
            getViewIdByTitle: function (srchTitle = '', pageUrl = ''/*Empty to search all (but takes longer)*/, exactMatch = false) {
                if (!srchTitle) return;
                if (!pageUrl) {
                    var scenes = Knack.scenes.models;
                    for (var i = 0; i < scenes.length; i++) {
                        var foundView = this.getViewIdByTitle(srchTitle, scenes[i].id, exactMatch);
                        if (foundView) return foundView;
                    }
                } else {
                    var sceneObj = Knack.scenes._byId[pageUrl];
                    if (sceneObj) {
                        var views = sceneObj.views.models;
                        for (var j = 0; j < views.length; j++) {
                            var title = views[j].attributes.title;
                            if (title && exactMatch && (title === srchTitle)) return views[j].id;
                            if (title && !exactMatch && title.includes(srchTitle)) return views[j].id;
                        }
                    }
                }
            },

            sortMenu: function () {
                if (!ktl.core.getCfg().enabled.sortedMenus || ktl.scenes.isiFrameWnd()) return;

                if (Knack.isMobile()) {
                    $('.kn-mobile-controls').mousedown(function (e) {
                        ktl.core.waitSelector('#kn-mobile-menu.is-visible')
                            .then(() => {
                                var allMenus = $('#kn-mobile-menu').find('.kn-dropdown-menu-list');
                                for (var i = 0; i < allMenus.length - 1; i++)
                                    ktl.core.sortUList(allMenus[i]);
                            })
                            .catch((err) => { console.log('Failed finding menu.', err); });
                    })
                } else {
                    var legacy = Knack.app.attributes.design.regions.header.isLegacy;
                    var allMenus = legacy ? document.querySelectorAll('#app-menu-list li.kn-dropdown-menu') : document.querySelectorAll('ul.knHeader__menu-list li.knHeader__menu-list-item--dropdown');
                    allMenus.forEach(menu => {
                        var subMenusList = menu.querySelector(legacy ? 'ul.kn-dropdown-menu-list' : 'ul.knHeader__menu-dropdown-list');
                        ktl.core.sortUList(subMenusList);

                        //If using modern style with Sticky option, fix menu height to allow access to overflowing items, below page.
                        if (!legacy && Knack.app.attributes.design.regions.header.options.sticky) {
                            menu.querySelector('.knHeader__menu-dropdown-list').style.maxHeight = (window.innerHeight * 0.8) + 'px';
                            menu.querySelector('.knHeader__menu-dropdown-list').style.overflow = 'auto';
                        }
                    })
                }
            },

            sortUList: function (uListElem) {
                if (!uListElem) return;

                var switching, allListElements, shouldSwitch;
                switching = true;
                while (switching) {
                    switching = false;
                    allListElements = uListElem.getElementsByTagName("LI");
                    for (var i = 0; i < allListElements.length - 1; i++) {
                        shouldSwitch = false;
                        if (allListElements[i].innerText.toLowerCase() > allListElements[i + 1].innerText.toLowerCase()) {
                            shouldSwitch = true;
                            break;
                        }
                    }

                    if (shouldSwitch) {
                        allListElements[i].parentNode.insertBefore(allListElements[i + 1], allListElements[i]);
                        switching = true;
                    }
                }
            },

            convertDateTimeToString: function (dateTimeObj, iso = false, dateOnly = false) {
                if (!dateTimeObj) return;

                var dtOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' };
                if (dateOnly) {
                    dtOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
                }

                if (iso) {
                    //yyyy-mm-dd format, for example used by input of type calendar.
                    var year = dateTimeObj.toLocaleString(undefined, { year: 'numeric' });
                    var month = dateTimeObj.toLocaleString(undefined, { month: '2-digit' });
                    var day = dateTimeObj.toLocaleString(undefined, { day: '2-digit' });
                    var isoDate = year + '-' + month + '-' + day;

                    //yyyy-mm-dd hh:mm:ss format when time is included.
                    if (!dateOnly)
                        isoDate += ' ' + dateTimeObj.toTimeString(undefined, { 'hour': '2-digit', 'minute': '2-digit', hourCycle: 'h23', 'second': '2-digit' });

                    return isoDate;
                } else {
                    //mm-dd-yyyy Knack's default format.
                    return dateTimeObj.toLocaleDateString(undefined, dtOptions);
                }
            },

            convertDateToIso: function (dateObj, period = '') {
                if (!dateObj) return '';
                var year = dateObj.toLocaleString(undefined, { year: 'numeric' });
                var month = dateObj.toLocaleString(undefined, { month: '2-digit' });
                var day = dateObj.toLocaleString(undefined, { day: '2-digit' });
                var isoDate = year + '-' + month;
                if (period !== 'monthly')
                    isoDate += '-' + day;
                return isoDate;
            },

            getLastDayOfMonth: function (dateObj, iso = false) {
                var lastDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
                return lastDayOfMonth;
            },

            injectCSS: (css) => { //Add custom styles to existing CSS.
                var ktlCSS = (document.querySelector('#ktlCSS') || ((ktlCSS = document.createElement('style')) && document.head.appendChild(ktlCSS)));
                ktlCSS.id = 'ktlCSS';
                ktlCSS.type = 'text/css';
                ktlCSS.textContent += css + '\n\n';
            },

            toggleMode: function () { //Prod <=> Dev modes
                //Dev mode on mobile devices is only possible if NodeJS runs with file server on main developer's machine.
                if (Knack.isMobile() && !ktl.core.getCfg().developerNames.includes(Knack.getUserAttributes().name)) return;

                var prod = (localStorage.getItem(APP_ROOT_NAME + 'dev') === null);
                if (prod)
                    ktl.storage.lsSetItem('dev', '', true);
                else
                    ktl.storage.lsRemoveItem('dev', true);

                ktl.debugWnd.lsLog('Switching mode to: ' + (prod ? 'DEV' : 'PROD'));
                setTimeout(() => {
                    if (ktl.scenes.isiFrameWnd())
                        ktl.wndMsg.send('reloadAppMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { reason: 'MANUAL_REFRESH' });
                    else
                        location.reload(true);
                }, 500);
            },

            //If mode is undefined, it will toggle.  If true, Kiosk is enabled, if false, Normal mode is enabled.
            kioskMode: function (mode) {
                if (typeof mode === 'undefined') {
                    if (ktl.storage.lsGetItem('KIOSK', false, true) === 'true')
                        ktl.storage.lsRemoveItem('KIOSK', false, true);
                    else
                        ktl.storage.lsSetItem('KIOSK', true, false, true);
                } else if (mode)
                    ktl.storage.lsSetItem('KIOSK', true, false, true);
                else
                    ktl.storage.lsRemoveItem('KIOSK', false, true);

                if (ktl.storage.lsGetItem('KIOSK', false, true) === 'true') {
                    $('#kn-app-header,.knHeader,.kn-info-bar').addClass('ktlDisplayNone');
                    $('body').addClass('ktlKioskMode');

                    //Add extra space at bottom of screen in kiosk mode, to allow editing
                    //with the virtual keyboard without blocking the input field.
                    if (ktl.userPrefs.getUserPrefs().showIframeWnd || ktl.scenes.isiFrameWnd())
                        $('body').removeClass('ktlBottomExtraSpaces');
                    else
                        $('body').addClass('ktlBottomExtraSpaces');
                } else {
                    $('.ktlFormKioskButtons').removeClass('ktlFormKioskButtons');
                    $('.ktlKioskButtons').removeClass('ktlKioskButtons');
                    $('#kn-app-header,.knHeader,.kn-info-bar').removeClass('ktlDisplayNone');
                    $('body').removeClass('ktlKioskMode ktlBottomExtraSpaces');
                }
            },

            loadLib: function (libName = '') {
                return new Promise(function (resolve, reject) {
                    if (!libName) {
                        reject('No library name provided.');
                        return;
                    }

                    if (libName === 'SecureLS') {
                        if (typeof SecureLS !== 'function') {
                            LazyLoad.js(['https://ctrnd.s3.amazonaws.com/Lib/Secure-LS/secure-ls.min.js'], function () {
                                (typeof SecureLS === 'function') ? resolve() : reject('Cannot find SecureLS library.');
                            })
                        } else
                            resolve();
                    } else if (libName === 'QRGenerator') {
                        //QR Code reader comes from here: https://github.com/jeromeetienne/jquery-qrcode
                        if (typeof jQuery.fn.qrcode !== 'function') {
                            LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.qrcode/1.0/jquery.qrcode.min.js'], function () {
                                (typeof jQuery.fn.qrcode === 'function') ? resolve() : reject('Cannot find QRGenerator library.');
                            })
                        } else
                            resolve();
                    }
                })
            },

            generateRandomChars: function (length) {
                var result = '';
                var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; //API PUT doesn't like ampersand &
                var charactersLength = characters.length;
                for (var i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                return result;
            },

            findLongestWord: function (str) {
                var longestWord = str.split(/[^a-zA-Z0-9]/).sort(function (a, b) { return b.length - a.length; });
                return longestWord[0];
            },

            addMinutes: function (date, minutes) {
                const dateCopy = new Date(date);
                dateCopy.setMinutes(date.getMinutes() + minutes);

                return dateCopy;
            },

            hasRoleAccess: function (options) {
                if (!options || $.isEmptyObject(options))
                    return true;

                //Allowed Roles are always the top priority.
                if (options.ktlRoles) {
                    const rolesToMatch = options.ktlRoles.split(',').map((role) => role.trim());
                    if (!ktl.account.checkUserRolesMatch(rolesToMatch))
                        return false;
                }

                return true;
            },

            splitAndTrimToArray: function (stringToSplit, separator = ',') {
                if (!stringToSplit) return;
                return stringToSplit.split(separator).map((element) => element.trim());
            },

            //Also known as the "Universal Selector" in documentation.
            //Parameter selector can be a jQuery selector if it starts with "$("
            //Otherwise, can be a field label/ID and optionally a view title/ID.
            //If optionalViewId parameter is provided, it will be used as the default view if not found explicitly in selector.
            getTextFromSelector: function (selector, optionalViewId) {
                return new Promise(function (resolve, reject) {
                    if (!selector) {
                        reject('getTextFromSelector called with empty parameter');
                        return;
                    }

                    let viewId = optionalViewId;
                    let fieldId;

                    const isJQueryTarget = ktl.core.extractJQuerySelector(selector);
                    if (isJQueryTarget) {
                        selector = isJQueryTarget;
                    } else {
                        //Not a jQuery selector - let's see if we can build one with what we have.

                        const selectorArray = ktl.core.splitAndTrimToArray(selector);

                        //If there's a view ID found in selector use it, otherwise use the one in optional parameter.
                        const selectorViewId = selector.match(/view_\d+/);
                        if (selectorViewId)
                            viewId = selectorViewId[0];
                        else if (selectorArray.length >= 2) {
                            viewId = ktl.scenes.findViewWithTitle(selectorArray[1]);
                        }

                        let fieldStr = selector.match(/field_\d+/);
                        if (fieldStr)
                            fieldId = fieldStr[0];
                        else {
                            //No field_ found, then try to find the field ID from the text of the first parameter.
                            if (!selectorArray.length) return;

                            if (selectorArray[0]) {
                                fieldId = ktl.fields.getFieldIdFromLabel(viewId, selectorArray[0]);
                            }
                        }

                        //If no view, but just a field ID, resolve with that.  It will be used for each rec ID.
                        if (!viewId && fieldId) {
                            resolve(fieldId);
                            return;
                        }

                        //If we have a view and a field IDs but it wasn't part of a valid jQuery selector, try to read the value.
                        if (viewId && fieldId) {
                            const viewType = ktl.views.getViewType(viewId); //Read once more, in case the view has changed since first call above.
                            selector = '#' + viewId;
                            if (viewType === 'table')
                                selector += ' .' + fieldId;
                            else if (viewType === 'details')
                                selector += ' .' + fieldId + ' .kn-detail-body';
                            else if (viewType === 'form') {
                                selector += ' input#' + fieldId;
                            }
                            //Any other view types to support?
                        }
                    }

                    ktl.core.waitSelector(selector, 10000)
                        .then(() => {
                            if ($(selector).length) {
                                const fieldType = ktl.fields.getFieldType(fieldId);

                                let value;
                                if (ktl.views.getViewType(viewId) === 'form')
                                    value = $(selector)[0].value.trim();
                                else
                                    value = $(selector)[0].textContent.trim();

                                if (selector.includes('.kn-table-totals') || (fieldType && numericFieldTypes.includes(fieldType)))
                                    value = ktl.core.extractNumericValue(value, fieldId);

                                resolve(value);
                            }
                        })
                        .catch(e => {
                            reject('Failed waiting for selector in getTextFromSelector: ' + selector);
                        })
                })
            },

            parseNumericValue: function (textValue) {
                let value = textValue;

                if (value.match(/[^$,.£€\ \d-]/))
                    return NaN;

                if (value && ['$', '£', '€'].includes(value[0]))
                    value = value.slice(1); // remove currency symbol

                value = value.replace(new RegExp("\\ ", 'g'), ''); //remove spaces

                const commasCount = [...value.matchAll(new RegExp('\\,', 'g'))].length;
                const dotsCount = [...value.matchAll(new RegExp('\\.', 'g'))].length;

                if (commasCount > 1) { // expecting thousands separated by commas
                    value = value.replace(new RegExp("\\,", 'g'), '');
                } else if (dotsCount === 1) { // expecting decimals separated by dot
                    value = value.replace(new RegExp("\\,", 'g'), ''); // remove comma
                } else if (commasCount === 1 && dotsCount === 0 && value.split(',')[0].length > 3) { // expecting comma separating decimals
                    value = value.replace(/,/g, '.');
                } else { // expecting thousand separated by comma without decimals
                    value = value.replace(new RegExp("\\,", 'g'), '');
                }

                return parseFloat(value);
            },

            //Will parse a text value based on its field type, both params are required.
            //If valid, will return the numeric value as a string.
            //Blanks are considered as zero.
            //If an error is encountered during parsing (ex: illegal numeric chars found), returns undefined.
            extractNumericValue: function (value, fieldId) {
                if (value === undefined || !fieldId) return;

                var fld;
                var numericValue;
                var isNumeric = false;

                if (fieldId === 'chznBetter') {
                    fld = $('#chznBetter');
                    if (fld.length)
                        isNumeric = fld[0].attributes && fld[0].attributes.numeric;
                    if (isNumeric) {
                        if (value === '') return '0'; //Blanks are considered as zero, for enforceNumeric.

                        numericValue = parseFloat(value);
                        if (!isNaN(value))
                            return numericValue.toString();
                        else
                            return;
                    }
                }

                var fieldAttributes;
                fieldId = fieldId.match(/field_\d+/g);
                if (fieldId && fieldId.length)
                    fieldId = fieldId[0];

                if (!fieldId) return;

                var field = Knack.objects.getField(fieldId);
                if (!field) return;

                fieldAttributes = field.attributes;
                fld = $('#kn-input-' + fieldId);
                isNumeric = false;
                if (fld.length)
                    isNumeric = fld[0].attributes && fld[0].attributes.numeric;

                if (!(fieldAttributes && (numericFieldTypes.includes(fieldAttributes.type) || isNumeric))) return;

                //Is this field a calculation related to another field, like a Sum, Avg, or other?
                if (fieldAttributes.format && fieldAttributes.format.field) {
                    fieldId = fieldAttributes.format.field.key;
                    var field = Knack.objects.getField(fieldId);
                    if (!field) return;

                    fieldAttributes = field.attributes;
                    fld = $('#kn-input-' + fieldId);
                    isNumeric = false;
                    if (fld.length)
                        isNumeric = fld[0].attributes && fld[0].attributes.numeric;

                    if (!(fieldAttributes && (numericFieldTypes.includes(fieldAttributes.type) || isNumeric))) return;
                }

                //Remove all white spaces.
                value = value.replace(/\s/g, '');

                if (value === '') return '0'; //Blanks are considered as zero, for enforceNumeric.

                numericValue = ktl.core.parseNumericValue(value);

                if (isNaN(numericValue))
                    return;

                return numericValue.toString();
            },

            getKeywordsByType: function (viewOrFieldId, type) {
                if (!viewOrFieldId || !type) return [];

                var allKwInstancesOfType = ktlKeywords[viewOrFieldId];
                if (allKwInstancesOfType && allKwInstancesOfType[type])
                    return allKwInstancesOfType[type];

                return [];
            },

            computeTargetSelector: function (viewId, fieldId, options, recordId) {
                var targetFieldId;
                var targetViewId;
                var ktlTarget;
                var targetSel;

                if (options && options.ktlTarget) {
                    ktlTarget = options.ktlTarget;

                    if (ktlTarget === 'page')
                        ktlTarget = '$(".kn-content")';
                    else if (ktlTarget === 'scene')
                        ktlTarget = '$(".kn-scene")';

                    const isJQueryTarget = ktl.core.extractJQuerySelector(ktlTarget);
                    if (isJQueryTarget)
                        targetSel = isJQueryTarget;
                    else {
                        const targetArray = ktl.core.splitAndTrimToArray(ktlTarget);
                        const arrayLength = targetArray.length;
                        if (arrayLength) {
                            //Search parameters to see if we can find a direct view_id.
                            for (let i = targetArray.length - 1; i >= 0; i--) {
                                let targetEl = targetArray[i];

                                if (targetEl.startsWith('view_'))
                                    targetViewId = targetEl;
                                else if (targetEl.startsWith('field_'))
                                    targetFieldId = targetEl;
                                else {
                                    const viewFromTitle = ktl.scenes.findViewWithTitle(targetEl);
                                    if (viewFromTitle)
                                        targetViewId = viewFromTitle;
                                    else {
                                        fieldId = ktl.fields.getFieldIdFromLabel(targetViewId || viewId, targetEl);
                                        if (!fieldId) {
                                            //Try with a link. Use case where a targetEl is a link instead of a typical field.
                                            if (recordId) {
                                                const linkTestSel = `#${viewId} [data-record-id="${recordId}"] .kn-details-link:textEquals("${targetEl}")`;
                                                if (linkTestSel.length)
                                                    return linkTestSel;
                                            }
                                        }
                                    }
                                }
                            }

                            //Still nothing?  Fall back to default: keyword's view.
                            if (!targetViewId)
                                targetViewId = viewId;

                            targetSel = '#' + targetViewId; //Starting point - the view ID.
                        }
                    }
                }

                if (!targetSel)
                    targetSel = '#' + viewId; //Starting point - the view ID.

                if (!targetFieldId && fieldId.startsWith('field_'))
                    targetFieldId = fieldId;

                if (targetFieldId) {
                    const viewType = ktl.views.getViewType(targetViewId); //Read once more, in case the view has changed since first call above.

                    if (recordId && (viewType === 'table' || viewType === 'search' || viewType === 'list'))
                        targetSel += ` tr[id="${recordId}"]`;

                    if (viewType === 'table' || viewType === 'search') {
                        const fieldType = ktl.views.getFieldTypeInView(viewId, targetFieldId);
                        if (fieldType === 'link') {
                            const colIndex = ktl.views.getColumnIndex(viewId, targetFieldId);
                            targetSel += ` .col-${colIndex}`;
                        } else
                            targetSel += ` .${fieldId}`;
                    } else if (viewType === 'details' || viewType === 'list')
                        targetSel += ` .${fieldId} .kn-detail-body`;
                    else if (viewType === 'form') {
                        targetSel += ` input#${fieldId}`;
                    }
                    //TODO: Support all view types.
                }

                return targetSel;
            },

            //selector parameter is a full jQuery string including dollar sign etc.
            //Ex1: $('#view_100 .field_200')
            //Ex2: $("li.menu-links__list-item:contains('Prev. Stay Info')")
            //MUST NOT include any backslashes for escaped characters like \' for quotes.
            extractJQuerySelector: function (selector) {
                if ((selector.startsWith("$('") || selector.startsWith('$("')) && (selector.endsWith("')") || selector.endsWith('")'))) {
                    return selector.substring(3, selector.length - 2);
                }
            },

            //Currently used to enter a password for Dev Tools Popup
            //But can be upgraded for general purpose interactions.
            createPopup: function (callback) {
                if (typeof callback !== 'function') return;

                ktl.systemColors.getSystemColors()
                    .then((sc) => {
                        var sysColors = sc;

                        var popupDiv = document.createElement('div');
                        popupDiv.setAttribute('id', 'popupDivId');
                        popupDiv.classList.add('devBtnsDiv', 'center');
                        var popupHdr = document.createElement('div');
                        popupHdr.setAttribute('id', 'popupHdrIdheader');
                        popupHdr.classList.add('ktlDevToolsHeader');
                        popupHdr.style['background-color'] = sysColors.paleLowSatClr;
                        popupHdr.innerText = ':: Enter Password ::';
                        popupDiv.appendChild(popupHdr);
                        document.body.appendChild(popupDiv);

                        var inputField = document.createElement("input");
                        inputField.type = 'password';
                        inputField.setAttribute('autocomplete', 'off');
                        inputField.classList.add('ktlDevToolsSearchInput');
                        popupDiv.appendChild(inputField);
                        inputField.focus();
                        setTimeout(() => {
                            inputField.value = ''; //Needed because autocomplete off doesn't work sometimes.
                        }, 1000);

                        inputField.addEventListener('keyup', function (event) {
                            if (event.key === 'Enter') {
                                $('#popupDivId').remove();
                                callback(inputField.value);
                            }
                        });
                    });
            },

            //Used to center an element on screen dynamically, without using classes or forcing styles.
            centerElementOnScreen: function (element, fixed = true) {
                var elementWidth = element.offsetWidth;
                var elementHeight = element.offsetHeight;
                var screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                var screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                var centeredLeft = (screenWidth - elementWidth) / 2;
                var centeredTop = (screenHeight - elementHeight) / 2;
                element.style.position = (fixed ? 'fixed' : 'absolute');

                element.style.left = centeredLeft + 'px';
                element.style.top = centeredTop + 'px';
            },

            showKnackStyleMessage: function (viewId, message, style = 'error' /*or success*/) {
                Knack.$['utility_forms'].renderMessage($('#' + viewId), '<b>' + message + '</b>', style);
            },

            findParentURL: function (URLNow, numParents) {
                if (numParents < 1 || numParents > 10) {
                    console.error("Number of parents should be between 1 and 10.");
                    return null;
                }

                // Split the URL after the protocol to avoid altering the 'http://' or 'https://'
                let protocolSplit = URLNow.split("://");
                if (protocolSplit.length < 2) {
                    console.error("Invalid URL format.");
                    return null;
                }

                let protocol = protocolSplit[0];
                let urlWithoutProtocol = protocolSplit[1];

                let urlParts = urlWithoutProtocol.split('/').filter(part => part !== '');

                // Remove two segments for each parent level
                let segmentsToRemove = numParents * 2;
                let sliceIndex = urlParts.length - segmentsToRemove;

                if (sliceIndex < 0) {
                    console.error("Number of parents specified is too high for the given URLNow.");
                    return null;
                }

                let parentURL = protocol + "://" + urlParts.slice(0, sliceIndex).join('/');
                // Add back the trailing slash if the original URL had one
                if (URLNow.endsWith('/')) {
                    parentURL += '/';
                }

                return parentURL;
            },

            checkLocalhostServer: function (port) {
                return new Promise(function (resolve, reject) {
                    fetch(`http://localhost:${port}`, { method: 'GET', mode: 'no-cors' })
                        .then(() => {
                            resolve();
                            return;
                        })
                        .catch(() => { })
                        .finally(() => { ktl.log.clog('green', 'Local server check successfull.  Ignore error above.'); })

                    //We can safely reject very quickly since server usually responds within 50ms.  Catch takes way too long.
                    setTimeout(() => { reject(); }, 100);
                })
            },

            //To enable several Developer only features, and remember/apply the setting to any logged-in account.
            //Mostly useful to access the KTL Developer Tools popup and the Ctrl+Shift developperPopupTool.
            forceDevRole: function (force = true) {
                if (force)
                    ktl.storage.lsSetItem('forceDevRole', true, true);
                else
                    ktl.storage.lsRemoveItem('forceDevRole', true);
            },

            //Iterates through an object to find a key with a specified value.  Returns the found key.
            findKeyWithValueInObject: function (obj, keyToFind, keyValue, keyNameToReturn, exactMatch = true, maxDepth = 20, currentDepth = 0) {
                if (typeof obj !== 'object' || obj === null || currentDepth > maxDepth) return null;

                for (let key in obj) {
                    if (key === keyToFind) {
                        if (exactMatch && obj[key] === keyValue)
                            return obj[keyNameToReturn] || obj;
                        else if (!exactMatch && obj[key].includes(keyValue))
                            return obj[keyNameToReturn] || obj;
                    } else if (typeof obj[key] === 'object') {
                        let found = this.findKeyWithValueInObject(obj[key], keyToFind, keyValue, keyNameToReturn, exactMatch, maxDepth, currentDepth + 1);
                        if (found !== null)
                            return found;
                    }
                }

                return null;
            },
        }
    })(); //Core

    //====================================================
    //Storage feature
    //Utilities related to cookies and localStorage.
    var secureLs = null;
    this.storage = (function () {
        const COOKIE_DEFAULT_EXP_DAYS = 1;
        const hasLocalStorage = typeof (Storage) !== 'undefined';

        return {
            hasLocalStorage: function () {
                return hasLocalStorage;
            },

            appendItemJSON: function (key, value, ...args) {
                const item = ktl.storage.getItemJSON(key, ...args);
                ktl.storage.setItemJSON(key, { ...(item || []), ...value }, ...args);
            },

            setItemJSON: function (key, value, ...args) {
                ktl.storage.lsSetItem(key, JSON.stringify(value), ...args);
            },

            // Just specify key and func will prepend APP_ROOT_NAME.
            // Typically used for generic utility storage, like logging, custom filters, user preferences, etc.
            lsSetItem: function (key, data, noUserId = false, session = false, secure = false) {
                if (!key)
                    return;

                var userId = Knack.getUserAttributes().id;
                if (!noUserId && !userId)
                    userId = 'Anonymous'

                if (hasLocalStorage) {
                    try {
                        if (secure) {
                            secureLs.set(APP_ROOT_NAME + key + (noUserId ? '' : '_' + userId), data);
                        } else {
                            if (session)
                                sessionStorage.setItem(APP_ROOT_NAME + key + (noUserId ? '' : '_' + userId), data);
                            else
                                localStorage.setItem(APP_ROOT_NAME + key + (noUserId ? '' : '_' + userId), data);
                        }
                    }
                    catch (e) {
                        console.log('Error in localStorage.setItem', e);
                    }
                } else
                    alert('KEC_1005 - lsSetItem called without storage');
            },

            getItemJSON: function (...args) {
                const item = ktl.storage.lsGetItem(...args);
                if (item)
                    return JSON.parse(item);
            },

            //Returns empty string if key doesn't exist.
            lsGetItem: function (key, noUserId = false, session = false, secure = false) {
                if (!key)
                    return;

                var userId = Knack.getUserAttributes().id;
                if (!noUserId && !userId)
                    userId = 'Anonymous'

                var val = '';
                if (hasLocalStorage) {
                    if (secure) {
                        val = secureLs.get(APP_ROOT_NAME + key + (noUserId ? '' : '_' + userId));
                    } else {
                        if (session)
                            val = sessionStorage.getItem(APP_ROOT_NAME + key + (noUserId ? '' : '_' + userId));
                        else
                            val = localStorage.getItem(APP_ROOT_NAME + key + (noUserId ? '' : '_' + userId));
                    }
                }
                return val ? val : '';
            },

            lsRemoveItem: function (lsKey, noUserId = false, session = false, secure = false) {
                if (!lsKey)
                    return;

                var userId = Knack.getUserAttributes().id;
                if (!noUserId && !userId)
                    userId = 'Anonymous'

                if (hasLocalStorage) {
                    if (secure) {
                        ktl.storage.initSecureLs()
                            .then(() => {
                                val = secureLs.remove(APP_ROOT_NAME + lsKey + (noUserId ? '' : '_' + userId));
                            })
                            .catch(reason => { ktl.log.clog('purple', reason); });
                    } else {
                        if (session)
                            sessionStorage.removeItem(APP_ROOT_NAME + lsKey + (noUserId ? '' : '_' + userId));
                        else
                            localStorage.removeItem(APP_ROOT_NAME + lsKey + (noUserId ? '' : '_' + userId));
                    }
                }
            },

            saveUserSetting: function (setting = '', value = '', expdays = COOKIE_DEFAULT_EXP_DAYS) {
                if (setting === '' || value === '') {
                    alert('Called saveUserSetting with invalid parameters.');
                    return;
                }

                //Save cookies per user.
                var username = Knack.getUserAttributes().name;
                ktl.storage.setCookie(username + '_' + setting, value, expdays);
            },

            loadUserSetting: function (setting) {
                var username = Knack.getUserAttributes().name;
                return ktl.storage.getCookie(username + '_' + setting);
            },

            setCookie: function (cname, cvalue, exdays = COOKIE_DEFAULT_EXP_DAYS) {
                var d = new Date();
                d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
                var expires = 'expires=' + d.toUTCString();
                document.cookie = APP_ROOT_NAME + cname + '=' + cvalue + ';' + expires + ';path=/';
            },

            getCookie: function (cname) {
                var name = APP_ROOT_NAME + cname + '=';
                var decodedCookie = decodeURIComponent(document.cookie);
                var ca = decodedCookie.split(';');
                for (var i = 0; i < ca.length; i++) {
                    var c = ca[i];
                    while (c.charAt(0) === ' ') {
                        c = c.substring(1);
                    }
                    if (c.indexOf(name) === 0) {
                        return c.substring(name.length, c.length);
                    }
                }
                return '';
            },

            deleteCookie: function (cname) {
                document.cookie = cname + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            },

            deleteAllCookies: function () {
                var cookies = document.cookie.split(';');
                for (var i = 0; i < cookies.length; i++) {
                    var cookie = cookies[i];
                    var eqPos = cookie.indexOf('=');
                    var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                    if (name.indexOf(APP_ROOT_NAME + Knack.getUserAttributes().name) >= 0)
                        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
                }
            },

            initSecureLs: function () {
                return new Promise(function (resolve, reject) {
                    if (typeof SecureLS === 'function')
                        resolve();
                    else {
                        ktl.core.loadLib('SecureLS')
                            .then(() => {
                                do {
                                    var key = ktl.storage.lsGetItem('AES_EK', true, false, false);
                                    if (!key || key === '') {
                                        key = prompt('Create AES Key:', ktl.core.generateRandomChars(40));
                                        if (!key)
                                            ktl.core.timedPopup('You must specify a Key.', 'warning');
                                    }
                                } while (!key || key === '');

                                ktl.storage.lsSetItem('AES_EK', key, true, false, false);
                                applyAesKey(key);
                            })
                            .catch(reason => { reject('initSecureLs error:', reason); })
                    }
                    function applyAesKey(key) {
                        secureLs = new SecureLS({
                            encodingType: 'aes',
                            isCompression: false,
                            encryptionSecret: key,
                        });
                        resolve();
                    }
                });
            },
        }
    })(); //storage

    //====================================================
    //Fields feature
    this.fields = (function () {
        var keyBuffer = '';
        var usingBarcodeReader = false;
        var onKeyPressed = null;
        var onFieldValueChanged = null;
        var textAsNumeric = []; //These are text fields that must be converted to numeric.
        var textAsNumericExcludeScenes = []; //Do not enforce numric for these scenes.
        var chznBetterSrchDelay = 1500; //Default is fine-tuned experimentally, for 'a bit below average' typing speed.
        var chznBetterThresholds = {};
        var chznBetterToExclude = [];
        var chznBetterSetFocus = null;
        var onInlineEditPopup = null;
        var convertNumDone = false;
        var horizontalRadioButtons = false;
        var horizontalCheckboxes = false;
        var processBarcode = null;

        var chznBetterTxt = '';
        var chznChoicesIntervalId = null;
        var chznLastKeyTimer = null;

        //TODO: Migrate all variables here.
        var cfg = {
            barcoreTimeout: 50,
            barcodeMinLength: 3,
            convertNumToTel: true,
        }

        $(document).keydown(function (e) {
            if (e.keyCode === 13) { //Enter
                var valid = e.target.getAttribute('valid');
                if (valid && valid !== 'true') {
                    e.preventDefault();
                    return;
                }

                //Inline editing: Leave just a bit of time for the chzn object to settle, then submit new cell-editor value.
                if (document.querySelector('#cell-editor .chzn-container')) {
                    e.preventDefault(); //Do not submit whole form.
                    setTimeout(function () {
                        $('#cell-editor > div.submit > a').trigger('click');
                    }, 200);
                } else if (document.querySelector('#cell-editor .kn-button[disabled=disabled]'))
                    e.preventDefault();

                //Some inline edit field types do not Submit on Enter. This solves the problem.

                //For Paragraph Text, user need to press Ctrl+Enter to Submit.
                //This allows using the more natural Enter to add a line feed.
                if ((e.target.type === 'textarea' && !e.ctrlKey))
                    return;

                //For some reason, in a Rich Text, the Ctrl+Enter event can't be trapped.  To investigate...
                if (e.target.classList.contains('redactor-editor')) {
                    if (e.ctrlKey)
                        console.log('RT with Ctrl'); //This one doesn't work as expected - we can't get here.
                    else {
                        //console.log('RT without Ctrl');
                        return;
                    }
                }

                $('#cell-editor .is-primary').click();

                //Filters: enables using the enter key to select and submit.
                setTimeout(function () { $('#kn-submit-filters').trigger('click'); }, 200);
            }

            readBarcode(e);
        })

        $(document).on('keypress', function (e) {
            if (e.keyCode === 10) { //Numpad Enter on Android does nothing in Knack.  Now it Submits the form.
                var currentFormView = $('div.kn-form').attr('id');
                $('#' + currentFormView + ' > form > div.kn-submit > button.kn-button.is-primary').trigger('click');
                return;
            }

            if ($('.kn-login').length > 0) //Let all keys pass through in login screen.
                return;

            //In a chznBetter, pressing enter submits the current text without waiting.
            if (!ktl.fields.getUsingBarcode() && e.keyCode === 13/*Enter key*/ && e.target.id === 'chznBetter') {
                e.preventDefault();
                ktl.fields.searchChznBetterDropdown(chznBetterTxt);
            }

            clearTimeout(chznLastKeyTimer);

            onKeyPressed(e);
        })

        document.addEventListener('click', function (e) {
            //Chzn dropdown bug fix.
            //Do we have a chzn dropdown that has more than 500 entries?  Only those have an autocomplete field.
            var chzn = $(e.target).closest('.chzn-container');
            if (chzn && chzn.length > 0 && (chzn.find('input.ui-autocomplete-input').length > 0)) {
                if (chzn.find('#chznBetter').length > 0) {
                    if ($('#chznBetter').length > 0) {
                        //If a single sel dropdown, fetch text from clicked entry and put in in chznBetter input.
                        var chznSingle = chzn.find('.chzn-single');
                        if (chznSingle.length > 0)
                            chznBetterTxt = chznSingle.text().replace('Type to search', chznBetterTxt).replace('Select', chznBetterTxt);

                        $('#chznBetter').val(chznBetterTxt);
                        ktl.fields.ktlChznBetterSetFocus();
                    }
                }
            }


            //Work in progress:  When user clicks on a cell for inline editing, provide a method to change its style, to make it wider for example.
            if (e.target.classList) {
                if (e.target.closest('.cell-editable .cell-edit')) {
                    ktl.core.waitSelector('#cell-editor .kn-input, .redactor-editor')
                        .then(() => { ktl.fields.ktlInlineEditActive(e); })
                        .catch(err => { console.log('Failed waiting for cell editor.', err, e); });
                }
            }
        })

        document.addEventListener('focus', function (e) {
            if (document.activeElement.classList.contains('input')) {
                //Turn-off auto complete for Kiosks. Users are annoyed by the dropdown that blocks the Submit button.
                if (ktl.core.isKiosk())
                    document.activeElement.setAttribute('autocomplete', 'off');

                try { //Prevent error on unsupported elements.
                    ktl.core.getCfg().enabled.selTextOnFocus && document.activeElement.setSelectionRange(0, document.activeElement.value.length); //Auto-select all text of input field.
                } catch { /*ignore*/ }


                //Find a better way than redo all over again.
                convertNumDone = false;
                ktl.fields.convertNumToTel();
            }

            //Do we need to add the chznBetter object?
            //chznBetter is ktl's fix to a few chzn dropdown problems.
            //Note that support of multi-selection type has been removed.  Too buggy for now, and needs more work.
            if (ktl.core.getCfg().enabled.chznBetter && !ktl.fields.getUsingBarcode()) {
                //Do we have a chzn dropdown that has more than 500 entries?  Only those have an autocomplete field and need a fix.
                var dropdownId = $(e.target).closest('.chzn-container').attr('id');

                var dropdownNeedsFix = false;
                if (dropdownId !== undefined && !dropdownId.includes('kn_conn_'))
                    dropdownNeedsFix = $('#' + dropdownId).find('.ui-autocomplete-input').length > 0;

                if (e.target.tagName.toLowerCase() === 'input') {
                    if (dropdownId !== undefined && $('#' + dropdownId).find('#chznBetter').length > 0) {
                        //console.log('Clicked dropdown already has chznBetter');
                    } else {
                        clearInterval(chznChoicesIntervalId);
                        $('#chznBetter').remove();

                        if (dropdownNeedsFix && dropdownId.length > 0) {
                            if ($('#chznBetter').length === 0)
                                ktl.fields.addChznBetter(dropdownId);
                        }
                    }
                }
            }
        }, true);

        $(document).on('input', function (e) {
            if (!ktl.fields.getUsingBarcode()) {

                //Process special field keywords
                var fieldId = e.target.id;
                if (!fieldId.startsWith('field_'))
                    fieldId = $('#' + fieldId).closest('.kn-input').attr('data-input-id');

                if (!fieldId || !fieldId.startsWith('field_')) return;

                if (ktlKeywords[fieldId]) {
                    if (ktlKeywords[fieldId]._uc)
                        e.target.value = e.target.value.toUpperCase();

                    if (ktlKeywords[fieldId]._num)
                        e.target.value = e.target.value.replace(/[^0-9.-]/g, '');

                    if (ktlKeywords[fieldId]._int)
                        e.target.value = e.target.value.replace(/[^0-9]/g, '');
                }

                ktl.fields.enforceNumeric();

                if ($(e.target).length > 0) {
                    var inputVal = $(e.target).val();
                    var threshold = 0;
                    if ($('#chznBetter').length > 0)
                        threshold = $('#chznBetter').attr('threshold');

                    if ($(e.target)[0].id === 'chznBetter') {
                        //Leave this here even though we update these two variables again a few lines below.
                        //This is to cover cases where threshold chars is not reached and focus is set elsewhere by user.
                        inputVal = inputVal.trim();
                        chznBetterTxt = inputVal;
                        chznLastKeyTimer = setTimeout(function () {
                            if (inputVal.length >= threshold) {
                                inputVal = $(e.target).val().trim(); //Get a last update in case user was quick and entered more than threshold chars.
                                ktl.fields.searchChznBetterDropdown(inputVal);
                            }
                        }, chznBetterSrchDelay);
                    } else if ($(e.target)[0].className.includes('ui-autocomplete-input')) {
                        var chznBetter = $(e.target).parent().find('#chznBetter');
                        if (chznBetter.length > 0) {
                            //When focus is switched to input in background, leave it there,
                            //but copy input text to foreground chznBetter field so user can see it.
                            inputVal = inputVal.trim();
                            chznBetterTxt = inputVal;
                            chznBetter.val(chznBetterTxt);

                            //Update filtered results again.
                            chznLastKeyTimer = setTimeout(function () {
                                if (inputVal.length >= threshold) {
                                    inputVal = $(e.target).val().trim(); //Get a last update in case user was quick and entered more than 4 chars.
                                    ktl.fields.searchChznBetterDropdown(inputVal);
                                }
                            }, chznBetterSrchDelay);
                        }
                    }
                }
            }
        })

        //Add Change event handlers for Dropdowns, Calendars, etc.
        $(document).on('knack-scene-render.any', function (event, scene) {
            //Dropdowns
            var timeout = null;
            $('.chzn-select').chosen().change(function (e, p) {
                if (e.target.id && e.target.selectedOptions[0]) {
                    const records = [...e.target.selectedOptions].map(option => {
                        return {
                            text: option.innerText,
                            id: option.value
                        }
                    });

                    const [viewId, fieldId] = e.target.id.split('-');
                    ktl.persistentForm.ktlOnSelectValueChanged({ viewId: viewId, fieldId: fieldId, records: records, e: e });

                    // Keep single record call for retro-compatibility of external code
                    ktl.fields.onFieldValueChanged({ viewId: viewId, fieldId: fieldId, recId: e.target.selectedOptions[0].value, text: e.target.selectedOptions[0].innerText, e: e }); //Notify app of change
                }
            })

            //Calendars
            $('.knack-date').datepicker().change(function (e) {
                processFieldChanged({ text: e.target.value, e: e });
            })

            //More to come...
            //TODO: multiple selection dropdowns

            //For text input changes, see inputHasChanged
            function processFieldChanged({ text: text, recId: recId, e: e }) {
                try {
                    var viewId = e.target.closest('.kn-view').id;
                    var fieldId = document.querySelector('#' + e.target.id).closest('.kn-input').getAttribute('data-input-id')
                        || document.querySelector('#' + viewId + ' .kn-search-filter #' + e.target.id).getAttribute('name'); //TODO: Need to support multiple search fields.

                    var p = { viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e };
                    ktl.persistentForm.ktlOnFieldValueChanged(p);
                    ktl.fields.onFieldValueChanged(p); //Notify app of change
                } catch { /*ignore*/ }
            }
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            if (horizontalRadioButtons) {
                $('#' + view.key + ' .kn-radio').addClass('horizontal');
                $('#' + view.key + ' .option.radio').addClass('horizontal');
            }

            if (horizontalCheckboxes) {
                $('#' + view.key + ' .kn-checkbox').addClass('horizontal');
                $('#' + view.key + ' .option.checkbox').addClass('horizontal');
            }
        })

        let barcodeText = '';
        let timeoutId;
        let lastCharTime = window.performance.now();
        function readBarcode(e) {
            if (!e.key) return;
            if (e.key.length === 1)
                barcodeText += e.key;

            if (barcodeText.length >= 2)
                ktl.fields.setUsingBarcode(true);

            if (ktl.fields.getUsingBarcode() && (e.key === 'Tab' || e.key === 'Enter'))
                e.preventDefault(); //Prevent Submitting form if terminator is CRLF or Tab.

            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (window.performance.now() - lastCharTime > cfg.barcoreTimeout) {
                    if (processBarcode && barcodeText.length >= cfg.barcodeMinLength)
                        processBarcode(barcodeText);

                    barcodeText = '';
                    ktl.fields.setUsingBarcode(false);
                }
            }, cfg.barcoreTimeout);

            lastCharTime = window.performance.now();
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.onKeyPressed && (onKeyPressed = cfgObj.onKeyPressed);
                cfgObj.onFieldValueChanged && (onFieldValueChanged = cfgObj.onFieldValueChanged);
                cfgObj.textAsNumeric && (textAsNumeric = cfgObj.textAsNumeric);
                cfgObj.textAsNumericExcludeScenes && (textAsNumericExcludeScenes = cfgObj.textAsNumericExcludeScenes);
                cfgObj.chznBetterSrchDelay && (chznBetterSrchDelay = cfgObj.chznBetterSrchDelay);
                cfgObj.chznBetterThresholds && (chznBetterThresholds = cfgObj.chznBetterThresholds);
                cfgObj.chznBetterToExclude && (chznBetterToExclude = cfgObj.chznBetterToExclude);
                cfgObj.chznBetterSetFocus && (chznBetterSetFocus = cfgObj.chznBetterSetFocus);
                cfgObj.onInlineEditPopup && (onInlineEditPopup = cfgObj.onInlineEditPopup);
                cfgObj.horizontalRadioButtons && (horizontalRadioButtons = cfgObj.horizontalRadioButtons);
                cfgObj.horizontalCheckboxes && (horizontalCheckboxes = cfgObj.horizontalCheckboxes);
                cfgObj.barcoreTimeout && (cfg.barcoreTimeout = cfgObj.barcoreTimeout);
                cfgObj.barcodeMinLength && (cfg.barcodeMinLength = cfgObj.barcodeMinLength);
                cfgObj.processBarcode && (processBarcode = cfgObj.processBarcode);
                if (typeof cfgObj.convertNumToTel !== 'undefined')
                    cfg.convertNumToTel = cfgObj.convertNumToTel;
            },

            //Converts all applicable fields in the scene from text to numeric (telephone) type to allow numeric keypad on mobile devices.
            //Also, using tel type is a little trick that allows auto-selection of text in a number field upon focus.
            convertNumToTel: function () {
                return new Promise(function (resolve) {
                    if (convertNumDone || ktl.scenes.isiFrameWnd() || textAsNumericExcludeScenes.includes(Knack.router.current_scene_key)) {
                        resolve();
                    } else {
                        var forms = document.querySelectorAll('.kn-form');
                        forms.forEach(form => {
                            var viewId = form.id;
                            if ($('#cell-editor .input').length)
                                viewId = 'cell-editor';

                            if (viewId) {
                                const fields = document.querySelectorAll('#' + viewId + ' .kn-input-short_text, #' + viewId + ' .kn-input-number, #' + viewId + ' .kn-input-currency');
                                fields.forEach(field => {
                                    var fieldAttr = field.attributes['data-input-id'] || field.attributes.id;
                                    var fieldId = fieldAttr.value;
                                    var fieldDesc = ktl.fields.getFieldDescription(fieldId);
                                    const fieldType = ktl.fields.getFieldType(fieldId);
                                    if ((fieldType && numericFieldTypes.includes(fieldType)) || fieldDesc.includes('_num') || fieldDesc.includes('_int') || textAsNumeric.includes(fieldId)) {
                                        if (!field.getAttribute('numeric')) {
                                            field.setAttribute('numeric', true);

                                            //We also need to change the input field itself to force numeric (tel) keyboard in mobile devices.
                                            if (cfg.convertNumToTel) {
                                                var originalInput = $('#' + viewId + ' #' + fieldId);
                                                if (originalInput.length) {
                                                    const originalValue = $('#' + viewId + ' #' + fieldId).val();
                                                    var originalHandlers = $._data(originalInput[0], 'events');
                                                    var newInput = $('<input>').attr('type', 'tel').attr('id', fieldId);

                                                    // Copy over any relevant attributes from the original input to the new input
                                                    newInput.attr('name', originalInput.attr('name'));
                                                    newInput.attr('class', originalInput.attr('class'));
                                                    // ... (copy any other attributes you need)

                                                    originalInput.replaceWith(newInput);
                                                    newInput.val(originalValue);

                                                    // Restore the original event handlers to the new input field
                                                    if (originalHandlers) {
                                                        $.each(originalHandlers, function (eventType, handlers) {
                                                            $.each(handlers, function (index, handler) {
                                                                newInput.on(eventType, handler.handler);
                                                            });
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                })
                            }
                        })

                        convertNumDone = true;
                        resolve();
                    }
                })
            },

            //Prevents entering non-numeric values in a numeric field.
            //If an error is detected, the Submit button is disabled and the field is colored in pink.
            //It may seem be inefficient to scan all views and fields, but it must be so in order to support persistent form data.
            enforceNumeric: function () {
                if (!ktl.core.getCfg().enabled.formPreValidation) return;

                var forms = document.querySelectorAll('#cell-editor');
                if (!forms.length)
                    forms = document.querySelectorAll('.kn-form');

                forms.forEach(form => {
                    var viewId = form.id;
                    if (viewId) {
                        var formValid = true;
                        var fields = document.querySelectorAll('#cell-editor #chznBetter[numeric=true]');
                        if (!fields.length)
                            fields = document.querySelectorAll('#cell-editor .kn-input[numeric=true]');
                        if (!fields.length)
                            fields = document.querySelectorAll('#' + viewId + ' .kn-input[numeric=true]');

                        fields.forEach(field => {
                            var inputFld = document.querySelector('#chznBetter[numeric=true]') ||
                                document.querySelector('#' + viewId + ' #' + field.getAttribute('data-input-id'));

                            if (inputFld) {
                                var value = inputFld.value;

                                var fieldValid = !isNaN(ktl.core.extractNumericValue(value, inputFld.id));

                                var fieldDesc = ktl.fields.getFieldDescription(inputFld.id);
                                if (fieldDesc && fieldDesc.includes('_int'))
                                    fieldValid = fieldValid && (value.search(/[^0-9]/) === -1);

                                if (fieldDesc && fieldDesc.includes('_num'))
                                    fieldValid = fieldValid && (value.search(/[^0-9.-]/) === -1);

                                formValid = formValid && fieldValid;
                                inputFld.setAttribute('valid', fieldValid);
                                if (fieldValid)
                                    $(inputFld).removeClass('ktlNotValid');
                                else
                                    $(inputFld).addClass('ktlNotValid');
                            }
                        })

                        var submit = document.querySelector('#' + viewId + ' .is-primary');
                        if (submit) {
                            if (!submit.validity)
                                submit.validity = { ktlInvalidItemObj: {} };

                            var submitInvalidItemObj = submit.validity.ktlInvalidItemObj;

                            if (formValid) {
                                if (submitInvalidItemObj && !submitInvalidItemObj.numericValid)
                                    delete submitInvalidItemObj.numericValid;
                            } else {
                                if (submitInvalidItemObj)
                                    submitInvalidItemObj.numericValid = false;
                                else
                                    submit.validity.ktlInvalidItemObj = { numericValid: false };
                            }
                        }

                        ktl.views.updateSubmitButtonState(viewId);
                    }
                })
            },

            addButton: function (div = null, label = '', style = '', classes = [], id = '') {
                if (!div) return null;

                !label && (label = 'Button');

                //If id is not specified, create it from Label. Ex: 'Closed Lots' will give id = 'closed-lots-id'
                if (!id) {
                    id = ktl.core.getCleanId(label);
                    var viewId = $(div).closest('.kn-view').attr('id');
                    if (!viewId)
                        viewId = div.id;

                    id = viewId + '_' + id;
                }

                var button = document.getElementById(id);
                if (button === null) {
                    button = document.createElement('BUTTON');
                    button.id = id;
                    button.setAttribute('type', 'button');

                    button.appendChild(document.createTextNode(label));
                    div.append(button);
                }

                if (style !== '')
                    button.setAttribute('style', style);

                if (!style.includes('color:')) //TODO: improve this to ignore background-color, but still trigger on (font) color.  Need better parsing.
                    ktl.systemColors.getSystemColors().then(sc => { button.style.color = sc.text.rgb });

                if (classes.length > 0)
                    button.classList.add(...classes);

                return button;
            },

            addCheckbox: function (div = null, label = '', state = false, id = '', cbStyle = '', lbStyle = '') {
                if (!div || !label) return null;

                !id && (id = ktl.core.getCleanId(label));

                var cbLabel = document.getElementById(id + '-label-id');
                var checkBox = document.getElementById(id + '-id');

                if (!checkBox) {
                    checkBox = document.createElement('input');
                    checkBox.type = 'checkbox';
                    checkBox.id = id + '-id';
                    cbLabel = document.createElement('label');
                    cbLabel.htmlFor = id + '-id';
                    cbLabel.setAttribute('id', id + '-label-id');
                    cbLabel.appendChild(document.createTextNode(label));
                }

                checkBox.setAttribute('style', 'margin-left: 5px; width: 15px; height: 15px; ' + cbStyle);
                cbLabel.setAttribute('style', 'vertical-align: text-bottom; margin-left: 5px; margin-right: 20px; ' + lbStyle);
                div.append(checkBox, cbLabel);
                checkBox.checked = state;

                return checkBox;
            },

            addInput: function (div = null, label = '', type = 'text', value = '', id = '', inStyle = '', lbStyle = '') {
                if (!div || !label) return null;

                !id && (id = ktl.core.getCleanId(label));

                var inLabel = document.getElementById(id + '-label');
                var input = document.getElementById(id);

                if (!input) {
                    input = document.createElement('input');
                    input.type = type;
                    input.id = id;
                    inLabel = document.createElement('label');
                    inLabel.htmlFor = id;
                    inLabel.setAttribute('id', id + '-label');
                    inLabel.appendChild(document.createTextNode(label));
                }

                input.setAttribute('style', inStyle ? inStyle : 'margin-left: 5px; width: 15px; height: 15px;');
                inLabel.setAttribute('style', lbStyle ? lbStyle : 'vertical-align: text-bottom; margin-left: 5px; margin-right: 20px;');
                div.append(input, inLabel);
                input.value = value;

                return input;
            },

            //====================================================
            addRadioButton: function (div = null, label = '', name = ''/*group*/, id = '', value = '', rbStyle = '', lbStyle = '') {
                if (!div || !name || !id) return null;

                !id && (id = ktl.core.getCleanId(label));

                var rbLabel = document.getElementById(id + '-label');
                var rbBtn = document.getElementById(id);

                if (rbBtn === null) {
                    rbBtn = document.createElement('input');
                    rbBtn.type = 'radio';
                    rbBtn.name = name;
                    rbBtn.id = id;
                    rbLabel = document.createElement('label');
                    rbLabel.htmlFor = id;
                    rbLabel.setAttribute('id', id + '-label');
                    rbLabel.appendChild(document.createTextNode(label));
                }

                rbBtn.setAttribute('style', rbStyle ? rbStyle : 'margin-left: 5px; width: 18px; height: 18px; margin-top: 3px;');
                rbLabel.setAttribute('style', lbStyle ? lbStyle : 'vertical-align: text-bottom; margin-left: 5px; margin-right: 20px; margin-top: 3px;');
                div.append(rbBtn, rbLabel); //Move this up in === null ?
                rbBtn.value = value;

                return rbBtn;
            },

            //Barcode reader specific functions
            addChar: function (char = '') {
                if (!char) {
                    ktl.log.clog('purple', 'addChar - invalid');
                    return;
                }

                keyBuffer += char;
            },
            clearBuffer: function () { keyBuffer = ''; },
            getBuffer: function () { return keyBuffer; },
            setUsingBarcode: function (using) { usingBarcodeReader = using; },
            getUsingBarcode: function () { return usingBarcodeReader; },

            //TODO removeDropdownEntries: function...
            /////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////
            //Remove restricted entries from a dropdown.
            //In this case, only high-level SuperAdmin, Admin and Developer can change a role.
            //This works with regular dropdowns and within an inline editing table.
            //$(document).on('mousedown keyup', function (e) {
            //    var knInput = e.target.closest('.kn-input') || e.target.closest('.cell-edit');
            //    if (!knInput) return;

            //    var fieldId = knInput.getAttribute('data-input-id') || knInput.getAttribute('data-field-key');
            //    if (!fieldId) return;

            //    var fieldObj = Knack.objects.getField(fieldId);
            //    if (!fieldObj) return;

            //    var fieldType = fieldObj.attributes.type;
            //    if (fieldType === 'user_roles') {
            //        ktl.core.waitSelector('ul.chzn-results') //Wait for options list to be populated.
            //            .then(function () {
            //                if (Knack.getUserRoleNames().includes('SuperAdmin') ||
            //                    Knack.getUserRoleNames().includes('Admin') ||
            //                    Knack.getUserRoleNames().includes('Developer'))
            //                    return;

            //                $("ul.chzn-results li:contains('SuperAdmin')").remove();
            //                $("ul.chzn-results li:contains('Admin')").remove();
            //                $("ul.chzn-results li:contains('Manager')").remove();
            //                $("ul.chzn-results li:contains('Supervisor')").remove();
            //            })
            //            .catch(() => {
            //                console.log('Failed waiting for results');
            //            });
            //    }
            //});

            shouldBeNumeric: function (fieldId) {
                return textAsNumeric.includes(fieldId);
            },

            //chznBetter functions
            // Ex. param:  dropdownId = 'view_XXX_field_YYY_chzn';
            addChznBetter: function (dropdownId) {
                const input = $(`#${dropdownId} .ui-autocomplete-input`);
                const options = input.autocomplete('option');

                const fieldId = $('#' + dropdownId).closest('[data-input-id]').attr('data-input-id') || '';

                input.autocomplete('option', {
                    ...options,
                    minLength: chznBetterThresholds[fieldId] ? chznBetterThresholds[fieldId] : 3,
                    delay: chznBetterSrchDelay || 2000,
                });

                return;

                // TODO Search & Destroy ChznBetter code
                // var fieldId = document.querySelector('#' + dropdownId).closest('.kn-input').getAttribute('data-input-id');
                // if (chznBetterToExclude.includes(fieldId))
                //     return;

                // //console.log('Entering addChznBetter');
                // var srchField = null;
                // if ($('#chznBetter').length === 0) {
                //     chznBetterTxt = '';
                //     var chznBetter = document.createElement('input');

                //     //Numeric fields only, set to Tel type.
                //     if (textAsNumeric.includes(fieldId) && !textAsNumericExcludeScenes.includes(Knack.router.current_scene_key)) {
                //         chznBetter.setAttribute('type', 'tel');
                //         chznBetter.setAttribute('numeric', 'true');
                //         chznBetter.setAttribute('threshold', chznBetterThresholds[fieldId] ? chznBetterThresholds[fieldId] : '4'); //Minimum number of characters to be typed before search is triggered.
                //     } else {
                //         chznBetter.setAttribute('type', 'text');
                //         chznBetter.setAttribute('threshold', chznBetterThresholds[fieldId] ? chznBetterThresholds[fieldId] : '3');
                //     }

                //     chznBetter.setAttribute('id', 'chznBetter');
                //     chznBetter.classList.add('input');

                //     var chzn = $('#' + dropdownId);

                //     srchField = chzn.find('.chzn-search');
                //     if (srchField.length === 0)
                //         srchField = chzn.find('.search-field');

                //     if (srchField && srchField.length > 0) {
                //         srchField.append(chznBetter);
                //     }
                // }

                // if (srchField && srchField.length > 0) {
                //     if (chznBetter) {
                //         chznBetter.value = chznBetterTxt;
                //         chznBetter.style.position = 'absolute';

                //         setTimeout(function () {
                //             chznBetter.focus();
                //         }, 200);

                //         //Start monitoring selection changes.
                //         //Purpose:
                //         //  It's the only way we can detect a delete because it's impossible to get notifications from a click on an X.
                //         //  When the number of items change for whatever reason (add or delete), we want the focus back on the input field.
                //         var numSel = 0;
                //         var prevNumSel = 0;
                //         chznChoicesIntervalId = setInterval(function () {
                //             var chznChoices = chzn.find('.chzn-choices li');
                //             if (chznChoices && chznChoices.length > 1) { //Omit first one (actually last in list), since always search-field.
                //                 numSel = chznChoices.length - 1;

                //                 if (prevNumSel !== numSel) {
                //                     //console.log('Updating num selected =', numSel);
                //                     prevNumSel = numSel;
                //                     chznBetter.focus();
                //                 }
                //             }
                //         }, 1000);
                //     }
                // }
            },

            //For KTL internal use.
            ktlChznBetterSetFocus: function () {
                setTimeout(function () {
                    $('#chznBetter').focus();
                    chznBetterSetFocus && chznBetterSetFocus();
                }, 200);
            },

            searchChznBetterDropdown: function (text = '') {
                if (!text) return;

                try {
                    chznBetterTxt = text;
                    var cbSel = document.querySelector('#chznBetter');
                    if (!cbSel || cbSel.getAttribute('valid') === 'false')
                        return;

                    var chzn = document.activeElement.closest('.kn-input') || document.activeElement.closest('.chzn-container').previousElementSibling;
                    var fieldId = chzn.getAttribute('data-input-id') || chzn.getAttribute('name');
                    if (chzn && fieldId) {
                        ktl.views.searchDropdown(text, fieldId, false, true)
                            .then(function () {
                                if (ktl.core.isKiosk())
                                    document.activeElement.blur(); //Remove Virtual Keyboard
                            })
                            .catch(function (foundText) {
                                if (foundText === '')
                                    ktl.fields.ktlChznBetterSetFocus();
                                else {
                                    setTimeout(function () {
                                        $(chzn).find('.chzn-drop').css('left', ''); //Put back, since was moved to -9000px.
                                        chzn.focus(); //Partial Match: Let use chose with up/down arrows and enter.
                                    }, 500);
                                }
                            })
                    }
                }
                catch (e) {
                    ktl.log.clog('red', 'Exception in searchChznBetterDropdown:');
                    console.log(e);
                }
            },

            //TODO: allow modifying style dyanmically.
            //Typical use: make them wider to see more context when typing, or make font larger.
            ktlInlineEditActive: function (e) {
                var viewId = e.target.closest('.kn-view');
                if (viewId) {
                    viewId = viewId.id;
                    var fieldId = e.target.closest('.cell-edit').attributes['data-field-key'].value;
                    onInlineEditPopup && onInlineEditPopup(viewId, fieldId, e);
                }
            },

            //Handles Change events for Dropdowns, Calendars, etc.
            onFieldValueChanged: function (p = { viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e }) {
                onFieldValueChanged && onFieldValueChanged(p);
            },

            //Returns an object with the fieldId and viewId of a field containing specified text in its description.
            //If viewId is not specified, will search through all views in current scene, which takes a bit longer.
            //Supported view types are 'form' and 'table'.
            getFieldFromDescription: function (descr = '', viewId = '', viewType = 'form') {
                return new Promise(function (resolve, reject) {
                    if (!descr || (!['form', 'table'].includes(viewType))) {
                        ktl.log.clog('purple', 'getFieldFromDescription called with bad parameters.');
                        console.log('descr =', descr, '\nviewId =', viewId, '\nviewType =', viewType);
                        reject();
                        return;
                    }

                    try {
                        var views = [];
                        var intervalId = setInterval(function () {
                            if (typeof Knack.router.scene_view.model.views.models === 'object') {
                                clearInterval(intervalId);
                                clearTimeout(failsafeTimeout);

                                if (viewId) {
                                    views.push(Knack.router.scene_view.model.views._byId[viewId]);
                                } else
                                    views = Knack.router.scene_view.model.views.models;

                                for (var v = 0; v < views.length; v++) {
                                    var type = views[v].attributes.type;
                                    if (type === viewType) {
                                        viewId = views[v].id;
                                        if (!Knack.views[viewId]) continue; //Happens for views that are hidden by rules.
                                        var fieldsAr = [];
                                        if (type === 'form')
                                            fieldsAr = Knack.views[viewId].getInputs();
                                        else
                                            fieldsAr = Knack.views[viewId].model.view.fields;

                                        if (typeof fieldsAr === 'object') {
                                            for (var i = 0; i < fieldsAr.length; i++) {
                                                var field = Knack.objects.getField(type === 'form' ? fieldsAr[i].id : fieldsAr[i].key);
                                                if (typeof field.attributes.meta === 'object') {
                                                    var fldDescr = field.attributes.meta && field.attributes.meta.description;
                                                    if (fldDescr && fldDescr.includes(descr)) {
                                                        resolve({ viewId: viewId, fieldId: field.attributes.key });
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }, 100);

                        var failsafeTimeout = setTimeout(function () {
                            clearInterval(intervalId);
                            reject();
                        }, 15000);
                    } catch (e) {
                        console.log('getViewFieldIdFromDescription exception\n', e);
                        reject();
                    }
                })
            },

            getFieldDescription: function (fieldId = '') {
                if (!fieldId || !fieldId.startsWith('field_')) return;

                var descr = '';
                try { descr = Knack.fields[fieldId].attributes.meta.description; }
                catch { /*ignore*/ }
                return descr;
            },

            //Returns the fieldId with the specified view ID and field label.
            //The label is the text displayed, not the field's real name.
            getFieldIdFromLabel: function (viewId, fieldLabel, exactMatch = true) {
                if (!viewId || !fieldLabel) return;

                let view = ktl.views.getViewObject(viewId);
                if (!view) return;

                let viewObjToScan = view;
                let keyToFind;
                let keyNameToReturn;

                const viewType = view.type;
                try {
                    if (viewType === 'table' || viewType === 'search') {
                        keyToFind = 'header';
                        keyNameToReturn = 'id';
                        viewObjToScan = view.columns;
                    } else if (viewType === 'details' || viewType === 'list') {
                        keyToFind = 'name';
                        keyNameToReturn = 'key';
                        viewObjToScan = view.columns;
                    } else if (viewType === 'form') {
                        keyToFind = 'label';
                        keyNameToReturn = 'id';
                        viewObjToScan = view;
                    } else if (viewType === 'rich_text')
                        return;
                    else
                        ktl.log.clog('purple', 'getFieldIdFromLabel - Unsupported view type', viewId, viewType);
                    //Support more view types as we go.

                    const foundField = ktl.core.findKeyWithValueInObject(viewObjToScan, keyToFind, fieldLabel, keyNameToReturn, exactMatch);

                    if (foundField !== null) {
                        if (typeof foundField === 'string')
                            return foundField;
                        else if (typeof foundField === 'object' && foundField.field && foundField.field.key)
                            return foundField.field.key;
                    }
                }
                catch (e) {
                    ktl.log.clog('purple', 'getFieldIdFromLabel error: Invalid field selector encountered', fieldLabel, e);
                }
            },

            //Returns the field label with the specified view and field IDs.
            //The label is the text displayed, not the field's real name.
            getFieldLabelFromId: function (viewId, fieldId, exactMatch = true) {
                if (!viewId || !fieldId) return;

                let view = ktl.views.getViewObject(viewId);
                if (!view) return;

                let viewObjToScan = view;
                let keyToFind;
                let keyNameToReturn;
                let foundField;

                const viewType = view.type;
                try {
                    if (viewType === 'table' || viewType === 'search') {
                        keyToFind = 'field';
                        keyNameToReturn = 'header';
                        viewObjToScan = view.columns;
                        for (const key in viewObjToScan) {
                            const obj = viewObjToScan[key];
                            if (obj[keyToFind] && obj[keyToFind].key === fieldId)
                                foundField = obj[keyNameToReturn];
                        }
                    } else if (viewType === 'details' || viewType === 'list') {
                        keyToFind = 'key';
                        keyNameToReturn = 'name';
                        viewObjToScan = view.columns;
                    } else if (viewType === 'form') {
                        keyToFind = 'id';
                        keyNameToReturn = 'label';
                        viewObjToScan = view;
                    } else if (viewType === 'rich_text')
                        return;
                    else
                        ktl.log.clog('purple', 'getFieldLabelFromId - Unsupported view type', viewId, viewType);
                    //Support more view types as we go.

                    if (!foundField)
                        foundField = ktl.core.findKeyWithValueInObject(viewObjToScan, keyToFind, fieldId, keyNameToReturn, exactMatch);

                    return foundField;
                }
                catch (e) {
                    ktl.log.clog('purple', 'getFieldLabelFromId error: Invalid field selector encountered', fieldId, e);
                }
            },

            getFieldKeywords: function (fieldId, fieldKeywords = {}) {
                if (!fieldId) return;
                var fieldDesc = ktl.fields.getFieldDescription(fieldId);
                if (fieldDesc) {
                    fieldDesc = fieldDesc.replace(/(\r\n|\n|\r)|<[^>]*>/gm, ' ').replace(/ {2,}/g, ' ').trim();
                    var keywords = extractKeywords(fieldDesc);
                    if (!$.isEmptyObject(keywords))
                        fieldKeywords[fieldId] = keywords;
                }
                return fieldKeywords;
            },


            //Parameters are size, field ID and hidden text flag "h".
            generateBarcode: function (viewId, keywords) {
                if (!viewId || ktl.views.getViewType(viewId) !== 'details') return;

                const kw = '_bcg';
                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                if (keywords && keywords[kw]) {
                    var size = 200;
                    var hideText = false;

                    var fieldId;

                    if (keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                        const params = keywords[kw][0].params;

                        if (params.length && params[0].length) {
                            const sizeParam = Number(params[0][0]);
                            if (isNaN(sizeParam)) {
                                ktl.log.clog('purple', 'generateBarcode called with invalid size:', viewId, sizeParam);
                                return;
                            }

                            size = Math.max(30, sizeParam);

                            if (params[0].length >= 2) {
                                fieldId = params[0][1];
                                if (!fieldId.startsWith('field_'))
                                    fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldId);

                                if (!$('#' + viewId + ' .' + fieldId).length) {
                                    ktl.log.clog('purple', 'generateBarcode called with invalid field ID:', viewId, fieldId);
                                    return;
                                }
                            }

                            if (params[0].length >= 3 && params[0][2] === 'h')
                                hideText = true;
                        }
                    } else {
                        const fieldSel = $('#' + viewId + ' [class*="field_"]:first');
                        if (fieldSel.length) {
                            var classes = fieldSel[0].classList.value;
                            const match = classes.match(/field_\d+/);
                            if (match)
                                fieldId = match[0];
                        }
                    }

                    if (!fieldId) {
                        ktl.log.clog('purple', 'generateBarcode called with an invalid field ID:', viewId);
                        return;
                    }

                    //Read and reformat the QR String properly to convert any existing HTML line breaks to newline.
                    const text = $('#' + viewId + ' .' + fieldId + ' .kn-detail-body span span')[0].textContent.replace(/<br \/>/g, '\n');
                    const barcodeData = { text: text, width: size, height: size };
                    ktl.core.loadLib('QRGenerator')
                        .then(() => {
                            var qrCodeDiv = document.getElementById('qrCodeDiv');
                            if (!qrCodeDiv) {
                                qrCodeDiv = document.createElement('div');
                                $('#' + viewId + ' .' + fieldId).append(qrCodeDiv);
                                qrCodeDiv.setAttribute('id', 'qrCodeDiv');
                            }

                            if (qrCodeDiv.lastChild)
                                qrCodeDiv.removeChild(qrCodeDiv.lastChild);

                            $('#qrCodeDiv').qrcode(barcodeData);

                            if (hideText)
                                $('#' + viewId + ' .' + fieldId + ' .kn-detail-body').remove();
                        })
                        .catch(reason => { reject('generateBarcode error:', reason); })
                }
            },

            getFieldType: function (fieldId) {
                if (!fieldId) return;
                const fieldObj = Knack.objects.getField(fieldId);
                if (fieldObj && fieldObj.attributes && fieldObj.attributes.type)
                    return fieldObj.attributes.type;
            },

            hideFields: function (viewId, keywords) {
                if (!viewId || !keywords) return;

                const kw = '_hf';

                //Process fields keyword
                var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
                if (!$.isEmptyObject(fieldsWithKwObj)) {
                    var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                    var foundKwObj = {};
                    for (let i = 0; i < fieldsWithKwAr.length; i++) {
                        var fieldId = fieldsWithKwAr[i];
                        ktl.fields.getFieldKeywords(fieldId, foundKwObj);
                        if (!$.isEmptyObject(foundKwObj)) {
                            if (foundKwObj[fieldId][kw]) {
                                if (foundKwObj[fieldId][kw].length && foundKwObj[fieldId][kw][0].options) {
                                    const options = foundKwObj[fieldId][kw][0].options;
                                    if (ktl.core.hasRoleAccess(options)) {
                                        ktl.views.hideField(fieldId);
                                    }
                                } else
                                    ktl.views.hideField(fieldId);
                            }
                        }
                    }
                }

                //Process views keyword
                if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                    const kwList = ktl.core.getKeywordsByType(viewId, kw);
                    for (var kwIdx = 0; kwIdx < kwList.length; kwIdx++) {
                        execKw(kwList[kwIdx]);
                    }

                    function execKw(kwInstance) {
                        const options = kwInstance.options;
                        if (!ktl.core.hasRoleAccess(options)) return;

                        $('#' + viewId).addClass('ktlVisibilityHidden');

                        var elementsArray = [];
                        const kwFields = kwInstance.params[0];
                        for (var i = 0; i < kwFields.length; i++) {
                            var fieldLabel = kwFields[i];

                            var fieldId = fieldLabel;
                            if (!fieldLabel.startsWith('field_'))
                                fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldLabel);

                            if (fieldId) {
                                const el = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"]')
                                    || document.querySelector('#' + viewId + ' .' + fieldId);

                                el && elementsArray.push(el);
                            } else {
                                //Try with an action link.
                                const actLink = $('#' + viewId + ' .kn-details-link .kn-detail-body:textEquals("' + fieldLabel + '")');
                                if (actLink.length)
                                    elementsArray.push(actLink.parent());
                            }
                        }

                        if (elementsArray.length) {
                            const hide = () => {
                                elementsArray.forEach(el => {
                                    if (el.classList)
                                        el.classList.add('ktlHidden');
                                    else
                                        el[0].classList.add('ktlHidden');
                                })
                            }
                            const unhide = () => {
                                elementsArray.forEach(el => {
                                    if (el.classList)
                                        el.classList.remove('ktlHidden');
                                    else
                                        el[0].classList.remove('ktlHidden');
                                })
                            }

                            ktl.views.hideUnhideValidateKtlCond(options, hide, unhide)
                                .then(() => {
                                    $('#' + viewId).removeClass('ktlVisibilityHidden');
                                })
                        } else
                            $('#' + viewId).removeClass('ktlVisibilityHidden');
                    }
                }
            },
        }
    })(); //fields

    //====================================================
    //Persistent Form
    //Will automatically save and load form data to prevent losses after a refresh, power outage, network loss or other.
    this.persistentForm = (function () {
        const PERSISTENT_FORM_DATA = 'persistentForm';
        //To see all data types:  console.log(Knack.config);
        const TEXT_DATA_TYPES = ['address', 'date_time', 'email', 'link', 'name', 'number', 'paragraph_text', 'phone', 'short_text', 'currency'];


        //Add fields and scenes to exclude from persistence in these arrays.
        let scenesToExclude = [];
        let fieldsToExclude = [];

        let currentViews = {}; //Needed to cleanup form data from previous views, when scene changes.
        let previousScene = '';
        let isInitialized = false;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (ktl.scenes.isiFrameWnd()) return;

            if (previousScene !== scene.key) {
                previousScene = scene.key;

                for (const viewId in currentViews)
                    eraseFormData(viewId);

                currentViews = {};
            }

            if (!ktl.core.getCfg().enabled.persistentForm || scenesToExclude.includes(scene.key))
                return;

            ktl.fields.convertNumToTel().then(() => {
                loadFormData()
                    .then(() => {
                        isInitialized = true;
                        setTimeout(function () {
                            ktl.fields.enforceNumeric();
                            $(document).trigger('KTL.persistentForm.completed');
                        }, 1000);
                    })
            });
        });

        $(document).on('knack-view-render.any', function (event, view) {
            if (ktl.scenes.isiFrameWnd()
                || !ktl.core.getCfg().enabled.persistentForm
                || (view.scene && scenesToExclude.includes(view.scene.key))
                || view.type != 'form')
                return;

            const elementsToObserve = document.querySelectorAll(`#${view.key} .redactor-box`);

            const observer = new MutationObserver((records, observer) => {
                if (!isInitialized) return;

                const editor = $(records.find(record => $(record.target).closest('.redactor-editor').length).target).closest('.redactor-editor');
                if (editor)
                    formContentHasChanged(editor[0]);
            });

            elementsToObserve.forEach((element) =>
                observer.observe(element, { subtree: true, childList: true, attributes: false, characterData: true })
            );
        });

        $(document).on('knack-form-submit.any', function (event, view, record) {
            if (ktl.scenes.isiFrameWnd()) return;
            eraseFormData(view.key);
        });

        const debouncedFormContentHasChanged = debounce(formContentHasChanged, 500);
        document.addEventListener('input', function (event) {
            if (!isInitialized
                || !ktl.core.getCfg().enabled.persistentForm
                || scenesToExclude.includes(Knack.router.current_scene_key)
                || ktl.scenes.isiFrameWnd())
                return;

            if (!event
                || !event.target.type
                || event.target.id === 'chznBetter'
                || event.target.className.includes('knack-date')
                || event.target.className.includes('ui-autocomplete-input')
                || $(event.target).closest('.chzn-container').length)
                return;

            if ((event.type === 'focusout' && event.relatedTarget) || event.type === 'input')
                debouncedFormContentHasChanged(event.target);
        });

        $(document).on('click', function (e) {
            if (!ktl.core.getCfg().enabled.persistentForm || scenesToExclude.includes(Knack.router.current_scene_key) || ktl.scenes.isiFrameWnd() || Knack.getUserAttributes() === 'No user found')
                return;

            //TODO:  Investigate iOS bug with userFilters.
            if (e.target.className.includes && e.target.className.includes('kn-button is-primary') && e.target.classList.length > 0 && e.target.type === 'submit') {
                var view = e.target.closest('.kn-form.kn-view');
                if (view) {
                    ktl.views.waitSubmitOutcome(view.id)
                        .then(() => {
                            eraseFormData(view.id);
                        })
                        .catch(failure => {
                            //Normal in many cases, so log is removed.  Put back to debug, if ever.
                            //ktl.log.clog('red', 'Persistent Form - waitSubmitOutcome failed: ' + failure);
                        });
                }
            }
        })

        //When input field text has changed or has lost focus, save it.
        //Note that this function applies to text input fields only.  Other field types are saved through ktlOnFieldValueChanged.
        function formContentHasChanged(element) {
            const view = element.closest('.kn-form.kn-view');
            if (!view) return;

            const viewId = view.id;

            const knInput = element.closest('.kn-input');
            if (!knInput) return;

            const fieldId = knInput.getAttribute('data-input-id');
            if (!fieldId) return;

            let inputValue = element.value;
            const field = Knack.objects.getField(fieldId);

            if (field && field.attributes) {
                if (field.attributes.format && field.attributes.format.type === 'checkboxes') {
                    var options = document.querySelectorAll('#' + viewId + ' [data-input-id=' + fieldId + '] input.checkbox');
                    var optObj = {};
                    options.forEach(opt => {
                        optObj[opt.value] = opt.checked;
                    })
                    inputValue = optObj;
                } else if (field.attributes.type === 'rich_text') {
                    inputValue = element.innerHTML;
                }
            }

            const subFieldId = (fieldId !== element.id) ? element.id : '';

            saveFormData(inputValue, viewId, fieldId, subFieldId);
        }

        //Save data for a given view and field.
        function saveFormData(data, viewId = '', fieldId = '', subField = '') {
            //console.log('saveFormData', data, viewId, fieldId, subField);
            if (!isInitialized || !fieldId || !viewId || !viewId.startsWith('view_')) return; //Exclude connection-form-view and any other not-applicable view types.

            var formDataObj = {};
            var view = Knack.router.scene_view.model.views._byId[viewId];
            if (!view) return;
            var viewAttr = view.attributes;
            if (!viewAttr) return;

            var action = viewAttr.action;
            if (fieldsToExclude.includes(fieldId) || (action !== 'insert' && action !== 'create')/*Add only, not Edit or any other type*/)
                return;

            var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
            if (formDataObjStr)
                formDataObj = JSON.parse(formDataObjStr);

            if (fieldId === 'chznBetter')
                fieldId = $('#' + fieldId).closest('.kn-input').attr('data-input-id');

            var fieldObj = Knack.objects.getField(fieldId);
            if (fieldObj.attributes.type === 'password') return; //Ignore passwords.

            //console.log('saveFormData: formDataObj =', formDataObj);
            formDataObj[viewId] = formDataObj[viewId] ? formDataObj[viewId] : {};

            if (!subField) {
                if (typeof data === 'string') {
                    if (fieldObj) {
                        if (data === 'Select' && (fieldObj.attributes.type === 'connection' || fieldObj.attributes.type === 'user_roles'))
                            data = ''; //Do not save the placeholder 'Select';
                    }
                } else { //Object
                    data = JSON.stringify(data);
                }

                if (!data)
                    delete formDataObj[viewId][fieldId];
                else
                    formDataObj[viewId][fieldId] = data;
            } else { //Some field types like Name and Address have sub-fields.
                formDataObj[viewId][fieldId] = formDataObj[viewId][fieldId] ? formDataObj[viewId][fieldId] : {};
                formDataObj[viewId][fieldId][subField] = data;
            }

            if ($.isEmptyObject(formDataObj[viewId]))
                delete (formDataObj[viewId]);

            if ($.isEmptyObject(formDataObj))
                ktl.storage.lsRemoveItem(PERSISTENT_FORM_DATA);
            else {
                formDataObjStr = JSON.stringify(formDataObj);
                ktl.storage.lsSetItem(PERSISTENT_FORM_DATA, formDataObjStr);
            }

            currentViews[viewId] = viewId;

            //Colorize fields that have been modified.
            //Unfinished, need to compare with original value and colorize only if different.
            //$('#' + viewId + ' #' + fieldId).css({ 'background-color': '#fff0d0' });
            //$('#' + viewId + '-' + fieldId).css({ 'background-color': '#fff0d0' });
            //$('#' + viewId + '_' + fieldId + '_chzn .chzn-single').css({ 'background-color': '#fff0d0' });
        }

        //Loads any data previously saved for all fields in all forms.
        //Also adds Change event handlers for dropdowns and calendars.   Eventually, support all object types.
        //After loading, re-validates numeric fields and put errors in pink.
        function loadFormData() {
            return new Promise(function (resolve) {
                var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);

                if (!formDataObjStr || $.isEmptyObject(JSON.parse(formDataObjStr))) {
                    ktl.storage.lsRemoveItem(PERSISTENT_FORM_DATA); //Wipe out if empty object, JIC.
                    resolve();
                    return;
                }

                let formDataObj = {};
                currentViews = {};
                var intervalId = null;

                //Reload stored data, but only for Form type of views.
                Knack.router.scene_view.model.views.models.map(model => model.attributes).forEach( view => {
                    if (view.action != 'insert' && view.action != 'create')  //Add only, not Edit or any other type
                        return;

                    const viewData = JSON.parse(formDataObjStr)[view.key];
                    if (!viewData)
                        return;

                    currentViews[view.key] = view.key;
                    formDataObj[view.key] = viewData;

                    Object.keys(formDataObj[view.key]).forEach( fieldId => {
                        if (fieldsToExclude.includes(fieldId)) {
                            ktl.log.clog('purple', 'Skipped field for PF: ' + fieldId);
                            return; //JIC - should never happen since fieldsToExclude are never saved in the first place.
                        }

                        //If we have an object instead of plain text, we need to recurse into it for each sub-field.
                        const field = Knack.objects.getField(fieldId);
                        if (!field)
                            return;//TODO: Move this IF with continue at top.

                        var subField = '';
                        var fieldType = field.attributes.type;
                        var fieldText = formDataObj[view.key][fieldId];

                        if (fieldType === 'rich_text') {
                            $(`#${view.key} #${fieldId}`).data('redactor').code.set(fieldText);
                        } else if (TEXT_DATA_TYPES.includes(fieldType)) {
                            const setFieldText = (subField) => {
                                const selectElement = $(`#${view.key} [data-input-id=${fieldId}] select[name="${subField}"]`);

                                if (selectElement.length) {
                                    selectElement.val(fieldText);
                                    return;
                                }

                                const el = document.querySelector(`#${view.key} [data-input-id=${fieldId}] #${subField}.input`) //Must be first.
                                    || document.querySelector(`#${view.key} [data-input-id=${fieldId}] input`)
                                    || document.querySelector(`#${view.key} [data-input-id=${fieldId}] .kn-textarea`);

                                if (el) {
                                    //The condition !el.value means 'Write value only if currently empty'
                                    //and prevents overwriting fields just populated by code elsewhere.
                                    !el.value && (el.value = fieldText);
                                }
                            }

                            if (typeof fieldText === 'object') { //Ex: name and address field types.
                                var allSubFields = Object.keys(formDataObj[view.key][fieldId]);
                                allSubFields.forEach(function (eachSubField) {
                                    fieldText = formDataObj[view.key][fieldId][eachSubField];
                                    setFieldText(eachSubField);
                                    delete formDataObj[view.key][fieldId][eachSubField];
                                })
                            } else {
                                setFieldText();
                                delete formDataObj[view.key][fieldId];
                            }
                        } else if (fieldType === 'connection') {
                            if (typeof fieldText === 'object') {
                                subField = Object.keys(formDataObj[view.key][fieldId]);
                                fieldText = formDataObj[view.key][fieldId][subField];
                            }

                            if ($(`#${view.key}-${fieldId}`).hasClass('chzn-select')) { // Dropdown Selector
                                const ids = fieldText.split(';').map(record => {
                                    const [text, id] = record.split(':');
                                    return id;
                                }).filter(v => !!v);

                                const values = $(`#${view.key}-${fieldId}`).val() || [];
                                $(`#${view.key}-${fieldId}`).val([...values, ...ids ]).trigger("liszt:updated");
                            } else if ($(`#${view.key} #connection-picker-radio-${fieldId}`).length) { // Radio buttons
                                $(`#${view.key} #connection-picker-radio-${fieldId} input[value="${fieldText}"]`).click();
                            } else if ($(`#${view.key} #connection-picker-checkbox-${fieldId}`).length) { // Checkboxes
                                $(`#${view.key} #connection-picker-checkbox-${fieldId} input[value="${fieldText}"]`).click();
                            }
                        } else if (fieldType === 'multiple_choice') {
                            if (typeof fieldText === 'object') {
                                 Object.keys(formDataObj[view.key][fieldId]).forEach( subField => {
                                    const value = formDataObj[view.key][fieldId][subField];
                                    $(`#${subField}`).val(value);
                                })
                            } else if (field.attributes.format.type === 'radios') {
                                $(`#${view.key} #kn-input-${fieldId} [value="${fieldText}"]`).click();
                            } else if (field.attributes.format.type === 'checkboxes') {
                                var options = JSON.parse(fieldText);
                                Object.keys(options).forEach(key => {
                                    const option = $(`#${view.key} [data-input-id="${fieldId}"] input[value="${key}"]`).first();
                                    if (options[key] != option.prop('checked'))
                                        option.click();
                                })
                            } else {
                                const values = $(`#${view.key}-${fieldId}`).val() || [];
                                const choices = fieldText.split(';').map(choice => choice.split(':')[0])
                                $(`#${view.key}-${fieldId}`).val([...values, ...choices ]).trigger("liszt:updated");
                            }
                        } else if (fieldType === 'boolean') {
                            $(`#${view.key} [data-input-id="${fieldId}"] input[value="${fieldText}"]`).first().click();
                        } else if (fieldType === 'password') {
                            //Ignore.
                        } else {
                            ktl.log.clog('purple', 'Unsupported field type: ' + fieldId + ', ' + fieldType);
                        }

                        delete formDataObj[view.key][fieldId];

                    });

                    delete formDataObj[view.key];
                });

                //Wait until all views and fields are processed.
                intervalId = setInterval(function () {
                    if ($.isEmptyObject(formDataObj)) {
                        clearInterval(intervalId);
                        intervalId = null;
                        resolve();
                        return;
                    }
                }, 200);

                setTimeout(function () { //Failsafe
                    clearInterval(intervalId);
                    resolve();
                    return;
                }, 10000);
            })
        }

        //Remove all saved data for this view after a submit
        //If changing scene, erase for all previous scene's views.
        //If viewId is empty, erase all current scene's views.
        function eraseFormData(viewId = '') {
            if (viewId) {
                var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
                if (formDataObjStr) {
                    var formDataObj = JSON.parse(formDataObjStr);
                    delete formDataObj[viewId];
                    ktl.storage.lsSetItem(PERSISTENT_FORM_DATA, JSON.stringify(formDataObj));
                }
            } else {
                Knack.router.scene_view.model.views.models.forEach(function (eachView) {
                    var view = eachView.attributes;
                    eraseFormData(view.key);
                })
            }
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.scenesToExclude && (scenesToExclude = cfgObj.scenesToExclude);
                cfgObj.fieldsToExclude && (fieldsToExclude = cfgObj.fieldsToExclude);
            },

            //For KTL internal use.  Add Change event handlers for Dropdowns, Calendars, etc.
            ktlOnFieldValueChanged: function ({ viewId: viewId, fieldId: fieldId, recId: recId, text: text }) {
                if (!fieldsToExclude.includes(fieldId)) {
                    let longestWord = ktl.core.findLongestWord(text); //Maximize your chances of finding something unique, thus reducing the number of records found.

                    if (recId)
                        longestWord += '-' + recId;
                    saveFormData(longestWord, viewId, fieldId);
                }
            },
            ktlOnSelectValueChanged: function ({ viewId: viewId, fieldId: fieldId, records: records }) {
                if (!fieldsToExclude.includes(fieldId)) {
                    const data = records.map(record => record.text + ':' + record.id).join(';');
                    saveFormData(data, viewId, fieldId);
                }
            },
        }
    })(); //persistentForm

    //====================================================
    //System Colors feature
    this.systemColors = (function () {
        var sysColors = {};
        var initDone = false;

        Object.defineProperty(sysColors, 'initDone', {
            get: function () { return initDone; }
        });

        $(document).on('knack-view-render.any', function (event, view, data) {
            //Apply System Colors
            if (initDone) {
                $('.ktlOfflineStatusCritical').css({ 'color': sysColors.text.rgb + '!important' });

                ktl.systemColors.getSystemColors().then(sc => {
                    if (ktl.core.getCfg().enabled.rowHoverHighlight && sc.tableRowHoverBkgColor && sc.tableRowHoverBkgColor !== '') {
                        $('#' + view.key + ' .kn-table').removeClass('knTable--rowHover');
                        $('#' + view.key + ' .kn-table').addClass('ktlTable--rowHover');
                    }
                })

                if (ktl.core.getCfg().enabled.inlineEditColor && sysColors.inlineEditBkgColor && ktl.views.viewHasInlineEdit(view.key))
                    $(`#${view.key} td.cell-edit`).addClass('ktlInlineEditableCellsStyle');
            }
        })


        return {
            setCfg: function (cfgObj = {}) {
                if (cfgObj.inlineEditBkgColor && cfgObj.inlineEditBkgColor !== '')
                    sysColors.inlineEditBkgColor = cfgObj.inlineEditBkgColor;

                if (cfgObj.inlineEditFontWeight && cfgObj.inlineEditFontWeight !== '')
                    sysColors.inlineEditFontWeight = cfgObj.inlineEditFontWeight;
                else
                    sysColors.inlineEditFontWeight = '500';

                if (ktl.core.getCfg().enabled.inlineEditColor && sysColors.inlineEditBkgColor) {
                    ktl.core.injectCSS(
                        '.ktlInlineEditableCellsStyle {' +
                        'background-color: ' + sysColors.inlineEditBkgColor + ';' +
                        'font-weight: ' + sysColors.inlineEditFontWeight + '}' +

                        '.bulkEditSelectedCol.bulkEditSelectedRow {' +
                        'background-color: ' + sysColors.header.rgb + '66!important;' +
                        'border-color: ' + sysColors.header.rgb + ';}' +

                        '.cell-edit.bulkEditSelectedRow {' +
                        'background-color: ' + sysColors.header.rgb + '44!important;}'
                    );
                }

                if (cfgObj.tableRowHoverBkgColor && cfgObj.tableRowHoverBkgColor !== '')
                    sysColors.tableRowHoverBkgColor = cfgObj.tableRowHoverBkgColor;

                if (ktl.core.getCfg().enabled.rowHoverHighlight && sysColors.tableRowHoverBkgColor && sysColors.tableRowHoverBkgColor !== '') {
                    ktl.core.injectCSS(
                        '.ktlTable--rowHover tbody tr:hover {' +
                        'background-color: ' + sysColors.tableRowHoverBkgColor + '!important;' +
                        'transition: background-color .2s ease-out;}'
                    );
                }
            },

            //For KTL internal use.
            initSystemColors: function () {
                ktl.core.waitSelector('#kn-dynamic-styles')
                    .then(function () {
                        var dynStylesCssTxt = document.querySelector('#kn-dynamic-styles').innerText;

                        //Basic colors
                        sysColors.header = extractSysElClr(/#kn-app-header \{\s+background-color: #/gm); //Header background color
                        sysColors.button = extractSysElClr(/\.is-primary \{\s+background-color: #/gm); //Buttons background color
                        sysColors.buttonText = extractSysElClr(/\.kn-navigation-bar a \{\s+color: #/gm); //Buttons text color
                        sysColors.text = extractSysElClr(/\.kn-content a \{\s+color: #/gm); //Text color
                        sysColors.links = extractSysElClr(/\.knMenuLink.knMenuLink--button \{\s+color: #/gm); //Button Link text color

                        //Additional colors, usually derived from basic colors, or hard-coded.
                        var newS = 1.0;
                        var newV = 1.0;
                        var newRGB = '';

                        //User Filter buttons
                        newS = Math.min(1, sysColors.header.hsv[1] * 0.1);
                        newV = 0.8;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.header.hsv[0], newS, newV);
                        sysColors.filterBtnClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';

                        newS = Math.min(1, sysColors.header.hsv[1] * 0.2);
                        newV = 1.0;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.header.hsv[0], newS, newV);
                        sysColors.activeFilterBtnClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';

                        newS = 1.0;
                        newV = 1.0;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.header.hsv[0], newS, newV);
                        sysColors.borderClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';

                        //Public Filters
                        newS = Math.min(1, sysColors.button.hsv[1] * 0.6);
                        newV = 1.0;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.button.hsv[0], newS, newV);
                        sysColors.publicFilterBtnClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';

                        newS = Math.min(1, sysColors.button.hsv[1] * 0.4);
                        newV = 1.0;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.button.hsv[0], newS, newV);
                        sysColors.activePublicFilterBtnClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';

                        //Just a generic pale washed-out color for various items.
                        newS = 0.2;
                        newV = 0.7;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.header.hsv[0], newS, newV);
                        sysColors.paleLowSatClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';
                        sysColors.paleLowSatClrTransparent = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ', 0.5)';

                        newS = 0.5;
                        newV = 1.0;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.header.hsv[0], newS, newV);
                        sysColors.inlineEditBkgColor = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ', 0.1)';
                        sysColors.tableRowHoverBkgColor = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ', 0.2)';


                        initDone = true;
                        //console.log('Init complete, sysColors =', sysColors);

                        function extractSysElClr(cssSearchStr = '') {
                            var index = 0, clrIdx = 0;
                            var hsl = [], hsv = [], rgbClr = [];
                            index = dynStylesCssTxt.search(cssSearchStr);
                            clrIdx = dynStylesCssTxt.indexOf('#', index + 1);
                            var color = dynStylesCssTxt.substr(clrIdx, 7); //Format is #rrggbb
                            rgbClr = ktl.systemColors.hexToRgb(color);
                            hsl = ktl.systemColors.rgbToHsl(rgbClr[0], rgbClr[1], rgbClr[2]);
                            hsv = ktl.systemColors.rgbToHsv(rgbClr[0], rgbClr[1], rgbClr[2]);
                            return { rgb: color, hsl: hsl, hsv: hsv };
                        }
                    })
            },

            getSystemColors: function () {
                return new Promise(function (resolve, reject) {
                    if (initDone) {
                        resolve(sysColors);
                        return;
                    } else {
                        ktl.systemColors.initSystemColors();

                        var intervalId = setInterval(function () {
                            if (initDone) {
                                clearInterval(intervalId);
                                intervalId = null;
                                clearTimeout(failsafeTimeout);
                                resolve(sysColors);
                                return;
                            }
                        }, 100);

                        var failsafeTimeout = setTimeout(function () {
                            if (intervalId !== null) {
                                clearInterval(intervalId);
                                reject('getSystemColors failed with failsafeTimeout.');
                                return;
                            }
                        }, 5000);
                    }
                })
            },


            /**
                * The following color conversion code comes from here: https://gist.github.com/mjackson/5311256
            * Converts an RGB color value to HSL. Conversion formula
            * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
            * Assumes r, g, and b are contained in the set [0, 255] and
            * returns h, s, and l in the set [0, 1].
            *
            * @param   Number  r       The red color value
            * @param   Number  g       The green color value
            * @param   Number  b       The blue color value
            * @return  Array           The HSL representation
            */
            rgbToHsl: function (r, g, b) {
                r /= 255, g /= 255, b /= 255;

                var max = Math.max(r, g, b), min = Math.min(r, g, b);
                var h, s, l = (max + min) / 2;

                if (max == min) {
                    h = s = 0; // achromatic
                } else {
                    var d = max - min;
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                    }

                    h /= 6;
                }

                return [h, s, l];
            },

            /**
                * Converts an HSL color value to RGB. Conversion formula
                * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
                * Assumes h, s, and l are contained in the set [0, 1] and
                * returns r, g, and b in the set [0, 255].
                *
                * @param   Number  h       The hue
                * @param   Number  s       The saturation
                * @param   Number  l       The lightness
                * @return  Array           The RGB representation
                */
            hslToRgb: function (h, s, l) {
                var r, g, b;

                if (s == 0) {
                    r = g = b = l; // achromatic
                } else {
                    function hue2rgb(p, q, t) {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1 / 6) return p + (q - p) * 6 * t;
                        if (t < 1 / 2) return q;
                        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                        return p;
                    }

                    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    var p = 2 * l - q;

                    r = hue2rgb(p, q, h + 1 / 3);
                    g = hue2rgb(p, q, h);
                    b = hue2rgb(p, q, h - 1 / 3);
                }

                return [r * 255, g * 255, b * 255];
            },

            /**
                * Converts an RGB color value to HSV. Conversion formula
                * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
                * Assumes r, g, and b are contained in the set [0, 255] and
                * returns h, s, and v in the set [0, 1].
                *
                * @param   Number  r       The red color value
                * @param   Number  g       The green color value
                * @param   Number  b       The blue color value
                * @return  Array           The HSV representation
                */
            rgbToHsv: function (r, g, b) {
                r /= 255, g /= 255, b /= 255;

                var max = Math.max(r, g, b), min = Math.min(r, g, b);
                var h, s, v = max;

                var d = max - min;
                s = max == 0 ? 0 : d / max;

                if (max == min) {
                    h = 0; // achromatic
                } else {
                    switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                    }

                    h /= 6;
                }

                return [h, s, v];
            },

            /**
                * Converts an HSV color value to RGB. Conversion formula
                * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
                * Assumes h, s, and v are contained in the set [0, 1] and
                * returns r, g, and b in the set [0, 255].
                *
                * @param   Number  h       The hue
                * @param   Number  s       The saturation
                * @param   Number  v       The value
                * @return  Array           The RGB representation
                */
            hsvToRgb: function (h, s, v) {
                var r, g, b;

                var i = Math.floor(h * 6);
                var f = h * 6 - i;
                var p = v * (1 - s);
                var q = v * (1 - f * s);
                var t = v * (1 - (1 - f) * s);

                switch (i % 6) {
                    case 0: r = v, g = t, b = p; break;
                    case 1: r = q, g = v, b = p; break;
                    case 2: r = p, g = v, b = t; break;
                    case 3: r = p, g = q, b = v; break;
                    case 4: r = t, g = p, b = v; break;
                    case 5: r = v, g = p, b = q; break;
                }

                return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
            },

            //Comes from here:  https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
            hexToRgb: function (hex) {
                return hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i
                    , (m, r, g, b) => '#' + r + r + g + g + b + b)
                    .substring(1).match(/.{2}/g)
                    .map(x => parseInt(x, 16));
            },
        }; //return systemColors functions
    })(); //systemColors

    //====================================================
    //User Filters feature
    const LS_UF = 'UF';
    const LS_UFP = 'UFP';
    const LS_UF_ACT = 'UF_ACTIVE';

    this.userFilters = (function () {
        const SAVE_FILTER_BTN = 'Save';
        const STOP_FILTER_BTN = 'Stop';
        const LOCK_FILTERS_BTN = 'Lock';
        const FILTER_BTN_SUFFIX = 'filterBtn';
        const SAVE_FILTER_BTN_SEL = SAVE_FILTER_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-SaveFilter-filterBtn
        const STOP_FILTER_BTN_SEL = STOP_FILTER_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-StopFilter-filterBtn
        const LOCK_FILTERS_BTN_SEL = LOCK_FILTERS_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-LockFilter-filterBtn

        const FILTER_BTN_STYLE = 'font-weight: bold; margin-left: 2px; margin-right: 2px';

        function getUserFilters() {
            return fetchFilters(LS_UF);
        }
        function setUserFilters(filters, dateIsNow = true) {
            try {
                if (dateIsNow)
                    filters.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                ktl.storage.lsSetItem(LS_UF, JSON.stringify(cleanUpFilters(filters)));
            } catch (e) {
                console.log('Error while saving filters:', e);
            }
        }

        function getPublicFilters() {
            return fetchFilters(LS_UFP);
        }
        function setPublicFilters(filters, dateIsNow = true) {
            try {
                if (dateIsNow)
                    filters.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                ktl.storage.lsSetItem(LS_UFP, JSON.stringify(cleanUpFilters(filters)));
            } catch (e) {
                console.log('Error while saving filters:', e);
            }
        }

        function cleanUpFilters(filters) {
            //JIC - delete junk empty filters
            // if (!fltSrc[filterDivId].filters.length) {
            //     delete fltSrc[filterDivId];
            //     syncFilters(type, filterDivId);
            //     return;
            // }

            //JIC - delete junk unnamed filters
            // if (!filter || filter.filterName === '') {
            //     filters[filterDivId].filters.splice(btnIndex, 1);
            //     if (!filters[filterDivId].filters.length)
            //         delete filters[filterDivId];
            //     syncFilters(type, filterDivId);
            //     errorFound = true;
            //     console.log('errorFound =', filterDivId, JSON.stringify(filter));
            //     break;
            // }
            return filters;
        }

        let allowUserFilters = null; //Callback to your app to allow user filters based on specific conditions.
        let viewToRefreshAfterFilterChg = null;  //This is necessary to remember the viewId to refresh after we exit filter editing.
        let publicFiltersLocked = true; //To prevent accidental modifications of public filters.

        var touchTimeout;
        var contextMenuFilterEnabled = true;
        var ufDndEnabled;
        var ufDndMoving = false;

        function applyActiveFilters() {
            const models = Knack.router.scene_view.model.views.models;
            if (!models.length || ($.isEmptyObject(getUserFilters()) && $.isEmptyObject(getPublicFilters())))
                return;

            models.forEach( model => {
                const viewId = model.attributes.key;
                if (model.attributes.type === 'report') {
                    //Reports are risky, since they don't have an absolute ID. Instead, they have an index and if they are moved around
                    //in the builder, the filters won't know about it and will stop working.
                    let reportIndex = 0;
                    model.attributes.rows.forEach((row) => {
                        const reports = row.reports;
                        if (reports.length) {
                            reports.forEach((report) => {
                                const filterId = `kn-report-${viewId}-${reportIndex + 1}`;
                                const filter = getActiveFilter(filterId);
                                const activeFilterIndex = filter.index;

                                if (activeFilterIndex >= 0) {
                                    const activeFilter = filter.filterSrc[filterId].filters[activeFilterIndex];

                                    if (activeFilter) {
                                        applyUserFilterToReportView(viewId, report, JSON.parse(activeFilter.filterString));
                                    }
                                }
                                reportIndex++;
                            })
                        }
                    })
                } else {
                    const filter = getActiveFilter(viewId);
                    var activeFilterIndex = filter.index;
                    if (activeFilterIndex >= 0) {
                        const activeFilter = filter.filterSrc[viewId].filters[activeFilterIndex];
                        if (activeFilter)
                            applyUserFilterToTableView(viewId, activeFilter.search, activeFilter.perPage, (activeFilter.sort && activeFilter.sort.split('-')[1]), JSON.parse(activeFilter.filterString));
                    } else
                        applyDefaultPublicFilter(viewId);
                }
            });
        }

        //Apply default Public Filter if no active filter.
        function applyDefaultPublicFilter(viewId) {
            if (!viewId) return;

            const kw = '_dpf';
            const kwList = ktl.core.getKeywordsByType(viewId, kw);
            kwList.forEach(kwInstance => { execKw(kwInstance); })

            function execKw(kwInstance) {
                const options = kwInstance.options;
                if (!ktl.core.hasRoleAccess(options)) return;
                if (!(kwInstance.params && kwInstance.params.length)) return;

                const publicFilterName = kwInstance.params[0][0];
                if (publicFilterName) {
                    const publicFilter = getFilter(viewId, publicFilterName);
                    if (publicFilter && publicFilter.type === LS_UFP) {
                        ktl.userFilters.setActiveFilter(publicFilterName, viewId);
                        const appliedFilter = publicFilter.filterSrc[viewId].filters[publicFilter.index];
                        if (appliedFilter)
                            applyUserFilterToTableView(viewId, appliedFilter.search, appliedFilter.perPage, (appliedFilter.sort && appliedFilter.sort.split('-')[1]), JSON.parse(appliedFilter.filterString));
                    }
                }
            }
        }

        function hideDefaultPublicFilter(viewId) {
            if (!viewId) return;

            const kw = '_dpf';
            const kwList = ktl.core.getKeywordsByType(viewId, kw);
            kwList.forEach(kwInstance => { execKw(kwInstance); })

            function execKw(kwInstance) {
                const publicFilterName = kwInstance.params[0][0];
                if (publicFilterName) {
                    if (kwInstance.params[0][0].length > 1) {
                        const hidden = (kwInstance.params[0][1] === 'h');
                        if (hidden)
                            $('#' + viewId + '_' + FILTER_BTN_SUFFIX + '_' + ktl.core.getCleanId(publicFilterName)).addClass('ktlHidden');
                    }
                }
            }
        }

        $(document).on('knack-scene-render.any', function (event, scene) {
            applyActiveFilters();
        });

        $(document).on('knack-scene-render.any', function (event, scene) {
            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            //Remove empty columns because it ruins the layout. Happens too often but not sure why (KTL or Knack?).
            ktl.core.waitSelector('.view-column', 5000) //Needed otherwise we miss them once in a while.
                .then(function () {
                    document.querySelectorAll('.view-column').forEach(column => {
                        if (!column.childElementCount)
                            column.remove();
                    })
                })
                .catch(() => { })
        });

        function applyUserFilterToTableView(viewId, search, perPage, sort, filters) {
            Knack.showSpinner();

            updateSearchTable(viewId, search);
            updatePerPage(viewId, perPage);
            updateSort(viewId, sort);
            updateFilters(viewId, filters);

            Knack.models[viewId].fetch({
                success: () => { Knack.hideSpinner(); }
            });
        }

        function applyUserFilterToReportView(viewId, viewReport, filters) {
            viewReport.this = Knack.views[viewId];
            if (viewReport.index === undefined) { // View not rendered yet
                $(document).one('knack-view-render.' + viewId, () => {
                    Knack.views[viewId].handleChangeFilters.call(viewReport, filters);
                });
            } else {
                Knack.views[viewId].handleChangeFilters.call(viewReport, filters);
            }
        }

        $(document).on('knack-records-render.report knack-records-render.table knack-records-render.list', function (e, view, data) {
            //Linked Filters _lf feature

            if (ktl.scenes.isiFrameWnd()) return;

            const masterViewId = view.key;
            const keywords = ktlKeywords[masterViewId];

            if (window.self.frameElement || $(`#${masterViewId} .kn-add-filter`).length === 0)
                return;

            if (!keywords || !keywords._lf)
                return;

            const linkedViewIds = ktl.views.convertViewTitlesToViewIds(keywords._lf[0].params[0], masterViewId);
            const masterView = Knack.models[masterViewId].view;

            if (linkedViewIds && !!masterView.filters && (masterView.filters.length === undefined || masterView.filters.length > 0)) {
                // Report view contains multiple subviews. Adding itself allows to apply the filter to all the subviews.
                if (masterView.type === 'report')
                    linkedViewIds.push(masterViewId);

                linkedViewIds.forEach((linkedViewId) => {
                    if (Knack.models[linkedViewId].view.type === 'report') {
                        Knack.models[linkedViewId].view.rows.forEach(row => {
                            row.reports.forEach(report => {
                                applyUserFilterToReportView(linkedViewId, report, masterView.filters);
                            });
                        });
                    } else if (masterView.type === 'table') {
                        const srchVal = $(`#${masterViewId} .table-keyword-search input`).val() || '';
                        //console.log('masterView.filters =', linkedViewId, masterView.filters);
                        applyUserFilterToTableView(linkedViewId, srchVal, masterView.rows_per_page, masterView.source.sort[0].field + '|' + masterView.source.sort[0].order, masterView.filters);
                    }
                });
            }
        })

        $(document).on('knack-records-render.report knack-records-render.table knack-records-render.list', function (e, view, data) {
            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            const viewId = view.key;

            if (!window.self.frameElement && allowUserFilters() && $(`#${viewId} .kn-add-filter`).length) {
                ktl.userFilters.addFilterButtons(viewId);
            }

            if (view.type === 'table') {
                $(`#${view.key} .kn-pagination .kn-select`).on('change', function (e) {
                    ktl.userFilters.saveFilter(view.key, true);
                });

                //When the Search button is clicked in table.
                $(`#${view.key} .kn-button.search`).on('click', function () {
                    const tableSearchText = $(`#${view.key} .table-keyword-search input`).val();
                    const activeFilter = getActiveFilter(view.key);
                    if (activeFilter.filterSrc[view.key]) {
                        const filter = activeFilter.filterSrc[view.key].filters[activeFilter.index];

                        if (filter && tableSearchText !== filter.search) {
                            ktl.userFilters.saveFilter(view.key, true);
                            updateSearchInFilter(view.key);
                        }
                    }
                });

                //When Enter is pressed in Search table field.
                $(`#${view.key} .table-keyword-search`).on('submit', function () {
                    ktl.userFilters.saveFilter(view.key, true);
                    updateSearchInFilter(view.key);
                });

                //When the Reset button is clicked in table's search.
                $(`#${view.key} .reset.kn-button.is-link`).on('click', function () {
                    $(`#${view.key} .table-keyword-search input`).val(''); //Force to empty otherwise we sometimes get current search string.
                    updateSearchInFilter(view.key);
                });

                $(`#${view.key} .kn-table-table th`).on('click', function () {
                    ktl.userFilters.saveFilter(view.key, true);
                });
            }
        })

        //Retrieves the searched string from the field and saves it in the localStorage's filter entry.
        function updateSearchInFilter(viewId) {
            var activeFilter = getActiveFilter(viewId);
            var filterSrc = activeFilter.filterSrc;
            if (!viewId || $.isEmptyObject(filterSrc) || $.isEmptyObject(filterSrc[viewId])) return;

            var filterIndex = activeFilter.index;
            if (filterIndex >= 0) {
                const isPublic = activeFilter.filterSrc[viewId].filters[filterIndex].public;

                if (!isPublic ||
                    (isPublic && document.querySelector('#' + viewId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-unlock-alt'))) {
                    var searchString = document.querySelector('#' + viewId + ' .table-keyword-search input').value;
                    filterSrc[viewId].filters[filterIndex].search = searchString;

                    if (activeFilter.type === LS_UF)
                        setUserFilters(filterSrc);
                    else
                        setPublicFilters(filterSrc);

                    if (getViewToRefresh()) {
                        const view = viewId.split('-')[2] || viewId.split('-')[0];
                        view && ktl.views.refreshView(view);
                    }
                }
            }
        }

        $(document).on('mousedown click', e => {
            if (ktl.scenes.isiFrameWnd()) return;

            //For Table views
            var viewId = e.target.closest('.kn-view');
            viewId = viewId ? viewId.id : null;

            //For Report views
            var filterDivId = e.target.closest('div[id^=kn-report-' + viewId + '-]:not(.filterDiv)');
            filterDivId = filterDivId ? filterDivId.id : viewId;

            //At this point we end up with either something like view_123 for tables or kn-report-view_123-1 for reports.

            //When user clicks on Add Filters button or edits the current filter, we must:
            // 1) remember the view we're in because when we click Submit in the filter's edit pop-up, it's not be possible to retrieve it.
            // 2) remove the current filter because it doesn't match anymore.
            if (e.type === 'mousedown' && e.target.closest('.kn-filters-nav,.kn-filters,.kn-remove-filter')) {
                setViewToRefresh(getViewToRefresh() || filterDivId);
                if (e.target.closest('.kn-remove-filter')) {
                    setViewToRefresh(null);
                    ktl.userFilters.removeActiveFilter(filterDivId);
                }
            } else if (e.target.id && e.target.id === 'kn-submit-filters') {
                var viewToRefresh = getViewToRefresh();
                if (viewToRefresh) {
                    setViewToRefresh(null);
                    ktl.userFilters.removeActiveFilter(viewToRefresh);
                }
            }
        })

        $('#knack-body').on('click touchstart', function (e) {
            if ($('.menuDiv').length) {
                $('.menuDiv').remove();
                ktl.views.autoRefresh();
                ufDndEnabled && ufDndEnabled.option('disabled', false);
            }
        });

        //Loads user filters from the localStorage and returns a temporary object.
        function fetchFilters(type) {
            if (type !== LS_UF && type !== LS_UFP) return;

            const lsStr = ktl.storage.lsGetItem(type) || '{}';

            try {
                return JSON.parse(lsStr);
            } catch (e) {
                alert('loadFilters - Error Found Parsing Filters:', e);
            }

            return {};
        }

        function createFilterButtons(filterDivId, fltBtnsDivId = '') {
            if (!filterDivId) return;

            //Public Filters first
            createFltBtns(filterDivId, getPublicFilters()[filterDivId], getFilter(filterDivId, '', LS_UFP).index);
            if (!Knack.getUserRoleNames().includes('Public Filters'))
                hideDefaultPublicFilter(filterDivId);

            //User Filters second
            createFltBtns(filterDivId, getUserFilters()[filterDivId], getFilter(filterDivId, '', LS_UF).index);

            function createFltBtns(filterDivId, viewfilters, activeIndex) {

                if ($.isEmptyObject(viewfilters))
                    return;

                for (var btnIndex = 0; btnIndex < viewfilters.filters.length; btnIndex++) {
                    var filter = viewfilters.filters[btnIndex];

                    var btnId = ktl.core.getCleanId(filter.filterName);
                    var filterBtn = ktl.fields.addButton(fltBtnsDivId, filter.filterName, FILTER_BTN_STYLE,
                        ['kn-button', 'is-small'],
                        filterDivId + '_' + FILTER_BTN_SUFFIX + '_' + btnId);

                    filterBtn.classList.add('filterBtn');
                    if (filter.public)
                        filterBtn.classList.add('public');
                    else
                        filterBtn.classList.remove('public');

                    if (btnIndex === activeIndex)
                        filterBtn.classList.add('activeFilter');
                    else
                        filterBtn.classList.remove('activeFilter');

                    filterBtn.filter = filter;

                    //================================================================
                    //Handle click event to apply filter and right-click to provide additional options in a popup.
                    filterBtn.addEventListener('click', e => { onFilterBtnClicked(e, filterDivId); });

                    filterBtn.addEventListener('touchstart', e => {
                        touchTimeout = setTimeout(() => {
                            contextMenuFilterEnabled && contextMenuFilter(e, filterDivId, e.target.filter);
                        }, 500);
                    });

                    filterBtn.addEventListener('touchmove', e => {
                        clearTimeout(touchTimeout);
                        contextMenuFilterEnabled = false;
                        ufDndMoving = true;
                    })

                    filterBtn.addEventListener('touchend', e => {
                        clearTimeout(touchTimeout);
                        if (!$('.menuDiv').length && !ufDndMoving)
                            onFilterBtnClicked(e, filterDivId);
                        ufDndMoving = false;
                    });

                    filterBtn.addEventListener('contextmenu', e => {
                        e.preventDefault(); //Prevent the default context menu from appearing.
                        contextMenuFilterEnabled && contextMenuFilter(e, filterDivId, e.target.filter);
                    });
                }

                applyButtonColors();
                setupFiltersDragAndDrop(filterDivId);
            }
        }

        function onFilterBtnClicked(event, filterDivId) {
            event.preventDefault();
            var target = event.target || event.currentTarget;
            if (!filterDivId || !target.filter) return;

            $('#' + filterDivId + ' .activeFilter').removeClass('activeFilter');
            target.classList.add('activeFilter');
            applyButtonColors();

            const filterUrlPart = formatFilterDivIdToUrlId(filterDivId);
            const filterString = target.filter.filterString;

            ktl.userFilters.setActiveFilter(target.filter.filterName, filterDivId);

            var isReport = false;
            if (filterUrlPart !== filterDivId)
                isReport = true;

            if (!isReport) {
                applyUserFilterToTableView(filterDivId, target.filter.search, target.filter.perPage, target.filter.sort, JSON.parse(filterString));
            } else {
                const [viewId, reportId] = filterDivId.replace('kn-report-', '').split('-');
                const report = Knack.models[viewId].view.rows
                    .reduce((result, row) => result || row.reports
                            .find( (report) => report.index === (reportId - 1)), undefined);

                applyUserFilterToReportView(viewId, report, JSON.parse(filterString));
            }
        };

        function updateSearchTable(viewId, srchTxt) {
            if (!viewId) return;
            var i = Knack.getSceneHash();
            var r = {}
            var a = [];
            !srchTxt && (srchTxt = '');
            r[viewId + "_search"] = encodeURIComponent(srchTxt);
            r[viewId + "_page"] = 1;
            Knack.views[viewId].model.view.pagination_meta.page = 1;
            Knack.views[viewId].model.view.source.page = 1;

            var o = Knack.getQueryString(r, a);
            o && (i += "?" + o);
            Knack.router.navigate(i, false);
            Knack.setHashVars();
        }

        function updateFilters(viewId, filters) {
            if (!viewId || !filters) return;
            const sceneHash = Knack.getSceneHash();
            const queryString = Knack.getQueryString({ [`${viewId}_filters`]: encodeURIComponent(JSON.stringify(filters)) });
            Knack.router.navigate(`${sceneHash}?${queryString}`, false);
            Knack.setHashVars();
            Knack.models[viewId].setFilters(filters); //Set new filters on view's model
        };

        function updatePerPage(viewId, perPage) {
            if (!viewId || !perPage) return;
            Knack.views[viewId].model.view.pagination_meta.page = 1;
            Knack.views[viewId].model.view.source.page = 1;
            Knack.views[viewId].model.view.pagination_meta.rows_per_page = perPage;
            Knack.views[viewId].model.view.rows_per_page = perPage;
            var query = {};
            query[viewId + '_per_page'] = perPage;
            query[viewId + '_page'] = 1;
            Knack.router.navigate(Knack.getSceneHash() + "?" + Knack.getQueryString(query), false);
            Knack.setHashVars();
        }

        function updateSort(viewId, sort) {
            if (!viewId || !sort) return;
            const sorts = decodeURIComponent(sort).split('|');

            if (sorts.length < 2)
                return;

            const field = sorts[0];
            const order = sorts[1];

            Knack.views[viewId].model.view.source.sort[0].field = field;
            Knack.views[viewId].model.view.source.sort[0].order = order;
        }

        function onStopFilterBtnClicked(e, filterDivId) {
            var closeFilters = document.querySelectorAll('#' + filterDivId + ' .kn-remove-filter');
            closeFilters.forEach(closeBtn => { closeBtn.click(); });
            ktl.userFilters.removeActiveFilter(filterDivId);
            setTimeout(() => {
                $('#' + filterDivId + ' .reset.kn-button.is-link').click();
            }, 1000);
        };

        function onLockFiltersBtnClicked(e, filterDivId) {
            publicFiltersLocked = !publicFiltersLocked;
            if (publicFiltersLocked)
                $('#' + filterDivId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-unlock-alt').removeClass('fa-unlock-alt').addClass('fa-lock');
            else
                $('#' + filterDivId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-lock').removeClass('fa-lock').addClass('fa-unlock-alt');
        };

        function applyButtonColors() {
            ktl.systemColors.getSystemColors()
                .then((sysColors) => {
                    $('.filterBtn').css({ 'background-color': sysColors.filterBtnClr, 'border-color': '' });
                    $('.activeFilter').css({ 'background-color': sysColors.activeFilterBtnClr/*, 'border-color': sysColors.borderClr */ });
                    $('.filterBtn.public').css({ 'background-color': sysColors.publicFilterBtnClr, 'border-color': '' });
                    $('.activeFilter.public').css({ 'background-color': sysColors.activePublicFilterBtnClr/*, 'border-color': sysColors.borderClr*/ });
                })
        }

        function contextMenuFilter(e, viewId, filter) {
            if (!e || !viewId || !filter) return;
            e.preventDefault();

            ufDndEnabled && ufDndEnabled.option('disabled', true);

            const filterName = filter.filterName;
            var thisFilter = getFilter(viewId, filterName);
            var filterIndex = thisFilter.index;
            var isPublic = thisFilter.filterSrc[viewId].filters[filterIndex].public;

            if (isPublic && !Knack.getUserRoleNames().includes('Public Filters')) {
                $('.menuDiv').remove(); //JIC
                return;
            }

            var menuDiv = $('.menuDiv');
            if (menuDiv.length !== 0)
                menuDiv.remove();

            menuDiv = document.createElement('div');
            menuDiv.setAttribute('class', 'menuDiv');
            $('#' + e.target.id).append(menuDiv);

            var pos = ktl.core.setContextMenuPostion(e, $('.menuDiv'));
            $('.menuDiv').css({ 'left': pos.x + 'px', 'top': pos.y + 'px', 'z-index': 2 });

            var ul = document.createElement('ul');
            menuDiv.appendChild(ul);
            ul.style.textAlign = 'left';
            ul.style.fontSize = 'larger';
            ul.style.listStyle = 'none';

            //Delete Filter
            const listDelete = document.createElement('li');
            listDelete.innerHTML = '<i class="fa fa-trash-o" style="margin-top: 2px;"></i> Delete';
            listDelete.style.marginBottom = '8px';
            $(listDelete).on('click touchstart', function (e) {
                e.preventDefault();
                $('.menuDiv').remove();
                ufDndEnabled && ufDndEnabled.option('disabled', false);

                var confirmationMsg = 'Are you sure you want to delete filter "' + filterName + '" ?';
                if (isPublic)
                    confirmationMsg = 'Warning:  This is a PUBLIC filter !!!\n\n' + confirmationMsg;

                if (confirm(confirmationMsg)) {
                    const filter = getFilter(viewId, filterName);
                    const filterSrc = filter.filterSrc;
                    filterSrc[viewId].filters.splice(filter.index, 1);
                    if (!filterSrc[viewId].filters.length)
                        delete filterSrc[viewId];

                    if (filter.type === LS_UF)
                        setUserFilters(filterSrc);
                    else
                        setPublicFilters(filterSrc);

                    if (getViewToRefresh()) {
                        const view = viewId.split('-')[2] || viewId.split('-')[0];
                        view && ktl.views.refreshView(view);
                    }

                    ktl.userFilters.addFilterButtons(viewId);

                    const activeFilterName = getActiveFilterName(viewId);

                    if (activeFilterName === filterName)
                        ktl.userFilters.removeActiveFilter(viewId);
                    else
                        ktl.userFilters.setActiveFilter(activeFilterName, viewId);
                }
            });
            ul.appendChild(listDelete);

            //Rename Filter
            const listRename = document.createElement('li');
            listRename.innerHTML = '<i class="fa fa-pencil-square-o" style="margin-top: 2px;"></i> Rename';
            listRename.style.marginBottom = '8px';
            $(listRename).on('click touchstart', function (e) {
                e.preventDefault();
                $('.menuDiv').remove();
                ufDndEnabled && ufDndEnabled.option('disabled', false);

                const newFilterName = prompt('New Filter Name: ', filterName);
                if (newFilterName && newFilterName !== filterName) {
                    let foundFilter = getFilter(viewId, newFilterName);
                    if (foundFilter.index >= 0) {
                        if (foundFilter.filterSrc[viewId].filters[foundFilter.index].filterName === newFilterName) {
                            alert('Filter name already exists.  Please use another one.');
                            return;
                        } else
                            foundFilter.filterSrc[viewId].filters[foundFilter.index].filterName = newFilterName;
                    } else { // No filter found. Overwrite name of active filter
                        let activeFilterName = getActiveFilterName(viewId);

                        if (activeFilterName === filterName)
                            activeFilterName = newFilterName;

                        foundFilter = getFilter(viewId, filterName);

                        foundFilter.filterSrc[viewId].filters[foundFilter.index].filterName = newFilterName;
                    }

                    if (foundFilter.type === LS_UF)
                        setUserFilters(foundFilter.filterSrc);
                    else
                        setPublicFilters(foundFilter.filterSrc);

                    if (getViewToRefresh()) {
                        const view = viewId.split('-')[2] || viewId.split('-')[0];
                        view && ktl.views.refreshView(view);
                    }

                    ktl.userFilters.addFilterButtons(viewId);
                    ktl.userFilters.setActiveFilter(newFilterName, viewId);
                }
            });
            ul.appendChild(listRename);

            //Public Filters, visible to all users.
            if (Knack.getUserRoleNames().includes('Public Filters')) {
                const listPublicFilters = document.createElement('li');
                listPublicFilters.innerHTML = '<i class="fa fa-gift" style="margin-top: 2px;"></i> Public: ';
                listPublicFilters.style.marginBottom = '8px';

                if (isPublic)
                    listPublicFilters.innerHTML += 'Yes';
                else
                    listPublicFilters.innerHTML += 'No';

                $(listPublicFilters).on('click touchstart', function (e) {
                    e.preventDefault();
                    $('.menuDiv').remove();
                    ufDndEnabled && ufDndEnabled.option('disabled', false);

                    const filter = getFilter(viewId, filterName);

                    if (filter.index < 0) {
                        ktl.log.clog('purple', 'Public Filter toggle, bad index found:', filter.index);
                        return;
                    }

                    //Toggle on/off
                    const currentFilter = filter.filterSrc[viewId].filters[filter.index];
                    filter.filterSrc[viewId].filters.splice(filter.index, 1);

                    const userFilters = getUserFilters();
                    const publicFilters = getPublicFilters();

                    if (currentFilter.public) {
                        delete currentFilter.public;
                        if (userFilters[viewId])
                            userFilters[viewId].filters.push(currentFilter);
                        else
                            userFilters[viewId] = { filters: [currentFilter] };

                        publicFilters[viewId].filters.splice(filter.index, 1);
                        if (!publicFilters[viewId].filters.length)
                            delete publicFilters[viewId];

                        setUserFilters(userFilters);
                        setPublicFilters(publicFilters);
                    } else {
                        currentFilter.public = true;
                        if (publicFilters[viewId])
                            publicFilters[viewId].filters.push(currentFilter);
                        else
                            publicFilters[viewId] = { filters: [currentFilter] };

                        userFilters[viewId].filters.splice(filter.index, 1);
                        if (!userFilters[viewId].filters.length)
                            delete userFilters[viewId];

                        setUserFilters(userFilters);
                        setPublicFilters(publicFilters);
                    }

                    ktl.userFilters.addFilterButtons(viewId);
                    ktl.userFilters.setActiveFilter(currentFilter.name, viewId);
                });

                ul.appendChild(listPublicFilters);
            }
        }

        function setViewToRefresh(viewId) {
            viewToRefreshAfterFilterChg = viewId;
        }

        function getViewToRefresh() {
            return viewToRefreshAfterFilterChg;
        }

        //Returns the filter found: container object, filter object, name, index, type.
        function getActiveFilter(viewId) {
            return getFilter(viewId, getActiveFilterName(viewId));
        }

        //Returns the filter found: container object, filter object, name, index, type.
        //If filterName is blank, it will find the active filter.
        function getFilter(viewId, filterName = '', type = '') {
            if (!viewId || (type && (type !== LS_UF && type !== LS_UFP))) return;

            var result = {};

            if (!filterName)
                filterName = getActiveFilterName(viewId);

            if (type)
                result = searchObj(type);
            else { //If type is not specified, search both.
                result = searchObj(LS_UF);
                if (result.index === -1)
                    result = searchObj(LS_UFP);
            }

            function searchObj(type) {
                const filterSrc = type === LS_UFP ? getPublicFilters() : getUserFilters();

                if (!filterSrc[viewId])
                    return { index: -1, type: LS_UF, filterSrc: getUserFilters() };

                const index = filterSrc[viewId].filters.findIndex(function (filter) {
                    if (filter && filterName && (filter.filterName.toLowerCase() === filterName.toLowerCase()))
                        return filter;
                });

                return { index: index, type: type, filterSrc: filterSrc };
            }

            return result;
        }

        function fetchActiveFilters() {
            const lsStr = ktl.storage.lsGetItem(LS_UF_ACT) || '{}';

            try {
                return JSON.parse(lsStr);
            } catch (e) {
                console.error('loadActiveFilters - Error Found Parsing object:', e);
            }
            return {};
        }

        function getActiveFilterName(viewId) {
            return fetchActiveFilters()[viewId] || '';
        }

        function updateActiveFilterName(viewId, name) {
            const filters = fetchActiveFilters();

            filters[viewId] = name;
            ktl.storage.lsSetItem(LS_UF_ACT, JSON.stringify(filters));
        }

        function setupFiltersDragAndDrop(filterDivId = '') {
            //Setup Drag n Drop for filter buttons.
            if (document.getElementById(filterDivId + '-filterDivId')) {
                ufDndEnabled = new Sortable(document.getElementById(filterDivId + '-filterDivId'), {
                    swapThreshold: 0.96,
                    animation: 250,
                    easing: "cubic-bezier(1, 0, 0, 1)",
                    onMove: function (/**Event*/evt, /**Event*/originalEvent) {
                        if (evt.dragged.filter.public && !Knack.getUserRoleNames().includes('Public Filters')) {
                            contextMenuFilterEnabled = true;
                            return false; //Cancel
                        }
                    },
                    onEnd: function (evt) {
                        if (evt.oldIndex !== evt.newIndex && evt.item.filter) {
                            var userFiltersAr = [];
                            var publicFiltersAr = [];

                            for (var i = 0; i < evt.to.children.length; i++) {
                                const item = evt.to.children[i];
                                const filters = getFilter(filterDivId, item.innerText);
                                if (filters && filters.index >= 0) {
                                    const filterObject = filters.filterSrc[filterDivId].filters[filters.index];
                                    if (evt.item.filter.public && filterObject.public)
                                        publicFiltersAr.push(filters.filterSrc[filterDivId].filters[filters.index]);
                                    else if (!evt.item.filter.public && !filterObject.public)
                                        userFiltersAr.push(filters.filterSrc[filterDivId].filters[filters.index]);
                                } else {
                                    console.log('ERROR - Invalid filter found');
                                    contextMenuFilterEnabled = true;
                                    return false;
                                }
                            }

                            if (userFiltersAr.length) {
                                const userFilters = getUserFilters();
                                userFilters[filterDivId].filters = userFiltersAr;
                                setUserFilters(userFilters);
                            } else if (publicFiltersAr.length) {
                                const publicFilters = getPublicFilters()
                                publicFilters[filterDivId].filters = publicFiltersAr;
                                setPublicFilters(publicFilters);
                            }

                            if (getViewToRefresh()) {
                                const view = filterDivId.split('-')[2] || viewId.split('-')[0];
                                view && ktl.views.refreshView(view);
                            }

                            ktl.userFilters.addFilterButtons(filterDivId);
                        }

                        contextMenuFilterEnabled = true;
                    }
                });
            }
        }

        function formatFilterDivIdToUrlId(filterDivId = '') {
            //Used to reformat the report div ID to the URL. Ex: kn-report-view_2924-1 becomes view_2924_0.
            const filterUrlPart = filterDivId.replace('kn-report-', '');
            const reportIndexSplit = filterUrlPart.split('-');
            if (reportIndexSplit.length < 2)
                return filterUrlPart;

            const index = parseInt(reportIndexSplit[1]) - 1;
            return reportIndexSplit[0] + '_' + index.toString();
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.allowUserFilters && (allowUserFilters = cfgObj.allowUserFilters);
            },

            getCfg: function () {
                return {
                    uf,
                };
            },

            //The entry point of the User Filters and Public Filters.
            addFilterButtons: function (viewId = '') {
                if (!document.querySelector('#' + viewId + ' .kn-add-filter'))
                    return;

                var allFiltersBar = document.querySelectorAll('[id^=kn-report-' + viewId + '-] .level-left'); //Report views
                if (!allFiltersBar.length)
                    allFiltersBar = document.querySelectorAll('#' + viewId + ' .kn-records-nav:not(.below) .level-left'); //Table views

                allFiltersBar.forEach(function (viewFilterDiv) {
                    var filterDivId = viewFilterDiv.closest('[id^=kn-report-' + viewId + '-]');

                    var adjustReportId = false;
                    if (filterDivId)
                        adjustReportId = true;
                    else
                        filterDivId = viewFilterDiv.closest('#' + viewId);

                    filterDivId = filterDivId ? filterDivId.id : null; //Typically view_123 for tables and kn-report-view_123-1 for reports.
                    if (adjustReportId)
                        filterUrlPart = formatFilterDivIdToUrlId(filterDivId);

                    if (filterDivId === null) {
                        if (ktl.account.isDeveloper())
                            alert('filterDivId is null for ' + viewFilterDiv + ', ' + viewId);
                        else
                            return;
                    }

                    //Force re-creation each time to get clean button order.  Also to remove existing click event handlers and prevent duplicates.
                    $('#' + filterDivId + ' .filterCtrlDiv').remove();

                    //Section for non-draggable control buttons.
                    var filterCtrlDiv = $('#' + filterDivId + ' .filterCtrlDiv');
                    if (filterCtrlDiv.length === 0) {
                        filterCtrlDiv = document.createElement('div');
                        filterCtrlDiv.setAttribute('class', 'filterCtrlDiv');
                        $('#' + filterDivId + ' .table-keyword-search').css({ 'display': 'flex' });
                        viewFilterDiv.appendChild(filterCtrlDiv);
                        $('#' + filterDivId + ' .filterCtrlDiv').css({ 'display': 'flex', 'margin-left': '15px' });
                    }

                    /////////////////////////////
                    //Save Filter button - always create, but enable/disable depending on filter state.
                    var saveFilterButton = ktl.fields.addButton(filterCtrlDiv, 'Save Filter', FILTER_BTN_STYLE + '; background-color: #ece6a6',
                        ['kn-button', 'is-small'],
                        filterDivId + '_' + SAVE_FILTER_BTN + '_' + FILTER_BTN_SUFFIX);

                    saveFilterButton.setAttribute('disabled', 'true');
                    saveFilterButton.classList.add('filterControl', 'tooltip');
                    saveFilterButton.innerHTML = '<i class="fa fa-save fa-lg" id="' + filterDivId + '-' + SAVE_FILTER_BTN_SEL + '"></i><div class="tooltip"><span class="tooltiptext">Name and save your filter.<br>This will create a button.</span ></div>';
                    saveFilterButton.addEventListener('click', e => { ktl.userFilters.saveFilter(filterDivId); });

                    //Stop Filters button - to temove all active filters button for this view.  Always create, but enable/disable depending on filter state.
                    var stopFilterButton = ktl.fields.addButton(filterCtrlDiv, 'Stop Filter', FILTER_BTN_STYLE + '; background-color: #e0cccc',
                        ['kn-button', 'is-small'],
                        filterDivId + '_' + STOP_FILTER_BTN + '_' + FILTER_BTN_SUFFIX);

                    stopFilterButton.setAttribute('disabled', 'true');
                    stopFilterButton.classList.add('filterControl', 'tooltip');
                    stopFilterButton.innerHTML = '<i class="fa fa-times fa-lg" id="' + filterDivId + '-' + STOP_FILTER_BTN_SEL + '"></i><div class="tooltip"><span class="tooltiptext">Remove all filtering and show all records.</span ></div>';
                    stopFilterButton.addEventListener('click', e => { onStopFilterBtnClicked(e, filterDivId); });

                    //Lock Public Filters button - to disable public Filters' automatic updates and triggering constant uploads.
                    if (Knack.getUserRoleNames().includes('Public Filters')) {
                        var lockPublicFiltersButton = ktl.fields.addButton(filterCtrlDiv, 'Lock Filters', FILTER_BTN_STYLE + '; background-color: #b3d0bd',
                            ['kn-button', 'is-small'],
                            filterDivId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX);

                        lockPublicFiltersButton.classList.add('filterControl', 'tooltip');
                        lockPublicFiltersButton.innerHTML = '<i class="fa ' + (publicFiltersLocked ? 'fa-lock' : 'fa-unlock-alt') + ' fa-lg" id="' + filterDivId + '-' + LOCK_FILTERS_BTN_SEL + '"></i><div class="tooltip"><span class="tooltiptext">Unlock for live Public Filters updates.</span ></div>';
                        lockPublicFiltersButton.addEventListener('click', e => { onLockFiltersBtnClicked(e, filterDivId); });
                    }

                    //Section for draggable user filter buttons.
                    var fltBtnsDivId = $('#' + filterDivId + ' .filterDiv');
                    if (fltBtnsDivId.length === 0) {
                        fltBtnsDivId = document.createElement('div');
                        fltBtnsDivId.setAttribute('class', 'filterDiv');
                        fltBtnsDivId.setAttribute('id', filterDivId + '-filterDivId');
                        $('#' + filterDivId + ' .table-keyword-search').css({ 'display': 'flex' });
                        filterCtrlDiv && filterCtrlDiv.appendChild(fltBtnsDivId);
                        $('#' + filterDivId + ' .filterDiv').css({ 'display': 'flex', 'margin-left': '5px' });
                    }

                    createFilterButtons(filterDivId, fltBtnsDivId);

                    //Enable/disable control buttons (Only save in this case)
                    if (document.querySelector('#' + filterDivId + ' .kn-tag-filter')) { //Is there an active filter from "Add filters"?
                        saveFilterButton.removeAttribute('disabled');
                        stopFilterButton.removeAttribute('disabled');
                    }
                })
            },

            setActiveFilter: function (filterName, filterDivId) {
                if (!filterDivId || !filterName) return;

                $('#' + filterDivId + ' .activeFilter').removeClass('activeFilter');
                var filterIndex = getFilter(filterDivId, filterName).index;
                if (filterIndex >= 0) {
                    var btnSelector = '#' + filterDivId + '_' + FILTER_BTN_SUFFIX + '_' + ktl.core.getCleanId(filterName);
                    ktl.core.waitSelector(btnSelector, 20000)
                        .then(function () {
                            var filterBtn = document.querySelector(btnSelector);
                            if (filterBtn) {
                                filterBtn.classList.add('activeFilter');
                                updateActiveFilterName(filterDivId, filterName);
                            }
                        })
                        .catch(function () {
                            ktl.log.clog('purple', 'setActiveFilter, Failed waiting for ' + btnSelector);
                        })
                } else
                    ktl.userFilters.removeActiveFilter(filterDivId);

                applyButtonColors();
            },

            removeActiveFilter: function (viewId) {
                if (!viewId) return;
                $('#' + viewId + ' .activeFilter').removeClass('activeFilter');
                applyButtonColors();

                updateActiveFilterName(viewId, undefined);
            },

            getActiveFilter: function (filterDivId) {
                const filter = getActiveFilter(filterDivId);

                if (filter.index >= 0)
                    return filter.filterSrc[filterDivId].filters[filter.index];
                else
                    return undefined;
            },

            appendToActiveFilter: function (filterDivId, name, property) {
                const filter = getActiveFilter(filterDivId) || {};

                if (filter.filterSrc[filterDivId] && filter.filterSrc[filterDivId].filters && filter.filterSrc[filterDivId].filters[filter.index]) {
                    filter.filterSrc[filterDivId].filters[filter.index][name] = property;

                    if (filter.type === LS_UF)
                        setUserFilters(filter.filterSrc);
                    else
                        setPublicFilters(filter.filterSrc);

                    return true;
                }
                return false;
            },

            saveFilter: function (filterDivId, updateActive = false) {
                if (!filterDivId) return;

                var filterUrlPart = formatFilterDivIdToUrlId(filterDivId);

                //Extract filter string for this view from URL and decode.
                var newFilterStr = '';
                var newPerPageStr = '';
                var newSortStr = '';
                var newSearchStr = '';
                var collapsed = '';
                var parts = ktl.core.splitUrl(window.location.href);
                const params = Object.entries(parts.params);
                if (!$.isEmptyObject(params)) {
                    params.forEach(function (param) {
                        if (param[0].includes(filterUrlPart + '_filters'))
                            newFilterStr = param[1];
                        if (param[0].includes(filterUrlPart + '_per_page'))
                            newPerPageStr = param[1];
                        if (param[0].includes(filterUrlPart + '_sort'))
                            newSortStr = param[1];
                        if (param[0].includes(filterUrlPart + '_search'))
                            newSearchStr = param[1];
                        if (param[0].includes(filterUrlPart + '_collapsed'))
                            collapsed = param[1].split(',').filter(value => value != '');
                    });
                }

                if (!newFilterStr) return;

                var filter = {};
                var filterSrc = {};
                var filterName = '';
                var type = '';

                if (updateActive) {
                    filter = getActiveFilter(filterDivId);
                    if (!filter.filterSrc[filterDivId]) return;

                    const filterObject = filter.filterSrc[filterDivId].filters[filter.index];
                    filterSrc = filter.filterSrc;
                    type = filter.type;

                    //If it's a public filter, exit if the unlocked icon is not present.  This covers all cases, i.e. when you don't have the right to modify it, or if you do but PFs are locked.
                    if (type === LS_UFP && !document.querySelector('#' + filterDivId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-unlock-alt'))
                        return;

                    if (filter.index >= 0)
                        filterName = filterObject.filterName;
                } else {
                    const activeFilterName = getActiveFilterName(filterDivId);

                    filterName = prompt('Filter Name: ', activeFilterName ? activeFilterName : '');
                    if (!filterName) return;

                    filter = getFilter(filterDivId, filterName);
                    filterSrc = filter.filterSrc;
                    type = filter.type;
                    if (filter.index >= 0) {
                        if (type === LS_UFP && !Knack.getUserRoleNames().includes('Public Filters')) {
                            alert('You can\'t overwrite Public Filters.\nChoose another name.');
                            return;
                        } else if (!confirm(filterName + ' already exists.  Do you want to overwrite?'))
                            return;
                    } else {
                        type = LS_UF; //By default, creating a new filter is always a User Filter.
                        filterSrc = getUserFilters();
                    }
                }

                if (!filterName) return;

                const previousFilterProperties = (filter.filterSrc[filterDivId] && filter.filterSrc[filterDivId].filters[filter.index]) ? filter.filterSrc[filterDivId].filters[filter.index] : {};
                var fltObj = { ...previousFilterProperties, 'filterName': filterName, 'filterString': newFilterStr, 'perPage': newPerPageStr, 'sort': newSortStr, 'search': newSearchStr, 'collapsed' : collapsed };

                if (type === LS_UFP)
                    fltObj.public = true;

                if ($.isEmptyObject(filterSrc) || !filterSrc[filterDivId])
                    filterSrc[filterDivId] = { filters: [] };

                if (filter.index >= 0)
                    filterSrc[filterDivId].filters[filter.index] = fltObj;
                else
                    filterSrc[filterDivId].filters.push(fltObj);

                if (type === LS_UF)
                    setUserFilters(filterSrc);
                else
                    setPublicFilters(filterSrc);

                if (getViewToRefresh()) {
                    const view = filterDivId.split('-')[2] || filterDivId.split('-')[0];
                    view && ktl.views.refreshView(view);
                }

                ktl.userFilters.addFilterButtons(filterDivId);
                ktl.userFilters.setActiveFilter(filterName, filterDivId);
            },

            //Uploads the updated user filters.
            uploadUserFilters: function (data = []) {
                var viewId = ktl.iFrameWnd.getCfg().userFiltersViewId;
                const userFilters = getUserFilters();
                if ($.isEmptyObject(userFilters)) return;
                var ufObjStr = JSON.stringify(userFilters);
                if (ufObjStr) {
                    var apiData = {};
                    apiData[ktl.iFrameWnd.getCfg().userFiltersCodeFld] = ufObjStr;
                    apiData[ktl.iFrameWnd.getCfg().userFiltersDateTimeFld] = ktl.core.getCurrentDateTime(true, true, false, true);
                    var recId = null;
                    var command = 'POST';
                    if (data.length) {
                        recId = data[0].id;
                        command = 'PUT';
                    }

                    ktl.log.clog('blue', 'Uploading user filters...');
                    ktl.core.knAPI(viewId, recId, apiData, command, [viewId])
                        .then(function (response) { ktl.log.clog('green', 'User filters uploaded successfully!'); })
                        .catch(function (reason) { alert('An error occurred while uploading User filters in table, reason: ' + JSON.stringify(reason)); })
                }
            },

            //This is where local and user filters are merged together.
            downloadUserFilters: function (newUserFiltersData = {}) {
                if (!newUserFiltersData.newUserFilters || $.isEmptyObject(newUserFiltersData.newUserFilters)) return;
                try {
                    ktl.log.clog('blue', 'Downloading user filters...');
                    const userFilters = newUserFiltersData.newUserFilters;
                    setUserFilters(userFilters, false);

                    //Live update of any relevant views.
                    const views = Object.keys(userFilters);
                    views.forEach(function (viewId) {
                        if (viewId.startsWith('view_') && document.querySelector('#' + viewId)) {
                            ktl.userFilters.addFilterButtons(viewId);
                            var filterBtn = document.querySelector('#' + viewId + '_' + FILTER_BTN_SUFFIX + '_' + ktl.core.getCleanId(getActiveFilterName(viewId)));
                            filterBtn && filterBtn.click();
                        }
                    })

                    ktl.log.clog('green', 'User filters downloaded successfully...');
                }
                catch (e) {
                    console.log('Exception in downloadUserFilters:', e);
                }
            },

            //Uploads the updated public filters to all users.
            uploadPublicFilters: function (data = []) {
                const viewId = ktl.iFrameWnd.getCfg().appSettingsViewId;
                const publicFilters = getPublicFilters();

                if ($.isEmptyObject(publicFilters))
                    return;

                var pfObjStr = JSON.stringify(publicFilters);
                if (pfObjStr) {
                    var apiData = {};
                    apiData[ktl.iFrameWnd.getCfg().appSettingsItemFld] = 'APP_PUBLIC_FILTERS';
                    apiData[ktl.iFrameWnd.getCfg().appSettingsValueFld] = pfObjStr;
                    apiData[ktl.iFrameWnd.getCfg().appSettingsDateTimeFld] = ktl.core.getCurrentDateTime(true, true, false, true);
                    var rec = ktl.views.findRecord(data, ktl.iFrameWnd.getCfg().appSettingsItemFld, 'APP_PUBLIC_FILTERS');
                    var recId = null;
                    var command = 'POST';
                    if (rec) {
                        recId = rec.id;
                        command = 'PUT';
                    }

                    ktl.log.clog('blue', 'Uploading public filters...');
                    ktl.core.knAPI(viewId, recId, apiData, command, [viewId])
                        .then(function (response) { ktl.log.clog('green', 'Public filters uploaded successfully!'); })
                        .catch(function (reason) { alert('An error occurred while uploading Public filters in table, reason: ' + JSON.stringify(reason)); })
                }
            },

            //This is where local and public filters are merged together.
            downloadPublicFilters: function (newPublicFiltersData = {}) {
                if (!newPublicFiltersData.newPublicFilters || $.isEmptyObject(newPublicFiltersData.newPublicFilters)) return;

                try {
                    ktl.log.clog('blue', 'Downloading Public filters...');
                    const publicFilters = newPublicFiltersData.newPublicFilters;
                    setPublicFilters(publicFilters, false);

                    fixConflictWithUserFilters();

                    //Live update of any relevant views.
                    const views = Object.keys(publicFilters);
                    views.forEach(function (viewId) {
                        if (viewId.startsWith('view_') && document.querySelector('#' + viewId)) {
                            ktl.userFilters.addFilterButtons(viewId);
                            var filterBtn = document.querySelector('#' + viewId + '_' + FILTER_BTN_SUFFIX + '_' + ktl.core.getCleanId(getActiveFilterName(viewId)));
                            filterBtn && filterBtn.click();
                        }
                    })

                    ktl.log.clog('green', 'Public filters downloaded successfully...');
                }
                catch (e) {
                    console.log('Exception in downloadPublicFilters:', e);
                }

                function fixConflictWithUserFilters() {
                    const userFilters = getUserFilters();
                    const views = Object.keys(userFilters);
                    var foundConflict = false;
                    views.forEach(function (viewId) {
                        if (viewId.startsWith('view_')) {
                            for (var i = 0; i < userFilters[viewId].filters.length; i++) {
                                var filter = userFilters[viewId].filters[i];
                                var filterName = filter.filterName;
                                var publicFilterName = getFilter(viewId, filterName, LS_UFP);
                                if (publicFilterName.index >= 0) {
                                    if (filterName === publicFilterName.filterSrc[viewId].filters[publicFilterName.index].filterName) {
                                        console.log('Found conflict:', viewId, i, filterName);
                                        foundConflict = true;
                                        filter.filterName += '_';
                                    }
                                }
                            }
                        }
                    })

                    if (foundConflict)
                        setUserFilters(userFilters);
                }
            }
        }
    })(); //User Filters feature

    //====================================================
    //Debug Window feature
    //A lightweight logging tool, mostly useful on mobile devices, where you have no console output.
    this.debugWnd = (function () {
        const LOCAL_STORAGE_MAX_ENTRIES = 100;
        var debugWnd = null;
        var dbgWndScrollHeight = 1420;
        var dbgWndRefreshInterval = null;
        var logsCleanupInterval = null; //JIC

        //Ensure that lsLog is not busting max length.
        if (ktl.storage.hasLocalStorage()) {
            clearInterval(logsCleanupInterval);
            logsCleanupInterval = setInterval(() => {
                getLocalStorageLogs();
            }, ONE_HOUR_DELAY)
        }

        // Returns an array with only our elements:
        //  - filtered on APP_ROOT_NAME but excluding it
        //  - sorted ascending, oldest first
        function getLocalStorageLogs() {
            if (!ktl.storage.hasLocalStorage()) return;

            var ls = [];
            var len = localStorage.length;

            for (var i = 0; i < len; i++) {
                var key = localStorage.key(i);

                //Exclude all logs other that those starting with a date.
                if (key.startsWith(APP_ROOT_NAME) && (key[APP_ROOT_NAME.length] >= '0' && key[APP_ROOT_NAME.length] <= '9')) {
                    var value = localStorage[key];
                    var dateTime = key.substr(APP_ROOT_NAME.length);
                    ls.push({ dateTime: dateTime, logDetails: value });
                }
            }

            //Custom sort function by ascending DT (oldest at top).
            ls.sort(function (a, b) {
                var dateA = new Date(a.dateTime), dateB = new Date(b.dateTime);
                return dateA - dateB;
            });

            if (ls.length > LOCAL_STORAGE_MAX_ENTRIES) {
                if (ls.length > LOCAL_STORAGE_MAX_ENTRIES + 5 /*leave a bit of headroom to prevent repetitive cleanup of logs*/)
                    ktl.log.addLog(ktl.const.LS_WRN, 'KEC_1012 - lsLog has exceeded max with ' + ls.length);

                ls = ktl.debugWnd.cleanupLogs(ls);
            }

            return ls;
        }

        //Creates the debugWnd object that displays local logs, with its control buttons.
        function create() {
            return new Promise(function (resolve) {
                if (!ktl.core.getCfg().enabled.debugWnd) return;

                if (debugWnd)
                    resolve(debugWnd);
                else {
                    if (debugWnd === null && !window.self.frameElement) {
                        ktl.systemColors.getSystemColors()
                            .then((sc) => {
                                var sysColors = sc;

                                if (!$('#dbgWndId').length) {
                                    const DEFAULT_TOP = 80;
                                    const DEFAULT_LEFT = 80;
                                    const DEFAULT_HEIGHT = window.innerHeight / 2;
                                    const DEFAULT_WIDTH = window.innerWidth / 2;

                                    debugWnd = document.createElement('div');
                                    debugWnd.setAttribute('id', 'dbgWndId');
                                    debugWnd.style.top = DEFAULT_TOP + 'px';
                                    debugWnd.style.left = DEFAULT_LEFT + 'px';
                                    debugWnd.style['z-index'] = 15;
                                    debugWnd.classList.add('devBtnsDiv', 'devToolSearchDiv');

                                    var debugWndHeader = document.createElement('div');
                                    debugWndHeader.setAttribute('id', 'dbgWndIdheader');
                                    debugWndHeader.classList.add('ktlDevToolsHeader');
                                    debugWndHeader.innerText = ':: KTL Debug Wnd ::';
                                    debugWndHeader.style['background-color'] = sysColors.paleLowSatClr;
                                    debugWnd.appendChild(debugWndHeader);

                                    var debugWndText = document.createElement('div');
                                    debugWndText.setAttribute('id', 'debugWndText');
                                    debugWndText.classList.add('ktlConsoleDiv');
                                    debugWnd.appendChild(debugWndText);

                                    //Clear button
                                    var debugWndClear = document.createElement('div');
                                    debugWndClear.setAttribute('id', 'debugWndClear');
                                    debugWndClear.style.height = '30px';
                                    debugWndClear.style.width = '80px';
                                    debugWndClear.style.position = 'absolute';
                                    debugWndClear.style.right = '5px';
                                    debugWndClear.style['color'] = sysColors.buttonText.rgb;
                                    debugWndClear.style['background-color'] = sysColors.button.rgb;
                                    debugWndClear.style['padding-left'] = '12px';
                                    debugWndClear.style['padding-right'] = '12px';
                                    debugWndClear.style['margin-right'] = '7px';
                                    debugWndClear.style['box-sizing'] = 'border-box';
                                    debugWndClear.innerText = 'Clear';
                                    debugWndClear.classList.add('pointer', 'kn-button');
                                    debugWndHeader.appendChild(debugWndClear);
                                    debugWndClear.addEventListener('click', function (e) { clearLsLogs(); })
                                    debugWndClear.addEventListener('touchstart', function (e) { clearLsLogs(); })

                                    document.body.appendChild(debugWnd);

                                    debugWndText.style.height = DEFAULT_HEIGHT + 'px';
                                    debugWndText.style.width = DEFAULT_WIDTH + 'px';

                                    ktl.debugWnd.showLogsInDebugWnd();

                                    const devToolStorageName = 'ktlDbgWnd';
                                    ktl.core.enableSortableDrag(debugWnd, debounce((position) => {
                                        ktl.storage.appendItemJSON(devToolStorageName, { ...position });
                                    }));

                                    const resizeObserver = new ResizeObserver(debounce((entries) => {
                                        const entry = entries[0];
                                        if (entry && entry.target.offsetWidth && entry.target.offsetWidth) {
                                            ktl.storage.appendItemJSON(devToolStorageName, {
                                                width: entry.target.offsetWidth,
                                                height: entry.target.offsetHeight
                                            });
                                        }
                                    }));
                                    resizeObserver.observe(debugWndText);

                                    const savedPosition = ktl.storage.getItemJSON(devToolStorageName);
                                    if (savedPosition) {
                                        debugWnd.style.left = (savedPosition.left || DEFAULT_LEFT) + 'px';
                                        debugWnd.style.top = (savedPosition.top || DEFAULT_TOP) + 'px';

                                        if (savedPosition.height && savedPosition.width) {
                                            debugWndText.style.height = savedPosition.height + 'px';
                                            debugWndText.style.width = savedPosition.width + 'px';
                                        }
                                    } else
                                        ktl.core.centerElementOnScreen(debugWnd);
                                } else {
                                    ktl.debugWnd.showLogsInDebugWnd();
                                }

                                function clearLsLogs() {
                                    if (confirm('Are you sure you want to delete Local Storage?')) {
                                        if (confirm('OK: Delete only Logs\nCANCEL: delete ALL data'))
                                            ktl.debugWnd.cleanupLogs(getLocalStorageLogs(), true);
                                        else
                                            ktl.debugWnd.cleanupLogs(null, true);

                                        ktl.debugWnd.showLogsInDebugWnd();
                                    }
                                }

                                resolve(debugWnd);
                                return;
                            })
                            .catch(function (reason) {
                                console.log('debugWnd - error loading colors:', reason);
                            })
                    }
                }
            })
        }

        return {
            // Local Storage Log
            // Very useful on mobile devices, where you can't see logs on a console output.
            // Has millisecond resolution.
            // Data can be any text, including multiline with \n.
            // Each log creates one separate localStorage entry, using a ring buffer structure.
            lsLog: function (logStr, sendToConsole = true) {
                if (ktl.storage.hasLocalStorage()) {
                    var dt = ktl.core.getCurrentDateTime();

                    localStorage.setItem(APP_ROOT_NAME + dt, logStr);
                    if (sendToConsole)
                        console.log(logStr);
                } else
                    ktl.log.clog('purple', 'Error - lsLog called without storage.');
            },

            showDebugWnd: function (show = false) {
                if (show) {
                    create().then((debugWnd) => {
                        debugWnd.style.display = 'block';
                        ktl.debugWnd.showLogsInDebugWnd();

                        clearInterval(dbgWndRefreshInterval);
                        dbgWndRefreshInterval = setInterval(function () {
                            ktl.debugWnd.showLogsInDebugWnd();
                        }, 5000);
                    })
                } else {
                    clearInterval(dbgWndRefreshInterval);
                    dbgWndRefreshInterval = null;
                    if (debugWnd) {
                        debugWnd.parentNode.removeChild(debugWnd);
                        debugWnd = null;
                    }
                }
            },

            //For KTL internal use. Does three things:
            //  1) Ensures max length of rotating logs buffer is not exceeded.  If length is exceeded,
            //     start from oldest logs and delete going up until only max entries remains.
            //  2) Erases all data or only the logs with a timestamp, keeping the special accumulators.
            //  3) Wipes all logs and accumulators for this app.
            cleanupLogs: function (ls = null, deleteAllLogs = false) {
                if (ls && ls.length === 0)
                    return;

                if (ls === null && deleteAllLogs) {
                    ktl.log.resetActivityCtr();

                    //Wipe all logs for this app.
                    var len = localStorage.length;
                    for (var i = len - 1; i >= 0; i--) {
                        var key = localStorage.key(i);
                        if (key && key.startsWith(APP_ROOT_NAME))
                            localStorage.removeItem(key);
                    }
                } else {
                    if (deleteAllLogs || ls.length > LOCAL_STORAGE_MAX_ENTRIES) {
                        var stopIndex = ls.length - LOCAL_STORAGE_MAX_ENTRIES;
                        if (deleteAllLogs)
                            stopIndex = ls.length;

                        for (var i = stopIndex - 1; i >= 0; i--) {
                            var lsStr = APP_ROOT_NAME + ls[i].dateTime;
                            localStorage.removeItem(lsStr);
                        }
                    }
                }

                ktl.debugWnd.showLogsInDebugWnd();
                return ls;
            },

            //For KTL internal use.  Display all logs in the debugWnd.
            //TODO: enable scroll and freeze to a position.
            //** Consider a makeover where we'd use a string array instead (one string per line), for more control.
            showLogsInDebugWnd: function () {
                if (debugWnd && debugWnd.style.display === 'block') {
                    var dbgStr = getLocalStorageLogs();
                    var debugWndText = document.getElementById('debugWndText');
                    debugWndText.innerHTML = '';
                    dbgStr.forEach(function (el) {
                        debugWndText.textContent += el.dateTime + '    ' + el.logDetails + '\n';
                    })

                    var lsItems = 0;
                    var len = localStorage.length;
                    for (var i = len - 1; i >= 0; i--) {
                        var key = localStorage.key(i);
                        if (key && key.startsWith(APP_ROOT_NAME))
                            lsItems++;
                    }
                    //console.log('showLogsInDebugWnd, lsItems =', lsItems);

                    //Append activity at end of all logs.
                    var cri = ktl.storage.lsGetItem(ktl.const.LS_CRITICAL);
                    var lgin = ktl.storage.lsGetItem(ktl.const.LS_LOGIN);
                    var act = ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY);
                    var nav = ktl.storage.lsGetItem(ktl.const.LS_NAVIGATION);
                    var appErr = ktl.storage.lsGetItem(ktl.const.LS_APP_ERROR);
                    var svrErr = ktl.storage.lsGetItem(ktl.const.LS_SERVER_ERROR);
                    var wrn = ktl.storage.lsGetItem(ktl.const.LS_WRN);
                    var inf = ktl.storage.lsGetItem(ktl.const.LS_INFO);
                    var dbg = ktl.storage.lsGetItem(ktl.const.LS_DEBUG);

                    debugWndText.textContent +=
                        (cri ? ('CRITICAL: ' + ktl.storage.lsGetItem(ktl.const.LS_CRITICAL) + '\n') : '') +
                        (lgin ? ('LOGIN: ' + ktl.storage.lsGetItem(ktl.const.LS_LOGIN) + '\n') : '') +
                        (act ? ('ACT: ' + ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY) + '\n') : '') +
                        (nav ? ('NAV: ' + ktl.storage.lsGetItem(ktl.const.LS_NAVIGATION) + '\n') : '') +
                        (appErr ? ('APP ERR: ' + ktl.storage.lsGetItem(ktl.const.LS_APP_ERROR) + '\n') : '') +
                        (svrErr ? ('SVR ERR: ' + ktl.storage.lsGetItem(ktl.const.LS_SERVER_ERROR) + '\n') : '') +
                        (wrn ? ('WRN: ' + ktl.storage.lsGetItem(ktl.const.LS_WRN) + '\n') : '') +
                        (inf ? ('INF: ' + ktl.storage.lsGetItem(ktl.const.LS_INFO) + '\n') : '') +
                        (dbg ? ('DBG: ' + ktl.storage.lsGetItem(ktl.const.LS_DEBUG) + '\n') : '') +
                        'Total localStorage usage = ' + lsItems + '\n';

                    debugWndText.scrollTop = dbgWndScrollHeight - 14;
                    debugWndText.focus();
                }
            },
        }
    })(); //Debug Window feature

    //====================================================
    //Views feature
    this.views = (function () {
        const PAUSE_REFRESH = 'pause_auto_refresh';
        var autoRefreshViews = {};
        var unPauseTimer = null;
        var processViewKeywords = null;
        var handleCalendarEventDrop = null;
        var handlePreprocessSubmitError = null;
        var dropdownSearching = {}; //Used to prevent concurrent searches on same field.
        var currentFocus = null;
        var gotoDateObj = new Date();
        var prevType = '';
        var prevStartDate = '';
        var quickToggleParams = {
            bgColorTrue: '#39d91f',
            bgColorFalse: '#f04a3b',
            bgColorPending: '#dd08',
        };

        //TODO: Migrate all variables here.
        var cfg = {
            hscCollapsedColumnsWidth: '5',
            hscGlobal: false,
            hscAllowed: null,
        }

        $(document).on('knack-scene-render.any', function (event, scene) {
            //In developer mode, add a checkbox to pause all views' auto-refresh.
            if (ktl.core.getCfg().enabled.devPauseAutoRefresh && ktl.account.isDeveloper() && !ktl.scenes.isiFrameWnd()) {
                var div = $('.kn-info-bar > div');
                if (div.length > 0) {
                    var cbStyle = 'position: absolute; left: 40vw; top: 0.7vh; width: 20px; height: 20px';
                    var lbStyle = 'position: absolute; left: 42vw; top: 0.7vh';
                    var autoRefreshCb = ktl.fields.addCheckbox(div[0], 'Pause Auto-Refresh', false, '', cbStyle, lbStyle);
                    autoRefreshCb.addEventListener('change', function () {
                        ktl.views.autoRefresh(!this.checked);
                    });
                }
            }

            //Reset summary callbacks upon scene change.
            ktl.scenes.sceneChangeNotificationSubscribe(function resetSummaryObserverCallbacks() {
                summaryObserverCallbacks = {};
            });
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            const viewId = view.key;

            if (ktl.views.viewHasSummary(viewId)) {
                /* This code is needed for keywords that may require summary data to achieve their task.

                Since the summaries are rendered "a bit later" than the rest of the grid data,
                we must find a way to capture the summary data BEFORE applying the keywords.

                The function ktlRenderTotals below replaces Knack's original renderTotals.
                Doing this allows us to gain control over WHEN the summary has completed rendering.
                At that prceise moment, it's time to capture the summary data in an object for eventual processing.

                *** A big thank you to Charles Brunelle who taught me this amazing technique - Normand D. */

                var ktlRenderTotals = function () {
                    if (Knack.views[viewId].ktlRenderTotals) {
                        Knack.views[viewId].ktlRenderTotals.original.call(this, ...arguments);

                        readSummaryValues(viewId);
                        ktlProcessKeywords(view, data);
                    }
                };

                if (!Knack.views[viewId].ktlRenderTotals || Knack.views[viewId].renderTotals !== Knack.views[viewId].ktlRenderTotals.ktlPost) {
                    Knack.views[viewId].ktlRenderTotals = {
                        original: Knack.views[viewId].renderTotals,
                        ktlPost: ktlRenderTotals
                    }

                    Knack.views[viewId].renderTotals = Knack.views[viewId].ktlRenderTotals.ktlPost;
                } else { //When data has changed, but the functions remain the same.
                    Knack.views[viewId].ktlRenderTotals.ktlPost = ktlRenderTotals;
                    Knack.views[viewId].renderTotals = Knack.views[viewId].ktlRenderTotals.ktlPost;
                }
            } else
                ktlProcessKeywords(view, data);

            ktl.views.addViewId(view);

            if (cfg.hscGlobal)
                ktl.views.addHideShowIconsToTableHeaders(viewId);

            //Fix problem with re-appearing filter button when filtring is disabled in views.
            //Reported here: https://forums.knack.com/t/add-filter-buttons-keep-coming-back/13966
            if (Knack.views[view.key] && Knack.views[view.key].model && Knack.views[view.key].model.view.filter === false)
                $('#' + view.key + ' .kn-filters-nav').remove();

            if (view.type === 'calendar') {
                try {
                    const fc = Knack.views[view.key].$('.knack-calendar').data('fullCalendar');

                    const originalEventDropHandler = fc.options.eventDrop;
                    fc.options.eventDrop = function (event, dayDelta, minuteDelta, allDay, revertFunc) {
                        ktlHandleCalendarEventDrop(view, event, dayDelta, minuteDelta, allDay, revertFunc);
                        return originalEventDropHandler.call(this, ...arguments);
                    };

                    const originalEventResizeHandler = fc.options.eventResize;
                    fc.options.eventResize = function (event, dayDelta, minuteDelta, revertFunc) {
                        ktlHandleCalendarEventResize(view, event, dayDelta, minuteDelta, revertFunc);
                        return originalEventResizeHandler.call(this, ...arguments);
                    };

                    //Callback when the calendar view changes type or range.
                    const viewDisplay = fc.options.viewDisplay;
                    fc.options.viewDisplay = function (calView) {
                        addGotoDate(view.key, calView);
                        return viewDisplay.call(this, ...arguments);
                    };

                    addGotoDate(view.key);
                } catch (e) { console.log(e); }
            }

            addLongClickListener('#' + viewId, function (e) {
                document.querySelector('#' + viewId).classList.add('ktlOutline');
                Knack.showSpinner();
                setTimeout(() => {
                    ktl.views.refreshView(viewId)
                        .then(() => {
                            Knack.hideSpinner();
                            document.querySelector('#' + viewId).classList.remove('ktlOutline');
                        })
                        .catch(() => { })
                }, 500);
            }, 500, true);

            $('.kn-table-table th').on('click', ktl.views.handleClickDateTimeSort);
        })

        //Process views with special keywords in their titles, fields, descriptions, etc.
        function ktlProcessKeywords(view, data) {
            if (!view || ktl.scenes.isiFrameWnd()) return;
            try {
                ktl.bulkOps.prepareBulkOps(view, data); //Must be applied before keywords to get the right column indexes.

                const viewId = view.key;
                var keywords = ktlKeywords[viewId];
                if (keywords && !$.isEmptyObject(keywords)) {
                    //This section is for keywords that are only supported by views.
                    //console.log('keywords =', JSON.stringify(keywords, null, 4));

                    //These also need to be processed in the mutation observer.
                    keywords._hc && ktl.views.hideColumns(view, keywords);
                    keywords._rc && ktl.views.removeColumns(view, keywords);
                    keywords._cls && ktl.views.addRemoveClass(viewId, keywords, data);
                    keywords._style && ktl.views.setStyle(viewId, keywords);

                    //These don't need to be processed in the mutation observer.
                    keywords._ni && ktl.views.noInlineEditing(view);
                    keywords._hv && ktl.views.hideView(viewId, keywords);
                    keywords._rv && ktl.views.removeView(viewId, keywords);
                    keywords._ht && hideTitle(viewId, keywords);
                    keywords._dr && ktl.views.numDisplayedRecords(viewId, keywords);
                    keywords._zoom && ktl.views.applyZoomLevel(viewId, keywords);
                    keywords._ts && ktl.views.addTimeStampToHeader(viewId, keywords);
                    keywords._dtp && ktl.views.addDateTimePickers(viewId, keywords);
                    keywords._al && ktl.account.autoLogin(viewId);
                    keywords._rvs && refreshViewsAfterSubmit(viewId, keywords);
                    keywords._rvr && refreshViewsAfterRefresh(viewId, keywords);
                    keywords._nf && disableFilterOnFields(view, keywords);
                    keywords._nsg && noSortingOnGrid(viewId, keywords);
                    keywords._bcg && ktl.fields.generateBarcode(viewId, keywords);
                    keywords._trk && ktl.views.truncateText(view, keywords);
                    (keywords._oln || keywords._ols) && ktl.views.openLink(viewId, keywords);
                    keywords._copy && ktl.views.copyToClipboard(viewId, keywords);
                    keywords._ha && headerAlignment(view, keywords);
                    keywords._hsc && ktl.views.hideShowColumns(viewId, keywords);
                    keywords._dl && ktl.views.disableLinks(viewId, keywords);
                    keywords._sth && stickyTableHeader(viewId, keywords, data);
                    keywords._stc && stickyTableColumns(viewId, keywords);
                    keywords._recid && setRecordId(viewId, keywords, data);
                    keywords._parent && goUpParentLevels(viewId, keywords);
                    keywords._vrd && viewRecordDetails(viewId, keywords);
                    keywords._click && performClick(viewId, keywords, data);
                    keywords._mail && sendBulkEmails(viewId, keywords, data);
                    keywords._dnd && dragAndDrop(viewId, keywords);
                    keywords._cpyfrom && copyRecordsFromView(viewId, keywords, data);
                    keywords._scs && colorizeSortedColumn(viewId, keywords);
                    keywords._cmr && closeModalAndRefreshViews(viewId, keywords);
                }

                //This section is for keywords that are supported by views and fields.
                ktl.fields.hideFields(viewId, keywords);
                quickToggle(viewId, data); //IMPORTANT: quickToggle must be processed BEFORE matchColor.
                matchColor(viewId, data);
                colorizeFieldByValue(viewId, data);
                ktl.views.obfuscateData(view, keywords);
                addTooltips(view, keywords);

                processViewKeywords && processViewKeywords(view, keywords, data);
            }
            catch (err) { console.log('err', err); };
        }

        function ktlHandleCalendarEventDrop(view, event, dayDelta, minuteDelta, allDay, revertFunc) {
            processRvd(view, event, revertFunc);

            handleCalendarEventDrop && handleCalendarEventDrop(view, event, dayDelta, minuteDelta, allDay, revertFunc);
        }

        function ktlHandleCalendarEventResize(view, event, dayDelta, minuteDelta, revertFunc) {
            processRvd(view, event, revertFunc);

            //TODO: handleCalendarEventResize && handleCalendarEventResize(view, event, dayDelta, minuteDelta, revertFunc);
        }

        function processRvd(view, event, revertFunc) {
            var keywords = ktlKeywords[view.key];
            const kw = '_rvd';

            if (!(keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length)) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            var viewIds = ktl.views.convertViewTitlesToViewIds(keywords[kw][0].params[0], view.key);
            var eventFieldId = view.events.event_field.key;
            var recId = event.id;
            var dndConfViewId = viewIds[0]; //First view must always be the DnD Confirmation view.

            //The retries are necessary due to the latency chain: calendar > server > view being updated.
            (function tryRefresh(DndConfViewId, retryCtr) {
                setTimeout(() => {
                    ktl.views.refreshView(DndConfViewId).then(function (data) {
                        ktl.core.knAPI(DndConfViewId, recId, {}, 'GET')
                            .then((record) => {
                                try {
                                    if (!record[eventFieldId] || (record.records && record.records.length === 0)) {
                                        ktl.log.clog('purple', 'Empty record found in processRvd.');
                                        return;
                                    }

                                    var dtFrom = record[eventFieldId + '_raw'].timestamp;
                                    var dtTo = dtFrom;
                                    var eventEnd = dtTo;
                                    var eventStart = event.start;

                                    if (event.allDay) {
                                        eventStart = new Date(new Date(eventStart).toDateString());
                                    } else {
                                        var format = Knack.objects.getField(eventFieldId).attributes.format.time_format;
                                        if (format === 'Ignore Time') {
                                            alert('This event type only supports "All Day"');
                                            revertFunc();
                                            return;
                                        }
                                    }

                                    if (Date.parse(dtFrom) === Date.parse(eventStart)) {
                                        if (!event.allDay) {
                                            dtTo = record[eventFieldId + '_raw'].to ? record[eventFieldId + '_raw'].to.timestamp : dtFrom;
                                            eventEnd = event.end ? event.end : dtTo;
                                        }

                                        if (Date.parse(dtTo) === Date.parse(eventEnd)) {
                                            ktl.log.clog('green', 'Date match found!');

                                            //Must refresh all views, including the DnD Confirmation, otherwise the view is not always updated.
                                            ktl.views.refreshViewArray(viewIds);
                                        }
                                    } else {
                                        if (retryCtr-- > 0) {
                                            //ktl.log.clog('purple', 'date mismatch', retryCtr);
                                            tryRefresh(DndConfViewId, retryCtr);
                                        } else
                                            ktl.log.clog('red', 'Error refreshing view after drag n drop operation.');
                                    }
                                }
                                catch (e) {
                                    console.log('processRvd exception:\n', e);
                                }
                            })
                            .catch(function (reason) {
                                alert('Error reason: ' + JSON.stringify(reason));
                            })
                    });
                }, 500);
            })(dndConfViewId, 10); //10 retries, is more than enough.
        }

        function addGotoDate(viewId, calView) {
            if (!viewId || !ktl.core.getCfg().enabled.calendarGotoDate) return;

            var inputType = 'date';
            var period = 'weekly-daily';

            if (calView) {
                if (calView.name === 'month') {
                    period = 'monthly';
                    inputType = 'month';
                }
            } else {
                if (Knack.views[viewId].current_view === 'month') {
                    period = 'monthly';
                    inputType = 'month';
                }
            }

            if (prevType !== inputType) {
                prevType = inputType;
                $('#' + viewId + '_gotoDate').remove();
                $('#' + viewId + '_gotoDate-label').remove();
            }

            var focusGoto = (document.activeElement === document.querySelector('#' + viewId + '_gotoDate'));
            if (calView) {
                if (prevStartDate !== calView.visStart && !focusGoto) {
                    prevStartDate = calView.visStart;
                    gotoDateObj = new Date(calView.start);
                }
            }

            var gotoDateIso = ktl.core.convertDateToIso(gotoDateObj, period);

            var gotoDateField = document.querySelector('#' + viewId + ' #' + viewId + '_gotoDate');
            if (!gotoDateField) {
                var div = document.createElement('div');
                ktl.core.insertAfter(div, document.querySelector('#' + viewId + ' .fc-header-left'));

                var gotoDateField = ktl.fields.addInput(div, 'Go to date', inputType, gotoDateIso, viewId + '_gotoDate', 'width: 150px; height: 25px;');
                ktl.scenes.autoFocus();

                gotoDateField.addEventListener('change', (e) => {
                    var dt = e.target.value;
                    dt = dt.replaceAll('-0', '-').replaceAll('-', '/'); //If we don't do this, we get crazy behavior.
                    Knack.views[viewId].$('.knack-calendar').fullCalendar('gotoDate', new Date(dt));
                    gotoDateField.focus();
                })
            }

            if (!focusGoto)
                gotoDateField.value = gotoDateIso;
        }


        $(document).on('click', function (e) {
            //Pause auto-refresh when on a tables's search field.
            if (e.target.closest('.table-keyword-search') && e.target.name === 'keyword' /*Needed to discriminate checkboxes.  We only want Search fields*/)
                ktl.views.autoRefresh(false);

            var viewId = e.target.closest('.kn-view');
            viewId = viewId ? viewId.id : null;

            if (viewId && e.target.closest('#' + viewId + ' .kn-button.is-primary') && !ktl.scenes.isiFrameWnd())
                ktl.views.preprocessSubmit(viewId, e);
        })

        document.addEventListener('focusout', function (e) {
            try {
                if (e.target.form.classList[0].includes('table-keyword-search') && $.isEmptyObject(autoRefreshViews))
                    ktl.views.autoRefresh();
            } catch { /*ignore*/ }
        }, true);

        $(document).keydown(function (e) {
            if (e.keyCode === 27) { //Esc
                $('.close-popover').trigger('click'); //Exit inline editing
                $('#asset-viewer > div > a').trigger('click'); //asset-viewer is the image viewer.
            } else if (e.keyCode === 37) //Left arrow
                $('#asset-viewer > div > div > a.kn-asset-prev').trigger('click');
            else if (e.keyCode === 39) //Right arrow
                $('#asset-viewer > div > div > a.kn-asset-next').trigger('click');
        })

        //Filter Restriction Rules from view's Description.
        function disableFilterOnFields(view, keywords) {
            if (!view) return;

            const kw = '_nf';
            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (view.type === 'table' /*TODO: add more view types*/) {
                var fieldsAr = keywords[kw][0].params[0];
                $('.kn-add-filter,.kn-filters').on('click', function (e) {
                    var filterFields = document.querySelectorAll('.field.kn-select select option');
                    filterFields.forEach(field => {
                        if (fieldsAr.includes(field.value) || fieldsAr.includes(field.textContent))
                            field.remove();
                    })
                })
            }
        }

        function refreshViewsAfterSubmit(viewId = '', keywords) {
            const kw = '_rvs';
            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (viewType !== 'form') return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                var viewIds = ktl.views.convertViewTitlesToViewIds(keywords._rvs[0].params[0], viewId);
                if (viewIds.length) {
                    $(document).bindFirst('knack-form-submit.' + viewId, () => {
                        ktl.views.refreshViewArray(viewIds)
                    })
                }
            }
        }

        function refreshViewsAfterRefresh(viewId = '', keywords) {
            if (!viewId) return;

            const kw = '_rvr';
            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                var viewIds = ktl.views.convertViewTitlesToViewIds(keywords[kw][0].params[0], viewId);
                if (viewIds.length)
                    ktl.views.refreshViewArray(viewIds)
            }
        }

        var summaryObserverCallbacks = {};
        function readSummaryValues(viewId) {
            if (!viewId) return;

            //Happens when submitting an inline edit box. Ignore because alignment is wrong due to checkboxes.
            //Will be ok on next refresh right after.
            if (document.querySelector('#' + viewId + ' .masterSelector'))
                return;

            const totals = document.querySelectorAll('#' + viewId + ' .kn-table-totals');
            const headers = document.querySelectorAll('#' + viewId + ' thead th');
            var summaryObj = {};
            for (var t = 0; t < totals.length; t++) {
                const row = totals[t];
                const td = row.querySelectorAll('td');
                var summaryType = '';
                for (var col = 0; col < td.length; col++) {
                    if (headers[col]) {
                        const txt = td[col].textContent.trim();
                        const fieldId = headers[col].className;
                        const val = ktl.core.extractNumericValue(txt, fieldId);
                        if (txt !== '' && val === undefined) {
                            //Found a summary type, ex: "Avg".
                            summaryType = txt;
                            summaryObj[summaryType] = {};
                        } else if (summaryType && val) {
                            var colHeader = document.querySelectorAll('#' + viewId + ' th')[col].textContent.trim();
                            if (colHeader)
                                summaryObj[summaryType][colHeader] = val;
                        }
                    }
                }
            }

            if (ktlKeywords[viewId])
                ktlKeywords[viewId].summary = summaryObj;
            else
                ktlKeywords[viewId] = { summary: summaryObj };

            //TODO: Notify only if a value has changed.
            for (var observerViewId in summaryObserverCallbacks) {
                var observer = summaryObserverCallbacks[observerViewId];
                observer.callback.apply(null, observer.params);
            }

            $(document).trigger('KTL.' + viewId + '.totalsRendered');
        }

        function readSummaryValue(viewTitleOrId, columnHeader, summaryName) {
            if (!viewTitleOrId || !columnHeader || !summaryName) return;

            var viewId = viewTitleOrId.startsWith('view_') ? viewTitleOrId : ktl.core.getViewIdByTitle(viewTitleOrId);
            var summaryObj = ktlKeywords[viewId] && ktlKeywords[viewId].summary;
            if (!$.isEmptyObject(summaryObj) && summaryObj[summaryName])
                return summaryObj[summaryName][columnHeader];
        }

        function addTooltips(view) {
            if (!view) return;

            const kw = '_ttip'; // @params = [tooltip text], [options] - Must be in two groups so that commas can be used in the tooltip text, options are tdfl (table, details, forms and lists)
            const viewId = view.key;
            const viewType = ktl.views.getViewType(viewId);
            if (!viewId) return;

            var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
            if (!$.isEmptyObject(fieldsWithKwObj)) {
                var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                var foundKwObj = {};
                for (var i = 0; i < fieldsWithKwAr.length; i++) {
                    fieldId = fieldsWithKwAr[i];
                    ktl.fields.getFieldKeywords(fieldId, foundKwObj);
                    if (!$.isEmptyObject(foundKwObj) && foundKwObj[fieldId]) {
                        ktl.core.getKeywordsByType(fieldId, kw).forEach(execKw);
                    }

                    // Get all instances of the tooltip keyword for the current field
                    function execKw(keyword) { // Loop through each instance of the tooltip keyword
                        //console.log('_ttip keyword', keyword);
                        if (!ktl.core.hasRoleAccess(keyword.options)) return; // Check if the current user has access to the tooltip keyword

                        const paramGroups = keyword.params; // Get the parameter groups for the current tooltip keyword
                        if (paramGroups.length < 2 && paramGroups.length % 2 != 0) return; // Check if the number of parameter groups is even

                        paramGroups.forEach((param, i) => { // Loop through each parameter group for the current tooltip keyword
                            if (i % 2 === 0) { // Check if the index of the current parameter group is even
                                const params = paramGroups.slice(i, i + 2); // Get the current and next parameter groups as an array
                                const ttipText = params[0].map(item => item.trim()).join(', '); // Get the tooltip text from the current parameter group and trim each item
                                const options = params[1][0]; // Get the options from the next parameter group

                                // if options includes 't' then table
                                if (options.includes('t') && viewType === 'table') {
                                    ktl.views.addTooltipsToFields(viewId, fieldId, ttipText, viewType); // Add the tooltip to the current field in the current view as a table tooltip
                                }

                                // if options includes 'f' then form
                                if (options.includes('f') && viewType === 'form') {
                                    ktl.views.addTooltipsToFields(viewId, fieldId, ttipText, viewType); // Add the tooltip to the current field in the current view as a form tooltip
                                }

                                // if options includes 'd' then details
                                if ( (options.includes('d') && viewType === 'details') || (options.includes('l') && viewType === 'list' ) ){
                                    ktl.views.addTooltipsToFields(viewId, fieldId, ttipText, "details"); // Add the tooltip to the current field in the current view as a details tooltip
                                }
                            }
                        });
                    }
                }
            }
        }

        /** _sth = Sticky Table Header
        * keyword @params numOfRecords, viewHeight - minimum records in table and height of view
        * @param {string} viewId
        * @param {object} keywords
        * @param {object} data */
        function stickyTableHeader(viewId, keywords, data) {
            const kw = '_sth';
            let numOfRecords = 10;
            let viewHeight = 800;

            if (!keywords[kw]) return;

            if (keywords[kw].length) {
                numOfRecords = keywords[kw][0].params[0][0] || numOfRecords;
                viewHeight = keywords[kw][0].params[0][1] || viewHeight;
            }

            if (data.length < numOfRecords) return;

            const bulkOp = getFirstEnabledBulkOp(keywords);
            if (bulkOp) {
                ktl.core.waitSelector(`#bulkOpsControlsDiv-${viewId}`, 500)
                    .then(() => {
                        ktl.views.stickTableHeader(viewId, viewHeight);
                    })
                    .catch(() => {
                        //give enough time for the bulkOps div to show if not apply sticky header
                        ktl.views.stickTableHeader(viewId, viewHeight);
                    });
            } else {
                ktl.views.stickTableHeader(viewId, viewHeight);
            }
        }

        /** _stc = Sticky Table Columns
        * keyword @param stickyColBkgdColor - The background color of the sticky column
        * @param {string} viewId
        * @param {object} keywords */
        function stickyTableColumns(viewId, keywords) {
            const kw = '_stc';
            let numOfColumns = 1;
            let stickyColBkgdColor = 'rgb(243 246 249)';

            if (!keywords[kw]) return;

            if (keywords[kw].length) {
                numOfColumns = keywords[kw][0].params[0][0] || numOfColumns;
                stickyColBkgdColor = keywords[kw][0].params[0][1] || stickyColBkgdColor;
            }

            const bulkOp = getFirstEnabledBulkOp(keywords);

            if (bulkOp) {
                ktl.core.waitSelector(`#bulkOpsControlsDiv-${viewId}`, 500)
                    .then(() => {
                        numOfColumns = numOfColumns < 2 ? 2 : numOfColumns;
                        ktl.views.stickTableColumns(viewId, numOfColumns, stickyColBkgdColor);
                    })
                    .catch(() => {
                        //give enough time for the bulkOps div to show if not apply sticky columns with original params
                        ktl.views.stickTableColumns(viewId, numOfColumns, stickyColBkgdColor);
                    });
            } else {
                ktl.views.stickTableColumns(viewId, numOfColumns, stickyColBkgdColor);
            }
        }

        /** Check if user and bulkOps operation is enabled
         * @param {object} keywords
         * @returns {boolean} - true if user has access and bulkOps are enabled*/
        function getFirstEnabledBulkOp(keywords) {
            if (keywords._nbo) return false;

            const bulkOps = [
                { operation: 'bulkEdit', role: 'Bulk Edit' },
                { operation: 'bulkCopy', role: 'Bulk Copy' },
                { operation: 'bulkDelete', role: 'Bulk Delete' },
            ];

            const userRoles = Knack.getUserRoleNames();
            for (const op of bulkOps) {
                if (ktl.core.getCfg().enabled.bulkOps[op.operation] && userRoles.includes(op.role)) {
                    return true;
                }
            }
            return false;
        }

        /////////////////////////////////////////////////////////////////////////////////
        function colorizeFieldByValue(viewId, data) {
            const CFV_KEYWORD = '_cfv';

            if (!viewId)
                return;

            const viewType = ktl.views.getViewType(viewId);
            if (viewType !== 'table' && viewType !== 'list' && viewType !== 'details')
                return;

            //Begin with View's _cfv.
            ktl.core.getKeywordsByType(viewId, CFV_KEYWORD).forEach(execKw);

            //Then end with fields _cfv, for precedence.
            colorizeFromFieldKeyword();

            function execKw(keyword) {
                if (!ktl.core.hasRoleAccess(keyword.options)) return;

                const options = keyword.options;
                const params = keyword.params;

                if (params.length) {
                    let fieldIds;
                    if (viewType === 'details') {
                        fieldIds = Array.from(document.querySelectorAll('#' + viewId + ' [class*=field]')).map((field) => {
                            let fieldId = field.classList.value.match(/field_\d+/);
                            if (fieldId.length)
                                fieldId = fieldId[0];
                            return fieldId;
                        });
                    } else { //Grids and Lists.
                        fieldIds = Knack.views[viewId].model.view.fields.map((f) => f.key);
                    }

                    cfvScanGroups(fieldIds, params, options);
                }
            }

            function colorizeFromFieldKeyword() {
                const fieldsWithKeywords = ktl.views.getAllFieldsWithKeywordsInView(viewId);

                if (!$.isEmptyObject(fieldsWithKeywords)) {
                    Object.keys(fieldsWithKeywords).forEach((fieldId) => {
                        const fieldKeywords = ktl.fields.getFieldKeywords(fieldId);
                        if (!$.isEmptyObject(fieldKeywords)
                            && fieldKeywords[fieldId]
                            && fieldKeywords[fieldId][CFV_KEYWORD]
                            && fieldKeywords[fieldId][CFV_KEYWORD].length) {
                            ktl.core.getKeywordsByType(fieldId, CFV_KEYWORD).forEach((keyword) => {
                                if (ktl.core.hasRoleAccess(keyword.options)) {
                                    cfvScanGroups([fieldId], keyword.params, keyword.options);
                                }
                            });
                        }
                    });
                }
            }

            function cfvScanGroups(viewFieldIds, groups, options) {
                if (!viewFieldIds || !data || !groups.length) return;

                if (options && !!options.ktlRefVal) {
                    const ktlRefValSplit = ktl.core.splitAndTrimToArray(options.ktlRefVal) || [''];
                    if (ktlRefValSplit.length === 2) {
                        const referenceViewId = ktl.scenes.findViewWithTitle(ktlRefValSplit[1]);
                        if (referenceViewId) {
                            $(document).off(`knack-view-render.${referenceViewId}.cfv${viewId}`).on(`knack-view-render.${referenceViewId}.cfv${viewId}`, () => {
                                ktl.views.refreshView(viewId);
                            });
                        }
                    }
                }

                groups.forEach((parameters) => {
                    if (parameters.length < 3) // Minimum parameter count
                        return;

                    const groupColumnHeader = parameters[0];
                    const groupReferenceValue = parameters[2];

                    let fieldId = groupColumnHeader;

                    if (!groupColumnHeader.startsWith('field_'))
                        fieldId = ktl.fields.getFieldIdFromLabel(viewId, groupColumnHeader);

                    if (!fieldId || !viewFieldIds.includes(fieldId))
                        return;

                    if (groupReferenceValue === 'ktlRefVal') {
                        if (!options || !options.ktlRefVal)
                            return;

                        const ktlRefVal = options.ktlRefVal;
                        const ktlRefValSplit = ktl.core.splitAndTrimToArray(ktlRefVal);

                        if (!ktlRefValSplit || !ktlRefValSplit.length)
                            return;

                        getReferenceValue(ktlRefVal, viewId)
                            .then((referenceValue) => {
                                //If no referenceValue found, then check in options to see if referenceValue a summary or a jQuery.
                                if (!referenceValue) {
                                    if (ktlRefValSplit[0] === 'ktlSummary') {
                                        if (ktlRefValSplit.length >= 2) {
                                            const summaryViewId = (ktlRefValSplit.length >= 3 && ktlRefValSplit[3]) ? ktlRefValSplit[3] : viewId;
                                            const summaryName = ktlRefValSplit[1] || '';
                                            const columnHeader = ktlRefValSplit[2] || '';

                                            if (summaryViewId !== viewId) {
                                                $(document).off('KTL.' + summaryViewId + '.totalsRendered.' + viewId).on('KTL.' + summaryViewId + '.totalsRendered.' + viewId, () => {
                                                    ktl.views.refreshView(viewId);
                                                })
                                                if (ktlKeywords[summaryViewId] && ktlKeywords[summaryViewId].summary) {
                                                    const summaryFieldId = ktl.fields.getFieldIdFromLabel(summaryViewId, columnHeader);
                                                    const summaryValue = readSummaryValue(summaryViewId, columnHeader, summaryName);
                                                    const value = ktl.core.extractNumericValue(summaryValue, summaryFieldId);

                                                    applyColorizationToRecords(fieldId, parameters, value, options);
                                                }
                                            } else {
                                                const summaryFieldId = ktl.fields.getFieldIdFromLabel(viewId, columnHeader);
                                                const summaryValue = readSummaryValue(viewId, columnHeader, summaryName);
                                                const value = ktl.core.extractNumericValue(summaryValue, summaryFieldId);
                                                const fieldId = ktl.fields.getFieldIdFromLabel(viewId, columnHeader);

                                                applyColorizationToRecords(fieldId, parameters, value, options);
                                            }
                                        }
                                    } else {
                                        //ktlRefVal can be followed by a jQuery selector, or a field label/ID and optionally a view title/ID.
                                        ktl.core.getTextFromSelector(ktlRefVal, viewId)
                                            .then(valueOfFieldId => {
                                                applyColorizationToRecords(fieldId, parameters, valueOfFieldId, options);
                                            })
                                            .catch(e => {
                                                ktl.log.clog('purple', 'Failed waiting for selector in applyColorization / getTextFromSelector.', viewId, e);
                                            })
                                    }
                                } else {
                                    applyColorizationToRecords(fieldId, parameters, referenceValue, options);
                                }
                            })
                            .catch(e => {
                                ktl.log.clog('purple', 'Failed waiting for selector in colorizeFieldByValue / getReferenceValue.', viewId, e);
                            });
                    } else {
                        applyColorizationToRecords(fieldId, parameters, groupReferenceValue, options);
                    }
                }); //Groups

                function applyColorizationToRecords(fieldId, parameters, value, options) {
                    if (!fieldId) return;

                    if (Array.isArray(fieldId)) {
                        fieldId.forEach((id) => applyColorizationToRecords(id, parameters, value, options));
                        return;
                    }

                    const viewType = ktl.views.getViewType(viewId);

                    if (viewType === 'details') {
                        var cellText;
                        const cellSelector = $('#' + viewId + ' .' + fieldId + ' .kn-detail-body');
                        cellText = cellSelector[0].textContent.trim();
                        applyColorizationToCells(fieldId, parameters, cellText, value, '', options);
                    } else { //Grids and Lists.
                        let fieldType = ktl.fields.getFieldType(fieldId);

                        if (fieldType === 'connection') { //Get display field type.
                            const objId = Knack.objects.getField(fieldId).attributes.relationship.object;
                            const displayFieldId = Knack.objects._byId[objId].attributes.identifier;
                            fieldType = ktl.fields.getFieldType(displayFieldId);
                        }

                        data.filter((record) => record[fieldId + '_raw'] != undefined).forEach((recordObj) => {
                            let cellText;

                            const rawData = recordObj[`${fieldId}_raw`];
                            if (rawData) {
                                if (Array.isArray(rawData) && rawData.length > 0)
                                    cellText = rawData.flat().map(obj => (obj.identifier || obj)).join(' ');
                                else if (fieldType === 'phone')
                                    cellText = rawData.formatted;
                                else if (fieldType === 'boolean') {
                                    const format = Knack.objects.getField(fieldId).attributes.format.format;
                                    if (format === 'yes_no')
                                        cellText = (rawData === true ? 'Yes' : 'No');
                                    else if (format === 'on_off')
                                        cellText = (rawData === true ? 'On' : 'Off');
                                    else
                                        cellText = (rawData === true ? 'True' : 'False');
                                } else
                                    cellText = rawData.toString();

                                if (cellText !== '' && numericFieldTypes.includes(fieldType))
                                    cellText = ktl.core.extractNumericValue(cellText, fieldId);
                            }

                            let refVal = value;

                            //When value is a reference field in same view. Only true for view keyword, n/a for fields.
                            if (value && value.startsWith('field_')) {
                                let valSel;

                                if (viewType === 'list')
                                    valSel = $('#' + viewId + ' [data-record-id="' + recordObj.id + '"]' + ' .kn-detail-body .' + value);
                                else
                                    valSel = $('#' + viewId + ' tbody tr[id="' + recordObj.id + '"]' + ' .' + value);

                                if (valSel.length)
                                    refVal = valSel[0].textContent.trim();
                            }

                            applyColorizationToCells(fieldId, parameters, cellText, refVal, recordObj, options);
                        }); //Data
                    }
                }

                function applyColorizationToCells(fieldId, parameter, cellTextParam, valueParam, record, options) {
                    const operator = parameter[1];
                    let value = valueParam;
                    let cellText = cellTextParam;

                    if (Array.isArray(cellTextParam))
                        cellText = cellTextParam.join(' ');

                    if (!value)
                        value = parameter[2];

                    if (value && value.startsWith('field_')) {
                        //When a field_id is specified, the use same view but another field.
                        var valSel = '#' + targetViewId + ' tbody tr[id="' + record.id + '"]' + ' .' + value;
                        if (viewType === 'list')
                            valSel = '#' + targetViewId + ' [data-record-id="' + record.id + '"]' + ' .kn-detail-body .' + value;
                        else if (viewType === 'details')
                            valSel = '#' + targetViewId + ' .kn-detail.' + value + ' .kn-detail-body';

                        if ($(valSel).length)
                            value = valSel[0].textContent.trim();
                    }

                    cellText = cellText && cellText.toLowerCase();
                    value = value.toLowerCase();

                    if (!ktlCompare(cellText, operator, value)) return;

                    var fgColor = parameter[3];

                    if (parameter.length >= 5)
                        var bgColor = parameter[4];

                    var span = '';
                    var propagate = false; //Propagate style to whole row.
                    var hide = false;
                    var remove = false;
                    var flash = false;
                    var flashFade = false;

                    var style = (fgColor ? 'color: ' + fgColor + '!important; ' : '') + (bgColor ? 'background-color: ' + bgColor + '!important; ' : '');

                    if (parameter.length >= 6 && parameter[5])
                        style += ('font-weight: ' + parameter[5] + '!important; ');

                    if (parameter.length >= 7) {
                        if (!cellText && parameter[6].includes('b')) //Ignore blank cells.
                            return;

                        if (parameter[6].includes('p'))
                            propagate = true;

                        if (parameter[6].includes('r')) {
                            span = ' span';
                            remove = true;
                        } else if (parameter[6].includes('h')) {
                            span = ' span';
                            hide = true;
                        } else {
                            if (parameter[6].includes('i'))
                                style += 'font-style: italic; ';

                            if (parameter[6].includes('u'))
                                style += 'text-decoration: underline; ';

                            if (parameter[6].includes('t')) //Text only, not whole cell.
                                span = ' span';

                            if (parameter[6].includes('ff'))
                                flashFade = true;
                            else if (parameter[6].includes('f'))
                                flash = true;
                        }
                    }

                    //Target selector.
                    var targetFieldId = fieldId;
                    var targetViewId;
                    var targetSel;

                    if (options && options.ktlTarget) {
                        var colNb;
                        const isJQueryTarget = ktl.core.extractJQuerySelector(options.ktlTarget);
                        if (isJQueryTarget)
                            targetSel = isJQueryTarget;
                        else {
                            const ktlTarget = ktl.core.splitAndTrimToArray(options.ktlTarget);

                            //Search parameters to see if we can find a targetViewId.
                            for (var i = 0; i < ktlTarget.length; i++) {
                                if (ktlTarget[i].startsWith('view_')) {
                                    targetViewId = ktlTarget[i];
                                    break;
                                }
                            }

                            //No direct view_id, let's try last param and search by view title.
                            var tryViewId;
                            if (!targetViewId) {
                                const lastItem = ktlTarget[ktlTarget.length - 1];
                                tryViewId = ktl.scenes.findViewWithTitle(lastItem);
                                if (tryViewId)
                                    targetViewId = tryViewId;
                            }

                            //Still nothing?  Fall back to default: keyword's view.
                            if (!targetViewId)
                                targetViewId = viewId;

                            targetSel = '#' + targetViewId; //Starting point - the view ID.

                            const targetViewType = ktl.views.getViewType(targetViewId);
                            if (targetViewType === 'table')
                                targetSel += ' tbody';
                            else if (targetViewType === 'list')
                                targetSel += ' kn-list-content, '; //Comma at end is required.

                            //Add all fields encountered.
                            for (i = 0; i < ktlTarget.length; i++) {
                                if (ktlTarget[i].startsWith('field_')) {
                                    targetFieldId = ktlTarget[i];
                                } else {
                                    //Try to find the field from the text.
                                    targetFieldId = ktl.fields.getFieldIdFromLabel(targetViewId, ktlTarget[i]);
                                }

                                if (targetViewType === 'table') {
                                    colNb = ktl.views.getFieldPositionFromHeader(targetViewId, ktlTarget[i]);
                                    if (colNb === undefined)
                                        colNb = ktl.views.getFieldPositionFromFieldId(targetViewId, targetFieldId);
                                    if (colNb >= 0)
                                        targetSel += ' tr[id="' + record.id + '"] td:nth-child(' + (colNb + 1) + ')' + span + ',';
                                } else if (targetViewType === 'list') {
                                    targetSel += ' [data-record-id="' + record.id + '"] .kn-detail.' + (propagate ? targetFieldId : targetFieldId + ' .kn-detail-body' + span) + ',';
                                } else if (targetViewType === 'details') {
                                    if (targetFieldId)
                                        targetSel += ' .kn-detail.' + (propagate ? targetFieldId : targetFieldId + ' .kn-detail-body' + span) + ',';
                                    else {
                                        //Try with an action link.
                                        const actionLink = $('#' + targetViewId + ' .kn-details-link .kn-detail-body:textEquals("' + ktlTarget[i] + '")');
                                        if (actionLink) {
                                            if (propagate)
                                                targetSel += ' .kn-details-link .kn-detail-body:textEquals("' + ktlTarget[i] + '"),';
                                            else
                                                targetSel += ' .kn-details-link .kn-detail-body:textEquals("' + ktlTarget[i] + '") span,';
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (!targetViewId)
                        targetViewId = viewId;

                    const viewType = ktl.views.getViewType(viewId);

                    if (!targetSel) {
                        targetSel = '#' + targetViewId + ' tbody tr[id="' + record.id + '"]' + (propagate ? span : ' .' + targetFieldId + span);
                        if (viewType === 'list')
                            targetSel = '#' + targetViewId + ' [data-record-id="' + record.id + '"]' + (propagate ? ' .kn-detail-body' + span : ' .' + targetFieldId + ' .kn-detail-body' + span);
                        else if (viewType === 'details')
                            targetSel = '#' + targetViewId + ' .' + (propagate ? targetFieldId : targetFieldId + ' .kn-detail-body' + span);
                    }

                    ktl.core.waitSelector(targetSel, 20000)
                        .then(function () {
                            if (remove)
                                $(targetSel).remove();
                            else if (hide) {
                                $(targetSel).addClass('ktlDisplayNone');
                            } else {
                                //Merge current and new styles.
                                const currentStyle = $(targetSel).attr('style');
                                $(targetSel).attr('style', (currentStyle ? currentStyle + '; ' : '') + style);
                            }

                            if (flash)
                                $(targetSel).addClass('ktlFlashingOnOff');
                            else if (flashFade)
                                $(targetSel).addClass('ktlFlashingFadeInOut');
                        })
                        .catch(function () {
                            //Timeout will happen once in a while when rendering a view with summary.
                            //Data becomes out of sync due to double renderTotals calls from Knack.
                        })
                }
            }

            ////////////////////////////////////////////////////////////
            //The reference value is the value against which we will compare the value of a record's field.
            //The refValSelString parameter can be a summary, a fixed field/view value or another field from the same record.
            function getReferenceValue(refValSelString, viewId) {
                return new Promise(function (resolve, reject) {
                    if (refValSelString && refValSelString !== '') {
                        var refValSelArray = ktl.core.splitAndTrimToArray(refValSelString);
                        if (!refValSelArray.length) {
                            reject('Called getReferenceValue with invalid parameter: ' + refValSelString);
                            return;
                        }

                        if (refValSelArray[0] === 'ktlSummary') {
                            if (refValSelArray.length >= 2) {
                                //console.log('ktlSummary, rvSelAr =', rvSelAr);
                                const summaryName = refValSelArray[1] ? refValSelArray[1] : '';
                                const columnHeader = refValSelArray[2] ? refValSelArray[2] : '';
                                const viewTitleOrId = (refValSelArray.length >= 3 && refValSelArray[3]) ? refValSelArray[3] : viewId;
                                const fieldId = ktl.fields.getFieldIdFromLabel(viewId, columnHeader);
                                const summaryValue = readSummaryValue(viewTitleOrId, columnHeader, summaryName); //TODO: Promisify to support other views asynchronously.
                                const refVal = ktl.core.extractNumericValue(summaryValue, fieldId);
                                resolve(refVal);
                            }
                        } else {
                            //ktlRefVal can be followed by a jQuery selector, or a field label/ID and optionally a view title/ID.
                            ktl.core.getTextFromSelector(refValSelString, viewId)
                                .then(refVal => {
                                    //console.log('ktlRefVal found:', refVal, rvSel);
                                    resolve(refVal);
                                })
                                .catch(reason => {
                                    reject('Failed waiting for selector in getReferenceValue / getTextFromSelector in ' + viewId + '\nrvSel:' + refValSelString + '\nReason: ' + reason);
                                })
                        }
                    }
                })
            }
        } //cfv feature

        //For KTL internal use.
        //Quick Toggle supports both named colors and hex style like #FF08 (RGBA).
        function quickToggle(viewId = '', data = []) {
            if (!viewId || data.length === 0 || ktl.scenes.isiFrameWnd()) return;

            const kw = '_qt';
            var kwInstance = ktlKeywords[viewId] && ktlKeywords[viewId][kw];
            if (kwInstance && kwInstance.length) {
                kwInstance = kwInstance[0];
                const options = kwInstance.options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            var qtScanItv = null;
            var quickToggleObj = {};
            var numToProcess = 0;
            var refreshTimer = null;
            var viewsToRefresh = [];
            var viewModel = Knack.router.scene_view.model.views._byId[viewId];
            if (!viewModel) return;

            var viewAttr = viewModel.attributes;
            const viewType = viewAttr.type;
            if (!['table', 'search'].includes(viewType)) return;

            var inlineEditing = false;
            if (viewType === 'table')
                inlineEditing = (viewAttr.options && viewAttr.options.cell_editor ? viewAttr.options.cell_editor : false);
            else
                inlineEditing = (viewAttr.cell_editor ? viewAttr.cell_editor : false);

            if (!inlineEditing) return;

            //Start with hard coded default colors.
            var bgColorTrue = quickToggleParams.bgColorTrue;
            var bgColorFalse = quickToggleParams.bgColorFalse;

            var fieldHasQt = false;

            //Override with view-specific colors, if any.
            if (kwInstance && kwInstance.params && kwInstance.params.length) {
                fieldHasQt = true; //If view has QT, then all fields inherit also.
                const fldColors = kwInstance.params[0];
                if (fldColors.length >= 1 && fldColors[0])
                    bgColorTrue = fldColors[0];

                if (fldColors.length >= 2 && fldColors[1])
                    bgColorFalse = fldColors[1];
            }

            var fieldKeywords = {};
            var fieldsColor = {};
            const cols = (viewType === 'table' ? viewAttr.columns : viewAttr.results.columns);
            for (var i = 0; i < cols.length; i++) {
                var col = cols[i];
                if (col.type === 'field' && col.field && col.field.key && !col.ignore_edit) {
                    var field = Knack.objects.getField(col.field.key);
                    if (field && !col.connection) { //Field must be local to view's object, not a connected field.
                        if (field.attributes.type === 'boolean') {
                            const fieldId = col.field.key;

                            //Override with field-specific colors, if any.
                            var tmpFieldColors = {
                                bgColorTrue: bgColorTrue,
                                bgColorFalse: bgColorFalse
                            }

                            ktl.fields.getFieldKeywords(fieldId, fieldKeywords);
                            if (fieldKeywords[fieldId] && fieldKeywords[fieldId]._qt) {
                                fieldHasQt = true;
                                if (fieldKeywords[fieldId]._qt.length && fieldKeywords[fieldId]._qt[0].params && fieldKeywords[fieldId]._qt[0].params.length > 0) {
                                    const fldColors = fieldKeywords[fieldId]._qt[0].params[0];
                                    if (fldColors.length >= 1 && fldColors[0] !== '')
                                        tmpFieldColors.bgColorTrue = fldColors[0];
                                    if (fldColors.length >= 2 && fldColors[1] !== '')
                                        tmpFieldColors.bgColorFalse = fldColors[1];
                                }
                            }

                            if (fieldHasQt) {
                                fieldsColor[fieldId] = tmpFieldColors;
                                $('#' + viewId + ' td.' + fieldId + '.cell-edit').addClass('qtCell');
                            }
                        }
                    }
                }
            }

            //Update table colors
            if (!$.isEmptyObject(fieldsColor)) {
                data.forEach(row => {
                    const keys = Object.keys(fieldsColor);
                    keys.forEach(fieldId => {
                        var style = 'background-color:' + ((row[fieldId + '_raw'] === true) ? fieldsColor[fieldId].bgColorTrue : fieldsColor[fieldId].bgColorFalse);
                        $('#' + viewId + ' tbody tr[id="' + row.id + '"] .' + fieldId).attr('style', style);
                    })
                })
            }

            //Process cell clicks.
            //$('#' + viewId + ' .qtCell').off('click').on('click', e => {
            $('#' + viewId + ' .qtCell').on('click', e => {
                if (document.querySelectorAll('.bulkEditCb:checked').length) return;

                e.stopImmediatePropagation();

                var fieldId = e.target.getAttribute('data-field-key') || e.target.parentElement.getAttribute('data-field-key');
                var viewId = e.target.closest('.kn-search.kn-view') || e.target.closest('.kn-table.kn-view');
                if (viewId) {
                    viewId = viewId.getAttribute('id');

                    const dt = Date.now();
                    var recId = e.target.closest('tr').id;
                    var value = ktl.views.getDataFromRecId(viewId, recId)[fieldId + '_raw'];
                    value = (value === true ? false : true);
                    if (!viewsToRefresh.includes(viewId))
                        viewsToRefresh.push(viewId);

                    quickToggleObj[dt] = { viewId: viewId, fieldId: fieldId, value: value, recId: recId, processed: false };
                    $(e.target.closest('td')).css('background-color', quickToggleParams.bgColorPending); //Visual cue that the process is started.
                    clearTimeout(refreshTimer);

                    numToProcess++;
                    startQtScanning();
                }
            })

            function startQtScanning() {
                ktl.core.infoPopup();
                showProgress();

                if (qtScanItv) return;
                ktl.views.autoRefresh(false);
                qtScanItv = setInterval(() => {
                    if (!$.isEmptyObject(quickToggleObj)) {
                        var dt = Object.keys(quickToggleObj)[0];
                        if (!quickToggleObj[dt].processed) {
                            quickToggleObj[dt].processed = true;
                            doQuickToggle(dt);
                        }
                    }
                }, 500);
            }

            function doQuickToggle(dt) {
                var recObj = quickToggleObj[dt];
                if ($.isEmptyObject(recObj) || !recObj.viewId || !recObj.fieldId) return;

                var apiData = {};
                apiData[recObj.fieldId] = recObj.value;
                ktl.core.knAPI(recObj.viewId, recObj.recId, apiData, 'PUT', [], false /*must be false otherwise spinner blocks click events*/)
                    .then(() => {
                        showProgress();
                        numToProcess--;
                        delete quickToggleObj[dt];
                        if ($.isEmptyObject(quickToggleObj)) {
                            clearInterval(qtScanItv);
                            qtScanItv = null;
                            Knack.showSpinner();
                            refreshTimer = setTimeout(() => {
                                ktl.core.removeInfoPopup();
                                ktl.views.refreshViewArray(viewsToRefresh)
                                    .then(() => {
                                        Knack.hideSpinner();
                                        ktl.views.autoRefresh();
                                    })
                            }, 500);
                        }
                    })
                    .catch(function (reason) {
                        ktl.views.autoRefresh();
                        alert('Error code KEC_1025 while processing Quick Toggle operation, reason: ' + JSON.stringify(reason));
                    })
            }

            function showProgress() {
                ktl.core.setInfoPopupText('Toggling... ' + numToProcess + ' items remaining.');
            }
        } //quickToggle


        //For KTL internal use.
        function matchColor(viewId, data = []) {
            if (!viewId || ktl.scenes.isiFrameWnd()) return;

            var viewModel = Knack.router.scene_view.model.views._byId[viewId];
            if (!viewModel) return;

            var viewAttr = viewModel.attributes;
            const viewType = viewAttr.type;
            if (!['table', 'search'].includes(viewType)) return;

            const kw = '_mc';
            var kwInstance = ktlKeywords[viewId] && ktlKeywords[viewId][kw];
            if (kwInstance && kwInstance.length)
                kwInstance = kwInstance[0];
            else
                return;

            const options = kwInstance.options;
            if (!ktl.core.hasRoleAccess(options)) return;

            var toMatch = kwInstance.params[0];
            if (toMatch.length !== 1 || !toMatch[0]) return;
            toMatch = toMatch[0];

            var fieldId = '';
            var fieldName = '';

            const attr = Knack.router.scene_view.model.views._byId[viewId].attributes;
            var cols = attr.columns.length ? attr.columns : attr.results.columns;
            for (var i = 0; i < cols.length; i++) {
                fieldId = cols[i].field.key;
                var field = Knack.objects.getField(fieldId);
                if (field && field.attributes) {
                    fieldName = field.attributes.name;
                    if (fieldName === toMatch)
                        break;
                }
            }

            if (!fieldId || !fieldName) {
                ktl.core.timedPopup('This table doesn\'t have a column with that header: ' + toMatch, 'warning', 4000);
                return;
            }

            data.forEach(row => {
                var rowSel = document.querySelector('#' + viewId + ' tbody tr[id="' + row.id + '"] .' + fieldId);
                if (rowSel) {
                    var bgColor = rowSel.style.backgroundColor;
                    document.querySelector('#' + viewId + ' tbody tr[id="' + row.id + '"] .' + fieldId).style.backgroundColor = ''; //Need to remove current bg color otherwise transparency can add up and play tricks.

                    $('#' + viewId + ' tbody tr[id="' + row.id + '"]').css('background-color', bgColor);
                }
            })
        }

        function noSortingOnGrid(viewId, keywords) {
            const kw = '_nsg';
            if (!viewId || !keywords || !keywords[kw]) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            $('#' + viewId + ' thead [href]').addClass('ktlSortDisabled');
        }

        //Adjust header alignment of Grids and Pivot Tables
        function headerAlignment(view, keywords) {
            const kw = '_ha';
            if (!view || !cfg.headerAlignment || !keywords || (keywords && !keywords[kw])) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            const viewType = view.type;

            if (viewType === 'report') //Pivot Tables.  Simpler: all data always right-aligned.
                $('#' + view.key + '.kn-report :is(thead th, tr.kn-table_summary td)').css('text-align', 'right');
            else if (viewType === 'table') {
                var columns = view.columns;
                if (!columns) return;

                try {
                    columns.forEach(col => {
                        var align = col.align;
                        if (col.type == 'field' || (col.type == 'link' && col.field)) {
                            var fieldId = col.field.key;
                            if (col.field) {
                                //Remove anything after field_xxx, like pseudo selectors with colon.
                                var extractedField = fieldId.match(/field_\d+/);
                                if (extractedField) {
                                    fieldId = extractedField[0];
                                    $('#' + view.key + ' thead th.' + fieldId).css('text-align', align);
                                    $('#' + view.key + ' thead th.' + fieldId + ' .table-fixed-label').css('display', 'inline-flex');
                                }
                            }
                        } else if (col.type == 'link') {
                            $('#' + view.key + ' thead th.kn-table-link').css('text-align', align);
                            $('#' + view.key + ' thead th.kn-table-link .table-fixed-label').css('display', 'inline-flex');
                        } //Any other field type?
                    })
                } catch (e) {
                    console.log('headerAlignment error:', e);
                }
            }
        }

        //Hide the view title only, typically used to save space when real estate is critical.
        function hideTitle(viewId, keywords) {
            const kw = '_ht';
            if (!(viewId && keywords && keywords[kw])) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            $('#' + viewId + ' .view-header h1').addClass('ktlHidden'); //Search Views use H1 instead of H2.
            $('#' + viewId + ' .view-header h2').addClass('ktlHidden');
        }

        function setRecordId(viewId, keywords, data) {
            const kw = '_recid';
            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (viewType !== 'table') return;

            var tableHasInlineEditing = false;
            var viewModel = Knack.router.scene_view.model.views._byId[viewId];
            if (viewModel) {
                var viewAttr = viewModel.attributes;
                tableHasInlineEditing = viewAttr.options ? viewAttr.options.cell_editor : false;
            }

            if (!tableHasInlineEditing) {
                ktl.log.clog('purple', `_recid keyword used in a grid without inline edit: ${viewId}`);
                return;
            }

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            var recIdLabel = 'Record ID';
            const params = keywords[kw][0] && keywords[kw][0].params;
            if (keywords[kw][0] && params.length && params[0].length)
                recIdLabel = params[0][0];

            const recIdFieldId = ktl.fields.getFieldIdFromLabel(viewId, recIdLabel);
            if (!recIdFieldId) return;

            var updateRecIdArray = [];

            data.forEach(el => {
                if (!el[recIdFieldId])
                    updateRecIdArray.push(el.id);
            })

            var arrayLen = updateRecIdArray.length;
            if (!arrayLen) return;

            const objName = ktl.views.getViewSourceName(viewId);

            ktl.views.autoRefresh(false);
            ktl.scenes.spinnerWatchdog(false);

            var idx = 0;
            var countDone = 0;
            var itv = setInterval(() => {
                if (idx < arrayLen)
                    updateRecord(updateRecIdArray[idx++]);
                else
                    clearInterval(itv);
            }, 150);

            function updateRecord(recId) {
                showProgress();
                var apiData = {};
                apiData[recIdFieldId] = recId;
                ktl.core.knAPI(viewId, recId, apiData, 'PUT')
                    .then(function () {
                        if (++countDone === updateRecIdArray.length) {
                            updateRecIdArray = [];
                            Knack.showSpinner();
                            ktl.views.refreshView(viewId).then(function () {
                                Knack.hideSpinner();
                                ktl.scenes.spinnerWatchdog();
                                ktl.views.autoRefresh();
                            })
                        }
                    })
                    .catch(function (reason) {
                        Knack.hideSpinner();
                        ktl.scenes.spinnerWatchdog();
                        ktl.views.autoRefresh();
                        alert('Record IDs update error: ' + JSON.parse(reason.responseText).errors[0].message);
                    })

                function showProgress() {
                    console.log('Updating ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (arrayLen - countDone));
                }
            }
        }

        function goUpParentLevels(viewId, keywords) {
            const kw = '_parent';

            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(viewType === 'form' || viewType === 'menu')) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                const level = keywords[kw][0].params[0][0] || 1;
                if (viewType === 'form') {
                    $(document).bindFirst('knack-form-submit.' + viewId, () => {
                        const url = ktl.core.findParentURL(window.location.href, level);
                        url && (window.location.href = url);
                    })
                } else if (viewType === 'menu') {
                    const buttonLabel = keywords[kw][0].params[0][1] || 'Go Back';

                    ktl.systemColors.getSystemColors()
                        .then((sc) => {
                            const sysColors = sc;
                            var gotoParentBtn = ktl.fields.addButton(document.querySelector('#' + viewId + ' .menu-links__list'), buttonLabel, `color:${sysColors.links.rgb}`, ['menu-links__list-item', 'knMenuLink', 'knMenuLink--button', 'knMenuLink--filled', 'knMenuLink--size-medium'], 'ktlGotoParent-' + viewId);
                            gotoParentBtn.addEventListener('click', function (e) {
                                const url = ktl.core.findParentURL(window.location.href, level);
                                url && (window.location.href = url);
                            })
                        })
                }
            }
        }

        function viewRecordDetails(viewId, keywords) {
            if (!viewId) return;

            const kw = '_vrd';
            const viewType = ktl.views.getViewType(viewId);
            if (!(keywords && keywords[kw] && (viewType === 'table' || viewType === 'search'))) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length === 1 && keywords[kw][0].params[0].length === 2) {
                const viewToSearch = keywords[kw][0].params[0][1];
                const viewIdToSearch = (viewToSearch.startsWith('view_')) ? viewToSearch : ktl.core.getViewIdByTitle(viewToSearch, Knack.getCurrentScene().slug, true);

                ktl.core.waitSelector(`#${viewIdToSearch}`)
                    .then(() => {
                        $(`#${viewIdToSearch} .kn-search_form`).addClass('ktlHidden'); //Hide search fields.

                        const fieldToSearch = keywords[kw][0].params[0][0];
                        var fieldIdToSearch;

                        if (fieldToSearch.startsWith('field_'))
                            fieldIdToSearch = fieldToSearch;
                        else {
                            $(`#${viewId} td`).on('click.ktlVrd', processVrd);

                            function processVrd(e) {
                                const clickedViewId = $(e.target).closest('.kn-view[id]').attr('id');
                                if (clickedViewId && clickedViewId === viewId) {
                                    const clickedObj = e.target.closest('tr') || e.target.closest('[data-record-id]');
                                    const recId = (clickedObj && clickedObj.id);
                                    if (recId) {
                                        fieldIdToSearch = ktl.fields.getFieldIdFromLabel(viewId, fieldToSearch);
                                        if (fieldIdToSearch) {
                                            const textToSearch = document.querySelector(`#${clickedViewId} tr[id="${recId}"] .${fieldIdToSearch}`).innerText;
                                            $(`#${viewIdToSearch}-search input`).val(textToSearch);
                                            $(`#${viewIdToSearch} .is-primary`).click();

                                            $(`#${viewId} td`).off('click.ktlVrd');
                                            $(`#${viewId} td`).on('click.ktlVrd', processVrd);

                                            $(document).on(`knack-view-render.${viewIdToSearch}`, function (event, view, data) {
                                                $(`#${viewIdToSearch}`).removeClass('ktlHidden');

                                                //Remove any similar rows, ex: two persons with same name. Keep only the row with same recId.
                                                $(`#${viewIdToSearch} tbody tr:not([id="${recId}"])`).remove();
                                                $(document).off(`knack-view-render.${viewIdToSearch}`);

                                                $(`#${clickedViewId} .ktlOutline`).removeClass('ktlOutline');
                                                $(clickedObj).addClass('ktlOutline');
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    })
                    .catch(() => {
                        ktl.log.clog('purple', `viewRecordDetails failed finding search view: ${viewToSearch}`)
                    })
            }
        }

        //Example: _click=Link Label, auto (or blank), Button Label
        let clickCurrentlyRunning = null;
        let clickLastRecIdProcessed = null;
        function performClick(viewId, keywords, data) {
            const kw = '_click';
            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(viewType === 'table' || viewType === 'search')) return;

            const kwList = ktl.core.getKeywordsByType(viewId, kw);
            kwList.forEach(kwInstance => { execKw(kwInstance); })

            function execKw(kwInstance) {
                const options = kwInstance.options;
                if (!ktl.core.hasRoleAccess(options)) return;

                const params = kwInstance.params[0];
                if (params.length < 1) return;

                //TODO
                //const conditions = options.ktlCond.replace(']', '').split(',').map(e => e.trim());
                //const view = conditions[3] || '';
                //const condViewId = (view.startsWith('view_')) ? view : ktl.scenes.findViewWithTitle(view);

                const actionLinkText = params[0];

                let needConfirm = true;
                if (params.length >= 2 && params[1] === 'auto')
                    needConfirm = false;
                let startButton;
                let buttonLabel;

                if (params.length >= 3 && params[2]) {
                    //Add a start button
                    buttonLabel = params[2];
                    let ktlAddonsDiv = ktl.views.getKtlAddOnsDiv(viewId);
                    const buttonId = ktl.core.getCleanId(buttonLabel);
                    startButton = ktl.fields.addButton(ktlAddonsDiv, buttonLabel, '', ['kn-button', 'ktlButtonMargin'], `${buttonId}-${viewId}`);

                    if (!data.length)
                        startButton.disabled = true;

                    if (clickCurrentlyRunning === actionLinkText) {
                        startButton.textContent = startButton.textContent + ' - STOP';
                        startButton.addEventListener('click', function (e) {
                            if (clickCurrentlyRunning) {
                                clickCurrentlyRunning = null;
                                startButton.textContent = buttonLabel;
                            }
                        })

                        doClick();
                    } else {
                        if (clickCurrentlyRunning)
                            startButton.disabled = true;

                        startButton.addEventListener('click', function (e) {
                            if (needConfirm) {
                                if (confirm(`Proceed with auto-click on ${actionLinkText}?`)) {
                                    clickCurrentlyRunning = actionLinkText;
                                    doClick();
                                }
                            } else {
                                clickCurrentlyRunning = actionLinkText;
                                doClick();
                            }
                        })
                    }
                } else { //No button
                    if (needConfirm) {
                        if (confirm(`Proceed with auto-click on ${actionLinkText}?`)) {
                            clickCurrentlyRunning = actionLinkText;
                            doClick();
                        }
                    }
                    else {
                        clickCurrentlyRunning = actionLinkText;
                        doClick();
                    }
                }

                function doClick() {
                    setTimeout(() => { //Leave some time to apply any other keyword that might hide the link.
                        //If last clicked record is still there, exit and wait for next refresh.
                        if (clickLastRecIdProcessed) {
                            if ($(`#${viewId} tr[id="${clickLastRecIdProcessed}"] .knViewLink__label:textEquals("${clickCurrentlyRunning}")`).length)
                                return;
                            else
                                clickLastRecIdProcessed = null;
                        }

                        let linkSelector;

                        if (clickCurrentlyRunning) {
                            linkSelector = $(`#${viewId} .knViewLink__label:textEquals("${clickCurrentlyRunning}")`);

                            if (linkSelector.length) {
                                linkSelector[0].classList.add('ktlOutline');
                                clickLastRecIdProcessed = linkSelector[0].closest(`tr`).id;
                                linkSelector[0].click();
                            } else {
                                if (startButton)
                                    startButton.textContent = buttonLabel;
                                clickLastRecIdProcessed = null;
                                clickCurrentlyRunning = null;
                            }
                        }
                    }, 1000);
                }
            }
        }

        //Work in progress...
        function sendBulkEmails(viewId, keywords, data) {
            const kw = '_mail';

            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(viewId && keywords && keywords[kw] && (viewType === 'table' || viewType === 'search'))) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            let sendEmailsButtonDiv = document.querySelector(`ktlButtonsDiv-${viewId}`);
            if (!sendEmailsButtonDiv) {
                sendEmailsButtonDiv = document.createElement('div');
                sendEmailsButtonDiv.setAttribute('id', `ktlButtonsDiv-${viewId}`);
                sendEmailsButtonDiv.style.marginTop = '10px';
                sendEmailsButtonDiv.style.marginBottom = '30px';

                const div = document.querySelector(`#${viewId}`);
                if (div) {
                    div.prepend(sendEmailsButtonDiv);

                    const sendEmailsButton = ktl.fields.addButton(sendEmailsButtonDiv, 'Send Emails Now', '', ['kn-button', 'ktlButtonMargin', 'bulkEditSelectSrc'], 'ktlSendEmailNow-' + viewId);
                    sendEmailsButton.addEventListener('click', function (e) {
                        console.log('Send email now');

                        //prepareEmailData();

                    })
                }
            }

            const SEND_DATE = 'Send';
            const SENT_DATE = 'Last Sent';
            const SUBJECT = 'Subject';
            const BODY = 'Body';
            const ML_POSTING = 'Posting ID';
            const ML_DETAILS_VIEW = ktl.core.getViewIdByTitle('Posting Details', 'posting-details-review-and-send');
            const ML_GRID_VIEW = ktl.core.getViewIdByTitle('Recipients', 'posting-details-review-and-send');

            let isMLDetailsViewRendered = false;
            let isMLGridViewRendered = false;
            let gridData = {};
            let apiData = {};
            let postingSrcFldId, subjectSrcFldId, bodySrcFldId, sendSrcFldId;
            let postingDstFldId, subjectDstFldId, bodyDstFldId, sendDstFldId, sentDstFldId;

            $(document).on(`knack-view-render.${ML_GRID_VIEW} knack-view-render.${ML_DETAILS_VIEW}`, function (event, view, data) {
                const viewId = view.key;
                if (viewId === ML_DETAILS_VIEW) {
                    postingSrcFldId = ktl.fields.getFieldIdFromLabel(ML_DETAILS_VIEW, ML_POSTING);
                    subjectSrcFldId = ktl.fields.getFieldIdFromLabel(ML_DETAILS_VIEW, SUBJECT);
                    bodySrcFldId = ktl.fields.getFieldIdFromLabel(ML_DETAILS_VIEW, 'Dead Body');
                    sendSrcFldId = ktl.fields.getFieldIdFromLabel(ML_DETAILS_VIEW, SEND_DATE);
                    isMLDetailsViewRendered = true;
                } else if (viewId === ML_GRID_VIEW) {
                    postingDstFldId = ktl.fields.getFieldIdFromLabel(ML_GRID_VIEW, ML_POSTING);
                    subjectDstFldId = ktl.fields.getFieldIdFromLabel(ML_GRID_VIEW, SUBJECT);
                    bodyDstFldId = ktl.fields.getFieldIdFromLabel(ML_GRID_VIEW, BODY);
                    sendDstFldId = ktl.fields.getFieldIdFromLabel(ML_GRID_VIEW, SEND_DATE);
                    sentDstFldId = ktl.fields.getFieldIdFromLabel(ML_GRID_VIEW, SENT_DATE);
                    isMLGridViewRendered = true;
                    gridData = data;
                }

                if (isMLDetailsViewRendered && isMLGridViewRendered) {
                    const postingValue = Knack.views[ML_DETAILS_VIEW].record[postingSrcFldId];
                    const postingRecId = Knack.views[ML_DETAILS_VIEW].record.id;
                    const subjectValue = Knack.views[ML_DETAILS_VIEW].record[subjectSrcFldId];
                    const bodyValue = Knack.views[ML_DETAILS_VIEW].record[bodySrcFldId];
                    const sendValue = Knack.views[ML_DETAILS_VIEW].record[sendSrcFldId];

                    apiData[postingDstFldId] = [postingRecId];
                    apiData[subjectDstFldId] = subjectValue;
                    apiData[bodyDstFldId] = bodyValue;
                    apiData[sendDstFldId] = sendValue;
                    apiData[sentDstFldId] = '';

                    let bulkOpsRecordsArray = [];
                    gridData.forEach(rec => {
                        if (!rec[`${postingDstFldId}_raw`].length || rec[`${postingDstFldId}_raw`][0].identifier !== postingValue) {
                            apiData.id = rec.id;
                            bulkOpsRecordsArray.push(apiData);
                        }
                    })

                    if (bulkOpsRecordsArray.length) {
                        ktl.views.processAutomatedBulkOps(ML_GRID_VIEW, bulkOpsRecordsArray)
                            .then(countDone => {
                                ktl.core.timedPopup('Mailing list pre-processing complete');

                            })
                            .catch(err => {
                                alert(`Mailing List pre-processing error encountered:\n${err}`);
                            })
                    }
                }
            })
        }

        function dragAndDrop(viewId, keywords) {
            const kw = '_dnd';

            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(viewId && keywords && keywords[kw] && (viewType === 'table' || viewType === 'search'))) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (!(keywords[kw][0].params && keywords[kw][0].params[0].length >= 2)) return;

            const dndType = keywords[kw][0].params[0][0];
            if (dndType === 'sort')
                dndSort();
            else {
                //TODO: Implement other DnD types as we go, ex: from srcView to dstView.
            }

            function dndSort() {
                const lineIndexFieldLabel = keywords[kw][0].params[0][1];
                const lineIndexFieldId = ktl.fields.getFieldIdFromLabel(viewId, lineIndexFieldLabel);
                const dndDiv = document.querySelector('#' + viewId + ' tbody');

                new Sortable(dndDiv, {
                    swapThreshold: 0.96,
                    animation: 250,
                    easing: "cubic-bezier(1, 0, 0, 1)",
                    onEnd: function (evt) {
                        if (evt.oldIndex !== evt.newIndex) {
                            ktl.core.infoPopup();
                            ktl.views.autoRefresh(false);
                            ktl.scenes.spinnerWatchdog(false);
                            $.blockUI({ message: '', overlayCSS: { backgroundColor: '#ddd', opacity: 0.2, } })

                            var recIdArray = [];
                            var idx;
                            const newData = document.querySelectorAll('#' + viewId + ' tbody tr .' + lineIndexFieldId);
                            for (idx = 0; idx < newData.length; idx++) {
                                if (newData[idx].innerText !== (idx + 1).toString()) {
                                    var recData = {};
                                    recData[lineIndexFieldId] = idx + 1;
                                    recData.recId = newData[idx].closest('tr').id;
                                    recIdArray.push(recData);
                                }
                            }

                            var arrayLen = recIdArray.length;
                            idx = 0;
                            var countDone = 0;
                            var apiData = {};

                            var itv = setInterval(() => {
                                if (idx < arrayLen) {
                                    apiData[lineIndexFieldId] = recIdArray[idx][lineIndexFieldId];
                                    const recId = recIdArray[idx].recId;
                                    updateRecord(recId, apiData);
                                    idx++;
                                } else
                                    clearInterval(itv);
                            }, 150);

                            function updateRecord(recId, apiData) {
                                showProgress();
                                ktl.core.knAPI(viewId, recId, apiData, 'PUT')
                                    .then(function () {
                                        if (++countDone === recIdArray.length) {
                                            recIdArray = [];
                                            Knack.showSpinner();
                                            ktl.core.removeInfoPopup();
                                            ktl.views.refreshView(viewId).then(function () {
                                                ktl.core.removeTimedPopup();
                                                ktl.scenes.spinnerWatchdog();
                                                ktl.views.autoRefresh();
                                                Knack.hideSpinner();
                                                $.unblockUI();
                                                ktl.core.timedPopup('Rows Reordered successfully');
                                            })
                                        } else
                                            showProgress();
                                    })
                                    .catch(function (reason) {
                                        ktl.core.removeInfoPopup();
                                        ktl.core.removeTimedPopup();
                                        Knack.hideSpinner();
                                        ktl.scenes.spinnerWatchdog();
                                        ktl.views.autoRefresh();
                                        $.unblockUI();
                                        alert('Rows Reorder failed: ' + JSON.parse(reason.responseText).errors[0].message);
                                    })

                                function showProgress() {
                                    ktl.core.setInfoPopupText('Updating ' + arrayLen + ' Lines.    Records left: ' + (arrayLen - countDone));
                                }
                            }
                        }
                    }
                });
            }
        }

        function copyRecordsFromView(dstViewId, keywords, data) {
            const kw = '_cpyfrom';
            if (!(dstViewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(dstViewId);
            if (viewType !== 'table') return;

            if (!ktl.views.viewHasInlineEdit(dstViewId)) {
                ktl.log.clog('purple', `_recid keyword used in a grid without inline edit: ${dstViewId}`);
                return;
            }

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            const params = keywords[kw][0].params;
            if (params.length < 1 || params[0].length < 1) return;

            const srcViewTitle = params[0][0];
            const srcViewId = ktl.scenes.findViewWithTitle(srcViewTitle, true, dstViewId);

            ktl.views.waitViewDataReady(srcViewId)
                .then(() => { srcDataReady(); })
                .catch(reason => {
                    ktl.log.clog('purple', `copyRecordsFromView - Timeout waiting for data: ${srcViewId}`);
                    console.error(reason);
                })

            function srcDataReady() {
                const srcData = Knack.views[srcViewId].model.data.models;
                if (!srcData.length) return;

                if (data.length === srcData.length) return;

                let needConfirm = true;
                if (params[0].length >= 2 && params[0][1] === 'auto')
                    needConfirm = false;

                if (params[0].length >= 3 && params[0][2]) {
                    //Add a start button
                    const buttonLabel = params[0][2];
                    let startButtonDiv = document.querySelector(`ktlButtonsDiv-${dstViewId}`);
                    if (!startButtonDiv) {
                        startButtonDiv = document.createElement('div');
                        startButtonDiv.setAttribute('id', `ktlButtonsDiv-${dstViewId}`);
                        startButtonDiv.style.marginTop = '10px';
                        startButtonDiv.style.marginBottom = '30px';

                        const div = document.querySelector(`#${dstViewId}`);
                        if (div) {
                            div.prepend(startButtonDiv);

                            const startButton = ktl.fields.addButton(startButtonDiv, buttonLabel, '', ['kn-button', 'ktlButtonMargin'], 'ktlStartClickNow-' + dstViewId);
                            startButton.addEventListener('click', function (e) {
                                if (needConfirm) {
                                    if (confirm(`Proceed with copy?`))
                                        proceed();
                                } else
                                    proceed();
                            })
                        }
                    }
                } else { //No button
                    if (needConfirm) {
                        if (confirm(`Proceed with copy?`))
                            proceed();
                    } else
                        proceed();
                }

                function proceed() {
                    let fieldsToCopy = ['']; //All fields by default
                    if (params.length >= 2 && params[1].length >= 1)
                        fieldsToCopy = params[1];

                    const model = Knack.views[dstViewId] && Knack.views[dstViewId].model;
                    const columns = model.view.columns;
                    const headers = columns.map(col => col.header.trim()).filter(header => {
                        return (fieldsToCopy.includes(header) || fieldsToCopy[0] === '');
                    });

                    //Try to find the equivalent headers in source view.
                    let dstHeaders = {};
                    for (const header of headers) {
                        const dstFieldId = ktl.fields.getFieldIdFromLabel(dstViewId, header);
                        if (dstFieldId && dstFieldId.startsWith('field_') && Knack.objects.getField(dstFieldId).attributes.type !== 'concatenation') {
                            const srcFieldId = ktl.fields.getFieldIdFromLabel(srcViewId, header);
                            if (srcFieldId)
                                dstHeaders[header] = { src: srcFieldId, dst: dstFieldId };
                        }
                    }

                    //Process additional parameter groups, if any.
                    for (let i = 2; i < params.length; i++) {
                        let param = params[i];
                        if (param.length == 2) {
                            if (param[0] !== '' && param[1] === 'ktlLoggedInAccount') {
                                const dstFieldId = ktl.fields.getFieldIdFromLabel(dstViewId, param[0]);
                                if (dstFieldId && dstFieldId.startsWith('field_') && Knack.objects.getField(dstFieldId).attributes.type !== 'concatenation') //Exclude Text Formulas
                                    dstHeaders[param[0]] = { src: 'ktlLoggedInAccount', dst: dstFieldId };
                            }
                        } else if (param.length == 3) {
                            //When source is a field/view selector.
                            //const header = param[0];
                            const fieldLabel = param[1];
                            const viewTitle = param[2];
                            const foreignViewId = ktl.scenes.findViewWithTitle(viewTitle, true, srcViewId);
                            const foreignFieldId = ktl.fields.getFieldIdFromLabel(foreignViewId, fieldLabel);
                            if (foreignFieldId) {
                                const viewType = ktl.views.getViewType(foreignViewId);
                                if (viewType === 'details') {
                                    ktl.views.waitViewDataReady(foreignViewId)
                                        .then(() => {
                                            const value = Knack.views[foreignViewId].record;
                                            dstHeaders[param[0]] = { src: 'ktlUseThisValue', dst: value };
                                        })
                                        .catch(err => {
                                            ktl.log.clog('purple', `copyRecordsFromView, proceed - Timeout waiting for data: ${foreignViewId}`);
                                            console.log('err =', err);
                                        })
                                }
                            }
                        }
                    }

                    let bulkCopyApiDataArray = [];

                    for (const recordObj of srcData) {
                        let recId;
                        let apiData = {};
                        for (const header in dstHeaders) {
                            if (dstHeaders[header].src.startsWith('field_')) {
                                let viewObj = Knack.objects.getField(dstHeaders[header].src).attributes.object_key;
                                let displayField = Knack.objects._byId[viewObj].attributes.identifier;
                                if (dstHeaders[header].src === displayField) {
                                    recId = recordObj.id;
                                    apiData[dstHeaders[header].dst] = [recId];
                                } else
                                    apiData[dstHeaders[header].dst] = recordObj.attributes[`${dstHeaders[header].src}_raw`];
                            } else {
                                if (dstHeaders[header].src === 'ktlLoggedInAccount')
                                    apiData[dstHeaders[header].dst] = [Knack.getUserAttributes().id];
                            }
                        }

                        bulkCopyApiDataArray.push(apiData);
                    }

                    $.blockUI({
                        message: 'Loading form, please wait...',
                        overlayCSS: {
                            backgroundColor: '#ddd', opacity: 0.2, cursor: 'wait'
                        },
                        css: { padding: 20 }
                    })

                    ktl.views.processAutomatedBulkOps(dstViewId, bulkCopyApiDataArray, 'POST', [], false, false)
                        .then(countDone => {
                            $.unblockUI();
                        })
                        .catch(err => {
                            $.unblockUI();
                            alert(`Copy error encountered:\n${err}`);
                        })
                }
            }
        }

        function colorizeSortedColumn(viewId, keywords) {
            const kw = '_scs';
            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(viewType === 'table' || viewType === 'search')) return;

            const kwList = ktl.core.getKeywordsByType(viewId, kw);
            kwList.forEach(kwInstance => { execKw(kwInstance); })

            function execKw(kwInstance) {
                const options = kwInstance.options;
                if (!ktl.core.hasRoleAccess(options)) return;

                const params = kwInstance.params[0];
                if (params.length < 1) return;

                const style = params[0];

                $(`#${viewId} th.sorted-asc, #${viewId} th.sorted-desc`).each(function() {
                    const index = $(this).index();
                    $(`#${viewId} tbody tr:not(.kn-table-group)`).each(function() {
                        $(this).find('td').eq(index).attr('style', style);
                    });
                });
            }
        }

        function closeModalAndRefreshViews(viewId, keywords) {
            const kw = '_cmr';
            if (!(viewId && keywords && keywords[kw] && Knack.router.scene_view.model.attributes.modal)) return;

            let viewsToRefreshArray = [];

            if (keywords[kw].length && keywords[kw][0].params) {
                for (const viewToRefresh of keywords[kw][0].params[0]) {
                    const viewIdToRefresh = (viewToRefresh.startsWith('view_')) ? viewToRefresh : ktl.core.getViewIdByTitle(viewToRefresh, Knack.router.scene_view.model.attributes.parent, true);
                    viewsToRefreshArray.push(viewIdToRefresh);
                }
            } else {
                //All parent views.
                const viewsInScene = Knack.scenes._byId[Knack.router.scene_view.model.attributes.parent].views.models;
                for (const viewToRefresh of viewsInScene) {
                    viewsToRefreshArray.push(viewToRefresh.attributes.key);
                }
            }

            $(document).off(`knack-form-submit.${viewId}`).one(`knack-form-submit.${viewId}`, function (event, view, record) {
                Knack.closeModal();
                ktl.views.refreshViewArray(viewsToRefreshArray);
            });
        }

        //Views
        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.processViewKeywords && (processViewKeywords = cfgObj.processViewKeywords);
                cfgObj.handleCalendarEventDrop && (handleCalendarEventDrop = cfgObj.handleCalendarEventDrop);
                cfgObj.quickToggleParams && (quickToggleParams = cfgObj.quickToggleParams);
                cfgObj.handlePreprocessSubmitError && (handlePreprocessSubmitError = cfgObj.handlePreprocessSubmitError);

                if (cfgObj.headerAlignment !== undefined)
                    cfg.headerAlignment = cfgObj.headerAlignment;

                if (cfgObj.ktlFlashRate !== undefined) {
                    cfg.ktlFlashRate = cfgObj.ktlFlashRate;
                    document.documentElement.style.setProperty('--ktlFlashRate', cfg.ktlFlashRate);
                }
                if (cfgObj.ktlOutlineColor !== undefined) {
                    cfg.ktlOutlineColor = cfgObj.ktlOutlineColor;
                    document.documentElement.style.setProperty('--ktlOutlineColor', cfg.ktlOutlineColor);
                }

                cfgObj.hscCollapsedColumnsWidth && (cfg.hscCollapsedColumnsWidth = Math.max(Math.min(cfgObj.hscCollapsedColumnsWidth, 500), 0));
                cfgObj.hscGlobal && (cfg.hscGlobal = cfgObj.hscGlobal);
                cfgObj.hscAllowed && (cfg.hscAllowed = cfgObj.hscAllowed);
            },

            refreshView: function (viewId) {
                return new Promise(function (resolve) {
                    if (viewId) {
                        var res = $('#' + viewId);
                        if (res.length > 0) { //One last check if view is in the current scene, since user can change page quickly.
                            var view = Knack.router.scene_view.model.views._byId[viewId];
                            if (!view || !view.attributes)
                                return resolve();

                            var viewType = view.attributes.type;
                            var formAction = view.attributes.action;
                            var triggerChange = (formAction === 'insert' || formAction === 'create') ? false : true;

                            (function tryRefresh(retryCtr) {
                                if (view && ['search', 'form', 'rich_text', 'menu', 'calendar' /*more types?*/].includes(viewType)) {
                                    if (triggerChange) {
                                        Knack.views[viewId].model.trigger('change');
                                        Knack.views[viewId].renderForm && Knack.views[viewId].renderForm();
                                        Knack.views[viewId].renderView && Knack.views[viewId].renderView();
                                        Knack.views[viewId].renderResults && Knack.views[viewId].renderResults();
                                    }
                                    Knack.views[viewId].render();
                                    Knack.views[viewId].postRender && Knack.views[viewId].postRender(); //This is needed for menus.
                                    return resolve();
                                } else {
                                    Knack.views[viewId].model.fetch({
                                        success: function (model, response, options) {
                                            if (['details' /*more types?*/].includes(viewType)) {
                                                Knack.views[viewId].render();
                                                Knack.views[viewId].postRender && Knack.views[viewId].postRender();
                                            }

                                            setTimeout(() => {
                                                return resolve(model);
                                            }, 1);
                                        },
                                        error: function (model, response, options) {
                                            //console.log('refreshView error response =', response);
                                            //console.log('model =', model);
                                            //console.log('options =', options);

                                            response.caller = 'refreshView';
                                            response.viewId = viewId;

                                            //Process critical failures by forcing a logout or hard reset.
                                            if (response.status === 401 || response.status === 403 || response.status === 500)
                                                procRefreshViewSvrErr(response);
                                            else {
                                                if (ktlKeywords[viewId] && ktlKeywords[viewId]._ar)
                                                    return resolve(); //Just ignore, we'll try again shortly anyways.

                                                if (retryCtr-- > 0) {
                                                    var responseTxt = JSON.stringify(response);
                                                    ktl.log.clog('purple', 'refreshView error, response = ' + responseTxt + ' retry = ' + retryCtr);

                                                    setTimeout(function () {
                                                        tryRefresh(retryCtr);
                                                    }, 1000);
                                                } else
                                                    procRefreshViewSvrErr(response);
                                            }
                                        }
                                    });
                                }
                            })(10); //Retries

                            function procRefreshViewSvrErr(response) {
                                ktl.wndMsg.ktlProcessServerErrors({
                                    reason: 'REFRESH_VIEW_ERROR',
                                    status: response.status,
                                    statusText: response.statusText,
                                    caller: response.caller,
                                    viewId: response.viewId,
                                });

                                return resolve();
                            }
                        }
                    } else {
                        var callerInfo = ktl.views.refreshView.caller.toString().replace(/\s+/g, ' ');
                        ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1009 - Called refreshView with invalid parameter.  Caller info: ' + callerInfo);
                        resolve(); //Always resolve.
                    }
                });
            },

            refreshViewArray: function (viewsToRefresh) {
                return new Promise(function (resolve, reject) {
                    if (viewsToRefresh.length === 0) {
                        resolve();
                        clearTimeout(failsafe);
                        return;
                    } else {
                        var promisesArray = [];
                        viewsToRefresh.forEach(function (viewId) {
                            if (viewId.startsWith('view_')) {
                                promisesArray.push(
                                    ktl.views.refreshView(viewId)
                                        .then(() => {
                                            //ktl.log.clog('green', 'View refreshed successfully: ' + viewId);
                                        })
                                )
                            }
                        })

                        Promise.all(promisesArray)
                            .then(() => {
                                //ktl.log.clog('green', 'All views refreshed: ' + viewsToRefresh);
                                resolve();
                            })
                            .catch(() => {
                                ktl.log.clog('red', 'Error refreshing views: ' + viewsToRefresh);
                                reject()
                            })
                            .finally(() => { clearTimeout(failsafe); })
                    }

                    var failsafe = setTimeout(() => {
                        ktl.log.clog('red', 'Failsafe timeout in refreshViewArray: ' + viewsToRefresh);
                        reject();
                    }, 60000);
                })
            },

            //Parse the Knack object to find all views and start any applicable auto refresh interval timers for each, based on title.
            //Triggered when view title contains _ar=30 (for 30 seconds interval in this example).
            autoRefresh: function (run = true, autoRestart = true) {
                clearTimeout(unPauseTimer);
                if (run) {
                    if (!$.isEmptyObject(autoRefreshViews))
                        stopAutoRefresh(false); //Force a clean start.

                    Knack.router.scene_view.model.views.models.forEach(function (view) {
                        var viewId = view.id;
                        var keywords = ktlKeywords[viewId];
                        if (keywords && keywords._ar) {
                            var intervalDelay = 60;
                            if (keywords._ar.length)
                                intervalDelay = parseInt(keywords._ar[0].params[0]);
                            intervalDelay = isNaN(intervalDelay) ? 60 : intervalDelay;
                            intervalDelay = Math.max(Math.min(intervalDelay, 86400 /*One day*/), 5); //Restrain value between 5s and 24h.

                            //Add view to auto refresh list.
                            if (!(viewId in autoRefreshViews)) {
                                var intervalId = setInterval(function () {
                                    ktl.views.refreshView(viewId).then(function () { });
                                }, intervalDelay * 1000);

                                autoRefreshViews[viewId] = { delay: intervalDelay, intervalId: intervalId };
                            }
                        }
                    })
                    $('#' + PAUSE_REFRESH + '-label-id').css('background-color', '');
                } else
                    stopAutoRefresh();

                $('#' + PAUSE_REFRESH + '-id').prop('checked', !run);

                //Stop all auto refresh interval timers for all views.
                function stopAutoRefresh(restart = true) {
                    $('#' + PAUSE_REFRESH + '-label-id').css('background-color', 'red');
                    const views = Object.entries(autoRefreshViews);
                    if (views.length > 0) {
                        views.forEach(function (element) {
                            var intervalId = element[1].intervalId;
                            clearInterval(intervalId);
                        })

                        autoRefreshViews = {};

                        //Just in case the user forgets, automatically 'un-pause' autoRefresh after five minutes to re-enable it.
                        //If user is a power developer, leave off for one hour.
                        const unpauseDelay = (ktl.core.getCfg().developerNames.includes(Knack.getUserAttributes().name)) ? ONE_HOUR_DELAY : FIVE_MINUTES_DELAY;
                        if (restart && autoRestart) {
                            unPauseTimer = setTimeout(function () {
                                ktl.views.autoRefresh();
                            }, unpauseDelay)
                        }
                    }
                }
            },

            //Hide the whole view, typically used when doing background searches, or GET API calls.
            hideView: function (viewId, keywords) {
                const kw = '_hv';
                if (!(viewId && keywords && keywords[kw])) return;

                const keywordsArray = ktl.core.getKeywordsByType(viewId, kw);
                if (!keywordsArray.length)
                    $('#' + viewId).addClass('ktlHidden');
                else {
                    keywordsArray.forEach(keyword => {
                        if (!ktl.core.hasRoleAccess(keyword.options))
                            return;

                        const hide = () => { $('#' + viewId).addClass('ktlHidden'); }
                        const unhide = () => { $('#' + viewId).removeClass('ktlHidden'); }

                        ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide);
                    });
                }
            },

            removeView: function (viewId, keywords) {
                const kw = '_rv';
                if (!(viewId && keywords && keywords[kw])) return;

                const keywordsArray = ktl.core.getKeywordsByType(viewId, kw);
                if (!keywordsArray.length)
                    $('#' + viewId).remove();
                else {
                    keywordsArray.forEach(keyword => {
                        if (!ktl.core.hasRoleAccess(keyword.options))
                            return;

                        const hide = () => { $('#' + viewId).addClass('ktlHidden'); }
                        const unhide = () => {
                            $('#' + viewId).removeClass('ktlHidden');
                        }

                        ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide)
                            .then(() => { $('#' + viewId + '.ktlHidden').remove(); })
                    });
                }
            },

            addViewId: function (view, fontStyle = 'color: red; font-weight: bold; font-size:small') {
                if (!view) return;
                const viewId = view.key;

                if (ktl.userPrefs.getUserPrefs().showViewId && $('#' + viewId + '-label-id').length === 0/*Add once only*/) {
                    var label = document.createElement('label');
                    label.setAttribute('id', viewId + '-label-id');
                    label.appendChild(document.createTextNode('    ' + viewId));
                    label.setAttribute('style', 'margin-left: 10px; margin-top: 8px;' + fontStyle);

                    var submitBtn = $('#' + viewId + ' .kn-submit');
                    var divHdr = document.querySelector('#' + viewId + ' h1:not(#knack-logo), #' + viewId + ' h2, #' + viewId + ' h3, #' + viewId + ' h4');
                    if (divHdr) {
                        //console.log(viewId, 'divHdr =', divHdr, divHdr.innerText);

                        //If there's no title or no title text, let's try our best to get an elegant layout.
                        var divTitle = document.querySelector('#' + viewId + ' .kn-title')
                        if (divTitle) {
                            var display = window.getComputedStyle(divTitle).display;
                            //console.log(viewId, 'display =', display);
                            if (display && (display === 'none' || !divHdr.innerText)) {
                                if (submitBtn.length)
                                    submitBtn.append(label);
                                else
                                    $('#' + viewId + ' .view-header').append(label);
                            } else
                                $('#' + viewId + ' .kn-title').append(label);
                        } else {
                            //Why Search views don't show it the first render?
                            $('#' + viewId).append(label);
                        }
                    } else {
                        if (submitBtn.length) {
                            submitBtn.append(label);
                        } else if ($('.kn-form.kn-view' + '.' + viewId).length) {
                            $('.kn-form.kn-view' + '.' + viewId).append(label);
                        } else if ($('#' + viewId + ' .control').length) {
                            $('#' + viewId + ' .control').append(label);
                        } else if ($('.kn-details.kn-view' + '.' + viewId).length) {
                            $('.kn-details.kn-view' + '.' + viewId).append(label);
                        } else {
                            label.setAttribute('style', 'margin-top: 8px;' + fontStyle);
                            $('#' + viewId).prepend(label);
                        }
                    }
                } else {
                    if (!ktl.userPrefs.getUserPrefs().showViewId) {
                        $('#' + viewId + '-label-id').remove();
                    }
                }
            },

            //Required by Bulk Ops and Remove/Hide Columns features.
            //Restores proper cell alignment due to added groups and removed columns.
            fixTableRowsAlignment: function (viewId) {
                if (!viewId || document.querySelector('#' + viewId + ' tr.kn-tr-nodata')) return;

                if (ktl.bulkOps.getBulkOpsActive(viewId)) {
                    //For summary lines, prepend a space if Bulk Ops are enabled.
                    var viewObj = ktl.views.getViewObj(viewId);
                    if (!viewObj) return;

                    if (ktl.views.viewHasSummary(viewId)) {
                        var sel = '#' + viewId + ' tr.kn-table-totals';
                        ktl.core.waitSelector(sel, SUMMARY_WAIT_TIMEOUT) //Totals and groups usually need a bit of extra wait time due to delayed server response.
                            .then(function () {
                                var totalRows = $('#' + viewId + ' tr.kn-table-totals');
                                if (!$('#' + viewId + ' tr.kn-table-totals td')[0].classList.contains('blankCell')) {
                                    for (var i = totalRows.length - 1; i >= 0; i--) {
                                        var row = totalRows[i];
                                        $(row).prepend('<td class="blankCell" style="background-color: #eee; border-top: 1px solid #dadada;"></td>');
                                    }
                                    fixSummaryRows();
                                }
                            })
                            .catch(function (e) { ktl.log.clog('purple', 'fixTableRowsAlignment / hasSummary - failed waiting for table totals.', viewId, e); })
                    }

                    //For groups, extend line up to end.
                    var cols = viewObj.columns;
                    var groupingFound = false;
                    for (var i = 0; i < cols.length; i++) {
                        if (cols[i].grouping) {
                            groupingFound = true;
                            break;
                        }
                    }

                    if (groupingFound) {
                        var sel = '#' + viewId + ' tr.kn-table-group';
                        ktl.core.waitSelector(sel, SUMMARY_WAIT_TIMEOUT)
                            .then(function () {
                                $('#' + viewId + ' tr.kn-table-group').each(function () {
                                    $(this).find('td').attr('colspan', document.querySelectorAll('#' + viewId + ' thead th').length);
                                });
                            })
                            .catch(function (e) { ktl.log.clog('purple', 'Failed waiting for table groups.', viewId, e); })
                    }
                } else {
                    if (ktlKeywords[viewId] && (ktlKeywords[viewId]._hc || ktlKeywords[viewId]._rc))
                        fixSummaryRows();
                }

                //Alignment fix for Summary rows (totals).
                function fixSummaryRows() {
                    var headers = $('#' + viewId + ' thead tr th:visible').length;
                    var totals = $('#' + viewId + ' tr.kn-table-totals:first').children('td:not(.ktlDisplayNone)').length;

                    for (var j = 0; j < (totals - headers); j++) {
                        $('#' + viewId + ' .kn-table-totals td:last-child').remove();
                    }
                }
            },

            addTimeStampToHeader: function (viewId, keywords) {
                if (!viewId) return;

                const kw = '_ts';
                if (!(keywords && keywords[kw])) return;

                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                if ($('#' + viewId + '-timestamp-id').length === 0/*Add only once*/) {
                    var timestamp = document.createElement('label');
                    timestamp.setAttribute('id', viewId + '-timestamp-id');
                    timestamp.appendChild(document.createTextNode(ktl.core.getCurrentDateTime(false, true, false, false)));
                    timestamp.setAttribute('style', 'margin-left: 60px; color: blue; font-weight: bold;');

                    var submitBtn = $('#' + viewId + ' .kn-submit');
                    var divHdr = document.querySelector('#' + viewId + ' h1:not(#knack-logo), #' + viewId + ' h2, #' + viewId + ' h3, #' + viewId + ' h4');
                    if (divHdr) {
                        //console.log(viewId, 'divHdr =', divHdr, divHdr.innerText);

                        //If there's no title or no title text, let's try our best to get an elegant layout.
                        var divTitle = document.querySelector('#' + viewId + ' .kn-title')
                        if (divTitle) {
                            var display = window.getComputedStyle(divTitle).display;
                            //console.log(viewId, 'display =', display);
                            if (display && (display === 'none' || !divHdr.innerText)) {
                                if (submitBtn.length)
                                    submitBtn.append(timestamp);
                                else
                                    $('#' + viewId + ' .view-header').append(timestamp);
                            } else
                                $('#' + viewId + ' .kn-title').append(timestamp);
                        } else {
                            //Why Search views don't show it the first render?
                            $('#' + viewId).append(timestamp);
                        }
                    } else {
                        if (submitBtn.length) {
                            submitBtn.append(timestamp);
                        } else if ($('.kn-form.kn-view' + '.' + viewId).length) {
                            $('.kn-form.kn-view' + '.' + viewId).append(timestamp);
                        } else if ($('#' + viewId + ' .control').length) {
                            $('#' + viewId + ' .control').append(timestamp);
                        } else if ($('.kn-details.kn-view' + '.' + viewId).length) {
                            $('.kn-details.kn-view' + '.' + viewId).append(timestamp);
                        } else {
                            timestamp.setAttribute('style', 'margin-top: 8px;' + fontStyle);
                            $('#' + viewId).prepend(timestamp);
                        }
                    }
                }
            },

            addDateTimePickers: function (viewId = '', keywords) {
                const kw = '_dtp';
                if (!(viewId && keywords && keywords[kw])) return;

                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                var period = 'monthly';
                var inputType = 'month';

                //These two variables are always a Date object in Knack's default format: mm/dd/yyyy.
                var startDateUs = '';
                var endDateUs = '';

                //These two variables are always a string in the date picker's ISO format: yyyy-mm-dd.
                var startDateIso = '';
                var endDateIso = '';

                //The tables Date/Time field on which the filtering is applied.  Always the first one found from the left.
                var fieldId = '';
                var fieldName = '';

                //Find first Date/Time field type.
                var cols = Knack.router.scene_view.model.views._byId[viewId].attributes.columns;
                for (var i = 0; i < cols.length; i++) {
                    fieldId = cols[i].field && cols[i].field.key;
                    if (fieldId) {
                        var field = Knack.objects.getField(fieldId);
                        if (field && field.attributes && field.attributes.type === 'date_time') {
                            fieldName = field.attributes.name;
                            break;
                        }
                    }
                }

                if (!fieldId || !fieldName) {
                    ktl.core.timedPopup('This table doesn\'t have a Date/Time column.', 'warning', 4000);
                    return;
                }

                var div = document.createElement('div');

                //If Search exists, append at end to save space.
                if (document.querySelector('#' + viewId + ' .table-keyword-search')) {
                    document.querySelector('#' + viewId + ' .table-keyword-search').appendChild(div);
                    div.style.marginLeft = '100px';
                } else {
                    ktl.core.insertAfter(div, document.querySelector('#' + viewId + ' .view-header'));
                    div.style.marginTop = '15px';
                    div.style.marginBottom = '15px';
                }

                var viewDates = ktl.views.loadViewDates(viewId);
                if (!viewDates.startDt) {
                    startDateUs = new Date(); //Nothing yet for this view, use "now".
                    endDateUs = ktl.core.getLastDayOfMonth(startDateUs);
                } else {
                    startDateUs = new Date(viewDates.startDt);
                    viewDates.period && (period = viewDates.period);
                    endDateUs = new Date(viewDates.endDt);
                }

                startDateIso = ktl.core.convertDateToIso(startDateUs, period);
                endDateIso = ktl.core.convertDateToIso(endDateUs, period);

                inputType = periodToInputType(period);

                var startDateInput = ktl.fields.addInput(div, 'From', inputType, startDateIso, 'startDateInput', 'width: 140px; height: 25px;');
                var endDateInput = ktl.fields.addInput(div, 'To', inputType, endDateIso, 'endDateInput', 'width: 140px; height: 25px;');
                var periodMonthly = ktl.fields.addRadioButton(div, 'Monthly', 'PERIOD', 'monthly', 'monthly');
                var periodWeekly = ktl.fields.addRadioButton(div, 'Weekly', 'PERIOD', 'weekly', 'weekly');
                var periodDaily = ktl.fields.addRadioButton(div, 'Daily', 'PERIOD', 'daily', 'daily');

                document.querySelector('#' + period).checked = true;

                startDateInput.value = startDateIso;
                endDateInput.value = endDateIso;

                if (endDateUs < startDateUs)
                    document.querySelector('#endDateInput').classList.add('ktlNotValid');

                /* This code was an attempt to allow using the keyboard up/down arrows to properly scroll through dates, but it doesn't work well.
                 * It only increases the day (in date type), or month (in month type), but the year can't be changed.
                 * We'd have to split the d/m/y into separate inputs and control each separately depending on focus.
                 *
                startDateInput.addEventListener('keydown', (e) => { processDtpKeydown(e); })
                endDateInput.addEventListener('keydown', (e) => { processDtpKeydown(e); })
                function processDtpKeydown(e) {
                    if (e.target.id !== 'startDateInput' && e.target.id !== 'endDateInput') return;
                    if (e.code === 'ArrowDown') {
                        e.preventDefault();
                        document.querySelector('#' + e.target.id).stepDown();
                        document.querySelector('#' + e.target.id).dispatchEvent(new Event('change'));
                    } else if (e.code === 'ArrowUp') {
                        e.preventDefault();
                        document.querySelector('#' + e.target.id).stepUp();
                        document.querySelector('#' + e.target.id).dispatchEvent(new Event('change'));
                    }
                }
                */

                startDateInput.addEventListener('change', (e) => {
                    var sd = e.target.value.replaceAll('-', '/');
                    startDateUs = new Date(sd);
                    adjustEndDate(period);

                    endDateInput.value = ktl.core.convertDateToIso(endDateUs, period);
                    ktl.views.saveViewDates(
                        viewId,
                        ktl.core.convertDateTimeToString(startDateUs, false, true),
                        ktl.core.convertDateTimeToString(endDateUs, false, true),
                        period);
                    updatePeriodFilter(startDateUs, endDateUs);
                })

                endDateInput.addEventListener('change', (e) => {
                    endDateUs = new Date(e.target.value.replace(/-/g, '/'));

                    ktl.views.saveViewDates(
                        viewId,
                        ktl.core.convertDateTimeToString(startDateUs, false, true),
                        ktl.core.convertDateTimeToString(endDateUs, false, true),
                        period);

                    updatePeriodFilter(startDateUs, endDateUs);
                })

                startDateInput.onfocus = (e) => { currentFocus = '#startDateInput'; }
                endDateInput.onfocus = (e) => { currentFocus = '#endDateInput'; }
                if (currentFocus) {
                    document.querySelector(currentFocus).focus();
                } else
                    startDateInput.focus();

                function adjustEndDate(period) {
                    if (period === 'monthly')
                        endDateUs = ktl.core.getLastDayOfMonth(startDateUs);
                    else if (period === 'weekly') {
                        endDateUs = new Date(startDateUs);
                        endDateUs.setDate(endDateUs.getDate() + 6);
                    } else if (period === 'daily')
                        endDateUs = new Date(startDateUs);
                }

                periodMonthly.addEventListener('click', e => { updatePeriod(e); });
                periodWeekly.addEventListener('click', e => { updatePeriod(e); });
                periodDaily.addEventListener('click', e => { updatePeriod(e); });

                function updatePeriod(e) {
                    period = e.target.defaultValue;
                    inputType = periodToInputType(period);
                    document.querySelector('#startDateInput').type = inputType;
                    document.querySelector('#endDateInput').type = inputType;
                    adjustEndDate(period);
                    ktl.views.saveViewDates(
                        viewId,
                        ktl.core.convertDateTimeToString(startDateUs, false, true),
                        ktl.core.convertDateTimeToString(endDateUs, false, true),
                        period);
                    updatePeriodFilter(startDateUs, endDateUs);
                }

                function periodToInputType(period) {
                    var inputType = 'month';
                    if (period !== 'monthly')
                        inputType = 'date';
                    return inputType;
                }

                function updatePeriodFilter(startDateUs, endDateUs) {
                    Knack.showSpinner();

                    //Merge current filter with new one, if possible, i.e. using the AND operator.
                    var currentFilters = Knack.views[viewId].getFilters();
                    var curRules = [];
                    var foundAnd = true;
                    if (!$.isEmptyObject(currentFilters)) {
                        //Sometimes, the filters have a rules key, but not always.
                        //If not, then the object itself is the array that contain the rules.
                        var rules;
                        if (currentFilters.rules && currentFilters.rules.length > 0)
                            rules = currentFilters.rules;
                        else if (currentFilters.length > 0)
                            rules = currentFilters;

                        if (rules) {
                            rules.forEach(rule => {
                                if (rule.match && rule.match === 'or')
                                    foundAnd = false;

                                if (rule.field !== fieldId)
                                    curRules.push(rule);
                            })
                        }
                    }

                    if (!foundAnd) {
                        Knack.hideSpinner();
                        alert('Current filter contains the OR operator. Date pickers only work with AND.');
                        return;
                    }

                    //Must adjust end date due to "is before" nature of date filter.
                    startDateUs.setDate(startDateUs.getDate() - 1);

                    if (period === 'monthly')
                        endDateUs = new Date(endDateUs.getFullYear(), endDateUs.getMonth() + 1);
                    else
                        endDateUs.setDate(endDateUs.getDate() + 1);

                    startDateUs = ktl.core.convertDateTimeToString(startDateUs, false, true);
                    endDateUs = ktl.core.convertDateTimeToString(endDateUs, false, true);

                    var filterRules = [
                        {
                            "field": fieldId,
                            "operator": "is after",
                            "value": {
                                "date": startDateUs,
                                "time": ""
                            },
                            "field_name": fieldName
                        },
                        {
                            "match": "and",
                            "field": fieldId,
                            "operator": "is before",
                            "value": {
                                "date": endDateUs,
                                "time": ""
                            },
                            "field_name": fieldName
                        }
                    ];

                    var filterObj = {
                        "match": "and",
                        "rules": filterRules.concat(curRules)
                    }

                    const sceneHash = Knack.getSceneHash();
                    const queryString = Knack.getQueryString({ [`${viewId}_filters`]: encodeURIComponent(JSON.stringify(filterObj)) });
                    Knack.router.navigate(`${sceneHash}?${queryString}`, false);
                    Knack.setHashVars();
                    Knack.models[viewId].setFilters(filterObj);
                    Knack.models[viewId].fetch({
                        success: () => { Knack.hideSpinner(); },
                        error: () => { Knack.hideSpinner(); }
                    });
                }
            },

            saveViewDates: function (viewId = '', startDt = '', endDt = '', period = 'monthly') {
                if (!viewId || (!startDt && !endDt)) return;

                var viewDates = {};
                var viewDatesStr = ktl.storage.lsGetItem(ktl.const.LS_VIEW_DATES);
                if (viewDatesStr) {
                    try {
                        viewDates = JSON.parse(viewDatesStr);
                    }
                    catch (e) {
                        console.log('Error parsing view dates.', e);
                        return;
                    }
                };

                viewDates[viewId] = { startDt: startDt, endDt: endDt, period: period };
                ktl.storage.lsSetItem(ktl.const.LS_VIEW_DATES, JSON.stringify(viewDates));
            },

            loadViewDates: function (viewId = '') {
                if (!viewId) return {};

                var startDt = '';
                var endDt = '';

                var viewDates = ktl.storage.lsGetItem(ktl.const.LS_VIEW_DATES);
                if (viewDates) {
                    try {
                        viewDates = JSON.parse(viewDates);
                        startDt = viewDates[viewId].startDt;
                        endDt = viewDates[viewId].endDt;
                        period = viewDates[viewId].period;
                    } catch (e) {
                        console.log('Error parsing report period', e);
                    }
                } else
                    return {};

                return { startDt: startDt, endDt: endDt, period: period };
            },

            hideField: function (fieldId) {
                $('#kn-input-' + fieldId).addClass('ktlHidden');
            },

            // srchTxt: string to find, must be non-empty.
            // fieldId:  'field_xyz' that is a chzn dropdown.
            // onlyExactMatch: if true, only the exact match is returned.  False will return all options containing text.
            //    -> Typically used when scanning a barcode.  When manual entry, user wants to view results and choose.
            // showPopup: True will show a 2-second confirmation message, found or not found.
            // viewId: 'view_xyz' is used for Search Views, and optional for others.  If left empty, the first found field is used.
            searchDropdown: function (srchTxt = '', fieldId = '', onlyExactMatch = true, showPopup = true, viewId = '', pfSaveForm = true) {
                return new Promise(function (resolve, reject) {
                    if (!srchTxt || !fieldId) {
                        reject('Empty parameters');
                        return;
                    }

                    if (dropdownSearching[fieldId])
                        return; //Exit if a search is already in progress for this field.

                    dropdownSearching[fieldId] = fieldId;

                    //If we're editing a cell, then it becomes our view by default and ignore viewId parameter.
                    //If viewId not specified, find first fieldId in page.
                    var viewSel = document.activeElement.closest('#cell-editor') ? '#cell-editor ' : ''; //Support inline editing.
                    if (!viewId) {
                        viewId = document.activeElement.closest('.kn-view');
                        viewId && (viewId = viewId.id);
                    }

                    viewSel = viewId ? '#' + viewId + ' ' : viewSel;
                    var dropdownObj = $(viewSel + '[name="' + fieldId + '"].select');

                    if (dropdownObj.length) {
                        //Multiple choice (hard coded entries) drop downs. Ex: Work Shifts
                        var isMultipleChoice = $(viewSel + '[data-input-id="' + fieldId + '"].kn-input-multiple_choice').length > 0 ? true : false;
                        var isSingleSelection = $(viewSel + '[id$="' + fieldId + '_chzn"].chzn-container-single').length > 0 ? true : false;
                        var chznSearchInput = $(viewSel + '[id$="' + fieldId + '_chzn"].chzn-container input').first();
                        var chznContainer = $(viewSel + '[id$="' + fieldId + '_chzn"].chzn-container');

                        //If the dropdown has a search field, trigger a search on the requested text now.
                        if ($(viewSel + '[id$="' + fieldId + '_chzn"] .ui-autocomplete-input').length > 0) {
                            chznSearchInput.focus();
                            chznSearchInput.autocomplete('search', srchTxt); //GO!
                            //Wait for response...
                        } else {
                            //The dropdown does not have a search field (less than 500 entries), just select among the options that are already populated.
                        }

                        var foundText = '';
                        var lowercaseSrch = srchTxt.toString().toLowerCase();
                        Knack.showSpinner();

                        var searchTimeout = null;
                        var intervalId = setInterval(function () {
                            if (!$('.ui-autocomplete-loading').is(':visible')) {
                                clearInterval(intervalId);
                                clearTimeout(searchTimeout);

                                if (isSingleSelection || isMultipleChoice) {
                                    //The dropdown has finished searching and came up with some results, but we must now
                                    //filter them to exclude any found elements that are not an exact match (whole word only).
                                    //Otherwise, we may end up with wrong results.
                                    //Ex: Typing 1234 could select 12345 if it was part of the results and before 1234.

                                    var id = '';
                                    waitForOptions(dropdownObj)
                                        .then((options) => {
                                            var foundExactMatch = false;
                                            if (options.length > 0) {
                                                var text = '';
                                                for (var i = 0; i < options.length; i++) {
                                                    text = options[i].innerText;
                                                    if (text !== 'Select...' && text !== 'Select') {
                                                        if (text.toLowerCase() === lowercaseSrch) { //Exact match, but not case sensitive.
                                                            foundExactMatch = true;
                                                            foundText = text;
                                                            id = options[i].value;
                                                            if (isMultipleChoice)
                                                                dropdownObj.find('option[value="' + id + '"]').attr('selected', 1);
                                                            else
                                                                dropdownObj.val(id);
                                                            dropdownObj.trigger('liszt:updated');
                                                            break;
                                                        } else if (!foundExactMatch && text.toLowerCase().indexOf(lowercaseSrch) >= 0) { //Partial match
                                                            foundText = text;
                                                        }
                                                    }
                                                }
                                            }

                                            Knack.hideSpinner();

                                            if (foundText) { //Found something.  Is it an exact match or multiple options?
                                                if (foundExactMatch) {
                                                    if (showPopup)
                                                        ktl.core.timedPopup('Found ' + foundText);

                                                    if (pfSaveForm)
                                                        dropdownObj.trigger('change'); //Required to save persistent form data.

                                                    if (chznContainer.length) {
                                                        $(chznContainer).find('.chzn-drop').css('left', '-9000px');
                                                        ktl.scenes.autoFocus();
                                                    }
                                                } else { //Multiple options.
                                                    if (onlyExactMatch) {
                                                        ktl.core.timedPopup('Could Not Find ' + srchTxt, 'error', 3000);
                                                        delete dropdownSearching[fieldId];
                                                        reject(foundText);
                                                        return;
                                                    }
                                                }

                                                delete dropdownSearching[fieldId];
                                                resolve(foundText);
                                                return;
                                            } else { //Nothing found.
                                                if (showPopup)
                                                    ktl.core.timedPopup('Could Not Find ' + srchTxt, 'error', 3000);

                                                if (onlyExactMatch) {
                                                    if (chznContainer.length) {
                                                        $(chznContainer).find('.chzn-drop').css('left', '-9000px');
                                                        ktl.scenes.autoFocus();
                                                    }
                                                }

                                                delete dropdownSearching[fieldId];
                                                reject(foundText);
                                                return;
                                            }
                                        })
                                        .catch(() => {
                                            delete dropdownSearching[fieldId];
                                            reject('No results!');
                                        })
                                } else { //Multi selection
                                    if (chznContainer.length) {
                                        chznContainer.find('.chzn-drop').css('left', '-9000px'); //Hide results until parsed.

                                        //A bit more time is required to let the found results to settle.
                                        var update = false;
                                        var results = chznContainer.find('.chzn-results li');
                                        var initialResults = results.length;

                                        setTimeout(function () {
                                            update = true;
                                        }, 1000);

                                        intervalId = setInterval(function () {
                                            results = chznContainer.find('.chzn-results li');
                                            if (update || initialResults !== results.length) { //Whichever comes first.
                                                clearInterval(intervalId);
                                                clearTimeout(searchTimeout);

                                                if (results.length > 0) {
                                                    var foundAtLeastOne = false;
                                                    chznContainer.find('.chzn-drop').css('left', ''); //Put back, since was moved to -9000px.
                                                    results.each(function () { //replace by for loop
                                                        if (results.length <= 500) {
                                                            $(this).addClass('kn-button');
                                                            $(this).css('border-color', 'black');

                                                            if (results.length === 1) {
                                                                if ($(this).hasClass('no-results')) {
                                                                    //Use addClass instead and let CSS do the job.
                                                                    $(this).css({ 'background-color': 'lightpink', 'padding-top': '8px' });
                                                                    $(this).css('display', 'list-item');
                                                                    ktl.core.timedPopup(srchTxt + ' not Found', 'error', 3000);
                                                                    ktl.fields.ktlChznBetterSetFocus();
                                                                } else {
                                                                    var tmpText = $(this)[0].innerText;
                                                                    //For some reason, if there's only one current entry under ul class "chzn-choices", we need to exclude that one.
                                                                    if ($(viewSel + '[id$="' + fieldId + '_chzn_c_0"]')[0].innerText !== tmpText) {
                                                                        $(this).css({ 'background-color': 'lightgreen', 'padding-top': '8px' });
                                                                        $(this).css('display', 'list-item');
                                                                        foundAtLeastOne = true;
                                                                    }
                                                                }
                                                            } else {
                                                                //Here, we may have a partial or exact match, or even no match at all.
                                                                var text = $(this).text();
                                                                if (text.toLowerCase() === lowercaseSrch) { //Exact match
                                                                    $(this).css({ 'background-color': 'lightgreen', 'padding-top': '8px' });
                                                                    $(this).css('display', 'list-item');
                                                                    foundAtLeastOne = true;
                                                                } else if (text.toLowerCase().indexOf(lowercaseSrch) >= 0 && $(this).hasClass('active-result')) { //Partial match
                                                                    $(this).css({ 'background-color': '', 'padding-top': '8px' });
                                                                    $(this).css('display', 'list-item');
                                                                    foundAtLeastOne = true;
                                                                } else
                                                                    $(this).css('display', 'none'); //No match
                                                            }
                                                        }
                                                    })

                                                    chznContainer.find('.chzn-drop').css('left', ''); //Put back, since was moved to -9000px.
                                                    Knack.hideSpinner();
                                                    chznContainer.focus(); //Allow using up/down arrows to select result and press enter.

                                                    if (!foundAtLeastOne) {
                                                        ktl.core.timedPopup(srchTxt + ' not Found', 'error', 3000);
                                                        // $('.ui-autocomplete-input').val('');
                                                        // $('#chznBetter').val('');
                                                        // document.activeElement.blur();
                                                        //ktl.fields.ktlChznBetterSetFocus();
                                                    }
                                                } else {
                                                    Knack.hideSpinner();
                                                    ktl.core.timedPopup(srchTxt + ' not Found', 'error', 3000);
                                                    ktl.fields.ktlChznBetterSetFocus();
                                                }

                                                //autoFocus(); <- Leave out in this case!
                                                //...User input is required with a physical click, otherwise the existing entry is replaced by new for some reason.
                                            }
                                        }, 200);
                                    }
                                }
                            }
                        }, 200);

                        searchTimeout = setTimeout(function () { //Failsafe
                            Knack.hideSpinner();
                            clearInterval(intervalId);
                            delete dropdownSearching[fieldId];
                            reject(foundText);
                            return; //JIC
                        }, 5000);
                    } else {
                        //ktl.log.clog('purple, 'Called searchDropdown with a field that does not exist: ' + fieldId);
                    }

                    function waitForOptions(dropdownObj) {
                        return new Promise(function (resolve, reject) {
                            var options = [];
                            var intervalId = setInterval(() => {
                                options = dropdownObj.find('option');
                                if (options.length) {
                                    clearInterval(intervalId);
                                    clearTimeout(failsafe);
                                    resolve(options);
                                    return;
                                }
                            }, 200);

                            var failsafe = setTimeout(function () {
                                ktl.log.clog('purple', 'waitForOptions timeout');
                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1021 - waitForOptions timeout: ' + Knack.scene_hash.replace(/[/\/#]+/g, '') + ', ' + dropdownObj[0].id);
                                clearInterval(intervalId);
                                reject(foundText);
                                return; //JIC
                            }, 25000);
                        })
                    }
                });
            },

            //Uses a Search view to find existing text.
            //Must have a single text input for a field, with exact match.
            //Also works with the generic 'Keyword Search' field, but its risky to miss if more than 100 results.
            //Does not work for a connected field using a dropdown (use ktl.views.searchDropdown if you need this).
            //Always perform an exact match
            //Set display results to 100 items and set sort order to maximize chances of finding target sooner.
            //fieldToCompare must not contain _RAW, as the code will automatically detect this.
            findInSearchView: function (textToFind = '', viewId = '', fieldToCompare = '') {
                return new Promise(function (resolve, reject) {
                    var foundData = {};
                    if (textToFind && viewId) {
                        var searchInput = document.querySelector('#' + viewId + ' .kn-keyword-search') || document.querySelector('#' + viewId + ' .kn-search-filter input');
                        if (searchInput) {
                            searchInput.value = textToFind;
                            $('#' + viewId + ' > form').submit();
                            $(document).on('knack-view-render.' + viewId, function (event, view, data) {
                                for (var i = 0; i < data.length; i++) {
                                    if (data[i][fieldToCompare] == textToFind //Do not use === so we can legitimately compare text with numbers.
                                        || (Array.isArray(data[i][fieldToCompare + '_raw']) && data[i][fieldToCompare + '_raw'].length && data[i][fieldToCompare + '_raw'][0].identifier == textToFind)) //When field_XXX_raw type is used with a connection.
                                    {
                                        foundData = data[i];
                                        break;
                                    }
                                }
                                $(document).off('knack-view-render.' + viewId); //Prevent multiple re-entry.

                                resolve(foundData);
                                return;
                            });
                        } else
                            reject('findInSearchView has null searchInput');
                    } else
                        resolve(foundData);
                })
            },

            /*//////////////////////////////////////////////////////////////////
            Hides any table's columns.

            Input parameters:
                - viewId: must be a view.key string, ex: 'view_123'
                - fields: must be an array of strings of field ids.
                - headers: must be an array of strings of column headers.
            */
            //////////////////////////////////////////////////////////////////
            hideTableColumns: function (viewId = '', fields = [], headers = []) {
                if (!viewId) {
                    ktl.log.clog('purple', 'Called hideTableColumns with invalid parameters.');
                    return;
                }

                if (!fields.length && !headers.length)
                    return;

                const view = Knack.views[viewId];
                view.model.view.columns.forEach(col => {
                    const header = col.header.trim();
                    if (headers.includes(header) || fields.includes(col.id)) {
                        const thead = $('#' + viewId + ' thead tr th:textEquals("' + header + '")');
                        if (thead.length) {
                            var cellIndex = thead[0].cellIndex;
                            thead[0].classList.add('ktlDisplayNone');
                            $('#' + viewId + ' tbody tr td:nth-child(' + (cellIndex + 1) + ')').addClass('ktlDisplayNone');
                        }
                    }
                });

                ktl.views.fixTableRowsAlignment(viewId);
            },

            /*//////////////////////////////////////////////////////////////////
            Unhides any table's columns.

            Input parameters:
                - viewId: must be a view.key string, ex: 'view_123'
                - fields: must be an array of strings of field ids.
                - headers: must be an array of strings of column headers.
            */
            //////////////////////////////////////////////////////////////////
            unhideTableColumns: function (viewId = '', fields = [], headers = []) {
                if (!viewId) {
                    ktl.log.clog('purple', 'Called unhideTableColumns with invalid parameters.');
                    return;
                }

                if (!fields.length && !headers.length)
                    return;

                const view = Knack.views[viewId];
                view.model.view.columns.forEach(col => {
                    const header = col.header.trim();
                    if (headers.includes(header) || fields.includes(col.id)) {
                        const thead = $('#' + viewId + ' thead tr th:textEquals("' + header + '")');
                        if (thead.length) {
                            var cellIndex = thead[0].cellIndex;
                            thead[0].classList.remove('ktlDisplayNone');
                            $('#' + viewId + ' tbody tr td:nth-child(' + (cellIndex + 1) + ')').removeClass('ktlDisplayNone');
                        }
                    }
                });

                ktl.views.fixTableRowsAlignment(viewId);
            },

            /*//////////////////////////////////////////////////////////////////
            Removes any table's columns, including those with Action, Edit and Delete.

            Input parameters:
                - viewId: must be a view.key string, ex: 'view_123'
                - fields: must be an array of strings of field ids.
                - headers: must be an array of strings of column headers.
            */
            //////////////////////////////////////////////////////////////////
            removeTableColumns: function (viewId = '', fields = [], headers = []) {
                if (typeof fields === "boolean")
                    return ktl.views.removeTableColumnsDeprecated(...arguments);

                if (!viewId) {
                    ktl.log.clog('purple', 'Called removeTableColumns with invalid parameters.');
                    return;
                }

                if (!fields.length && !headers.length)
                    return;

                const view = Knack.views[viewId];
                const columns = view.model.view.columns;
                for (var i = columns.length - 1; i >= 0; i--) {
                    var column = columns[i];
                    var header = column.header.trim();
                    if (headers.includes(header) || fields.includes(column.id)) {
                        var thead = $('#' + viewId + ' thead tr th:textEquals("' + header + '")');
                        if (thead.length) {
                            var cellIndex = thead[0].cellIndex;
                            thead.remove();
                            $('#' + viewId + ' tbody tr td:nth-child(' + (cellIndex + 1) + ')').remove();
                            columns.splice(i, 1);
                        }
                    }
                }

                ktl.views.fixTableRowsAlignment(viewId);
            },

            /*//////////////////////////////////////////////////////////////////
            Removes any table's columns by index, including those with Action, Edit and Delete.

            Input parameters:
                - viewId: must be a view.key string, ex: 'view_123'
                - columnsArray: must be an array of 1-based integers, ex: [5, 2, 1] to remove 1st, 2nd and 5th columns.  Order MUST be decreasing.
            */
            //////////////////////////////////////////////////////////////////
            removeTableColumnsByIndex: function (viewId = '', columnIndexes = []) {
                if (!viewId) {
                    ktl.log.clog('purple', 'Called removeTableColumnsByIndex with invalid parameters.');
                    return;
                }

                if (!columnIndexes.length)
                    return;

                const view = Knack.views[viewId];
                const columns = view.model.view.columns;
                for (var i = columns.length - 1; i >= 0; i--) {
                    var col = columns[i];
                    var header = col.header.trim();
                    if (columnIndexes.includes(i + 1)) {
                        var thead = $('#' + viewId + ' thead tr th:textEquals("' + header + '")');
                        if (thead.length) {
                            var cellIndex = thead[0].cellIndex;
                            thead.remove();
                            $('#' + viewId + ' tbody tr td:nth-child(' + (cellIndex + 1) + ')').remove();
                            columns.splice(i, 1);
                        }
                    }
                }

                ktl.views.fixTableRowsAlignment(viewId);
            },

            /*//////////////////////////////////////////////////////////////////
            !!! Deprecated
            Removes or hides any table's columns, including those
            with Action, Edit and Delete.

            Input parameters:

                - viewId: must be a view.key string, ex: 'view_123'
                - remove: true removes elements from DOM, false only hides them.  Useful to hide them when you need to access data, but not secure.
                - columnsArray: must be an array of 1-based integers, ex: [5, 2, 1] to remove 1st, 2nd and 5th columns.  Order MUST be decreasing.
                - fieldsArray: must be an array of strings, ex: ['field_XXX', 'field_YYY'].  Order is not important.

                You may use both arrays at same time, but columnsArray has precedence.
            */
            //////////////////////////////////////////////////////////////////
            removeTableColumnsDeprecated: function (viewId = '', remove = true, columnsAr = [], fieldsAr = [], headersAr = []) {
                console.warn('Deprecated function call. Update to use removeTableColumns(viewId, fields, headers or hideTableColumns(viewId, fields, headers) or removeTableColumnsByIndex(viewId, columnIndexes)')
                if (!viewId ||
                    ((fieldsAr && fieldsAr.length === 0) && (columnsAr && columnsAr.length === 0)) && (headersAr && headersAr.length === 0)) {
                    ktl.log.clog('purple', 'Called removeTableColumnsDeprecated with invalid parameters.');
                    return;
                }

                //console.log('columnsArray =', columnsArray);
                //console.log('fieldsArray =', fieldsArray);
                //console.log('headersAr =', headersAr);
                var view = Knack.views[viewId];
                var columns = view.model.view.columns;
                for (var i = columns.length - 1; i >= 0; i--) {
                    var col = columns[i];
                    var header = col.header.trim();
                    if (headersAr.includes(header) || columnsAr.includes(i + 1) || fieldsAr.includes(col.id)) {
                        var thead = $('#' + viewId + ' thead tr th:textEquals("' + header + '")');
                        if (thead.length) {
                            var cellIndex = thead[0].cellIndex;
                            if (remove) {
                                thead.remove();
                                $('#' + viewId + ' tbody tr td:nth-child(' + (cellIndex + 1) + ')').remove();
                                columns.splice(i, 1);
                            } else {
                                thead[0].classList.add('ktlDisplayNone');
                                $('#' + viewId + ' tbody tr td:nth-child(' + (cellIndex + 1) + ')').addClass('ktlDisplayNone');
                            }
                        }
                    }
                }

                ktl.views.fixTableRowsAlignment(viewId);
            },

            //Pass a list of field IDs and returns the first found.
            findFirstExistingField: function (fieldArray = []) {
                if (fieldArray.length === 0)
                    return '';

                try {
                    var fieldId = '';
                    for (var i = 0; i < fieldArray.length; i++) {
                        fieldId = $('[name=' + fieldArray[i] + ']');
                        if (fieldId.length) {
                            var knInput = fieldId[0].closest('.kn-input');
                            if (knInput) {
                                fieldId = knInput.getAttribute('data-input-id');
                                return fieldId;
                            }
                        }
                    }
                    return '';
                } catch (e) {
                    return '';
                }
            },

            //When a table is rendered, pass its data to this function along with the field and a value to search.
            //It returns the first record found, or undefined if nothing is found.
            findRecord: function (data = [], fieldId = '', value = '') {
                if (!data.length || !fieldId || !value) return;
                for (var i = 0; i < data.length; i++) {
                    if (data[i][fieldId] === value)
                        return data[i];
                }
            },

            //This is used in a Search view, where you pass the viewId and value to be searched.
            //The fieldId is used to set the value in the proper input field, when more than one.
            //Resolves with an array of data records found.
            searchRecordByValue: function (viewId, fieldId, value) {
                return new Promise(function (resolve, reject) {
                    if (!value || !fieldId || !viewId) {
                        reject('Called searchRecordByValue with invalid parameters.');
                    } else {
                        if (viewId === '_uvx') {
                            var uvxViewId = ktl.scenes.findViewWithKeyword('_uvx', viewId);
                            if (uvxViewId) {
                                $('#' + uvxViewId + ' input').val(''); //Clear all inputs.
                                var field = Knack.objects.getField(fieldId);
                                var fieldName = field.attributes.name;
                                var srchFields = $('#' + uvxViewId + ' .kn-search-filter').find('.kn-label:contains("' + fieldName + '")').parent().find('input');
                                srchFields.val(value);
                                $('#' + uvxViewId + ' .kn-button.is-primary').click();
                                $(document).on('knack-view-render.' + uvxViewId, function (event, view, data) {
                                    $(document).off('knack-view-render.' + uvxViewId);
                                    resolve(data);
                                    return;
                                })
                            }
                        } else if (viewId === '_uvc') {
                            var uvcViewId = ktl.scenes.findViewWithKeyword('_uvc', viewId);
                            if (uvcViewId) {
                                $('#' + uvcViewId + ' input').val(''); //Clear all inputs.
                                var field = Knack.objects.getField(fieldId);
                                var fieldName = field.attributes.name;
                                var srchFields = $('#' + uvcViewId + ' .kn-search-filter').find('.kn-label:contains("' + fieldName + '")').parent().find('input');
                                srchFields.val(value);
                                $('#' + uvcViewId + ' .kn-button.is-primary').click();
                                $(document).on('knack-view-render.' + uvcViewId, function (event, view, data) {
                                    $(document).off('knack-view-render.' + uvcViewId);
                                    resolve(data);
                                    return;
                                })
                            }
                        } else
                            resolve([]);
                    }
                })
            },

            //For KTL internal use.
            processFieldKeywords: function (viewId, fieldId, keywords, e) {
                return new Promise(function (resolve, reject) {
                    if (!viewId || !fieldId) {
                        reject('Called processFieldKeywords with invalid parameters.');
                        return;
                    } else {
                        var outcomeObj = { msg: '' };

                        //Unique Value Exceptions _uvx
                        if (keywords._uvx && keywords._uvx[0].params[0].length) {
                            e.preventDefault();

                            const viewType = ktl.views.getViewType(viewId);
                            var field = Knack.objects.getField(fieldId);
                            var fieldName = field.attributes.name;
                            var fieldValue = $('#' + viewId + ' #' + fieldId).val();
                            if (viewType === 'search' || !fieldValue || fieldValue === '' || (fieldValue !== '' && keywords._uvx[0].params[0].includes(fieldValue.toLowerCase()))) {
                                resolve(outcomeObj);
                                return;
                            }

                            ktl.views.searchRecordByValue('_uvx', fieldId, fieldValue)
                                .then(foundRecords => {
                                    if (foundRecords.length) {
                                        if (!outcomeObj.msg)
                                            outcomeObj.msg = 'Error:\n';

                                        outcomeObj.msg += fieldName + ' ' + fieldValue + ' already exists\n';
                                    }
                                    resolve(outcomeObj);
                                    return;
                                })
                                .catch(err => { reject(err); })
                        } else
                            resolve(outcomeObj);
                    }
                })
            },

            //For KTL internal use.
            preprocessSubmit: function (viewId, e) {
                if (!viewId) return;

                const view = Knack.router.scene_view.model.views._byId[viewId];
                if (!view) return;

                const viewType = view.attributes.type;
                if (viewType !== 'form')
                    return;

                $('#' + viewId + ' .kn-form-confirmation').css('display', 'none');
                $('#' + viewId + ' input').removeClass('input-error');
                $('.kn-message.is-error').remove();

                preprocessFields(viewId, e)
                    .then(() => {
                        preprocessViews(viewId, e)
                            .then(() => {
                                $('#' + viewId + ' form').submit();
                                //$(e.target).click();
                            })
                            .catch(outcomeObj => {
                                ktlHandlePreprocessSubmitError(outcomeObj);
                            })
                    })
                    .catch(outcomeObj => {
                        ktlHandlePreprocessSubmitError(outcomeObj);
                    })

                function ktlHandlePreprocessSubmitError(outcomeObj) {
                    outcomeObj.msg && ktl.core.showKnackStyleMessage(viewId, 'KTL Error: ' + outcomeObj.msg, 'error');
                    setTimeout(() => {
                        handlePreprocessSubmitError && handlePreprocessSubmitError(viewId, outcomeObj);
                    }, 100)
                }

                function preprocessFields(viewId, e) {
                    return new Promise(function (resolve, reject) {
                        var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
                        if (!$.isEmptyObject(fieldsWithKwObj)) {
                            var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                            var outcomeObj = { msg: '' }; //Using an object opens the door to adding more properties if ever we need them.

                            (function processKeywordsLoop(f) {
                                var fieldId = fieldsWithKwAr[f];
                                var keywords = fieldsWithKwObj[fieldId];
                                if (!keywords)
                                    resolve();

                                ktl.views.processFieldKeywords(viewId, fieldId, keywords, e)
                                    .then(ocObj => {
                                        outcomeObj.msg += ocObj.msg;
                                        if (outcomeObj.msg !== '')
                                            reject(outcomeObj);
                                        else
                                            resolve();
                                    })
                                    .catch(err => {
                                        console.log('preprocessFields Exception:', err);
                                    })
                                    .finally(() => {
                                        if (++f < fieldsWithKwAr.length)
                                            processKeywordsLoop(f);
                                        else {
                                            if (outcomeObj.msg !== '')
                                                reject(outcomeObj);
                                            else
                                                resolve();
                                        }
                                    })
                            })(0);
                        } else
                            resolve();
                    })
                }

                function preprocessViews(viewId, e) {
                    return new Promise(function (resolve, reject) {
                        var keywords = ktlKeywords[viewId];
                        if (keywords && !$.isEmptyObject(keywords)) {
                            var outcomeObj = { msg: '' };

                            //Unique Value Check
                            if (keywords._uvc && keywords._uvc[0].params[0].length) {
                                e.preventDefault();

                                var value = '';
                                for (var f = 0; f < keywords._uvc[0].params[0].length; f++) {
                                    var uvcParam = keywords._uvc[0].params[0][f];
                                    if ((uvcParam.match(/['"]/g) || []).length === 2) {
                                        const matches = uvcParam.match(/(['"])(.*?)\1/);
                                        if (matches) {
                                            const content = matches[2];
                                            value += content;
                                        }
                                    } else {
                                        var fieldId = ktl.fields.getFieldIdFromLabel(viewId, uvcParam);
                                        if (fieldId) {
                                            var fieldType = Knack.objects.getField(fieldId).attributes.type;
                                            if (['short_text', 'phone', 'link'].includes(fieldType))
                                                value += document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] input').value;
                                            else if (fieldType === 'multiple_choice')
                                                value += $('#' + viewId + ' [data-input-id="' + fieldId + '"] .kn-select .select').val();
                                            else if (fieldType === 'connection') {
                                                const sel = document.querySelector('#' + viewId + ' [name="' + fieldId + '"].chzn-select').selectedOptions[0].innerText;
                                                if (sel && sel !== '' && sel !== 'Select')
                                                    value += sel;
                                            } else if (fieldType === 'name') {
                                                const firstName = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #first').value;
                                                const lastName = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #last').value;
                                                value += (firstName + ' ' + lastName);
                                            } else if (fieldType === 'address') {
                                                const street = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #street').value.trim();
                                                const street2 = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #street2').value.trim();
                                                const city = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #city').value.trim();
                                                const state = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #state').value.trim();
                                                const zip = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #zip').value.trim();
                                                const country = document.querySelector('#' + viewId + ' [data-input-id="' + fieldId + '"] #country').value.trim();
                                                value += (street ? street + ' ' : '')
                                                    + (street2 ? street2 + ' ' : '')
                                                    + (city ? city + ', ' : '')
                                                    + (state ? state + ' ' : '')
                                                    + (zip ? zip + ' ' : '')
                                                    + (country ? country : '');
                                            }
                                        }
                                    }
                                }

                                //Search for duplicate in _uvc Search view.
                                if (value && value !== '' && value !== 'Type to search') {
                                    var uvcSearchViewId = ktl.scenes.findViewWithKeyword('_uvc', viewId);
                                    if (uvcSearchViewId) {
                                        var fieldToCheck = ktl.views.findFirstFieldWithKeyword(uvcSearchViewId, '_uvc');
                                        if (fieldToCheck) {
                                            var field = Knack.objects.getField(fieldToCheck);
                                            var fieldName = field.attributes.name;

                                            ktl.views.searchRecordByValue('_uvc', fieldToCheck, value.trim())
                                                .then(foundRecords => {
                                                    if (foundRecords.length) {
                                                        outcomeObj.msg = fieldName + ' must be unique. "' + value + '" is already being used.';
                                                        outcomeObj.foundRecords = foundRecords;
                                                        return reject(outcomeObj);
                                                    } else
                                                        return resolve();
                                                })
                                                .catch(err => {
                                                    console.log('preprocessViews Exception:', err);
                                                    outcomeObj.msg = 'preprocessViews Exception: ' + err;
                                                    return reject(outcomeObj);
                                                })
                                        }
                                    }
                                } else
                                    resolve();
                            } else
                                resolve();
                        } else
                            resolve();
                    })
                }
            },


            //For KTL internal use.
            //Scans all fields in view and returns an object with those having keywords in their description.
            getAllFieldsWithKeywordsInView: function (viewId) {
                if (!viewId || !Knack.views[viewId] || !Knack.views[viewId].model) return {};

                //Scan all fields in form to find any keywords.
                const view = Knack.views[viewId].model.view;
                var foundFields = [];
                var fields = [];

                const viewType = ktl.views.getViewType(viewId);
                if (viewType === 'search') {
                    //Search portion at top
                    view.groups.forEach(grp => {
                        grp.columns.forEach(cols => {
                            cols.fields.forEach(fld => {
                                if (fld.connection)
                                    foundFields.push(fld.connection.key);
                                else
                                    foundFields.push(fld.id);
                            })
                        })
                    })

                    //Results portion at bottom
                    if (view.results && view.results.columns) {
                        view.results.columns.forEach(fld => {
                            if (fld.connection && !foundFields.includes(fld.connection.key))
                                foundFields.push(fld.connection.key);
                            else if (!foundFields.includes(fld.id))
                                foundFields.push(fld.id);
                        })
                    }
                } else if (viewType === 'form') {
                    view.groups.forEach(grp => {
                        grp.columns.forEach(cols => {
                            cols.inputs.forEach(fld => {
                                foundFields.push(fld.id);
                            })
                        })
                    })
                } else if (viewType === 'table' || viewType === 'list') {
                    var fields = view.fields;
                    for (var f = 0; f < fields.length; f++)
                        foundFields.push(fields[f].key);
                } else if (viewType === 'details') {
                    view.columns.forEach(col => {
                        col.groups.forEach(grp => {
                            grp.columns.forEach(cols => {
                                cols.forEach(fld => {
                                    foundFields.push(fld.key);
                                })
                            })
                        })
                    })
                }

                if (!foundFields.length) return {};

                //console.log('viewId =', viewId);
                //console.log('viewType =', viewType);
                //console.log('fields =', fields);

                var fieldsWithKwObj = {};
                for (var j = 0; j < foundFields.length; j++)
                    ktl.fields.getFieldKeywords(foundFields[j], fieldsWithKwObj);

                return fieldsWithKwObj;
            },

            //For KTL internal use.
            //Finds the first field in view with the specified keyword in its field description.
            findFirstFieldWithKeyword: function (viewId, keyword) {
                if (!viewId || !keyword) return;

                var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
                if (!$.isEmptyObject(fieldsWithKwObj)) {
                    var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                    var foundKwObj = {};
                    for (var i = 0; i < fieldsWithKwAr.length; i++) {
                        var fieldId = fieldsWithKwAr[i];
                        ktl.fields.getFieldKeywords(fieldId, foundKwObj);
                        if (!$.isEmptyObject(foundKwObj) && foundKwObj[fieldId][keyword])
                            return fieldId;
                    }
                }
            },

            //For KTL internal use.
            //When a table header is clicked to sort, invert sort order if type is date_time, so we get most recent first.
            handleClickDateTimeSort: function (event) {
                const viewId = $(event.currentTarget).closest('.kn-view[id]').attr('id');

                if (!viewId)
                    return;

                const viewType = ktl.views.getViewType(viewId);
                const classes = $(event.currentTarget).attr('class');
                if (!classes) return;
                const fieldId = classes.split(/\s+/)[0];

                let model;
                if (viewType === 'table') {
                    model = Knack.views[viewId].model;
                } else if (viewType === 'search') {
                    model = Knack.views[viewId].model.results_model;
                } else {
                    // view type not supported
                    return;
                }

                const field = model.view.fields.find((field) => field.key === fieldId);
                if (field) {
                    if (event.currentTarget.classList.value.split(' ').every((c) => !c.includes('sorted'))) { // Not already sorted. First click
                        if ((field.type === 'date_time' && !event.ctrlKey && !event.metaKey) || (field.type !== 'date_time' && (event.ctrlKey || event.metaKey))) {
                            const anchor = $(event.currentTarget).find('a');
                            const href = anchor.attr('href').split('|')[0]; // Safeguard if order is already there.
                            anchor.attr('href', `${href}|desc`);
                        }
                    }
                }
            },

            submitAndWait: function (viewId = '', formData = {/*fieldId: value*/ }) {
                return new Promise(function (resolve, reject) {
                    if (!viewId || $.isEmptyObject(formData)) return;

                    var fields = Object.entries(formData);
                    try {
                        for (var i = 0; i < fields.length; i++)
                            document.querySelector('#' + viewId + ' #' + fields[i][0]).value = fields[i][1];

                        var resultRecord = {};
                        $(document).off('knack-form-submit.' + viewId); //Prevent multiple re-entry.
                        document.querySelector('#' + viewId + ' .kn-button.is-primary').click();
                        $(document).on('knack-form-submit.' + viewId, function (event, view, record) {
                            resultRecord = record;
                        })

                        var success = null, failure = null;
                        var intervalId = setInterval(function () {
                            success = document.querySelector('#' + viewId + ' .kn-message.success') && document.querySelector('#' + viewId + ' .kn-message.success').textContent.replace(/\n/g, '').trim();
                            failure = document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body') && document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body').textContent.replace(/\n/g, '').trim();
                            if (!$.isEmptyObject(resultRecord) && (success || failure)) {
                                clearInterval(intervalId);
                                clearTimeout(failsafe);
                                //console.log('success, failure:', success, failure);
                                success && resolve({
                                    outcome: 'submitAndWait, ' + viewId + ' : ' + success,
                                    record: resultRecord
                                });
                                failure && reject('submitAndWait, ' + viewId + ' : ' + failure);
                                return;
                            }
                        }, 200);

                        var failsafe = setTimeout(function () {
                            clearInterval(intervalId);
                            reject('submitAndWait timeout error');
                        }, 30000);
                    } catch (e) {
                        reject(e);
                    }
                })
            },

            //Will return with true if the form has been submitted successfuly or account has logged-in, or false otherwise.
            waitSubmitOutcome: function (viewId = '') {
                return new Promise(function (resolve, reject) {
                    if (!viewId) return;

                    var success = null;
                    var failure = null;
                    var loggedIn = (Knack.getUserAttributes() !== 'No user found');

                    var intervalId = setInterval(function () {
                        success = document.querySelector('#' + viewId + ' .kn-message.success') && document.querySelector('#' + viewId + ' .kn-message.success').textContent.replace(/\n/g, '').trim();
                        if (!loggedIn && (Knack.getUserAttributes() !== 'No user found'))
                            success = true;
                        failure = document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body') && document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body').textContent.replace(/\n/g, '').trim();
                        if (success || failure) {
                            clearInterval(intervalId);
                            clearTimeout(failsafe);
                            success && resolve({ outcome: 'waitSubmitOutcome, ' + viewId + ' : ' + success });
                            failure && reject('waitSubmitOutcome, ' + viewId + ' : ' + failure);
                            return;
                        }
                    }, 200);

                    var failsafe = setTimeout(function () {
                        clearInterval(intervalId);
                        reject('waitSubmitOutcome timeout error in ' + viewId);
                    }, 30000);
                })
            },

            updateSubmitButtonState: function (viewId = '') {
                if (!viewId || !ktl.core.getCfg().enabled.formPreValidation) return;

                var submit = document.querySelector('#' + viewId + ' .is-primary');
                if (submit) {
                    var validity = submit.validity ? submit.validity : true;
                    var submitDisabled = !$.isEmptyObject(validity.ktlInvalidItemObj);
                    if (submitDisabled)
                        submit.setAttribute('disabled', true);
                    else
                        submit.removeAttribute('disabled');

                    submitDisabled && ktl.scenes.spinnerWatchdog(!submitDisabled); //Don't let the disabled Submit cause a page reload.
                }
            },

            getDataFromRecId: function (viewId = '', recId = '') {
                if (!viewId || !recId || !Knack.views[viewId]) return {};
                const viewType = ktl.views.getViewType(viewId);
                if (viewType === 'table')
                    return Knack.views[viewId].model.data._byId[recId].attributes;
                else if (viewType === 'search')
                    return Knack.views[viewId].model.results_model.data._byId[recId].attributes;
            },

            //For KTL internal use.
            convertViewTitlesToViewIds: function (viewTitles = [], excludeViewId = '') {
                return viewTitles.reduce((viewIds, viewTitle) => {
                    var foundViewId = ktl.scenes.findViewWithTitle(viewTitle.trim(), true, excludeViewId);
                    if (foundViewId)
                        viewIds.push(foundViewId);
                    return viewIds;
                }, []);
            },

            //For KTL internal use.
            //Disable mouse clicks when a table's Inline Edit is enabled for PUT/POST API calls, but you don't want users to modify cells.
            //Each parameter is a column header text where disable applies. If no parameter, the whole table is disabled.
            noInlineEditing: function (view) {
                if (!view || ktl.scenes.isiFrameWnd()) return;
                const viewId = view.key;

                const kw = '_ni';
                var kwInstance = ktlKeywords[viewId] && ktlKeywords[viewId][kw];
                if (kwInstance) {
                    if (kwInstance.length)
                        kwInstance = kwInstance[0];

                    const options = kwInstance.options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    var model = (Knack.views[viewId] && Knack.views[viewId].model);
                    if (Knack.views[viewId] && model && model.view.options && model.view.options.cell_editor) {
                        if (kwInstance.params && kwInstance.params.length) {
                            //Process each field individually.
                            //As an exception, if a field starts with an exclamation mark, allow inline editing.
                            var allowInline = {};
                            if (kwInstance.params[0][0].charAt(0) === '!') {
                                //Found first param as an exception.
                                $('#' + viewId + ' .cell-edit').addClass('ktlNoInlineEdit'); //By default, all fields.
                                kwInstance.params[0].forEach(colHeader => {
                                    if (colHeader.charAt(0) === '!') {
                                        colHeader = colHeader.substring(1);
                                        allowInline[colHeader] = true;
                                    } else
                                        allowInline[colHeader] = false;

                                    var thead = $('#' + viewId + ' thead tr th:textEquals("' + colHeader + '")');
                                    if (thead.length && allowInline[colHeader] === true)
                                        $('#' + viewId + ' tbody tr td:nth-child(' + (thead[0].cellIndex + 1) + ')').removeClass('ktlNoInlineEdit');
                                })
                            } else {
                                kwInstance.params[0].forEach(colHeader => {
                                    var thead = $('#' + viewId + ' thead tr th:textEquals("' + colHeader + '")');
                                    if (thead.length)
                                        $('#' + viewId + ' tbody tr td:nth-child(' + (thead[0].cellIndex + 1) + ')').addClass('ktlNoInlineEdit');
                                })
                            }
                        } else
                            $('#' + viewId + ' .cell-edit').addClass('ktlNoInlineEdit');
                    }
                }

                //Must be left outside the "if keywords._ni exists" condition above.
                //Must always be executed to support the _lud and _lub keywords that can also add the ktlNoInlineEdit class.
                $('#' + viewId + ' .ktlNoInlineEdit').bindFirst('click', function (e) {
                    e.stopImmediatePropagation();
                });
            },

            removeColumns: function (view = {}, keywords = {}) {
                const KEYWORD_NAME = '_rc';

                if (!view.key
                    || (view.key !== 'table' && view.type === 'search')
                    || !keywords[KEYWORD_NAME]) return;

                const model = (Knack.views[view.key] && Knack.views[view.key].model);
                const columns = model.view.columns;

                ktl.core.getKeywordsByType(view.key, KEYWORD_NAME).forEach(keyword => {

                    if (!ktl.core.hasRoleAccess(keyword.options)) return;

                    const headers = columns.map(col => col.header.trim()).filter(header => {
                        return keyword.params[0].includes(header);
                    });

                    ktl.views.removeTableColumns(view.key, [], headers);
                });
            },

            hideColumns: function (view = {}, keywords = {}) {
                const KEYWORD_NAME = '_hc';

                if (!view.key
                    || (view.type !== 'table' && view.type === 'search')
                    || !keywords[KEYWORD_NAME]) return;

                const model = (Knack.views[view.key] && Knack.views[view.key].model);
                const columns = model.view.columns;

                ktl.core.getKeywordsByType(view.key, KEYWORD_NAME).forEach(keyword => {
                    if (!ktl.core.hasRoleAccess(keyword.options))
                        return;

                    const headers = columns.map(col => col.header.trim()).filter(header => {
                        return keyword.params[0].includes(header);
                    });

                    const fields = columns.map(col => (col.id || (col.field && col.field.key))).filter(fieldId => {
                        return fieldId && keyword.params[0].includes(fieldId);
                    });

                    const hide = () => ktl.views.hideTableColumns(view.key, fields, headers);
                    const unhide = () => ktl.views.unhideTableColumns(view.key, fields, headers);

                    if (fields.length || headers.length)
                        ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide);
                });
            },

            hideUnhideValidateKtlCond: function (options = {}, hide, unhide) {
                return new Promise(function (resolve) {
                    hide();

                    if (!options.ktlCond) return resolve();

                    const conditions = options.ktlCond.replace(']', '').split(',').map(e => e.trim());

                    const operator = conditions[0] || '';
                    const value = conditions[1] || '';
                    const field = conditions[2] || '';
                    const view = conditions[3] || '';
                    const viewId = ktl.scenes.findViewWithTitle(view);

                    if (value === 'ktlMobile' && (operator === 'is' || operator === 'not')) {
                        if (Knack.isMobile() && operator === 'is')
                            hide();
                        else if (!Knack.isMobile() && operator === 'not')
                            hide();
                        else
                            unhide();

                        return resolve();
                    }

                    if (field.startsWith('$(')) {
                        const selector = ktl.core.extractJQuerySelector(field);
                        ktl.core.waitSelector(selector, 10000).then(() => {
                            const fieldValue = $(selector)[0].textContent.trim();
                            if (!fieldValue || !ktlCompare(fieldValue, operator, value))
                                unhide();

                            if ($(selector).is(':input')) {
                                const update = (event) => {
                                    if (ktlCompare(event.target.value, operator, value))
                                        hide();
                                    else
                                        unhide();
                                }
                                $(selector).off('keyup.ktlHc').on('keyup.ktlHc', update);
                                $(selector).one('change', update);
                            }
                        }).catch(() => {
                            unhide();
                        });

                        return resolve();
                    }

                    if (field === 'ktlNow' || field === 'ktlNowUTC') {
                        if (ktlCompare(field, operator, value))
                            hide();
                        else
                            unhide();

                        return resolve();
                    }

                    let fieldId = (field.startsWith('field_')) ? field : ktl.fields.getFieldIdFromLabel(viewId, field);

                    if (!fieldId) {
                        $(document).one(`knack-view-render.${viewId}`, () => {
                            fieldId = (field.startsWith('field_')) ? field : ktl.fields.getFieldIdFromLabel(viewId, field);
                            apply();
                        })
                    } else
                        apply();

                    function apply() {
                        let selector = '';
                        if (viewId && fieldId) {
                            const viewType = ktl.views.getViewType(viewId);
                            selector = '#' + viewId;
                            if (viewType === 'details')
                                selector += ' .' + fieldId + ' .kn-detail-body';
                            else if (viewType === 'form') {
                                selector += ' input#' + fieldId;
                            }
                        }

                        if (!selector) {
                            unhide();
                        } else {
                            ktl.core.waitSelector(selector, 10000).then(() => {
                                let fieldValue;
                                if (ktl.views.getViewType(viewId) === 'form') {
                                    fieldValue = $(selector).val();
                                    $(selector).off('keyup.ktlHc').on('keyup.ktlHc', (event) => {
                                        if (ktlCompare(event.target.value, operator, value))
                                            hide();
                                        else
                                            unhide();
                                    })
                                } else
                                    fieldValue = $(selector)[0].textContent.trim();

                                if (!fieldValue || !ktlCompare(fieldValue, operator, value))
                                    unhide();
                            }).catch(() => {
                                unhide();
                            });
                        }

                        resolve();
                    }
                });
            },

            validateKtlCond: function (options = {}, recordObj = {} /*Used only with Tables and Lists*/, keywordViewId) {
                return new Promise(function (resolve) {
                    if (!options.ktlCond) return resolve(true);

                    const conditions = options.ktlCond.replace(']', '').split(',').map(e => e.trim());

                    const operator = conditions[0] || '';
                    const value = conditions[1] || '';
                    const field = conditions[2] || '';
                    let fieldId;
                    const view = conditions[3] || '';
                    let viewId = ktl.scenes.findViewWithTitle(view);

                    if (value === 'ktlMobile' && (operator === 'is' || operator === 'not')) {
                        if (Knack.isMobile() && operator === 'is')
                            return resolve(true);
                        else if (!Knack.isMobile() && operator === 'not')
                            return resolve(true);
                        else
                            return resolve(false);
                    }

                    let foreignViewId; //Foreign view and field are used by ktlMatch, to indicate where to search.
                    let foreignFieldId;
                    if (value === 'ktlMatch' && (operator === 'is' || operator === 'not')) {
                        foreignViewId = viewId;
                        viewId = keywordViewId;
                        foreignFieldId = (field.startsWith('field_')) ? field : ktl.fields.getFieldIdFromLabel(foreignViewId, field);
                    }

                    if (foreignViewId) {
                        ktl.views.waitViewDataReady(foreignViewId)
                            .then(() => {
                                allViewsReady();
                            })
                            .catch(err => {
                                ktl.log.clog('purple', `validateKtlCond - Timeout waiting for data: ${foreignViewId}`);
                                console.log('err =', err);
                                return resolve(false);
                            })
                    } else
                        allViewsReady();

                    function allViewsReady() {
                        if (field.startsWith('$(')) {
                            const selector = ktl.core.extractJQuerySelector(field);
                            ktl.core.waitSelector(selector, 10000).then(() => {
                                const fieldValue = $(selector)[0].textContent.trim();
                                if (!fieldValue || !ktlCompare(fieldValue, operator, value))
                                    return resolve(false);

                                if ($(selector).is(':input')) {
                                    const update = (event) => {
                                        return resolve(ktlCompare(event.target.value, operator, value));
                                    }
                                    $(selector).off('keyup.ktlHc').on('keyup.ktlHc', update);
                                    $(selector).one('change', update);
                                }
                            }).catch(() => {
                                return resolve(false);
                            });
                        }

                        if (field === 'ktlNow' || field === 'ktlNowUTC')
                            return resolve(ktlCompare(field, operator, value));

                        fieldId = (field.startsWith('field_')) ? field : ktl.fields.getFieldIdFromLabel(viewId, field);

                        if (!fieldId) {
                            $(document).one(`knack-view-render.${viewId}`, () => {
                                fieldId = (field.startsWith('field_')) ? field : ktl.fields.getFieldIdFromLabel(viewId, field);
                                apply();
                            })
                        } else
                            apply();
                    }

                    function apply() {
                        let selector = '';
                        if (viewId) {
                            const viewType = ktl.views.getViewType(viewId);
                            selector = '#' + viewId;
                            if (viewType === 'details') {
                                if (fieldId)
                                    selector += ' .' + fieldId + ' .kn-detail-body';
                            } else if (viewType === 'form') {
                                if (fieldId)
                                    selector += ' input#' + fieldId;
                            } else if (viewType === 'table' || viewType === 'search' || viewType === 'list') {
                                if (!fieldId) {
                                    const actionLink = $(`#${viewId} tr[id="${recordObj.id}"] .kn-action-link:textEquals("${field}")`);
                                    if (actionLink.length) {
                                        const fieldValue = actionLink[0].innerText;
                                        const result = ktlCompare(fieldValue, operator, value);
                                        return resolve(result);
                                    }
                                } else {
                                    let cellText;

                                    const rawData = recordObj[`${fieldId}_raw`];
                                    if (rawData) {
                                        let fieldType = ktl.fields.getFieldType(fieldId);

                                        if (Array.isArray(rawData) && rawData.length > 0)
                                            cellText = rawData.flat().map(obj => (obj.identifier || obj.timestamp || obj)).join(' ');
                                        else if (fieldType === 'phone')
                                            cellText = rawData.formatted;
                                        else if (fieldType === 'boolean') {
                                            const format = Knack.objects.getField(fieldId).attributes.format.format;
                                            if (format === 'yes_no')
                                                cellText = (rawData === true ? 'Yes' : 'No');
                                            else if (format === 'on_off')
                                                cellText = (rawData === true ? 'On' : 'Off');
                                            else
                                                cellText = (rawData === true ? 'True' : 'False');
                                        } else
                                            cellText = rawData.toString();

                                        if (cellText !== '' && numericFieldTypes.includes(fieldType))
                                            cellText = ktl.core.extractNumericValue(cellText, fieldId);
                                    }

                                    if (value === 'ktlMatch') {
                                        const foreignViewType = ktl.views.getViewType(foreignViewId);
                                        if (foreignViewType === 'table' || foreignViewType === 'list') {
                                            const foreignData = Knack.views[foreignViewId].model.data.models;
                                            if (!foreignData.length)
                                                return resolve(operator === 'not');

                                            //Search all records now.
                                            for (const record of foreignData) {
                                                let foreignCellText = record.attributes[`${foreignFieldId}_raw`];

                                                if (Array.isArray(foreignCellText) && foreignCellText.length)
                                                    foreignCellText = foreignCellText[0].identifier;

                                                if (ktlCompare(cellText, operator, foreignCellText))
                                                    return resolve(true);
                                            }

                                            return resolve(false);
                                        } else
                                            return resolve(false);
                                    } else
                                        return resolve(ktlCompare(cellText, operator, value));
                                }
                            } else {
                                ktl.log.clog('purple', 'validateKtlCond - unsupported view type', viewId, viewType);
                                return resolve(false);
                            }
                        }

                        if (!selector) {
                            return resolve(false);
                        } else {
                            ktl.core.waitSelector(selector, 10000).then(() => {
                                let fieldValue;
                                if (ktl.views.getViewType(viewId) === 'form') {
                                    fieldValue = $(selector).val();
                                    $(selector).off('keyup.ktlHc').on('keyup.ktlHc', (event) => {
                                        return resolve(ktlCompare(event.target.value, operator, value));
                                    })
                                } else
                                    fieldValue = $(selector)[0].textContent.trim();

                                const fieldType = ktl.fields.getFieldType(fieldId);
                                if (fieldType && numericFieldTypes.includes(fieldType))
                                    fieldValue = ktl.core.extractNumericValue(fieldValue, fieldId);

                                if (!fieldValue)
                                    return resolve(false);

                                return resolve(ktlCompare(fieldValue, operator, value));
                            }).catch(() => {
                                return resolve(false);
                            });
                        }
                    }
                });
            },

            getViewSourceName: function (viewId) {
                if (!viewId) return;
                const viewObj = Knack.views[viewId];
                if (!viewObj) return;

                var object = viewObj.model.view.source.object;
                return Knack.objects._byId[object].attributes.name;
            },

            getViewType: function (viewId) {
                if (!viewId) return;
                var viewObj = ktl.views.getViewObj(viewId);
                if (viewObj)
                    return viewObj.type;
            },

            getViewObj: function (viewId) {
                if (!viewId) return;
                var viewObj = Knack.views[viewId];
                if (viewObj && viewObj.model && viewObj.model.view)
                    return viewObj.model.view;
                else {
                    viewObj = Knack.router.scene_view.model.views._byId[viewId];
                    if (viewObj)
                        return viewObj.attributes;
                }
            },

            applyZoomLevel: function (viewId, keywords) {
                if (!viewId) return;

                const kw = '_zoom';
                if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    $('#' + viewId).addClass('ktlVisibilityHidden');

                    const sel = ktl.core.computeTargetSelector(viewId, '', options);
                    ktl.core.waitSelector(sel, 20000)
                        .then(() => {
                            var zoomLevel = keywords[kw][0].params[0][0];
                            if (!isNaN(zoomLevel))
                                $(sel).css({ 'zoom': zoomLevel + '%' });
                        })
                        .catch(function () { })
                        .finally(() => {
                            $('#' + viewId).removeClass('ktlVisibilityHidden');
                        })

                }
            },

            addRemoveClass: function (viewId, keywords, data = []) {
                const kw = '_cls';
                if (!viewId || !keywords[kw]) return;

                const kwList = ktl.core.getKeywordsByType(viewId, kw);
                kwList.forEach(kwInstance => { execKw(kwInstance); })

                function execKw(kwInstance) {
                    const options = kwInstance.options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    const viewType = ktl.views.getViewType(viewId);

                    if (viewType === 'table' || viewType === 'search' || viewType === 'list') {
                        (function processClassForAllRecords(idx) {
                            let recordObj = data[idx];
                            processClass(options, recordObj)
                                .then(() => {
                                    if (++idx < data.length)
                                        processClassForAllRecords(idx);
                                })
                        })(0);
                    } else
                        processClass(options);

                    function processClass(options, recordObj = {}) {
                        return new Promise(function (resolve) {
                            ktl.views.validateKtlCond(options, recordObj, viewId)
                                .then(valid => {
                                    if (valid) {
                                        const sel = ktl.core.computeTargetSelector(viewId, '', options, recordObj.id);
                                        ktl.core.waitSelector(sel, 20000)
                                            .then(() => {
                                                var classes = kwInstance.params[0];
                                                for (var i = 0; i < classes.length; i++) {
                                                    var params = classes[i];
                                                    if (params.startsWith('!'))
                                                        $(sel).removeClass(params.replace('!', ''));
                                                    else {
                                                        if (params === 'ktlRemove')
                                                            $(sel).remove();
                                                        else
                                                            $(sel).addClass(params);
                                                    }
                                                }

                                                resolve();
                                            })
                                            .catch(function () {
                                                console.log('Timeout waiting for selector in _cls', sel);
                                                resolve();
                                            })
                                    } else
                                        resolve();
                                })
                        })
                    }
                }
            },

            setStyle: function (viewId, keywords) {
                const kw = '_style';
                if (!viewId || !keywords[kw]) return;

                const kwList = ktl.core.getKeywordsByType(viewId, kw);
                kwList.forEach(kwInstance => { execKw(kwInstance); })

                function execKw(kwInstance) {
                    const options = kwInstance.options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    const sel = ktl.core.computeTargetSelector(viewId, '', options);
                    ktl.core.waitSelector(sel, 20000, 'visible')
                        .then(() => {
                            $(sel).each((ix, el) => {
                                //Merge new style with existing one.
                                const currentStyle = $(el).attr('style');
                                $(el).attr('style', (currentStyle ? currentStyle + '; ' : '') + kwInstance.params[0]);
                            })
                        })
                        .catch(function () { })
                }
            },

            truncateText: function (view, keywords) {
                const kw = '_trk';
                if (!view || !keywords || (keywords && !keywords[kw])) return;

                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                const viewType = view.type;
                if (viewType === 'table') {
                    var columns = view.columns;
                    if (!columns) return;

                    try {
                        columns.forEach(col => {
                            var widthType = col.width.type;
                            var widthUnits = col.width.units;
                            if (widthType === 'custom' && widthUnits === 'px') {
                                var widthAmount = col.width.amount;

                                if (col.type === 'field') {
                                    if (col.field) {
                                        var fieldId = col.field.key;
                                        //Remove anything after field_xxx, like pseudo selectors with colon.
                                        var extractedField = fieldId.match(/field_\d+/);
                                        if (extractedField) {
                                            fieldId = extractedField[0];
                                            $('#' + view.key + ' td.' + fieldId + ' span').addClass('ktlTruncateCellText');
                                            $('#' + view.key + ' td.' + fieldId + ' span').css('max-width', widthAmount + 'px');
                                        }
                                    }
                                }
                            }
                        })
                    } catch (e) {
                        console.log('truncateText error:', e);
                    }
                }
            },

            openLink: function (viewId, keywords) {
                const kw = keywords._oln ? '_oln' : '_ols';
                if (!viewId || !keywords || (keywords && !keywords[kw])) return;

                var options;
                if (keywords[kw].length && keywords[kw][0].options) {
                    options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                const viewType = ktl.views.getViewType(viewId);
                if (viewType === 'rich_text') {
                    var innerHTML = document.querySelector('#' + viewId).innerHTML;
                    document.querySelector('#' + viewId).innerHTML = innerHTML.replace(/_ol[sn]=/, '');

                    //In rich text views, jump directly to the URL, without requiring a click.
                    const href = keywords[kw][0].params[0][0];
                    let parser = new DOMParser();
                    let url = parser.parseFromString(href, 'text/html').querySelector('a').getAttribute('href');
                    window.open(url, kw === '_ols' ? '_self' : '_blank');
                } else {
                    if (kw === '_ols') return;

                    var olnSelector = '.knTable td a, .kn-detail-body a';

                    //Apply to all views if ktlTarget is page.
                    if (options && (!options.ktlTarget || options.ktlTarget !== 'page'))
                        olnSelector = '#' + viewId + ' ' + olnSelector;

                    const linkElement = $(olnSelector);
                    linkElement.off('click').on('click', e => {
                        const target = e.target;
                        let openInNewTab = false;

                        if (target.classList.contains('kn-link'))
                            openInNewTab = true;
                        else {
                            let fieldId;
                            let fld = target.closest('[class^="field_"]');
                            if (fld)
                                fieldId = fld.getAttribute('data-field-key');
                            else {
                                const detailsView = $(target).closest('.kn-detail');
                                if (detailsView.length)
                                    fieldId = detailsView.attr('class').split(/\s+/)[1];
                            }

                            if (!fieldId || !fieldId.startsWith('field_')) return;

                            const fieldType = ktl.fields.getFieldType(fieldId);
                            if (fieldType === 'link')
                                openInNewTab = true;
                        }

                        if (openInNewTab && e.target.href) {
                            e.preventDefault();
                            window.open(e.target.href, '_blank');
                        }
                    })
                }
            },

            numDisplayedRecords: function (viewId, keywords) {
                if (!viewId) return;

                const kw = '_dr';
                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                    var perPage = keywords[kw][0].params[0][0];
                    var href = window.location.href;
                    if (!href.includes(viewId + '_per_page=')) {
                        $('#' + viewId).addClass('ktlVisibilityHidden');
                        Knack.showSpinner();

                        const view = Knack.views[viewId].model.view;

                        if (view.pagination_meta)
                            view.pagination_meta.page = 1;

                        if (view.source)
                            view.source.page = 1;

                        if (view.pagination_meta)
                            view.pagination_meta.rows_per_page = perPage;

                        if (view.rows_per_page)
                            view.rows_per_page = perPage;

                        var i = {};
                        i[viewId + '_per_page'] = perPage;
                        i[viewId + '_page'] = 1;
                        Knack.router.navigate(Knack.getSceneHash() + "?" + Knack.getQueryString(i), false);
                        Knack.setHashVars();

                        if (document.querySelector('.kn-view.kn-table.' + viewId + ' .kn-table-wrapper')) { //This is to support Search views, otherwise you get an error on first render.
                            Knack.models[viewId].fetch({
                                success: () => {
                                    Knack.hideSpinner();
                                    $('#' + viewId).removeClass('ktlVisibilityHidden');
                                }
                            });
                        } else
                            $('#' + viewId).removeClass('ktlVisibilityHidden');
                    }
                }
            },

            copyToClipboard: function (viewId, keywords) {
                const kw = '_copy';
                if (!viewId || !keywords || (keywords && !keywords[kw])) return;

                const viewType = ktl.views.getViewType(viewId);

                if (!document.querySelector('#' + viewId + ' .ktlCopyButton')) {
                    if (keywords[kw].length && keywords[kw][0].options) {
                        const options = keywords[kw][0].options;
                        if (!ktl.core.hasRoleAccess(options)) return;
                    }

                    var viewKtlButtonsDiv;

                    if (viewType === 'table' || viewType === 'search')
                        viewKtlButtonsDiv = $('#' + viewId + ' .table-keyword-search');

                    if (!viewKtlButtonsDiv || !viewKtlButtonsDiv.length)
                        viewKtlButtonsDiv = $('#' + viewId + ' .kn-title');

                    viewKtlButtonsDiv.css({ 'display': 'inline-flex' });

                    const copyToClipboard = document.createElement('BUTTON');
                    copyToClipboard.setAttribute('class', 'kn-button ktlCopyButton');
                    copyToClipboard.innerHTML = 'Copy';
                    copyToClipboard.style.marginLeft = '10%';
                    copyToClipboard.setAttribute('type', 'button'); //Needed to prevent copying when pressing Enter in search field.
                    viewKtlButtonsDiv.append(copyToClipboard);

                    copyToClipboard.addEventListener('click', function () {
                        if (viewType === 'table' || viewType === 'search')
                            ktl.core.selectElementContents(document.querySelector('#' + viewId + ' .kn-table-wrapper'));
                        else if (viewType === 'details')
                            ktl.core.selectElementContents(document.querySelector('#' + viewId + '.kn-details section'));
                        else {
                            console.log('copyToClipboard error.  Unsupported view type:', viewId);
                            return;
                        }

                        try {
                            var successful = document.execCommand('copy');
                            var msg = successful ? 'Table copied to clipboard' : 'Error copying table to clipboard';
                            ktl.core.timedPopup(msg, successful ? 'success' : 'error', 1000);
                        } catch (err) {
                            ktl.core.timedPopup('Unable to copy', 'error', 2000);
                        } finally {
                            ktl.core.selectElementContents();
                        }

                    });
                }

                var copyIsDisabled = false;
                if (document.querySelector('#' + viewId + ' tr.kn-tr-nodata'))
                    copyIsDisabled = true;
                else if (viewType === 'search' && !document.querySelector('#' + viewId + ' .kn-table-wrapper'))
                    copyIsDisabled = true;

                const btn = document.querySelector('#' + viewId + ' .ktlCopyButton');
                if (btn)
                    btn.disabled = copyIsDisabled;
            },

            obfuscateData: function (view, keywords) {
                if (!view || !keywords) return;

                const kw = '_obf';
                const viewId = view.key;
                const PRIVATE_DATA = '*************';

                //Process fields keyword
                var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
                if (!$.isEmptyObject(fieldsWithKwObj)) {
                    var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                    var foundKwObj = {};
                    for (let i = 0; i < fieldsWithKwAr.length; i++) {
                        var fieldId = fieldsWithKwAr[i];
                        ktl.fields.getFieldKeywords(fieldId, foundKwObj);
                        if (!$.isEmptyObject(foundKwObj)) {
                            if (foundKwObj[fieldId][kw]) {
                                if (foundKwObj[fieldId][kw].length && foundKwObj[fieldId][kw][0].options) {
                                    const options = foundKwObj[fieldId][kw][0].options;
                                    if (ktl.core.hasRoleAccess(options)) {
                                        obfField(fieldId);
                                    }
                                } else
                                    obfField(fieldId);
                            }
                        }
                    }

                    function obfField(fieldId) {
                        //Grids
                        $('#' + viewId + ' td.' + fieldId + ' > span').each(function () {
                            $(this).text(PRIVATE_DATA);
                        });

                        //Details
                        $('#' + viewId + ' .' + fieldId + ' .kn-detail-body').each(function () {
                            $(this).text(PRIVATE_DATA);
                        });
                    }
                }

                //Process views keyword
                if (keywords && !keywords[kw]) return;

                const kwList = ktl.core.getKeywordsByType(viewId, kw);
                if (kwList.length)
                    kwList.forEach(kwInstance => { execKw(kwInstance); })
                else
                    obfuscateAllFields();

                function execKw(kwInstance) {
                    const options = kwInstance.options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    var fieldsArray = [];
                    const kwFields = kwInstance.params[0];
                    for (var i = 0; i < kwFields.length; i++) {
                        var fieldLabel = kwFields[i];

                        var fieldId = fieldLabel;
                        if (!fieldLabel.startsWith('field_'))
                            fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldLabel);

                        if (fieldId) {
                            fieldsArray.push(fieldId);
                        } else {
                            //Try with an action link.
                            const actLink = $('#' + viewId + ' .kn-details-link .kn-detail-body:textEquals("' + fieldLabel + '")');
                            if (actLink.length) {
                                actLink.text(PRIVATE_DATA);
                                fieldsArray.push('_ktl_nothing_'); //Dummy entry to trigger non-empty arraybelow.
                            }
                        }
                    }

                    if (fieldsArray.length) {
                        fieldsArray.forEach(el => {
                            $('#' + viewId + ' td.' + el + ' > span').each(function () { //Grids
                                $(this).text(PRIVATE_DATA);
                            });

                            $('#' + viewId + ' .' + el + ' .kn-detail-body').each(function () { //Details
                                $(this).text(PRIVATE_DATA);
                            });
                        });
                    } else
                        obfuscateAllFields();
                }

                function obfuscateAllFields() {
                    $('#' + viewId + ' td > span').each(function () {
                        $(this).text(PRIVATE_DATA);
                    });

                    $('#' + viewId + ' .kn-detail-body').each(function () {
                        $(this).text(PRIVATE_DATA);
                    });
                }
            },

            hideShowColumns: function (viewId, keywords) {
                if (!viewId || cfg.hscGlobal) return;

                const kw = '_hsc';
                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                ktl.views.addHideShowIconsToTableHeaders(viewId);
            },

            //Returns a zero-based index of the first column from left that matches the header param.
            //TODO: support details view
            getFieldPositionFromHeader: function (viewId, header) {
                if (!viewId || !header) return;
                const viewType = ktl.views.getViewType(viewId);
                if (viewType !== 'table') {
                    ktl.log.clog('purple', 'getFieldPositionFromHeader - unsupported view type', viewId, viewType);
                    return;
                }

                const headers = document.querySelectorAll('#' + viewId + ' .kn-table th');
                for (var i = 0; i < headers.length; i++) {
                    const headerTxt = headers[i].textContent.trim();
                    if (headerTxt === header)
                        return i;
                }
            },

            //Returns a zero-based index of the first column from left that matches the fieldId param.
            //TODO: support details view
            getFieldPositionFromFieldId: function (viewId, fieldId) {
                if (!viewId || !fieldId) return;
                const viewType = ktl.views.getViewType(viewId);
                if (viewType !== 'table') {
                    ktl.log.clog('purple', 'getFieldPositionFromFieldId - unsupported view type', viewId, viewType);
                    return;
                }

                const headers = document.querySelectorAll('#' + viewId + ' .kn-table th');
                for (var i = 0; i < headers.length; i++) {
                    colFieldId = headers[i].classList && headers[i].classList.value && headers[i].classList.value.match(/field_\d+/);
                    if (colFieldId && colFieldId.length) {
                        colFieldId = colFieldId[0];
                        if (colFieldId === fieldId)
                            return i;
                    }
                }
            },

            //Used when we need to get the field type, but at the view level.
            //It happens that a field may become a link when the Link Type option is Field instead of Text.
            getFieldTypeInView: function (viewId, fieldId, exactMatch = true) {
                if (!viewId || !fieldId) return;

                let view = ktl.views.getViewObject(viewId);
                if (!view) return;

                let viewObjToScan = view;
                let keyToFind;
                let keyNameToReturn;
                let foundField;

                const viewType = view.type;
                try {
                    if (viewType === 'table' || viewType === 'search') {
                        keyToFind = 'field';
                        keyNameToReturn = 'type';
                        viewObjToScan = view.columns;
                        for (const key in viewObjToScan) {
                            const obj = viewObjToScan[key];
                            if (obj[keyToFind] && obj[keyToFind].key === fieldId)
                                foundField = obj[keyNameToReturn];
                        }
                    } else if (viewType === 'details' || viewType === 'list') {
                        keyToFind = 'key';
                        keyNameToReturn = 'type';
                        viewObjToScan = view.columns;
                    } else if (viewType === 'form') {
                        keyToFind = 'id';
                        keyNameToReturn = 'type';
                        viewObjToScan = view;
                    } else if (viewType === 'rich_text')
                        return;
                    else
                        ktl.log.clog('purple', 'getFieldTypeInView - Unsupported view type', viewId, viewType);
                    //Support more view types as we go.

                    if (!foundField)
                        foundField = ktl.core.findKeyWithValueInObject(viewObjToScan, keyToFind, fieldId, keyNameToReturn, exactMatch);

                    return foundField;
                }
                catch (e) {
                    ktl.log.clog('purple', 'getFieldTypeInView error: Invalid field selector encountered', fieldId, e);
                }
            },

            getColumnIndex: function (viewId, fieldId) {
                if (!viewId || !fieldId) return;
                if (ktl.views.getViewType(viewId) !== 'table') return;

                const header = $(`#${viewId} thead th.${fieldId}`);

                if (header) {
                    const hasBulkOperationColumn = $(`#${viewId} .kn-table thead tr th:first-child`).find('input[type="checkbox"]').length > 0;
                    let colIndex = header[0].cellIndex;
                    if (hasBulkOperationColumn && colIndex >= 1)
                        colIndex--;
                    return colIndex
                }
            },

            //Returns undefined if view type is not applicable, or the number of summaries, from 0 to 4.
            viewHasSummary: function (viewId) {
                var viewObj = ktl.views.getViewObj(viewId);
                if (viewObj && viewObj.totals)
                    return viewObj.totals.length;
            },

            addSummaryObserver: function (viewId, callback, ...params) {
                if (typeof callback === 'function')
                    summaryObserverCallbacks[viewId] = { callback, params };
                else
                    console.error('Called addSummaryObserver with a non-function type argument.');
            },

            addCheckboxesToTable: function (viewId, withMaster = true) {
                if (!viewId) return;
                const viewType = ktl.views.getViewType(viewId);
                if (viewType !== 'table' && viewType !== 'search') {
                    ktl.log.clog('purple', 'addCheckboxesToTable - unsupported view type', viewId, viewType);
                    return;
                }

                //Only add checkboxes if there's data and checkboxes not yet added.
                var selNoData = $('#' + viewId + ' > div.kn-table-wrapper > table > tbody > tr > td.kn-td-nodata');
                if (selNoData.length === 0 && !document.querySelector('#' + viewId + ' .kn-table th:nth-child(1) input[type=checkbox]')) {
                    if (withMaster) { // Add the master checkbox to to the header to select/unselect all
                        $('#' + viewId + ' .kn-table thead tr').prepend('<th style="width: 24px;"><input type="checkbox"></th>');
                        $('#' + viewId + ' .kn-table thead input').addClass('masterSelector');
                        $('#' + viewId + ' .masterSelector').change(function () {
                            $('#' + viewId + ' tr td input:checkbox').each(function () {
                                $(this).attr('checked', $('#' + viewId + ' th input:checkbox').attr('checked') !== undefined);
                            });

                            //TODO: onMasterCheckboxChange(viewId);
                        });
                    } else {
                        //Add blank cell to keep header properly aligned.
                        $('#' + viewId + ' thead tr').prepend('<th class="blankCell" style="background-color: #eee; border-top: 1px solid #dadada;"></th>');
                    }

                    //Add a checkbox to each row in the table body
                    $('#' + viewId + ' tbody tr').each(function () {
                        if (this.id && !this.classList.contains('kn-table-totals') && !this.classList.contains('kn-table-group')) {
                            $(this).prepend('<td><input type="checkbox"></td>');
                        }
                    });

                    $('#' + viewId + ' tbody tr td input:checkbox').addClass('bulkEditCb');
                }
            },

            //Add a tooltip to a field label/header
            addTooltipsToFields: function (viewId, fieldId, tooltipText, viewType) {
                if (!viewId || !viewType || !fieldId) return;
                // Define the tooltip position based on the view type
                const tooltipPosition = {
                    form: `#${viewId} #kn-input-${fieldId} > label`,
                    details: `#${viewId} .${fieldId} .kn-detail-label`,
                    table: `#${viewId} th.${fieldId}`,
                }[viewType];

                // Define the tooltip icon HTML
                const icon = '<i class="fa fa-question-circle ktlTooltipIcon ktlTtipIcon-' + viewType + '-view"> </i>';

                // Add the tooltip icon to the DOM
                $(tooltipPosition)
                    .not('.has-tooltip')
                    .addClass('has-tooltip')
                    .append(icon)
                    .find('.table-fixed-label')
                    .css('display', 'inline-block');

                // Add event listeners to show and hide the tooltip
                $(document).on('mouseenter', tooltipPosition + ' i.fa-question-circle', function (e) {
                    if (!$(".ktlTooltip").length) {
                        const tooltipElement = $('<div class="ktlTooltip ktlTtip-' + viewType + '-view">' + tooltipText + '</div>')
                        const icon = $(this);
                        const iconWidth = icon.width();
                        const iconHeight = icon.height();
                        let iconPosition;

                        // Add the tooltip to the DOM
                        if (viewType === 'table') {
                            $(tooltipElement).appendTo('body');
                            iconPosition = icon.offset();
                        } else {
                            $(tooltipElement).appendTo(icon.parent()); // Append to parent
                            iconPosition = icon.position();
                        }

                        // Position the tooltip
                        const tooltipWidth = tooltipElement.width();
                        const tooltipHeight = tooltipElement.height();
                        let tooltipTop = iconPosition.top - tooltipHeight - (2 * iconHeight); // Calculate relative to the icon
                        let tooltipLeft = iconPosition.left + (iconWidth / 2) - (tooltipWidth / 2); // Calculate relative to the icon
                        // Adjust tooltipLeft if it's off the left or right side of the page
                        const pageWidth = $(window).width();
                        if (tooltipLeft < 0) {
                            tooltipLeft = 0;
                        }
                        else if (tooltipLeft + tooltipWidth > pageWidth) {
                            tooltipLeft = pageWidth - tooltipWidth;
                        }
                        tooltipElement.css({ top: tooltipTop, left: tooltipLeft }); // Set position to 'absolute'
                    }
                });

                $(document).on('mouseleave', tooltipPosition + ' i.fa-question-circle', function () {
                    $('.ktlTooltip').remove();
                });
            },

            addHideShowIconsToTableHeaders: function (viewId) {
                if (!viewId || (cfg.hscAllowed && !cfg.hscAllowed(viewId)))
                    return;

                if (!['table', 'search'].includes(ktl.views.getViewType(viewId)))
                    return;

                const hasBulkOperationColumn = $(`#${viewId} .kn-table thead tr th:first-child`).find('input[type="checkbox"]').length > 0;

                $(`#${viewId} .kn-table thead tr th`).each(function (index) {
                    if (index === 0 && hasBulkOperationColumn)
                        return; // Skip Bulk Checkboxes Column

                    if (!$(this).find('.ktlHideShowColumnIcon').length) {
                        $(this).prepend('<i class="ktlHideShowColumnIcon fa fa-caret-left" />');
                    }
                });

                $(`#${viewId} thead th .table-fixed-label`).css('display', 'inline-flex');

                function getCollapsedColumns() {
                    const activeFilter = ktl.userFilters.getActiveFilter(viewId);

                    if (activeFilter && activeFilter['collapsed'])
                        return activeFilter['collapsed'];
                    else
                        return (getUrlParameter(`${viewId}_collapsed`) || '' ).split(',').filter(value => value != '');
                }

                getCollapsedColumns().forEach(title => {
                    $(`#${viewId} .kn-table th`).each((index, element) => {
                        if ( $(element).text().trim() === title)
                            hideColumn(viewId, index + 1);
                    })
                });

                function showColumn(viewId, columnIndex) {
                    $(`#${viewId} .kn-table th:nth-child(${columnIndex}) i`).show();
                    $(`#${viewId} .kn-table tr`).find(`th:nth-child(${columnIndex}), td:nth-child(${columnIndex})`)
                        .css('width', '') // Reset width
                        .css('min-width', '')
                        .css('padding', '')
                        .removeClass('ktlCollapsedColumn')
                        .off('click.ktl-hsc');
                }

                function hideColumn(viewId, columnIndex) {
                    $(`#${viewId} .kn-table tr`).find(`th:nth-child(${columnIndex}), td:nth-child(${columnIndex})`)
                        .css('width', cfg.hscCollapsedColumnsWidth + 'px')
                        .css('min-width', cfg.hscCollapsedColumnsWidth + 'px')
                        .css('padding', '0px')
                        .addClass('ktlCollapsedColumn');

                    // Replace click events to unshrink column on the next event
                    $(`#${viewId} .kn-table th.ktlCollapsedColumn, #${viewId} .kn-table td.ktlCollapsedColumn`).off('click.ktl-hsc').bindFirst('click.ktl-hsc', function (headerClickEvent) {
                        headerClickEvent.preventDefault();
                        headerClickEvent.stopPropagation();
                        headerClickEvent.stopImmediatePropagation();
                        showColumn(viewId, headerClickEvent.currentTarget.cellIndex + 1);
                    });
                }

                $(`#${viewId} .kn-table thead i.ktlHideShowColumnIcon`).on('click', function (iconClickEvent) {
                    iconClickEvent.preventDefault();
                    iconClickEvent.stopPropagation();

                    const columnIndex = $(this).parent().index() + 1;
                    const title = $(this).parent().text().trim();
                    let collapsedColumn = getCollapsedColumns();

                    if($(this).parent().hasClass('ktlCollapsedColumn')) {
                        showColumn(viewId, columnIndex);
                        collapsedColumn = collapsedColumn.filter( t => t != title);
                    } else {
                        hideColumn(viewId, columnIndex);
                        if (collapsedColumn.findIndex(t => t === title) < 0)
                            collapsedColumn.push(title);
                    }

                    if (!ktl.userFilters.appendToActiveFilter(viewId, 'collapsed', collapsedColumn)) {
                        let parameters = `${viewId}_collapsed=${collapsedColumn.join(',')}`;
                        const [url, params] = document.location.href.split('?');

                        if (params) {
                            const filteredParams = params.split('&').filter(v => !v.includes(`${viewId}_collapsed`));
                            filteredParams.push(parameters);
                            parameters = filteredParams.join('&');
                        }

                        window.history.replaceState(null, 'unused', [url, parameters].join('?'));
                    }
                });
            },

            disableLinks: function (viewId, keywords) {
                if (!viewId) return;

                const kw = '_dl';
                let options;

                if (keywords[kw].length && keywords[kw][0].options) {
                    options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                var linkSelector = '.knTable td a, .kn-detail-body a';

                //Apply to all views if ktlTarget is page.
                if (options && (!options.ktlTarget || options.ktlTarget !== 'page'))
                    linkSelector = '#' + viewId + ' ' + linkSelector;

                const linkElement = $(linkSelector);
                linkElement.off('click').on('click', e => {
                    const target = e.target;
                    let preventClick = false;

                    if (target.classList.contains('kn-link'))
                        preventClick = true;
                    else {
                        let fieldId;
                        let fld = target.closest('[class^="field_"]');
                        if (fld)
                            fieldId = fld.getAttribute('data-field-key');
                        else {
                            const detailsView = $(target).closest('.kn-detail');
                            if (detailsView.length)
                                fieldId = detailsView.attr('class').split(/\s+/)[1];
                        }

                        if (!fieldId || !fieldId.startsWith('field_')) return;

                        const fieldType = ktl.fields.getFieldType(fieldId);
                        if (fieldType === 'link')
                            preventClick = true;
                    }

                    if (preventClick && e.target.href)
                        e.preventDefault();
                })

            },

            /** Stick table Headers
             * @param {string} viewId
             * @param {number} viewHeight */
            stickTableHeader: function (viewId, viewHeight) {
                const zIndex = (Knack.app.attributes.design.regions.header.isLegacy) ? 2 : 0;
                $(`#${viewId} table, #${viewId} .kn-table-wrapper`)
                    .css('height', viewHeight + 'px')
                    .find('th')
                    .css({ 'position': 'sticky', 'top': '-2px', 'z-index': zIndex });
            },

            /** Stick table Columns
             * @param {string} viewId
             * @param {number} numOfColumns
             * @param {string} stickyColBkgdColor */
            stickTableColumns: function (viewId, numOfColumns, stickyColBkgdColor) {
                let stickyColWidth = 0;
                for (let i = 1; i <= numOfColumns; i++) {
                    const tableHeadSelector = $(`#${viewId} thead tr th:nth-child(${i})`);
                    const tableBodySelector = $(`#${viewId} tbody tr td:nth-child(${i})`);
                    const columnWidth = tableHeadSelector.outerWidth();
                    stickyColWidth += columnWidth;
                    tableHeadSelector.css({ 'z-index': 3, 'position': 'sticky', 'left': (stickyColWidth - columnWidth) + 'px' });
                    tableBodySelector.css({ 'z-index': 1, 'position': 'sticky', 'left': (stickyColWidth - columnWidth) + 'px', 'background-color': stickyColBkgdColor });
                }
            },

            viewHasInlineEdit: function (viewId) {
                try {
                    if (!viewId) return;
                    var viewModel = Knack.router.scene_view.model.views._byId[viewId];
                    if (!viewModel) return;

                    var viewAttr = viewModel.attributes;
                    const viewType = viewAttr.type;
                    if (!['table', 'search'].includes(viewType)) return;

                    var inlineEditing = false;
                    if (viewType === 'table')
                        inlineEditing = (viewAttr.options && viewAttr.options.cell_editor ? viewAttr.options.cell_editor : false);
                    else
                        inlineEditing = (viewAttr.cell_editor ? viewAttr.cell_editor : false);

                    return inlineEditing;
                } catch (e) {
                    return false;
                }
            },

            getViewObject: function (viewId) {
                if (!viewId) return;

                let view = Knack.views[viewId];
                if (!view) {
                    const scenes = Knack.scenes.models;
                    for (const scene of scenes) {
                        for (const view of scene.views.models) {
                            if (view.attributes.key === viewId)
                                return view.attributes;
                        }
                    }
                }

                return view.model.view;
            },

            //Used to perform bulk edits and copies of records programmatically.
            processAutomatedBulkOps: function (bulkOpsViewId, bulkOpsRecordsArray, requestType = 'PUT', viewsToRefresh = [], showSpinner = true, enableShowProgress = true) {
                return new Promise(function (resolve, reject) {
                    if (!bulkOpsViewId || !bulkOpsRecordsArray || !bulkOpsRecordsArray.length || !requestType)
                        return reject('Called processAutomatedBulkOps with invalid parameters.');

                    const objName = ktl.views.getViewSourceName(bulkOpsViewId);

                    enableShowProgress && ktl.core.infoPopup();
                    ktl.views.autoRefresh(false);
                    ktl.scenes.spinnerWatchdog(false);

                    var arrayLen = bulkOpsRecordsArray.length;

                    var idx = 0;
                    var countDone = 0;
                    var itv = setInterval(() => {
                        if (idx < arrayLen)
                            updateRecord(bulkOpsRecordsArray[idx++]);
                        else
                            clearInterval(itv);
                    }, 150);

                    function updateRecord(apiData) {
                        let recId = null;
                        if (!apiData || $.isEmptyObject(apiData)) return;

                        showProgress();

                        if (requestType.toUpperCase() === 'PUT') {
                            recId = apiData.id;
                            delete apiData.id;
                        }

                        ktl.core.knAPI(bulkOpsViewId, recId, apiData, requestType, viewsToRefresh, showSpinner)
                            .then(function (data) {
                                if (++countDone === bulkOpsRecordsArray.length) {
                                    bulkOpsRecordsArray = [];
                                    Knack.showSpinner();
                                    ktl.core.removeInfoPopup();
                                    ktl.views.refreshView(bulkOpsViewId).then(function () {
                                        ktl.core.removeTimedPopup();
                                        ktl.scenes.spinnerWatchdog();
                                        setTimeout(function () {
                                            ktl.views.autoRefresh();
                                            Knack.hideSpinner();
                                            return resolve(countDone);
                                        }, 1000);
                                    })
                                } else
                                    showProgress();
                            })
                            .catch(function (reason) {
                                ktl.core.removeInfoPopup();
                                ktl.core.removeTimedPopup();
                                Knack.hideSpinner();
                                ktl.scenes.spinnerWatchdog();
                                ktl.views.autoRefresh();
                                return reject('processAutomatedBulkOps error: ' + JSON.parse(reason.responseText).errors[0].message);
                            })

                        function showProgress() {
                            enableShowProgress && ktl.core.setInfoPopupText('Updating ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (arrayLen - countDone));
                        }
                    }
                })
            },

            waitViewDataReady: function (viewId) {
                return new Promise(function (resolve, reject) {
                    if (!viewId || !Knack.views[viewId])
                        return reject();

                    if (Knack.views[viewId].record || Knack.views[viewId].model.data.total_records)
                        return resolve();

                    const itv = setInterval(() => {
                        if (Knack.views[viewId].record || Knack.views[viewId].model.data.total_records) {
                            clearInterval(itv);
                            return resolve();
                        }
                    }, 100);

                    setTimeout(() => { //Failsafe
                        clearInterval(itv);
                        reject();
                    }, 20000);
                })
            },

            //Will return the KTL add-ons div for this view, and create it if doesn't exist.
            //This is where we add all KTL-related buttons and indicators.
            getKtlAddOnsDiv: function (viewId) {
                if (!viewId) return;

                let ktlAddonsDiv = document.querySelector(`#${viewId} .ktlAddonsDiv`);
                if (!ktlAddonsDiv) {
                    var prepend = false;
                    var searchFound = false;

                    var div = document.querySelector(`#${viewId} .table-keyword-search .control.has-addons`);
                    if (div) {
                        searchFound = true;
                    } else
                        div = document.querySelector(`#${viewId} .kn-submit.control`); //For search views.

                    if (!div)
                        div = document.querySelector(`#${viewId} .view-header`);

                    if (!div) {
                        div = document.querySelector('#' + viewId);
                        if (!div) return; //Support other layout options as we go.
                        prepend = true;
                    }

                    ktlAddonsDiv = document.createElement('div');
                    ktlAddonsDiv.classList.add('ktlAddonsDiv');

                    if (searchFound) {
                        if (Knack.isMobile())
                            $(ktlAddonsDiv).css('margin-top', '2%');
                        else
                            ktlAddonsDiv.classList.add('ktlAddonsWithSearchDiv');
                    }

                    if (prepend)
                        $(div).prepend(ktlAddonsDiv);
                    else
                        ktl.core.insertAfter(ktlAddonsDiv, div);
                }

                return ktlAddonsDiv;
            },

        } //return
    })(); //Views feature

    //====================================================
    //Scenes feature
    this.scenes = (function () {
        var spinnerCtrDelay = 30;
        var spinnerCtr = 0;
        var spinnerInterval = null;
        var spinnerWdExcludeScn = [];
        var spinnerWdRunning = false;
        var idleWatchDogTimer = null;
        var ktlKioskButtons = {};
        var prevScene = '';
        var idleWatchDogDelay = 0;
        var versionDisplayName = '';
        var showHiddenElem = false;

        //App callbacks
        var onSceneRender = null;
        var autoFocus = null;
        var spinnerWatchDogTimeout = null;
        var idleWatchDogTimeout = null;
        var processMutation = null;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (Knack.router.current_scene_key !== scene.key) {
                alert('ERROR - Scene keys do not match!');
                return;
            }

            //Leaving more time to iFrameWnd has proven to reduce errors and improve stability.
            //Anyways... no one is getting impatient at an invisible window!
            if (window.self.frameElement && (window.self.frameElement.id === IFRAME_WND_ID))
                spinnerCtrDelay = 60;

            ktl.scenes.spinnerWatchdog();
            ktl.iFrameWnd.create();
            ktl.views.autoRefresh();
            ktl.scenes.resetIdleWatchdog();
            ktl.fields.convertNumToTel();
            ktl.core.sortMenu();

            //Handle Scene change.
            if (prevScene !== scene.key) {
                addMenuTitleToTab();

                if (prevScene) //Do not log navigation on first page - useless and excessive.  We only want transitions.
                    ktl.log.addLog(ktl.const.LS_NAVIGATION, scene.key + ', ' + JSON.stringify(ktl.core.getMenuInfo()), false);

                prevScene = scene.key;
            }

            var lastSavedVersion = ktl.storage.lsGetItem('APP_KTL_VERSIONS');
            if (!lastSavedVersion || lastSavedVersion !== APP_KTL_VERSIONS) {
                ktl.log.addLog(ktl.const.LS_INFO, 'KEC_1013 - Updated software: ' + APP_KTL_VERSIONS);
                ktl.storage.lsSetItem('APP_KTL_VERSIONS', APP_KTL_VERSIONS);
            }

            addFooter(ktlKeywords.ktlAppFooter);

            onSceneRender && onSceneRender(event, scene, appInfo);
        })

        var modalScanItv;
        $(document).on('knack-view-render.any', function (event, view, data) {
            //Kiosk buttons must be added each time a view is rendered, otherwise they disappear after a view's refresh.
            ktl.scenes.addKioskButtons(view.key, {});

            if (view.scene && view.scene.modal === true) {
                addMenuTitleToTab(); //Need this because scene is not always rendered if we open a modal several times in a row.
                //Check for modal close
                modalScanItv = setInterval(() => {
                    if (!$('.kn-modal-bg').length) {
                        clearInterval(modalScanItv);
                        addMenuTitleToTab();
                    }
                }, 500)
            }

        })

        $(document).on('mousedown', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('mousemove', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('keypress', function (e) { ktl.scenes.resetIdleWatchdog(); })

        //Early detection of scene change to prevent multi-rendering and flickering of views.
        var sceneChangeObservers = [];
        var newScene = '';
        setInterval(function () {
            if (!window.self.frameElement || (window.self.frameElement && window.self.frameElement.id !== IFRAME_WND_ID)) {
                if (Knack.router.current_scene_key !== newScene) {
                    const previousScene = newScene;
                    newScene = Knack.router.current_scene_key;
                    sceneChangeObservers.forEach(obs => {
                        if (typeof obs === 'function')
                            obs({ newScene: newScene, previousScene: previousScene });
                    })

                    sceneChangeObservers = [];
                }
            }
        }, 100);

        function addMenuTitleToTab() {
            var page = ktl.core.getMenuInfo().page;
            (ktl.core.getCfg().enabled.showMenuInTitle && page) && (document.title = Knack.app.attributes.name + ' - ' + page); //Add menu to browser's tab.
        }

        function addFooter(footerSlug) {
            if (!footerSlug) return;
            const footerHTML = Knack.scenes._byId[footerSlug].views.models[0].attributes.content;

            const footerElement = document.createElement('footer');
            footerElement.innerHTML = footerHTML;
            footerElement.id = 'ktlFooter';
            footerElement.style.textAlign = 'left';
            footerElement.style.padding = '20px';
            footerElement.style.marginLeft = '10px';
            // Additional styling as needed

            if (!document.getElementById('ktlFooter'))
                document.body.appendChild(footerElement);
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.idleWatchDogDelay && (idleWatchDogDelay = cfgObj.idleWatchDogDelay);
                cfgObj.idleWatchDogTimeout && (idleWatchDogTimeout = cfgObj.idleWatchDogTimeout);
                cfgObj.spinnerWdExcludeScn && (spinnerWdExcludeScn = cfgObj.spinnerWdExcludeScn);
                cfgObj.spinnerWatchDogTimeout && (spinnerWatchDogTimeout = cfgObj.spinnerWatchDogTimeout);
                cfgObj.spinnerCtrDelay && (spinnerCtrDelay = cfgObj.spinnerCtrDelay);
                cfgObj.autoFocus && (autoFocus = cfgObj.autoFocus);
                cfgObj.ktlKioskButtons && (ktlKioskButtons = cfgObj.ktlKioskButtons);
                cfgObj.onSceneRender && (onSceneRender = cfgObj.onSceneRender);
                if (typeof cfgObj.versionDisplayName === 'string')
                    (versionDisplayName = cfgObj.versionDisplayName);
                cfgObj.processMutation && (processMutation = cfgObj.processMutation);

            },

            getCfg: function () {
                return {
                    idleWatchDogDelay,
                    versionDisplayName,
                    ktlKioskButtons,
                    processMutation,
                }
            },

            autoFocus: function () {
                if (!ktl.core.getCfg().enabled.autoFocus) return;

                if (!document.querySelector('#cell-editor')) //If inline editing uses chznBetter, keep focus here after a succesful search.
                    autoFocus && autoFocus();
            },

            //Improved version of Knack.router.scene_view.renderViews(), with a promise that resolves only after all views have rendered.
            renderViews: function () {
                return new Promise(function (resolve, reject) {
                    //console.log('ktl.scenes.renderViews.caller =', ktl.scenes.renderViews.caller);

                    var allViews = [];
                    var views = Knack.router.scene_view.model.views.models;
                    for (var i = 0; i < views.length; i++)
                        allViews.push(views[i].id);

                    ktl.views.refreshViewArray(allViews)
                        .then(() => {
                            resolve();
                        })
                        .catch(reason => {
                            ktl.log.clog('purple', 'Error encountered in renderViews', reason);
                        })
                })
            },

            //Add default extra buttons to facilitate Kiosk mode:  Refresh, Back, Done and Messaging
            //Excludes all iFrames and all view titles must not contain _kn keyword.
            addKioskButtons: function (viewId = '') {
                if (!viewId || window.self.frameElement || !ktl.core.isKiosk())
                    return;

                try {
                    if (typeof Knack.views[viewId] === 'undefined' || typeof Knack.views[viewId].model.view.title === 'undefined')
                        return;

                    var keywords = ktlKeywords[viewId];
                    if (!keywords) return;
                    if (keywords._kn)
                        return;

                    if (keywords._kr) {
                        var messagingBtn;
                        var refreshBtn;
                        var backBtn;

                        //Find the first bar that exists, in this top-down order priority.
                        var kioskButtonsParentDivSel = '#' + viewId + ' .kn-submit, .kn-submit';
                        var kioskButtonsParentDiv = document.querySelector(kioskButtonsParentDivSel);
                        if (!kioskButtonsParentDiv) {
                            //Happens with pages without a Submit button.  Ex: When you only have a table.
                            //Then, try with kn-title or kn-records-nav div.
                            kioskButtonsParentDivSel = '#' + viewId + ' .kn-title, #' + viewId + ' .kn-records-nav';
                            kioskButtonsParentDiv = document.querySelector(kioskButtonsParentDivSel);
                            if (!kioskButtonsParentDiv) {
                                ktl.log.clog('purple', 'ERROR - Could not find a div to attach Kiosk buttons.');
                                return;
                            }
                        }

                        for (var kioskBtn in ktlKioskButtons) {
                            if (kioskBtn === 'ADD_MESSAGING' && !ktlKioskButtons.ADD_MESSAGING.scenesToExclude.includes(Knack.router.current_scene_key)) {
                                messagingBtn = document.getElementById(ktlKioskButtons.ADD_MESSAGING.id);
                                if (!messagingBtn) {
                                    messagingBtn = document.createElement('BUTTON');
                                    messagingBtn.classList.add('kn-button', 'smallKioskButtons');
                                    messagingBtn.id = ktlKioskButtons.ADD_MESSAGING.id;
                                    messagingBtn.innerHTML = ktlKioskButtons.ADD_MESSAGING.html;

                                    messagingBtn.addEventListener('click', function (e) {
                                        e.preventDefault();
                                        window.location.href = ktlKioskButtons.ADD_MESSAGING.href;
                                        ktl.storage.lsRemoveItem(ktl.const.LS_SYSOP_MSG_UNREAD);
                                    });
                                }
                            } else if (kioskBtn === 'ADD_REFRESH') {
                                if (!document.getElementById(ktlKioskButtons.ADD_REFRESH.id)) {
                                    refreshBtn = document.createElement('BUTTON');
                                    refreshBtn.classList.add('kn-button', 'smallKioskButtons');

                                    refreshBtn.id = ktlKioskButtons.ADD_REFRESH.id;
                                    refreshBtn.innerHTML = ktlKioskButtons.ADD_REFRESH.html;

                                    refreshBtn.addEventListener('click', function (e) {
                                        e.preventDefault();
                                        ktlKioskButtons.ADD_REFRESH.href();
                                    });
                                }
                            } else if (kioskBtn === 'ADD_BACK' || kioskBtn === 'ADD_DONE') {
                                var btnKey;
                                if (keywords._kb)
                                    btnKey = 'ADD_BACK';
                                else if (keywords._kd)
                                    btnKey = 'ADD_DONE';

                                if (btnKey && !document.getElementById(ktlKioskButtons.ADD_BACK.id)) {
                                    backBtn = document.createElement('BUTTON');
                                    backBtn.classList.add('kn-button', 'smallKioskButtons');

                                    backBtn.id = ktlKioskButtons[btnKey].id;
                                    backBtn.innerHTML = ktlKioskButtons[btnKey].html;

                                    backBtn.addEventListener('click', function (e) {
                                        e.preventDefault();

                                        //Exceptions, where we want to jump to a specific URL.
                                        //Also used to bypass history, like when user does a few searches.
                                        var href = $('#' + ktlKioskButtons[btnKey].id).attr('href');
                                        if (href)
                                            window.location.href = window.location.href.slice(0, window.location.href.indexOf('#') + 1) + href;
                                        else {
                                            if (typeof ktlKioskButtons[btnKey].href === 'function')
                                                ktlKioskButtons[btnKey].href();
                                            else
                                                window.location.href = ktlKioskButtons[btnKey].href;
                                        }
                                    });
                                }
                            } else if (kioskBtn === 'ADD_SHIFT') {
                                //Add Shift button right next to Submit.
                                var shiftBtn = ktlKioskButtons.ADD_SHIFT && document.getElementById(ktlKioskButtons.ADD_SHIFT.id);
                                if (!shiftBtn && !ktlKioskButtons.ADD_SHIFT.scenesToExclude.includes(Knack.router.current_scene_key)) {
                                    shiftBtn = document.createElement('BUTTON');
                                    shiftBtn.classList.add('kn-button', 'ktlKioskButtons');
                                    shiftBtn.style.marginLeft = '30px';
                                    shiftBtn.id = ktlKioskButtons.ADD_SHIFT.id;

                                    ktl.core.waitSelector(kioskButtonsParentDivSel, 10000, 'visible')
                                        .then(() => {
                                            kioskButtonsParentDiv.appendChild(shiftBtn);
                                            ktlKioskButtons.ADD_SHIFT.html(ktl.userPrefs.getUserPrefs().workShift);

                                            shiftBtn.addEventListener('click', function (e) {
                                                e.preventDefault();
                                                window.location.href = ktlKioskButtons.ADD_SHIFT.href;
                                            });
                                        })
                                        .catch(function () { })
                                }
                            } else { //Other custom kiosk buttons from App.
                                var kioskAppBtn = ktlKioskButtons[kioskBtn] && document.getElementById(ktlKioskButtons[kioskBtn].id);
                                if (!kioskAppBtn && !ktlKioskButtons[kioskBtn].scenesToExclude.includes(Knack.router.current_scene_key)) {
                                    kioskAppBtn = document.createElement('BUTTON');
                                    kioskAppBtn.classList.add('kn-button', 'smallKioskButtons');
                                    kioskAppBtn.style.marginLeft = '30px';
                                    kioskAppBtn.id = ktlKioskButtons[kioskBtn].id;

                                    //Add custom app button at the right of Submit.
                                    ktl.core.waitSelector(kioskButtonsParentDivSel, 10000, 'visible')
                                        .then(() => {
                                            kioskButtonsParentDiv.appendChild(kioskAppBtn);

                                            const typeHtml = typeof ktlKioskButtons[kioskBtn].html;
                                            if (typeHtml === 'function')
                                                ktlKioskButtons[kioskBtn].html(viewId, kioskAppBtn);
                                            else
                                                kioskAppBtn.innerHTML = ktlKioskButtons[kioskBtn].html;

                                            const hrefClick = ktlKioskButtons[kioskBtn].href;
                                            if (hrefClick) {
                                                kioskAppBtn.addEventListener('click', function (e) {
                                                    e.preventDefault();
                                                    var href = $('#' + ktlKioskButtons[kioskBtn].id).attr('href');
                                                    if (href)
                                                        window.location.href = window.location.href.slice(0, window.location.href.indexOf('#') + 1) + href;
                                                    else {
                                                        if (typeof hrefClick === 'function')
                                                            hrefClick(viewId, kioskAppBtn.id);
                                                        else
                                                            window.location.href = hrefClick;
                                                    }
                                                });
                                            }
                                        })
                                        .catch(function () { })
                                }
                            }
                        } //for in loop

                        var kioskButtonsDiv = document.querySelector('.kioskButtonsDiv');
                        if (!kioskButtonsDiv) {
                            kioskButtonsDiv = document.createElement('div');
                            kioskButtonsDiv.setAttribute('class', 'kioskButtonsDiv');

                            ktl.core.waitSelector(kioskButtonsParentDivSel, 10000, 'visible')
                                .then(() => {
                                    kioskButtonsParentDiv.appendChild(kioskButtonsDiv);
                                })
                                .catch(function () { })
                        }

                        var knMenuBar = document.querySelector('.kn-menu'); //Get first menu in page.
                        if (knMenuBar) {
                            var menuSel = '#' + knMenuBar.id + '.kn-menu .control';
                            ktl.core.waitSelector(menuSel, 15000, 'visible')
                                .then(function () {
                                    ktl.core.hideSelector('#' + knMenuBar.id);
                                    var menuCopy = knMenuBar.cloneNode(true);
                                    menuCopy.id += '_copy';
                                    $('.kioskButtonsDiv').prepend($(menuCopy));
                                    ktl.core.hideSelector('#' + menuCopy.id, true);

                                    $('.kn-submit').css({ 'display': 'inline-flex', 'width': '100%' });
                                    $('.kn-menu').css({ 'display': 'inline-flex', 'margin-right': '30px' });
                                    applyStyle(); //Need to apply once again due to random additional delay.
                                })
                                .catch(function () {
                                    ktl.log.clog('purple', 'menu bar not found');
                                })
                        } else {
                            if (kioskButtonsParentDivSel.includes('kn-title'))
                                $('#' + viewId + ' .kn-title').css('display', 'flex');
                            else
                                $('.kn-submit').css('display', 'flex');
                        }

                        backBtn && kioskButtonsDiv.appendChild(backBtn);
                        refreshBtn && kioskButtonsDiv.appendChild(refreshBtn);
                        messagingBtn && kioskButtonsDiv.appendChild(messagingBtn);
                    }

                    applyStyle();

                    function applyStyle() {
                        ktl.core.waitSelector(kioskButtonsParentDivSel, 10000, 'visible')
                            .then(() => {
                                //Make all buttons same size and style.
                                const scnId = Knack.views[viewId].model.view.scene.key;
                                const kbs = (ktlKeywords[scnId] && ktlKeywords[scnId]._kbs);
                                if (!kbs) {
                                    //Apply plain, default style if no _kbs found.
                                    $('.kn-button:not(.search,.devBtn)').addClass('ktlKioskButtons');
                                    for (var i = 0; i < Knack.router.scene_view.model.views.length; i++) {
                                        if (Knack.router.scene_view.model.views.models[i].attributes.type === 'form') {
                                            $('.kn-button:not(.search,.devBtn)').addClass('ktlFormKioskButtons');
                                            break;
                                        }
                                    }
                                } else {
                                    //Apply custom style.
                                    //The style is a string that has the same format as in the Elements view.
                                    //Ex: 'height:50px;font-weight:700;min-width:150px;'
                                    if (kbs && kbs.length)
                                        $('.kn-button:not(.search,.devBtn)').css('cssText', kbs[0].params[0]);
                                }

                                $('.kioskButtonsDiv').css({ 'position': 'absolute', 'right': '2%' });
                            })
                            .catch(() => { })
                    }
                }
                catch (e) {
                    ktl.log.clog('purple', 'addKioskButtons exception:');
                    console.log(e);
                }
            },

            spinnerWatchdog: function (run = true) {
                if (!ktl.core.getCfg().enabled.spinnerWatchDog) return;

                if (spinnerWdExcludeScn.includes(Knack.router.current_scene_key) || (ktlKeywords[Knack.router.current_scene_key] && ktlKeywords[Knack.router.current_scene_key]._nswd))
                    run = false;

                if (run) {
                    //ktl.log.clog('green', 'SWD running ' + Knack.router.current_scene_key);
                    clearInterval(spinnerInterval);
                    spinnerCtr = spinnerCtrDelay;
                    spinnerInterval = setInterval(function () {
                        if ($('#kn-loading-spinner').is(':visible') ||
                            $('.kn-spinner').is(':visible') ||
                            $('.kn-button.is-primary').is(':disabled')) {
                            if (spinnerCtr-- > 0) {
                                if (spinnerCtr < spinnerCtrDelay - 10)
                                    ktl.core.timedPopup('Please wait... ' + (spinnerCtr + 1).toString() + ' seconds', 'success', 1100); //Allow a 100ms overlap to prevent blinking.
                            } else {
                                ktl.log.addLog(ktl.const.LS_INFO, 'KEC_1010 - Spinner Watchdog Timeout in ' + Knack.router.current_scene_key); //@@@ Replace by a weekly counter.
                                spinnerWatchDogTimeout && spinnerWatchDogTimeout(); //Callback to your App for specific handling.
                            }
                        } else {
                            spinnerCtr = spinnerCtrDelay;
                        }
                    }, 1000);
                } else {
                    clearInterval(spinnerInterval);
                    //ktl.log.clog('purple', 'SWD stopped ' + Knack.router.current_scene_key);
                }

                spinnerWdRunning = run;
            },

            isSpinnerWdRunning: function () {
                return spinnerWdRunning;
            },

            //Attention getter or status outcome indicator.
            //Useful on small devices, when monitoring from far away, ex: flash green/white upon success.
            flashBackground: function (color1 = null, color2 = null, delayBetweenColors = 0, duration = 0) {
                if (color1 === null || delayBetweenColors === 0 || duration === 0)
                    return;

                var initialBackgroundColor = $("#knack-body").css('background-color');

                var run = true;
                var intervalId = null;
                intervalId = setInterval(function () {
                    if (run) {
                        $("#knack-body").css({ 'background-color': color1 });
                        setTimeout(function () {
                            if (run) {
                                $("#knack-body").css({ 'background-color': color2 });
                            }
                        }, delayBetweenColors / 2);
                    }
                }, delayBetweenColors);

                setTimeout(function () {
                    run = false;
                    clearInterval(intervalId);
                    $("#knack-body").css({ 'background-color': initialBackgroundColor });
                }, duration);
            },

            resetIdleWatchdog: function () {
                if (ktl.scenes.isiFrameWnd() || !ktl.core.getCfg().enabled.idleWatchDog) return;

                clearTimeout(idleWatchDogTimer);
                if (ktl.scenes.getCfg().idleWatchDogDelay > 0) {
                    idleWatchDogTimer = setTimeout(function () {
                        ktl.scenes.idleWatchDogTimeout();
                    }, ktl.scenes.getCfg().idleWatchDogDelay);
                }
            },

            idleWatchDogTimeout: function () {
                idleWatchDogTimeout && idleWatchDogTimeout();
            },

            //Searches for a view title in the current scene.
            //If a view Id is used as the first parameter, it will be returned as is.
            findViewWithTitle: function (viewTitle = '', exactMatch = true, excludeViewId = '') {
                var views = Knack.router.scene_view.model.views.models;
                var title = '';
                var viewId = '';
                viewTitle = viewTitle.toLowerCase();
                if (viewTitle.startsWith('view_'))
                    return viewTitle;
                try {
                    for (var i = 0; i < views.length; i++) {
                        viewId = views[i].attributes.key;
                        if (viewId === excludeViewId || !views[i].attributes.title) continue;
                        title = views[i].attributes.title.toLowerCase();
                        if (exactMatch && title === viewTitle)
                            return viewId;
                        if (!exactMatch && title.includes(viewTitle))
                            return viewId;
                    }
                }
                catch (e) {
                    ktl.log.clog('purple', 'Exception in findViewWithTitle:');
                    console.log(e);
                }
                return '';
            },

            //For KTL internal use.
            findViewWithKeyword: function (keyword = '', excludeViewId = '') {
                var views = Knack.router.scene_view.model.views.models; //Search only in current scene.
                var viewId = '';
                keyword = keyword.toLowerCase();
                try {
                    for (var i = 0; i < views.length; i++) {
                        viewId = views[i].attributes.key;
                        if (viewId === excludeViewId || $.isEmptyObject(ktlKeywords[viewId])) continue;
                        if (ktlKeywords[viewId][keyword]) {
                            if ((keyword === '_uvx' || keyword === '_uvc') && views[i].attributes.type !== 'search')
                                continue;
                            else
                                return viewId;
                        }
                    }
                }
                catch (e) {
                    ktl.log.clog('purple', 'Exception in findViewWithKeyword:');
                    console.log(e);
                }
            },

            scrollToTop: function () {
                window.scrollTo(0, 0);
            },

            //Note: if you provide your own div, then the viPos... options are ignored.
            addVersionInfo: function (info, style = '', div) {
                const vi = ktl.core.getCfg().enabled.versionInfo;
                if ((!vi.viShowAppInfo && !vi.viShowKtlInfo)
                    || !ktl.account.checkUserRolesMatch(vi.viShowToRoles)
                    || window.self.frameElement) return;

                if (document.querySelector('#addVersionInfoDiv')) return;

                //If style is provided use it, otherwise, use KTL's default.
                var versionStyle = style ? style : 'white-space: pre; font-size:small; font-weight:bold; border-style:none; padding-bottom:2px;';

                if (localStorage.getItem(info.lsShortName + 'dev') === null) //TODO: lsGetItem - fix and allow returing null if key doesn't exist.
                    versionStyle += '; color:#0008; background-color:#FFF3;';
                else //Dev mode, make version bright yellow/red font.
                    versionStyle += '; background-color:gold; color:red; font-weight: bold';

                //Build version info string.
                var appVer = vi.viShowAppInfo ? ktl.scenes.getCfg().versionDisplayName + ' v' + window.APP_VERSION : '';

                if (vi.viShowAppInfo && vi.viShowKtlInfo)
                    appVer += '    ';

                var ktlVer = vi.viShowKtlInfo ? 'KTL v' + KTL_VERSION : '';
                if (info.ktlVersion === 'dev')
                    ktlVer += '-dev';

                var versionInfo = appVer + ktlVer + (info.hostname ? '    ' + info.hostname : '');

                info.pre && (versionInfo = info.pre + '    ' + versionInfo);
                info.post && (versionInfo = versionInfo + '    ' + info.post);

                var addVersionInfoDiv = document.createElement('div');
                addVersionInfoDiv.setAttribute('id', 'addVersionInfoDiv');

                if (div)
                    div.appendChild(addVersionInfoDiv);
                else {
                    document.body.appendChild(addVersionInfoDiv);

                    const xPos = Knack.isMobile() ? vi.viPosXMobile : vi.viPosX;
                    const yPos = Knack.isMobile() ? vi.viPosYMobile : vi.viPosY;


                    $(addVersionInfoDiv).css({ 'position': 'absolute', 'z-index': '10' });
                    /*TODO: Investigate why sometimes the Version Info bar has a squarish ratio instead of a single line.
                    The line below solves this problem, but doesn't work in all cases, causing a worse problem: showing at bottom.*/
                    //$(addVersionInfoDiv).css({ 'position': 'absolute', 'z-index': '10', 'display': 'contents' });

                    if (xPos === 'left')
                        $(addVersionInfoDiv).css({ 'margin-left': '5px', 'left': '0px' });
                    else if (xPos === 'center')
                        $(addVersionInfoDiv).css({ 'left': '50%', 'transform': 'translate(-50%, 0)' });
                    else if (xPos === 'right')
                        $(addVersionInfoDiv).css({ 'margin-right': '5px', 'right': '0px' });

                    if (yPos === 'top')
                        $(addVersionInfoDiv).css({ 'top': '5px' });
                    else if (yPos === 'bottom')
                        $(addVersionInfoDiv).css({ 'padding-bottom': '5px' });
                }

                const viButton = ktl.fields.addButton(addVersionInfoDiv, versionInfo, versionStyle, [], 'verButtonId');
                document.documentElement.style.setProperty('--viBarOpacity', vi.viOpacity.toString() + '%');

                viButton.onmouseover = function () {
                    document.documentElement.style.setProperty('--viBarOpacity', vi.viOpacityHover.toString() + '%');
                };

                viButton.onmouseout = function () {
                    document.documentElement.style.setProperty('--viBarOpacity', vi.viOpacity.toString() + '%');
                };

                //Special Dev Options popup, require a PIN to access options.
                $('#verButtonId').on('click touchstart', function (e) {
                    var logoutBtn;
                    var kioskModeBtn;
                    if (kioskModeBtn) {
                        if (kioskModeBtn && ktl.core.isKiosk())
                            kioskModeBtn.textContent = 'Kiosk: Yes';
                        else
                            kioskModeBtn.textContent = 'Kiosk: No';
                    }

                    const pinAlreadyEntered = ktl.storage.lsGetItem('pinAlreadyEntered', false, true);
                    if (ktl.account.isDeveloper() || pinAlreadyEntered)
                        showDevPopup();
                    else {
                        ktl.core.createPopup(pw => {
                            if (pw === ktl.core.getCfg().devOptionsPin)
                                showDevPopup();
                        })
                    }

                    function showDevPopup() {
                        ktl.systemColors.getSystemColors()
                            .then((sc) => {
                                var sysColors = sc;

                                ktl.storage.lsSetItem('pinAlreadyEntered', true, false, true);
                                var userPrefsObj = ktl.userPrefs.getUserPrefs();

                                if ($('#devBtnsDivId').length) return;

                                var devBtnsDiv = document.createElement('div');
                                devBtnsDiv.setAttribute('id', 'devBtnsDivId');
                                devBtnsDiv.classList.add('devBtnsDiv');

                                //Header
                                var devBtnsDivHeader = document.createElement('div');
                                devBtnsDivHeader.setAttribute('id', 'devBtnsDivIdheader');
                                devBtnsDivHeader.style['background-color'] = sysColors.paleLowSatClr;
                                devBtnsDivHeader.classList.add('ktlDevToolsHeader');

                                devBtnsDivHeader.innerText = ':: KTL Developer Tools ::';
                                devBtnsDiv.appendChild(devBtnsDivHeader);

                                document.body.appendChild(devBtnsDiv);

                                //Only add Local Dev button if NodeJS file server is running.
                                ktl.core.checkLocalhostServer(3000)
                                    .then(() => {
                                        var devModeBtn = ktl.fields.addButton(devBtnsDiv, 'Dev/Prod', '', ['devBtn', 'kn-button']);
                                        const prod = (localStorage.getItem(APP_ROOT_NAME + 'dev') === null);
                                        devModeBtn.textContent = 'KTL Mode: ' + (prod ? 'Prod' : 'Local Dev');
                                        devModeBtn.addEventListener('click', () => {
                                            ktl.core.toggleMode();
                                        })

                                        addDevToolsButtons();
                                    })
                                    .catch(() => { addDevToolsButtons(); })

                                function addDevToolsButtons() {
                                    ktl.fields.addButton(devBtnsDiv, 'View IDs', '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                        userPrefsObj.showViewId = !userPrefsObj.showViewId;
                                        userPrefsObj.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                                        ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS, JSON.stringify(userPrefsObj));
                                        ktl.scenes.renderViews();
                                        if (ktl.core.getCfg().enabled.iFrameWnd && ktl.iFrameWnd.getiFrameWnd())
                                            ktl.wndMsg.send('userPrefsChangedMsg', 'req', ktl.const.MSG_APP, IFRAME_WND_ID, 0, JSON.stringify(userPrefsObj));
                                    })

                                    var showHiddenElemBtn = ktl.fields.addButton(devBtnsDiv, 'Hidden Elements: ' + (showHiddenElem ? 'Show' : 'Hide'), '', ['devBtn', 'kn-button']);
                                    showHiddenElemBtn.addEventListener('click', () => {
                                        showHiddenElem = !showHiddenElem;
                                        showHiddenElemBtn.textContent = 'Hidden Elements: ' + (showHiddenElem ? 'Show' : 'Hide');
                                        if (showHiddenElem) {
                                            $('.ktlHidden').replaceClass('ktlHidden', 'ktlHidden_dis');
                                            $('.ktlDisplayNone').replaceClass('ktlDisplayNone', 'ktlDisplayNone_dis');
                                        } else {
                                            $('.ktlHidden_dis').replaceClass('ktlHidden_dis', 'ktlHidden');
                                            $('.ktlDisplayNone_dis').replaceClass('ktlDisplayNone_dis', 'ktlDisplayNone');
                                        }
                                    })

                                    kioskModeBtn = ktl.fields.addButton(devBtnsDiv, 'Kiosk: No', '', ['devBtn', 'kn-button']);
                                    if (ktl.core.isKiosk())
                                        kioskModeBtn.textContent = 'Kiosk: Yes';

                                    kioskModeBtn.addEventListener('click', () => {
                                        if (ktl.core.isKiosk()) {
                                            kioskModeBtn.textContent = 'Kiosk: No';
                                            ktl.core.timedPopup('Switching back to Normal mode...');
                                        } else {
                                            kioskModeBtn.textContent = 'Kiosk: Yes';
                                            ktl.core.timedPopup('Switching to Kiosk mode...');
                                        }

                                        ktl.core.kioskMode();
                                        Knack.router.scene_view.render();
                                        processLogoutBtn(); //To update name, depending if visible of not.
                                    })

                                    const iFrmWndBtn = ktl.fields.addButton(devBtnsDiv, 'iFrameWnd: N/A', '', ['devBtn', 'kn-button']);
                                    if (ktl.core.getCfg().enabled.iFrameWnd && ktl.iFrameWnd.getiFrameWnd()) {
                                        iFrmWndBtn.textContent = 'iFrameWnd: ' + (userPrefsObj.showIframeWnd ? 'Show' : 'Hide');
                                        iFrmWndBtn.addEventListener('click', () => {
                                            userPrefsObj.showIframeWnd = !userPrefsObj.showIframeWnd;
                                            ktl.iFrameWnd.showIFrame(userPrefsObj.showIframeWnd);
                                            userPrefsObj.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                                            ktl.wndMsg.send('userPrefsChangedMsg', 'req', ktl.const.MSG_APP, IFRAME_WND_ID, 0, JSON.stringify(userPrefsObj));
                                            iFrmWndBtn.textContent = 'iFrameWnd: ' + (userPrefsObj.showIframeWnd ? 'Show' : 'Hide');
                                        })
                                    } else
                                        iFrmWndBtn.setAttribute('disabled', 'true');

                                    const dbgWnd = ktl.fields.addButton(devBtnsDiv, 'DebugWnd', '', ['devBtn', 'kn-button']);
                                    if (ktl.core.getCfg().enabled.debugWnd)
                                        dbgWnd.addEventListener('click', () => {
                                            if ($('#debugWnd').length)
                                                ktl.debugWnd.showDebugWnd(false);
                                            else
                                                ktl.debugWnd.showDebugWnd(true);
                                        })
                                    else
                                        dbgWnd.setAttribute('disabled', 'true');

                                    ktl.fields.addButton(devBtnsDiv, 'Reset Auto-Login', '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                        ktl.core.timedPopup('Erasing Auto-Login data...', 'warning', 1800);
                                        var loginInfo = ktl.storage.lsGetItem('AES_LI', true, false);
                                        if (loginInfo && loginInfo !== '') {
                                            if (loginInfo === 'SkipAutoLogin')
                                                ktl.storage.lsRemoveItem('AES_LI', true, false, false);
                                            else
                                                ktl.storage.lsRemoveItem('AES_LI', true, false, true);
                                        }

                                        ktl.storage.lsRemoveItem('AES_EK', true, false, false);

                                        setTimeout(() => {
                                            if (confirm('Do you want to logout?')) {
                                                ktl.account.logout();
                                                processLogoutBtn();
                                            }
                                        }, 500)
                                    })

                                    var remoteDev = (ktl.storage.lsGetItem('remoteDev', true) === 'true');
                                    ktl.fields.addButton(devBtnsDiv, 'Debug this device: ' + (remoteDev ? 'Yes' : 'No'), '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                        //This forces loading 'KTL-dev.js' debug code from CTRND's CDN, in Prod folder.
                                        //See 'remoteDev' in KTL_Start.js
                                        if (confirm('Use remote KTL-Dev.js code on this device?'))
                                            ktl.storage.lsSetItem('remoteDev', true, true);
                                        else
                                            ktl.storage.lsRemoveItem('remoteDev', true);
                                        location.reload(true);
                                    })

                                    //Bypass the KTL, but only for this session.
                                    ktl.fields.addButton(devBtnsDiv, 'Bypass KTL', '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                        if (confirm('Bypass KTL on this device?')) {
                                            ktl.storage.lsSetItem('bypassKtl', true, true, true);
                                            location.reload(true);
                                        }
                                    })

                                    //Execute custom code that is fetched from core's config.
                                    var devDebugCode = ktl.core.getCfg().devDebugCode;
                                    if (devDebugCode && devDebugCode !== '') {
                                        ktl.fields.addButton(devBtnsDiv, 'Exec devDebugCode', '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                            const exec = new Function('ktl', devDebugCode);
                                            exec(ktl);
                                        })
                                    }

                                    var searchBtn = ktl.fields.addButton(devBtnsDiv, 'Search...', '', ['devBtn', 'kn-button']);
                                    searchBtn.addEventListener('click', () => {
                                        if ($('#devToolSearchDivId').length) return;

                                        var devToolSearchDiv = document.createElement('div');
                                        devToolSearchDiv.setAttribute('id', 'devToolSearchDivId');
                                        devToolSearchDiv.classList.add('devBtnsDiv', 'devToolSearchDiv');

                                        var devToolSearchHdr = document.createElement('div');
                                        devToolSearchHdr.setAttribute('id', 'devToolSearchDivIdheader');
                                        devToolSearchHdr.style['background-color'] = sysColors.paleLowSatClr;
                                        devToolSearchHdr.classList.add('ktlDevToolsHeader');

                                        devToolSearchHdr.innerText = ':: KTL Search Tool ::';
                                        devToolSearchDiv.appendChild(devToolSearchHdr);
                                        document.body.appendChild(devToolSearchDiv);

                                        const devToolStorageName = 'devToolSearch';
                                        ktl.core.enableSortableDrag(devToolSearchDiv, debounce((position) => {
                                            ktl.storage.setItemJSON(devToolStorageName, position)
                                        }));

                                        const savedPosition = ktl.storage.getItemJSON(devToolStorageName);
                                        if (savedPosition) {
                                            devToolSearchDiv.style.left = savedPosition.left + 'px';
                                            devToolSearchDiv.style.top = savedPosition.top + 'px';
                                        } else
                                            ktl.core.centerElementOnScreen(devToolSearchDiv);

                                        var paragraph = document.createElement('p');
                                        paragraph.appendChild(document.createTextNode('Enter field_id, view_id, scene_id,\n'));
                                        paragraph.appendChild(document.createTextNode('a specific keyword or kw for all keywords.'));
                                        paragraph.style.whiteSpace = 'pre';
                                        devToolSearchDiv.appendChild(paragraph);

                                        var searchInput = document.createElement("input");
                                        searchInput.type = 'text';
                                        searchInput.value = '';
                                        searchInput.classList.add('ktlDevToolsSearchInput');
                                        devToolSearchDiv.appendChild(searchInput);
                                        searchInput.focus();

                                        var resultWndText;

                                        searchInput.addEventListener('keyup', function (event) {
                                            if (event.key === 'Enter') {
                                                performSearch(searchInput.value);
                                            }
                                        });

                                        searchInput.addEventListener('click', function (event) {
                                            searchInput.focus();
                                        })

                                        function performSearch(query) {
                                            if (!query) return;
                                            searchInput.classList.remove('ktlNotValid');
                                            console.log('Searching for:', query);

                                            $('.ktlDevToolLink').remove();

                                            var builderUrl;
                                            var appUrl;
                                            var kwResults;

                                            if (query.startsWith('field_')) {
                                                const field = Knack.objects.getField(query);
                                                if (field && field.id) {
                                                    const fieldId = field.id;
                                                    const objectId = Knack.objects.getField(fieldId).attributes.object_key;
                                                    builderUrl = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}/schema/list/objects/${objectId}/fields/${fieldId}/settings`;
                                                }
                                            } else if (query.startsWith('view_')) {
                                                for (var s = 0; s < Knack.scenes.models.length && !builderUrl; s++) {
                                                    var views = Knack.scenes.models[s].views;
                                                    for (var v = 0; v < views.models.length; v++) {
                                                        let view = views.models[v];
                                                        if (view) {
                                                            const attr = view.attributes;
                                                            const viewId = attr.key;
                                                            if (viewId === query) {
                                                                const sceneId = attr.scene.key;
                                                                builderUrl = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}/pages/${sceneId}/views/${viewId}/${attr.type}`;
                                                                const slug = Knack.scenes.getByKey(sceneId).attributes.slug;
                                                                appUrl = `${Knack.url_base}#${slug}`;
                                                                console.log('Open in App:', appUrl);
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            } else if (query.startsWith('scene_')) {
                                                for (var t = 0; t < Knack.scenes.models.length; t++) {
                                                    if (query === Knack.scenes.models[t].attributes.key) {
                                                        builderUrl = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}/pages/${query}`;
                                                        const slug = Knack.scenes.getByKey(query).attributes.slug;
                                                        appUrl = `${Knack.url_base}#${slug}`;
                                                        console.log('Open in App:', appUrl);
                                                        break;
                                                    }
                                                }
                                            } else if (query === 'kw') {
                                                kwResults = ktl.sysInfo.findAllKeywords();
                                            } else {
                                                kwResults = ktl.sysInfo.findAllKeywords(query);
                                            }

                                            if (builderUrl || appUrl || kwResults) {
                                                if (builderUrl) {
                                                    console.log('Open in Builder:', builderUrl);
                                                    const builderLink = document.createElement('a');
                                                    builderLink.classList.add('is-small', 'ktlDevToolLink');
                                                    builderLink.style.margin = '1em 0em 1em 0em';
                                                    builderLink.style['text-decoration'] = 'none';
                                                    builderLink.href = builderUrl;
                                                    builderLink.target = '_blank';
                                                    builderLink.innerHTML = `Open "${query}" in Builder`;
                                                    devToolSearchDiv.appendChild(builderLink);
                                                }

                                                if (appUrl) {
                                                    console.log('App URL:', appUrl);
                                                    const appLink = document.createElement('a');
                                                    appLink.classList.add('is-small', 'ktlDevToolLink');
                                                    appLink.style.margin = '0em 0em 0.75em 0em';
                                                    appLink.style['text-decoration'] = 'none';
                                                    appLink.href = appUrl;
                                                    appLink.target = '_self';
                                                    appLink.innerHTML = `Open "${query}" in App`;
                                                    devToolSearchDiv.appendChild(appLink);
                                                    appLink.addEventListener('click', () => {
                                                        setTimeout(() => {
                                                            searchInput.focus();
                                                        }, 1500);
                                                    })
                                                }

                                                if (kwResults) {
                                                    if (!$('#resultWndTextId').length) {
                                                        const DEFAULT_TOP = 80;
                                                        const DEFAULT_LEFT = 80;
                                                        const DEFAULT_HEIGHT = window.innerHeight - 160;
                                                        const DEFAULT_WIDTH = window.innerWidth - 80;

                                                        var resultWnd = document.createElement('div');
                                                        resultWnd.setAttribute('id', 'resultWndId');
                                                        resultWnd.style.top = DEFAULT_TOP + 'px';
                                                        resultWnd.style.left = DEFAULT_LEFT + 'px';
                                                        resultWnd.style['z-index'] = 15;
                                                        resultWnd.classList.add('devBtnsDiv', 'devToolSearchDiv');

                                                        var resultWndHdr = document.createElement('div');
                                                        resultWndHdr.setAttribute('id', 'resultWndIdheader');
                                                        resultWndHdr.classList.add('ktlDevToolsHeader');
                                                        resultWndHdr.style['background-color'] = sysColors.paleLowSatClr;
                                                        resultWndHdr.innerText = ':: KTL Search Results ::';
                                                        resultWnd.appendChild(resultWndHdr);

                                                        resultWndText = document.createElement('div');
                                                        resultWndText.setAttribute('id', 'resultWndTextId');
                                                        resultWndText.classList.add('ktlConsoleDiv');
                                                        resultWnd.appendChild(resultWndText);

                                                        document.body.appendChild(resultWnd);

                                                        resultWndText.innerHTML = kwResults;
                                                        resultWndText.style.height = Math.min(resultWndText.clientHeight, DEFAULT_HEIGHT) + 'px';
                                                        resultWndText.style.width = Math.min(resultWndText.clientWidth, DEFAULT_WIDTH) + 'px';

                                                        const devToolStorageName = 'devToolSearchResult';
                                                        ktl.core.enableSortableDrag(resultWnd, debounce((position) => {
                                                            ktl.storage.appendItemJSON(devToolStorageName, { ...position });
                                                        }));

                                                        const resizeObserver = new ResizeObserver(debounce((entries) => {
                                                            const entry = entries[0];
                                                            if (entry && entry.target.offsetWidth && entry.target.offsetWidth) {
                                                                ktl.storage.appendItemJSON(devToolStorageName, {
                                                                    width: entry.target.offsetWidth,
                                                                    height: entry.target.offsetHeight
                                                                });
                                                            }
                                                        }));
                                                        resizeObserver.observe(resultWndText);

                                                        const savedPosition = ktl.storage.getItemJSON(devToolStorageName);
                                                        if (savedPosition) {
                                                            resultWnd.style.left = (savedPosition.left || DEFAULT_LEFT) + 'px';
                                                            resultWnd.style.top = (savedPosition.top || DEFAULT_TOP) + 'px';

                                                            if (savedPosition.height && savedPosition.width) {
                                                                resultWndText.style.height = savedPosition.height + 'px';
                                                                resultWndText.style.width = savedPosition.width + 'px';
                                                            }
                                                        } else
                                                            ktl.core.centerElementOnScreen(resultWnd);

                                                    } else {
                                                        resultWndText.innerHTML = kwResults;
                                                    }
                                                }
                                            } else {
                                                console.log('Not found');
                                                searchInput.classList.add('ktlNotValid');
                                            }
                                        }
                                    })

                                    logoutBtn = ktl.fields.addButton(devBtnsDiv, '', '', ['devBtn', 'kn-button']);
                                    processLogoutBtn();
                                    logoutBtn.addEventListener('click', () => {
                                        if (confirm('Are you sure you want to logout?')) {
                                            ktl.account.logout();
                                            processLogoutBtn();
                                        }
                                    })

                                    function processLogoutBtn() {
                                        const isLoggedIn = ktl.account.isLoggedIn();
                                        var userName = isLoggedIn ? Knack.getUserAttributes().values.name.first : 'N/A';
                                        if (logoutBtn) {
                                            const userId = Knack.getUserAttributes().id;
                                            const userIsVisible = $('#' + userId).is(':visible');
                                            logoutBtn.textContent = 'Logout' + (userIsVisible ? '' : ': ' + userName);
                                            if (isLoggedIn)
                                                logoutBtn.removeAttribute('disabled');
                                            else
                                                logoutBtn.setAttribute('disabled', 'true');
                                        }
                                    }

                                    //Linux-specific devices - BEGIN
                                    const sys = ktl.sysInfo.getSysInfo();
                                    if (sys.os === 'Linux' /*&& sys.processor.includes('arm')*/) {
                                        addEditKioskPageBtn = ktl.fields.addButton(devBtnsDiv, 'Kiosk Setup Page', '', ['devBtn', 'kn-button']);
                                        addEditKioskPageBtn.addEventListener('click', () => {
                                            if (confirm('Go to kiosk setup page?'))
                                                window.location.href = window.location.href.slice(0, window.location.href.indexOf('#') + 1) + 'add-kiosk-device';
                                        })

                                        rebootBtn = ktl.fields.addButton(devBtnsDiv, 'Reboot', '', ['devBtn', 'kn-button']);
                                        rebootBtn.addEventListener('click', () => {
                                            if (confirm('Are you sure you want to reboot device?'))
                                                ktl.sysInfo.rebootDevice();
                                        })

                                        shutDownBtn = ktl.fields.addButton(devBtnsDiv, 'Shut Down', '', ['devBtn', 'kn-button']);
                                        shutDownBtn.addEventListener('click', () => {
                                            if (confirm('Are you sure you want to shut down device?'))
                                                ktl.sysInfo.shutDownDevice();
                                        })
                                    }
                                    //Linux-specific devices - END

                                    const closeBtn = ktl.fields.addButton(devBtnsDiv, 'Close', '', ['devBtn', 'kn-button']);
                                    closeBtn.addEventListener('click', () => {
                                        $('#devBtnsDivId').remove();
                                    })
                                    $(closeBtn).css('margin-top', '20px');

                                    //Now that all buttons are added, load position or calculate default at center.
                                    const devToolStorageName = 'devToolBtns';
                                    ktl.core.enableSortableDrag(devBtnsDiv, debounce((position) => {
                                        ktl.storage.setItemJSON(devToolStorageName, position);
                                    }));

                                    const savedPosition = ktl.storage.getItemJSON(devToolStorageName);
                                    if (savedPosition) {
                                        devBtnsDiv.style.left = savedPosition.left + 'px';
                                        devBtnsDiv.style.top = savedPosition.top + 'px';
                                    } else
                                        ktl.core.centerElementOnScreen(devBtnsDiv);
                                }
                            })
                    }

                    return false; //False to prevent firing both events on mobile devices.
                })

                //For Dev Options popup, act like a modal window: close when clicking oustide.
                $(document).on('click', function (e) {
                    if (e.target.closest('.kn-content') || (e.target && e.target.id && e.target.id === 'knack-body')) {
                        $('#popupDivId').remove();
                        if ($('#dbgWndId').length)
                            ktl.debugWnd.showDebugWnd(false);
                        else if ($('#resultWndId').length)
                            $('#resultWndId').remove();
                        else if ($('#devToolSearchDivId').length)
                            $('#devToolSearchDivId').remove();
                        else
                            $('#devBtnsDivId').remove();
                    }
                })
            },

            isiFrameWnd: function () {
                return (window.self.frameElement && (window.self.frameElement.id === IFRAME_WND_ID)) ? true : false;
            },

            sceneChangeNotificationSubscribe: function (callback) {
                if (!callback) return;

                //TODO: add only if not already existing.
                //Actually, see how we can change from array to object...
                if (!sceneChangeObservers.includes(callback))
                    sceneChangeObservers.push(callback);
            },

            getSceneKeyFromViewId: function (viewId) {
                if (!viewId) return;

                const view = Knack.views[viewId];
                if (view && view.model && view.model.view && view.model.view.scene)
                    return view.model.view.scene.key;

                const scenes = Knack.scenes.models;
                for (const scene of scenes) {
                    for (const views of scene.views.models) {
                        if (views.attributes.key === viewId)
                            return scene.attributes.key;
                    }
                }
            },
        }
    })(); //Scenes feature

    //====================================================
    //Logging feature
    this.log = (function () {
        var lastDetails = ''; //Prevent multiple duplicated logs.  //TODO: replace by a list of last 10 logs and a timestamp
        var mouseClickCtr = 0;
        var keyPressCtr = 0;
        var isActive = false; //Start monitoring activity only once.
        var logCategoryAllowed = null; //Callback function in your app that returns whether or not a category is to be logged, based on specific conditions.
        var cfg = {
            logEnabled: {},
        };

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (logCategoryAllowed && logCategoryAllowed(ktl.const.LS_ACTIVITY) && !mouseClickCtr && !keyPressCtr)
                monitorActivity();
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            if (ktl.scenes.isiFrameWnd() || (view.type !== 'table' && view.type !== 'search')) return;

            var fields = view.fields;
            if (!fields) return;

            var bulkOpsLudFieldId = '';
            var bulkOpsLubFieldId = '';
            var descr = '';

            for (var f = 0; f < view.fields.length; f++) {
                var field = fields[f];
                descr = field.meta && field.meta.description.replace(/(\r\n|\n|\r)|<[^>]*>/gm, " ").replace(/ {2,}/g, ' ').trim();
                descr === '_lud' && (bulkOpsLudFieldId = field.key);
                descr === '_lub' && (bulkOpsLubFieldId = field.key);
            }

            if (bulkOpsLudFieldId && bulkOpsLubFieldId) {
                $('#' + view.key + ' .cell-edit.' + bulkOpsLudFieldId).addClass('ktlNoInlineEdit');
                $('#' + view.key + ' .cell-edit.' + bulkOpsLubFieldId).addClass('ktlNoInlineEdit');
                $(document).off('knack-cell-update.' + view.key).on('knack-cell-update.' + view.key, function (event, view, record) {
                    Knack.showSpinner();
                    var apiData = {};
                    apiData[bulkOpsLudFieldId] = ktl.core.getFormattedCurrentDateTime(Knack.fields[bulkOpsLudFieldId].attributes.format.date_format);
                    apiData[bulkOpsLubFieldId] = [Knack.getUserAttributes().id];
                    ktl.core.knAPI(view.key, record.id, apiData, 'PUT', [view.key])
                        .then((updated) => { Knack.hideSpinner(); })
                        .catch(function (reason) {
                            Knack.hideSpinner();
                            alert('Error while processing Auto-Update log operation, reason: ' + JSON.stringify(reason));
                        })
                });
            }
        })

        function monitorActivity() {
            if (isActive || ktl.scenes.isiFrameWnd() || !ktl.storage.hasLocalStorage() || Knack.getUserAttributes() === 'No user found')
                return;
            else
                isActive = true;

            $(document).on('click', function (e) { mouseClickCtr++; })
            $(document).on('keypress', function (e) { keyPressCtr++; })

            setInterval(function () {
                ktl.log.updateActivity();
            }, 5000);
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.logCategoryAllowed && (logCategoryAllowed = cfgObj.logCategoryAllowed);
                cfgObj.logEnabled && (cfg.logEnabled = cfgObj.logEnabled);
            },

            getCfg: function () {
                return cfg;
            },

            //Colorized log with multiple parameters.
            clog: function (color = 'purple', ...logArray) {
                var msg = '';
                for (var i = 0; i < logArray.length; i++)
                    msg += logArray[i] + ' ';
                msg = msg.slice(0, -1);
                console.log('%c' + msg, 'color:' + color + ';font-weight:bold');
            },

            //Converts an object to a string and back to an object to freeze it in time and allow easy visualization.
            objSnapshot: function (logMsg = 'Object Snapshot:\n', obj) {
                try {
                    console.log(logMsg, JSON.parse(JSON.stringify(obj)));
                }
                catch (e) {
                    ktl.log.clog('purple', 'objSnapshot exception: ' + e);
                }
            },

            // Adds a new log for a given category in the logs accumulator.
            // These logs are stored in localStorage, and each new one is inserted
            // at the beginning of the array to get the most recent at top.
            addLog: function (category = '', details = '', showInConsole = true) {
                if (!ktl.core.getCfg().enabled.iFrameWnd || category === '' || details === '' || lastDetails === details)
                    return;

                //Logging flags
                if ((category === ktl.const.LS_LOGIN && !ktl.log.getCfg().logEnabled.login) ||
                    (category === ktl.const.LS_ACTIVITY && !ktl.log.getCfg().logEnabled.activity) ||
                    (category === ktl.const.LS_NAVIGATION && !ktl.log.getCfg().logEnabled.navigation) ||
                    (category === ktl.const.LS_INFO && !ktl.log.getCfg().logEnabled.info) ||
                    (category === ktl.const.LS_DEBUG && !ktl.log.getCfg().logEnabled.debug) ||
                    (category === ktl.const.LS_WRN && !ktl.log.getCfg().logEnabled.warning) ||
                    (category === ktl.const.LS_APP_ERROR && !ktl.log.getCfg().logEnabled.error) ||
                    (category === ktl.const.LS_SERVER_ERROR && !ktl.log.getCfg().logEnabled.serverErr) ||
                    (category === ktl.const.LS_CRITICAL && !ktl.log.getCfg().logEnabled.critical))
                    return;

                //Use app's callback to check if log category is allowed.
                if (logCategoryAllowed && !logCategoryAllowed(category, details)) {
                    //ktl.log.clog('purple, 'Skipped log category ' + category);
                    return;
                }

                const catToStr = {
                    [ktl.const.LS_LOGIN]: 'Login',
                    [ktl.const.LS_ACTIVITY]: 'Activity',
                    [ktl.const.LS_NAVIGATION]: 'Navigation',
                    [ktl.const.LS_INFO]: 'Info',
                    [ktl.const.LS_DEBUG]: 'Debug',
                    [ktl.const.LS_WRN]: 'Warning',
                    [ktl.const.LS_APP_ERROR]: 'App Error',
                    [ktl.const.LS_SERVER_ERROR]: 'Server Error',
                    [ktl.const.LS_CRITICAL]: 'Critical',
                };

                var type = catToStr[category];
                //console.log('type =', type);

                if (!type) {
                    ktl.log.clog('purple', 'Error in addLog: Found invalid type.');
                    return;
                }

                lastDetails = details;

                var newLog = {
                    dt: ktl.core.getCurrentDateTime(true, true, true, true),
                    type: type,
                    details: details
                };

                //Read logs as a string.
                try {
                    var logArray = [];
                    var categoryLogs = ktl.storage.lsGetItem(category);
                    if (categoryLogs)
                        logArray = JSON.parse(categoryLogs).logs;

                    if (category === ktl.const.LS_ACTIVITY) { //Activity is a special case, where only one entry is present.
                        if (logArray.length === 0)
                            logArray.push(newLog);
                        else
                            logArray[0] = newLog; //Update existing.
                    } else
                        logArray.unshift(newLog); //Add at beginning of array.

                    var logObj = {
                        logs: logArray,
                        logId: ktl.core.getCurrentDateTime(true, true, true, true).replace(/[\D]/g, ''), //Unique message identifier used validate that transmission was successfull, created from a millisecond timestamp.
                    };

                    ktl.storage.lsSetItem(category, JSON.stringify(logObj));

                    //Also show some of them in console.  Important logs always show, others depending on param.
                    var color = 'blue';
                    if (category === ktl.const.LS_WRN || category === ktl.const.LS_CRITICAL || category === ktl.const.LS_APP_ERROR || category === ktl.const.LS_SERVER_ERROR) {
                        if (category === ktl.const.LS_WRN)
                            color = 'orangered';
                        else
                            color = 'purple';
                        showInConsole = true;
                    }

                    showInConsole && ktl.log.clog(color, type + ' - ' + details);
                }
                catch (e) {
                    ktl.log.addLog(ktl.const.LS_INFO, 'addLog, deleted log having obsolete format: ' + category + ', ' + e);
                    ktl.storage.lsRemoveItem(category);
                }
            },

            //For KTL internal use.
            //Returns the oldest log's date/time from array.  Resolution is 1 minute.
            getLogArrayAge: function (category = '') {
                if (category === '') return null;

                try {
                    var logArray = [];
                    var categoryLogs = ktl.storage.lsGetItem(category);
                    if (categoryLogs)
                        logArray = JSON.parse(categoryLogs).logs;

                    if (logArray.length > 0) {
                        var oldestLogDT = Date.parse(logArray[logArray.length - 1].dt);
                        var nowUTC = Date.parse(ktl.core.getCurrentDateTime(true, false, false, true));
                        var minutesElapsed = Math.round((nowUTC - oldestLogDT) / 60000);
                        //console.log('minutesElapsed =', minutesElapsed);
                        return minutesElapsed;
                    } else
                        return null;
                }
                catch (e) {
                    ktl.log.addLog(ktl.const.LS_INFO, 'getLogArrayAge, deleted log having obsolete format: ' + category + ', ' + e);
                    ktl.storage.lsRemoveItem(category);
                }
            },

            resetActivityCtr: function () {
                mouseClickCtr = 0;
                keyPressCtr = 0;
            },

            //For KTL internal use.
            removeLogById: function (logId = '') {
                if (!logId) return;

                var categories = [ktl.const.LS_LOGIN, ktl.const.LS_ACTIVITY, ktl.const.LS_NAVIGATION,
                ktl.const.LS_INFO, ktl.const.LS_DEBUG, ktl.const.LS_WRN, ktl.const.LS_APP_ERROR,
                ktl.const.LS_SERVER_ERROR, ktl.const.LS_CRITICAL];

                categories.forEach(category => {
                    var categoryLogs = ktl.storage.lsGetItem(category);
                    if (categoryLogs) {
                        try {
                            var logObj = JSON.parse(categoryLogs);
                            if (logObj.logId && logObj.logId === logId) {
                                //console.log('Deleting found logId =', logId, 'cat=', category);
                                ktl.storage.lsRemoveItem(category);
                            }
                        }
                        catch (e) {
                            ktl.log.addLog(ktl.const.LS_INFO, 'removeLogById, deleted log having obsolete format: ' + category + ', ' + e);
                            ktl.storage.lsRemoveItem(category);
                        }
                    }
                })
            },

            updateActivity: function () {
                if (!ktl.log.getCfg().logEnabled.activity) return;

                //Important to read again every 5 seconds in case some other opened pages would add to shared counters.
                var categoryLogs = ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY);
                try {
                    var nowUTC = ktl.core.getCurrentDateTime(true, true, false, true);
                    if (!categoryLogs)
                        ktl.log.addLog(ktl.const.LS_ACTIVITY, JSON.stringify({ mc: 0, kp: 0, dt: nowUTC }), false); //Doesn't exist, create activity entry.
                    else {
                        var details = JSON.parse(JSON.parse(categoryLogs).logs[0].details);
                        var diff = Date.parse(nowUTC) - Date.parse(details.dt);
                        if (isNaN(diff) || (ktl.scenes.getCfg().idleWatchDogDelay === 0) || (diff < ktl.scenes.getCfg().idleWatchDogDelay))
                            ktl.scenes.resetIdleWatchdog();
                        else {
                            //Update activity's date/time to now.
                            ktl.log.addLog(ktl.const.LS_ACTIVITY, JSON.stringify({ mc: details.mc, kp: details.kp, dt: nowUTC }), false);
                            ktl.scenes.idleWatchDogTimeout();
                        }

                        if (mouseClickCtr > 0 || keyPressCtr > 0) {
                            ktl.log.addLog(ktl.const.LS_ACTIVITY, JSON.stringify({ mc: details.mc + mouseClickCtr, kp: details.kp + keyPressCtr, dt: nowUTC }), false);
                            ktl.log.resetActivityCtr();
                        }
                    }
                }
                catch (e) {
                    ktl.log.addLog(ktl.const.LS_INFO, 'Deleted ACTIVITY log having obsolete format: ' + e);
                    ktl.storage.lsRemoveItem(ktl.const.LS_ACTIVITY);
                }
            },

            //TODO: add getCategoryLogs.  Returns object with array and logId.
        }
    })(); //Logging feature

    //====================================================
    //User Preferences feature
    this.userPrefs = (function () {
        const defaultUserPrefsObj = {
            dt: '01/01/1970 00:00:00',
            showViewId: false,
            showExtraDebugInfo: false,
            showIframeWnd: false,
            showDebugWnd: false,
            workShift: 'A'
            //TODO:  allow dynamically adding more as per user requirements.
        };

        var userPrefsObj = defaultUserPrefsObj;
        var myUserPrefsViewId = ktl.core.getViewIdByTitle('My Preferences');

        //App Callbacks
        var allowShowPrefs = null; //Determines what prefs can be shown, based on app's rules.
        var applyUserPrefs = null; //Apply your own prefs.
        var lastUserPrefs = readUserPrefsFromLs(); //Used to detect prefs changes.

        function readUserPrefsFromLs() {
            try {
                var lsPrefsStr = ktl.storage.lsGetItem(ktl.const.LS_USER_PREFS);
                if (lsPrefsStr)
                    userPrefsObj = JSON.parse(lsPrefsStr);

                return lsPrefsStr; //Return string version.
            }
            catch (e) {
                ktl.log.clog('purple', 'Exception in readUserPrefsFromLs: ' + e);
            }

            return '';
        }

        $(document).on('knack-view-render.any', function (event, view, data) {
            try {
                if (view.key === ktl.iFrameWnd.getCfg().curUserPrefsViewId) {
                    var acctPrefsFld = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
                    var prefsViewId = ktl.iFrameWnd.getCfg().updUserPrefsViewId;
                    if (!prefsViewId || !acctPrefsFld) {
                        ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1020 - prefsViewId = "' + prefsViewId + '", acctPrefsFld = "' + acctPrefsFld + '"');
                        return;
                    }

                    var prefsStr = data[acctPrefsFld];
                    if (prefsStr) {
                        var prefsTmpObj = JSON.parse(prefsStr);

                        //Add iFrameRefresh=true to user prefs and this will force a iFrameWnd refresh.
                        //Can be useful sometimes to trigger on/off views via Page Rules.
                        if (prefsStr.includes('iFrameRefresh')) {
                            delete prefsTmpObj['iFrameRefresh'];
                            var updatedPrefs = JSON.stringify(prefsTmpObj);
                            ktl.views.submitAndWait(ktl.iFrameWnd.getCfg().updUserPrefsViewId, { [acctPrefsFld]: updatedPrefs })
                                .then(() => { Knack.router.scene_view.render(); })
                                .catch(failure => { ktl.log.clog('red', 'iFrameRefresh failure: ' + failure); })
                        } else if (prefsStr.includes('reloadApp')) {
                            delete prefsTmpObj['reloadApp'];
                            var updatedPrefs = JSON.stringify(prefsTmpObj);
                            ktl.views.submitAndWait(ktl.iFrameWnd.getCfg().updUserPrefsViewId, { [acctPrefsFld]: updatedPrefs })
                                .then(success => { ktl.wndMsg.send('reloadAppMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { reason: 'MANUAL_REFRESH' }); })
                                .catch(failure => { ktl.log.clog('red', 'reloadAppMsg failure: ' + failure); })
                        } else {
                            if (prefsStr && (prefsStr !== lastUserPrefs)) {
                                ktl.log.clog('blue', 'Prefs have changed!!!!');

                                lastUserPrefs = prefsStr;

                                ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS, prefsStr);
                                ktl.wndMsg.send('userPrefsChangedMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP);

                                ktl.userPrefs.ktlApplyUserPrefs();
                            }
                        }
                    } else {
                        //If nothing yet, use default object: 1970, etc.
                        document.querySelector('#' + acctPrefsFld).value = JSON.stringify(defaultUserPrefsObj);
                        document.querySelector('#' + prefsViewId + ' .kn-button.is-primary').click();
                        ktl.log.clog('green', 'Uploading default prefs to cloud');
                    }
                } else if (view.key === ktl.userPrefs.getCfg().myUserPrefsViewId) { //Form for user to update his own prefs
                    var allow = allowShowPrefs ? allowShowPrefs() : {};
                    if ($.isEmptyObject(allow)) {
                        ktl.core.hideSelector('#' + ktl.userPrefs.getCfg().myUserPrefsViewId);
                        return;
                    }

                    var userPrefsTmp = userPrefsObj;

                    var prefsBar = document.createElement('div');
                    prefsBar.style.marginTop = '20px';
                    prefsBar.style.marginBottom = '50px';
                    ktl.core.insertAfter(prefsBar, document.querySelector('#' + ktl.userPrefs.getCfg().myUserPrefsViewId + ' .view-header'));
                    ktl.core.hideSelector('#' + ktl.userPrefs.getCfg().myUserPrefsViewId + ' .columns');

                    //TODO: change this "add pref" mechanism to allow developer to add all the app-specific prefs that are desired,
                    //on top of default ones.  Use an object that describes each prefs and loop through each one with an iterator.

                    if (allow.showViewId) {
                        var showViewIdCb = ktl.fields.addCheckbox(prefsBar, 'Show View ID', userPrefsTmp.showViewId);
                        showViewIdCb.addEventListener('change', e => {
                            userPrefsTmp.showViewId = e.target.checked;
                            updateUserPrefsFormText();
                        });
                    }

                    if (ktl.core.getCfg().enabled.iFrameWnd && allow.showIframe) {
                        var showIframeWndCb = ktl.fields.addCheckbox(prefsBar, 'Show iFrameWnd', userPrefsTmp.showIframeWnd);
                        showIframeWndCb.addEventListener('change', e => {
                            userPrefsTmp.showIframeWnd = e.target.checked;
                            updateUserPrefsFormText();
                        });
                    }

                    if (allow.showDebugWnd) {
                        var showDebugWndCb = ktl.fields.addCheckbox(prefsBar, 'Show DebugWnd', userPrefsTmp.showDebugWnd);
                        showDebugWndCb.addEventListener('change', e => {
                            userPrefsTmp.showDebugWnd = e.target.checked;
                            updateUserPrefsFormText();
                        });
                    }

                    if (allow.showExtraDebugInfo) {
                        var showExtraDebugCb = ktl.fields.addCheckbox(prefsBar, 'Show Extra Debug', userPrefsTmp.showExtraDebugInfo);
                        showExtraDebugCb.addEventListener('change', e => {
                            userPrefsTmp.showExtraDebugInfo = e.target.checked;
                            updateUserPrefsFormText();
                        });
                    }

                    function updateUserPrefsFormText() {
                        userPrefsTmp.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                        var acctPrefsFld = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
                        $('#' + acctPrefsFld).val(JSON.stringify(userPrefsTmp));
                    }
                }
            }
            catch (e) {
                ktl.log.clog('purple', 'On render view for User Prefs error: ' + e);
                console.log('view =', view);
                console.log('data =', data);
            }
        })

        $(document).on('knack-scene-render.any', function (event, scene) {
            ktl.userPrefs.ktlApplyUserPrefs();
        })

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.allowShowPrefs && (allowShowPrefs = cfgObj.allowShowPrefs);
                cfgObj.applyUserPrefs && (applyUserPrefs = cfgObj.applyUserPrefs);
                cfgObj.myUserPrefsViewId && (myUserPrefsViewId = cfgObj.myUserPrefsViewId);
            },

            getCfg: function () {
                return {
                    myUserPrefsViewId,
                };
            },

            getUserPrefs: function () {
                readUserPrefsFromLs();
                return userPrefsObj;
            },

            ktlApplyUserPrefs: function (renderViews = false) {
                ktl.debugWnd.showDebugWnd(ktl.userPrefs.getUserPrefs().showDebugWnd);
                ktl.iFrameWnd.showIFrame(ktl.userPrefs.getUserPrefs().showIframeWnd);
                for (var viewId in Knack.views) {
                    if (Knack.views[viewId] && Knack.views[viewId].model)
                        ktl.views.addViewId(Knack.views[viewId].model.view);
                }

                var myUserPrefsViewId = ktl.userPrefs.getCfg().myUserPrefsViewId;
                myUserPrefsViewId && ktl.views.refreshView(myUserPrefsViewId);

                if (renderViews && !applyUserPrefs)
                    ktl.scenes.renderViews();

                applyUserPrefs && applyUserPrefs(renderViews);
            },

            getDefaultUserPrefs: function () {
                return defaultUserPrefsObj;
            }
        }
    })(); //User Prefs

    //====================================================
    //Account feature
    this.account = (function () {
        const LOGIN_SUCCESSFUL = 'Successful';
        const LOGIN_ACCESS_DENIED = 'Page access denied';
        const LOGIN_WRONG_USER_INFO = 'Wrong email or password';
        const LOGIN_TIMEOUT = 'Timeout';

        //Show logged-in user ID when double-clicking on First name.
        //Useful to copy/pase in the localStorage filtering field to see only those entries.
        $(document).on('knack-scene-render.any', function (event, scene) {
            $('.kn-current_user > span.first').on('dblclick', (e) => {
                var userId = $('.kn-current_user').attr('id');
                console.log('\nApp:\t', app_id);
                console.log('LS key:\t', APP_ROOT_NAME);
                console.log('User:\t', userId);
            })

            if ($('.remember input').length && ktl.core.getCfg().enabled.rememberMe)
                $('.remember input')[0].checked = true;
        })

        //Handle log-in/out events.
        $(document).on('click', function (e) {
            if (e.target.value === 'Sign In' && e.target.type === 'submit') {
                var sel = $('.kn-login-form > form > input');
                if (sel && sel.length > 0) {
                    waitLoginOutcome()
                        .then(function (result) {
                            var menuInfo = ktl.core.getMenuInfo();
                            if (result === LOGIN_SUCCESSFUL) {
                                waitUserId()
                                    .then(() => {
                                        result = JSON.stringify({ result: result, APP_KTL_VERSIONS: APP_KTL_VERSIONS, publicIP: ktl.sysInfo.getSysInfo().ip, page: menuInfo, agent: navigator.userAgent });

                                        ktl.storage.lsRemoveItem('PAUSE_SERVER_ERROR_LOGS');
                                        ktl.log.addLog(ktl.const.LS_LOGIN, result);

                                        if (localStorage.length > 500)
                                            ktl.log.addLog(ktl.const.LS_WRN, 'KEC_1019 - Local Storage size: ' + localStorage.length);

                                        ktl.iFrameWnd.create();
                                    })
                                    .catch(() => {
                                        console.error('waitLoginOutcome: Failed waiting for user ID.');
                                    })
                            } else {
                                //If an error occurred, redirect to the error page as a last resort, so we can post a log (we need user id).
                                var lastError = JSON.stringify({ result: result, link: menuInfo.link });
                                ktl.storage.lsSetItem(ktl.const.LS_LAST_ERROR, lastError);
                                var index = window.location.href.indexOf('#');
                                window.location.href = window.location.href.slice(0, index + 1) + 'error-page';
                            }
                        })
                        .catch(function (result) {
                            ktl.debugWnd.lsLog(result);
                            ktl.storage.lsSetItem(ktl.const.LS_LAST_ERROR, JSON.stringify({ result: result, link: window.location.href })); //Take a quick note of what happened.

                            //Error page... Not used yet in this case, but maybe later.
                            //var index = window.location.href.indexOf('#');
                            //window.location.href = window.location.href.slice(0, index + 1) + 'error-page';

                            //Only for Kiosks.  Has no effect otherwise since already on screen.
                            //$('#email').val('');
                            $('#password').val('');
                            $('.kn-login.kn-view').css({ 'position': 'absolute', 'left': '0px' }); //Put back on screen to show the error to IT or Sysop.
                        })
                }
            } else if (e.target.text === 'Log Out') { //Delete iFrame on Logout.
                ktl.wndMsg.startHeartbeat(false);
                ktl.iFrameWnd.delete();
            }
        })

        function waitLoginOutcome() {
            return new Promise(function (resolve, reject) {
                var i = 0;
                var sel = null;
                var intervalId = setInterval(function () {
                    sel = $('.kn-message.is-error > span');
                    if (sel.length > 0) {
                        if (sel[0].innerText.indexOf('have permission to access this page') >= 0) {
                            clearInterval(intervalId);
                            resolve(LOGIN_ACCESS_DENIED);
                        } else if (sel[0].innerText === 'Email or password incorrect.') {
                            clearInterval(intervalId);
                            reject(LOGIN_WRONG_USER_INFO);
                        }
                    }

                    sel = $('.kn-login-form > form > input');
                    if (sel.length === 0 && Knack.getUserAttributes() != 'No user found') {
                        clearInterval(intervalId);
                        resolve(LOGIN_SUCCESSFUL);
                    }

                    if (i++ >= 200) { //Fail after 20 seconds.
                        clearInterval(intervalId);
                        reject(LOGIN_TIMEOUT);
                    }
                }, 100);
            })
        }

        if (!window.logout) { //Emergency logout
            window.logout = function () {
                ktl.account.logout();
            }
        }

        return {
            isDeveloper: function () {
                return Knack.getUserRoleNames().includes('Developer') || (ktl.storage.lsGetItem('forceDevRole', true) === 'true');
            },

            isLoggedIn: function () {
                return Knack.getUserAttributes() !== 'No user found';
            },

            logout: function () {
                if (ktl.scenes.isiFrameWnd()) {
                    //Do not process here.  Let the parent App do it properly since it needs to delete the iFrameWnd first.
                    //Also, the parent may never see the expiry (when no API calls nor submits), so we end up in a loop.
                    ktl.wndMsg.send('logoutMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP);
                } else {
                    ktl.iFrameWnd.delete();
                    Knack.handleLogout();
                }
            },

            autoLogin: function (viewId = '') {
                if (!viewId) return;
                var loginInfo = ktl.storage.lsGetItem('AES_LI', true, false);
                if (loginInfo && loginInfo !== '') {
                    if (loginInfo === 'SkipAutoLogin') {
                        console.log('AL not needed:', loginInfo);
                        return;
                    } else {
                        ktl.storage.initSecureLs()
                            .then(() => {
                                var loginInfo = ktl.storage.lsGetItem('AES_LI', true, false, true);
                                if (loginInfo && loginInfo !== '') {
                                    loginInfo = JSON.parse(loginInfo);
                                    $('.kn-login.kn-view' + '#' + viewId).addClass('ktlHidden');
                                    $('#email').val(loginInfo.email);
                                    $('#password').val(loginInfo.pw);
                                    $('.remember input')[0].checked = true;

                                    //Do not use form submit. Must be click below, otherwise waitLoginOutcome is never called.
                                    //$('#' + viewId + ' form').submit();
                                    $('.kn-login-form .kn-button.is-primary').click();
                                }
                            })
                            .catch(reason => { ktl.log.clog('purple', reason); });
                    }
                } else {
                    //First time - AL needed not yet specified.
                    if (confirm('Do you need Auto-Login on this page?')) {
                        ktl.storage.initSecureLs()
                            .then(() => {
                                var email = prompt('Email:', '');
                                var pw = prompt('PW:', '');
                                if (!email || !pw) {
                                    alert('You must specify an Email and a Password.');
                                    ktl.account.autoLogin(viewId);
                                } else {
                                    loginInfo = JSON.stringify({ email: email, pw: pw });
                                    ktl.storage.lsSetItem('AES_LI', loginInfo, true, false, true);
                                }
                                location.reload();
                            })
                            .catch(reason => { ktl.log.clog('purple', reason); });
                    } else
                        ktl.storage.lsSetItem('AES_LI', 'SkipAutoLogin', true, false, false);
                }
            },

            checkUserRolesMatch: function (rolesToCheck = []/*Leave empty for any roles.*/) {
                if (!rolesToCheck.length) return true;
                var defaultRes = false;
                const userRoles = Knack.getUserRoleNames().split(', ');
                for (let i = 0; i < rolesToCheck.length; i++) {
                    if (rolesToCheck[i].startsWith('!')) {
                        defaultRes = true;
                        rolesToCheck[i] = rolesToCheck[i].replace('!', '');
                        if (userRoles.includes(rolesToCheck[i]))
                            return false;
                    } else {
                        defaultRes = false;
                        if (userRoles.includes(rolesToCheck[i]))
                            return true;
                    }
                }

                return defaultRes;
            },
        }
    })(); //account

    //====================================================
    //iFrameWnd feature
    this.iFrameWnd = (function () {
        var iFrameWnd = null; //The actual iframe window.
        var iFrameTimeout = null;
        var highPriLoggingInterval = null;
        var lowPriLoggingInterval = null;

        var accountsObj = ktl.core.getObjectIdByName(getAccountsObjectName());
        var accountLogsObj = ktl.core.getObjectIdByName('Account Logs');
        var appSettingsObj = ktl.core.getObjectIdByName('App Settings');
        var userFiltersObj = ktl.core.getObjectIdByName('User Filters');

        var cfg = {
            iFrameReady: false,
            appSettingsViewId: ktl.core.getViewIdByTitle('App Settings', 'iframewnd'),
            appSettingsItemFld: ktl.core.getFieldIdByName('Item', appSettingsObj),
            appSettingsValueFld: ktl.core.getFieldIdByName('Value', appSettingsObj),
            appSettingsDateTimeFld: ktl.core.getFieldIdByName('Date/Time', appSettingsObj),
            userFiltersViewId: ktl.core.getViewIdByTitle('User Filters', 'iframewnd'),
            userFiltersCodeFld: ktl.core.getFieldIdByName('Filters Code', userFiltersObj),
            userFiltersDateTimeFld: ktl.core.getFieldIdByName('Date/Time', userFiltersObj),

            curUserPrefsViewId: ktl.core.getViewIdByTitle('Current User Prefs', 'iframewnd'),
            updUserPrefsViewId: ktl.core.getViewIdByTitle('Update User Prefs', 'iframewnd'),
            hbViewId: ktl.core.getViewIdByTitle('Heartbeat', 'iframewnd'),
            acctLogsViewId: ktl.core.getViewIdByTitle('Account Logs', 'iframewnd'),

            acctSwVersionFld: ktl.core.getFieldIdByName('SW Version', accountsObj),
            acctUtcHbFld: ktl.core.getFieldIdByName('UTC HB', accountsObj),
            acctTimeZoneFld: ktl.core.getFieldIdByName('TZ', accountsObj),
            acctLocHbFld: ktl.core.getFieldIdByName('LOC HB', accountsObj),
            acctOnlineFld: ktl.core.getFieldIdByName('Online', accountsObj),
            acctUserPrefsFld: ktl.core.getFieldIdByName('User Prefs', accountsObj),
            acctUtcLastActFld: (ktl.core.getFieldIdByName('UTC ACT', accountsObj) || ktl.core.getFieldIdByName('UTC Last Activity', accountsObj)),
            acctFirstNameFld: ktl.core.getFieldIdByName('First Name', accountsObj),
            acctLastNameFld: ktl.core.getFieldIdByName('Last Name', accountsObj),

            alAccountFld: ktl.core.getFieldIdByName('Account', accountLogsObj),
            alDateTimeFld: ktl.core.getFieldIdByName('Date/Time', accountLogsObj),
            alLogTypeFld: ktl.core.getFieldIdByName('Log Type', accountLogsObj),
            alDetailsFld: ktl.core.getFieldIdByName('Details', accountLogsObj),
            alLogIdFld: ktl.core.getFieldIdByName('Log Id', accountLogsObj),
            alEmailFld: ktl.core.getFieldIdByName('Email To', accountLogsObj),
        }

        //High priority logs, sent every minute.
        var highPriorityLogs = [
            { type: ktl.const.LS_CRITICAL, typeStr: 'Critical' },
            { type: ktl.const.LS_APP_ERROR, typeStr: 'App Error' },
            { type: ktl.const.LS_SERVER_ERROR, typeStr: 'Server Error' },
            { type: ktl.const.LS_WRN, typeStr: 'Warning' },
            { type: ktl.const.LS_INFO, typeStr: 'Info' },
            { type: ktl.const.LS_DEBUG, typeStr: 'Debug' },
            { type: ktl.const.LS_LOGIN, typeStr: 'Login' },
        ];

        //Lower priority logs, accumulated in localStorage and sent every hour.
        var lowPriorityLogs = [
            { type: ktl.const.LS_ACTIVITY, typeStr: 'Activity' },
            { type: ktl.const.LS_NAVIGATION, typeStr: 'Navigation' },
        ];

        $(document).ready(() => {
            if (ktl.scenes.isiFrameWnd())
                document.querySelector('#knack-body').classList.add('iFrameWnd');
        })

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (ktl.scenes.isiFrameWnd()) {
                ktl.wndMsg.send('iFrameWndReadyMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, APP_KTL_VERSIONS);
                startHighPriorityLogging();
                startLowPriorityLogging();
            }
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            if (view.key === cfg.acctLogsViewId) {
                //Logs cleanup and processing of email action.
                var recId = '';
                for (var i = 0; i < data.length; i++) {
                    ktl.log.removeLogById(data[i][cfg.alLogIdFld]);
                    if (data[i][cfg.alEmailFld])
                        recId = data[i].id; //Catch oldest email not sent yet.
                }

                if (recId) {
                    $('#' + view.key + ' tr[id="' + recId + '"] .kn-action-link:contains("SEND")')[0].click();
                    var selToast = '#toast-container';
                    ktl.core.waitSelector(selToast)
                        .then(function () {
                            selToast = '#toast-container > div > div > p';
                            var msg = $(selToast).text();
                            if (msg.includes('Account Logs - Email sent successfully')) {
                                //console.log('Email sent, re-starting auto refresh and logging loop');
                                ktl.views.autoRefresh();
                                startHighPriorityLogging();
                            } else
                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1022 - Failed sending email for critical error.  Msg = ' + msg);
                        })
                        .catch(function () { })
                }
            } else if (view.key === cfg.userFiltersViewId) {
                var newUserFilters = '';
                if (data.length)
                    newUserFilters = data[0][cfg.userFiltersCodeFld];

                try {
                    var cloudUfDt = '';
                    var usrFiltersNeedDownload = false;
                    var usrFiltersNeedUpload = false;
                    if (newUserFilters && newUserFilters.length > 1) {
                        newUserFilters = JSON.parse(newUserFilters);
                        if ($.isEmptyObject(newUserFilters)) return;
                        cloudUfDt = newUserFilters.dt;
                    }

                    var lastUfStr = ktl.storage.lsGetItem(LS_UF);
                    if (lastUfStr) {
                        try {
                            var lastUfTempObj = JSON.parse(lastUfStr);
                            if (!$.isEmptyObject(lastUfTempObj)) {
                                var localUfDt = lastUfTempObj.dt;
                                //console.log('localUfDt =', localUfDt);
                                //console.log('cloudUfDt =', cloudUfDt);
                                if (ktl.core.isMoreRecent(cloudUfDt, localUfDt))
                                    usrFiltersNeedDownload = true;
                                else if (!cloudUfDt || ktl.core.isMoreRecent(localUfDt, cloudUfDt))
                                    usrFiltersNeedUpload = true;
                            }
                        } catch (e) {
                            alert('Read User Filters - Error Found Parsing Filters:', e);
                        }
                    } else
                        usrFiltersNeedDownload = true;

                    if (usrFiltersNeedDownload)
                        ktl.wndMsg.send('userFiltersNeedDownloadMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { newUserFilters: newUserFilters });
                    else if (usrFiltersNeedUpload)
                        ktl.userFilters.uploadUserFilters(data);
                }
                catch (e) {
                    console.log('Error parsing newUserFilters\n', e);
                }
            } else if (view.key === cfg.appSettingsViewId) {
                var rec = ktl.views.findRecord(data, cfg.appSettingsItemFld, 'APP_KTL_VERSIONS');
                if (rec) {
                    var newSWVersion = rec[cfg.appSettingsValueFld];
                    if (newSWVersion !== APP_KTL_VERSIONS) {
                        if (localStorage.getItem(APP_ROOT_NAME + 'dev') !== null || ktl.storage.lsGetItem('remoteDev', true) === 'true') {
                            //Dev or remoteDev, ignore.
                        } else {
                            //Prod
                            if (ktl.core.getCfg().developerNames.includes(Knack.getUserAttributes().name)) {
                                //Only warn when in Prod mode.
                                ktl.wndMsg.send('swVersionsDifferentMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP);
                            } else {
                                console.log('sending reloadAppMsg with ver:', newSWVersion);
                                ktl.wndMsg.send('reloadAppMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { reason: 'SW_UPDATE', version: newSWVersion });
                            }
                        }
                    }
                } else {
                    var apiData = {}; //Not found, create new entry.
                    apiData[ktl.iFrameWnd.getCfg().appSettingsItemFld] = 'APP_KTL_VERSIONS';
                    apiData[ktl.iFrameWnd.getCfg().appSettingsValueFld] = APP_KTL_VERSIONS;
                    apiData[ktl.iFrameWnd.getCfg().appSettingsDateTimeFld] = ktl.core.getCurrentDateTime(true, true, false, true);
                    ktl.log.clog('blue', 'Creating APP_KTL_VERSIONS entry...');
                    ktl.core.knAPI(view.key, null, apiData, 'POST', [view.key])
                        .then(function (response) { ktl.log.clog('green', 'APP_KTL_VERSIONS entry created successfully!'); })
                        .catch(function (reason) { alert('An error occurred while creating APP_KTL_VERSIONS in table, reason: ' + JSON.stringify(reason)); })
                }

                rec = ktl.views.findRecord(data, cfg.appSettingsItemFld, 'APP_PUBLIC_FILTERS');
                if (rec) {
                    var cloudPublicFilters = rec[cfg.appSettingsValueFld];
                    try {
                        var cloudPfDt = '';
                        var pubFiltersNeedDownload = false;
                        var pubFiltersNeedUpload = false;
                        if (cloudPublicFilters && cloudPublicFilters.length > 1) {
                            cloudPublicFilters = JSON.parse(cloudPublicFilters);
                            if ($.isEmptyObject(cloudPublicFilters)) return;
                            if (!cloudPublicFilters.dt) {
                                ktl.log.clog('purple', 'KTL has encountered an empty date in cloud public filters');
                                return;
                            }

                            cloudPfDt = cloudPublicFilters.dt;
                        }

                        var localPfStr = ktl.storage.lsGetItem(LS_UFP);
                        if (localPfStr) {
                            try {
                                var localPfTempObj = JSON.parse(localPfStr);
                                if (!$.isEmptyObject(localPfTempObj)) {
                                    if (!localPfTempObj.dt) {
                                        ktl.log.clog('purple', 'KTL has encountered an empty date in local public filters');
                                        return;
                                    }

                                    var localPfDt = localPfTempObj.dt;

                                    if (localPfDt !== cloudPfDt)
                                        console.log(`Change found: localPfDt: ${localPfDt} vs cloudPfDt: ${cloudPfDt}`);

                                    if (ktl.core.isMoreRecent(cloudPfDt, localPfDt))
                                        pubFiltersNeedDownload = true;
                                    else if (Knack.getUserRoleNames().includes('Public Filters') && (!cloudPfDt || ktl.core.isMoreRecent(localPfDt, cloudPfDt))) {
                                        pubFiltersNeedUpload = true;
                                    }
                                }
                            } catch (e) {
                                alert('Read Public Filters - Error Found Parsing Filters:', e);
                            }
                        } else
                            pubFiltersNeedDownload = true;

                        if (pubFiltersNeedDownload)
                            ktl.wndMsg.send('publicFiltersNeedDownloadMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { newPublicFilters: cloudPublicFilters });
                        else if (pubFiltersNeedUpload)
                            ktl.userFilters.uploadPublicFilters(data);
                    }
                    catch (e) {
                        console.log('Error parsing newPublicFilters\n', e);
                    }
                } else
                    ktl.userFilters.uploadPublicFilters(data);
            }
        })

        function startHighPriorityLogging() {
            clearInterval(highPriLoggingInterval);
            highPriLoggingInterval = setInterval(() => {
                //Send high-priority logs immediately, as these are not accumulated like low-priority logs.
                (function sequentialSubmit(ix) {
                    var checkNext = false;
                    var el = highPriorityLogs[ix];

                    var categoryLogs = ktl.storage.lsGetItem(el.type);
                    if (categoryLogs) {
                        try {
                            var logObj = JSON.parse(categoryLogs);
                            var details = JSON.stringify(logObj.logs);
                            if (details) {
                                if (!logObj.sent) {
                                    logObj.sent = true; //Do not send twice, when many opened windows.
                                    ktl.storage.lsSetItem(el.type, JSON.stringify(logObj));

                                    ktl.log.clog('purple', 'Submitting high priority log for: ' + el.typeStr);

                                    var viewId = cfg.acctLogsViewId;
                                    if (viewId) {
                                        var apiData = {};
                                        apiData[cfg.alLogIdFld] = logObj.logId;
                                        apiData[cfg.alLogTypeFld] = el.typeStr;
                                        apiData[cfg.alDetailsFld] = details;
                                        if (el.type === ktl.const.LS_CRITICAL) { //When critical, send via email immediately.
                                            apiData[cfg.alEmailFld] = ktl.core.getCfg().developerEmail;
                                            console.log('Critical error log, sending email to', apiData[cfg.alEmailFld]);
                                            ktl.views.autoRefresh(false);
                                            clearInterval(highPriLoggingInterval);
                                        }

                                        ktl.core.knAPI(viewId, null, apiData, 'POST', [cfg.acctLogsViewId], false)
                                            .then(function (result) {
                                                checkNext = true;
                                            })
                                            .catch(function (reason) {
                                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1015 - Failed posting high-priority log type ' + el.typeStr + ', logId ' + logObj.logId + ', reason ' + JSON.stringify(reason));
                                                delete logObj.sent;
                                                ktl.storage.lsSetItem(el.type, JSON.stringify(logObj));
                                                ktl.views.autoRefresh(); //JIC it was stopped by critical email not sent.
                                                startHighPriorityLogging();
                                            })
                                    } else
                                        checkNext = true;
                                } else
                                    checkNext = true;
                            } else
                                checkNext = true;
                        }
                        catch (e) {
                            ktl.log.addLog(ktl.const.LS_INFO, 'startHighPriorityLogging, deleted log having obsolete format: ' + el.type + ', ' + e);
                            ktl.storage.lsRemoveItem(category);
                            checkNext = true;
                        }
                    } else
                        checkNext = true;

                    if (checkNext && ++ix < highPriorityLogs.length)
                        sequentialSubmit(ix);
                })(0);
            }, 10000);
        }

        const LOW_PRIORITY_LOGGING_DELAY = ONE_MINUTE_DELAY; //TODO: make these configurable.
        const DEV_LOW_PRIORITY_LOGGING_DELAY = 10000;
        const TIME_TO_SEND_LOW_PRIORITY_LOGS = ktl.account.isDeveloper() ? 10/*send sooner for devs*/ : 60; //1 hour.
        function startLowPriorityLogging() {
            // - Submit all accumulated low-priority logs.
            // - Check what needs to be uploaded, i.e. non-empty arrays, older than LOGGING_DELAY, send them in sequence.
            // - Submit to Knack if activity or other log accumulator has changed.
            clearInterval(lowPriLoggingInterval);
            lowPriLoggingInterval = setInterval(() => {
                (function sequentialSubmit(ix) {
                    var checkNext = false;
                    var el = lowPriorityLogs[ix];
                    var oldestLog = ktl.log.getLogArrayAge(el.type);
                    if (oldestLog !== null) {
                        //console.log('Oldest log for ', el.type, 'is', oldestLog);

                        //Accumulate logs over a longer period of time to reduce nb of records
                        if (oldestLog >= TIME_TO_SEND_LOW_PRIORITY_LOGS) {
                            //lsLog('Submitting logs for: ' + el.typeStr);
                            var categoryLogs = ktl.storage.lsGetItem(el.type);
                            if (categoryLogs) {
                                try {
                                    var logObj = JSON.parse(categoryLogs);
                                    var details = JSON.stringify(logObj.logs);
                                    if (details) {
                                        if (el.type === ktl.const.LS_ACTIVITY && (details.substring(65, 80) === 'mc\\":0,\\"kp\\":0')) //Do not send zero activity.
                                            checkNext = true;
                                        else {
                                            if (!logObj.sent) {
                                                logObj.sent = true; //Do not send twice, when many opened windows.
                                                ktl.storage.lsSetItem(el.type, JSON.stringify(logObj));

                                                var viewId = cfg.acctLogsViewId;
                                                if (viewId) {
                                                    var apiData = {};
                                                    apiData[cfg.alLogIdFld] = logObj.logId;
                                                    apiData[cfg.alLogTypeFld] = el.typeStr;
                                                    apiData[cfg.alDetailsFld] = details;
                                                    ktl.core.knAPI(viewId, null, apiData, 'POST', [cfg.acctLogsViewId], false)
                                                        .then(function (result) {
                                                            checkNext = true;
                                                        })
                                                        .catch(function (reason) {
                                                            ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1016 - Failed posting low-priority log type ' + el.typeStr + ', logId ' + logObj.logId + ', reason ' + JSON.stringify(reason));
                                                            delete logObj.sent;
                                                            ktl.storage.lsSetItem(el.type, JSON.stringify(logObj));
                                                        })
                                                }
                                            } else
                                                checkNext = true;
                                        }
                                    } else
                                        checkNext = true;
                                }
                                catch (e) {
                                    ktl.log.addLog(ktl.const.LS_INFO, 'startLowPriorityLogging, deleted log having obsolete format: ' + el.type + ', ' + e);
                                    ktl.storage.lsRemoveItem(category);
                                    checkNext = true;
                                }
                            } else
                                checkNext = true;
                        } else
                            checkNext = true;
                    } else
                        checkNext = true;

                    if (checkNext && ++ix < lowPriorityLogs.length)
                        sequentialSubmit(ix);
                })(0);
            }, ktl.account.isDeveloper() ? DEV_LOW_PRIORITY_LOGGING_DELAY : LOW_PRIORITY_LOGGING_DELAY);
        }

        const updateLastActivity = debounce(function (event) {
            if (!window.self.frameElement && cfg.iFrameReady) {
                ktl.wndMsg.send('activityMsg', 'req', ktl.const.MSG_APP, IFRAME_WND_ID);
            }
        }, 1000);

        $(document).on('mousedown', updateLastActivity);
        $(document).on('keydown', updateLastActivity);

        function getAccountsObjectName() {
            const objects = Knack.objects.models;
            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i];
                if (obj.attributes && obj.attributes.profile_key && obj.attributes.profile_key === 'all_users')
                    return obj.attributes.name;
            }
        }

        return {
            setCfg: function (cfgObj = {}) {
                if (cfgObj.iFrameReady) {
                    cfg.iFrameReady = cfgObj.iFrameReady;
                    clearTimeout(iFrameTimeout);
                }
            },

            getCfg: function () {
                return cfg;
            },

            //For KTL internal use.
            create: function () {
                if (!ktl.core.getCfg().enabled.iFrameWnd) return;

                var URL = Knack.scenes._byId[IFRAME_WND_ID.toLowerCase()];
                if (!URL) {
                    ktl.log.clog('red', 'Attempted to create iFrameWnd, but could not find page.');
                    return;
                }
                //console.log('URL =', URL);
                //console.log('URL slug =', URL.attributes.slug);

                //Create invisible iFrameWnd window below the app page.
                if (!iFrameWnd && $('.kn-login').length === 0
                    && !window.self.frameElement && Knack.getUserAttributes() != 'No user found') {
                    var index = window.location.href.indexOf('#');
                    iFrameWnd = document.createElement('iFrame');
                    iFrameWnd.setAttribute('id', IFRAME_WND_ID);
                    iFrameWnd.src = window.location.href.slice(0, index + 1) + URL.attributes.slug;

                    document.body.appendChild(iFrameWnd);
                    ktl.iFrameWnd.showIFrame(ktl.userPrefs.getUserPrefs().showIframeWnd);

                    //ktl.log.clog('blue', 'Created iFrameWnd');

                    //If creation fails, re-create.
                    iFrameTimeout = setTimeout(() => {
                        ktl.log.clog('purple', 'ERROR - iFrameWnd creation failed with timeout!');
                        if (ktl.iFrameWnd.getiFrameWnd()) {
                            ktl.iFrameWnd.delete();
                            ktl.iFrameWnd.create();
                        }
                    }, 60000);
                }
            },

            //For KTL internal use.
            delete: function () {
                if (iFrameWnd) {
                    ktl.wndMsg.removeAllMsgOfType('heartbeatMsg'); //TODO:  change to delete all msg for dst === iFrameWnd.
                    iFrameWnd.parentNode.removeChild(iFrameWnd);
                    iFrameWnd = null;
                }
            },

            //No param = toggle.
            showIFrame: function (show) {
                if (!iFrameWnd)
                    return;

                if (typeof show === 'undefined') {
                    show = true;
                    if (iFrameWnd.style.visibility === 'visible')
                        show = false;
                }

                if (show === true) {
                    iFrameWnd.style.width = '100vw';
                    iFrameWnd.style.height = '100vh';
                    iFrameWnd.style.visibility = 'visible';
                } else {
                    iFrameWnd.width = '0';
                    iFrameWnd.height = '0';
                    iFrameWnd.style.visibility = 'hidden';
                }
            },

            getiFrameWnd: function () {
                return iFrameWnd;
            },
        }
    })(); //iFrameWnd

    //====================================================
    //Window message queue feature
    this.wndMsg = (function () {
        //TODO: Make these two below adjustable with setCfg.
        const SEND_RETRIES = 5;
        const MSG_EXP_DELAY = 10000; //Time between req and ack.  Typically less than 5 seconds.

        var lastMsgId = 0;
        var msgQueue = {};
        var heartbeatInterval = null;
        var procMsgInterval = null;
        var processFailedMessages = null; //Process failed app-specific messages.
        var processAppMsg = null; //Process app-specific messages.
        var sendAppMsg = null; //To tx/rx app-specific messages to/from iFrames or child windows.
        var processServerErrors = null; //Process server-related errors like 401, 403, 500, and all others.

        function Msg(type, subtype, src, dst, id, data, expiration, retryCnt = SEND_RETRIES) {
            this.msgType = type;
            this.msgSubType = subtype;
            this.src = src;
            this.dst = dst;
            this.msgId = id;
            this.msgData = data;
            this.expiration = expiration;
            this.retryCnt = retryCnt;
        }

        startMsgQueueProc();

        window.addEventListener('message', (event) => {
            try {
                var msgId = event.data.msgId; //Keep a copy for ack.

                if (event.data.msgSubType === 'req') {
                    ktl.userPrefs.getUserPrefs().showExtraDebugInfo && ktl.log.clog('darkcyan', 'REQ: ' + event.data.msgType + ', ' + event.data.msgSubType + ', ' + msgId + ', ' + event.data.src + ', ' + event.data.dst + ', ' + event.data.retryCnt);

                    switch (event.data.msgType) {
                        case 'iFrameWndReadyMsg':
                            ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            ktl.iFrameWnd.setCfg({ iFrameReady: true });

                            if (ktl.iFrameWnd.getCfg().hbViewId && ktl.iFrameWnd.getCfg().hbViewId !== '')
                                ktl.wndMsg.startHeartbeat();

                            //Delete iFrameWnd and re-create periodically.
                            setTimeout(function () {
                                //ktl.log.clog('purple', 'Reloading frame);
                                if (ktl.iFrameWnd.getiFrameWnd()) {
                                    ktl.iFrameWnd.delete();
                                    ktl.iFrameWnd.create();
                                }
                            }, ONE_HOUR_DELAY);
                            break;
                        case 'heartbeatMsg':
                            var viewId = ktl.iFrameWnd.getCfg().hbViewId;
                            var fieldId = ktl.iFrameWnd.getCfg().acctUtcHbFld;
                            if (!viewId || !fieldId) {
                                ktl.log.clog('purple', 'Found heartbeatMsg with invalid viewId or fieldId:' + viewId + ', ' + fieldId);
                                return;
                            }

                            var utcHb = ktl.core.getCurrentDateTime(true, false, false, true);
                            var locHB = new Date().valueOf();
                            var date = utcHb.substr(0, 10);
                            var sel = document.querySelector('#' + viewId + '-' + fieldId);
                            if (!sel) return; //Happens when logging out or reloading app after a SW update.

                            document.querySelector('#' + viewId + '-' + fieldId).value = date;
                            var time = utcHb.substr(11, 5);
                            document.querySelector('#' + viewId + '-' + fieldId + '-time').value = time;
                            document.querySelector('#' + viewId + ' #' + ktl.iFrameWnd.getCfg().acctTimeZoneFld).value = -(new Date().getTimezoneOffset() / 60);
                            document.querySelector('#' + viewId + ' #kn-input-' + ktl.iFrameWnd.getCfg().acctOnlineFld + ' input').checked = true;

                            //Wait until Submit is completed and ack parent
                            ktl.views.submitAndWait(viewId, { [ktl.iFrameWnd.getCfg().acctSwVersionFld]: APP_KTL_VERSIONS })
                                .then(success => {
                                    var after = Date.parse(success.record[ktl.iFrameWnd.getCfg().acctLocHbFld]);
                                    var diff = locHB - after;
                                    if (diff <= 60000) //One minute discrepancy is common due to calculation delay when submit is minute-borderline.
                                        ktl.wndMsg.send(event.data.msgType, 'ack', IFRAME_WND_ID, ktl.const.MSG_APP, msgId);
                                    else
                                        console.log('Missed HB, diff:', diff);
                                })
                                .catch(failure => {
                                    ktl.userPrefs.getUserPrefs().showExtraDebugInfo && ktl.log.clog('red', 'Failure sending heartbeatMsg: ' + failure);
                                })
                            break;

                        case 'ktlProcessServerErrorsMsg': //Forward any server errors from iFrameWnd to app.
                            ktl.wndMsg.ktlProcessServerErrors(event.data.msgData);
                            break;

                        case 'reloadAppMsg': //No need to ack this msg.  This msg destination must always be App, never iFrameWnd.
                            var msg = event.data.msgData;
                            ktl.debugWnd.lsLog('Rxed reloadAppMsg with: ' + JSON.stringify(msg));

                            if (msg.reason === 'SW_UPDATE') {
                                ktl.core.timedPopup('Updating app to new version, please wait...');
                                ktl.core.waitAndReload(2000);
                            } else if (msg.reason === 'MANUAL_REFRESH') {
                                ktl.core.timedPopup('Reloading app, please wait...');
                                ktl.core.waitAndReload(2000);
                            } else {
                                setTimeout(() => {
                                    if (typeof Android === 'object')
                                        Android.restartApplication()
                                    else
                                        location.reload(true);
                                }, 200);
                            }
                            break;

                        case 'userPrefsChangedMsg':
                            if (window.self.frameElement && (event.data.dst === IFRAME_WND_ID)) {
                                //App to iFrameWnd, when prefs are changed locally by user.
                                //Upload new prefs so other opened browsers can see the changes.
                                var fieldId = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
                                var formId = ktl.iFrameWnd.getCfg().updUserPrefsViewId;
                                if (!formId || !fieldId) return;

                                $(document).off('knack-form-submit.' + formId); //Prevent multiple re-entry.
                                document.querySelector('#' + fieldId).value = event.data.msgData; //Stringified UserPrefsObj.
                                document.querySelector('#' + formId + ' .kn-button.is-primary').click();
                                ktl.log.clog('green', 'Uploading prefs to cloud');

                                //Wait until Submit is completed and ack parent
                                $(document).on('knack-form-submit.' + formId, function (evt, view, record) {
                                    ktl.wndMsg.send(event.data.msgType, 'ack', IFRAME_WND_ID, ktl.const.MSG_APP, msgId);
                                    ktl.views.refreshView(ktl.iFrameWnd.getCfg().curUserPrefsViewId);
                                });
                            } else {
                                //iFrameWnd to App, when prefs changed remotely, by user or Sysop.
                                ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                                ktl.userPrefs.ktlApplyUserPrefs();
                            }
                            break;
                        case 'userFiltersNeedDownloadMsg':
                            ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            ktl.userFilters.downloadUserFilters(event.data.msgData);
                            break;
                        case 'publicFiltersNeedDownloadMsg':
                            ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            ktl.userFilters.downloadPublicFilters(event.data.msgData);
                            break;
                        case 'swVersionsDifferentMsg':
                            ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            ktl.core.timedPopup(Knack.getUserAttributes().name + ' - Versions are different!  Please refresh and Broadcast new version.', 'warning', 4000);
                            break;
                        case 'activityMsg':
                            ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            var viewId = ktl.iFrameWnd.getCfg().hbViewId;
                            var fieldId = ktl.iFrameWnd.getCfg().acctUtcLastActFld;
                            if (viewId && fieldId) {
                                var utcAct = ktl.core.getCurrentDateTime(true, false, false, true);
                                var date = utcAct.substr(0, 10);
                                var field = document.querySelector('#' + viewId + '-' + fieldId);
                                field && (field.value = date);
                                var time = utcAct.substr(11, 5);
                                field = document.querySelector('#' + viewId + '-' + fieldId + '-time');
                                field && (field.value = time);
                            }
                            break;
                        case 'logoutMsg':
                            ktl.wndMsg.send(event.data.msgType, 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            ktl.account.logout();
                            break;
                        default:
                            processAppMsg && processAppMsg(event);
                            break;
                    }
                } else if (event.data.msgSubType === 'ack') {
                    ktl.userPrefs.getUserPrefs().showExtraDebugInfo && ktl.log.clog('darkcyan', 'ACK: ' + event.data.msgType + ', ' + event.data.msgSubType + ', ' + msgId + ', ' + event.data.src + ', ' + event.data.dst + ', ' + event.data.retryCnt);

                    if (event.data.msgType === 'heartbeatMsg')
                        ktl.wndMsg.removeAllMsgOfType(event.data.msgType);
                    else
                        removeMsg(msgId);
                }
            }
            catch (e) {
                ktl.log.clog('purple', 'KTL message handler error:');
                console.log(e);
            }
        })

        function startMsgQueueProc() {
            //Check for pending messages.
            clearInterval(procMsgInterval);
            procMsgInterval = setInterval(function () {
                for (var msgId in msgQueue) {
                    if (/*msgQueue[msgId].msgType !== 'heartbeatMsg' && */ktl.userPrefs.getUserPrefs().showExtraDebugInfo)
                        if (window.self.frameElement)
                            ktl.log.objSnapshot('iFrameWnd processMsgQueue - msgQueue[msgId] =', msgQueue[msgId]);
                        else
                            ktl.log.objSnapshot('app processMsgQueue - msgQueue[msgId] =', msgQueue[msgId]);

                    var exp = Math.round((msgQueue[msgId].expiration - new Date().valueOf()) / 1000);
                    if (exp <= 0)
                        retryMsg(msgId);
                }
            }, 1000);
        }

        function retryMsg(msgId = '') {
            if (--msgQueue[msgId].retryCnt > 0) {
                ktl.userPrefs.getUserPrefs().showExtraDebugInfo && ktl.log.clog('red', 'RETRY MSG: ' + msgQueue[msgId].msgType + ', ' + msgId + ', ' + msgQueue[msgId].retryCnt);
                msgQueue[msgId].expiration = new Date().valueOf() + MSG_EXP_DELAY;
                ktl.wndMsg.send(msgQueue[msgId].msgType, msgQueue[msgId].msgSubType, msgQueue[msgId].src, msgQueue[msgId].dst, msgId, msgQueue[msgId].msgData);
            } else {
                ktl.log.clog('red', 'Msg Send MAX RETRIES Failed!!!');
                ktlProcessFailedMessages(msgId);
            }
        }

        function removeMsg(msgId = '') {
            if (msgQueue[msgId]) {
                delete msgQueue[msgId];
                ktl.userPrefs.getUserPrefs().showExtraDebugInfo && console.log('Msg removed:', msgId);
            }
        }

        function ktlProcessFailedMessages(msgId = '') {
            var msgType = msgQueue[msgId].msgType;
            removeMsg(msgId);

            if (msgType === 'heartbeatMsg') {
                if (ktl.iFrameWnd.getiFrameWnd()) {
                    ktl.log.clog('red', 'iFrameWnd stopped responding.  Re-creating...');
                    ktl.iFrameWnd.delete();
                    ktl.iFrameWnd.create();
                }
            } else {
                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1018 - Message type dropped: ' + msgType + ' in ' + Knack.router.current_scene_key);
                processFailedMessages && processFailedMessages(msgType, msgId);
            }
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.processFailedMessages && (processFailedMessages = cfgObj.processFailedMessages);
                cfgObj.processAppMsg && (processAppMsg = cfgObj.processAppMsg);
                cfgObj.sendAppMsg && (sendAppMsg = cfgObj.sendAppMsg);
                cfgObj.processServerErrors && (processServerErrors = cfgObj.processServerErrors);
            },

            send: function (msgType = '', msgSubType = '', src = '', dst = '', msgId = 0, msgData = null) {
                if (!msgType || !msgSubType) {
                    ktl.log.clog('purple', 'Called Send with invalid parameters');
                    return;
                }

                var msg = new Msg(msgType, msgSubType, src, dst, msgId, msgData);

                if (msgSubType === 'req') {
                    msg.msgId = msgId === 0 ? new Date().valueOf() : msgId;
                    msg.msgId = (lastMsgId === msg.msgId) ? msg.msgId + 1 : msg.msgId;
                    lastMsgId = msg.msgId;
                    msg.expiration = msg.msgId + MSG_EXP_DELAY;
                    msg.retryCnt = SEND_RETRIES;
                    msgQueue[msg.msgId] = msg;
                    //ktl.log.objSnapshot('msgQueue', msgQueue);
                }

                if (src === ktl.const.MSG_APP && dst === IFRAME_WND_ID && ktl.iFrameWnd.getiFrameWnd())
                    ktl.iFrameWnd.getiFrameWnd().contentWindow.postMessage(msg, '*');
                else if (src === IFRAME_WND_ID && dst === ktl.const.MSG_APP)
                    parent.postMessage(msg, '*');
                else
                    sendAppMsg && sendAppMsg(msg);
            },


            //For KTL internal use.
            startHeartbeat: function (run = true) {
                if (!run) {
                    clearInterval(heartbeatInterval);
                    ktl.wndMsg.removeAllMsgOfType('heartbeatMsg');
                    return;
                }

                //Sends a Heartbeat every minute.
                //This is mostly useful for monitoring the sanity of critical accounts.
                //For example, in an industrial production line, where each device has its own account,
                //the Sysop can be notified by email if a device goes down for any reason.
                sendHB(); //Send first HB immediately.
                clearInterval(heartbeatInterval);
                heartbeatInterval = setInterval(function () { sendHB(); }, ONE_MINUTE_DELAY);
                function sendHB() {
                    ktl.wndMsg.send('heartbeatMsg', 'req', ktl.const.MSG_APP, IFRAME_WND_ID);
                };
            },

            removeAllMsgOfType: function (msgType = '') {
                var numRemoved = 0;
                if (Object.keys(msgQueue).length) {
                    for (var msgId in msgQueue) {
                        var type = msgQueue[msgId].msgType;
                        if (type === msgType) {
                            numRemoved++;
                            removeMsg(msgId);
                        }
                    }
                }
                return numRemoved;
            },

            //For KTL internal use.
            ktlProcessServerErrors: function (msg = {}) {
                if ($.isEmptyObject(msg)) return;

                //If an error is detected in the iFrameWnd, redirect it to the app for processing, since all decisions are taken there.
                if (ktl.scenes.isiFrameWnd()) {
                    ktl.wndMsg.send('ktlProcessServerErrorsMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, msg);
                    return;
                }

                if (!ktl.core.isKiosk())
                    ktl.log.clog('purple', 'SERVER ERROR, status=' + msg.status + ', reason=' + msg.reason + ', view=' + msg.viewId + ', caller=' + msg.caller);

                //Log first one only, then pause all subsequent server error logs until next login.
                if (!ktl.storage.lsGetItem('PAUSE_SERVER_ERROR_LOGS')) {
                    ktl.log.addLog(ktl.const.LS_SERVER_ERROR, 'KEC_1023 - Server Error: ' + JSON.stringify(msg));
                    ktl.storage.lsSetItem('PAUSE_SERVER_ERROR_LOGS', JSON.stringify({ [msg.status]: true }));
                }

                if ([401, 403, 500].includes(msg.status)) {
                    if (msg.status === 401 || msg.status === 403) {
                        if (typeof Android === 'object') {
                            if (confirm(`A reboot is needed, do you want to do it now? (code ${msg.status})`))
                                Android.restartApplication();
                        } else {
                            ktl.core.timedPopup('Your log-in has expired. Please log back in to continue.', 'warning', 4000);
                            ktl.account.logout(); //Login has expired, force logout.
                        }
                    } else if (msg.status === 500) {
                        ktl.core.timedPopup('Error 500 has occurred - reloading page...', 'warning');
                        ktl.core.waitAndReload(2000); //Problem:  interrupts the process if happens during a Bulk Edit.
                        //TODO: 1-Add stats counter here   2-Reboot after 3+ times in 3 minutes if Android.
                    } else {
                        //Future errors here.
                    }
                }

                //Now give control to app's callback for further processing if needed.
                processServerErrors && processServerErrors(msg);
            },
        }
    })(); //Window message queue feature

    //====================================================
    //Bulk Operations feature
    //Need to create a role called 'Bulk Edit' and assign it to 'trusty' users who will not wreak havoc.
    //For super users, a role named 'Bulk Delete' can be created to delete records in batches.
    this.bulkOps = (function () {
        var bulkOpsActive = {};
        var bulkOpsRecIdArray = [];
        var bulkOpsHeaderArray = [];
        var bulkOpsViewId = null;
        var bulkOpsLudFieldId = null;
        var bulkOpsLubFieldId = null;
        var bulkOpsDeleteAll = false;
        var previousScene = '';
        var apiData = {};

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (previousScene !== scene.key) {
                previousScene = scene.key;
                bulkOpsRecIdArray = [];
            }
        })

        var preventClick = false;
        $(document).on('mousedown', function (e) {
            //Upon Ctrl+click on a header checkboxes, toggle all on or off.
            if (e.ctrlKey && e.target.getAttribute('type') === 'checkbox' && e.target.classList.contains('bulkEditHeaderCbox')) {
                var viewId = e.target.closest('.kn-table.kn-view');
                if (viewId) {
                    e.stopImmediatePropagation();
                    preventClick = true;
                    viewId = viewId.getAttribute('id');
                    var checked = $('#' + viewId + ' .bulkEditHeaderCbox:checked');
                    $('#' + viewId + ' .bulkEditHeaderCbox').prop('checked', checked.length === 0);
                    updateBulkOpsGuiElements(viewId);
                }
            }
        })

        $(document).on('click', function (e) {
            if (ktl.scenes.isiFrameWnd()) return;

            if (e.target.closest('tr')) {
                if (e.target.getAttribute('type') === 'checkbox') {
                    if (preventClick) {
                        preventClick = false;
                        e.preventDefault();
                        return;
                    }

                    var viewId = e.target.closest('[class*="view_"][id^="view_"]');
                    if (viewId) {
                        viewId = viewId.getAttribute('id');
                        if (e.target.closest('td')) //If click in td row, uncheck master checkbox in header.
                            $('.' + viewId + '.kn-table thead tr input[type=checkbox]').first().prop('checked', false);

                        //If check boxes spread across more than one view, discard all and start again in current target view.
                        if (bulkOpsViewId !== viewId) {
                            if (bulkOpsViewId !== null) { //Uncheck all currently checked in old view.
                                $('.' + bulkOpsViewId + '.kn-table thead tr input[type=checkbox]').prop('checked', false);
                                $('.' + bulkOpsViewId + '.kn-table tbody tr input[type=checkbox]').each(function () {
                                    $(this).prop('checked', false);
                                });

                                updateBulkOpsGuiElements(bulkOpsViewId);
                            }

                            bulkOpsViewId = viewId;
                        }

                        updateBulkOpsGuiElements(viewId);
                    }
                }
            }
        })

        function updateBulkOpsGuiElements(viewId = '') {
            if (!viewId) return;

            bulkOpsHeaderArray = [];
            $('#' + viewId + ' .bulkEditHeaderCbox').each((idx, cb) => {
                var fieldId = $(cb).closest('th');
                fieldId = fieldId.attr('class').split(' ')[0];
                if (fieldId.startsWith('field_')) {
                    if (cb.checked) {
                        $('#' + viewId + ' td.' + fieldId).addClass('bulkEditSelectedCol');
                        bulkOpsHeaderArray.push(fieldId);
                    } else
                        $('#' + viewId + ' td.' + fieldId).removeClass('bulkEditSelectedCol');
                }
            })

            const numChecked = updateBulkOpsRecIdArray(viewId);
            updateDeleteButtonStatus(viewId, numChecked);
            updateHeaderCheckboxes(viewId, numChecked);
            enableBulkCopy(viewId, numChecked);
            $('#ktl-bulk-reuse-last-src-' + viewId).prop('disabled', !numChecked);

            if (numChecked > 0)
                ktl.views.autoRefresh(false);
            else
                ktl.views.autoRefresh();
        }

        //The entry point of the feature, where Bulk Ops is enabled per view, depending on account role permission.
        //Called upon each view rendering.
        function enableBulkOperations(view, data) {
            var viewObj = ktl.views.getViewObj(view.key);
            if (!viewObj) return;

            //Wait until summary section is done rendering.
            if (ktl.views.viewHasSummary(view.key)) {
                //Wait until all the summary rows have finished rendering.
                ktl.views.addSummaryObserver(view.key, enableBulkOperationsPostSummary); //TODO: replace with new trigger('KTL... method?

                function enableBulkOperationsPostSummary() {
                    addBulkdOpsGuiElements(view, data);
                }
            } else
                addBulkdOpsGuiElements(view, data);

            function addBulkdOpsGuiElements(view, data) {
                bulkOpsAddCheckboxesToTable(view.key);
                ktl.views.fixTableRowsAlignment(view.key);
                addBulkOpsButtons(view, data);

                //Put back checkboxes that were checked before view refresh.
                if (view.key === bulkOpsViewId) {
                    //Rows
                    for (var i = 0; i < bulkOpsRecIdArray.length; i++) {
                        var cb = $('#' + view.key + ' tr[id="' + bulkOpsRecIdArray[i] + '"] :checkbox');
                        if (cb.length)
                            cb[0].checked = true;
                    }

                    //Columns
                    for (var i = 0; i < bulkOpsHeaderArray.length; i++) {
                        var cb = $('#' + view.key + ' th.' + bulkOpsHeaderArray[i] + ' :checkbox');
                        if (cb.length)
                            cb[0].checked = true;
                    }
                }

                if (viewCanDoBulkOp(view.key, 'edit')) {
                    //When user clicks on a row, to indicate the record source.
                    $('#' + view.key + ' tr td.cell-edit:not(:checkbox):not(.ktlNoInlineEdit)').bindFirst('click', e => {
                        var tableRow = e.target.closest('tr');
                        if (tableRow) {
                            if (bulkOpsRecIdArray.length > 0) {
                                //Prevent Inline Edit.
                                e.stopImmediatePropagation();
                                apiData = {};
                                processBulkOps(view.key, e);
                            }
                        }
                    })
                }

                updateBulkOpsGuiElements(view.key);
            }
        }

        function bulkOpsAddCheckboxesToTable(viewId) {
            if (!viewId) return;
            const viewType = ktl.views.getViewType(viewId);
            if (viewType !== 'table' && viewType !== 'search') {
                ktl.log.clog('purple', 'bulkOpsAddCheckboxesToTable - unsupported view type', viewId, viewType);
                return;
            }

            //Only add checkboxes if there's data and checkboxes not yet added.
            var selNoData = $('#' + viewId + ' > div.kn-table-wrapper > table > tbody > tr > td.kn-td-nodata');
            if (selNoData.length === 0 && !document.querySelector('#' + viewId + ' .kn-table th:nth-child(1) input[type=checkbox]')) {
                // Add the master checkbox to to the header to select/unselect all
                $('#' + viewId + ' .kn-table thead tr').prepend('<th style="width: 24px;"><input type="checkbox"></th>');
                $('#' + viewId + ' .kn-table thead input').addClass('masterSelector');
                $('#' + viewId + ' .masterSelector').change(function () {
                    $('#' + viewId + ' tr td input:checkbox').each(function () {
                        $(this).attr('checked', $('#' + viewId + ' th input:checkbox').attr('checked') !== undefined);
                    });

                    updateBulkOpsGuiElements(viewId);
                });

                //Add a checkbox to each header that is inline-editable.
                if (viewCanDoBulkOp(viewId, 'edit') || viewCanDoBulkOp(viewId, 'copy')) {
                    $('#' + viewId + ' thead th').each((idx, el) => {
                        var inline = $('#' + viewId + ' tbody tr:not(.kn-table-group:first) td:nth-child(' + (idx) + ')');

                        //Don't add checkboxes for headers having fields with these keywords.
                        var kwNoCheckBox = false;
                        var kw = {};
                        var fieldId = el.classList[0];
                        if (fieldId && fieldId.startsWith('field_')) {
                            ktl.fields.getFieldKeywords(fieldId, kw);
                            if (!$.isEmptyObject(kw)) {
                                if (kw[fieldId]._lud || kw[fieldId]._lub)
                                    kwNoCheckBox = true;
                            }
                        }

                        if (idx > 0 && inline.length && inline[0].classList.contains('cell-edit') && !inline[0].classList.contains('ktlNoInlineEdit') && !kwNoCheckBox) {
                            $(el).find('.table-fixed-label').css('display', 'inline-flex').append('<input type="checkbox">').addClass('bulkEditTh');
                            $(el).find('input:checkbox').addClass('bulkEditHeaderCbox');
                        }
                    })

                    $('#' + viewId + ' thead input:checkbox').addClass('bulkEditCb');
                }

                //Add a checkbox to each row in the table body
                $('#' + viewId + ' tbody tr').each(function () {
                    if (this.id && !this.classList.contains('kn-table-totals') && !this.classList.contains('kn-table-group')) {
                        $(this).prepend('<td><input type="checkbox"></td>');
                    }
                });

                $('#' + viewId + ' tbody tr td input:checkbox').addClass('bulkEditCb');
            }
        }

        function addBulkOpsButtons(view, data) {
            if (document.querySelector('#' + view.key + ' .bulkOpsControlsDiv')) return;

            var prepend = false;
            var searchFound = false;

            var div = document.querySelector('#' + view.key + ' .table-keyword-search .control.has-addons');
            if (div) {
                searchFound = true;
            } else
                div = document.querySelector('#' + view.key + ' .kn-submit.control'); //For search views.

            if (!div)
                div = document.querySelector('#' + view.key + ' .view-header');

            if (!div) {
                div = document.querySelector('#' + view.key);
                if (!div) return; //Support other layout options as we go.
                prepend = true;
            }

            var bulkOpsControlsDiv = document.createElement('div');
            bulkOpsControlsDiv.classList.add('bulkOpsControlsDiv');
            bulkOpsControlsDiv.setAttribute('id', 'bulkOpsControlsDiv-' + view.key);

            if (searchFound) {
                if (Knack.isMobile())
                    $(bulkOpsControlsDiv).css('margin-top', '2%');
                else
                    bulkOpsControlsDiv.classList.add('bulkOpsControlsWithSearchDiv');
            }

            prepend ? $(div).prepend(bulkOpsControlsDiv) : $(div).append(bulkOpsControlsDiv);

            addBulkDeleteButtons(view, data);
            addReuseLastSourceButton(view);
        }

        function addBulkDeleteButtons(view, data) {
            if (!document.querySelector('#' + view.key + ' .kn-link-delete')
                || !ktl.core.getCfg().enabled.bulkOps.bulkDelete
                || !viewCanDoBulkOp(view.key, 'delete')
                || !data.length
                || ktl.scenes.isiFrameWnd())
                return;

            //Add Delete Selected button.
            if (!document.querySelector('#ktl-bulk-delete-selected-' + view.key)) {
                var deleteRecordsBtn = ktl.fields.addButton(document.querySelector('#' + view.key + ' .bulkOpsControlsDiv'), '', '', ['kn-button', 'ktlButtonMargin'], 'ktl-bulk-delete-selected-' + view.key);
                deleteRecordsBtn.addEventListener('click', function (event) {
                    var deleteArray = [];
                    $('#' + view.key + ' tbody input[type=checkbox]:checked').each(function () {
                        if (!$(this).closest('.kn-table-totals').length) {
                            deleteArray.push($(this).closest('tr').attr('id'));
                        }
                    });

                    ktl.bulkOps.deleteRecords(deleteArray, view)
                        .then(function () {
                            $.blockUI({
                                message: '',
                                overlayCSS: {
                                    backgroundColor: '#ddd',
                                    opacity: 0.2,
                                    cursor: 'wait'
                                },
                            })

                            ktl.views.refreshView(view.key).then(function (model) {
                                $.unblockUI();
                                setTimeout(() => {
                                    if (bulkOpsDeleteAll) {
                                        if (model && model.length > 0) {
                                            $('#ktl-bulk-delete-all-' + view.key).click();
                                        } else {
                                            bulkOpsDeleteAll = false;
                                            alert('Delete All has completed successfully');
                                        }
                                    } else
                                        alert('Deleted Selected has completed successfully');
                                }, 500);
                            });
                        })
                        .catch(function (response) {
                            $.unblockUI();
                            ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1024 - Bulk Delete failed, reason: ' + response);
                            setTimeout(() => {
                                alert('Failed deleting record.\n' + response);
                            }, 500);
                        })
                });
            }

            //Delete All button for massive delete operations, with automated looping over all pages automatically.
            //Only possible when filtering is used.
            if (document.querySelector('#' + view.key + ' .kn-tag-filter') && !document.querySelector('#ktl-bulk-delete-all-' + view.key)) {
                var deleteAllRecordsBtn = ktl.fields.addButton(document.querySelector('.bulkOpsControlsDiv'), '', '', ['kn-button', 'ktlButtonMargin'], 'ktl-bulk-delete-all-' + view.key);
                if (data.length > 0)
                    deleteAllRecordsBtn.disabled = false;
                else
                    deleteAllRecordsBtn.disabled = true;

                //Get total number of records to delete.  Either get it from summary, or from data length when summary not shown (less than ~7 records).
                var totalRecords = $('#' + view.key + ' .kn-entries-summary').last();
                if (totalRecords.length > 0)
                    totalRecords = totalRecords.html().substring(totalRecords.html().lastIndexOf('of</span> ') + 10).replace(/\s/g, '');
                else
                    totalRecords = data.length;

                deleteAllRecordsBtn.textContent = 'Delete All: ' + totalRecords;

                deleteAllRecordsBtn.addEventListener('click', function (event) {
                    var allChk = $('#' + view.key + ' > div.kn-table-wrapper > table > thead > tr > th:nth-child(1) > input[type=checkbox]');
                    if (allChk.length > 0) {
                        if (data.length > 0) {
                            if (!bulkOpsDeleteAll) { //First time, kick start process.
                                const objName = ktl.views.getViewSourceName(view.key);
                                if (confirm('Are you sure you want to delete all ' + totalRecords + ' ' + objName + ((totalRecords > 1 && objName.slice(-1) !== 's') ? 's' : '') + '?\nNote:  you can abort the process at any time by pressing F5.'))
                                    bulkOpsDeleteAll = true;
                                //Note that pressing Escape on keyboard to exit the "confim" dialog causes a loss of focus.  Search stops working since you can't type in text.
                                //You must click Delete All again and click Cancel with the mouse to restore to normal behavior!  Weird...
                            }

                            if (bulkOpsDeleteAll) {
                                allChk[0].click();
                                setTimeout(function () {
                                    $('#ktl-bulk-delete-selected-' + view.key).click();
                                }, 500);
                            }
                        } else { //For good luck - should never happen since button is disabled when no data.
                            bulkOpsDeleteAll = false;
                            console.log('DELETE ALL MODE - No data to delete');
                        }
                    }
                });
            }

            $('#' + view.key + ' input[type=checkbox]').on('click', function (e) {
                var numChecked = $('#' + view.key + ' tbody input[type=checkbox]:checked').length;

                //If Delete All was used, just keep going!
                if (numChecked && bulkOpsDeleteAll)
                    $('#ktl-bulk-delete-selected-' + view.key).click();
            });
        }

        function updateDeleteButtonStatus(viewId = '', numChecked) {
            var deleteRecordsBtn = document.querySelector('#ktl-bulk-delete-selected-' + viewId);
            if (deleteRecordsBtn) {
                deleteRecordsBtn.disabled = !numChecked;
                deleteRecordsBtn.textContent = 'Delete Selected: ' + numChecked;
            }

            ktl.views.autoRefresh(!numChecked); //If a checkbox is clicked, pause auto-refresh otherwise user will lose all selections.
        }

        function addReuseLastSourceButton(view) {
            if ($.isEmptyObject(apiData) || document.querySelector('#ktl-bulk-reuse-last-src-' + view.key)) return;
            var reuseLastSourceBtn = ktl.fields.addButton(document.querySelector('#' + view.key + ' .bulkOpsControlsDiv'), 'Reuse Last Source', '', ['kn-button', 'ktlButtonMargin', 'bulkEditSelectSrc'], 'ktl-bulk-reuse-last-src-' + view.key);
            reuseLastSourceBtn.addEventListener('click', function (e) {
                if (e.ctrlKey)
                    previewLastBulkEditData();
                else
                    processBulkOps(view.key, e);
            })
        }

        function previewLastBulkEditData() {
            var lastData = JSON.stringify(apiData, null, 4);
            alert(lastData);
        }

        function updateHeaderCheckboxes(viewId, numChecked = 0) {
            if (!viewId || (!viewCanDoBulkOp(viewId, 'edit') && !viewCanDoBulkOp(viewId, 'copy'))) return;
            if (numChecked) {
                $('#' + viewId + ' .bulkEditHeaderCbox').removeClass('ktlDisplayNone');

                if ($('#' + viewId + ' .bulkEditHeaderCbox:checked').length)
                    $('#' + viewId + ' tbody tr td').addClass('bulkEditSelectSrc');
                else
                    $('#' + viewId + ' tbody tr td.cell-edit').addClass('bulkEditSelectSrc');

            } else {
                $('#' + viewId + ' .bulkEditHeaderCbox').addClass('ktlDisplayNone');
                $('#' + viewId + ' tbody tr td').removeClass('bulkEditSelectSrc');
            }
        }

        //Called to refresh the record array to be modified.
        //Can be changed by user clicks, table filtering change, page reload and page change.
        //Returns the number of selected records (checked).
        function updateBulkOpsRecIdArray(viewId) {
            if (!viewId) return;
            bulkOpsRecIdArray = [];
            $('#' + viewId + ' .bulkEditSelectedRow').removeClass('bulkEditSelectedRow');
            $('#' + viewId + ' tbody input[type=checkbox]:checked').each(function () {
                var id = $(this).closest('tr').attr('id');
                bulkOpsRecIdArray.push(id);
                $(this).closest('tr').find('td:not(.ktlNoInlineEdit)').addClass('bulkEditSelectedRow');
                $(this).closest('tr').find('td :checkbox').parent().removeClass('bulkEditSelectedRow')
            });

            return bulkOpsRecIdArray.length;
        }

        //For Bulk Edit, called when user clicks on a row and when there are some checkboxes enabled.
        //For Bulk Copy, called when user clicks on Bulk Copy button, when one row is selected and at least one column.
        function processBulkOps(viewId, e) {
            if (!viewId) return;

            var numToProcess = 0;
            var recId;
            var operation = e.target.id;
            if (operation === 'ktl-bulk-copy-' + viewId) {
                //Bulk Copy
                numToProcess = prompt('How many copies do you want to create?', 0);
                numToProcess = parseInt(numToProcess);
                if (isNaN(numToProcess) || numToProcess <= 0) {
                    alert('Must chose a numeric value higher than zero.');
                    return;
                }

                recId = bulkOpsRecIdArray[0];
            } else {
                //Bulk Edit
                if (confirm('Are you sure you want to apply this source data to ' + bulkOpsRecIdArray.length + ' selected records?')) {
                    numToProcess = 1;
                    //e.stopImmediatePropagation();
                }
            }

            if (numToProcess > 0) {
                if (!$.isEmptyObject(apiData) && e.target.id === 'ktl-bulk-reuse-last-src-' + viewId) {
                    processBulkEdit(); //Reuse Last Source button.
                } else {
                    recId = recId || e.target.closest('tr[id]').id;
                    const src = Knack.views[viewId].model.data._byId[recId].attributes;

                    //Add all selected fields from header.
                    var checkedFields = $('.bulkEditHeaderCbox:is(:checked)');
                    if (checkedFields.length) {
                        checkedFields.each((idx, cbox) => {
                            var fieldId = $(cbox).closest('th').attr('class').split(' ')[0];
                            if (fieldId.startsWith('field_')) {
                                if (cbox.checked) {
                                    apiData[fieldId] = src[fieldId + '_raw'];

                                    //Support date formats with day month year.  Issue #132
                                    const fieldType = ktl.fields.getFieldType(fieldId);
                                    if (fieldType === 'date_time')
                                        apiData[fieldId].date = apiData[fieldId].date_formatted;
                                }
                            }
                        })
                    } else {
                        //If no column selected, use field clicked.
                        var clickedFieldId = $(e.target).closest('td[class^="field_"].cell-edit');
                        if (clickedFieldId.length && clickedFieldId.attr('data-field-key').startsWith('field_')) {
                            clickedFieldId = clickedFieldId.attr('data-field-key');
                            apiData[clickedFieldId] = src[clickedFieldId + '_raw'];
                            const fieldType = ktl.fields.getFieldType(clickedFieldId);

                            //Support date formats with day month year.  Issue #132
                            if (fieldType === 'date_time')
                                apiData[clickedFieldId].date = apiData[clickedFieldId].date_formatted;
                        }
                    }

                    if (operation === 'ktl-bulk-copy-' + viewId)
                        processBulkCopy();
                    else
                        processBulkEdit();
                }

                function processBulkEdit() {
                    const objName = ktl.views.getViewSourceName(bulkOpsViewId);

                    if (bulkOpsLudFieldId && bulkOpsLubFieldId) {
                        apiData[bulkOpsLudFieldId] = ktl.core.getFormattedCurrentDateTime(Knack.fields[bulkOpsLudFieldId].attributes.format.date_format)
                        apiData[bulkOpsLubFieldId] = [Knack.getUserAttributes().id];
                    }

                    ktl.core.infoPopup();
                    ktl.views.autoRefresh(false);
                    ktl.scenes.spinnerWatchdog(false);
                    Knack.showSpinner();

                    var arrayLen = bulkOpsRecIdArray.length;

                    var idx = 0;
                    var countDone = 0;
                    var itv = setInterval(() => {
                        if (idx < arrayLen)
                            updateRecord(bulkOpsRecIdArray[idx++]);
                        else
                            clearInterval(itv);
                    }, 150);

                    function updateRecord(recId) {
                        showProgress();
                        ktl.core.knAPI(bulkOpsViewId, recId, apiData, 'PUT', [], false)
                            .then(function () {
                                if (++countDone === bulkOpsRecIdArray.length) {
                                    bulkOpsRecIdArray = [];
                                    postBulkOpsRestoreState();
                                    ktl.views.refreshView(bulkOpsViewId).then(function () {
                                        setTimeout(() => {
                                            alert('Bulk Edit completed successfully');
                                        }, 500);
                                    })
                                } else
                                    showProgress();
                            })
                            .catch(function (reason) {
                                postBulkOpsRestoreState();
                                setTimeout(() => {
                                    alert('Bulk Edit Error: ' + JSON.parse(reason.responseText).errors[0].message);
                                }, 500);
                            })

                        function showProgress() {
                            ktl.core.setInfoPopupText('Updating ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (arrayLen - countDone));
                        }
                    }
                }

                function processBulkCopy() {
                    const objName = ktl.views.getViewSourceName(bulkOpsViewId);

                    if (bulkOpsLudFieldId && bulkOpsLubFieldId) {
                        apiData[bulkOpsLudFieldId] = ktl.core.getFormattedCurrentDateTime(Knack.fields[bulkOpsLudFieldId].attributes.format.date_format);
                        apiData[bulkOpsLubFieldId] = [Knack.getUserAttributes().id];
                    }

                    ktl.core.infoPopup();
                    ktl.views.autoRefresh(false);
                    ktl.scenes.spinnerWatchdog(false);

                    var countDone = 0;
                    var countInprocess = 0;
                    var itv = setInterval(() => {
                        if (countInprocess++ < numToProcess)
                            createRecord();
                        else
                            clearInterval(itv);
                    }, 150);

                    function createRecord() {
                        showProgress();
                        ktl.core.knAPI(bulkOpsViewId, null, apiData, 'POST', [], false)
                            .then(function () {
                                if (++countDone === numToProcess) {
                                    postBulkOpsRestoreState();
                                    ktl.views.refreshView(bulkOpsViewId).then(function () {
                                        ktl.views.autoRefresh();
                                        alert('Bulk Copy completed successfully');
                                    })
                                } else
                                    showProgress();
                            })
                            .catch(function (reason) {
                                postBulkOpsRestoreState();
                                alert('Bulk Copy Error: ' + JSON.parse(reason.responseText).errors[0].message);
                            })

                        function showProgress() {
                            ktl.core.setInfoPopupText('Creating ' + numToProcess + ' ' + objName + ((numToProcess > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (numToProcess - countDone));
                        }
                    }
                }
            }
        }

        function enableBulkCopy(viewId, numChecked) {
            if (!viewCanDoBulkOp(viewId, 'copy')) return;
            if (numChecked === 1) {
                var bulkCopyBtn = ktl.fields.addButton(document.querySelector('#' + viewId + ' .bulkOpsControlsDiv'), 'Bulk Copy', '', ['kn-button', 'ktlButtonMargin', 'bulkEditSelectSrc'], 'ktl-bulk-copy-' + viewId);
                bulkCopyBtn.disabled = ($('#' + viewId + ' .bulkEditHeaderCbox:is(:checked)').length === 0);
                $(bulkCopyBtn).off('click').on('click', function (e) {
                    apiData = {};
                    processBulkOps(viewId, e);
                })

            } else
                $('#ktl-bulk-copy-' + viewId).remove();
        }

        //bulkOp must be "edit", "copy" or "delete".  No parameter means disable ALL bulk ops.
        function viewCanDoBulkOp(viewId, bulkOp) {
            if (!viewId || !bulkOp) return false;

            const nbo = ktlKeywords[viewId] && ktlKeywords[viewId]._nbo;
            let bulkOpDisabled = false;
            if (nbo !== undefined) {
                if (nbo.length === 0)
                    bulkOpDisabled = true;
                else {
                    if (!nbo[0].params[0].length || nbo[0].params[0].includes(bulkOp))
                        bulkOpDisabled = true;
                }
            }

            let tableHasInlineEditing = ktl.views.viewHasInlineEdit(viewId);

            //Bulk Edit
            if (bulkOp === 'edit'
                && ktl.core.getCfg().enabled.bulkOps.bulkEdit
                && Knack.getUserRoleNames().includes('Bulk Edit')
                && tableHasInlineEditing
                && !bulkOpDisabled)
                return true;

            //Bulk Copy
            if (bulkOp === 'copy'
                && ktl.core.getCfg().enabled.bulkOps.bulkCopy
                && Knack.getUserRoleNames().includes('Bulk Copy')
                && tableHasInlineEditing
                && !bulkOpDisabled)
                return true;

            //Bulk Delete
            if (bulkOp === 'delete'
                && ktl.core.getCfg().enabled.bulkOps.bulkDelete
                && Knack.getUserRoleNames().includes('Bulk Delete')
                && document.querySelector('#' + viewId + ' .kn-link-delete')
                && !bulkOpDisabled)
                return true;

            return false;
        }

        function postBulkOpsRestoreState() {
            ktl.core.removeInfoPopup();
            ktl.core.removeTimedPopup();
            Knack.hideSpinner();
            ktl.scenes.spinnerWatchdog();
            ktl.views.autoRefresh();
        }

        return {
            //View param is view object, not view.key.  deleteArray is an array of record IDs.
            deleteRecords: function (deleteArray, view) {
                return new Promise(function (resolve, reject) {
                    var arrayLen = deleteArray.length;
                    if (arrayLen === 0)
                        reject('Called deleteRecords with empty array.');

                    const objName = ktl.views.getViewSourceName(view.key);

                    ktl.scenes.spinnerWatchdog(false);
                    Knack.showSpinner();
                    ktl.core.infoPopup();

                    var idx = 0;
                    var countDone = 0;
                    var itv = setInterval(() => {
                        if (idx < arrayLen)
                            deleteRecord(deleteArray[idx++]);
                        else
                            clearInterval(itv);
                    }, 150);

                    function deleteRecord(recId) {
                        showProgress();
                        ktl.core.knAPI(view.key, recId, {}, 'DELETE', [], false)
                            .then(function () {
                                if (++countDone === deleteArray.length) {
                                    postBulkOpsRestoreState();
                                    resolve();
                                } else
                                    showProgress();
                            })
                            .catch(function (reason) {
                                postBulkOpsRestoreState();
                                reject('deleteRecords - Failed to delete record ' + recId + ', reason: ' + JSON.stringify(reason));
                            })

                        function showProgress() {
                            ktl.core.setInfoPopupText('Deleting ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (arrayLen - countDone));
                        }
                    }
                })
            },

            getBulkOpsActive: function (viewId) {
                return bulkOpsActive[viewId] === true;
            },

            prepareBulkOps: function (view, data) {
                const viewType = ktl.views.getViewType(view.key);
                if (ktl.scenes.isiFrameWnd() || ktl.core.isKiosk() || !(viewType === 'table' || viewType === 'search'))
                    return;

                if (!viewCanDoBulkOp(view.key, 'edit') && !viewCanDoBulkOp(view.key, 'copy') && !viewCanDoBulkOp(view.key, 'delete'))
                    return;

                //Put code below in a shared function (see _lud in this.log).
                var fields = view.fields;
                if (!fields) return;

                var lud = '';
                var lub = '';
                var descr = '';
                for (var f = 0; f < view.fields.length; f++) {
                    var field = fields[f];
                    descr = field.meta && field.meta.description.replace(/(\r\n|\n|\r)|<[^>]*>/gm, " ").replace(/ {2,}/g, ' ').trim();
                    descr === '_lud' && (lud = field.key);
                    descr === '_lub' && (lub = field.key);
                }

                if (lud && lub) {
                    bulkOpsLudFieldId = lud;
                    bulkOpsLubFieldId = lub;
                }


                //IMPORTANT!!  noInlineEditing must be called before enableBulkOperations because
                //its effect on the cells' inline editing has an impact on the bulk selection process.
                ktl.views.noInlineEditing(view);

                if (viewCanDoBulkOp(view.key, 'edit') || viewCanDoBulkOp(view.key, 'copy') || viewCanDoBulkOp(view.key, 'delete')) {
                    bulkOpsActive[view.key] = true;
                    enableBulkOperations(view, data);
                }
            },
        }
    })(); //Bulk Operations feature

    //====================================================
    //System Info feature
    this.sysInfo = (function () {
        const STARTUP_WD_TIMEOUT_DELAY = 60;
        const NORMAL_WD_TIMEOUT_DELAY = 20;
        const WD_SAFETY_MARGIN = 1.5;

        var sysInfo = {
            os: 'Unknown',
            browser: 'Unknown',
            ip: 'Unknown',
            model: 'Unknown',
            processor: 'Unknown',
            mobile: '',
            hasLocalServer: false,
        };

        var cfg = {
            appBcstSWUpdateViewId: ktl.core.getViewIdByTitle('SW Update', Knack.router.current_scene_key, true),
        };

        //Comes from here:  https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
        (function detectSysInfo() {
            // Opera 8.0+
            var isOpera = ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) ? 'Opera' : '';
            // Firefox 1.0+
            var isFirefox = (typeof InstallTrigger !== 'undefined') ? 'Firefox' : '';
            // Safari 3.0+ "[object HTMLElementConstructor]"
            var isSafari = (/constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && window['safari'].pushNotification))) ? 'Safari' : '';
            // Internet Explorer 6-11
            var isIE = (/*@cc_on!@*/false || !!document.documentMode) ? 'IE' : '';
            // Edge 20+
            var isEdge = (!isIE && !!window.StyleMedia) ? 'Edge' : '';
            // Chrome 1 - 79
            var isChrome = (!!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime)) ? 'Chrome' : '';
            // Edge (based on chromium) detection
            var isEdgeChromium = (isChrome && (navigator.userAgent.indexOf("Edg") != -1)) ? 'Edge Chromium' : '';

            sysInfo.browser = (isEdgeChromium || isChrome) + isOpera + isFirefox + isEdge + isIE + isSafari;

            // Engine type detection - Blink or Unknown
            var engineType = ((isChrome || isOpera) && !!window.CSS) ? 'Blink' : 'Unknown';
            sysInfo.engine = engineType;

            if (navigator.userAgent.includes('Android'))
                sysInfo.os = 'Android';
            else if (navigator.userAgent.includes('Windows'))
                sysInfo.os = 'Windows';
            else if (navigator.userAgent.includes('Linux') || navigator.platform.includes('Linux'))
                sysInfo.os = 'Linux';
            else if (navigator.userAgent.includes('Mac OS'))
                sysInfo.os = 'Mac OS';

            if (navigator.userAgent.includes('T2lite'))
                sysInfo.model = 'T2Lite';
            else if (navigator.userAgent.includes('D1-G'))
                sysInfo.model = 'D1-G';

            if (navigator.userAgent.includes('x64'))
                sysInfo.processor = 'x64';
            else if (navigator.userAgent.includes('armv7'))
                sysInfo.processor = 'armv7';
            else if (navigator.userAgent.includes('arch64'))
                sysInfo.processor = 'armv8';
            else if (navigator.userAgent.includes('x86'))
                sysInfo.processor = 'x86';

            sysInfo.mobile = Knack.isMobile().toString();

            getPublicIP()
                .then((ip) => { sysInfo.ip = ip; })
                .catch(() => { console.log('KTL\'s getPublicIP failed.  Make sure uBlock not active.'); })
        })();

        function getPublicIP() {
            return new Promise(function (resolve, reject) {
                //NOTE:  This will not work if browser has uBlock Origin extension enabled.
                $.get('https://www.cloudflare.com/cdn-cgi/trace', function (data, status) {
                    if (status === 'success') {
                        var index = data.indexOf('ip=') + 3;
                        var publicIP = data.substr(index);
                        index = publicIP.indexOf('\n');
                        publicIP = publicIP.substr(0, index);
                        if (ktl.core.isIPFormat(publicIP))
                            resolve(publicIP);
                        else
                            reject();
                    } else
                        reject();
                });
            });
        }

        //SW Update
        $(document).on('knack-view-render.any', function (event, view, data) {
            if (view.key === cfg.appBcstSWUpdateViewId) {
                var appSettingsObj = ktl.core.getObjectIdByName('App Settings');
                var bcstAction = $('#' + cfg.appBcstSWUpdateViewId + ' .kn-action-link:contains("BROADCAST NOW")');
                if (bcstAction.length) {
                    bcstAction.on('click', function (e) {
                        var apiData = {};
                        apiData[ktl.core.getFieldIdByName('Value', appSettingsObj)] = APP_KTL_VERSIONS;
                        apiData[ktl.core.getFieldIdByName('Date/Time', appSettingsObj)] = ktl.core.getCurrentDateTime(true, true, false, true);
                        ktl.log.clog('orange', 'Updating versions in table...');
                        ktl.core.knAPI(cfg.appBcstSWUpdateViewId, data[0].id, apiData, 'PUT', [cfg.appBcstSWUpdateViewId])
                            .then(function (response) { ktl.log.clog('green', 'Versions updated successfully!'); })
                            .catch(function (reason) { alert('An error occurred while updating versions in table, reason: ' + JSON.stringify(reason)); })
                    });
                }
            }
        })

        $(document).on('KTL.DefaultConfigReady', () => {
            if (ktl.scenes.isiFrameWnd()) return;

            this.recoveryWatchdog = (function () {
                //Check if we're running Android with Kiosk Browser app,
                //or Linux - based(ex: Raspberry PI 4) and enable the Recovery Watchdog.
                let deviceIsCompatibleWithRecoveryWd = false;
                if (typeof Android !== 'undefined' && typeof Android.resetWatchdog === 'function') {
                    deviceIsCompatibleWithRecoveryWd = true;
                } else if ((sysInfo.os === 'Linux' /*&& sysInfo.processor.includes('arm')*/))
                    deviceIsCompatibleWithRecoveryWd = true;

                if (deviceIsCompatibleWithRecoveryWd) {
                    if (!cfg.recoveryWatchdogEnabled) {
                        ktl.sysInfo.sendRecoveryWdHeartbeat(0); //Zero means "Disable Recovery WD".
                        return;
                    }
                } else
                    return;

                var wdLoopTimeout;
                var maxMemUsage = 0;

                var simulateCrash = false; //Just for temporary testing during development.

                if (cfg.recoveryWatchdogEnabled) {
                    $(document).one('click', resetWdOntouch);

                    function resetWdOntouch(e) {
                        //console.log('resetWdOntouch:', e.type);
                        resetRecoveryWatchdog(NORMAL_WD_TIMEOUT_DELAY);
                        setTimeout(() => {
                            $(document).one('click', resetWdOntouch);
                        }, 5000);
                    }

                    $(document).on('knack-scene-render.any', (event, scene) => {
                        resetRecoveryWatchdog(NORMAL_WD_TIMEOUT_DELAY);

                        //    simulateCrash = false;
                        //    $(document).on('keydown touchstart', function (event) {
                        //        if (/*event.type === 'touchstart' || */event.key === '!') {
                        //            ktl.core.timedPopup('STOPPING WATCHDOG...', 'error', 2000);
                        //            simulateCrash = true;
                        //        }
                        //    })
                    });

                    function resetRecoveryWatchdog(wdTimeoutDelay = STARTUP_WD_TIMEOUT_DELAY) {
                        function recoveryWdLoop() {
                            if (!simulateCrash) {
                                clearTimeout(wdLoopTimeout);
                                ktl.sysInfo.sendRecoveryWdHeartbeat(wdTimeoutDelay)
                                    .then(svrResponse => {
                                        wdTimeoutDelay = NORMAL_WD_TIMEOUT_DELAY;
                                        if (svrResponse.memory)
                                            updateMemoryUsage(svrResponse);

                                        if (ktl.account.isDeveloper()) {
                                            var svrMsg = svrResponse.message;
                                            if (svrResponse.memory) {
                                                svrMsg += ' - ' + svrResponse.memory.usedMemory;
                                            }

                                            //console.log('svrMsg =', svrMsg);
                                            //ktl.core.timedPopup(svrMsg, 'success', 3000);
                                        }
                                    })
                                    .catch(reason => {
                                        console.error(reason);
                                        if (ktl.core.getCfg().developerNames.includes(Knack.getUserAttributes().name))
                                            ktl.core.timedPopup('Reset WD error: ' + reason, 'error');
                                        wdTimeoutDelay = STARTUP_WD_TIMEOUT_DELAY;
                                    })
                                    .finally(() => {
                                        wdLoopTimeout = setTimeout(recoveryWdLoop, wdTimeoutDelay / WD_SAFETY_MARGIN * 1000);
                                    });
                            }
                        }

                        function updateMemoryUsage(svrResponse) {
                            if (!$('#verButtonId').length) return;

                            if (!$('#additionalInfoDiv').length) {
                                const vbDiv = document.querySelector('#addVersionInfoDiv');
                                var additionalInfoDiv = document.createElement('div');
                                additionalInfoDiv.setAttribute('id', 'additionalInfoDiv');
                                vbDiv.appendChild(additionalInfoDiv);

                                var sourceDiv = document.getElementById('verButtonId');
                                var targetDiv = document.getElementById('additionalInfoDiv');

                                targetDiv.style.cssText = sourceDiv.style.cssText;
                                $('#addVersionInfoDiv').css('display', 'flex');
                            }

                            maxMemUsage = Math.max(maxMemUsage, svrResponse.memory.usedMemory);
                            const percentageMem = Math.round(maxMemUsage / svrResponse.memory.totalMemory * 100);
                            document.querySelector('#additionalInfoDiv').textContent = '  Mem: ' + svrResponse.memory.usedMemory + ' Max: ' + maxMemUsage + ' ' + percentageMem + '% / ' + svrResponse.memory.totalGB;
                        }

                        recoveryWdLoop();
                    }

                    resetRecoveryWatchdog(STARTUP_WD_TIMEOUT_DELAY); //Entry point.
                }
            })(); //recoveryWatchdog
        });

        return {
            getSysInfo: function () {
                return sysInfo;
            },

            setCfg: function (cfgObj = {}) {
                cfgObj.recoveryWatchdogEnabled && (cfg.recoveryWatchdogEnabled = cfgObj.recoveryWatchdogEnabled);
            },

            //See list here: https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Keywords
            //Show only what contains search string parameter, or all if empty.
            findAllKeywords: function (search = '') {
                var result = '';
                var st = window.performance.now();
                search && console.log('Searching all keywords for:', search);
                const regex = new RegExp(search, 'i');

                var builderUrl;
                var appUrl;

                for (var kwKey in ktlKeywords) {
                    const kwInfo = ktlKeywords[kwKey];
                    const str = JSON.stringify(kwInfo, null, 4);
                    if (regex.test(str)) {
                        if (kwKey.startsWith('view_')) {
                            for (var s = 0; s < Knack.scenes.models.length; s++) {
                                var views = Knack.scenes.models[s].views;
                                for (var v = 0; v < views.models.length; v++) {
                                    let view = views.models[v];
                                    if (view) {
                                        const attr = view.attributes;
                                        const viewId = attr.key;
                                        if (viewId === kwKey) {
                                            const sceneId = attr.scene.key;

                                            builderUrl = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}/pages/${sceneId}/views/${viewId}/${attr.type}`;

                                            const slug = Knack.scenes.getByKey(sceneId).attributes.slug;
                                            appUrl = `${Knack.url_base}#${slug}`;

                                            console.log('Builder:', builderUrl);
                                            console.log('App:', appUrl);
                                            console.log('Title:', attr.title);
                                            result += '<br><a href="' + builderUrl + '" target="_blank">' + builderUrl + '</a>';
                                            result += '<br><a href="' + appUrl + '" target="_self">' + appUrl + '</a>';
                                            result += '<br>Title: ' + attr.title;
                                            break;
                                        }
                                    }
                                }
                            }
                        } else if (kwKey.startsWith('scene_')) {
                            for (var t = 0; t < Knack.scenes.models.length; t++) {
                                if (kwKey === Knack.scenes.models[t].attributes.key) {
                                    builderUrl = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}/pages/${kwKey}`;
                                    console.log('Builder URL =', builderUrl);
                                    result += '<br><a href="' + builderUrl + '" target="_blank">' + builderUrl + '</a>';
                                    result += '<br><a href="' + appUrl + '" target="_self">' + appUrl + '</a>';
                                    break;
                                }
                            }
                        } else if (kwKey.startsWith('field_')) {
                            const objectId = Knack.objects.getField(kwKey).attributes.object_key;
                            builderUrl = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}/schema/list/objects/${objectId}/fields/${kwKey}/settings`;
                            console.log('Builder URL =', builderUrl);
                            result += '<br><a href="' + builderUrl + '" target="_blank">' + builderUrl + '</a>';
                        }

                        console.log(kwKey + ':\n', str, '\n\n\n');
                        result += '<br>' + kwKey + ':<br>' + str + '<br><br><br>';
                    }
                }

                var en = window.performance.now();
                console.log(`Finding all keywords took ${Math.trunc(en - st)} ms`);

                return result;
            },

            getLinuxDeviceInfo: function () {
                return new Promise(function (resolve, reject) {
                    const sys = ktl.sysInfo.getSysInfo();
                    if (sys.os !== 'Linux' /*|| !sys.processor.includes('arm')*/) return reject('Device not running a Linux OS');

                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', 'http://localhost:' + LOCAL_SERVER_PORT + '/msg?getDeviceInfo', true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } else if (xhr.status === 0) {
                            console.error('getDeviceInfo Server error', xhr);
                            reject(xhr);
                        }
                    };

                    xhr.send();
                })
            },

            restartService: function () {
                return new Promise(function (resolve, reject) {
                    const sys = ktl.sysInfo.getSysInfo();
                    if (sys.os !== 'Linux' /*|| !sys.processor.includes('arm')*/) return;

                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', 'http://localhost:' + LOCAL_SERVER_PORT + '/msg?restartService', true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } else if (xhr.status === 0) {
                            console.error('restartService error', xhr);
                            reject(xhr);
                        }
                    };

                    xhr.send();
                });
            },

            rebootDevice: function () {
                return new Promise(function (resolve, reject) {
                    const sys = ktl.sysInfo.getSysInfo();
                    if (sys.os !== 'Linux' /*|| !sys.processor.includes('arm')*/) return;

                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', 'http://localhost:' + LOCAL_SERVER_PORT + '/msg?rebootDevice', true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } else if (xhr.status === 0) {
                            console.error('rebootDevice error', xhr);
                            reject(xhr);
                        }
                    };

                    xhr.send();
                });
            },

            shutDownDevice: function () {
                return new Promise(function (resolve, reject) {
                    const sys = ktl.sysInfo.getSysInfo();
                    if (sys.os !== 'Linux' /*|| !sys.processor.includes('arm')*/) return;

                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', 'http://localhost:' + LOCAL_SERVER_PORT + '/msg?shutDownDevice', true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4 && xhr.status === 200) {
                            const responseData = JSON.parse(xhr.responseText);
                            resolve(responseData);
                        } else if (xhr.status === 0) {
                            console.error('shutDownDevice error', xhr);
                            reject(xhr);
                        }
                    };

                    xhr.send();
                });
            },

            /* High rebustness recovery watchdog against Internet, Chromium, Kiosk App or other failures.
            Whenever one of these stops responding, will trigger a refresh or a reboot.
            Delay is in seconds.
            Supported on the following environments:
            - Linux/arm64 (Raspberry PI 4, 5 and on)
            - Android "Kiosk Browser" app
            */
            sendRecoveryWdHeartbeat: function (wdTimeoutDelay = STARTUP_WD_TIMEOUT_DELAY) {
                return new Promise(function (resolve, reject) {
                    if (typeof Android !== 'undefined' && typeof Android.resetWatchdog === 'function') {
                        //ktl.core.timedPopup('WD: ' + wdTimeoutDelay, 'success');
                        Android.resetWatchdog(wdTimeoutDelay);
                        //Android.resetWatchdog(60);
                        resolve({ message: 'Android.resetWatchdog: ' + wdTimeoutDelay });
                    } else if (sysInfo.os === 'Linux' /*&& sysInfo.processor.includes('arm')*/) {
                        const timeoutNoSvr = setTimeout(() => {
                            //console.error('Server timeout', xhr);
                            reject('Recovery WD startup error: ' + xhr.responseText);
                        }, STARTUP_WD_TIMEOUT_DELAY * 1000);

                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', 'http://localhost:' + LOCAL_SERVER_PORT + '/watchdog?wdTimeoutDelay=' + wdTimeoutDelay, true);
                        xhr.onreadystatechange = function () {
                            //console.log('Server response:', xhr.readyState, xhr.status, xhr.statusText, xhr.responseText);
                            if (xhr.readyState === 4 && xhr.status === 200) {
                                clearTimeout(timeoutNoSvr);
                                const responseData = JSON.parse(xhr.responseText);
                                resolve(responseData);
                            } else if (xhr.status === 0) {
                                clearTimeout(timeoutNoSvr);
                                //console.error('Server error', xhr);
                                reject('Recovery WD svr response error: ' + xhr.responseText);
                            }
                        };

                        xhr.send();
                    } else
                        reject('Recovery Watchdog is not supported on ' + sysInfo.os);
                })
            },
        }
    })(); //sysInfo

    //====================================================
    //Account Logs feature
    this.accountsLogs = (function () {
        const SCENE_URL_NAME = 'view-account-logs';
        const SYSOP_DASHBOARD_ACCOUNT_LOGS = ktl.core.getViewIdByTitle('Account Logs', SCENE_URL_NAME);
        if (!SYSOP_DASHBOARD_ACCOUNT_LOGS) return;

        function generateTableContainer(event, scene) {
            const dynamicTableDiv = document.createElement('div');
            dynamicTableDiv.classList.add('kn-table', 'kn-table-table', 'is-bordered', 'is-striped', 'can-overflow-x');
            dynamicTableDiv.setAttribute('id', 'accountLogsDynamicTable');
            dynamicTableDiv.style.width = '100%';
            dynamicTableDiv.style.minHeight = '70px';
            dynamicTableDiv.style.height = '400px';
            dynamicTableDiv.style.resize = 'vertical';
            dynamicTableDiv.style.whiteSpace = 'pre'; //Allow multiple spaces for Prettyprint indentation of JSON.
            dynamicTableDiv.style['border-width'] = '5px';
            dynamicTableDiv.style.overflow = 'scroll';

            $('#knack-dist_1 > div.kn-scenes.kn-section').prepend(dynamicTableDiv);

            ktl.views.refreshView(SYSOP_DASHBOARD_ACCOUNT_LOGS);
        }

        function addCopyToClipboardButton() {
            const tableKeywordSearchBar = $('.table-keyword-search');
            if (!tableKeywordSearchBar.length)
                return;

            tableKeywordSearchBar.css({ 'display': 'inline-flex' });

            const copyToClipboard = document.createElement('BUTTON');
            copyToClipboard.setAttribute('class', 'kn-button ktlCopyButton');
            copyToClipboard.innerHTML = 'Copy Top Table to Clipboard';
            copyToClipboard.style.marginLeft = '10%';
            copyToClipboard.setAttribute('type', 'button'); //Needed to prevent copying when pressing Enter in search field.
            tableKeywordSearchBar.append(copyToClipboard);

            copyToClipboard.addEventListener('click', function () {
                const table = $('#accountLogsDynamicTable').get(0);
                if (table) {
                    ktl.core.selectElementContents(table);
                    try {
                        const successful = document.execCommand('copy');
                        const msg = successful ? 'Table copied to clipboard' : 'Error copying table to clipboard';
                        ktl.core.timedPopup(msg, successful ? 'success' : 'error', 1000);
                    } catch (err) {
                        ktl.core.timedPopup('Unable to copy', 'error', 2000);
                    }

                    ktl.core.selectElementContents();
                }
            });
        }

        function generateDynamicTable(viewData) {
            const accountFieldId = ktl.iFrameWnd.getCfg().alAccountFld;
            const logTypeFieldId = ktl.iFrameWnd.getCfg().alLogTypeFld;
            const detailsFieldId = ktl.iFrameWnd.getCfg().alDetailsFld;
            const dateTimeFieldId = ktl.iFrameWnd.getCfg().alDateTimeFld;

            if ($('#accountLogsDynamicTable').length === 0) {
                return;
            }

            if (viewData === undefined || viewData.length === 0) {
                $('#accountLogsDynamicTable').empty().text('    ** No Data **');
                return;
            }

            const searchInput = $('#' + SYSOP_DASHBOARD_ACCOUNT_LOGS + ' > div:nth-child(2) > div:nth-child(2) > form > p > input').val();
            const searchStr = (searchInput) ? searchInput.toLowerCase() : '';

            const tableData = [];
            let bInvalidEntryFound = false;

            const elementsWithlogDetails = (element) => {
                var logDetails = element[detailsFieldId];
                if (logDetails.length === 0 || element[`${accountFieldId}_raw`].length === 0) {
                    bInvalidEntryFound = true;
                    console.log('Invalid entry found: el =', element);
                    return false;
                }
                return true;
            }

            viewData.filter(elementsWithlogDetails).forEach(function (element) {
                const account = element[accountFieldId].toLowerCase();
                const logType = element[logTypeFieldId].toLowerCase();
                const details = element[detailsFieldId];

                if (details[0] === '['/*Quick check for valid JSON format*/) {
                    JSON.parse(details)
                        .filter((detail) => {
                            return (detail.details.toLowerCase().indexOf(searchStr) >= 0)
                                || (account.indexOf(searchStr) >= 0)
                                || (logType.indexOf(searchStr) >= 0);
                        })
                        .forEach((detail) => {
                            const newLocalDT = new Date(detail.dt.substring(0, 19) + ' UTC');
                            const date = ktl.core.addZero(newLocalDT.getMonth() + 1) + '/' + ktl.core.addZero(newLocalDT.getDate()) + '/' + newLocalDT.getFullYear();
                            let time = ktl.core.addZero(newLocalDT.getHours()) + ':' + ktl.core.addZero(newLocalDT.getMinutes());
                            time += ':' + ktl.core.addZero(newLocalDT.getSeconds());

                            tableData.push({
                                Name: element[`${accountFieldId}_raw`][0].identifier,
                                Local_DT: date + ' ' + time,
                                UTC_DT: detail.dt.substring(0, 19), //Strip milliseconds.
                                LogType: detail.type,
                                Details: detail.details
                            });
                        });
                } else { //Not JSON, just a plain string.
                    if (details.toLowerCase().indexOf(searchStr) >= 0) {
                        tableData.push({
                            Name: element[`${accountFieldId}_raw`][0].identifier,
                            Local_DT: element[dateTimeFieldId],
                            UTC_DT: 'n/a',
                            LogType: element[logTypeFieldId],
                            Details: details
                        });
                    }
                }
            })

            if (bInvalidEntryFound)
                ktl.core.timedPopup('Invalid entries have been been found. See console logs.', 'warning', 2000);

            tableData.sort(function NewestFirstByDT(a, b) {
                var dateA = new Date(a.UTC_DT), dateB = new Date(b.UTC_DT);
                return dateB - dateA;
            });

            const numOfRows = tableData.length;
            if (numOfRows > 0) {
                const table = document.createElement("table");

                //Retrieve column header.
                var col = [];
                for (var i = 0; i < numOfRows; i++) {
                    for (const key in tableData[i]) {
                        if (col.indexOf(key) === -1) {
                            col.push(key);
                        }
                    }
                }

                const tHead = document.createElement("thead");
                const hRow = document.createElement("tr");

                //Add column header to row of table head.
                for (var i = 0; i < col.length; i++) {
                    var th = document.createElement("th");
                    th.innerHTML = col[i];
                    hRow.appendChild(th);
                }
                tHead.appendChild(hRow);
                table.appendChild(tHead);

                const tBody = document.createElement("tbody");

                //Add column header to row of table head.
                for (var i = 0; i < numOfRows; i++) {
                    const bRow = document.createElement("tr");
                    for (var j = 0; j < col.length; j++) {
                        const td = document.createElement("td");
                        td.innerHTML = tableData[i][col[j]];
                        bRow.appendChild(td);
                    }
                    tBody.appendChild(bRow);

                }
                table.appendChild(tBody);

                $('#accountLogsDynamicTable').empty().append(table);
            }
        }

        $(document).on('knack-scene-render.any', () => {
            if (Knack.router.current_scene === SCENE_URL_NAME)
                generateTableContainer();
        });

        $(document).on('knack-view-render.' + SYSOP_DASHBOARD_ACCOUNT_LOGS, function (event, view, data) {
            generateDynamicTable(data);
            addCopyToClipboardButton();
        });
    })(); //Account Logs feature

    //====================================================
    //Status Monitoring feature
    this.statusMonitoring = (function () {
        //Highlight all accounts with more than DEVICE_OFFLINE_DELAY minutes missed heartbeat.
        //Terminals have more emphasis and regular accounts.
        //Custom CSS code takes care of colors.

        const SCENE_URL_NAME = 'status-monitoring';
        const SYSOP_DASHBOARD_ACC_STATUS = ktl.core.getViewIdByTitle('Status Monitoring', SCENE_URL_NAME);
        const statusMonitoring = {
            online: [],
            offline: [],
        }

        function refreshRecords(data) {
            const DEVICE_OFFLINE_DELAY = 60000 * 3;
            const recordsToUpdate = [];
            const nowUTC = Date.parse(ktl.core.getCurrentDateTime(true, false, false, true));
            statusMonitoring.online = [];
            statusMonitoring.offline = [];

            data.forEach(record => {
                const swVersionFieldId = ktl.iFrameWnd.getCfg().acctSwVersionFld;
                const lastActivityFieldId = ktl.iFrameWnd.getCfg().acctUtcLastActFld;
                const rowSelector = `#${SYSOP_DASHBOARD_ACC_STATUS} tr[id="${record.id}"]`

                const swVersionSelector = $(`${rowSelector} .${swVersionFieldId}`);
                if (record[swVersionFieldId] !== window.APP_KTL_VERSIONS)
                    swVersionSelector.css({ 'color': 'red', 'font-weight': 'bold' });
                else
                    swVersionSelector.css({ 'font-weight': 'normal' });

                if (record[lastActivityFieldId]) {
                    const diff = nowUTC - Date.parse(record[lastActivityFieldId]);
                    const lastActivitySelector = $(`${rowSelector} .${lastActivityFieldId}`);

                    if (diff <= FIVE_MINUTES_DELAY)
                        lastActivitySelector.css({ 'background-color': 'lightgreen', 'font-weight': 'bold' });
                    else if (diff <= ONE_HOUR_DELAY)
                        lastActivitySelector.css({ 'background-color': '#ffff72', 'font-weight': 'bold' });
                }

                const utcHeartBeatField = record[ktl.iFrameWnd.getCfg().acctUtcHbFld];
                const onlineField = record[ktl.iFrameWnd.getCfg().acctOnlineFld];
                const localHeartBeatFieldId = ktl.iFrameWnd.getCfg().acctLocHbFld;
                const diff = nowUTC - Date.parse(utcHeartBeatField);

                //Take note of those who need their Online status to be updated.
                if (isNaN(diff) || diff >= DEVICE_OFFLINE_DELAY) {
                    if (onlineField !== 'No') // Yes or blank
                        recordsToUpdate.push({ record: record, online: 'No' });

                    statusMonitoring.offline.push(record);
                    $(`#${record.id} .${localHeartBeatFieldId}`).addClass('ktlOfflineStatusCritical')
                } else {
                    if (onlineField === 'No')
                        recordsToUpdate.push({ record: record, online: 'Yes' });

                    statusMonitoring.online.push(record);
                    $(`#${record.id} .${localHeartBeatFieldId}`).removeClass('ktlOfflineStatusCritical')
                }
            })

            return recordsToUpdate;
        }

        function updateAccounts(recordsToUpdate, viewKey) {
            return new Promise(async function (resolve) {
                ktl.scenes.spinnerWatchdog(false);

                let updateSuccessfulCount = 0;

                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
                const delayMS = 150;

                await safePromiseAllSettled(recordsToUpdate.map(async (record, index) => {
                    await sleep(index * delayMS);
                    return sendUpdate(record);
                })).finally(() => {
                    ktl.core.removeInfoPopup();
                    ktl.core.removeTimedPopup();
                    Knack.hideSpinner();
                    ktl.scenes.spinnerWatchdog();

                    resolve(updateSuccessfulCount);
                });

                function sendUpdate(recObj) {
                    const record = recObj.record;

                    const onlineFieldId = ktl.iFrameWnd.getCfg().acctOnlineFld;
                    const firstNameField = record[ktl.iFrameWnd.getCfg().acctFirstNameFld];
                    const lastNameField = record[ktl.iFrameWnd.getCfg().acctLastNameFld];
                    const accountName = firstNameField + ' ' + lastNameField;

                    const apiData = {};
                    apiData[onlineFieldId] = recObj.online;

                    return ktl.core.knAPI(viewKey, record.id, apiData, 'PUT', [], false)
                        .then(function () {
                            updateSuccessfulCount++;
                            updateInfoPopup(accountName, ` is ${recObj.online === 'Yes' ? 'ONLINE' : 'OFFLINE'}`);
                        })
                        .catch(function (reason) {
                            console.debug('Offline - failed updating account:', accountName + ', reason: ' + JSON.stringify(reason));
                            updateInfoPopup(accountName, ` is ${recObj.online === 'Yes' ? 'ONLINE' : 'OFFLINE'} (failed)`);
                        });
                }

                function updateInfoPopup(accountName, status) {
                    if (accountName && updateSuccessfulCount) {
                        if (updateSuccessfulCount === 1)
                            ktl.core.infoPopup();
                        ktl.core.setInfoPopupText('Updated ' + accountName + status);
                    }
                }
            })
        }

        function highlightOfflineAccounts(event, view, data) {
            if (!data.length) return;

            const recordsToUpdate = refreshRecords(data);
            updateAccounts(recordsToUpdate, view.key).then(updateCount => {

                if (updateCount) {
                    console.debug('updateCount =', updateCount);
                    ktl.views.refreshView(SYSOP_DASHBOARD_ACC_STATUS);
                }

                $(document).trigger('KTL.StatusMonitoring.Updated', [statusMonitoring]);
            });
        }

        $(document).on('knack-view-render.' + SYSOP_DASHBOARD_ACC_STATUS, highlightOfflineAccounts);
    })(); //Status Monitoring feature

    //===================================================
    //Developper Popup Tool feature
    this.developperPopupTool = (function () {
        if (!ktl.account.isDeveloper()) return;

        const baseURL = `https://builder.knack.com/${Knack.mixpanel_track.account}/${Knack.mixpanel_track.app}`;

        const createButton = function (iconClass) {
            const button = document.createElement('a');
            button.classList.add('is-small');
            button.style.display = 'inline-flex';
            button.style.margin = '0em 0.5em';
            button.style['text-decoration'] = 'none';
            const icon = document.createElement('i');
            icon.classList.add('fa');

            if (iconClass)
                icon.classList.add(iconClass);

            button.appendChild(icon);
            return button;
        }

        const createCopyContentButton = function (element, fieldId) {
            const button = createButton();
            button.innerText = 'Copy content';
            button.style['text-decoration'] = 'underline';

            const field = Knack.objects.getField(fieldId);

            button.addEventListener('click', () => {
                let text = $(element).text().trim();

                if (field && field.attributes.type === 'rich_text') {
                    let content = $(element);
                    while (content.children().length === 1 && content.children().first().is('span')) {
                        content = content.children();
                    }
                    text = content.html().trim();
                }

                const numeric = ktl.core.parseNumericValue(text);
                text = numeric || text;

                navigator.clipboard.writeText(text.toString().trim())
                    .catch(() => ktl.core.timedPopup('Unable to copy', 'error', 2000))
                    .then(() => ktl.core.timedPopup('Copied to clipboard', 'success', 1000));
            });

            return button;
        }

        const createLine = function (text, url) {
            const container = document.createElement('div');
            container.style.padding = '2px 12px';

            const textSpan = document.createElement('span');
            textSpan.innerHTML = text;
            textSpan.style.margin = '0em 0.5em';
            container.appendChild(textSpan);

            const copyButton = createButton('fa-copy');
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(text)
                    .catch(() => ktl.core.timedPopup('Unable to copy', 'error', 2000))
                    .then(() => ktl.core.timedPopup('Copied to clipboard', 'success', 1000));
            });

            container.appendChild(copyButton);

            if (url) {
                const copyLinkButton = createButton('fa-link');
                copyLinkButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(url)
                        .catch(() => ktl.core.timedPopup('Unable to copy', 'error', 2000))
                        .then(() => ktl.core.timedPopup('Link copied to clipboard', 'success', 1000));
                });
                container.appendChild(copyLinkButton);

                const knackButton = createButton('fa-copy');
                knackButton.href = url;
                knackButton.target = '_blank';
                knackButton.innerHTML = '';
                knackButton.style.color = 'transparent';
                const icon = document.createElement('i');
                icon.classList.add('fa', 'fa-copy');
                icon.style.background = "url(https://ctrnd.s3.amazonaws.com/Lib/KTL/Media/knack-logo.png)";
                icon.style['background-size'] = 'contain';
                icon.style.width = '14px';
                icon.style.height = '14px';
                icon.style['background-repeat'] = 'no-repeat';
                knackButton.appendChild(icon);
                container.appendChild(knackButton);
            }

            return container;
        }

        const defaultOptions = {
            content: function (element) {
                const container = document.createElement('div');

                const escSpan = document.createElement('span');
                escSpan.innerText = 'Esc to close';
                escSpan.style.color = 'grey';
                escSpan.style.margin = '0em 0.5em';
                container.appendChild(escSpan);

                if (!document.querySelector('#kn-add-option')) {
                    const sceneId = $(element).closest('.kn-scene').attr('id').substring(3);
                    container.appendChild(createLine(sceneId, `${baseURL}/pages/${sceneId}`));
                }

                return container;
            },
            placement: 'auto',
            animation: false
        };

        const viewOptions = {
            ...defaultOptions,
            content: function (element) {
                const container = defaultOptions.content(element);

                if (!document.querySelector('#kn-add-option')) {
                    const sceneId = $(element).closest('.kn-scene[id]').attr('id').substring(3);
                    const viewId = $(element).closest('.kn-view[id]').attr('id');
                    const viewType = Knack.views[viewId].model.view.type;
                    const viewUrl = `${baseURL}/pages/${sceneId}/views/${viewId}/${viewType}`;
                    container.appendChild(createLine(viewId, viewUrl));
                }

                return container;
            }
        };

        const tableHeadOptions = {
            ...defaultOptions,
            content: function (element) {
                const container = viewOptions.content(element);

                const viewId = $(element).closest('.kn-view[id]').attr('id');
                const objectId = Knack.views[viewId].model.view.source.object;

                if (objectId) {
                    const objectName = Knack.objects._byId[objectId].attributes.name;
                    container.appendChild(createLine(objectName));
                    container.appendChild(createLine(objectId, `${baseURL}/schema/list/objects/${objectId}/fields`));
                } else {
                    const textSpan = document.createElement('span');
                    textSpan.innerText = 'Object Id not found';
                    textSpan.style.margin = '0px 18px';
                    container.appendChild(textSpan);
                }

                const fieldId = $(element).attr('class').split(/\s+/)[0];

                if (fieldId && fieldId.includes('field')) {
                    const fieldURL = (objectId) ? `${baseURL}/schema/list/objects/${objectId}/fields/${fieldId}/settings` : undefined;
                    container.appendChild(createLine(fieldId, fieldURL));
                }

                return container;
            }
        };

        const tableDataOptions = {
            ...defaultOptions,
            content: function (element) {
                const container = tableHeadOptions.content(element);

                const viewId = $(element).closest('.kn-view[id]').attr('id');
                const objectId = Knack.views[viewId].model.view.source.object;

                const recordId = $(element).closest('tr').attr('id');
                if (recordId) {
                    const url = (objectId) ? `${baseURL}/records/objects/${objectId}/record/${recordId}/edit` : undefined;
                    container.appendChild(createLine(recordId, url));
                }

                const spans = $(element).find('span');
                const linkedRecords = $.map(spans, (s) => $(s).attr('class')).concat($.map(spans, (s) => $(s).attr('id')));
                const linkedRecord = linkedRecords.find((record) => !record.includes(' ') && !record.includes('.') && record.length === KNACK_RECORD_LENGTH);

                if (linkedRecord) {
                    const fieldId = $(element).attr('data-field-key');
                    const field = Knack.objects.getField(fieldId);

                    const linkedObject = (field.attributes.relationship) ? field.attributes.relationship.object : field.attributes.object_key;
                    const url = (linkedObject) ? `${baseURL}/records/objects/${linkedObject}/record/${linkedRecord}/edit` : undefined;
                    container.appendChild(createLine('<b>Connects to</b> ' + linkedRecord, url));
                }

                const copyButton = createCopyContentButton(element, $(element).attr('class').split(/\s+/)[0]);
                container.appendChild(copyButton);

                return container;
            }
        };

        const listDetailFindFieldId = (element) => {
            let fieldId = '';
            if ($(element).closest('.kn-detail').length)
                fieldId = $(element).closest('.kn-detail').attr('class').split(/\s+/).find(c => c.includes('field_'));
            else {
                if ($(element).attr('class').includes('kn-detail-body'))
                    fieldId = $(element).parent().attr('class').split(/\s+/).find(c => c.includes('field_'));
                else if ($(element).attr('class').includes('kn-detail-label'))
                    fieldId = $(element).parent().attr('class').split(/\s+/).find(c => c.includes('field_'));
            }
            return fieldId;
        }

        const listDetailLabelOptions = {
            ...defaultOptions,
            content: function (element) {
                const container = viewOptions.content(element);

                const viewId = $(element).closest('.kn-view[id]').attr('id');
                const objectId = Knack.views[viewId].model.view.source.object;

                if (objectId) {
                    const objectName = Knack.objects._byId[objectId].attributes.name;
                    container.appendChild(createLine(objectName));
                    container.appendChild(createLine(objectId, `${baseURL}/schema/list/objects/${objectId}/fields`));
                } else {
                    const textSpan = document.createElement('span');
                    textSpan.innerText = 'Object Id not found';
                    textSpan.style.margin = '0px 18px';
                    container.appendChild(textSpan);
                }

                const fieldId = listDetailFindFieldId(element);

                if (fieldId && fieldId.includes('field')) {
                    const fieldURL = (objectId) ? `${baseURL}/schema/list/objects/${objectId}/fields/${fieldId}/settings` : undefined;
                    container.appendChild(createLine(fieldId, fieldURL));
                }

                const recordId = $(element).closest('.kn-list-item-container').attr('data-record-id') || (Knack.views[viewId].record && Knack.views[viewId].record.id);
                if (recordId) {
                    const url = (objectId) ? `${baseURL}/records/objects/${objectId}/record/${recordId}/edit` : undefined;
                    container.appendChild(createLine(recordId, url));
                }
                return container;
            }
        };

        const listDetailBodyOptions = {
            ...defaultOptions,
            content: function (element) {
                const container = listDetailLabelOptions.content(element);
                const fieldId = listDetailFindFieldId(element);

                const spans = $(element).find('span');
                const linkedRecords = $.map(spans, (s) => {
                    return { id: $(s).attr('class'), label: $(s).text() }
                })
                    .concat($.map(spans, (s) => {
                        return { id: $(s).attr('id'), label: $(s).text() }
                    }));

                linkedRecords.filter((record) => record.id && !record.id.includes(' ') && !record.id.includes('.') && record.id.length === KNACK_RECORD_LENGTH).forEach(function (record) {
                    const field = Knack.objects.getField(fieldId);

                    const linkedObject = (field.attributes.relationship) ? field.attributes.relationship.object : field.attributes.object_key;
                    const url = (linkedObject) ? `${baseURL}/records/objects/${linkedObject}/record/${record.id}/edit` : undefined;
                    container.appendChild(createLine(`<b>Connects to</b> ${record.label} - ${record.id}`, url));
                });

                const copyButton = createCopyContentButton(element, fieldId);
                container.appendChild(copyButton);
                return container;
            }
        };

        const formInputOptions = {
            ...defaultOptions,
            content: function (element) {
                const container = viewOptions.content(element);

                const fieldId = $(element).attr('data-input-id');
                if (fieldId) {
                    const objectId = Knack.objects.getField(fieldId).attributes.object_key;

                    if (objectId) {
                        const objectName = Knack.objects._byId[objectId].attributes.name;
                        container.appendChild(createLine(objectName));
                        container.appendChild(createLine(objectId, `${baseURL}/schema/list/objects/${objectId}/fields`));
                    } else {
                        const textSpan = document.createElement('span');
                        textSpan.innerText = 'Object Id not found';
                        textSpan.style.margin = '0px 18px';
                        container.appendChild(textSpan);
                    }

                    const fieldURL = (objectId) ? `${baseURL}/schema/list/objects/${objectId}/fields/${fieldId}/settings` : undefined;
                    container.appendChild(createLine(fieldId, fieldURL));
                }

                return container;
            }
        };

        let openedPopOverTarget;
        let popover;
        function showPopOver(options, event, force = false) { // force comes from .trigger('mouseenter', true);
            if (!ktl.core.getCfg().enabled.devInfoPopup)
                return;

            if ((event.shiftKey && event.ctrlKey) || force) {

                //Let the Ctrl+Shift keys do their default job during inline editing.
                //Useful to snap-select at word boundaries with arrow keys.
                const inlineEditing = !!($('#cell-editor, #cell-editor-form').length);
                if (inlineEditing)
                    return;

                if (document.querySelector('#kn-add-option'))
                    return;

                $(openedPopOverTarget).removeClass('active').removeData('popover');

                const target = $(event.currentTarget);
                openedPopOverTarget = event.currentTarget;

                const bindedOptions = {
                    ...options,
                    content: options.content.bind(this, event.currentTarget)
                };

                if (!popover) {
                    target.popover(bindedOptions);
                    popover = target.data('popover');

                    popover.$win = { resize: () => { } }; // Remove subsequent resize occurence
                    const bindEvents = popover.bindEvents;
                    popover.bindEvents = () => { }; // Remove subsequent bindEvents occurence
                    $('body').on('click', (event) => {
                        if (!$(event.target).closest('#kn-popover').length) {
                            bindEvents.call(popover);
                            $('.ktlOutlineDevPopup').removeClass('ktlOutlineDevPopup');
                        }
                    }); // reinstate modal click after initial bindEvents
                } else {
                    popover.init(bindedOptions, target);
                    $('#kn-popover [role=presentation]').remove();
                }

                // Outlines target element.
                $('.ktlOutlineDevPopup').removeClass('ktlOutlineDevPopup');
                target.addClass('ktlOutlineDevPopup');

                event.stopPropagation();
            }
        }

        function closePopOver(eventTarget) {
            $(eventTarget).removeClass('active').removeData('popover');
            openedPopOverTarget = null;
            $('#kn-popover').hide();
            $('.ktlOutlineDevPopup').removeClass('ktlOutlineDevPopup');
        }

        $(document).on('mouseenter.ktlPopOver', '.knTable th', showPopOver.bind(this, tableHeadOptions));
        $(document).on('mouseenter.ktlPopOver', '.knTable td', showPopOver.bind(this, tableDataOptions));
        $(document).on('mouseenter.ktlPopOver', '.kn-table .view-header', showPopOver.bind(this, viewOptions));
        $(document).on('mouseenter.ktlPopOver', '.kn-view', showPopOver.bind(this, viewOptions));
        $(document).on('mouseenter.ktlPopOver', '.kn-detail-label', showPopOver.bind(this, listDetailLabelOptions));
        $(document).on('mouseenter.ktlPopOver', '.kn-detail-body', showPopOver.bind(this, listDetailBodyOptions));
        $(document).on('mouseenter.ktlPopOver', '.kn-form .kn-input', showPopOver.bind(this, formInputOptions));
        $(document).on('mouseleave.ktlPopOver', '.knTable th, .knTable td, .kn-table .view-header, .kn-view, .kn-detail-label, .kn-detail-body, .kn-form .kn-input', function hidePopOver(event) {
            if (event.shiftKey && event.ctrlKey) {
                closePopOver(event.currentTarget);
            }
        });

        $(document).on('knack-view-render.any', function (event, view, data) {
            $('#' + view.key + ' a.kn-add-option').bindFirst('click', function (event) {
                closePopOver(openedPopOverTarget);
            })
        })

        $(document).on('keydown', function (event) {
            if (event.shiftKey && event.ctrlKey) {
                $('.knTable th:hover, .knTable td:hover, .kn-table .view-header:hover, .kn-view:hover, .kn-detail-label:hover, .kn-detail-body:hover, .kn-form .kn-input:hover').last().trigger('mouseenter.ktlPopOver', true);
            } else if (event.key === 'Escape') {
                closePopOver(openedPopOverTarget);
            }
        });
    })();//developperPopupTool

    //===================================================
    //Virtual Keyboard feature
    //Comes from here: https://github.com/hodgef/simple-keyboard
    this.virtualKeyboard = (function () {
        let keyboardLoaded = false;
        $(document).on('KTL.DefaultConfigReady', function () {
            ktl.virtualKeyboard.load();
        })

        function load() {
            LazyLoad.css(['https://cdn.jsdelivr.net/npm/simple-keyboard@latest/build/css/index.css'], function () {
                LazyLoad.js(['https://cdn.jsdelivr.net/npm/simple-keyboard@latest/build/index.js'], function () {
                    if (keyboardLoaded)
                        return;

                    keyboardLoaded = true;
                    const Keyboard = window.SimpleKeyboard.default;
                    let target;

                    $('body').append('<div id="simple-keyboard" class="simple-keyboard"></div>');
                    $('#simple-keyboard').hide();

                    $('#simple-keyboard').on('click', event => {
                        event.stopPropagation();
                    })

                    let keyboard = new Keyboard({
                        onChange: (input, event) => onChange(input, event),
                        onKeyPress: (button, event) => onKeyPress(button, event),
                        layout: {
                            'default': [
                                '{escape} 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
                                '{tab} q w e r t y u i o p [ ] \\',
                                '{capslock} a s d f g h j k l ; \' {enter}',
                                '{shift} z x c v b n m , . / {shift}',
                                '.com @ {space} {arrowleft} {arrowright}'
                            ],
                            'shift': [
                                '{escape} ! @ # $ % ^ & * ( ) _ + {bksp}',
                                '{tab} Q W E R T Y U I O P { } |',
                                '{capslock} A S D F G H J K L : " {enter}',
                                '{shift} Z X C V B N M < > ? {shift}',
                                '.ca @ {space} {arrowleft} {arrowright}'
                            ],
                            'numeric': [
                                '7 8 9',
                                '4 5 6',
                                '1 2 3',
                                '. 0 -',
                                '{bksp} {enter}',
                                '{arrowleft} {arrowright}'
                            ],
                        },
                        preventMouseDownDefault: true,
                        preventMouseUpDefault: true,
                        stopMouseDownPropagation: true,
                        stopMouseUpPropagation: true,
                        tabCharOnTab: false,
                        disableButtonHold: true,
                        mergeDisplay: true,
                        display: {
                            "{escape}": "⎋",
                            "{tab}": " ",
                            "{bksp}": "⌫",
                            "{enter}": "↵",
                            "{capslock}": "⇪",
                            "{shift}": "⇧",
                        }
                    });

                    let sendButtonEvents = [];
                    function onChange(input, event) {
                        if (!target)
                            return;

                        if (['{shift}', '{capslock}'].includes(event.target.attributes['data-skbtn'].value))
                            return; // No change

                        let caretStart;

                        if (event.target.attributes['data-skbtn'].value === '{bksp}') {
                            if (input.length === target.value.length - 1)
                                caretStart = target.selectionStart - 1;
                            else
                                caretStart = target.selectionStart
                        } else
                            caretStart = target.selectionStart + 1;

                        keyboard.setCaretPosition(caretStart);
                        target.value = input;
                        target.selectionStart = caretStart;
                        target.selectionEnd = caretStart;
                        target.dispatchEvent(new InputEvent('input', {
                            bubbles: true,
                            cancelable: true
                        }));

                        if (sendButtonEvents) { // Sending events after the value was changed
                            sendButtonEvents.forEach(event => target.dispatchEvent(event));
                            sendButtonEvents = [];
                        }
                    }

                    let shiftKeyPressed = false;
                    let capslockKeyPressed = false;
                    function onKeyPress(button) {
                        if (button === '{shift}') {
                            if (!capslockKeyPressed) {
                                shiftKeyPressed = !shiftKeyPressed;
                                keyboard.setOptions({ layoutName: shiftKeyPressed ? 'shift' : 'default' });
                            }
                        } else if (button === '{capslock}') {
                            shiftKeyPressed = false
                            capslockKeyPressed = !capslockKeyPressed;

                            if (capslockKeyPressed) {
                                keyboard.setOptions({ layoutName: 'shift' });
                                $('#simple-keyboard').addClass('capslock');
                            } else {
                                keyboard.setOptions({ layoutName: 'default' });
                                $('#simple-keyboard').removeClass('capslock');
                            }

                        } else if (button === "{tab}") {
                            // Add tab keypress
                        } else {
                            if (keyboard.getOptions().layoutName != 'numeric'
                                && !capslockKeyPressed
                                && shiftKeyPressed) {
                                keyboard.setOptions({ layoutName: 'default' });
                                shiftKeyPressed = false;
                            }

                            if (!target)
                                return;

                            if (button === "{enter}")
                                $(target).closest('form').submit();

                            if (button === "{escape}") {
                                $(target).blur();
                                $('.simple-keyboard').hide();
                                keyboard.clearInput();
                                target = null;
                            }

                            if (button === "{arrowleft}") {
                                if (target.selectionEnd != target.selectionStart) {
                                    target.selectionEnd = target.selectionStart;
                                    keyboard.setCaretPosition(target.selectionStart, target.selectionStart);
                                } else {
                                    target.selectionStart = Math.max(target.selectionStart - 1, 0);
                                    target.selectionEnd = target.selectionStart;
                                    keyboard.setCaretPosition(target.selectionStart, target.selectionStart);
                                }
                            }

                            if (button === "{arrowright}") {
                                if (target.selectionEnd != target.selectionStart) {
                                    target.selectionStart = target.selectionEnd;
                                    keyboard.setCaretPosition(target.selectionStart, target.selectionStart);
                                } else {
                                    target.selectionStart = target.selectionStart + 1;
                                    target.selectionEnd = target.selectionStart;
                                    keyboard.setCaretPosition(target.selectionStart, target.selectionStart);
                                }
                            }

                            if (!button.startsWith("{") && !button.startsWith("}")) {
                                target.dispatchEvent(new KeyboardEvent("keydown", {
                                    key: button.charAt(0),
                                    keyCode: button.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));
                                sendButtonEvents.push(new KeyboardEvent("keypress", {
                                    key: button.charAt(0),
                                    keyCode: button.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));
                                sendButtonEvents.push(new KeyboardEvent("keyup", {
                                    key: button.charAt(0),
                                    keyCode: button.charCodeAt(0),
                                    bubbles: true,
                                    cancelable: true
                                }));
                            }

                            if (button === "{bksp}") {
                                target.dispatchEvent(new KeyboardEvent("keydown", {
                                    key: 'Backspace',
                                    keyCode: 8,
                                    bubbles: true,
                                    cancelable: true
                                }));
                                sendButtonEvents.push(new KeyboardEvent("keypress", {
                                    key: 'Backspace',
                                    keyCode: 8,
                                    bubbles: true,
                                    cancelable: true
                                }));
                                sendButtonEvents.push(new KeyboardEvent("keyup", {
                                    key: 'Backspace',
                                    keyCode: 8,
                                    bubbles: true,
                                    cancelable: true
                                }));
                            }
                        }
                    }

                    function handleShift(currentLayout = keyboard.options.layoutName) {
                        const shiftToggle = currentLayout === "default" ? "shift" : "default";

                        keyboard.setOptions({ layoutName: shiftToggle });
                    }

                    $(document).on('focus', 'input, textarea', event => {
                        if (event.target.attributes['type']) {
                            if (target == event.target || !$(event.target).is(':visible') || (!['number', 'tel', 'text', 'email', 'password', 'search', 'url'].includes(event.target.attributes['type'].value)))
                                return;
                        }

                        target = event.target;
                        keyboard.setInput(event.target.value);
                        keyboard.setCaretPosition(target.selectionStart, target.selectionEnd);

                        const fieldId = $(target).closest('[data-input-id]').attr('data-input-id') || 0;

                        if ($(target).attr('type') === 'tel' || $(target).attr('type') === 'number' || ktl.fields.shouldBeNumeric(fieldId))
                            keyboard.setOptions({ layoutName: 'numeric' });
                        else
                            keyboard.setOptions({ layoutName: 'default' });

                        capslockKeyPressed = false;
                        shiftKeyPressed = false;

                        $('#simple-keyboard').show();

                        if (($(target).offset().top - $(document).scrollTop()) > ($(window).height() - $('#simple-keyboard').height() - 100)) {
                            $([document.documentElement, document.body]).animate({
                                scrollTop: $(target).offset().top - 200
                            }, 200, 'linear', () => target && target.dispatchEvent(new KeyboardEvent("focus", {
                                bubbles: true,
                                cancelable: true
                            })));
                        }

                        $(target).on("remove", function () {
                            $('.simple-keyboard').hide();
                            keyboard.clearInput();
                            target = null;
                        })
                    });

                    $(document).on('mousedown', event => {
                        if ($(event.target).closest('.simple-keyboard').length == 0
                            && $('.simple-keyboard:visible').length == 1
                            && event.target != target) {

                            $('.simple-keyboard').hide();
                            keyboard.clearInput();
                            target = null;
                        }
                    });

                    $(document).on('click', '.chzn-container', (event) => {
                        if ($(event.currentTarget).hasClass('chzn-container-active'))
                            $(event.currentTarget).find('.chzn-search input').trigger('mousedown');
                    });

                    $(document).on('click', '.cell-edit', (event) => {
                        ktl.core.waitSelector("#cell-editor").then(() => {
                            setTimeout(() => { // Wait for cell-editor's content to change
                                $("#cell-editor").find('div:not(.chzn-search) > input:visible').trigger('focus');
                            }, 500);
                        });
                    });
                });
            });
        }

        return {
            show(visible = false) {
                if (visible)
                    $('.simple-keyboard').show();
                else
                    $('.simple-keyboard').hide();
            },

            load: function () {
                if (ktl.scenes.isiFrameWnd() || !ktl.core.getCfg().enabled.virtualKeyboard) return;

                //Only for Linux systems without a built-in VK, like Raspberry PI 4.
                const sys = ktl.sysInfo.getSysInfo();
                if (sys.os === 'Linux' /*&& sys.processor.includes('arm')*/)
                    load();
                else
                    ktl.core.setCfg({ enabled: { virtualKeyboard: false } });
            },
        }
    })(); //virtualKeyboard

    window.ktl = {
        //KTL exposed objects
        const: this.const,
        core: this.core,
        storage: this.storage,
        fields: this.fields,
        views: this.views,
        scenes: this.scenes,
        persistentForm: this.persistentForm,
        userFilters: this.userFilters,
        bulkOps: this.bulkOps,
        account: this.account,
        accountLogs: this.accountsLogs,
        userPrefs: this.userPrefs,
        iFrameWnd: this.iFrameWnd,
        debugWnd: this.debugWnd,
        log: this.log,
        wndMsg: this.wndMsg,
        sysInfo: this.sysInfo,
        systemColors: this.systemColors,
        statusMonitoring: this.statusMonitoring,
        virtualKeyboard: this.virtualKeyboard,
    };

    return window.ktl;
};

//Global helper functions.
window.ktlkw = function (param) {
    ktl.sysInfo.findAllKeywords(param);
}

window.ktlpause = function () {
    ktl.views.autoRefresh(false);
}

function ktlCompare(a, operator, b) {
    let conditionMatches = false;

    const numA = Number(a);
    const numB = Number(b);

    if ((operator === 'is' || operator === 'eq') && a === b)
        conditionMatches = true;
    else if ((operator === 'not' || operator === 'neq') && a !== b)
        conditionMatches = true;
    else if (operator === 'has' && a && a.includes(b))
        conditionMatches = true;
    else if (operator === 'hasnt' && a && !a.includes(b))
        conditionMatches = true;
    else if (operator === 'sw' && a && a.startsWith(b))
        conditionMatches = true;
    else if (operator === 'ew' && a && a.endsWith(b))
        conditionMatches = true;
    else if (!isNaN(numA) && !isNaN(numB)) { //All numeric comparisons here.
        if (operator === 'equ' && numB === numA)
            conditionMatches = true;
        else if (operator === 'lt' && numA < numB)
            conditionMatches = true;
        else if (operator === 'lte' && numA <= numB)
            conditionMatches = true;
        else if (operator === 'gt' && numA > numB)
            conditionMatches = true;
        else if (operator === 'gte' && numA >= numB)
            conditionMatches = true;
    } else if (operator === 'in') {
        if (a === 'ktlNow' || a === 'ktlNowUTC')
            conditionMatches = isCurrentTimeInRange(b, (a === 'ktlNowUTC'));
    } else if (operator === 'out') {
        if (a === 'ktlNow' || a === 'ktlNowUTC')
            conditionMatches = !isCurrentTimeInRange(b, (a === 'ktlNowUTC'));
    }

    return conditionMatches;
}

function getCurrentUTCDate() {
    const now = new Date();
    return {
        hours: now.getUTCHours(),
        minutes: now.getUTCMinutes()
    };
}

function isCurrentTimeInRange(timeRange, useUTC = false) {
    const [startStr, endStr] = timeRange.split('-');

    const getTimeObj = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return { hours, minutes };
    };

    const start = getTimeObj(startStr);
    const end = getTimeObj(endStr);

    const current = useUTC ? getCurrentUTCDate() : {
        hours: new Date().getHours(),
        minutes: new Date().getMinutes()
    };

    const isAfterStart = (current.hours > start.hours) ||
        (current.hours === start.hours && current.minutes >= start.minutes);
    const isBeforeEnd = (current.hours < end.hours) ||
        (current.hours === end.hours && current.minutes <= end.minutes);

    let result;
    if (start.hours <= end.hours)
        result = isAfterStart && isBeforeEnd;
    else
        result = isAfterStart || isBeforeEnd;

    //console.log('Start Time:', start);
    //console.log('End Time:', end);
    //console.log('Current Time:', current);
    //console.log('Is after start:', isAfterStart);
    //console.log('Is before end:', isBeforeEnd);
    //console.log('Result:', result);

    return result;
}

function debounce(func, timeout = 1000) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function safePromiseAllSettled(promises) {
    // To support Chrome Android 69
    // if (!Promise.allSettled) {
    return Promise.all(
        promises.map((promise, i) =>
            promise
                .then(value => ({
                    status: 'fulfilled',
                    value,
                }))
                .catch(reason => ({
                    status: 'rejected',
                    reason,
                }))
        )
    );
    // }

    // return Promise.allSettled(promises);
}

//needFirstClick to true will required a click + long press to be triggered.
function addLongClickListener(selector, callback, duration = 500, needFirstClick = false) {
    $(selector).each(function () {
        let $element = $(this);

        if ($element.data('hasLongClickListener')) return;

        let longPressTimeout;
        let clickOccurred = false;
        let startPosition = { x: 0, y: 0 };

        function handleClick() {
            if (needFirstClick) {
                clickOccurred = true;
                // Reset click state after a short duration
                setTimeout(() => { clickOccurred = false; }, duration);
            }
        }

        function handleMouseDown(event) {
            if (needFirstClick && !clickOccurred) return;

            startPosition.x = event.pageX;
            startPosition.y = event.pageY;

            longPressTimeout = setTimeout(() => {
                const targetIsChzn = event.target.closest('.chzn-container'); //Exclude because dropdowns are conflicting with virtual keyboard.
                if (!targetIsChzn) {
                    callback(event);
                    if (needFirstClick) {
                        clickOccurred = false; // Reset click state after long press callback
                    }
                }
            }, duration);
        }

        function handleMouseMove(event) {
            if (Math.abs(event.pageX - startPosition.x) > 10 || Math.abs(event.pageY - startPosition.y) > 10) {
                clearTimeout(longPressTimeout);
                if (needFirstClick) clickOccurred = false; // Reset click state on move
            }
        }

        function handleMouseUpOrLeave(event) {
            if (longPressTimeout) clearTimeout(longPressTimeout);
            if (needFirstClick) clickOccurred = false; // Reset click state on mouse up or leave
        }

        if (needFirstClick)
            $element.on('click', handleClick);

        $element.on('mousedown', handleMouseDown);
        $element.on('mousemove', handleMouseMove);
        $element.on('mouseup mouseleave', handleMouseUpOrLeave);

        $element.data('hasLongClickListener', true);
    });
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function waitUserId() {
    return new Promise(function (resolve, reject) {
        if (Knack.getUserAttributes() === 'No user found') {
            var intervalId = setInterval(function () {
                if (Knack.getUserAttributes() !== 'No user found') {
                    clearInterval(intervalId);
                    clearTimeout(failsafe);
                    resolve();
                }
            }, 200);
        } else
            resolve();

        var failsafe = setTimeout(() => {
            clearInterval(intervalId);
            reject();
        }, 5000);
    })
}

function getUrlParameter(name) {
    const url = window.location.href.split('?')

    if (url.length < 2)
        return;

    const parameters = url[1].split('&');
    for (let i = 0; i < parameters.length; i++) {
        const parameter = parameters[i].split('=');

        if (parameter[0] === name) {
            return parameter[1] === undefined ? '' : decodeURIComponent(parameter[1]);
        }
    }
    return;
};

////////////////  End of KTL /////////////////////

//window.ktlEnd = window.performance.now();
//console.log(`KTL took ${Math.trunc(window.ktlEnd - window.ktlStart)} ms`);
