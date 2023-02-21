//====================================================
//====================================================
var KnackApp = function ($, info = {}) {
    window.$ = $;

    window.APP_VERSION = '1.0.0'; //Your App version.

    const IFRAME_WND_ID = 'iFrameWnd';

    var ktl = new Ktl($, info);
    window.ktl = ktl;

    //====================================================
    //App constants - BEGIN
    //Add any constants shared between your app and the KTL, like scene, view and field IDs.
    const HOME_SCN = 'scene_1'; //As an example.
    //App constants - END

    //====================================================
    //KTL Setup - BEGIN
    (function () {
        ktl.core.setCfg({
            developerName: 'Firstname Lastname', //Put your name here to get super powers!
            developerEmail: '', //yourmail@provider.com
            enabled: { //Main KTL feature switches.  Here is where your App can override the defaults and enable/disable the features.
                showAppInfo: true,
                showKtlInfo: true,
                showMenuInTitle: true,
                selTextOnFocus: true,
                chznBetter: true,
                autoFocus: true,
                userFilters: true,
                persistentForm: true,
                debugWnd: true,
                idleWatchDog: true,
                spinnerWatchDog: true,

                //Those below nust also be properly setup to have any effect.  See documentation.
                iFrameWnd: false,
                logging: {
                    logins: false,
                    navigation: false,
                    activity: false,
                },

                bulkOps: {
                    bulkEdit: true,
                    bulkDelete: true,
                },
            },

            //Functions in this app.
            isKiosk: isKiosk,
        })

        //For Idle timeout delay in milliseconds, you can use a fixed value, or change it depending on the use case.
        //As an example, below I change it if it's a kiosk device.
        //Zero means disabled, so idleWatchDogTimeout() will never be called.
        var idleWatchDogDelay = 120 * 60000; //120 minutes (2 hours) by default.
        var spinnerCtrDelay = 60; //60 seconds of waiting is a good starting point.
        if (isKiosk()) {
            idleWatchDogDelay = 0; //Inactivity timeout is disabled by default for kiosks.
            spinnerCtrDelay = 45; //If ever Kiosks users are a bit less patient.
        }

        ktl.scenes.setCfg({
            onSceneRender: onSceneRender,
            autoFocus: autoFocus,
            idleWatchDogDelay: idleWatchDogDelay,
            idleWatchDogTimeout: idleWatchDogTimeout,
            spinnerWatchDogTimeout: spinnerWatchDogTimeout,
            spinnerCtrDelay: spinnerCtrDelay,
            spinnerWdExcludeScn: [],
        })

        ktl.views.setCfg({
            processViewKeywords: processViewKeywords,
            handleCalendarEventDrop: handleCalendarEventDrop,
        })

        ktl.fields.setCfg({
            onKeyPressed: onKeyPressed,
            onFieldValueChanged: onFieldValueChanged,
            textAsNumeric: [],
            textAsNumericExcludeScenes: [],
            //chznBetterSrchDelay: 2000, //Uncomment if you prefer longer delay.
            chznBetterThresholds: {
                'field_x': '4',
            },
            chznBetterToExclude: [],
            chznBetterSetFocus: chznBetterSetFocus,
        })

        ktl.persistentForm.setCfg({
            scenesToExclude: [],
            fieldsToExclude: ['field_xx', 'field_yy'], //Fields you never want to save.
        })

        ktl.systemColors.getSystemColors()
            .then(sc => {
                ktl.systemColors.setCfg({
                    inlineEditBkgColor: '', //Could also be some other presets in sysColors like: sc.paleLowSatClrTransparent
                    inlineEditFontWeight: '', //Can be 'bold' or a numeric value like 600.
                    tableRowHoverBkgColor: '', //Or a named color like 'mistyrose' or a hex RGBA value '#a0454b75'
                })
            })
            .catch((err) => { ktl.log.clog('red', 'App getSystemColors error: ' + err); })

        ktl.userPrefs.setCfg({
            allowShowPrefs: allowShowPrefs,
            applyUserPrefs: applyUserPrefs,
        })

        ktl.wndMsg.setCfg({
            processFailedMessages: processFailedMessages,
            processAppMsg: processAppMsg,
            sendAppMsg: sendAppMsg,
            processServerErrors: processServerErrors,
        })

        //Features that do not apply to the iFrameWnd.
        if (!window.self.frameElement) {
            ktl.scenes.setCfg({
                kioskButtons: {
                    ADD_REFRESH: {
                        html: '<i class="fa fa-refresh"></i>',
                        id: 'kn-button-refresh',
                        href: function () { location.reload(true) },
                        scenesToExclude: [],
                    },
                    ADD_MESSAGING: {
                        html: '<i class="fa fa-envelope-o"></i>',
                        id: 'kn-button-messaging',
                        href: window.location.href.slice(0, window.location.href.indexOf('#') + 1) + 'messaging',
                        scenesToExclude: [/*MESSAGING_SCN*/],
                    },
                    ADD_BACK: {
                        html: '<i class="fa fa-arrow-left"></i>',
                        id: 'kn-button-back',
                        href: function () { window.history.back(); },
                        scenesToExclude: [],
                    },
                    ADD_DONE: {
                        html: '<i class="fa fa-check-square-o"></i>',
                        id: 'kn-button-back',
                        href: function () { window.history.back(); },
                        scenesToExclude: [],
                    },
                    ADD_SHIFT: {
                        html: updateWorkShiftItems,
                        id: 'kn-button-shift',
                        href: window.location.href.slice(0, window.location.href.indexOf('#') + 1) + 'change-shift',
                        scenesToExclude: [/*CHANGE_SHIFT_SCN, MESSAGING_SCN*/],
                    },
                },

                versionDisplayName: Knack.app.attributes.name.toUpperCase(),
                //versionDisplayName: 'CTRND', //As an example, when you prefer to use a shorter name.
            })

            ktl.userFilters.setCfg({
                allowUserFilters: allowUserFilters,
            })

            ktl.log.setCfg({
                logCategoryAllowed: logCategoryAllowed,
            });
        }
    })();
    //KTL Setup - END
    //====================================================




    //====================================================
    //KTL callbacks to your App - BEGIN

    //====================================================
    //Same as $(document).on('knack-scene-render.any')
    //Called by KTL
    function onSceneRender(event, scene) {
        if (ktl.core.isKiosk()) {
            ktl.scenes.addVersionInfo(info, 'margin-left: 10px; margin-top: 2px; font-size:small; position:absolute; top:0; right:10px');
        } else {
            document.body.classList.add('show-menu');

            var versionStyle = '';
            var bottomCenter = false; //Set this to true to have the version info at bottom center of page, as an example.
            if (bottomCenter)
                versionStyle = 'white-space: pre; margin-right: 5px; font-size:small; font-weight:bold; position:absolute; border-style:none; padding-bottom:2px; left: 50%; transform: translate(-50%, -50%);';

            ktl.scenes.addVersionInfo(info, versionStyle);
        }
    }

    //Positions the cursor at a convenient place for the user to enter the next data.
    function autoFocus() {
        if (window.self.frameElement) //Never in iFrames.  Prevents parent from working properly.
            return;

        const autoFocusFields = [/*'field_xx', 'field_yy'*/]; //Add specific fields you want the focus on, if any.

        var field = autoFocusFields.find(function (element) {
            if ($('#' + element).length > 0)
                return element;
        });

        if (field !== undefined) {
            $('#' + field).focus();
        } else {
            var field = document.querySelector('.kn-input:not(.kn-input-connection) input');
            if (field)
                field.focus();
            else {
                var sel = $('.input[name=keyword]').first(); //When nothing found, use first Search field, if within viewport.
                if (sel.length > 0) {
                    if (!sel.is(':offscreen')) //Prevent annoying scroll down.
                        sel[0].focus();
                } else { //Search field not found.
                    sel = $('.kn-textarea'); //Text area is Paragraph text.
                    if (sel.length > 0)
                        sel[0].focus();
                    else {
                        sel = $('.input:not(input[name=keyword]):not(input[name=date])'); //Try any text input field except a Search and Calendar.
                        if (sel.length > 0)
                            sel[0].focus();
                        else {
                            sel = $('button'); //Try button
                            if (sel.length > 0 && sel[0].id !== 'verButtonId')
                                sel[0].focus();
                        }
                    }
                }
            }
        }

        $.expr.filters.offscreen = function (el) {
            var rect = el.getBoundingClientRect();
            return (
                (rect.x + rect.width) < 0
                || (rect.y + rect.height) < 0
                || (rect.x > window.innerWidth || rect.y > window.innerHeight)
            );
        };
    }

    //When there is no keypress or mouse click for a certin time, by default reload the page.
    //But you can put any code you want there.
    function idleWatchDogTimeout() {
        location.reload(true);

        //You can also reset the idle wd and do something else.
        //ktl.scenes.resetIdleWatchdog();
        //Your specific code here...
    }

    //When the spinner takes too long after a Submit or any other cases, by default reload the page.
    //But you can put any code you want there.
    function spinnerWatchDogTimeout() {
        location.reload(true);
    }

    //Keypress event handler
    function onKeyPressed(e) {
        var key = String.fromCharCode(e.which);
        //console.log('Key pressed =', key);
    }

    function chznBetterSetFocus() {
        try {
            var chzn = document.activeElement.closest('.kn-input') || document.activeElement.closest('.chzn-container').previousElementSibling;
            var fieldId = chzn.getAttribute('data-input-id') || chzn.getAttribute('name');

            if (fieldId === 'field_xxxx') {
                //Your specific code here...
            }
        }
        catch (e) {
            ktl.log.clog('red', 'Exception in chznBetterSetFocus:');
            console.log(e);
        }
    }

    function onFieldValueChanged({ viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e }) {
        if (viewId === 'view_xyz') {
            //Your specific code here...
        }
    }

    //Special app-specific keywords.  Note that all keywords must start by an underscore "_".
    function processViewKeywords(view, data) {
        if (!view.orgTitle) return;
        if (view.orgTitle.includes('_my_app_keyword')) {
            //Do something here...
        }
    }

    function isKiosk() {
        var kiosk = false; //Add your condition(s) here.
        return kiosk;
    }

    function allowShowPrefs() {
        var allow = {};

        if (ktl.account.isDeveloper()) {
            allow.showViewId = true;
            allow.showDebugWnd = true;
            allow.showIframe = true;
            allow.showExtraDebugInfo = true;
        }

        //Add your own conditions here.

        return allow;
    }

    function applyUserPrefs(refreshScene = false) {
        if (refreshScene)
            ktl.scenes.renderViews();
    }

    function allowUserFilters() {
        var allow = !isKiosk(); //Add your condition(s) here.
        return allow;
    }

    //Callback that returns whether or not a log category is allowed, and based on your criteria.
    function logCategoryAllowed(category) {
        var allow = true;
        var exceptions = []; //Leave empty to allow all types of logs.
        //Example: var exceptions = [ktl.const.LS_ACTIVITY, ktl.const.LS_NAVIGATION]; //Add your exceptions here

        if (exceptions.includes(category)) //General category switch.
            allow = false;
        else { //More fine-tuned filtering.
            if (category === ktl.const.LS_NAVIGATION && isKiosk()) //Log scene changes, but not for kiosks (not useful).
                allow = false;
        }

        return allow;
    }

    function processFailedMessages(msgType = 'unknown', msgId = 'unknown') {
        console.log('Failed Message: msgType =', msgType, 'msgId =', msgId);
    }

    function processAppMsg(event) {
        try {
            var msgId = event.data.msgId; //Keep a copy for ack.

            if (event.data.msgSubType === 'req') {
                if (event.data.msgType === 'someMsg') {
                    ktl.wndMsg.send('someMsg', 'ack', IFRAME_WND_ID, ktl.const.MSG_APP, msgId);
                    //Process your msg here...
                }
            }
            //Ack is always handled by ktl.
        }
        catch (e) {
            ktl.log.clog('purple', 'App message handler error:');
            console.log(e);
        }
    }

    //External Apps data exchange and communication - just a test as a proof of concept - BEGIN
    function sendAppMsg(msg = {}) {
        if (!msg.msgType || !msg.msgSubType) {
            ktl.log.clog('purple', 'Called sendAppMsg with invalid parameters');
            return;
        }

        if (msg.src === ktl.const.MSG_APP && msg.dst === IFRAME_WND_ID)
            ktl.iFrameWnd.getiFrameWnd() && ktl.iFrameWnd.getiFrameWnd().contentWindow.postMessage(msg, '*');
        else if (msg.src === 'iFrame_App1' && msg.dst === 'App2_iFrame') //Can be app to app, app to iframe, iframe to App, but not iframe to iframe.
            parent.postMessage(msg, '*');
        else {
            console.log('Called sendAppMsg with unsupported src/dst.');//$$$
        }
    }

    //All server errors are processed here, in app.  Any error occuring in iFrameWnd must be forwarded here.
    function processServerErrors(msg = {}) {
        if ($.isEmptyObject(msg)) return;

        //Implement your app-specific processing here.
    }

    function updateWorkShiftItems(shiftLetter = '') {
        //Update Shift button text, if it exists.
        var shiftBtn = $('#kn-button-shift');
        if (shiftBtn.length > 0) {
            var workShiftBtnTxt = 'Reading Shift...';
            if (shiftLetter)
                workShiftBtnTxt = shiftLetter + '-Shift';
            shiftBtn[0].innerHTML = workShiftBtnTxt;
        }

        //Update dropdown in submit form, if exists.
        if (shiftLetter) {
            var fieldId = ktl.views.findFirstExistingField(['field_xxx', 'field_yyy']);
            if (fieldId) {
                ktl.views.searchDropdown(shiftLetter, fieldId, true, false)
                    .then(function (foundText) { })
                    .catch(function (foundText) { ktl.log.addLog(ktl.const.LS_APP_ERROR, 'EC_xxxx - Could not find shift ' + shiftLetter) })
            }
        }
    }

    function handleCalendarEventDrop(view, event, dayDelta, minuteDelta, allDay, revertFunc) {
        console.log('eventDrop', { view, event, dayDelta, minuteDelta, allDay, revertFunc });
    }

    //KTL callbacks to your App - END
    //====================================================

    //Setup default preferences - BEGIN
    var userPrefs = ktl.userPrefs.getUserPrefs();

    //Typically, only the developers are interested in seeing the view IDs.
    if (ktl.account.isDeveloper())
        userPrefs.showViewId = true;
    else
        userPrefs.showViewId = false;

    userPrefs.showExtraDebugInfo = false;
    userPrefs.showIframeWnd = false;
    userPrefs.showDebugWnd = false;
    userPrefs.workShift = '';

    //Save back to localStorage.
    ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS, JSON.stringify(userPrefs));
    //console.log('userPrefs =', userPrefs);
    //Setup default preferences - END


    //====================================================
    //  Add your code here...



};

