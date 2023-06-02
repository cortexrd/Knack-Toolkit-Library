Last updated: June 2, 2023

# Advanced KTL Development Modes

When using the KTL, there are three development modes of operation:

-   Production (“Prod”)
-   Development (“Dev”)
-   Hybrid

## About Prod and Dev modes

Traditionally, all your app code resides in the Builder's Javascript pane. This is what we refer to as the Prod mode and is the default.

But with the KTL, it is now possible to switch to Dev mode instantly to load your Javascript and CSS code at run-time directly from your hard drive. This means you can now code and save on your workstation, without having to copy/paste the code to the Builder every time you want to test a change.

This mode enables you (the developer) to work more efficiently by using your favorite code editor with all its bells and whistles, instead of the basic Builder's Javascript pane editor. You must install **Node.js** (<https://nodejs.org>) on your computer and run the [**NodeJS_FileServer.js**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/NodeJS/NodeJS_FileServer.js) script provided. Then, each time you save your code, all you have to do is refresh the browser to see the changes take effect immediately. In this mode, writing and testing code simply won’t ever get any faster.

Another great advantage is that it opens the possibility of teamwork. Currently, only one developer at a time can edit the code. With the Loader and Node.js file server, there is no conflict because each developer works with his own "sandboxed" local copy and pulls external changes whenever he/she chooses to do so.

**Furthermore and most importantly**, you can simultaneously work on a production app, running officially released and tested code, while you run development code locally – yes, two different code revisions at the same time, without conflicting! This means that the classic method of going in Knack’s Builder to create a sandbox copy of your app to develop and experiment with new code is not required anymore - or a lot less often. When your app becomes huge, creating a copy can take a whole day sometimes.

If you’re interested in peeking under the hood and understanding how the Dev/Prod mode is selected, see the file [KTL_Start.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Start.js).

## Prod Mode

This is the traditional mode that we're all used to, i.e. when all the code resides in the Builder's Javascript and CSS panes. **If you do not have coding experience, this is for you**.

### Pros

-   Easier and faster setup, no need to install anything, except the 5 lines of the [Loader](#no-time-to-read-all-this-now---how-about-a-quick-tryout).
-   Other users can always see your changes.
-   You can evaluate your code on any device, not limited to your workstation.

### Cons

-   Slower than Dev mode and more tedious to work, due to the redundant merge/copy/paste/save sequence required each time you make a change.
-   Can be risky if used in production (when the app is being used in a live and consequential context) since your development code always takes effect immediately.

To use this mode, you have two options:

1.  Use the default, basic, ready-to-use setup [here](#no-time-to-read-all-this-now---how-about-a-quick-tryout)
2.  If you want to customize the KTL’s behavior or disable some features, edit a copy of the [KTL_Defaults.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp.js) file and paste that code in the Javascript pane, after the Loader. [See Editing the KTL_Defaults file](#editing-the-ktl_defaults-file).

\*Note about **KTL_Defaults.js**: throughout the document, we will refer to this file name as the “app code”, but you can substitute it to anything that would better match your app’s name. As long as you modify the merge utility files accordingly, if you are planning to use it. See the **-filename** parameter in the batch file.

### Setup

You will need to modify the [KTL_Defaults.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Defaults.js) file to match your needs if you want to go beyond the basic default setup. [See Editing the KTL_Defaults file](#editing-the-ktl_defaults-file).

## Dev Mode

This mode provides much faster code-save-test cycles and is typically used when you have frequent code changes, and where you don't need to show your results to others until a milestone is reached. It also enables collaborative coding on the same app.

It requires the installation of Node.js as a basic local file server that the Loader uses to fetch the KTL files and your app's code. The Builder's Javascript pane only needs to contain the Loader code (5 lines!). You can also have the full Prod code without conflict. Although this means a few extra milliseconds of loading time, it allows you to leverage the powerful [Hybrid Mode](#hybrid-mode).

### Pros

-   Allows very fast "code-save-test" cycles.
-   Allows multi-developer coding collaboration without conflict.
-   Allows Hybrid Mode for development and production code running at same time.

### Cons

-   Requires a one-time Node.js installation and setup.
-   Other users or clients cannot see the updates until you merge all code and switch to Prod Mode.
-   You cannot evaluate your code on devices other than your workstation, running the file server.

### Multi-Developers Collaboration

With the Dev mode, it is now possible to have many developers write code independently on the same app since they are working on a “sandboxed” copy of their code. Of course, for other developers to see your changes, they need to pull/merge your new code with theirs, and vice-versa for you to see their changes. GitHub is excellent at that.

### Setup

Install **Node.js** (<https://nodejs.org>) on your workstation. Just the basic installation, no optional component is needed (Chocolatey).

Validate installation by typing **node -v** in a command prompt or terminal window. You should see the version number displayed.

1.  Edit the file [KTL_Defaults.js](#editing-the-ktl_defaults-file). using this procedure.
2.  Run the **FileServer.bat** utility.
3.  Alternatively to the batch file, you can also open a command prompt or a shell, go to the **code** folder (assuming default folder structure) and launch **node NodeJS_FileServer.js**.
4.  Each time you refresh your app's page, you will see logs showing the path and file name requested.
5.  Open a browser to your Knack app.
6.  Check console logs to see if all is looking good.

## Hybrid Mode

Traditionally, Knack developers have to go in the Builder to create a temporary copy of their production app to experiment freely without fearing serious consequences or disruption. While this is still desirable in many cases, you now have another option: **Hybrid Mode**. Thanks to the Loader, a hybrid setup is possible where both the Prod and Dev modes are active at the same time. This enables you to run development code in a production environment without users being affected by it.

What happens is that the Loader will use the stable and released code from the Prod in the Javascript pane by default for all users. But if it detects the “development flag” in your localStorage, it will switch to the Dev code… **but on your workstation only**.

With Hybrid Mode, it is also possible to switch back and forth between the Prod and Dev modes instantly. See [Switching Modes](#switching-modes) in the next section.

## Switching Modes

Once you’ve mastered both modes, you’ll typically spend 95% of the time in Dev mode for its efficiency and speed, and 5% in Prod mode to show updates to your client.

You can switch modes using two methods:

1.  If you have the **showAppInfo** flag enabled **and** your account has the “**Developer**” role, it will add the version info bar on the top-right of the screen. Clicking on it will show a prompt with this: **Which version to run, "prod" or "dev"?** Type in the desired mode and click ok. The page will refresh itself automatically.
2.  You can manually add a key to the localStorage for your app with the **LS Key** followed by **\_dev** like this: **KTLTu_fcbf_dev**, for example. Leave the value empty since not used. The **LS Key** can be obtained by double-clicking on your first name in the top bar, then looking at the console output. You will also find there the App ID and your User ID.

Once in the Dev mode, you will see the version shown with bright yellow/red as an attention getter that indicates you are in Dev mode.

## Cloning the Source Code

If you’re interested in collaborating with the KTL project or just study the code and “borrow” a few tricks, you will need to fetch all the files from GitHub to your workstation. The best way to do so is to install GitHub and “clone” the repository locally. You will find this under the green “\< \> Code” button at top right of this page. Alternatively, you can use “Download ZIP” under that same button. In that case, you will need to remove the “**-master**” at the end of the folder Knack-Toolkit-Library-master.

You will end up with the following folder structure on your favorite “code” folder. It will keep each app’s code separated, a single set of shared libraries, and everything easy to maintain with a revision control tool like GitHub.

.code\\Lib\\KTL\\KTL.js

.code\\Lib\\KTL\\KTL.css

.code\\Lib\\KTL\\KTL_Defaults.js

.code\\Lib\\KTL\\KTL_Loader.js

.code\\Lib\\KTL\\KTL_Start.js

.code\\Lib\\KTL\\NodeJS\\NodeJS_MergeFiles.js

.code\\Lib\\KTL\\NodeJS\\NodeJS_FileServer.js

.code\\Lib\\KTL\\Docs

Etc …

And still under the .**code** folder, this is where you add your own app files. The filename must also be inside a folder having the same name, like this:

.code\\KnackApps\\**My App**\\**My App.js**

Then any additional libraries that you’re using:

.code\\Lib\\SomeOtherCoolLib\\CoolLibCode.js
