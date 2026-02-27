# KTL AI Instructions

This guide captures the Knack Toolkit Library (KTL) architecture and conventions. Use it alongside `CLAUDE.md` when making updates.

## 1. Core Architecture (KTL.js)

### 1.1 Singleton entry point
- KTL is created with `function Ktl($, appInfo)` and stored as `window.ktl`.
- The constructor returns the existing instance if already initialized.
- Versioning is stored in globals (`window.APP_KTL_VERSIONS`, `window.APP_ROOT_NAME`).

### 1.2 Module pattern
- Each subsystem is attached on `this` using IIFEs that return an object.
- Example pattern:
  ```javascript
  this.core = (function () {
      return {
          myFn() { /* ... */ }
      };
  })();
  ```
- Existing modules include (non-exhaustive):
  - `ktl.core`, `ktl.fields`, `ktl.views`, `ktl.scenes`, `ktl.storage`, `ktl.log`, `ktl.bulkOps`, `ktl.userPrefs`, `ktl.sysInfo`.

### 1.3 Constants & globals
- Use `const` for file-level constants (e.g., `TEN_SECONDS_DELAY`).
- Shared constants live in `ktl.const`.
- Keyword parsing uses `window.ktlKeywords` and underscores (`_keyword`) for features.

## 2. JavaScript Conventions

### 2.1 Alerts & user prompts (from `CLAUDE.md`)
- **Never use `alert()`**.
- Use `ktl.core.selectOption()` for alerts and confirmations.
  ```javascript
  ktl.core.selectOption('Operation completed', 'OK');
  const result = await ktl.core.selectOption('Are you sure?', 'Yes,No');
  ```

### 2.2 Vanilla JS vs jQuery
- **New code should use vanilla JS** (`querySelector`, `addEventListener`, `fetch`, etc.).
- **Convert to vanilla JS** when explicitly asked or when doing a large refactor.
- **Keep jQuery** in these cases:
  - Knack event hooks (`knack-view-render`, `knack-scene-render`, etc.)
  - Chosen event bindings (`.chosen()` / `.on('change', ...)`)
  - Existing functions already written in jQuery (keep consistency within the function)

### 2.3 Code structure & naming
- Use `camelCase` for functions/variables; `UPPER_SNAKE_CASE` for constants.
- Prefer `const`/`let` over `var` in new code.
- Avoid new globals; attach generic utilities under an existing `ktl.*` module.

### 2.4 Reuse existing functionality
- Always look for existing helpers in `ktl.core`, `ktl.views`, `ktl.fields`, `ktl.log`, etc.
- If a new function is broadly useful, **add it to the appropriate existing module** rather than creating a new global function.

## 3. CSS Conventions (KTL.css)

### 3.1 Class naming
- Use the `ktl` prefix for all new classes (`.ktlHidden`, `.ktlDenseGrid`, etc.).
- Dynamic variants follow the pattern `[class^="ktlHidden_"]` or `[class*=" ktlHidden_"]`.
- Keep Knack-native class names (e.g., `.kn-radio`, `.kn-checkbox`) untouched.

### 3.2 Shared variables
- Global spacing variables live in `:root` (e.g., `--ktlButtonSpacing`).
- Prefer adding new reusable values to `:root` instead of hard-coding.

### 3.3 Organization
- Follow existing section headers and comment style in `KTL.css`.
- Group feature-specific styles together and keep them close to related features.

## 4. Keyword Conventions
- Keywords are underscore-prefixed (`_ar`, `_ts`, `_cfv`) and are parsed from view titles/descriptions.
- Use the existing keyword parsing helpers in `ktl.core`.
- If adding keywords, ensure they follow the underscore format and update relevant docs.

## 5. When Adding or Refactoring Features

1. **Reuse first**: Check for existing helpers before writing new logic.
2. **Extend modules**: Add reusable functions to `ktl.core` (or the most relevant module).
3. **Avoid new globals**: Keep functionality encapsulated within the KTL instance.
4. **Large refactors**: Convert to vanilla JS except for Knack events and chosen events.

## 6. Where to Look for Patterns
- **`CLAUDE.md`**: alert replacement and JS style rules.
- **`KTL.js`**: module layout, keyword parsing, Knack event handling patterns.
- **`KTL.css`**: prefix conventions, spacing variables, feature grouping.
- **`KTL_Defaults.js`**: configuration patterns and defaults (when adding new settings).

## 7. Documentation Maintenance Rules
- Before changing an existing feature, check `LIB/KTL/Docs/` for a related doc (for example `KTL_API.md`).
- If a related doc exists, update it in the same change so behavior and options remain accurate.
- If no related doc exists, create one only when the feature/change is complex (multi-step behavior, non-obvious API contracts, advanced configuration, or cross-module impact).
- Do not create docs for small/simple changes; keep those in code comments or commit messages.
- When adding a new complex-feature doc, place it under `LIB/KTL/Docs/` and use a clear feature-based filename.

---

These guidelines are intended to keep changes consistent with the existing KTL codebase and reduce risk when extending shared functionality.
