/**
 * Knack Toolkit Library (ktl) - Javascript
 * See documentation for more details on github:  https://github.com/cortexrd/Knack-Toolkit-Library
 *
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license GPLv3
 * 2019-2022
 * */

window.APP_ROOT_NAME = Knack.app.attributes.name + '_';
const APP_ROOT_NAME = window.APP_ROOT_NAME;

window.IFRAME_WND_ID = 'iFrameWnd';
const IFRAME_WND_ID = window.IFRAME_WND_ID;

const TEN_SECONDS_DELAY = 10000;
const ONE_MINUTE_DELAY = 60000;
const FIVE_MINUTES_DELAY = ONE_MINUTE_DELAY * 5;
const ONE_HOUR_DELAY = ONE_MINUTE_DELAY * 60;

function Ktl($) {
    const KTL_VERSION = '0.6.15';
    const APP_VERSION = window.APP_VERSION;
    const APP_KTL_VERSIONS = APP_VERSION + ' - ' + KTL_VERSION;
    window.APP_KTL_VERSIONS = APP_KTL_VERSIONS;

    var ktl = this;

    //KEC stands for "KTL Event Code".  Next:  KEC_1025
    //

    /**
    * Exposed constant strings
    *  @constant
    */
    this.const = {
        //Local Storage constants
        LS_USER_PREFS: 'USER_PREFS_',

        LS_LOGIN: 'LOGIN_',
        LS_ACTIVITY: 'ACTIVITY_',
        LS_NAVIGATION: 'NAVIGATION_',
        LS_INFO: 'INF_',
        LS_DEBUG: 'DBG_',
        LS_WRN: 'WRN_',
        LS_APP_ERROR: 'APP_ERR_',
        LS_SERVER_ERROR: 'SVR_ERR_',
        LS_CRITICAL: 'CRI_',

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

    /**
        * Core functions
        * @param  {} function(
        */
    this.core = (function () {
        window.addEventListener("resize", (event) => {
            ktl.core.sortMenu(); //To resize menu and prevent overflowing out of screen bottom when Sticky is used.
        });

        var cfg = {
            //IMPORTANT!!! DO NOT EDIT THIS SECTION.  Instead, use the ktl.core.setCfg function.
            developerName: '',
            developerEmail: '',
            enabled: { //Main KTL feature switches.  By default, all is disabled and your App enables what is desired in ktl.core.setCfg.
                showAppInfo: false,
                showKtlInfo: false,
                showMenuInTitle: false,
                selTextOnFocus: false,
                chznBetter: false,
                autoFocus: false,
                userFilters: false,
                persistentForm: false,
                debugWnd: false,
                idleWatchDog: false,
                spinnerWatchDog: false,

                //Those below nust also be properly setup to have any effect.  See documentation.
                iFrameWnd: false,
                logging: {
                    logins: false,
                    navigation: false,
                    activity: false,
                },

                bulkOps: {
                    bulkEdit: false,
                    bulkDelete: false,
                },
            },
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
                cfgObj.developerName && (cfg.developerName = cfgObj.developerName);
                cfgObj.developerEmail && (cfg.developerEmail = cfgObj.developerEmail);
                cfgObj.enabled && (cfg.enabled = cfgObj.enabled);
                cfgObj.isKiosk && (isKiosk = cfgObj.isKiosk);
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

                    var failsafeTimeout = setTimeout(function () {
                        if (intervalId) {
                            clearInterval(intervalId);
                            reject(new Error('Called knAPI with invalid scene key'));
                            return;
                        }
                    }, 5000);

                    //Wait for scene key to settle.  An undefined value happens sometimes when returning from a form's submit back to its parent.
                    var sceneKey = Knack.router.scene_view.model.views._byId[viewId];
                    var intervalId = setInterval(function () {
                        if (!sceneKey)
                            sceneKey = Knack.router.scene_view.model.views._byId[viewId];
                        else {
                            clearInterval(intervalId);
                            intervalId = null;
                            clearTimeout(failsafeTimeout);

                            sceneKey = sceneKey.attributes.scene.key;
                            var apiURL = 'https://api.knack.com/v1/pages/' + sceneKey + '/views/' + viewId + '/records/';

                            if (recId)
                                apiURL += recId;

                            //TODO: Support GET requests with filter.

                            if (showSpinner)
                                Knack.showSpinner();

                            //console.log('apiURL =', apiURL);
                            //console.log('knAPI - viewId: ', viewId, ', recId:', recId, ', requestType', requestType);

                            $.ajax({
                                url: apiURL,
                                type: requestType,
                                crossDomain: true, //Attempting to reduce the frequent but intermittent CORS error message.
                                retryLimit: 8,
                                headers: {
                                    'Authorization': Knack.getUserToken(),
                                    'X-Knack-Application-Id': Knack.application_id,
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*.knack.com', //Attempting to reduce the frequent but intermittent CORS error message.  No success.  Someone... Please help me!!!
                                },
                                data: JSON.stringify(apiData),
                                success: function (data) {
                                    Knack.hideSpinner();
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
                                        Knack.hideSpinner();

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
                        }
                    }, 100);
                })
            },

            isKiosk: function () {
                return isKiosk ? isKiosk() : false;
            },

            //Param is selector string and optionally if we want to put back a hidden element as it was.
            hideSelector: function (sel = '', show = false) {
                sel && ktl.core.waitSelector(sel)
                    .then(() => {
                        if (show)
                            $(sel).css({ 'position': '', 'left': '' });
                        else
                            $(sel).css({ 'position': 'absolute', 'left': '-9000px' });
                    })
                    .catch(() => { ktl.log.clog('purple', 'hideSelector failed waiting for selector: ' + sel); });
            },

            //Param: sel is a string, not the jquery object.
            waitSelector: function (sel = '', timeout = 2000, is = '', outcome = ktl.const.WAIT_SEL_IGNORE, scanSpd = ktl.const.WAIT_SELECTOR_SCAN_SPD) {
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
                        } else if (outcome === ktl.const.WAIT_SEL_ALERT && Knack.getUserAttributes().name === ktl.core.getCfg().developerName)
                            alert('waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);

                        reject();
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

            switchVersion: function (ver = 'prod') {
                if (ver === 'prod')
                    ktl.storage.lsRemoveItem('dev');
                else if (ver === 'dev')
                    ktl.storage.lsSetItem('dev', '');

                ktl.debugWnd.lsLog('Switching version to ' + ver);

                setTimeout(() => {
                    if (ktl.scenes.isiFrameWnd())
                        ktl.wndMsg.send('reloadAppMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { reason: 'MANUAL_REFRESH' });
                    else
                        location.reload(true);
                }, 2000);
            },

            enableDragElement: function (el) {
                var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
                if (document.getElementById(el.id + "header")) {
                    // if present, the header is where you move the DIV from:
                    document.getElementById(el.id + "header").onmousedown = dragMouseDown;
                    document.getElementById(el.id + "header").ontouchstart = dragMouseDown;
                } else {
                    // otherwise, move the DIV from anywhere inside the DIV:
                    el.onmousedown = dragMouseDown;
                    el.ontouchstart = dragMouseDown;
                }

                function dragMouseDown(e) {
                    e = e || window.event;
                    e.preventDefault();
                    // get the mouse cursor position at startup:
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    document.ontouchend = closeDragElement;
                    // call a function whenever the cursor moves:
                    document.onmousemove = elementDrag;
                    document.ontouchmove = elementDrag;
                }

                function elementDrag(e) {
                    e = e || window.event;
                    e.preventDefault();

                    var clientX = e.clientX || e.touches[0].clientX;
                    var clientY = e.clientY || e.touches[0].clientY;

                    // calculate the new cursor position:
                    pos1 = pos3 - clientX;
                    pos2 = pos4 - clientY;
                    pos3 = clientX;
                    pos4 = clientY;

                    // set the element's new position:
                    el.style.left = (el.offsetLeft - pos1) + "px";
                    el.style.top = (el.offsetTop - pos2) + "px";
                }

                function closeDragElement() {
                    // stop moving when mouse button is released:
                    document.onmouseup = null;
                    document.onmousemove = null;
                    document.ontouchmove = null;
                    document.ontouchend = null;
                    document.ontouchstart = null;
                }
            },

            splitUrl: function (url) {
                var urlParts = {};
                var indexParams = url.indexOf('?');
                if (indexParams === -1)
                    urlParts['path'] = url;
                else
                    urlParts['path'] = url.substring(0, indexParams);

                var params = {};
                var pairs = url.substring(url.indexOf('?') + 1).split('&');

                for (var i = 0; i < pairs.length; i++) {
                    if (!pairs[i])
                        continue;
                    var pair = pairs[i].split('=');
                    if (typeof (pair[1]) !== 'undefined')
                        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }

                urlParts['params'] = params;

                return urlParts;
            },

            // Returns Top Menu, Menu and Link.
            getMenuInfo: function () {
                var linkStr = window.location.href;
                var topMenu = null;
                var topMenuStr = '';
                var menuStr = '';

                var menuElem = document.querySelector('#app-menu-list .is-active > a > span');
                menuElem && (menuStr = menuElem.innerText);

                if (ktl.core.isKiosk()) {
                    topMenuStr = 'Kiosk Mode - no menu'; //For some reason, Kiosk's Menu have many entries.
                } else {
                    menuElem && (topMenu = menuElem.closest('.kn-dropdown-menu'));
                    if (topMenu) {
                        topMenuStr = topMenu.innerText;

                        //Special case for Apple devices, where all menus are included.  Must cleanup and keep only first one.
                        if (topMenuStr.length >= 13 && topMenuStr.substr(0, 13) === '\n            ') {
                            var array = topMenuStr.split('\n            ');
                            topMenuStr = array[1];
                        }
                    }
                }

                return { topmenu: topMenuStr.trim(), menu: menuStr.trim(), link: linkStr.trim() };
            },

            isHex: function (str) {
                var regexp = /^[0-9a-fA-F]+$/;
                if (regexp.test(str))
                    return true;
                else
                    return false;
            },

            isIPFormat: function (ipAddress) {
                var ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (ipAddress.match(ipformat)) {
                    return true;
                }
                else {
                    return false;
                }
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

            //Currently supports 2 and 3 digits only.  Needs better error handling.
            //Returns string in format:  mm/dd/yyyy HH:MM:SS.mmm
            getCurrentDateTime: function (withDate = true, withSeconds = true, withMilliseconds = true, useUTC = false) {
                var date = '';
                var today = new Date();

                if (useUTC) {
                    if (withDate)
                        date = ktl.core.addZero(today.getUTCMonth() + 1) + '/' + ktl.core.addZero(today.getUTCDate()) + '/' + today.getUTCFullYear();

                    var time = ktl.core.addZero(today.getUTCHours()) + ':' + ktl.core.addZero(today.getUTCMinutes());
                    if (withSeconds)
                        time += ':' + ktl.core.addZero(today.getUTCSeconds());
                    if (withMilliseconds)
                        time += ':' + ktl.core.addZero(today.getUTCMilliseconds(), 3, withMilliseconds);
                } else {
                    if (withDate)
                        date = ktl.core.addZero(today.getMonth() + 1) + '/' + ktl.core.addZero(today.getDate()) + '/' + today.getFullYear();

                    var time = ktl.core.addZero(today.getHours()) + ':' + ktl.core.addZero(today.getMinutes());
                    if (withSeconds)
                        time += ':' + ktl.core.addZero(today.getSeconds());
                    if (withMilliseconds)
                        time += ':' + ktl.core.addZero(today.getMilliseconds(), 3, withMilliseconds);
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

            //Selects all text from an element.
            //Omit el param to de-select.
            selectElementContents: function (el = null) {
                var body = document.body, range, sel;
                if (document.createRange && window.getSelection) {
                    range = document.createRange();
                    sel = window.getSelection();
                    sel.removeAllRanges();
                    if (el === null)
                        return;
                    try {
                        range.selectNodeContents(el);
                        sel.addRange(range);
                    } catch (e) {
                        range.selectNode(el);
                        sel.addRange(range);
                    }
                } else if (body.createTextRange) {
                    range = body.createTextRange();
                    range.moveToElementText(el);
                    range.select();
                }
            },

            timedPopup: function (msg, status = 'success', duration = 2000) {
                if (timedPopupEl)
                    ktl.core.removeTimedPopup();

                if (!progressWnd) {
                    timedPopupEl = document.createElement('div');
                    var style = 'position:fixed;top:20%;left:50%;margin-right:-50%;transform:translate(-50%,-50%) \
;min-width:300px;min-height:50px;line-height:50px; \
font-size:large;text-align:center;font-weight:bold;border-radius:25px;padding-left:25px;padding-right:25px;white-space:pre';

                    if (status === 'warning')
                        style += ';background-color:#fffa5e;border:2px solid #7e8060;top:10%';
                    else if (status === 'error')
                        style += ';background-color:#FFB0B0;border:5px solid #660000';
                    else //Default is success
                        style += ';background-color:#81b378;border:5px solid #294125';

                    timedPopupEl.setAttribute('style', style);

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

            infoPopup: function (addedStyle = '') {
                var el = document.createElement('div');
                el.id = 'kn-modeless-wnd';

                //Default style, that can be modified or incremented by parameter.
                var style = 'position:fixed;top:20%;left:50%;margin-right:-50%;transform:translate(-50%,-50%)';
                style += ';min-width:300px;min-height:50px;line-height:50px;font-size:large;text-align:center;font-weight:bold;border-radius:25px;padding-left:25px;padding-right:25px';
                style += ';background-color:#81b378;border:5px solid #294125; white-space:pre';
                el.setAttribute('style', style + ';' + addedStyle);
                document.body.appendChild(el);
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
                referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
            },

            //Ensures that the context menu follows the mouse, but without overflowing outside of window.
            setContextMenuPostion: function (event, contextMenu) {
                var mousePosition = {};
                var menuPostion = {};
                var menuDimension = {};
                menuDimension.x = contextMenu.outerWidth();
                menuDimension.y = contextMenu.outerHeight();
                mousePosition.x = event.clientX;
                mousePosition.y = event.clientY;

                if (mousePosition.x + menuDimension.x > $(window).width())
                    menuPostion.x = mousePosition.x - menuDimension.x;
                else
                    menuPostion.x = mousePosition.x;

                if (mousePosition.y + menuDimension.y > $(window).height())
                    menuPostion.y = mousePosition.y - menuDimension.y;
                else
                    menuPostion.y = mousePosition.y;

                return menuPostion;
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
                if (ktl.scenes.isiFrameWnd()) return;

                if (Knack.isMobile()) {
                    $('.kn-mobile-controls').mousedown(function (e) {
                        ktl.core.waitSelector('#kn-mobile-menu.is-visible')
                            .then(() => {
                                var allMenus = $('#kn-mobile-menu').find('.kn-dropdown-menu-list');
                                for (i = 0; i < allMenus.length - 1; i++)
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

                var i, switching, allListElements, shouldSwitch;
                switching = true;
                while (switching) {
                    switching = false;
                    allListElements = uListElem.getElementsByTagName("LI");
                    for (i = 0; i < allListElements.length - 1; i++) {
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

            convertDateTimeToString: function (dt) {
                if (!dt) return;
                const dtOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' };
                return dt.toLocaleDateString(undefined, dtOptions);
            },
        }
    })();

    //====================================================
    //Storage Feature
    //Utilities related to cookies and localStorage.
    this.storage = (function () {
        const COOKIE_DEFAULT_EXP_DAYS = 1;
        var hasLocalStorage = typeof (Storage) !== 'undefined';

        return {
            hasLocalStorage: function () {
                return hasLocalStorage;
            },

            // Just specify key and func will prepend APP_ROOT_NAME.
            // Typically used for generic utility storage, like logging, custom filters, user preferences, etc.
            lsSetItem: function (lsKey, data) {
                if (lsKey.indexOf('undefined') >= 0)
                    return; //Needed to prevent logging pre-login events.

                if (hasLocalStorage) {
                    localStorage.setItem(APP_ROOT_NAME + lsKey, data);
                } else
                    alert('KEC_1005 - lsSetItem called without storage');
            },

            //Returns empty string if key doesn't exist.
            lsGetItem: function (lsKey) { //TODO: lsGetItem - fix and allow returing null if key doesn't exist.
                var val = '';
                if (hasLocalStorage)
                    val = localStorage.getItem(APP_ROOT_NAME + lsKey);
                return val ? val : '';
            },

            lsRemoveItem: function (lsKey) {
                hasLocalStorage && localStorage.removeItem(APP_ROOT_NAME + lsKey);
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
        }
    })();

    //====================================================
    //Fields feature
    this.fields = (function () {
        var keyBuffer = '';
        var usingBarcodeReader = false;
        var onKeyPressed = null;
        var onFieldValueChanged = null;
        var textAsNumeric = []; //These are text fields that must be converted to numeric.
        var chznBetterSrchDelay = 1500; //Default is fine-tuned experimentally, for 'a bit below average' typing speed.
        var chznBetterThresholds = {};
        var chznBetterToExclude = [];
        var chznBetterSetFocus = null;
        var convertNumDone = false;

        var chznBetterTxt = '';
        var chznChoicesIntervalId = null;
        var chznLastKeyTimer = null;

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
                    setTimeout(function () { $('#cell-editor > div.submit > a').trigger('click'); }, 200);
                } else if (document.querySelector('#cell-editor .kn-button[disabled=disabled]'))
                    e.preventDefault();


                //Filters: enables using the enter key to select and submit.
                setTimeout(function () { $('#kn-submit-filters').trigger('click'); }, 200);
            }
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

            /*
            //Work in progress:  When user clicks on a cell for inline editing, provide a method to change its style, to make it wider for example.
            console.log('e.target =', e.target);

            var popover = e.target.closest('.kn-popover');
            if (popover) {
                console.log('popover =', popover);
                console.log('e.target.parentElement =', e.target.parentElement);
            }

            if (e.target.classList) {
                console.log('e.target.classList =', e.target.classList);
                var target = e.target;
                if (e.target.classList.value.includes('col-'))
                    target = e.target.parentElement;

                console.log('target =', target);
                if (target.classList && target.classList.value.includes('cell-edit')) {
                    var fieldId = target.attributes['data-field-key'].value;
                    console.log('fieldId =', fieldId);
                    if (true || fieldId === 'field_x') { //TODO provide an array of fields and their style to apply.
                        ktl.core.waitSelector('#cell-editor ' + ' #' + fieldId)
                            .then(() => {
                                console.log('Found inline 1');
                                ktl.fields.inlineEditChangeStyle();
                            })
                            .catch(() => {
                                console.log('1 - Failed waiting for cell editor.');
                            });

                        ktl.core.waitSelector('#cell-editor ' + ' #kn-input-' + fieldId)
                            .then(() => {
                                console.log('Found inline 2');
                                ktl.fields.inlineEditChangeStyle();
                            })
                            .catch(() => {
                                console.log('2 - Failed waiting for cell editor.');
                            });
                    }
                }
            }
            */
        })

        document.addEventListener('focus', function (e) {
            if (document.activeElement.classList.contains('input')) {
                //Turn-off auto complete for Kiosks. Users are annoyed by the dropdown that blocks the Submit button.
                if (ktl.core.isKiosk())
                    document.activeElement.setAttribute('autocomplete', 'off');

                try { //Prevent error on unsupported elements.
                    ktl.core.getCfg().enabled.selTextOnFocus && document.activeElement.setSelectionRange(0, document.activeElement.value.length); //Auto-select all text of input field.
                } catch (err) { }


                //Find a better way than redo all over again.
                convertNumDone = false;
                ktl.fields.convertNumToTel();
            }

            //Do we need to add the chznBetter object?
            //chznBetter is ktl's fix to a few chzn dropdown problems.
            //Note that support of multi-selection type has been removed.  Too buggy for now, and needs more work.
            if (ktl.core.getCfg().enabled.chznBetter && e.path.length >= 1 && !ktl.fields.getUsingBarcode()) {
                //Do we have a chzn dropdown that has more than 500 entries?  Only those have an autocomplete field and need a fix.
                var dropdownId = $(e.target).closest('.chzn-container').attr('id');
                var isMultiSelect = $(e.target).closest('.chzn-container-multi').length > 0;

                var dropdownNeedsFix = false;
                if (dropdownId !== undefined && !dropdownId.includes('kn_conn_'))
                    dropdownNeedsFix = $('#' + dropdownId).find('.ui-autocomplete-input').length > 0;

                if (e.target.tagName.toLowerCase() === 'input') {
                    if (dropdownId !== undefined && $('#' + dropdownId).find('#chznBetter').length > 0) {
                        //console.log('Clicked dropdown already has chznBetter');
                    } else {
                        clearInterval(chznChoicesIntervalId);
                        if ($('#chznBetter').length > 0)
                            $('#chznBetter').remove();

                        if (dropdownNeedsFix && dropdownId.length > 0 && !isMultiSelect) {
                            if ($('#chznBetter').length === 0)
                                ktl.fields.addChznBetter(dropdownId);
                        }
                    }
                }
            }
        }, true);

        $(document).on('input', function (e) {
            if (!ktl.fields.getUsingBarcode()) {
                ktl.fields.enforceNumeric();

                //Process special field flags
                var fieldDesc = ktl.fields.getFieldDescription(e.target.id);
                if (fieldDesc && fieldDesc.includes('TO_UPPERCASE'))
                    e.target.value = e.target.value.toUpperCase();

                if ($(e.target).length > 0) {
                    var inputVal = $(e.target).val();
                    var threshold = 0;
                    if ($('#chznBetter').length > 0)
                        threshold = $('#chznBetter').attr('threshold');

                    if ($(e.target)[0].id === 'chznBetter') {
                        //Leave this here even though we update these two variables again a few lines below.
                        //This is to cover cases where threshold chars is not reached and focus is set elsewhere by user.
                        inputVal = inputVal.replace(' ', '');
                        chznBetterTxt = inputVal;
                        chznLastKeyTimer = setTimeout(function () {
                            if (inputVal.length >= threshold) {
                                //console.log('inputVal =', inputVal);
                                inputVal = $(e.target).val().replace(' ', ''); //Get a last update in case user was quick and entered more than threshold chars.
                                ktl.fields.searchChznBetterDropdown(inputVal);
                            }
                        }, chznBetterSrchDelay);
                    } else if ($(e.target)[0].className.includes('ui-autocomplete-input')) {
                        var chznBetter = $(e.target).parent().find('#chznBetter');
                        if (chznBetter.length > 0) {
                            //When focus is switched to input in background, leave it there,
                            //but copy input text to foreground chznBetter field so user can see it.
                            inputVal = inputVal.replace(' ', '');
                            chznBetterTxt = inputVal;
                            chznBetter.val(chznBetterTxt);

                            //Update filtered results again.
                            chznLastKeyTimer = setTimeout(function () {
                                if (inputVal.length >= threshold) {
                                    inputVal = $(e.target).val().replace(' ', ''); //Get a last update in case user was quick and entered more than 4 chars.
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
            $('.chzn-select').chosen().change(function (e, p) {
                if (e.target.id && e.target.selectedOptions[0]) {
                    var text = e.target.selectedOptions[0].innerText;
                    var recId = e.target.selectedOptions[0].value; //@@@ TODO: create a function called hasRecIdFormat() to validate hex and 24 chars.
                    if (text !== '' && text !== 'Select' && text !== 'Type to search') {
                        text = findLongestWord(text); //Maximize your chances of finding something unique, thus reducing the number of records found.
                        processFieldChanged({ text: text, recId: recId, e: e });
                    }
                }
            })

            function findLongestWord(str) {
                var longestWord = str.split(/[^a-zA-Z0-9]/).sort(function (a, b) { return b.length - a.length; });
                return longestWord[0];
            }

            //Calendars
            $('.knack-date').datepicker().change(function (e) {
                processFieldChanged({ text: e.target.value, e: e });
            })

            //More to come...
            //TODO: radio buttons, multiple selection dropdowns

            //For text input changes, see inputHasChanged
            function processFieldChanged({ text: text, recId: recId, e: e }) {
                //console.log('processFieldChanged', text, recId, e);
                try {
                    var viewId = e.target.closest('.kn-view').id;
                    var fieldId = document.querySelector('#' + e.target.id).closest('.kn-input').getAttribute('data-input-id')
                        || document.querySelector('#' + viewId + ' .kn-search-filter #' + e.target.id).getAttribute('name'); //TODO: Need to support multiple search fields.

                    var p = { viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e };
                    ktl.persistentForm.onFieldValueChanged(p);
                    ktl.fields.onFieldValueChanged(p); //Notify app of change
                } catch (err) { }
            }
        })

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.onKeyPressed && (onKeyPressed = cfgObj.onKeyPressed);
                cfgObj.onFieldValueChanged && (onFieldValueChanged = cfgObj.onFieldValueChanged);
                cfgObj.textAsNumeric && (textAsNumeric = cfgObj.textAsNumeric);
                cfgObj.chznBetterSrchDelay && (chznBetterSrchDelay = cfgObj.chznBetterSrchDelay);
                cfgObj.chznBetterThresholds && (chznBetterThresholds = cfgObj.chznBetterThresholds);
                cfgObj.chznBetterToExclude && (chznBetterToExclude = cfgObj.chznBetterToExclude);
                cfgObj.chznBetterSetFocus && (chznBetterSetFocus = cfgObj.chznBetterSetFocus);
            },

            //Converts all applicable fields in the scene from text to numeric (telephone) type to allow numeric keypad on mobile devices.
            //Also, using tel type is a little trick that allows auto-selection of text in a number field upon focus.
            convertNumToTel: function () {
                return new Promise(function (resolve) {
                    if (convertNumDone || ktl.scenes.isiFrameWnd())
                        resolve();
                    else {
                        var forms = document.querySelectorAll('.kn-form');
                        forms.forEach(form => {
                            var viewId = form.id;
                            var fields = document.querySelectorAll('#' + viewId + ' .kn-input-short_text,.kn-input-number');
                            fields.forEach(field => {
                                var fieldId = field.attributes['data-input-id'].value;
                                if (field.classList.contains('kn-input-number') || textAsNumeric.includes(fieldId)) {
                                    if (!field.getAttribute('numeric')) {
                                        field.setAttribute('numeric', true);

                                        //We also need to change the input field itself to force numeric (tel) keyboard in mobile devices.
                                        $('#' + viewId + ' #' + fieldId).clone().attr('type', 'tel').insertAfter($('#' + viewId + ' #' + fieldId)).prev().remove();
                                    }
                                }
                            })
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
                var forms = document.querySelectorAll('.kn-form') || document.querySelectorAll('#cell-editor');
                forms.forEach((form) => {
                    var formValid = true;
                    var fields = document.querySelectorAll('#cell-editor #chznBetter[numeric=true]');
                    if (!fields.length)
                        fields = document.querySelectorAll('#cell-editor .kn-input[numeric=true]');
                    if (!fields.length)
                        fields = document.querySelectorAll('#' + form.id + ' .kn-input[numeric=true]');

                    fields.forEach((field) => {
                        var viewId = field.closest('.kn-view') || field.closest('#cell-editor');
                        if (viewId) {
                            viewId = viewId.id;
                            var inputFld = document.querySelector('#chznBetter[numeric=true]') || document.querySelector('#' + form.id + ' #' + field.getAttribute('data-input-id'));
                            if (inputFld) {
                                var value = inputFld.value;
                                var fieldValid = !isNaN(value);
                                formValid = formValid && fieldValid;
                                inputFld.setAttribute('valid', fieldValid);
                                $(inputFld).css('background-color', !fieldValid ? '#fdb0b0' : ''); //Same color as Knack errors.

                                var submit = document.querySelector('#' + viewId + ' .is-primary');
                                var validity = submit.validity ? submit.validity : true;

                                if (formValid)
                                    validity.invalidItemObj && (delete validity.invalidItemObj.numericValid);
                                else
                                    validity.invalidItemObj ? validity.invalidItemObj.numericValid = false : validity.invalidItemObj = { numericValid: false };

                                ktl.views.updateSubmitButtonState(viewId);
                            }
                        }
                    })
                })
            },

            addButton: function (div = null, label = '', style = '', classes = [], id = '') {
                if (!div) {
                    ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1014 - Called addButton with invalid parameters');
                    return null;
                }

                !label && (label = 'Button');

                //If id is not specified, create it from Label. Ex: 'Closed Lots' will give id = 'closed-lots-id'
                if (!id) {
                    id = ktl.core.getCleanId(label);
                    var viewId = $(div).closest('.kn-view').attr('id');
                    id = viewId + '_' + id;
                }

                var button = document.getElementById(id);
                if (button === null) {
                    button = document.createElement('BUTTON');
                    button.id = id;

                    button.appendChild(document.createTextNode(label));
                    div.append(button);
                }

                if (style !== '')
                    button.setAttribute('style', style);

                if (!style.includes(' color:'))
                    ktl.systemColors.getSystemColors().then(sc => { button.style.color = sc.text.rgb });

                if (classes.length > 0)
                    button.classList.add(...classes);

                return button;
            },

            addCheckbox: function (div = null, label = '', state = false, id = '', cbStyle = '', lbStyle = '') {
                if (div === null || label === '') {
                    ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1006 - Called addCheckbox with invalid parameters');
                    return null;
                }

                if (!id) {
                    id = ktl.core.getCleanId(label);
                }

                var cbLabel = document.getElementById(id + '-label-id');
                var checkBox = document.getElementById(id + '-id');

                if (checkBox === null) {
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

            //====================================================
            addRadioButton: function (div = null, label = '', name = ''/*group*/, id = '', value = '', rbStyle = '', lbStyle = '') {
                if (div === null || name === '' || id === '') {
                    ktl.log.addLog(ktl.const.LS_APP_ERROR, 'EC_1024 - Called addRadioButton with invalid parameters');
                    return null;
                }

                if (!id) {
                    id = ktl.core.getCleanId(label);
                }

                var rbLabel = document.getElementById(id + '-label-id');
                var rbBtn = document.getElementById(id + '-id');

                if (rbBtn === null) {
                    rbBtn = document.createElement('input');
                    rbBtn.type = 'radio';
                    rbBtn.name = name;
                    rbBtn.id = id + '-id';
                    rbLabel = document.createElement('label');
                    rbLabel.htmlFor = id + '-id';
                    rbLabel.setAttribute('id', id + '-label-id');
                    rbLabel.appendChild(document.createTextNode(label));
                }

                rbBtn.setAttribute('style', 'margin-left: 5px; width: 18px; height: 18px; margin-top: 3px; ' + rbStyle);
                rbLabel.setAttribute('style', 'vertical-align: text-bottom; margin-left: 5px; margin-right: 20px; margin-top: 3px; ' + lbStyle);
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

            //chznBetter functions
            // Ex. param:  dropdownId = 'view_XXX_field_YYY_chzn';
            addChznBetter: function (dropdownId) {
                var fieldId = document.querySelector('#' + dropdownId).closest('.kn-input').getAttribute('data-input-id');
                if (chznBetterToExclude.includes(fieldId))
                    return;

                //console.log('Entering addChznBetter');
                var srchField = null;
                if ($('#chznBetter').length === 0) {
                    chznBetterTxt = '';
                    var chznBetter = document.createElement('input');

                    //Numeric fields only, set to Tel type.
                    if (textAsNumeric.includes(fieldId)) {
                        chznBetter.setAttribute('type', 'tel');
                        chznBetter.setAttribute('numeric', 'true');
                        chznBetter.setAttribute('threshold', chznBetterThresholds[fieldId] ? chznBetterThresholds[fieldId] : '4'); //Minimum number of characters to be typed before search is triggered.
                    } else {
                        chznBetter.setAttribute('type', 'text');
                        chznBetter.setAttribute('threshold', chznBetterThresholds[fieldId] ? chznBetterThresholds[fieldId] : '3');
                    }

                    chznBetter.setAttribute('id', 'chznBetter');
                    chznBetter.classList.add('input');

                    var chzn = $('#' + dropdownId);

                    srchField = chzn.find('.chzn-search');
                    if (srchField.length === 0)
                        srchField = chzn.find('.search-field');

                    if (srchField && srchField.length > 0) {
                        srchField.append(chznBetter);
                    }
                }

                if (srchField && srchField.length > 0) {
                    if (chznBetter) {
                        chznBetter.value = chznBetterTxt;
                        chznBetter.style.position = 'absolute';

                        setTimeout(function () {
                            chznBetter.focus();
                        }, 200);

                        //Start monitoring selection changes.
                        //Purpose:
                        //  It's the only way we can detect a delete because it's impossible to get notifications from a click on an X.
                        //  When the number of items change for whatever reason (add or delete), we want the focus back on the input field.
                        var numSel = 0;
                        var prevNumSel = 0;
                        chznChoicesIntervalId = setInterval(function () {
                            var chznChoices = chzn.find('.chzn-choices li');
                            if (chznChoices && chznChoices.length > 1) { //Omit first one (actually last in list), since always search-field.
                                numSel = chznChoices.length - 1;

                                if (prevNumSel !== numSel) {
                                    //console.log('Updating num selected =', numSel);
                                    prevNumSel = numSel;
                                    chznBetter.focus();
                                }
                            }
                        }, 1000);
                    }
                }
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
                    if (document.querySelector('#chznBetter').getAttribute('valid') === 'false')
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

            //TODO, detect inline edit cell and modify its style dyanmically.  Typical use: make them wider to see more context when typing.
            inlineEditChangeStyle: function () {
                setTimeout(function () {
                    $('.kn-form-col.column.is-constrained').css({ 'max-width': '100vw', 'width': '75vw' }); //Example here that enlarges width.
                    //var sel = document.querySelector('.kn-form-col.column.is-constrained');
                    //console.log('sel =', sel);
                }, 500);
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
                {
                    var descr = '';
                    try { descr = Knack.fields[fieldId].attributes.meta.description; }
                    catch (e) { }
                    return descr;
                }
            },
        }
    })(); //fields

    //====================================================
    //Persistent Form
    //Will automatically save and load form data to prevent losses after a refresh, power outage, network loss or other.
    this.persistentForm = (function () {
        const PERSISTENT_FORM_DATA = 'persistentForm';

        //Add fields and scenes to exclude from persistence in these arrays.
        var scenesToExclude = [];
        var fieldsToExclude = [];

        var currentViews = {}; //Needed to cleanup form data from previous views, when scene changes.
        var previousScene = '';
        var formDataObj = {};
        var keyTimeout = null;
        var pfInitDone = false;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (ktl.scenes.isiFrameWnd()) return;

            //Always erase potential residual data - for good luck.
            if (previousScene != scene.key) {
                previousScene = scene.key;

                for (var viewId in currentViews)
                    eraseFormData(viewId);

                currentViews = {};
            }

            if (!ktl.core.getCfg().enabled.persistentForm || scenesToExclude.includes(scene.key))
                return;

            ktl.fields.convertNumToTel().then(() => {
                loadFormData()
                    .then(() => {
                        pfInitDone = true;
                        setTimeout(function () { ktl.fields.enforceNumeric(); }, 1000);
                    })
            });
        })

        document.addEventListener('input', function (e) {
            if (!pfInitDone || !ktl.core.getCfg().enabled.persistentForm ||
                scenesToExclude.includes(Knack.router.current_scene_key) || ktl.scenes.isiFrameWnd()) return;

            inputHasChanged(e);
        })

        document.addEventListener('focusout', function (e) {
            if (!pfInitDone || !document.hasFocus() || !ktl.core.getCfg().enabled.persistentForm ||
                scenesToExclude.includes(Knack.router.current_scene_key) || ktl.scenes.isiFrameWnd() ||
                e.target.type === 'radio') return;

            inputHasChanged(e);
        }, true);

        $(document).on('knack-form-submit.any', function (event, view, record) {
            if (ktl.scenes.isiFrameWnd()) return;
            eraseFormData(view.key);
        });

        $(document).on('click', function (e) {
            if (!ktl.core.getCfg().enabled.persistentForm || scenesToExclude.includes(Knack.router.current_scene_key) || ktl.scenes.isiFrameWnd() || Knack.getUserAttributes() === 'No user found')
                return;

            //TODO:  Investigate iOS bug eith userFilters.
            if (e.target.className.includes && e.target.className.includes('kn-button is-primary') && e.target.classList.length > 0 && e.target.type === 'submit') {
                var view = e.target.closest('.kn-form.kn-view');
                if (view) {
                    ktl.views.waitSubmitOutcome(view.id)
                        .then(() => {
                            eraseFormData(view.id);
                        })
                        .catch(failure => {
                            ktl.log.clog('red', 'Persistent Form - waitSubmitOutcome failed: ' + failure);
                        });
                }
            }
        })

        //Save data for a given view and field.
        function saveFormData(text = '', viewId = '', fieldId = '', subField = '') {
            //console.log('saveFormData', text, viewId, fieldId, subField);
            if (!pfInitDone || !fieldId || !viewId || !viewId.startsWith('view_')) return; //Exclude connection-form-view and any other not-applicable view types.

            var action = Knack.router.scene_view.model.views._byId[viewId].attributes.action;
            if (fieldsToExclude.includes(fieldId) || (action !== 'insert' && action !== 'create')/*Add only, not Edit or any other type*/)
                return;

            var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
            if (formDataObjStr)
                var formDataObj = JSON.parse(formDataObjStr);

            if (fieldId === 'chznBetter')
                fieldId = $('#' + fieldId).closest('.kn-input').attr('data-input-id');

            formDataObj[viewId] = formDataObj[viewId] ? formDataObj[viewId] : {};

            if (!subField) {
                var fieldObj = Knack.objects.getField(fieldId);
                if (fieldObj) {
                    if (text === 'Select' && (fieldObj.attributes.type === 'connection' || fieldObj.attributes.type === 'user_roles'))
                        text = ''; //Do not save the placeholder 'Select';
                }

                if (!text)
                    delete formDataObj[viewId][fieldId];
                else
                    formDataObj[viewId][fieldId] = text;
            } else { //Some field types like Name and Address have sub-fields.
                formDataObj[viewId][fieldId] = formDataObj[viewId][fieldId] ? formDataObj[viewId][fieldId] : {};
                formDataObj[viewId][fieldId][subField] = text;
            }

            formDataObjStr = JSON.stringify(formDataObj);
            ktl.storage.lsSetItem(PERSISTENT_FORM_DATA, formDataObjStr);

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

                //To see all data types:  console.log(Knack.config);
                const textDataTypes = ['address', 'date_time', 'email', 'link', 'name', 'number', 'paragraph_text', 'phone', 'rich_text', 'short_text'];

                formDataObj = {};
                currentViews = {};
                var intervalId = null;

                //Reload stored data, but only for Form type of views.
                var views = Knack.router.scene_view.model.views.models;
                for (var v = 0; v < views.length; v++) {
                    var view = views[v].attributes;
                    if (view.action === 'insert' || view.action === 'create') { //Add only, not Edit or any other type
                        var viewData = JSON.parse(formDataObjStr)[view.key];
                        if (!viewData) continue;

                        currentViews[view.key] = view.key;
                        formDataObj[view.key] = viewData;

                        var fieldsArray = Object.keys(formDataObj[view.key]);
                        for (var f = 0; f < fieldsArray.length; f++) {
                            var fieldId = fieldsArray[f];
                            if (fieldsToExclude.includes(fieldId)) {
                                ktl.log.clog('purple', 'Skipped field for PF: ' + fieldId);
                                continue; //JIC - should never happen since fieldsToExclude are never saved in the first place.
                            }

                            var fieldText = formDataObj[view.key][fieldId];

                            //If we have an object instead of plain text, we need to recurse into it for each sub-field.
                            var field = Knack.objects.getField(fieldId);
                            if (field) { //TODO: Move this IF with continue at top.
                                var subField = '';
                                var fieldType = field.attributes.type;
                                if (textDataTypes.includes(fieldType)) {
                                    if (typeof fieldText === 'object') { //Ex: name and address field types.
                                        var allSubFields = Object.keys(formDataObj[view.key][fieldId])
                                        allSubFields.forEach(function (eachSubField) {
                                            fieldText = formDataObj[view.key][fieldId][eachSubField];
                                            setFieldText(eachSubField);
                                            delete formDataObj[view.key][fieldId][eachSubField];
                                        })
                                    } else {
                                        setFieldText();
                                        delete formDataObj[view.key][fieldId];
                                    }

                                    function setFieldText(subField) {
                                        var el = document.querySelector('#' + view.key + ' [data-input-id=' + fieldId + '] #' + subField + '.input') || //Must be first.
                                            document.querySelector('#' + view.key + ' [data-input-id=' + fieldId + '] input') ||
                                            document.querySelector('#' + view.key + ' [data-input-id=' + fieldId + '] .kn-textarea');

                                        if (el) {
                                            //The condition !el.value means 'Write value only if currently empty' 
                                            //and prevents overwriting fields just populated by code elsewhere.
                                            !el.value && (el.value = fieldText);
                                        }
                                    }
                                } else if (fieldType === 'connection') {
                                    if (typeof fieldText === 'object') {
                                        subField = Object.keys(formDataObj[view.key][fieldId]);
                                        fieldText = formDataObj[view.key][fieldId][subField];
                                    }

                                    var textToFind = fieldText.split('-');
                                    var recId = textToFind.length === 2 ? textToFind[1] : '';
                                    textToFind = textToFind[0];

                                    //Start with a first 'rough' pass to populate option records...
                                    ktl.views.searchDropdown(textToFind, fieldId, false, false, '', false)
                                        .then(function () { findRecId(recId); })
                                        .catch(function () { findRecId(recId); })

                                    //... then a second pass to find exact match with recId.
                                    function findRecId(recId) {
                                        recId && $('#' + view.key + '-' + fieldId).val(recId).trigger('liszt:updated').chosen().trigger('change');

                                        var chznContainer = $('#' + view.key + ' [data-input-id="' + fieldId + '"] .chzn-container');
                                        $(chznContainer).find('.chzn-drop').css('left', '-9000px');
                                    }

                                } else if (fieldType === 'multiple_choice') {
                                    console.log('field.attributes.format.type =', field.attributes.format.type);

                                    if (typeof fieldText === 'object') {
                                        subField = Object.keys(formDataObj[view.key][fieldId]);
                                        fieldText = formDataObj[view.key][fieldId][subField];
                                    } else if (field.attributes.format.type === 'radios') {
                                        document.querySelector('#kn-input-' + fieldId + ' [value="' + fieldText + '"]').checked = true
                                        resolve();
                                        return;
                                    } else if (field.attributes.format.type === 'checkbox') {
                                        //TODO
                                        resolve();
                                        return;
                                    }

                                    fieldText && ktl.views.searchDropdown(fieldText, fieldId, true, false, '', false)
                                        .then(function () { })
                                        .catch(function () { })
                                } else if (fieldType === 'boolean') {
                                    document.querySelector('#' + view.key + ' [data-input-id="' + fieldId + '"] input').checked = fieldText;
                                } else {
                                    ktl.log.clog('purple', 'Unsupported field type: ' + fieldId + ', ' + fieldType);
                                }

                                delete formDataObj[view.key][fieldId];
                            }
                        }

                        delete formDataObj[view.key];
                    }
                }

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

        //When input field text has changed or has lost focus, save it.
        //Note that this function applies to text input fields only.  Other field types are saved through onFieldValueChanged.
        function inputHasChanged(e = null) {
            if (!e || !e.target.type || e.target.id === 'chznBetter'
                || e.target.className.includes('knack-date') || e.target.className.includes('ui-autocomplete-input'))
                return;

            //Useful logs to implement future object types.
            //console.log('e =', e);
            //console.log('e.type =', e.type);
            //console.log('e.target.type =', e.target.type);
            //console.log('e.target.value =', e.target.value);
            //console.log('e.target.id =', e.target.id);
            //console.log('e.target.name =', e.target.name);
            //console.log('e.target.className =', e.target.className);
            //console.log('e.relatedTarget =', e.relatedTarget);

            clearTimeout(keyTimeout);


            if ((e.type === 'focusout' && e.relatedTarget) || (e.type === 'input' && e.target.type === 'select-one'))
                saveText();
            else {
                keyTimeout = setTimeout(function () {
                    saveText();
                }, 1000);
            }

            function saveText() {
                var subField = '';
                var knInput = e.target.closest('.kn-input');
                if (knInput) {
                    var fieldId = knInput.getAttribute('data-input-id');
                    var text = e.target.value;

                    var field = Knack.objects.getField(fieldId);
                    console.log('inputHasChanged - field.attributes =', field.attributes);
                    if (field.attributes.format.type === 'radios') {
                        console.log('inputHasChanged - radios');
                        text = e.target.checked;
                    } else if (field.attributes.format.type === 'checkboxes') {
                        console.log('inputHasChanged - checkbox');
                        text = e.target.checked;
                    }

                    if (fieldId !== e.target.id) {
                        subField = e.target.id;
                    }

                    var viewId = e.target.closest('.kn-form.kn-view');
                    if (viewId) {
                        viewId = viewId.id;
                        if (viewId && fieldId)
                            saveFormData(text, viewId, fieldId, subField);
                    }
                }
            }
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
            onFieldValueChanged: function ({ viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e }) {
                if (!fieldsToExclude.includes(fieldId)) {
                    recId && (text += '-' + recId);
                    saveFormData(text, viewId, fieldId);
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
                $('.kn-table').css({ 'color': sysColors.text.rgb });
                $('.table-row-highlighted').css({ 'color': sysColors.text.rgb + '!important' });
            }
        })


        return {
            setCfg: function (cfgObj = {}) {
                //TODO: Support custom colors or variations.
            },

            //For KTL internal use.
            initSystemColors: function () {
                ktl.core.waitSelector('#kn-dynamic-styles')
                    .then(function () {
                        var dynStylesCssTxt = document.querySelector('#kn-dynamic-styles').innerText;

                        //Basic colors
                        sysColors.header = extractSysElClr(/\#kn-app-header {\s+background-color: #/gm); //Header background color
                        sysColors.button = extractSysElClr(/\.is-primary {\s+background-color: #/gm); //Buttons background color
                        sysColors.buttonText = extractSysElClr(/\.kn-navigation-bar a {\s+color: #/gm); //Buttons text color
                        sysColors.text = extractSysElClr(/\.kn-content a {\s+color: #/gm); //Text color

                        //Additional colors, usually derived from basic colors, or hard-coded.
                        var newS, newV = 1.0;
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

                        //Just a generic pale washed-out color for various items.  Ex: background color of debug window.
                        newS = 0.1;
                        newV = 1.0;
                        newRGB = ktl.systemColors.hsvToRgb(sysColors.header.hsv[0], newS, newV);
                        sysColors.paleLowSatClr = 'rgb(' + newRGB[0] + ',' + newRGB[1] + ',' + newRGB[2] + ')';

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

    const LS_UF = 'UF_';
    const LS_UFP = 'UFP_';
    const LS_UF_ACT = 'UF_ACTIVE_';


    this.userFilters = (function () {
        const SAVE_FILTER_BTN = 'Save';
        const STOP_FILTER_BTN = 'Stop';
        const LOCK_FILTERS_BTN = 'Lock';
        const FILTER_BTN_SUFFIX = 'filterBtn';
        const SAVE_FILTER_BTN_SEL = SAVE_FILTER_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-SaveFilter-filterBtn
        const STOP_FILTER_BTN_SEL = STOP_FILTER_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-StopFilter-filterBtn
        const LOCK_FILTERS_BTN_SEL = LOCK_FILTERS_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-LockFilter-filterBtn

        var userFiltersObj = {}; //The main user filters object that drives the whole feature.
        var publicFiltersObj = {}; //The main public filters object that drives the whole feature.
        var activeFilterNameObj = {}; //To keep the name of the curently active filter for each view.

        var allowUserFilters = null; //Callback to your app to allow user filters based on specific conditions.
        var viewToRefreshAfterFilterChg = null;  //This is necessary to remember the viewId to refresh after we exit filter editing.
        var publicFiltersLocked = true; //To prevent accidental modifications of public filters.

        var filterBtnStyle = 'font-weight: bold; margin-left: 2px; margin-right: 2px'; //Default base style. Add your own at end of this string.

        Object.defineProperty(userFiltersObj, "isEmpty", {
            get: function () { $.isEmptyObject(this); }
        });

        Object.defineProperty(publicFiltersObj, "isEmpty", {
            get: function () { $.isEmptyObject(this); }
        });

        loadAllFilters();

        //Early detection of scene change to prevent multi-rendering of views and flickering.
        var scn = '';
        setInterval(function () {
            if (!window.self.frameElement || (window.self.frameElement && window.self.frameElement.id !== IFRAME_WND_ID)) {
                if (Knack.router.current_scene_key !== scn) {
                    scn = Knack.router.current_scene_key;
                    assembleFilterURL();
                }
            }
        }, 500);

        function assembleFilterURL() {
            var views = Knack.router.scene_view.model.views.models;
            if (!views.length || ($.isEmptyObject(userFiltersObj) && $.isEmptyObject(publicFiltersObj))) return;

            var parts = ktl.core.splitUrl(window.location.href);
            var newUrl = parts['path'] + '?';
            var allParams = '';

            for (var i = 0; i < views.length; i++) {
                var filterDivId = views[i].attributes.key;
                var filterType = views[i].attributes.type;

                //Reports are risky, since they don't have an absolute ID.  Instead, they have an index and if they are moved around
                //in the builder, the filters won't know about it and will stop working.
                //TODO:  Check if the source object is the good one at least, and if not, delete the filter.  A missing filter is better than a bad one.
                if (filterType === 'report') {
                    var rows = views[i].attributes.rows;
                    var reportIdx = 0;
                    rows.forEach((obj) => {
                        var ar = obj.reports;
                        if (ar.length) {
                            ar.forEach(() => {
                                filterDivId = 'kn-report-' + views[i].attributes.key + '-' + (reportIdx + 1).toString();
                                tableOrReportAssy(filterDivId);
                                reportIdx++;
                            })
                        }
                    })
                } else
                    tableOrReportAssy(filterDivId);
            }

            if (allParams)
                window.location.href = newUrl + allParams;

            function tableOrReportAssy(filterDivId) {
                var filterUrlPart = filterDivIdToUrl(filterDivId);
                var flt = getFilter(filterDivId);
                var actFltIdx = flt.index;
                if (actFltIdx >= 0) {
                    var filter = flt.filterSrc[filterDivId].filters[actFltIdx];
                    if (filter) {
                        var encodedNewFilter = encodeURIComponent(filter.filterString).replace(/'/g, "%27").replace(/"/g, "%22");

                        if (allParams)
                            allParams += '&';

                        allParams += filterUrlPart + '_filters=' + encodedNewFilter;

                        if (filter.perPage)
                            allParams += '&' + filterUrlPart + '_per_page=' + filter.perPage;

                        if (filter.sort)
                            allParams += '&' + filterUrlPart + '_sort=' + filter.sort;

                        if (filter.search)
                            allParams += '&' + filterUrlPart + '_search=' + filter.search;
                    }
                }
            }
        }

        $(document).on('knack-scene-render.any', function (event, scene) {
            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            //Remove empty columns because it ruins the layout. Happens too often but not sure why (KTL or Knack?).
            var cols = document.querySelectorAll('.view-column');
            cols.forEach(col => {
                if (!col.childElementCount)
                    col.remove();
            })
        })

        $(document).on('knack-records-render.report knack-records-render.table', function (e, view, data) {
            if ((ktl.scenes.isiFrameWnd()) || !ktl.core.getCfg().enabled.userFilters) return;

            if (!window.self.frameElement && allowUserFilters() && $('#' + view.key + ' .kn-add-filter').length > 0)
                ktl.userFilters.addFilterButtons(view.key);

            if (view.type == 'table') {
                var perPageDropdown = document.querySelector('#' + view.key + ' .kn-pagination .kn-select');
                if (perPageDropdown) {
                    perPageDropdown.addEventListener('change', function (e) {
                        ktl.userFilters.onSaveFilterBtnClicked(null, view.key, true);
                    });
                }

                //When the Search button is clicked in table.
                var searchBtn = document.querySelector('#' + view.key + ' .kn-button.search');
                if (searchBtn) {
                    searchBtn.addEventListener('click', function () {
                        ktl.userFilters.onSaveFilterBtnClicked(null, view.key, true);
                        updateSearchInFilter(view.key);
                    });
                }

                //When Enter is pressed in Search table field.
                var searchField = document.querySelector('#' + view.key + ' .table-keyword-search');
                if (searchField) {
                    searchField.addEventListener('submit', function () {
                        ktl.userFilters.onSaveFilterBtnClicked(null, view.key, true);
                        updateSearchInFilter(view.key);
                    })
                }

                //When the Reset button is clicked in table's search.
                var resetSearch = document.querySelector('#' + view.key + ' .reset.kn-button.is-link');
                if (resetSearch) {
                    resetSearch.addEventListener('click', function () {
                        document.querySelector('#' + view.key + ' .table-keyword-search input').value = ''; //Force to empty otherwise we sometimes get current search string.
                        updateSearchInFilter(view.key);
                    })
                }
            }
        })

        //Retrieves the searched string form the field and saves it in the localStorage's filter entry.
        function updateSearchInFilter(viewId = '') {
            var actFlt = getFilter(viewId);
            var filterSrc = actFlt.filterSrc;
            if (!viewId || $.isEmptyObject(filterSrc) || $.isEmptyObject(filterSrc[viewId])) return;

            var filterIndex = actFlt.index;
            if (filterIndex >= 0) {
                var isPublic = actFlt.filterObj.public;
                var filterType = actFlt.type;
                if (!isPublic ||
                    (isPublic && document.querySelector('#' + viewId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-unlock-alt'))) {
                    var searchString = document.querySelector('#' + viewId + ' .table-keyword-search input').value;
                    filterSrc[viewId].filters[filterIndex].search = searchString;
                    saveFilters(filterType, viewId);
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

        //Load all filters from local storage.
        function loadAllFilters() {
            loadFilters(LS_UF);
            loadFilters(LS_UFP);
            loadActiveFilters();
        }

        //Loads user filters from the localStorage and returns a temporary object.
        //updateObj: true will modify the actual placeholder of the object.  Used to merge filters from multiple opened browsers.
        function loadFilters(type = '', updateObj = true) {
            if (type !== LS_UF && type !== LS_UFP) return;
            var fltObjTemp = {};
            var lsStr = ktl.storage.lsGetItem(type + Knack.getUserAttributes().id);
            if (lsStr) {
                try {
                    fltObjTemp = JSON.parse(lsStr);
                    if (updateObj && !$.isEmptyObject(fltObjTemp)) {
                        if (type === LS_UF) {
                            userFiltersObj = fltObjTemp;
                            checkForPublicInUser();
                        } else
                            publicFiltersObj = fltObjTemp;
                    }
                } catch (e) {
                    alert('loadFilters - Error Found Parsing Filters:', e);
                }
            }

            return fltObjTemp;
        }

        //Jan 01, 2023:  Temporary function just to be sure all works fine with new code.  Delete this eventually.
        function checkForPublicInUser() {
            try {
                const views = Object.keys(userFiltersObj);
                var viewError = '';
                views.forEach(function (viewId) {
                    if (viewId.startsWith('view_')) {
                        for (i = 0; i < userFiltersObj[viewId].filters.length; i++) {
                            if (userFiltersObj[viewId].filters[i].public) {
                                viewError = viewId;
                                break;
                            }
                        }
                    }
                })

                if (viewError)
                    console.log('KTL Error - Found a Public Filter in User Filter object, viewId =', viewError);
            } catch (e) {
                console.log('error', e);
            }
        }

        function loadActiveFilters() {
            var lsStr = ktl.storage.lsGetItem(LS_UF_ACT + Knack.getUserAttributes().id);
            if (lsStr) {
                try {
                    var fltObjTemp = JSON.parse(lsStr);
                    activeFilterNameObj = fltObjTemp;
                } catch (e) {
                    alert('loadActiveFilters - Error Found Parsing object:', e);
                }
            }
        }

        //Save all filters to local storage.
        //But before, read back from localStorage and merge with any external updates from another browser.
        function saveFilters(type = '', viewId = '') {
            if (type !== LS_UF && type !== LS_UFP) return;

            if (viewId) {
                var fltObjFromLs = loadFilters(type, false);

                var currentFltObj = {};
                if (type === LS_UF)
                    currentFltObj = userFiltersObj;
                else
                    currentFltObj = publicFiltersObj;

                if (fltObjFromLs[viewId]) { //Existing view
                    if (currentFltObj[viewId]) { //Modified filter
                        if ($.isEmptyObject(currentFltObj[viewId]))
                            delete fltObjFromLs[viewId];
                        else
                            fltObjFromLs[viewId] = currentFltObj[viewId];
                    } else //Deleted view.
                        delete fltObjFromLs[viewId];
                } else { //Non-existing view
                    if (currentFltObj[viewId]) { //Added view and filter.
                        fltObjFromLs[viewId] = currentFltObj[viewId];
                    }
                }

                delete fltObjFromLs.dt;
                if ($.isEmptyObject(fltObjFromLs)) {
                    ktl.storage.lsRemoveItem(type + Knack.getUserAttributes().id);
                    return;
                } else {
                    fltObjFromLs.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                    if (type === LS_UF)
                        userFiltersObj = fltObjFromLs;
                    else
                        publicFiltersObj = fltObjFromLs;
                }
            }

            try {
                ktl.storage.lsSetItem(type + Knack.getUserAttributes().id, JSON.stringify(type === LS_UF ? userFiltersObj : publicFiltersObj));
            } catch (e) {
                console.log('Error while saving filters:', e);
            }

            if (getViewToRefresh() && viewId) {
                viewId = viewId.split('-')[2] || viewId.split('-')[0];
                viewId && ktl.views.refreshView(viewId);
            }
        }

        function createFilterButtons(filterDivId = '', fltBtnsDivId = '') {
            if (!filterDivId) return;

            //Public Filters first
            createFltBtns(filterDivId, LS_UFP);

            //User Filters second
            createFltBtns(filterDivId, LS_UF);

            function createFltBtns(filterDivId, type) {
                var fltSrc = (type === LS_UF) ? userFiltersObj : publicFiltersObj;

                if (!$.isEmptyObject(fltSrc) && !$.isEmptyObject(fltSrc[filterDivId])) {
                    var errorFound = false;
                    var activeFilterIndex = getFilter(filterDivId, '', type).index;

                    //JIC - delete junk.
                    if (!fltSrc[filterDivId].filters.length) {
                        delete fltSrc[filterDivId];
                        saveFilters(type, filterDivId);
                        return;
                    }


                    for (var btnIndex = 0; btnIndex < fltSrc[filterDivId].filters.length; btnIndex++) {
                        var filter = fltSrc[filterDivId].filters[btnIndex];

                        //JIC - delete junk.
                        if (!filter || filter.filterName === '') {
                            fltSrc[filterDivId].filters.splice(btnIndex, 1);
                            if (!fltSrc[filterDivId].filters.length)
                                delete fltSrc[filterDivId];
                            saveFilters(type, filterDivId);
                            errorFound = true;
                            console.log('errorFound =', errorFound, JSON.stringify(filter));
                            break;
                        }

                        var btnId = ktl.core.getCleanId(filter.filterName);
                        var filterBtn = ktl.fields.addButton(fltBtnsDivId, filter.filterName, filterBtnStyle,
                            ['kn-button', 'is-small'],
                            filterDivId + '_' + FILTER_BTN_SUFFIX + '_' + btnId);

                        filterBtn.classList.add('filterBtn');
                        if (filter.public)
                            filterBtn.classList.add('public');
                        else
                            filterBtn.classList.remove('public');

                        if (btnIndex === activeFilterIndex)
                            filterBtn.classList.add('activeFilter');
                        else
                            filterBtn.classList.remove('activeFilter');

                        filterBtn.filter = filter;

                        //================================================================
                        //Handle click event to apply filter and right-click to provide additional options in a popup.
                        filterBtn.addEventListener('click', e => { onFilterBtnClicked(e, filterDivId); });
                        filterBtn.addEventListener('contextmenu', e => { contextMenuFilter(e, filterDivId, e.target.filter); })
                    }

                    if (errorFound) createFilterButtons(filterDivId, fltBtnsDivId);

                    applyButtonColors();
                    setupFiltersDragAndDrop(filterDivId);
                }
            }
        }

        function onFilterBtnClicked(e, filterDivId = '') {
            e.preventDefault();
            var target = e.target || e.currentTarget;
            if (!filterDivId || !target.filter) return;

            $('#' + filterDivId + ' .activeFilter').removeClass('activeFilter');
            target.classList.add('activeFilter');
            applyButtonColors();

            var filterUrlPart = filterDivIdToUrl(filterDivId);

            //Get current URL, check if a filter exists, if so, replace it.  If not, append it.
            var parts = ktl.core.splitUrl(window.location.href);
            var newUrl = parts['path'] + '?';
            var otherParams = ''; //Usually, this contains params for other views then this one.

            //Get any additional params from URL.
            const params = Object.entries(parts['params']);
            if (!$.isEmptyObject(params)) {
                params.forEach(function (param) {
                    if (param[0].includes(filterUrlPart + '_filters') ||
                        param[0].includes(filterUrlPart + '_per_page') ||
                        param[0].includes(filterUrlPart + '_sort') ||
                        param[0].includes(filterUrlPart + '_search') ||
                        param[0].includes(filterUrlPart + '_page')) {
                        //Ignore all these.
                    } else {
                        if (otherParams)
                            otherParams += '&';
                        otherParams += param[0] + '=' + encodeURIComponent(param[1]).replace(/'/g, "%27").replace(/"/g, "%22");
                    }
                })
            }

            //var encodedNewFilter = encodeURIComponent(target.filter.filterString).replace(/'/g, "%27").replace(/"/g, "%22");
            var encodedNewFilter = target.filter.filterString;
            var allParams = filterUrlPart + '_filters=' + encodedNewFilter;

            if (target.filter.perPage)
                allParams += '&' + filterUrlPart + '_per_page=' + target.filter.perPage;

            if (target.filter.sort)
                allParams += '&' + filterUrlPart + '_sort=' + target.filter.sort;

            if (target.filter.search)
                allParams += '&' + filterUrlPart + '_search=' + target.filter.search;

            if (otherParams)
                allParams += '&' + otherParams;

            newUrl += allParams;

            ktl.userFilters.setActiveFilter(target.filter.filterName, filterDivId);

            var isReport = false;
            if (filterUrlPart !== filterDivId)
                isReport = true;

            if (!isReport) {
                Knack.showSpinner();
                updateSearchTable(filterDivId, target.filter.search);
                updateFilters(filterUrlPart, JSON.parse(encodedNewFilter))
                updatePerPage(filterDivId, target.filter.perPage);
                updateSort(filterDivId, target.filter.sort);
                Knack.models[filterDivId].fetch({
                    success: () => { Knack.hideSpinner(); }
                });
            } else {
                //Until a solution is found to the "var u = new t.Model;" issue, we have
                //to refresh the whole page when applying a filter to a report chart.
                //See: https://forums.knack.com/t/knack-under-the-hood-understanding-handlechangefilters/13611/6
                if (window.location.href !== newUrl)
                    window.location.href = newUrl;
            }
        };

        function updateSearchTable(viewId, srchTxt) {
            if (!viewId || !srchTxt) return;
            Knack.views[viewId].model.searching = true;
            var i = Knack.getSceneHash();
            var r = {}
            var a = [];
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
            var i = {};
            i[viewId + '_per_page'] = perPage;
            i[viewId + '_page'] = 1;
            Knack.router.navigate(Knack.getSceneHash() + "?" + Knack.getQueryString(i), false);
            Knack.setHashVars();
        }

        function updateSort(viewId, sort) {
            if (!viewId || !sort) return;
            var field = sort.split('|')[0];
            var order = sort.split('|')[1];
            var sortAr = [field, order]


            Knack.views[viewId].model.view.source.sort = [{
                field: sortAr[0],
                order: sortAr[1]
            }];

            var i = {};
            i[viewId + "_sort"] = sortAr[0] + "|" + sortAr[1]; //{ "view_1264_sort": "field_182-field_182|asc" }           
            var r = Knack.getSceneHash() + "?" + Knack.getQueryString(i);
            Knack.router.navigate(r);
            Knack.setHashVars();
            Knack.views[viewId].model.setDataAPI();
        }

        function onStopFilterBtnClicked(e, filterDivId) {
            var closeFilters = document.querySelectorAll('#' + filterDivId + ' .kn-remove-filter');
            closeFilters.forEach(closeBtn => { closeBtn.click(); });
            ktl.userFilters.removeActiveFilter(filterDivId);
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
                    $('.activeFilter').css({ 'background-color': sysColors.activeFilterBtnClr/*, 'border-color': sysColors.borderClr */});
                    $('.filterBtn.public').css({ 'background-color': sysColors.publicFilterBtnClr, 'border-color': '' });
                    $('.activeFilter.public').css({ 'background-color': sysColors.activePublicFilterBtnClr/*, 'border-color': sysColors.borderClr*/ });
                })
        }

        function contextMenuFilter(e, viewId, filter) {
            e.preventDefault();

            loadFilters(LS_UF);
            loadFilters(LS_UFP);

            var filterName = filter.filterName;
            var thisFilter = getFilter(viewId, filterName);
            var filterIndex = thisFilter.index;
            var isPublic = thisFilter.filterObj.public;
            var filterSrc = thisFilter.filterSrc;
            var filterType = thisFilter.type;
            var activeFilterName = getFilter(viewId).filterObj;
            activeFilterName = activeFilterName ? activeFilterName.filterName : '';

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
            $('.menuDiv').css({ 'margin-top': '-100px' });

            var ul = document.createElement('ul');
            menuDiv.appendChild(ul);
            ul.style.textAlign = 'left';
            ul.style.fontSize = 'larger';
            ul.style.listStyle = 'none';


            //Delete Filter
            var listDelete;
            if (!isPublic) {
                listDelete = document.createElement('li');
                listDelete.innerHTML = '<i class="fa fa-trash-o" style="margin-top: 2px;"></i> Delete';
                listDelete.style.marginBottom = '8px';
                listDelete.addEventListener('click', function (e) {
                    e.preventDefault();
                    $('.menuDiv').remove();

                    if (confirm('Are you sure you want to delete filter "' + filterName + '" ?')) {
                        filterSrc[viewId].filters.splice(filterIndex, 1);
                        if (!filterSrc[viewId].filters.length)
                            delete filterSrc[viewId];

                        saveFilters(filterType, viewId);
                        ktl.userFilters.addFilterButtons(viewId);

                        if (activeFilterName === filterName)
                            ktl.userFilters.removeActiveFilter(viewId);
                        else
                            ktl.userFilters.setActiveFilter(activeFilterName, viewId);
                    }
                });
            }

            //Rename Filter
            var listRename = document.createElement('li');
            listRename.innerHTML = '<i class="fa fa-pencil-square-o" style="margin-top: 2px;"></i> Rename';
            listRename.style.marginBottom = '8px';

            listRename.addEventListener('click', function (e) {
                e.preventDefault();
                $('.menuDiv').remove();

                var newFilterName = prompt('New Filter Name: ', filterName);
                if (newFilterName && newFilterName !== filterName) {
                    var foundFilter = getFilter(viewId, newFilterName);
                    if (foundFilter.index >= 0) {
                        alert('Filter name already exists.  Please use another one.');
                        return;
                    } else {
                        if (activeFilterName === filterName)
                            activeFilterName = newFilterName;

                        var updatedFilter = getFilter(viewId, filterName).filterObj;
                        updatedFilter.filterName = newFilterName;
                        saveFilters(filterType, viewId);
                        ktl.userFilters.addFilterButtons(viewId);
                        ktl.userFilters.setActiveFilter(activeFilterName, viewId);
                    }
                }
            });

            //Public Filters, visible to all users.
            var listPublicFilters;
            if (Knack.getUserRoleNames().includes('Public Filters')) {
                listPublicFilters = document.createElement('li');
                listPublicFilters.innerHTML = '<i class="fa fa-gift" style="margin-top: 2px;"></i> Public: ';
                listPublicFilters.style.marginBottom = '8px';

                if (filter.public)
                    listPublicFilters.innerHTML += 'Yes';
                else
                    listPublicFilters.innerHTML += 'No';

                listPublicFilters.addEventListener('click', function (e) {
                    e.preventDefault();
                    $('.menuDiv').remove();

                    if (filterIndex >= 0) {
                        //Toggle on/off
                        if (filter.public) {
                            delete filterSrc[viewId].filters[filterIndex].public;
                            if (userFiltersObj[viewId]) {
                                userFiltersObj[viewId].filters.push(filterSrc[viewId].filters[filterIndex]);
                            } else {
                                var newFlt = filterSrc[viewId].filters[filterIndex];
                                var ar = [];
                                ar.push(newFlt);
                                userFiltersObj[viewId] = { filters: ar };
                            }
                        } else {
                            var curFlt = filterSrc[viewId].filters[filterIndex];
                            curFlt.public = true;
                            if (publicFiltersObj[viewId]) {
                                publicFiltersObj[viewId].filters.push(curFlt);
                            } else {
                                var ar = [];
                                ar.push(curFlt);
                                publicFiltersObj[viewId] = { filters: ar };
                            }
                        }

                        filterSrc[viewId].filters.splice(filterIndex, 1);
                        saveFilters(LS_UF, viewId);
                        saveFilters(LS_UFP, viewId);
                        ktl.userFilters.addFilterButtons(viewId);
                        ktl.userFilters.setActiveFilter(activeFilterName, viewId);
                    } else
                        ktl.log.clog('purple', 'Public Filter toggle, bad index found:', filterIndex);
                });
            }
    
            listPublicFilters && ul.appendChild(listPublicFilters);
            listDelete && ul.appendChild(listDelete);
            ul.appendChild(listRename);
        }

        function setViewToRefresh(viewId) {
            viewToRefreshAfterFilterChg = viewId;
        }

        function getViewToRefresh() {
            return viewToRefreshAfterFilterChg;
        }

        //Returns the filter found: container object, filter object, name, index, type.
        //If filterName is blank, it will find the active filter.
        function getFilter(viewId = '', filterName = '', type) {
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
                if (!type) return {};
                var filterSrc = userFiltersObj;
                if (type === LS_UFP)
                    filterSrc = publicFiltersObj;

                if (filterSrc[viewId]) {
                    var index = filterSrc[viewId].filters.findIndex(function (filter) {
                        if (filter && filterName && (filter.filterName.toLowerCase() === filterName.toLowerCase()))
                            return filter;
                    });
                } else
                    return { index: -1, type: LS_UF, filterSrc: userFiltersObj};

                return { index: index, type: type, filterSrc: filterSrc, filterObj: filterSrc[viewId].filters[index] };
            }

            return result;
        }

        function getActiveFilterName(viewId = '') {
            if (!viewId) return;
            var lsStr = ktl.storage.lsGetItem(LS_UF_ACT + Knack.getUserAttributes().id);
            if (lsStr) {
                try {
                    var actFltObj = JSON.parse(lsStr);
                    if (!$.isEmptyObject(actFltObj)) {
                        return actFltObj[viewId];
                    }
                } catch (e) {
                    alert('getActiveFilterName - Error Found Parsing Filters: ' + viewId + ', reason: ' + e);
                }
            }
            return '';
        }

        function setupFiltersDragAndDrop(filterDivId = '') {
            //Setup Drag n Drop for filter buttons.
            if (document.getElementById(filterDivId + '-filterDivId')) {
                new Sortable(document.getElementById(filterDivId + '-filterDivId'), {
                    swapThreshold: 0.96,
                    animation: 250,
                    easing: "cubic-bezier(1, 0, 0, 1)",
                    onMove: function (/**Event*/evt, /**Event*/originalEvent) {
                        if (evt.dragged.filter.public && !Knack.getUserRoleNames().includes('Public Filters')) {
                            return false; //Cancel
                        }
                    },
                    onEnd: function (evt) {
                        if (evt.oldIndex !== evt.newIndex && evt.item.filter) {
                            var userFiltersAr = [];
                            var publicFiltersAr = [];

                            evt.to.children.forEach(function (item) {
                                var flt = getFilter(filterDivId, item.innerText);
                                if (evt.item.filter.public && flt.filterObj.public)
                                    publicFiltersAr.push(flt.filterSrc[filterDivId].filters[flt.index]);
                                else if (!evt.item.filter.public && !flt.filterObj.public)
                                    userFiltersAr.push(flt.filterSrc[filterDivId].filters[flt.index]);
                            });

                            if (userFiltersAr.length) {
                                userFiltersObj[filterDivId].filters = userFiltersAr;
                                saveFilters(LS_UF, filterDivId);
                            } else if (publicFiltersAr.length) {
                                publicFiltersObj[filterDivId].filters = publicFiltersAr;
                                saveFilters(LS_UFP, filterDivId);
                            }

                            ktl.userFilters.addFilterButtons(filterDivId);
                        }
                    }
                });
            }
        }

        //Used to reformat the report div ID to the URL. Ex: kn-report-view_2924-1 becomes view_2924_0.
        function filterDivIdToUrl(filterDivId = '') {
            if (!filterDivId) return;

            var filterUrlPart = filterDivId.replace('kn-report-', '');
            var vrAr = filterUrlPart.split('-');
            if (vrAr.length < 2)
                return filterUrlPart;

            var idx = parseInt(vrAr[1]) - 1;
            filterUrlPart = vrAr[0] + '_' + idx.toString();
            return filterUrlPart;
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
                        filterUrlPart = filterDivIdToUrl(filterDivId);

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
                    var saveFilterButton = ktl.fields.addButton(filterCtrlDiv, 'Save Filter', filterBtnStyle + '; background-color: #ece6a6',
                        ['kn-button', 'is-small'],
                        filterDivId + '_' + SAVE_FILTER_BTN + '_' + FILTER_BTN_SUFFIX);

                    saveFilterButton.setAttribute('disabled', 'true');
                    saveFilterButton.classList.add('filterControl', 'tooltip');
                    saveFilterButton.innerHTML = '<i class="fa fa-save fa-lg" id="' + filterDivId + '-' + SAVE_FILTER_BTN_SEL + '"></i><div class="tooltip"><span class="tooltiptext">Name and save your filter.<br>This will create a button.</span ></div>';
                    saveFilterButton.addEventListener('click', e => { ktl.userFilters.onSaveFilterBtnClicked(e, filterDivId); });

                    //Stop Filters button - to temove all active filters button for this view.  Always create, but enable/disable depending on filter state.
                    var stopFilterButton = ktl.fields.addButton(filterCtrlDiv, 'Stop Filter', filterBtnStyle + '; background-color: #e0cccc',
                        ['kn-button', 'is-small'],
                        filterDivId + '_' + STOP_FILTER_BTN + '_' + FILTER_BTN_SUFFIX);

                    stopFilterButton.setAttribute('disabled', 'true');
                    stopFilterButton.classList.add('filterControl', 'tooltip');
                    stopFilterButton.innerHTML = '<i class="fa fa-times fa-lg" id="' + filterDivId + '-' + STOP_FILTER_BTN_SEL + '"></i><div class="tooltip"><span class="tooltiptext">Remove all filtering and show all records.</span ></div>';
                    stopFilterButton.addEventListener('click', e => { onStopFilterBtnClicked(e, filterDivId); });

                    //Lock Public Filters button - to disable public Filters' automatic updates and triggering constant uploads.
                    if (Knack.getUserRoleNames().includes('Public Filters')) {
                        var lockPublicFiltersButton = ktl.fields.addButton(filterCtrlDiv, 'Lock Filters', filterBtnStyle + '; background-color: #b3d0bd',
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

            setActiveFilter: function (filterName = '', filterDivId = '') {
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
                                loadActiveFilters();
                                activeFilterNameObj[filterDivId] = filterName;
                                ktl.storage.lsSetItem(LS_UF_ACT + Knack.getUserAttributes().id, JSON.stringify(activeFilterNameObj));
                            }
                        })
                        .catch(function () {
                            ktl.log.clog('purple', 'setActiveFilter, Failed waiting for ' + btnSelector);
                        })
                } else
                    ktl.userFilters.removeActiveFilter(filterDivId);

                applyButtonColors();
            },

            removeActiveFilter: function (viewId = '') {
                if (!viewId) return;
                $('#' + viewId + ' .activeFilter').removeClass('activeFilter');
                applyButtonColors();

                loadActiveFilters();
                delete activeFilterNameObj[viewId];
                ktl.storage.lsSetItem(LS_UF_ACT + Knack.getUserAttributes().id, JSON.stringify(activeFilterNameObj));
            },

            //When user saves a filter to a named button, or when a filter's parameter is modified, like the sort order.
            onSaveFilterBtnClicked: function (e, filterDivId = '', updateActive = false) {
                if (!filterDivId) return;

                var filterUrlPart = filterDivIdToUrl(filterDivId);

                //Extract filter string for this view from URL and decode.
                var newFilterStr = '';
                var newPerPageStr = '';
                var newSortStr = '';
                var newSearchStr = '';
                var parts = ktl.core.splitUrl(window.location.href);
                const params = Object.entries(parts['params']);
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
                    });
                }

                if (!newFilterStr) return;

                var flt = {};
                var filterSrc = {};
                var filterName = '';
                var type = '';

                if (updateActive) {
                    flt = getFilter(filterDivId);
                    filterSrc = flt.filterSrc;
                    type = flt.type;

                    //If it's a public filter, exit if the unlocked icon is not present.  This covers all cases, i.e. when you don't have the right to modify it, or if you do but PFs are locked.
                    if (type === LS_UFP && !document.querySelector('#' + filterDivId + '_' + LOCK_FILTERS_BTN + '_' + FILTER_BTN_SUFFIX + ' .fa-unlock-alt'))
                        return;

                    if (flt.index >= 0)
                        filterName = flt.filterObj.filterName;
                } else {
                    filterName = prompt('Filter Name: ', '');
                    if (!filterName) return;

                    flt = getFilter(filterDivId, filterName);
                    filterSrc = flt.filterSrc;
                    type = flt.type;
                    if (flt.index >= 0) {
                        if (type === LS_UFP && !Knack.getUserRoleNames().includes('Public Filters')) {
                            alert('You can\'t overwrite Public Filters.\nChoose another name.');
                            return;
                        } else if (!confirm(filterName + ' already exists.  Do you want to overwrite?'))
                            return;
                    } else {
                        type = LS_UF; //By default, creating a new filter is always a User Filter.
                        filterSrc = userFiltersObj;
                    }
                }

                var fltObj = { 'filterName': filterName, 'filterString': newFilterStr, 'perPage': newPerPageStr, 'sort': newSortStr, 'search': newSearchStr };

                if (type === LS_UFP)
                    fltObj.public = true;

                if ($.isEmptyObject(filterSrc) || !filterSrc[filterDivId])
                    filterSrc[filterDivId] = { filters: [] };

                if (flt.index >= 0)
                    filterSrc[filterDivId].filters[flt.index] = fltObj;
                else
                    filterSrc[filterDivId].filters.push(fltObj);

                filterSrc.dt = ktl.core.getCurrentDateTime(true, true, false, true);

                saveFilters(type, filterDivId);
                ktl.userFilters.addFilterButtons(filterDivId);
                ktl.userFilters.setActiveFilter(filterName, filterDivId);
            },

            //Uploads the updated user filters.
            uploadUserFilters: function (data = []) {
                var viewId = ktl.iFrameWnd.getCfg().userFiltersViewId;
                loadFilters(LS_UF);
                if ($.isEmptyObject(userFiltersObj)) return;
                var ufObjStr = JSON.stringify(userFiltersObj);
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
                loadFilters(LS_UF);
                try {
                    ktl.log.clog('blue', 'Downloading user filters...');
                    userFiltersObj = newUserFiltersData.newUserFilters;
                    saveFilters(LS_UF);

                    //Live update of any relevant views.
                    const views = Object.keys(userFiltersObj);
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
                var viewId = ktl.iFrameWnd.getCfg().appSettingsViewId;
                loadFilters(LS_UFP);
                if ($.isEmptyObject(publicFiltersObj)) return;
                var pfObjStr = JSON.stringify(publicFiltersObj);
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
                loadFilters(LS_UFP);
                try {
                    ktl.log.clog('blue', 'Downloading Public filters...');
                    publicFiltersObj = newPublicFiltersData.newPublicFilters;
                    saveFilters(LS_UFP);

                    fixConflictWithUserFilters();

                    //Live update of any relevant views.
                    const views = Object.keys(publicFiltersObj);
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
                    loadFilters(LS_UF);
                    const views = Object.keys(userFiltersObj);
                    var foundConflict = false;
                    views.forEach(function (viewId) {
                        if (viewId.startsWith('view_')) {
                            for (i = 0; i < userFiltersObj[viewId].filters.length; i++) {
                                var flt = userFiltersObj[viewId].filters[i];
                                var fn = flt.filterName;
                                var fnp = getFilter(viewId, fn, LS_UFP);
                                if (fnp.index >= 0) {
                                    if (fn === fnp.filterObj.filterName) {
                                        console.log('Found conflict:', viewId, i, fn);
                                        foundConflict = true;
                                        flt.filterName += '_';
                                    }
                                }
                            }
                        }
                    })

                    if (foundConflict)
                        saveFilters(LS_UF);
                }
            },

            loadAllFilters: function () { //Typically used after a new login.
                loadAllFilters();
            },
        }
    })();

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
                                debugWnd = document.createElement('div');
                                debugWnd.setAttribute('id', 'debugWnd');
                                debugWnd.style.width = '900px';
                                debugWnd.style.height = '400px';
                                debugWnd.style.position = 'fixed';
                                debugWnd.style.right = '5px';
                                debugWnd.style.bottom = '50px';
                                debugWnd.style.padding = '3px';
                                debugWnd.style.resize = 'both';
                                debugWnd.style.whiteSpace = 'pre'; //Allow multiple spaces for Prettyprint indentation of JSON.
                                debugWnd.style['z-index'] = 9;
                                debugWnd.style['background-color'] = sysColors.paleLowSatClr;
                                debugWnd.style['border-style'] = 'ridge';
                                debugWnd.style['border-width'] = '5px';
                                debugWnd.style['border-color'] = sysColors.header.rgb;
                                debugWnd.style.display = 'none';

                                //Header
                                var debugWndHeader = document.createElement('div');
                                debugWndHeader.setAttribute('id', 'debugWndheader');
                                debugWndHeader.style.height = '30px';
                                debugWndHeader.style['z-index'] = 10;
                                debugWndHeader.style['color'] = sysColors.paleLowSatClr;
                                debugWndHeader.style['font-size'] = '12pt';
                                debugWndHeader.style['background-color'] = sysColors.header.rgb;
                                debugWndHeader.style['margin-bottom'] = '5px';
                                debugWndHeader.innerText = '  System Logs';
                                debugWndHeader.style['line-height'] = '30px';
                                debugWnd.appendChild(debugWndHeader);

                                //Clear button
                                var debugWndClear = document.createElement('div');
                                debugWndClear.setAttribute('id', 'debugWndClear');
                                debugWndClear.style.height = '30px';
                                debugWndClear.style.width = '65px';
                                debugWndClear.style.position = 'absolute';
                                debugWndClear.style.right = '8%';
                                debugWndClear.style.top = '3px';
                                debugWndClear.style['color'] = sysColors.buttonText.rgb;
                                debugWndClear.style['background-color'] = sysColors.button.rgb;
                                debugWndClear.style['padding-left'] = '12px';
                                debugWndClear.style['padding-right'] = '12px';
                                debugWndClear.style['margin-inline'] = '5px';
                                debugWndClear.style['box-sizing'] = 'border-box';
                                debugWndClear.style['line-height'] = '200%'; //Trick to center text vertically.
                                debugWndClear.innerText = 'Clear';
                                debugWndClear.classList.add('pointer');
                                debugWndHeader.appendChild(debugWndClear);
                                debugWndClear.addEventListener('click', function (e) { clearLsLogs(); })
                                debugWndClear.addEventListener('touchstart', function (e) { clearLsLogs(); })

                                //Close button
                                var debugWndClose = document.createElement('div');
                                debugWndClose.setAttribute('id', 'debugWndClose');
                                debugWndClose.style.height = '30px';
                                debugWndClose.style.width = '65px';
                                debugWndClose.style.position = 'absolute';
                                debugWndClose.style.right = '0%';
                                debugWndClose.style.top = '3px';
                                debugWndClose.style['color'] = sysColors.buttonText.rgb;
                                debugWndClose.style['padding-left'] = '12px';
                                debugWndClose.style['padding-right'] = '12px';
                                debugWndClose.style['margin-inline'] = '5px';
                                debugWndClose.style['box-sizing'] = 'border-box';
                                debugWndClose.style['background-color'] = sysColors.button.rgb;
                                debugWndClose.style['line-height'] = '200%'; //Trick to center text vertically.
                                debugWndClose.innerText = 'Close';
                                debugWndClose.classList.add('pointer');
                                debugWndHeader.appendChild(debugWndClose);
                                debugWndClose.addEventListener('click', function (e) { ktl.debugWnd.showDebugWnd(false); })
                                debugWndClose.addEventListener('touchstart', function (e) { ktl.debugWnd.showDebugWnd(false); })

                                //Text area
                                var debugWndText = document.createElement('div');
                                debugWndText.setAttribute('id', 'debugWndText');
                                debugWndText.style.height = '92%';
                                debugWndText.style['color'] = sysColors.text.rgb;
                                debugWndText.style.overflow = 'scroll';
                                debugWndText.style.fontFamily = 'monospace';
                                debugWndText.style.fontWeight = 'bold';
                                debugWndText.style.fontSize = '10px';
                                debugWnd.appendChild(debugWndText);

                                document.body.appendChild(debugWnd);

                                ktl.debugWnd.showDebugWnd(true);
                                ktl.core.enableDragElement(document.getElementById('debugWnd'));
                                debugWnd.addEventListener('dblclick', function () { clearLsLogs(); });

                                function clearLsLogs() {
                                    if (confirm('Are you sure you want to delete Local Storage?')) {
                                        if (confirm('OK: Delete only Logs\nCANCEL: delete ALL data'))
                                            ktl.debugWnd.cleanupLogs(getLocalStorageLogs(), true);
                                        else
                                            ktl.debugWnd.cleanupLogs(null, true);

                                        ktl.debugWnd.showLogsInDebugWnd();
                                    }
                                }

                                debugWnd.onscroll = function () { //TODO: Disable auto-scroll when going back up manually to examine logs.
                                    dbgWndScrollHeight = debugWnd.scrollTop + 14; //14 for fine tuning of height.

                                    //Handle when user scrolls all the way down
                                    //https://stackoverflow.com/questions/3898130/check-if-a-user-has-scrolled-to-the-bottom/3898152
                                    //$(window).scroll(function () {
                                    //    if ($(window).scrollTop() + $(window).height() == $(document).height()) {
                                    //        alert("Reached bottom!");
                                    //    }
                                    //});
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
                        }, 2000);
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
                    var cri = ktl.storage.lsGetItem(ktl.const.LS_CRITICAL + Knack.getUserAttributes().id);
                    var lgin = ktl.storage.lsGetItem(ktl.const.LS_LOGIN + Knack.getUserAttributes().id);
                    var act = ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id);
                    var nav = ktl.storage.lsGetItem(ktl.const.LS_NAVIGATION + Knack.getUserAttributes().id);
                    var appErr = ktl.storage.lsGetItem(ktl.const.LS_APP_ERROR + Knack.getUserAttributes().id);
                    var svrErr = ktl.storage.lsGetItem(ktl.const.LS_SERVER_ERROR + Knack.getUserAttributes().id);
                    var wrn = ktl.storage.lsGetItem(ktl.const.LS_WRN + Knack.getUserAttributes().id);
                    var inf = ktl.storage.lsGetItem(ktl.const.LS_INFO + Knack.getUserAttributes().id);
                    var dbg = ktl.storage.lsGetItem(ktl.const.LS_DEBUG + Knack.getUserAttributes().id);

                    debugWndText.textContent +=
                        (cri ? ('CRITICAL: ' + ktl.storage.lsGetItem(ktl.const.LS_CRITICAL + Knack.getUserAttributes().id) + '\n') : '') +
                        (lgin ? ('LOGIN: ' + ktl.storage.lsGetItem(ktl.const.LS_LOGIN + Knack.getUserAttributes().id) + '\n') : '') +
                        (act ? ('ACT: ' + ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id) + '\n') : '') +
                        (nav ? ('NAV: ' + ktl.storage.lsGetItem(ktl.const.LS_NAVIGATION + Knack.getUserAttributes().id) + '\n') : '') +
                        (appErr ? ('APP ERR: ' + ktl.storage.lsGetItem(ktl.const.LS_APP_ERROR + Knack.getUserAttributes().id) + '\n') : '') +
                        (svrErr ? ('SVR ERR: ' + ktl.storage.lsGetItem(ktl.const.LS_SERVER_ERROR + Knack.getUserAttributes().id) + '\n') : '') +
                        (wrn ? ('WRN: ' + ktl.storage.lsGetItem(ktl.const.LS_WRN + Knack.getUserAttributes().id) + '\n') : '') +
                        (inf ? ('INF: ' + ktl.storage.lsGetItem(ktl.const.LS_INFO + Knack.getUserAttributes().id) + '\n') : '') +
                        (dbg ? ('DBG: ' + ktl.storage.lsGetItem(ktl.const.LS_DEBUG + Knack.getUserAttributes().id) + '\n') : '') +
                        'Total localStorage usage = ' + lsItems + '\n';

                    debugWndText.scrollTop = dbgWndScrollHeight - 14;
                    debugWndText.focus();
                }
            },
        }
    })();

    //====================================================
    //Views feature
    this.views = (function () {
        const PAUSE_REFRESH = 'pause_auto_refresh';
        var autoRefreshViews = {};
        var unPauseTimer = null;
        var processViewFlags = null;
        var dropdownSearching = {}; //Used to prevent concurrent searches on same field.

        $(document).on('knack-scene-render.any', function (event, scene) {
            //In developer mode, add a checkbox to pause all views' auto-refresh.
            if (ktl.account.isDeveloper() && !ktl.scenes.isiFrameWnd()) {
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

            for (var viewId in Knack.views)
                Knack.views[viewId] && (ktl.views.addViewId(Knack.views[viewId].model.view));
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            ktlProcessViewFlags(view, data);
            ktl.views.addViewId(view);
            disableFilterOnFields(view);
        })

        //Remove default handleClickSort and use KTL's instead for more flexibility.
        $(document).on('mousedown', function (e) {
            $('thead').off('click');
        })

        $(document).on('click', function (e) {
            ktl.views.handleClickSort(e);

            //Pause auto-refresh when on a tables's search field.
            if (e.target.closest('.table-keyword-search') && e.target.name === 'keyword' /*Needed to discriminate checkboxes.  We only want Search fields*/)
                ktl.views.autoRefresh(false);
        })

        document.addEventListener('focusout', function (e) {
            try {
                if (e.target.form.classList[0].includes('table-keyword-search') && $.isEmptyObject(autoRefreshViews))
                    ktl.views.autoRefresh();
            } catch (err) { }
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

        //Process views with special flags in their titles, such as HIDDEN_VIEW and HIDDEN_TITLE, etc.
        function ktlProcessViewFlags(view, data) {
            try {
                //Clean up title first by removing all flags. All flags must be AFTER any title text to be kept.
                if (view.title && view.title !== '') {
                    var index = Math.min(
                        ktl.core.getSubstringPosition(view.title, 'AUTOREFRESH', 1),
                        ktl.core.getSubstringPosition(view.title, 'HIDDEN_', 1),
                        ktl.core.getSubstringPosition(view.title, 'NO_INLINE', 1),
                        ktl.core.getSubstringPosition(view.title, 'USER_FILTERS_', 1),
                        ktl.core.getSubstringPosition(view.title, 'ADD_', 1),
                        ktl.core.getSubstringPosition(view.title, 'NO_BUTTONS', 1),
                        ktl.core.getSubstringPosition(view.title, 'BROADCAST_SW_UPDATE', 1)
                    );

                    //Truncate all title characters beyond the lowest index found.
                    var title = view.title.substring(0, index);
                    $('#' + view.key + ' > div.view-header > h1').text(title); //Search Views use H1 instead of H2.
                    $('#' + view.key + ' > div.view-header > h2').text(title);

                    //Hide the whole view, typically used when doing background searches.
                    if (view.title.includes('HIDDEN_VIEW')) {
                        if (!Knack.getUserRoleNames().includes('Developer'))
                            $('#' + view.key).css({ 'position': 'absolute', 'left': '-9000px' }); //Hide (move) away from screen to prevent clicking and adding duplicates.
                    }

                    //Hide the view title only, typically used to save space when real estate is critical.
                    if (view.title.includes('HIDDEN_TITLE')) {
                        $('#' + view.key + ' > div.view-header > h1').css({ 'position': 'absolute', 'left': '-9000px' }); //Search Views use H1 instead of H2.
                        $('#' + view.key + ' > div.view-header > h2').css({ 'position': 'absolute', 'left': '-9000px' });
                    }

                    //Disable mouse clicks when a table's Inline Edit is enabled for PUT/POST API calls, but you don't want users to modify cells.
                    if (Knack.views[view.key] && Knack.views[view.key].model && Knack.views[view.key].model.view.options && Knack.views[view.key].model.view.options.cell_editor) {
                        if (view.title.includes('NO_INLINE') && !ktl.account.isDeveloper())
                            $('#' + view.key + ' .cell-edit').css({ 'pointer-events': 'none', 'background-color': '', 'font-weight': '' });
                        else
                            $('#' + view.key + ' .cell-edit').css({ 'pointer-events': 'all', 'background-color': '#ffffdd', 'font-weight': 'bold' });
                    }

                    if (view.title.includes('ADD_TIMESTAMP'))
                        ktl.views.addTimeStampToHeader(view);
                }

                //Remove unwanted columns, as specified in Builder, when _HIDE and _REMOVE is found in header.
                if (view.type === 'table' /*TODO: add more view types*/) {
                    var columns = view.columns;
                    var hiddenFieldsAr = [];
                    var removedFieldsAr = [];
                    var header = '';
                    var fieldId = '';
                    columns.forEach(col => {
                        header = col.header;
                        if (col.type === 'field')
                            fieldId = col.id;
                        else if (col.type === 'link' && col.link_type === 'field')
                            fieldId = col.field.key;

                        if (header.includes('_HIDE'))
                            hiddenFieldsAr.push(fieldId);
                        if (header.includes('_REMOVE'))
                            removedFieldsAr.push(fieldId);
                    })

                    if (hiddenFieldsAr.length)
                        ktl.views.removeTableColumns(view.key, false, [], hiddenFieldsAr);
                    if (removedFieldsAr.length)
                        ktl.views.removeTableColumns(view.key, true, [], removedFieldsAr);
                }

                processViewFlags && processViewFlags(view, data);

                //Put back h2 opacity to normal (see CSS code).
                //This is to prevent seeing the title flags in headings until they are removed, which happens often on slower devices.
                $('h2').css('opacity', '1');
            }
            catch (err) { console.log('err', err); };
        }

        //Filter Restriction Rules from view's Description.
        function disableFilterOnFields(view) {
            if (view.type === 'table' /*TODO: add more view types*/) {
                const NF = 'NO_FILTER=';
                var descr = view.description;
                if (!descr) return;
                var index = descr.indexOf(NF);
                if (index >= 0) {
                    descr = descr.substr(index + NF.length);
                    var realDescr = view.description.substr(0, index - 1);
                    var sel = '#' + view.key + ' .kn-description';
                    ktl.core.waitSelector(sel, 5000)
                        .then(function () {
                            document.querySelector(sel).innerText = realDescr;
                            descr = descr.replace(/\s/g, '')
                            var fieldsAr = descr.split(',');
                            $('.kn-add-filter,.kn-filters').on('click', function (e) {
                                var filterFields = document.querySelectorAll('.field.kn-select select option');
                                filterFields.forEach(field => {
                                    if (fieldsAr.includes(field.value))
                                        field.remove();
                                })
                            })
                        })
                        .catch(function () {
                            ktl.log.clog('purple', 'disableFilterOnFields failed waiting for description.');
                        })
                }
            }
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.processViewFlags && (processViewFlags = cfgObj.processViewFlags);
            },

            refreshView: function (viewId) {
                return new Promise(function (resolve) {
                    if (viewId) {
                        var res = $('#' + viewId);
                        if (res.length > 0) { //One last check if view is in the current scene, since user can change page quickly.
                            var view = Knack.router.scene_view.model.views._byId[viewId];
                            if (!view || !view.attributes) {
                                resolve();
                                return;
                            }

                            var viewType = view.attributes.type;
                            var formAction = view.attributes.action;
                            var useFetch = (formAction === 'insert' || formAction === 'create') ? false : true;

                            //This generates a bit too much logs sometimes.  Uncomment if you really need it.
                            //if (ktl.userPrefs.getUserPrefs().showExtraDebugInfo) {
                            //    ktl.log.clog('purple, 'refreshView: ' + viewId);
                            //    console.log('viewType:', viewType, '  formAction:', formAction, '  useFetch:', useFetch);
                            //}

                            (function tryRefresh(retryCtr) {
                                if (view && ['search', 'form', 'rich_text', 'menu' /*more types?*/].includes(viewType)) {
                                    if (useFetch) { //Can't use fetch() because it triggers a on submit event for some reason.
                                        Knack.views[viewId].model.trigger('change'); //This does the job though.  Discovered by trial and error!
                                        Knack.views[viewId].renderForm && Knack.views[viewId].renderForm();
                                        Knack.views[viewId].renderView && Knack.views[viewId].renderView();
                                    }
                                    Knack.views[viewId].render();
                                    Knack.views[viewId].postRender && Knack.views[viewId].postRender(); //This is needed for menus.
                                } else {
                                    Knack.views[viewId].model.fetch({
                                        success: function (model, response, options) {
                                            if (['details' /*more types?*/].includes(viewType)) {
                                                Knack.views[viewId].render();
                                                Knack.views[viewId].postRender && Knack.views[viewId].postRender();
                                            }

                                            resolve(model);
                                            return;
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
                                                if (Knack.router.scene_view.model.views._byId[viewId].attributes.title.includes('AUTOREFRESH')) {
                                                    resolve(); //Just ignore, we'll try again shortly anyways.
                                                    return;
                                                } else {
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

                                resolve();
                                return;
                            }
                        }
                    } else {
                        var callerInfo = refreshView.caller.toString().replace(/\s+/g, ' ');
                        ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1009 - Called refreshView with invalid parameter.  Caller info: ' + callerInfo);
                        resolve(); //Always resolve.
                    }
                });
            },

            refreshViewArray: function (viewsToRefresh) {
                return new Promise(function (resolve, reject) {
                    if (viewsToRefresh.length === 0)
                        resolve();
                    else {
                        Knack.showSpinner();

                        var promisesArray = [];
                        viewsToRefresh.forEach(function (viewId) {
                            promisesArray.push(
                                ktl.views.refreshView(viewId)
                                    .then(() => {
                                        //ktl.log.clog('green', 'View refreshed successfully: ' + viewId);
                                    })
                                    .catch(() => {
                                        ktl.log.clog('red', 'Error refreshing view:' + viewId);
                                    })
                            )
                        })

                        Promise.all(promisesArray)
                            .then(() => {
                                //ktl.log.clog('green', 'All views refreshed!');
                                Knack.hideSpinner();
                                resolve();
                            })
                            .catch(() => {
                                ktl.log.clog('red', 'Error refreshing views!');
                                reject()
                            })
                            .finally(() => {
                                clearTimeout(failsafe);
                            })
                    }

                    var failsafe = setTimeout(() => {
                        ktl.log.clog('red', 'Failsafe timeout in refreshViewArray!');
                        reject();
                    }, 30000);
                })
            },

            //Parse the Knack object to find all views and start any applicable autorefresh interval timers for each, based on title.
            //Triggered when view title contains AUTOREFRESH=30 (for 30 seconds interval in this example).
            autoRefresh: function (run = true, autoRestart = true) {
                clearTimeout(unPauseTimer);
                if (run) {
                    if (!$.isEmptyObject(autoRefreshViews))
                        stopAutoRefresh(false); //Force a clean start.

                    Knack.router.scene_view.model.views.models.forEach(function (eachView) {
                        var view = eachView.attributes;
                        if (view.title && view.title.includes('AUTOREFRESH')) {
                            var index = view.title.lastIndexOf('='); //Get refresh delay value
                            var intervalDelay = (index === -1) ? 20 : intervalDelay = Math.max(Math.min(parseInt(view.title.substring(index + 1)), 86400 /*One day*/), 5); //Restrain value between 5s and 24h.

                            //Add view to autorefresh list.
                            if (!(view.key in autoRefreshViews)) {
                                var intervalId = setInterval(function () {
                                    ktl.views.refreshView(view.key).then(function () { });
                                }, intervalDelay * 1000);

                                autoRefreshViews[view.key] = { delay: intervalDelay, intervalId: intervalId };
                            }
                        }
                    })
                    $('#' + PAUSE_REFRESH + '-label-id').css('background-color', '');
                } else
                    stopAutoRefresh();

                $('#' + PAUSE_REFRESH + '-id').prop('checked', !run);

                //Stop all autorefresh interval timers for all views.
                function stopAutoRefresh(restart = true) {
                    $('#' + PAUSE_REFRESH + '-label-id').css('background-color', 'red');
                    const views = Object.entries(autoRefreshViews);
                    if (views.length > 0) {
                        views.forEach(function (element) {
                            var intervalId = element[1].intervalId;
                            clearInterval(intervalId);
                        })

                        autoRefreshViews = {};

                        //For safety reasons, automatically 'un-pause' autoRefresh after five minutes to re-enable it.
                        if (restart && autoRestart) {
                            unPauseTimer = setTimeout(function () {
                                ktl.views.autoRefresh();
                            }, FIVE_MINUTES_DELAY)
                        }
                    }
                }
            },

            addViewId: function (view, fontStyle = 'color: red; font-weight: bold; font-size:small') {
                if (ktl.userPrefs.getUserPrefs().showViewId && $('#' + view.key + '-label-id').length === 0/*Add once only*/) {
                    var label = document.createElement('label');
                    label.setAttribute('id', view.key + '-label-id');
                    label.appendChild(document.createTextNode('    ' + view.key));
                    label.setAttribute('style', 'margin-left: 10px; margin-top: 8px;' + fontStyle);

                    var submitBtn = $('#' + view.key + ' .kn-submit');
                    var divHdr = document.querySelector('#' + view.key + ' h1:not(#knack-logo), ' + '#' + view.key + ' h2, ' + '#' + view.key + ' h3, ' + '#' + view.key + ' h4');
                    if (divHdr) {
                        //console.log(view.key, 'divHdr =', divHdr, divHdr.innerText);

                        //If there's no title or no title text, let's try our best to get an elegant layout.
                        var divTitle = document.querySelector('#' + view.key + ' .kn-title')
                        if (divTitle) {
                            var display = window.getComputedStyle(divTitle).display;
                            //console.log(view.key, 'display =', display); 
                            if (display && (display === 'none' || !divHdr.innerText)) { //Typically hidden by a special title flag.
                                //console.log('submitBtn =', submitBtn);
                                if (submitBtn.length)
                                    submitBtn.append(label);
                                else {
                                    //console.log(view.key, 'no submit button');
                                    $('#' + view.key + ' .view-header').append(label);
                                }
                            } else {
                                $('#' + view.key + ' .view-header').css({ 'display': 'inline-flex' }).append(label);
                            }
                        } else {
                            $('#' + view.key).css({ 'display': 'inline-flex' }).append(label);//.prepend(label);
                        }
                    } else {
                        if (submitBtn.length) {
                            submitBtn.append(label);
                        } else if ($('.kn-form.kn-view' + '.' + view.key).length) {
                            $('.kn-form.kn-view' + '.' + view.key).append(label);
                        } else if ($('#' + view.key + ' .control').length) {
                            $('#' + view.key + ' .control').css({ 'display': 'inline-flex' }).append(label);
                        } else if ($('.kn-details.kn-view' + '.' + view.key).length) {
                            $('.kn-details.kn-view' + '.' + view.key).append(label);
                        } else {
                            label.setAttribute('style', 'margin-top: 8px;' + fontStyle);
                            $('#' + view.key).prepend(label);
                        }
                    }
                } else {
                    if (!ktl.userPrefs.getUserPrefs().showViewId) {
                        $('#' + view.key + '-label-id').remove();
                    }
                }
            },

            //Params: masterCheckBoxCallback is the function to be called when the top checkbox is clicked.
            //        It is used to do an action upon change like ena/disable a button or show number of items checked.
            addCheckboxesToTable: function (viewId, masterCheckBoxCallback = null) {
                var selNoData = $('#' + viewId + ' > div.kn-table-wrapper > table > tbody > tr > td.kn-td-nodata');

                //Only add checkboxes if there's data and checkboxes not yet added.
                if (selNoData.length === 0 && !document.querySelector('#' + viewId + ' > div.kn-table-wrapper > table > thead > tr > th:nth-child(1) > input[type=checkbox]')) {
                    // Add the checkbox to to the header to select/unselect all
                    $('#' + viewId + '.kn-table thead tr').prepend('<th><input type="checkbox"></th>');
                    $('#' + viewId + '.kn-table thead input').change(function () {
                        $('.' + viewId + '.kn-table tbody tr input').each(function () {
                            $(this).attr('checked', $('#' + viewId + '.kn-table thead input').attr('checked') != undefined);
                        });

                        var numChecked = $('#' + viewId + ' tbody input[type=checkbox]:checked').length;
                        masterCheckBoxCallback && masterCheckBoxCallback(numChecked);
                    });

                    //Add a checkbox to each row in the table body
                    $('#' + viewId + ' .kn-table tbody tr').each(function () {
                        if (!this.classList.contains('kn-table-totals') && !this.classList.contains('kn-table-group'))
                            $(this).prepend('<td><input type="checkbox"></td>');
                    });


                    //For summary lines, prepend a space.
                    if (Knack.router.scene_view.model.views._byId[viewId].attributes.totals.length) {
                        var sel = '#' + viewId + ' tr.kn-table-totals';
                        ktl.core.waitSelector(sel, 10000) //For some reason, totals need extra wait time due to delayed server response.
                            .then(function () {
                                $('#' + viewId + ' tr.kn-table-totals').each(function () {
                                    $(this).prepend('<td style="background-color: #eee; border-top: 1px solid #dadada;"></td>');
                                });
                            })
                            .catch(function () { ktl.log.clog('purple', 'Failed waiting for table totals.', viewId); })
                    }

                    //For groups, extend line up to end.
                    var cols = Knack.router.scene_view.model.views._byId[viewId].attributes.columns;
                    var groupingFound = false;
                    for (i = 0; i < cols.length; i++) {
                        if (cols[i].grouping) {
                            groupingFound = true;
                            break;
                        }
                    }

                    if (groupingFound) {
                        var sel = '#' + viewId + ' tr.kn-table-group';
                        ktl.core.waitSelector(sel, 10000) //Totals may need extra wait time due to delayed server response.
                            .then(function () {
                                $('#' + viewId + ' tr.kn-table-group').each(function () {
                                    $(this).find('td').attr('colspan', document.querySelectorAll('#' + viewId + ' thead th').length);
                                });
                            })
                            .catch(function () { ktl.log.clog('purple', 'Failed waiting for table totals.', viewId); })
                    }
                }
            },

            addTimeStampToHeader: function (view) {
                var header = document.querySelector('#' + view.key + ' .kn-title');
                if ($('#' + view.key + '-timestamp-id').length === 0/*Add only once*/) {
                    var timestamp = document.createElement('label');
                    timestamp.setAttribute('id', view.key + '-timestamp-id');
                    timestamp.appendChild(document.createTextNode(ktl.core.getCurrentDateTime(false, true, false, false)));
                    timestamp.setAttribute('style', 'margin-left: 60px; color: blue; font-weight: bold; font-size:20pt;');
                    header && header.append(timestamp);
                }
            },

            hideField: function (fieldId) {
                $('#kn-input-' + fieldId).css({ 'position': 'absolute', 'left': '-9000px' });
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
                        reject('');
                        return;
                    }

                    //if (dropdownSearching[fieldId])
                    //    return; //Exit if a search is already in progress for this field.

                    dropdownSearching[fieldId] = fieldId;

                    //If we're editing a cell, then it becomes our view by default and ignore viewId parameter.
                    //If viewId not specified, find first fieldId in page.
                    var viewSel = document.activeElement.closest('#cell-editor') ? '#cell-editor ' : ''; //Support inline editing.
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
                                                        $('.ui-autocomplete-input').val('');
                                                        $('#chznBetter').val('');
                                                        document.activeElement.blur();
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
            removeTableColumns: function (viewId = '', remove = true, columnsArray = [], fieldsArray = []) {
                var header;
                var cell;
                var column;

                if (!viewId || ((fieldsArray && fieldsArray.length === 0) && (columnsArray && columnsArray.length === 0))) {
                    ktl.log.clog('purple', 'Called removeTableColumns with invalid parameters.');
                    return;
                }

                if (columnsArray && columnsArray.length > 0) {
                    columnsArray.forEach(function (el) {
                        //Remove Header
                        header = $('#' + viewId + ' > div.kn-table-wrapper > table > thead > tr > th:nth-child(' + el + ')');
                        if (remove)
                            header.remove();
                        else
                            header.css({ 'display': 'none' });

                        //Remove each data field
                        cell = $('#' + viewId + ' > div.kn-table-wrapper > table > tbody > tr > td:nth-child(' + el + ')');
                        if (cell.length > 0) {
                            if (remove)
                                cell.remove();
                            else
                                cell.css({ 'display': 'none' });
                        }
                    })
                }

                if (fieldsArray && fieldsArray.length > 0) {
                    $("div.kn-table.kn-view." + viewId + " table.kn-table thead tr th").each(function (index) {
                        header = $(this)[0].className;

                        if (fieldsArray.some(function (v) { return header.indexOf(v) >= 0; })) {
                            if (remove)
                                $(this).remove(); //Remove header.
                            else
                                $(this).css({ 'display': 'none' });

                            //Remember each columns where cells muse be removed.
                            column = index + 1;

                            //Remove each row's data.
                            $("div.kn-table.kn-view." + viewId + " table tr:not(.kn-table-group)").each(function () {
                                cell = $(this).find('td:nth-child(' + column.toString() + ')');
                                if (cell.length > 0) {
                                    if (remove)
                                        cell.remove(); //Remove cell.
                                    else
                                        cell.css({ 'display': 'none' });
                                }
                            })
                        }
                    })
                }
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
            //It returns the record found, or undefined if nothing is found.
            findRecord: function (data = [], fieldId = '', value = '') {
                if (!data.length || !fieldId || !value) return;
                for (i = 0; i < data.length; i++) {
                    if (data[i][fieldId] === value)
                        return data[i];
                }
            },

            //When a table header is clicked to sort, invert sort order if type is date_time, so we get most recent first.
            //Note: this function replaces the Knack's default handler completely.
            handleClickSort: function (e) {
                if (e.target.closest('.kn-sort')) {
                    e.preventDefault();
                    var viewId = e.target.closest('.kn-table.kn-view');
                    if (viewId) {
                        viewId = viewId.getAttribute('id');
                        var href = e.target.closest('[href]');
                        if (href) {
                            Knack.showSpinner();
                            var fieldId = e.target.closest('th').classList[0];
                            if (Knack.objects.getField(fieldId)) {
                                var fieldAttr = Knack.objects.getField(fieldId).attributes;
                                var ctrlClickInvert = false;
                                if (e.ctrlKey)
                                    ctrlClickInvert = true;

                                href = e.target.closest('.kn-sort').href;
                                var order = href.split('|')[1];
                                var newField = href.split('|')[0].split('#')[1];
                                var viewObj = Knack.views[viewId];
                                if (fieldAttr.type === 'date_time')
                                    ctrlClickInvert = !ctrlClickInvert;

                                var alreadySorted = e.target.closest('[class*="sorted-"]');
                                if (!alreadySorted)
                                    order = ctrlClickInvert ? 'desc' : 'asc';

                                viewObj.model.view.source.sort = [{
                                    field: newField,
                                    order: order
                                }];

                                var i = {};
                                i[viewId + "_sort"] = newField + "|" + order;
                                var r = Knack.getSceneHash() + "?" + Knack.getQueryString(i);
                                Knack.router.navigate(r);
                                Knack.setHashVars();
                                viewObj.model.setDataAPI();

                                Knack.models[viewId].fetch({
                                    success: () => {
                                        Knack.hideSpinner();
                                        ktl.userFilters.onSaveFilterBtnClicked(e, viewId, true);
                                    }
                                });
                            }
                        }
                    }
                }
            },

            submitAndWait: function (viewId = '', formData = {/*fieldId: value*/}) {
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
                            success = document.querySelector('#' + viewId + ' .kn-message.success') && document.querySelector('#' + viewId + ' .kn-message.success > p').innerText;
                            failure = document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body') && document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body > p').innerText;
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

                    var success = null, failure = null;
                    var loggedIn = (Knack.getUserAttributes() !== 'No user found');
                    var intervalId = setInterval(function () {
                        success = document.querySelector('#' + viewId + ' .kn-message.success') && document.querySelector('#' + viewId + ' .kn-message.success > p').innerText;
                        if (!loggedIn && (Knack.getUserAttributes() !== 'No user found'))
                            success = true;
                        failure = document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body') && document.querySelector('#' + viewId + ' .kn-message.is-error .kn-message-body > p').innerText;
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
                if (!viewId) return;

                var submit = document.querySelector('#' + viewId + ' .is-primary');
                var validity = submit.validity ? submit.validity : true;
                var submitDisabled = !$.isEmptyObject(validity.invalidItemObj);
                if (submitDisabled)
                    submit.setAttribute('disabled', true);
                else
                    submit.removeAttribute('disabled');

                submitDisabled && ktl.scenes.spinnerWatchdog(!submitDisabled); //Don't let the disabled Submit cause a page reload.
            },
        }
    })();

    //====================================================
    //Scenes feature
    this.scenes = (function () {
        var spinnerCtrDelay = 30;
        var spinnerCtr = 0;
        var spinnerInterval = null;
        var spinnerWdExcludeScn = [];
        var spinnerWdRunning = false;
        var idleWatchDogTimer = null;
        var kioskButtons = {};
        var prevScene = '';
        var idleWatchDogDelay = 0;

        //App callbacks
        var onSceneRender = null;
        var autoFocus = null;
        var spinnerWatchDogTimeout = null;
        var idleWatchDogTimeout = null;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (Knack.router.current_scene_key !== scene.key) {
                alert('ERROR - Scene keys do not match!');
                return;
            }

            //Leaving more time to iFrameWnd has proven to reduce errors and improve stability.
            //Anyways... no one is getting impatient at an invisible window!
            if (window.self.frameElement && (window.self.frameElement.id === IFRAME_WND_ID))
                spinnerCtrDelay = 60;

            if (ktl.core.isKiosk()) {
                //Add extra space at bottom of screen in kiosk mode, to allow editing with the 
                //virtual keyboard without blocking the input field.
                if (ktl.userPrefs.getUserPrefs().showIframeWnd || ktl.scenes.isiFrameWnd())
                    $('body').css({ 'padding-bottom': '' });
                else
                    $('body').css({ 'padding-bottom': '500px' });
            } else {
                if (!window.self.frameElement) //If not an iFrame, put back header hidden by CSS.
                    (document.querySelector("#kn-app-header") || document.querySelector('.knHeader')).setAttribute('style', 'display:block !important');
            }

            ktl.scenes.spinnerWatchdog();
            ktl.iFrameWnd.create();
            ktl.views.autoRefresh();
            ktl.scenes.resetIdleWatchdog();
            ktl.fields.convertNumToTel();
            ktl.core.sortMenu();

            //Handle Scene change.
            if (prevScene != scene.key) {
                var menu = ktl.core.getMenuInfo().menu;
                (ktl.core.getCfg().enabled.showMenuInTitle && menu) && (document.title = Knack.app.attributes.name + ' - ' + menu); //Add menu to browser's tab.

                if (prevScene) //Do not log navigation on first page - useless and excessive.  We only want transitions.
                    ktl.log.addLog(ktl.const.LS_NAVIGATION, scene.key + ', ' + JSON.stringify(ktl.core.getMenuInfo()), false);

                prevScene = scene.key;
            }

            var lastSavedVersion = ktl.storage.lsGetItem('APP_KTL_VERSIONS');
            if (!lastSavedVersion || lastSavedVersion !== APP_KTL_VERSIONS) {
                ktl.log.addLog(ktl.const.LS_INFO, 'KEC_1013 - Updated software: ' + APP_KTL_VERSIONS);
                ktl.storage.lsSetItem('APP_KTL_VERSIONS', APP_KTL_VERSIONS);
                ktl.storage.lsRemoveItem('SW_VERSION'); //Remove obsolete key.  TODO: Delete in a few weeks.
            }

            onSceneRender && onSceneRender(event, scene);
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            //Kiosk buttons must be added each time a view is rendered, otherwise they disappear after a view's refresh.
            ktl.scenes.addKioskButtons(view.key, {});
        })

        $(document).on('mousedown', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('mousemove', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('keypress', function (e) { ktl.scenes.resetIdleWatchdog(); })

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.idleWatchDogDelay && (idleWatchDogDelay = cfgObj.idleWatchDogDelay);
                cfgObj.idleWatchDogTimeout && (idleWatchDogTimeout = cfgObj.idleWatchDogTimeout);
                cfgObj.spinnerWdExcludeScn && (spinnerWdExcludeScn = cfgObj.spinnerWdExcludeScn);
                cfgObj.spinnerWatchDogTimeout && (spinnerWatchDogTimeout = cfgObj.spinnerWatchDogTimeout);
                cfgObj.spinnerCtrDelay && (spinnerCtrDelay = cfgObj.spinnerCtrDelay);
                cfgObj.autoFocus && (autoFocus = cfgObj.autoFocus);
                cfgObj.kioskButtons && (kioskButtons = cfgObj.kioskButtons);
                cfgObj.onSceneRender && (onSceneRender = cfgObj.onSceneRender);
            },

            getCfg: function () {
                return {
                    idleWatchDogDelay,
                }
            },

            autoFocus: function () {
                if (!ktl.core.getCfg().enabled.autoFocus)
                    return;

                if (!document.querySelector('#cell-editor')) //If inline editing uses chznBetter, keep focus here after a succesful search.
                    autoFocus && autoFocus();
            },

            //Improved version of Knack.router.scene_view.renderViews() that doesn't screw up all layout.
            renderViews: function () {
                //console.log('ktl.scenes.renderViews.caller =', ktl.scenes.renderViews.caller);
                var views = Object.entries(Knack.views);
                for (var i = 0; i < views.length; i++)
                    ktl.views.refreshView(views[i][0]);
            },

            //Add default extra buttons to facilitate Kiosk mode:  Refresh, Back, Done and Messaging
            //Excludes all iFrames and all view titles must not contain NO_BUTTONS flag.
            addKioskButtons: function (viewId = '', style = {}) {
                if (window.self.frameElement || !ktl.core.isKiosk())
                    return;

                try {
                    var backBtnText = '';
                    if (typeof Knack.views[viewId] === 'undefined' || typeof Knack.views[viewId].model.view.title === 'undefined')
                        return;

                    var title = Knack.views[viewId].model.view.title;
                    if (title.includes('NO_BUTTONS'))
                        return;
                    else {
                        if (title.includes('ADD_REFRESH')) {
                            if (title.includes('ADD_BACK'))
                                backBtnText = 'Back';
                            else if (title.includes('ADD_DONE'))
                                backBtnText = 'Done';

                            //Messaging button    
                            var messagingBtn = null;
                            if (kioskButtons.ADD_MESSAGING && !kioskButtons.ADD_MESSAGING.scenesToExclude.includes(Knack.router.current_scene_key)) {
                                var messagingBtn = document.getElementById(kioskButtons.ADD_MESSAGING.id);
                                if (messagingBtn === null) {
                                    messagingBtn = document.createElement('BUTTON');
                                    messagingBtn.classList.add('kn-button', 'kiosk-btn');
                                    messagingBtn.id = kioskButtons.ADD_MESSAGING.id;
                                    messagingBtn.innerHTML = kioskButtons.ADD_MESSAGING.html;

                                    messagingBtn.addEventListener('click', function (e) {
                                        e.preventDefault(); //Required otherwise calls Submit.
                                        window.location.href = kioskButtons.ADD_MESSAGING.href;
                                        ktl.storage.lsRemoveItem(ktl.const.LS_SYSOP_MSG_UNREAD);
                                    });
                                }
                            }

                            //Refresh button
                            var refreshBtn = document.getElementById(kioskButtons.ADD_REFRESH.id);
                            if (kioskButtons.ADD_REFRESH && !refreshBtn) {
                                refreshBtn = document.createElement('BUTTON');
                                refreshBtn.classList.add('kn-button', 'kiosk-btn');

                                refreshBtn.id = kioskButtons.ADD_REFRESH.id;
                                refreshBtn.innerHTML = kioskButtons.ADD_REFRESH.html;

                                refreshBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    kioskButtons.ADD_REFRESH.href();
                                });
                            }

                            //Back button
                            var backBtn = document.getElementById(kioskButtons.ADD_BACK.id);
                            if (backBtnText && !backBtn) {
                                backBtn = document.createElement('BUTTON');
                                backBtn.classList.add('kn-button', 'kiosk-btn');
                                var backOrDone = backBtnText === 'Back' ? 'ADD_BACK' : 'ADD_DONE';
                                backBtn.id = kioskButtons[backOrDone].id;
                                backBtn.innerHTML = kioskButtons[backOrDone].html;

                                backBtn.addEventListener('click', function (e) {
                                    e.preventDefault();

                                    //Exceptions, where we want to jump to a specific URL.
                                    var href = $('#' + kioskButtons[backOrDone].id).attr('href');
                                    if (href)
                                        window.location.href = window.location.href.slice(0, window.location.href.indexOf('#') + 1) + href;
                                    else
                                        kioskButtons[backOrDone].href();
                                });
                            }

                            //Find the Submit bar with the buttons (ADD_BACK or ADD_DONE) or Header 2 if none.
                            var submitBar = document.querySelector('#' + viewId + ' .kn-submit');
                            if (!submitBar) {
                                submitBar = document.querySelector('#' + viewId + ' .view-header'); //Happens with pages without a Submit button.  Ex: When you only have a table.
                                if (!submitBar) {
                                    //alert('ERROR - View Header is null'); //This since it should never happen.
                                    ktl.log.clog('purple', 'ERROR - View Header is null');
                                    return;
                                } else {
                                    $('.view-header').css('display', 'inline-flex'); //Prevent Refresh button from being too low due to Block display style.
                                }
                            } else {
                                //Add shift Button right next to Submit.
                                var shiftBtn = kioskButtons.ADD_SHIFT && document.getElementById(kioskButtons.ADD_SHIFT.id);
                                if (kioskButtons.ADD_SHIFT && !shiftBtn && !kioskButtons.ADD_SHIFT.scenesToExclude.includes(Knack.router.current_scene_key)) {
                                    shiftBtn = document.createElement('BUTTON');
                                    shiftBtn.classList.add('kn-button');
                                    shiftBtn.style.marginLeft = '30px';
                                    shiftBtn.id = kioskButtons.ADD_SHIFT.id;

                                    submitBar.appendChild(shiftBtn);
                                    kioskButtons.ADD_SHIFT.html(ktl.userPrefs.getUserPrefs().workShift);

                                    shiftBtn.addEventListener('click', function (e) {
                                        e.preventDefault();
                                        window.location.href = kioskButtons.ADD_SHIFT.href;
                                    });
                                }
                            }

                            var knMenuBar = document.querySelector('.kn-menu'); //Get first menu in page.
                            if (knMenuBar) {
                                var menuSel = '#' + knMenuBar.id + '.kn-menu .control';
                                ktl.core.waitSelector(menuSel, 15000)
                                    .then(function () {
                                        ktl.core.hideSelector('#' + knMenuBar.id);
                                        var menuCopy = knMenuBar.cloneNode(true);
                                        menuCopy.id += '_copy';
                                        $(extraButtonsBar).prepend($(menuCopy));
                                        ktl.core.hideSelector('#' + menuCopy.id, true);
                                        $('.kn-submit').css({ 'display': 'inline-flex', 'width': '100%' });
                                        $('.kn-menu').css({ 'display': 'inline-flex', 'margin-right': '30px' });
                                    })
                                    .catch(function () {
                                        ktl.log.clog('purple', 'menu bar not found');
                                    })
                            } else
                                $('.kn-submit').css('display', 'flex');

                            var extraButtonsBar = document.querySelector('.extraButtonsBar');
                            if (!extraButtonsBar) {
                                extraButtonsBar = document.createElement('div');
                                extraButtonsBar.setAttribute('class', 'extraButtonsBar');
                                submitBar.appendChild(extraButtonsBar);
                                $('.extraButtonsBar').css({ 'position': 'absolute', 'right': '2%' });

                                backBtn && extraButtonsBar.appendChild(backBtn);
                                refreshBtn && extraButtonsBar.appendChild(refreshBtn);
                                messagingBtn && extraButtonsBar.appendChild(messagingBtn);
                            } else {
                                backBtn && extraButtonsBar.appendChild(backBtn);
                                refreshBtn && extraButtonsBar.appendChild(refreshBtn);
                                messagingBtn && extraButtonsBar.appendChild(messagingBtn);
                            }
                        }

                        //Make all buttons same size and style.
                        if (!$.isEmptyObject(style))
                            $('.kn-button').css(style);
                        else
                            $('.kn-button').css({ 'font-size': '20px', 'background-color': '#5b748a!important', 'color': '#ffffff', 'height': '33px', 'line-height': '0px' });

                        $('.kiosk-btn').css({ 'margin-left': '20px' });

                        for (var i = 0; i < Knack.router.scene_view.model.views.length; i++) {
                            if (Knack.router.scene_view.model.views.models[i].attributes.type === 'form') {
                                $('.kn-button').css({ 'height': '40px' });
                                break;
                            }
                        }
                    }
                }
                catch (e) {
                    ktl.log.clog('purple', 'addKioskButtons exception:');
                    console.log(e);
                }
            },

            spinnerWatchdog: function (run = true) {
                if (!ktl.core.getCfg().enabled.spinnerWatchDog || spinnerWdExcludeScn.includes(Knack.router.current_scene_key))
                    return;

                if (run) {
                    //ktl.log.clog('green', 'SWD running ' + Knack.router.current_scene_key);
                    clearInterval(spinnerInterval);
                    spinnerCtr = spinnerCtrDelay;
                    spinnerInterval = setInterval(function () {
                        if ($('#kn-loading-spinner').is(':visible') ||
                            $('.kn-spinner').is(':visible') ||
                            $('.kn-button.is-primary').is(':disabled')) {
                            if (spinnerCtr-- > 0) {
                                if (spinnerCtr < spinnerCtrDelay - 5)
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

            findViewWithTitle: function (srch = '', exact = false) {
                var views = Knack.router.scene_view.model.views.models;
                var title = '';
                var viewId = '';
                srch = srch.toLowerCase();
                try {
                    for (var i = 0; i < views.length; i++) {
                        viewId = views[i].attributes.key;
                        title = views[i].attributes.title.toLowerCase();
                        if (exact && title === srch) return viewId;
                        if (title.includes(srch)) return viewId;
                    }
                }
                catch (e) {
                    ktl.log.clog('purple', 'Exception in findViewWithTitle:');
                    console.log(e);
                }
                return '';
            },

            scrollToTop: function () {
                document.body.scrollTop = 0; // For Safari
                document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
            },

            addVersionNumber: function (info, style = '') {
                if (!ktl.core.getCfg().enabled.showAppInfo || window.self.frameElement) return;

                //By default, version numbers are added at top right of screen
                if ($('#verButtonId').length === 0) {
                    var ktlVer = ktl.core.getCfg().enabled.showKtlInfo ? '    KTL v' + KTL_VERSION : '';
                    var appName = Knack.app.attributes.name.toUpperCase();
                    var versionInfo = appName + '    v' + APP_VERSION + ktlVer + '    ' + info.hostname;


                    var versionStyle = 'white-space: pre; margin-left: 10px; font-size:small; position:absolute; top:5px; right:10px; background-color:transparent; border-style:none';
                    if (localStorage.getItem(Knack.app.attributes.name + '_dev') === null) { //TODO: lsGetItem - fix and allow returing null if key doesn't exist.
                        if (style) //If style already exist, use it as is.
                            versionStyle = style;
                        else //Otherwise, use KTL's default.
                            versionStyle += '; color:darkslategray'; //Make this color configuratble or automatic based on theme.
                    } else //Dev mode, make version bright yellow/red font.
                        versionStyle += '; background-color:gold; color:red; font-weight: bold';

                    ktl.fields.addButton(document.body, versionInfo, versionStyle, [], 'verButtonId');
                    $('#verButtonId').on('click touchstart', function (e) {
                        if (ktl.account.isDeveloper()) {
                            e.preventDefault();
                            var ver = prompt('Which version to run, "prod" or "dev"?', 'prod');
                            if (ver === 'prod' || ver === 'dev')
                                ktl.core.switchVersion(ver);
                        }
                    })

                    //Add extra space at top of screen in kiosk mode, to prevent conflict with menus or other objects.
                    if (ktl.core.isKiosk() && !ktl.scenes.isiFrameWnd())
                        $('body').css({ 'padding-top': '15px' });
                }
            },

            isiFrameWnd: function () {
                return (window.self.frameElement && (window.self.frameElement.id === IFRAME_WND_ID)) ? true : false;
            },
        }
    })(); //Scenes

    //====================================================
    //Logging feature
    this.log = (function () {
        var lastDetails = ''; //Prevent multiple duplicated logs.  //TODO: replace by a list of last 10 logs and a timestamp
        var mouseClickCtr = 0;
        var keyPressCtr = 0;
        var isActive = false; //Start monitoring activity only once.
        var logCategoryAllowed = null; //Callback function in your app that returns whether or not a category is to be logged, based on specific conditions.

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (logCategoryAllowed && logCategoryAllowed(ktl.const.LS_ACTIVITY) && !mouseClickCtr && !keyPressCtr)
                monitorActivity();
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

                if ((category === ktl.const.LS_LOGIN && !ktl.core.getCfg().enabled.logging.logins) ||
                    (category === ktl.const.LS_ACTIVITY && !ktl.core.getCfg().enabled.logging.activity) ||
                    (category === ktl.const.LS_NAVIGATION && !ktl.core.getCfg().enabled.logging.navigation))
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
                    var categoryLogs = ktl.storage.lsGetItem(category + Knack.getUserAttributes().id);
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

                    ktl.storage.lsSetItem(category + Knack.getUserAttributes().id, JSON.stringify(logObj));

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
                    ktl.storage.lsRemoveItem(category + Knack.getUserAttributes().id);
                }
            },

            //For KTL internal use.  Returns the oldest log's date/time from array.  Resolution is 1 minute.
            getLogArrayAge: function (category = '') {
                if (category === '') return null;

                try {
                    var logArray = [];
                    var categoryLogs = ktl.storage.lsGetItem(category + Knack.getUserAttributes().id);
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
                    ktl.storage.lsRemoveItem(category + Knack.getUserAttributes().id);
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
                    var categoryLogs = ktl.storage.lsGetItem(category + Knack.getUserAttributes().id);
                    if (categoryLogs) {
                        try {
                            var logObj = JSON.parse(categoryLogs);
                            if (logObj.logId && logObj.logId === logId) {
                                //console.log('Deleting found logId =', logId, 'cat=', category);
                                ktl.storage.lsRemoveItem(category + Knack.getUserAttributes().id);
                            }
                        }
                        catch (e) {
                            ktl.log.addLog(ktl.const.LS_INFO, 'removeLogById, deleted log having obsolete format: ' + category + ', ' + e);
                            ktl.storage.lsRemoveItem(category + Knack.getUserAttributes().id);
                        }
                    }
                })
            },

            updateActivity: function () {
                if (!ktl.core.getCfg().enabled.logging.activity) return;

                //Important to read again every 5 seconds in case some other opened pages would add to shared counters.
                var categoryLogs = ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id);
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
                    ktl.storage.lsRemoveItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id);
                }
            },

            //TODO: add getCategoryLogs.  Returns object with array and logId.
        }
    })();

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
                var lsPrefsStr = ktl.storage.lsGetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id);
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
                                .then(success => { location.reload(true); })
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

                                ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id, prefsStr);
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
                    var acctPrefsFld = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
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
                        document.querySelector('#' + acctPrefsFld).value = JSON.stringify(userPrefsTmp);
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
                for (var viewId in Knack.views)
                    Knack.views[viewId] && (ktl.views.addViewId(Knack.views[viewId].model.view));

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

        //Handle log-in/out events.
        $(document).on('click', function (e) {
            if (e.target.value === 'Sign In' && e.target.type === 'submit') {
                var sel = $('.kn-login-form > form > input');
                if (sel && sel.length > 0) {
                    postLoginEvent()
                        .then(function (result) {
                            var menuInfo = ktl.core.getMenuInfo();
                            if (result === LOGIN_SUCCESSFUL) {
                                result = JSON.stringify({ result: result, APP_KTL_VERSIONS: APP_KTL_VERSIONS, page: menuInfo, agent: navigator.userAgent });

                                ktl.userFilters.loadAllFilters();
                                ktl.storage.lsRemoveItem('PAUSE_SERVER_ERROR_LOGS');
                                ktl.log.addLog(ktl.const.LS_LOGIN, result);

                                if (localStorage.length > 500)
                                    ktl.log.addLog(ktl.const.LS_WRN, 'KEC_1019 - Local Storage size: ' + localStorage.length);

                                ktl.iFrameWnd.create();
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

        function postLoginEvent() {
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

        return {
            isDeveloper: function () {
                return Knack.getUserRoleNames().includes('Developer');
            },
            isLoggedIn: function () {
                return Knack.getUserAttributes() !== 'No user found';
            },
        }
    })();

    //====================================================
    //iFrameWnd feature
    this.iFrameWnd = (function () {
        var iFrameWnd = null; //The actual object
        var iFrameTimeout = null;
        var highPriLoggingInterval = null;
        var lowPriLoggingInterval = null;

        var accountsObj = ktl.core.getObjectIdByName('Accounts');
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
            acctTimeZoneFld: ktl.core.getFieldIdByName('Time Zone', accountsObj),
            acctLocHbFld: ktl.core.getFieldIdByName('LOC HB', accountsObj),
            acctOnlineFld: ktl.core.getFieldIdByName('Online', accountsObj),
            acctUserPrefsFld: ktl.core.getFieldIdByName('User Prefs', accountsObj),
            acctUtcLastActFld: ktl.core.getFieldIdByName('UTC Last Activity', accountsObj),

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

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (ktl.scenes.isiFrameWnd()) {
                var intervalId = setInterval(function () { //Wait until ready HB field is ready.
                    if (ktl.iFrameWnd.getCfg().hbViewId !== '') {
                        clearInterval(intervalId);
                        clearTimeout(timeout);
                        ktl.wndMsg.send('iFrameWndReadyMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, APP_KTL_VERSIONS);
                        startHighPriorityLogging();
                        startLowPriorityLogging();
                    }
                }, 200);

                var timeout = setTimeout(function () { //Failsafe
                    clearInterval(intervalId);
                    ktl.log.clog('purple', 'iFrameWndReadyMsg timeout');
                }, 30000);
            }
        })

        //Logs cleanup and processing of email action.
        $(document).on('knack-view-render.any', function (event, view, data) {
            if (view.key === cfg.acctLogsViewId) {
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
                                //console.log('Email sent, re-starting autorefresh and logging loop');
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

                    var lastUfStr = ktl.storage.lsGetItem(LS_UF + Knack.getUserAttributes().id);
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
                        if (Knack.getUserAttributes().name === ktl.core.getCfg().developerName)
                            ktl.wndMsg.send('swVersionsDifferentMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP);
                        else {
                            console.log('sending reloadAppMsg with ver:', newSWVersion);
                            ktl.wndMsg.send('reloadAppMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { reason: 'SW_UPDATE', version: newSWVersion });
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
                    var newPublicFilters = rec[cfg.appSettingsValueFld];
                    try {
                        var cloudPfDt = '';
                        var pubFiltersNeedDownload = false;
                        var pubFiltersNeedUpload = false;
                        if (newPublicFilters && newPublicFilters.length > 1) {
                            newPublicFilters = JSON.parse(newPublicFilters);
                            if ($.isEmptyObject(newPublicFilters)) return;
                            cloudPfDt = newPublicFilters.dt;
                        }

                        var lastPfStr = ktl.storage.lsGetItem(LS_UFP + Knack.getUserAttributes().id);
                        if (lastPfStr) {
                            try {
                                var lastPfTempObj = JSON.parse(lastPfStr);
                                if (!$.isEmptyObject(lastPfTempObj)) {
                                    var localPfDt = lastPfTempObj.dt;
                                    //console.log('localPfDt =', localPfDt);
                                    //console.log('cloudPfDt =', cloudPfDt);
                                    if (ktl.core.isMoreRecent(cloudPfDt, localPfDt))
                                        pubFiltersNeedDownload = true;
                                    else if (!cloudPfDt || ktl.core.isMoreRecent(localPfDt, cloudPfDt)) {
                                        pubFiltersNeedUpload = true;
                                    }
                                }
                            } catch (e) {
                                alert('Read Public Filters - Error Found Parsing Filters:', e);
                            }
                        } else
                            pubFiltersNeedDownload = true;

                        if (pubFiltersNeedDownload)
                            ktl.wndMsg.send('publicFiltersNeedDownloadMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, { newPublicFilters: newPublicFilters });
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

                    var categoryLogs = ktl.storage.lsGetItem(el.type + Knack.getUserAttributes().id);
                    if (categoryLogs) {
                        try {
                            var logObj = JSON.parse(categoryLogs);
                            var details = JSON.stringify(logObj.logs);
                            if (details) {
                                if (!logObj.sent) {
                                    logObj.sent = true; //Do not send twice, when many opened windows.
                                    ktl.storage.lsSetItem(el.type + Knack.getUserAttributes().id, JSON.stringify(logObj));

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
                                                ktl.storage.lsSetItem(el.type + Knack.getUserAttributes().id, JSON.stringify(logObj));
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
                            ktl.storage.lsRemoveItem(category + Knack.getUserAttributes().id);
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
                            var categoryLogs = ktl.storage.lsGetItem(el.type + Knack.getUserAttributes().id);
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
                                                ktl.storage.lsSetItem(el.type + Knack.getUserAttributes().id, JSON.stringify(logObj));

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
                                                            ktl.storage.lsSetItem(el.type + Knack.getUserAttributes().id, JSON.stringify(logObj));
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
                                    ktl.storage.lsRemoveItem(category + Knack.getUserAttributes().id);
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

                //Create invisible iFrame logging object.
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

            showIFrame: function (show = false) {
                if (!iFrameWnd)
                    return;

                if (show) {
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
    })();

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
                            ktl.wndMsg.startHeartbeat();

                            //Delete iFrameWnd and re-create periodically.  This is to check for a SW update.
                            setTimeout(function () {
                                //ktl.log.clog('purple', 'Reloading frame);
                                if (ktl.iFrameWnd.getiFrameWnd()) {
                                    ktl.iFrameWnd.delete();
                                    ktl.iFrameWnd.create();
                                }
                            }, FIVE_MINUTES_DELAY);
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
                            if (window.self.frameElement && (event.data.dst === IFRAME_WND_ID)) { //App to iFrameWnd, when prefs are changed locally by user.
                                //Upload new prefs so other opened browsers can see the changes.
                                var fieldId = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
                                var formId = ktl.iFrameWnd.getCfg().updUserPrefsViewId;
                                if (!formId || !fieldId) return;

                                $(document).off('knack-form-submit.' + formId); //Prevent multiple re-entry.
                                document.querySelector('#' + fieldId).value = event.data.msgData;
                                document.querySelector('#' + formId + ' .kn-button.is-primary').click();
                                ktl.log.clog('green', 'Uploading prefs to cloud');

                                //Wait until Submit is completed and ack parent
                                $(document).on('knack-form-submit.' + formId, function (event, view, record) {
                                    ktl.wndMsg.send(event.data.msgType, 'ack', IFRAME_WND_ID, ktl.const.MSG_APP, msgId);
                                    ktl.views.refreshView(ktl.iFrameWnd.getCfg().curUserPrefsViewId);
                                });
                            } else { //iFrameWnd to App, when prefs changed remotely, by user or Sysop.
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

                if (ktl.scenes.isiFrameWnd()) { //If an error id detect in the iFrameWnd, redirect it to the app for processing, since all desicions are taken there.
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

                if ([401, 500].includes(msg.status)) {
                    if (msg.status == 401) {
                        if (typeof Android === 'object') {
                            if (confirm('A reboot is needed, do you want to do it now?'))
                                Android.restartApplication();
                        } else {
                            ktl.core.timedPopup('Your log-in has expired. Please log back in to continue.', 'warning', 4000);
                            $('.kn-log-out').trigger('click'); //Login has expired, force logout.
                        }
                    } else if (msg.status == 500) {
                        ktl.core.timedPopup('Error 500 has occurred - reloading page...', 'warning');
                        ktl.core.waitAndReload(2000);
                        //TODO: 1-Add stats counter here   2-Reboot after 3+ times in 3 minutes if Android.
                    } else {
                        //Future errors here.
                    }
                }

                //Now give control to app's callback for further processing if needed.
                processServerErrors && processServerErrors(msg);
            },
        }
    })();

    //====================================================
    //Bulk Operations feature
    //Need to create a role called 'Bulk Edit' and assign it to 'trusty' users who will not wreak havoc.
    //For super users, a role named 'Bulk Delete' can be created to delete records in batches.
    this.bulkOps = (function () {
        var bulkOpsRecIdArray = [];
        var bulkOpsFieldId = null;
        var bulkOpsNewValue = null;
        var bulkOpsViewId = null;
        var bulkOpsInProgress = false; //Needed to prevent re-entering because pressing Enter on Sumbit causes two Click events.
        var bulkOpsDeleteAll = false;

        $(document).on('knack-view-render.table', function (event, view, data) {
            if (ktl.scenes.isiFrameWnd() || (!ktl.core.getCfg().enabled.bulkOps.bulkEdit && !ktl.core.getCfg().enabled.bulkOps.bulkDelete))
                return;

            var viewModel = Knack.router.scene_view.model.views._byId[view.key];
            if (viewModel) {
                var viewAttr = viewModel.attributes;
                var inlineEditing = viewAttr.options ? viewAttr.options.cell_editor : false;
                var canDelete = document.querySelector('#' + view.key + ' .kn-link-delete');
                if ((canDelete && Knack.getUserRoleNames().includes('Bulk Delete')) || (inlineEditing && Knack.getUserRoleNames().includes('Bulk Edit'))) {
                    enableBulkOperations(view, data);
                    if (bulkOpsInProgress)
                        processBulkOps();
                }
            }
        })

        $(document).on('click', function (e) {
            //On every click event, we process Inline Submit and Checkbox clicks.
            //Prepare all we need for Bulk Operations. Take note of view, field and new value.

            //Did we click on Submit during inline editing?
            var submit = $(e.target).closest('#cell-editor .kn-button');
            if (submit.length > 0 && !bulkOpsInProgress && bulkOpsRecIdArray.length > 0) {
                bulkOpsInProgress = true;
                bulkOpsFieldId = $('#cell-editor .kn-input').attr('data-input-id');

                //Uncomment to find new unknown types: 
                //console.log('Field type =', Knack.objects.getField(bulkOpsFieldId).attributes.type);

                bulkOpsNewValue = $('#cell-editor .chzn-select.select.chzn-done').val()
                    || $('#cell-editor .kn-input #' + bulkOpsFieldId).val()
                    || $('#cell-editor .knack-date.input.control.hasDatepicker').val()
                    || $('#cell-editor .kn-radio input[type=radio]:checked').val()
                    || $('#cell-editor .kn-input-multiple_choice .kn-select .select').val()
                    || $('#cell-editor .kn-input-boolean input[type=checkbox]').is(':checked');
                var time = $('#cell-editor .kn-time.input.control.ui-timepicker-input').val();
                if (time)
                    bulkOpsNewValue += ' ' + time;
            } else if (e.target.getAttribute('type') === 'checkbox') {
                //If check boxes spread across more than one view, discard all and start again in latest view.
                var thisView = e.target.closest('.kn-table.kn-view');
                if (thisView) {
                    var viewId = thisView.getAttribute('id');
                    if (e.target.closest('td')) //If click in td row, uncheck master checkbox in th.
                        $('.' + viewId + '.kn-table thead tr input[type=checkbox]').prop('checked', false);

                    if (bulkOpsViewId !== viewId) {
                        if (bulkOpsViewId !== null) { //Uncheck all currently checked in old view.
                            $('.' + bulkOpsViewId + '.kn-table thead tr input[type=checkbox]').prop('checked', false);
                            $('.' + bulkOpsViewId + '.kn-table tbody tr input[type=checkbox]').each(function () {
                                $(this).prop('checked', false);
                            });

                            updateDeleteButtonStatus(bulkOpsViewId, 0);
                        }

                        bulkOpsViewId = viewId;
                    }

                    updateBulkOpCheckboxes();
                }
            }
        })

        //The entry point of the feature, where Bulk Ops is enabled per view, depending on account role permission.
        //Called upon each view rendering.
        function enableBulkOperations(view, data) {
            var canDelete = document.querySelector('#' + view.key + ' .kn-link-delete');

            ktl.views.addCheckboxesToTable(view.key, masterCheckBoxCallback);

            if (canDelete && ktl.core.getCfg().enabled.bulkOps.bulkDelete && Knack.getUserRoleNames().includes('Bulk Delete'))
                addBulkDeleteButtons(view, data);

            function masterCheckBoxCallback(numChecked) {
                canDelete && updateDeleteButtonStatus(view.key, numChecked);
                updateBulkOpCheckboxes();
            }

            //Put back checkboxes that were checked before view refresh.
            if (view.key === bulkOpsViewId) {
                var arrayLen = bulkOpsRecIdArray.length;
                if (arrayLen > 0) {
                    for (var i = bulkOpsRecIdArray.length - 1; i >= 0; i--) {
                        var sel = $('#' + view.key + ' tr[id="' + bulkOpsRecIdArray[i] + '"]');
                        if (sel.length > 0) {
                            $('#' + view.key + ' tr[id="' + bulkOpsRecIdArray[i] + '"] > td:nth-child(1) > input[type=checkbox]').prop('checked', true);
                        }
                    }
                }
            }
        }

        //Called to refresh the record array to be modified.
        //Can be changed by user clicks, table filtering change, view refresh.
        function updateBulkOpCheckboxes() {
            bulkOpsRecIdArray = [];
            $('#' + bulkOpsViewId + ' tbody input[type=checkbox]:checked').each(function () {
                var id = $(this).closest('tr').attr('id');
                bulkOpsRecIdArray.push(id);
            });

            if (bulkOpsRecIdArray.length > 0)
                ktl.views.autoRefresh(false);
            else
                ktl.views.autoRefresh();

            updateDeleteButtonStatus(bulkOpsViewId, bulkOpsRecIdArray.length);
        }

        //Called when user clicks on Submit from an Inline Editing form and when there are some checkboxes enabled.
        function processBulkOps() {
            var object = Knack.router.scene_view.model.views._byId[bulkOpsViewId].attributes.source.object;
            var objName = Knack.objects._byId[object].attributes.name;  //Create function getObjNameForView

            if (bulkOpsInProgress && confirm('Are you sure you want to apply this value to all selected items?')) {
                bulkOpsInProgress = false;
                var apiData = {};

                var fieldAttr = Knack.objects.getField(bulkOpsFieldId).attributes;
                if (fieldAttr.type === 'connection')
                    apiData[bulkOpsFieldId] = [bulkOpsNewValue];
                else
                    apiData[bulkOpsFieldId] = bulkOpsNewValue;

                ktl.core.infoPopup();
                ktl.views.autoRefresh(false);
                ktl.scenes.spinnerWatchdog(false);

                var arrayLen = bulkOpsRecIdArray.length;
                (function updateRecord(recIdArray) {
                    var recId = recIdArray[0];
                    ktl.core.setInfoPopupText('Updating ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + recIdArray.length);
                    ktl.core.knAPI(bulkOpsViewId, recId, apiData, 'PUT')
                        .then(function () {
                            //console.log('updated recId =', recId);
                            recIdArray.shift();
                            if (recIdArray.length === 0) {
                                Knack.showSpinner();
                                ktl.core.removeInfoPopup();
                                ktl.views.refreshView(bulkOpsViewId).then(function () {
                                    ktl.core.removeTimedPopup(); //Remove residual SWD pop up.

                                    ktl.scenes.spinnerWatchdog();
                                    setTimeout(function () {
                                        ktl.views.autoRefresh();
                                        Knack.hideSpinner();
                                        alert('Bulk operation completed successfully');
                                    }, 1000);
                                })
                            } else {
                                updateRecord(recIdArray);
                            }
                        })
                        .catch(function (reason) {
                            alert('Error code KEC_1017 while processing bulk operations, reason: ' + JSON.stringify(reason));
                            ktl.core.removeInfoPopup();
                            ktl.views.autoRefresh();
                            ktl.scenes.spinnerWatchdog();
                        })
                })(bulkOpsRecIdArray);
            } else
                bulkOpsInProgress = false;
        }

        function addBulkDeleteButtons(view, data, div = null) {
            if (!ktl.core.getCfg().enabled.bulkOps.bulkDelete || !data.length || ktl.scenes.isiFrameWnd())
                return;

            var prepend = false;
            if (!div) { //If no div is supplied, try other options.
                div = document.querySelector('#' + view.key + ' .table-keyword-search') || document.querySelector('#' + view.key + ' .view-header');
                if (!div) {
                    div = document.querySelector('#' + view.key);
                    if (!div) return; //TODO: Support other layout options as we go.
                    prepend = true;
                }
            }

            //Add Delete Selected button.
            if (!document.querySelector('#kn-button-delete-selected-' + view.key)) {
                var deleteRecordsBtn = document.createElement('BUTTON');
                deleteRecordsBtn.setAttribute('class', 'kn-button');
                deleteRecordsBtn.id = 'kn-button-delete-selected-' + view.key;
                deleteRecordsBtn.innerHTML = 'Delete Selected';
                prepend ? (deleteRecordsBtn.style.marginBottom = '10px') : (deleteRecordsBtn.style.marginInlineStart = '30px');
                deleteRecordsBtn.setAttribute('type', 'button'); //Needed to prevent copying when pressing Enter in search field.
                deleteRecordsBtn.disabled = true;
                prepend ? $(div).prepend(deleteRecordsBtn) : $(div).append(deleteRecordsBtn);

                deleteRecordsBtn.addEventListener('click', function (event) {
                    var deleteArray = [];
                    $('#' + view.key + ' tbody input[type=checkbox]:checked').each(function () {
                        if (!$(this).closest('.kn-table-totals').length) {
                            deleteArray.push($(this).closest('tr').attr('id'));
                        }
                    });

                    ktl.scenes.spinnerWatchdog(false);
                    ktl.bulkOps.deleteRecords(deleteArray, view)
                        .then(function () {
                            ktl.scenes.spinnerWatchdog();
                            jQuery.blockUI({
                                message: '',
                                overlayCSS: {
                                    backgroundColor: '#ddd',
                                    opacity: 0.2,
                                    //cursor: 'wait'
                                },
                            })

                            //The next two timeouts are needed to allow enough time for table to update itself, otherwise, we don't get updated results.
                            setTimeout(function () {
                                ktl.views.refreshView(view.key).then(function (model) {
                                    setTimeout(function () {
                                        jQuery.unblockUI();
                                        if (bulkOpsDeleteAll) {
                                            if (model && model.length > 0) {
                                                $('#kn-button-delete-all-' + view.key).click();
                                            } else {
                                                bulkOpsDeleteAll = false;
                                                alert('Delete All has completed successfully');
                                            }
                                        } else
                                            alert('Deleted Selected has completed successfully');
                                    }, 2000);
                                });
                            }, 2000);
                        })
                        .catch(function (response) {
                            jQuery.unblockUI();
                            ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1024 - Bulk Delete failed, reason: ' + response);
                            alert('Failed deleting record.\n' + response);
                        })
                });
            }

            //Delete All button for massive delete operations, with automated looping over all pages automatically.
            //Only possible when filtering is used.
            var filter = $('#' + view.key + '_filters > ul > li');
            if (filter.length > 0) {
                if ($('#kn-button-delete-all-' + view.key).length === 0) {
                    var deleteAllRecordsBtn = document.createElement('BUTTON');
                    deleteAllRecordsBtn.setAttribute('class', 'kn-button');
                    deleteAllRecordsBtn.id = 'kn-button-delete-all-' + view.key;
                    deleteAllRecordsBtn.innerHTML = 'Delete All';
                    deleteAllRecordsBtn.style.marginLeft = '5%';
                    deleteAllRecordsBtn.setAttribute('type', 'button'); //Needed to prevent copying when pressing Enter in search field.
                    if (data.length > 0)
                        deleteAllRecordsBtn.disabled = false;
                    else
                        deleteAllRecordsBtn.disabled = true;

                    div.appendChild(deleteAllRecordsBtn);

                    deleteAllRecordsBtn.addEventListener('click', function (event) {
                        var allChk = $('#' + view.key + ' > div.kn-table-wrapper > table > thead > tr > th:nth-child(1) > input[type=checkbox]');
                        if (allChk.length > 0) {
                            if (data.length > 0) {
                                if (!bulkOpsDeleteAll) { //First time, kick start process.
                                    //Get total number of records to delete.  Either get it from summary, or from data length when summary not shown (less than ~7 records).
                                    var totalLogs = $('#' + view.key + ' .kn-entries-summary').last();
                                    if (totalLogs.length > 0)
                                        totalLogs = totalLogs.html().substring(totalLogs.html().lastIndexOf('of</span> ') + 10).replace(/\s/g, '');
                                    else
                                        totalLogs = data.length;

                                    if (confirm('Are you sure you want to delete all ' + totalLogs + ' logs?\nNote:  you can abort the process at any time by pressing F5.'))
                                        bulkOpsDeleteAll = true;
                                    //Note that pressing Escape on keyboard to exit the "confim" dialog causes a loss of focus.  Search stops working since you can't type in text.
                                    //You must click Delete All again and click Cancel with the mouse to restore to normal behavior!  Weird...
                                }

                                if (bulkOpsDeleteAll) {
                                    allChk[0].click();
                                    setTimeout(function () {
                                        $('#kn-button-delete-selected-' + view.key).click();
                                    }, 500);
                                }
                            } else { //For good luck - should never happen since button is disabled when no data.
                                bulkOpsDeleteAll = false;
                                console.log('DELETE ALL MODE - No data to delete');
                            }
                        }
                    });
                }
            }

            $('#' + view.key + ' input[type=checkbox]').on('click', function (e) {
                var numChecked = $('#' + view.key + ' tbody input[type=checkbox]:checked').length;

                //If Delete All was used, just keep going!
                if (numChecked && bulkOpsDeleteAll)
                    $('#kn-button-delete-selected-' + view.key).click();
            });
        }

        function updateDeleteButtonStatus(viewId = '', numChecked) {
            var deleteRecordsBtn = document.querySelector('#kn-button-delete-selected-' + viewId);
            deleteRecordsBtn && (deleteRecordsBtn.disabled = !numChecked);
            ktl.views.autoRefresh(!numChecked); //If a checkbox is clicked, pause auto-refresh otherwise user will lose all selections.
        }

        return {
            //View param is view object, not view.key.  deleteArray is an array of record IDs.
            deleteRecords: function (deleteArray, view) {
                return new Promise(function (resolve, reject) {
                    var arrayLen = deleteArray.length;
                    if (arrayLen === 0)
                        reject('Called deleteRecords with empty array.');

                    var objName = Knack.objects._byId[Knack.views[view.key].model.view.source.object].attributes.name; //Get object's name.  TODO:  put in a function getObjNameForView

                    ktl.core.infoPopup();
                    (function deleteRecord(recIdArray) {
                        var id = recIdArray[0];
                        ktl.core.setInfoPopupText('Deleting ' + arrayLen + ' ' + objName + ((arrayLen > 1 && objName.slice(-1) !== 's') ? 's' : '') + '.    Records left: ' + recIdArray.length);

                        ktl.core.knAPI(view.key, id, {}, 'DELETE')
                            .then(function () {
                                recIdArray.shift();
                                if (recIdArray.length === 0) {
                                    ktl.core.removeInfoPopup();
                                    resolve();
                                } else {
                                    deleteRecord(recIdArray);
                                }
                            })
                            .catch(function (reason) {
                                ktl.core.removeInfoPopup();
                                reject('deleteRecords - Failed to delete record ' + id + ', reason: ' + JSON.stringify(reason));
                            })
                    })(deleteArray);
                })
            },
        }
    })();

    //====================================================
    //System Info feature
    this.sysInfo = (function () {
        var sInfo = {
            os: 'Unknown',
            browser: 'Unknown',
            ip: 'Unknown',
            model: 'Unknown',
            processor: 'Unknown',
            mobile: ''
        };

        var cfg = {
            appBcstSWUpdateViewId: ktl.core.getViewIdByTitle('BROADCAST_SW_UPDATE', Knack.router.current_scene_key, true),
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

            sInfo.browser = (isEdgeChromium || isChrome) + isOpera + isFirefox + isEdge + isIE + isSafari;

            // Engine type detection - Blink or Unknown
            var engineType = ((isChrome || isOpera) && !!window.CSS) ? 'Blink' : 'Unknown';
            sInfo.engine = engineType;

            if (navigator.userAgent.indexOf('Android') >= 0)
                sInfo.os = 'Android';
            else if (navigator.userAgent.indexOf('Windows') >= 0)
                sInfo.os = 'Windows';
            else if (navigator.userAgent.indexOf('Linux') >= 0)
                sInfo.os = 'Linux';
            else if (navigator.userAgent.indexOf('Mac OS') >= 0)
                sInfo.os = 'Mac OS';

            if (navigator.userAgent.indexOf('T2lite') >= 0)
                sInfo.model = 'T2Lite';
            else if (navigator.userAgent.indexOf('D1-G') >= 0)
                sInfo.model = 'D1-G';

            if (navigator.userAgent.indexOf('x64') >= 0)
                sInfo.processor = 'x64';
            else if (navigator.userAgent.indexOf('armv7') >= 0)
                sInfo.processor = 'armv7';
            else if (navigator.userAgent.indexOf('x86') >= 0)
                sInfo.processor = 'x86';

            sInfo.mobile = Knack.isMobile().toString();

            getPublicIP()
                .then((ip) => { sInfo.ip = ip; })
                .catch(() => { console.log('getPublicIP failed.  Make sure uBlock not active.'); })
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

        return {
            getSysInfo: function () {
                return sInfo;
            },
        }
    })(); //sysInfo

    return { //KTL exposed objects
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
        userPrefs: this.userPrefs,
        iFrameWnd: this.iFrameWnd,
        debugWnd: this.debugWnd,
        log: this.log,
        wndMsg: this.wndMsg,
        sysInfo: this.sysInfo,
        systemColors: this.systemColors,
    };
};

////////////////  End of KTL /////////////////////

