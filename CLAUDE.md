# KTL Development Guidelines for Claude

This document contains important coding conventions and guidelines specific to the Knack Toolkit Library (KTL) for Claude Code to reference.

## User Dialogs and Alerts

**IMPORTANT**: Never use `alert()` or `confirm()` in KTL code. Always use `ktl.core.selectOption()` instead.

### Why?
On touch devices running Linux (e.g., Raspberry Pi) without a desktop environment (Lite OS), there is no OS-provided virtual keyboard. Standard JavaScript `alert()` and `confirm()` dialogs can leave users stuck with no way to dismiss them without plugging in a physical keyboard or mouse.

### Usage

Instead of:
```javascript
alert('Error message');
```

Use:
```javascript
ktl.core.selectOption('Error message', 'Close');
```

For confirmations, instead of:
```javascript
if (confirm('Are you sure?')) {
    // do something
}
```

Use:
```javascript
const result = await ktl.core.selectOption('Are you sure?', 'Yes,No');
if (result === 0) { // Yes was selected
    // do something
}
```

### Examples

- **Simple message**: `ktl.core.selectOption('Operation completed', 'OK');`
- **Error message**: `ktl.core.selectOption('KTL version must be higher than 0.35.1\nCurrent version: ' + ktlVersion, 'Close');`
- **Confirmation**: `await ktl.core.selectOption('Are you sure?', 'Yes,No');`
- **Multiple options**: `await ktl.core.selectOption('Select an option', 'Option 1,Option 2,Option 3');`

The function returns the index of the selected option (0-based), or -1 if cancelled.

## jQuery vs Vanilla JavaScript

**IMPORTANT**: For all new code, use plain vanilla JavaScript instead of jQuery.

### Rules
1. **New code**: Always use vanilla JS (e.g., `document.querySelector()`, `element.addEventListener()`, `fetch()`)
2. **Existing code**: Leave as-is unless explicitly asked to convert
3. **Mixed context**: If modifying a function that already uses jQuery, continue with jQuery for consistency within that function

### Examples

Instead of:
```javascript
$('#myElement').hide();
$('#myButton').on('click', handler);
$.ajax({ url: '/api', success: callback });
```

Use:
```javascript
document.getElementById('myElement').style.display = 'none';
document.getElementById('myButton').addEventListener('click', handler);
fetch('/api').then(response => response.json()).then(callback);
```

### Common Conversions
| jQuery | Vanilla JS |
|--------|------------|
| `$(selector)` | `document.querySelector(selector)` |
| `$(selector).hide()` | `element.style.display = 'none'` |
| `$(selector).show()` | `element.style.display = ''` |
| `$(selector).on('click', fn)` | `element.addEventListener('click', fn)` |
| `$(selector).val()` | `element.value` |
| `$(selector).text()` | `element.textContent` |
| `$(selector).html()` | `element.innerHTML` |
| `$(selector).addClass('x')` | `element.classList.add('x')` |
| `$(selector).removeClass('x')` | `element.classList.remove('x')` |

## Additional Guidelines

(Add more KTL-specific guidelines here as needed)
