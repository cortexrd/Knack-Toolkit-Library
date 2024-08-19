//This file contains all the default implementations of the KTL.
//You can override these by copying each part you want to customize
//in your own file, referred to in the documentation as "MyApp.js".
window.KnackApp = function ($, appInfo = {}) {
    if (typeof window.APP_VERSION === 'undefined')
        window.APP_VERSION = '1.0.0'; //Your App version.

    window.$ = $;
    var ktl = new Ktl($, appInfo);
    window.ktl = ktl;
    const IFRAME_WND_ID = 'iFrameWnd';

    //====================================================
    //KTL Setup - BEGIN
    (function () {
        try {
            ktl.core.setCfg({
                developerNames: ['Firstname Lastname'], //Add your name here to get super powers!
                developerEmail: '', //yourmail@provider.com
                devOptionsPin: '0000',
                devDebugCode: '',

                //Main KTL feature switches.  Here is where your App can override the defaults and enable/disable the features.
                enabled: {
                    versionInfo: {
                        viShowAppInfo: true,
                        viShowKtlInfo: true,
                        viShowToRoles: ['Developer'], //Array of Account Roles strings who can see the version info bar. Leave empty for all.
                        viPosX: 'right', //right, center, left
                        viPosY: 'top', //top, bottom
                        viPosXMobile: 'center', //right, center, left
                        viPosYMobile: 'bottom', //top, bottom
                        viOpacity: 50, //0 to 100
                        viOpacityHover: 100, //0 to 100
                    },

                    showMenuInTitle: true,
                    selTextOnFocus: true,
                    inlineEditColor: true,
                    rowHoverHighlight: true,
                    autoFocus: true,
                    sortedMenus: true,
                    userFilters: true,
                    persistentForm: true,
                    calendarGotoDate: true,
                    rememberMe: true,
                    formPreValidation: true,
                    spinnerWatchDog: true,
                    idleWatchDog: true,
                    debugWnd: true,
                    devInfoPopup: true,
                    devPauseAutoRefresh: true,
                    virtualKeyboard: false,

                    //Those below must also be set up properly to have any effect.  See documentation.
                    iFrameWnd: false,

                    bulkOps: {
                        bulkEdit: true,
                        bulkCopy: true,
                        bulkDelete: true,
                        bulkAction: true,
                    },
                },

                popupStyle: {
                    success: ';background-color:#81b378;border:5px solid #294125',
                    warning: ';background-color:#fffa5e;border:2px solid #7e8060',
                    error: ';background-color:#FFB0B0;border:5px solid #660000',
                },

                tooltipStyles: {
                    ktlTtipFormViewBgColor: '#222222',
                    ktlTtipFormViewTxtColor: '#ffffff',
                    ktlTtipIconFormViewColor: '#222222',
                    ktlTtipDetailsViewBgColor: '#222222', //Lists use details colours
                    ktlTtipDetailsViewTxtColor: '#ffffff', //Lists use details colours
                    ktlTtipIconDetailsViewColor: '#222222', //Lists use details colours
                    ktlTtipTableViewBgColor: '#222222',
                    ktlTtipTableViewTxtColor: '#ffffff',
                    ktlTtipIconTableViewColor: '#222222',
                },

                //Functions in this app.
                isKiosk: isKiosk,
            })

            //For Idle timeout delay in minutes, you can use a fixed value, or change it depending on the use case.
            //As an example, below I change it if it's a kiosk device.
            //Zero means disabled, so idleWatchDogTimeout() will never be called.
            var idleWatchDogDelay = 120; //120 minutes (2 hours) by default.
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
                handlePreprocessSubmitError: handlePreprocessSubmitError,
                //Uncomment below to override default Quick Toggle colors.
                //    quickToggleParams: {
                //        bgColorTrue: '#39d91f',
                //        bgColorFalse: '#f04a3b',
                //        bgColorPending: '#dd08',
                //        showSpinner: true,
                //        showNotification: true,
                //        pendingClass: '',
                //    },
                headerAlignment: true,
                ktlFlashRate: '1',
                ktlOutlineColor: 'green',
                ktlHideShowButtonColor: '#c7c7c7',
                stickGroupingsWithHeader: false,
                //hscCollapsedColumnsWidth: '0', //In pixels
                //hscGlobal: true,
            })

            ktl.fields.setCfg({
                onKeyPressed: onKeyPressed,
                onFieldValueChanged: onFieldValueChanged,
                textAsNumeric: [],
                textAsNumericExcludeScenes: [],
                //chznDropDownSearchDelay: 2000, //Uncomment if you prefer longer delay.
                onInlineEditPopup: onInlineEditPopup,
                //Uncomment the two lines below to get horizontal layout for RBs and CBs.
                //horizontalRadioButtons: true,
                //horizontalCheckboxes: true,

                //barcodeTimeout: 20,
                //barcodeMinLength: 3,
                //barcodePrefixes: [],
                //convertNumToTel: true,
            })

            ktl.persistentForm.setCfg({
                scenesToExclude: [],
                fieldsToExclude: ['field_xx', 'field_yy'], //Fields you never want to save.
            })

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
                    ktlKioskButtons: {
                        ADD_REFRESH: {
                            html: '<i class="fa fa-refresh"></i>',
                            id: 'kn-button-refresh',
                            href: function () { location.reload(true) },
                            scenesToExclude: [],
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
                        //    ADD_MESSAGING: {
                        //        html: '<i class="fa fa-envelope-o"></i>',
                        //        id: 'kn-button-messaging',
                        //        href: window.location.href.slice(0, window.location.href.indexOf('#') + 1) + 'messaging',
                        //        scenesToExclude: [/*MESSAGING_SCN*/],
                        //    },
                        //    ADD_SHIFT: {
                        //        html: updateWorkShiftItems,
                        //        id: 'kn-button-shift',
                        //        href: window.location.href.slice(0, window.location.href.indexOf('#') + 1) + 'change-shift',
                        //        scenesToExclude: [/*CHANGE_SHIFT_SCN, MESSAGING_SCN*/],
                        //    },
                    },

                    //versionDisplayName: 'CTRND', //As an example, when you prefer to use a shorter name.
                    versionDisplayName: Knack.app.attributes.name,
                    processMutation: processMutation,
                })

                ktl.userFilters.setCfg({
                    allowUserFilters: allowUserFilters,
                })

                ktl.log.setCfg({
                    logCategoryAllowed: logCategoryAllowed,
                    logEnabled: {
                        critical: false,
                        error: false,
                        serverErr: false,
                        warning: false,
                        info: false,
                        debug: false,
                        login: false,
                        activity: false,
                        navigation: false,
                    }
                });

                ktl.sysInfo.setCfg({
                    recoveryWatchdogEnabled: false,
                })
            }

            ktl.iFrameWnd.setCfg({
                sendHeartbeat: true,
            });


            if (typeof window.ktlReady === 'function')
                window.ktlReady(appInfo);

            $(document).trigger('KTL.DefaultConfigReady');
        }
        catch (error) {
            console.error('KTL Setup error encountered:\n', error);
        }
    })();
    //KTL Setup - END
    //====================================================




    //====================================================
    //KTL callbacks to your App - BEGIN

    //====================================================
    //Same as $(document).on('knack-scene-render.any')
    //Called by KTL
    function onSceneRender(event, scene, appInfo) {
        if (ktl.core.isKiosk()) {
            ktl.scenes.addVersionInfo(appInfo, 'margin-left: 10px; margin-top: 2px; font-size:small; top:0; right:10px');
        } else {
            //If you want to add pre/post version info text, use these below.
            //info.pre = '';
            //info.post = '';
            ktl.scenes.addVersionInfo(appInfo);
        }

        //Uncomment below to get invisible bar, but yet clickable for Dev Options.
        //$('#verButtonId').css('opacity', '0%'); //Or 10% for barely visible

        autoFocus();
    }

    //Positions the cursor at a convenient place for the user to enter the next data.
    function autoFocus() {
        if (!ktl.core.getCfg().enabled.autoFocus || window.self.frameElement) //Never in iFrames.  Prevents parent from working properly.
            return;

        const autoFocusFields = [/*'field_xx', 'field_yy'*/]; //Add specific fields you want the focus on, if any.

        var field = autoFocusFields.find(function (element) {
            if ($('#' + element).length > 0)
                return element;
        });

        if (field !== undefined) {
            $('#' + field).focus();
        } else {
            var sel = $('.kn-input:not(.kn-input-connection, .kn-input-date_time) input').first();
            if (sel.length && !sel.is(':offscreen')) //Prevent annoying scroll down.
                sel[0].focus();
            else {
                sel = $('.input[name=keyword]').first(); //When nothing found, use first Search field, if within viewport.
                if (sel.length && !sel.is(':offscreen')) {
                    sel[0].focus();
                } else { //Search field not found.
                    sel = $('.kn-textarea'); //Text area is Paragraph text.
                    if (sel.length && !sel.is(':offscreen'))
                        sel[0].focus();
                    else {
                        sel = $('.input:not(input[name=keyword]):not(input[name=date])'); //Try any text input field except a Search and Calendar.
                        if (sel.length && !sel.is(':offscreen'))
                            sel[0].focus();
                        else {
                            sel = $('button'); //Try button
                            if (sel.length && sel[0].id !== 'verButtonId' && !sel.is(':offscreen'))
                                sel[0].focus();
                        }
                    }
                }
            }
        }
    }

    //This is called after there's been no keypress or mouse click for a certain period of time.
    //By default it does nothing.
    function idleWatchDogTimeout() {
        //Your specific code here...

        //You can reset the idle wd and do something else.
        //ktl.scenes.resetIdleWatchdog();

        //Or force a logout like this:
        //ktl.account.logout();
    }

    //When the spinner takes too long after a Submit or any other cases, by default reload the page.
    //But you can put any code you want there.
    function spinnerWatchDogTimeout() {
        location.reload(true);
    }

    function processMutation(mutRec) {
    }

    //Keypress event handler
    function onKeyPressed(e) {
        //var key = String.fromCharCode(e.which);
        //console.log('Key pressed =', key);
    }

    //Keydown event, with the convenient F2 as an example to debug or do other action.
    $(document).keydown(function (e) {
        if (e.keyCode === 113) { //F2
            //debugger;
        }
    })

    function onInlineEditPopup(viewId, fieldId, e) {
        //Example to stretch the text input field.
        //$('.kn-form-col.column.is-constrained').css({ 'max-width': '100vw', 'width': '75vw' }); //Example here that enlarges width.
        //var sel = document.querySelector('.kn-form-col.column.is-constrained');
        //console.log('sel =', sel);
    }

    function onFieldValueChanged({ viewId: viewId, fieldId: fieldId, recId: recId, text: text, e: e }) {
        //console.log('onFieldValueChanged:');
        //console.log('viewId =', viewId);
        //console.log('fieldId =', fieldId);
        //console.log('recId =', recId);
        //console.log('text =', text);
        //console.log('e =', e);

        if (viewId === 'view_xyz') {
            //Your specific code here...
        }
    }

    //Special app-specific keywords.  Note that all keywords must start with an underscore "_".
    function processViewKeywords(view, keywords, data) {
        if (keywords && !$.isEmptyObject(keywords)) {
            if (keywords._my_app_keyword) {
                //Do something here...
            }
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
            console.log('Called sendAppMsg with unsupported src/dst.');
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
        //console.log('eventDrop', { view, event, dayDelta, minuteDelta, allDay, revertFunc });
    }

    function handlePreprocessSubmitError(viewId, outcomeObj) {
        //console.log('outcomeObj =', outcomeObj);
    }

    //KTL callbacks to your App - END
    //====================================================


    //====================================================
    //Your App-specific code goes here...


};
