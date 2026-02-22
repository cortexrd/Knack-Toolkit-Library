# KTL - Claude Code Project Instructions

See `KTL_AI_Instructions.md` for full architecture, conventions, and coding guidelines. That file is the shared reference for all AI tools and contributors.

## Quick Reference (from shared guide)

- **Never use `alert()` or `confirm()`** — use `ktl.core.selectOption()` (Pi kiosk compatibility)
- **Vanilla JS for new code** — no jQuery except Knack event hooks, Chosen bindings, and existing jQuery functions
- **`ktl` prefix** for all new CSS classes
- **Underscore prefix** for keywords (`_legend`, `_ttip`, `_cfv`)
- Add new utilities to existing `ktl.*` modules, not as new globals

## jQuery-to-Vanilla Conversion Table

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
