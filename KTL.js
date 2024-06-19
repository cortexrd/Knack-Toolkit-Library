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

    const KTL_VERSION = '0.25.6';
    const APP_KTL_VERSIONS = window.APP_VERSION + ' - ' + KTL_VERSION;
    window.APP_KTL_VERSIONS = APP_KTL_VERSIONS;

    const APP_ROOT_NAME = appInfo.lsShortName;
    window.APP_ROOT_NAME = APP_ROOT_NAME;

    const LOCAL_SERVER_PORT = '3000';

    var ktl = this;

    const TEXT_DATA_TYPES = ['address', 'date_time', 'email', 'link', 'name', 'number', 'paragraph_text', 'phone', 'short_text', 'currency'];

    //KEC stands for "KTL Event Code".  Next:  KEC_1026

    //window.ktlParserStart = window.performance.now();
    //Parser step 1 : Add view keywords.
    //Extract all keywords from view titles and descriptions, and cleanup view titles and descriptions.
    const ktlKeywords = {};
    window.ktlKeywords = ktlKeywords;

    function getKeywordsStartIndex(text = '') {
        return text.toLowerCase().search(/(?:^|\s)(_[a-zA-Z0-9]\w*)/m);
    }

    function cleanUpKeywords(text = '') {
        const firstKeywordIndex = getKeywordsStartIndex(text);
        if (firstKeywordIndex >= 0) {
            return text.substring(0, firstKeywordIndex).trim();
        }
        return text;
    }

    function getKeywords(text = '') {
        const firstKeywordIndex = getKeywordsStartIndex(text);
        if (firstKeywordIndex >= 0) {
            return extractKeywords(text.substring(firstKeywordIndex).trim());
        }
        return {};
    }

    function getKeywordsFromContent(content = '') {
        const firstKeywordIndex = getKeywordsStartIndex(content);

        if (firstKeywordIndex >= 0) {
            let keywordsToParse = content.substring(firstKeywordIndex).trim();

            //Remove line breaks and paragraphs after first kw found.
            keywordsToParse = keywordsToParse.replace(/<\/?p>|<br\s*\/?>/gi, ' ').trim();

            //Decode all special HTML characters to plain text. Ex: &gt to >
            keywordsToParse = $('<p/>').html(keywordsToParse).text();

            return extractKeywords(keywordsToParse);
        }
        return {};
    }

    const extractKeywordsFromView = (scene, view) => {
        const attributes = view.attributes;
        const viewKwObj = {};

        if (attributes.type === 'rich_text') {
            const content = (attributes.content || '').replace('<p>_', ' _');
            const viewKeywords = getKeywordsFromContent(content);
            Object.assign(viewKwObj, viewKeywords);

            if (!content.includes('_ol'))
                attributes.content = cleanUpKeywords(content);
        } else {
            const viewKeywords = getKeywords(attributes.title);
            let descriptionKeywords;
            if (attributes.description) {
                //Allow <br> in description directly in front of a keyword to improve readbility.
                //Note: When typing <br> in the description, builder converts it to <br />.
                //Syntax looks like this while being typed: <br>_cls=params
                //Syntax looks like this once we get here: <br />_cls=params
                descriptionKeywords = getKeywords(attributes.description.replace(/<br \/>_/g, '_'));
                attributes.description = cleanUpKeywords(attributes.description.replace(/<br \/>_/g, '_'));
            }

            attributes.title = cleanUpKeywords(attributes.title);
            Object.assign(viewKwObj, viewKeywords, descriptionKeywords);
        }

        if (attributes.type === 'report') {
            attributes.rows.forEach((row, rowIndex) => {
                row.reports.forEach((report, columnIndex) => {
                    const keywords = getKeywords(report.description);

                    if (!$.isEmptyObject(keywords)) {
                        ktlKeywords[`${view.id}_r${rowIndex}_c${columnIndex}`] = getKeywords(report.description); // _r's & _c's order matters for later matching
                        report.description = cleanUpKeywords(report.description);
                    }
                });
            });

            attributes.columns.forEach((column, columnIndex) => {
                column.reports.forEach((report, rowIndex) => {
                    const keywords = getKeywords(report.description);

                    if (!$.isEmptyObject(keywords)) {
                        ktlKeywords[`${view.id}_c${columnIndex}_r${rowIndex}`] = getKeywords(report.description); // _r's & _c's order matters for later matching
                        report.description = cleanUpKeywords(report.description);
                    }
                });
            });
        }

        if (!$.isEmptyObject(viewKwObj)) {
            ktlKeywords[view.id] = viewKwObj;

            //Add scene keywords.
            if (viewKwObj._km || viewKwObj._kbs || viewKwObj._zoom || viewKwObj._nswd)
                ktlKeywords[scene.attributes.key] = viewKwObj;
            else if (viewKwObj._footer)
                ktlKeywords.ktlAppFooter = Knack.scenes.getByKey(view.attributes.scene.key).attributes.slug;
            else if (viewKwObj._loh) {
                const logOutHere = scene.attributes.slug;
                ktlKeywords.ktlLogOutHere = logOutHere;
                $(document).on('click', '.kn-log-out', e => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    $('.kn-scene').addClass('ktlHidden');
                    window.location.href = window.location.href.slice(0, window.location.href.indexOf('#') + 1) + logOutHere;
                    ktl.account.logout();
                    setTimeout(() => { $('.kn-scene').removeClass('ktlHidden'); }, 100);
                })
            }
        }
    };

    Knack.scenes.models.forEach(scene => {
        scene.views.forEach(view => {
            extractKeywordsFromView(scene, view);
        });
    });

    //Add field keywords.
    const objects = Knack.objects.models;
    for (var o = 0; o < objects.length; o++) {
        var obj = objects[o];

        obj.attributes.fields.filter(f => !!f).forEach(f => {
            const fieldId = f.key;
            const field = Knack.fields[fieldId];
            var fieldDesc = field.attributes && field.attributes.meta && field.attributes.meta.description;
            if (fieldDesc) {
                fieldDesc = fieldDesc.replace(/(\r\n|\n|\r)|<[^>]*>/gm, ' ').replace(/ {2,}/g, ' ').trim();
                var fieldKwObj = extractKeywords(fieldDesc);
                if (!$.isEmptyObject(fieldKwObj))
                    ktlKeywords[fieldId] = fieldKwObj;
            }
        });
    }

    //window.ktlParserEnd = window.performance.now();
    //console.log(`KTL parser took ${Math.trunc(window.ktlParserEnd - window.ktlParserStart)} ms`);

    //Parser step 2 : Separate each keyword from its parameters and parse the parameters.
    function extractKeywords(strToParse = '', keywords = {}) {
        const strSplit = strToParse.split(/(?:^|\s)(_[a-zA-Z0-9_]{2,})/gm);
        strSplit.splice(0, 1);
        for (let i = 0; i < strSplit.length; i++) {
            strSplit[i] = strSplit[i].trim().replace(/\u200B/g, ''); //u200B is a "zero width space".  Caught that once during a copy/paste!
            if (strSplit[i].length >= 2 && strSplit[i].startsWith('_') && strSplit[i][1] !== '_') {
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
            if (['ktlRoles', 'ktlRefVal', 'ktlTarget', 'ktlCond', 'ktlMsg'].includes(firstParam)) {
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

    const numericFieldTypes = ['number', 'currency', 'sum', 'min', 'max', 'average', 'equation'];

    /**
    * Exposed constant strings
    *  @constant
    */
    this.const = {
        //Local Storage constants
        LS_USER_PREFS: 'USER_PREFS',
        LS_VIEW_DATES: 'VIEW_DATES',
        LS_AUTOCOMPLETES: 'AUTOCOMPLETE',

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

        const resizeSubscribers = [];
        window.addEventListener('resize', handleResize);
        function handleResize() {
            for (const subscriber of resizeSubscribers)
                subscriber.callback(...subscriber.additionalParameters);
        }

        let defaultConfigurationReady = false;
        $(document).on('KTL.DefaultConfigReady', () => {
            defaultConfigurationReady = true;
            ktl.core.addAppResizeSubscriber(ktl.core.sortMenu);
        })

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
            waitDefaultConfigurationReady: function () {
                return new Promise(function (resolve, reject) {
                    if (defaultConfigurationReady) return resolve();

                    $(document).on('KTL.DefaultConfigReady', () => {
                        clearTimeout(failsafeTimeout);
                        return resolve();
                    })

                    const failsafeTimeout = setTimeout(function () {
                        reject();
                    }, 10000);
                })
            },

            setCfg: function (cfgObj = {}) {
                cfgObj.developerNames && (cfg.developerNames = cfgObj.developerNames);
                cfgObj.developerEmail && (cfg.developerEmail = cfgObj.developerEmail);
                cfgObj.devOptionsPin && (cfg.devOptionsPin = cfgObj.devOptionsPin);
                cfgObj.devDebugCode && (cfg.devDebugCode = cfgObj.devDebugCode);
                cfgObj.isKiosk && (isKiosk = cfgObj.isKiosk);
                cfgObj.virtualKeyboard && (virtualKeyboard = cfgObj.virtualKeyboard);
                cfgObj.forceVirtualKeyboard && (cfg.forceVirtualKeyboard = cfgObj.forceVirtualKeyboard);

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
            knAPI: function (viewId = null, recId = null, apiData = {}, requestType = '', viewsToRefresh = [], showSpinner = true, filters) {
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

                    if (recId)
                        apiURL += recId;

                    if (filters)
                        apiURL += '?filters=' + encodeURIComponent(JSON.stringify(filters));

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
                        },
                        data: JSON.stringify(apiData),
                        success: function (data) {
                            showSpinner && Knack.hideSpinner();

                            if (recId && requestType === 'GET')
                                data.id = recId; //Put back original reference rec id for future mapping from GET to PUT operations, if needed.

                            if (viewsToRefresh.length === 0)
                                resolve(data);
                            else {
                                ktl.views.refreshViewArray(viewsToRefresh)
                                    .then(function () { resolve(data); })
                                    .catch(() => { })
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
                        if (is) {
                            if (is === 'none') //Special case: Checks if selector does not exist.
                                testSel = !$(sel).length;
                            else
                                testSel = $(sel).is(':' + is);
                        }

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
                const encodedId = text.toLowerCase().split('').map(char =>
                    char.match(/[a-zA-Z0-9]/) ? char : char.charCodeAt(0).toString(16) //For non-alpha chars, convert to their encoded value.
                ).join('');

                return encodedId;
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

            getAccountsObjectName: function () {
                const objects = Knack.objects.models;
                for (let i = 0; i < objects.length; i++) {
                    const obj = objects[i];
                    if (obj.attributes && obj.attributes.profile_key && obj.attributes.profile_key === 'all_users')
                        return obj.attributes.name;
                }
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
                const fields = Knack.objects._byId[objectId].fields.models.filter(f => !!f);
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

            convertDateTimeToString: function (dateTimeObj, iso = false, dateOnly = false, dateTimeFormat) {
                if (!dateTimeObj) return;

                let year = dateTimeObj.toLocaleString(undefined, { year: 'numeric' });
                let month = dateTimeObj.toLocaleString(undefined, { month: '2-digit' });
                let day = dateTimeObj.toLocaleString(undefined, { day: '2-digit' });
                let slashSeparator = (dateTimeFormat && dateTimeFormat.includes('/'));

                //ISO format by default: yyyy-mm-dd format.  Used by input of type calendar.
                let convertedDateTime = `${year}-${month}-${day}`;

                if (!iso) {
                    dateTimeFormat = dateTimeFormat || 'mm/dd/yyyy'; //If none supplied, use Knack's default format.

                    dateTimeFormat = dateTimeFormat.replace(/-/g, '/');

                    if (dateTimeFormat === 'mm/dd/yyyy')
                        convertedDateTime = `${month}-${day}-${year}`;
                    else if (dateTimeFormat === 'dd/mm/yyyy')
                        convertedDateTime = `${day}-${month}-${year}`;
                    else if (dateTimeFormat === 'M D, yyyy')
                        convertedDateTime = `${month}-${day}-${year}`;
                }

                if (slashSeparator)
                    convertedDateTime = convertedDateTime.replace(/\-/g, '/');

                //yyyy-mm-dd hh:mm:ss format when time is included.
                if (!dateOnly)
                    convertedDateTime += ' ' + dateTimeObj.toTimeString(undefined, { 'hour': '2-digit', 'minute': '2-digit', hourCycle: 'h23', 'second': '2-digit' });

                return convertedDateTime;
            },

            convertDateToIso: function (dateObj, period = '', separator = '/') {
                if (!dateObj) return '';
                let year = dateObj.toLocaleString(undefined, { year: 'numeric' });
                let month = dateObj.toLocaleString(undefined, { month: '2-digit' });
                let day = dateObj.toLocaleString(undefined, { day: '2-digit' });
                let isoDate = `${year}${separator}${month}`;
                if (period !== 'monthly')
                    isoDate += `${separator}${day}`;
                return isoDate;
            },

            getLastDayOfMonth: function (dateObj, iso = false) {
                let lastDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
                return lastDayOfMonth;
            },

            injectCSS: (css) => { //Add custom styles to existing CSS.
                let ktlCSS = document.querySelector('#ktlCSS');
                if (!ktlCSS) {
                    ktlCSS = document.createElement('style');
                    document.head.appendChild(ktlCSS);
                }

                ktlCSS.id = 'ktlCSS';
                ktlCSS.type = 'text/css';
                ktlCSS.textContent += css + '\n\n';
            },

            toggleMode: function () { //Formerly used to switch between Prod <=> Dev modes
                ktl.log.clog('purple', 'toggleMode is deprecated.  Use switchKtlCode instead.');
            },

            //Switch from Prod, Dev, Beta, Local, or x.yy.zz version.
            //If no param is supplied, will toggle between prod and local.
            switchKtlCode: function (ktlCode) {
                const currentKtlCode = ktl.storage.lsGetItem('ktlCode', true);

                if (!ktlCode) {
                    if (currentKtlCode === 'prod')
                        ktlCode = 'local';
                    if (currentKtlCode === 'local')
                        ktlCode = 'prod';
                }

                if (currentKtlCode === ktlCode)
                    return;

                ktl.storage.lsSetItem('ktlCode', ktlCode, true);

                ktl.debugWnd.lsLog('Switching KTL code to: ' + ktlCode);
                setTimeout(() => {
                    if (ktl.scenes.isiFrameWnd())
                        ktl.wndMsg.send('reloadAppMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { reason: 'MANUAL_REFRESH' });
                    else
                        location.reload(true);
                }, 500);
            },

            isKiosk: function () {
                var sessionKiosk = (ktl.storage.lsGetItem('KIOSK', false, true) === 'true');
                return sessionKiosk || (isKiosk ? isKiosk() : false);
            },

            //Will first check if we should enter kiosk mode, then do it.
            applyKioskMode: function () {
                if (ktl.core.isKiosk()) {
                    if (!document.querySelector('.ktlKioskMode'))
                        ktl.core.kioskMode(true);
                } else
                    ktl.core.kioskMode(false);
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

                const headerSelector = '#kn-app-header,.knHeader,.kn-info-bar';
                ktl.core.waitSelector(headerSelector, 30000)
                    .then(() => {
                        if (ktl.storage.lsGetItem('KIOSK', false, true) === 'true') {
                            $(headerSelector).addClass('ktlDisplayNone');
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
                            $(headerSelector).removeClass('ktlDisplayNone');
                            $('body').removeClass('ktlKioskMode');
                        }
                    })
                    .catch((err) => { console.log('Timeout waiting for header while setting kiosk mode.', err); });
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
                        //QR Code library comes from here: https://github.com/jeromeetienne/jquery-qrcode
                        if (typeof jQuery.fn.qrcode !== 'function') {
                            LazyLoad.js(['https://cdnjs.cloudflare.com/ajax/libs/jquery.qrcode/1.0/jquery.qrcode.min.js'], function () {
                                (typeof jQuery.fn.qrcode === 'function') ? resolve() : reject('Cannot find QRGenerator library.');
                            })
                        } else
                            resolve();
                    } else if (libName === 'JsBarcodeGenerator') {
                        //JsBarcode library comes from here: https://github.com/lindell/JsBarcode
                        if (typeof jQuery.fn.JsBarcode !== 'function') {
                            LazyLoad.js(['https://unpkg.com/jsbarcode@latest/dist/JsBarcode.all.min.js'], function () {
                                (typeof jQuery.fn.JsBarcode === 'function') ? resolve() : reject('Cannot find JsBarcode library.');
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
                    if (!selector)
                        return reject('getTextFromSelector called with empty parameter');

                    let viewId = optionalViewId;
                    let fieldId;

                    const isJQueryTarget = ktl.core.extractJQuerySelector(selector, viewId);
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
                            if (!selectorArray.length)
                                return reject('getTextFromSelector called with empty selectorArray');

                            if (selectorArray[0])
                                fieldId = ktl.fields.getFieldIdFromLabel(viewId, selectorArray[0]);
                        }

                        //If no view, but just a field ID, resolve with that.  It will be used for each rec ID.
                        if (!viewId && fieldId)
                            return resolve(fieldId);

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

                    const isJQueryTarget = ktl.core.extractJQuerySelector(ktlTarget, viewId);
                    if (isJQueryTarget) {
                        targetSel = isJQueryTarget;
                    }
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

                if (!targetFieldId && (fieldId && fieldId.startsWith('field_')))
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
            extractJQuerySelector: function (selector, viewId) {
                if ((selector.startsWith("$('") && selector.endsWith("')"))
                    || (selector.startsWith('$("') && selector.endsWith('")'))
                    || (selector.startsWith('$(`') && selector.endsWith('`)'))) {
                    let extractedSelector = selector.substring(3, selector.length - 2);
                    extractedSelector = extractedSelector.replace(/\$\{viewId\}/g, viewId);

                    return extractedSelector;
                }
            },

            //Currently used to enter a password for Dev Tools Popup
            //But can be upgraded for general purpose interactions.
            createPopup: function (callback) {
                if (typeof callback !== 'function') return;

                ktl.systemColors.getSystemColors()
                    .then((sc) => {
                        var sysColors = sc;

                        var popupForm = document.createElement('form');
                        popupForm.setAttribute('id', 'popupFormId');
                        popupForm.classList.add('devBtnsDiv', 'center');
                        popupForm.onsubmit = function (event) {
                            event.preventDefault();
                            $('#popupFormId').remove();
                            callback(inputField.value);
                        };

                        var popupHdr = document.createElement('div');
                        popupHdr.setAttribute('id', 'popupHdrIdheader');
                        popupHdr.classList.add('ktlDevToolsHeader');
                        popupHdr.style['background-color'] = sysColors.paleLowSatClr;
                        popupHdr.innerText = ':: Enter Password ::';
                        popupForm.appendChild(popupHdr);
                        document.body.appendChild(popupForm);

                        var inputField = document.createElement("input");
                        inputField.type = 'password';
                        inputField.setAttribute('autocomplete', 'off');
                        inputField.classList.add('ktlDevToolsSearchInput');
                        popupForm.appendChild(inputField);
                        inputField.focus();
                        setTimeout(() => {
                            inputField.value = ''; // Needed because autocomplete off doesn't work sometimes.
                        }, 1000);
                    });
            },

            //Used to center an element on screen dynamically, without using classes or forcing styles.
            centerElementOnScreen: function (element, fixed = true) {
                const elementWidth = element.offsetWidth;
                const elementHeight = element.offsetHeight;
                const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
                const centeredLeft = (screenWidth - elementWidth) / 2;
                const centeredTop = (screenHeight - elementHeight) / 2;
                element.style.position = (fixed ? 'fixed' : 'absolute');

                element.style.left = centeredLeft + 'px';
                element.style.top = centeredTop + 'px';

                return { left: centeredLeft, top: centeredTop };
            },

            showKnackStyleMessage: function (viewId, message, style = 'error' /*or success*/) {
                Knack.$['utility_forms'].renderMessage($('#' + viewId), '<b>' + message + '</b>', style);
            },

            findParentURL: function (URLNow, numParents) {
                if (isNaN(numParents) || numParents < 1 || numParents > 10) {
                    ktl.log.clog('purple', `findParentURL called with invalid numParents: ${level}.  Value must be between 1 and 10.`);
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
            //Mostly useful to access the KTL Developer Tools popup and the Ctrl+Shift developerPopupTool.
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

            addAppResizeSubscriber: function (callback) {
                const additionalParameters = Array.from(arguments).slice(1);
                resizeSubscribers.push({ callback, additionalParameters });
            },

            removeAppResizeSubscriber: function (callback) {
                const index = resizeSubscribers.findIndex(subscriber => subscriber.callback === callback);
                if (index !== -1) {
                    resizeSubscribers.splice(index, 1);
                }
            },

            ktlDevToolsAdjustPositionAndSave: function (div, devToolStorageName, position = {}) {
                if (!devToolStorageName || !position)
                    return;

                const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                const screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

                const ktlDevToolWidth = div.clientWidth;
                const ktlDevToolHeight = div.clientHeight;

                if ((div.offsetLeft + ktlDevToolWidth > screenWidth) || (div.offsetTop + ktlDevToolHeight > screenHeight)) {
                    position = ktl.core.centerElementOnScreen(div);
                    ktl.storage.appendItemJSON(devToolStorageName, position);
                } else {
                    if (!$.isEmptyObject(position)) {
                        div.style.left = position.left + 'px';
                        div.style.top = position.top + 'px';
                        ktl.storage.appendItemJSON(devToolStorageName, position);
                    }
                }
            },

            objectToString: function (obj, depth = 10) {
                let result = {};

                function collectProperties(currentObj, path, currentDepth) {
                    if (currentDepth > depth) return;

                    Object.keys(currentObj).forEach(key => {
                        const value = currentObj[key];
                        const newPath = path ? `${path}.${key}` : key;

                        // Check if value is an object or an array, and handle arrays explicitly
                        if (Array.isArray(value)) {
                            // For arrays, simply mark them with a placeholder or their type to ensure they're included
                            result[newPath] = 'Array'; // Or use [] to represent an empty array as is
                            if (value.length && currentDepth < depth) {
                                value.forEach((item, index) => {
                                    collectProperties(item, `${newPath}.${index}`, currentDepth + 1);
                                });
                            }
                        } else if (typeof value === 'object' && value !== null && currentDepth < depth) {
                            collectProperties(value, newPath, currentDepth + 1);
                        } else {
                            // Primitive values or the final objects/arrays at the maximum depth
                            result[newPath] = typeof value === 'object' ? "Object" : value;
                        }
                    });
                }

                function organizeProperties(flatProperties) {
                    const organized = {};

                    Object.keys(flatProperties).forEach(key => {
                        const parts = key.split('.');
                        let current = organized;

                        for (let i = 0; i < parts.length - 1; i++) {
                            const part = parts[i];
                            // Check if the next part represents an array or a terminal value
                            if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
                                current[part] = {};
                            }
                            current = current[part];
                        }

                        const lastKey = parts[parts.length - 1];
                        // Handle the case where the last part of the path is an array or terminal value differently
                        if (flatProperties[key] === "Array") {
                            current[lastKey] = []; // Assign an empty array if the value is indicated as "Array"
                        } else {
                            current[lastKey] = flatProperties[key];
                        }
                    });

                    return organized;
                }

                collectProperties(obj, '', 1);
                const organizedProperties = organizeProperties(result);

                return JSON.stringify(organizedProperties, null, 2);
            },

            countOwnPropertiesRecursively: function (obj, depth = 10) {
                let count = 0;
                if (obj !== null && typeof obj === 'object' && depth > 0) {
                    Object.keys(obj).forEach(key => {
                        count++;
                        const value = obj[key];
                        count += ktl.core.countOwnPropertiesRecursively(value, depth - 1);
                    });
                }

                return count;
            },

            //Function to extract IDs from span or other HTML elements.
            extractIds: function (html) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const elements = doc.querySelectorAll('[id], [class]');
                const hex24Regex = /^[0-9a-fA-F]{24}$/; // Regex for 24-char hexadecimal
                const idsAndClassesHex24 = Array.from(elements).flatMap(el => [el.id, ...el.className.split(/\s+/)])
                    .filter(Boolean) // Remove empty strings
                    .filter(s => hex24Regex.test(s)); // Keep only 24-char hex values
                return idsAndClassesHex24;
            },

            //Compares two arrays and returns true if they contain the same elements, regardless of their order.
            //Only works with simple values like strings or numbers, not objects.
            isArraysContainSameElements: function (array1, array2) {
                return array1.length === array2.length &&
                    array1.every(id => array2.includes(id)) &&
                    array2.every(id => array1.includes(id));
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
                                let encryptionKey = ktl.storage.lsGetItem('AES_EK', true, false, false);
                                if (!encryptionKey) {
                                    encryptionKey = ktl.core.generateRandomChars(40);
                                    ktl.storage.lsSetItem('AES_EK', encryptionKey, true, false, false);
                                }

                                secureLs = new SecureLS({
                                    encodingType: 'aes',
                                    isCompression: false,
                                    encryptionSecret: encryptionKey,
                                });

                                resolve();
                            })
                            .catch(reason => { reject('initSecureLs error:', reason); })
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
        var onInlineEditPopup = null;
        var convertNumDone = false;
        var horizontalRadioButtons = false;
        var horizontalCheckboxes = false;

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

                //Filters: enables using the enter key to select and submit.
                setTimeout(function () {
                    $('#kn-submit-filters').trigger('click');
                }, 200);
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

            onKeyPressed(e);
        })

        document.addEventListener('click', function (e) {
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
            if (!e.target) return;

            let viewId = e.target.closest('.kn-view');
            if (viewId)
                viewId = viewId.id;
            else {
                if (e.target.closest('#cell-editor'))
                    viewId = 'cell-editor';
            }

            convertNumDone = false;
            let newInput;
            if (viewId)
                newInput = ktl.fields.fieldConvertNumToTel(viewId, e.target.closest('.kn-input'));

            let newTarget;
            if (newInput) {
                newInput.select();
                newTarget = newInput[0];
            } else {
                if (ktl.core.getCfg().enabled.selTextOnFocus)
                    $(e.target).select();
                newTarget = e.target;
            }

            //Turn-off auto complete for Kiosks. Users are annoyed by the dropdown that blocks the Submit button.
            if (newTarget.classList.contains('input')) {
                if (ktl.core.isKiosk())
                    newTarget.setAttribute('autocomplete', 'off');
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
            }
        })

        //Add Change event handlers for Dropdowns, Calendars, etc.
        $(document).on('knack-view-render.any', function (event, view, data) {
            const viewId = view.key;

            if (horizontalRadioButtons) {
                $('#' + viewId + ' .kn-radio').addClass('horizontal');
                $('#' + viewId + ' .option.radio').addClass('horizontal');
            }

            if (horizontalCheckboxes) {
                $('#' + viewId + ' .kn-checkbox').addClass('horizontal');
                $('#' + viewId + ' .option.checkbox').addClass('horizontal');
            }

            //Dropdowns
            let chosenUpdateTimeout;
            $(`#${viewId} .chzn-select`).chosen().change(function (e, p) {
                if ($(`.ktlPersistenFormLoadedScene`).length) {
                    if (e.target.id && e.target.selectedOptions) {
                        //This chosenUpdateTimeout is required to ignore the first undesired change event.
                        //For some reason we get a first event with the current value, but we want the next one with the NEW changed value.
                        //Maybe this is by design, to provide the before-and-after values that could be useful.
                        clearTimeout(chosenUpdateTimeout);
                        chosenUpdateTimeout = setTimeout(() => {
                            const records = [...e.target.selectedOptions].map(option => {
                                return {
                                    text: option.innerText,
                                    id: option.value
                                }
                            });

                            const [targetViewId, fieldId] = e.target.id.split('-');
                            ktl.persistentForm.ktlOnSelectValueChanged({ viewId: targetViewId, fieldId: fieldId, records: records, e: e });

                            // Keep single record call for retro-compatibility of external code
                            if (e.target.selectedOptions[0])
                                ktl.fields.onFieldValueChanged({ viewId: viewId, fieldId: fieldId, recId: e.target.selectedOptions[0].value, text: e.target.selectedOptions[0].innerText, e: e }); //Notify app of change
                        }, 500);
                    }
                }
            })

            //Calendars
            //...Date
            $(`#${viewId} .knack-date`).datepicker().change(function (e) {
                processFieldChanged({ text: e.target.value, e: e });
            })

            //...Time
            $(`#${viewId} .kn-time`).timepicker().change(function (e) {
                processFieldChanged({ text: e.target.value, e: e });
            })

            //More to come...
            //TODO: multiple choices, all formats

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

        $(document).on('KTL.persistentForm.completed.scene', function (event, viewOrScene) {
            //This is required because when removing the last option from a multiple selection dropdown, the change event is not fired.
            $('.search-choice-close').off('click.ktl_removeoption').bindFirst('click.ktl_removeoption', function (e) {
                const [viewId, fieldId] = $(e.target).closest('.kn-input').find('.chzn-select').attr('id').split('-');

                setTimeout(() => {
                    const options = $(e.target).closest('.kn-input-connection').find('.chzn-select [value]').toArray();
                    const records = options.map(option => {
                        return {
                            text: option.innerText,
                            id: option.value
                        };
                    });

                    ktl.persistentForm.ktlOnSelectValueChanged({ viewId: viewId, fieldId: fieldId, records: records });
                }, 200);
            })
        });

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
                    if (barcodeText.length >= cfg.barcodeMinLength)
                        $(document).trigger('KTL.processBarcode', barcodeText);

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
                cfgObj.chznDropDownSearchDelay && (chznDropDownSearchDelay = cfgObj.chznDropDownSearchDelay);
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
            fieldConvertNumToTel: function (viewId, field) {
                if (!viewId || !field) return;

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
                            if (originalInput.length && originalInput.attr('type') != 'tel') {
                                const originalValue = $('#' + viewId + ' #' + fieldId).val();
                                var originalHandlers = $._data(originalInput[0], 'events');
                                var newInput = $('<input>').attr('type', 'tel').attr('id', fieldId);

                                // Copy over any relevant attributes from the original input to the new input
                                newInput.attr('name', originalInput.attr('name'));
                                newInput.attr('class', originalInput.attr('class'));
                                // ... (copy any other attributes you need)

                                // JQuery 'replaceWith' is not resilient to Aria elements
                                originalInput.before(newInput);
                                originalInput.hide();

                                newInput.val(originalValue);

                                // Restore the original event handlers to the new input field
                                if (originalHandlers) {
                                    $.each(originalHandlers, function (eventType, handlers) {
                                        $.each(handlers, function (index, handler) {
                                            newInput.on(eventType, handler.handler);
                                        });
                                    });
                                }
                                originalInput.trigger('KTL.convertNumToTel', [newInput]);
                                originalInput.remove();
                                originalInput.off();

                                return newInput;
                            }
                        }
                    }
                }

                return undefined;
            },

            sceneConvertNumToTel: function () {
                return new Promise(function (resolve) {
                    if (convertNumDone || ktl.scenes.isiFrameWnd() || textAsNumericExcludeScenes.includes(Knack.router.current_scene_key)) {
                        resolve();
                    } else {
                        var forms = document.querySelectorAll('.kn-form');
                        forms.forEach(form => {
                            var viewId = form.id;
                            if (viewId) {
                                const fields = document.querySelectorAll('#' + viewId + ' .kn-input-short_text, #' + viewId + ' .kn-input-number, #' + viewId + ' .kn-input-currency');
                                fields.forEach(field => {
                                    ktl.fields.fieldConvertNumToTel(viewId, field);
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

                for (const form of forms) {
                    var viewId = form.id;
                    if (viewId) {
                        let fields = document.querySelectorAll('#cell-editor .kn-input[numeric=true]');
                        if (!fields.length)
                            fields = document.querySelectorAll('#' + viewId + ' .kn-input[numeric=true]');

                        for (const field of fields) {
                            var inputFld = document.querySelector('#' + viewId + ' #' + field.getAttribute('data-input-id'));

                            if (inputFld) {
                                var value = inputFld.value;

                                var fieldValid = !isNaN(ktl.core.extractNumericValue(value, inputFld.id));

                                var fieldDesc = ktl.fields.getFieldDescription(inputFld.id);
                                if (fieldDesc && fieldDesc.includes('_int'))
                                    fieldValid = fieldValid && (value.search(/[^0-9]/) === -1);

                                if (fieldDesc && fieldDesc.includes('_num'))
                                    fieldValid = fieldValid && (value.search(/[^0-9.-]/) === -1);

                                inputFld.setAttribute('valid', fieldValid);
                                if (fieldValid)
                                    $(inputFld).removeClass('ktlNotValid_numeric');
                                else
                                    $(inputFld).addClass('ktlNotValid_numeric');
                            }
                        }

                        ktl.views.updateSubmitButtonState(viewId, 'numericValid', !document.querySelector(`#${viewId} .ktlNotValid_numeric`));
                    }
                }
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
                                            fieldsAr = Knack.views[viewId].model.view.fields.filter(f => !!f);

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

                let view = ktl.views.getView(viewId);
                if (!view) return;

                let viewObjToScan = view;
                let keyToFind;
                let keyNameToReturn;

                const viewType = view.type;
                try {
                    if (viewType === 'table' || viewType === 'search') {
                        keyToFind = 'header';
                        keyNameToReturn = 'id';
                        viewObjToScan = (view.results && view.results.columns && view.results.columns.length) ? view.results.columns : view.columns;
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

                let view = ktl.views.getView(viewId);
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

            barcodeGenerator: function (viewId, keywords, data) {
                if (!viewId) return;

                const viewType = ktl.views.getViewType(viewId);
                if (!['details', 'list', 'form', 'rich_text'].includes(viewType)) return;

                const kw = '_bcg';
                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }

                if (keywords && keywords[kw]) {
                    var fieldId;
                    let text;
                    let hideText = false;
                    let textSelector;
                    let divSelector;
                    let bcgDiv;
                    let style;
                    let format = 'QR';
                    let size = 200; //QR Codes only
                    let width = 100; //1D Barcodes only
                    let height = 100; //1D Barcodes only

                    if (keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                        const groups = keywords[kw][0].params;

                        for (const group of groups) {
                            if (group[0] === 'format' && group.length >= 2) {
                                format = group[1];
                                if (group.length >= 4) {
                                    const widthParam = Number(group[2]);
                                    const heightParam = Number(group[3]);
                                    if (!isNaN(widthParam) && !isNaN(heightParam)) {
                                        width = widthParam;
                                        height = heightParam;
                                    }
                                }
                            } else if (group[0] === 'style' && group.length >= 2) {
                                style = group[1];
                            } else if (group[0] === 'text' && group.length >= 2) {
                                text = group[1];
                            } else {
                                //Basic params, typically first group.
                                if (group.length >= 1) {
                                    const sizeParam = Number(group[0]);
                                    if (isNaN(sizeParam)) {
                                        ktl.log.clog('purple', 'barcodeGenerator called with invalid size:', viewId, sizeParam);
                                        return;
                                    }

                                    size = Math.max(30, sizeParam);

                                    if (group.length >= 2) {
                                        fieldId = group[1];
                                        if (!fieldId.startsWith('field_'))
                                            fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldId);

                                        if (!document.querySelector(`#${viewId} [data-input-id="${fieldId}"], #${viewId} .${fieldId}`)) {
                                            ktl.log.clog('purple', 'barcodeGenerator called with invalid params:', viewId, fieldId);
                                            return;
                                        }
                                    }

                                    if (group.length >= 3 && group[2] === 'h')
                                        hideText = true;
                                }
                            }
                        }
                    } else {
                        //If no field is specified, then try to find the first avaiable field in the view.
                        const fieldSel = $('#' + viewId + ' [class*="field_"]:first');
                        if (fieldSel.length) {
                            var classes = fieldSel[0].classList.value;
                            const match = classes.match(/field_\d+/);
                            if (match)
                                fieldId = match[0];
                        }
                    }

                    if (format === 'QR') {
                        ktl.core.loadLib('QRGenerator')
                            .then(() => { barcodeReady(); })
                            .catch(reason => { console.log('QR error:', reason); })
                    } else {
                        alignment = 'left';
                        ktl.core.loadLib('JsBarcodeGenerator')
                            .then(() => { barcodeReady(); })
                            .catch(reason => { console.log('JsBarcode error:', reason); })
                    }

                    function barcodeReady() {
                        try {
                            if (viewType === 'details') {
                                textSelector = `#${viewId} .${fieldId} .kn-detail-body span`;
                                divSelector = `${viewId}-bcgDiv-${fieldId}`;
                                text = $(`${textSelector} span`)[0].textContent.replace(/<br \/>/g, '\n');
                                drawBarcode(text, textSelector, divSelector);
                            } else if (viewType === 'list') {
                                data.forEach(row => {
                                    textSelector = `#${viewId} [data-record-id="${row.id}"] .${fieldId} .kn-detail-body span`;
                                    divSelector = `${viewId}-bcgDiv-${fieldId}-${row.id}`;
                                    text = $(`${textSelector} span`)[0].textContent.replace(/<br \/>/g, '\n');
                                    bcgDiv = drawBarcode(text, textSelector, divSelector);
                                })
                            } else if (viewType === 'form') {
                                textSelector = `#${viewId} .${fieldId}`;
                                divSelector = `${viewId}-bcgDiv-${fieldId}`;
                                text = $('#' + viewId + ' #' + fieldId).val().replace(/<br \/>/g, '\n');
                                bcgDiv = drawBarcode(text, textSelector, divSelector);

                                $(`#${viewId} #${fieldId}`).on('input', function (e) {
                                    if (bcgDiv.lastChild)
                                        bcgDiv.removeChild(bcgDiv.lastChild);

                                    text = $('#' + viewId + ' #' + fieldId).val().replace(/<br \/>/g, '\n');
                                    drawBarcode(text, textSelector, divSelector);
                                })
                            } else if (viewType === 'rich_text') {
                                divSelector = `${viewId}-bcgDiv`;
                                bcgDiv = drawBarcode(text, textSelector, divSelector);
                            }
                        }
                        catch (e) {
                            ktl.log.clog('purple', 'barcodeReady error:', e);
                        }

                        function drawBarcode(text, textSelector, divSelector) {
                            let bcgDiv = document.getElementById(divSelector);
                            if (!bcgDiv) {
                                bcgDiv = document.createElement('div');
                                bcgDiv.setAttribute('id', divSelector);

                                if (format === 'QR')
                                    bcgDiv.style.marginTop = '10px';

                                if (style) {
                                    const mergedStyle = mergeStyles(bcgDiv.style.cssText, style);
                                    Object.assign(bcgDiv.style, mergedStyle);
                                }

                                function mergeStyles(baseStyles, newStyles) {
                                    function cssTextToObject(cssText) {
                                        return cssText.split(';').reduce((acc, style) => {
                                            if (style.trim()) {
                                                const [key, value] = style.split(':');
                                                acc[key.trim()] = value.trim();
                                            }
                                            return acc;
                                        }, {});
                                    }

                                    const bsObj = cssTextToObject(baseStyles);
                                    const nsObj = cssTextToObject(newStyles);
                                    return { ...bsObj, ...nsObj };
                                }

                                if (viewType === 'form') {
                                    $(`#${viewId} [data-input-id="${fieldId}"]`).append(bcgDiv);
                                } else if (viewType === 'rich_text') {
                                    $(`#${viewId}`).append(bcgDiv);
                                } else {
                                    if (hideText) {
                                        $(`${textSelector} span`).remove();
                                        $(`${textSelector}`).append(bcgDiv);
                                    } else {
                                        $(`${textSelector} span`).prepend(bcgDiv);
                                    }
                                }
                            } else {
                                if (bcgDiv.lastChild) {
                                    bcgDiv.removeChild(bcgDiv.lastChild);
                                }
                            }

                            if (format === 'QR') {
                                const barcodeData = { text: text, width: size, height: size };
                                $(`#${divSelector}`).qrcode(barcodeData);
                            } else {
                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                bcgDiv.appendChild(canvas);
                                const canvasId = `${divSelector}-canvas`;
                                canvas.setAttribute('id', canvasId);
                                JsBarcode(`#${canvasId}`, text || '<empty>', {
                                    format: format,
                                    width: 2, // Width of a single bar.
                                    height: height,
                                });
                            }

                            return bcgDiv;
                        }
                    }
                }
            },

            barcodeReader: function (viewId, keywords) {
                const kw = '_bcr';
                if (!viewId || !keywords[kw]) return;

                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;

                let prefix;
                let autoSubmit = false;
                let submitDelay = 0;
                const barcodeFields = [];

                //The queue's intention is to be able to queue quick successive readings.
                //But we need to prevent sending output characters in the fields, creating garbled text.
                const barcodeQueue = [];

                const groups = keywords[kw][0].params;
                if (groups.length) {
                    for (const group of groups) {
                        if (group[0] === 'prefix' && group.length === 2) {
                            prefix = group[1];
                        } else if (group[0] === 'auto' && group.length >= 2) {
                            if (group.length >= 2 && group[1].toLowerCase() === 'submit')
                                autoSubmit = true;
                            if (group.length >= 3 && !isNaN(group[2]))
                                submitDelay = Number(group[2]);
                        } else {
                            if (group.length >= 1) {
                                let fieldId = group[0];
                                if (!fieldId.startsWith('field_'))
                                    fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldId);

                                if (!document.querySelector(`#${viewId} [data-input-id="${fieldId}"], #${viewId} .${fieldId}`)) {
                                    ktl.log.clog('purple', 'barcodeReader called with invalid params:', viewId, fieldId);
                                    return;
                                }

                                let textLength = 0;
                                let decimals = 0;
                                if (group.length >= 2) {
                                    textLength = group[1];
                                    decimals = 0;
                                    if (textLength && !isNaN(textLength)) {
                                        textLength = Number(textLength);
                                        if (group.length >= 3) {
                                            decimals = group[2];
                                            if (decimals && !isNaN(decimals))
                                                decimals = Number(decimals);
                                        }

                                    }

                                }

                                barcodeFields.push({ fieldId, textLength, decimals });
                            }
                        }
                    }

                    //Prevent entering text in form's fields.
                    /*
                     * Disabled for now.  Could be useful with an option in the keyword, 
                     * to prevent barcode data from being inserted in user's text in fields.
                    */
                    //$(document).keydown(function (e) {
                    //    //Prevent only printable characters.
                    //    if (e.key.length === 1 && e.key.match(/^[\w\s\p{P}\p{S}]$/u)) {
                    //        const targetView = $(e.target).closest('.kn-view[id]');
                    //        if (targetView.length && targetView.attr('id') === viewId)
                    //            e.preventDefault();
                    //    }
                    //})

                    function addToQueue(string) {
                        barcodeQueue.push(string);
                        //console.log('barcodeQueue =', barcodeQueue.length, barcodeQueue);
                        checkAndProcessQueue();
                    }

                    function checkAndProcessQueue() {
                        if (!autoSubmit || (autoSubmit && !$(`#${viewId} .kn-button.is-primary`).is(':disabled')))
                            processQueue();
                    }

                    function processQueue() {
                        while (barcodeQueue.length > 0) {
                            let currentString = barcodeQueue.shift();
                            processBarcodeText(currentString);
                        }
                    }

                    function processBarcodeText(barcodeText) {
                        if (!prefix || (prefix && barcodeText.startsWith(prefix))) {
                            if (prefix)
                                barcodeText = barcodeText.substring(prefix.length);

                            var promisesArray = [];
                            for (const barcodeField of barcodeFields) {
                                let textLength = barcodeField.textLength;
                                let fieldText = textLength === 0 ? barcodeText : barcodeText.substring(0, textLength);

                                if (barcodeField.decimals) {
                                    fieldText = barcodeText.substring(0, textLength + barcodeField.decimals);
                                    fieldText = fieldText.substring(0, textLength) + '.' + fieldText.substring(textLength); //TODO: use same decimal format as field.
                                    barcodeText = barcodeText.substring(textLength + barcodeField.decimals);
                                } else {
                                    barcodeText = barcodeText.substring(textLength);
                                }

                                const fieldType = ktl.fields.getFieldType(barcodeField.fieldId);
                                if (TEXT_DATA_TYPES.includes(fieldType)) {
                                    const el = document.querySelector(`#${viewId} [data-input-id=${barcodeField.fieldId}] input`)
                                        || document.querySelector(`#${viewId} [data-input-id=${barcodeField.fieldId}] .kn-textarea`);

                                    if (el) {
                                        el.value = fieldText;
                                        ktl.fields.enforceNumeric();
                                    }
                                } else if (fieldType === 'rich_text') {
                                    $(`#${viewId} #${barcodeField.fieldId}`).data('redactor').code.set(fieldText);
                                } else if (fieldType === 'connection') {
                                    if ($(`#${viewId}-${barcodeField.fieldId}`).hasClass('chzn-select')) {
                                        promisesArray.push(ktl.views.searchDropdown(fieldText, barcodeField.fieldId, true, true, viewId)
                                            .then(function () { })
                                            .catch(function (foundText) { console.log('error', foundText); })
                                        );
                                    }
                                }
                            }

                            setTimeout(() => {
                                if (promisesArray.length) {
                                    Promise.all(promisesArray)
                                        .then(() => {
                                            barcodeExtractionComplete();
                                        })
                                        .catch((error) => {
                                            ktl.log.clog('red', 'processBarcode error: ' + error);
                                        })
                                } else
                                    barcodeExtractionComplete();

                                function barcodeExtractionComplete() {
                                    if (autoSubmit) {
                                        setTimeout(() => {
                                            $(`#${viewId} .is-primary`).click();
                                            ktl.views.waitSubmitOutcome(viewId)
                                                .then(() => {
                                                    checkAndProcessQueue();
                                                })
                                                .catch(failure => {
                                                    ktl.log.clog('red', 'Barcode waitSubmitOutcome failed: ' + failure);
                                                });
                                        }, submitDelay * 1000);
                                    }
                                }
                            }, 200);
                        }
                    }

                    $(document).off(`KTL.processBarcode.ktl_bcr.${viewId}`).on(`KTL.processBarcode.ktl_bcr.${viewId}`, (e, barcodeText) => {
                        addToQueue(barcodeText);
                        //console.log('addToQueue:', viewId, barcodeText);
                    })
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

                //Process view keyword
                if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                    const kwList = ktl.core.getKeywordsByType(viewId, kw);
                    for (var kwIdx = 0; kwIdx < kwList.length; kwIdx++) {
                        execKw(kwList[kwIdx]);
                    }

                    function execKw(kwInstance) {
                        const options = kwInstance.options;
                        if (!ktl.core.hasRoleAccess(options)) return;

                        $('#' + viewId).addClass('ktlHidden_hf');

                        var elementsArray = [];
                        const kwFields = kwInstance.params[0];
                        for (var i = 0; i < kwFields.length; i++) {
                            var fieldLabel = kwFields[i];

                            var fieldId = fieldLabel;
                            if (!fieldLabel.startsWith('field_'))
                                fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldLabel);

                            if (fieldId) {
                                const elements = document.querySelectorAll(`#${viewId} [data-input-id="${fieldId}"], #${viewId} .${fieldId}`);
                                if (elements.length)
                                    elements.forEach(el => elementsArray.push(el));
                            } else {
                                //Try with an action link.
                                const actLink = $(`#${viewId} .kn-details-link .kn-detail-body:textEquals("${fieldLabel}")`);
                                if (actLink.length) {
                                    actLink.each(function () {
                                        elementsArray.push($(this).parent());
                                    });
                                }
                            }
                        }

                        if (elementsArray.length) {
                            const hide = () => {
                                elementsArray.forEach(el => {
                                    if (el.classList)
                                        el.classList.add('ktlHidden_hf');
                                    else
                                        el[0].classList.add('ktlHidden_hf');
                                })
                            }
                            const unhide = () => {
                                elementsArray.forEach(el => {
                                    if (el.classList)
                                        el.classList.remove('ktlHidden_hf');
                                    else
                                        el[0].classList.remove('ktlHidden_hf');
                                })
                            }

                            ktl.views.hideUnhideValidateKtlCond(options, hide, unhide)
                                .then(() => {
                                    $('#' + viewId).removeClass('ktlHidden_hf');
                                })
                        } else
                            $('#' + viewId).removeClass('ktlHidden_hf');
                    }
                }
            },

            //Fields can be by label or ID.
            disableFields: function (viewId, fields = []) {
                if (!viewId || !fields.length) return;

                for (const field of fields) {
                    const fieldId = field.startsWith('field_') ? field : ktl.fields.getFieldIdFromLabel(viewId, field);
                    const fieldType = this.getFieldType(fieldId);
                    if (fieldType === 'connection')
                        $(`#${viewId} [data-input-id="${fieldId}"] a`).attr('disabled', true);
                    else
                        $(`#${viewId} [data-input-id="${fieldId}"] input`).attr('disabled', true);
                }
            },

            //These two functions work together.
            //They are used to disable then re-enable anchors temporarily.
            //This enables showing the desired text color instead of the link color with the underline,
            //then restoring them back to their original anchor state.
            disableAnchor: function (html) {
                return html.replace(/<a /g, '<a-ktlnoanchor ').replace(/<\/a>/g, '</a-ktlnoanchor>');
            },
            revertToAnchor: function (html) {
                return html.replace(/<a-ktlnoanchor /g, '<a ').replace(/<\/a-ktlnoanchor>/g, '</a>');
            },
        }
    })(); //fields

    //====================================================
    //Persistent Form
    //Will automatically save and load form data to prevent losses after a refresh, power outage, network loss or other.
    this.persistentForm = (function () {
        const PERSISTENT_FORM_DATA = 'persistentForm';
        //To see all data types:  console.log(Knack.config);

        //Add fields and scenes to exclude from persistence in these arrays.
        let scenesToExclude = [];
        let fieldsToExclude = [];

        let currentViews = {}; //Needed to cleanup form data from previous views, when scene changes.
        let previousScene = '';
        let isInitialized = false;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (ktl.scenes.isiFrameWnd()) return;

            if (!previousScene)
                previousScene = scene.key;
            else if (previousScene !== scene.key) {
                previousScene = scene.key;

                for (const viewId in currentViews)
                    eraseFormData(viewId);

                currentViews = {};
            }

            ktl.fields.sceneConvertNumToTel().then(() => {
                if (!ktl.core.getCfg().enabled.persistentForm || scenesToExclude.includes(scene.key)) {
                    //Allow other features that depend on this event to run, even if PF is not enabled.
                    isInitialized = true;
                    $('.kn-scene').addClass('ktlPersistenFormLoadedScene');
                    $(document).trigger('KTL.persistentForm.completed.scene', [scene]);
                } else {
                    loadFormData()
                        .then(() => {
                            isInitialized = true;
                            setTimeout(() => {
                                ktl.fields.enforceNumeric();
                                $('.kn-scene').addClass('ktlPersistenFormLoadedScene');
                                $(document).trigger('KTL.persistentForm.completed.scene', [scene]);
                            }, 1000);
                        })
                }
            });
        });

        $(document).on('knack-view-render.any', function (event, view) {
            if (ktl.scenes.isiFrameWnd() || view.type != 'form') return;
            const viewId = view.key;

            const elementsToObserve = document.querySelectorAll(`#${viewId} .redactor-box`);
            const observer = new MutationObserver((records, observer) => {
                if (!isInitialized) return;

                const editor = $(records.find(record => $(record.target).closest('.redactor-editor').length).target).closest('.redactor-editor');
                if (editor) {
                    formContentHasChanged(editor[0]);
                }
            });

            elementsToObserve.forEach((element) =>
                observer.observe(element, { subtree: true, childList: true, attributes: false, characterData: true })
            );

            if (!ktl.core.getCfg().enabled.persistentForm || (view.scene && scenesToExclude.includes(view.scene.key))) {
                //Allow other features that depend on this event to run, even if PF is not enabled.
                $(`#${viewId}`).addClass('ktlPersistenFormLoadedView');
                $(document).trigger(`KTL.persistentForm.completed.view.${viewId}`, viewId);
                return;
            }

            //TODO:  ktl.fields.viewConvertNumToTel().then(() => {
            //View-based verison of sceneConvertNumToTel

            if (ktlKeywords[viewId] && ktlKeywords[viewId]._rlv) {
                loadFormData(viewId)
                    .then(() => {
                        isInitialized = true;
                        setTimeout(() => {
                            ktl.fields.enforceNumeric();
                        }, 1000);
                    })
            } else
                $(document).trigger('KTL.loadFormData', viewId);
        });

        $(document).on('knack-form-submit.any', function (event, view, record) {
            if (ktl.scenes.isiFrameWnd()) return;
            eraseFormData(view.key);
        });

        const debouncedFormContentHasChanged = debounce(formContentHasChanged, 500);
        $(document).on('input', function (event) {
            if (!event
                || !event.target.type
                || event.target.className.includes('knack-date')
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
                if (field.attributes.type === 'boolean') {
                    if (field.attributes.format.input === 'checkbox')
                        inputValue = element.checked;
                } else if (field.attributes.format && field.attributes.format.type === 'checkboxes') {
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

            if (isInitialized
                && ktl.core.getCfg().enabled.persistentForm
                && !scenesToExclude.includes(Knack.router.current_scene_key)
                && !ktl.scenes.isiFrameWnd())
                saveFormData(inputValue, viewId, fieldId, subFieldId);

            $(document).trigger('KTL.fieldValueChanged', { viewId: viewId, fieldId: fieldId, text: inputValue, e: {} });
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

        $(document).on('KTL.loadFormData', function (event, viewId) {
            if (!viewId) return;

            loadFormData(viewId)
                .then(() => {
                    setTimeout(() => {
                        ktl.fields.enforceNumeric();
                    }, 1000);
                })
        })

        //Loads any data previously saved for all fields in forms.
        //If a viewId is supplied, only this form will be processed, otherwise all forms in scene.
        //Also adds Change event handlers for dropdowns and calendars.   Eventually, support all object types.
        //After loading, re-validates numeric fields and put errors in pink.
        let allViewsDone = [];
        function loadFormData(viewId) {
            return new Promise(function (resolve) {
                if (allViewsDone.length) return; //Prevent re-entry until finished.

                var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
                if (!formDataObjStr || $.isEmptyObject(JSON.parse(formDataObjStr))) {
                    ktl.storage.lsRemoveItem(PERSISTENT_FORM_DATA); //Wipe out if empty object, JIC.
                    if (viewId) {
                        $(`#${viewId}`).addClass('ktlPersistenFormLoadedView');
                        $(document).trigger(`KTL.persistentForm.completed.view.${viewId}`, viewId);
                    } else {
                        $('.kn-scene').addClass('ktlPersistenFormLoadedScene');
                        $(document).trigger('KTL.persistentForm.completed.scene', [Knack.router.scene_view.model]);
                    }
                    return resolve();
                }

                const formDataObj = {};
                currentViews = {};

                if (viewId) {
                    const view = Knack.router.scene_view.model.views._byId[viewId];
                    if (view && view.attributes)
                        loadDataForView(view.attributes)
                            .then(() => {
                                if (view.attributes.type === 'form' && (view.attributes.action === 'insert' || view.attributes.action === 'create')) {
                                    $(`#${view.attributes.key}`).addClass('ktlPersistenFormLoadedView');
                                    $(document).trigger(`KTL.persistentForm.completed.view.${view.attributes.key}`, view.attributes.key);
                                    return resolve();
                                }
                            })
                } else {
                    //All views in scene.
                    Knack.router.scene_view.model.views.models.map(model => model.attributes).forEach(view => {
                        allViewsDone.push(
                            loadDataForView(view)
                                .then(() => {
                                    if (view.type === 'form' && (view.action === 'insert' || view.action === 'create')) {
                                        $(`#${view.key}`).addClass('ktlPersistenFormLoadedView');
                                        $(document).trigger(`KTL.persistentForm.completed.view.${view.key}`, view.key);
                                    }
                                })
                        );
                    })

                    Promise.all(allViewsDone)
                        .then(() => {
                            allViewsDone = [];
                            resolve();
                        })
                }

                function loadDataForView(view) {
                    return new Promise(function (resolve) {
                        if (view.type !== 'form') return resolve();

                        //Add only, not Edit or any other type
                        if (view.action != 'insert' && view.action != 'create')
                            return resolve();

                        const viewData = JSON.parse(formDataObjStr)[view.key];
                        if (!viewData) return resolve();

                        currentViews[view.key] = view.key;
                        formDataObj[view.key] = viewData;

                        //Object.keys(formDataObj[view.key]).forEach(fieldId => {
                        const keys = Object.keys(formDataObj[view.key]);
                        for (const fieldId of keys) {
                            if (fieldsToExclude.includes(fieldId)) {
                                ktl.log.clog('purple', 'Skipped field for PF: ' + fieldId);
                                continue; //JIC - should never happen since fieldsToExclude are never saved in the first place.
                            }

                            const field = Knack.objects.getField(fieldId);
                            if (!field) continue;

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
                                        !el.value && ($(el).val(fieldText));
                                    }
                                }

                                if (typeof fieldText === 'object') {
                                    //If we have an object instead of plain text, we need to recurse into it for each sub-field.
                                    //Ex: name and address field types.
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

                                if ($(`#${view.key}-${fieldId}`).hasClass('chzn-select')) {
                                    const options = fieldText.split(';').map(record => {
                                        const [label, id] = record.split(':');
                                        return { label, id };
                                    }).filter(v => !!v.id);

                                    const input = $(`#${view.key}-${fieldId}`);

                                    options.forEach(option => {
                                        if (!input.find(`option[value="${option.id}"]`).length) {
                                            input.append(`<option value="${option.id}">${option.label}</option>`);
                                        }
                                    });

                                    const values = input.val() || [];
                                    input.val([...values, ...options.map(o => o.id)]).trigger("liszt:updated");
                                } else if ($(`#${view.key} #connection-picker-radio-${fieldId}`).length) { // Radio buttons
                                    $(`#${view.key} #connection-picker-radio-${fieldId} input[value="${fieldText}"]`).click();
                                } else if ($(`#${view.key} #connection-picker-checkbox-${fieldId}`).length) { // Checkboxes
                                    $(`#${view.key} #connection-picker-checkbox-${fieldId} input[value="${fieldText}"]`).click();
                                }
                            } else if (fieldType === 'multiple_choice') {
                                if (typeof fieldText === 'object') {
                                    Object.keys(formDataObj[view.key][fieldId]).forEach(subField => {
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
                                    $(`#${view.key}-${fieldId}`).val([...values, ...choices]).trigger("liszt:updated");
                                }
                            } else if (fieldType === 'boolean') {
                                if (field.attributes.format.input === 'checkbox') {
                                    if (fieldText === 'true')
                                        $(`#${view.key} [data-input-id="${fieldId}"] input`).first().click();
                                } else if (field.attributes.format.input === 'radios')
                                    $(`#${view.key} [data-input-id="${fieldId}"] input[value="${fieldText}"]`).first().click();
                                else {
                                    $(`#${view.key} [data-input-id="${fieldId}"] option`).removeAttr('selected');
                                    $(`#${view.key} [data-input-id="${fieldId}"] option[value=${fieldText}]`).attr('selected', 'selected');
                                    $(`#${view.key} select#${fieldId}.select`).trigger('change');
                                }
                            } else if (['password', 'file', 'image'].includes(fieldType)) {
                                //Ignore.
                            } else {
                                ktl.log.clog('purple', 'Unsupported field type: ' + fieldId + ', ' + fieldType);
                            }

                            delete formDataObj[view.key][fieldId];
                        };

                        delete formDataObj[view.key];
                        return resolve();
                    })
                }

                setTimeout(function () { //Failsafe
                    return resolve();
                }, 20000);
            })
        }

        //Remove all saved data for this view after a submit
        //If changing scene, erase for all previous scene's views.
        //If viewId is empty, erase all current scene's views.
        function eraseFormData(viewId) {
            if (viewId) {
                var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
                if (formDataObjStr) {
                    var formDataObj = JSON.parse(formDataObjStr);

                    //Process Reload Last Values _rlv
                    if (ktlKeywords[viewId] && ktlKeywords[viewId]._rlv && ktlKeywords[viewId]._rlv.length && ktlKeywords[viewId]._rlv[0].params[0].length) {
                        const rlvFields = ktlKeywords[viewId]._rlv[0].params[0];
                        const rlvFieldsId = rlvFields.map(field => field.startsWith('field_') ? field : ktl.fields.getFieldIdFromLabel(viewId, field));

                        Object.keys(formDataObj[viewId]).forEach(persistentFieldId => {
                            if (!rlvFieldsId.includes(persistentFieldId)) {
                                delete formDataObj[viewId][persistentFieldId];
                            }
                        });
                    } else
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

            disablePersistentForm: function (sceneKey) {
                if (!scenesToExclude.includes(sceneKey))
                    scenesToExclude.push(sceneKey);
            },

            //For KTL internal use.  Add Change event handlers for Calendars, etc.
            ktlOnFieldValueChanged: function ({ viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e }) {
                if (!fieldsToExclude.includes(fieldId)) {
                    let longestWord = ktl.core.findLongestWord(text); //Maximize your chances of finding something unique, thus reducing the number of records found.

                    if (recId)
                        longestWord += '-' + recId;
                    saveFormData(longestWord, viewId, fieldId);
                    $(document).trigger('KTL.fieldValueChanged', { viewId: viewId, fieldId: fieldId, text: text, e: e });
                }
            },

            //For KTL internal use.  Add Change event handlers for Dropdowns.
            ktlOnSelectValueChanged: function ({ viewId: viewId, fieldId: fieldId, records: records }) {
                if (!fieldsToExclude.includes(fieldId)) {
                    const data = records.map(record => record.text + ':' + record.id).join(';');
                    saveFormData(data, viewId, fieldId);
                    $(document).trigger('KTL.dropDownValueChanged', { viewId: viewId, fieldId: fieldId, records: records });
                }
            },
        }
    })(); //persistentForm

    //====================================================
    //Autocomplete Feature
    this.autocomplete = (function () {
        function autocompleteFields(viewId) {
            if (ktl.views.getViewType(viewId) != 'form')
                return;

            const fieldsWithKeywords = ktl.views.getAllFieldsWithKeywordsInView(viewId) || {};
            const fieldIds = Object.entries(fieldsWithKeywords).filter(([key, value]) => !!value._ac).map(([key, value]) => key);

            if (fieldIds.length === 0)
                return;

            function fetchSources() {
                return JSON.parse(ktl.storage.lsGetItem(ktl.const.LS_AUTOCOMPLETES) || '{}');
            }

            function saveSources(source) {
                ktl.storage.lsSetItem(ktl.const.LS_AUTOCOMPLETES, JSON.stringify(source));
            }

            function removeEntry(fieldId, entry) {
                const sources = fetchSources();
                if (!sources || $.isEmptyObject(sources)) return;

                sources[fieldId] = sources[fieldId] && sources[fieldId].filter((value) => value != entry);

                if (sources[fieldId].length == 0)
                    delete sources[fieldId];

                saveSources(sources);
                return sources;
            }

            function appendEntry(fieldId, entry) {
                const sources = fetchSources();
                if (sources[fieldId]) {
                    sources[fieldId] = [...new Set([...sources[fieldId], entry])];
                } else {
                    sources[fieldId] = [entry]
                }
                saveSources(sources);
                return sources;
            }

            function setupAutocomplete(field, key) {
                function deleteAndRefresh(value) {
                    const source = removeEntry(key, value);
                    if (!source || $.isEmptyObject(source)) return;

                    if (source[key]) {
                        field.autocomplete('option', 'source', source[key]);
                        field.autocomplete('search');
                    }
                }

                const source = (fetchSources()[key] || []).map(value => { return { label: value.substring(0, 100), value }; });
                // JQuery Autocomplete v1.9
                field.autocomplete({
                    source: source,
                    appendTo: `#${viewId}`,
                    minLength: 0,
                    delay: 0,
                    autoFocus: false,
                    open: function (event) {
                        if (!field.is(':visible')) {
                            $(this).off(event); // Remove event kept by convertNumToTel switch
                            return;
                        }

                        field.autocomplete('widget').children('li').append($('<i/>').on('click', (event) => {
                            event.stopImmediatePropagation();
                            deleteAndRefresh($(event.currentTarget).parent().text());
                        }));
                    },
                    select: function (event, ui) {
                        if (!field.is(':visible')) {
                            $(this).off(event); // Remove event kept by convertNumToTel switch
                            return;
                        }

                        field.trigger('input');
                    }
                }).keyup(function (event) {
                    if (!field.is(':visible')) {
                        $(this).off(event); // Remove event kept by convertNumToTel switch
                        return;
                    }

                    if (event.key === "Delete") {
                        deleteAndRefresh(field.autocomplete('widget').find('li > a.ui-state-focus').text());
                    }
                }).focus(function (event) {
                    if (!field.is(':visible')) {
                        $(this).off(event); // Remove event kept by convertNumToTel switch
                        return;
                    }

                    field.autocomplete('search');
                });
            };

            fieldIds.forEach(fieldId => {
                $(`#${viewId} div[data-input-id="${fieldId}"] input[name]:not(:hidden)`).each(function () {
                    const field = $(this);
                    const name = $(this).attr('name');
                    const key = fieldId + (!name.includes('field_') ? '-' + name : '');
                    setupAutocomplete(field, key);

                    field.on('KTL.convertNumToTel', function (event, newField) {
                        field.autocomplete('destroy');
                        setupAutocomplete(newField, key);
                        newField.focus();
                    });
                });

                $(`#${viewId} div[data-input-id="${fieldId}"] textarea`).each(function () {
                    setupAutocomplete($(this), fieldId);
                });
            });

            $(`#${viewId} button[type="submit"]`).on('click', event => {
                fieldIds.forEach(fieldId => {
                    $(`#${viewId} div[data-input-id="${fieldId}"] input[name]:not(:hidden)`).each(function () {
                        const field = $(this);
                        const name = field.attr('name');
                        const key = fieldId + (!name.includes('field_') ? '-' + name : '');
                        const entry = field.val();
                        if (entry)
                            appendEntry(key, entry);
                    });

                    $(`#${viewId} div[data-input-id="${fieldId}"] textarea`).each(function () {
                        const entry = $(this).val();
                        if (entry)
                            appendEntry(fieldId, entry);
                    });
                });
            });

        }

        $(document).on('knack-view-render.any', function (event, view) {
            autocompleteFields(view.key)
        });

        $(document).on('KTL.persistentForm.completed.scene', function (event, scene) {
            if (!scene || !scene.views) return;
            scene.views.forEach(view => {
                autocompleteFields(view.key);
            })
        });

    })(); //Autocomplete

    //====================================================
    // Searchable Dropdown Threshold Feature
    this.searchableDropdownThreshold = (function () {
        const KEYWORD = '_sddt';

        function searchableDropdownThresholdFields(viewId, containerId) {
            const fieldsWithKeywords = ktl.views.getAllFieldsWithKeywordsInView(viewId) || {};
            const fields = Object.entries(fieldsWithKeywords).filter(([key, value]) => !!value[KEYWORD]);

            fields.forEach(([fieldId, args]) => {
                const [minLength, delay] = args[KEYWORD][0].params[0];
                let input = $(`#${containerId || viewId} [data-input-id="${fieldId}"] input.ui-autocomplete-input`);

                if (!input.length)
                    return;

                if (!input.data().autocomplete)
                    return;

                const options = input.autocomplete('option');
                input.autocomplete('option', {
                    ...options,
                    minLength,
                    delay,
                });
            });
        }

        $(document).on('knack-view-render.any', function (event, view) {
            searchableDropdownThresholdFields(view.key)
        });

        $(document).on('KTL.persistentForm.completed.scene', function (event, scene) {
            if (!scene || !scene.views) return;
            scene.views.forEach(view => {
                searchableDropdownThresholdFields(view.key);
            })
        });

        $(document).on('click', 'td.cell-edit:not(:checkbox):not(.ktlNoInlineEdit)', function (event) {
            const viewId = $(event.target).closest('.kn-view[id]').attr('id');

            ktl.core.waitSelector('#cell-editor input.ui-autocomplete-input', 1000)
                .then(() => searchableDropdownThresholdFields(viewId, 'cell-editor'))
                .catch(() => { })

        });

    })(); // Searchable Dropdown Threshold Feature

    //====================================================
    //System Colors feature
    this.systemColors = (function () {
        //Colors can be a named color like 'mistyrose' or a hex RGBA value '#a0454b75'
        //Or some other presets in sysColors like: sc.paleLowSatClrTransparent
        const sysColors = {
            header: '',
            button: '',
            buttonText: '',
            text: '',
            links: '',
            filterBtnClr: '',
            activeFilterBtnClr: '',
            borderClr: '',
            publicFilterBtnClr: '',
            activePublicFilterBtnClr: '',
            paleLowSatClr: '',
            paleLowSatClrTransparent: '',
            tableRowHoverBkgColor: '',
            inlineEditBkgColor: '',
            inlineEditFontWeight: '500', //Can be 'bold' or a numeric value like 600.
        };

        let systemColorsReady = false;

        $(document).on('knack-view-render.any', function (event, view, data) {
            ktl.systemColors.getSystemColors().then(sc => {
                if (ktl.core.getCfg().enabled.rowHoverHighlight && sc.tableRowHoverBkgColor && sc.tableRowHoverBkgColor !== '') {
                    $('#' + view.key + ' .kn-table').removeClass('knTable--rowHover');
                    $('#' + view.key + ' .kn-table').addClass('ktlTable--rowHover');
                }

                if (ktl.core.getCfg().enabled.inlineEditColor && sysColors.inlineEditBkgColor && ktl.views.viewHasInlineEdit(view.key)) {
                    $(`#${view.key} td.cell-edit`).addClass('ktlInlineEditableCellsStyle');
                }
            })
        })

        return {
            setCfg: function (cfgObj = {}) {
                ktl.systemColors.getSystemColors().then(() => {
                    if (typeof cfgObj.inlineEditBkgColor !== 'undefined') {
                        sysColors.inlineEditBkgColor = cfgObj.inlineEditBkgColor;
                        document.documentElement.style.setProperty('--ktlInlineEditableCellsBgColor', sysColors.inlineEditBkgColor);
                    }

                    if (typeof cfgObj.inlineEditFontWeight !== 'undefined') {
                        sysColors.inlineEditFontWeight = cfgObj.inlineEditFontWeight;
                        document.documentElement.style.setProperty('--ktlInlineEditableCellsFontWeight', sysColors.inlineEditFontWeight);
                    }

                    if (typeof cfgObj.tableRowHoverBkgColor !== 'undefined') {
                        sysColors.tableRowHoverBkgColor = cfgObj.tableRowHoverBkgColor;
                        document.documentElement.style.setProperty('--ktltableRowHoverBkgColor', sysColors.tableRowHoverBkgColor);
                    }
                })
            },

            //For KTL internal use.
            initSystemColors: function () {
                return new Promise(function (resolve, reject) {
                    ktl.core.waitSelector('#kn-dynamic-styles')
                        .then(function () {
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

                            document.documentElement.style.setProperty('--ktlInlineEditableCellsBgColor', sysColors.inlineEditBkgColor);
                            document.documentElement.style.setProperty('--ktlInlineEditableCellsFontWeight', sysColors.inlineEditFontWeight);
                            document.documentElement.style.setProperty('--ktltableRowHoverBkgColor', sysColors.tableRowHoverBkgColor);
                            document.documentElement.style.setProperty('--bulkEditSelectedRowsCells', sysColors.header.rgb + '44');
                            document.documentElement.style.setProperty('--bulkEditSelectedColsAndRows', sysColors.header.rgb + '77');
                            document.documentElement.style.setProperty('--bulkEditSelectedBorders', sysColors.header.rgb);

                            systemColorsReady = true;
                            return resolve();
                        })
                        .catch(err => {
                            return reject('Timeout waiting for #kn-dynamic-styles:' + err);
                        })
                })
            },

            getSystemColors: function () {
                return new Promise(function (resolve, reject) {
                    if (systemColorsReady) {
                        return resolve(sysColors);
                    } else {
                        ktl.systemColors.initSystemColors()
                            .then(() => { return resolve(sysColors); })
                            .catch((error) => { return reject('getSystemColors failed during initSystemColors: ' + error); })
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

        function applyUserFilterToTableView(viewId, search, perPage, sort, filters) {
            Knack.showSpinner();

            updateSearchTable(viewId, search);
            updatePerPage(viewId, perPage);
            updateSort(viewId, sort);
            updateFilters(viewId, filters);

            Knack.models[viewId].fetch({
                success: () => {
                    Knack.hideSpinner();
                    $(document).trigger('KTL.filterApplied', viewId);
                }
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

        //Apply default Public Filter if no active filter.
        function applyDefaultPublicFilter(viewId) {
            if (!viewId) return;

            const kw = '_dpf';
            const kwList = ktl.core.getKeywordsByType(viewId, kw);
            if (kwList.length)
                kwList.forEach(kwInstance => { execKw(kwInstance); })
            else
                $(document).trigger('KTL.filterApplied', viewId);

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
                            applyUserFilterToTableView(viewId, appliedFilter.search, appliedFilter.perPage, appliedFilter.sort, JSON.parse(appliedFilter.filterString));
                    }
                }
            }
        }

        function linkFilters(viewTitles, masterView) {
            const masterViewId = masterView.key;
            const linkedViewIds = ktl.views.convertViewTitlesToViewIds(viewTitles, masterViewId);

            if (linkedViewIds && !!masterView.filters && (masterView.filters.length === undefined || masterView.filters.length > 0)) {
                linkedViewIds.forEach((linkedViewId) => {
                    if (Knack.models[linkedViewId].view.type === 'report') {
                        Knack.models[linkedViewId].view.rows.forEach(row => {
                            row.reports.forEach(report => {
                                applyUserFilterToReportView(linkedViewId, report, masterView.filters);
                            });
                        });
                    } else if (masterView.type === 'table') {
                        const srchVal = $(`#${masterViewId} .table-keyword-search input`).val() || '';
                        applyUserFilterToTableView(
                            linkedViewId,
                            srchVal,
                            masterView.rows_per_page,
                            masterView.source.sort[0].field + '|' + masterView.source.sort[0].order,
                            masterView.filters);
                    }
                });
            }
        }

        $(document).on('knack-records-render.report knack-records-render.table knack-records-render.list', function (e, view, data) {
            //Linked Filters _lf feature

            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            const masterViewId = view.key;
            const keywords = ktlKeywords[masterViewId];

            if (window.self.frameElement || $(`#${masterViewId} .kn-add-filter`).length === 0)
                return;

            if (!keywords || !keywords._lf)
                return;

            linkFilters(keywords._lf[0].params[0], Knack.models[masterViewId].view);
        });


        $(document).on('knack-records-render.report', function (e, view, data) {
            //Linked Filters _lf feature, Report Subviews

            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            const applyFilters = (keyword, index) => {
                if (!keyword._lf) return;

                const urlFilters = getUrlParameter(`${view.key}_${index}_filters`);
                const filters = JSON.parse(urlFilters || '{}');

                ktl.views.convertViewTitlesToViewIds(keyword._lf[0].params[0], view.key).forEach(viewId => {
                    if (Knack.models[viewId].view.type === 'report') {
                        Knack.models[viewId].view.rows.forEach(row => {
                            row.reports.forEach(report => {
                                applyUserFilterToReportView(viewId, report, filters);
                            });
                        });
                    } else {
                        Knack.showSpinner();
                        updateFilters(viewId, filters);
                        Knack.models[viewId].fetch({
                            success: () => { Knack.hideSpinner(); }
                        });
                    }
                });
            }

            view.rows.forEach((row, rowIndex) => {
                row.reports.forEach((report, columnIndex) => {
                    const keyword = ktlKeywords[`${view.key}_r${rowIndex}_c${columnIndex}`];
                    if (keyword) {
                        applyFilters(keyword, report.index);
                    }
                });
            });

            view.columns.forEach((column, columnIndex) => { // Cannot find a use case for columns by Knack but it's in the object. Keeping it for consistency. NOT TESTED
                column.reports.forEach((report, rowIndex) => {
                    const keyword = ktlKeywords[`${view.key}_c${columnIndex}_r${rowIndex}`];
                    if (keyword) {
                        applyFilters(keyword.reportIndex);
                    }
                });
            });
        });

        $(document).on('knack-view-render.any', function (event, view, data) {
            //Linked Searches _ls feature
            if ((ktl.scenes.isiFrameWnd()) || window.self.frameElement) return;

            const keywords = ktlKeywords[view.key];

            if (!keywords || !keywords._ls)
                return;

            const searchInput = $(`#${view.key} .table-keyword-search input`);

            if (searchInput.length === 0)
                return;

            const parameters = keywords._ls[0].params[0];
            const linkedViewIds = ktl.views.convertViewTitlesToViewIds(parameters, view.key)
                .filter(viewId => Knack.models[viewId].view.type === 'table');

            searchInput.on('keyup', () => {
                linkedViewIds.forEach((viewId) => {
                    $(`#${viewId} .table-keyword-search input`).val(searchInput.val());
                });
            });

            const updateTables = () => {
                linkedViewIds.forEach((viewId) => {
                    Knack.showSpinner();
                    updateSearchTable(viewId, searchInput.val());
                    Knack.models[viewId].fetch({
                        success: () => { Knack.hideSpinner(); }
                    });
                });
            }

            $(`#${view.key} .kn-button.search`).on('click', updateTables);
            $(`#${view.key} .table-keyword-search`).on('submit', updateTables);
        });

        $(document).on('knack-records-render.report knack-records-render.table knack-records-render.list', function (e, view, data) {
            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            const viewId = view.key;

            if (!window.self.frameElement && allowUserFilters() && $(`#${viewId} .kn-add-filter`).length) {
                ktl.userFilters.addFilterButtons(viewId);
            }
        });

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
        };

        $(document).on('knack-records-render.table', function (e, view, data) {
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
            $(`#${view.key} .reset.kn-button.is-link`).bindFirst('click', function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();

                $(`#${view.key} .table-keyword-search input`).val(''); //Force to empty otherwise we sometimes get current search string.
                $(`#${view.key} .kn-button.search`).click();
            });

            $(`#${view.key} .kn-table-table th`).on('click', function () {
                $(document).one(`knack-view-render.${view.key}`, function (event, view, data) {
                    ktl.userFilters.saveFilter(view.key, true);
                })
            });
        });

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
                        .find((report) => report.index === (reportId - 1)), undefined);

                applyUserFilterToReportView(viewId, report, JSON.parse(filterString));
            }
        };

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
            $('.menuDiv').css({ 'left': pos.x + 'px', 'top': pos.y + 'px' });

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

                const hasIframeWnd = !!(ktl.core.getCfg().enabled.iFrameWnd && ktl.iFrameWnd.getiFrameWnd());

                if (hasIframeWnd) {
                    if (isPublic)
                        listPublicFilters.innerHTML += 'Yes';
                    else
                        listPublicFilters.innerHTML += 'No';
                } else {
                    listPublicFilters.innerHTML += '(no iFrameWnd)';
                    listPublicFilters.style.color = 'gray';
                }

                $(listPublicFilters).on('click touchstart', function (e) {
                    e.preventDefault();

                    if (!hasIframeWnd) {
                        e.stopImmediatePropagation();
                        return;
                    }

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
                            collapsed = param[1].split(',').filter(value => value != '').map(value => encodeURIComponent(value));
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

                    filterSrc = filter.filterSrc;
                    type = filter.type;

                    //If it's a public filter, exit if the unlocked icon is not present.  This covers all cases, i.e. when you don't have the right to modify it, or if you do but PFs are locked.
                    if (type === LS_UFP && !document.querySelector('#' + filterDivId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-unlock-alt')) {
                        ktl.userFilters.removeActiveFilter(filterDivId);
                        return;
                    }

                    const filterObject = filter.filterSrc[filterDivId].filters[filter.index];
                    if (filterObject) {
                        if (filter.index >= 0)
                            filterName = filterObject.filterName;

                        if (!collapsed)
                            collapsed = filterObject.collapsed;
                    }
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
                var fltObj = { ...previousFilterProperties, 'filterName': filterName, 'filterString': newFilterStr, 'perPage': newPerPageStr, 'sort': newSortStr, 'search': newSearchStr, 'collapsed': collapsed };

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
            },

            applyActiveFilter: function (view) {
                const viewId = view.key;
                if (view.type === 'report') {
                    //Reports are risky, since they don't have an absolute ID. Instead, they have an index and if they are moved around
                    //in the builder, the filters won't know about it and will stop working.
                    let reportIndex = 0;
                    view.rows.forEach((row) => {
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
                            applyUserFilterToTableView(viewId, activeFilter.search, activeFilter.perPage, activeFilter.sort, JSON.parse(activeFilter.filterString));
                        else
                            $(document).trigger('KTL.filterApplied', viewId);
                    } else
                        applyDefaultPublicFilter(viewId); //No active filter, apply _dpf if any.
                }
            },
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
                                        //ktlDevToolsAdjustPositionAndSave(devToolStorageName, position);
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

                                        ktl.core.ktlDevToolsAdjustPositionAndSave(debugWnd, devToolStorageName, savedPosition);
                                    } else {
                                        const position = ktl.core.centerElementOnScreen(debugWnd);
                                        ktl.core.ktlDevToolsAdjustPositionAndSave(debugWnd, devToolStorageName, position);
                                    }
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
        const PAUSE_AUTO_REFRESH_CHECKBOX_ID = 'pause_auto_refresh';
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
        let quickToggleParams = {
            bgColorTrue: '#39d91f',
            bgColorFalse: '#f04a3b',
            bgColorPending: '#dd08',
            showSpinner: true,
            showNotification: true,
            pendingClass: '',
        };

        const automatedBulkOpsQueue = {};

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
                    var autoRefreshCb = ktl.fields.addCheckbox(div[0], 'Pause Auto-Refresh', false, PAUSE_AUTO_REFRESH_CHECKBOX_ID, cbStyle, lbStyle);
                    autoRefreshCb.addEventListener('change', function () {
                        ktl.views.autoRefresh(!this.checked);
                    });
                }
            }
        })

        //Object that keeps a render count for each viewId that has a summary and groups.
        const viewWithSummaryRenderCounts = {};
        $(document).on('knack-view-render.any', function (event, view, data) {
            const viewId = view.key;

            if (ktl.views.viewHasSummary(viewId) || ktl.views.viewHasGroups(viewId)) {
                viewWithSummaryRenderCounts[viewId] = (viewWithSummaryRenderCounts[viewId] || 0) + 1;

                const numberOfSummaryLines = document.querySelectorAll(`#${viewId} .kn-table-totals`).length;
                const noData = document.querySelector(`#${viewId} .kn-tr-nodata`);

                if (viewWithSummaryRenderCounts[viewId] === 2) {
                    viewWithSummaryRenderCounts[viewId] = 0;
                    ktlProcessKeywords(view, data);
                } else {
                    if (numberOfSummaryLines === 1 && !noData) {
                        if (Knack.models[viewId].results_model) {
                            Knack.models[viewId].results_model.fetch();
                            return;
                        }
                    }
                }

                if (viewWithSummaryRenderCounts[viewId] > 2 || !(numberOfSummaryLines === 1 && !noData))
                    viewWithSummaryRenderCounts[viewId] = 0;

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
                    ktlProcessKeywords(view, data);
                } else { //When data has changed, but the functions remain the same.
                    Knack.views[viewId].ktlRenderTotals.ktlPost = ktlRenderTotals;
                    Knack.views[viewId].renderTotals = Knack.views[viewId].ktlRenderTotals.ktlPost;
                }
            } else {
                ktlProcessKeywords(view, data);
            }

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
                const sel = window.getSelection();
                sel.removeAllRanges();
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

            $('#' + viewId + ' .cell-edit').bindFirst('click', function (e) {
                if (e.target.closest('.ktlNoInlineEdit')) {
                    e.stopImmediatePropagation();
                }
            });
        })

        $(document).on('knack-form-submit.any', function (event, view, record) {
            if (ktl.scenes.isiFrameWnd()) return;

            const keywords = ktlKeywords[view.key];

            //_rcm Remove confirmation Message
            if (keywords && keywords._rcm) {
                let delayBeforeRemovingMsg = 0;
                if (keywords._rcm.length && keywords._rcm[0].params[0].length) {
                    delayBeforeRemovingMsg = Number(keywords._rcm[0].params[0]);
                    if (isNaN(delayBeforeRemovingMsg) || delayBeforeRemovingMsg < 0 || delayBeforeRemovingMsg > 3600000)
                        delayBeforeRemovingMsg = 0;
                }

                ktl.core.waitSelector(`#${view.key} .kn-form-confirmation`, 30000)
                    .then(() => {
                        setTimeout(() => {
                            $('#' + view.key + ' .kn-form-confirmation').addClass('ktlHidden');
                        }, delayBeforeRemovingMsg);
                    })
                    .catch(() => { })
            }

            //_hsr Highlight Submitted Record
            if (keywords && keywords._hsr) {
                ktl.scenes.renderViews()
                    .then(() => {
                        var rowSel = '.kn-view tr[id="' + record.id + '"]'; //Note: View ID is not included intentionnally to flash new record in all views.
                        if (!$(rowSel).length)
                            rowSel = '.kn-view tr:has(.' + record.id + ')';

                        if ($(rowSel).length) {
                            let duration = 1000;
                            let flashRate = 500;
                            let highlightColor = 'green';
                            let classes = 'ktlFlashingFadeInOut highlightedSubmittedRow';
                            let style;

                            const params = keywords._hsr[0].params;
                            for (const param of params) {
                                if (param.length) {
                                    if (param[0] === 'dr' && param.length >= 3) {
                                        duration = Number(param[1]);
                                        if (isNaN(duration) || duration < 100 || duration > 3600000)
                                            duration = 100;

                                        flashRate = Number(param[2]);
                                        if (isNaN(flashRate) || flashRate < 0 || flashRate > 50000)
                                            flashRate = 500;
                                        flashRate /= 1000;
                                    } else if (param[0] === 'clr' && param.length >= 2)
                                        highlightColor = param[1];
                                    else if (param[0] === 'cls' && param.length >= 2)
                                        classes = param.slice(1).join(' ');
                                    else if (param[0] === 'style' && param.length >= 2)
                                        style = param.slice(1).join(',');
                                }
                            }

                            ktl.views.setCfg({ ktlFlashRate: `${flashRate}s` });
                            ktl.views.setCfg({ ktlOutlineColor: highlightColor });

                            $(rowSel).addClass(classes);
                            const currentStyle = $(rowSel).attr('style');
                            $(rowSel).attr('style', (currentStyle ? currentStyle + '; ' : '') + style);

                            $(rowSel + ' td').addClass('ktlNoBgColor');
                            $(rowSel + ' td a').each((ix, el) => { el.outerHTML = ktl.fields.disableAnchor(el.outerHTML); })

                            setTimeout(() => {
                                $(rowSel).removeClass(classes);
                                $(rowSel + ' td').removeClass('ktlNoBgColor');
                                $(rowSel + ' td a-ktlnoanchor').each((ix, el) => { el.outerHTML = ktl.fields.revertToAnchor(el.outerHTML); })
                                $(rowSel).attr('style', currentStyle ? currentStyle : '');
                                ktl.views.setCfg({ ktlFlashRate: '1s' });
                            }, duration);
                        }
                    })
                    .catch(reason => {
                        ktl.log.clog('purple', 'Submit any, renderViews failure:', reason);
                    })
            }
        });

        //Process views with special keywords in their titles, fields, descriptions, etc.
        function ktlProcessKeywords(view, data) {
            if (!view || ktl.scenes.isiFrameWnd()) return;

            if (view.scene && (view.scene.key !== Knack.router.scene_view.model.attributes.key)) {
                const isLoginPage = document.querySelector('.kn-login');
                if (isLoginPage && isLoginPage.id && ktlKeywords[isLoginPage.id] && ktlKeywords[isLoginPage.id]._al) {
                    ktl.account.autoLogin(view.key);
                    return;
                }
            }

            try {
                //ktl.bulkOps.prepareBulkOps(view, data); //Must be applied before keywords to get the right column indexes.

                const viewId = view.key;
                var keywords = ktlKeywords[viewId];
                if (keywords && !$.isEmptyObject(keywords)) {
                    //This section is for keywords that are only supported by views.
                    //console.log('keywords =', JSON.stringify(keywords, null, 4));

                    //These also need to be pre-processed in the KTL.preprocessView event.
                    keywords._hc && ktl.views.hideColumns(view, keywords);
                    keywords._rc && ktl.views.removeColumns(view, keywords);
                    keywords._cls && ktl.views.addRemoveClass(viewId, keywords, data);
                    keywords._style && ktl.views.setStyle(viewId, keywords);

                    //These don't need to be pre-processed in the KTL.preprocessView event.
                    keywords._ni && ktl.views.noInlineEditing(view);
                    keywords._hv && ktl.views.hideView(viewId, keywords);
                    keywords._rv && ktl.views.removeView(viewId, keywords);
                    keywords._ht && hideTitle(viewId, keywords);
                    keywords._dr && ktl.views.numDisplayedRecords(viewId, keywords);
                    keywords._zoom && ktl.views.applyZoomLevel(viewId, keywords);
                    keywords._ts && ktl.views.addTimeStampToHeader(viewId, keywords);
                    keywords._dtp && addDateTimePickers(viewId, keywords);
                    keywords._rvs && refreshViewsAfterSubmit(viewId, keywords);
                    keywords._rvr && refreshViewsAfterRefresh(viewId, keywords);
                    keywords._nsg && noSortingOnGrid(viewId, keywords);
                    keywords._bcg && ktl.fields.barcodeGenerator(viewId, keywords, data);
                    keywords._bcr && ktl.fields.barcodeReader(viewId, keywords);
                    keywords._trk && ktl.views.truncateText(view, keywords);
                    (keywords._oln || keywords._ols) && ktl.views.openLink(viewId, keywords);
                    keywords._copy && ktl.views.copyToClipboard(viewId, keywords);
                    keywords._da && dataAlignment(view, keywords);
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
                    keywords._dv && disableView(view, keywords);
                    keywords._ro && removeOptions(view, keywords);
                    keywords._afs && autoFillAndSubmit(view, keywords);
                    keywords._afsg && autoFillAndSubmitQRGenerator(view, keywords);
                    keywords._vk && virtualKeyboard(viewId, keywords);
                    keywords._asf && autoSubmitForm(viewId, keywords);
                    keywords._rdclk && redirectClick(viewId, keywords);
                }

                //This section is for features that can be applied with or without a keyword.
                //When used without a keyword, they are controlled by a global flag.
                headerAlignment(view, keywords);

                //This section is for keywords that are supported by views and fields.
                ktl.fields.hideFields(viewId, keywords);
                quickToggle(viewId, data); //IMPORTANT: quickToggle must be processed BEFORE matchColor.
                matchColor(viewId, data);
                colorizeFieldByValue(viewId, data);
                ktl.views.obfuscateData(view, keywords);
                addTooltips(view, keywords);
                disableFilterOnFields(view);
                fieldIsRequired(view);

                const viewType = ktl.views.getViewType(viewId);
                if (viewType === 'form')
                    labelText(view, keywords);
                else {
                    //Wait for summary to complete before changing the header.  The summary needs the fields' original labels to place its values.
                    if (ktl.views.viewHasSummary(viewId)) {
                        $(document).off('KTL.' + viewId + '.totalsRendered.processKeywords').on('KTL.' + viewId + '.totalsRendered.processKeywords', () => {
                            labelText(view, keywords);
                            ktl.views.fixTableRowsAlignment(view.key);
                        })
                    } else {
                        labelText(view, keywords);
                    }
                }

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
            viewIds.shift();

            //The retries are necessary due to the latency chain: calendar > server > view being updated.
            (function tryRefresh(dndConfirmationViewId, retryCtr) {
                setTimeout(() => {
                    ktl.views.refreshView(dndConfirmationViewId).then(function (data) {
                        ktl.core.knAPI(dndConfirmationViewId, recId, {}, 'GET')
                            .then(record => {
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

                                            //Don't expect to see the API call's data in the DnD view.
                                            //It's normal that it always shows the same data, the first record found.
                                            ktl.views.refreshViewArray(viewIds)
                                                .then(() => { })
                                                .catch(() => { })
                                        }
                                    } else {
                                        if (retryCtr-- > 0) {
                                            //ktl.log.clog('purple', 'date mismatch', retryCtr);
                                            tryRefresh(dndConfirmationViewId, retryCtr);
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

            var gotoDateIso = ktl.core.convertDateToIso(gotoDateObj, period, '-');

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
            //Pause auto-refresh when on a tables's search field, or search fields in Search views.
            if (e.target.closest('.table-keyword-search') && e.target.name === 'keyword')
                ktl.views.autoRefresh(false);
            else if (e.target.closest('.kn-keyword-search, .kn-search-filter') && e.target.name === 'value')
                ktl.views.autoRefresh(false);

            var viewId = e.target.closest('.kn-view');
            viewId = viewId ? viewId.id : null;

            if (viewId && e.target.closest('#' + viewId + ' .kn-button.is-primary') && !ktl.scenes.isiFrameWnd())
                ktl.views.preprocessSubmit(viewId, e);
        })

        document.addEventListener('focusout', function (e) {
            try {
                if ((e.target.form.classList[0].includes('table-keyword-search') || e.target.form.classList[0].includes('kn-search_form')) && $.isEmptyObject(autoRefreshViews))
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

        //Hides a field from the filter's drop-down.
        let noFilteringViewFields = {};
        function disableFilterOnFields(view) {
            if (!view) return;

            if (!(view.type === 'table' || view.type === 'list'/* || view.type === 'report'    TODO Issue #242   */))
                return;

            const kw = '_nf';
            let viewId = view.key;
            var fieldsAr = [];

            //Process view keyword
            const keywords = ktlKeywords[viewId];
            if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params.length) {
                let canBeProcessed = false;

                if (keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (ktl.core.hasRoleAccess(options))
                        canBeProcessed = true;
                } else
                    canBeProcessed = true;

                if (canBeProcessed && keywords[kw][0].params && keywords[kw][0].params.length)
                    fieldsAr = keywords[kw][0].params[0];
            }

            //Process fields keywords
            var fieldsWithKwObj;
            if (Knack.views[viewId].model.view.filter_fields === 'view')
                fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
            else { //object
                const objectId = Knack.views[viewId].model.view.source.object;
                fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInObject(objectId);
            }

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
                                if (ktl.core.hasRoleAccess(options) && !fieldsAr.includes(fieldId))
                                    fieldsAr.push(fieldId);
                            } else if (!fieldsAr.includes(fieldId))
                                fieldsAr.push(fieldId);
                        }
                    }
                }
            }

            fieldsAr = fieldsAr.map(field =>
                field.startsWith('field_') ? field : ktl.fields.getFieldIdFromLabel(viewId, field)
            );

            noFilteringViewFields[viewId] = { fieldsAr: fieldsAr };

            $(`#${viewId} .kn-add-filter, #${viewId} .kn-filters`).on('mousedown', function (e) {
                noFilteringRemoveFields(viewId);

                ktl.core.waitSelector('#add-filter-link', 3000)
                    .then(function () {
                        $(`#add-filter-link`).on('mousedown', function (e) {
                            noFilteringRemoveFields(viewId);
                        })
                    })
                    .catch(function () { })

            })

            function noFilteringRemoveFields(viewId) {
                const fieldsAr = noFilteringViewFields[viewId].fieldsAr;
                for (const fieldId of fieldsAr) {
                    const fieldSelector = `.field.kn-select select option[value="${fieldId}"]`;
                    ktl.core.waitSelector(fieldSelector, 3000)
                        .then(function () {
                            $(fieldSelector).remove();
                        })
                        .catch(function () { })
                }
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
                            .then(() => { })
                            .catch(() => { })
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
                        .then(() => { })
                        .catch(() => { })
            }
        }

        function readSummaryValues(viewId) {
            if (!viewId) return;

            ktl.views.fixTableRowsAlignment(viewId)
                .then(() => {
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

                    $(document).trigger('KTL.' + viewId + '.totalsRendered');
                })
        }

        function readSummaryValue(viewTitleOrId, columnHeader, summaryName) {
            if (!viewTitleOrId || !columnHeader || !summaryName) return;

            var viewId = viewTitleOrId.startsWith('view_') ? viewTitleOrId : ktl.core.getViewIdByTitle(viewTitleOrId);
            var summaryObj = ktlKeywords[viewId] && ktlKeywords[viewId].summary;
            if (!$.isEmptyObject(summaryObj) && summaryObj[summaryName])
                return summaryObj[summaryName][columnHeader];
        }


        function addTooltips(view, keywords) {
            const kw = '_ttip';// @params = [tooltip text], [options] - Must be in two groups so that commas can be used in the tooltip text, options are tdfl (table, details, forms and lists)
            const { key: viewId, type: viewType } = view;
            if (!viewId) return;

            //Process fields keyword
            var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
            if (!$.isEmptyObject(fieldsWithKwObj)) {
                var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                var foundKwObj = {};
                for (var i = 0; i < fieldsWithKwAr.length; i++) {
                    fieldId = fieldsWithKwAr[i];
                    ktl.fields.getFieldKeywords(fieldId, foundKwObj);
                    if (!$.isEmptyObject(foundKwObj) && foundKwObj[fieldId]) {
                        ktl.core.getKeywordsByType(fieldId, kw).forEach(execFieldKw);
                    }
                }
            }

            function execFieldKw(keyword) {
                if (!ktl.core.hasRoleAccess(keyword.options)) return;
                const paramGroups = keyword.params;
                if (paramGroups.length < 2 && paramGroups.length % 2 != 0) return; // Check if the number of parameter groups is even

                const tooltipPositions = {
                    f: viewType === 'form' ? `#${viewId} #kn-input-${fieldId} > label` : null,
                    t: viewType === 'table' ? `#${viewId} th.${fieldId}` : null,
                    l: viewType === 'list' ? `#${viewId} .${fieldId} .kn-detail-label` : null,
                    d: viewType === 'details' ? `#${viewId} .${fieldId} .kn-detail-label` : null
                };

                for (let i = 0; i < paramGroups.length; i += 2) {
                    const [firstParam, [viewOptionTxt, ttipIcon]] = paramGroups.slice(i, i + 2);
                    const ttipText = firstParam.map(item => item.trim()).join(', ');
                    const tooltipIcon = ttipIcon || 'fa-question-circle';

                    ['f', 'l', 'd', 't'].forEach(option => {
                        if (viewOptionTxt.includes(option) && tooltipPositions[option]) {
                            ktl.views.addTooltipsToFields(viewId, ttipText, viewType, tooltipPositions[option], tooltipIcon);
                        }
                    });
                }
            }

            //Process view keyword
            if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                const kwList = ktl.core.getKeywordsByType(viewId, kw);
                for (var kwIdx = 0; kwIdx < kwList.length; kwIdx++) {
                    execKw(kwList[kwIdx]);
                }

                function execKw(kwInstance) {
                    const options = kwInstance.options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    const paramGroups = kwInstance.params;
                    if (paramGroups.length < 2 && paramGroups.length % 2 != 0) return; // Check if the number of parameter groups is even

                    const tooltipIconPositions = [];
                    for (let i = 0; i < paramGroups.length; i += 2) {
                        const [firstParam, [fieldLabel, ttipIcon]] = paramGroups.slice(i, i + 2);
                        const ttipText = firstParam.map(item => item.trim()).join(', ');
                        fieldId = ktl.fields.getFieldIdFromLabel(viewId, fieldLabel);
                        const tooltipIcon = ttipIcon || 'fa-question-circle';

                        let tooltipIconPosition;
                        const viewSelector = `#${viewId}`;

                        switch (viewType) {
                            case 'form':
                                tooltipIconPosition = `${viewSelector} #kn-input-${fieldId} > label`;
                                break;
                            case 'search':
                            case 'table':
                                if (fieldId) {
                                    tooltipIconPosition = `${viewSelector} th.${fieldId}`;
                                } else {
                                    const selectors = [
                                        `${viewSelector} th.kn-table-link:textEquals("${fieldLabel}")`,
                                        `${viewSelector} th.kn-table-action-link:textEquals("${fieldLabel}")`
                                    ];
                                    selectors.forEach(selector => {
                                        if ($(selector).length) {
                                            tooltipIconPosition = selector;
                                        }
                                    });
                                }
                                break;
                            case 'list':
                            case 'details':
                                tooltipIconPosition = fieldId ? `${viewSelector} .${fieldId} .kn-detail-label` : `${viewSelector} .kn-details-link .kn-detail-body:textEquals("${fieldLabel}")`;
                                break;
                        }
                        tooltipIconPositions.push({ position: tooltipIconPosition, text: ttipText, icon: tooltipIcon });
                    }

                    tooltipIconPositions.forEach(({ position, text, icon }) => {
                        if ($(position).length) ktl.views.addTooltipsToFields(viewId, text, viewType, position, icon);
                    });
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
                { operation: 'bulkAction', role: 'Bulk Action' },
            ];

            const userRoles = Knack.getUserRoleNames();
            for (const op of bulkOps) {
                if (ktl.core.getCfg().enabled.bulkOps[op.operation] && userRoles.includes(op.role)) {
                    return true;
                }
            }
            return false;
        }

        function disableView(view, keywords) {
            const kw = '_dv';
            if (!keywords[kw]) return;

            const { key: viewId, type: viewType, columns } = view;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (viewType === 'table' || viewType === 'search') {
                columns.forEach(column => {
                    const selector = `#${viewId} tbody td`;

                    if (column.type === 'field') {
                        $(`${selector}.${column.field.key}`).addClass('ktlNoInlineEdit');
                    }
                    else {
                        $(selector).find('a').removeAttr('href').addClass('ktlLinkDisabled');
                    }
                });

                $(document).on('KTL.BulkOperation.Updated', () => {
                    $(`#${viewId} .bulkEditCb`).attr('disabled', 'disabled');
                });
            } else {
                let elementSelector;
                if (viewType === 'details' || viewType === 'list') {
                    elementSelector = `#${viewId} .kn-detail-body`;
                } else if (viewType === 'form') {
                    elementSelector = `#${viewId} .kn-input`;
                } else if (viewType === 'menu') {
                    elementSelector = `#${viewId} li`;
                }

                const elements = $(elementSelector);

                elements.find('a').removeAttr('href').addClass('ktlLinkDisabled');
                elements.find('.redactor-editor').attr('contenteditable', 'false');

                //one('KTL.convertNumToTel' is necessary in case we call sceneConvertNumToTel more than once.
                elements.find('input').attr('disabled', 'disabled').one('KTL.convertNumToTel', function (event, newField) {
                    newField.attr('disabled', 'disabled');
                })

                elements.find('select').attr('disabled', 'disabled');
                elements.find('textarea').attr('disabled', 'disabled');
                elements.find('.rateit').rateit('readonly', true);
                elements.filter('.kn-input-signature').css('pointer-events', 'none');

                if (viewType === 'form') {
                    $(document).one('KTL.persistentForm.completed.scene', () => {
                        // Persistent Form is adding and removing the attribute during its process
                        $(`#${viewId} .kn-button`).attr('disabled', 'disabled');
                        ktl.scenes.spinnerWatchdog(false); //Don't let the disabled Submit cause a page reload.
                    });
                }
            }

            $(`#${viewId} .kn-button`).attr('disabled', 'disabled');
            ktl.scenes.spinnerWatchdog(false); //Don't let the disabled Submit cause a page reload.
        }

        function removeOptions(view, keywords) {
            const kw = '_ro';

            const { key: viewId } = view;
            if (!viewId) return;

            //Process view keyword
            if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                const promises = ktl.core.getKeywordsByType(viewId, kw).map((keyword) => {
                    if (ktl.core.hasRoleAccess(keyword.options)) {
                        return processViewRemoveOption(keyword);
                    }
                    return Promise.resolve();
                });

                Promise.all(promises).then(() => {
                    $('#' + viewId).removeClass('ktlHidden_ro');
                });
            }

            async function processViewRemoveOption({ params, options }) {
                return ktl.views.validateKtlCond(options, recordObj = {}, viewId)
                    .then(valid => {
                        if (!valid) return;

                        const [fieldLabel, ...optionsToRemove] = params[0];
                        let fieldId = fieldLabel.startsWith('field_') ? fieldLabel : ktl.fields.getFieldIdFromLabel(viewId, fieldLabel);

                        if (!fieldId) return;

                        const fieldType = ktl.fields.getFieldType(fieldId);
                        const fieldFormat = Knack.objects.getField(fieldId).attributes.format;

                        let isOptionBased = false;
                        let selector;

                        const isMultipleChoice = fieldType === 'multiple_choice';
                        const isConnection = fieldType === 'connection';
                        const isBoolean = fieldType === 'boolean';

                        const formatType = fieldFormat && fieldFormat.type;
                        const formatInput = fieldFormat && fieldFormat.input;

                        if ((isMultipleChoice && ['single', 'multi'].includes(formatType)) || isConnection) {
                            selector = $(`#${viewId}-${fieldId}`).find('option');
                            isOptionBased = true;
                        }
                        else if (isMultipleChoice && ['checkboxes', 'radios'].includes(formatType)) {
                            selector = $(`#${viewId} #kn-input-${fieldId}`).find('input');
                        }
                        else if (isBoolean && ['dropdown'].includes(formatInput)) {
                            selector = $(`#${viewId} #${fieldId}`).find('option');
                            isOptionBased = true;
                        }
                        else if (isBoolean && ['radios', 'checkbox'].includes(formatInput)) {
                            selector = $(`#${viewId} #kn-input-${fieldId}`).find('input');
                        }

                        if (!selector) return;

                        $(selector).each(function () {
                            const option = $(this);
                            const optionText = isOptionBased ? option.text().trim() : option.val().trim();
                            if (!optionsToRemove.includes(optionText)) return;

                            if (isOptionBased) {
                                option.remove();
                                selector.trigger('liszt:updated');
                            } else {
                                option.closest('.control').remove();
                            }
                        });
                    });
            }
        }

        function labelText({ key: viewId, type: viewType }, keywords) {
            const kw = '_lbl';// @params = [label text], [options] OR @params = label text
            if (!viewId && !keywords[kw]) return;

            var fieldsWithKwObj = ktl.views.getAllFieldsWithKeywordsInView(viewId);
            if (!$.isEmptyObject(fieldsWithKwObj)) {
                var fieldsWithKwAr = Object.keys(fieldsWithKwObj);
                var foundKwObj = {};
                for (var i = 0; i < fieldsWithKwAr.length; i++) {
                    fieldId = fieldsWithKwAr[i];
                    ktl.fields.getFieldKeywords(fieldId, foundKwObj);
                    if (!$.isEmptyObject(foundKwObj) && foundKwObj[fieldId])
                        ktl.core.getKeywordsByType(fieldId, kw).forEach(execFieldKw);
                }
            }

            function execFieldKw({ params }) {
                const selectors = {
                    form: `#${viewId} #kn-input-${fieldId} .kn-label span:not(.kn-required)`,
                    details: `#${viewId} .${fieldId} .kn-detail-label span`,
                    list: `#${viewId} .${fieldId} .kn-detail-label span`,
                    table: `#${viewId} th.${fieldId} span span:not(span.icon)`
                };

                let labelTxt = params[0].join(', ');
                let selector = selectors[viewType];

                if (params.length === 2) {
                    let applyToViewTypes = params[1];
                    if (applyToViewTypes[0].includes(viewType[0]))
                        selector = selectors[viewType];
                    else
                        selector = '';
                }

                selector && $(selector).text(labelTxt);
            }
        }

        /////////////////////////////////////////////////////////////////////////////////
        function colorizeFieldByValue(viewId, data) {
            const CFV_KEYWORD = '_cfv';

            if (!viewId)
                return;

            const viewType = ktl.views.getViewType(viewId);
            if (viewType !== 'table' && viewType !== 'list' && viewType !== 'details')
                return;

            //Begin with field _cfv.
            colorizeFromFieldKeyword();

            //Then end with view _cfv, for precedence.
            ktl.core.getKeywordsByType(viewId, CFV_KEYWORD).forEach(execKw);

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
                        fieldIds = Knack.views[viewId].model.view.fields.filter(f => !!f).map((f) => f.key);
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

                    if (options.ktlRefVal.endsWith(','))
                        options.ktlRefVal = options.ktlRefVal.replace(',', '');

                    const ktlRefValSplit = ktl.core.splitAndTrimToArray(options.ktlRefVal) || [''];

                    if ((ktlRefValSplit.length === 1 && !ktlRefValSplit[0]) ||
                        (ktlRefValSplit.length === 2 && (!ktlRefValSplit[0] || !ktlRefValSplit[1]))) {
                        ktl.log.clog('purple', `Called _cfv with invalid ktlTarget parameters in ${viewId}`);
                        return;
                    }

                    if (ktlRefValSplit.length === 2 && ktlRefValSplit[0] && ktlRefValSplit[1]) {
                        const referenceViewId = ktl.scenes.findViewWithTitle(ktlRefValSplit[1]);
                        if (referenceViewId && referenceViewId !== viewId/*prevent looping if ref view is provided and same as this view*/) {
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
                            if (rawData !== undefined) {
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
                            if (!refVal && options && options.ktlRefVal) {
                                if (options.ktlRefVal.startsWith('field_'))
                                    value = options.ktlRefVal;
                                else
                                    value = ktl.fields.getFieldIdFromLabel(viewId, options.ktlRefVal);
                            }

                            //When value is a reference field in same view. Only true for view keyword, n/a for fields.
                            if (value && value.startsWith('field_')) {
                                let valSel;

                                if (viewType === 'list')
                                    valSel = $('#' + viewId + ' [data-record-id="' + recordObj.id + '"]' + ' .kn-detail-body .' + value);
                                else
                                    valSel = $('#' + viewId + ' tbody tr[id="' + recordObj.id + '"]' + ' .' + value);

                                if (valSel.length) {
                                    refVal = valSel[0].textContent.trim();

                                    let cellText;
                                    const fieldType = ktl.fields.getFieldType(value);

                                    const rawData = recordObj[`${value}_raw`];
                                    if (rawData !== undefined) {
                                        if (Array.isArray(rawData) && rawData.length > 0)
                                            cellText = rawData.flat().map(obj => (obj.identifier || obj)).join(' ');
                                        else if (fieldType === 'phone')
                                            cellText = rawData.formatted;
                                        else if (fieldType === 'boolean') {
                                            const format = Knack.objects.getField(value).attributes.format.format;
                                            if (format === 'yes_no')
                                                cellText = (rawData === true ? 'Yes' : 'No');
                                            else if (format === 'on_off')
                                                cellText = (rawData === true ? 'On' : 'Off');
                                            else
                                                cellText = (rawData === true ? 'True' : 'False');
                                        } else
                                            cellText = rawData.toString();

                                        if (cellText !== '' && numericFieldTypes.includes(fieldType))
                                            cellText = ktl.core.extractNumericValue(cellText, value);

                                        refVal = cellText;
                                    }
                                }
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

                    let fgColor = parameter[3];

                    let bgColor;
                    if (parameter.length >= 5)
                        bgColor = parameter[4];

                    let span = '';
                    let propagate = false; //Propagate style to whole row.
                    let hide = false;
                    let remove = false;
                    let suppress = false;
                    let flash = false;
                    let flashFade = false;

                    let style = (fgColor ? 'color: ' + fgColor + '!important; ' : '') + (bgColor ? 'background-color: ' + bgColor + '!important; ' : '');

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
                        } else if (parameter[6].includes('s')) {
                            suppress = true;
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
                    let targetFieldId = fieldId;
                    let targetViewId;
                    let targetSel;

                    if (options && options.ktlTarget) {
                        let colNb;
                        const isJQueryTarget = ktl.core.extractJQuerySelector(options.ktlTarget, viewId);
                        if (isJQueryTarget)
                            targetSel = isJQueryTarget;
                        else {
                            const ktlTarget = ktl.core.splitAndTrimToArray(options.ktlTarget);

                            //Search parameters to see if we can find a targetViewId.
                            for (let i = 0; i < ktlTarget.length; i++) {
                                if (ktlTarget[i].startsWith('view_')) {
                                    targetViewId = ktlTarget[i];
                                    break;
                                }
                            }

                            //No direct view_id, let's try last param and search by view title.
                            let tryViewId;
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
                            else if (suppress) {
                                function cleanupGroupAfterRowRemoval(tableRow) {
                                    var $currentRow = $(tableRow);
                                    var $group = $currentRow.prevAll('.kn-table-group').first(); // Find the closest preceding group
                                    var $nextSibling = $currentRow.next('tr'); // Get the next sibling row

                                    $currentRow.remove();

                                    // Check if the next sibling is a group or if the group has no more rows with IDs
                                    if ($nextSibling.hasClass('kn-table-group') || $group.nextUntil('.kn-table-group', 'tr[id]').length === 0) {
                                        // Remove the group and its totals row
                                        $group.next('.kn-table-totals').remove();
                                        $group.remove();
                                    }
                                }

                                cleanupGroupAfterRowRemoval($(targetSel).closest('tr'));

                                const newCount = $(`#${targetViewId} tbody tr:not(.kn-table-group):not(.kn-table-totals)`).length;

                                var div = document.querySelector('#' + targetViewId + ' .kn-entries-summary');
                                if (div && div.childNodes.length >= 3)
                                    div.childNodes[2].nodeValue = ` 1-${newCount} `;

                                if (div && div.childNodes.length >= 5) {
                                    if (Knack.views[viewId].model.view.pagination_meta.total_entries < Knack.views[viewId].model.view.pagination_meta.rows_per_page
                                        && Knack.views[viewId].model.view.pagination_meta.total_entries > newCount)
                                        div.childNodes[4].nodeValue = ` ${newCount}\n`;
                                }

                                if (ktl.views.viewHasSummary(viewId)) {
                                    Knack.views[viewId].renderTotals();
                                }
                            } else if (hide) {
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
            //The refValSelString parameter can be a summary, or a fixed field/view value from a details view.
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
            let kwInstance = ktlKeywords[viewId] && ktlKeywords[viewId][kw];
            if (kwInstance && kwInstance.length) {
                kwInstance = kwInstance[0];
                const { options } = kwInstance;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            let qtScanItv = null;
            let quickToggleObj = {};
            let numToProcess = 0;
            let refreshTimer = null;
            let viewsToRefresh = [];
            const viewModel = Knack.router.scene_view.model.views._byId[viewId];
            if (!viewModel) return;

            const viewAttr = viewModel.attributes;
            const { type: viewType } = viewAttr;
            if (!['table', 'search'].includes(viewType)) return;

            const inlineEditing = viewType === 'table' ? (viewAttr.options && viewAttr.options.cell_editor) : viewAttr.cell_editor;
            // Start with hard coded default colors.
            let bgColorTrue = quickToggleParams.bgColorTrue;
            let bgColorFalse = quickToggleParams.bgColorFalse;

            let viewHasQt = false;
            // Override with view-specific colors, if any.
            if (kwInstance) {
                viewHasQt = true; // If view has QT, then all fields inherit also.

                if (kwInstance.params && kwInstance.params.length) {
                    const fldColors = kwInstance.params[0];
                    if (fldColors.length >= 1 && fldColors[0])
                        bgColorTrue = fldColors[0];

                    if (fldColors.length >= 2 && fldColors[1])
                        bgColorFalse = fldColors[1];
                }
            }

            let fieldKeywords = {};
            let fieldsColor = {};
            const cols = viewType === 'table' ? viewAttr.columns : viewAttr.results.columns;
            cols.forEach(col => {
                if (col.type === 'field' && col.field && col.field.key) {
                    const field = Knack.objects.getField(col.field.key);
                    if (field && !col.connection) { // Field must be local to view's object, not a connected field.
                        if (field.attributes.type === 'boolean') {
                            let fieldHasQt = false;
                            const { key: fieldId } = col.field;

                            // Override with field-specific colors, if any.
                            let tmpFieldColors = {
                                bgColorTrue: bgColorTrue,
                                bgColorFalse: bgColorFalse
                            }

                            ktl.fields.getFieldKeywords(fieldId, fieldKeywords);
                            const fieldKeyword = fieldKeywords[fieldId] && fieldKeywords[fieldId][kw];
                            if (viewHasQt || fieldKeyword) {
                                fieldHasQt = true;
                                if (fieldKeyword && fieldKeyword.length && fieldKeyword[0].params && fieldKeyword[0].params.length > 0) {
                                    const fldColors = fieldKeyword[0].params[0];
                                    if (fldColors.length >= 1 && fldColors[0] !== '')
                                        tmpFieldColors.bgColorTrue = fldColors[0];
                                    if (fldColors.length >= 2 && fldColors[1] !== '')
                                        tmpFieldColors.bgColorFalse = fldColors[1];
                                }
                            }

                            if (fieldHasQt) {
                                fieldsColor[fieldId] = tmpFieldColors;
                                if (inlineEditing && !col.ignore_edit)
                                    $(`#${viewId} td.${fieldId}.cell-edit`).addClass('qtCellClickable');
                            }
                        }
                    }
                }
            });

            // Update table colors
            if (!$.isEmptyObject(fieldsColor)) {
                data.forEach(row => {
                    Object.keys(fieldsColor).forEach(fieldId => {
                        // Merge new style with existing one.
                        const cell = $(`#${viewId} tbody tr[id="${row.id}"] .${fieldId}`);
                        const currentStyle = cell.attr('style');
                        const style = `background-color:${row[fieldId + '_raw'] === true ? fieldsColor[fieldId].bgColorTrue : fieldsColor[fieldId].bgColorFalse}`;
                        cell.attr('style', `${currentStyle ? currentStyle + '; ' : ''}${style}`);
                    });
                });
            }

            //Process cell clicks.
            $(`#${viewId} .qtCellClickable`).bindFirst('click', e => {
                if ($('.bulkEditCb:checked').length) return;

                e.stopImmediatePropagation();

                const fieldId = $(e.target).data('field-key') || $(e.target).parent().data('field-key');
                const viewElement = $(e.target).closest('.kn-search.kn-view[id], .kn-table.kn-view[id]');
                if (viewElement.length) {
                    const viewId = viewElement.attr('id');

                    const dt = Date.now();
                    const recId = $(e.target).closest('tr').attr('id');
                    let value = ktl.views.getDataFromRecId(viewId, recId)[`${fieldId}_raw`];
                    value = (value === true ? false : true);
                    if (!viewsToRefresh.includes(viewId))
                        viewsToRefresh.push(viewId);

                    quickToggleObj[dt] = { viewId, fieldId, value, recId, processed: false };
                    const cell = $(e.target).closest('td');
                    cell.css('background-color', quickToggleParams.bgColorPending); //Visual cue that the process is started.
                    if (quickToggleParams.pendingClass) {
                        cell.addClass(quickToggleParams.pendingClass);
                    }
                    clearTimeout(refreshTimer);

                    numToProcess++;
                    startQtScanning();
                }
            });

            function startQtScanning() {
                if (quickToggleParams.showNotification) {
                    ktl.core.infoPopup();
                    showProgress();
                }

                if (qtScanItv) return;
                ktl.views.autoRefresh(false);
                qtScanItv = setInterval(() => {
                    if (!$.isEmptyObject(quickToggleObj)) {
                        const dt = Object.keys(quickToggleObj)[0];
                        const { processed } = quickToggleObj[dt];
                        if (!processed) {
                            quickToggleObj[dt].processed = true;
                            doQuickToggle(dt);
                        }
                    }
                }, 500);
            }

            function doQuickToggle(dt) {
                const recObj = quickToggleObj[dt];
                if ($.isEmptyObject(recObj) || !recObj.viewId || !recObj.fieldId) return;

                const apiData = { [recObj.fieldId]: recObj.value };
                ktl.core.knAPI(recObj.viewId, recObj.recId, apiData, 'PUT', [], false /*must be false otherwise spinner blocks click events*/)
                    .then(() => {
                        if (quickToggleParams.showNotification) {
                            showProgress();
                        }
                        numToProcess--;
                        delete quickToggleObj[dt];
                        if ($.isEmptyObject(quickToggleObj)) {
                            clearInterval(qtScanItv);
                            qtScanItv = null;
                            if (quickToggleParams.showSpinner) {
                                Knack.showSpinner();
                            }
                            refreshTimer = setTimeout(() => {
                                ktl.core.removeInfoPopup();
                                ktl.views.refreshViewArray(viewsToRefresh)
                                    .then(() => {
                                        Knack.hideSpinner();
                                        ktl.views.autoRefresh();
                                    })
                                    .catch(() => { })
                            }, 500);
                        }
                    })
                    .catch(reason => {
                        ktl.views.autoRefresh();
                        alert(`Error code KEC_1025 while processing Quick Toggle operation, reason: ${JSON.stringify(reason)}`);
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

            const headerToMatch = toMatch.startsWith('field_') ? ktl.fields.getFieldLabelFromId(viewId, toMatch) : toMatch;
            let columnIndex = ktl.views.getColumnIndex(viewId, headerToMatch);

            if (columnIndex >= 0) {
                data.forEach(row => {
                    var referenceCell = document.querySelector(`#${viewId} tbody tr[id="${row.id}"] td:nth-child(${columnIndex + 1})`).closest('td');
                    if (referenceCell) {
                        const bgColor = referenceCell.style.backgroundColor;
                        referenceCell.style.backgroundColor = ''; //Need to remove current bg color to prevent conflict.
                        $(`#${viewId} tbody tr[id="${row.id}"]`).css('background-color', bgColor);
                    }
                })
            } else {
                ktl.log.clog('purple', `Warning! Column ${toMatch} not found (or grouped) in ${viewId}`);
            }
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
            if (!view) return;

            const kw = '_ha';

            if (!cfg.headerAlignment) {
                if (!keywords || (keywords && !keywords[kw])) return;

                if (keywords[kw].length && keywords[kw][0].options) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;
                }
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

        function dataAlignment(view, keywords) {
            const kw = '_da';
            if (!view || !keywords || (keywords && !keywords[kw])) return;

            if (keywords[kw][0].params.length < 1) return;
            const alignment = keywords[kw][0].params[0][0];
            if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            const viewType = view.type;

            if (viewType === 'details') {
                const fields = keywords[kw][0].params[0].slice(1);
                if (fields.length) {
                    for (const field of fields) {
                        let fieldId = field;
                        if (!field.startsWith('field_'))
                            fieldId = ktl.fields.getFieldIdFromLabel(view.key, field);

                        $(`#${view.key} .${fieldId} .kn-detail-body`).css('text-align', alignment);
                    }
                } else
                    $(`#${view.key} .kn-detail-body`).css('text-align', alignment);
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
                const numParents = keywords[kw][0].params[0][0] || 1;
                if (isNaN(numParents) || numParents < 1 || numParents > 10) {
                    ktl.log.clog('purple', `_parent has an illegal level value: ${numParents} in ${viewId}.  Value must be between 1 and 10.`);
                    return;
                }

                if (viewType === 'form') {
                    $(document).bindFirst('knack-form-submit.' + viewId, () => {
                        const url = ktl.core.findParentURL(window.location.href, numParents);
                        url && (window.location.href = url);
                    })
                } else if (viewType === 'menu') {
                    const buttonLabel = keywords[kw][0].params[0][1] || 'Go Back';

                    ktl.systemColors.getSystemColors()
                        .then((sc) => {
                            const sysColors = sc;
                            var gotoParentBtn = ktl.fields.addButton(document.querySelector('#' + viewId + ' .menu-links__list'), buttonLabel, `color:${sysColors.links.rgb}`, ['menu-links__list-item', 'knMenuLink', 'knMenuLink--button', 'knMenuLink--filled', 'knMenuLink--size-medium'], 'ktlGotoParent-' + viewId);
                            gotoParentBtn.addEventListener('click', function (e) {
                                const url = ktl.core.findParentURL(window.location.href, numParents);
                                url && (window.location.href = url);
                            })
                        })
                }
            }
        }

        const vrdCurrentlySelectedRows = {};
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
                            $(`#${viewId} td`).bindFirst('click.ktl_vrd', processVrd);

                            function processVrd(e) {
                                const clickedViewId = $(e.target).closest('.kn-view[id]').attr('id');
                                if (clickedViewId && clickedViewId === viewId) {
                                    const clickedObj = e.target.closest('tr') || e.target.closest('[data-record-id]');
                                    const recId = (clickedObj && clickedObj.id);
                                    if (recId) {
                                        if (recId !== vrdCurrentlySelectedRows[viewId]) {
                                            //Do not allow Inline Editing or opening links. Wait for next click, when row is selected.
                                            e.preventDefault();
                                            e.stopImmediatePropagation();

                                            fieldIdToSearch = ktl.fields.getFieldIdFromLabel(viewId, fieldToSearch);
                                            if (fieldIdToSearch) {
                                                const textToSearch = document.querySelector(`#${clickedViewId} tr[id="${recId}"] .${fieldIdToSearch}`).innerText;
                                                $(`#${viewIdToSearch}-search input`).val(textToSearch);
                                                $(`#${viewIdToSearch} .is-primary`).click();

                                                $(`#${viewId} td`).off('click.ktl_vrd');
                                                $(`#${viewId} td`).bindFirst('click.ktl_vrd', processVrd);

                                                $(document).on(`knack-view-render.${viewIdToSearch}`, function (event, view, data) {
                                                    $(`#${viewIdToSearch}`).removeClass('ktlHidden');

                                                    //Remove any similar rows, ex: two persons with same name. Keep only the row with same recId.
                                                    $(`#${viewIdToSearch} tbody tr:not([id="${recId}"])`).remove();
                                                    $(document).off(`knack-view-render.${viewIdToSearch}`);

                                                    $(`#${clickedViewId} .ktlOutline`).removeClass('ktlOutline');
                                                    $(clickedObj).addClass('ktlOutline');
                                                    vrdCurrentlySelectedRows[viewId] = recId;
                                                });
                                            }
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
        const clickCurrentlyRunning = {
            actionLinkText: '',
            buttonId: '',
            buttonLabel: '',
            lastRecIdProcessed: '',
        };

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
                    startButton = ktl.fields.addButton(ktlAddonsDiv, buttonLabel, '', ['kn-button', 'ktlButtonMargin'], `ktlAutoClick_${viewId}-${buttonId}`);

                    if (document.querySelector(`#${viewId} .kn-tr-nodata`)) //Do not use !data.length because it will fail with Search views.
                        $(`#${viewId} [id^=ktlAutoClick_]`).attr('disabled', true);
                    else
                        $(`#${viewId} [id^=ktlAutoClick_]`).attr('disabled', false);

                    if (clickCurrentlyRunning.buttonId === startButton.getAttribute('id')) {
                        const runningButton = $(`#${viewId} #${clickCurrentlyRunning.buttonId}`);
                        if (runningButton.length)
                            runningButton[0].textContent = clickCurrentlyRunning.buttonLabel + ' - STOP';

                        doClick();
                    }

                    $(startButton).off('click').on('click', e => {
                        if (!clickCurrentlyRunning.actionLinkText) {
                            if (needConfirm) {
                                if (confirm(`Proceed with auto-click on ${actionLinkText}?`)) {
                                    clickCurrentlyRunning.actionLinkText = actionLinkText;
                                    clickCurrentlyRunning.buttonId = startButton.id;
                                    clickCurrentlyRunning.buttonLabel = buttonLabel;
                                }
                            } else {
                                clickCurrentlyRunning.actionLinkText = actionLinkText;
                                clickCurrentlyRunning.buttonId = startButton.id;
                                clickCurrentlyRunning.buttonLabel = buttonLabel;
                            }

                            doClick();
                        } else {
                            //A command is already running, user clicked to stop it.
                            if (clickCurrentlyRunning.buttonId) {
                                const runningButton = $(`#${viewId} #${clickCurrentlyRunning.buttonId}`);
                                if (runningButton.length) {
                                    runningButton[0].textContent = clickCurrentlyRunning.buttonLabel + ' - STOPPING...';
                                    runningButton[0].disabled = true;
                                    clickCurrentlyRunning.actionLinkText = '';
                                    clickCurrentlyRunning.buttonId = '';

                                    ktl.core.waitSelector('#toast-container', 20000, 'none')
                                        .then(function () { })
                                        .catch(function () { })
                                        .finally(() => {
                                            runningButton[0].textContent = clickCurrentlyRunning.buttonLabel;
                                            resetState();
                                        })
                                }
                            }
                        }
                    })
                } else { //No button
                    //Is there a link to click at all?
                    const firstLink = !!$(`#${viewId} .kn-action-link:textEquals("${actionLinkText}"), #${viewId} .knViewLink__label:textEquals("${actionLinkText}")`).length;
                    if (!firstLink) {
                        resetState();
                        return;
                    }

                    if (needConfirm) {
                        if (confirm(`Proceed with auto-click on ${actionLinkText}?`)) {
                            clickCurrentlyRunning.actionLinkText = actionLinkText;
                            doClick();
                        }
                    } else {
                        clickCurrentlyRunning.actionLinkText = actionLinkText;
                        doClick();
                    }
                }

                function doClick() {
                    setTimeout(() => { //Leave some time to apply any other keyword that might hide the link.  TODO: find better method.
                        ktl.core.waitSelector(`#${viewId} tbody`, 15000) //Needed for Search views, due to delay rendering.
                            .then(function () {
                                //if (document.querySelectorAll(`#${viewId} tbody tr`).length nodata) { //Do not use data.length!  Will give zero for Searches.
                                if (!document.querySelector(`#${viewId} .kn-tr-nodata`)) { //Do not use data.length!  Will give zero for Searches.
                                    //Pause autoRefresh because this keyword will automatically refresh the view.
                                    //Otherwise, we get conflicting refreshes.
                                    ktl.views.pauseAutoRefreshForView(viewId);

                                    //Disable all buttons except the one running.
                                    if (clickCurrentlyRunning.buttonId) {
                                        $(`#${viewId} [id^=ktlAutoClick_]`).attr('disabled', true);
                                        $(`#${viewId} #${clickCurrentlyRunning.buttonId}`).attr('disabled', false);
                                    }

                                    let linkSelector;

                                    if (clickCurrentlyRunning.actionLinkText) {
                                        linkSelector = $(`#${viewId} .kn-action-link:textEquals("${clickCurrentlyRunning.actionLinkText}"), #${viewId} .knViewLink__label:textEquals("${clickCurrentlyRunning.actionLinkText}")`);

                                        if (linkSelector.length) {
                                            const recId = linkSelector[0].closest('tr').id;
                                            if (recId !== clickCurrentlyRunning.lastRecIdProcessed) {
                                                const outlineElement = linkSelector.closest('.kn-table-link');
                                                outlineElement.addClass('ktlOutline');
                                                clickCurrentlyRunning.lastRecIdProcessed = recId;
                                                linkSelector[0].click();
                                            } else
                                                return; //If last clicked record is still there, exit and wait for next refresh.
                                        } else {
                                            //Nothing else to click: job completed.
                                            if (ktl.account.isDeveloper())
                                                ktl.log.clog('green', 'Auto-click completed!');

                                            if (clickCurrentlyRunning.buttonId) {
                                                const runningButton = $(`#${viewId} #${clickCurrentlyRunning.buttonId}`);
                                                if (runningButton.length)
                                                    runningButton[0].textContent = clickCurrentlyRunning.buttonLabel;
                                            }

                                            resetState();
                                        }
                                    }
                                } else {
                                    clickCurrentlyRunning.lastRecIdProcessed = '';
                                    clickCurrentlyRunning.actionLinkText = '';

                                    //No data, exit and let autoRefresh do it's job, until some data is found - applies to auto mode.
                                    ktl.views.runAutoRefreshForView(viewId);
                                    return;
                                }
                            })
                            .catch(function (err) {
                                ktl.log.clog('purple', 'Timeout waiting for grid in Auto Click', viewId, err);
                                if (clickCurrentlyRunning.buttonId) {
                                    const runningButton = $(`#${viewId} #${clickCurrentlyRunning.buttonId}`);
                                    if (runningButton.length)
                                        runningButton.click();
                                }
                            })
                    }, 1000);
                }
            }

            function resetState() {
                clickCurrentlyRunning.actionLinkText = '';
                clickCurrentlyRunning.buttonId = '';
                clickCurrentlyRunning.buttonLabel = '';
                clickCurrentlyRunning.lastRecIdProcessed = '';
                $(`#${viewId} [id^=ktlAutoClick_]`).attr('disabled', false);
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

                    const sendEmailsButton = ktl.fields.addButton(sendEmailsButtonDiv, 'Send Emails Now', '', ['kn-button', 'ktlButtonMargin'], 'ktlSendEmailNow-' + viewId);
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

        const dragAndDropSubscribers = [];
        function dragAndDrop(viewId, keywords) {
            const kw = '_dnd';
            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(viewId && keywords && keywords[kw] && (viewType === 'table' || viewType === 'search'))) return;

            if (!ktl.views.viewHasInlineEdit(viewId)) {
                ktl.log.clog('purple', `_dnd keyword used in a grid or search without inline edit: ${viewId}`);
                return;
            }

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            const params = keywords[kw][0].params;

            if (!params || params[0].length < 2) return;

            const dndType = params[0][0];
            if (dndType === 'sort')
                dndSort();
            else {
                //TODO: Implement other DnD types as we go, ex: from srcView to dstView.
            }

            //To reposition rows vertically withing a grid.
            //If the grid has groupings, the DnD operation will be constrained within its group.
            function dndSort() {
                const lineIndexFieldLabel = params[0][1];
                const sortFieldId = ktl.fields.getFieldIdFromLabel(viewId, lineIndexFieldLabel);
                if (!sortFieldId) return;

                let viewHasGrouping = ktl.views.viewHasGroups(viewId);

                let maxIndexRenumber = Number.MAX_SAFE_INTEGER;
                let noDragElements = [];
                let noDragFieldId;

                for (const group of params) {
                    if (group.length === 2 && group[0] === 'lte')
                        maxIndexRenumber = Number(group[1]);
                    else if (group.length >= 3 && group[0] === 'nodrag') {
                        noDragFieldId = group[1];
                        if (!noDragFieldId.startsWith('field_'))
                            noDragFieldId = ktl.fields.getFieldIdFromLabel(viewId, noDragFieldId);
                        noDragElements = group.slice(2);
                    }
                }

                ktl.core.waitSelector(`#kn-loading-spinner`, 20000, 'hidden')
                    .then(() => {
                        const rows = document.querySelectorAll(`#${viewId} tbody tr`);
                        let groupName = 'noGrp';
                        for (const row of rows) {
                            if (viewHasGrouping) {
                                if (row.classList.contains('kn-table-group') || row.classList.contains('kn-table-totals')) {
                                    row.classList.add('ktlNotAllowed');
                                    if (row.classList.contains('kn-table-group') && row.textContent)
                                        groupName = row.textContent.replace(/[^a-zA-Z0-9]/g, '_'); //Any character other than a-z or 0-9, replace by underscore.
                                } else {
                                    row.classList.add(`dndGrp_${groupName}`);
                                }
                            }

                            if (noDragFieldId) {
                                const fieldText = $(row).find(`.${noDragFieldId} span`)[0].innerText;
                                if (noDragElements.includes(fieldText)) {
                                    row.classList.add('ktlNotAllowed', 'ktlNotAllowedKeep');
                                    $(row).find('td').css('cursor', 'unset');
                                }
                            }
                        }

                        processDndSort();
                    })
                    .catch(() => { })

                function processDndSort() {
                    $(`#${viewId} tbody tr:not(.kn-table-group):not(.kn-table-totals):not(.ktlNotAllowed)`).addClass(`ktlDragAndDrop`);

                    let draggedRecId;
                    let initialGroup;

                    const dndDiv = document.querySelector(`#${viewId} tbody`);
                    if (Sortable.get(dndDiv)) return;

                    new Sortable(dndDiv, {
                        delay: 500,
                        delayOnTouchOnly: true,
                        touchStartThreshold: 5,
                        //handle: '.dndHandle',
                        swapThreshold: 0.96,
                        animation: 250,
                        easing: 'cubic-bezier(1, 0, 0, 1)',
                        filter: `#${viewId} .kn-table-group, #${viewId} .ktlNotAllowed`,
                        direction: 'vertical',

                        onStart: function (evt) {
                            ktl.views.onDragAndDropEvent(viewId, evt);

                            draggedRecId = evt.item.id;

                            if (viewHasGrouping) {
                                const dndGrpClassName = Array.from(evt.item.classList).find(className => className.startsWith('dndGrp_'));
                                if (dndGrpClassName) {
                                    initialGroup = dndGrpClassName;
                                    $(`#${viewId} tbody tr:not(.${initialGroup})`).addClass(`ktlNotAllowed`);
                                }
                            }
                        },

                        onMove: function (evt, originalEvent) {
                            ktl.views.onDragAndDropEvent(viewId, evt);

                            if (viewHasGrouping) {
                                const dndGrpClassName = Array.from(evt.related.classList).find(className => className.startsWith('dndGrp_'));
                                if (evt.related.classList.contains('kn-table-group') || (dndGrpClassName && dndGrpClassName !== initialGroup)) {
                                    $(`#${viewId} tr.${dndGrpClassName}`).addClass('ktlNotValid');
                                    return false;
                                } else {
                                    $(`#${viewId} tr.ktlNotValid`).removeClass('ktlNotValid');
                                }
                            }
                        },

                        onEnd: function (evt) {
                            ktl.views.onDragAndDropEvent(viewId, evt);

                            $(`#${viewId} tbody tr.ktlNotValid`).removeClass('ktlNotValid');
                            $(`#${viewId} tbody tr.ktlNotAllowed:not(.ktlNotAllowedKeep)`).removeClass('ktlNotAllowed');

                            if (evt.oldIndex !== evt.newIndex) {
                                ktl.core.infoPopup();
                                ktl.views.autoRefresh(false);
                                ktl.scenes.spinnerWatchdog(false);
                                $.blockUI({ message: '', overlayCSS: { backgroundColor: '#ddd', opacity: 0.2, } })

                                var recIdArray = [];
                                var idx;
                                let newData;

                                if (viewHasGrouping)
                                    newData = document.querySelectorAll(`#${viewId} tbody tr.${initialGroup} .${sortFieldId}`);
                                else
                                    newData = document.querySelectorAll(`#${viewId} tbody tr .${sortFieldId}`);

                                for (idx = 0; idx < newData.length; idx++) {
                                    const sortValue = Number(newData[idx].innerText);
                                    if (sortValue !== (idx + 1)) {
                                        const recId = newData[idx].closest('tr').id;
                                        if (sortValue <= maxIndexRenumber || recId === draggedRecId) {
                                            var recData = {};
                                            recData[sortFieldId] = idx + 1;
                                            recData.recId = recId;
                                            recIdArray.push(recData);
                                        }
                                    }
                                }

                                var arrayLen = recIdArray.length;
                                idx = 0;
                                var countDone = 0;
                                var apiData = {};

                                var itv = setInterval(() => {
                                    if (idx < arrayLen) {
                                        apiData[sortFieldId] = recIdArray[idx][sortFieldId];
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
                                                    ktl.core.timedPopup('Rows Reordered successfully', 'success', 1000);
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
                    })
                }
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

            let options;
            if (keywords[kw].length && keywords[kw][0].options) {
                options = keywords[kw][0].options;
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

                let needConfirm = true;
                if (params[0].length >= 2 && params[0][1] === 'auto')
                    needConfirm = false;

                if (params[0].length >= 3 && params[0][2]) {
                    //Add a start button
                    const buttonLabel = params[0][2];
                    let ktlAddonsDiv = ktl.views.getKtlAddOnsDiv(dstViewId);
                    const startButton = ktl.fields.addButton(ktlAddonsDiv, buttonLabel, '', ['kn-button', 'ktlButtonMargin'], 'ktlStartClickNow-' + dstViewId);
                    $(startButton).off('click.ktl_cpyfrom').on('click.ktl_cpyfrom', e => {
                        if (needConfirm) {
                            if (confirm(`Proceed with copy?`))
                                proceed();
                        } else
                            proceed();
                    });
                } else { //No button
                    if (needConfirm) {
                        if (confirm(`Proceed with copy?`))
                            proceed();
                    } else
                        proceed();
                }

                function proceed() {
                    let mode = 'add';
                    if (params[0].length >= 4 && params[0][3]) {
                        if (['add', 'edit', 'api'].includes(params[0][3]))
                            mode = params[0][3];
                        else {
                            ktl.log.clog('purple', 'Invalid mode found in _cpyfrom:', dstViewId, params[0][3]);
                            return;
                        }
                    }

                    if (mode === 'add' && data.length) return;

                    let bulkApiDataArray = [];
                    let fieldsToCopy = ['']; //All fields by default
                    let headersMapping = {};

                    if (mode === 'add' || mode === 'edit') {
                        if (params.length >= 2 && params[1].length >= 1)
                            fieldsToCopy = params[1];

                        const model = Knack.views[dstViewId] && Knack.views[dstViewId].model;
                        const columns = model.view.columns;
                        const headers = columns.map(col => col.header.trim()).filter(header => {
                            return (fieldsToCopy.includes(header) || fieldsToCopy[0] === '');
                        });

                        //Try to find the equivalent headers in source view.
                        for (const header of headers) {
                            const dstFieldId = ktl.fields.getFieldIdFromLabel(dstViewId, header);
                            if (dstFieldId && dstFieldId.startsWith('field_') && Knack.objects.getField(dstFieldId).attributes.type !== 'concatenation') {
                                const srcFieldId = ktl.fields.getFieldIdFromLabel(srcViewId, header);
                                if (srcFieldId)
                                    headersMapping[header] = { src: srcFieldId, dst: dstFieldId };
                            }
                        }

                        //Process additional parameter groups, if any.
                        for (let i = 2; i < params.length; i++) {
                            let param = params[i];
                            if (param.length == 2) {
                                if (param[0] !== '' && param[1] === 'ktlLoggedInAccount') {
                                    const dstFieldId = ktl.fields.getFieldIdFromLabel(dstViewId, param[0]);
                                    if (dstFieldId && dstFieldId.startsWith('field_') && Knack.objects.getField(dstFieldId).attributes.type !== 'concatenation') //Exclude Text Formulas
                                        headersMapping[param[0]] = { src: 'ktlLoggedInAccount', dst: dstFieldId };
                                }
                            } else if (param.length == 3) {
                                //When source is a field/view selector.
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
                                                headersMapping[param[0]] = { src: 'ktlUseThisValue', dst: value };
                                            })
                                            .catch(err => {
                                                ktl.log.clog('purple', `copyRecordsFromView, proceed - Timeout waiting for data: ${foreignViewId}`);
                                                console.log('err =', err);
                                            })
                                    }
                                }
                            }
                        }

                        let srcFieldObject = ktl.views.getView(srcViewId);
                        let srcViewDisplayFieldId = Knack.objects._byId[srcFieldObject.source.object].attributes.identifier;

                        for (const srcRecord of srcData) {
                            let srcRecId = srcRecord.id;

                            const apiData = {};
                            for (const header in headersMapping) {
                                const srcFieldId = headersMapping[header].src;
                                const dstFieldId = headersMapping[header].dst;

                                if (srcFieldId.startsWith('field_')) {
                                    const sourceRecord = srcRecord.attributes[srcFieldId];
                                    const spanClass = $(sourceRecord).find('span[class]');
                                    if (spanClass.length) {
                                        apiData[dstFieldId] = [];
                                        for (const classId of Array.from(spanClass)) {
                                            apiData[dstFieldId].push(classId.classList.value);
                                        }
                                    } else {
                                        const spanId = $(sourceRecord).find('span[id]');
                                        if (spanId.length) {
                                            const ids = ktl.core.extractIds(srcRecord.attributes[srcFieldId]);
                                            apiData[dstFieldId] = ids;
                                        } else {
                                            if (srcFieldId === srcViewDisplayFieldId)
                                                apiData[dstFieldId] = [srcRecId];
                                            else {
                                                const data = srcRecord.attributes[`${srcFieldId}_raw`];
                                                if (data) {
                                                    if (Array.isArray(data) && data.length)
                                                        apiData[dstFieldId] = data;
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (srcFieldId === 'ktlLoggedInAccount')
                                        apiData[dstFieldId] = [Knack.getUserAttributes().id];
                                }
                            }

                            if (mode === 'add')
                                bulkApiDataArray.push(apiData);
                            else if (mode === 'edit') {
                                //Edit mode requires the additional record ID for each destination row.
                                if (!$.isEmptyObject(apiData)) {
                                    const dstRowsWithSameRecId = $(`#${dstViewId} tbody tr td .${srcRecId}`);
                                    if (dstRowsWithSameRecId.length) {
                                        dstRowsWithSameRecId.each((ix, el) => {
                                            const dstRecId = el.closest('tr').id;

                                            for (const header in headersMapping) {
                                                const srcFieldId = headersMapping[header].src;
                                                const dstFieldId = headersMapping[header].dst;

                                                const dstFieldType = ktl.fields.getFieldType(dstFieldId);
                                                if (dstFieldType === 'connection') {
                                                    const html = $(`#${dstViewId} tr[id="${dstRecId}"] .${dstFieldId}`).html();
                                                    const dstRecIds = ktl.core.extractIds(html);

                                                    let array1 = [];
                                                    let array2 = [];

                                                    if (apiData[dstFieldId]) {
                                                        array1 = apiData[dstFieldId];
                                                        array2 = dstRecIds;
                                                    }

                                                    if (!ktl.core.isArraysContainSameElements(array1, array2))
                                                        bulkApiDataArray.push({ apiData: apiData, id: dstRecId });
                                                } else { //Text and numeric values.
                                                    const srcText = $(`#${srcViewId} tr[id="${srcRecId}"] .${srcFieldId}`).text();
                                                    const dstText = $(`#${dstViewId} tr[id="${dstRecId}"] .${dstFieldId}`).text();

                                                    if (srcText !== dstText) {
                                                        //console.log('src vs dst text', srcText, dstText);
                                                        //console.log('sel', `#${dstViewId} tr[id="${dstRecId}"] .${dstFieldId}`);
                                                        bulkApiDataArray.push({ apiData: apiData, id: dstRecId });
                                                    }

                                                } //TODO: add support for all field types.
                                            }
                                        });
                                    }
                                }
                            }
                        }

                        if (bulkApiDataArray.length) {
                            //console.log('bulkApiDataArray =', JSON.stringify(bulkApiDataArray, null, 4));
                            proceedToUpdateRecords(bulkApiDataArray);
                        }
                    } else if (mode === 'api') {
                        if (params.length >= 2 && params[1].length === 3)
                            fieldsToCopy = params[1];
                        else
                            return;

                        if (fieldsToCopy[0].startsWith('field_')) return;

                        const remoteViewId = fieldsToCopy[1];
                        const remoteSourceFieldId = ktl.fields.getFieldIdFromLabel(remoteViewId, fieldsToCopy[0]);
                        const localSourceFieldId = ktl.fields.getFieldIdFromLabel(dstViewId, fieldsToCopy[0]);
                        if (!remoteViewId.startsWith('view_')) return;
                        const dstFieldId = fieldsToCopy[2].startsWith('field_') ? fieldsToCopy[2] : ktl.fields.getFieldIdFromLabel(dstViewId, fieldsToCopy[2]);

                        //First pass to fetch all record IDs we need.
                        for (const srcRecord of srcData) {
                            const record = srcRecord.attributes;
                            let srcRecId = record.id;

                            const dstText = $(`#${dstViewId} tr[id="${srcRecId}"] .${dstFieldId}`).text().trim();
                            if (dstText !== record[localSourceFieldId]) {
                                const filters = {
                                    'match': 'and',
                                    'rules': [
                                        {
                                            'field': remoteSourceFieldId,
                                            'operator': 'is',
                                            'value': record[localSourceFieldId]
                                        },
                                    ]
                                };

                                bulkApiDataArray.push({ id: srcRecId, filters: filters });
                            }
                        }

                        if (!bulkApiDataArray.length) return;

                        ktl.views.processAutomatedBulkOps(remoteViewId, bulkApiDataArray, 'GET', [], false, false)
                            .then(results => {
                                $.unblockUI();
                                bulkApiDataArray = [];
                                for (const result of results) {
                                    const apiData = {};

                                    apiData[dstFieldId] = [];
                                    for (const record of result.records) {
                                        apiData[dstFieldId].push(record.id);
                                    }

                                    bulkApiDataArray.push({ id: result.id, apiData: apiData });
                                }

                                //Second pass to update the records in the destination view.
                                proceedToUpdateRecords(bulkApiDataArray);
                            })
                            .catch(err => {
                                $.unblockUI();
                                ktl.log.clog('purple', `processAutomatedBulkOps error encountered:\n${err}`);
                            })
                    } //API mode

                    function proceedToUpdateRecords(bulkApiDataArray = []) {
                        if (!bulkApiDataArray.length) return;

                        if (options && options.ktlMsg) {
                            const message = options.ktlMsg.split(',').slice(1).join(',').trim();
                            const displayMode = options.ktlMsg.split(',')[0].trim();
                            if (message) {
                                if (displayMode === 'static') {
                                    $.blockUI({
                                        message: message,
                                        overlayCSS: {
                                            backgroundColor: '#ddd', opacity: 0.2, cursor: 'wait'
                                        },
                                        css: { padding: 20 }
                                    })
                                }
                            }
                        }

                        let requestType = (mode === 'add') ? 'POST' : 'PUT';

                        ktl.views.processAutomatedBulkOps(dstViewId, bulkApiDataArray, requestType, [], false, false)
                            .then(countDone => {
                                $.unblockUI();
                            })
                            .catch(err => {
                                $.unblockUI();
                                ktl.log.clog('purple', `processAutomatedBulkOps error encountered:\n${err}`);
                            })
                    }
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

                $(`#${viewId} th.sorted-asc, #${viewId} th.sorted-desc`).each(function () {
                    const index = $(this).index();
                    $(`#${viewId} tbody tr:not(.kn-table-group)`).each(function () {
                        $(this).find('td').eq(index).attr('style', style);
                    });
                });
            }
        }

        function closeModalAndRefreshViews(viewId, keywords) {
            const kw = '_cmr';
            if (!(viewId && keywords && keywords[kw] && Knack.router.scene_view.model.attributes.modal)) return;

            let viewsToRefreshArray = [];

            //Do not use this technique below to get this modal view's parent.
            //It will give wrong parent in some cases, depending on the pages structure.
            //BAD=> const viewsInScene = Knack.scenes._byId[Knack.router.scene_view.model.attributes.parent].views.models;

            //This is the correct way to get parent in the page based on HTML, not from the Builder's structure.
            const sceneKey = $('.kn-scenes .kn-scene')[0].id.replace('kn-', '');
            const sceneSlug = Knack.scenes.getByKey(sceneKey).attributes.slug;

            let forcePageRefresh = false;

            if (keywords[kw].length && keywords[kw][0].params) {
                if (keywords[kw][0].params[0][0] === 'ktlPageRefresh')
                    forcePageRefresh = true;
                else {
                    for (const viewToRefresh of keywords[kw][0].params[0]) {
                        const viewIdToRefresh = (viewToRefresh.startsWith('view_')) ? viewToRefresh : ktl.core.getViewIdByTitle(viewToRefresh, Knack.router.scene_view.model.attributes.parent, true);
                        $(`#${viewIdToRefresh}`).length > 0 && viewsToRefreshArray.push(viewIdToRefresh);
                    }
                }
            } else {
                //All parent views.
                const viewsInScene = Knack.scenes._byId[sceneSlug].views.models;
                for (const { attributes: { key: viewIdToRefresh } } of viewsInScene) {
                    //Calendars don't need a refresh since it's done automatically.
                    if (ktl.views.getViewType(viewIdToRefresh) !== 'calendar' && $(`#${viewIdToRefresh}`).length) {
                        viewsToRefreshArray.push(viewIdToRefresh);
                    }
                }
            }

            const viewType = ktl.views.getViewType(viewId);
            if (viewType === 'form') {
                $(document).off(`knack-form-submit.${viewId}.ktl_cmr`).one(`knack-form-submit.${viewId}.ktl_cmr`, function (event, view, record) {
                    Knack.closeModal();
                    refreshViews();
                });
            } else {
                const keepModalOpen = Knack.router.scene_view.model.attributes.modal_prevent_background_click_close;
                if (keepModalOpen && keepModalOpen === true) {
                    $(`.delete.close-modal`).bindFirst('click', e => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        Knack.closeModal();
                        refreshViews();
                    })
                } else {
                    $(document).on('knack-modal-close', (e) => {
                        refreshViews();
                    })
                }
            }

            function refreshViews() {
                if (forcePageRefresh)
                    //If some page rules exist and must be enforced, the user can use this param
                    //to force a full page update instead of individual view refreshes.
                    Knack.router.scene_view.render();
                else
                    ktl.views.refreshViewArray(viewsToRefreshArray)
                        .then(() => { })
                        .catch(() => { })
            }
        }

        function autoFillAndSubmitQRGenerator(view, keywords) {
            const kw = '_afsg';
            if (!(view && keywords && keywords[kw]) && ktl.views.getViewType(view.key) !== 'form') return;

            const viewId = view.key;

            const formAction = view.action;
            if (!(formAction === 'insert' || formAction === 'create')) return;

            const options = keywords[kw][0].options;
            if (!ktl.core.hasRoleAccess(options)) return;

            const params = keywords[kw][0].params;
            if (params.length < 2 || params[0].length < 2) return;

            const url = params[0][0];
            let afsViewId = params[0][1];

            let qrCodeSize = 200;
            if (params[0].length >= 3)
                qrCodeSize = Number(params[0][2]);

            const qrCodeUrlFieldId = ktl.fields.getFieldIdFromLabel(viewId, 'QR Code URL');
            if (!qrCodeUrlFieldId) {
                ktl.log.clog('purple', `"QR Code URL" field is missing for _afsg keyword`);
                return;
            }

            ktl.fields.disableFields(viewId, [qrCodeUrlFieldId]);

            let varsObject = {}; //Named after the _vars parameters.  See here: https://learn.knack.com/article/z36i2it02b-how-to-use-url-variables-to-pre-populate-a-form
            let urlWithVars;
            let fieldsAutoPopulatedByQrCode;
            let otherParams = {};

            const groups = keywords[kw][0].params.slice(1);
            for (const group of groups) {
                if (group[0] === 'qr') {
                    fieldsAutoPopulatedByQrCode = group.slice(1);
                    for (const autoPopField of fieldsAutoPopulatedByQrCode) {
                        const fieldId = autoPopField.startsWith('field_') ? autoPopField : ktl.fields.getFieldIdFromLabel(viewId, autoPopField);
                        varsObject[fieldId] = '';
                    }
                } else if (group[0] === 'disable') {
                    let disable = group.slice(1);
                    if (disable.length >= 1)
                        otherParams.disable = disable;
                } else if (group[0] === 'auto') {
                    let automation = group.slice(1);
                    if (automation.length >= 1)
                        otherParams.automation = automation;
                }
            }

            ktl.core.loadLib('QRGenerator')
                .then(() => {
                    $(`#${viewId}`).on('input', function (e) {
                        for (const fieldId in varsObject) {
                            let value = $(`#${viewId} #${fieldId}`).val();

                            if (ktl.fields.getFieldType(fieldId) === 'connection')
                                value = [`${document.querySelector(`#${viewId}-${fieldId}`).selectedOptions[0].value}`];

                            varsObject[fieldId] = value;
                        }

                        generateQRCode();
                    })

                    generateQRCode();

                    function generateQRCode() {
                        urlWithVars = `${url}?${afsViewId}_vars=${encodeURIComponent(JSON.stringify(varsObject))}`;

                        if (!$.isEmptyObject(otherParams))
                            urlWithVars += `&otherParams=${encodeURIComponent(JSON.stringify(otherParams))}`;

                        $(`#${viewId} #${qrCodeUrlFieldId}`).val(urlWithVars);

                        const barcodeData = { text: urlWithVars, width: qrCodeSize, height: qrCodeSize };

                        var bcgDiv = document.getElementById(`${viewId}-bcgDiv-${qrCodeUrlFieldId}`);
                        if (!bcgDiv) {
                            bcgDiv = document.createElement('div');

                            $(`#${viewId} [data-input-id="${qrCodeUrlFieldId}"]`).append(bcgDiv);

                            bcgDiv.setAttribute('id', `${viewId}-bcgDiv-${qrCodeUrlFieldId}`);
                            bcgDiv.style.marginTop = '10px';
                        }

                        if (bcgDiv.lastChild)
                            bcgDiv.removeChild(bcgDiv.lastChild);
                        $(`#${viewId}-bcgDiv-${qrCodeUrlFieldId}`).qrcode(barcodeData);
                    }
                })
                .catch(reason => { reject('barcodeGenerator error:', reason); })
        }

        function autoFillAndSubmit(view, keywords) {
            const kw = '_afs';
            if (!(view && keywords && keywords[kw]) && ktl.views.getViewType(view.key) !== 'form') return;

            if (!(view.action === 'insert' || view.action === 'create')) return;

            ktl.persistentForm.disablePersistentForm(Knack.router.current_scene_key);

            const viewId = view.key;

            const parts = ktl.core.splitUrl(window.location.href);
            let otherParams = parts.params.otherParams;
            if (otherParams) {
                otherParams = JSON.parse(otherParams);
                if (otherParams.disable)
                    ktl.fields.disableFields(viewId, otherParams.disable);

                let timerValueAfterClose;
                if (otherParams.automation.includes('close')) {
                    //Extract optional timer value in seconds, following 'close'.
                    const closeIndex = otherParams.automation.indexOf('close');
                    timerValueAfterClose =
                        closeIndex !== -1 &&
                            closeIndex + 1 < otherParams.automation.length &&
                            !isNaN(otherParams.automation[closeIndex + 1])
                            ? Number(otherParams.automation[closeIndex + 1])
                            : null;
                }

                if (otherParams.automation.includes('submit')) {
                    $(`#${viewId} .is-primary`).click();
                    $(document).on('knack-form-submit.' + viewId, function (event, view, record) {
                        processClose();
                    });
                } else
                    processClose();

                function processClose() {
                    if (timerValueAfterClose > 0 || timerValueAfterClose < 172800 /*2 days*/) {
                        setTimeout(() => {
                            window.close();
                        }, 1000 * timerValueAfterClose);
                    } else if (!timerValueAfterClose)
                        window.close();
                }
            }
        }

        function addDateTimePickers(viewId = '', keywords) {
            const kw = '_dtp';
            if (!(viewId && keywords && keywords[kw])) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            //The tables Date/Time field on which the filtering is applied.  Always the first one found from the left.
            let fieldId = '';

            // Find first Date/Time field type using array functions.
            let cols = Knack.router.scene_view.model.views._byId[viewId].attributes.columns;
            let field = cols.find(col => {
                fieldId = col.field && col.field.key;
                if (!fieldId) return false;
                let field = Knack.objects.getField(fieldId);
                return field && field.attributes && field.attributes.type === 'date_time';
            });

            let fieldName = field ? Knack.objects.getField(field.field.key).attributes.name : undefined;

            if (!fieldId || !fieldName) {
                ktl.core.timedPopup('This table doesn\'t have a Date/Time column.', 'warning', 4000);
                return;
            }

            let period = 'monthly';
            let inputType = 'month';

            //These two variables are always a Date object, in Knack's field format.
            let startDateInFieldFormat;
            let endDateInFieldFormat;

            //These two variables are always a string in the date picker's ISO format: yyyy-mm or yyyy-mm-dd.
            let startDatePickerIso = '';
            let endDatePickerIso = '';

            const dateTimeFormat = Knack.fields[fieldId].attributes.format.date_format;

            let ktlAddonsDiv = ktl.views.getKtlAddOnsDiv(viewId);
            ktlAddonsDiv.classList.add('ktlDateTimePickerDiv');

            let viewDates = loadViewDates(viewId);
            if (viewDates.startDt) {
                startDateInFieldFormat = new Date(viewDates.startDt + 'T00:00:00');
                viewDates.period && (period = viewDates.period);
                endDateInFieldFormat = new Date(viewDates.endDt + 'T00:00:00');
            } else {
                startDateInFieldFormat = new Date(); //Nothing yet for this view, use "now".
                endDateInFieldFormat = ktl.core.getLastDayOfMonth(startDateInFieldFormat);
            }

            startDatePickerIso = ktl.core.convertDateToIso(startDateInFieldFormat, period, '-');
            endDatePickerIso = ktl.core.convertDateToIso(endDateInFieldFormat, period, '-');

            inputType = periodToInputType(period);

            let startDateInput = ktl.fields.addInput(ktlAddonsDiv, 'From', inputType, '', `${viewId}-startDateInput`, 'width: 140px; height: 25px;');
            let endDateInput = ktl.fields.addInput(ktlAddonsDiv, 'To', inputType, '', `${viewId}-endDateInput`, 'width: 140px; height: 25px;');
            let periodMonthly = ktl.fields.addRadioButton(ktlAddonsDiv, 'Monthly', 'PERIOD', `${viewId}-monthly`, 'monthly');
            let periodWeekly = ktl.fields.addRadioButton(ktlAddonsDiv, 'Weekly', 'PERIOD', `${viewId}-weekly`, 'weekly');
            let periodDaily = ktl.fields.addRadioButton(ktlAddonsDiv, 'Daily', 'PERIOD', `${viewId}-daily`, 'daily');

            document.querySelector(`#${viewId}-${period}`).checked = true;

            startDateInput.value = startDatePickerIso;
            endDateInput.value = endDatePickerIso;

            if (endDateInFieldFormat < startDateInFieldFormat)
                document.querySelector(`#${viewId}-endDateInput`).classList.add('ktlNotValid');

            startDateInput.addEventListener('change', (e) => {
                if (!e.target.value) {
                    startDateInput.classList.add('ktlNotValid');
                    return;
                } else
                    startDateInput.classList.remove('ktlNotValid');

                let startDateFromPicker = e.target.value.replace(/-/g, '/');
                startDateInFieldFormat = new Date(startDateFromPicker);
                endDateInFieldFormat = computeEndDate(startDateInFieldFormat, period);

                endDateInput.value = ktl.core.convertDateToIso(endDateInFieldFormat, period, '-');

                saveViewDates(
                    viewId,
                    ktl.core.convertDateTimeToString(startDateInFieldFormat, true, true),
                    ktl.core.convertDateTimeToString(endDateInFieldFormat, true, true),
                    period);

                updatePeriodFilter(startDateInFieldFormat, endDateInFieldFormat);
            })

            endDateInput.addEventListener('change', (e) => {
                if (!e.target.value) {
                    endDateInput.classList.add('ktlNotValid');
                    return;
                } else
                    endDateInput.classList.remove('ktlNotValid');

                endDateInFieldFormat = new Date(e.target.value.replace(/-/g, '/'));

                saveViewDates(
                    viewId,
                    ktl.core.convertDateTimeToString(startDateInFieldFormat, true, true),
                    ktl.core.convertDateTimeToString(endDateInFieldFormat, true, true),
                    period);

                updatePeriodFilter(startDateInFieldFormat, endDateInFieldFormat);
            })

            startDateInput.onfocus = (e) => { currentFocus = `#${viewId}-startDateInput`; }
            endDateInput.onfocus = (e) => { currentFocus = `#${viewId}-endDateInput`; }

            if (currentFocus) {
                document.querySelector(currentFocus).focus();
            } else
                startDateInput.focus();

            function computeEndDate(startDate, period) {
                let endDate;

                if (period === 'monthly')
                    endDate = ktl.core.getLastDayOfMonth(startDate);
                else if (period === 'weekly') {
                    endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 6);
                } else if (period === 'daily')
                    endDate = new Date(startDate);

                return endDate;
            }

            periodMonthly.addEventListener('click', e => { handlePeriodTypeChange(e); });
            periodWeekly.addEventListener('click', e => { handlePeriodTypeChange(e); });
            periodDaily.addEventListener('click', e => { handlePeriodTypeChange(e); });

            function handlePeriodTypeChange(e) {
                period = e.target.defaultValue;
                inputType = periodToInputType(period);
                startDateInput.type = inputType;
                endDateInput.type = inputType;

                //let st = startDateInput.value;
                startDateInFieldFormat = new Date(viewDates.startDt + 'T00:00:00');
                endDateInFieldFormat = computeEndDate(startDateInFieldFormat, period);

                startDatePickerIso = ktl.core.convertDateToIso(startDateInFieldFormat, period, '-');
                endDatePickerIso = ktl.core.convertDateToIso(endDateInFieldFormat, period, '-');

                if (startDatePickerIso.includes('Invalid Date') || endDatePickerIso.includes('Invalid Date'))
                    return;

                startDateInput.value = startDatePickerIso;
                endDateInput.value = endDatePickerIso;

                saveViewDates(
                    viewId,
                    ktl.core.convertDateTimeToString(startDateInFieldFormat, true, true),
                    ktl.core.convertDateTimeToString(endDateInFieldFormat, true, true),
                    period);

                updatePeriodFilter(startDateInFieldFormat, endDateInFieldFormat);
            }

            function periodToInputType(period) {
                let inputType = 'month';
                if (period !== 'monthly')
                    inputType = 'date';
                return inputType;
            }

            function updatePeriodFilter(startDateInFieldFormat, endDateInFieldFormat) {
                Knack.showSpinner();

                //Merge current filter with new one, if possible, i.e. using the AND operator.
                let currentFilters = Knack.views[viewId].getFilters();
                let curRules = [];
                let foundAnd = true;
                if (!$.isEmptyObject(currentFilters)) {
                    //Sometimes, the filters have a rules key, but not always.
                    //If not, then the object itself is the array that contain the rules.
                    let rules;
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
                startDateInFieldFormat.setDate(startDateInFieldFormat.getDate() - 1);

                if (period === 'monthly')
                    endDateInFieldFormat = new Date(endDateInFieldFormat.getFullYear(), endDateInFieldFormat.getMonth() + 1);
                else
                    endDateInFieldFormat.setDate(endDateInFieldFormat.getDate() + 1);

                startDateInFieldFormat = ktl.core.convertDateTimeToString(startDateInFieldFormat, false, true, dateTimeFormat);
                endDateInFieldFormat = ktl.core.convertDateTimeToString(endDateInFieldFormat, false, true, dateTimeFormat);

                let filterRules = [
                    {
                        "field": fieldId,
                        "operator": "is after",
                        "value": {
                            "date": startDateInFieldFormat,
                            "time": ""
                        },
                        "field_name": fieldName
                    },
                    {
                        "match": "and",
                        "field": fieldId,
                        "operator": "is before",
                        "value": {
                            "date": endDateInFieldFormat,
                            "time": ""
                        },
                        "field_name": fieldName
                    }
                ];

                let filterObj = {
                    "match": "and",
                    "rules": filterRules.concat(curRules)
                }

                const sceneHash = Knack.getSceneHash();
                const queryString = Knack.getQueryString({ [`${viewId}_filters`]: encodeURIComponent(JSON.stringify(filterObj)) });
                Knack.router.navigate(`${sceneHash}?${queryString}`, false);
                Knack.setHashVars();

                try {
                    Knack.models[viewId].setFilters(filterObj);
                    Knack.models[viewId].fetch({
                        success: () => { Knack.hideSpinner(); },
                        error: () => { Knack.hideSpinner(); }
                    });
                }
                catch (e) {
                    ktl.log.clog('purple', '_dtp error', viewId);
                }
            }

            function saveViewDates(viewId = '', startDt = '', endDt = '', period = 'monthly') {
                if (!viewId || (!startDt && !endDt)) return;

                let viewDates = {};
                let viewDatesStr = ktl.storage.lsGetItem(ktl.const.LS_VIEW_DATES);
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
            }

            function loadViewDates(viewId = '') {
                if (!viewId) return {};

                let startDt = '';
                let endDt = '';
                let period = '';

                let viewDates = ktl.storage.lsGetItem(ktl.const.LS_VIEW_DATES);
                if (viewDates) {
                    try {
                        viewDates = JSON.parse(viewDates);
                        if (viewDates[viewId]) {
                            startDt = viewDates[viewId].startDt;
                            endDt = viewDates[viewId].endDt;
                            period = viewDates[viewId].period;
                        }
                    } catch (e) {
                        console.log('Error parsing report period', e);
                    }
                } else
                    return {};

                return { startDt: startDt, endDt: endDt, period: period };
            }
        }

        function virtualKeyboard(viewId, keywords) {
            const kw = '_vk';
            if (!(viewId && keywords && keywords[kw])) return;

            ktl.core.setCfg({
                enabled: { virtualKeyboard: true },
                forceVirtualKeyboard: 'all',
            });

            ktl.virtualKeyboard.load();
        }

        function autoSubmitForm(viewId, keywords) {
            const kw = '_asf';
            if (!(viewId && keywords && keywords[kw])) return;

            let delayBeforeSubmit = 0;
            if (keywords._asf.length && keywords._asf[0].params[0].length && keywords._asf[0].params[0][0])
                delayBeforeSubmit = Number(keywords._asf[0].params[0][0]);

            delayBeforeSubmit = isNaN(delayBeforeSubmit) ? 0 : Math.min(Math.max(delayBeforeSubmit, 0), 172800 /*2 days*/);

            setTimeout(() => {
                $(`#${viewId} .is-primary`).click();
            }, delayBeforeSubmit * 1000);
        }

        function redirectClick(viewId, keywords) {
            const kw = '_rdclk';
            if (!(viewId && keywords && keywords[kw])) return;

            const viewType = ktl.views.getViewType(viewId);
            if (!(keywords && keywords[kw] && (viewType === 'table' || viewType === 'search'))) return;

            if (keywords[kw].length && keywords[kw][0].options) {
                const options = keywords[kw][0].options;
                if (!ktl.core.hasRoleAccess(options)) return;
            }

            if (keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                const groups = keywords[kw][0].params;
                for (const group of groups) {
                    //Group must have an even number of parameters.
                    if (group.length >= 2 && group.length % 2 === 0) {
                        const sourceColumn = group[0];
                        const destinationColumn = group[1];
                        const sourceColumnIndex = ktl.views.getColumnIndex(viewId, sourceColumn);
                        const destinationColumnIndex = ktl.views.getColumnIndex(viewId, destinationColumn);
                        if (sourceColumnIndex && destinationColumnIndex) {
                            let sourceTargetSelector = `#${viewId} tbody td .col-${sourceColumnIndex}`;
                            const element = $(sourceTargetSelector);

                            $(`#${viewId} tbody td .col-${sourceColumnIndex} span span`).filter(function () {
                                return $.trim($(this).text()) !== '';
                            }).each(function () {
                                if (!this.outerHTML.startsWith('<a span'))
                                    this.outerHTML = this.outerHTML.replace('<span', '<a span');
                            });

                            element.off('click').on('click', e => {
                                const target = e.target;
                                if (target) {
                                    let recId = target.closest('tr[id]').id;
                                    if (recId) {
                                        let destinationTargetSelector = `#${viewId} tbody tr[id="${recId}"] td .col-${destinationColumnIndex} a`;
                                        if ($(destinationTargetSelector).length) {
                                            e.preventDefault();
                                            $(destinationTargetSelector)[0].click();
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }

        function fieldIsRequired(view) {
            if (!view || ktl.scenes.isiFrameWnd()) return;

            if (view.type !== 'form') return;

            const kw = '_req';
            let viewId = view.key;
            var fieldsAr = [];

            //Process fields keywords
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
                                if (ktl.core.hasRoleAccess(options) && !fieldsAr.includes(fieldId))
                                    fieldsAr.push(fieldId);
                            } else if (!fieldsAr.includes(fieldId))
                                fieldsAr.push(fieldId);
                        }
                    }
                }
            }

            //Process view keyword
            if (ktl.core.getCfg().enabled.persistentForm && (view.action === 'insert' || view.action === 'create')) {
                ktl.core.waitSelector(`#${viewId}.ktlPersistenFormLoadedView`, 20000)
                    .then(function () {
                        formReady();
                    })
                    .catch(function () { })
            } else
                formReady();

            function formReady() {
                const keywords = ktlKeywords[viewId];
                if (keywords && keywords[kw] && keywords[kw].length) {
                    const kwList = ktl.core.getKeywordsByType(viewId, kw);
                    for (var kwIdx = 0; kwIdx < kwList.length; kwIdx++) {
                        execKw(kwList[kwIdx]);
                    }

                    function execKw(kwInstance) {
                        const options = kwInstance.options;
                        if (!ktl.core.hasRoleAccess(options)) return;

                        ktl.views.validateKtlCond(options, {}, viewId)
                            .then(valid => {
                                if (valid) {
                                    const params = kwInstance.params[0];
                                    if (params.length < 1) return;

                                    fieldsAr.push(...kwInstance.params[0]);

                                    //Add other Required fields as set by the Builder.
                                    const inputFields = Knack.views[viewId].getInputs();
                                    for (inputField of inputFields) {
                                        if (inputField.field && inputField.field.required && !fieldsAr.includes(inputField.field.key))
                                            fieldsAr.push(inputField.field.key);
                                    }

                                    fieldsAr = fieldsAr.map(field =>
                                        field && field.startsWith('field_') ? field : ktl.fields.getFieldIdFromLabel(viewId, field)
                                    );

                                    for (const fieldId of fieldsAr) {
                                        const labelSpan = $(`#${viewId} [data-input-id='${fieldId}'] .kn-label span`);
                                        if (labelSpan.length > 0 && !document.querySelector(`#${viewId} [data-input-id='${fieldId}'] .kn-required`)) {
                                            labelSpan.after('<span class="kn-required">*</span>');
                                            labelSpan.css('margin-right', '4px');
                                        }

                                        const fieldType = ktl.fields.getFieldType(fieldId);
                                        if (TEXT_DATA_TYPES.includes(fieldType)) {
                                            const inputField = $(`#${viewId} [data-input-id='${fieldId}'] input`);
                                            if (inputField.length) {
                                                for (const field of Array.from(inputField)) {
                                                    if (field.type !== 'hidden' && field.name !== 'street2' && field.name !== 'middle') {
                                                        validateNonEmptyTextField(field);
                                                        inputField.off('input.ktl_req change.ktl_req').on('input.ktl_req change.ktl_req', function (e) {
                                                            if (this.type !== 'hidden' && this.name !== 'street2' && this.name !== 'middle') {
                                                                validateNonEmptyTextField(this);

                                                                //For Street sub-field, check all other address sub-fields in case auto-complete is used.
                                                                if (this.name === 'street') {
                                                                    const subFields = document.querySelectorAll(`[data-input-id="${fieldId}"] input:not([type="hidden"])`);

                                                                    setTimeout(() => { //Leave enough time for auto-complete to fill the fields.
                                                                        for (const subField of subFields) {
                                                                            if (subField.type !== 'hidden' && subField.name !== 'street2') {
                                                                                validateNonEmptyTextField(subField);
                                                                            }
                                                                        }
                                                                    }, 300);
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                            } else {
                                                const paragraphText = $(`#${viewId} [data-input-id='${fieldId}'] .kn-textarea`);
                                                if (paragraphText.length) {
                                                    validateNonEmptyTextField(paragraphText[0]);
                                                    paragraphText.off('input.ktl_req').on('input.ktl_req', function () {
                                                        validateNonEmptyTextField(this);
                                                    });
                                                }
                                            }
                                        } else if (fieldType === 'connection') {
                                            validateNonEmptyDropdown(viewId, fieldId);
                                        } else if (fieldType === 'signature') {
                                            //Handle mouse moves and check if "Undo last stroke" button is present.
                                            const signatureSelector = `#${viewId} [data-input-id='${fieldId}'] .jSignature`;
                                            ktl.core.waitSelector(signatureSelector, 10000, 'visible')
                                                .then(() => {
                                                    $(signatureSelector).addClass('ktlNotValid_empty');

                                                    //Check upon mouse up...
                                                    $(document).off('mouseup.ktl_signature').on('mouseup.ktl_signature', () => {
                                                        setTimeout(() => {
                                                            const lastStrokeButton = `#${viewId} input[value="Undo last stroke"]`;
                                                            if ($(lastStrokeButton).length && $(lastStrokeButton).is(':visible'))
                                                                $(signatureSelector).removeClass('ktlNotValid_empty');
                                                            else
                                                                $(signatureSelector).addClass('ktlNotValid_empty');

                                                            ktl.views.updateSubmitButtonState(viewId, 'requiredFieldEmpty', !document.querySelector(`#${viewId} .ktlNotValid_empty`));
                                                        }, 100);
                                                    });
                                                })
                                                .catch(() => { })
                                        } else if (fieldType === 'rich_text') {
                                            validateNonEmptyTextField(fieldId);
                                        } else if (fieldType === 'multiple_choice') {
                                            validateNonEmptyTextField(fieldId);
                                        } else if (fieldType === 'boolean') {
                                            //TODO
                                            console.log('_req - Unsupported field type:', fieldType);
                                        } else
                                            console.log('_req - Unsupported field type:', fieldType);
                                    }

                                    //Dropdown selectors.
                                    $(document).on('KTL.dropDownValueChanged', (event, params) => {
                                        const { viewId: eventViewId, fieldId, records } = params;
                                        if (eventViewId === viewId && fieldsAr.includes(fieldId)) {
                                            $(`#${viewId} .search-choice-close`).off('click.ktl_removeoption').bindFirst('click.ktl_removeoption', function (e) {
                                                validateNonEmptyDropdown(viewId, fieldId);
                                            })

                                            validateNonEmptyDropdown(viewId, fieldId);
                                        }
                                    })

                                    function validateNonEmptyDropdown(viewId, fieldId) {
                                        setTimeout(() => {
                                            if (document.querySelector(`#${viewId}_${fieldId}_chzn.chzn-container-single`)) {
                                                //Single-selection dropdowns
                                                let selectedText = 'Select';
                                                const selector = $(`#${viewId}_${fieldId}_chzn .result-selected`);
                                                if (selector.length)
                                                    selectedText = selector[0].textContent;
                                                if (document.querySelector(`#${viewId} #kn-input-${fieldId} .kn-required`) && (selectedText === 'Select' || selectedText === 'Select...'))
                                                    $(`#${viewId}_${fieldId}_chzn .chzn-single`).addClass('ktlNotValid_empty');
                                                else
                                                    $(`#${viewId}_${fieldId}_chzn .chzn-single`).removeClass('ktlNotValid_empty');
                                            } else if (document.querySelector(`#${viewId}_${fieldId}_chzn.chzn-container-multi`)) {
                                                //Multi-selection dropdowns
                                                if (document.querySelector(`#${viewId} #kn-input-${fieldId} .kn-required`) && !document.querySelector(`#${viewId}_${fieldId}_chzn .result-selected`)) {
                                                    $((`#${viewId}_${fieldId}_chzn input`)).addClass('ktlNotValid_empty');
                                                    $((`#${viewId}_${fieldId}_chzn .chzn-choices`)).addClass('ktlNotValid_empty');
                                                } else {
                                                    $((`#${viewId}_${fieldId}_chzn input`)).removeClass('ktlNotValid_empty');
                                                    $((`#${viewId}_${fieldId}_chzn .chzn-choices`)).removeClass('ktlNotValid_empty');
                                                }
                                            }

                                            ktl.views.updateSubmitButtonState(viewId, 'requiredFieldEmpty', !document.querySelector(`#${viewId} .ktlNotValid_empty`));
                                        }, 200);
                                    }

                                    function validateNonEmptyTextField(field) {
                                        if (!field) return;

                                        if (typeof field === 'string' && field.startsWith('field_')) {
                                            field = Knack.objects.getField(field).attributes;
                                        }

                                        if (!field) return;

                                        const fieldId = field.key;

                                        if (field.type === 'rich_text') {
                                            const richTextObject = $(`#${viewId} #${fieldId}`).closest('.redactor-box').find('.redactor-editor');
                                            if (richTextObject.length) {
                                                const text = richTextObject[0].innerHTML.replace(/<\/?p>|<br\s*\/?>/gi, ' ').trim();
                                                if (text === '' || text === '\u200B')
                                                    $(richTextObject).addClass('ktlNotValid_empty');
                                                else
                                                    $(richTextObject).removeClass('ktlNotValid_empty');
                                            }
                                        } if (field.type === 'multiple_choice') {
                                            const element = $('#' + viewId + ' [name="' + fieldId + '"]');
                                            if (element.length) {
                                                let selectedText;
                                                if (Knack.objects.getField(`${fieldId}`).attributes.format.type === 'single') {
                                                    selectedText = element.val();
                                                    if (selectedText === '')
                                                        element.addClass('ktlNotValid_empty');
                                                    else
                                                        element.removeClass('ktlNotValid_empty');
                                                } else {
                                                    selectedText = $(`#${viewId} [name="${fieldId}"] option:selected`);
                                                    if (!selectedText.length) {
                                                        $((`#${viewId}_${fieldId}_chzn input`)).addClass('ktlNotValid_empty');
                                                        $((`#${viewId}_${fieldId}_chzn .chzn-choices`)).addClass('ktlNotValid_empty');
                                                    } else {
                                                        $((`#${viewId}_${fieldId}_chzn input`)).removeClass('ktlNotValid_empty');
                                                        $((`#${viewId}_${fieldId}_chzn .chzn-choices`)).removeClass('ktlNotValid_empty');
                                                    }
                                                }
                                            }
                                        } else {
                                            const fieldName = field.name;
                                            if (!fieldName) return;

                                            if (field.value === '')
                                                $(field).addClass('ktlNotValid_empty');
                                            else
                                                $(field).removeClass('ktlNotValid_empty');
                                        }

                                        ktl.views.updateSubmitButtonState(viewId, 'requiredFieldEmpty', !document.querySelector(`#${viewId} .ktlNotValid_empty`));
                                    }

                                    $(document).on('KTL.fieldValueChanged', (event, params) => {
                                        const { viewId: eventViewId, fieldId, text, e } = params;
                                        if (eventViewId === viewId && fieldsAr.includes(fieldId)) {
                                            validateNonEmptyTextField(e.target || fieldId);
                                        }
                                    })

                                    ktl.views.updateSubmitButtonState(viewId, 'requiredFieldEmpty', !document.querySelector(`#${viewId} .ktlNotValid_empty`));                                }
                            })
                    }
                }
            }
        }

        //Views
        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.processViewKeywords && (processViewKeywords = cfgObj.processViewKeywords);
                cfgObj.handleCalendarEventDrop && (handleCalendarEventDrop = cfgObj.handleCalendarEventDrop);
                cfgObj.quickToggleParams && (quickToggleParams = { ...quickToggleParams, ...cfgObj.quickToggleParams });
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
                    if (viewId && document.querySelector(`#${viewId}`)) {
                        var view = Knack.router.scene_view.model.views._byId[viewId];
                        if (!view || !view.attributes)
                            return resolve();

                        var viewType = view.attributes.type;
                        var formAction = view.attributes.action;
                        var triggerChange = (formAction === 'insert' || formAction === 'create') ? false : true;

                        let scrollLeft;
                        let scrollTop;
                        const viewWrapper = document.querySelector(`#${viewId} .kn-table-wrapper`);
                        if (viewWrapper) {
                            scrollLeft = document.querySelector(`#${viewId} .kn-table-wrapper`).scrollLeft;
                            scrollTop = document.querySelector(`#${viewId} .kn-table-wrapper`).scrollTop;
                        }

                        (function tryRefresh(retryCtr) {
                            $("#kn-loading-spinner").addClass('ktlHidden');
                            $(document).trigger('KTL.preprocessView', Knack.views[viewId]);

                            if (view && ['search', 'form', 'rich_text', 'menu', 'calendar' /*more types?*/].includes(viewType)) {
                                if (viewType === 'form') {
                                    if (formAction !== 'insert' && formAction !== 'create') {
                                        //This code causes an unintentional submit event.  Had to replace it with code below until a solution is found.
                                        //The intention is to update the Edit Form with most recent server data, in case it's been changed elsewhere.
                                        /*
                                        Knack.views[viewId].model.fetch({
                                            success: function (model, response, options) {
                                                Knack.views[viewId].render();

                                                setTimeout(() => {
                                                    $(document).trigger('KTL.loadFormData', viewId);
                                                    ktlProcessKeywords(view.attributes);
                                                }, 1000);
                                            },
                                            error: function (model, response, options) {
                                                console.log('tryRefresh error', viewId, response);
                                            }
                                        });
                                        */
                                        Knack.views[viewId].reloadForm(); //Reloads but with local data only, not from the server.
                                        Knack.views[viewId].render();
                                        setTimeout(() => {
                                            $(document).trigger('KTL.loadFormData', viewId);
                                            ktlProcessKeywords(view.attributes);
                                        }, 1000);
                                    } else {
                                        Knack.views[viewId].render();

                                        setTimeout(() => {
                                            $(document).trigger('KTL.loadFormData', viewId);
                                            ktlProcessKeywords(view.attributes);
                                        }, 1000);
                                    }
                                } else {
                                    if (triggerChange) {
                                        Knack.views[viewId].model.trigger('change');
                                        Knack.views[viewId].renderForm && Knack.views[viewId].renderForm();
                                        Knack.views[viewId].renderView && Knack.views[viewId].renderView();
                                    }

                                    //*** TODO:  Determine what is relevant and what is the exact sequence in Knack's code.
                                    if (viewType === 'search') //Do not call render() in search views because it erases the top form section.
                                        Knack.views[viewId].renderResults && Knack.views[viewId].renderResults();
                                    else
                                        Knack.views[viewId].render();

                                    Knack.views[viewId].renderGroups && Knack.views[viewId].renderGroups();
                                    Knack.views[viewId].postRender && Knack.views[viewId].postRender(); //This is needed for menus.
                                }

                                $("#kn-loading-spinner").removeClass('ktlHidden');
                                return resolve();
                            } else {
                                Knack.views[viewId].model.fetch({
                                    success: function (model, response, options) {
                                        if (['details', 'table' /*more types?*/].includes(viewType)) {
                                            //*** TODO:  Determine what is relevant and what is the exact sequence in Knack's code.

                                            if (viewType !== 'table')
                                                Knack.views[viewId].render();

                                            Knack.views[viewId].renderResults && Knack.views[viewId].renderResults();
                                            Knack.views[viewId].postRender && Knack.views[viewId].postRender();
                                        }

                                        if (viewWrapper) {
                                            if (scrollTop)
                                                document.querySelector(`#${viewId} .kn-table-wrapper`).scrollTop = scrollTop;

                                            if (scrollLeft)
                                                document.querySelector(`#${viewId} .kn-table-wrapper`).scrollLeft = scrollLeft;
                                        }

                                        setTimeout(() => {
                                            $("#kn-loading-spinner").removeClass('ktlHidden');
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
                                            if (ktlKeywords[viewId] && ktlKeywords[viewId]._ar) {
                                                $("#kn-loading-spinner").removeClass('ktlHidden');
                                                return resolve(); //Just ignore, we'll try again shortly anyways.
                                            }

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

                            $("#kn-loading-spinner").removeClass('ktlHidden');
                            return resolve();
                        }
                    } else {
                        resolve(); //Normal: Can happen if view is hidden by a display rule.
                    }
                });
            },

            refreshViewArray: function (viewsToRefresh) {
                return new Promise(function (resolve, reject) {
                    if (!viewsToRefresh || viewsToRefresh.length === 0) {
                        clearTimeout(failsafe);
                        return resolve();
                    } else {
                        var promisesArray = [];
                        viewsToRefresh.forEach(function (viewId) {
                            if (viewId.startsWith('view_')) {
                                promisesArray.push(
                                    ktl.views.refreshView(viewId)
                                        .then(() => {
                                            //ktl.log.clog('green', 'View refreshed successfully: ' + viewId);
                                        })
                                );
                            }
                        })

                        Promise.all(promisesArray)
                            .then(() => {
                                //ktl.log.clog('green', 'All views refreshed: ' + viewsToRefresh);
                                resolve();
                            })
                            .catch(() => {
                                ktl.log.clog('red', 'Error refreshing views: ' + viewsToRefresh);
                                reject();
                            })
                            .finally(() => { clearTimeout(failsafe); })
                    }

                    var failsafe = setTimeout(() => {
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
                                    if (!autoRefreshViews[viewId].pause)
                                        ktl.views.refreshView(viewId).then(function () { });
                                }, intervalDelay * 1000);

                                autoRefreshViews[viewId] = { delay: intervalDelay, intervalId: intervalId };
                            }
                        }
                    })
                    $('#' + PAUSE_AUTO_REFRESH_CHECKBOX_ID + '-label-id').css('background-color', '');
                } else
                    stopAutoRefresh();

                $('#' + PAUSE_AUTO_REFRESH_CHECKBOX_ID + '-id').prop('checked', !run);

                //Stop all auto refresh interval timers for all views.
                function stopAutoRefresh(restart = true) {
                    $('#' + PAUSE_AUTO_REFRESH_CHECKBOX_ID + '-label-id').css('background-color', 'red');
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

            pauseAutoRefreshForView: function (viewId) {
                if (!viewId || !autoRefreshViews[viewId]) return;
                autoRefreshViews[viewId].pause = true;
            },

            runAutoRefreshForView: function (viewId) {
                if (!viewId || !autoRefreshViews[viewId]) return;
                delete autoRefreshViews[viewId].pause;
            },

            //Hide the whole view, typically used when doing background searches, or GET API calls.
            hideView: function (viewId, keywords) {
                const kw = '_hv';
                if (!(viewId && keywords && keywords[kw])) return;

                const keywordsArray = ktl.core.getKeywordsByType(viewId, kw);
                const view = $('#' + viewId);

                if (!keywordsArray.length)
                    view.addClass('ktlHidden_hv');
                else {
                    keywordsArray.forEach((keyword, index) => {
                        if (keyword.options.ktlRoles) {
                            const roles = keyword.options.ktlRoles.split(',').map((role) => role.trim());
                            if (ktl.account.matchUserRoles(roles))
                                view.addClass('ktlHidden_hv_' + index);
                        }

                        if (keyword.options.ktlCond) {
                            const hide = () => { view.addClass('ktlHidden_hv_' + index); }
                            const unhide = () => { view.removeClass('ktlHidden_hv_' + index); }

                            const conditions = keyword.options.ktlCond.replace(']', '').split(',').map(e => e.trim());
                            const viewParam = conditions[3] || '';
                            const viewParamId = ktl.scenes.findViewWithTitle(viewParam);
                            const viewType = ktl.views.getViewType(viewParamId);

                            if (viewType === 'form') {
                                hide();
                                ktl.core.waitSelector('.ktlPersistenFormLoadedScene', 5000)
                                    .then(() => {
                                        ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide);
                                    })
                                    .catch(() => { })
                            } else {
                                ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide);
                            }
                        }
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
                        if (keyword.options.ktlRoles) {
                            const roles = keyword.options.ktlRoles.split(',').map((role) => role.trim());
                            if (ktl.account.matchUserRoles(roles))
                                $('#' + viewId).remove();
                        }

                        if (keyword.options.ktlCond) {
                            let validatingKtlCond = true;
                            const hide = () => { $('#' + viewId).addClass('ktlHidden'); }
                            const unhide = () => {
                                if (validatingKtlCond)
                                    $('#' + viewId).removeClass('ktlHidden');
                                else
                                    $('#' + viewId + '.ktlHidden').remove();
                            }

                            const conditions = keyword.options.ktlCond.replace(']', '').split(',').map(e => e.trim());
                            const viewParam = conditions[3] || '';
                            const viewParamId = ktl.scenes.findViewWithTitle(viewParam);
                            const viewType = ktl.views.getViewType(viewParamId);

                            if (viewType === 'form') {
                                hide();
                                $(document).one('KTL.persistentForm.completed.scene', () => {
                                    ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide)
                                        .then(() => { validatingKtlCond = false })
                                });
                            } else {
                                ktl.views.hideUnhideValidateKtlCond(keyword.options, hide, unhide)
                                    .then(() => { validatingKtlCond = false })
                            }
                        }
                    });
                }
            },

            addViewId: function (view, fontStyle = 'color: red; font-weight: bold; font-size:small') {
                if (!view) return;

                const viewId = view.key;
                const userPrefs = ktl.userPrefs.getUserPrefs();

                if (userPrefs.showViewId && !$(`#${viewId}-label-id`).length) {
                    const label = $('<label>', {
                        id: `${viewId}-label-id`,
                        text: `    ${viewId}`,
                        css: {
                            marginLeft: '10px',
                            marginTop: '8px',
                            cssText: fontStyle
                        }
                    });

                    const viewElement = $(`#${viewId}`);
                    const submitBtn = $(`.kn-submit:has(input[value="${viewId}"])`);
                    const divHdr = viewElement.find('h1:not(#knack-logo), h2, h3, h4').first();
                    const divTitle = viewElement.find('.kn-title').first();

                    //If there's no title or no title text, let's try our best to get an elegant layout.
                    if (divHdr.length && divTitle.length && divTitle.css('display') !== 'none' && divHdr.text()) {
                        if (ktlKeywords[viewId] && ktlKeywords[viewId]._ht) {
                            viewElement.prepend(label);
                        } else {
                            divTitle.append(label);
                        }
                    } else if (divHdr.length) {
                        divHdr.append(label);
                    } else if (submitBtn.length) {
                        submitBtn.append(label);
                    } else {
                        const targetElement = viewElement.find('.kn-form.kn-view, .control, .kn-details.kn-view').first();
                        if (targetElement.length) {
                            targetElement.append(label);
                        } else {
                            label.css({ 'margin-top': '8px', 'margin-bottom': '16px', 'display': 'block' });
                            viewElement.prepend(label);
                        }
                    }
                } else if (!userPrefs.showViewId) {
                    $(`#${viewId}-label-id`).remove();
                }
            },

            //Required by Bulk Ops and Remove/Hide Columns features.
            //Restores proper cell alignment due to added groups and removed columns.
            fixTableRowsAlignment: function (viewId) {
                return new Promise(function (resolve) {
                    if (!viewId || document.querySelector('#' + viewId + ' tr.kn-tr-nodata'))
                        return resolve();

                    if (ktl.bulkOps.getBulkOpsActive(viewId)) {
                        //For summary lines, prepend a space if Bulk Ops are enabled.
                        var viewObj = ktl.views.getView(viewId);
                        if (!viewObj)
                            return resolve();

                        checkSummaryFixNeeded();

                        //For groups, extend line up to end.
                        var cols = (viewObj.results && viewObj.results.columns) || viewObj.columns;
                        //var cols = viewObj.columns;
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
                                        if (!$(this).find('td').hasClass('blankCell'))
                                            $(this).prepend(`<td class="blankCell" style="border-top: 1px solid #dadada;"></td>`);
                                    });
                                })
                                .catch(function (e) { ktl.log.clog('purple', 'Failed waiting for table groups.', viewId, e); })
                        }
                    } else {
                        if (ktlKeywords[viewId] && (ktlKeywords[viewId]._hc || ktlKeywords[viewId]._rc))
                            fixSummaryRows();
                        else
                            checkSummaryFixNeeded();
                    }

                    function checkSummaryFixNeeded() {
                        if (ktl.views.viewHasSummary(viewId)) {
                            var sel = '#' + viewId + ' tr.kn-table-totals';
                            ktl.core.waitSelector(sel, SUMMARY_WAIT_TIMEOUT) //Totals and groups usually need a bit of extra wait time due to delayed server response.
                                .then(function () {
                                    var totalRows = $('#' + viewId + ' tr.kn-table-totals');
                                    if (!$('#' + viewId + ' tr.kn-table-totals td')[0].classList.contains('blankCell')) {
                                        var headers = $('#' + viewId + ' thead tr th:visible').length;
                                        var totals = $('#' + viewId + ' tr.kn-table-totals:first').children('td:not(.ktlDisplayNone)').length;

                                        if (headers > totals) {
                                            for (var i = totalRows.length - 1; i >= 0; i--) {
                                                var row = totalRows[i];
                                                $(row).prepend('<td class="blankCell" style="background-color: #eee; border-top: 1px solid #dadada;"></td>');
                                            }
                                        }

                                        fixSummaryRows();
                                    }
                                })
                                .catch(function (e) { ktl.log.clog('purple', 'fixTableRowsAlignment / hasSummary - failed waiting for table totals.', viewId, e); })
                        }
                    }

                    //Alignment fix for Summary rows (totals).
                    function fixSummaryRows() {
                        var headers = $('#' + viewId + ' thead tr th:visible').length;
                        var totals = $('#' + viewId + ' tr.kn-table-totals:first').children('td:not(.ktlDisplayNone)').length;

                        for (var j = 0; j < (totals - headers); j++) {
                            $('#' + viewId + ' .kn-table-totals td:last-child').remove();
                        }
                    }

                    resolve();
                })
            },

            addTimeStampToHeader: function (viewId, keywords, fontStyle = 'color: gray; font-weight: bold; font-size:x-large') {
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
                    timestamp.classList.add('ktlTimeStamp');
                    timestamp.appendChild(document.createTextNode(ktl.core.getCurrentDateTime(false, true, false, false)));

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
                } else {
                    //Just update existing.  This happens with Search views, where render() is not called, thus keeping the timestamp.
                    $('#' + viewId + '-timestamp-id')[0].textContent = ktl.core.getCurrentDateTime(false, true, false, false);
                }
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

                        let currentOptionsMultipleChoices = [];

                        //If the dropdown has a search field, trigger a search on the requested text now.
                        if ($(viewSel + '[id$="' + fieldId + '_chzn"] .ui-autocomplete-input').length > 0) {
                            //If it's a multiple selection, we must take note of the current options and merge the next one coming, if found.
                            if (!isSingleSelection) {
                                const currentOptions = $(`#${viewId}-${fieldId} option`);
                                currentOptions.each(function () {
                                    if ($(this).text() !== srchTxt) {
                                        currentOptionsMultipleChoices.push(this);
                                    }
                                });
                            }

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
                                                        ktl.core.timedPopup('Could not find ' + srchTxt, 'error', 3000);
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
                                                    ktl.core.timedPopup('Could not find ' + srchTxt, 'error', 3000);

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
                                        //chznContainer.find('.chzn-drop').css('left', '-9000px'); //Hide results until parsed.

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
                                                delete dropdownSearching[fieldId];

                                                //Insert back previous selected entries.
                                                const input = $(`#${viewId}-${fieldId}`);
                                                for (const opt of currentOptionsMultipleChoices) {
                                                    input.append(opt);
                                                }

                                                if ($(`#${viewId}_${fieldId}_chzn .chzn-results li.no-results`).length) {
                                                    Knack.hideSpinner();
                                                    ktl.core.timedPopup(srchTxt + ' not Found', 'error', 3000);
                                                } else {
                                                    if (results.length === 1) {
                                                        $(`#${viewId}-${fieldId} option:not("selected")`).attr('selected', '');
                                                        input.trigger("liszt:updated");
                                                        if (showPopup)
                                                            ktl.core.timedPopup('Found ' + foundText);
                                                    } else {
                                                        if (showPopup)
                                                            ktl.core.timedPopup('Found many, select from list...', 'warning');
                                                        input.trigger("liszt:updated");
                                                    }

                                                    chznContainer.find('.chzn-drop').css('left', ''); //Put back, since was moved to -9000px.
                                                    Knack.hideSpinner();
                                                    chznContainer.focus(); //Allow using up/down arrows to select result and press enter.
                                                }
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

                                return resolve(foundData);
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
                const viewType = view.type;
                let columns;
                if (viewType === 'search')
                    columns = view.model.results_model.view.columns;
                else
                    columns = view.model.view.columns;

                columns.forEach(col => {
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

            //Can be used with grids, search and list views to find a specific record that has a given value for a given field.
            //It returns the first record found, or undefined if nothing is found.
            //The data source can come from the view's render event or directly from the Knack.view.view_id data object.
            findRecord: function (data = [], fieldId = '', value = '') {
                if (!data.length || !fieldId || !value) return;
                for (const record of data) {
                    if (record[fieldId]) {
                        if (record[fieldId] === value)
                            return record;
                    } else if (record.attributes) {
                        if (record.attributes[fieldId] === value)
                            return record.attributes;
                    }
                }

                return undefined;
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
                            var uvxViewId = ktl.scenes.findViewWithKeywordInCurrentScene('_uvx', viewId);
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
                            var uvcViewId = ktl.scenes.findViewWithKeywordInCurrentScene('_uvc', viewId);
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

                $('#' + viewId + ' .kn-form-confirmation').addClass('ktlHidden');
                $('#' + viewId + ' input').removeClass('input-error');
                $('.kn-message.is-error').remove();

                preprocessFields(viewId, e)
                    .then(() => {
                        preprocessViews(viewId, e)
                            .then(() => {
                                $('#' + viewId + ' .kn-form-confirmation').removeClass('ktlHidden');
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
                                    var uvcSearchViewId = ktl.scenes.findViewWithKeywordInCurrentScene('_uvc', viewId);
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

                //Scan all fields in view to find any keywords.
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
                } else if (viewType === 'table' || viewType === 'list')
                    foundFields.push(...view.fields.filter(f => !!f).map(field => field.key));
                else if (viewType === 'details') {
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

                var fieldsWithKwObj = {};
                for (var j = 0; j < foundFields.length; j++)
                    ktl.fields.getFieldKeywords(foundFields[j], fieldsWithKwObj);

                return fieldsWithKwObj;
            },

            getAllFieldsWithKeywordsInObject: function (objectId) {
                if (!objectId || !Knack.objects._byId[objectId]) return {};

                let fieldsWithKwObj = {};

                Knack.objects._byId[objectId].attributes.fields.filter(f => !!f).forEach(field =>
                    fieldsWithKwObj = {
                        ...fieldsWithKwObj,
                        ...ktl.fields.getFieldKeywords(field.key)
                    }
                );

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

                const field = model.view.fields.find((field) => !!field && field.key === fieldId);
                if (field) {
                    if (event.currentTarget.classList.value.split(' ').every((c) => !c.includes('sorted'))) { // Not already sorted. First click
                        const isDateTime = (field.type === 'date_time') || (field.type === 'equation' && field.format.equation_type === 'date');
                        if ((isDateTime && !event.ctrlKey && !event.metaKey) || (!isDateTime && (event.ctrlKey || event.metaKey))) {
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

                    var success = false;
                    var failure = false;
                    var loggedIn = (Knack.getUserAttributes() !== 'No user found');

                    var intervalId = setInterval(function () {
                        const successMsg = document.querySelector('#' + viewId + ' .kn-message.success');
                        success = !!(successMsg && successMsg.checkVisibility());
                        if (!loggedIn && (Knack.getUserAttributes() !== 'No user found'))
                            success = true;
                        const failureMsg = document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body');
                        failure = !!(failureMsg && failureMsg.checkVisibility());
                        if (success || failure) {
                            clearInterval(intervalId);
                            clearTimeout(failsafe);
                            if (success)
                                return resolve({ outcome: 'waitSubmitOutcome, ' + viewId + ' : ' + successMsg.textContent.replace(/\n/g, '').trim() });

                            if (failure)
                                return reject('waitSubmitOutcome, ' + viewId + ' : ' + failureMsg.textContent.replace(/\n/g, '').trim());
                        }
                    }, 200);

                    var failsafe = setTimeout(function () {
                        clearInterval(intervalId);
                        reject('waitSubmitOutcome timeout error in ' + viewId);
                    }, 30000);
                })
            },

            //Will disable the Submit button of the viewId, if any of the validationKey exists.
            //In other words, the ktlInvalidItemObj must be empty to enable Submit.
            //Global flag formPreValidation must be enabled.
            updateSubmitButtonState: function (viewId, validationKey, isValid) {
                if (!viewId || !validationKey || !ktl.core.getCfg().enabled.formPreValidation) return;

                var submit = document.querySelector('#' + viewId + ' .is-primary');
                if (!submit) return;

                if (submit.validity) {
                    if (!submit.validity.ktlInvalidItemObj)
                        submit.validity.ktlInvalidItemObj = {};
                } else
                    submit.validity = { ktlInvalidItemObj: {} };

                if (isValid === true)
                    delete submit.validity.ktlInvalidItemObj[validationKey];
                else
                    submit.validity.ktlInvalidItemObj[validationKey] = false; //Value (false) doesn't matter here, only the key's existence.

                if ($.isEmptyObject(submit.validity.ktlInvalidItemObj))
                    submit.removeAttribute('disabled');
                else {
                    submit.setAttribute('disabled', true);
                    ktl.scenes.spinnerWatchdog(false); //Don't let the disabled Submit cause a page reload.
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
                const columns = (model.results_model && model.results_model.view && model.results_model.view.columns.length) ? model.results_model.view.columns : model.view.columns;

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

                    if (view === 'ktlLoggedInAccount') {
                        const userAttr = Knack.getUserAttributes();
                        if (userAttr !== 'No user found' && field.startsWith('field_')) {
                            const userValue = userAttr['values'][field];
                            return resolve(ktlCompare(userValue, operator, value));
                        } else {
                            console.error(`ktlCond - ktlLoggedInAccount in ${keywordViewId} requires a fieldId to compare against not a field label ${field}.`);
                            return resolve(false);
                        }
                    }

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
                        const selector = ktl.core.extractJQuerySelector(field, viewId);
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

                    if (view === 'ktlLoggedInAccount') {
                        const userAttr = Knack.getUserAttributes();
                        if (userAttr !== 'No user found' && field.startsWith('field_')) {
                            const userValue = userAttr['values'][field];
                            return resolve(ktlCompare(userValue, operator, value));
                        } else {
                            console.error(`ktlCond - ktlLoggedInAccount in ${keywordViewId} requires a fieldId to compare against not a field label ${field}.`);
                            return resolve(false);
                        }
                    }

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
                            const selector = ktl.core.extractJQuerySelector(field, viewId);
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

            getView: function (viewId) {
                if (!viewId) return;
                let view = Knack.views[viewId];
                if (view)
                    return view.model.view;
                else {
                    const scenes = Knack.scenes.models;
                    for (const scene of scenes) {
                        for (const view of scene.views.models) {
                            if (view.attributes.key === viewId)
                                return view.attributes;
                        }
                    }
                }
            },

            getViewType: function (viewId) {
                if (!viewId) return;
                var viewObj = ktl.views.getView(viewId);
                if (viewObj)
                    return viewObj.type;
            },

            getViewSourceName: function (viewId) {
                if (!viewId) return;
                const view = ktl.views.getView(viewId);
                if (view)
                    return Knack.objects._byId[view.source.object].attributes.name;
            },

            applyZoomLevel: function (viewId, keywords) {
                if (!viewId) return;

                const kw = '_zoom';
                if (keywords && keywords[kw] && keywords[kw].length && keywords[kw][0].params && keywords[kw][0].params.length) {
                    const options = keywords[kw][0].options;
                    if (!ktl.core.hasRoleAccess(options)) return;

                    $('#' + viewId).addClass('ktlHidden_zm');

                    const sel = ktl.core.computeTargetSelector(viewId, '', options);
                    ktl.core.waitSelector(sel, 20000)
                        .then(() => {
                            var zoomLevel = keywords[kw][0].params[0][0];
                            if (!isNaN(zoomLevel))
                                $(sel).css({ 'zoom': zoomLevel + '%' });
                        })
                        .catch(function () { })
                        .finally(() => {
                            $('#' + viewId).removeClass('ktlHidden_zm');
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
                        const isJQueryTarget = kwInstance.options && kwInstance.options.ktlTarget && ktl.core.extractJQuerySelector(kwInstance.options.ktlTarget, viewId);
                        if (isJQueryTarget)
                            processClass(options);
                        else {
                            (function processClassForAllRecords(idx) {
                                let recordObj = data[idx];
                                processClass(options, recordObj)
                                    .then(() => {
                                        if (++idx < data.length)
                                            processClassForAllRecords(idx);
                                    })
                            })(0);
                        }
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
                                                resolve(); //Normal in many cases.
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

                    const url = $(`#${viewId} a`).filter(function () {
                        return $.trim($(this).text()) === keywords[kw][0].params[0][0];
                    }).attr('href'); // Get the href attribute of the matched element

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
                        $('#' + viewId).addClass('ktlHidden_dr');
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
                                    $('#' + viewId).removeClass('ktlHidden_dr');
                                }
                            });
                        } else
                            $('#' + viewId).removeClass('ktlHidden_dr');
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
                    copyToClipboard.innerHTML = 'Copy to Clipboard';
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

                //Process view keyword
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

                let view = ktl.views.getView(viewId);
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

            //Returns the zero-based index of the column with fieldId or header label.  Works with Action links also.
            //Hidden columns are counted in (not ignored) to get the real index, as if they were visible.
            getColumnIndex: function (viewId, headerOrFieldId) {
                if (!viewId || !headerOrFieldId) return;
                if (!['table', 'search'].includes(ktl.views.getViewType(viewId))) return;

                const headerToMatch = headerOrFieldId.startsWith('field_') ? ktl.fields.getFieldLabelFromId(viewId, headerOrFieldId) : headerOrFieldId;
                const foundHeader = $(`#${viewId} thead th`).filter(function () {
                    return $(this).text().trim() === headerToMatch;
                });

                if (foundHeader.length) {
                    return foundHeader.index();
                }
            },

            //Returns undefined if view type is not applicable, or the number of summaries, from 0 to 4.
            viewHasSummary: function (viewId) {
                var viewObj = ktl.views.getView(viewId);
                if (viewObj && viewObj.totals)
                    return viewObj.totals.length;
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
            addTooltipsToFields: function (viewId, tooltipText, viewType, tooltipIconPosition, tooltipIcon) {
                if (!viewId || !viewType) return;
                viewType = viewType === 'list' ? 'details' : viewType;

                const icon = `<i class="fa ${tooltipIcon} ktlTooltipIcon ktlTtipIcon-${viewType}-view"> </i>`;

                //If view ttip found remove it.  Field has precedence.
                if ($(`${tooltipIconPosition} .ktlTooltipIcon`).length)
                    $(`${tooltipIconPosition} .ktlTooltipIcon`).remove();

                $(tooltipIconPosition)
                    .append(icon)
                    .find('.table-fixed-label')
                    .css('display', 'inline-block');

                const pos = $(tooltipIconPosition);
                if (pos.length) {
                    const isColumnCollapsed = pos[0].classList.contains('ktlCollapsedColumn');
                    if (isColumnCollapsed) {
                        $(`${tooltipIconPosition} i.ktlTooltipIcon`).hide();
                    }
                }

                $(`${tooltipIconPosition} i.${tooltipIcon}`).on('mouseenter.ktlTooltip', function (e) {
                    const icon = $(this);

                    const tooltipElement = $(`<div class="ktlTooltip ktlTtip-${viewType}-view">${tooltipText}</div>`).appendTo('body');
                    const tooltipWidth = tooltipElement.outerWidth();
                    const tooltipHeight = tooltipElement.outerHeight();

                    let tooltipLeft = e.clientX - tooltipWidth / 2;
                    let tooltipTop = e.clientY - tooltipHeight - 20;

                    if (tooltipLeft < 0) {
                        tooltipLeft = 10;
                    } else if (tooltipLeft + tooltipWidth > $(window).width()) {
                        tooltipLeft = $(window).width() - tooltipWidth - 10;
                    }

                    if (tooltipTop < 0) {
                        tooltipTop = e.clientY + 20;
                    }

                    // Set the style properties directly on the element's style object
                    Object.assign(tooltipElement[0].style, {
                        position: 'fixed',
                        left: tooltipLeft + 'px',
                        top: tooltipTop + 'px',
                        zIndex: 2000
                    });

                    icon.data('tooltipElement', tooltipElement);

                    tooltipElement.show();
                }).on('mouseleave.ktlTooltip', function () {
                    const icon = $(this);
                    // Retrieve the tooltipElement from the icon
                    const tooltipElement = icon.data('tooltipElement')

                    tooltipElement.remove();
                });
            },

            addHideShowIconsToTableHeaders: function (viewId) {
                if (!viewId || ktl.scenes.isiFrameWnd() || (cfg.hscAllowed && !cfg.hscAllowed(viewId)))
                    return;

                if (!['table', 'search'].includes(ktl.views.getViewType(viewId)))
                    return;

                const hasBulkOperationColumn = $(`#${viewId} .kn-table thead tr th:first-child`).find('input[type="checkbox"]').length > 0;

                $(`#${viewId} .kn-table thead tr th`).each(function (index) {
                    if (index === 0 && hasBulkOperationColumn)
                        return; // Skip Bulk Checkboxes Column

                    if (!$(this).find('.ktlHideShowColumnIcon').length) {
                        $(this).prepend(`<i class="ktlHideShowColumnIcon fa fa-caret-left" title="${$(this).text().trim()}"/>`);
                    }
                });

                $(`#${viewId} thead th .table-fixed-label`).css('display', 'inline-flex');

                //Always returns an encoded version of the columns' headers.  Needed to support question marks in headers.
                function getCollapsedColumns() {
                    const activeFilter = ktl.userFilters.getActiveFilter(viewId);

                    if (activeFilter && activeFilter['collapsed'])
                        return activeFilter['collapsed'];
                    else {
                        const params = (getUrlParameter(`${viewId}_collapsed`) || '')
                            .split(',')
                            .filter(value => value != '').map(value=>encodeURIComponent(value));

                        return params;
                    }
                }

                getCollapsedColumns().forEach(title => {
                    $(`#${viewId} .kn-table th`).each((index, element) => {
                        if ($(element).text().trim() === decodeURIComponent(title))
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
                        .off('click.ktl_hsc');
                }

                function hideColumn(viewId, columnIndex) {
                    $(`#${viewId} tr > th:nth-child(${columnIndex}) i.ktlTooltipIcon`).hide()
                    $(`#${viewId} .kn-table tr`).find(`th:nth-child(${columnIndex}), td:nth-child(${columnIndex})`)
                        .css('width', cfg.hscCollapsedColumnsWidth + 'px')
                        .css('min-width', cfg.hscCollapsedColumnsWidth + 'px')
                        .css('padding', '0px')
                        .addClass('ktlCollapsedColumn');

                    // Replace click events to unshrink column on the next event
                    $(`#${viewId} .kn-table th.ktlCollapsedColumn, #${viewId} .kn-table td.ktlCollapsedColumn`).off('click.ktl_hsc').bindFirst('click.ktl_hsc', function (collapsedColumnClickEvent) {
                        collapsedColumnClickEvent.preventDefault();
                        collapsedColumnClickEvent.stopPropagation();
                        collapsedColumnClickEvent.stopImmediatePropagation();

                        const columnIndex = $(collapsedColumnClickEvent.currentTarget).index();

                        $(collapsedColumnClickEvent.currentTarget).closest(".kn-table").find("thead th").eq(columnIndex).find("i.ktlHideShowColumnIcon").click();
                    });
                }

                $(`#${viewId} .kn-table thead i.ktlHideShowColumnIcon`).on('click', function (iconClickEvent) {
                    iconClickEvent.preventDefault();
                    iconClickEvent.stopPropagation();

                    const columnIndex = $(this).parent().index() + 1;
                    const title = encodeURIComponent($(this).parent().text().trim());
                    let collapsedColumns = getCollapsedColumns();

                    if ($(this).parent().hasClass('ktlCollapsedColumn')) {
                        showColumn(viewId, columnIndex);
                        collapsedColumns = collapsedColumns.filter(t => t != title);
                    } else {
                        hideColumn(viewId, columnIndex);
                        if (collapsedColumns.findIndex(t => t === title) < 0)
                            collapsedColumns.push(title);
                    }

                    if (!ktl.userFilters.appendToActiveFilter(viewId, 'collapsed', collapsedColumns)) {
                        let parameters = `${viewId}_collapsed=${collapsedColumns.join(',')}`;
                        const [url, params] = document.location.href.split('?');

                        if (params) {
                            const filteredParams = params.split('&').filter(v => !v.includes(`${viewId}_collapsed`));
                            filteredParams.push(parameters);
                            parameters = filteredParams.join('&');
                        }

                        window.history.replaceState(null, '', [url, parameters].join('?'));
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

                //Assume all views by default, in case ktlTarget is "page"...
                var linkSelector = `.knTable td a:not(".kn-action-link"), .kn-detail-body a:not(".kn-action-link")`;

                //...and if not, then only this view.
                if (!options || (options && options.ktlTarget && options.ktlTarget !== 'page'))
                    linkSelector = `#${viewId} .knTable td a:not(".kn-action-link"), #${viewId} .kn-detail-body a:not(".kn-action-link")`;

                const elements = $(linkSelector);
                elements.each((ix, el) => {
                    let preventClick = false;
                    if (el.classList.contains('kn-link'))
                        preventClick = true;
                    else {
                        let fieldId;
                        let fld = el.closest('[class^="field_"]');
                        if (fld)
                            fieldId = fld.getAttribute('data-field-key');
                        else {
                            const detailsView = $(el).closest('.kn-detail');
                            if (detailsView.length)
                                fieldId = detailsView.attr('class').split(/\s+/)[1];
                        }

                        if (!fieldId || !fieldId.startsWith('field_')) return;

                        const fieldType = ktl.fields.getFieldType(fieldId);
                        if (fieldType === 'link' || fieldType === 'phone' || fieldType === 'email')
                            preventClick = true;
                    }

                    if (preventClick && el.href)
                        elements.addClass('ktlLinkDisabled');
                })
            },

            /** Stick table Headers
             * @param {string} viewId
             * @param {number} viewHeight */
            stickTableHeader: function (viewId, viewHeight) {
                if (!Knack.app.attributes.design.regions.header.isLegacy)
                    $(`.knHeader__menu-dropdown-list`).css({ 'z-index': '5' }); //4 works, 5 for safety margin.

                $(`#${viewId} table, #${viewId} .kn-table-wrapper`)
                    .css('height', viewHeight + 'px')
                    .find('th')
                    .css({ 'position': 'sticky', 'top': '-2px', 'z-index': '2' });
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

            //Used to perform bulk edits and copies of records programmatically.
            processAutomatedBulkOps: function (bulkOpsViewId, bulkOpsRecordsArray, requestType = 'PUT', viewsToRefresh = [], showSpinner = true, enableShowProgress = true) {
                return new Promise(function (resolve, reject) {
                    if (!bulkOpsViewId || !bulkOpsRecordsArray || !bulkOpsRecordsArray.length || !requestType)
                        return reject('Called processAutomatedBulkOps with invalid parameters.');

                    requestType = requestType.toUpperCase();

                    //Check if there's already an existing queue for this view.
                    if (!automatedBulkOpsQueue[bulkOpsViewId]) { //No, then add all array.
                        automatedBulkOpsQueue[bulkOpsViewId] = bulkOpsRecordsArray;
                    } else { //Yes, then add only new requests, i.e. where the record ID is not found.
                        //Ignore updates for now, until a solution is found to double API calls.

                        /*
                        console.log('existing', automatedBulkOpsQueue[bulkOpsViewId]);
                        bulkOpsRecordsArray.forEach(newRequest => {
                            const queue = automatedBulkOpsQueue[bulkOpsViewId];
                            if (!queue.some(request => request.id === newRequest.id)) {
                                ktl.log.clog('blue', 'New entry added', bulkOpsViewId, newRequest);
                                queue.push(newRequest);
                            }
                        });
                        */
                    }

                    const objName = ktl.views.getViewSourceName(bulkOpsViewId);

                    enableShowProgress && ktl.core.infoPopup();
                    ktl.views.autoRefresh(false);
                    ktl.scenes.spinnerWatchdog(false);

                    var arrayLen = automatedBulkOpsQueue[bulkOpsViewId].length;

                    var idx = 0;
                    var countDone = 0;
                    let results = []; //For GET requests.
                    var itv = setInterval(() => {
                        if (idx < arrayLen) {
                            if (automatedBulkOpsQueue[bulkOpsViewId])
                                updateRecord(automatedBulkOpsQueue[bulkOpsViewId][idx++]);
                        } else
                            clearInterval(itv);
                    }, 150);

                    function updateRecord(apiData) {
                        let recId = null;
                        let filters;
                        if (!apiData || $.isEmptyObject(apiData)) return;

                        showProgress();

                        if (requestType === 'PUT') {
                            recId = apiData.id;
                            apiData = apiData.apiData;
                            delete apiData.id;
                        } else if (requestType === 'GET') {
                            filters = apiData.filters;
                            recId = apiData.id; //Needed to map the origin of the request and the result.
                        }

                        ktl.core.knAPI(bulkOpsViewId, recId, apiData, requestType, viewsToRefresh, showSpinner, filters)
                            .then(function (data) {
                                if (requestType === 'GET')
                                    results.push(data);

                                if (automatedBulkOpsQueue[bulkOpsViewId] && (++countDone === automatedBulkOpsQueue[bulkOpsViewId].length)) {
                                    automatedBulkOpsQueue[bulkOpsViewId] = [];
                                    delete automatedBulkOpsQueue[bulkOpsViewId];

                                    ktl.core.removeInfoPopup();
                                    if (requestType === 'GET') {
                                        ktl.core.removeTimedPopup();
                                        ktl.scenes.spinnerWatchdog();
                                        ktl.views.autoRefresh();
                                        Knack.hideSpinner();
                                        return resolve(results);
                                    } else if (document.querySelector(`#${bulkOpsViewId}`)) {
                                        Knack.showSpinner();
                                        ktl.views.refreshView(bulkOpsViewId).then(function () {
                                            ktl.core.removeTimedPopup();
                                            ktl.scenes.spinnerWatchdog();
                                            setTimeout(function () {
                                                ktl.views.autoRefresh();
                                                Knack.hideSpinner();
                                                return resolve(countDone);
                                            }, 1000);
                                        })
                                    }
                                } else
                                    showProgress();
                            })
                            .catch(function (reason) {
                                ktl.core.removeInfoPopup();
                                ktl.core.removeTimedPopup();
                                Knack.hideSpinner();
                                ktl.scenes.spinnerWatchdog();
                                ktl.views.autoRefresh();
                                return reject('processAutomatedBulkOps error: ' + reason.stack);
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

                    if (Knack.views[viewId].record
                        || (Knack.views[viewId].model.data && Knack.views[viewId].model.data.total_records > 0)
                        || document.querySelector(`#${viewId} .kn-tr-nodata`)) {
                        return resolve();
                    }

                    const itv = setInterval(() => {
                        if (Knack.views[viewId].record
                            || (Knack.views[viewId].model.data && Knack.views[viewId].model.data.total_records > 0)
                            || document.querySelector(`#${viewId} .kn-tr-nodata`)) {
                            clearInterval(itv);
                            return resolve();
                        }
                    }, 100);

                    setTimeout(() => { //Failsafe
                        clearInterval(itv);
                        reject();
                    }, 60000);
                })
            },

            //Will return the KTL add-ons div for this view, and create it if doesn't exist.
            //This is where we add all KTL-related buttons and indicators.
            getKtlAddOnsDiv: function (viewId) {
                if (!viewId) return;

                let ktlAddonsDiv = document.querySelector(`#${viewId} .ktlAddonsDiv`);
                if (!ktlAddonsDiv) {
                    ktlAddonsDiv = document.createElement('div');

                    var prepend = false;
                    var searchFound = false;

                    var div = document.querySelector(`#${viewId} .table-keyword-search .control.has-addons, #${viewId} .kn-submit.control`);
                    if (div) {
                        searchFound = true;
                    } else
                        div = document.querySelector(`#${viewId} .kn-submit.control`); //For search views.

                    const viewHeader = document.querySelector(`#${viewId} .view-header`);
                    if (!div)
                        div = viewHeader;

                    if (!div) {
                        div = document.querySelector('#' + viewId);
                        if (!div) return; //Support other layout options as we go.
                        prepend = true;
                    }

                    ktlAddonsDiv.classList.add('ktlAddonsDiv');

                    if (searchFound) {
                        if (Knack.isMobile())
                            $(ktlAddonsDiv).css('margin-top', '2%');
                        else {
                            ktlAddonsDiv.classList.add('ktlAddonsWithSearchDiv');
                            document.querySelector(`#${viewId} .table-keyword-search .control.has-addons, #${viewId} .kn-submit.control`).style.display = 'inline-flex'; //Otherwise, we get the buttons on a row below Search bar.
                        }
                    }

                    $(ktlAddonsDiv).css('margin-bottom', '1.1em');

                    if (prepend)
                        $(div).prepend(ktlAddonsDiv);
                    else
                        ktl.core.insertAfter(ktlAddonsDiv, div);
                }

                return ktlAddonsDiv;
            },

            viewHasGroups: function (viewId) {
                if (!viewId) return false;
                var viewObj = ktl.views.getView(viewId);
                if (!viewObj) return false;
                for (const col of viewObj.columns) {
                    if (col.grouping)
                        return true;
                }

                return false;
            },

            addDragAndDropObserver: function (callback) {
                const additionalParameters = Array.from(arguments).slice(1);
                let observerExists = false; //Assuming no callback doesn't have a UUID.
                //Unique ID may be used to prevent multiple callback instances, when different functions have the same name.
                if (callback.uuid) {
                    observerExists = dragAndDropSubscribers.some(observer => observer.callback.uuid === callback.uuid);
                    if (!observerExists) {
                        dragAndDropSubscribers.push({ callback, additionalParameters });
                    }
                }
            },

            removeDragAndDropObserver: function (callback) {
                const index = dragAndDropSubscribers.findIndex(subscriber => subscriber.callback === callback);
                if (index !== -1) {
                    dragAndDropSubscribers.splice(index, 1);
                }
            },

            onDragAndDropEvent: function (viewId, evt) {
                if (!viewId || !evt) return;
                for (const subscriber of dragAndDropSubscribers)
                    subscriber.callback(viewId, evt, ...subscriber.additionalParameters);
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

            //Remove empty columns because it ruins the layout. Happens too often but not sure why (KTL or Knack?).
            if (!ktl.scenes.isiFrameWnd()) {
                ktl.core.waitSelector('.view-column', 5000) //Needed otherwise we miss them once in a while.
                    .then(function () {
                        document.querySelectorAll('.view-column').forEach(column => {
                            if (!column.childElementCount)
                                column.remove();
                        })
                    })
                    .catch(() => { })
            }

            //Leaving more time to iFrameWnd has proven to reduce errors and improve stability.
            //Anyways... no one is getting impatient at an invisible window!
            if (window.self.frameElement && (window.self.frameElement.id === IFRAME_WND_ID))
                spinnerCtrDelay = 60;

            ktl.scenes.spinnerWatchdog();
            ktl.iFrameWnd.create();
            ktl.views.autoRefresh();
            ktl.scenes.resetIdleWatchdog();
            ktl.fields.sceneConvertNumToTel();
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

            setTimeout(() => {
                const showHiddenElements = ktl.storage.lsGetItem('SHOW_HIDDEN_ELEMENTS', false, true);
                if (showHiddenElements === 'true')
                    showHiddenElemements();
            }, 2000);
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

            if (!ktl.scenes.isiFrameWnd()) {
                setTimeout(() => {
                    const showHiddenElements = ktl.storage.lsGetItem('SHOW_HIDDEN_ELEMENTS', false, true);
                    if (showHiddenElements === 'true') {
                        showHiddenElemements();

                        //TODO: Why this doesn't work?
                        setTimeout(() => {
                            ktl.views.fixTableRowsAlignment(view.key);
                        }, 2000);
                    }
                }, 2000);
            }
        })

        $(document).on('mousedown', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('mousemove', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('keypress', function (e) { ktl.scenes.resetIdleWatchdog(); })

        //Early detection of scene change to prevent multi-rendering and flickering of views.
        //Inspired from David Roizenman's code on Slack: https://knack-community.slack.com/archives/C016QKN0QBF/p1707364683629919
        Knack.router.on('route:viewScene', function (slug, search) {
            if (!ktl.scenes.isiFrameWnd()) {
                waitUserId()
                    .then(() => { ktl.core.applyKioskMode(); })
                    .catch(() => { })

                for (const view of Knack.router.scene_view.model.attributes.views) {
                    $(document).on('knack-view-init.' + view.key, function (event, view) {
                        $(document).trigger('KTL.preprocessView', view);
                    })
                }
            }
        });

        $(document).on('KTL.preprocessView', (event, view) => {
            if (!view || !view.model || !view.model.view) return;

            const viewObj = view.model.view;
            const viewId = viewObj.key;

            //Pre-process keywords.
            var keywords = ktlKeywords[viewId];
            if (keywords) {
                if (keywords._ro)
                    $('#' + viewId).addClass('ktlHidden_ro');

                keywords._zoom && ktl.views.applyZoomLevel(viewId, keywords);
                keywords._dr && ktl.views.numDisplayedRecords(viewId, keywords);
                ktl.fields.hideFields(viewId, keywords);

                if (!ktl.account.isDeveloper() && !ktl.core.isKiosk())
                    keywords._km && ktl.core.kioskMode(true);
                keywords._hv && ktl.views.hideView(viewId, keywords);
                keywords._hc && ktl.views.hideColumns(viewObj, keywords);
                keywords._rc && ktl.views.removeColumns(viewObj, keywords);
                keywords._cls && ktl.views.addRemoveClass(viewId, keywords);
                keywords._style && ktl.views.setStyle(viewId, keywords);
            }

            ktl.userFilters.applyActiveFilter(viewObj);
        });

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
        }, 250);

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

        function showHiddenElemements() {
            $('.ktlHidden').replaceClass('ktlHidden', 'dis_ktlHidden');
            $('.ktlDisplayNone').replaceClass('ktlDisplayNone', 'dis_ktlDisplayNone');
            $('.ktlVisibilityHidden').replaceClass('ktlVisibilityHidden', 'dis_ktlVisibilityHidden');

            $('[class^=ktlHidden_], [class*=" ktlHidden_"]').each(function () {
                var currentClass = $(this).attr('class');
                var newClass = currentClass.split(' ').map(function (className) {
                    if (className.startsWith('ktlHidden_')) {
                        return 'dis_' + className;
                    }
                    return className;
                }).join(' ');

                $(this).attr('class', newClass);
            });
        }

        function hideHiddenElemements() {
            $('.dis_ktlHidden').replaceClass('dis_ktlHidden', 'ktlHidden');
            $('.dis_ktlDisplayNone').replaceClass('dis_ktlDisplayNone', 'ktlDisplayNone');
            $('.dis_ktlVisibilityHidden').replaceClass('dis_ktlVisibilityHidden', 'ktlVisibilityHidden');

            $('[class^=dis_ktlHidden_], [class*=" dis_ktlHidden_"]').each(function () {
                var currentClass = $(this).attr('class');
                var newClass = currentClass.split(' ').map(function (className) {
                    if (className.startsWith('dis_ktlHidden_')) {
                        return className.replace('dis_', '');
                    }
                    return className;
                }).join(' ');

                $(this).attr('class', newClass);
            });
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

                if (!document.querySelector('#cell-editor'))
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
                                    messagingBtn.classList.add('kn-button', 'ktlSmallKioskButtons');
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
                                    refreshBtn.classList.add('kn-button', 'ktlSmallKioskButtons');

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
                                    backBtn.classList.add('kn-button', 'ktlSmallKioskButtons');

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
                                    kioskAppBtn.classList.add('kn-button', 'ktlSmallKioskButtons');
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
                let idleWatchDogDelay = ktl.scenes.getCfg().idleWatchDogDelay;
                if (idleWatchDogDelay > 0) {
                    if (idleWatchDogDelay > 1440) //For backwards compatibility, when value was in milliseconds.  Now in minutes.
                        idleWatchDogDelay /= 60000;

                    idleWatchDogTimer = setTimeout(function () {
                        ktl.scenes.idleWatchDogTimeout();
                    }, idleWatchDogDelay * 60000);
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

            findViewWithKeyword: function (keyword = '', excludeViewId = '') {
                ktl.log.clog('purple', 'findViewWithKeyword is deprecated.  Use findViewWithKeywordInCurrentScene instead.');
                return findViewWithKeywordInCurrentScene(keyword = '', excludeViewId = '');
            },

            //Searches in the current scene for a view with the specified keyword.
            //Returns on the first occurence found.
            findViewWithKeywordInCurrentScene: function (keyword = '', excludeViewId = '') {
                var views = Knack.router.scene_view.model.views.models;
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

            //Searches through the whole app, in all scenes, for all views using the specified keyword.
            //Returns an array containing the found view IDs.
            //If firstOccurenceOnly is true, will return an array with the first view ID found.
            findViewsWithKeywordInAllScenes: function (keyword, firstOccurenceOnly = false) {
                if (!keyword) return [];
                let foundViewIds = [];
                const scenes = Knack.scenes.models;
                for (const scene of scenes) {
                    var views = scene.views.models;
                    for (const view of views) {
                        const viewId = view.id;
                        if (viewId) {
                            if (ktlKeywords[viewId] && ktlKeywords[viewId][keyword]) {
                                if (firstOccurenceOnly)
                                    return [viewId];
                                else
                                    foundViewIds.push(viewId);
                            }
                        }
                    }
                }

                return foundViewIds;
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
                let versionStyle = style ? style : 'white-space: pre; font-size:small; font-weight:bold; border-style:none; padding-bottom:2px;';

                let ktlCode = ktl.storage.lsGetItem('ktlCode', true);
                if (ktlCode === 'prod') {
                    if (['dev', 'beta'].includes(info.ktlVersion))
                        ktlCode = info.ktlVersion;
                    versionStyle += '; color:#0008; background-color:#FFF3;';
                } else if (ktlCode === 'dev')
                    versionStyle += '; background-color:pink; color:black; font-weight: bold';
                else if (ktlCode === 'local')
                    versionStyle += '; background-color:gold; color:red; font-weight: bold';
                else if (ktlCode === 'beta' || /^\d.*\./.test(ktlCode))
                    versionStyle += '; background-color:orange; color:black; font-weight: bold';

                //Build version info string.
                let appVer = vi.viShowAppInfo ? ktl.scenes.getCfg().versionDisplayName + ' v' + window.APP_VERSION : '';

                if (vi.viShowAppInfo && vi.viShowKtlInfo)
                    appVer += '    ';

                let ktlVer = vi.viShowKtlInfo ? 'KTL v' + KTL_VERSION : '';
                if (['dev', 'beta'].includes(ktlCode)) //For local, we want to see the current version number.
                    ktlVer = 'KTL-' + ktlCode;

                let versionInfo = appVer + ktlVer + (info.hostname ? '    ' + info.hostname : '');

                info.pre && (versionInfo = info.pre + '    ' + versionInfo);
                info.post && (versionInfo = versionInfo + '    ' + info.post);

                let addVersionInfoDiv = document.createElement('div');
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
                    let logoutBtn;
                    let kioskModeBtn;
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
                            if (pw === ktl.core.getCfg().devOptionsPin) {
                                setTimeout(() => {
                                    showDevPopup();
                                }, 500);
                            }
                        })
                    }

                    function showDevPopup() {
                        ktl.systemColors.getSystemColors()
                            .then((sc) => {
                                let sysColors = sc;

                                ktl.storage.lsSetItem('pinAlreadyEntered', true, false, true);
                                let userPrefsObj = ktl.userPrefs.getUserPrefs();

                                if ($('#devBtnsDivId').length) return;

                                let devBtnsDiv = document.createElement('div');
                                devBtnsDiv.setAttribute('id', 'devBtnsDivId');
                                devBtnsDiv.classList.add('devBtnsDiv');

                                //Header
                                let devBtnsDivHeader = document.createElement('div');
                                devBtnsDivHeader.setAttribute('id', 'devBtnsDivIdheader');
                                devBtnsDivHeader.style['background-color'] = sysColors.paleLowSatClr;
                                devBtnsDivHeader.classList.add('ktlDevToolsHeader');

                                devBtnsDivHeader.innerText = ':: KTL Developer Tools ::';
                                devBtnsDiv.appendChild(devBtnsDivHeader);

                                document.body.appendChild(devBtnsDiv);

                                let ktlCode = ktl.storage.lsGetItem('ktlCode', true);
                                ktl.fields.addButton(devBtnsDiv, 'KTL Code: ' + ktlCode, '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                    //This forces loading a specific 'KTL-xyz.js' version code from CTRND's CDN, in Prod folder.
                                    //See 'ktlCode' in KTL_Start.js
                                    let newKtlCode = prompt('Prod, Local, Dev, Beta or numbered version?\nType: p, l, d, b or version no.\nLeave empty for prod');
                                    if (newKtlCode === null) return;
                                    newKtlCode = newKtlCode.toLowerCase();
                                    if (!newKtlCode || newKtlCode === 'p')
                                        ktl.core.switchKtlCode('prod');
                                    else {
                                        if (newKtlCode === 'l') {
                                            //Only apply Local mode if NodeJS file server is running.
                                            ktl.core.checkLocalhostServer(3000)
                                                .then(() => {
                                                    ktl.core.switchKtlCode('local');
                                                })
                                                .catch(() => {
                                                    alert('Local server not running');
                                                    return;
                                                })
                                        } else {
                                            if (newKtlCode === 'b')
                                                ktlCode = 'beta';
                                            else if (newKtlCode === 'd')
                                                ktlCode = 'dev';
                                            else if (/^\d.*\./.test(newKtlCode))
                                                ktlCode = newKtlCode;

                                            ktl.core.switchKtlCode(ktlCode);
                                        }
                                    }
                                })

                                ktl.fields.addButton(devBtnsDiv, 'View IDs', '', ['devBtn', 'kn-button']).addEventListener('click', () => {
                                    userPrefsObj.showViewId = !userPrefsObj.showViewId;
                                    userPrefsObj.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                                    ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS, JSON.stringify(userPrefsObj));
                                    ktl.scenes.renderViews();
                                    if (ktl.core.getCfg().enabled.iFrameWnd && ktl.iFrameWnd.getiFrameWnd())
                                        ktl.wndMsg.send('userPrefsChangedMsg', 'req', ktl.const.MSG_APP, IFRAME_WND_ID, 0, JSON.stringify(userPrefsObj));
                                })

                                let showHiddenElements = (ktl.storage.lsGetItem('SHOW_HIDDEN_ELEMENTS', false, true) === 'true');
                                var showHiddenElemBtn = ktl.fields.addButton(devBtnsDiv, 'Hidden Elements: ' + (showHiddenElements ? 'Show' : 'Default'), '', ['devBtn', 'kn-button']);
                                showHiddenElemBtn.addEventListener('click', () => {
                                    showHiddenElements = !showHiddenElements;
                                    showHiddenElemBtn.textContent = 'Hidden Elements: ' + (showHiddenElements ? 'Show' : 'Default');

                                    ktl.storage.lsSetItem('SHOW_HIDDEN_ELEMENTS', showHiddenElements, false, true);

                                    if (showHiddenElements)
                                        showHiddenElemements();
                                    else
                                        hideHiddenElemements();
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
                                    if (loginInfo) {
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
                                    ktl.core.addAppResizeSubscriber(ktl.core.ktlDevToolsAdjustPositionAndSave, devToolSearchDiv, devToolStorageName);
                                    ktl.core.enableSortableDrag(devToolSearchDiv, debounce((position) => {
                                        ktl.core.ktlDevToolsAdjustPositionAndSave(devToolSearchDiv, devToolStorageName, position);
                                    }));

                                    const savedPosition = ktl.storage.getItemJSON(devToolStorageName);
                                    if (savedPosition) {
                                        devToolSearchDiv.style.left = savedPosition.left + 'px';
                                        devToolSearchDiv.style.top = savedPosition.top + 'px';
                                        ktl.core.ktlDevToolsAdjustPositionAndSave(devToolSearchDiv, devToolStorageName, savedPosition);
                                    } else {
                                        const position = ktl.core.centerElementOnScreen(devToolSearchDiv);
                                        ktl.core.ktlDevToolsAdjustPositionAndSave(devToolSearchDiv, devToolStorageName, position);
                                    }

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
                                                    ktl.core.addAppResizeSubscriber(ktl.core.ktlDevToolsAdjustPositionAndSave, resultWnd, devToolStorageName);
                                                    ktl.core.enableSortableDrag(resultWnd, debounce((position) => {
                                                        ktl.core.ktlDevToolsAdjustPositionAndSave(resultWnd, devToolStorageName, { ...position });
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

                                                        ktl.core.ktlDevToolsAdjustPositionAndSave(resultWnd, devToolStorageName, savedPosition);
                                                    } else {
                                                        const position = ktl.core.centerElementOnScreen(resultWnd);
                                                        ktl.core.ktlDevToolsAdjustPositionAndSave(resultWnd, devToolStorageName, position);
                                                    }
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

                                    const restartKioskServiceBtn = ktl.fields.addButton(devBtnsDiv, 'Restart Kiosk Service', '', ['devBtn', 'kn-button']);
                                    restartKioskServiceBtn.addEventListener('click', () => {
                                        if (confirm('Are you sure you want to restart the kiosk service?'))
                                            ktl.sysInfo.restartService();
                                    })

                                    const rebootBtn = ktl.fields.addButton(devBtnsDiv, 'Reboot', '', ['devBtn', 'kn-button']);
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

                                //Now that all buttons are added, load position and adjust if necessary, based on window size.
                                const devToolStorageName = 'devToolBtns';

                                const savedPosition = ktl.storage.getItemJSON(devToolStorageName);
                                if (savedPosition) {
                                    devBtnsDiv.style.left = savedPosition.left + 'px';
                                    devBtnsDiv.style.top = savedPosition.top + 'px';
                                    ktl.core.ktlDevToolsAdjustPositionAndSave(devBtnsDiv, devToolStorageName, savedPosition);
                                } else {
                                    const position = ktl.core.centerElementOnScreen(devBtnsDiv);
                                    ktl.core.ktlDevToolsAdjustPositionAndSave(devBtnsDiv, devToolStorageName, position);
                                }

                                //Handle resizing of window and moving of tool.
                                ktl.core.addAppResizeSubscriber(ktl.core.ktlDevToolsAdjustPositionAndSave, devBtnsDiv, devToolStorageName);
                                ktl.core.enableSortableDrag(devBtnsDiv, debounce((newPosition) => {
                                    ktl.core.ktlDevToolsAdjustPositionAndSave(devBtnsDiv, devToolStorageName, newPosition);
                                }));
                            })
                    }

                    return false; //False to prevent firing both events on mobile devices.
                })

                //For Dev Options popup, act like a modal window: close when clicking oustide.
                $(document).on('click', function (e) {
                    if (e.target.closest('.kn-content') || (e.target && e.target.id && e.target.id === 'knack-body')) {
                        $('#popupDivId').remove();
                        $('#popupFormId').remove();

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

            if (!view.fields) return;

            let bulkOpsLudFieldId = '';
            let bulkOpsLubFieldId = '';

            const fieldsWithKeywords = ktl.views.getAllFieldsWithKeywordsInView(view.key);
            Object.keys(fieldsWithKeywords).forEach((fieldId) => {
                const fieldKeywords = ktl.fields.getFieldKeywords(fieldId);
                if (fieldKeywords[fieldId] && fieldKeywords[fieldId]._lud)
                    bulkOpsLudFieldId = fieldId;
                else if (fieldKeywords[fieldId] && fieldKeywords[fieldId]._lub)
                    bulkOpsLubFieldId = fieldId;
            })

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

                const views = Knack.router.scene_view.model.attributes.views;
                for (const view of views) {
                    ktl.views.addViewId(view);
                }

                var myUserPrefsViewId = ktl.userPrefs.getCfg().myUserPrefsViewId;
                if (myUserPrefsViewId && $(`#${myUserPrefsViewId}`).length)
                    ktl.views.refreshView(myUserPrefsViewId);

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
            ktl.developerPopupTool();

            $('.kn-current_user > span.first').on('dblclick', (e) => {
                var userId = $('.kn-current_user').attr('id');
                console.log('\nApp:\t', app_id);
                console.log('LS key:\t', APP_ROOT_NAME);
                console.log('User:\t', userId);
            })

            if ($('.remember input').length && ktl.core.getCfg().enabled.rememberMe)
                $('.remember input')[0].checked = true;

            ktl.account.updateLocalIP();
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

                                        ktl.core.applyKioskMode();

                                        ktl.iFrameWnd.create();
                                    })
                                    .catch(err => {
                                        console.error('waitLoginOutcome: Failed waiting for user ID.', err);
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

        if (!window.logout) { //Emergency manual logout from console.
            window.logout = function () {
                ktl.account.logout();
            }
        }

        return {
            isDeveloper: function () {
                return ((Knack.getUserRoleNames().split(',').map((element) => element.trim()).includes('Developer')) || (ktl.storage.lsGetItem('forceDevRole', true) === 'true'));
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

            autoLogin: function (viewId) {
                if (!viewId) return;
                var loginInfo = ktl.storage.lsGetItem('AES_LI', true, false);
                if (loginInfo) {
                    if (loginInfo === 'SkipAutoLogin') {
                        console.log('AL not needed:', loginInfo);
                        return;
                    } else {
                        ktl.storage.initSecureLs()
                            .then(() => {
                                try {
                                    var loginInfo = ktl.storage.lsGetItem('AES_LI', true, false, true);
                                    if (loginInfo) {
                                        loginInfo = JSON.parse(loginInfo);
                                        $('.kn-login.kn-view' + '#' + viewId).addClass('ktlHidden');
                                        $('#email').val(loginInfo.email);
                                        $('#password').val(loginInfo.pw);
                                        $('.remember input')[0].checked = true;

                                        //Do not use form submit. Must be click below, otherwise waitLoginOutcome is never called.
                                        //$('#' + viewId + ' form').submit();
                                        $('.kn-login-form .kn-button.is-primary').click();
                                    }
                                }
                                catch (e) {
                                    //Data is corrupt, remove all and logout as a last resort.
                                    console.error('Error parsing autoLogin info.\n', e);
                                    ktl.storage.lsRemoveItem('AES_LI', true, false, false);
                                    ktl.account.autoLogin(viewId);
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

                if (ktl.storage.lsGetItem('forceDevRole', true) === 'true')
                    userRoles.push('Developer');

                for (let i = 0; i < rolesToCheck.length; i++) {
                    if (rolesToCheck[i].startsWith('!')) {
                        defaultRes = true;
                        if (userRoles.includes(rolesToCheck[i].replace('!', '')))
                            return false;
                    } else {
                        defaultRes = false;
                        if (userRoles.includes(rolesToCheck[i]))
                            return true;
                    }
                }

                return defaultRes;
            },

            matchUserRoles: function (roles = []) {
                const userRoles = Knack.getUserRoleNames().split(', ');

                if (ktl.storage.lsGetItem('forceDevRole', true) === 'true')
                    userRoles.push('Developer');

                return roles.every(role => {
                    if (role.startsWith('!')) {
                        return !userRoles.includes(role.replace('!', ''));
                    }

                    return userRoles.includes(role);
                });
            },

            updateLocalIP: function () {
                if (ktl.scenes.isiFrameWnd() || Knack.getUserAttributes() === 'No user found') return;

                const sys = ktl.sysInfo.getSysInfo();
                if (sys.os !== 'Linux' /*|| !sys.processor.includes('arm')*/) return;

                const accountsObj = ktl.core.getObjectIdByName(ktl.core.getAccountsObjectName());
                const ipAddressFieldId = ktl.core.getFieldIdByName('IP Address', accountsObj);

                if (!ipAddressFieldId) return;

                const foundViews = ktl.scenes.findViewsWithKeywordInAllScenes('_remote_account_update', true);
                if (foundViews.length === 1 && foundViews[0]) {
                    ktl.sysInfo.getLinuxDeviceInfo()
                        .then(svrResponse => {
                            let localIPAddress = svrResponse.deviceInfo.localIP;
                            if (Knack.getUserAttributes() !== 'No user found' && localIPAddress !== Knack.getUserAttributes().values[ipAddressFieldId]) {
                                let apiData = {};
                                apiData[ipAddressFieldId] = localIPAddress;
                                ktl.core.knAPI(foundViews[0], Knack.getUserAttributes().id, apiData, 'PUT')
                                    .then(function () { })
                                    .catch(function (reason) {
                                        ktl.log.clog('purple', 'Failed updating IP', JSON.stringify(reason));
                                    })
                            }
                        })
                        .catch(reason => {
                            console.log('getDeviceInfo in KIOSK_DEVICES failed, reason:', JSON.stringify(reason));
                        })
                }
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

        var accountsObj = ktl.core.getObjectIdByName(ktl.core.getAccountsObjectName());
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
                        const ktlCode = ktl.storage.lsGetItem('ktlCode', true);
                        if (['dev', 'beta', 'local'].includes(ktlCode) || /^\d.*\./.test(ktlCode)) {
                            //Dev, Beta, Local or specific version, ignore.
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
                    }, ONE_MINUTE_DELAY * 2);
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
                            ktl.debugWnd.lsLog('Error ' + msg.status);
                            setTimeout(() => {
                                ktl.account.logout(); //Login has expired, force logout.
                                setTimeout(() => {
                                    Android.restartApplication();
                                }, 1000);
                            }, 1000);

                            //    if (true || confirm(`A reboot is needed, do you want to do it now? (code ${msg.status})`)) {
                            //        ktl.account.logout(); //Login has expired, force logout.
                            //        setTimeout(() => {
                            //            Android.restartApplication();
                            //        }, 1500);
                            //    }
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

        $(document).on('knack-view-render.any', function (event, view, data) {
            const viewId = view.key;
            ktl.bulkOps.prepareBulkOps(view, data); //Must be applied before keywords to get the right column indexes.
            ktl.views.fixTableRowsAlignment(viewId);
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

            let viewId;
            const view = e.target.closest('[class*="view_"][id^="view_"]');
            if (view)
                viewId = view.getAttribute('id');
            if (!viewId) return;

            if (e.target.closest('tr')) {
                if (e.target.getAttribute('type') === 'checkbox') {
                    if (preventClick) {
                        preventClick = false;
                        e.preventDefault();
                        return;
                    }

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
        })

        function updateBulkOpsGuiElements(viewId = '') {
            if (!viewId) return;

            bulkOpsHeaderArray = [];
            $('#' + viewId + ' .bulkEditHeaderCbox').each((idx, cb) => {
                var fieldId = $(cb).closest('th');
                fieldId = fieldId.attr('class').split(' ')[0].split(':')[0];
                if (fieldId.startsWith('field_')) {
                    if (cb.checked) {
                        $('#' + viewId + ' td.' + fieldId).addClass('bulkEditSelectedCol');
                        bulkOpsHeaderArray.push(fieldId);
                    } else
                        $('#' + viewId + ' td.' + fieldId).removeClass('bulkEditSelectedCol');
                }
            })

            const numChecked = updateBulkOpsRecIdArray(viewId);

            updateHeaderCheckboxes(viewId, numChecked);

            updateDeleteButtonState(viewId, numChecked);
            updateCopyButtonState(viewId, numChecked);
            updatePasteButtonState(viewId, numChecked);
            updateDuplicateButtonState(viewId, numChecked);

            if (numChecked > 0)
                ktl.views.autoRefresh(false);
            else
                ktl.views.autoRefresh();

            $(document).trigger('KTL.BulkOperation.Updated', [viewId]);
        }

        //The entry point of the feature, where Bulk Ops is enabled per view, depending on account role permission.
        //Called upon each view rendering.
        let bulkActionColumnIndex = null;
        function enableBulkOperations(view, data) {
            const viewId = view.key;

            var viewObj = ktl.views.getView(viewId);
            if (!viewObj) return;

            bulkOpsAddCheckboxesToTable(viewId);
            addBulkOpsButtons(view, data);

            //Put back checkboxes that were checked before view refresh.
            if (viewId === bulkOpsViewId) {
                //Rows
                for (var i = 0; i < bulkOpsRecIdArray.length; i++) {
                    var cb = $('#' + viewId + ' tr[id="' + bulkOpsRecIdArray[i] + '"] :checkbox');
                    if (cb.length)
                        cb[0].checked = true;
                }

                //Columns
                for (var i = 0; i < bulkOpsHeaderArray.length; i++) {
                    var cb = $('#' + viewId + ' th.' + bulkOpsHeaderArray[i] + ' :checkbox');
                    if (cb.length)
                        cb[0].checked = true;
                }
            }

            if (viewCanDoBulkOp(viewId, 'edit')) {
                //When user clicks on a row, to indicate the record source.
                $('#' + viewId + ' tr td.cell-edit:not(:checkbox):not(.ktlNoInlineEdit)').bindFirst('click', e => {
                    var tableRow = e.target.closest('tr');
                    if (tableRow) {
                        if (bulkOpsRecIdArray.length > 0) {
                            //Prevent Inline Edit.
                            e.stopImmediatePropagation();
                            apiData = {};
                            processBulkOps(viewId, e);
                        }
                    }
                })
            }

            if (viewCanDoBulkOp(viewId, 'action')) {
                //When user clicks on an action link.
                if (!bulkActionColumnIndex) {
                    $(`#${viewId} tbody tr td i, #${viewId} tbody tr td .kn-action-link`).bindFirst('click.ktl_bulkaction', e => {
                        //When process is triggered the first time by a manual click.
                        if (bulkOpsRecIdArray.length) {
                            const tableLink = e.target.closest('.kn-table-link');
                            if (!tableLink) return;

                            const columnElement = tableLink.querySelector('[class^="col-"]');
                            if (!columnElement) return;

                            e.preventDefault();
                            e.stopImmediatePropagation();

                            bulkActionColumnIndex = columnElement.classList[0];

                            //Clean array to include only those with an action.
                            const bulkOpsRecIdArrayCopy = bulkOpsRecIdArray;
                            bulkOpsRecIdArray = [];
                            for (const recId of bulkOpsRecIdArrayCopy) {
                                const actionLink = $(`#${viewId} tbody tr[id="${recId}"] .${bulkActionColumnIndex} .kn-action-link`);
                                if (!actionLink.length)
                                    $(`#${viewId} tbody tr[id="${recId}"] td input[type=checkbox]`).prop('checked', false);
                                else
                                    bulkOpsRecIdArray.push(recId);
                            }

                            processBulkAction();
                        }
                    })
                } else {
                    processBulkAction();
                }

                function processBulkAction() {
                    if (!bulkOpsRecIdArray.length) {
                        bulkActionColumnIndex = null;
                        ktl.views.refreshView(viewId);
                        return;
                    }

                    //Find a better way to do this without having to wait until toasts are all gone.  Too slow.
                    //The problem is due to summary renderings that cause a double call of this function and kills a click once in a while.
                    ktl.core.waitSelector('#toast-container', 20000, 'none')
                        .then(function () { })
                        .catch(function () { })
                        .finally(() => {
                            const recId = bulkOpsRecIdArray.shift();
                            const actionLink = $(`#${viewId} tbody tr[id="${recId}"] .${bulkActionColumnIndex} .kn-action-link`);

                            if (actionLink.length) {
                                $(`#${viewId} tbody tr[id="${recId}"] td input[type=checkbox]`).prop('checked', false);

                                $(`#${viewId} tbody tr td i, #${viewId} tbody tr td .kn-action-link`).off('click.ktl_bulkaction');

                                //Wait until link is enabled
                                const intervalId = setInterval(() => {
                                    const actionLink = $(`#${viewId} tbody tr[id="${recId}"] .${bulkActionColumnIndex} .kn-action-link`);
                                    if (!actionLink.hasClass('disabled')) {
                                        clearInterval(intervalId);
                                        const outlineElement = actionLink.closest('.kn-table-link');
                                        outlineElement.addClass('ktlOutline');
                                        actionLink.click();
                                    }
                                }, 100);
                            }
                        })
                }
            }

            updateBulkOpsGuiElements(viewId);

            $(document).trigger('KTL.BulkOperation.Updated', [viewId]);
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
                            const fieldType = ktl.fields.getFieldType(fieldId);
                            if (fieldType === 'file') //Not supported in API calls.
                                kwNoCheckBox = true;
                            else {
                                ktl.fields.getFieldKeywords(fieldId, kw);
                                if (!$.isEmptyObject(kw)) {
                                    if (kw[fieldId]._lud || kw[fieldId]._lub)
                                        kwNoCheckBox = true;
                                }
                            }
                        }

                        if (idx > 0 && inline.length && inline[0].classList.contains('cell-edit') && !inline[0].classList.contains('ktlNoInlineEdit') && !kwNoCheckBox) {
                            $(el).find('.table-fixed-label').css('display', 'inline-flex').append('<input type="checkbox">').addClass('bulkEditTh');
                            $(el).find('input:checkbox').addClass('bulkEditHeaderCbox');
                        }
                    })

                }

                if (viewCanDoBulkOp(viewId, 'edit') || viewCanDoBulkOp(viewId, 'copy') || viewCanDoBulkOp(viewId, 'delete'))
                    $('#' + viewId + ' thead input:checkbox').addClass('bulkEditCb');

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

            if (data.length) {
                addBulkDeleteButtons(view, data);
                addCopyButton(view);
                addPasteButton(view);
                addDuplicateButton(view);
            }
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

        function addCopyButton(view) {
            const viewId = view.key;
            if (!viewCanDoBulkOp(viewId, 'edit')) return;

            if (document.querySelector('#ktl-bulk-copy-' + viewId)) return;
            const copyBtn = ktl.fields.addButton(document.querySelector('#' + viewId + ' .bulkOpsControlsDiv'), 'Copy', '', ['kn-button', 'ktlButtonMargin'], 'ktl-bulk-copy-' + viewId);
            copyBtn.addEventListener('click', function (e) {
                let checkedFields = $('.bulkEditHeaderCbox:is(:checked)');
                if (!checkedFields.length)
                    $('#' + viewId + ' .bulkEditHeaderCbox').prop('checked', true);

                apiData = {};

                const recId = bulkOpsRecIdArray[0];
                const src = (Knack.views[viewId].model.results_model && Knack.views[viewId].model.results_model.data._byId[recId].attributes)
                    || Knack.views[viewId].model.data._byId[recId].attributes;

                //TODO:  put the duplicate code below in a common function.
                checkedFields = $('.bulkEditHeaderCbox:is(:checked)');
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

                if ($.isEmptyObject(apiData))
                    ktl.core.timedPopup('No data found.  Please try again', 'error');
                else {
                    ktl.core.timedPopup('Data copied successfully - ready to be pasted.', 'success');
                    $(`#${viewId} tbody tr[id="${recId}"] input:checkbox`)[0].checked = false;
                }

                updateBulkOpsGuiElements(viewId);
            })
        }

        function addPasteButton(view) {
            const viewId = view.key;
            if (!viewCanDoBulkOp(viewId, 'edit')) return;
            if (document.querySelector('#ktl-bulk-paste-' + viewId)) return;
            const pasteBtn = ktl.fields.addButton(document.querySelector('#' + viewId + ' .bulkOpsControlsDiv'), 'Paste', '', ['kn-button', 'ktlButtonMargin', 'bulkEditSelectSrc'], 'ktl-bulk-paste-' + viewId);
            pasteBtn.addEventListener('click', function (e) {
                if (e.ctrlKey)
                    previewLastBulkEditData();
                else
                    processBulkOps(viewId, e);
            })
        }

        function addDuplicateButton(view) {
            const viewId = view.key;
            if (!viewCanDoBulkOp(viewId, 'copy')) return;
            if (document.querySelector(`#ktl-bulk-duplicate-${viewId}`)) return;
            const duplicateBtn = ktl.fields.addButton(document.querySelector('#' + viewId + ' .bulkOpsControlsDiv'), 'Duplicate', '', ['kn-button', 'ktlButtonMargin'], 'ktl-bulk-duplicate-' + viewId);
            duplicateBtn.addEventListener('click', function (e) {
                apiData = {};
                processBulkOps(viewId, e);
            })
        }

        function updateDeleteButtonState(viewId = '', numChecked) {
            const deleteRecordsBtn = document.querySelector('#ktl-bulk-delete-selected-' + viewId);
            if (deleteRecordsBtn) {
                deleteRecordsBtn.disabled = !numChecked;
                deleteRecordsBtn.textContent = 'Delete Selected: ' + numChecked;
            }

            ktl.views.autoRefresh(!numChecked); //If a checkbox is clicked, pause auto-refresh otherwise user will lose all selections.
        }

        function updateCopyButtonState(viewId, numChecked) {
            if (!viewCanDoBulkOp(viewId, 'edit')) return;
            const bulkCopyBtn = document.querySelector('#ktl-bulk-copy-' + viewId);
            if (bulkCopyBtn)
                bulkCopyBtn.disabled = (numChecked !== 1);
        }

        function updatePasteButtonState(viewId, numChecked) {
            if (!viewCanDoBulkOp(viewId, 'edit')) return;
            const bulkPasteBtn = document.querySelector(`#ktl-bulk-paste-${viewId}`);
            if (bulkPasteBtn)
                bulkPasteBtn.disabled = ($.isEmptyObject(apiData) || !numChecked);

            if (!$.isEmptyObject(apiData)) {
                if (!$(bulkPasteBtn).find('.fa-eye').length) {
                    bulkPasteBtn.innerHTML += '<i class="fa fa-eye" style="margin-left: 5px;"></i>';
                    const bulkPasteBtnEye = `#ktl-bulk-paste-${viewId} .fa-eye`;

                    $(bulkPasteBtnEye).hover(
                        function (e) {
                            const jsonData = apiData;
                            const popup = $('<div/>', {
                                id: 'jsonPopup',
                                text: '',
                                css: {
                                    position: 'absolute',
                                    top: e.pageY + 5,
                                    left: e.pageX + 5,
                                    border: '1px solid black',
                                    padding: '5px',
                                    backgroundColor: 'white',
                                    zIndex: 1000,
                                    whiteSpace: 'pre',
                                    maxWidth: '400px',
                                    maxHeight: '300px',
                                    overflow: 'auto'
                                }
                            }).appendTo('body');
                            $('#jsonPopup').text(JSON.stringify(jsonData, null, 4));
                        },
                        function () {
                            $('#jsonPopup').remove();
                        }
                    );
                }
            }
        }

        function updateDuplicateButtonState(viewId, numChecked) {
            if (!viewCanDoBulkOp(viewId, 'copy')) return;
            const bulkDuplicateBtn = document.querySelector('#ktl-bulk-duplicate-' + viewId);
            if (bulkDuplicateBtn)
                bulkDuplicateBtn.disabled = (numChecked !== 1);
        }

        function previewLastBulkEditData() {
            var lastData = JSON.stringify(apiData, null, 4);
            alert(lastData);
        }

        function updateHeaderCheckboxes(viewId, numChecked = 0) {
            if (!viewId || (!viewCanDoBulkOp(viewId, 'edit') && !viewCanDoBulkOp(viewId, 'copy'))) return;
            if (numChecked) {
                $('#' + viewId + ' .bulkEditHeaderCbox').removeClass('ktlDisplayNone');

                if (viewCanDoBulkOp(viewId, 'edit')) {
                    if ($('#' + viewId + ' .bulkEditHeaderCbox:checked').length)
                        $('#' + viewId + ' tbody tr td').addClass('bulkEditSelectSrc');
                    else
                        $('#' + viewId + ' tbody tr td.cell-edit').addClass('bulkEditSelectSrc');
                }
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
        //For Bulk Duplicate, called when user clicks on Duplicate button, when one row is selected.  No columns checked means all.
        function processBulkOps(viewId, e) {
            if (!viewId) return;

            var numToProcess = 0;
            var recId;
            var operation = e.target.id;
            if (operation === 'ktl-bulk-duplicate-' + viewId) {
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
                if (!$.isEmptyObject(apiData) && e.target.id === 'ktl-bulk-paste-' + viewId) {
                    processBulkEdit(); //Paste button.
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

                    if (operation === 'ktl-bulk-duplicate-' + viewId)
                        processBulkDuplicate();
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
                                    alert('Bulk Edit Error: ' + reason.stack);
                                }, 500);
                            })

                        function showProgress() {
                            ktl.core.setInfoPopupText('Updating ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (arrayLen - countDone));
                        }
                    }
                }

                function processBulkDuplicate() {
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
                                alert('Bulk Copy Error: ' + reason.stack);
                            })

                        function showProgress() {
                            ktl.core.setInfoPopupText('Creating ' + numToProcess + ' ' + objName + ((numToProcess > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + (numToProcess - countDone));
                        }
                    }
                }
            }
        }

        //bulkOp must be "edit", "copy" or "delete".
        function viewCanDoBulkOp(viewId, bulkOp) {
            if (!viewId || !bulkOp) return false;

            const nbo = ktlKeywords[viewId] && ktlKeywords[viewId]._nbo;
            const ebo = ktlKeywords[viewId] && ktlKeywords[viewId]._ebo;

            let bulkOpEnabled = false;
            if (ebo !== undefined) {
                if (ebo.length && ebo[0].options) {
                    const options = ebo[0].options;
                    if (!ktl.core.hasRoleAccess(options)) return false;
                }

                if (ebo.length === 0)
                    bulkOpEnabled = true;
                else {
                    if (!ebo[0].params[0].length || ebo[0].params[0].includes(bulkOp))
                        bulkOpEnabled = true;
                }
            }

            let bulkOpDisabled = false;
            if (nbo !== undefined) {
                if (nbo.length && nbo[0].options) {
                    const options = nbo[0].options;
                    if (!ktl.core.hasRoleAccess(options)) return true;
                }

                if (nbo.length === 0)
                    bulkOpDisabled = true;
                else {
                    if (nbo[0].params.length && (!nbo[0].params[0].length || nbo[0].params[0].includes(bulkOp)))
                        bulkOpDisabled = true;
                }
            }

            let tableHasInlineEditing = ktl.views.viewHasInlineEdit(viewId);

            //Bulk Edit
            if (bulkOp === 'edit' && ktl.core.getCfg().enabled.bulkOps.bulkEdit) {
                if ((Knack.getUserRoleNames().includes('Bulk Edit') || bulkOpEnabled)
                    && tableHasInlineEditing
                    && !bulkOpDisabled)
                    return true;
            }

            //Bulk Copy
            if (bulkOp === 'copy' && ktl.core.getCfg().enabled.bulkOps.bulkCopy) {
                if ((Knack.getUserRoleNames().includes('Bulk Copy') || bulkOpEnabled)
                    && tableHasInlineEditing
                    && !bulkOpDisabled)
                    return true;
            }

            //Bulk Delete
            if (bulkOp === 'delete' && ktl.core.getCfg().enabled.bulkOps.bulkDelete && document.querySelector('#' + viewId + ' .kn-link-delete')) {
                if ((Knack.getUserRoleNames().includes('Bulk Delete') || bulkOpEnabled)
                    && !bulkOpDisabled)
                    return true;
            }

            //Bulk Action
            if (bulkOp === 'action' && ktl.core.getCfg().enabled.bulkOps.bulkAction) {
                if ((Knack.getUserRoleNames().includes('Bulk Action') || bulkOpEnabled)
                    && !bulkOpDisabled)
                    return true;
            }

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
                if (ktl.scenes.isiFrameWnd() || ktl.core.isKiosk() || !(viewType === 'table' || viewType === 'search') || !data.length)
                    return;

                if (!viewCanDoBulkOp(view.key, 'edit') && !viewCanDoBulkOp(view.key, 'copy') && !viewCanDoBulkOp(view.key, 'delete') && !viewCanDoBulkOp(view.key, 'action'))
                    return;

                //Put code below in a shared function (see _lud in this.log).
                if (!view.fields) return;

                let lud = '';
                let lub = '';

                view.fields.filter(f => !!f).forEach(field => {
                    const descr = field.meta && field.meta.description.replace(/(\r\n|\n|\r)|<[^>]*>/gm, " ").replace(/ {2,}/g, ' ').trim();
                    descr === '_lud' && (lud = field.key);
                    descr === '_lub' && (lub = field.key);
                })

                if (lud && lub) {
                    bulkOpsLudFieldId = lud;
                    bulkOpsLubFieldId = lub;
                }


                //IMPORTANT!!  noInlineEditing must be called before enableBulkOperations because
                //its effect on the cells' inline editing has an impact on the bulk selection process.
                ktl.views.noInlineEditing(view);

                if (viewCanDoBulkOp(view.key, 'edit') || viewCanDoBulkOp(view.key, 'copy') || viewCanDoBulkOp(view.key, 'delete') || viewCanDoBulkOp(view.key, 'action')) {
                    bulkOpsActive[view.key] = true;
                    enableBulkOperations(view, data);
                }
            },
        }
    })(); //Bulk Operations feature

    //====================================================
    //System Info feature
    this.sysInfo = (function () {
        const STARTUP_WD_TIMEOUT_DELAY = 240;
        const NORMAL_WD_TIMEOUT_DELAY = 120;
        const WD_SAFETY_MARGIN = 1.5;

        var sysInfo = {
            os: 'Unknown',
            browser: 'Unknown',
            ip: 'Unknown',
            model: 'Unknown',
            processor: 'Unknown',
            mobile: '',
            hasLocalServer: false, //TODO
            keyboardDetected: false,
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
                $.get('https://api.ipify.org?format=json', function (data, status) {
                    if (status === 'success') {
                        var publicIP = data.ip;
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

                if (!deviceIsCompatibleWithRecoveryWd) return;

                if (!cfg.recoveryWatchdogEnabled) {
                    ktl.sysInfo.sendRecoveryWdHeartbeat(0); //Zero means "Disable Recovery WD".
                    return;
                }

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
                                        if (svrResponse.deviceInfo) {
                                            const deviceInfo = svrResponse.deviceInfo;
                                            wdTimeoutDelay = NORMAL_WD_TIMEOUT_DELAY;
                                            if (deviceInfo && !$.isEmptyObject(deviceInfo)) {
                                                addToVersionInfoBar(deviceInfo);
                                                let sysInfo = ktl.sysInfo.getSysInfo();
                                                sysInfo.keyboardDetected = deviceInfo.keyboardDetected;

                                                //TODO: investigate why this doesn't work.  Goal: if service comes back (ex: manual restart), remove classes.
                                                //if ($('#additionalInfoDiv').length)
                                                //    $('#additionalInfoDiv').removeClass('ktlFlashingOnOff ktlOfflineStatus');
                                            }
                                        } else {
                                            //Force a kiosk-app update.
                                            ktl.sysInfo.restartService()
                                                .then(svrResponse => {
                                                    ktl.core.timedPopup(svrResponse.message, 'success', 4000);
                                                    ktl.account.updateLocalIP();
                                                })
                                                .catch(error => { ktl.core.timedPopup(error, 'error', 4000); })


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

                                            document.querySelector('#additionalInfoDiv').textContent = ' WAITING FOR UPDATE... ';
                                        }
                                    })
                                    .catch(reason => {
                                        console.error(reason);

                                        if ($('#additionalInfoDiv').length)
                                            $('#additionalInfoDiv').addClass('ktlFlashingOnOff ktlOfflineStatus');

                                        if (ktl.core.getCfg().developerNames.includes(Knack.getUserAttributes().name))
                                            ktl.core.timedPopup('Reset WD error: ' + reason, 'error');
                                        wdTimeoutDelay = STARTUP_WD_TIMEOUT_DELAY;
                                    })
                                    .finally(() => {
                                        wdLoopTimeout = setTimeout(recoveryWdLoop, wdTimeoutDelay / WD_SAFETY_MARGIN * 1000);
                                    });
                            }
                        }

                        function addToVersionInfoBar(deviceInfo) {
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

                            const percentageMemoryUsed = (!isNaN(deviceInfo.memorySizeMB) && deviceInfo.memorySizeMB > 0) ? `${Math.round((deviceInfo.maxMemory / deviceInfo.memorySizeMB) * 100)}` : 'N/A';
                            const deviceInfoString = `Kbd:${deviceInfo.keyboardDetected ? 'Y' : 'N'}  Host:${deviceInfo.hostname}  IP:${deviceInfo.localIP}  ${deviceInfo.CPUTemperature}°C / ${deviceInfo.maxCPUTemperature}°C max  Used:${deviceInfo.usedMemory}  Max:${deviceInfo.maxMemory} ${percentageMemoryUsed}%  Tot:${deviceInfo.memorySizeMB} (${deviceInfo.memorySizeGB})`;
                            document.querySelector('#additionalInfoDiv').textContent = ' ' + deviceInfoString + ' ';
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
                    if (regex.test(kwKey) || regex.test(str)) {
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

            keywordsToString: function (depth = 10) {
                const stringifiedKeywords = ktl.core.objectToString(ktlKeywords, depth);
                console.log(stringifiedKeywords);
                const numberOfProperties = ktl.core.countOwnPropertiesRecursively(ktlKeywords, depth);
                console.log('Stringified keywords length, as currently displayed: ', stringifiedKeywords.length);
                console.log('Number of properties: ', numberOfProperties);
                if (depth >= 2) {
                    const pattern = /"_([a-zA-Z])/g;
                    const matches = stringifiedKeywords.match(pattern);
                    const count = matches ? matches.length : 0;
                    console.log('Number of Keywords: ', count);
                }
            },

            countKeywords: function (obj) {
                const propertyCount = {};
                let totalKeywords = 0;

                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        const subObj = obj[key];
                        for (const subKey in subObj) {
                            // Check if the property starts with an underscore followed by at least one letter
                            if (/^_[a-zA-Z]/.test(subKey)) {
                                if (!propertyCount[subKey]) {
                                    propertyCount[subKey] = 0;
                                }
                                propertyCount[subKey]++;
                                totalKeywords++;
                            }
                        }
                    }
                }

                // Convert to sorted array
                const sortedProperties = Object.keys(propertyCount).map(key => {
                    return { key, count: propertyCount[key] };
                }).sort((a, b) => b.count - a.count);

                // Create a new object with sorted properties
                const sortedObject = {};
                sortedProperties.forEach(item => {
                    sortedObject[item.key] = item.count;
                });

                // Add the total keyword count
                sortedObject["Total keywords"] = totalKeywords;

                return JSON.stringify(sortedObject, null, 2);
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
                    //console.log('entering sendRecoveryWdHeartbeat', wdTimeoutDelay);
                    if (typeof Android !== 'undefined' && typeof Android.resetWatchdog === 'function') {
                        setTimeout(() => { //This delay fixes the problem with Kiosk Browser crashing intermittently.
                            Android.resetWatchdog(wdTimeoutDelay);
                        }, 500);
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
                                console.error('Server error', xhr);
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
        if (!SYSOP_DASHBOARD_ACC_STATUS) return;

        const onlineStatusFieldId = ktl.iFrameWnd.getCfg().acctOnlineFld;
        const localHeartBeatFieldId = ktl.iFrameWnd.getCfg().acctLocHbFld;
        const lastActivityFieldId = ktl.iFrameWnd.getCfg().acctUtcLastActFld;
        const swVersionFieldId = ktl.iFrameWnd.getCfg().acctSwVersionFld;

        const statusMonitoring = {
            online: [],
            offline: [],
        }

        let readyToProcessRecords = true;

        $(document).on('KTL.filterApplied', (event, viewId) => {
            if (viewId === SYSOP_DASHBOARD_ACC_STATUS) {
                if (readyToProcessRecords)
                    processRecordsUpdate(viewId);
            }
        });

        $(document).on('KTL.StatusMonitoring.Updated', (event, statusMonitoring) => {
            //console.log('KTL.StatusMonitoring.Updated - statusMonitoring =', statusMonitoring);
        });

        $(document).on('knack-view-render.' + SYSOP_DASHBOARD_ACC_STATUS, function (event, view, data) {
            //Colorize fields - Online and Last Activity.
            $(`#${SYSOP_DASHBOARD_ACC_STATUS} tbody .${localHeartBeatFieldId}`).removeClass('ktlOfflineStatus');
            for (const offline of statusMonitoring.offline) {
                $(`#${SYSOP_DASHBOARD_ACC_STATUS} tbody tr[id=${offline.id}] .${localHeartBeatFieldId}`).addClass('ktlOfflineStatus');
            }

            const nowUTC = Date.parse(ktl.core.getCurrentDateTime(true, false, false, true));
            data.forEach(record => {
                const rowSelector = `#${SYSOP_DASHBOARD_ACC_STATUS} tr[id="${record.id}"]`;
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
            })
        });

        function processRecordsUpdate(viewId) {
            readyToProcessRecords = false;
            const data = Knack.views[viewId].model && Knack.views[viewId].model.data && Knack.views[viewId].model.data.models;
            if (!data || !data.length) return;

            const recordsToUpdate = refreshRecords(data);
            updateAccounts(recordsToUpdate, viewId)
                .then(updatedCount => {
                    $(document).trigger('KTL.StatusMonitoring.Updated', [statusMonitoring]);

                    if (updatedCount) {
                        //ktl.log.clog('green', 'Status Monitoring - updated count', updatedCount);
                        ktl.views.refreshView(SYSOP_DASHBOARD_ACC_STATUS);
                    }

                    setTimeout(() => {
                        readyToProcessRecords = true; //Prevent re-entry due to consecutive view refreshes.
                    }, 15000);
                })
        }

        function refreshRecords(data) {
            const DEVICE_OFFLINE_DELAY = ONE_MINUTE_DELAY * 3;
            const recordsToUpdate = [];
            const acctUtcHbFldId = ktl.iFrameWnd.getCfg().acctUtcHbFld;
            const nowUTC = Date.parse(ktl.core.getCurrentDateTime(true, false, false, true));
            statusMonitoring.online = [];
            statusMonitoring.offline = [];

            data.forEach(rec => {
                const record = rec.attributes;
                const utcHeartBeatField = record[acctUtcHbFldId];
                const onlineField = record[onlineStatusFieldId];
                const diff = nowUTC - Date.parse(utcHeartBeatField);

                //Take note of those who need their Online status to be updated.
                if (isNaN(diff) || diff >= DEVICE_OFFLINE_DELAY) {
                    if (onlineField !== 'No') // Yes or blank
                        recordsToUpdate.push({ record: record, online: 'No' });

                    statusMonitoring.offline.push(record);
                } else {
                    if (onlineField === 'No')
                        recordsToUpdate.push({ record: record, online: 'Yes' });

                    statusMonitoring.online.push(record);
                }
            })

            return recordsToUpdate;
        }

        function updateAccounts(recordsToUpdate, viewKey) {
            return new Promise(async function (resolve) {
                ktl.scenes.spinnerWatchdog(false);

                let updatedCount = 0;

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

                    resolve(updatedCount);
                });

                function sendUpdate(recObj) {
                    const record = recObj.record;

                    const firstNameField = record[ktl.iFrameWnd.getCfg().acctFirstNameFld];
                    const lastNameField = record[ktl.iFrameWnd.getCfg().acctLastNameFld];
                    const accountName = firstNameField + ' ' + lastNameField;

                    const apiData = {};
                    apiData[onlineStatusFieldId] = recObj.online;

                    return ktl.core.knAPI(viewKey, record.id, apiData, 'PUT', [], false)
                        .then(function () {
                            updatedCount++;
                            updateInfoPopup(accountName, ` is ${recObj.online === 'Yes' ? 'ONLINE' : 'OFFLINE'}`);
                        })
                        .catch(function (reason) {
                            console.debug('Offline - failed updating account:', accountName + ', reason: ' + JSON.stringify(reason));
                            updateInfoPopup(accountName, ` is ${recObj.online === 'Yes' ? 'ONLINE' : 'OFFLINE'} (failed)`);
                        });
                }

                function updateInfoPopup(accountName, status) {
                    if (accountName && updatedCount) {
                        if (updatedCount === 1)
                            ktl.core.infoPopup();
                        ktl.core.setInfoPopupText('Updated ' + accountName + status);
                    }
                }
            })
        }
    })(); //Status Monitoring feature

    //===================================================
    //Developer Popup Tool feature
    this.developerPopupTool = function () {
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

                const viewId = $(element).closest('.kn-view[id]').attr('id');
                if (Knack.views[viewId] && !document.querySelector('#kn-add-option')) {
                    const sceneId = $(element).closest('.kn-scene[id]').attr('id').substring(3);
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
                    if (fieldId) {
                        const field = Knack.objects.getField(fieldId);
                        const linkedObject = (field.attributes.relationship) ? field.attributes.relationship.object : field.attributes.object_key;
                        const url = (linkedObject) ? `${baseURL}/records/objects/${linkedObject}/record/${linkedRecord}/edit` : undefined;
                        container.appendChild(createLine('<b>Connects to</b> ' + linkedRecord, url));
                    }
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
                    if (fieldId) {
                        const field = Knack.objects.getField(fieldId);
                        const linkedObject = (field.attributes.relationship) ? field.attributes.relationship.object : field.attributes.object_key;
                        const url = (linkedObject) ? `${baseURL}/records/objects/${linkedObject}/record/${record.id}/edit` : undefined;
                        container.appendChild(createLine(`<b>Connects to</b> ${record.label} - ${record.id}`, url));
                    }
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
    };//developerPopupTool

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

                        if (ktl.sysInfo.getSysInfo().keyboardDetected)
                            $('.simple-keyboard').hide();

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
                if (sys.os === 'Linux' /*&& sys.processor.includes('arm')*/ || ktl.core.getCfg().forceVirtualKeyboard !== undefined)
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

window.kw2str = function (depth = 10) {
    ktl.sysInfo.keywordsToString(depth);
}

window.kwcount = function () {
    const kwCount = ktl.sysInfo.countKeywords(ktlKeywords);
    console.log('Count of each KTL Keywords:\n\n', kwCount);
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
