//This file shows how to customize the KTL for your application.
//Insert the code below in the Javascript pane of your app's Builder, just after the loader code.
//Once the KTL is done loading, it will apply your desired settings.
//Each block of code that starts with a line that contains "setCfg" must be located inside the ktlReady section.
//The rest can be located anywhere.
//See documentation for more details.

window.ktlReady = function () {
    ktl.scenes.setCfg({
        versionDisplayName: 'MyApp', //This will show a short version name of your app.  Leave empty to remove it.
        onSceneRender: onSceneRender, //This is sample to show how to override the default implementation.
        autoFocus: autoFocus, //Same as above.
    })

    ktl.core.setCfg({
        developerNames: ['Firstname Lastname'], //Add your name here to get super powers!

        //Main KTL feature switches.  Here is where your App can override the defaults and enable/disable the features.
        enabled: {
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

            //Those below must also be properly set up to have any effect.  See documentation.
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
}

//Here's where you put all your customimzed versions of the KTL callback functions.
function onSceneRender(event, scene, info) {
    console.log('Customized scene render.');
    var versionStyle = '';
    if (Knack.getUserAttributes() !== 'No user found')
        ktl.scenes.addVersionInfo(info, versionStyle);

    $('#verButtonId').css('opacity', '10%'); //Set Version Info Bar as barely visible.

    autoFocus();
}

function autoFocus() {
    console.log('Customized auto-focus');
}

