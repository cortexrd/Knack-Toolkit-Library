# Knack Toolkit Library Changelog


## 0.34.8    *2025-10-28*

- Improves dropdown change handling with per-select debounce (#549)
  - * Improves dropdown change handling with per-select debounce
  - Uses individual timeouts for each dropdown to prevent rapid changes on different selects from interfering with each other. Adds error handling and cleans up timeout references to enhance reliability and maintainability of form value change detection.
  - * Removes stale timeout references after clearing
  - Deletes timeout entries immediately after clearing to prevent leaving behind stale references, reducing potential memory leaks and ensuring accurate timeout management.
  - * Added back a deleted comment
- Status Monitoring page improvements
  - Hearbeat delay value comes from the account's User Prefs now, instead of one hard coded value for all.

## 0.34.7    *2025-10-26*

- Improves sticky header scroll restoration and styling (#548)
  - Persists and restores scroll positions for views with sticky headers,
  - enhancing user experience when refreshing tables. Refactors sticky header
  - and grouping styles to use dynamic CSS and ensures scroll restoration
  - waits for stable content. Reduces UI glitches and improves maintainability.
- Fixed issue with search results: multiple instances, unable to close.
  - And zero size window.
- Suppress VSCode error: 'delete' cannot be called on an identifier in strict mode.

## 0.34.6    *2025-10-21*

- _rcm keyword updated
  - Now supports grids and search views.
  - Now supports 3 options: no param, delay only and delay per action link.
  - Now supports multiple groups and roles
- Fixed issue #545 - no more multiple instances of the search results.
  - Also simplified the closure of all popups with a single click outside the windows or the Escape key.
- Fixed double VK appearing on PI devices, when using _vk also.
- Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
- Fixed issue with kiosk device using barcode scanners.
  - The _vk now works as expected and forces the use of VK even if the scanner is detected as a physical keyboard.
- Added Carl's videos.
- Added Carl's videos link.
- Improved developer search tool.
- Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
- Fixed when Enter key is pressed in an inline edit.
- Now runs on whatever is the root folder.
- Create initLocalMode.js
  - Utility to create all necessary files to start using the local development mode.

## 0.34.5    *2025-10-19*

- No additional commits for this version

## 0.34.4    *2025-10-08*

- Quick fix for issue #537
- removeOption _ro fix.  Now triggers dropdown update only when finished.

## 0.34.3    *2025-10-08*

- No additional commits for this version

## 0.34.2    *2025-10-06*

- setFieldValue improved date/time support.
- Added local timestamp to log.
- Added count of found items to findAllKeywords

## 0.34.1    *2025-09-26*

- Kiosk devices now properly handles autologin with multi-pages.
- Fixed issue #543
  - Again... setFieldValue now supports more field and format types.
- Removed duplicate code
- Fixed issue #543
  - setFieldValue now supports more field and format types.

## 0.34.0    *2025-09-24*

- setFieldValue, added support for dropdowns and ktlAll param.
- Updated searchDropdown to support multiple concurrent searches.
  - _sfv fixed radio buttons multiple choices.
- Updated setFieldValue _sfv to support ktlRefVal
  - Also added support for multiple instances.
- Put back header as before :: KTL Search Results ::
- Scene's reference, now more compact view.
- Added utility to find all references to a scene
  - New Icon in the Dev Popup Tool.
  - New message to populate search results text: KTL.devPopupSetResultText
  - Now Ctrl+Shift+F also re-opens last search results view.
- Fixed bug in findKeyWithValueInObject
  - Updated findAllReferencesToThisScene to find links in tables.
- Fixed conflict between virtual keyboard and modal popups.
  - User can now scroll the modal view to allow tying values without hiding overlapped fields.
- _ar Auto-Refresh minimal value goes from 5 to 60 seconds.
  - As per Knack's request, to reduce server load.
  - Will show a log during keywords parsing.
- Updated findAllKeywords to detect _ar with less than 60s
  - Display summary section highlighting problematic views IDs.

## 0.33.1    *2025-09-17*

- No additional commits for this version

## 0.33.0    *2025-08-29*

- No additional commits for this version

## 0.32.9    *2025-08-25*

- No additional commits for this version

## 0.32.8    *2025-08-15*

- Forced logout on token expiry to prevent API failures.
  - Happens when user with an expired token submits a form that is followed by API calls that will fail.  This solves the issue by forcing a logout when a form exists in the page.
  - Fixed _sa (Select All) in an Add form.

## 0.32.7    *2025-07-25*

- Fixed kiosk issue, unable to auto-login.

## 0.32.6    *2025-07-18*

- Improves numeric value extraction from formatted text (#531)
  - * Improves numeric value extraction from formatted text
  - Enhances parsing of numeric values by handling misplaced minus signs
  - and removing non-numeric symbols more robustly. Improves cell text
  - retrieval for numeric fields to better capture negative numbers and
  - formatted values. Reduces errors with currency and special formats.
  - * Adds support for ul, ol, and li markup replacements
  - Expands the replacements mapping to handle unordered and ordered lists,
  - as well as list items, improving HTML formatting flexibility for tooltips.
- Fixed fixTableRowsAlignment: Added cellIndex validation.
- Fixed
  - hiddenHeaders.forEach is now hiddenHeaders.each and parameters were inverted.
- Remove version info bar flashing yellow
  - when kiosk's agent service comes back.

## 0.32.5    *2025-06-24*

- Minor comments refactor
- Fixed _as addSelectAllOption:  race condition
- Improves table header column count logic (#527)
  - * Fixes colspan calculation for table groups
  - Addresses an issue where the colspan attribute of table group rows was not being calculated correctly when the table header was empty.
  - It now uses the number of visible table data cells in row of the table body as a fallback when no visible header cells are available.
  - * Improves table header column count logic
  - Ensures accurate calculation of visible header columns
  - when no headers are explicitly visible, by selecting the
  - first visible row instead of relying on potentially
  - invisible rows. This fixes an issue where the column
  - count would be incorrectly reported as zero.
- Improves print view and sort icon layering (#524)
  - * Improves print view and sort icon layering
  - Improves print view by hiding the bookmarks container, preventing it from being printed.
  - Reduces the z-index of the bookmarks container. This prevents it from overlapping with other elements on the page.
  - * The z-index was likely added previously to ensure proper layering,
  - but it's no longer needed and can be safely removed.
  - * Adds `!important` to the `display: none` rule for specific elements
  - This ensures that these elements are reliably hidden, even if other styles try to override the `display` property.

## 0.32.4    *2025-06-11*

- Added a check for the redactor editor that stops an error from occuring when a class is added to Knacks redactor editor (#518)
- Removed obsolete dead code in getKtlAddOnsDiv.
- Modified addBulkOpsButtons to use getKtlAddOnsDiv.
- Improves bookmark context menu and state handling (#517)
  - * Improves bookmark context menu and state handling
  - Adds "Open in New Tab" and "Open in New Window" options to the bookmark context menu for enhanced usability.
  - Simplifies bookmark minimized state management by directly storing the state ('min' or 'max') in local storage instead of the entire user preferences object.
  - * Adds accessibility labels to bookmark menu items
  - Improves accessibility by adding aria-label attributes to the bookmark menu items (Rename, Delete, Open in New Tab, Open in New Window).
  - This provides screen readers with more information about the purpose of each menu item.
- _dnd - Adding support for apply button.
  - Add the Apply Reorder button, with optional label.
  - Added checkAndProcessBlanks to automatically fill the blank sort values.
  - Now using getKtlAddOnsDiv

## 0.32.3    *2025-06-04*

- Added support for Linux kiosks with dual monitor setup.
  - Now each app instance has its own heartbeat and timeout.
- Fixed addCheckboxesToTable:  now checks 1st row for existing checkbox
  - instead of header, since master checkbox may not exist in some user-specific scenarios.
  - Ex: unanimity check lists.
  - waitViewDataReady now returns view data instead of nothing.
- Always bypass cache in local dev mode.
- Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
- Improves bookmark display and minimize functionality (#515)
  - * Improves bookmark display and minimize functionality
  - Enhances the bookmark display with styling improvements and an interactive bookmark icon.
  - The bookmark list can now be re-opened by clicking on the bookmark icon, improving the user experience. Updates minimize functionality to remove the minimize button when the list is minimized, and it's re-rendered when maximized.
  - * Removed whitespace from code
  - * Removed duplicate padding
  - * Improves bookmark icon accessibility
  - Enhances the bookmark icon by adding descriptive titles and aria-labels that dynamically update based on the minimized state.
  - This improves accessibility for users who rely on screen readers or other assistive technologies, providing a better understanding of the bookmark icon's function.
  - * Improved/Simplified the add bookmarks list function
- Removed obsolete files.
- Fixed algorithm to find last tag
  - and ignore all commits having comment: Update CHANGELOG.md

## 0.32.2 *2025-05-30*

-   \_ask is now supported without parameters.
    -   In this case, it applies the default confirmation popup to all action links in the view.
-   Removed cache-busting dummy param when using code on local server.
    -   Otherwise we need to re-open the file each time we refresh. The param was not useful in this case anyways.
-   Updates cell title for nested spans (\#513)
    -   Updates cell title for nested spans
    -   Updates the title attribute for table cells containing nested spans, specifically addressing connection fields.
    -   Instead of using the entire text content of the outer span, it now extracts and joins the text from the direct child spans, separated by commas if multiple spans are present. This ensures a more accurate and relevant title for connection fields.
    -   Adjusted code to work for both types of td
    -   Minor simplification
    -   Improve variable names
-   Updated the server to ignore the ? cache-busting parameter.

## 0.32.1 *2025-05-25*

-   selectOption has been modified to accept ktlOther for user input text.
    -   Updated KTL Version selector to use selectOption.
    -   This solves the problem of not being able to use the virtual keyboard in kiosk devices to switch between KTL versions.
-   Added date value to bypass cache and force reloading latest code.

## 0.32.0 *2025-05-25*

-   Improvements / Better support of Radio Buttons and Checkboxes in KtlCond (\#510)
    -   Enhance event handling for keyup and click on selector; improve checkbox logic in Ktl function.
-   New keyword: \_ask to confirm before clicking on an action link.
    -   Added the new selectOption popup for multiple selections.
    -   Works with \_ask but can also be used in other contexts.
-   Fixed bookmarks list position,
    -   sometimes pushed to the right, instead of left-aligned,
-   Updates-to-ktlBookmarks (\#509)
    -   Moved fixed styles to CSS
    -   Enhance bookmarks feature with minimized state and context menu options
    -   Enhances bookmarks with minimize and context menu
    -   Improves the bookmark functionality by adding a minimize/expand feature with persistent state, and a context menu for renaming and deleting bookmarks.
    -   The minimize feature allows users to reduce the visual footprint of the bookmarks, while the context menu provides quick access to edit and delete functions, improving the overall user experience.
    -   Refactors bookmark initialization and state
    -   Simplifies bookmark initialization by consolidating logic for fetching bookmark configurations and applying them to the UI.
    -   It improves bookmark minimization by ensuring the minimized state is properly managed and persisted across sessions, regardless of whether the minimize feature is enabled. It also streamlines the process of adding bookmark buttons.
    -   Improves menu removal logic

## 0.31.3 *2025-05-21*

-   Added class ktlIsMobile to body.
-   Fixed issue \#507: \_cfv added support for search views.
    -   Added findViewsByType utility to find all views by type, including reports: charts, pivot tables, etc.

## 0.31.2 *2025-05-20*

-   Bookmarks \_bm - added support for ktlRoles.
    -   Changed all classes to start by ktl and use camel case like all others.

## 0.31.1 *2025-05-20*

-   Bookmarks feature - added class for header
    -   No more icon for page if feature is not enabled.
    -   Renamed classes to match existing KTL naming convention.
-   Update for 0.31.0
-   Changelogs for 0.31.0
-   Add Bookmarks \_bm improvements.
    -   Added keyword parameter to support top or bottom positioning of bookmark container.
    -   Default is bottom of page.
-   New keywords: \_bm for Add Bookmarks
    -   Several improvements and fixes regarding User Preferences: real-time updates and backwards message acknowledgement.
    -   Prevent sending messages to iFrameWnd when it's the destination but doesn't exists.
-   Get rid of LF vs CRLF warning in GitHub.
    -   Now always Unix-Style LF only.
    -   Note to all developers on Window...
    -   Run these two lines in a cmd.exe prompt:
    -   git config --global core.autocrlf false
    -   git config --global core.eol lf
-   Changes for 0.30.13
-   Feature / Dropdown Select All (\#505)
    -   Feature / Dropdown Select All
    -   Add persistent form support.
-   Fixed issue \#501, \_hc causing shift in headers.
    -   Involved a fix in the hideTableColumns function, where the field ID and headers must be processed separately.
-   refreshView - added support for login pages.

## 0.30.13 *2025-05-09*

-   Filters column headers by text content, when headers contain HTML elements. (\#504)
    -   Filters column headers by text content.
    -   Updates the column header filtering logic to handle HTML tags within the header text.
    -   It now correctly identifies the column by comparing the plain text content, improving accuracy when headers contain HTML elements.
    -   Removed Logs
-   Fixed extractJQuerySelector when jQuery string ends with anything else than closing parentheses.
    -   This happens with .
    -   Fixed validateKtlCond when used with checkboxes in a form.
-   Add title attrinute to \_trk which allows you to hover over the td and display the text. Styling left as default so users can apply there own styles in their CSS (\#503)
    -   Add title attrinute to \_trk which allows you to hover over the td and display the text. Styling left as default so users can apply there own styles in their CSS
    -   Added a check to make sure we don't keep adding titles if one already exists
-   ChangeLog generator now automatically finds most recent tag.
-   Automatic creation of the CHANGELOG.md file using Javascript script.
-   Cleanup in GIT ignored files and folders.

## 0.30.12 *2025-04-29*

-   Issue \#495 modal flickering.

## 0.30.11 *2025-04-26*

-   Added pageIntegrityWatchdogEnabled flag
    -   Fixed several bugs that caused inifinite refresh and a crash in Firefox.

## 0.30.7 *2025-04-24*

-   Added new feature: Page Integrity Monitor
-   Minor refactor and deleted obsolete function.
-   Added support for User Filters in Calendars
    -   Discussion \#492 about \_dr - added value in dropdown.
-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fixed issue \#458 about \_hf in modals
    -   Fixed multiple triggers of KTL.preprocessView.

## 0.30.6 *2025-04-22*

-   Fixed issue \#491 about Modal not showing.
    -   Introduced by accident, while fixing issue \#458.

## 0.30.5 *2025-04-20*

-   Fixed issue \#458 about \_hf in modals
    -   Fixed multiple triggers of KTL.preprocessView.
-   Fixed issue \#488 about Pivot Report views and \_nf
-   Fix issue \#460 about \_trk and inconsistent line heights.

## 0.30.4 *2025-04-16*

-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fixed issue \#485 about Linked Filters
    -   No more need to enable User Filters.
-   Fixed the regex to extract numbers and Number characters from the field (\#484)
    -   Fixed the regex to extract numbers and Number characters from the field
    -   It will now work with custom suffixes & prefixes
    -   Fixed styles if H1 or H2 in details Views
-   Fixed \_loh doesnt redirect if logout caused by an inactivity timeout \#479
-   \_arh, added support for Delete operations, issue \#463
-   Fixed issue \#463 - not recording from Add forms
-   Minor code and comments cleanup in \_req.

## 0.30.2 *2025-04-01*

-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fixe for reports (\#478)
    -   Fixe for reports
    -   Formatting
-   Added replacements to view ttip keywords (\#469)
    -   Added replacements to view ttip keywords
    -   Formatting

## 0.30.1 *2025-04-01*

-   Added auto-login from encrypted cloud credentials.

## 0.30.0 *2025-03-18*

-   Support auto login from IoT server credentials
    -   instead of local storage.

## 0.29.17 *2025-03-18*

-   Added some replacements for html tags to ttip: (\#468)
    -   Added some replacements for html tags to ttip:
    -   '{br}': '',
    -   '{n}': '\\n',
    -   '{strong}': '',
    -   '{/strong}': '',
    -   '{em}': '',
    -   '{/em}': '',
    -   '{hr}': '',
    -   Remove \\n as it didn't work
-   Fixed \_kn to be scene-wide

## 0.29.16 *2025-03-11*

-   PR\#461
-   Added extra check for view.model (\#461)

## 0.29.15 *2025-03-10*

-   Fixed inactive forceVirtualKeyboard.

## 0.29.14 *2025-02-27*

-   Fixed PR\#457
-   Added Date Object case to knAPI and convertDateTimeToIso (\#457)
    -   Added date object case to converDateTimeToIso
    -   Fix: removed command from code
-   change fieldText to let (\#455)
-   Fixed \_cpytxt to support links to another page in dest cell.
-   Force view refresh after downloading user/public filters.

## 0.29.13 *2025-02-14*

-   Updated User and Public Filters' button coloring method.
    -   for more contrast and easier to spot the active one.
-   Updated Universal Search to improve error handling and fix an error that occurred (\#448)
    -   Updated Universal Search to improve error handling and fix an error that occurred
    -   Added default param to isObject

## 0.29.12 *2025-02-11*

-   Introduced Epiry optional variable to \_rlv (\#447)
    -   Introduced Epiry optional variable to \_rlv
    -   Made updates to code replacing var where possible.
    -   Update Universal search to include menu links and tasks emails
-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fixed issue \#439
    -   Added calendar support to auto-refresh.
-   Remove keywords from the early return so it will work on views without keywords (\#446)
-   Fixed issue \#442

## 0.29.11 *2025-02-08*

-   Changed from using Knack render() to manipulate the colspan directly (\#445)
    -   Changed from using Knack render() to manipulate the colspan directly
    -   This is an issue with grids and groupings.
    -   Removed consol.log
    -   Change condition for when the colspan for groups gets updated
-   Fixed crash with virtual keyboard focus on search input.

## 0.29.10 *2025-02-04*

-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fix/_req and non required fields (\#441)
    -   Refactor input event handling and visibility class management in KTL.js
    -   Updated comments
    -   Tidy up of some code in \_req
    -   A few More updates to code. Imprved cacheing Jquery objects
    -   Removed \$ from variable names
    -   Removed an unused variable
    -   removed unused \$
    -   The commit fixes:
    -   checkboxes and radios are now requiied
    -   hiden fields are now triggering the submiit update when based on an unrequired field as wel as a required field
    -   A few edits to css
    -   Fixed Early Return

## 0.29.9 *2025-01-29*

-   Virtual KB fix: now properly supports number fields.
    -   Optimized lib loading.
-   Fixed virtualKeyboard and forceVirtualKeyboard flags.
-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   \_ah bug fix when using quotes/double quotes in headers
    -   Fixed extractNumericValue error: added defensive coding
-   Fix / IOS-Mobile Decimal Number in Native Virtual Keybopard (\#437)
-   Fixed re-submit of a form for Ivan Jovanovic
    -   He uses the Confirmation Message's HTML to change the Submit to a Back button that goes back in History. This caused a re-submitting of the form.

## 0.29.8 *2025-01-21*

-   Fixed issue \#386
    -   \_cpyfrom not copying number fields.

## 0.29.7 *2025-01-09*

-   Updated Character Count Missed Commit (\#430)

## 0.29.6 *2025-01-09*

-   Added the cache-busting parameter.
-   Added new feature Character limit (\#428)
    -   Added new feature Character limit
    -   \_cl=characters, max or recomended
    -   \_cl=25, max
    -   \_cl=50, rec
    -   Tidy up
    -   Add character count to ktl
    -   \_cc
    -   Tidy up and added css
-   \_dpf - added implementation for h and hh parameters.
-   Fixed fixTableRowsAlignment group alignment.
    -   findEmails now only shows include/exclude when something to show.
-   Fixed issue \#422, double \_arh history entries
    -   Updated findEmails to use comma-separated email list and minus prefix for exclusion.
-   Fixed issue - opening an edit form creates 2 record histories.
    -   As reported by Ivan Jovanovic in email received on Dec 12, 2024.
    -   Was caused by viewData_arh (now viewData) not being re-initialized on every view render. Data was kept form previous view (same view ID).
-   Auto-Selection now works in Paragraph Text also.
-   Partially fixed issue \#422 \_arh getNestedValue
    -   Added defensive coding in viewHasSummary.
-   Fix/req-field-keywords-independant-of-view-keywords (\#423)
    -   req field keywords will now work even if a view keyword is not on the view
    -   Updates to filedIsRequired function make sure fields and view keywords are processed separatly then together
    -   Fixed so that code will work if no options are passed into keyword
    -   Fix/If no keywords don't process fields

## 0.29.5 *2024-12-05*

-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fixced issue \#420
-   Fixed grid groups having colspan = 0 and added a triger to the open of the view (\#418)
    -   Fixed grid groups having colspan = 0 and added a triger to the open of the view
    -   Minor update
-   \_cfv now supports form fields, but only read-only.
-   \_lf fixed Per page and pagination issue when removing filter
    -   From Carl's message in Slack and Loom video.

## 0.29.4 *2024-11-27*

-   Proper init: let isoTime = '00:00:00';
-   Fixed issue \#416
    -   Added convertDateTimeToIso just before API call.
    -   To prevent having to change all code.
-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Made description selector more specific (\#413)
-   \_hf and hideUnhideValidateKtlCond bug fixes.
-   Fix ktlAddonsdiv & addBulkOpsButtons when a view has \_hsv (\#411)
    -   Fix ktlAddonsdiv & addBulkOpsButtons when a view has \_hsv
    -   Refactored code to use const & let
    -   Added a new function to ktl.core checkIfViewHasKeyword
    -   Fixed the crashing issue if a view didn't have any keywords
    -   Fixed \_hv & rvto us hasRoleAccess
    -   The function still used matchUserRoles and was failing on !Developer
    -   Updated Universal Search to include View Name
    -   Fixed an Error
    -   Minor fix for Universal Search

## 0.29.3 *2024-11-20*

-   Fixed jagged details view render.
    -   Fixed lockPublicFiltersButton undefined.
-   Added dummy date parameter to bypass cache.
-   If a view is hidden on open renderSignatures() (\#410)
    -   If a view is hidden on open renderSignatures()
    -   When a view is hidden signature boxes were not rendering as Knack check if visible
    -   Removed Comment
-   Converted to async/await.
-   userFilters update for issue \#409
    -   Added flags to modify the control buttons behavior:
    -   hide the buttons when no filter active
    -   use monochrome or no background color
-   \_bcrm: No field parameters: Use all form's input fields
    -   Make scan buttons same height as input fields.
-   Added \_bcrm for barcodeReaderManual
    -   Automatic QR code reader camera popup and close.
-   Added exponential backoff retry delay upon API call error.

## 0.29.2 *2024-11-12*

-   Fixed findKeyWithValueInObject
-   Hot fix for undefined mixpanel_track.
    -   Now using Knack.app.attributes.
-   Fixed bug where summaries were not shown.
    -   ...due to processing before scene made visible.
    -   Added temporary observer debug code to detect DOM changes.
-   Fixed modal pages conflict with Kiosk buttons.
    -   Removed duplicated menus and no more kiosk buttons in modal pages.
-   Fixed modal pages with Kiosk buttons.
-   Added hover color for dynamic table in Account Logs.
-   Fixed builder url (\#405)
-   Update-Universal-Search (\#402)
    -   Update checkTextContent
    -   Updated Universal Search to include email recipients and builder link
    -   Fix \_vrh Adding icon to table groups

## 0.29.0 *2024-10-31*

-   Hearbeat is now configurable via heartbeatIntervalDelay
    -   and ktl.wndMsg.setCfg
    -   One minute is still the default, as before.
    -   Added appIsIdle flag for future use.
-   Few fixes
-   Migrated universalSearch to core.
-   Migrated tablesAndFieldCounts to core.
-   Migrated countKeywords to core.
-   Migrated keywordsToString to core.
-   Migrated findAllKeywords to core.
-   Renamed to ktlFindEmails.
-   Standardized global functions with ktl prefix
-   Changed indexes to IDs
-   Added findEmails utility.
-   Improved formatting of output.

## 0.28.8 *2024-10-27*

-   Fix for when no params added to \_parent (\#401)
-   Added a new helper function getTableRows (\#399)
    -   Added a new helper function getTableRows
    -   We use this a lot throughout many apps and I think it's a good addition to the KTL
    -   Minor improvement
-   Persistent Forms: improved Date/Time and Timer support.
-   Major update in the process again.
    -   Now properly handle all use cases.
-   Experimenting with optimization.
-   Added flag fixRows in hideColumns and removeColumns
-   Alittle refactor of \_copy & SelectElementContents (\#397)
    -   Made sure that the hsv shrink link works with copy
-   Modified fixTableRowsAlignment to use async/await
    -   Other fixed in summaryPostProcessing.
-   Merge branch 'fix/view-jitter-due-to-summary' into dev
-   Major update and fixes on processing
    -   By fixing issue \#348 we now had severe flashing and jittering of views.
    -   Now all is properly synchronized.
    -   Also fixed Ctrl+click on header checkboxes in Search views.
    -   Just a bunch of logs to debug.
-   Extra searches and changed name (\#396)
-   objectsAndFieldCounts - minor refactor.
-   Added searchTextInViewsAndInputs
    -   Thanks to Craig Winnall !
-   Auto select last keyword in Search
-   KTL Dev Tools improvements
    -   Ctrl+Shift+F to open KTL Dev Tools and Search
    -   Escape key to hide popups in sequence
    -   Search remembers last string
    -   Better compact layout of search results if a keyword
-   Improved findAllKeywords
    -   If search string is a keyword, it will give an optimized results.
    -   Also fixed whole word to find exact match.
-   objectsAndFieldCounts now includes connections.
-   Added close modal trigger to the form submit as well as the click close modal (\#391)
-   objectsAndFieldCounts: improved output to single string.
-   Added utility: objectsAndFieldCounts
    -   to see how many objects and number of fields in each, in asc order.

## 0.28.7 *2024-10-08*

-   Added addThousandsSeparators
    -   for manual number formatting.
    -   Fixed developerPopupTool close.
-   Fixed addButton, bad ID.
    -   Prevent spaces in IDs.
-   \_cpyfrom now synchronous with multi-instances
-   \_cpyfrom - fixed random button order.
    -   now order follows keyword order.
-   \_cpyfrom now with multiple instances
    -   Fixed issue \#386
    -   Added refresh on dest view.
    -   Improved getCleanId.
    -   Fixed issue \#381
-   Fixed dropdown on change event.
-   Added a param group to hsv [save, false] you could also pass true here but that is the default behaviour. (\#383)
    -   This allows view to stay closed if the user moves away from the page and comes back.
-   Fixed issue \#379. Title must be an exact match.
-   Fixed issue \#379. Can now disable and ignore SW Updates
-   Fixed noFilteringInReport: roles and fields now ok.
    -   Would ignore field keywords if view didn't have one.
-   Fixed issue \#378
-   Fixed issue \#376
    -   Better support for date time fields in Persistent Forms.
    -   Minor refactor.
-   Little refactor of saveFormData.

## 0.28.6 *2024-09-28*

-   Fix tables within td (\#374)
    -   Fix tables within td
    -   Minor change
-   Fix/ktlTarget-Brackets-inside-a-Jquery-object (\#373)
    -   Updated parseKeywordParamGroups to check for square brackets inside a jquery object
    -   Added extra check for Matching Quotes to make sure we are not matching ) inside the jqery object i.e. :has()
    -   Remove console.log
    -   Removed some comments
    -   Changed a Comment
    -   Fixed another comment
-   Fixed on change event for date and time fields. Issue \#349
    -   Also fixed findLongestWord useage in ktlOnFieldValueChanged.
-   Fixed issue \#349
    -   Added defensive coding in barcodeGenerator \_bcg.
-   Fixed disabled links and fields that remained clickable.
    -   despite their grayed-out color.
-   Fixed autocomplete error on close.
-   Fixed auto complete \_ac that caused opening on scene render.
    -   Autocomplete dropdown would open if focus was set on a field with autocomplete on a scene render.
-   Fixed Issue \#370. Modals now support \_rlv
    -   Also modified \_rlv behavior: no params means all fields.
-   \_afs: added anti looping protection
-   Updated \_afs and \_afsg to use field labels instead of IDs.

## 0.28.5 *2024-09-20*

-   Fixed hscGlobal flag priority. Fixed \_hsc in Search views.
-   Merge branch 'feature/sitcky-header&column-report-table' into dev
-   \_afsg - fixed auto close
-   Fixed \_bcg: skip empty text instead of exception.
    -   Fixed findKeyWithValueInObject to ignore leading and trailing spaces.
-   Added extract numeric value from numeric field types in details view (\#369)
    -   Added extract numeric value from numeric field types in details view
    -   Moved applyColorIzationToCells outside the extract numric check
-   \_ttip now supports field IDs in n views.
    -   Fixed tooltipIconPosition to inline-flex for bulk checkboxes.
    -   Simplified some code using getFieldIdFromLabel.
-   Disabled Scene References in dev info popup.
    -   and minor refactor on jqs syntax.
-   Bulk Ops improvements on error handling.
    -   Can now see the exact cause of a failure.
    -   Only one alert popup per operation, not per record.
-   Fixed undefined result_model
    -   and Blank spaces cleanup.
-   Added New viewType to \_hsv (\#365)
    -   Added new menu View
    -   Refactor CSS and JS for better responsiveness
    -   Set max-width to fit-content in KTL.css thiallows menu views to not stretch to the width of the screen if on 1 button or when there is little content
    -   Add min-width to hiddenSection in KTL.js this makes the hidden section wider than the button if the content is too smal
    -   Removed console log and removed bad CSS max-width fit-content
    -   Fixed an issue with details in a modal the scroll bars show while shrinking and growing
    -   Removed unused CSS from hideShowSection
    -   Removed the margin right -10px from the section if the view already has section. This stops Details views section being bigger than the view
-   Merge branch 'fix/corrupted-summaries-with-bulk-ops' into dev
-   Added temporary flag for debugging.
-   Fixed Summary errors related to issue \#348
    -   Big refactor to have better control over sequence between interacting features: bulk ops, summaries, \_hc and ktlProcessKeywords.
    -   Fixed \_nf bug.
    -   Added ktlCtxPostRender to support Search views.
    -   Renamed to ktlPostRender.
    -   New class ktlKioskModalPage to keep modals within screen.
-   Fixed issue \#363
    -   And renamed kw like all others.
-   Fixed issue \#339
-   Fixed issue \#351 when \_ha on multiple lines.
-   Reusing sth and stc code
-   \_nf small improvement: prevent briefly seeing the first field.
    -   Now, the whole filters section is hidden until processed.
-   Feature/no filtering report view support (\#360)
    -   TODO -\> Feature / Sticky Header & Column Report Support
    -   Feature / No Filtering Report View Support
    -   Fix race condition
-   Added Calendar to \_hsv (\#356)
    -   Added Calendar to \_hsv
    -   Removed Console.log
-   Minor comment update.
-   Remove the little pointer every time.
    -   Currently, it was showing after a page refresh.
-   Feature / Added Keywords Description and Scene References in DevInfo Popover (\#358)
-   Added exception addLongClickListener for input, textarea, signature and rich text editor (\#357)
-   Feature / Remove Connection Picker (\#352)
    -   Feature / Remove Connection Picker
    -   Code cleaning
-   Fixed remove columns for when a column does not have a field.key (\#350)
    -   Fixed remove columns for when a column does not have a field.key
    -   Some minor updates
-   Feature / Sticky Header & Column Report Support

## 0.28.4 *2024-08-31*

-   Merge branch 'fix/barcode-reading' into dev
-   Several improvements and fixes on barcode reading code.
-   Removed return that prevented ktlProcessKeywords.
-   Testing inter-character timings.
-   Fix to developerPopupTool, return nothing instead of first element.
-   More fixes to the developerPopupTool.
    -   Fixed acctNameFld. Now one field instead of First Name and Last Name.
-   Merge branch 'fix/performance-issues' into dev
-   Optimized developerPopupTool.
    -   No more debounce needed.
    -   No more long tasks and bad performance on large pages.
-   Fixed hideFields \_hf keyword when multi-instances.
    -   Added ktlBottomExtraSpaces when using Virtual Keyboard.
    -   Removed unused processBarcode function.
-   Added support for CSS file as a link instead of embedded code.
    -   Also check if local file exists before replacing.
-   Implemented CSS file support from local server.
-   added user_roles field type (\#343)
-   More improvement on developerPopupTool performance.
-   Further developerPopupTool performance improvements.
-   Fixed the Ctrl+Shirt showPopOver in dense pages
    -   by adding a debounce of 200ms.
-   Added cool function findAllReferencesToThisScene
    -   Otherwise, it's impossible to find out where a page is referenced in the app.

## 0.28.3 *2024-08-19*

-   Fixed addKeyToBarcode issues.
    -   Added barcodePrefixes for global prefixes on top of per keyword.
    -   Now selected text is not overwritten.
    -   Fixed typo: barcore.

## 0.28.2 *2024-08-16*

-   Barcode reading refactor.
    -   \_cfv beginning of form support. Unfinished.
-   Fixed searchDropdown to use default first form in page is no viewID supplied.
-   Fixed Status Monitoring update of online status.

## 0.28.1 *2024-08-14*

-   Improved Search views support.
-   Fixed issue \#338 with getAllFieldsWithKeywordsInView
    -   Fixed focus bug in Kiosk mode, using bad target.
    -   Fixed showHiddenElemements and hideHiddenElemements.
-   Fixed bad performance on headerAlignment.
    -   Due to CSS causing too many rendering recalculations.
-   Fixed bad ktlProcessKeywords calls with Search views.
-   \_cfv now works with Search views.
    -   Fixed ktlFlashRate: now only the digit, without s unit.
-   Major improvement on performance. KW now applies only once.
    -   Using callStack and postRender to detect caller function before calling ktlProcessKeywords.
    -   Fixed formattedDateTime bug.
    -   Fixed \_zoom bug with viewRefresh, now smoother.
-   Code cleanup.
-   Big improvement with Summary.
    -   Now processes kw only once.
-   Improved fixSummaryRows. Now a Promise.
    -   Move readSummaryValues to on record render event for early reading, before keywords processing.
-   Fixed \_cpytxt to support one or more spans. Use last.
    -   Fixed isArraysContainSameElements when one of the arrays is undefined.

## 0.28.0 *2024-08-01*

-   Changed \_sfdv to \_sfv
-   \_sdfv now has option between sequential searches and direct values input.
    -   Added hasRecordIdFormat to validate rec IDs.
    -   Fixed bug in chznSearchInput.
-   Fixed rating field types to prevent forced numeric conversion.
-   Big cleanup in fieldConvertNumToTel
    -   now renamed to fieldSetAsNumeric.
    -   Uses simple code to set inputmode attribute to numeric.
    -   No more complex copy input field code.
-   \_sdfv - added support for multi-selection dropdowns.
    -   Fixed and improved searchDropdown old code.
-   \_sdfv added support to more field types.
    -   Improved field keywords for faster responsiveness, like \_uc, \_int and \_num.
-   New keyword: \_sfdv setFormDefaultValues

## 0.27.11 *2024-07-31*

-   \_cfdt - fixed undefined value bugs.
-   \_cfdt now uses same offset syntax as Record History
    -   with d, h and m suffixes.
    -   Also started code to support rangeField per record, but not finished.
-   \_cfdt - calculateFutureDateTime: added support for Gris and Searches.
-   Fixed \_cfdt bug.
-   New keyword: \_cfdt for calculateFutureDateTime
    -   Used in a form to set the date and time in a field to a future DT.
    -   computeFutureDateTime: added iso format support.
-   \_cfv several fixes with summaries bad sync.
    -   numericFieldTypes now includes ratings.
    -   Fixes related to command and period separators.
