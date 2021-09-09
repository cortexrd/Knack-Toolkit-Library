//====================================================
//====================================================
const SW_VERSION = '21_08_30_01';
//APP ID:  60d0e1112a5aa1001fd42549
var KnackApp = function ($, info = {}) {
    window.$ = $;

    var ktl = new Ktl($);

    //====================================================
    //App constants - BEGIN
    //Add all constants shared between your app and the KTL, like scene, view and field IDs.
    const FILTER_INCLUDING = true;
    const FILTER_EXCLUDING = false;

    const AUDIBLE_ALERT = 'audible_alert';
    const EMAIL_ALERT = 'email_alert';

    //Local Storage and Logging - BEGIN
    const LS_SW_UPDATE_STATE = 'SW_UPDATE_STATE';
    const LS_SYSOP_MSG_UNREAD = 'SYSOP_MSG_UNREAD';

    const SW_UPDATE_NO_UPDATE = 'No Update';
    const SW_UPDATE_LOW_PRIORITY = 'Low Priority';
    const SW_UPDATE_HIGH_PRIORITY = 'High Priority';
    const SW_UPDATE_COMPLETED = 'Completed';

    const ACTIVITY_KEYPRESS = 0;

    const SYSOP_ACCOUNT_LOGS_SCN_613 = 'scene_613';
    const SYSOP_DASHBOARD_ACCOUNT_LOGS_1654 = 'view_1654';

    const SYSOP_PREFS_STATUS_SCN_617 = 'scene_617';
    const SYSOP_DASHBOARD_ACC_PREFS_STATUS_1664 = 'view_1664';

    const IFRAME_WND_SCN = 'scene_919';
    //const IFRAME_USER_PREFS_VIEW_1652 = 'view_1652';

    const DEVICE_OFFLINE_DELAY = 60000 * 3;

    const LOG_TYPE = 'field_826';
    const LOG_DETAILS = 'field_838'; //Paragraph Text
    //Local Storage and Logging - END

    const HOME_PAGE_SCN = 'scene_258';
    const WIP_REPORT_OUTPUT_SCN = 'scene_59';
    const OUTPUT_GRAPHS_SCN = 'scene_687';

    const INSPECTION1 = 'scene_194';
    const INSPECTION2 = 'scene_433';
    const INSPECTION3 = 'scene_434';
    const INSPECTION4 = 'scene_435';
    const INSPECTION5 = 'scene_436';

    const EXTRUDER_TERM = 'scene_180';
    const PRIME_EXTRUDER = 'scene_202';
    const CASTING_BACKTENDER_EDIT_STAGE_LOG = 'scene_306';
    const TERMINALS_SETUP = 'scene_488';

    //These are not kiosk terminals, but power users on a PC, using a scanner.
    //They also have the top menu bar, logout, etc.
    const NEW_ROLL_CARD = 'scene_372';
    const FIX_MISSING_CARD = 'scene_416';
    const EDIT_ROLL = 'scene_120';
    const INVENTORY_NEW_ROLL = 'scene_450';
    const INVENTORY_NEW_LOT = 'scene_453';

    const HIDDEN_LINKS = 'scene_289';

    //C-Leadhand Terminal
    const CASTING_LEADHAND_SCN = 'scene_532';
    const CASTING_LEADHAND_ADD_LOT = 'scene_558';
    const CASTING_LEADHAND_REPORT_1370 = 'view_1370';
    const CASTING_LEADHAND_ADD_LOT_INFO_1371 = 'view_1371';
    const CASTING_LEADHAND_ADD_LOT_FORM = 'view_1437';

    //Add Hold Logs - added to Lab In
    const HOLD_LOGS_TABLE = 'view_1469'; //@@@ still good?
    const HOLD_LOGS_FAILURE = 'field_742';

    //Views
    const NEW_ORDERS_LOTS = 'view_237';
    const PENDING_ORDERS_LOTS = 'view_265';
    const TOPCOAT_LOGS = 'view_1124';

    const INSPECTION1_LOT = 'view_345';
    const INSPECTION2_LOT = 'view_1126';
    const INSPECTION3_LOT = 'view_1128';
    const INSPECTION4_LOT = 'view_1130';
    const INSPECTION5_LOT = 'view_1132';

    const MANAGE_EMBOSSING_ROLLS_VIEW = 'view_1411';

    const BACKTENDER_REPORT_MF = 'view_61'; //MF for Menu Filters
    const BACKTENDER_REPORT_AF = 'view_1569'; //AF for Advanced Filter
    const DFS_REPORT_MF = 'view_1027';
    const DFS_REPORT_AF = 'view_1703';

    const DFS_SIGN_SCN = 'scene_405';
    const IMPORT_ORDERS_TABLE = 'view_1762';
    const TRACKING_ALL_LOTS_1759 = 'view_1759';

    const COMPOUNDS_BATCH_SCN_423 = 'scene_423';
    const COMPOUNDS_BATCH_TABLE = 'view_1669';
    const COMPOUNDS_BATCH_DETAILS_SCN = 'scene_620';
    const COMPOUND_KETTLES_SCN_624 = 'scene_624';
    const COMPOUND_KETTLES_DETAILS_SCN_800 = 'scene_800';
    const COMPOUND_KETTLES_TABLE_1684 = 'view_1684';
    const COMPOUND_COLOR_TICKETS_TABLE = 'view_1679';
    const COMPOUNDS_ADD_BATCH = 'view_1676';
    const COMPOUNDS_EDIT_BATCH = 'view_1865';
    const SEARCH_KETTLE_VIEW = 'view_2120';
    const KETTLE_CLEANUP_SCN = 'scene_807';
    const LOTS_TRACKING_NOTIFICATION_SCN = 'scene_890';

    const WORK_SHIFT_SELECT_VIEW = 'view_2408';

    //Fields commonly used
    const STAGELOG_ROLL = 'field_48'; //Dropdown
    const STAGELOG_YARDS_OUT = 'field_123';
    const STAGE_LOG_WIDTH = 'field_338';
    const STAGE_LOG_WIDTH_BEG = 'field_563';
    const STAGE_LOG_YARDS_RETURNED = 'field_213';
    const STAGE_LOG_AUX_YARDS_OUT = 'field_224';
    const STAGE_LOG_COMMENT = 'field_57';
    const DIGITAL_BASE_ROLLS = 'field_363';

    const STAGE_LOG_WEIGHT_LEFT = 'field_531';
    const STAGE_LOG_WEIGHT_CENTRE = 'field_532';
    const STAGE_LOG_WEIGHT_RIGHT = 'field_533';
    const STAGE_LOG_BOND_LEFT = 'field_534';
    const STAGE_LOG_BOND_CENTRE = 'field_535';
    const STAGE_LOG_BOND_RIGHT = 'field_536';
    const STAGE_LOG_COHESION = 'field_546';

    const STAGE_LOG_DOWNTIME_MATCH = 'field_761';
    const STAGE_LOG_DOWNTIME_SETUP = 'field_762';
    const STAGE_LOG_DOWNTIME_WASH = 'field_763';
    const STAGE_LOG_DOWNTIME_ROLL_CHG = 'field_764';

    const ROLL_NUMBER = 'field_20';
    const ROLL_ACTUAL_YARDS = 'field_13';
    const ROLL_LOT = 'field_33'; //Dropdown
    const ROLL_PRIME_LOT = 'field_523'; //Text
    const ROLL_TEMP_WIDTH = 'field_371';
    const ROLL_TEMP_COMMENT = 'field_365';

    const LAMINATION_TERMINAL_SCN = 'scene_913';
    const LAMINATION_LOT = 'field_343'; //Dropdown
    const LAMINATION_FABRIC_LOT = 'field_342';
    const LAMINATION_SEAMS = 'field_360';
    const LAMINATION_WEIGHT = 'field_347';
    const LAMINATION_YARDS = 'field_348';
    const LAMINATION_WIDTH = 'field_350';
    const LAMINATION_LEFTOVER = 'field_349';
    const LAMINATION_DEFECTIVE_YARDS = 'field_344';

    const CHANGE_SHIFT_SCN = 'scene_793';
    const TERMINAL_MESSAGING_SCN = 'scene_856';

    const TOPCOAT_LOT = 'field_501';
    const TOPCOAT_WEIGHT = 'field_505';
    const TOPCOAT_ADJUSTMENT = 'field_514';
    const TOPCOAT_VISCOSITY = 'field_515';
    const TOPCOAT_RETURNED = 'field_510';
    const TOPCOAT_COMMENT = 'field_503';
    const TOPCOAT_DRUM_WEIGHT = 'field_530';
    const TOPCOAT_REUSE = 'field_633';

    const LAB_LOT = 'field_368'; //Dropdown

    const EXTRUDER_WEIGHT_LEFT = 'field_539';
    const EXTRUDER_WEIGHT_CENTRE = 'field_540';
    const EXTRUDER_WEIGHT_RIGHT = 'field_541';
    const EXTRUDER_BOND_LEFT = 'field_542';
    const EXTRUDER_BOND_CENTRE = 'field_543';
    const EXTRUDER_BOND_RIGHT = 'field_544';
    const EXTRUDER_COHESION = 'field_545';

    const EXTR_PARAM_MIN_WIDTH = 'field_564';
    const EXTR_PARAM_MIN_WEIGHT = 'field_565';
    const EXTR_PARAM_MAX_WEIGHT = 'field_566';
    const EXTR_PARAM_MIN_COHESION = 'field_567';
    const EXTR_PARAM_MAX_COHESION = 'field_568';

    const LOT_NUMBER = 'field_24'; //Text
    const CASTING_LEADHAND_LOT = 'field_636'; //Dropdown

    const HOLD_LOGS_LOT = 'field_743';
    const HOLD_LOGS_YARDS = 'field_745';

    const ADD_EMBOSSING_ROLL = 'field_673';

    const EMBOSSING_SPEED = 'field_675';
    const EMBOSSING_YARDS_IN = 'field_676';
    const EMBOSSING_GAUGE_IN = 'field_677';
    const EMBOSSING_GAUGE_OUT = 'field_678';
    const EMBOSSING_WIDTH_IN = 'field_679';
    const EMBOSSING_STEAM1 = 'field_681';
    const EMBOSSING_STEAM2 = 'field_682';
    const EMBOSSING_WEB_TEMPERATURE = 'field_683';
    const EMBOSSING_ROLL_PRESSURE = 'field_684';

    const CASTING_LEADHAND_PAPER_WIDTH = 'field_639';

    const COLOR_TICKET_INPUT = 'field_859';
    const COLOR_TICKET_DROPDOWN = 'field_1184';
    const BATCH_WEIGHT = 'field_855';
    const KETTLE_WEIGHT = 'field_861';
    const COLOR_TICKET_LOTS = 'field_864';
    const QUALITY_ALERT_YARDS = 'field_1075';
    const BLEND_NB_INPUT = 'field_1060';

    const TIME_TO_RX_SCANNER_FRAME = 200; //Time it takes for a complete barcode to be received from scanner.  Usually around 100ms on Android T2Lite.

    const NP_BKGND_COLOR = '#ff7583';
    const EDITABLE_BKGND_COLOR = '#ffffdd';
    const TOGGLE_YES_BKGND_COLOR = '#fad900';
    const DFS_COLOR = 'e4a83f';
    //App constants - END

    //====================================================
    //KTL Setup - BEGIN
    (function () {
        ktl.core.setCfg({
            developerName: 'Normand Defayette', //Put your name here to get super powers!
            showAppInfo: true,
            showKtlInfo: true,
            enabled: {
                selTextOnFocus: true,
                autoFocus: true,
                userFilters: true,
                persistentForm: true,
                debugWnd: true,
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
            onSceneRender: onSceneRender,
            autoFocus: autoFocus,
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
        })

        ktl.iFrameWnd.setCfg({
            acctSwVersionFld: 'field_1632',
            acctUtcHbFld: 'field_1633',
            acctLocHbFld: 'field_1634',
            acctUserPrefsFld: 'field_1631',
            acctWorkShiftFld: 'field_1639',

            alLogTypeFld: 'field_826',
            alDetailsFld: 'field_838',
            alConfirmationFld: 'field_828',
        })

        ktl.wndMsg.setCfg({
            processFailedMessages: processFailedMessages,
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
    //KTL callbacks to your app - BEGIN

    //====================================================
    //Same as $(document).on('knack-scene-render.any')
    //Called by KTL
    function onSceneRender(event, scene) {
        curScn = scene.key;
        if (scene.key !== IFRAME_WND_SCN) {
            processHiddenUtilityFields();
            autoFocus();
        }

        //True is a special case where scanner should read color ticket in all pages from Manage / Compounds and below.
        //Also in Kettle Cleanup page //@@@ find a better name for flag.
        g_inCompounds = (window.location.href.includes('#compounds/') || window.location.href.includes('#kettle-cleanup/') || window.location.href.includes('#kettles/'));

        if (ktl.core.isKiosk())
            ktl.scenes.addVersionNumber(info, 'margin-left: 10px; margin-top: 2px; font-size:small; position:absolute; top:0; right:10px');
        else
            ktl.scenes.addVersionNumber(info);

        //For Home page, always show menu and allow logging out, even if terminal.
        if (scene.key === HOME_PAGE_SCN) {
            document.body.classList.add('show-menu');
            $('.kn-info-bar').css('display', 'block');
        }

        if (accountIsTerminalOnly()) {
            document.body.classList.add('terminal-class'); //See CSS code for details.

            //This is needed for terminals to get rid of the top blue header and info bar with logout.
            if (scene.key !== HOME_PAGE_SCN)
                document.body.classList.remove('show-menu');

            //Add extra lines at bottom of screen
            if (!window.self.frameElement)
                $('body').css('padding-bottom', '500px');

            //Force all terminal tables to have single spacing.  This will truncate long text such as in comments.
            //Otherwise the whole table switches to double line spacing and tons of realestate is wasted.
            //Note: the last two params are supposed to create an ellipsis to indicate more text is hidden.
            //But they have no effect for some reason (to investigate more).
            if (scene.key !== CASTING_LEADHAND_SCN) //Exception
                $('.kn-table').css({ 'white-space': 'nowrap', 'text-overflow': 'ellipsis', 'overflow': 'hidden' });
        } else { //Non-terminals
            if (!ktl.account.getRoleNames().includes('Dashboard') && !window.self.frameElement) {
                document.body.classList.add('show-menu');
                $('.kn-info-bar').css('display', 'block');
            }
        }
    }

    //====================================================
    // Positions the cursor at a convenient place for the user to enter the next data.
    function autoFocus() {
        if (window.self.frameElement //Never in iFrames.  Prevents parent from working properly.
            || curScn === TERMINAL_MESSAGING_SCN //Terminal users don't notice the important bottom portion of screen when focus is set.
            || curScn === COMPOUND_KETTLES_SCN_624 //Simply annoying for them.
            || curScn === SCHEDULING_SCENE
            || curScn === COMPOUNDS_BATCH_DETAILS_SCN
            || curScn === COMPOUND_KETTLES_DETAILS_SCN_800
            || curScn === 'scene_830' //Gemba
            || Knack.getUserAttributes().name === 'Eric Lamontagne') //To prevent Eric from having the auto-complete dropdown showing (mystery why only him)
            return;

        const autoFocusFields = [EMBOSSING_YARDS_IN, STAGE_LOG_WIDTH_BEG, ROLL_TEMP_WIDTH, ROLL_ACTUAL_YARDS,
            STAGELOG_YARDS_OUT, LAMINATION_FABRIC_LOT, TOPCOAT_WEIGHT, LOT_NUMBER, ADD_EMBOSSING_ROLL,
            HOLD_LOGS_FAILURE, COLOR_TICKET_INPUT, COLOR_TICKET_DROPDOWN, CASTING_LEADHAND_PAPER_WIDTH];

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
    }

    //Keypress event handler
    function onKeyPressed(e) {
        var pressedKey = String.fromCharCode(e.which);
        var target = e.target;

        if (!ktl.fields.getUsingBarcode()
            && ((pressedKey === 'B' || pressedKey === 'C' || pressedKey === 'K' || pressedKey === 'L' || pressedKey === 'R'))
            && target.id !== 'field_849' /*Allow all chars in Compounds Supplier Lot*/
            && !target.classList.contains('redactor-editor') && !target.classList.contains('kn-textarea')
        ) {
            if (e.target.id && !e.target.classList.contains('input') || $('#kn-input-' + e.target.id).attr('numeric') || g_inCompounds) {
                e.preventDefault();
                ktl.fields.clearBuffer();
                ktl.fields.addChar(pressedKey);
                ktl.fields.setUsingBarcode(true);

                setTimeout(processBarcode, TIME_TO_RX_SCANNER_FRAME);
            }
        } else if (ktl.fields.getUsingBarcode() && ((pressedKey >= '0' && pressedKey <= '9') || (pressedKey >= 'A' && pressedKey <= 'Z') || pressedKey === '-' || pressedKey === '_')) {
            ktl.fields.addChar(pressedKey);
            if ($('#kn-input-' + e.target.id).attr('numeric'))
                e.preventDefault(); //Prevent filling a numeric (or tel) field with scanner's 'junk'.
        }
    }

    //Special app-specific title flags.
    function processTitleFlags(view, data) {
        if (view.title.includes('INSPECTION_LOTS')) {
            g_inspectionLotsView = view.key;
            g_inspectionLots = [];
            data.forEach(function (el) {
                g_inspectionLots.push(el.field_24);
            })
        }
    }

    function isKiosk() {
        var kiosk = accountIsTerminalOnly(); //Add your condition(s) here.
        return kiosk;
    }

    function allowShowPrefs() {
        var allow = {};

        //Can be useful in some cases, so make these available.
        allow.showViewId = true;
        allow.showDebugWnd = true;
        allow.showIframe = true;

        if (ktl.account.isDeveloper()) {
            allow.showExtraDebugInfo = true;
        }

        //Add your own conditions here.

        return allow;
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
            if (category === ktl.const.LS_NAVIGATION && accountIsTerminalOnly()) //Log scene changes, but not for terminals (not useful).
                allow = false;
        }

        return allow;
    }

    function processFailedMessages(msgType = '') {
        msgType && console.log('Failed msgType =', msgType);
    }

    //Shift fields:  field_1639 = User Prefs, field_1159 = Roll, field_1160 = Stage Logs
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
            var fieldId = ktl.views.findFirstExistingField(['field_1159', 'field_1160']);
            if (fieldId) {
                ktl.views.searchDropdown(shiftLetter, fieldId, true, false)
                    .then(function (foundText) { })
                    .catch(function (foundText) { ktl.log.addLog(ktl.const.LS_APP_ERROR, 'EC_1020 - Could not find shift ' + shiftLetter + ' in ' + curScn); })
            }
        }
    }

    //KTL callbacks to your app - END
    //====================================================

    //Setup default preferences.
    var userPrefs = ktl.userPrefs.getUserPrefs();
    userPrefs.showViewId = true;
    userPrefs.showExtraDebugInfo = true;
    userPrefs.showIframeWnd = true;
    userPrefs.showDebugWnd = true;
    userPrefs.workShift = '';

    ktl.storage.lsSetItem(ktl.const.LS_USER_PREFS + Knack.getUserAttributes().id, JSON.stringify(userPrefs));
    console.log('userPrefs =', userPrefs);






    //====================================================
    //====================================================
    //Your existing code goes here… - BEGIN
    //.........
    //Your existing code goes here… - END


};



