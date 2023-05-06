# ![A picture containing text, clipart Description automatically generated](./Docs/media/f885aa5ef3409ff28bd30849d54ad54c.jpeg)

Last updated: April 6, 2023

# Contents

[Introduction](#introduction)

[Installation](#installation)

[KTL Features](#ktl-features)

[Customizing Features](#customizing-features)

[Advanced Features](#advanced-features)

[Advanced KTL Development Modes](#advanced-keywords-setup)

[List of all Keywords](#list-of-all-keywords)

# Introduction

**What is the Knack Toolkit Library?**

The Knack Toolkit Library, or KTL for short, is a collection of open-source Javascript utilities that eases Knack application development by adding several features that are not easily created from the ground up.

You do not need any coding skills to benefit from the KTL. The simple **“keyword-based”** approach allows you to use the Builder to trigger the desired features and specific behavior.

For the few features that require API calls, everything is done to minimize their usage as much as possible. All calls are 100% view-based, so **your API key is never used**.

# What are Keywords?

KTL uses reserved keywords to trigger features. You decide *if* and *where* you need them. All keywords are created in the Builder and are **never visible** in the app. All keywords must start with an underscore followed by a letter, ex: **\_ts**.

They are used in two ways: per view and per field.

## Per View

Keywords can be added in the view’s **title** or **description** - interchangeably or together. Each keywords are separated by a space, or line feeds (return) when used in the description box.

## Per Field

Keywords can be added in the field’s **description** in the object.

## Placement

For views, all keywords must be placed **after** the last word that you intend to keep visible. All text beyond the first keyword found will be truncated (invisible) in the app. For fields, it is not relevant since descriptions are “internal notes” for developers only and not visible in the app anyways.

## Parameters

Some keywords require one or more parameters, and some may be optional. When using parameters, the equal sign “=”operator is added after the keyword, followed by the parameter(s). If multiple parameters are used, the comma is the separator and spaces are allowed.

Ex: \_rvs=vTitle1, vTitle2

The keywords are not case-sensitive, but the parameters are and must always be an **exact match** to take effect.

# Installation

## No time to read all this now - How about a quick tryout?

If you want to try/use the basic default setup version of the KTL, all you need to do is copy the **5 lines** of code from this file [**KTL_Loader.js**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Loader.js) at the **top** of the Javascript pane of the Builder. See the next section for the list of basic features.

If you already have your own code, it will not conflict with the KTL. Just leave it after those added lines.

If you do not like some features, you can turn them off individually – [see here](#disabling-a-feature).

## Basic Setup

**Zero config needed for Basic Features**

Right out of the box, without any coding or complex setup, the KTL will provide these nice additions to your app:

-   Using reserved keywords to trigger special behavior. [See list](#list-of-all-keywords).
-   User filters to save your filters to named buttons
-   Bulk Operations: Edit, Copy and Delete
-   Form data persistence that saves as you type, and will load back your data if a page is reloaded after a submit failure or power outage
-   Dropdown selector improvements
-   Numeric pre-validation
-   Auto-focus on first field of a form or search field in a table
-   Sorted menus
-   Show page’s title in browser’s tab
-   Go to Date selector added to all calendar views
-   Better keyboard support: Enter to Submit, image viewer left/right arrows for next/prev, and esc to exit
-   Custom highlight/color for table’s inline-editable fields for easy identification
-   Custom highlight/color for table row hover
-   Ctrl+Click on a table’s header to invert the default sort
-   Idle (inactivity) timeout watchdog
-   Spinner timeout watchdog
-   Kiosk mode support
-   Debug window for embedded devices

## Advanced Setup

Click the following links if you are interested to know more about [Advanced Features](#advanced-features) and [Advanced KTL Development Modes](#advanced-keywords-setup).

# KTL Features

The KTL is organized around these feature categories:

-   Loader
-   Core
-   Storage
-   Scenes
-   Views
-   Fields
-   Bulk Operations
-   User Filters
-   Form Persistence
-   Accounts
-   User Preferences
-   iFrame Window
-   Debug Window
-   Logging
-   Windows Messaging
-   System Info
-   System Colors

In the next section, we will go through each one and see what they can do, with the list of all available functions to you as a developer, if ever you’re interested in trying out the more advanced features.

## Loader

### Usage

This is where the KTL is initialized and where the [Dev or Prod](#switching-modes) mode is selected.

### Functions

-   The Loader has no exposed functions.

## Core

### Usage

This contains generic utility functions, used by most other features internally, but also available to your app.

### Functions

-   **setCfg**: This is where you can enable the features you want.
-   **getCfg**: To get the config and read the flags.
-   **knAPI**: Knack API wrapper with retries and error management.
-   **isKiosk**: For support of kiosk mode applications. You decide the trigger conditions for kiosk mode in a callback function. It is possible to switch back and forth between the Normal and Kiosk modes if you have the Developer role and Ctrl+Click on the version info bar.
-   **hideSelector**: To move away elements off the screen to hide them or save real-estate.
-   **waitSelector**: When you need to wait until an element exists or is visible.
-   **waitAndReload**: Waits for a specific delay, then reloads page.
-   **switchVersion**: To toggle between production and development versions.
-   **enableDragElement**: Provides basic drag’n drop functionality to an element.
-   **splitUrl**: Creates an array containing the path and parameters of the URL.
-   **getMenuInfo**: Retrieves the top menu, menu, page and URL information.
-   **isHex**: For hexadecimal format validation.
-   **isIPFormat**: For IP format validation.
-   **getSubstringPosition**: Returns the index of the Nth occurrence of a string within a string.
-   **addZero**: Adds leading zeros to 2 or 3-digit numbers, typically for logs alignment.
-   **getCurrentDateTime**: Generates a local or UTC date/time string.
-   **dateInPast**: Compares the first date to the second one and returns true if it's in the past, ignoring the time component. If a second date is not provided, it uses today.
-   **isMoreRecent**: Compares two dates and returns true is first parameter is more recent than second one. Resolution is one minute.
-   **selectElementContents**: Selects all element's text.
-   **timedPopup**: Generates a brief, auto-delete popup with status text and color.
-   **removeTimedPopup**: To remove the timedPopup.
-   **infoPopup**: Similar to timedPopup, but without an expiration delay. Removal must be done manually. Useful for progress indicators.
-   **setInfoPopupText**: To indicate general information, status, or progress in infoPopup.
-   **removeInfoPopup**: To remove infoPopup.
-   **insertAfter**: To insert a node after an existing one, but as sibling, not as a child.
-   **setContextMenuPostion**: Upon right-click, ensures that a context menu follows the mouse, but without overflowing outside of window.
-   **getObjectIdByName**: Pass the object’s name and returns the object’s ID.
-   **getFieldIdByName**: Pass the field name and object ID and will return the field’s ID.
-   **getViewIdByTitle:** Pass the view title (and Page URL optionally) and returns the first view ID containing specific text in its title, with optional exact match.
-   **sortMenu**: Will sort the sub-menus in alphabetical order.
-   **sortUList**: Will sort any un-ordered list in alphabetical order.
-   **convertDateTimeToString**: Will convert a Date object to a string, ISO or US format, and date only option.
-   **convertDateToIso**: Converts a date string from US to ISO format. US is for various Knack functions like API calls and filtering, whereas ISO is for HTML objects like calendar input types.
-   **getLastDayOfMonth**: Pass a date string and it will return the last day of that month, as a string, is ISO or US format.
-   **injectCSS**: Used internally to add custom styles at run-time based on user’s settings.
-   **toggleMode**: Toggles back and forth between the Prod and Dev modes. Only for Developer role. This is invoked when the version info bar is clicked.
-   **loadLib**: Loads an external Javascript library. Used when additional libraries are required upon activation of a specific feature. Ex: SecureLS for encrypting data in localStorage.
-   **generateRandomChars**: Utility that generates random characters of a specified length. Currently used for AES-256 encryption.
-   **findLongestWord**: Utility that returns the longest word in a phrase.

### A note about knAPI

While Inline editing is mandatory for PUT (edit) operations on a table, sometimes it may not be desirable to let users modify data manually. You can disable these inline edits by adding the view title keyword **\_ni**. This allows the API calls to work properly, while disabling the mouse actions.

\* Note about security: use this keyword with caution as it only disables the user interface. Someone with coding skills and bad intentions could still modify the data using commands in the console.

## Storage

### Usage

Provides non-volatile storage utilities using the localStorage and cookies objects. It is the cornerstone of several other features.

### Functions

-   **hasLocalStorage**: Returns whether or not localStorage is supported.
-   **lsSetItem, lsGetItem, lsRemoveItem**: Saves, loads, and deletes text item in app-specific keys. By default, localStorage is used, but the “session” parameter allows using the sessionStorage instead for non-persistent data.
-   **saveUserSetting, loadUserSetting, setCookie, getCookie, deleteCookie, deleteAllCookies**: Same but using cookies.

## Fields

### Usage

Provides field-related features like auto-select all text on focus, convert from text to numeric and enforce numeric validation or uppercase letters.

### Functions

-   **setCfg**: Set all callbacks to your app, like keypress event handler and field value changed. Use the textAsNumeric array to specify which fields must be considered as numeric even though you have set them up as Short Text in Knack. This can be particularly useful in specific use cases. For example, you can dynamically change this to allow a unique Account Role to enter letters, while all others can only enter digits. It is possible to modify the radio buttons and checkboxes to have a horizontal layout by setting the horizontalRadioButtons and horizontalCheckboxes flags to true.
-   **convertNumToTel**: All numeric fields will automatically be converted to telephone type. This has no negative or perceptible impact for all users, except that it allows mobile devices to switch the keyboard to telephone type for a more convenient numeric layout and also auto-selection of all text upon focus.
-   **enforceNumeric**: Provides automatic pre-validation on those fields:
    -   all **Number** type fields
    -   any **Short Text** fields having the **\_int** or **\_num** keywords in their description
    -   all fields specified in the **textAsNumeric** array.

        If an illegal numeric value is found during typing, the submit button will be disabled (grayed out), and the field will be colorized with Knack's "pink" error indicator.

-   **addButton**: Will add a button to a specified div element. You can specify the label, style, classes and ID, and it will return a button object to which you can attach your event handlers.
-   **addCheckbox**: Similar to addButton, but for a checkbox.
-   **addRadioButton**: Similar to addButton, but for radio buttons.
-   **Barcode reader specific functions**: **addChar, clearBuffer, getBuffer, setUsingBarcode,** and **getUsingBarcode**. Useful in the context of business and industrial projects.
-   **addChznBetter**: The chznBetter object is a custom solution that fixes a few problems with the Knack dropdown object. The most annoying being the following: When you have more than 500 items in the list, the dropdown switches mode and displays a search field. But most of the time, when 3 or 4 characters are typed, the last one or two are erased, rendering the selection very tedious. We got so many complaints about this that we decided to code our own solution. As a bonus, you can now customize the delay before the search starts (common to all dropdowns), and for individual dropdowns, the threshold number of characters to type before the search starts. Defaults are 1.5 seconds delay, and 3 characters for short text fields and 4 for textAsNumeric fields. Use the ktl.fields.setCfg function to modify chznBetterSrchDelay and chznBetterThresholds to match your needs.
-   **searchChznBetterDropdown**: chznBetter's wrapper to searchDropdown. Mainly used internally, but accessible to your app in case of specific needs.
-   **inlineEditChangeStyle**: To dynamically modify of an inline edit cell, typically to make it wider to more text. Not completed, work in progress.
-   **onFieldValueChanged**: Callback to your app to process value change events for Dropdowns and Calendars. Driven by processFieldChanged function. More field types will be added eventually.
-   **getFieldFromDescription**: Returns an object with the field ID and view ID of a field containing specified text in its description.
-   **getFieldDescription**: Returns the description text from the field ID parameter.
-   **getFieldIdFromLabel**: Returns the field ID with the specified view and label. The label is the one displayed, not the field's real name. Exact match as option.
-   **getFieldKeywords**: Returns the keywords for the specified field ID.

### Adding keywords to a field’s description to trigger features

In the Builder, when you edit a field in the schema view, there’s a Description text box, where you can put your own notes, as a developer. Now, this can also be used by the KTL to trigger special behavior. See [What are Keywords?](#what-are-keywords) For more details.

Here is the list:

**\_uc**: to convert text to uppercase in real-time

**\_num**: Numeric characters only, including decimal dot. This will prevent entering any other characters even if the field type is short text. Validation is done in real time with enforceNumeric.

**\_int**: Integer characters only (0-9). This will prevent entering any other characters even if the field type is short text. Validation is done in real time with enforceNumeric.

**\_ip**: enforce IP format, with automatic colons and hex char real-time validation (not yet implemented).

**\_lud and \_lub**: Last Updated Date and Last Updated By. Both must be used together. \_lud is a date/time field and \_lub is a connection to an account. When this pair of fields are included in a table that has Inline Editing enabled, each time the user modifies **any** cell, an API call will automatically update these two values with the current date/time and the logged-in account.

## Views

### Usage

Provides view-related features.

### Functions

-   **setCfg**: To setup your parameters and callbacks to your app. Callback processViewKeywords allows you to process your own special title keywords.
-   **refreshView**: Robust view refresh function with retries and error handling. Supports most types of views including tables, details, searches, forms, rich text, and menus.
-   **refreshViewArray**: Calls refreshView for each view in the array of view IDs as parameter, and returns (resolve from promise) only when all are done refreshing.
-   **autoRefresh**: You can now add auto refresh to any view without a single line of code. It is done from the Builder, by simply adding **\_ar=30** at the end of your view's title and it will refresh itself every 30 seconds. Values from 5 (seconds) to 86500 (24 hours) are accepted. Of course, the keyword is truncated so only your title remains visible. Also, you can start and stop the process at will by setting the run parameter to true/false. Note that this will apply to all views in scene.
-   **addViewId**: Convenient for developers who want to see the view id next to or near the title.
-   **addCheckboxesToTable**: Will add checkboxes to a table, including the top one in the header to check all at once. Used by bulk operations.
-   **addTimeStampToHeader**: Useful to see when the last refresh date/time occurred and assess that your app is running smoothly.
-   **hideField**: Moves a field away from the screen to hide it or save space.
-   **searchDropdown**: Searches text in a dropdown or a multiple choices object, with these options: exact match, show popup for outcome. Currently supports 3 different states of the dropdown: single selection, less than 500 and more than 500 entries. Will auto select the found result it it is an exact match. Otherwise returns all found items and lets you manually choose from the results list. Multiple selections are more complex and will be supported eventually.
-   **findInSearchView**: Uses a Search view to find text, with exact match. Very useful to prevent duplicate entries on a connected field, for example, by doing a hidden search on that view before submitting a new connected record.
-   **removeTableColumns**: Will hide or remove columns from a table. Pass it an array of field ids, and/or array of columns indexes to remove. Also works with action links, which is useful to remove a Delete action if the logged-in role should not be allowed for example.
-   **findFirstExistingField**: Pass a list of field IDs and returns the first found in scene.
-   **findRecord**: When a table is rendered, pass its data to this function along with the field and a value to search. It returns the record found, or undefined if nothing is found.
-   **searchRecordByValue**: This is used in a Search view, where you pass the view ID and value to be searched. The field ID is used to set the value in the proper input field, when more than one. Resolves with an array of data records found.
-   **handleClickSort**: Inverts the sort order if the data type is Date/Time. In several apps, we’ve been told that too often users need to click the header twice because they want to see the most recent entries. You can also do a Ctrl+Click to sort it ascending like Knack’s default behavior.
-   **submitAndWait**: Pass a form’s view ID and an object containing pairs of field IDs and values. It will fill in the form and submit automatically, then return with a success or failure outcome. If successful, the resulting record is also returned and can be used for further processing.
-   **waitSubmitOutcome**: After submitting a form programmatically, this Promise function will wait for the outcome and resolve with the success message and reject with the failure reason.
-   **updateSubmitButtonState**: Used to perform real-time form validation, i.e. before Submit is clicked, by enabling or disabling the button based on your criteria. Pass the form’s view ID and it will enable or disable the Submit button. This status extends the existing **validity** property of the button, by adding the **invalidItemObj** object to it. When this object is empty, Submit is enabled, if it contains any key, it will be disabled.
-   **ktlProcessKeywords**: This is an internal function that is not exposed. But worth some additional explaining, nonetheless. It parses the view's title for keywords that trigger special behavior. See the list and details below.
-   **handleCalendarEventDrop**: Provides notification that a drag’n drop operation has been done on a calendar event. This can be used to sync a table to a calendar.
-   **getDataFromRecId**: returns the data record for a given view and record ID. Works with Tables and Search views.
-   **getViewSourceName**: Returns the object’s name for the given view ID.

### Adding keywords to a view’s title or description to trigger features

You can add reserved keywords **at the end of your view’s title** **or description** to trigger special behavior. See [What are Keywords?](#what-are-keywords) For more details.

Here is the list:

**\_ar=n**: Auto Refresh view. The view will be refreshed periodically every “*n*” seconds. It is possible to manually start/stop the process using the autoRefresh function.

**\_hv**: Hidden View. Moves the view away from screen but kept in DOM. Used to save real-estate, while maintaining API calls and automated search capabilities.

**\_ht**: Hidden view Title. Used to save real-estate while keeping the title in the Builder.

**\_hc=colHeader1, colHeader2**: Hidden Columns. To hide a grid’s columns, based on the header’s exact text. The columns are only hidden but still exist in DOM. The visibility can be reversed on the fly with a bit of extra code. Hiding a column is useful to save real-estate or hide its data, while maintaining API calls capability or allow filtering on all fields.

**\_hf=fieldName1, fieldName2**: Hidden Fields. To hide fields in a view, based on their exact names. Typically used with utility fields that don’t need to be visible.

**\_rc=colHeader1, colHeader2**: Removed Columns. To delete de columns based on the header’s exact text. This will delete them from the table **and** the DOM. Like \_hc, removing a column will maintain API calls capability and allow filtering on its field.

This option is “somewhat” a bit more secure than \_hc since it’s not as easy to peek at data from the browser’s console. Though someone could intercept the data *before* it’s been removed, i.e. while it’s being sent by the server, so keep this in mind.

**\_nf=field_x, field_y, field_z**: No Filtering. Will prevent filtering on these fields, even if they are visible in the table.

**\_ni=colHeader1, colHeader2**: No Inline editing on columns with specified headers. If no parameter is supplied, it will apply to the whole table. Disables inline editing for the user, even if enabled in the Builder. Enabling inline editing is required for API calls in tables, but not always desirable at the user interface. This provides a solution.

\* Note about \_ni security: use this keyword with caution as it only disables the user interface. Someone with coding skills and bad intentions could still modify the data using commands in the console.

**\_dr=rowsNumber**: Displayed Records. Sets the initial number of rows in a table, allowing to go beyond the maximum value of 100 in the Builder. This is applied when the page is first opened.

**\_lf= vTitle1,vTitle2**: Linked Filters. Add this to the main “controlling” view, and all other views will apply the same filtering pattern. The number of records per page, sort column+order and searched text will also apply, if the view allows it.

**\_dtp**: Add Date/Time Picker to a table. The table **must have a Date/Time field**, and the first one found from the left will be used. Six new fields will appear at the top of your table view: **From**, **To** and periods as **Monthly**, **Weekly**, and **Daily**. Depending on the active period, when you change From, the To field will automatically update itself accordingly, and the view will be filtered in real-time. On the other hand, if you change the To date, the From will not be affected, leaving you more flexibility. The focus is conveniently placed on the last field used so you can use the up/down arrows to scroll quickly through months and visualize data. This is also compatible with additional filter fields, provided that the AND operator is used. Once you have a filter that you like, it is also possible to save it as a [User Filter](#user-filters).

**\_rvs=vTitle1,vTitle2**: Refresh Views after a Submit. Add this to a form’s title and when it is submitted successfully, will refresh any other views specified. Use the exact full title text, separated by commas, spaces are allowed.

Ex: **Customer Sale \_rvs=Client Sales, Store Sales**

Here, the form’s visible title will be “Customer Sales”, and when submitted successfully, the two views with the title “Client Sales” and “Store Sales” will be refreshed.

**\_rvr=vTitle1,vTitle2**: Refresh Views after a Refresh. Same syntax as \_rvs. Used to trigger a refresh to other views. Care must be taken to avoid infinite circular loops: A\>B\>C\>A\>B\>C…

**\_rvd=vConfTitle,vTitle1,vTitle2**: Refresh Views after a Drop. Used to confirm that a drag’n drop operation has completed successfully after an event has been moved or resized in a Calendar view. Optionally, if additional view titles are supplied, those will be refreshed. The first parameter **vConfTitle** is a List view of same object as the calendar, with the events’ date/time field, that must be added in the same page as the Calendar view. It should have the **\_hv** keyword since it’s a utility view that displays no useful information. It only serves to perform a GET API call on it.

**\_qt=bgColorTrue,bgColorFalse**: Quick Toggle of Boolean fields in a Table or Search view. Will queue all clicks on cells with a Yes/No type of fields and will invert their state in a background processing loop. Optional true/false/pending colors can be specified, compatible with all web formats like \#rrggbbaa, \#rgba and named colors (ex: darkolivegreen). The colors can be app-wide or on a per-view basis, as desired. See quickToggleParams for details in the KTL_KnackApp.js file.

**\_mc=colHeader**: Match Color of the whole row to the cell at a specific column in a table. Can be used in conjunction with the \_qt feature to use its colors.

**\_uvc=fldName1, fldName2**: Unique Value Check. Used when it is not possible to use the Builder’s **Must be unique** option due to the nature of the field. This is the case for Connected and Text Formula fields. This features requires additional setup in the field’s description and a dedicated hidden Search view. See instructions in the [Advanced Keywords Setup](#advanced-keywords-setup).

**\_uvx=str1, str2**: Unique Values Exceptions. Used when we need unique values, but with a few specific exceptions. See instructions in the [Advanced Keywords Setup](#advanced-keywords-setup).

**\_km:** Triggers the Kiosk mode for that page. This only applies for any role other than Developer. For the accounts having the Developer role, it is possible to switch back and forth between the Normal and Kiosk modes by doing a Ctrl+Click on the version info bar.

**\_kr**: Kiosk add Refresh button. For Kiosk mode only, when there’s no keyboard/mouse. When this keyword is used, any menu on the page will be moved next to it to save space.

**\_kb**: Kiosk add Back button.

**\_kd**: Kiosk add Done button.

**\_al**: Auto-Login, with AES encrypted email/pw stored in localStorage. This must be in the view title of the **login page**. Used to automate boot-up of Kiosks, Dashboards or any unattended devices. A first-time setup procedure must be done manually, by entering an encryption key then the email/pw information. This is done for each new device and can be bypassed if desired.

**\_yourOwnKeywords**: You can also add your own app-specific keywords and process them in the callback function processViewKeywords.

## Scenes

### Usage

Provides scene-related features.

### Functions

-   **setCfg**: To set up your parameters and callbacks to your app.
-   **getCfg**: To read the idle watchdog delay value.
-   **autoFocus**: Callback to your app's handler of autoFocus. By default, Knack does not set the focus to a field. But this enables you to choose when and how to do it – your way. For your convenience, a sample snippet is included, but feel free to adapt it to your needs.
-   **renderViews**: Renders all views in the current scene.
-   **addKioskButtons**: In kiosk mode, most of the time there is no mouse or keyboard. This enables adding specific buttons, typically for navigation: Back, Done, Refresh. We've also added support for Work Shift and Messaging buttons, but they are currently disabled by default. If ever you need them, more information will be provided upon request.
-   **spinnerWatchdog**: This is a timer that checks if the app is in a waiting state. If the spinner takes more than a specified amount of time (default is 30s), you can gain back control, typically by reloading the page. Most of the time, this solves the "infinite waiting" problem after a Submit or any page load/refresh, especially for kiosks without a keyboard, where users would otherwise have to reboot the device. After quite a bit of experimentation, we were surprised to observe that a submitted form was indeed sent successfully, but it was the screen refresh that never came back. This forced refresh solved the problem at least 90% of the time.
-   **isSpinnerWdRunning**: Returns true if page is busy and spinner is shown.
-   **flashBackground**: Simple attention getter, useful on small devices monitored from a distant area, to show status like success or failure.
-   **resetIdleWatchdog**: The idle watchdog is an “inactivity timer”. Each time a mouse click/move, or a key press is detected, this is called. After a given amount of time without activity, the idleWatchDogTimeout callback (below) in your app allows a specific action to take place.
-   **idleWatchDogTimeout**: The idle callback to your app, typically for reloading the page or logging out the user.
-   **findViewWithTitle**: Searches through each view in the current scene and returns the first view ID containing specific text in its title, with optional exact match.
-   **scrollToTop**: Scrolls the page all the way up.
-   **addVersionNumber**: Adds the app and optionally the KTL version numbers on the page. It is possible to make the version info bar invisible or to move it to the bottom of the page if desired. If made invisible by setting its opacity to 0, it will become visible upon mouse hovering. See the usage and examples in the onSceneRender function in the KTL_KnackApp.js file. The version info bar is used to trigger a popup with useful Developer on-the-fly features. This popup can also be used by other roles, by entering the PIN setup by devOptionsPin.
-   **isiFrameWnd**: returns whether the window is the top-level app, or the hidden child utility page called iFrameWnd.
-   **onSceneRender**: Callback to your app's handler of a “knack-scene-render.any” event.

### Adding keywords to a rich text view to trigger features

In the Builder, you can add a rich text view with these keywords to trigger special behavior. See [What are Keywords?](#what-are-keywords) For more details.

The page must have **only one view,** have the “Include this page in the Page Menu” flag active and be in the **top** **menu** (not in a sub-menu).

**\_ols=url** : Open Link in Same page. To redirect your browser to another URL, on the same page. In the rich text, add the keyword **\_ols=** as plain text, followed by a **link** to the website and a descriptive text (or same URL).

**\_oln=url** : Open Link in New page. To redirect your browser to another URL, in a new tab. In the rich text, add the keyword **\_oln=** as plain text, followed by a **link** to the website and a descriptive text (or same URL).

Ex: \_oln=[Support](https://ctrnd.com)

When clicked on the Support top menu, a new tab will be opened to the Cortex R&D Inc. website.

## Form Persistence

### Usage

When user types-in data in a **Add form**, values are saved to localStorage and restored in case of power outage, accidental refresh, loss of network or other mishaps. **Data is erased** when the form is **submitted** **successfully,** or user **navigates away** from page.

The Edit form is not supported as it would cause confusion as for distinguishing between the data pulled from Knack vs the stored one.

### Functions

-   **setCfg**: To define scenes and fields to exclude, i.e. that are never saved.

## User Filters

### Usage

When "Add filters" is used in tables and reports, it is possible to save each one you create to a named button by clicking on the yellow diskette save icon. The [X] icon with a pink color is to remove the active filter and see all records. Your filters are saved in localStorage but can be saved/restored to/from Knack for backup or migration to other devices, provided some additional setup. See the [User Filters setup procedure](#user-filters-1).

Each active filter will not only remember its filter parameters, but also the column selected for sorting, the sort order, and the searched text. You can rename and delete buttons at will, and you can also drag and drop the buttons to re-order them at your convenience. The button colors will have matching variations based on the app's header color. Each view remembers the last active filter when you go back to its page.

The User Filters feature is enabled by default, but you can disable it by setting the userFilters flag to false in the ktl.core.setCfg function.

### Public Filters

If you are annoyed by the limitations of **Filter menus** that only have one field and without AND/OR operators, then you will find Public Filters very useful. They are the same as User Filters but created by special users, yet visible to everyone.

First, you need to perform the setup of the [iFrameWnd](#iframewnd) and the [Heartbeat Monitoring and SW Update](#heartbeat-monitoring-and-sw-update).

Then, create a **Public Filters** role and assign it to the privileged users of your choice. When they create their filters, they can right-click the assigned button to open the popup menu, where an option is shown: **Public: Yes/No**. Clicking on it will broadcast the new filter to all users. Within about 20 seconds, they will see it appear on all opened pages with that view. The Public Filters are always located to the left of the other filters with a slightly increased color and kept in the same order as the creator’s. They cannot be renamed, deleted or re-ordered by regular users.

### Functions

-   **setCfg**: When User Filters are enabled with the main flag, it is possible to use the allowUserFilters callback to your app to disable it based on specific conditions. Ex: Kiosk mode devices usually don’t have filters enabled, while all others do.

## Bulk Operations

### Usage

There are three types of bulk operations: Bulk Edit, Copy and Delete. As their names imply, they provide the ability to perform multiple record modifications, duplications or delete operations in batches. They work with table views and have a global flag to enable each of them separately.

Tip: When selecting rows and headers, it is possible to Ctrl+Click on checkboxes to toggle them all Off or On at once.

### Bulk Edit

This allows copying one or many fields from one record to many other records. To use this feature, you must:

1.  Make sure that the bulkEdit flag is enabled in the ktl.core.setCfg function. This is already done in the default basic setup.
2.  Create an account role named "Bulk Edit" and assign it diligently to very trusty and liable users.
3.  For each applicable table, enable Inline editing and be sure to disable all the fields that should be protected against unintended modifications.

**Setting up the source record**

Make sure that your desired data is visible in one of the records in the table. This will be the **source record**, i.e. the one being copied from. If all the source row fields are not exactly as you wish, you would typically choose another record, or do a few inline edits until they match your requirements.

**Selecting records to be modified**

Select all the checkboxes for the records to be modified in the first column. A highlight will indicate each selected row.

The mouse cursor will change to a **target**, indicating that you can now select the **source record**. At that point, you have two options: single or multiple fields edit.

**Single Field**

If you only want to modify one field, click on any field in the table and its content will be applied to all selected rows, same field. A pop-up message will ask for confirmation before proceeding.

**Multiple Fields**

If you want to modify several fields at once, click on the desired checkboxes in the headers of those fields, at the top of the table. All cells to be affected by the operation will be highlighted at the intersection of the selected rows and columns.

You can click anywhere in the table and this cell’s row will determine the source record whose data will be applied to the selected rows. A pop-up message will ask for confirmation before proceeding.

**Progress and completion**

A progress indicator will show up and a confirmation message will pop up after completion.

\*\* Important note\*\* the table's sort+filter combination may cause your changes to disappear due to becoming out of scope. This is normal. You can prevent this by first choosing a sort+filter combination that will not cause this. Ideally set the filtering to show only a very restricted number of records, but still include the ones you need. Experimenting with only a few records at a time (less than 10) or even better “test records” is recommended as a starting point.

**Interrupting the process**

If you realize you’ve made an error, the process can be interrupted (but not undone) at any time by pressing F5 to reload the page.

**Reuse Last Source**

Once you’ve completed the first Bulk Edit operation, a new button will show up labeled “Reuse Last Source”. As its name implies, it allows applying successive Bulk Edits with the same data, over and over. Just select a new set of records with the left checkboxes and click the button. Note that the header checkboxes are not relevant and will be ignored in this case. The last data source tied to the button will remain in memory as long as the page is not refreshed. You can navigate back and forth to any pages to see something, come back to the original page and reuse that same data again. Also, as a reminder of the last operation, it is possible to peek at the data source by doing Ctrl+Click on the button.

### Bulk Copy

This allows the creation of a desired number of records based on a source record and specified fields. To use this feature, you must:

1.  Make sure that the bulkCopy flag is enabled in the ktl.core.setCfg function. This is already done in the default basic setup.
2.  Create an account role named "Bulk Copy" and assign it diligently to very trusty and liable users.
3.  For each applicable table, enable Inline editing and be sure to disable all the fields that should be protected against unintended copying.

**Setting up the source record**

Make sure that your desired data is visible in one of the records in the table. This will be the **source record**, i.e. the one being copied from. For a Bulk Copy to be possible, you must select **only one row** and **at least one header**. If all the source row fields are not exactly as you wish, you would typically choose another record, or do a few inline edits until they match your requirements.

You can click on the Bulk Copy button and enter the desired number of copies. A pop-up message will ask for confirmation before proceeding.

Progress will be displayed, and it is possible to interrupt the process just like the Bulk Edit (see above).

**Finding the new records**

It is strongly recommended that an Auto Increment field is added to the table, in order to be able to find the newly created records by sorting them on this field in decrementing order. This will conveniently place all new records at the top of the table and ready for a session of manual fine-tuning.

### Bulk Delete

This allows deleting records based on manual selection or on all records resulting from a filter being applied. To use this feature, you must:

1.  Make sure that the bulkDelete flag is enabled in the ktl.core.setCfg function. This is already done in the default basic setup.
2.  Create an account role named "Bulk Delete" and assign it diligently to very trusty and liable users.
3.  For each applicable table, a Delete action link must be added.

You will see two buttons appear:

-   **Delete Selected**: Is enabled when at least one record is selected
-   **Delete All**: Is enabled when "Add filters" is used. The checkboxes are ignored, and the process will keep deleting records until none is left, flipping through pages automatically.

If you realize you’ve made an error, the process can be interrupted (but not undone) at any time by pressing F5 to reload the page.

### Functions

-   **deleteRecords**: Used internally by bulk delete to delete an array of records but may be used elsewhere by your app if ever needed.

## Account

### Usage

Provides features for the currently logged-in account.

### Functions

-   **isDeveloper**: Check if the list of role names contains "Developer"
-   **isLoggedIn**: Returns false if Knack.getUserAttributes() is not "No user found" (not logged-in).

## User Preferences

### Usage

Provides various settings for the currently logged-in account. Some are built-in, and more can be added by your app. You can control which settings can be modified by the user and they can access them in the Account Settings page. See the [User Preferences setup procedure](#user-preferences-1).

### Functions

-   **setCfg**: To set up your parameters and callbacks to your app. The allowShowPrefs() callback is where you can control what preferences you give access to specific roles. Typically, this is used to give access to more advanced flags to developers. The applyUserPrefs callback is where you can process your own custom preferences.
-   **getUserPrefs**: Reads the user preferences from localStorage.

## iFrame Window

Referred to as the **iFrameWnd**, it's a hidden utility page that is dynamically created at the bottom of the main app page. It contains various views to implement system status, user preferences, remote SW updates and logging features. You may even add your own views if you need any. The idea is to be at two places at the same time: The main app page that changes as the user navigates around, and that invisible iFrameWnd that stays with us to serve various functions in the background. When the user logs-in, the authentication token is conveniently shared with the iFrameWnd, allowing us to log-in seamlessly and do API calls. If desired, it is possible to exchange information between both windows using the powerful [wndMsg](#windows-messaging) feature.

### Usage

-   It is used to monitor the current SW version on all devices, perform remote SW updates, send UTC timestamps called *heartbeats* from devices to the system to assess sanity/presence.
-   The user preferences are also read/modified here, including various debug flags and the work shift.
-   A logging table is used to send all logs to Knack via an API call. It contains the 5 most recent logs with a unique identifier (Log ID) to confirm the transaction.
-   To enable and configure the iFrameWnd feature, see the [iFrameWnd setup procedure](#iframewnd).

### Functions

-   **setCfg**: Called when the iFrameWnd is ready.
-   **getCfg**: Returns the iFrameWnd config about field and view IDs.
-   **showIFrame**: To show or hide the iFrameWnd.
-   **getiFrameWnd**: Returns the iFrameWnd object. Mainly used by sendAppMsg but also available to your app for any use.

## Debug Window

### Usage

Provides a window to see local logs on mobile devices where we don't have the luxury of a console log output. Useful for simple tracing/debugging without the complexity of USB tethering and the learning curve that comes with all the tools. Works on all device types (not just mobile), and the window can be moved around. The logs are stored in a ring buffer of 100 elements.

### Functions

-   **lsLog**: Adds a log to localStorage, with timestamp to millisecond resolution. These logs can be shown in the debugWnd when visible, and optionally, in the console.log if you have one.
-   **showDebugWnd**: Show or hide the debugWnd.

## Logging

### Usage

Provides comprehensive logging functionalities for just about anything you want to monitor, such as user activity, navigation, system status, errors, or simply traces for development and debugging. All logs are connected to a given account.

To use this feature, you must set the iFrameWnd and all desired logging flags to true in the ktl.core.setCfg function, then follow the [Account Logs setup procedure](#account-logging).

All logs are aways saved in localStorage, with their timestamp. This is to prevent losing any of them in case of power outage or browser crash.

Then, at certain intervals, the logs are inserted to the Account Logs object with an API call, and upon confirmation, they are erased from localStorage.

To minimize record consumption and API calls usage, navigation logs are agglomerated over an hour and sent only once as a single stringified object. A custom viewer then disassembles them for display in chronological order.

The logging categories are User Login, Navigation, Activity (count of keypresses and mouse clicks), Critical Events, App Errors, Server Errors, Warnings, Info and Debug.

### Functions

-   **setCfg**: Allows setting a callback logCategoryAllowed() that returns whether or not a category should be logged, based on specific conditions.
-   **clog**: Provides an enhanced version of console.log(), with custom color and bold font text.
-   **objSnapshot**: Converts an object to a string and back to an object. This is used to *freeze* the content of an object in time.
-   **addLog**: Adds a log to the localStorage for deferred processing. All log categories are not created equal. Here's how each work:
    -   Critical: Sent to Knack within 1 minute. An email is also sent to the Sysop.
    -   Login, Info, Debug, Warning, App Error, Server Error: Sent to Knack within 1 minute.
    -   Activity, Navigation: Data is accumulated in an object in localStorage, then sent as a single bundle to Knack every hour to reduce record usage and API calls.
-   **getLogArrayAge**: Used internally by iFrameWnd and returns the oldest log's date/time from array within a resolution of 1 minute.
-   **monitorActivity**: Entry point that starts the user activity logging. Every 5 seconds, the mouse clicks and key presses counters are updated in localStorage, and counters from all opened pages and tabs are merged (added) together.
-   **resetActivityCtr**: Resets mouse and keyboard activity counters.
-   **updateActivity**: Updates the keyboard and mouse activity counters in localStorage. Mainly used by KTL internally, but available to your app, for specific use.

## Windows Messaging

Provides a framework to exchange data between windows. It uses a queue and supports automatic retries and error handling. The windows can be app window, the iFrameWnd, or any other window that the app creates and needs to communicate with. For example, this is how your app can implement a heartbeat message that notifies Knack about your account (or device) being online and running properly.

### Functions

-   **setCfg:** Used to set callbacks to your app.
    -   **processFailedMessages** to handle messages that were never acknowledged.
    -   **processAppMsg** to implement your own messages.
    -   **processServerErrors** to implement your own processing of server errors.
    -   **sendAppMsg**: Experimental feature still under development. Will be used to exchange messages across different Knack apps.
-   **send**: To send a msg to a specific window. May contain a payload or not.
-   **removeAllMsgOfType**: Cleans up the msg queue of all those of a specific type.

## System Info

Retrieves information about the operating system, browser, device model, processor, whether or not we are on a mobile device, and public IP address.

This is also where the SW Update broadcast takes place.

### Functions

-   **getSysInfo**: Returns an object with the above-mentioned properties.
-   **findAllKeywords**: Scans through all views and fields and creates a catalog of keywords used with info about Scene ID, View ID and Title. This can be invoked from the browser’s console with this command: **ktlkw()**

## System Colors

Retrieves information about Knack's colors and generates a few variations for KTL features.

### Functions

-   **setCfg**: To define your own parameters for highlighting…
    -   **inlineEditBkgColor**: the color of inline-editable cells
    -   **inlineEditFontWeight**: the font weight of inline-editable cells
    -   **tableRowHoverBkgColor**: the table’s row hover color if you want to override Knack’s default
-   **getSystemColors**: Get the sysColors object.
-   **rgbToHsl**, **hslToRgb**, **rgbToHsv**, **hsvToRgb**, **hexToRgb**: Various color conversion utilities.

# Customizing Features

You can customize how the KTL operates by modifying the **KTL_KnackApp.js** file. This is done by setting various flags and variables, but also by adding your own processing code in the callbacks.

## Callbacks

The callbacks play a major role, and can be seen as a “bridge” between the KTL and your App. In some cases, it passes control to execute app-specific code that drives its behavior at run-time, but also to get/set configuration parameters.

## Disabling a Feature

You can turn off a feature by setting its flag to false by using one of these two method – **but not both**:

1.  **Simple method**: Copy the content of the [KTL_Features.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Features.js) in the Javascript pane after the KTL_Loader.js code. This will **disable all features**. To enable a feature, either remove the line or set its flag to true. Keep the colons and commas in place, as they are required.
2.  **Advanced method**: Copy the content of the [KTL_KnackApp.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp.js) file in the Javascript pane and edit the function **ktl.core.setCfg**, in the **//KTL Setup** section, under the **enabled** section.

For example, you don’t want to see the version info bar at top-right of the page, set this to false: **showAppInfo: false**

The advanced method involves more lines of code but offers extra flexibility to the developers who want to experiment with the callbacks and specific configurations.

## Editing the KTL_KnackApp file

1.  Open the **KTL_KnackApp.js** file in your favorite editor.
2.  Locate the **//App constants** section and add any const (scenes, views, field IDs) that KTL may need. If not sure, just ignore for now.
3.  Locate the **//KTL Setup** section and go through all the flags and settings to match your needs.
4.  Locate the **//KTL callbacks to your App** section and go through each function, adapting them to match your needs.
5.  Locate the **//Setup default preferences** section and go through all the flags and settings to match your needs.
6.  Copy/paste the content of the file in the Javascript pane, after the 5 lines of the KTL_Loader.js at top. Save.
7.  If you are in Dev mode, the previous step is not required since the local file server will use the code from your workstation.
8.  Open a browser to your Knack app.
9.  Check console logs to see if all is looking good.

\*Note: If you are using the Prod mode, you should never edit the generated Prod file directly. Always edit the KTL_KnackApp.js file and copy/paste the code in the Javascript pane.

## Keeping your KTL_KnackApp file in Sync

The **KTL_KnackApp.js** file is subject to frequent changes over time, mainly due to added functionalities. Since this file lives in two different places – your copy and the official KTL copy, you will need to check what has changed since your last update (GitHub pull or clone) and import those changes in your copy. Omitting to do so will not have any negative impact other than not fully benefiting from the latest updates.

# Advanced Features

These features are considered "advanced" in the sense that they require additional setup. Some of them provide communication methods between various parts of your app, thus leveraging quite powerful administration features.

Namely:

1.  iFrameWnd
2.  Heartbeat Monitoring
3.  User Preferences
4.  Account Logging
5.  Remote SW Updates (the page and view setup will come soon)
6.  User and Public Filters automatic Upload and Download

## Setup

In this section, when you see a name for an object, a field or a view title, it must be written **exactly** as shown, case sensitive, spaces, everything. It is recommended to copy/paste to avoid any typos.

### Invisible Menu

This shall be your default place for any future utility hidden pages. For now, the iFrameWnd page will be its first resident.

1.  Add a new **Dropdown Menu** named **Invisible Menu**.
2.  Do not any page yet, click Continue at bottom.
3.  In settings, uncheck Include this page in the Page Menu.

### iFrameWnd

To use this feature, you must set the iFrameWnd flag to true in the ktl.core.setCfg function.

Create a new Login Page and give permission to all users. Set Page Name to: **iFrameWnd**. Its URL should automatically be set to **iframewnd**. This page will be the placeholder for the next features. For now, leave it blank as we need to create a few objects first. Now, go back to the Invisible Menu and assign the iFrameWnd to it.

#### User Preferences

If you want to add User Preferences to your app, there are some already built-in, and you can also add your own. Follow this procedure:

1.  Create a Role called **Developer** and assign it to yourself.
2.  In the Accounts object, add a Paragraph Text field named **User Prefs**.
3.  In the iFrameWnd page, add a view: Type: Details, For: Logged-in Account. Once the view is added, remove all fields, then add User Prefs. Set the view title to **Current User Prefs \_ar=10**.
4.  Add a Form view that updates the currently logged-in account. Once the view is added, remove all fields, then add User Prefs. Set the view title to **Update User Prefs**. Enable the form's auto-reload in the Submit rule.
5.  Align both views on the same row to save space.
6.  Go to User Pages (at the bottom of the Pages view) and edit the Account Settings page.
7.  Add a menu named **My Settings** and move it to the top of the page.
8.  Add a link to a new page named **My Preferences** and enter to edit that page.
9.  Add a Form view that updates the currently logged-in account. Once the view is added, remove all fields, then add User Prefs. Set the view title to **My Preferences**.
10. Refresh your app and click on the - Account Settings link, then on My Preferences button in top menu.
11. You will see 4 new checkboxes (dynamically generated by code): Show View ID, Show iFrameWnd, Show DebugWnd and Show Extra Debug.
12. Check all 4, submit and view the result: view IDs will be shown in red next to each view, the iFrameWnd will appear at the bottom of the app, the DebugWnd will show up, and some new logs about WndMsg processing (REQ, ACK, etc.) will be shown in the console output.
13. Uncheck all those you don’t want and submit. It is recommended to leave Show iFrameWnd on if you’re planning to set up the User Preferences that follow.

#### Heartbeat Monitoring and SW Update

If you want to add Heartbeat Monitoring to your app to assess an account's presence and generate alerts, or perform remote SW updates, follow this procedure:

1.  Add the [User Preferences](#user-preferences-1) feature from the above procedure.
2.  In the Accounts object, add these fields:
    1.  **SW Version**: Type: Short text.
    2.  **UTC HB**: Type: Date/Time, Date Format: mm/dd/yyyy, Default Date: none, Time Format: military, Default Time: none.
    3.  **Time Zone**: Type: Number, no decimals.
    4.  **LOC HB**: Type: Equation, Equation Type: Date, Date Type: hours, Result Type: Date, Equation Editor: {UTC HB}+{Time Zone}, Date Format: mm/dd/yyyy, Time Format: military.
    5.  **Online**: Type: Yes/No, Default No, Input: Checkbox.
    6.  **UTC Last Activity**: Type: Date/Time, Date Format: mm/dd/yyyy, Time Format: military.
3.  Create a **new object** called **App Settings** with these fields:
    1.  Rename the default first field from App Settings Name to **Item**: Type: Short Text, set as object’s Display Field and Sort in Alphabetic order.
    2.  **Value**: Type: Paragraph Text.
    3.  **Date/Time**: Type: Date/Time, Date Format: mm/dd/yyyy, Time Format: military.
4.  In the iFrameWnd page created above, add a Form view that updates the currently logged-in account. Once the view is added, remove all fields, then add on a first line: SW Version, UTC HB and LOC HB. Set LOC HB as read-only. Then on a second line: Online, UTC Last Activity and Time Zone. Set the view title to **Heartbeat**. In the form’s Submit rules, enable auto-reload and set the Confirmation message to “Heartbeat sent successfully.”.
5.  Still in the iFrameWnd, add a table view that displays **App Settings**, with title: **App Settings \_ar=20**. Source filter: **Item Starting with APP**, sorted alphabetically A to Z. No Search, inline editing = On, 10 records at a time, no filtering allowed. Add all fields. Set Value’s Truncate Text to 75 characters.
6.  Be sure you have the Show iFrameWnd checkbox on in [User Prefs](#user-preferences-1) above.
7.  Refresh the app and you should see in the iFrameWnd the heartbeat being submitted every minute and the Online being set to Yes.
8.  **VIEWER**: To view the heartbeats, online status, latest activity, SW Version, etc., create a Sysop Dashboard page accessible to Developer role only, with a table view that shows the Accounts having an Active status. Title: **Account Status \_ar=60**. Fields: Name, Online, LOC HB, UTC HB, UTC Last Activity, SW Version and User Prefs. This view will refresh itself every minute, so you can assess the presence, latest activity and SW Version for each account.
9.  **Note**: The Online status flag is set, but not reset automatically. You’ll need to create a daily task to reset it. We also have some existing code that does it with API calls and will add it to the KTL soon. We will also provide all code for Online updates, emails and audio alerts, custom status colorizing, etc.
10. **For SW Updates**: In the Status Monitoring page, add a table view for App Settings object. Title: **SW Update**. Filter Source on Item contains APP_KTL_VERSIONS. Settings: no search, Inline Edit = On, 10 records, no filtering. Leave three fields: Item, Value and Date/Time.
11. Add an action column: Header: Broadcast SW Update, Link Text: BROADCAST NOW. Action is Update this record, Item to a field value Item. Confirmation msg: SW Update in progress.... You can set the text style in bold red with the display rule: when Item is not blank.

#### User Filters

In addition to being able to create named buttons for the User Filters that are saved in localStorage, it is possible with a bit of setup to upload your settings to Knack and download them back wherever and whenever needed. This two-way process is automatically done in the background, and can be seen as a backup method, but also to migrate them to other devices (or browsers, see note below). Note that if you migrate filters from one app to another, typically a temporary development copy, some filters may not work due to the record IDs that have changed for connected fields. This is a normal behavior, and the only way to fix this is to redo their settings and save back to the same button name.

To support automatic Upload and Download, follow this procedure:

1.  Create an object named **User Filters** and add these fields:
    1.  **Account**: Type: Connection to Accounts, all settings at default.
    2.  **Date/Time**: Type: Date/Time, Date Format: mm/dd/yyyy, Default Date: Current Date, Time Format: military, Default Time: Current Time.
    3.  **Filters Code**: Type: Paragraph Text.
    4.  Object Settings : Display Field: Account, Sort Order: Account, a to z.
    5.  Delete the first default field created: User Filters Name.
2.  Go to the **iFrameWnd** page and add a new Table that displays **User Filters** connected to the logged-in account. Call it **User Filters**, remove the Account column and leave only the Date/Time and Filters Code. Set Filters Code’s Truncate Text to 75 characters.
3.  Source: Limit number of records to 1.
4.  Settings: no search, Inline Editing = On, 10 records at a time, no filtering. Title: **User Filters \_ar=30** (you can change the 30 for 10 seconds temporarily for quicker testing, then put back to 30)

**To assess this feature:**

Open two different browsers (ex: Chrome and Edge) and log-in with your own account in both. Open them to the same page, where there’s a table with filtering enabled. Create a couple of filters in the first browser, wait about 30 seconds and you will see those filters appear in the second browser. Same applies for Public Filters: set a filter to Public, make changes to it, and all will be reflected in the other browser, but also for all users of that view.

\*Note about browsers: the localStorage is not shared across different browsers (and also within the same browser but in private/incognito mode). This is when the automatic Upload/Download feature then comes in handy, by allowing this transfer to occur in real-time, within about 30 seconds.

#### Account Logging

If you want to add Account Logging to your app, follow this procedure:

1.  Create an object named Account Logs and add these fields:
    1.  **Log Nb**: Type: Auto-Increment.
    2.  **Account**: Type: Connection to Accounts, all settings at default.
    3.  **Date/Time**: Type: Date/Time, Date Format: mm/dd/yyyy, Default Date: Current Date, Time Format: military, Default Time: Current Time.
    4.  **Log Type**: Type: Short Text.
    5.  **Details**: Type: Paragraph Text.
    6.  **Log Id**: Type: Short Text. See note below for details.
    7.  **Email To**: Type: Email.
    8.  In the Object Settings: Display Field: Account, Sort Order: Log Nb, low to high.
2.  In the iFrameWnd, add a view: Type: Table, For: Account Logs, connected to the logged-in Account.
    1.  Once the view is added, remove all fields, then add Date/Time, Log Type, Details, Log ID, Email To and an Custom Email action with these settings, as from the screen capture [**KTL Account Logs Email Settings.jpg**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/Docs/KTL%20Account%20Logs%20Email%20Settings.jpg).
    2.  The blank value to Email To in Action \#2 is intended. This field also acts as a flag and resetting it to blank prevents sending the email more than once.
    3.  The Outcome phrase “Account Logs - Email sent successfully” is used in the code to confirm completion, so it must be exactly the same.
    4.  Set the view title to **Account Logs \_ar=30**, disable search, enable Inline editing, 10 records at a time, no filter.
    5.  Sort by Log Nb: high to low, limit to 5 records.

\*Note about the **Log Id** field: This is a unique ID that is a UTC millisecond timestamp. It is generated by the code at the moment the log is sent via the API call. Its purpose is to validate that the log has been sent and received properly. With that confirmation, the log can safely be deleted from localStorage.

# Advanced Keywords Setup

Some keywords require additional setup, and this section provides the step-by-step procedure that applies to each.

## Unique Value Check \_uvc

1.  In the field of interest, add the \_uvc keyword in its description.
2.  Create an **Add form** containing the \_uvc field, and add in the title or description: **\_uvc=fieldName1, fieldName2, fieldName3**
3.  In this example, the field is a Formula Text that concatenates three fields together. The number of fields is not important, but all must match, i.e. both what is displayed and the real field name in the schema.
4.  Those fields must all be in that same form.
5.  Add a **Search view** that has the same source and the \_uvc field as the search input.
6.  The search input must have “Users can choose from different filter options” unchecked and Exact Match selected.
7.  Result in a grid, one column with \_uvc field.
8.  Add \_uvc and \_hv to the view title or description.
9.  Adding duplicate values should prevent submitting and show an error message.

## Unique Values Exceptions \_uvx

1.  In the field of interest, add the \_uvx keyword in its description with this format:

**\_uvx=excText1, excText2**

In this example, there will be two expressions that will be accepted as duplicates for that field.

1.  Add a **Search view** that has the same source and the \_uvx field as the search input.
2.  The search input must have “Users can choose from different filter options” unchecked and Exact Match selected.
3.  Result in a grid, one column with \_uvx field.
4.  Add \_uvx and \_hv to the view title or description.
5.  Adding duplicate values should prevent submitting and show an error message, unless they are among the exceptions allowed.

**Additional notes about \_uvc and \_uvx:**

The \_uvx feature can combine more than one field in the same Add form, as long as all fields are also included in the Search view.

Furthermore, the \_uvc and \_uvx are inter-compatible, i.e. they can be used together in the same Search view. In that case both the \_uvc and \_uvx keywords must be included in its title or description.

# Advanced KTL Development Modes

There are three development modes of operation:

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
2.  If you want to customize the KTL’s behavior or disable some features, edit a copy of the [KTL_KnackApp.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp.js) file and paste that code in the Javascript pane, after the Loader. [See Editing the KTL_KnackApp file](#editing-the-ktl_knackapp-file).

\*Note about **KTL_KnackApp.js**: throughout the document, we will refer to this file name as the “app code”, but you can substitute it to anything that would better match your app’s name. As long as you modify the merge utility files accordingly, if you are planning to use it. See the **-filename** parameter in the batch file.

### Setup

You will need to modify the KTL_KnackApp.js file to match your needs if you want to go beyond the basic default setup. [See Editing the KTL_KnackApp file](#editing-the-ktl_knackapp-file).

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

1.  Edit the file [KTL_KnackApp.js using this procedure](#editing-the-ktl_knackapp-file).
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

.code\\Lib\\KTL\\KTL_KnackApp.js

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

# Additional utilities

### Merging a list of .js files together

There are two utilities provided for merging .js files together: [**MergeFiles.bat**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/MergeFiles.bat) that calls [**NodeJS_MergeFiles.js**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/NodeJS/NodeJS_MergeFiles.js).

First, you’ll need to install **Node.js** (<https://nodejs.org>) on your workstation. Just the basic installation, no optional component is needed.

Then, the custom Prod file can be generated using the NodeJS_MergeFiles.js merge utility provided in the NodeJS folder.

This script can be invoked manually in a command prompt or shell, but it is easier to run the MergeFiles.bat provided. The extension .bat is only for Windows, but it can be rewritten a .sh (shell script) for Linux and MacOS. See the .bat file for more details about the script parameters.

These files will be merged together:

1.  [KTL_Loader.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Loader.js)
2.  [KTL_KnackApp.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp.js)

The output file is KTL_KnackApp_Prod.js

# Future Improvements

-   Use JSDoc to have an adequate auto-generated and detailed API documentation, for each function with parameter description, etc.
-   Geofencing and other map-based features, with geo-based events and Google Maps integration.
-   The sky's the limit! Let us see what we can come up with…

# Conclusion

That's about it for now, thanks for reading this and testing the library. Hope you’ll enjoy it as much as we did creating it. Now, let’s see how many of you will **collaborate on this project**. Cortex R&D needs you!!!

# List of all Keywords

| **Keyword**                        | **Description**                                       | **Where to use it**                                      | **Example**                                |
|------------------------------------|-------------------------------------------------------|----------------------------------------------------------|--------------------------------------------|
| \_ar=n                             | Auto-Refresh a view every *n* seconds                 | View Title or Description                                | \_ar=60                                    |
| \_hv                               | Hidden View                                           | ‘’                                                       |                                            |
| \_ht                               | Hidden Title                                          | ‘’                                                       |                                            |
| \_hf=fld1, fld2…                   | Hidden Fields                                         | “                                                        | \_hf=Work Shift                            |
| \_ni=colHeader1, colHeader2…       | No Inline editing                                     | ‘’                                                       | \_ni=Email,Phone                           |
| \_ts                               | Adds a Time Stamp to a view                           | ‘’                                                       |                                            |
| \_dtp                              | Adds Date/Time Pickers                                | ‘’                                                       |                                            |
| \_rvs=vTitle1, vTitle2…            | Refresh Views after Submit                            | ‘’                                                       | \_rvs=Monthly Sales, Clients               |
| \_rvr=vTitle1, vTitle2…            | Refresh Views after Refresh                           | ‘’                                                       | \_rvr=Monthly Sales, Clients               |
| \_rvd=vConfTitle,vTitle1, vTitle2… | Refresh Views after calendar event Drag’n Drop        | ‘’                                                       | \_rvd=Confirmation, Monthly Sales, Clients |
| \_lf= vTitle1,vTitle2…             | Linked Filters                                        | ‘’                                                       | \_lf=Monthly Sales, Clients                |
| \_qt=colorTrue,colorFalse          | Quick Toggle of Boolean fields                        | ‘’                                                       | \_qt=\#0F07,pink                           |
| \_mc=colHeader                     | Match Color for whole row to a given column           | ‘’                                                       | \_mc=Sales                                 |
| \_hc= colHeader1, colHeader2…      | Hide Columns, but keep in DOM                         | ‘’                                                       |                                            |
| \_rc= colHeader1, colHeader2…      | Removed Columns, including DOM                        | ‘’                                                       |                                            |
| \_nf=field_1,field_2…              | No Filtering on specified fields                      | ‘’                                                       | \_nf=field_1,field_2                       |
|                                    |                                                       | ‘’                                                       |                                            |
| \_al                               | Auto-Login                                            | View Title or Description of a login page                |                                            |
|                                    |                                                       | ‘’                                                       |                                            |
| \_oln=url                          | Open Link in a New page (tab)                         | Rich Text view with link                                 | Support \_oln=https://ctrnd.com            |
| \_ols=url                          | Open Link in Same page                                | Rich Text view with link                                 | Support \_ols=https://ctrnd.com            |
|                                    |                                                       | ‘’                                                       |                                            |
| \_uc                               | Convert to Uppercase                                  | Field Description                                        |                                            |
| \_num                              | Numeric                                               | ‘’                                                       |                                            |
| \_int                              | Integer                                               | ‘’                                                       |                                            |
| \_ip                               | Validate IP format (to do)                            | ‘’                                                       |                                            |
| \_lud                              | Last Updated Date. For Inline edits, used with \_lub. | ‘’                                                       |                                            |
| \_lub                              | Last Updated By. For Inline edits, used with \_lud.   | ‘’                                                       |                                            |
| \_uvc                              | Unique Value Check                                    | See Advanced Keywords Setup                              |                                            |
| \_uvx                              | Unique Values Exceptions                              | ‘’                                                       |                                            |
|                                    |                                                       | ‘’                                                       |                                            |
| \_km                               | Kiosk Mode                                            | View Title or Description. Effective in Kiosk mode only. |                                            |
| \_kr                               | Kiosk add Refresh button                              | ‘’                                                       |                                            |
| \_kb                               | Kiosk add Back button                                 | ‘’                                                       |                                            |
| \_kd                               | Kiosk add Done button                                 | ‘’                                                       |                                            |
|                                    |                                                       |                                                          |                                            |

## 

## All code and documentation written by:

Normand Defayette

[nd@ctrnd.com](mailto:nd@ctrnd.com)

Cortex R&D Inc.

Blainville, Québec, Canada

![A picture containing text, clipart Description automatically generated](./Docs/media/f885aa5ef3409ff28bd30849d54ad54c.jpeg)
