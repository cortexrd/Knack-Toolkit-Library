-   [Introduction](#introduction)
-   [Overview](#overview)
    -   [Zero config needed for Basic
        Features](#zero-config-needed-for-basic-features)
-   [No time to read all this now - How about a quick
    tryout?](#no-time-to-read-all-this-now---how-about-a-quick-tryout)
-   [Features](#features)
    -   [Bootloader](#bootloader)
    -   [Core](#core)
    -   [Storage](#storage)
    -   [Fields](#fields)
    -   [Views](#views)
    -   [Scenes](#scenes)
    -   [Form Persistence](#form-persistence)
    -   [User Filters](#user-filters)
    -   [Bulk Operations](#bulk-operations)
    -   [Account](#account)
    -   [User Preferences](#user-preferences)
    -   [iFrame Window](#iframe-window)
    -   [Debug Window](#debug-window)
    -   [Logging](#logging)
    -   [Windows Messaging](#windows-messaging)
    -   [System Info](#system-info)
    -   [System Colors](#system-colors)
-   [How to use KTL](#how-to-use-ktl)
    -   [Folder Structure](#folder-structure)
    -   [KTL Modes](#ktl-modes)
    -   [ACB Mode -- "All Code in
        Builder"](#acb-mode-all-code-in-builder)
    -   [CLS Mode -- "Code on Local
        Server"](#cls-mode-code-on-local-server)
    -   [Hybrid Mode - For Production and Development at same
        time!](#hybrid-mode---for-production-and-development-at-same-time)
    -   [Switching Modes](#switching-modes)
-   [Editing KTL_KnackApp.js](#editing-ktl_knackapp.js)
-   [Advanced Features](#advanced-features)
    -   [Setup](#setup-2)
-   [Future Improvements](#future-improvements)
-   [Conlusion](#conlusion)

# Introduction

**Knack Toolkit Library**

v0.6.22 - pre-release

Knack Toolkit Library, henceforth referred to as **KTL**, is a
collection of open-source Javascript utilities that eases Knack
application development and add several features that are not easily
created from the ground up. Those features that involve using the Knack
API are 100% view-based, so your API key is never exposed.

# Overview

## Zero config needed for Basic Features

Right out of the box, without any coding or complex setup, the KTL will
provide many nice additions to your app:

-   user filters to save your filters to named buttons

-   form data persistence that saves as you type, and will load back
    your data if a page is reloaded after a submit failure or power
    outage

-   sorted menus

-   lightly colorized inline-editable fields for easy identification

-   special keywords in the view's title to trigger

    -   auto-refresh of tables, details view or other views

    -   hidden views

    -   hidden titles

    -   disable inline editing

-   special keywords in the view's description to trigger

    -   filter restriction for specified fields

-   special keywords in the table's column headers to trigger

    -   hidden or deleted columns

-   special keywords in menus to trigger

    -   link to any URL, even external ones

-   Ctrl+Click on a table header to invert the default sort

-   idle timeout watchdog

-   spinner timeout watchdog

-   numeric pre-validation

-   force uppercase on desired fields

-   auto-focus on first field of a form or search field in a table

-   dropdown selector improvements

-   kiosk mode

-   debug window for embedded devices

Click the following link if you're interested to know more about
[Advanced Features](#advanced-features).

# No time to read all this now - How about a quick tryout?

If you want to try/use the basic, default setup version of the KTL, all
you need to do is copy the content of those two files:
[**KTL_KnackApp_ACB.js**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp_ACB.js)
and
[**KTL_Knack_ACB.css**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp_ACB.css)
to their respective panes in your Builder. If you already have your own
code, it will not conflict with the KTL. Just move it between these
lines at the end:

//My App code - BEGIN

// \.....your code here\....

//My App code -- END

For your CSS code vs KTL's, the placement does not matter. But it is
recommended to keep each of them grouped together, with clearly
identified delimiters.

If you don't like a feature, don't worry. It's possible to turn it off
by setting its flag to false in the function **ktl.core.setCfg**, in the
**//KTL Setup** section of the **KTL_KnackApp.js** file.

# Features

The code is organized by specific feature categories, and here\'s the
complete list:

-   Bootloader

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

In the next section, we'll go through each one and see what they can do,
with the list of all available functions to you as a developer, if ever
you're interested in trying out the more advanced features.

## Bootloader

### Usage

The bootloader is the entry point of all code, including the KTL and
your app-specific code. It is very technical, and the average user will
not really need to understand it. Basically, it does two things:

### External library loading

First, I wish to say a big *\"thank you\"* to
[**Soluntech**](https://www.soluntech.com/) for their gracious
permission to use a portion of their code to manage the dynamic library
loading. This is the cornerstone that allowed kickstarting the KTL
project. In short, it uses a list of libraries your app will need, and
automatically loads them with the LazyLoad function. Again, you won\'t
need to understand how it works since the setup is already done.

### Developing your code locally -- aka [CLS mode](#how-to-use-ktl)

Traditionally, i.e. without the Bootloader, all your app code resides in
the Builder\'s Javascript and CSS panes. But if you leverage the
Bootloader, you'll be able to load your Javascript and CSS code from
your hard drive instead, at run-time. This means you can now code and
save directly on your workstation, without having to copy/paste the code
to the Builder every time you want to test a change.

This mode enables you (the developer) to work more efficiently by using
your favorite code editor with all its bells and whistles, instead of
the basic Builder\'s Javascript pane editor. You must install
**Node.js** (<https://nodejs.org>) on your computer and run the
**NodeJS_FileServer.js** script provided. Then, each time you save your
code, all you have to do is refresh the browser to see the changes take
effect immediately. In this mode, writing and testing code simply won't
ever get any faster.

Another great advantage is that it opens the possibility of teamwork.
Currently, only one developer at a time can edit the code. With the
bootloader and Node.js file server, there is no conflict because each
developer works with his own \"sandboxed\" local copy and pulls external
changes whenever he/she chooses to do so.

**Furthermore and most importantly**, you can simultaneously work on a
production app, running officially released and tested code, while you
run development code locally -- yes, two different code revisions at the
same time, without conflicting! This means that the classic method of
going in Knack's Builder to create a sandbox copy of your app to develop
and experiment with new code is not required anymore - or a lot less
often. When your app becomes huge, creating a copy can take a whole day
sometimes.

### Functions

-   Bootloader has no exposed functions.

## Core

### Usage

This contains generic utility functions, used by most other features
internally, but also available to your app.

### Functions

-   **setCfg**: This is where you can enable the features you want.

-   **getCfg**: To get the config and read the flags.

-   **knAPI**: Knack API wrapper with retries and error management.

-   **isKiosk**: For support of kiosk mode applications. You decide the
    trigger conditions for kiosk mode in a callback function.

-   **hideSelector**: To move away elements off the screen to hide them
    or save real-estate.

-   **waitSelector**: When you need to wait until an element exists or
    is visible.

-   **waitAndReload**: Waits for a specific delay, then reloads page.

-   **switchVersion**: To toggle between production and development
    versions.

-   **enableDragElement**: To add basic drag and drop to an element.

-   **splitUrl**: Creates an array containing the path and parameters of
    the URL.

-   **getMenuInfo**: Retrieves the menu and sub-menu items.

-   **isHex**: For hexadecimal format validation.

-   **isIPFormat**: For IP format validation.

-   **getSubstringPosition**: Returns the index of the Nth occurrence of
    a string within a string.

-   **addZero**: Adds leading zeros to 2 or 3-digit numbers, typically
    for logs alignment.

-   **getCurrentDateTime**: Generates a local or UTC date/time string.

-   **dateInPast**: Compares the first date to the second one and
    returns true if it\'s in the past, ignoring the time component. If a
    second date is not provided, it uses today.

-   **isMoreRecent**: Compares two dates and returns true is first
    parameter is more recent than second one. Resolution is one minute.

-   **selectElementContents**: Selects all element\'s text.

-   **timedPopup**: Generates a brief, auto-delete popup with status
    text and color.

-   **removeTimedPopup**: To remove the timedPopup.

-   **infoPopup**: Similar to timedPopup, but without an expiration
    delay. Removal must be done manually. Useful for progress
    indicators.

-   **setInfoPopupText**: To indicate general information, status, or
    progress in infoPopup.

-   **removeInfoPopup**: To remove infoPopup.

-   **insertAfter**: To insert a node after an existing one, but as
    sibling, not as a child.

-   **setContextMenuPostion**: Upon right-click, ensures that a context
    menu follows the mouse, but without overflowing outside of window.

-   **getObjectIdByName**: Pass the object's name and returns the
    object's ID.

-   **getFieldIdByName**: Pass the field name and object ID and will
    return the field's ID.

-   **getViewIdByTitle:** Pass the view title (and Page URL optionally)
    and returns the first view ID containing specific text in its title,
    with optional exact match.

-   **sortMenu**: Will sort the sub-menus in alphabetical order.

-   **sortUList**: Will sort any un-ordered list in alphabetical order.

-   **convertDateTimeToString**: Will convert a Date object to a string,
    ISO or US format, and date only option.

-   **convertDateToIso**: Converts a date string from US to ISO format.
    US is for various Knack functions like API calls and filtering,
    whereas ISO is for HTML objects like calendar input types.

-   **getLastDayOfMonth**: Pass a date string and it will return the
    last day of that month, as a string, is ISO or US format.

### A note about knAPI

While Inline editing is mandatory for PUT (edit) operations on a table,
it may not be desirable to let users modify data manually. You can
disable these edits dynamically by adding the view title flag
**NO_INLINE**. This allows the API calls to work properly, while
disabling the mouse actions.

## Storage

### Usage

Provides non-volatile storage utilities using the localStorage and
cookies objects. It is the cornerstone of several other features.

### Functions

-   **hasLocalStorage**: Returns whether or not localStorage is
    supported.

-   **lsSetItem, lsGetItem, lsRemoveItem**: Saves, loads, and deletes
    text item in app-specific keys.

-   **saveUserSetting, loadUserSetting, setCookie, getCookie,
    deleteCookie, deleteAllCookies**: Same but using cookies.

## Fields

### Usage

Provides field-related features like auto-select all text on focus,
convert from text to numeric and enforce numeric validation or uppercase
letters.

### Functions

-   **setCfg**: Set all callbacks to your app, like keypress event
    handler and field value changed. Use the textAsNumeric array to
    specify which fields must be considered as numeric even though you
    have set them up as Short Text in Knack. This can be very useful in
    some special use cases. For example, you can dynamically change this
    to allow a unique Account Role to enter letters, while all others
    can only enter digits.

-   **convertNumToTel**: All numeric fields will automatically be
    converted to telephone type. This has no negative or perceptible
    impact for all users, except that it allows mobile devices to switch
    the keyboard to telephone type for a more convenient numeric layout
    and also auto-selection of all text upon focus.

-   **enforceNumeric**: For all numeric fields, and any specified in
    textAsNumeric, validation will be performed. If non-numeric values
    are found, the submit button will be disabled and grayed out, and
    the field will be colorized with Knack\'s \"pink\" error indicator.

-   **addButton**: Will add a button to a specified div element. You can
    specify the label, style, classes and ID, and it will return a
    button object to which you can attach your event handlers.

-   **addCheckbox**: Similar to addButton, but for a checkbox.

-   **addRadioButton**: Similar to addButton, but for radio buttons.

-   **Barcode reader specific functions**: **addChar, clearBuffer,
    getBuffer, setUsingBarcode,** and **getUsingBarcode**. Useful in the
    context of business and industrial projects.

-   **addChznBetter**: The chznBetter object is a custom solution that
    fixes a few problems with the Knack dropdown object. The most
    annoying being the following: When you have more than 500 items in
    the list, the dropdown switches mode and displays a search field.
    But most of the time, when 3 or 4 characters are typed, the last one
    or two are erased, rendering the selection very tedious. I got so
    many complaints about this that I decided to code my own solution.
    As a bonus, you can now customize the delay before the search starts
    (common to all dropdowns), and for individual dropdowns, the
    threshold number of characters to type before the search starts.
    Defaults are 1.5 seconds delay, and 3 characters for short text
    fields and 4 for textAsNumeric fields. Use the ktl.fields.setCfg
    function to modify chznBetterSrchDelay and chznBetterThresholds to
    match your needs.

-   **searchChznBetterDropdown**: chznBetter\'s wrapper to
    searchDropdown. Mainly used internally, but accessible to your app
    in case of specific needs.

-   **inlineEditChangeStyle**: To dynamically modify of an inline edit
    cell, typically to make it wider to more text. Not completed, work
    in progress.

-   **onFieldValueChanged**: Callback to your app to process value
    change events for Dropdowns and Calendars. Driven by
    processFieldChanged function. More field types will be added
    eventually.

-   **getFieldFromDescription**: Returns an object with the field ID and
    view ID of a field containing specified text in its description.

-   **getFieldDescription**: Returns the description text from the field
    ID parameter.

### Using field's Description text box as flags to trigger special behavior

In the Builder, when you edit a field in the schema view, there's a
Description text box, where you can put your own notes, as a developer.
Now, this can also be used by the KTL to trigger special behavior. You
can add the flag at the end of your description, or on a separate line,
as you wish. Here's the list:

-   **TO_UPPERCASE**: to convert text to uppercase in real-time

-   **IS_IP_ADDRESS**: TODO: enforce IP format, with automatic colons
    and hex char real-time validation.

## Views

### Usage

Provides view-related features.

### Functions

-   **setCfg**: To setup your parameters and callbacks to your app.
    Callback processViewFlags allows you to process your own special
    title flags.

-   **refreshView**: Robust view refresh function with retries and error
    handling. Supports most types of views including tables, details,
    searches, forms, rich text, and menus.

-   **refreshViewArray**: Calls refreshView for each view in the array
    of view ids as parameter, and returns (resolve from promise) only
    when all are done refreshing.

-   **autoRefresh**: You can now add auto refresh to any view without a
    single line of code. It is done from the Builder, by simply adding
    AUTOREFRESH=30 at the end of your view\'s title and it will refresh
    itself every 30 seconds. Values from 5 (seconds) to 86500 (24 hours)
    are accepted. Of course, the flag is truncated so only your title
    remains visible. Also, you can start and stop the process at will by
    setting the run parameter to true/false. Note that this will apply
    to all views in scene.

-   **addViewId**: Convenient for developers who want to see the view id
    next to or near the title.

-   **addCheckboxesToTable**: Will add checkboxes to a table, including
    the top one in the header to check all at once. Used by bulk
    operations.

-   **addTimeStampToHeader**: Useful to see when the last refresh
    date/time occurred and assess that your app is running smoothly.

-   **hideField**: Moves a field away from the screen to hide it or save
    space.

-   **searchDropdown**: Searches text in a dropdown or a multiple
    choices object, with these options: exact match, show popup for
    outcome. Currently supports 3 different states of the dropdown:
    single selection, less than 500 and more than 500 entries. Will auto
    select the found result it it's an exact match. Otherwise returns
    all found items and lets you manually choose from the results list.
    Multiple selections are more complex and will be supported
    eventually.

-   **findInSearchView**: Uses a Search view to find text, with exact
    match. Very useful to prevent duplicate entries on a connected
    field, for example, by doing a hidden search on that view before
    submitting a new connected record.

-   **removeTableColumns**: Will hide or remove columns from a table.
    Pass it an array of field ids, and/or array of columns indexes to
    remove. Also works with action links, which is useful to remove a
    Delete action if the logged-in role shouldn\'t be allowed for
    example.

-   **findFirstExistingField**: Pass a list of field IDs and returns the
    first found in scene.

-   **modifyTableSort**: Inverts the sort order if the data type is
    Date/Time. In several apps, I found that users always need to click
    the header twice because they want to see the most recent entries.
    You can also do a Ctrl+Click to sort it ascending like it is now.

-   **submitAndWait**: Pass a form's view ID and an object containing
    pairs of field IDs and values. It will fill in the form and submit
    automatically, then return with a success or failure outcome. If
    successful, the resulting record is also returned and can be used
    for further processing.

-   **updateSubmitButtonState**: Used to perform real-time form
    validation, i.e. before Submit is clicked, by enabling or disabling
    the button based on your criteria. Pass the form's view ID and it
    will enable or disable the Submit button. This status extends the
    existing **validity** property of the button, by adding the
    **invalidItemObj** object to it. When this object is empty, Submit
    is enabled, if it contains any key, it will be disabled.

-   **ktlProcessViewFlags**: This is an internal function that is not
    exposed. But worth some additional explaining, nonetheless. It
    parses the view\'s title for flags that trigger special behavior.
    See the list and details below.

### Using view's Title to add flags to trigger special behavior

You can add these flags **at the end of your view's title** to trigger
the behavior. The flag and any text that follows will be truncated, thus
not visible to the user.

#### AUTOREFRESH=\[value\]

The view will be refreshed periodically every *\[value\]* seconds. It is
possible to start/stop at will using the autoRefresh function.

#### HIDDEN_VIEW

To hide the view away from screen, but still existing.

#### HIDDEN_TITLE

To hide the view title only to save real-estate.

#### ADD_REFRESH

For Kiosk mode only, adds a Refresh button.

#### ADD_BACK

For Kiosk mode only, adds a Back button.

#### ADD_DONE

For Kiosk mode only, adds a Done button.

#### NO_INLINE

Disables inline editing for the user, while still enabled in Builder for
API calls.

#### DATETIME_PICKERS

Six new fields will appear at the top of your table view: **From**,
**To** and periods as **Monthly**, **Weekly**, and **Daily**. Depending
on the active period, when you change From, the To field will
automatically update itself accordingly, and the view will be filtered
in real-time. On the other hand, if you change the To date, the From
will not be affected, leaving you more flexibility. The focus is
conveniently placed on the last field used so you can use the up/down
arrows to scroll quickly through months and visualize data. This is also
compatible with additional filter fields, provided that the AND operator
is used. Once you have a filter that you like, it's also possible to
save it as a [User Filter](#user-filters).

#### REFRESH_VIEW

When a form is submitted, will refresh any other views specified.

Ex: **Customer Sale REFRESH_VIEW=Client Sales,Store Sales**

The visible title will be Customer Sales, and when submitted
successfully, the two tables with the title Client Sales and Store
Sales, separated by a comma, will also be refreshed. The titles must
match exactly.

#### Your own flags

You can also add your own app-specific flags in the callback function
processViewFlags.

### Using view's Description text box as flags to trigger special behavior

In the Builder, when you edit a view, there's a Description text box,
where you can put additional information to the user. Now, this can also
be used by the KTL to trigger special behavior. You can add your flags
at the end of your description, or on a separate line, as you wish, as
long as it's at the end of your text. Currently, only tables are
supported. Here's the list:

-   **NO_FILTER=field_x, field_y, field_z** This will prevent filtering
    on these fields, even if they are visible in the table. Each must
    have a comma separator, spaces are allowed.

### Adding flags to the tables header text to trigger special behavior

In the Builder, when you edit a table view, you can add these flags at
the end of your header text to trigger special behavior:

-   **\_HIDE**: To hide the column. The columns are only hidden and
    still exists in DOM. The visibility is reversible (hide/show) on the
    fly if needed.

-   **\_REMOVE**: To complete delete de column from the DOM. Safer since
    it's not possible to peek at data by showing the columns manually.

## Scenes

### Usage

Provides scene-related features.

### Functions

-   **setCfg**: To set up your parameters and callbacks to your app.

-   **getCfg**: To read the idle watchdog delay value.

-   **autoFocus**: Callback to your app\'s handler of autoFocus. By
    default, Knack does not set the focus to a field. But this enables
    you to choose when and how to do it -- your way.

-   **renderViews**: Renders all views in the current scene.

-   **addKioskButtons**: In kiosk mode, most of the time there is no
    mouse or keyboard. This enables adding specific buttons, typically
    for navigation: Back, Done, Refresh. I\'ve also added Work Shift and
    Messaging buttons, if ever you need them (more information provided
    upon request).

-   **spinnerWatchdog**: This is a timer that checks if the app is in a
    waiting state. If the spinner takes more than a specified amount of
    time (default is 30s), you can gain back control, typically by
    reloading the page. Most of the time, this solves the \"infinite
    waiting\" problem after a Submit or any page load/refresh,
    especially for kiosks without a keyboard, where users would
    otherwise have to reboot the device. After quite a bit of
    experimentation, I was surprised to observe that a submitted form
    was indeed sent successfully, but it was the screen refresh that
    never came back. This forced refresh solved the problem at least 90%
    of the time.

-   **isSpinnerWdRunning**: Returns true if page is busy and spinner is
    shown.

-   **flashBackground**: Simple attention getter, useful on small
    devices monitored from a distant area, to show status like success
    or failure.

-   **resetIdleWatchdog**: The idle watchdog is an "inactivity timer".
    Each time a mouse click/move or a key press is detected, this is
    called. After a given amount of time without activity, the
    idleWatchDogTimeout callback (below) in your app allows a specific
    action to take place.

-   **idleWatchDogTimeout**: The idle callback to your app, typically
    for reloading the page or logging out the user.

-   **findViewWithTitle**: Searches through each view in the current
    scene and returns the first view ID containing specific text in its
    title, with optional exact match.

-   **scrollToTop**: Scrolls the page all the way up.

-   **addVersionNumber**: Adds the app and optionally the KTL version
    numbers on the page.

-   **isiFrameWnd**: returns whether the window is the top-level app, or
    the hidden child utility page called iFrameWnd.

-   **onSceneRender**: Callback to your app\'s handler of a
    "knack-scene-render.any" event.

### Using Page Settings' Name field as flags to trigger special behavior

In the Builder, you can add these flags at the end of your Page
Settings' Name field to trigger special behavior:

**LINK_OPEN_SAME=** : to redirect your browser to another URL, in the
same page.

**LINK_OPEN_NEW=** : to redirect your browser to another URL, in a new
tab.

Ex: Support LINK_OPEN_NEW=https://ctrnd.com/

This will open a new tab to ctrnd.com website. The menu will display as
**Support**. The page can be left blank, and the Page URL is ignored --
just use a random label like linksupport for example.

## Form Persistence

### Usage

When user types-in data in a form, values are saved to localStorage and
restored in case of power outage, accidental refresh, loss of network or
other mishaps. **Data is erased** when the form is **submitted**
**successfully,** or user **navigates away** from page.

### Functions

-   **setCfg**: To define scenes and fields to exclude, i.e. that are
    never saved.

## User Filters

### Usage

When \"Add filters\" is used in tables and reports, it is possible to
save each one you create to a named button by clicking on the yellow
diskette save icon. The \[X\] icon with a pink color is to remove the
active filter and see all records. Your filters are saved in
localStorage but can be saved/restored to/from Knack for backup or
migration to other devices, provided some additional setup. See the
[User Filters setup procedure](#user-filters-1).

Each active filter will not only remember its filter parameters, but
also the column selected for sorting, the sort order, and the searched
text. You can rename and delete buttons at will, and you can also drag
and drop the buttons to re-order them at your convenience. The button
colors will have matching variations based on the app\'s header color.
Each view remembers the last active filter when you go back to its page.

The User Filters feature is enabled by default, but you can disable it
by setting the userFilters flag to false in the ktl.core.setCfg
function.

### Public Filters

If you are annoyed by the limitations of **Filter menus** that only have
one field and without AND/OR operators, then you will find Public
Filters very useful. They are the same as User Filters but created by
special users, yet visible to everyone.

First, you need to perform the setup of the [iFrameWnd](#iframewnd) and
the [Heartbeat Monitoring and SW
Update](#heartbeat-monitoring-and-sw-update).

Then, create a **Public Filters** role and assign it to the privileged
users of your choice. When they create their filters, they can
right-click the assigned button to open the popup menu, where an option
is shown: **Public: Yes/No**. Clicking on it will broadcast the new
filter to all users. Within about 20 seconds, they will see it appear on
all opened pages with that view. The Public Filters are always located
to the left of the other filters with a slightly increased color and
kept in the same order as the creator's. They can't be renamed, deleted
or re-ordered by regular users.

### Functions

-   **setCfg**: When User Filters are enabled with the main flag, it is
    possible to use the allowUserFilters callback to your app to disable
    it based on specific conditions. Ex: Kiosk mode devices usually
    don't have filters enabled, while all others do.

## Bulk Operations

### Usage

There are two types of bulk operations: Bulk Edit and Bulk Delete. As
their names imply, they provide the ability to perform several record
modifications or delete operations in batches. Both work with table
views and have a global flag to enable each of them separately.

### Bulk Edit

To use this feature, you must:

1)  Enable the bulkEdit flag in the ktl.core.setCfg function

2)  Create an account role named \"Bulk Edit\" and assign it diligently
    to very trusty and liable users.

3)  For each applicable table, enable Inline editing and be sure to
    disable all the fields that should be protected against unintended
    modifications.

These field types are supported: all text fields, connected fields, date
time picker, Yes/No, multiple choices (single selection and radio
buttons only at this time).

Usage: In the table, select all the checkboxes for the records to be
modified. Then click on any cell to edit its value (inline). After
submitting the change, a prompt will ask you if the value should also
apply to all selected records. Click yes to apply to all. A confirmation
message will pop up after completion.

\*\* Important note\*\* the table\'s sort+filter combination may cause
your changes to disappear due to becoming out of scope. This is normal.
You can prevent this by first choosing a sort+filter combination that
will not cause this. Ideally set the filtering to show only a very
restricted number of records, but still include the ones you need.
Experimenting with only a few records at a time (less than 10) or even
better "test records" is recommended as a starting point. If you\'ve
made an error, the process can be interrupted (but not undone) at any
time by pressing F5 to reload the page.

### Bulk Delete

To use this feature, you must:

1)  Enable the bulkDelete flag in the ktl.core.setCfg function

2)  Create an account role named \"Bulk Delete\" and assign it
    diligently to very trusty and liable users.

3)  For each applicable table, a Delete action link must be added.

You will see two buttons appear:

-   **Delete Selected**: Is enabled when at least one record is selected

-   **Delete All**: Is enabled when \"Add filters\" is used. The
    checkboxes are ignored, and the process will keep deleting records
    until none is left, flipping through pages automatically.

If you\'ve made an error, the process can be interrupted (but not
undone) at any time by pressing F5 to reload the page.

### Functions

-   **deleteRecords**: Used internally by bulk delete to delete an array
    of records but may be used elsewhere by your app if ever needed.

## Account

### Usage

Provides features for the currently logged-in account.

### Functions

-   **isDeveloper**: Check if the list of role names contains
    \"Developer\"

-   **isLoggedIn**: Returns false if Knack.getUserAttributes() is not
    \"No user found\" (not logged-in).

## User Preferences

### Usage

Provides various settings for the currently logged-in account. Some are
built-in, and more can be added by your app. You can control which
settings can be modified by the user and they can access them in the
Account Settings page. See the [User Preferences setup
procedure](#account-logging).

### Functions

-   **setCfg**: To set up your parameters and callbacks to your app. The
    allowShowPrefs() callback is where you can control what preferences
    you give access to specific roles. Typically, this is used to give
    access to more advanced flags to developers. The applyUserPrefs
    callback is where you can process your own custom preferences.

-   **getUserPrefs**: Reads the user preferences from localStorage.

## iFrame Window

Referred to as the **iFrameWnd**, it\'s a hidden utility page that is
dynamically created at the bottom of the main app page. It contains
various views to implement system status, user preferences, remote SW
updates and logging features. You may even add your own views if you
need any. The idea is to be at two places at the same time: The main app
page that changes as the user navigates around, and that invisible
iFrameWnd that stays with us to serve various functions in the
background. When the user logs-in, the authentication token is
conveniently shared with the iFrameWnd, allowing us to log-in seamlessly
and do API calls. If desired, it is possible to exchange information
between both windows using the powerful [wndMsg](#windows-messaging)
feature.

### Usage

-   It is used to monitor the current SW version on all devices, perform
    remote SW updates, send UTC timestamps called *heartbeats* from
    devices to the system to assess sanity/presence.

-   The user preferences are also read/modified here, including various
    debug flags and the work shift.

-   A logging table is used to send all logs to Knack via an API call.
    It contains the 5 most recent logs with a unique identifier (Log ID)
    to confirm the transaction.

-   To enable and configure the iFrameWnd feature, see the [iFrameWnd
    setup procedure](#iframewnd).

### Functions

-   **setCfg**: Called when the iFrameWnd is ready.

-   **getCfg**: Returns the iFrameWnd config about field and view IDs.

-   **showIFrame**: To show or hide the iFrameWnd.

-   **getiFrameWnd**: Returns the iFrameWnd object. Mainly used by
    sendAppMsg but also available to your app for any use.

## Debug Window

### Usage

Provides a window to see local logs on mobile devices where we don\'t
have the luxury of a console log output. Useful for simple
tracing/debugging without the complexity of USB tethering and the
learning curve that comes with all the tools. Works on all device types
(not just mobile), and the window can be moved around. The logs are
stored in a ring buffer of 100 elements.

### Functions

-   **lsLog**: Adds a log to localStorage, with timestamp to millisecond
    resolution. These logs can be shown in the debugWnd when visible,
    and optionally, in the console.log if you have one.

-   **showDebugWnd**: Show or hide the debugWnd.

## Logging

### Usage

Provides comprehensive logging functionalities for just about anything
you want to monitor, such as user activity, navigation, system status,
errors, or simply traces for development and debugging. All logs are
connected to a given account.

To use this feature, you must set the iFrameWnd and all desired logging
flags to true in the ktl.core.setCfg function, then follow the [Account
Logs setup procedure](#account-logging).

All logs are aways saved in localStorage, with their timestamp. This is
to prevent losing any of them in case of power outage or browser crash.

Then, at certain intervals, the logs are inserted to the Account Logs
object with an API call, and upon confirmation, they are erased from
localStorage.

To minimize record consumption and API calls usage, navigation logs are
agglomerated over an hour and sent only once as a single stringified
object. A custom viewer then disassembles them for display in
chronological order.

The logging categories are: User Login, Navigation, Activity (count of
keypresses and mouse clicks), Critical Events, App Errors, Server
Errors, Warnings, Info and Debug.

### Functions

-   **setCfg**: Allows setting a callback logCategoryAllowed() that
    returns whether or not a category should be logged, based on
    specific conditions.

-   **clog**: Provides an enhanced version of console.log(), with custom
    color and bold font text.

-   **objSnapshot**: Converts an object to a string and back to an
    object. This is used to *freeze* the content of an object in time.

-   **addLog**: Adds a log to the localStorage for deferred processing.
    All log categories are not created equal. Here\'s how each work:

    -   Critical: Sent to Knack within 1 minute. An email is also sent
        to the Sysop.

    -   Login, Info, Debug, Warning, App Error, Server Error: Sent to
        Knack within 1 minute.

    -   Activity, Navigation: Data is accumulated in an object in
        localStorage, then sent as a single bundle to Knack every hour
        to reduce record usage and API calls.

-   **getLogArrayAge**: Used internally by iFrameWnd and returns the
    oldest log\'s date/time from array within a resolution of 1 minute.

-   **monitorActivity**: Entry point that starts the user activity
    logging. Every 5 seconds, the mouse clicks and key presses counters
    are updated in localStorage, and counters from all opened pages and
    tabs are merged (added) together.

-   **resetActivityCtr**: Resets mouse and keyboard activity counters.

-   **updateActivity**: Updates the keyboard and mouse activity counters
    in localStorage. Mainly used by KTL internally, but available to
    your app, for specific use.

## Windows Messaging

Provides a framework to exchange data between windows. It uses a queue
and supports automatic retries and error handling. The windows can be
app window, the iFrameWnd, or any other window that the app creates and
needs to communicate with. For example, this is how your app can
implement a heartbeat message that notifies Knack about your account (or
device) being online and running properly.

### Functions

-   **setCfg:** Used to set callbacks to your app.

    -   **processFailedMessages** to handle messages that were never
        acknowledged.

    -   **processAppMsg** to implement your own messages.

    -   **processServerErrors** to implement your own processing of
        server errors.

    -   **sendAppMsg**: Experimental feature still under development.
        Will be used to exchange messages across different Knack apps.

-   **send**: To send a msg to a specific window. May contain a payload
    or not.

-   **removeAllMsgOfType**: Cleans up the msg queue of all those of a
    specific type.

## System Info

Retrieves information about the operating system, browser, device model,
processor, whether or not we are on a mobile device, and public IP
address.

This is also where the SW Update broadcast takes place.

### Functions

-   **getSysInfo**: Returns an object with the above-mentioned
    properties.

## System Colors

Retrieves information about Knack\'s colors and generates a few
variations for KTL features.

### Functions

-   **getSystemColors**: Get the sysColors object.

-   **rgbToHsl**, **hslToRgb**, **rgbToHsv**, **hsvToRgb**,
    **hexToRgb**: Various color conversion utilities.

# How to use KTL

The first thing to do is to get all the files on your workstation. The
best way to do it is to install GitHub and "clone" the repository
locally. You will find this under the green "\< \> Code" button at top
right of this page. Alternatively, you can use "Download ZIP" under that
same button. In that case, you will need to remove the "**-master**" at
the end of the folder Knack-Toolkit-Library-master.

## Folder Structure

The following folder structure will be generated by default from the
repository. It will keep each app's code separated, a single set of
shared libraries, and everything easy to maintain with a revision
control tool like GitHub.

.code\\MyKnackApps\\App1\\App1.js

.code\\MyKnackApps\\App2\\App2.js

.code\\MyKnackApps\\App3\\App3.js

.code\\Lib\\KTL\\KTL_Bootloader.js

.code\\Lib\\KTL\\KTL.js

.code\\Lib\\KTL\\KTL.css

.code\\Lib\\KTL\\KTL_KnackApp.js

.code\\Lib\\KTL\\NodeJS\\NodeJS_ACB_MergeFiles.js

.code\\Lib\\KTL\\NodeJS\\NodeJS_FileServer.js

.code\\Lib\\SomeOtherCoolLib\\CoolCode.js

## KTL Modes

There are three possible modes for using KTL: **ACB, CLS** and
**Hybrid**.

## ACB Mode -- "All Code in Builder"

This is the traditional mode that we\'re all used to, i.e. when all the
code resides in the Builder\'s Javascript and CSS panes.

### Pros

-   Easier and faster setup, no need to install anything for default
    ACB.

-   Other users can always see your changes.

-   You can test your code on any device, not limited to your
    workstation.

### Cons

-   Slower than CLS mode and more tedious to work, due to the redundant
    merge/copy/paste/save sequence required each time you make a change.

-   Can be risky if used in production (when the app is being used in a
    live and consequential context) since your development code always
    takes effect immediately. You must have good coding experience and
    know exactly what you\'re doing.

To use this mode, you have two options:

1)  Use the default, basic, ready-to-use setup
    [here](#no-time-to-read-all-this-now---how-about-a-quick-tryout)

2)  Use your custom app code and generate the ACB file yourself. This is
    described in the following section.

### How to generate your own ACB file

First, you'll need to install **Node.js** (<https://nodejs.org>) on your
workstation. Just the basic installation, no optional component is
needed.

Then, the custom ACB file can be generated using the
[NodeJS_ACB_MergeFiles.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/NodeJS/NodeJS_ACB_MergeFiles.js)
merge utility provided in the NodeJS folder.

This script can be invoked manually in a command prompt or shell, but
it's easier to run the batch file provided:
[Merge_ACB.bat](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/Merge_ACB.bat)
. The extension .bat is only for Windows but it can be rewritten a .sh
(shell script) for Linux and MacOS. See the .bat file for more details
about the script parameters.

These three files will be merged together:

1)  [KTL_Bootloader.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Bootloader.js)

2)  [KTL.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL.js)

3)  [KTL_KnackApp.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp.js)

The output file is
[KTL_KnackApp_ACB](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_KnackApp_ACB.js).

\*Note about **KTL_KnackApp.js**: throughout the document, we'll refer
to the app code file as this one, but you can substitute it to anything
that would better match your app name. As long as you modify the merge
utilities accordingly. See the **-filename** parameter in the batch
file.

Open the KTL_KnackApp_ACB.js file, copy its content to your Javascript
pane in the Builder and save.

Open the KTL_KnackApp_ACB.css file, copy its content to your CSS pane in
the Builder and save.

\*Note that eventually, when we reach the first official release, these
two files will be hosted on my Cortex R&D's CDN, and all these copy
operations won't be required anymore.

### Setup

You will need to modify the KTL_KnackApp.js file to match your needs if
you want to go beyond the basic default setup. [Follow the procedure
here](#switching-modes).

## CLS Mode -- "Code on Local Server"

This mode provides much faster code-save-test cycles and is typically
used when you have frequent code changes, and where you don\'t need to
show your results to others until a milestone is reached. It also
enables collaborative coding on the same app.

It requires the installation of Node.js as a basic local file server
that the Bootloader uses to fetch the KTL files and your app\'s code.
The Builder\'s Javascript pane only needs to contain the Bootloader code
(\~240 lines!). You can also have the full ACB code without conflict.
Although this means a few extra milliseconds of loading time, it allows
you to leverage the powerful [Hybrid
Mode](#hybrid-mode---for-production-and-development-at-same-time).

### Pros

-   Allows very fast \"code-save-test\" cycles.

-   Allows multi-developer coding collaboration without conflict.

-   Allows Hybrid Mode for development and production code running at
    same time.

### Cons

-   Requires a one-time Node.js installation and setup.

-   Other users or clients can\'t see the updates until you merge all
    code and switch to the ACB Mode.

-   You can\'t test on devices other than your workstation, running the
    file server.

### Multi-Developers Collaboration

With the CLS mode, it is now possible to have many developers write code
independently on the same app since they are working on a "sandboxed"
copy of their code. Of course, for other developers to see your changes,
they need to pull/merge your new code with theirs, and vice-versa for
you to see their changes. GitHub is excellent at that.

### Setup

Install **Node.js** (<https://nodejs.org>) on your workstation. Just the
basic installation, no optional component is needed.

Validate installation by typing **node -v** in a command prompt or
terminal window. You should see the version number displayed.

1)  Edit the file [KTL_KnackApp.js using this
    procedure](#switching-modes). Include the KTL.css file also.

2)  Run the FileServer.bat utility. You can also open a command prompt
    or a shell, go to the **code** folder (see folder structure below)
    and launch **node NodeJS_FileServer.js**.

3)  Each time you refresh your app\'s page, you will see logs showing
    the path and file name requested.

4)  Open a browser to your Knack app.

5)  Check console logs to see if all is looking good.

## Hybrid Mode - For Production and Development at same time!

Traditionally, Knack developers have to create a temporary copy of their
production app to experiment freely without fearing serious consequences
or disruption. While this is still desirable in many cases, you now have
another option: **Hybrid Mode**. Thanks to the Bootloader, a hybrid
setup is possible with both the ACB and CLS modes at same time. This
enables you to run development code in a production environment without
users being affected by it.

What happens is that the Bootloader will use the stable and released
code from the ACB in the Javascript pane by default for remote users.
But if it detects a development flag in your localStorage, it will
switch to the CLS code **on your workstation only**.

With Hybrid Mode, it is also possible to switch back and forth between
the ACB and CLS modes instantly. See [Switching Modes](#switching-modes)
in the next section.

## Switching Modes

Once you've mastered both modes, you'll typically spend 95% of the time
in CLS mode for its efficiency and speed, and 5% in ACB mode to show
updates to your client.

Switching modes can be done two ways:

1)  If you have the showAppInfo flag enabled, it will add the version
    info on the top-right of the screen. Clicking on it will show a
    prompt with this: *Which version to run, \"prod\" or \"dev\"?* Type
    in the desired mode and click ok. Note that this is possible only
    for accounts having the "Developer" role.

2)  Add a key to the localStorage for your app with the name followed by
    **\_dev** like this: **KTL_KnackApp_dev**. Leave the value empty
    since it is not used. Refresh the page and you'll see the version
    now shown with bright yellow/red attention getter that indicates
    you're in CLS development mode.

# Editing KTL_KnackApp.js

1)  Open the **KTL_KnackApp.js** file in your favorite editor.

2)  Locate the **//App constants** section and add any const (scenes,
    views, field IDs) that KTL may need. If not sure, just ignore for
    now.

3)  Locate the **//KTL Setup** section and go through all the flags and
    settings to match your needs.

4)  Locate the **//KTL callbacks to your App** section and go through
    each function, adapting them to match your needs.

5)  Locate the **//Setup default preferences** section and go through
    all the flags and settings to match your needs.

6)  In the CSS pane, add the CSS code from file KTL.css to yours.

7)  Open a browser to your Knack app.

8)  Check console logs to see if all is looking good.

\*Note: If you're using the ACB mode, you should never edit the
generated ACB file directly. Always edit the KTL_KnackApp.js file and
merge again.

# Advanced Features

These features are considered \"advanced\" in the sense that they
require additional setup. Also, some of them can provide communication
between various parts of your app, thus leveraging quite powerful
administration features.

Namely:

1)  iFrameWnd

    a.  Heartbeat Monitoring

    b.  User Preferences

    c.  Account Logging

    d.  Remote SW Updates (the page and view setup will come soon)

    e.  Public Filters

2)  Bulk Operations

    a.  Edit

    b.  Delete

3)  User Filters Upload and Download (save/restore)

## Setup

In this section, when you see a name for an object, a field or a view
title, it must be written **exactly** as shown, case sensitive, spaces,
everything. It is recommended to copy/paste to avoid any typos.

### Invisible Menu

This shall be your default place for any future utility hidden pages.
For now, the iFrameWnd page will be its first resident.

1)  Create a menu named Invisible Menu.

2)  In settings, uncheck Include this page in the Page Menu.

### iFrameWnd

To use this feature, you must set the iFrameWnd flag to true in the
ktl.core.setCfg function.

Create a new Login Page and give permission to all users. Set Page Name
to: **iFrameWnd**. Its URL should automatically be set to **iframewnd**.
This page will be the placeholder for the next features. For now, leave
it blank as we need to create a few objects first. Now, go back to the
Invisible Menu and assign the iFrameWnd to it.

#### User Preferences

If you want to add User Preferences to your app, there are some already
built-in, and you can also add your own. Follow this procedure:

1)  In the Accounts object, add a Paragraph Text field named **User
    Prefs**.

2)  In the iFrameWnd page, add a view: Type: Details, For: Logged-in
    Account. Once the view is added, remove all fields, then add User
    Prefs. Set the view title to **Current User Prefs AUTOREFRESH=10**.

3)  Add a Form view that updates the currently logged-in account. Once
    the view is added, remove all fields, then add User Prefs. Set the
    view title to **Update User Prefs**. Enable the form\'s auto-reload
    in the Submit rule.

4)  Align both views on the same row to save space.

5)  Go to User Pages (at the bottom of the Pages view) and edit the
    Account Settings page.

6)  Add a menu named **My Settings** and move it to the top of the page.

7)  Add a link to a new page named **My Preferences** and enter to edit
    that page.

8)  Add a Form view that updates the currently logged-in account. Once
    the view is added, remove all fields, then add User Prefs. Set the
    view title to **My Preferences**.

9)  Refresh your app and click on the - Account Settings link, then on
    My Preferences button in top menu.

10) You will see 4 new checkboxes (dynamically generated by code): Show
    View ID, Show iFrameWnd, Show DebugWnd and Show Extra Debug.

11) Check all 4, submit and view the result: view IDs will be shown in
    red next to each view, the iFrameWnd will appear at the bottom of
    the app, the DebugWnd will show up, and some new logs about WndMsg
    processing (REQ, ACK, etc.) will be shown in the console output.

12) Uncheck all those you don't want and submit. It is recommended to
    leave Show iFrameWnd on if you're planning to set up the User
    Preferences that follow.

#### Heartbeat Monitoring and SW Update

If you want to add Heartbeat Monitoring to your app to assess an
account\'s presence and generate alerts, or perform remote SW updates,
follow this procedure:

1)  Add the [User Preferences](#user-preferences-1) feature from the
    above procedure.

2)  In the Accounts object, add these fields:

    a.  **SW Version**: Type: Short text.

    b.  **UTC HB**: Type: Date/Time, Date Format: mm/dd/yyyy, Default
        Date: none, Time Format: military, Default Time: none.

    c.  **Time Zone**: Type: Number, no decimals.

    d.  **LOC HB**: Type: Equation, Equation Type: Date, Date Type:
        hours, Result Type: Date, Equation Editor: {UTC HB}+{Time Zone},
        Date Format: mm/dd/yyyy, Time Format: military.

    e.  **Online**: Type: Yes/No, Default No, Input: Checkbox.

    f.  **UTC Last Activity**: Type: Date/Time, Date Format: mm/dd/yyyy,
        Time Format: military.

3)  Create a **new object** called **App Settings** with these fields:

    a.  **Item**: Type: Short Text, set as object's Display Field and
        Sort in Alphabetic order.

    b.  **Value**: Type: Paragraph Text.

    c.  **Date/Time**: Type: Date/Time, Date Format: mm/dd/yyyy, Time
        Format: military.

4)  In the iFrameWnd page created above, add a Form view that updates
    the currently logged-in account. Once the view is added, remove all
    fields, then add on a first line: SW Version, UTC HB and LOC HB (set
    as read-only). Then on a second line: Online, UTC Last Activity and
    Time Zone. Set the view title to **Heartbeat**. In the form's Submit
    rules, enable auto-reload and set the Confirmation message to
    "Heartbeat sent successfully.".

5)  Still in the iFrameWnd, add a table view that displays **App
    Settings**, with title: **App Settings AUTOREFRESH=20**. Source
    filter: **Item Starting with APP**, sorted alphabetically A to Z. No
    Search, inline editing = On, 10 records at a time, no filtering
    allowed. Add all fields. Set Value's Truncate Text to 75 characters.

6)  Be sure you have the Show iFrameWnd checkbox on in [User
    Prefs](#user-preferences-1) above.

7)  Refresh the app and you should see in the iFrameWnd the heartbeat
    being submitted every minute and the Online being set to Yes.

8)  **VIEWER**: To view the heartbeats, online status, latest activity,
    SW Version, etc., create a Sysop Dashboard page accessible to
    Developer role only, with a table view that shows the Accounts
    having an Active status. Title: **Account Status AUTOREFRESH=60**.
    Fields: Name, Online, LOC HB, UTC HB, UTC Last Activity, SW Version
    and User Prefs. This view will refresh itself every minute, so you
    can assess the presence, latest activity and SW Version for each
    account.

9)  **Note**: The Online status flag is set, but not reset
    automatically. You'll need to create a daily task to reset it. I
    also have some existing code that does it with API calls, but need
    to add it to the KTL soon. TODO: provide code for Online update,
    email and audio alerts, custom status colorizing, etc.

10) **For SW Updates**: In the Status Monitoring page, add a table view
    for App Settings object. Title: **BROADCAST_SW_UPDATE**. Filter
    Source on Item contains APP_KTL_VERSIONS. Settings: no search,
    Inline Edit = On, 10 records, no filtering. Leave three fields Item,
    Value and Date/Time.

11) Add an action column: Header: Broadcast SW Update, Link Text:
    BROADCAST NOW. Action is Update this record, Item to a field value
    Item. Confirmation msg: SW Update in progress\.... You can set the
    text style in bold red with the display rule: when Item is not
    blank.

#### User Filters

In addition to being able to create named buttons for the User Filters
that are saved in localStorage, it is possible with a bit of setup to
upload your settings to Knack and download them back wherever and
whenever needed. This two-way process is automatically done in the
background, and can be seen as a backup method, but also to migrate them
to other devices (or browsers, see note below). Note that if you migrate
filters from one app to another, typically a temporary development copy,
some filters may not work due to the record IDs that have changed for
connected fields. This is a normal behavior, and the only way to fix
this is to redo their settings and save back to the same button name.

To support automatic Upload and Download, follow this procedure:

1)  Create an object named **User Filters** and add these fields:

    a.  **Account**: Type: Connection to Accounts, all settings at
        default.

    b.  **Date/Time**: Type: Date/Time, Date Format: mm/dd/yyyy, Default
        Date: Current Date, Time Format: military, Default Time: Current
        Time.

    c.  **Filters Code**: Type: Paragraph Text.

    d.  Object Settings : Display Field: Account, Sort Order: Account, a
        to z.

2)  Go to the **iFrameWnd** page and add a new Table that displays
    **User Filters** connected to the logged-in account. Call it User
    Filters, remove the Account column and leave only the Date/Time and
    Filters Code. Set Filters Code's Truncate Text to 75 characters.

3)  Source: Limit number of records to 1.

4)  Settings: no search, Inline Editing = On, 10 records at a time, no
    filtering. Title: **User Filters AUTOREFRESH=30** (you can change
    the 30 for 10 seconds temporarily for quicker testing, then put back
    to 30)

**To test this feature:**

Open two different browsers (ex: Chrome and Edge) and log-in with the
same account - yours. Open both to the same page, where there's a table
with filtering enabled. Create a couple of filters in the first browser,
wait about 30 seconds and you will see those filters appear in the
second browser. Same applies for Public Filters: set a filter to Public,
make changes to it, and all will be reflected in the other browser, but
also for all users of that view.

\*Note about browsers: the localStorage is not shared across different
browsers (and also within the same browser but in private/incognito
mode). This is when the automatic Upload/Download feature then comes to
the rescue, by allowing this transfer to occur in real-time, within
about 30 seconds.

#### Account Logging

If you want to add Account Logging to your app, follow this procedure:

1)  Create an object named Account Logs and add these fields:

    a.  **Log Nb**: Type: Auto-Increment.

    b.  **Account**: Type: Connection to Accounts, all settings at
        default.

    c.  **Date/Time**: Type: Date/Time, Date Format: mm/dd/yyyy, Default
        Date: Current Date, Time Format: military, Default Time: Current
        Time.

    d.  **Log Type**: Type: Short Text.

    e.  **Details**: Type: Paragraph Text.

    f.  **Log Id**: Type: Short Text. See note below for details.

    g.  **Email To**: Type: Email.

    h.  In the Object Settings: Display Field: Account, Sort Order: Log
        Nb, low to high.

2)  In the iFrameWnd, add a view: Type: Table, For: Account Logs,
    connected to the logged-in Account.

    a.  Once the view is added, remove all fields, then add Date/Time,
        Log Type, Details, Log ID, Email To and an Custom Email action
        with these settings, as from the screen capture [**KTL Account
        Logs Email
        Settings.jpg**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/Docs/KTL%20Account%20Logs%20Email%20Settings.jpg).

    b.  The blank value to Email To in Action #2 is intended. This field
        also acts as a flag and resetting it to blank prevents sending
        the email more than once.

    c.  The Outcome phrase "Account Logs - Email sent successfully" is
        used in the code to confirm completion, so it must be exactly
        the same.

    d.  Set the view title to **Account Logs AUTOREFRESH=30**, disable
        keyword search, enable Inline editing, 10 records at a time, no
        filter.

    e.  Sort by Log Nb: high to low, limit to 5 records.

\*Note about the **Log Id** field: This is a unique ID that is a UTC
millisecond timestamp. It is generated by the code at the moment the log
is sent via the API call. Its purpose is to validate that the log has
been sent and received properly. With that confirmation, the log can
safely be deleted from localStorage.

#### Bulk Operations

If you want to add Bulk Edit and Bulk Delete to your app, follow this
procedure described in this section [Bulk Operations](#bulk-operations).

# Future Improvements

-   Use JSDoc to have an adequate auto-generated and detailed API
    documentation, for each function with parameter description, etc.

-   Geofencing and other map-based features, with geo-based events and
    Google Maps integration.

-   The sky\'s the limit! Let\'s see what we can come up with...

# Conlusion

That\'s about it for now, thanks for reading this and testing the
library. Hope you enjoy it as much as I did write it. Now, let's see how
many of you will **collaborate on this project**. Cortex R&D needs
you!!!

All code and documentation written by:

Normand Defayette

<nd@ctrnd.com>

Cortex R&D Inc.

Blainville, Québec, Canada
