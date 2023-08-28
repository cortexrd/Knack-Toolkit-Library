//This file is a template that disables all KTL features in your application.
//Insert the code below in the Javascript pane of your app's Builder, just after the loader code.
//Once the KTL is done loading, it will jump in the ktlReady function and apply your desired settings.
//All code must be located inside the ktlReady section.
//See GitHub's Wiki for more details.

//Your app's version.
window.APP_VERSION = '1.0.0';

window.ktlReady = function (appInfo = {}) {
    var ktl = new Ktl($, appInfo);

    //KTL Setup - BEGIN
    ktl.scenes.setCfg({
        versionDisplayName: '', //Short version of your app name. Leave empty to hide it. Comment whole line for actual app name.
    })

    ktl.core.setCfg({
        developerNames: ['Firstname Lastname'], //Add your name here to get super powers!

        //Main KTL feature switches.  Here is where your App can override the defaults and enable/disable the features.
        enabled: {
            //"Basic" features
            //Enabled by default. To disable them, their flag must exist and be set to false.
            versionInfo: {
                viShowAppInfo: false,
                viShowKtlInfo: false,
                viShowToRoles: ['Developer'], //Array of Account Roles strings who can see the version info bar. Leave empty for all.
                viPosX: 'right', //right, center, left
                viPosY: 'top', //top, bottom
                viPosXMobile: 'center', //right, center, left
                viPosYMobile: 'bottom', //top, bottom
                viOpacity: 50, //0 to 100
                viOpacityHover: 100, //0 to 100
            },

            showMenuInTitle: false,
            selTextOnFocus: false,
            inlineEditColor: false,
            rowHoverHighlight: false,
            chznBetter: false,
            autoFocus: false,
            sortedMenus: false,
            userFilters: false,
            persistentForm: false,
            calendarGotoDate: false,
            rememberMe: false,
            formPreValidation: false,
            spinnerWatchDog: false,
            idleWatchDog: false,
            debugWnd: false,
            devInfoPopup: false,

            //Those below must also be set up properly to have any effect.  See documentation.
            iFrameWnd: false,

            bulkOps: {
                bulkEdit: false,
                bulkCopy: false,
                bulkDelete: false,
            },
        },
    })

    ktl.views.setCfg({
        headerAlignment: false,
    })

    ktl.fields.setCfg({
        convertNumToTel: false,
    })

    //KTL Setup - END


    //KTL callbacks to your App - BEGIN
    //KTL callbacks to your App - END

    /////////////////////////////////////////////////
    //Your App-specific code goes here...

}
