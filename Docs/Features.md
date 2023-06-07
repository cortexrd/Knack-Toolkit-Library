# KTL Features Overview

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

# Features Details and Function

In this section, we will go through each feature category and see what they can do, with the list of all available functions to you as a developer, if ever you’re interested creating your own advanced features.

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

**\_cfv=[params1], [params2]**: Colorize Field by Value. Can be used with grids and lists. Used to change the color of the text and background of a cell, based on its value. It is also possible to set the following styles: font weight (bold, extrabold , 700), underline and italic. It is also possible to set the style to propagate across the whole row. The colors support named values (ex: red, purple) or hex values with optional transparency (ex: \#ff08, or \#ffff0080 for 50% transparent yellow).

The parameters syntax is as follows:

**\_cfv= [operator, value, textColor, backgroundColor, fontWeight, options]**

operator (required):

-   eq (equals)
-   neq (not equals)
-   gt (greater than)
-   gte (greater than or equal to)
-   lt (less than)
-   lte (less than or equal to)
-   sw (starts with)
-   ew (ends with)

value (required): Any textual or numeric value. For “empty” string, leave two consecutive commas.

textColor (required): any standard “named colors” or hex values starting with \# and has 3, 4, 6, or 8 digits is supported.

backgroundColor (optional): Same as above. Will colorize the cell or only the text if the “t” option is included.

fontWeight (optional): Any named value like “bold”, or “lighter”, or a numeric values like 700. Omit or leave empty for default.

options (optional): Possible values are

u - underline

i - italic

t - text only

p - propagate style to whole row

Example: \_cfv=[ne,,,red,,iu], [gte,100, yellow,\#00F9]

The first group between square brackets will set the background in red when the value is not blank and set the text style to default weight, italics and underlined. The second one will set the text color to yellow and the background in blue at 56.3 % transparency, when the value is greater than or equal to 100.

Additional notes:

-   The square brackets are optional if you have only one group of parameters
-   Be careful to avoid conflicting conditions, since they will give unpredictable results.
-   The group of parameters are applied from left to right, so that if you have overlapping conditions, the last one will have precedence.
-   Transparency is useful to combine the visual effects of various colors
-   This keyword must be used in the field’s description. It will take effect in all grids and lists where used.
-   This keyword can also be used in the view title or description.
-   Using both in the view and in the field is supported but need extra care to avoid conflicting conditions. When using both, the field keyword has precedence over the view’s.

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

**\_ar=n**: Auto Refresh view. The view will be refreshed periodically every “*n*” seconds. If no or invalid parameter is given, the default is 60 seconds. It is possible to manually start/stop the process using the autoRefresh function.

**\_hv**: Hidden View. Moves the view away from screen but kept in DOM. Used to save real-estate, while maintaining API calls and automated search capabilities.

**\_ht**: Hidden view Title. Used to save real-estate while keeping the title in the Builder.

**\_hc=colHeader1, colHeader2**: Hidden Columns. To hide a grid’s columns, based on the header’s exact text. The columns are only hidden but still exist in DOM. The visibility can be reversed on the fly with a bit of extra code. Hiding a column is useful to save real-estate or hide its data, while maintaining API calls capability or allow filtering on all fields.

**\_hf=fieldName1, fieldName2**: Hidden Fields. To hide fields in a view, based on their exact names. Typically used with utility fields that don’t need to be visible.

**\_rc=colHeader1, colHeader2**: Removed Columns. To delete de columns based on the header’s exact text. This will delete them from the table **and** the DOM. Like \_hc, removing a column will maintain API calls capability and allow filtering on its field.

This option is “somewhat” a bit more secure than \_hc since it’s not as easy to peek at data from the browser’s console. Though someone could intercept the data *before* it’s been removed, i.e. while it’s being sent by the server, so keep this in mind.

**\_nf=field_x, field_y, field_z**: No Filtering. Will prevent filtering on these fields, even if they are visible in the table.

**\_ni=colHeader1, colHeader2**: No Inline editing on columns with specified headers. If no parameter is supplied, it will apply to the whole table. Disables inline editing for the user, even if enabled in the Builder. Enabling inline editing is required for API calls in tables, but not always desirable at the user interface. This provides a solution.

Notes:

-   It is possible to allow inline editing for a specific field by adding an exclamation mark as the first character. Ex: **\_ni=!Phone Number, !Address** will disable inline editing for the whole grid, except for the columns with headers Phone Number and Address.
-   About \_ni security: use this keyword with caution as it only disables the user interface. Someone with coding skills and bad intentions could still modify the data using commands in the console.

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

**\_cfv=[params1], [params2]**: Colorize Field by Value. See \_cfv in fields description for all details.

**\_km:** Triggers the Kiosk mode for that page. This only applies for any role other than Developer. For the accounts having the Developer role, it is possible to switch back and forth between the Normal and Kiosk modes by clicking on the version info bar, provided that it is accessible.

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
-   **addVersionInfo**: Adds the app and optionally the KTL version numbers on the page. It is possible to make the version info bar invisible or to move it to the bottom of the page if desired. If made invisible by setting its opacity to 0, it will become visible upon mouse hovering. See the usage and examples in the onSceneRender function in the KTL_KnackApp.js file. The version info bar is used to trigger a popup with useful Developer on-the-fly features. This popup can also be used by other roles, by entering the PIN setup by devOptionsPin.
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