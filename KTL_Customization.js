//This file is a template that shows how to customize the KTL for your application.
//Insert the code below in the Javascript pane of your app's Builder, just after the loader code.
//Once the KTL is done loading, it will jump in the ktlReady function and apply your desired settings.
//All code must be located inside the ktlReady section.
//See documentation for more details.

//Your app's version.
window.APP_VERSION = '1.0.0';

var ktl;
window.ktlReady = function (appInfo = {}) {
    ktl = window.ktl;

    //KTL Setup - BEGIN
    ktl.scenes.setCfg({
        versionDisplayName: 'MyApp', //This will show a short version name of your app.  Leave empty to remove it.
    })

    ktl.core.setCfg({
        developerNames: ['Firstname Lastname'], //Add your name here to get super powers!

        //Main KTL feature switches.  Here is where your App can override the defaults and enable/disable the features.
        enabled: {
            //"Basic" features
            //Enabled by default. To disable them, their flag must exist and be set to false.
            showAppInfo: true,
            showKtlInfo: true,
            showMenuInTitle: true,
            selTextOnFocus: true,
            inlineEditColor: true,
            rowHoverHighlight: true,
            chznBetter: true,
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

            //"Advanced" features
            //Disabled by default and/or must be set up properly to have any effect. See documentation.
            iFrameWnd: false,
            logging: {
                logins: false,
                navigation: false,
                activity: false,
            },

            bulkOps: {
                bulkEdit: true,
                bulkCopy: true,
                bulkDelete: true,
            },
        },
    })

    //KTL Setup - END

    /////////////////////////////////////////////////
    //Your App-specific code goes here...

}
