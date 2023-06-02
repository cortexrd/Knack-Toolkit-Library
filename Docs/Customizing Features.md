Last updated: June 2, 2023

# Customizing Features

It is possible to control the KTL’s behavior to match your needs. For example, you may want to disable a feature, modify the default colors, or respond to an event that the KTL has generated for your app.

The process is separated in two directions: **setups** and **callbacks**.

## Setups

**App -\> KTL**

A setup is done when your app sends the KTL a set of parameters to initialize itself differently than its defaults. It is usually done at startup, with hard coded or computed values.

But a setup can also occur at any other time later (runtime), using values that are based on your app’s business logic, like the account roles, time of day, geographic location, etc.

To use setups, you must add each one you need manually in your app’s code, as explained below.

## Callbacks

**KTL -\> App**

The callbacks play a major role, and can be seen as the “interface” that the KTL uses when it needs to *talk* to your App.

Some callbacks will provide additional information called “parameters”.

Those without parameters are simple event notifications, like idleWatchDogTimeout for example, that notify your app that no mouse of keyboard activity has occurred in the last hour. You can decide to force a logout typically, but only if the account Role does not include Developer.

To use callbacks, you must add each one you need manually in your app’s code, as explained below.

# Adding Setups and Callbacks

To customize the KTL, it is strongly recommended that you create a file named **MyApp.js** in which your own code will reside. Of course, the name is yours to decide, but throughout this document, we will refer to this name as a reference.

The reasons are that the file is easier to edit using your favorite editor and allows a **revision control tool** to keep track of what has changed over time. **GitHub** is a great tool and a reference in that field.

## The MyApp.js file will typically contain:

### The Loader

These are the 5 lines from this file: [KTL_Loader.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Loader.js)

### The KTL setups/callbacks

You will copy the contents of the [KTL_Customization.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Customization.js) file below the Loader.

This is a startup “template” with a few feature flags and the KTL’s entry point, the **ktlReady** function.

The number of lines contained will grow over time as you need more customizations.

This is where you can disable features, for example. More on this below.

### Your app-specific code

Copy your existing code from the Javascript pane in the Builder to this section, after the comment: **//Your App-specific code goes here...**

### Workflow

Each time you want to change the KTL setup, callbacks or your own code, do all the editing in this file. Then when you need to test it, copy its content to the Javascript pane in the Builder, save, refresh your app and see if all works as expected.

Keep an eye on the console output (F12 in most browsers) to see if there are errors.

If you’re tired of this redundant routine, consider using the KTL’s **Dev mode**. Its purpose is to address this issue. It requires a bit of setup, but it’s well worth it.

# Disabling and Customizing Features

Before you can disable of customize features, it is assumed that you have read and implemented the previous section: [Adding Setups and Callbacks](#_Adding_Setups_and).

## Disabling a Feature

In MyApp.js, locate the **ktl.core.setCfg** function. This is where you will find the basic feature flags, under **enabled**.

All KTL **basic** features are **enabled by default**. So you must explicitly disable them individually.

For example, you don’t want to see the version info bar at top-right of the page, set this to false: **showAppInfo: false**

**Note**: Some advanced features that require some additional configuration are enabled by default but won’t take effect until the setup is done.

## Customizing a Feature

1.  Open the [KTL_Defaults.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Defaults.js) file in your favorite editor.

### Flags

1.  Locate the **//KTL Setup** section and copy each setCfg function that you want to customize in your MyApp.js file, **inside** the ktlReady function’s brackets, before the **//KTL Setup – END** marker.
2.  Go through each flag and set them to match your needs. You should keep only what is needed and delete the rest to keep the file lean and clean.

### Callbacks

You can customize any existing callback by copying the default implementation from [KTL_Defaults.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Defaults.js) to your file and modifying its code. You must also add its reference in the matching setCfg function.

Ex: For **onSceneRender**, we need this line in **ktl.scenes.setCfg**.

```
        ktl.scenes.setCfg({
            onSceneRender: onSceneRender,
        })
```

1.  Locate the **//KTL callbacks to your App** section and go through each function, adapting them to match your needs.

### Testing

1.  Copy/paste the content of your file in the Javascript pane and save.
2.  If you are in Dev mode, the previous step is not required since the local file server will load the code from your workstation directly.
3.  Open a browser to your Knack app.
4.  Check console logs to see if all is looking good.

## Keeping your MyApp file in Sync

Since the [KTL_Defaults.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Defaults.js) file is subject to frequent changes over time, mainly due to added functionalities, is it strongly recommended that you go fetch the latest version regularly to see what has changed.

Omitting to do so will not have any negative impact other than not fully benefiting from the latest updates.

GitHub is great as showing each submitted set of changes over time.
