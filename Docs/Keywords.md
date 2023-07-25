# Contents

[About Keywords](#about-keywords)

[Keyword Options](#keyword-parameters)

[Keywords List](#keywords-list)

[Advanced Keywords Setup](#advanced-keywords-setup)

[Need more keywords?](#need-more-keywords)

# About Keywords

For an introduction on what are KTL keywords, [see this section](https://github.com/cortexrd/Knack-Toolkit-Library#what-are-keywords) on the main of this GitHub project.

Some keywords support multiple instances of that same keyword in a given view or field.

# Keyword Parameters

Some keywords require one or more parameters, and some may be optional. When using parameters, the equal sign “=”operator is added after the keyword, followed by the parameter(s). If multiple parameters are used, the comma is the separator and spaces are allowed.

Ex: \_rvs=vTitle1, vTitle2

The keywords are not case-sensitive, but the parameters are and must always be an **exact match** to take effect. There are a few exceptions, and they will be clearly documented.

# Parameter Groups

Some keywords can accept many groups of parameters in a chain. In those cases, the groups are enclosed in square brackets. All groups must be separated by a comma.

Example of a keywords using two groups:

\_cfv=[Column1,neq,,,red,,iu], [Column2,gte,100, yellow,\#00F9]

# Keyword Options

Some keywords can also be used with **options** that will affect their behavior. The options are always used in a separate group. This means that when used, the keyword parameters and the options must both be enclosed in square brackets, due to multiple parameter groups. The placement of the option group is not important. Only one instance of a given option kind is allowed per keyword. But there may be several different option kinds used in combination, each in their respective group.

Here are the available options:

-   **ktlRoles**: Defines to which roles the keyword will be applied. If you wish to **exclude** a role, add an exclamation mark before. This option has the highest precedence. It is being evaluated before anything else, and if this condition is not satisfied, the keyword will not be executed. It is possible to add several roles, separated by a comma. The roles are compared from left to right against the roles of the logged-in account. As soon as a false condition is met, the keyword execution is aborted.
-   **ktlTarget**: A *Universal Selector* (see below) that defines to which element the keyword will be applied. See *Universal Selectors* below for accepted values.
-   **ktlRefVal**: A *Universal Selector* (see below) from which the text or numeric value will be extracted. This value will then become the *reference* of a comparison that takes place in the processing of the keyword. Ex: with \_cfv, can be used to compare if a numeric value is higher than the reference, and apply a specified color in such case. The selector can be anywhere on the page, not necessarily in the same view. Can be a text value, a numeric value, a calculated summary like Total, Average, Maximum or Minimum. If the ktlRefVal contains only a field without a view, then the keyword’s view is used, and this field’s value becomes the reference in the comparison process for each record. See *Universal Selectors* below for accepted values.
-   **ktlSummary**: This is actually a “sub-option” of the ktlRefVal option. It is used to specify that the reference value shall be taken from a summary section, at the intersection of a row and column, using their label. If a view is specified, it must be the last parameter. If omitted, the current view is assumed by default.

For some examples, see in next section below. There’s also a discussion on this topic here, where you can also post questions if you need assistance: [Examples on using the KTL - keywords and code](https://github.com/cortexrd/Knack-Toolkit-Library/discussions/50)

## Universal Selectors

The Universal Selectors is a concept that provides a simplified and flexible method of specifying elements for processing. If the user prefers using the **field_id** and **view_id** syntax, it will work. Using the **View Title** and **Field Label** will also work, as well as a mixed combination.

The syntax can be one of the following:

-   **view_id, field_ids**: When providing both, in the ID form, the order is not important. Multiple fields are supported, but only one view.
-   **field_ids** or **fields label** only: When providing only the field ID or label, then the view is assumed to be the same as the keyword’s container. Multiple fields are supported.
-   **Fields label, view title**: When providing both but using their textual format, then the order is important. The field(s) must be first, followed by the view. Multiple fields are supported, but only one view.
-   any qualified **jQuery selector** that points to an element containing text or value. This allows selecting more complex or custom text elements, including multiple elements. The KTL automatically detects a jQuery selector string.

#### Universal Selectors examples

**\_cfv=[Price, lt, ktlRefVal, red, yellow, ,i], [ktlRefVal, Reg Price], [ktlTarget, Price, Item Desc], [ktlRoles, !Manager, !Supervisor]**

This keyword command is added to the description of a list view. It will compare each record’s Price field against a reference value: the field named Reg Price of the same view, same record. If Price is less than Reg Price, the Price and Item Desc fields will be colorized with red italics text on a yellow background. But this will not take effect if the logged-in account has either the role Manager or Supervisor.

**\_cfv=[Price, gte, ktlRefVal, blue, palegreen, bold], [ktlRefVal, Average Sales, Store Details], [ktlTarget, Item Desc], [ktlRoles, Manager]**

This keyword command is added to the description of a grid view. It will compare each row's Price field against a reference value found another view: a details view entitled Store Details, and its field Average Sales. If the value is greater than or equal, then the Item Desc field's value of this grid's row will be colorized blue and the cell will have a pale green background. But this will only take effect if the logged-in account has the Manager role.

## Keyword examples

**\_ni= [Amount, Phone], [ktlRoles, !Developer]**

Will disable Inline Editing of two columns of a grid having headers Amount and Phone, for all roles except Developer.

**\_hc= [Address, Name], [ktlRoles, Sales, Supervisor]**

Will hide columns Address and Name in a grid, for roles Sales and Supervisor.

**\_zoom=[120], [ktlTarget, \#view_123 .kn-table], [ktlRoles, Senior, Visually Impaired]**

Will zoom view_123’s table by 20% for seniors and users with low vision.

**\_cfv=[Sales, gt,ktlRefVal,yellow,darkgreen], [ktlRefVal,\#view_219 .kn-table-totals:last-of-type td:nth-child(2)]**

Will colorize the column having the title “Sales” with yellow text on dark green background, if the value of the cells are greater than the last summary found in the grid in view_219.

# Keywords List

Here's the complete list of all keywords, in alphabetical order.

You will see what is specific to each such as where to use them (ex: view, field), what are the supported options and if possible to use multiple instances.

## \_al

Auto-Login, with AES encrypted email/pw stored in localStorage. This must be in the view title of the **login page**. Used to automate boot-up of Kiosks, Dashboards or any unattended devices. A first-time setup procedure must be done manually, by entering an encryption key then the email/pw information. This is done for each new device and can be bypassed if desired.

## \_ar=n

Auto Refresh view. The view will be refreshed periodically every “*n*” seconds. If omitted or invalid parameter is given, the default is 60 seconds. It is possible to programmatically start/stop the process using the autoRefresh function.

## \_bcg=size, fieldId, h

Barcode Generator. When used in a Details view, will generate a QR Code containing the text of the specified field.

-   The size parameter defines the dimension in pixels. If omitted, 200 is used by default.
-   The fieldId parameter defines which field to use, by its ID. If omitted, the first one is used.
-   adding the "h" parameter will remove the text
-   if the text is present, the code will be placed above it

Examples:

`_bcg=75, field_123, h`

Will create a QR code of 75x75 pixels for field_123, and no text below it.

`_bcg=,,h`

Will create a QR code of 200x200 pixels for the first field found, without the text.

Supported options: ktlRoles

## \_cfv=colHeader, operator, refValue, textColor, backgroundColor, fontWeight, options

Colorize Field by Value. Can be used with grids, lists and details views. Used to compare the content of a cell to a reference value, and apply the following:

-   Change the text and background colors
-   Set the following styles: font weight (bold, extrabold , 700), underline and italic
-   Affect the whole cell or only the text within
-   Propagate the style across the whole row
-   Flash the cell with On/Off or Fade In/Out modes, and an adjustable rate
-   Hide or remove the cell's text

The color formats supported are:

-   named values (ex: red, purple)
-   hex values with optional transparency (ex: \#ff08, or \#ffff0080 for 50% transparent yellow)

The parameters are as follows:

**colHeader** (required): The colorization will be applied to the cells of the column having this header. The field ID can also be used instead of the header text. Note: if used in a field, the colHeader must match the field name.

**operator** (required):

-   is (equals - textual)
-   not (not equals)
-   has (contains text)
-   sw (starts with)
-   ew (ends with)
-   equ (equals - numeric)
-   gt (greater than)
-   gte (greater than or equal to)
-   lt (less than)
-   lte (less than or equal to)

**referenceValue** (required): Any literal text or numeric value against which the field value will be compared. For “empty” string, leave two consecutive commas. When a fixed value or text is not desirable, a special option can be used instead: **ktlRefVal**. This links to an external “referenced” value that can change dynamically. When used, this option must be added as the first token of an additional group, followed by a comma and an *Universal Selector* that fetches the reference value in real-time.

**textColor** (required): any standard “named colors” or hex values starting with \# and has 3, 4, 6, or 8 digits is supported.

**backgroundColor** (optional): Same as above. Will colorize the cell or only the text if the “t” option is included.

**fontWeight** (optional): Any named value like “bold”, or “lighter”, or a numeric values like 700. Omit or leave empty for default.

**options** (optional): Possible values are

u - underline

i - italic

t - text only

p - propagate style to whole row

r - remove text

h - hide text

f - flash with On/Off mode

ff - flash with fade In/Out mode

Example: \_cfv=[Discount,not,,,red,bold,iu], [Reg Price,gte,50, yellow,\#00F9,,ff]

The first group between square brackets will set the background in red and text in bold when the Discount value is not blank and set the text style to bold, italics and underlined. The second group will "smooth flash" the text color to yellow and the background in blue at 56.3 % transparency, when the Reg Price value is greater than or equal to 50.

**Additional notes:**

-   The square brackets are optional if you have only one group of parameters
-   Be careful to avoid conflicting conditions since they will yield unpredictable results.
-   The group of parameters are applied from left to right, so that if you have overlapping conditions, the last one will have precedence.
-   Transparency is useful to combine the visual effects of various colors
-   This keyword can be used in a view’s title or description.
-   This keyword can be used in a field’s description (table view). In such cases, it will take effect in all grids and lists across the app.
-   Using \_cfv in both the view and the field simultaneously is supported but the field will supersede the view’s colorization if both are competing. Care should be taken to avoid conflicting conditions and confusion. Using transparency helps combining colors while maintaining the desired visual cue.

Supported options: ktlRoles, Multiple Instances, ktlTarget, ktlRefVal, ktlSummary

## \_dr=rowsNumber

Displayed Records. Sets the initial number of rows in a table, allowing to go beyond the maximum value of 100 in the Builder.

## \_dtp

Add Date/Time Picker to a table. The table **must have a Date/Time field**, and the first one found from the left will be used. Six new fields will appear at the top of your table view: **From**, **To** and periods as **Monthly**, **Weekly**, and **Daily**. Depending on the active period, when you change From, the To field will automatically update itself accordingly, and the view will be filtered in real-time. On the other hand, if you change the To date, the From will not be affected, leaving you more flexibility. The focus is conveniently placed on the last field used so you can use the up/down arrows to scroll quickly through months and visualize data. This is also compatible with additional filter fields, provided that the AND operator is used. Once you have a filter that you like, it is also possible to save it as a [User Filter](#user-filters).

## \_ha

Header Alignment. When used with a grid or a pivot table, the headers will match the alignment of the columns’ data.

## \_hc=colHeader1, colHeader2

Hidden Columns. To hide a grid’s columns, based on the header’s exact text. The columns are only hidden but still exist in DOM. The visibility can be reversed on the fly with a bit of extra code. Hiding a column is useful to save real-estate or hide its data, while maintaining API calls capability or allow filtering on all fields.

## \_hf=fieldName1, fieldName2

Hidden Fields. To hide fields in a form or details view, based on their exact names. Typically used with utility fields that don't need to be visible.

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

## \_lf=vTitle1,vTitle2

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

## \_notes

Allows entering development notes or instructions in a view's title or description. Similar to the Description text box in a field.

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

Unique Value Check. Used when it is not possible to use the Builder’s **Must be unique** option due to the nature of the field. This is the case for Connected and Text Formula fields. This feature requires additional setup in the field’s description and a dedicated hidden Search view. See instructions in the Advanced Keywords Setup / [Unique Value Check \_uvc](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Keywords#unique-value-check-_uvc).

## \_uvx=str1, str2

Unique Values Exceptions. Used when we need unique values, but with a few specific exceptions. See instructions in the Advanced Keywords Setup / [Unique Values Exceptions \_uvx](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Keywords#unique-values-exceptions-_uvx).

## \_oln=url

Open Link in New page. To redirect your browser to another URL, in a new tab. In the rich text, add the keyword **\_oln=** as plain text, followed by a **link** to the website and a descriptive text (or same URL).

Ex: \_oln=[Support](https://ctrnd.com)

When clicked on the Support top menu, a new tab will be opened to the Cortex R&D Inc. website.

## \_ols=url

Open Link in Same page. To redirect your browser to another URL, on the same page. In the rich text, add the keyword **\_ols=** as plain text, followed by a **link** to the website and a descriptive text (or same URL).

## \_style

To add a style to a view, page or a jQuery selector. This will **merge** your new style to any existing style. Can be used with the ktlTarget option.

Ex: `_style=[min-width:250px],[ktlTarget,.kn-button]`

Will set all Knack buttons in the page (those having class kn-button) to have a minimum width of 250px.

## \_yourOwnKeywords

You can also add your own app-specific keywords and process them in the callback function processViewKeywords.

## \_zoom=zoomValue, options

Applies a zoom value in percentage to a specified element.

The options are:

-   **None** (leave empty): for the view where the keyword is placed
-   **page**: to apply to whole page
-   **sel,selectorString**: to apply to a specific valid jQuery selector

Ex: **\_zoom=120,sel,.myClass**

Will zoom in at 120% all elements having the class myClass.

### Adding keywords to a rich text view to trigger features

In the Builder, you can add a rich text view with these keywords to trigger special behavior.

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

# Need more keywords?

If you would like to propose new keywords, please use the Issues page here:

<https://github.com/cortexrd/Knack-Toolkit-Library/issues>

Explain how you would see the ideal implementation and tell us a bit about your use cases.
