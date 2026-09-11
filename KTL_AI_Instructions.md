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
- **Vanilla JS is preferred, not required** (decision 2026-09-11). jQuery stays available in
  Knack's runtime, and KTL will not be ported to a next-gen codebase from this one, so
  there is no payoff in avoiding it at all cost.
- **Use whichever is simpler.** If jQuery makes new or existing code shorter or clearer,
  keep jQuery. Match the style of the surrounding function.
- **Do not convert existing jQuery to vanilla** for its own sake; only when explicitly asked.
- **Always jQuery** for Knack event hooks (`knack-view-render`, etc.), Chosen bindings, and
  jQuery UI widgets (`.datepicker(...)`).
- Reviews should not flag jQuery usage as a convention issue.

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
4. **Large refactors**: Vanilla or jQuery, whichever reads simpler (see 2.2); no wholesale conversion.

## 6. Where to Look for Patterns
- **`CLAUDE.md`**: alert replacement and JS style rules.
- **`KTL.js`**: module layout, keyword parsing, Knack event handling patterns.
- **`KTL.css`**: prefix conventions, spacing variables, feature grouping.
- **`KTL_Defaults.js`**: configuration patterns and defaults (when adding new settings).

## 7. Documentation Maintenance Rules
- Before changing an existing feature, check `Docs/` for a related doc (for example `KTL_API.md`).
- If a related doc exists, update it in the same change so behavior and options remain accurate.
- If no related doc exists, create one only when the feature/change is complex (multi-step behavior, non-obvious API contracts, advanced configuration, or cross-module impact).
- Do not create docs for small/simple changes; keep those in code comments or commit messages.
- When adding a new complex-feature doc, place it under `Docs/` and use a clear feature-based filename.

---

These guidelines are intended to keep changes consistent with the existing KTL codebase and reduce risk when extending shared functionality.
