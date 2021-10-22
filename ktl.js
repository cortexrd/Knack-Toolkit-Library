/**
 * Knack Toolkit Library (ktl) - Javascript
 * @author  Normand Defayette <nd@ctrnd.com>
 * @license GPLv3
 */

//Find a better place for these universal values.
const APP_ROOT_NAME = Knack.app.attributes.name + '_';
const TEN_SECONDS_DELAY = 10000;
const ONE_MINUTE_DELAY = 60000;
const FIVE_MINUTES_DELAY = ONE_MINUTE_DELAY * 5;
const ONE_HOUR_DELAY = ONE_MINUTE_DELAY * 60;
const IFRAME_WND_ID = 'iFrameWnd';

function Ktl($) {
    const KTL_VERSION = '0.1.0';
    const SW_VERSION = window.SW_VERSION;

    var ktl = this;

    //KEC stands for "KTL Event Code".  Next:  KEC_1019

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
        LS_INFO: 'INF_', //TODO, not yet implemented.
        LS_DEBUG: 'DBG_',
        LS_WRN: 'WRN_',
        LS_APP_ERROR: 'APP_ERR_',
        LS_SERVER_ERROR: 'SVR_ERR_',
        LS_CRITICAL: 'CRI_',

        LS_LOGIN_STR: 'Login',
        LS_ACTIVITY_STR: 'Activity',
        LS_NAVIGATION_STR: 'Navigation',
        LS_INFO_STR: 'Info',
        LS_DEBUG_STR: 'Debug',
        LS_WRN_STR: 'Warning',
        LS_APP_ERROR_STR: 'App Error',
        LS_SERVER_ERROR_STR: 'Server Error',
        LS_CRITICAL_STR: 'Critical',

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
        var cfg = {
            developerName: '',
            showAppInfo: false,
            showKtlInfo: false,
            showMenuInTitle: false,
            enabled: { //Main KTL feature switches.  By default, all is disabled and your App enables what is desired in ktl.core.setCfg.
                selTextOnFocus: false,
                autoFocus: false,
                userFilters: false,
                persistentForm: false,
                debugWnd: false,
                iFrameWnd: false,
                idleWatchDog: false,
                spinnerWatchDog: false,
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
                cfgObj.showAppInfo && (cfg.showAppInfo = cfgObj.showAppInfo);
                cfgObj.showKtlInfo && (cfg.showKtlInfo = cfgObj.showKtlInfo);
                cfgObj.showMenuInTitle && (cfg.showMenuInTitle = cfgObj.showMenuInTitle);
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
                            sceneKey = Knack.router.scene_view.model.views._byId[viewId]
                        else {
                            clearInterval(intervalId);
                            intervalId = null;
                            clearTimeout(failsafeTimeout);

                            sceneKey = sceneKey.attributes.scene.key;
                            var apiURL = 'https://api.knack.com/v1/pages/' + sceneKey + '/views/' + viewId + '/records/';

                            if (recId)
                                apiURL += recId;

                            //@@@ TODO:  support GET requests with filter.
                            //if (requestType === 'GET') {
                            //    var filters = {
                            //        'match': 'or',
                            //        'rules': [
                            //            {
                            //                'field': 'field_xx',
                            //                'operator': 'is',
                            //                'value': 'recordIdxxxxxxxxxxxxxxx'
                            //            }
                            //        ]
                            //    };

                            //    apiURL += '?filters=' + encodeURIComponent(JSON.stringify(filters));
                            //}


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
                                error: function (jqXHR) {
                                    //console.log('knAPI failure, retries:', this.retryLimit, 'status:', jqXHR.status, 'statusText:', jqXHR.statusText);

                                    if (this.retryLimit-- > 0) {
                                        var ajaxParams = this; //Backup 'this' otherwise this will become the Window object in the setTimeout.
                                        setTimeout(function () {
                                            $.ajax(ajaxParams);
                                        }, 500);
                                        return;
                                    } else {
                                        Knack.hideSpinner();

                                        jqXHR.caller = 'knAPI';
                                        jqXHR.viewId = viewId;

                                        //Process critical failures by forcing a logout or hard reset.
                                        if (jqXHR.status === 401 || jqXHR.status === 403 || jqXHR.status === 500) {
                                            if (window.self.frameElement)
                                                parent.postMessage({ msgType: 'forceReload', response: jqXHR }, '*');
                                            else {
                                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1002 - Forcing logout');
                                                $('.kn-log-out').trigger('click'); //Token has expired, force logout.
                                                location.reload(true);
                                            }
                                        } else {
                                            if (jqXHR.status)
                                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1003 - knAPI failure in ' + viewId + ', status: ' + jqXHR.status + ', statusText: ' + jqXHR.statusText);
                                        }

                                        reject(new Error(jqXHR.statusText));
                                    }
                                },
                            });
                        }
                    }, 100);
                })
            },

            isKiosk: function () {
                return isKiosk();
            },
            
            //Param is selector string.
            hideSelector: function (sel = '') {
                sel && $(sel).css({ 'position': 'absolute', 'left': '-9000px' });
            },

            //Param: sel is a string, not the jquery object.
            waitSelector: function (sel = '', timeout = 2000, is = '', outcome = ktl.const.WAIT_SEL_IGNORE, scanSpd = ktl.const.WAIT_SELECTOR_SCAN_SPD) {
                return new Promise(function (resolve, reject) {
                    if (selIsOk(sel)) {
                        resolve();
                        return;
                    } else {
                        var intervalId = setInterval(function () {
                            if (selIsOk(sel)) {
                                clearInterval(intervalId);
                                intervalId = null;
                                resolve();
                                return;
                            }
                        }, scanSpd);

                        setTimeout(function () { //Failsafe
                            if (intervalId) {
                                clearInterval(intervalId);
                                intervalId = null;
                                if (outcome === ktl.const.WAIT_SEL_LOG_WARN) {
                                    ktl.log.addLog(ktl.const.LS_WRN, 'kEC_1011 - waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);
                                } else if (outcome === ktl.const.WAIT_SEL_LOG_ERROR) {
                                    ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1001 - waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);
                                } else if (outcome === ktl.const.WAIT_SEL_ALERT && Knack.getUserAttributes().name === ktl.core.getCfg().developerName)
                                    alert('waitSelector timed out for ' + sel + ' in ' + Knack.router.current_scene_key);

                                reject();
                            }
                        }, timeout);
                    }

                    function selIsOk(sel) {
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

            switchVersion: function (userVer = 'prod') {
                ktl.storage.lsSetItem('USE_VER', userVer);
                var useVer = ktl.storage.lsGetItem('USE_VER');
                ktl.debugWnd.lsLog('SWITCH USE_VER' + useVer);
                setTimeout(() => {
                    ktl.wndMsg.send('reloadPageMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP);
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
                var menu = '';
                var topMenuStr = '';
                var menuStr = '';
                if (ktl.core.isKiosk())
                    topMenuStr = 'Kiosk Mode - no menu'; //For some reason, Kiosk's Menu have many entries.
                else {
                    menu = $('#app-menu-list .is-active > a > span');
                    if (menu.length > 0)
                        menuStr = menu[0].innerText;

                    topMenu = menu.closest('.kn-dropdown-menu');
                    if (topMenu.length > 0) {
                        topMenuStr = topMenu[0].innerText;

                        //Special case for Apple devices, where all menus are included.  Must cleanup and keep only first one.
                        if (topMenuStr.length >= 13 && topMenuStr.substr(0, 13) === '\n            ') {
                            var array = topMenuStr.split('\n            ');
                            topMenuStr = array[1];
                        }
                    }
                }

                return { topmenu: topMenuStr, menu: menuStr, link: linkStr };
            },

            isHex: function (str) {
                var regexp = /^[0-9a-fA-F]+$/;
                if (regexp.test(str))
                    return true;
                else
                    return false;
            },

            ipFormatOk: function (ipAddress) {
                var ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (ipAddress.match(ipformat)) {
                    return true;
                }
                else {
                    return false;
                }
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
                if (timedPopupEl) {
                    clearTimeout(timedPopupTimer);
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
            lsGetItem: function (lsKey) {
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
                setCookie(username + '_' + setting, value, expdays);
            },

            loadUserSetting: function (setting) {
                var username = Knack.getUserAttributes().name;
                return getCookie(username + '_' + setting);
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

            getPublicIP().then((ip) => { sInfo.ip = ip; });
        })();


        function getPublicIP() {
            return new Promise(function (resolve, reject) {
                $.get('https://www.cloudflare.com/cdn-cgi/trace', function (data) {
                    var index = data.indexOf('ip=') + 3;
                    var publicIP = data.substr(index);
                    index = publicIP.indexOf('\n');
                    publicIP = publicIP.substr(0, index);
                    if (ktl.core.ipFormatOk(publicIP))
                        resolve(publicIP);
                    else
                        reject(publicIP);
                });
            });
        }

        return {
            getSysInfo: function () {
                return sInfo;
            },
        }
    })();

    //====================================================
    //Fields feature
    this.fields = (function () {
        var keyBuffer = '';
        var usingBarcodeReader = false;
        var onKeyPressed = null;
        var textAsNumeric = []; //These are text fields that must be converted to numeric.
        var convertNumDone = false;

        const DELAY_BEFORE_SEARCH_CHZN = 1500; //Fine-tuned for 'a bit below average' typing speed.
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

            if ($('.kn-login').length > 0) //All passthrough in login screen.
                return;

            //In a chznBetter, pressing enter submits the current text without waiting.
            if (!ktl.fields.getUsingBarcode() && e.keyCode === 13/*Enter key*/ && e.target.id === 'chznBetter') {
                e.preventDefault();
                ktl.fields.searchChznBetterDropdown(chznBetterTxt);
            }

            clearTimeout(chznLastKeyTimer);

            onKeyPressed(e);
        })

        $(document).on('click', function (e) {
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
                        ktl.fields.chznBetterSetFocus();
                    }
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
                } catch (err) { }


                //Find a better way than redo all over again.
                convertNumDone = false;
                ktl.fields.convertNumToTel();
            }

            //Do we need to add the chznBetter object?
            //chznBetter is ktl's fix to a few chzn dropdown problems.
            if (e.path.length >= 1 && !ktl.fields.getUsingBarcode()) {
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
                        if ($('#chznBetter').length > 0)
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
                ktl.fields.enforceNumeric();
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
                                console.log('inputVal =', inputVal);
                                inputVal = $(e.target).val().replace(' ', ''); //Get a last update in case user was quick and entered more than threshold chars.
                                ktl.fields.searchChznBetterDropdown(inputVal);
                            }
                        }, DELAY_BEFORE_SEARCH_CHZN);
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
                            }, DELAY_BEFORE_SEARCH_CHZN);
                        }
                    }
                }
            }
        })

        document.addEventListener('click', function (e) {
            //Work in progress:  When user clicks on a cell for inline editing, provide a mthod to change its style, to make it wider for example.
            //console.log('e.target =', e.target);

            var popover = e.target.closest('.kn-popover');
            if (popover) {
                console.log('popover =', popover);
                console.log('e.target.parentElement =', e.target.parentElement);
            }
            return;

            if (e.target.classList) {
                console.log('e.target.classList =', e.target.classList);
                var target = e.target;
                if (e.target.classList.value.includes('col-'))
                    target = e.target.parentElement;

                //console.log('target =', target);
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
        })

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.onKeyPressed && (onKeyPressed = cfgObj.onKeyPressed);
                cfgObj.textAsNumeric && (textAsNumeric = cfgObj.textAsNumeric);
            },

            //Converts all applicable fields in the scene from text to numeric (telephone) type to allow numeric keypad on mobile devices.
            //Also, using tel type is a little trick that allows auto-selection of text in a number field upon focus.
            convertNumToTel: function () {
                return new Promise(function (resolve) {
                    if (convertNumDone || Knack.router.current_scene_key === ktl.iFrameWnd.getCfg().iFrameScnId)
                        resolve();
                    else {
                        var fields = document.querySelectorAll('.kn-input');
                        fields.forEach(function (field) {
                            var viewId = $(field).closest('.kn-view') || e.target.closest('#cell-editor');
                            if (viewId && viewId[0]) {
                                viewId = viewId[0].id;
                                if (field.closest('.kn-input-number') || textAsNumeric.includes(field.id)) {
                                    var fieldId = document.querySelector('#' + field.id + ' .control [id]').id;
                                    if (!field.getAttribute('numeric')) {
                                        field.setAttribute('numeric', true);
                                        $(field).clone().attr('type', 'tel').insertAfter($(field)).prev().remove();

                                        //We also need to change the input field itself to force numeric (tel) keyboard in mobile devices.
                                        $('#' + viewId + ' #' + fieldId).clone().attr('type', 'tel').insertAfter($('#' + viewId + ' #' + fieldId)).prev().remove();
                                    }
                                }
                            }
                        })

                        convertNumDone = true;
                        resolve();
                    }
                })
            },

            //Prevents entering non-numeric values in a numeric field.
            //If an error is detected, the Submit button is disabled and the field is colored in pink.
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
                            var inputFld = document.querySelector('#chznBetter[numeric=true]') || document.querySelector('#' + form.id + ' #' + field.getAttribute('data-input-id'));
                            if (inputFld) {
                                var value = inputFld.value;
                                var fieldValid = !isNaN(value);
                                formValid = formValid && fieldValid;

                                inputFld.setAttribute('valid', fieldValid);
                                $('#' + viewId.id + ' [type=submit]').prop('disabled', !formValid); //Form Submit
                                $('#cell-editor > div.submit > a').attr('disabled', !formValid); //Inline Editing Submit
                                $(inputFld).css('background-color', !fieldValid ? '#fdb0b0' : ''); //Same color as Knack errors.
                                !formValid && ktl.scenes.spinnerWatchdog(formValid); //Don't let the disabled Submit cause a page reload.
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
                    id = label.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"); //Any character other than a-z or 0-9, replace by underscore.
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
                    id = label.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"); //Any character other than a-z or 0-9, replace by underscore.
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

            //Barcode reader specific functions
            addChar: function (char = '') {
                if (!char) {
                    ktl.log.clog('addChar - invalid', 'purple');
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
            //Remove restricted entries from a dropdown.  In this case, high-level Account Roles.
            //$(document).on('mousedown keyup',
            //    '#view_313_field_25_chzn' + //Roles field for Add account
            //    ', #view_232_field_25_chzn' //Roles field for Edit account
            //    //', #view_XXX_field_YYY_chzn' //Add more here as needed.  Don't forget the + at end of line!
            //    , function () {
            //        //$("ul.chzn-results li:contains('Supervisor')").remove();
            //        //$("ul.chzn-results li:contains('Admin')").remove();
            //        $("ul.chzn-results li:contains('SuperAdmin')").remove();
            //    }
            //);


            //chznBetter functions
            // Ex. param:  dropdownId = 'view_XXX_field_YYY_chzn';
            addChznBetter: function (dropdownId) {
                //console.log('Entering addChznBetter');
                var fieldId = $('#' + dropdownId).closest('.kn-input').attr('data-input-id');
                var srchField = null;
                if ($('#chznBetter').length === 0) {
                    chznBetterTxt = '';
                    var chznBetter = document.createElement('input');

                    //Numeric fields only, set to Tel type.
                    if (textAsNumeric.includes(fieldId)) {
                        chznBetter.setAttribute('type', 'tel');
                        chznBetter.setAttribute('numeric', 'true');
                        chznBetter.setAttribute('threshold', '4'); //Minimum number of characters to be typed before search is triggered.
                    } else {
                        chznBetter.setAttribute('type', 'text');
                        chznBetter.setAttribute('threshold', '3');
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

            chznBetterSetFocus: function () {
                setTimeout(function () { $('#chznBetter').focus(); }, 200);
            },

            searchChznBetterDropdown: function (text = '') {
                if (!text) return;

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
                                ktl.fields.chznBetterSetFocus();
                            else {
                                setTimeout(function () {
                                    $(chzn).find('.chzn-drop').css('left', ''); //Put back, since was moved to -9000px.
                                    chzn.focus(); //Partial Match: Let use chose with up/down arrows and enter.
                                }, 500);
                            }
                        })
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
        }
    })();

    //====================================================
    //Persistent Form
    //Will automatically save and load form data to prevent losses after a refresh, power outage, network loss or other.
    this.persistentForm = (function () {
        const PERSISTENT_FORM_DATA = 'persistentForm';

        //Add fields and scenes to exclude from persistence in these arrays.
        var scenesToExclude = [];
        var fieldsToExclude = [];

        var currentViews = [];
        var previousScene = '';
        var formDataObj = {};
        var keyTimeout = null;
        var pfInitDone = false;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (!ktl.core.getCfg().enabled.persistentForm || scenesToExclude.includes(scene.key) || Knack.router.current_scene_key === ktl.iFrameWnd.getCfg().iFrameScnId)
                return;

            if (previousScene != scene.key) {
                previousScene = scene.key;
                currentViews.forEach(function (view) {
                    eraseFormData(view);
                });
                currentViews = [];
            }

            ktl.fields.convertNumToTel().then(() => {
                loadFormData()
                    .then(() => {
                        addChangeEventHandlers();
                        pfInitDone = true;
                        setTimeout(function () { ktl.fields.enforceNumeric(); }, 1000);
                    })
            });
        })

        document.addEventListener('input', function (e) {
            if (pfInitDone && !scenesToExclude.includes(Knack.router.current_scene_key))
                inputHasChanged(e);
        })

        document.addEventListener('focusout', function (e) {
            if (pfInitDone && !scenesToExclude.includes(Knack.router.current_scene_key) && document.hasFocus())
                inputHasChanged(e);
        }, true);

        $(document).on('knack-form-submit.any', function (event, view, record) {
            if (Knack.router.current_scene_key !== ktl.iFrameWnd.getCfg().iFrameScnId)
                eraseFormData(view);
        });

        //Save data for a given view and field.
        function saveFormData (viewId = '', fieldId = '', text = '') {
            if (!pfInitDone || !viewId || !fieldId || fieldsToExclude.includes(fieldId))
                return;

            var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
            if (formDataObjStr)
                formDataObj = JSON.parse(formDataObjStr);

            if (fieldId === 'chznBetter')
                fieldId = $('#' + fieldId).closest('.kn-input').attr('data-input-id');

            formDataObj[viewId] = formDataObj[viewId] ? formDataObj[viewId] : {};
            formDataObj[viewId][fieldId] = text;

            formDataObjStr = JSON.stringify(formDataObj);
            ktl.storage.lsSetItem(PERSISTENT_FORM_DATA, formDataObjStr);

            //Colorize fields that have been modified.
            //Unfinished, need to compare with original value and colorize only if different.
            //$('#' + viewId + ' #' + fieldId).css({ 'background-color': '#fff0d0' });
            //$('#' + viewId + '-' + fieldId).css({ 'background-color': '#fff0d0' });
            //$('#' + viewId + '_' + fieldId + '_chzn .chzn-single').css({ 'background-color': '#fff0d0' });
        }

        //Loads any data previously saved for all fields in all forms.
        //Also adds Change event handlers for dropdowns and calendars.   Eventually, support all object types.
        //After loading, re-validates numeric fields and put errors in pink.
        function loadFormData () {
            return new Promise(function (resolve) {
                formDataObj = {};
                var formDataObjStr = ktl.storage.lsGetItem(PERSISTENT_FORM_DATA);
                if (formDataObjStr)
                    formDataObj = JSON.parse(formDataObjStr);
                else {
                    resolve();
                    return;
                }

                //To see all data types:  console.log(Knack.config);
                var textDataTypes = ['address', 'date_time', 'email', 'link', 'name', 'number', 'paragraph_text', 'phone', 'rich_text', 'short_text'];

                var intervalId = null;
                var numFields = Knack.router.scene_view.model.views.models.length;
                currentViews = [];
                Knack.router.scene_view.model.views.models.forEach(function (eachView) {
                    var view = eachView.attributes;
                    currentViews.push(view);

                    //Restore stored data
                    if (formDataObj[view.key]) {
                        var fieldsArray = Object.keys(formDataObj[view.key]);
                        if (fieldsArray.length > 0) {
                            numFields += fieldsArray.length - 1;
                            fieldsArray.forEach(function (fieldId) {
                                var fieldText = formDataObj[view.key][fieldId];
                                var field = Knack.objects.getField(fieldId);
                                if (field) {
                                    var fieldType = field.attributes.type;
                                    if (textDataTypes.includes(fieldType)) {
                                        var el = document.querySelector('#' + view.key + ' [data-input-id=' + fieldId + '] input')
                                            || document.querySelector('#' + view.key + ' [data-input-id=' + fieldId + '] .kn-textarea');

                                        if (el) {
                                            //The condition !el.value means 'Write value only if currently empty' 
                                            //and prevents overwriting fields just populated by code.
                                            !el.value && (el.value = fieldText);
                                        }

                                        numFields--;
                                    } else if (fieldType === 'connection') {
                                        var textToFind = fieldText.split('-');
                                        var recId = textToFind.length === 2 ? textToFind[1] : '';
                                        textToFind = textToFind[0];

                                        //Start with a first 'rough' pass to populate option records...
                                        ktl.views.searchDropdown(textToFind, fieldId, false, false)
                                            .then(function () { findRecId(recId); })
                                            .catch(function () { findRecId(recId); })

                                        //... then a second pass to find exact match with recId.
                                        function findRecId(recId) {
                                            recId && $('#' + view.key + '-' + fieldId).val(recId).trigger('liszt:updated').chosen().trigger('change');
                                            numFields--;
                                            var chznContainer = $('[id*="' + fieldId + '"] .chzn-container');
                                            $(chznContainer).find('.chzn-drop').css('left', '-9000px');
                                        }
                                    } else if (fieldType === 'multiple_choice') {
                                        ktl.views.searchDropdown(fieldText, fieldId, true, false)
                                            .then(function () { })
                                            .catch(function () { })
                                    }
                                }
                            })
                        }
                    }
                    numFields--;
                })

                //Wait until all views and fields are processed.
                intervalId = setInterval(function () {
                    if (numFields <= 0) {
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
                }, 5000);
            })
        }

        //Add Change event handlers for Dropdowns, Calendars, etc.
        function addChangeEventHandlers() {
            var self = this;

            //Dropdowns
            $('.chzn-select').chosen().change(function (e, p) {
                if (e.target.id) {
                    var text = e.target.selectedOptions[0].innerText;
                    var recId = e.target.selectedOptions[0].value; //@@@ TODO: create a function called hasRecIdFormat() to validate hex and 24 chars.
                    if (text !== '' && text !== 'Select' && text !== 'Type to search') {
                        text = findLongestWord(text); //Maximize your chances of finding something unique, thus reducing the number of records found.
                        var fieldId = $('#' + e.target.id).closest('.kn-input').attr('data-input-id');
                        var viewId = e.target.closest('.kn-view').id;
                        saveFormData(viewId, fieldId, text + '-' + recId);
                    }
                }
            });

            function findLongestWord(str) {
                var longestWord = str.split(/[^a-zA-Z0-9]/).sort(function (a, b) { return b.length - a.length; });
                return longestWord[0];
            }

            //Calendars
            $('.knack-date').datepicker().change(function (e) {
                var text = e.target.value;
                var fieldId = $('#' + e.target.id).closest('.kn-input').attr('data-input-id');
                var viewId = e.target.closest('.kn-view').id;
                saveFormData(viewId, fieldId, text);
            })

            //Etc.  TODO:  radio buttons, checkboxes
        }

        //When input field text has changed or has lost focus, save it.
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
                var text = e.target.value;
                var viewId = e.target.closest('.kn-form.kn-view');
                if (viewId) {
                    viewId = viewId.id;

                    //For the fieldId, sometimes we get view_XXX-field_YYY (ex: multiple-choices dropdowns).  Keep only field info.
                    var fieldIndex = e.target.id.indexOf('field_');
                    if (fieldIndex >= 0) {
                        var fieldId = e.target.id.substr(fieldIndex);
                        if (!viewId || !fieldId) return;
                        saveFormData(viewId, fieldId, text);
                    }
                }
            }
        }

        //Remove all saved data for this view after a submit 
        //If changing scene (view param is null), then erase for all views.
        function eraseFormData(view = null) {
            if (view) {
                delete formDataObj[view.key];
                ktl.storage.lsSetItem(PERSISTENT_FORM_DATA, JSON.stringify(formDataObj));
            } else {
                Knack.router.scene_view.model.views.models.forEach(function (eachView) {
                    var view = eachView.attributes;
                    eraseFormData(view);
                })
            }
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.scenesToExclude && (scenesToExclude = cfgObj.scenesToExclude);
                cfgObj.fieldsToExclude && (fieldsToExclude = cfgObj.fieldsToExclude);
            },
        }
    })();

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
                //TODO scenesToExclude
            },

            initSystemColors: function () {
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
    })();

    //====================================================
    //User Filters feature
    const LS_FILTERS = 'FILTERS_';
    
    this.userFilters = (function () {
        const SAVE_FILTER_BTN = 'Save';
        const FILTER_BTN_SUFFIX = 'filterBtn';
        const SAVE_FILTER_BTN_SEL = SAVE_FILTER_BTN + '-' + FILTER_BTN_SUFFIX; //ex: view_1234-SaveFilter-filterBtn

        var allFiltersObj = {}; //The main object that drives the whole feature.
        var applyFilter = true;
        var allowUserFilters = null; //Callback to your app to allow user filters based on specific conditions.
        var viewToRefreshAfterFilterChg = null;
        var ufMenuViewId = '';
        var ufCodeViewId = '';
        var ufDateTimeFld = '';
        var ufFiltersCodeFld = '';


        Object.defineProperty(allFiltersObj, "isEmpty", {
            get: function () { $.isEmptyObject(this); }
        });

        loadAllFilters();

        $(document).on('knack-scene-render.any', function (event, scene) {
            applyFilter = true;
            loadAllFilters();

            //If we're on a multi-column report view, special processing is required to force a view refresh, otherwise we lose the buttons.
            $('.kn-filters').mousedown(function (e) {
                if ($(e.target).closest('.kn-remove-filter').length > 0) {
                    setViewToRefresh($(e.target).closest('.kn-view').attr('id'));

                    var column = '';
                    var colView = $(e.target).closest('[id^="kn-report-' + getViewToRefresh() + '-"]');
                    if (colView.length > 0)
                        column = '_' + (colView[0].id.slice(-1) - 1);

                    removeActiveFilter(getViewToRefresh() + column);
                }
            });
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            if (!ktl.core.getCfg().enabled.userFilters) return;

            if (!window.self.frameElement && allowUserFilters() && $('#' + view.key + ' .kn-add-filter').length > 0)
                addFilterButtons(view.key);
        })

        $(document).on('click', function (e) {
            var viewToRefresh = getViewToRefresh();
            if (e.target.className.includes && e.target.className.includes('kn-button is-primary') && e.target.classList.length > 0 && e.target.type === 'submit') {
                if (e.target.id === 'kn-submit-filters') {
                    if (viewToRefresh) {
                        ktl.views.refreshView(viewToRefresh);
                        setViewToRefresh(null);
                    }
                }
            } else {
                //When user clicks on Add Filters button or edits the current filter,
                //we must refresh the view to get our User Filter buttons back.
                if (e.target.closest('.kn-filters-nav,.kn-filters,.kn-remove-filter')) {
                    var viewId = e.target.closest('.kn-view');
                    viewId = viewId ? viewId.id : null;
                    setViewToRefresh(viewToRefresh || viewId);
                    if (e.target.closest('.kn-remove-filter')) {
                        if (getViewToRefresh()) {
                            ktl.views.refreshView(getViewToRefresh());
                            setViewToRefresh(null);
                        }
                    }
                }
            }
        })

        $(document).on('knack-view-render.' + ufMenuViewId, function (event, view, data) {
            var allFiltersObj = {};

            //UPLOAD menu button
            var filters = ktl.storage.lsGetItem(LS_FILTERS + Knack.getUserAttributes().id);
            var disabled = true;
            if (filters) {
                allFiltersObj = JSON.parse(filters);
                if (!$.isEmptyObject(allFiltersObj))
                    disabled = false;
            }
            $('#' + ufMenuViewId + ' > div > a.kn-link.kn-link-1.kn-button').attr('disabled', disabled);

            $('#' + ufMenuViewId + ' > div > a.kn-link.kn-link-1.kn-button').click(function () {
                //Get latest LS_FILTERS object's state.
                filters = ktl.storage.lsGetItem(LS_FILTERS + Knack.getUserAttributes().id);
                if (filters) {
                    allFiltersObj = JSON.parse(filters);
                    if (!$.isEmptyObject(allFiltersObj)) {
                        //Check if record already exists.  If so, get its Id for an update (PUT), instead of new (POST).
                        var recId = $('#' + ufCodeViewId + ' > div.kn-table-wrapper > table > tbody > tr').attr('id'); //
                        var requestType = 'POST';
                        if (recId !== undefined && recId.length === 24) //Quick valid check
                            requestType = 'PUT';
                        else
                            recId = null;

                        var today = new Date();
                        var date = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();
                        var time = today.getHours() + ':' + today.getMinutes();
                        var dateTime = date + ' ' + time;

                        var apiData = {};
                        apiData[ufDateTimeFld] = dateTime;
                        apiData[ufFiltersCodeFld] = filters;

                        knAPI(ufCodeViewId, recId, apiData, requestType, [ufCodeViewId])
                            .then(function (response) {
                                alert('Uploaded Filters to Cloud Successfully!');
                            })
                            .catch(function (reason) {
                                alert('An error occurred while uploading filters to cloud: ' + reason)
                            })
                    }
                }
            });

            //DOWNLOAD menu button
            $('#' + ufMenuViewId + ' > div > a.kn-link.kn-link-2.kn-button').click(function () {
                //Check if record exists.  If so, get filter string and parse it to trap any errors.
                var allFiltersString = $('#' + ufCodeViewId + ' > div.kn-table-wrapper > table > tbody > tr > td.' + ufFiltersCodeFld + '.cell-edit').text();
                try {
                    allFiltersObj = JSON.parse(allFiltersString);
                    if (!$.isEmptyObject(allFiltersObj)) {
                        saveAllFilters('', allFiltersObj);
                        alert('Filters have been downloaded successfully.  Refresh all opened pages.');
                    }
                } catch (e) {
                    alert('Error Found Parsing Filters:', e);
                }
            });
        });

        $(document).on('knack-view-render.' + ufCodeViewId, function (event, view, data) {
            ktl.core.waitSelector('#' + ufMenuViewId + ' > div > a.kn-link.kn-link-2.kn-button')
                .then(function () {
                    if (data.length > 0)
                        $('#' + ufMenuViewId + ' > div > a.kn-link.kn-link-2.kn-button').attr('disabled', false);
                    else
                        $('#' + ufMenuViewId + ' > div > a.kn-link.kn-link-2.kn-button').attr('disabled', true);
                })
        });

        //Load all filters from local storage.
        function loadAllFilters() { //Never called?
            //TODO: Should we use a promise?
            var lsFilters = ktl.storage.lsGetItem(LS_FILTERS + Knack.getUserAttributes().id);
            if (lsFilters) {
                try {
                    allFiltersObj = JSON.parse(lsFilters);
                    if (!$.isEmptyObject(allFiltersObj)) {
                        //Here would go the resolve();
                        //console.log('allFiltersString is valid');
                    }
                } catch (e) {
                    alert('Error Found Parsing Filters:', e);
                }
            }
        }

        //Save all filters to local storage.
        function saveAllFilters (viewId = '', filtersObj = allFiltersObj) {
            if (!$.isEmptyObject(filtersObj)) {
                var filterObjStr = JSON.stringify(filtersObj);
                ktl.storage.lsSetItem(LS_FILTERS + Knack.getUserAttributes().id, filterObjStr);

                if (viewId)
                    ktl.views.refreshView(viewId);
            }
        }

        function addFilterButtons (viewId = '') {
            if ($('#' + viewId + ' .kn-add-filter').length === 0)
                return;

            //Prepare div and style
            var filterBtnStyle = 'font-weight: bold; margin-left: 2px; margin-right: 2px'; //Default base style. Add your own at end of this string.

            var columns = document.querySelectorAll('#' + viewId + ' li.column');

            var addFiltersBar = document.querySelectorAll('#' + viewId + ' .kn-records-nav:not(.below) .level-left');

            addFiltersBar.forEach(function (viewFilterDiv, divIndex) {
                var viewIdWithColumn = viewId;
                var idPrefix = '';
                if (columns.length > 0) {
                    viewIdWithColumn = viewId + '_' + divIndex;
                    idPrefix = divIndex + '_';
                }

                //Section for non-draggable control buttons.
                var filterCtrlDiv = $('#' + viewIdWithColumn + ' .filterCtrlDiv');
                if (filterCtrlDiv.length === 0) {
                    filterCtrlDiv = document.createElement('div');
                    filterCtrlDiv.setAttribute('class', 'filterCtrlDiv');
                    $('#' + viewIdWithColumn + ' .table-keyword-search').css({ 'display': 'flex' });
                    viewFilterDiv.appendChild(filterCtrlDiv);
                    $('#' + viewId + ' .filterCtrlDiv').css({ 'display': 'flex', 'margin-left': '15px' });
                }

                /////////////////////////////
                //Add Save Filter button.  Always create, but hide/show depending on filter state.
                var saveFilterButton = ktl.fields.addButton(filterCtrlDiv, 'Save Filter', filterBtnStyle + '; background-color: #ece6a6',
                    ['kn-button', 'is-small'],
                    viewId + '_' + idPrefix + SAVE_FILTER_BTN + '_' + FILTER_BTN_SUFFIX);

                saveFilterButton.setAttribute('disabled', 'true');
                saveFilterButton.classList.add('filterControl', 'tooltip');
                saveFilterButton.innerHTML = '<i class="fa fa-save fa-lg" id="' + viewIdWithColumn + '-' + SAVE_FILTER_BTN_SEL + '"></i><div class="tooltip"><span class="tooltiptext">Name and save your filter.<br>This will create a button.</span ></div>';
                saveFilterButton.addEventListener('click', function (e) {
                    e.preventDefault();
                    saveUserFilter(viewIdWithColumn);
                    ktl.views.refreshView(viewId);
                });

                //Section for draggable user filter buttons.
                var filterDiv = $('#' + viewIdWithColumn + ' .filterDiv');
                if (filterDiv.length === 0) {
                    filterDiv = document.createElement('div');
                    filterDiv.setAttribute('class', 'filterDiv');
                    filterDiv.setAttribute('id', viewIdWithColumn + '-filterDivId');
                    $('#' + viewIdWithColumn + ' .table-keyword-search').css({ 'display': 'flex' });
                    filterCtrlDiv && filterCtrlDiv.appendChild(filterDiv);
                    $('#' + viewIdWithColumn + ' .filterDiv').css({ 'display': 'flex', 'margin-left': '5px' });
                }

                if (!allFiltersObj.isEmpty) {
                    if (!$.isEmptyObject(allFiltersObj[viewIdWithColumn])) {
                        var activeFilter = allFiltersObj[viewIdWithColumn].active;
                        allFiltersObj[viewIdWithColumn].filters.forEach(function (filter, btnIndex) {
                            //Handle button clicks
                            if (filter.filterName === '')
                                return;
                            var filterBtnId = idPrefix + filter.filterName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"); //Any character other than a-z or 0-9, replace by underscore.
                            var filterButton = ktl.fields.addButton(filterDiv, filter.filterName, filterBtnStyle,
                                ['kn-button', 'is-small'],
                                filterBtnId + '_' + FILTER_BTN_SUFFIX);
                            filterButton.classList.add('filterBtn', 'draggable');
                            if (btnIndex === activeFilter)
                                filterButton.classList.add('activeFilter');
                            else
                                filterButton.classList.remove('activeFilter');

                            applyButtonColors();

                            //Apply Filter
                            filterButton.addEventListener('click', function (e) {
                                e.preventDefault();

                                //Check Active status.  If already active, skip.  If not, remove any currently active filter and set this one.
                                var index = getFilterIndex(allFiltersObj, filter.filterName, viewIdWithColumn);
                                $('.activeFilter').removeClass('activeFilter');
                                this.classList.add('activeFilter');
                                applyButtonColors();

                                //Nice attempt, but does not work.  Skips first filtering.  Check for another solution...
                                //if (allFiltersObj[viewIdWithColumn].active === index) {
                                //    ktl.log.clog('Skipping filter since same.', 'purple');
                                //    return;
                                //}

                                //console.log('allFiltersObj[viewIdWithColumn].active =', allFiltersObj[viewIdWithColumn].active);//$$$
                                //console.log('index =', index);//$$$

                                allFiltersObj[viewIdWithColumn].active = index;
                                saveAllFilters();

                                //Get current URL, check if a filter exists, if so, replace it.  If not, append it.
                                var parts = ktl.core.splitUrl(window.location.href);

                                var newUrl = parts['path'] + '?';
                                var otherParams = '';

                                //Get other params from URL.
                                const params = Object.entries(parts['params']);
                                if (!$.isEmptyObject(params)) {
                                    params.forEach(function (param) {
                                        if (param[0].indexOf(viewIdWithColumn + '_filters') >= 0 || param[0].indexOf(viewIdWithColumn + '_page') >= 0) {
                                            //Ignore these
                                        } else if (param[0].indexOf(viewIdWithColumn + '_page') >= 0) {
                                            //Ignore also
                                        } else {
                                            otherParams += param[0] + '=' + encodeURIComponent(param[1]).replace(/'/g, "%27").replace(/"/g, "%22") + '&';
                                        }
                                    });
                                }

                                var encodedNewFilter = encodeURIComponent(filter.filterString).replace(/'/g, "%27").replace(/"/g, "%22");
                                var allParams = otherParams + viewIdWithColumn + '_filters=' + encodedNewFilter;
                                newUrl += allParams;

                                window.location.href = newUrl;
                            });

                            //Right-click to provide Delete and Rename options.
                            filterButton.addEventListener('contextmenu', function (e) {
                                contextMenuFilter(e, viewIdWithColumn, filter);
                            })
                        });

                        //Apply active filters but only if we're changing scene.
                        //@@@ TODO:  Need an elegant support of multi-column reports, i.e. up to 3 filters to apply per view.
                        //Need to get all filter strings, concatenante them in memory and create new URL,
                        //instead fo applying three times, which causes multi-refreshes and flickering.
                        if (applyFilter) {
                            applyFilter = false;
                            if (activeFilter >= 0) {
                                //TODO as per above comment: use this list. var selActiveList = $('.activeFilter');
                                //console.log('selActiveList =', selActiveList);
                                $('.activeFilter').click();
                            }
                        }

                        //Setup Drag n Drop for filter buttons.
                        if (document.getElementById(viewIdWithColumn + '-filterDivId')) {
                            new Sortable(document.getElementById(viewIdWithColumn + '-filterDivId'), {
                                swapThreshold: 0.96,
                                animation: 250,
                                easing: "cubic-bezier(1, 0, 0, 1)",
                                onEnd: function (/**Event*/evt) {
                                    //When a drag n drop is done, update localStorage for this view.
                                    var filterDiv = evt.to;

                                    //Create new entries as copies of sorted filters, but at beginning of array.
                                    //When done, you get a doubled array, and simply truncate last half to get final version.
                                    //console.log('filterDiv.children =', filterDiv.children);
                                    var filterNames = [];
                                    filterDiv.children.forEach(function (item) {
                                        filterNames.push(item.innerText);
                                    });

                                    var initialLength = allFiltersObj[viewIdWithColumn].filters.length;
                                    //console.log('initialLength =', initialLength);
                                    filterNames.slice().reverse().forEach(function (item) {
                                        var foundFilter = allFiltersObj[viewIdWithColumn].filters.find(function (filter) {
                                            if (filter.filterName === item)
                                                return filter;
                                        });

                                        allFiltersObj[viewIdWithColumn].filters.unshift({ 'filterName': item, 'filterString': foundFilter.filterString });
                                    });

                                    //console.log('allFiltersObj[viewId].filters =');
                                    //console.log(JSON.parse(JSON.stringify(allFiltersObj[viewId].filters)))

                                    //New length should (must) be doubled.
                                    var length = allFiltersObj[viewIdWithColumn].filters.length;
                                    //console.log('length =', length);
                                    if (length === initialLength * 2) { //JIC.  Should always be true.
                                        allFiltersObj[viewIdWithColumn].filters.length = length / 2;
                                        saveAllFilters(); //Save updated object
                                    } else
                                        alert('Unexpected filter length detected.  Filters not saved.'); //@@@ TODO:  handle this somehow.
                                }
                            });
                        }
                    }
                }

                //Enable/disable control buttons (Only save in this case)
                ktl.core.waitSelector('#' + viewId + ' .kn-tag-filter', 5000, 'visible') //Instead, maybe try to wait until scene has rendered.
                    .then(function () {
                        var enabledFilters = document.querySelectorAll('#' + viewId + ' .kn-tag-filter');
                        enabledFilters.forEach(function (filter) {
                            var nav = filter.closest('.kn-records-nav');
                            var saveBtn = $(nav).find('#' + viewIdWithColumn + '_' + SAVE_FILTER_BTN + '_' + FILTER_BTN_SUFFIX);
                            if (saveBtn.length > 0) {
                                saveBtn.prop('disabled', false);
                            }
                        })
                    })
                    .catch(function () { //Normal case, where the _filters section never appear.  We still needed to wait to see.
                        if (!allFiltersObj.isEmpty) {
                            if (allFiltersObj[viewIdWithColumn] && allFiltersObj[viewIdWithColumn].active !== -1) {
                                //allFiltersObj[viewId].active = -1;
                                //saveAllFilters();
                                $('.filterBtn').removeClass('activeFilter');
                            }
                        }
                    })
            })
        }

        //When user saves a filter to a named button
        function saveUserFilter (viewId = '') {
            if (!viewId) return;

            //Extract filter string for this view from URL and decode.
            var newFilterStr = '';
            var parts = ktl.core.splitUrl(window.location.href);
            const params = Object.entries(parts['params']);
            if (!$.isEmptyObject(params)) {
                params.forEach(function (param) {
                    if (param[0].indexOf(viewId + '_filters') >= 0)
                        newFilterStr = param[1];
                });
            }

            if (!newFilterStr) return;

            var filterName = prompt('Filter Name: ', '');
            if (!filterName) return;

            if (!allFiltersObj.isEmpty) {
                var exists = false;
                if (viewId in allFiltersObj) {
                    //console.log('View IS Found');
                    //console.log('allFilterObj[id] =', allFilterObj[viewId].filters);

                    var filter = {};
                    var i = 0;
                    for (i = 0; i < allFiltersObj[viewId].filters.length; i++) {
                        filter = allFiltersObj[viewId].filters[i];

                        if (filterName === filter.filterName) {
                            exists = true;
                            break;
                        }
                    }

                    if (exists) {
                        if (confirm(filterName + ' already exists.  Do you want to overwrite?')) {
                            //console.log('Overwriting filter');
                            allFiltersObj[viewId].filters[i].filterString = newFilterStr;
                            allFiltersObj[viewId].active = i;
                        }
                    } else {
                        //console.log('Adding filter to existing view');
                        allFiltersObj[viewId].filters.push({ 'filterName': filterName, 'filterString': newFilterStr });
                        allFiltersObj[viewId].active = allFiltersObj[viewId].filters.length - 1;
                    }
                } else {
                    //console.log('View not found.  Adding view with new ilter');
                    allFiltersObj[viewId] = { filters: [{ 'filterName': filterName, 'filterString': newFilterStr }] };
                    allFiltersObj[viewId].active = 0;
                }
            } else {
                //console.log('No filters found, creating new');
                allFiltersObj[viewId] = { filters: [{ 'filterName': filterName, 'filterString': newFilterStr }] };
                allFiltersObj[viewId].active = 0;
            }

            saveAllFilters(viewId);
        }

        function applyButtonColors() {
            ktl.systemColors.getSystemColors()
                .then((sysColors) => {
                    $('.filterBtn').css({ 'background-color': sysColors.filterBtnClr });
                    $('.activeFilter').css({ 'background-color': sysColors.activeFilterBtnClr, 'border-color': sysColors.borderClr });
                })
        }

        function contextMenuFilter (e, viewId, filter) {
            e.preventDefault();
            var menuDiv = $('.menuDiv');
            if (menuDiv.length !== 0)
                menuDiv.remove();

            menuDiv = document.createElement('div');
            menuDiv.setAttribute('class', 'menuDiv');
            $('#' + e.target.id).append(menuDiv);
            $('.menuDiv').css({ 'display': 'flex', 'margin-left': '5px', 'position': 'absolute', 'top': '-80px' });

            var ul = document.createElement('ul');
            menuDiv.appendChild(ul);
            ul.style.textAlign = 'left';
            ul.style.fontSize = 'larger';
            ul.style.listStyle = 'none';

            //Delete Filter
            var listDelete = document.createElement('li');
            listDelete.innerHTML = '<i class="fa fa-trash-o" style="margin-top: 2px;"></i> Delete';
            listDelete.style.marginBottom = '8px';
            listDelete.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation(); //Required?

                var id = $(e.target).closest('.filterBtn').attr('id');
                var filterName = $('#' + id);
                $('.menuDiv').remove();
                filterName = $('#' + id).text();

                if (confirm('Are you sure you want to delete filter "' + filterName + '" ?')) {
                    var filterIndex = getFilterIndex(allFiltersObj, filter.filterName, viewId);
                    allFiltersObj[viewId].filters.splice(filterIndex, 1);
                    if (allFiltersObj[viewId].filters.length === 0)
                        delete allFiltersObj[viewId];

                    saveAllFilters(viewId);
                }
            });

            //Rename Filter
            var listRename = document.createElement('li');
            listRename.innerHTML = '<i class="fa fa-pencil-square-o" style="margin-top: 2px;"></i> Rename';
            listRename.style.marginBottom = '8px';

            listRename.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation(); //Required?

                var id = $(e.target).closest('.filterBtn').attr('id');
                var filterName = $('#' + id);
                $('.menuDiv').remove();
                filterName = $('#' + id).text();

                var newFilterName = prompt('New Filter Name: ', filterName);
                if (newFilterName !== null && newFilterName !== '' && newFilterName !== filterName) {
                    var foundFilter = allFiltersObj[viewId].filters.find(function (filter) {
                        if (filter.filterName === filterName)
                            return filter;
                    });

                    foundFilter.filterName = newFilterName;

                    saveAllFilters(viewId);
                }
            });

            /*  TODO...
            //Public Filters (system-wide)
            var listPublic = document.createElement('li');
            listPublic.innerHTML = '<i class="fa fa-gift" style="margin-top: 2px;"></i> Public: ';
            listPublic.style.marginBottom = '8px';
            
            listPublic.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation(); //Required?
            
                //console.log('Public');
            
                var id = $(e.target).closest('.filterBtn').attr('id');
                var filterName = $('#' + id);
                $('.menuDiv').remove();
            
                filterName = $('#' + id).text();
                //console.log('filterName =', filterName);
            
                //Toggle on/off
                listPublic.innerHTML += 'Yes';
            
                //var newFilterName = prompt('New Filter Name: ', filterName);
                //if (newFilterName !== null && newFilterName !== '' && newFilterName !== filterName) {
                //    var foundFilter = allFiltersObj[viewId].filters.find(function (filter) {
                //        if (filter.filterName === filterName)
                //            return filter;
                //    });
            
                //    foundFilter.filterName = newFilterName;
            
                //    //Send to iFram so it can save it to System's User Prefs
                //    saveAllFilters(allFiltersObj, viewId);
                //}
            });

            if (accountCanCreateSystemFilters)
                ul.appendChild(listPublic);
            */

            ul.appendChild(listDelete);
            ul.appendChild(listRename);
        }

        function removeActiveFilter (viewId) {
            allFiltersObj[viewId].active = -1;
            saveAllFilters();
        }

        function setViewToRefresh (viewId) {
            viewToRefreshAfterFilterChg = viewId;
        }

        function getViewToRefresh () {
            return viewToRefreshAfterFilterChg;
        }

        function getFilterIndex (allFiltersObj, filterName, viewId) {
            var filterIndex = allFiltersObj[viewId].filters.findIndex(function (filter) {
                if (filter.filterName === filterName) {
                    return filter;
                }
            });

            return filterIndex;
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.allowUserFilters && (allowUserFilters = cfgObj.allowUserFilters);
                cfgObj.ufCodeViewId && (ufCodeViewId = cfgObj.ufCodeViewId);
                cfgObj.ufMenuViewId && (ufMenuViewId = cfgObj.ufMenuViewId);
                cfgObj.ufDateTimeFld && (ufDateTimeFld = cfgObj.ufDateTimeFld);
                cfgObj.ufFiltersCodeFld && (ufFiltersCodeFld = cfgObj.ufFiltersCodeFld);
            },

            getCfg: function () {
                return {
                    uf,
                };
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
        function getLocalStorageLogs () {
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
                    ktl.log.clog('Error - lsLog called without storage.', 'purple');
            },

            deleteDebugWnd: function () {
                if (debugWnd) {
                    debugWnd.parentNode.removeChild(debugWnd);
                    debugWnd = null;
                }
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
                    ktl.debugWnd.deleteDebugWnd();
                }
            },

            // Does three things:
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

            //Display all logs in the debugWnd.
            //TODO: enable scroll and lock to a position.
            //** Consider a makeover where we'd use a string array instead (one string per line), for more control.
            showLogsInDebugWnd: function () {
                if (debugWnd && debugWnd.style.display === 'block') {
                    var dbgStr = getLocalStorageLogs();
                    var debugWndText = document.getElementById('debugWndText');
                    debugWndText.innerHTML = '';
                    dbgStr.forEach(function (el) {
                        debugWndText.textContent += el.dateTime + '    ' + el.logDetails + '\n';
                    })

                    const APP_ROOT_NAME = Knack.app.attributes.name + '_';
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

                    debugWndText.textContent +=
                        (cri ? ('CRITICAL: ' + ktl.storage.lsGetItem(ktl.const.LS_CRITICAL + Knack.getUserAttributes().id) + '\n') : '') +
                        (lgin ? ('LOGIN: ' + ktl.storage.lsGetItem(ktl.const.LS_LOGIN + Knack.getUserAttributes().id) + '\n') : '') +
                        (act ? ('ACT: ' + ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id) + '\n') : '') +
                        (nav ? ('NAV: ' + ktl.storage.lsGetItem(ktl.const.LS_NAVIGATION + Knack.getUserAttributes().id) + '\n') : '') +
                        (appErr ? ('APP ERR: ' + ktl.storage.lsGetItem(ktl.const.LS_APP_ERROR + Knack.getUserAttributes().id) + '\n') : '') +
                        (svrErr ? ('SVR ERR: ' + ktl.storage.lsGetItem(ktl.const.LS_SERVER_ERROR + Knack.getUserAttributes().id) + '\n') : '') +
                        (wrn ? ('WRN: ' + ktl.storage.lsGetItem(ktl.const.LS_WRN + Knack.getUserAttributes().id) + '\n') : '') +
                        //TODO:  Add info logs here.
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
        var processTitleFlags = null;

        $(document).on('knack-scene-render.any', function (event, scene) {
            //In developer mode, add a checkbox to pause all views' auto-refresh.
            if (ktl.account.isDeveloper() && scene.key !== ktl.iFrameWnd.getCfg().iFrameScnId) {
                //var div = $('.kn-info-bar > div');
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
                ktl.views.addViewId(Knack.views[viewId].model.view);
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            ktlProcessTitleFlags(view, data);
            ktl.views.addViewId(view);
        })

        $(document).on('click', function (e) {
            ktl.views.modifyTableSort(e);

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
        function ktlProcessTitleFlags(view, data) {
            try {
                //Clean up title first by removing all flags. All flags must be AFTER any title text to be kept.
                if (view.title && view.title !== '') {
                    var index = Math.min(
                        ktl.core.getSubstringPosition(view.title, 'AUTOREFRESH', 1),
                        ktl.core.getSubstringPosition(view.title, 'HIDDEN_', 1),
                        ktl.core.getSubstringPosition(view.title, 'NO_INLINE', 1),
                        ktl.core.getSubstringPosition(view.title, 'USER_PREFS_', 1),
                        ktl.core.getSubstringPosition(view.title, 'UTC_HEARTBEAT', 1),
                        ktl.core.getSubstringPosition(view.title, 'ACCOUNT_LOGS', 1),
                        ktl.core.getSubstringPosition(view.title, 'USER_FILTERS_', 1),
                        ktl.core.getSubstringPosition(view.title, 'ADD_', 1),
                        ktl.core.getSubstringPosition(view.title, 'NO_BUTTONS', 1)
                    );

                    //Truncate all title characters beyond the lowest index found.
                    var title = view.title.substring(0, index);
                    $('#' + view.key + ' > div.view-header > h2').text(title);

                    //Hide the whole view, typically used when doing background searches.
                    if (view.title.includes('HIDDEN_VIEW')) {
                        if (!ktl.account.getRoleNames().includes('Developer'))
                            $('#' + view.key).css({ 'position': 'absolute', 'left': '-9000px' }); //Hide (move) away from screen to prevent clicking and adding duplicates.
                    }

                    //Hide the view title only, typically used to save space when real estate is critical.
                    if (view.title.includes('HIDDEN_TITLE'))
                        $('#' + view.key + ' > div.view-header > h2').css({ 'display': 'none' });

                    //Disable mouse clicks when a table's Inline Edit is enabled for PUT/POST API calls, but you don't want users to modify cells.
                    if (Knack.views[view.key] && Knack.views[view.key].model && Knack.views[view.key].model.view.options && Knack.views[view.key].model.view.options.cell_editor) {
                        if (view.title.includes('NO_INLINE'))
                            $('#' + view.key + ' .cell-edit').css({ 'pointer-events': 'none', 'background-color': '', 'font-weight': '' });
                        else
                            $('#' + view.key + ' .cell-edit').css({ 'pointer-events': 'all', 'background-color': '#ffffdd', 'font-weight': 'bold' });
                    }

                    //Special processing of iFrameWnd settings - BEGIN
                    if (!ktl.iFrameWnd.getCfg().hbViewId && view.title.includes('UTC_HEARTBEAT')) {
                        ktl.iFrameWnd.setCfg({
                            hbViewId: view.key,
                            iFrameScnId: view.scene.key,
                        });

                        //Leaving more time to iFrameWnd has proven to reduce errors and improve stability.
                        //Anyways... no one is getting impatient at an invisible window!
                        ktl.scenes.setCfg({ spinnerCtrReload: 60 });
                    }

                    if (!ktl.iFrameWnd.getCfg().accountLogsViewId && view.title.includes('ACCOUNT_LOGS'))
                        ktl.iFrameWnd.setCfg({ accountLogsViewId: view.key });

                    if (!ktl.iFrameWnd.getCfg().curUserPrefsViewId && view.title.includes('USER_PREFS_CUR'))
                        ktl.iFrameWnd.setCfg({ curUserPrefsViewId: view.key })

                    if (!ktl.iFrameWnd.getCfg().updUserPrefsViewId && view.title.includes('USER_PREFS_UPD'))
                        ktl.iFrameWnd.setCfg({ updUserPrefsViewId: view.key })
                    //Special processing of iFrameWnd settings - END

                    if (!ktl.userPrefs.getCfg().myUserPrefsViewId && view.title.includes('USER_PREFS_SET')) {
                        ktl.userPrefs.setCfg({ myUserPrefsViewId: view.key })
                        ktl.views.refreshView(view.key);
                    }

                    if (view.title.includes('USER_FILTERS_MENU'))
                        ktl.userFilters.setCfg({ ufMenuViewId: view.key })

                    if (view.title.includes('USER_FILTERS_CODE'))
                        ktl.userFilters.setCfg({ ufCodeViewId: view.key })

                    processTitleFlags && processTitleFlags(view, data);
                }

                //Put back h2 opacity to normal (see CSS code).
                //This is to prevent seeing the title flags in headings until they are removed, which happens often on slower devices.
                $('h2').css('opacity', '1');
            }
            catch (err) { console.log('err', err); };
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.processTitleFlags && (processTitleFlags = cfgObj.processTitleFlags);
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
                            var useFetch = (formAction === 'insert') ? false : true;

                            //This generates a bit too much logs sometimes.  Uncomment if you really need it.
                            //if (ktl.userPrefs.getUserPrefs().showExtraDebugInfo) {
                            //    ktl.log.clog('refreshView: ' + viewId, 'purple');
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
                                            if (['details' /*more types?*/].includes(viewType))
                                                Knack.views[viewId].render();

                                            resolve(model);
                                            return;
                                        },
                                        error: function (model, response, options) {
                                            response.caller = 'refreshView';
                                            response.viewId = viewId;

                                            //Process critical failures by forcing a logout or hard reset.
                                            if (response.status === 401 || response.status === 403 || response.status === 500) {
                                                if (Knack.router.current_scene_key === ktl.iFrameWnd.getCfg().iFrameScnId)
                                                    parent.postMessage({ msgType: 'forceReload', response: response }, '*');
                                                else {
                                                    if (response.status === 500)
                                                        location.reload(true);
                                                    else {
                                                        ktl.log.addLog(LS_APP_ERROR, 'KEC_1007 - Forcing logout');
                                                        $('.kn-log-out').trigger('click'); //Token has expired, force logout.
                                                    }
                                                }
                                            } else {
                                                if (Knack.router.scene_view.model.views._byId[viewId].attributes.title.includes('AUTOREFRESH')) {
                                                    resolve(); //Just ignore, we'll try again shortly anyways.
                                                    return;
                                                } else {
                                                    if (retryCtr-- > 0) {
                                                        var responseTxt = JSON.stringify(response);
                                                        ktl.log.clog('refreshView error, response = ' + responseTxt + ' retry = ' + retryCtr, 'purple');

                                                        setTimeout(function () {
                                                            tryRefresh(retryCtr);
                                                        }, 1000);
                                                    } else {
                                                        if (response.status === 0 && Knack.router.current_scene_key === ktl.iFrameWnd.getCfg().iFrameScnId)
                                                            parent.postMessage({ msgType: 'forceReload', response: response }, '*');
                                                        else {
                                                            ktl.log.addLog(ktl.const.LS_SERVER_ERROR, 'KEC_1008 - refreshView failure in ' + viewId + ', status: ' + response.status + ', statusText: ' + response.statusText);
                                                            resolve(model);
                                                            return;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }
                            })(10); //Retries
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
                                        //ktl.log.clog('View refreshed successfully: ' + viewId, 'green');
                                    })
                                    .catch(() => {
                                        ktl.log.clog('Error refreshing view:' + viewId, 'red');
                                    })
                            )
                        })

                        Promise.all(promisesArray)
                            .then(() => {
                                //ktl.log.clog('All views refreshed!', 'green');
                                Knack.hideSpinner();
                                resolve();
                            })
                            .catch(() => {
                                ktl.log.clog('Error refreshing views!', 'red');
                                reject()
                            })
                            .finally(() => {
                                clearTimeout(failsafe);
                            })
                        }

                    var failsafe = setTimeout(() => {
                        ktl.log.clog('Failsafe timeout in refreshViewArray!', 'red');
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
                    //console.log('viewId =', viewId);//$$$
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

            //Params:   - viewKey is the id of the view, like view_123 or view.key.
            //          - callback is the function to be called when the top checkbox is clicked.
            //            It is used to do an action upon change like ena/disable a button or show number of items checked.
            addCheckboxesToTable: function (viewKey, masterCheckBoxCallback = null) {
                var selNoData = $('#' + viewKey + ' > div.kn-table-wrapper > table > tbody > tr > td.kn-td-nodata');
                if (selNoData.length === 0) { //Only add checkboxes if there's data.
                    // Add the checkbox to to the header to select/unselect all
                    $('#' + viewKey + '.kn-table thead tr').prepend('<th><input type="checkbox"></th>');
                    $('#' + viewKey + '.kn-table thead input').change(function () {
                        $('.' + viewKey + '.kn-table tbody tr input').each(function () {
                            $(this).attr('checked', $('#' + viewKey + '.kn-table thead input').attr('checked') != undefined);
                        });

                        var numChecked = $('#' + viewKey + ' tbody input[type=checkbox]:checked').length;
                        masterCheckBoxCallback && masterCheckBoxCallback(numChecked);
                    });

                    // Add a checkbox to each row in the table body
                    $('#' + viewKey + '.kn-table tbody tr').each(function () {
                        $(this).prepend('<td><input type="checkbox"></td>');
                    });

                    if (!Knack.views[viewKey].options.model.view.totals) return;

                    var hasSummary = Knack.views[viewKey].options.model.view.totals.length;
                    if (hasSummary) {
                        var sel = '#' + viewKey + ' > div.kn-table-wrapper > table > tbody > tr.kn-table-totals';
                        ktl.core.waitSelector(sel)
                            .then(function () {
                                $(sel).prepend('<td><input type="checkbox"></td>');
                                $('#' + viewKey + ' > div.kn-table-wrapper > table > tbody > tr.kn-table-totals > td:nth-child(1) > input[type=checkbox]').css('display', 'none');
                            })
                            .catch(function () {
                            })
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
            // viewId: 'view_xyz' is optional.  If left empty, the first found field is used. (TODO)
            searchDropdown: function (srchTxt = '', fieldId = '', onlyExactMatch = true, showPopup = true, viewId = '') {
                return new Promise(function (resolve, reject) {
                    if (!srchTxt || !fieldId) {
                        reject('');
                        return;
                    }

                    var prefix = document.activeElement.closest('#cell-editor') ? '#cell-editor ' : ''; //Support inline editing.
                    var isSearchForm = false; //Not used yet. TODO...
                    var dropdownObj = $(prefix + '[id$="' + fieldId + '"]'); //Selector: id ends with field_xyz
                    if (dropdownObj.length === 0) { //Try search form
                        dropdownObj = $('.kn-search-form [id*="' + fieldId + '"].chzn-select');
                        isSearchForm = dropdownObj.length ? true : false;
                    }

                    if (dropdownObj.length) {
                        //Multiple choice (hard coded entries) drop downs. Ex: Work Shifts
                        var isMultipleChoice = $(prefix + '[id*="' + fieldId + '"].kn-input-multiple_choice').length > 0 ? true : false;;
                        var chznSearchInput = $(prefix + '[id*="' + fieldId + '"] .chzn-container input').first();
                        var isSingleSelection = $(prefix + '[id*="' + fieldId + '"] .chzn-container-single').length > 0 ? true : false;
                        var chznContainer = $(prefix + '[id*="' + fieldId + '"] .chzn-container');

                        //If the dropdown has a search field, trigger a search on the requested text now.
                        if ($(prefix + '[id*="' + fieldId + '"] .ui-autocomplete-input').length > 0) {
                            chznSearchInput.focus();
                            chznSearchInput.autocomplete('search', srchTxt); //GO!
                        }

                        //Wait for response...
                        var foundText = '';
                        var lowercaseSrch = srchTxt.toString().toLowerCase();
                        Knack.showSpinner();

                        var intervalId = setInterval(function () {
                            if (!$('.ui-autocomplete-loading').is(':visible')) {
                                clearInterval(intervalId);

                                if (isSingleSelection || isMultipleChoice) {
                                    //The dropdown has finished searching and came up with some results, but we must now
                                    //filter them to exclude any found elements that are not an exact match (whole word only).
                                    //Otherwise, we may end up with wrong results.  
                                    //Ex: Typing 1234 could select 12345 if it was part of the results and before 1234.
                                    var id = '';
                                    var options = dropdownObj.find('option');
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

                                            dropdownObj.trigger('change'); //Required to save persistent form data.

                                            if (chznContainer.length) {
                                                $(chznContainer).find('.chzn-drop').css('left', '-9000px');
                                                ktl.scenes.autoFocus();
                                            }
                                        } else { //Multiple options.
                                            if (onlyExactMatch) {
                                                ktl.core.timedPopup('Could Not Find ' + srchTxt, 'error', 3000);
                                                reject(foundText);
                                                return;
                                            }
                                        }

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

                                        reject(foundText);
                                        return;
                                    }
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
                                                                    ktl.fields.chznBetterSetFocus();
                                                                } else {
                                                                    var lotNb = $(this)[0].innerText;
                                                                    //For some reason, if there's only one current entry under ul class "chzn-choices", we need to exclude that one.
                                                                    if ($(prefix + '[id$="' + fieldId + '_chzn_c_0"]')[0].innerText !== lotNb) {
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
                                                        //ktl.fields.chznBetterSetFocus();
                                                    }
                                                } else {
                                                    Knack.hideSpinner();
                                                    ktl.core.timedPopup(srchTxt + ' not Found', 'error', 3000);
                                                    ktl.fields.chznBetterSetFocus();
                                                }

                                                //autoFocus(); <- Leave out in this case!  
                                                //...User input is required with a physical click, otherwise the existing entry is replaced by new for some reason.
                                            }
                                        }, 200);
                                    }
                                }
                            }
                        }, 200);

                        setTimeout(function () { //Failsafe
                            Knack.hideSpinner();
                            clearInterval(intervalId);
                            reject(foundText);
                            return; //JIC
                        }, 5000);
                    } else {
                        //ktl.log.clog('Called searchDropdown with a field that does not exist: ' + fieldId, 'purple');
                    }
                });
            },

            //Uses a Search view to find existing text.
            //Must have a single text input for a field, with exact match.
            //ALso works with the generic 'Keyword Search' field, but its risky to miss if more than 100 results.
            //Does not work for a connected field using a dropdown.
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
                    ktl.log.clog('Called removeTableColumns with invalid parameters.', 'purple');
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

            //Pass a list of fields and returns the first found.
            findFirstExistingField: function (fieldArray = []) {
                if (fieldArray.length === 0)
                    return '';

                var fieldId = '';
                for (var i = 0; i < fieldArray.length; i++) {
                    fieldId = $('[name=' + fieldArray[i] + ']');
                    if (fieldId.length) {
                        fieldId = fieldId[0].closest('.kn-input').getAttribute('data-input-id');
                        return fieldId;
                    }
                }
                return '';
            },

            //When a table header is clicked to sort, invert sort order if type is date_time, so we get most recent first.
            modifyTableSort: function (e) {
                if (e.target.closest('.kn-sort')) {
                    var alreadySorted = e.target.closest('[class*="sorted-"]');
                    if (alreadySorted)
                        return;


                    var fieldId = e.target.closest('th').className;
                    if (Knack.objects.getField(fieldId)) {
                        var fieldAttr = Knack.objects.getField(fieldId).attributes;

                        var invert = false;
                        if (e.ctrlKey)
                            invert = true;

                        var viewId = e.target.closest('.kn-table.kn-view');
                        if (viewId) {
                            viewId = viewId.getAttribute('id');
                            //if (fieldAttr.type === 'connection')
                            //    Knack.views[viewId].model.view.source.sort[0].field = fieldId + '-' + fieldId;
                            //else
                            //    Knack.views[viewId].model.view.source.sort[0].field = fieldId;

                            //if (fieldAttr.type === 'date_time')
                            //    Knack.views[viewId].model.view.source.sort[0].order = invert ? 'asc' : 'desc';
                            //else
                            //    Knack.views[viewId].model.view.source.sort[0].order = invert ? 'desc' : 'asc';


                            //Temporary fix for the above code, until I find what's wrong with the random refresh.
                            if (fieldAttr.type === 'date_time')
                                Knack.views[viewId].model.view.source.sort[0].field = fieldId;
                            else
                                return;

                            Knack.views[viewId].model.view.source.sort[0].order = invert ? 'asc' : 'desc';

                            e.preventDefault();

                            Knack.showSpinner();
                            //jQuery.blockUI({ message: 'Please wait...' });
                            jQuery.blockUI({
                                message: '',
                                //css: { backgroundColor: '#f00', color: '#fff' },
                                overlayCSS: {
                                    backgroundColor: '#ddd',
                                    opacity: 0.2,
                                    //cursor: 'wait'
                                },
                            })

                            ktl.views.refreshView(viewId)
                                .then(function () {
                                    //For some reason, we need a second refreshe, otherwise order is wrong.  TODO: Need to find a better solution.
                                    ktl.views.refreshView(viewId)
                                        .then(function () {
                                            Knack.hideSpinner();
                                            jQuery.unblockUI();
                                        })
                                })
                        }
                    }
                }
            },

            submitAndWait: function (viewId = '', formData = {}) {
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
                                //console.log('success, failure:', success, failure);//$$$
                                success && resolve({
                                    outcome: 'submitAndWait, ' + viewId + ' : ' + success,
                                    record: resultRecord
                                });
                                failure && reject('submitAndWait, ' + viewId + ' : ' + failure);
                                return;
                            }
                        }, 200);

                        setTimeout(function () { //Failsafe
                            clearInterval(intervalId);
                            reject('submitAndWait timeout error');
                        }, 15000);
                    }
                    catch (e) {
                        reject(e);
                    }
                })
            },
        }
    })();

    //====================================================
    //Scenes feature
    this.scenes = (function () {
        var spinnerCtrReload = 30;
        var spinnerCtr = spinnerCtrReload;
        var spinnerInterval = null;
        var spinnerWdExcludeScn = [];
        var spinnerWdRunning = false;
        var idleTimer = null;
        var kioskButtons = {};
        var prevScene = '';

        //App callbacks
        var onSceneRender = null;
        var autoFocus = null;
        var idleWatchDogTimout = null;
        var spinnerWatchDogTimeout = null;

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (Knack.router.current_scene_key !== scene.key) {
                alert('ERROR - Scene keys do not match!');
                return;
            }

            if (!window.self.frameElement && !ktl.core.isKiosk()) //If not an iFrame, put back header hidden by CSS.
                document.querySelector("#kn-app-header").style.display = 'block';

            ktl.scenes.spinnerWatchdog(true);
            ktl.iFrameWnd.create();
            ktl.views.autoRefresh();
            ktl.scenes.resetIdleWatchdog();
            ktl.fields.convertNumToTel();

            //Handle Scene change.
            if (prevScene != scene.key) {
                var menu = ktl.core.getMenuInfo().menu;
                (ktl.core.getCfg().showMenuInTitle && menu) && (document.title = Knack.app.attributes.name + ' - ' + menu); //Add menu to browser's tab.

                if (prevScene) //Do not log navigation on first page - useless and excessive.  We only want transitions.
                    ktl.log.addLog(ktl.const.LS_NAVIGATION, JSON.stringify(ktl.core.getMenuInfo()));

                prevScene = scene.key;
            }

            const LS_SW_VERSION = 'SW_VERSION';
            var lastSavedVersion = ktl.storage.lsGetItem(LS_SW_VERSION);
            if (!lastSavedVersion || lastSavedVersion !== SW_VERSION) {
                ktl.log.addLog(ktl.const.LS_WRN, 'KEC_1013 - Updated to SW_VERSION: ' + SW_VERSION); //TODO:  change type to Info
                ktl.storage.lsSetItem(LS_SW_VERSION, SW_VERSION);
            }

            onSceneRender && onSceneRender(event, scene);
        })

        $(document).on('knack-view-render.any', function (event, view, data) {
            //Kiosk buttons must be added each time a view is rendered, otherwise they disappear after a view's refresh.
            ktl.scenes.addKioskButtons();
        })

        $(document).on('click', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('keypress', function (e) { ktl.scenes.resetIdleWatchdog(); })
        $(document).on('mousemove', function (e) { ktl.scenes.resetIdleWatchdog(); })

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.idleWatchDogDelay && (idleWatchDogDelay = cfgObj.idleWatchDogDelay);
                cfgObj.autoFocus && (autoFocus = cfgObj.autoFocus);
                cfgObj.kioskButtons && (kioskButtons = cfgObj.kioskButtons);
                cfgObj.spinnerWdExcludeScn && (spinnerWdExcludeScn = cfgObj.spinnerWdExcludeScn);
                cfgObj.onSceneRender && (onSceneRender = cfgObj.onSceneRender);
                cfgObj.spinnerCtrReload && (spinnerCtrReload = cfgObj.spinnerCtrReload);
                cfgObj.idleWatchDogTimout && (idleWatchDogTimout = cfgObj.idleWatchDogTimout);
                cfgObj.spinnerWatchDogTimeout && (spinnerWatchDogTimeout = cfgObj.spinnerWatchDogTimeout);
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

            refreshScene: function () {
                //console.log('ktl.scenes.refreshScene.caller =', ktl.scenes.refreshScene.caller);
                var views = Object.entries(Knack.views);
                for (var i = 0; i < views.length; i++)
                    ktl.views.refreshView(views[i][0]);
            },

            //Add default extra buttons to facilitate Kiosk mode:  Refresh, Back, Done and Messaging
            //Excludes all iFrames and all view titles must not contain NO_BUTTONS flag.
            addKioskButtons: function (style = {}) {
                if (window.self.frameElement || !ktl.core.isKiosk())
                    return;

                var exit = false;
                var backBtnText = '';
                for (var viewId in Knack.views) {
                    var view = Knack.views[viewId];
                    if (Knack.router.scene_view.model.views._byId[viewId] && view && view.model.view.title) {
                        //console.log('view.model.view.title =', view.model.view.title);
                        if (view.model.view.title.includes('NO_BUTTONS'))
                            exit = true;
                        else {
                            if (view.model.view.title.includes('ADD_BACK'))
                                backBtnText = 'Back';
                            else if (view.model.view.title.includes('ADD_DONE'))
                                backBtnText = 'Done';
                        }
                    }
                }

                if (exit) return;

                var addBackBtn = false;

                if (backBtnText !== '')
                    addBackBtn = true;

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
                var refreshBtn = document.getElementById('kn-button-refresh');
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

                        //Exceptions, where we want to jump to an specific URL.
                        var href = $('#' + kioskButtons[backOrDone].id).attr('href');
                        if (href)
                            window.location.href = window.location.href.slice(0, window.location.href.indexOf('#') + 1) + href;
                        else
                            kioskButtons[backOrDone].href();
                    });
                }

                var hasSubmitButton = true;
                var submitBar = document.getElementsByClassName('kn-submit');
                //console.log('submitBar =', submitBar.length);
                if (submitBar.length === 0) {
                    submitBar = document.getElementsByTagName('h2'); //Happens with pages without a Submit button.  Ex:  Lamination Terminal.
                    if (submitBar.length === 0) {
                        //alert('ERROR - View Header is null'); //Important that someone sees this since it should never happen.
                        return;
                    } else {
                        $('.view-header > h2').css('display', 'inline-flex'); //Prevent Refresh button from being too low due to Block display style.
                        hasSubmitButton = false;
                    }
                } else {
                    //Add shift Button right next to Submit.
                    var shiftBtn = document.getElementById(kioskButtons.ADD_SHIFT.id);
                    if (kioskButtons.ADD_SHIFT && !shiftBtn && !kioskButtons.ADD_SHIFT.scenesToExclude.includes(Knack.router.current_scene_key)) {
                        shiftBtn = document.createElement('BUTTON');
                        shiftBtn.classList.add('kn-button');
                        shiftBtn.style.marginLeft = '30px';
                        shiftBtn.id = kioskButtons.ADD_SHIFT.id;

                        submitBar[0].appendChild(shiftBtn);
                        kioskButtons.ADD_SHIFT.html(ktl.userPrefs.getUserPrefs().workShift);

                        shiftBtn.addEventListener('click', function (e) {
                            e.preventDefault();
                            window.location.href = kioskButtons.ADD_SHIFT.href;
                        });
                    }
                }

                if ($('.kn-menu').length === 0) { //No menu, just a plain terminal.
                    $('.kn-submit').css('display', 'flex');
                    var extraButtonsBar = document.getElementsByClassName('extraButtonsBar');
                    if (extraButtonsBar.length === 0) {
                        extraButtonsBar = document.createElement('div');
                        extraButtonsBar.setAttribute('class', 'extraButtonsBar');
                        submitBar[0].appendChild(extraButtonsBar);
                        $('.extraButtonsBar').css({ 'position': 'absolute', 'right': '2%' });
                        //console.log('Creating extraButtonsBar =', extraButtonsBar);
                        backBtn && extraButtonsBar.appendChild(backBtn); //Then add Menu bar to Submit bar
                        refreshBtn && extraButtonsBar.appendChild(refreshBtn);
                        messagingBtn && extraButtonsBar.appendChild(messagingBtn);
                    } else {
                        backBtn && extraButtonsBar[0].appendChild(backBtn); //Then add Menu bar to Submit bar
                        refreshBtn && extraButtonsBar[0].appendChild(refreshBtn);
                        messagingBtn && extraButtonsBar[0].appendChild(messagingBtn);
                    }
                } else { //Page has menu buttons.
                    var knMenuBar = document.getElementsByClassName('kn-menu');
                    backBtn && knMenuBar[0].appendChild(backBtn);

                    //Add Refresh at end of menu.
                    refreshBtn && knMenuBar[0].appendChild(refreshBtn);
                    messagingBtn && knMenuBar[0].appendChild(messagingBtn);

                    //Then add Menu bar to Submit bar, if there's one.
                    if (submitBar[0].classList.contains('kn-submit'))
                        submitBar[0].appendChild(knMenuBar[0]);

                    $('.kn-submit').css({ 'display': 'inline-flex', 'width': '100%' });
                    $('.kn-menu').css({ 'display': 'inline-flex', 'position': 'absolute', 'right': '1%' });
                    $('.kn-menu > div').css({ 'margin-right': '20px' });
                }

                //Make all buttons same size and style.
                if (!$.isEmptyObject(style))
                    $('.kn-button').css(style);
                else
                    $('.kn-button').css({ 'font-size': '20px', 'background-color': '#5b748a!important', 'color': '#ffffff', 'height': '40px', 'line-height': '0px' });

                $('.kiosk-btn').css({ 'margin-left': '20px' });

                if (!hasSubmitButton)
                    $('.kn-button').css({ 'height': '33px' });
            },

            spinnerWatchdog: function (run = true) {
                if (!ktl.core.getCfg().enabled.spinnerWatchDog || spinnerWdExcludeScn.includes(Knack.router.current_scene_key))
                    return;

                if (run) {
                    //ktl.log.clog('WD running ' + Knack.router.current_scene_key, 'green');
                    clearInterval(spinnerInterval);
                    spinnerCtr = spinnerCtrReload;
                    spinnerInterval = setInterval(function () {
                        if ($('#kn-loading-spinner').is(':visible') ||
                            $('.kn-spinner').is(':visible') ||
                            $('.kn-button.is-primary').is(':disabled')) {
                            if (spinnerCtr-- > 0) {
                                if (spinnerCtr < spinnerCtrReload - 5)
                                    ktl.core.timedPopup('Please wait... ' + (spinnerCtr + 1).toString() + ' seconds', 'success', 1100); //Allow a 100ms overlap to prevent blinking.
                            } else {
                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1010 - Spinner Watchdog Timeout in ' + Knack.router.current_scene_key); //@@@ Replace by a weekly counter.
                                spinnerWatchDogTimeout && spinnerWatchDogTimeout(); //Callback to your App for proper handling.
                            }
                        } else {
                            spinnerCtr = spinnerCtrReload;
                        }
                    }, 1000);
                } else {
                    clearInterval(spinnerInterval);
                    //ktl.log.clog('WD stopped ' + Knack.router.current_scene_key, 'purple');
                }

                spinnerWdRunning = run;
            },

            isSpinnerWdRunning: function () {
                return spinnerWdRunning;
            },

            //Attention gatherer or status outcome indicator.
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
                if (!ktl.core.getCfg().enabled.idleWatchDog) return;

                clearTimeout(idleTimer);
                idleTimer = setTimeout(function () {
                    if (Knack.router.current_scene_key !== ktl.iFrameWnd.getCfg().iFrameScnId)
                        idleWatchDogTimout && idleWatchDogTimout();
                }, ktl.scenes.getCfg().idleWatchDogDelay);
            },

            findViewWithTitle: function (srch = '', exact = false) {
                var views = Object.entries(Knack.views);
                var title = '';
                var viewId = '';
                srch = srch.toLowerCase();
                for (var i = 0; i < views.length; i++) {
                    viewId = views[i][0];
                    title = views[i][1].model.view.title.toLowerCase();
                    if (exact && title === srch) return viewId;
                    if (title.includes(srch)) return viewId;
                }
                return '';
            },

            scrollToTop: function () {
                document.body.scrollTop = 0; // For Safari
                document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
            },

            addVersionNumber: function (info, style = '') {
                if (!ktl.core.getCfg().showAppInfo || window.self.frameElement) return;

                //By default, version numbers are added at top right of screen
                if ($('#verButtonId').length === 0) {
                    var ktlVer = ktl.core.getCfg().showKtlInfo ? '    KTL v' + KTL_VERSION : '';
                    var appName = Knack.app.attributes.name.toUpperCase();
                    var versionInfo = appName + '    v' + SW_VERSION + ktlVer + '    ' + info.hostname;

                    ktl.fields.addButton(document.body, versionInfo, style, [], 'verButtonId');

                    $('#verButtonId').on('click touchstart', function(e) {
                        e.preventDefault();
                        var ver = prompt('Which version to run, "prod" or "beta"?', 'prod');
                        if (ver === 'prod' || ver === 'beta') {
                            ktl.storage.lsSetItem('USE_VER', ver);
                            location.reload(true);
                        }
                    })
                }
            },
        }
    })(); //Scenes

    //====================================================
    //Logging feature
    this.log = (function () {
        var lastDetails = ''; //Prevent multiple duplicated logs.
        var mouseClickCtr = 0;
        var keyPressCtr = 0;
        var isActive = false;
        var logCategoryAllowed = null; //Callback function in your app that returns whether or not a category is to be logged, based on specific conditions.

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (logCategoryAllowed && logCategoryAllowed(ktl.const.LS_ACTIVITY) && !mouseClickCtr && !keyPressCtr)
                monitorActivity();
        })

        function monitorActivity() {
            if (isActive)
                return;
            else
                isActive = true;

            if (window.self.frameElement && window.self.frameElement.id === IFRAME_WND_ID)
                return;

            if (ktl.storage.hasLocalStorage() && Knack.getUserAttributes() !== 'No user found') {
                $(document).on('click', function (e) { mouseClickCtr++; })
                $(document).on('keypress', function (e) { keyPressCtr++; })

                var actStr = ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id);
                if (!actStr) {
                    //Doesn't exist, create activity entry.
                    ktl.log.addLog(ktl.const.LS_ACTIVITY, JSON.stringify([{ mc: 0, kp: 0 }]));
                } else {
                    //Every 5 seconds, update user Keyboard and Mouse activity counters in localStorage.
                    setInterval(function () {
                        if (mouseClickCtr > 0 || keyPressCtr > 0) {
                            var newMC = 0;
                            var newKP = 0;

                            var actStr = ktl.storage.lsGetItem(ktl.const.LS_ACTIVITY + Knack.getUserAttributes().id);
                            if (!actStr) {
                                ktl.log.addLog(ktl.const.LS_ACTIVITY, JSON.stringify([{ mc: mouseClickCtr, kp: keyPressCtr }]));
                            } else {
                                var activity = JSON.parse(actStr);
                                var details = JSON.parse(activity[0].details);
                                if (details.length > 0) {
                                    newMC = details[0].mc + mouseClickCtr;
                                    newKP = details[0].kp + keyPressCtr;
                                    ktl.log.addLog(ktl.const.LS_ACTIVITY, JSON.stringify([{ mc: newMC, kp: newKP }]));
                                    ktl.log.resetActivityCtr();
                                }
                            }
                        }
                    }, 5000);
                }
            }
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.logCategoryAllowed && (logCategoryAllowed = cfgObj.logCategoryAllowed);
            },

            clog: function (msg = '', color = 'black') {
                console.log('%c' + msg, 'color:' + color + ';font-weight:bold');
            },

            clog2: function (color = 'black', ...msgArray) {
                var msg = '';
                for (var i = 0; i < msgArray.length; i++)
                    msg += msgArray[i] + ', ';
                msg = msg.slice(0, -2);
                console.log('%c' + msg, 'color:' + color + ';font-weight:bold');
            },

            objSnapshot: function (logMsg, obj) {
                console.log(logMsg, JSON.parse(JSON.stringify(obj)));
            },

            // Adds a new log for a given category in the logs accumulator.
            // These logs are stored in localStorage, and each new one is inserted
            // at the beginning of the array to get the most recent at top.
            addLog: function (category = '', details = '') {
                if (category === '' || details === '' || lastDetails === details)
                    return;

                //Use app's callback to check if log category is allowed.
                if (logCategoryAllowed && !logCategoryAllowed(category)) {
                    //ktl.log.clog('Skipped log category ' + category, 'purple');
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
                    ktl.log.clog('Error in addLog: Found invalid type.', 'purple');
                    return;
                }

                lastDetails = details;

                var logObj = {
                    dt: ktl.core.getCurrentDateTime(true, true, true, true),
                    type: type,
                    details: details
                };

                //Read logs as a string.
                var currentLogs = ktl.storage.lsGetItem(category + Knack.getUserAttributes().id);
                if (!currentLogs)
                    currentLogs = '[]';

                var logArray = JSON.parse(currentLogs); //Convert them to a JS object.
                if (category === ktl.const.LS_ACTIVITY) { //Activity is a special case, where only one entry is present.
                    if (logArray.length === 0)
                        logArray.push(logObj);
                    else
                        logArray[0] = logObj; //Update existing.
                } else
                    logArray.unshift(logObj); //Add at beginning of array.

                ktl.storage.lsSetItem(category + Knack.getUserAttributes().id, JSON.stringify(logArray)); //Convert back to string and save to ls.

                //Also show some of them in console.
                if (category === ktl.const.LS_WRN || category === ktl.const.LS_CRITICAL || category === ktl.const.LS_APP_ERROR || category === ktl.const.LS_SERVER_ERROR) {
                    var color = 'purple';
                    if (category === ktl.const.LS_WRN)
                        color = 'orangered';
                    ktl.log.clog(type + ' - ' + details, color);
                }
            },

            // Returns the oldest log's date/time from array.
            // Resolution is 1 hour.
            getLogArrayAge: function (category = '') {
                if (category === '')
                    return;

                var currentLog = ktl.storage.lsGetItem(category + Knack.getUserAttributes().id);
                if (!currentLog)
                    currentLog = '[]';

                var logArray = JSON.parse(currentLog);
                //console.log('logArray.length = ', category, logArray.length);
                if (logArray.length > 0) {
                    var oldestLogDT = new Date();
                    oldestLogDT.setTime(Date.parse(logArray[logArray.length - 1].dt.substring(0, 19))); //Remember logs are prepended, i.e. [0] is most recent, [length-1] is oldest log.
                    oldestLogDT.setHours(oldestLogDT.getHours(), 0, 0, 0);

                    var dateNow = new Date();
                    dateNow.setHours(dateNow.getHours(), 0, 0, 0);

                    var hoursElapsed = (dateNow.getTime() - oldestLogDT.getTime()) / 3600000;
                    //console.log('hoursElapsed = ', hoursElapsed);
                    return hoursElapsed;
                } else
                    return null;
            },

            resetActivityCtr: function () {
                mouseClickCtr = 0;
                keyPressCtr = 0;
            },
        }
    })();

    //====================================================
    //User Preferences feature
    this.userPrefs = (function () {
        var userPrefsObj = {
            dt: new Date(1970, 0, 1),
            showViewId: false,
            showExtraDebugInfo: false,
            showIframeWnd: false,
            showDebugWnd: false,
            workShift: 'A'
            //TODO:  allow dynamically adding more as per user requirements.
        };


        var myUserPrefsViewId = '';
        //Should we move user prefs field id also here?

        //App Callbacks
        var allowShowPrefs = null; //Determines what prefs can be shown, based on app's rules.
        var applyUserPrefs = null; //Apply your own prefs.

        //Convert old prefs to new ones.
        var lsPrefsStr = localStorage.getItem(Knack.app.attributes.name + '_' + ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id);
        if (lsPrefsStr) {
            if (lsPrefsStr.includes('showId')) {
                userPrefsObj = JSON.parse(lsPrefsStr);
                userPrefsObj.showViewId = userPrefsObj.showId;
                userPrefsObj.showExtraDebugInfo = userPrefsObj.allowDebug;
                userPrefsObj.showIframeWnd = userPrefsObj.showIFrame;
                userPrefsObj.workShift = userPrefsObj.workShift;

                delete userPrefsObj.showId;
                delete userPrefsObj.allowDebug;
                delete userPrefsObj.showIFrame;

                lsPrefsStr = JSON.stringify(userPrefsObj);
                localStorage.setItem(Knack.app.attributes.name + '_' + ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id, lsPrefsStr);

                ktl.debugWnd.lsLog('KTL - Converted old prefs format...');
                ktl.log.addLog(ktl.const.LS_WRN, 'New app - PREFS_UPGRADE: user preferences have been converted.');
            }
        }

        readUserPrefsFromLs();
        var lastUserPrefs = ktl.storage.lsGetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id); //Used to detect prefs changes.

        //console.log('userPrefsObj =', userPrefsObj);
        function readUserPrefsFromLs() { //Use Try Catch to prevent white screen.
            var lsPrefsStr = ktl.storage.lsGetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id);
            if (lsPrefsStr)
                userPrefsObj = JSON.parse(lsPrefsStr);

            return lsPrefsStr; //Return string version.
        }

        $(document).on('knack-view-render.any', function (event, view, data) {
            if (view.key === ktl.iFrameWnd.getCfg().curUserPrefsViewId /*USER_PREFS_CUR - read-only autorefresh view*/) {
                var fieldId = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
                if (!fieldId) return;

                //Add iFrameRefresh=true to user prefs and this will force a iFrameWnd refresh.
                //Can be useful sometimes to trigger on/off views via Page Rules.
                if (data[fieldId].includes('iFrameRefresh')) {
                    var prefsTmpObj = JSON.parse(data[fieldId]);
                    delete prefsTmpObj['iFrameRefresh'];
                    var updatedPrefs = JSON.stringify(prefsTmpObj);
                    ktl.views.submitAndWait(ktl.iFrameWnd.getCfg().updUserPrefsViewId /*USER_PREFS_UPD*/, { [fieldId]: updatedPrefs })
                        .then(success => { location.reload(true); })
                        .catch(failure => { ktl.log.clog('iFrameRefresh failure: ' + failure, 'red'); })
                } else {
                    if (data[fieldId] && (data[fieldId] !== lastUserPrefs)) {
                        ktl.log.clog('Prefs have changed!!!!', 'blue');

                        lastUserPrefs = data[fieldId];

                        ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id, data[fieldId]);
                        ktl.wndMsg.send('userPrefsChangedMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP);

                        ktl.userPrefs.applyUserPrefs();
                    } else if (!data[fieldId] || data[fieldId].includes('showId')) {
                        //If nothing yet, or old format, use default object: 1970, etc.
                        var defaultUserPrefsObj = {
                            dt: new Date(1970, 0, 1),
                            showViewId: false,
                            showExtraDebugInfo: false,
                            showIframeWnd: false,
                            showDebugWnd: false,
                            workShift: 'A'
                        };

                        //ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id, JSON.stringify(defaultUserPrefsObj));
                        var acctUserPrefsFld = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
                        var updUserPrefsViewId = ktl.iFrameWnd.getCfg().updUserPrefsViewId;
                        if (!updUserPrefsViewId || !acctUserPrefsFld) return;

                        document.querySelector('#' + acctUserPrefsFld).value = JSON.stringify(defaultUserPrefsObj);
                        document.querySelector('#' + updUserPrefsViewId + ' .kn-button.is-primary').click();
                        ktl.log.clog('Uploading default prefs to cloud', 'green');
                    }
                }
            } else if (view.key === ktl.userPrefs.getCfg().myUserPrefsViewId /*USER_PREFS_SET - form for user to update his own prefs*/) {
                var fieldId = ktl.iFrameWnd.getCfg().acctUserPrefsFld;
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
                        sendPrefsChangedMsg();
                    });
                }

                if (allow.showIframe) {
                    var showIframeWndCb = ktl.fields.addCheckbox(prefsBar, 'Show iFrameWnd', userPrefsTmp.showIframeWnd);
                    showIframeWndCb.addEventListener('change', e => {
                        userPrefsTmp.showIframeWnd = e.target.checked;
                        sendPrefsChangedMsg();
                    });
                }

                if (allow.showDebugWnd) {
                    var showDebugWndCb = ktl.fields.addCheckbox(prefsBar, 'Show DebugWnd', userPrefsTmp.showDebugWnd);
                    showDebugWndCb.addEventListener('change', e => {
                        userPrefsTmp.showDebugWnd = e.target.checked;
                        sendPrefsChangedMsg();
                    });
                }

                if (allow.showExtraDebugInfo) {
                    var showExtraDebugCb = ktl.fields.addCheckbox(prefsBar, 'Show Extra Debug', userPrefsTmp.showExtraDebugInfo);
                    showExtraDebugCb.addEventListener('change', e => {
                        userPrefsTmp.showExtraDebugInfo = e.target.checked;
                        sendPrefsChangedMsg();
                    });
                }

                function sendPrefsChangedMsg() {
                    userPrefsTmp.dt = ktl.core.getCurrentDateTime(true, true, false, true);
                    document.querySelector('#' + fieldId).value = JSON.stringify(userPrefsTmp);
                }
            }
        })

        $(document).on('knack-scene-render.any', function (event, scene) {
            ktl.userPrefs.applyUserPrefs();
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

            applyUserPrefs: function (refreshScene = false) {
                ktl.debugWnd.showDebugWnd(ktl.userPrefs.getUserPrefs().showDebugWnd);
                ktl.iFrameWnd.showIFrame(ktl.userPrefs.getUserPrefs().showIframeWnd);
                for (var viewId in Knack.views)
                    ktl.views.addViewId(Knack.views[viewId].model.view);

                var myUserPrefsViewId = ktl.userPrefs.getCfg().myUserPrefsViewId;
                myUserPrefsViewId && ktl.views.refreshView(myUserPrefsViewId);

                if (refreshScene && !applyUserPrefs)
                    ktl.scenes.refreshScene();
                applyUserPrefs && applyUserPrefs(refreshScene);
            },
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
        var logLogin = true; //Get rid of this
        $(document).on('click', function (e) {
            if (e.target.value === 'Sign In' && e.target.type === 'submit') {
                var sel = $('.kn-login-form > form > input');
                if (sel && sel.length > 0) {
                    //lsLog('User attempting to log-in...');
                    postLoginEvent()
                        .then(function (result) {
                            var menuInfo = ktl.core.getMenuInfo();
                            if (result === LOGIN_SUCCESSFUL) {
                                result = JSON.stringify({ result: result, sw_version: SW_VERSION, page: menuInfo, agent: navigator.userAgent });
                                if (logLogin) {
                                    logLogin = false;
                                    ktl.log.addLog(ktl.const.LS_LOGIN, result);
                                }

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
            getRoleNames: function () {
                return Knack.getUserRoleNames();
            },
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
        const LOGGING_DELAY = ONE_HOUR_DELAY;

        //TODO: Put all this in an object like core:  var cfg = {...
        var iFrameWnd = null;
        var iFrameReady = false;
        var iFrameTimeout = null;

        //Scene and views
        var iFrameScnId = '';
        var hbViewId = '';
        var curUserPrefsViewId = '';
        var updUserPrefsViewId = '';
        var accountLogsViewId = '';

        //Account fields
        var acctSwVersionFld = '';
        var acctUtcHbFld = '';
        var acctLocHbFld = '';
        var acctUserPrefsFld = '';
        var acctWorkShiftFld = '';

        //Account Logs fields
        var alLogTypeFld = '';
        var alDetailsFld = '';
        var alLogIdFld = '';

        var highPriorityLoggingTimer = null;
        var lowPriorityLoggingTimer = null;


        //High priority logs, sent every minute.
        var highPriorityLogs = [
            { type: ktl.const.LS_CRITICAL, typeStr: ktl.const.LS_CRITICAL_STR },
            { type: ktl.const.LS_LOGIN, typeStr: ktl.const.LS_LOGIN_STR },
            { type: ktl.const.LS_WRN, typeStr: ktl.const.LS_WRN_STR },
            { type: ktl.const.LS_APP_ERROR, typeStr: ktl.const.LS_APP_ERROR_STR },
        ];

        //Lower priority logs, accumulated in localStorage and sent every 3 hours.
        var lowPriorityLogs = [
            { type: ktl.const.LS_ACTIVITY, typeStr: ktl.const.LS_ACTIVITY_STR },
            { type: ktl.const.LS_NAVIGATION, typeStr: ktl.const.LS_NAVIGATION_STR },
            { type: ktl.const.LS_SERVER_ERROR, typeStr: ktl.const.LS_SERVER_ERROR_STR }
        ];

        $(document).on('knack-scene-render.any', function (event, scene) {
            if (window.self.frameElement && window.self.frameElement.id === IFRAME_WND_ID) {
                var intervalId = setInterval(function () { //Wait until ready HB field is ready.
                    if (ktl.iFrameWnd.getCfg().hbViewId !== '') {
                        clearInterval(intervalId);
                        clearTimeout(timeout);
                        ktl.wndMsg.send('iFrameWndReadyMsg', 'req', IFRAME_WND_ID, ktl.const.MSG_APP, 0, SW_VERSION);
                        startHighPriorityLogging();
                        startLowPriorityLogging();
                    }
                }, 20);

                var timeout = setTimeout(function () { //Failsafe
                    clearInterval(intervalId);
                    ktl.log.clog('iFrameWndReadyMsg timeout', 'purple');
                }, 30000);
            }
        })

        function startHighPriorityLogging() {
            clearInterval(highPriorityLoggingTimer);
            highPriorityLoggingTimer = setInterval(() => {
                //Send high-priority logs now.
                (function sequentialSubmit(ix) {
                    var checkNext = false;
                    var el = highPriorityLogs[ix];
                    var details = ktl.storage.lsGetItem(el.type + Knack.getUserAttributes().id);
                    if (details && details.length) {
                        if (el.type === ktl.const.LS_CRITICAL || el.type === ktl.const.LS_LOGIN || el.type === ktl.const.LS_WRN || el.type === ktl.const.LS_APP_ERROR) {
                            ktl.log.clog('Submitting priority log for: ' + el.typeStr, 'purple');

                            var logId = ktl.core.getCurrentDateTime(true, true, true, true).replace(/[\D]/g, ''); //Unique message identifier used validate that transmission was successfull, created from a millisecond timestamp.
                            if (el.type === ktl.const.LS_CRITICAL) { //In this case, send via email directly first.
                                console.log('found critical error log'); //TODO Send email
                            } else {
                                var viewId = ktl.iFrameWnd.getCfg().accountLogsViewId;
                                if (viewId) {
                                    var apiData = {};
                                    apiData[alLogIdFld] = logId;
                                    apiData[alLogTypeFld] = el.typeStr;
                                    apiData[alDetailsFld] = details;
                                    ktl.core.knAPI(viewId, null, apiData, 'POST', [], false)
                                        .then(function (result) {
                                            //@@@ TODO: Use logId as a feedback to delete them.
                                            ktl.storage.lsRemoveItem(el.type + Knack.getUserAttributes().id);
                                            checkNext = true;
                                        })
                                        .catch(function (reason) {
                                            ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1015 - Failed posting high-priority log in sequentialSubmit ' + ix + ', ' + reason);
                                        })
                                }
                            }
                        } else
                            checkNext = true;
                    } else
                        checkNext = true;

                    if (checkNext && ++ix < highPriorityLogs.length)
                        sequentialSubmit(ix);
                })(0);
            }, 10000);
        }

        function startLowPriorityLogging() {
            // - Submit all accumulated low-priority logs.
            // - Check what needs to be uploaded, i.e. non-empty arrays, older than LOGGING_DELAY, send them in sequence.
            // - Submit to Knack if activity or other log accumulator has changed.
            clearInterval(lowPriorityLoggingTimer);
            lowPriorityLoggingTimer = setInterval(() => {
                (function sequentialSubmit(ix) {
                    var checkNext = false;
                    var el = lowPriorityLogs[ix];
                    var oldestLog = ktl.log.getLogArrayAge(el.type);
                    if (oldestLog !== null) {
                        //lsLog('Found non-empty logs: ' + el.typeStr);
                        //console.log('Oldest log for ', el.type, 'is', oldestLog);

                        if (oldestLog >= 3 /*Logs must be older than 3 hours to be sent, to reduce nb of records*/) {
                            //lsLog('Submitting logs for: ' + el.typeStr);

                            var details = ktl.storage.lsGetItem(el.type + Knack.getUserAttributes().id);
                            if (details && details.length) {
                                if (el.type === ktl.const.LS_ACTIVITY && (details.substring(66, 81) === 'mc\\":0,\\"kp\\":0')) //Do not send zero activity.
                                    checkNext = true;
                                else {
                                    var viewId = ktl.iFrameWnd.getCfg().accountLogsViewId;
                                    if (viewId) {
                                        var logId = ktl.core.getCurrentDateTime(true, true, true, true).replace(/[\D]/g, '');
                                        var apiData = {};
                                        apiData[alLogIdFld] = logId;
                                        apiData[alLogTypeFld] = el.typeStr;
                                        apiData[alDetailsFld] = details;
                                        ktl.core.knAPI(viewId, null, apiData, 'POST', [], false)
                                            .then(function (result) {
                                                //@@@ TODO: Use wndMsg queue instead and logId as a feedback before deleting the stored logs.
                                                ktl.storage.lsRemoveItem(el.type + Knack.getUserAttributes().id);
                                                checkNext = true;
                                            })
                                            .catch(function (reason) {
                                                ktl.log.addLog(ktl.const.LS_APP_ERROR, 'KEC_1016 - Failed posting low-priority log in sequentialSubmit ' + ix + ', ' + reason);
                                            })
                                    }
                                }
                            }
                        } else
                            checkNext = true;
                    } else
                        checkNext = true;

                    if (checkNext && ++ix < lowPriorityLogs.length)
                        sequentialSubmit(ix);
                })(0);
            }, ktl.account.isDeveloper() ? 60000 : LOGGING_DELAY); //TODO: make configurable, and with a special short value for developers.
        }

        return {
            setCfg: function (cfgObj = {}) {
                cfgObj.iFrameScnId && (iFrameScnId = cfgObj.iFrameScnId);
                if (cfgObj.iFrameReady) {
                    iFrameReady = cfgObj.iFrameReady;
                    clearTimeout(iFrameTimeout);
                }

                cfgObj.curUserPrefsViewId && (curUserPrefsViewId = cfgObj.curUserPrefsViewId);
                cfgObj.hbViewId && (hbViewId = cfgObj.hbViewId);
                cfgObj.accountLogsViewId && (accountLogsViewId = cfgObj.accountLogsViewId);

                cfgObj.acctSwVersionFld && (acctSwVersionFld = cfgObj.acctSwVersionFld);
                cfgObj.acctUtcHbFld && (acctUtcHbFld = cfgObj.acctUtcHbFld);
                cfgObj.acctLocHbFld && (acctLocHbFld = cfgObj.acctLocHbFld);
                cfgObj.acctUserPrefsFld && (acctUserPrefsFld = cfgObj.acctUserPrefsFld);
                cfgObj.acctWorkShiftFld && (acctWorkShiftFld = cfgObj.acctWorkShiftFld);
                cfgObj.updUserPrefsViewId && (updUserPrefsViewId = cfgObj.updUserPrefsViewId);

                cfgObj.alLogTypeFld && (alLogTypeFld = cfgObj.alLogTypeFld);
                cfgObj.alDetailsFld && (alDetailsFld = cfgObj.alDetailsFld);
                cfgObj.alLogIdFld && (alLogIdFld = cfgObj.alLogIdFld);
            },

            getCfg: function () {
                return {
                    iFrameWnd,
                    iFrameReady,
                    iFrameScnId,
                    curUserPrefsViewId,
                    updUserPrefsViewId,
                    hbViewId,
                    accountLogsViewId,
                    acctSwVersionFld,
                    acctUtcHbFld,
                    acctLocHbFld,
                    acctUserPrefsFld,
                    acctWorkShiftFld,
                };
            },

            create: function () {
                if (!ktl.core.getCfg().enabled.iFrameWnd) return;

                var URL = Knack.scenes._byId[IFRAME_WND_ID] || Knack.scenes._byId['iframe-account-logs']; //TODO:  remove iframe-account-logs after switchover.
                if (!URL) return;
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

                    //If creation fails, re-create.
                    iFrameTimeout = setTimeout(() => {
                        ktl.log.clog('ERROR - iFrameWnd creation failed with timeout!', 'purple');
                        if (ktl.iFrameWnd.getiFrameWnd()) {
                            ktl.iFrameWnd.delete();
                            ktl.iFrameWnd.create();
                        }
                    }, 30000);
                }
            },

            delete: function () {
                if (iFrameWnd) {
                    ktl.wndMsg.removeAllMsgOfType('heartbeatMsg');
                    iFrameWnd.parentNode.removeChild(iFrameWnd);
                    iFrameWnd = null;
                }
            },

            showIFrame: function (show = false) {
                //console.log('iFrameWnd =', iFrameWnd);
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
                return iFrameWnd; //The actual object
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
                    if (ktl.userPrefs.getUserPrefs().showExtraDebugInfo)
                        ktl.log.clog('REQ: ' + event.data.msgType + ', ' + event.data.msgSubType + ', ' + msgId + ', ' + event.data.src + ', ' + event.data.dst + ', ' + event.data.retryCnt, 'darkcyan');

                    switch (event.data.msgType) {
                        case 'iFrameWndReadyMsg':
                            ktl.wndMsg.send('iFrameWndReadyMsg', 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                            ktl.iFrameWnd.setCfg({ iFrameReady: true });

                            if (event.data.msgData !== SW_VERSION) {
                                ktl.core.timedPopup('Updating app to new version, please wait...');
                                ktl.core.waitAndReload(2000);
                            }

                            startHeartbeat();

                            //Delete iFrameWnd and re-create periodically.  This is to check for a SW update.
                            setTimeout(function () {
                                //ktl.log.clog('Reloading frame', 'purple');
                                if (ktl.iFrameWnd.getiFrameWnd()) {
                                    ktl.iFrameWnd.delete();
                                    ktl.iFrameWnd.create();
                                }
                            }, FIVE_MINUTES_DELAY);
                            break;
                        case 'heartbeatMsg':
                            var viewId = ktl.iFrameWnd.getCfg().hbViewId;
                            if (!viewId) {
                                ktl.log.clog('Found heartbeatMsg with empty viewId', 'purple');
                                return;
                            }

                            var utcHb = ktl.core.getCurrentDateTime(true, false, false, true);
                            var locHB = new Date().valueOf();
                            var date = utcHb.substr(0, 10);
                            var fieldId = ktl.iFrameWnd.getCfg().acctUtcHbFld;
                            document.querySelector('#' + viewId + '-' + fieldId).value = date;
                            var time = utcHb.substr(11, 5);
                            document.querySelector('#' + viewId + '-' + fieldId + '-time').value = time;

                            //Wait until Submit is completed and ack parent
                            ktl.views.submitAndWait(viewId, { [ktl.iFrameWnd.getCfg().acctSwVersionFld]: SW_VERSION })
                                .then(success => {
                                    var after = Date.parse(success.record[ktl.iFrameWnd.getCfg().acctLocHbFld]);
                                    var diff = locHB - after;
                                    if (diff <= 60000) //One second discrepancy is common due to calculation delay when submit is minute-borderline.
                                        ktl.wndMsg.send('heartbeatMsg', 'ack', IFRAME_WND_ID, ktl.const.MSG_APP, msgId);
                                    else
                                        console.log('Missed HB, diff:', diff);
                                })
                                .catch(failure => {
                                    ktl.log.clog('Failure sending heartbeatMsg: ' + failure, 'red');
                                })
                            break;
                        case 'reloadPageMsg':
                            ktl.debugWnd.lsLog('Rxed msg: reloadPage');
                            setTimeout(() => {
                                if (typeof Android === 'object')
                                    Android.restartApplication()
                                else
                                    location.reload(true);
                            }, 200);
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
                                ktl.log.clog('Uploading prefs to cloud', 'green');

                                //Wait until Submit is completed and ack parent
                                $(document).on('knack-form-submit.' + formId, function (event, view, record) {
                                    ktl.wndMsg.send('userPrefsChangedMsg', 'ack', IFRAME_WND_ID, ktl.const.MSG_APP, msgId);
                                    ktl.views.refreshView(ktl.iFrameWnd.getCfg().curUserPrefsViewId);
                                });
                            } else { //iFrameWnd to App, when prefs changed remotely, by user or Sysop.
                                ktl.wndMsg.send('userPrefsChangedMsg', 'ack', ktl.const.MSG_APP, IFRAME_WND_ID, msgId);
                                ktl.userPrefs.applyUserPrefs();
                            }
                            break;
                        default:
                            processAppMsg && processAppMsg(event);
                            break;
                    }
                } else if (event.data.msgSubType === 'ack') {
                    if (ktl.userPrefs.getUserPrefs().showExtraDebugInfo)
                        ktl.log.clog('ACK: ' + event.data.msgType + ', ' + event.data.msgSubType + ', ' + msgId + ', ' + event.data.src + ', ' + event.data.dst + ', ' + event.data.retryCnt, 'darkcyan');

                    if (event.data.msgType === 'heartbeatMsg')
                        ktl.wndMsg.removeAllMsgOfType('heartbeatMsg');
                    else
                        removeMsg(msgId);
                }
            }
            catch (e) {
                ktl.log.clog('KTL message handler error:', 'purple');
                console.log(e);
            }
        })

        function startHeartbeat() {
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
        }

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

        function retryMsg (msgId = '') {
            if (--msgQueue[msgId].retryCnt > 0) {
                ktl.log.clog('RETRY MSG: ' + msgQueue[msgId].msgType + ', ' + msgId + ', ' + msgQueue[msgId].retryCnt, 'red');
                msgQueue[msgId].expiration = new Date().valueOf() + MSG_EXP_DELAY;
                ktl.wndMsg.send(msgQueue[msgId].msgType, msgQueue[msgId].msgSubType, msgQueue[msgId].src, msgQueue[msgId].dst, msgId, msgQueue[msgId].msgData);
            } else {
                ktl.log.clog('Msg Send MAX RETRIES Failed!!!', 'red');
                ktlProcessFailedMessages(msgId);
            }
        }

        function removeMsg(msgId = '') {
            if (msgQueue[msgId]) {
                delete msgQueue[msgId];
                if (ktl.userPrefs.getUserPrefs().showExtraDebugInfo)
                    console.log('Msg removed:', msgId);
            }
        }

        function ktlProcessFailedMessages (msgId = '') {
            var msgType = msgQueue[msgId].msgType;
            removeMsg(msgId);

            if (msgType === 'heartbeatMsg') {
                if (ktl.iFrameWnd.getiFrameWnd()) {
                    ktl.log.clog('iFrameWnd stopped responding.  Re-creating...', 'red');
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
            },

            send: function (msgType = '', msgSubType = '', src = '', dst = '', msgId = 0, msgData = null) {
                if (!msgType || !msgSubType) {
                    ktl.log.clog('Called Send with invalid parameters', 'purple');
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

        $(document).on('knack-view-render.any', function (event, view, data) {
            if (!ktl.core.getCfg().enabled.bulkOps.bulkEdit && !ktl.core.getCfg().enabled.bulkOps.bulkDelete) return;

            var viewModel = Knack.router.scene_view.model.views._byId[view.key];
            if (viewModel) {
                var viewAttr = viewModel.attributes;
                if (viewAttr.type === 'table') {
                    var inlineEditing = viewAttr.options ? viewAttr.options.cell_editor : false;
                    if (ktl.account.getRoleNames().includes('Bulk Delete') || (inlineEditing && ktl.account.getRoleNames().includes('Bulk Edit'))) {
                        ktl.bulkOps.enableBulkOperations(view, data);
                        if (bulkOpsInProgress)
                            processBulkOps();
                    }
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

        //Called to refresh the record array to be modified.
        //Can be changed by user clicks, table filtering change, view refresh.
        function updateBulkOpCheckboxes () {
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
                                ktl.core.removeInfoPopup();
                                ktl.views.refreshView(bulkOpsViewId).then(function () {
                                    setTimeout(function () {
                                        ktl.views.autoRefresh();
                                        ktl.scenes.spinnerWatchdog(true);
                                        alert('Operation completed successfully');
                                    }, 1000);
                                })
                            } else {
                                updateRecord(recIdArray);
                            }
                        })
                        .catch(function (reason) {
                            alert('Error code KEC_1017 while processing bulk operations: ' + reason);
                            ktl.core.removeInfoPopup();
                            ktl.views.autoRefresh();
                            ktl.scenes.spinnerWatchdog(true);
                        })
                })(bulkOpsRecIdArray);
            } else
                bulkOpsInProgress = false;
        }

        function addBulkDeleteButtons(view, data, div = null) {
            if (!ktl.core.getCfg().enabled.bulkOps.bulkDelete || !data.length || Knack.router.current_scene_key === ktl.iFrameWnd.getCfg().iFrameScnId)
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
                            var id = $(this).closest('tr').attr('id');
                            deleteArray.push(id);
                        }
                    });

                    ktl.scenes.spinnerWatchdog(false);
                    ktl.bulkOps.deleteRecords(deleteArray, view)
                        .then(function () {
                            ktl.scenes.spinnerWatchdog(true);
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
            //The entry point of the feature, where Bulk Ops is enabled per view, depending on account role permission.
            //Called upon each view rendering.
            enableBulkOperations: function (view, data) {
                ktl.views.addCheckboxesToTable(view.key, masterCheckBoxCallback);
                if (ktl.core.getCfg().enabled.bulkOps.bulkDelete && ktl.account.getRoleNames().includes('Bulk Delete'))
                    addBulkDeleteButtons(view, data);

                function masterCheckBoxCallback(numChecked) {
                    updateDeleteButtonStatus(view.key, numChecked);
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
            },

            //View param is view object, not view.key.
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
                                reject('knAPI - Failed to delete record ' + id + ' with reason: ' + reason);
                            })
                    })(deleteArray);
                })
            },
        }
    })();

    return { //KTL exposed objects
        const: this.const,
        core: this.core,
        storage: this.storage,
        scenes: this.scenes,
        views: this.views,
        fields: this.fields,
        bulkOps: this.bulkOps,
        userFilters: this.userFilters,
        persistentForm: this.persistentForm,
        account: this.account,
        userPrefs: this.userPrefs,
        iFrameWnd: this.iFrameWnd,
        debugWnd: this.debugWnd,
        log: this.log,
        wndMsg: this.wndMsg,
        sysInfo: this.sysInfo,
        systemColors: this.systemColors,
    };
}; //ktl end


//TODO:
//inlineEditChangeStyle: function () {
//necessary?... var msgId = event.data.msgId; //Keep a copy for ack.
//TODO:  remove iframe-account-logs after switchover.
//console.log('found critical error log'); //TODO Send email
//Use Try Catch to prevent white screen.
//ktl.core.waitSelector('#' + viewId + ' .kn-tag-filter', 5000, 'visible') //Instead, maybe try to wait until scene has rendered.
//TODO: Should only call this if really needed.
//Need to find a way to apply user filters to view where there are many reports (columns).  Currently, filters cause lots of refreshes.  Maybe pre-format URL once, then apply?
//Wait until Submit is completed and ack parent - convert to use submitAndWait
//Afer app starup, if iframe never acks its presence within X seconds, re-create it.
