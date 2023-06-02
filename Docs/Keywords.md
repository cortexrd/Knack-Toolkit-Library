Last updated: June 2, 2023

# Contents

[Keywords List](#keywords-list)

[Advanced Keywords Setup](#advanced-keywords-setup)

# Keywords List

In alphabetical order.

## \_al

Auto-Login, with AES encrypted email/pw stored in localStorage. This must be in the view title of the **login page**. Used to automate boot-up of Kiosks, Dashboards or any unattended devices. A first-time setup procedure must be done manually, by entering an encryption key then the email/pw information. This is done for each new device and can be bypassed if desired.

## \_ar=n

Auto Refresh view. The view will be refreshed periodically every “*n*” seconds. If no or invalid parameter is given, the default is 60 seconds. It is possible to manually start/stop the process using the autoRefresh function.

## \_cfv=[params1], [params2]

Colorize Field by Value. Can be used with grids and lists. Used to change the color of the text and background of a cell, based on its value. It is also possible to set the following styles: font weight (bold, extrabold , 700), underline and italic. It is also possible to set the style to propagate across the whole row. The colors support named values (ex: red, purple) or hex values with optional transparency (ex: \#ff08, or \#ffff0080 for 50% transparent yellow).

The parameters syntax is as follows:

\_cfv= [operator, value, textColor, backgroundColor, fontWeight, options]

operator (required):

-   eq (equals)
-   neq (not equals)
-   has (contains text)
-   sw (starts with)
-   ew (ends with)
-   gt (greater than)
-   gte (greater than or equal to)
-   lt (less than)
-   lte (less than or equal to)

value (required): Any textual or numeric value. For “empty” string, leave two consecutive commas.

textColor (required): any standard “named colors” or hex values starting with \# and has 3, 4, 6, or 8 digits is supported.

backgroundColor (optional): Same as above. Will colorize the cell or only the text if the “t” option is included.

fontWeight (optional): Any named value like “bold”, or “lighter”, or a numeric values like 700. Omit or leave empty for default.

options (optional): Possible values are

u - underline

i - italic

t - text only

p - propagate style to whole row

Example: \_cfv=[neq,,,red,,iu], [gte,100, yellow,\#00F9]

The first group between square brackets will set the background in red when the value is not blank and set the text style to default weight, italics and underlined. The second one will set the text color to yellow and the background in blue at 56.3 % transparency, when the value is greater than or equal to 100.

Additional notes:

-   The square brackets are optional if you have only one group of parameters
-   Be careful to avoid conflicting conditions since they will give unpredictable results.
-   The group of parameters are applied from left to right, so that if you have overlapping conditions, the last one will have precedence.
-   Transparency is useful to combine the visual effects of various colors
-   This keyword must be used in the field’s description. It will take effect in all grids and lists where used.
-   This keyword can also be used in the view title or description.
-   Using both in the view and in the field is supported but need extra care to avoid conflicting conditions. When using both, the field keyword has precedence over the view’s.

## \_dr=rowsNumber

Displayed Records. Sets the initial number of rows in a table, allowing to go beyond the maximum value of 100 in the Builder. This is applied when the page is first opened.

## \_dtp

Add Date/Time Picker to a table. The table **must have a Date/Time field**, and the first one found from the left will be used. Six new fields will appear at the top of your table view: **From**, **To** and periods as **Monthly**, **Weekly**, and **Daily**. Depending on the active period, when you change From, the To field will automatically update itself accordingly, and the view will be filtered in real-time. On the other hand, if you change the To date, the From will not be affected, leaving you more flexibility. The focus is conveniently placed on the last field used so you can use the up/down arrows to scroll quickly through months and visualize data. This is also compatible with additional filter fields, provided that the AND operator is used. Once you have a filter that you like, it is also possible to save it as a [User Filter](#user-filters).

## \_hc=colHeader1, colHeader2

Hidden Columns. To hide a grid’s columns, based on the header’s exact text. The columns are only hidden but still exist in DOM. The visibility can be reversed on the fly with a bit of extra code. Hiding a column is useful to save real-estate or hide its data, while maintaining API calls capability or allow filtering on all fields.

## \_hf=fieldName1, fieldName2

Hidden Fields. To hide fields in a view, based on their exact names. Typically used with utility fields that don’t need to be visible.

## \_ht

Hidden view Title. Used to save real-estate while keeping the title in the Builder.

## \_hv

Hidden View. Moves the view away from screen but kept in DOM. Used to save real-estate, while maintaining API calls and automated search capabilities.

## \_int

Integer characters only (0-9). This will prevent entering any other characters even if the field type is short text. Validation is done in real time with enforceNumeric.

## \_ip

Enforce IP format, with automatic colons and hex char real-time validation (not yet implemented).

## \_kb

Kiosk add Back button.

## \_kd

Kiosk add Done button.

## \_km

Triggers the Kiosk mode for that page. This only applies for any role other than Developer. For the accounts having the Developer role, it is possible to switch back and forth between the Normal and Kiosk modes by clicking on the version info bar, provided that it is accessible.

## \_kr

Kiosk add Refresh button. For Kiosk mode only, when there’s no keyboard/mouse. When this keyword is used, any menu on the page will be moved next to it to save space.

## \_lf= vTitle1,vTitle2

Linked Filters. Add this to the main “controlling” view, and all other views will apply the same filtering pattern. The number of records per page, sort column+order and searched text will also apply, if the view allows it.

## \_lub and \_lud

Last Updated By and Last Updated Date. Both must be used together. \_lud is a date/time field and \_lub is a connection to an account. When this pair of fields are included in a table that has Inline Editing enabled, each time the user modifies **any** cell, an API call will automatically update these two values with the current date/time and the logged-in account.

## \_mc=colHeader

Match Color of the whole row to the cell at a specific column in a table. Can be used in conjunction with the \_qt feature to use its colors.

## \_nf=field_x, field_y, field_z

No Filtering. Will prevent filtering on these fields, even if they are visible in the table.

## \_ni=colHeader1, colHeader2

No Inline editing on columns with specified headers. If no parameter is supplied, it will apply to the whole table. Disables inline editing for the user, even if enabled in the Builder. Enabling inline editing is required for API calls in tables, but not always desirable at the user interface. This provides a solution.

Notes:

-   It is possible to allow inline editing for a specific field by adding an exclamation mark as the first character. Ex: **\_ni=!Phone Number, !Address** will disable inline editing for the whole grid, except for the columns with headers Phone Number and Address.
-   About \_ni security: use this keyword with caution as it only disables the user interface. Someone with coding skills and bad intentions could still modify the data using commands in the console.

## \_num

Numeric characters only, including decimal dot. This will prevent entering any other characters even if the field type is short text. Validation is done in real time with enforceNumeric.

## \_qt=bgColorTrue,bgColorFalse

Quick Toggle of Boolean fields in a Table or Search view. Will queue all clicks on cells with a Yes/No type of fields and will invert their state in a background processing loop. Optional true/false/pending colors can be specified, compatible with all web formats like \#rrggbbaa, \#rgba and named colors (ex: darkolivegreen). The colors are applied in order of precedence, per field, per view or app-wide, respectively and as desired. To override the app-wide default colors, see quickToggleParams for details in the [KTL_Defaults.js](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Defaults.js) file.

## \_rc=colHeader1, colHeader2

Removed Columns. To delete de columns based on the header’s exact text. This will delete them from the table **and** the DOM. Like \_hc, removing a column will maintain API calls capability and allow filtering on its field.

This option is “somewhat” a bit more secure than \_hc since it’s not as easy to peek at data from the browser’s console. Though someone could intercept the data *before* it’s been removed, i.e. while it’s being sent by the server, so keep this in mind.

## \_rvd=vConfTitle,vTitle1,vTitle2

Refresh Views after a Drag’n Drop. Used in a Calendar view to confirm that a drag’n drop operation has completed successfully after an event has been moved or resized. Optionally, if additional view titles are supplied, those will be refreshed. The first parameter **vConfTitle** is a List view of same object as the calendar, with the events’ date/time field, that must be added in the same page as the Calendar view. It should have the **\_hv** keyword since it’s a utility view that displays no useful information. It only serves to perform a GET API call on it.

## \_rvr=vTitle1,vTitle2

Refresh Views after a Refresh. Same syntax as \_rvs. Used to trigger a refresh to other views. Care must be taken to avoid infinite circular loops: A\>B\>C\>A\>B\>C…

## \_rvs=vTitle1,vTitle2

Refresh Views after a Submit. Add this to a form’s title and when it is submitted successfully, will refresh any other views specified. Use the exact full title text, separated by commas, spaces are allowed.

Ex: **Customer Sale \_rvs=Client Sales, Store Sales**

Here, the form’s visible title will be “Customer Sales”, and when submitted successfully, the two views with the title “Client Sales” and “Store Sales” will be refreshed.

## \_uc

To convert text to uppercase in real-time

## \_uvc=fldName1, fldName2

Unique Value Check. Used when it is not possible to use the Builder’s **Must be unique** option due to the nature of the field. This is the case for Connected and Text Formula fields. This feature requires additional setup in the field’s description and a dedicated hidden Search view. See instructions in the Advanced Keywords Setup / [Unique Value Check \_uvc](#_Unique_Value_Check).

## \_uvx=str1, str2

Unique Values Exceptions. Used when we need unique values, but with a few specific exceptions. See instructions in the Advanced Keywords Setup / [Unique Values Exceptions \_uvx](#_Unique_Values_Exceptions).

## \_oln=url

Open Link in New page. To redirect your browser to another URL, in a new tab. In the rich text, add the keyword **\_oln=** as plain text, followed by a **link** to the website and a descriptive text (or same URL).

Ex: \_oln=[Support](https://ctrnd.com)

When clicked on the Support top menu, a new tab will be opened to the Cortex R&D Inc. website.

## \_ols=url

Open Link in Same page. To redirect your browser to another URL, on the same page. In the rich text, add the keyword **\_ols=** as plain text, followed by a **link** to the website and a descriptive text (or same URL).

## \_yourOwnKeywords

You can also add your own app-specific keywords and process them in the callback function processViewKeywords.

### Adding keywords to a rich text view to trigger features

In the Builder, you can add a rich text view with these keywords to trigger special behavior. See [What are Keywords?](#what-are-keywords) For more details.

The page must have **only one view,** have the “Include this page in the Page Menu” flag active and be in the **top** **menu** (not in a sub-menu).

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

# List of all Keywords

| **Keyword**                                          | **Description**                                       | **Where to use it**                                      | **Example**                                  |
|------------------------------------------------------|-------------------------------------------------------|----------------------------------------------------------|----------------------------------------------|
| \_ar=n Default is 60 seconds if parameter is omitted | Auto-Refresh a view every *n* seconds                 | View Title or Description                                | \_ar=60                                      |
| \_hv                                                 | Hidden View                                           | ‘’                                                       |                                              |
| \_ht                                                 | Hidden Title                                          | ‘’                                                       |                                              |
| \_hf=fld1, fld2…                                     | Hidden Fields                                         | “                                                        | \_hf=Work Shift                              |
| \_ni=colHeader1, colHeader2…                         | No Inline editing                                     | ‘’                                                       | \_ni=Email,!Phone (excl mark allows editing) |
| \_ts                                                 | Adds a Time Stamp to a view                           | ‘’                                                       |                                              |
| \_dtp                                                | Adds Date/Time Pickers                                | ‘’                                                       |                                              |
| \_rvs=vTitle1, vTitle2…                              | Refresh Views after Submit                            | ‘’                                                       | \_rvs=Monthly Sales, Clients                 |
| \_rvr=vTitle1, vTitle2…                              | Refresh Views after Refresh                           | ‘’                                                       | \_rvr=Monthly Sales, Clients                 |
| \_rvd=vConfTitle,vTitle1, vTitle2…                   | Refresh Views after calendar event Drag’n Drop        | ‘’                                                       | \_rvd=Confirmation, Monthly Sales, Clients   |
| \_lf= vTitle1,vTitle2…                               | Linked Filters                                        | ‘’                                                       | \_lf=Monthly Sales, Clients                  |
| \_qt=colorTrue,colorFalse                            | Quick Toggle of Boolean fields                        | ‘’                                                       | \_qt=\#0F07,pink                             |
| \_mc=colHeader                                       | Match Color for whole row to a given column           | ‘’                                                       | \_mc=Sales                                   |
| \_hc= colHeader1, colHeader2…                        | Hide Columns, but keep in DOM                         | ‘’                                                       |                                              |
| \_rc= colHeader1, colHeader2…                        | Removed Columns, including DOM                        | ‘’                                                       |                                              |
| \_nf=field_1,field_2…                                | No Filtering on specified fields                      | ‘’                                                       | \_nf=field_1,field_2                         |
|                                                      |                                                       |                                                          |                                              |
| \_al                                                 | Auto-Login                                            | View Title or Description of a login page                |                                              |
|                                                      |                                                       | ‘’                                                       |                                              |
| \_oln=url                                            | Open Link in a New page (tab)                         | Rich Text view with link                                 | Support \_oln=https://ctrnd.com              |
| \_ols=url                                            | Open Link in Same page                                | Rich Text view with link                                 | Support \_ols=https://ctrnd.com              |
|                                                      |                                                       | ‘’                                                       |                                              |
| \_uc                                                 | Convert to Uppercase                                  | Field Description                                        |                                              |
| \_num                                                | Numeric                                               | ‘’                                                       |                                              |
| \_int                                                | Integer                                               | ‘’                                                       |                                              |
| \_ip                                                 | Validate IP format (to do)                            | ‘’                                                       |                                              |
| \_lud                                                | Last Updated Date. For Inline edits, used with \_lub. | ‘’                                                       |                                              |
| \_lub                                                | Last Updated By. For Inline edits, used with \_lud.   | ‘’                                                       |                                              |
| \_uvc                                                | Unique Value Check                                    | See Advanced Keywords Setup                              |                                              |
| \_uvx                                                | Unique Values Exceptions                              | ‘’                                                       |                                              |
| \_cfv=[grp1],[grp2]…                                 | Colorize Field by Value                               | Field description or View Title or Description.          | \_cfv=[lte,5,red,\#ff08,bold,iu]             |
| \_km                                                 | Kiosk Mode                                            | View Title or Description. Effective in Kiosk mode only. |                                              |
| \_kr                                                 | Kiosk add Refresh button                              | ‘’                                                       |                                              |
| \_kb                                                 | Kiosk add Back button                                 | ‘’                                                       |                                              |
| \_kd                                                 | Kiosk add Done button                                 | ‘’                                                       |                                              |
|                                                      |                                                       |                                                          |                                              |
