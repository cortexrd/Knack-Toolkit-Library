# KTL Theme & Sticky Columns - Knowledge Transfer Summary

## Overview

This document summarizes work done on the KTL Theme Editor and Sticky Table Columns feature, specifically addressing conflicts between dark theme colors and Knack's built-in styling.

---

## 1. Sticky Table Columns Feature (`_stc`)

### The Problem
When using the `_stc` keyword to make table columns sticky, headers became transparent when the grid was set to Knack's "Clean" format. This is because `.knTable--clean th` sets `background-color: transparent !important;`.

### The Solution
Created dedicated CSS classes and used CSS variables for theme integration:

- **`.ktlHasStickyColumns`** - Added to the table element
- **`.ktlStickyHeader`** - Added to sticky header cells (`th`)
- **`.ktlStickyCell`** - Added to sticky body cells (`td`)

### Key CSS Variables
```css
--ktlStickyHeaderBg    /* Header background color */
--ktlStickyCellBg      /* Cell background color */
--ktlStickyCellText    /* Cell text color */
```

These are set dynamically based on theme state, reading from:
- `--ktlTheme_tableCellBg`
- `--ktlTheme_tableCellText`

---

## 2. CSS Specificity Battles

### Challenge: Multiple `!important` Rules Competing

1. **Knack's Clean table**: `.knTable--clean th { background-color: transparent !important; }`
2. **Theme's table cells**: `.ktlUserTheme .knTable td { background-color: var(...) !important; }`
3. **Sticky cells need their own background**

### Solution: Strategic `:not()` Exclusions

The theme rule was updated to exclude sticky cells and inline editable cells:

```javascript
// Line ~19326 in KTL.js
.ktlUserTheme .knTable td:not([style*="background"]):not(.ktlInlineEditableCellsStyle):not(.ktlStickyCell) {
    background-color: var(--ktlTheme_tableCellBg) !important;
    color: var(--ktlTheme_tableCellText) !important;
}
```

---

## 3. Respecting Multiple Color Sources

### Priority Order (highest to lowest):
1. **Knack Display Rules** - Inline `style="background:..."` attributes
2. **KTL Inline Editable Styling** - `.ktlInlineEditableCellsStyle` (green background)
3. **Theme Colors** - CSS variables from Theme Editor
4. **Fallback** - Default color (`#f3f6f9`)

### CSS Pattern Used
```css
td.ktlStickyCell:not([style*="background"]):not(.ktlInlineEditableCellsStyle) {
    background-color: var(--ktlStickyCellBg, #f3f6f9) !important;
    color: var(--ktlStickyCellText, inherit) !important;
}
```

The `:not([style*="background"])` selector respects inline styles from Knack display rules.

---

## 4. Theme Integration Code

### Location: `stickTableColumns` function (~line 17978)

```javascript
stickTableColumns: function (viewSelector, columnCount, backgroundColor) {
    const table = $(`#${viewSelector} table`);
    table.addClass('ktlHasStickyColumns');

    // ... column positioning code ...

    // Determine colors based on theme state
    const isDarkTheme = document.body.classList.contains('ktlUserTheme');
    const computedStyle = getComputedStyle(document.documentElement);
    const themeCellBg = isDarkTheme ? computedStyle.getPropertyValue('--ktlTheme_tableCellBg').trim() : '';
    const themeCellText = isDarkTheme ? computedStyle.getPropertyValue('--ktlTheme_tableCellText').trim() : '';
    const defaultBg = backgroundColor || themeCellBg || '#f3f6f9';
    const defaultText = themeCellText || 'inherit';

    // Inject sticky column CSS if not already present
    if (!document.getElementById('ktlStickyColStyles')) {
        const style = document.createElement('style');
        style.id = 'ktlStickyColStyles';
        style.textContent = `
            table.ktlHasStickyColumns.knTable--clean th {
                background-color: var(--ktlStickyHeaderBg, ${defaultBg}) !important;
            }
            th.ktlStickyHeader {
                position: sticky !important;
                z-index: 3 !important;
            }
            td.ktlStickyCell {
                position: sticky !important;
                z-index: 1 !important;
            }
            td.ktlStickyCell:not([style*="background"]):not(.ktlInlineEditableCellsStyle),
            .ktlUserTheme .knTable td.ktlStickyCell:not([style*="background"]):not(.ktlInlineEditableCellsStyle) {
                background-color: var(--ktlStickyCellBg, ${defaultBg}) !important;
                color: var(--ktlStickyCellText, ${defaultText}) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Always set CSS variables for sticky columns
    document.documentElement.style.setProperty('--ktlStickyHeaderBg', defaultBg);
    document.documentElement.style.setProperty('--ktlStickyCellBg', defaultBg);
    document.documentElement.style.setProperty('--ktlStickyCellText', defaultText);
},
```

---

## 5. Key Lessons Learned

### CSS Variable Reading
```javascript
const computedStyle = getComputedStyle(document.documentElement);
const value = computedStyle.getPropertyValue('--ktlTheme_tableCellBg').trim();
```

### Theme Detection
```javascript
const isDarkTheme = document.body.classList.contains('ktlUserTheme');
```

### CSS Variable with Fallback
```css
background-color: var(--ktlStickyCellBg, #f3f6f9);
```

### Sticky cells should NEVER be transparent
This was a key requirement - sticky cells must always have an opaque background to prevent content from showing through when scrolling.

---

## 6. Related Theme Work

### Luminance-based Logo Switching
The theme editor auto-swaps between dark and light logos based on header color luminance:
```javascript
luminance = (0.299 * R + 0.587 * G + 0.114 * B) / 255
// If luminance > 0.5, use dark logo; otherwise use light logo
```

### Radio/Checkbox Hover Fix
Added CSS rule for dark theme:
```css
.ktlUserTheme .kn-radio:hover, .ktlUserTheme .kn-checkbox:hover {
    color: var(--ktlTheme_lightText);
}
```

---

## 7. Files Modified

- **KTL.js** - Main file containing:
  - `stickTableColumns` function (~line 17978)
  - Theme CSS rules (~line 19326)
  - Theme Editor functionality

---

## 8. Known Remaining Conflicts

There may still be conflicts between:
- Dark theme colors and Knack's built-in colorization for various elements
- The general pattern for fixing these is:
  1. Identify the Knack selector causing the issue
  2. Create a more specific selector with `.ktlUserTheme` prefix
  3. Use `:not()` selectors to respect inline styles and special cases
  4. Use CSS variables for dynamic theme integration
