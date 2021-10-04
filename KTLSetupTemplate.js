//====================================================
//====================================================
const SW_VERSION = '0.1.0'; //Your App version.
//Your App ID:  xxxxxxxxxxxxxxxxxxxxxxxx

var KnackApp = function ($, info = {}) {
    window.$ = $;

    var ktl = new Ktl($);

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
            showAppInfo: true,
            showKtlInfo: true,
            showMenuInTitle: true,
            enabled: { //Main KTL feature switches.  Here is where your App can override the defaults (all is disabled) and enables what is desired.
                selTextOnFocus: true,
                autoFocus: true,
                persistentForm: true,
                debugWnd: true,
                idleWatchDog: true,
                spinnerWatchDog: true,

                //Those below nust also be properly setup to have any effect.  See documentation.
                userFilters: true,
                iFrameWnd: true,
                bulkOps: {
                    bulkEdit: true,
                    bulkDelete: true,
                },
            },

            //Functions in this app.
            isKiosk: isKiosk,
        })

        ktl.scenes.setCfg({
            idleWatchDogDelay: idleWatchDogDelay,
            onSceneRender: onSceneRender,
            autoFocus: autoFocus,
            idleWatchDogTimout: idleWatchDogTimout,
            spinnerWatchDogTimeout: spinnerWatchDogTimeout,
            spinnerWdExcludeScn: [],
        })

        ktl.views.setCfg({
            processTitleFlags: processTitleFlags,
        })

        ktl.fields.setCfg({
            onKeyPressed: onKeyPressed,
            textAsNumeric: [],
        })

        ktl.persistentForm.setCfg({
            scenesToExclude: [],
            fieldsToExclude: ['field_xx', 'field_yy'], //Fields you never want to save.
        })

        ktl.systemColors.setCfg({
        })
        ktl.systemColors.getSystemColors()
            .then(() => { })
            .catch(function () { ktl.log.clog('KTL error loading system colors', 'red'); })

        ktl.userPrefs.setCfg({
            allowShowPrefs: allowShowPrefs,
            applyUserPrefs: applyUserPrefs,
        })

        ktl.iFrameWnd.setCfg({
            //Fields below must match those in the Account object.
            acctSwVersionFld: 'field_x',
            acctUtcHbFld: 'field_x',
            acctLocHbFld: 'field_x',
            acctUserPrefsFld: 'field_x',
            acctWorkShiftFld: 'field_x',

            //Fields below must match those in the Account Logs object.
            alLogTypeFld: 'field_x',
            alDetailsFld: 'field_x',
            alLogIdFld: 'field_x',
        })

        ktl.wndMsg.setCfg({
            processFailedMessages: processFailedMessages,
            processAppMsg: processAppMsg,
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
            })

            ktl.userFilters.setCfg({
                allowUserFilters: allowUserFilters, //Callback to your app.
                ufDateTimeFld: 'field_x',
                ufFiltersCodeFld: 'field_x',
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
        if (ktl.core.isKiosk())
            ktl.scenes.addVersionNumber(info, 'margin-left: 10px; margin-top: 2px; font-size:small; position:absolute; top:0; right:10px');
        else
            ktl.scenes.addVersionNumber(info);
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
                            if (sel.length > 0)
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
    function idleWatchDogTimout() {
        location.reload(true);

        //You can also reset the idle wd and do something else.
        //ktl.scenes.resetIdleWatchdog();
        //Some action here...
    }

    //When the spinner takes too long after a Submit or any other cases, by default reload the page.
    //But you can put any code you want there.
    function spinnerWatchDogTimeout() {
        location.reload(true);
    }

    //Keypress event handler
    function onKeyPressed(e) {
        var key = String.fromCharCode(e.which);
        console.log('Key pressed =', key);
    }

    //Special app-specific title flags.
    function processTitleFlags(view, data) {
        if (view.title.includes('MY_APP_FLAG')) {
        }
    }

    function isKiosk() {
        var kiosk = false; //Add your condition(s) here.
        return kiosk;
    }

    function allowShowPrefs() {
        var allow = {};

        if (ktl.account.isDeveloper()) {
            allow.showViewId = false;
            allow.showDebugWnd = false;
            allow.showIframe = false;
            allow.showExtraDebugInfo = false;
        }

        //Add your own conditions here.

        return allow;
    }

    function applyUserPrefs() {
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
            ktl.log.clog('App message handler error:', 'purple');
            console.log(e);
        }
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

    //KTL callbacks to your App - END
    //====================================================

    //Setup default preferences - BEGIN
    var userPrefs = ktl.userPrefs.getUserPrefs();
    userPrefs.showViewId = true;
    userPrefs.showExtraDebugInfo = true;
    userPrefs.showIframeWnd = true;
    userPrefs.showDebugWnd = true;
    userPrefs.workShift = '';

    //Save back to localStorage.
    ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id, JSON.stringify(userPrefs));
    console.log('userPrefs =', userPrefs);
    //Setup default preferences - END






    //====================================================
    //====================================================
    //My App code - BEGIN
    //.........
    //My App code - END


};

