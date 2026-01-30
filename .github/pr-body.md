## Overview
This PR adds shift-click functionality to checkbox selection in KTL tables, allowing users to quickly select a range of checkboxes similar to how file selection works in most operating systems.

## Changes Made

### New Feature: Shift-Click Checkbox Selection
- **Created reusable function**: `ktl.views.addShiftClickToCheckboxes(viewId, selector)`
  - Allows users to select a range of checkboxes by clicking one checkbox, then holding Shift and clicking another
  - All checkboxes between the first and second click are automatically checked/unchecked to match the state of the second checkbox
  - Works in both directions (clicking up or down the list)

### Implementation Details
- **Vanilla JavaScript**: Implemented using pure vanilla JS (no jQuery dependency for the new functionality)
- **Event Delegation**: Uses a single event listener on the view container for better performance and to handle dynamically added checkboxes
- **Converted jQuery selectors**: Replaced jQuery pseudo-selector `:checkbox` with valid CSS `[type="checkbox"]`
- **Comprehensive JSDoc**: Added detailed documentation with usage examples

### Integration
- Applied to `addCheckboxesToTable` function
- Applied to `bulkOpsAddCheckboxesToTable` function
- Maintains backward compatibility with existing functionality
- Preserves all existing behaviors (master checkbox, bulk operations, etc.)

## Benefits
- **Improved UX**: Familiar pattern that users expect from file managers, email clients, etc.
- **Performance**: Single event listener instead of one per checkbox
- **Maintainability**: DRY principle - single reusable function instead of duplicated logic
- **Flexibility**: Accepts optional selector parameter for customization

## Testing
- Verified shift-click selection works in both directions
- Confirmed compatibility with existing checkbox features
- Tested with dynamically loaded table data

## Related Issues
Addresses user request for bulk checkbox selection improvements in KTL tables.