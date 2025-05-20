# Knack Toolkit Library Changelog


## 0.31.2    *2025-05-20*

- Bookmarks _bm - added support for ktlRoles.
  - Changed all classes to start by ktl and use camel case like all others.

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
-   Update CHANGELOG.md
-   Changes for 0.30.13
-   Feature / Dropdown Select All (\#505)
    -   Feature / Dropdown Select All
    -   Add persistent form support.
-   Fixed issue \#501, \_hc causing shift in headers.
    -   Involved a fix in the hideTableColumns function, where the field ID and headers must be processed separately.
-   refreshView - added support for login pages.

## 0.30.13 *2025-05-09*

-   V-bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
-   Changed from using Knack render() to manipulate the colspan directly (\#445)
    -   Changed from using Knack render() to manipulate the colspan directly
    -   This is an issue with grids and groupings.
    -   Removed consol.log
    -   Change condition for when the colspan for groups gets updated
-   Fixed crash with virtual keyboard focus on search input.

## 0.29.10 *2025-02-04*

-   V-bump
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

-   V-bump
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

-   V-bump
-   Fixed issue \#386
    -   \_cpyfrom not copying number fields.

## 0.29.7 *2025-01-09*

-   V-bump
-   Updated Character Count Missed Commit (\#430)

## 0.29.6 *2025-01-09*

-   V-bump
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

-   V-bump
-   Merge branch 'dev' of https://github.com/cortexrd/Knack-Toolkit-Library into dev
-   Fixced issue \#420
-   Fixed grid groups having colspan = 0 and added a triger to the open of the view (\#418)
    -   Fixed grid groups having colspan = 0 and added a triger to the open of the view
    -   Minor update
-   \_cfv now supports form fields, but only read-only.
-   \_lf fixed Per page and pagination issue when removing filter
    -   From Carl's message in Slack and Loom video.

## 0.29.4 *2024-11-27*

-   V-bump
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

-   V-Bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
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

-   V-bump
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
-   V-bump
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

-   V-bump
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

-   V-bump and improved Search views support.
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

-   V-bump
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
