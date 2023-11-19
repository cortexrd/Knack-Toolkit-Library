# ![A picture containing text, clipart Description automatically generated](./Docs/media/f885aa5ef3409ff28bd30849d54ad54c.jpeg)

See our [YouTube channel for introductory tutorials](https://www.youtube.com/@cortexrdinc.4479)

# Contents

[Introduction](#introduction)

[Installation](#installation)

[Features Overview](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Features-Overview)

[Customizing Features](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Customizing-Features)

[Advanced Features](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Advanced-Features)

[Advanced Development Modes](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Advanced-Development-Modes)

[Keywords](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Keywords)

# Introduction

**What is the Knack Toolkit Library?**

The Knack Toolkit Library, or KTL for short, is a collection of open-source Javascript utilities that eases Knack application development by adding several features that are not easily created from the ground up.

You do not need any coding skills to benefit from the KTL. The simple **“keyword-based”** approach allows you to use the Builder to trigger the desired features and specific behaviors.

For the few features that require API calls, everything is done to minimize their usage as much as possible. All calls are 100% view-based, so **your API key is never used**.

Need a quick intro? [YouTube channel for introductory tutorials](https://www.youtube.com/@cortexrdinc.4479)

# What are Keywords?

KTL uses reserved keywords to trigger features. You decide *if* and *where* you need them. All keywords are created in the Builder and are **never visible** in the app. All keywords must **start with an underscore** followed by a letter.

A few examples:

**\_ts** (to show a timestamp)

**\_ar=30** (to auto-refresh a view every 30 seconds)

**\_cfv=Deals,has,On Sale,red,yellow** (to colorize a field in red text on yellow background when a value contains “On Sale”)

Keywords can be used in two places: in fields and views.

## In Fields

Keywords can be added in a field’s **description**, in the table view.

When used in a field, the keyword will be applied **across the board** in your app, in all views using this field.

## In Views

Keywords can be added in a view’s **title** or **description** - interchangeably or together. Each keywords are separated by a space, or line feeds (return) when used in the description box. In some cases, it can also be used inside a Rich Text.

When used in a view, the keyword will be applied **in that view only**.

## Placement

For views, all keywords must be placed **after** the last word that you intend to keep visible. All text beyond the first keyword found will be truncated (invisible) in the app.

For fields, it is not relevant since descriptions are “internal notes” for developers only and not visible in the app anyways.

## Parameters

Some keywords require one or more parameters, and some may be optional. When using parameters, the equal sign “=”operator is added after the keyword, followed by the parameter(s). If multiple parameters are used, the comma is the separator and spaces are allowed.

Ex: \_rvs=vTitle1, vTitle2

The keywords are not case-sensitive, but the parameters are and must always be an **exact match** to take effect.

Some keywords can accept many **groups** of parameters in a chain. In those cases, the groups are enclosed in **square brackets**.

Example with two groups: \_cfv=[Column1,neq,,,red,,iu], [Column2,gte,100, yellow,\#00F9]

# Installation

## No time to read all this now - How about a quick tryout?

Need a quick intro? [YouTube channel for introductory tutorials](https://www.youtube.com/@cortexrdinc.4479)

If you want to try/use the basic default setup version of the KTL, all you need to do is copy the **5 lines** of code from this file [**KTL_Loader.js**](https://github.com/cortexrd/Knack-Toolkit-Library/blob/master/KTL_Loader.js) at the **top** of the Javascript pane of the Builder. See the next section for the list of basic features.

If you already have your own code, it will not conflict with the KTL. Just leave it after those added lines.

If you do not like some features, you can turn them off or customize them individually – [see here](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Customizing-Features).

## Basic Setup

**Zero config needed for Basic Features**

Right out of the box, without any coding or complex setup, the KTL will provide these nice additions to your app:

-   Using reserved keywords to trigger special behavior. [See list](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Keywords).
-   User filters to save your filters to named buttons
-   Bulk Operations: Edit, Copy and Delete
-   Form data persistence that saves as you type, and will load back your data if a page is reloaded after a submit failure or power outage
-   Dropdown selector improvements
-   Click followed by long press anywhere in a view to refresh that view
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

The KTL “keyword-based” approach is an ideal tool for non-coders. But behind each of those keywords lies a huge collection of “hidden” function waiting to be leveraged.

If ever you’re interested in some basic or advanced coding, click the following links to know more about [Advanced Features](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Advanced-Features) and [Advanced Development Modes](https://github.com/cortexrd/Knack-Toolkit-Library/wiki/Advanced-Development-Modes).

# Future Improvements

-   Direct front-end external data Import from an Excel or CSV file.  We've done this successfully for Morbern Inc. the main sponsor of this project, and it works flawlessly.
-   Use JSDoc to have an adequate auto-generated and detailed API documentation, for each function with parameter description, etc.
-   Geofencing and other map-based features, with geo-based events and Google Maps integration.
-   The sky's the limit! Let us see what we can come up with…

# Conclusion

That's about it for now, thanks for reading this and testing the library. Hope you’ll enjoy it as much as we did creating it. Now, let’s see how many of you will **collaborate on this project**. Cortex R&D needs you!!!

## 

## This project was started by:

Normand Defayette

[nd@ctrnd.com](mailto:nd@ctrnd.com)

Cortex R&D Inc.

Blainville, Québec, Canada

[YouTube channel](https://www.youtube.com/@cortexrdinc.4479)

![A picture containing text, clipart Description automatically generated](./Docs/media/f885aa5ef3409ff28bd30849d54ad54c.jpeg)
