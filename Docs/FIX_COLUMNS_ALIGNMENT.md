# Fix Columns Alignment — Investigation & Findings

## Problem Summary

The `fixTableRowsAlignment()` function in KTL.js is responsible for ensuring that summary (totals) rows, grouping rows, and bulk-ops checkbox cells all line up with their corresponding header and data columns. Despite multiple fixes over time, alignment still breaks in certain scenarios.

This document captures all findings from the 2026-02-26 through 2026-02-28 investigation sessions.

---

## Architecture Overview

### Key Players

1. **Knack** — Renders the base table with `<thead>`, `<tbody>`, and `<tr class="kn-table-totals">` rows. Can also dynamically hide columns via the **"Hide empty columns"** builder option, reducing the rendered column count below the schema column count.
2. **KTL (KTL.js)** — Processes keywords, hides columns, adds bulk-ops checkboxes, handles inline edit styling, and calls `fixTableRowsAlignment()`
3. **App code (e.g. WIP.js)** — Can insert synthetic columns (e.g. cieLabColor), hide columns, and modify the DOM via `knack-view-render` handlers and `processViewKeywords` callback

### Column-Hiding Mechanisms

| Mechanism | CSS Class | Applied By | When |
|-----------|-----------|------------|------|
| `_dn` keyword | `ktlDisplayNone` | KTL keyword processing | During `ktlProcessKeywords` |
| `_dttip` (hide source) | `ktlDisplayNone_dttip` | KTL `addDataTooltips()` | During `ktlProcessKeywords` |
| `_hc` (hide columns) | `ktlDisplayNone_hc` | KTL `hideColumns()` | Before `ktlProcessKeywords` (line ~11887) |
| App-specific | `ktlDisplayNone_cieLab` | WIP.js cieLab code | Separate `knack-view-render` handler |
| Knack "Hide empty columns" | *(columns not rendered at all)* | Knack backend | At render time — columns with no data are omitted from `<thead>` and `<tbody>` entirely |
| `_cgc` (choose grid columns) | *(columns not rendered)* | Knack + KTL | User-selectable column visibility |

### Synthetic Column Insertion

App code (e.g. WIP.js) can insert extra `<th>` and `<td>` elements that don't exist in the Knack schema:
- **cieLabColor**: WIP.js hides 3 CIELAB source fields (L, a, b) and inserts a single synthetic "Color" column with a hex color swatch
- These synthetic columns are inserted into `<thead>` and `<tbody>` rows but NOT into `<tr class="kn-table-totals">`

### Knack "Hide empty columns"

When enabled in the Knack builder, columns where ALL records have empty values are **not rendered at all** — no `<th>`, no `<td>`, no totals `<td>`. This means:
- The schema (`view.model.view.columns`) still lists all 54 columns (for example)
- But only 21 (for example) are rendered in the DOM
- The totals row also has only 21 cells, matching the visible headers
- The `_cgc` keyword ("choose grid columns") has a similar effect

This is fundamentally different from CSS-based hiding (`_hc`, `_dttip`) where columns exist in the DOM but are hidden via `display: none`.

### Grouping Columns

When a grid uses grouping (e.g. "Live" field on Casting Schedule Dashboard view_3015), the grouping column:
- **Is in the schema** (`view.model.view.columns`) with `grouping: true`
- **Has no `<th>` header** — the group values appear as `<tr class="kn-table-group kn-group-level-1">` separator rows instead
- **May still have a totals `<td>`** — Knack renders one totals cell per schema column, including the grouping column, even though no header exists

This creates a mismatch: schema has N columns, headers have N-1 (no grouping header) + possible synthetic columns, totals have N cells. The rebuild must handle this gap.

### Cell Lookup Modes

The rebuild uses two modes depending on the relationship between `originalCells.length` and `schemaColumns.length`:

| Mode | Condition | How it works |
|------|-----------|-------------|
| **Direct lookup** | `originalCells.length >= schemaColumns.length` | `originalCells[matchedSchemaIdx]` — cell i maps to schema column i |
| **Sequential** | `originalCells.length < schemaColumns.length` | `originalCells[cellIdx++]` — cells are a sequential subset (for "Hide empty columns" / `_cgc`) |

### hideColumns nth-child Index Mismatch

`hideColumns()` applies `ktlDisplayNone_hc` using `nth-child(schemaIndex + 1)`. This works for headers and data rows where column count equals the number of rendered schema columns plus synthetic columns. But the **Knack-rendered totals row** may have a different cell count (e.g. it includes grouping column cells but excludes synthetic columns), causing `nth-child` to target the **wrong** totals cell. The rebuild corrects this by **stripping** all `ktlDisplayNone_*` classes from original cells and **re-propagating** the correct ones from the matched header.

---

## Execution Order (Critical)

Understanding the exact execution order is essential. For a view like `view_217`:

### Phase 1: KTL's processing pipeline
```
1. _hc keyword → hideColumns()           — hides columns by class
2. _rc keyword → removeColumns()          — removes columns from DOM
3. prepareBulkOps()                       — prepends checkbox <th>/<td>
4. ktlProcessKeywords()                   — processes all keywords:
   a. _ni, _hv, _rv, _ht, etc.           — various keyword handlers
   b. _dttip → addDataTooltips()          — hides source columns, adds ktlDisplayNone_dttip
   c. applyGridColorization()             — CFV, inline edit, sticky, hover, theme
   d. obfuscateData(), addTooltips(), addDataTooltips()
   e. processViewKeywords(view, kw, data) — APP CALLBACK (WIP.js processViewKeywords)
   f. fixTableRowsAlignment(viewId)       — ASYNC, waits for totals row
```

### Phase 2: App's separate `knack-view-render` handlers (registered after KTL)
```
5. WIP.js cieLab handler fires:
   a. Adds ktlDisplayNone_cieLab to 3 source th/td
   b. Inserts synthetic <th class="cieLabColor"> after SKU Quality header
   c. Inserts synthetic <td class="cieLabColor"> in each data row
   d. Does NOT touch totals row
```

### Phase 3: Async completion
```
6. fixTableRowsAlignment() resumes (was awaiting totals row via waitSelector)
   a. Takes the fresh DOM totals cells (filtering out blankCell from prepareBulkOps)
   b. Rebuilds the totals row using schema-based positional mapping
   c. Creates filler cells for non-schema columns (bulk-ops, synthetic)
   d. Propagates ktlDisplayNone_* classes from headers to matching totals cells
   e. Repositions summary labels if needed
```

---

## Solution: Schema-Based Positional Rebuild

The previous approach (heuristic-based synthetic column detection, separate blankCell prepend, separate hidden-column hiding) was replaced with a unified rebuild strategy.

### Core Algorithm

1. **Wait** — `fixTableRowsAlignment()` awaits the totals row via `waitSelector`.

2. **Collect** — Grab the fresh DOM totals cells, filtering out any `blankCell` added by `prepareBulkOps`.

3. **Rebuild** — Walk through all `<th>` headers left-to-right. For each header, determine if it's a schema column:
   - **Has `field_XXX` class**: match by field key against schema columns (forward-search)
   - **Has `kn-table-link` class** (Knack action columns like "Edit", "View"): match by trimmed header text
   - **Neither** (checkbox, app synthetic columns): non-schema → filler cell
   - If matched: place the corresponding original totals cell
   - If not matched: create an empty filler `<td>` (with totals-row background styling)
   - Strip any existing `ktlDisplayNone_*` classes from the original cell, then propagate the correct ones from the header

### Why Forward-Search

The schema column list contains ALL columns defined in the Knack builder (e.g. 54). But when Knack's **"Hide empty columns"** option is enabled, or the user uses **"Choose Columns"** (`_cgc`), only a subset of columns are rendered (e.g. 21). The rendered headers skip over hidden schema columns. A strict sequential match (schemaIdx++ on every header) fails because header[2] might correspond to schema[4] if schema[2] and schema[3] are hidden.

The forward-search scans ahead in the schema to find the matching column, correctly handling gaps.

### Header Classification Logic

```
Header has field_XXX class?
  → YES: Match by field key (forward-search in schema)
  → NO: Header has kn-table-link class?
    → YES: Match by trimmed text (forward-search in schema)
    → NO: Non-schema column → filler cell
```

This cleanly separates:
- **Regular data columns** — matched by field class (most reliable)
- **Knack action columns** (Edit, View, Delete) — matched by text (they have no field class but are real schema columns)
- **Non-schema columns** (bulk-ops checkbox, app synthetic columns) — never matched, always get filler cells

### What This Handles

| Scenario | How it's handled |
|----------|-----------------|
| Bulk-ops checkbox column | No field class, no kn-table-link → filler cell with `blankCell` class |
| App synthetic columns (cieLabColor) | No field class, no kn-table-link → filler cell with totals-row styling |
| Hidden columns (_hc, _dttip, _dn) | Existing `ktlDisplayNone_*` stripped, then correct classes propagated from header |
| "Hide empty columns" (Knack backend) | Forward-search skips non-rendered schema columns |
| Choose grid columns (_cgc) | Forward-search skips non-rendered schema columns |
| Multiple summary rows | Each row rebuilt independently |
| Record history column | No field class, no kn-table-link → filler cell |
| kn-table-link columns with trailing spaces in schema | Trimmed text comparison handles it |
| Grouping columns (no header but has totals cell) | Direct lookup by schema index skips the orphan cell; forward-search skips the grouping schema entry |
| hideColumns nth-child index mismatch on totals cells | Strip existing ktlDisplayNone_* then re-propagate from header |
| Double-run of fixTableRowsAlignment | Strip-then-propagate is idempotent — second run produces same correct result |

### What KTL No Longer Does

- **No pristine cell capture** — Totals cells are always fresh on each render; no need to capture before keyword processing.
- **No synthetic column heuristic** — KTL doesn't detect or know about app-specific columns. If an app adds a synthetic `<th>`, it automatically gets a filler `<td>` in the totals row.
- **No separate blankCell prepend logic** — unified into the rebuild loop.
- **No separate hidden-column hiding pass** — handled by class propagation during rebuild.

---

## Bugs Found & Fixed

### Session 1 (2026-02-26 AM)

#### Bug 1: `$view` undefined in fixTableRowsAlignment
**Symptom**: Hidden columns in totals row not being hidden.
**Root cause**: Used `$view.find(...)` but `$view` was never declared. Error silently caught.
**Fix**: Changed to `$('#${viewId} ...')`.

#### Bug 2: fixTableRowsAlignment called before column hiding
**Symptom**: Hidden column detection found nothing because columns weren't hidden yet.
**Root cause**: Called before `ktlProcessKeywords`.
**Fix**: Moved to end of `ktlProcessKeywords()`.

#### Bug 3: Synthetic columns missing from totals row
**Symptom**: Summary values shifted left.
**Root cause**: App-inserted synthetic columns not in totals row.
**Fix**: Added heuristic synthetic column detection (later replaced by schema-based rebuild).

### Session 2 (2026-02-26 PM) — Complete Rewrite

#### Bug 4: Knack totals cells have no `field_XXX` classes
**Symptom**: Field-class-based mapping produced all-empty totals row.
**Root cause**: Initial rewrite assumed totals `<td>` elements have `field_XXX` classes. They don't — they're purely positional.
**Fix**: Switched to schema-based positional mapping using `view.model.view.columns`.

#### Bug 5: "Hide empty columns" breaks sequential schema matching
**Symptom**: Summary values missing on Backtender Report (view_1569). 54 schema columns but only 21 rendered.
**Root cause**: Sequential match (`schemaIdx++`) fails when rendered columns are a subset of the schema.
**Fix**: Changed to forward-search through schema columns.

#### Bug 6: Filler cells missing totals-row background styling
**Symptom**: White gap in totals row at synthetic column position (cieLabColor).
**Root cause**: Only the bulk-ops blankCell got background styling; other filler cells were unstyled.
**Fix**: Applied `background-color: #eee; border-top: 1px solid #dadada` to all filler cells.

### Session 3 (2026-02-27) — Matching Refinements

#### Bug 7: Checkbox header steals schema match via empty-text collision
**Symptom**: All totals cells empty on SKUs page (view_217).
**Root cause**: The bulk-ops checkbox header (`ktlCheckboxHeaderCell`) has no field class and empty text. During forward-search, it matched a real schema column that also has empty header text (a `kn-table-link` action column), consuming that schema slot. All subsequent headers then failed to find their schema columns.
**Fix**: Replaced the `ktlCheckboxHeaderCell` exclusion with a positive-match rule: only attempt schema matching for headers that have a `field_*` class OR a `kn-table-link` class. All other headers (checkbox, app synthetic) are automatically non-schema.

#### Bug 8: Synthetic "Color" header matches real schema "Color" column
**Symptom**: All totals cells empty on SKUs page (view_217).
**Root cause**: The cieLabColor synthetic header has text "Color" but no field class. The text-based forward-search matched a real schema column also named "Color" at index 22, jumping the search position past all real headers.
**Fix**: Same as Bug 7 — restrict text-based matching to `kn-table-link` headers only. Synthetic headers without `kn-table-link` class are never matched against the schema.

#### Bug 9: Trailing spaces in Knack schema headers break text matching
**Symptom**: "View" action column misaligned on All Orders page (view_626). Summary values shifted right by one.
**Root cause**: Schema column had `header: "View "` (trailing space), but DOM header text was `"View"` (trimmed via `.textContent.trim()`). Strict equality failed.
**Fix**: Added `.trim()` to the schema header comparison: `thText === (col.header || '').trim()`.

#### Bug 10: Pristine cell capture was unnecessary and caused stale data issues
**Symptom**: Investigation revealed captured "pristine" cells sometimes contained filler styling from a previous `fixTableRowsAlignment` run.
**Root cause**: The capture in `finalizeSummaryPostProcessing()` could grab already-modified cells in certain render sequences. This was a red herring — totals cells are always re-rendered fresh by Knack on each `knack-records-render` event.
**Fix**: Removed pristine cell capture entirely. `fixTableRowsAlignment` now uses the fresh DOM cells directly (with blankCell filtering). Simpler and more reliable.

### Session 4 (2026-02-28) — Grouping Columns & hideColumns Index Mismatch

#### Bug 11: Sequential cellIdx offset with grouping columns
**Symptom**: Missing cell at bottom right on Casting Schedule Dashboard (view_3015, `_nbo`). Totals rows had 22 visible cells vs 23 in data rows.
**Root cause**: Schema[0] ("Live", field_2211) is a grouping column — it's in the schema and has a totals cell, but has no `<th>` header. The sequential `cellIdx` assigned `originalCells[0]` (grouping column's cell) to the first matched header (which matched schema[1]), cascading the offset.
**Fix**: Added direct lookup mode. When `originalCells.length >= schemaColumns.length`, use `originalCells[matchedSchemaIdx]` (the matched schema index) instead of `originalCells[cellIdx++]`. The grouping column's orphan cell is simply not used.

#### Bug 12: hideColumns applies ktlDisplayNone_hc to wrong totals cell
**Symptom**: PHold column (field_3156) incorrectly hidden in totals row on view_3015 (Casting Schedule Dashboard).
**Root cause**: `hideColumns()` uses `nth-child(schemaIndex + 1)` to apply `ktlDisplayNone_hc`. In headers/data rows (28 elements including synthetic cieLabColor), `nth-child(22)` correctly targets "DFS Close Date" (schema[21]). But in the Knack-rendered totals row (27 cells — no cieLabColor), `nth-child(22)` targets "PHold" (schema[22]) instead.
**Fix**: The rebuild now **strips** all `ktlDisplayNone_*` classes from original cells before **re-propagating** the correct ones from the matched header. This makes the rebuild authoritative — the header is always the source of truth for visibility.

#### Bug 13: fixTableRowsAlignment runs twice (double-run)
**Symptom**: On second run, directLookup uses rebuilt cells (in header order) instead of fresh Knack cells (in schema order), causing index misalignment for positions before the first synthetic column.
**Root cause**: `hideColumns()` calls `fixTableRowsAlignment()` at its end (line ~19767), and `ktlProcessKeywords` calls it again at its end (~12172). Both calls await the same totals row selector; when it appears, both proceed.
**Fix**: The strip-then-propagate approach makes the function idempotent — the second run strips classes from the first run and re-propagates from headers, producing the same correct result. For positions 0-5 (before cieLabColor), cells may be swapped between runs, but since they're all empty totals cells the visual result is identical.

---

## Code Locations

| What | File | Line(s) |
|------|------|---------|
| fixTableRowsAlignment | KTL.js | ~19176 |
| Call site | KTL.js | End of ktlProcessKeywords (~12172) |
| Schema-based rebuild | KTL.js | ~19185-19235 |
| Label repositioning | KTL.js | ~19238-19268 |
| cieLab column insertion (WIP) | WIP.js | ~6070-6157 |
| getGridColspan | KTL.js | search for `getGridColspan` |
| SUMMARY_WAIT_TIMEOUT | KTL.js | Line 17 (10000ms) |

---

## Testing Checklist

When modifying `fixTableRowsAlignment`, test these scenarios:

- [x] Grid with summary row + bulk-ops + hidden columns (_dttip, _dn, _hc) — **SKUs view_217**
- [x] Grid with summary row + synthetic columns (cieLab in WIP) — **SKUs view_217**
- [x] Grid with summary row + bulk-ops + synthetic + hidden columns (the full combo) — **SKUs view_217**
- [x] Grid with summary row + "Hide empty columns" enabled — **Backtender Report view_1569**
- [x] Grid with summary row + _cgc (choose grid columns) — **Backtender Report view_1569**
- [x] Grid with summary row + kn-table-link action columns — **All Orders view_626**
- [x] Grid with trailing spaces in schema headers — **All Orders view_626 ("View " column)**
- [x] Grid with summary row but NO bulk-ops — **Casting Schedule Dashboard view_3015**
- [x] Grid with grouping rows — **Casting Schedule Dashboard view_3015 (grouped by "Live")**
- [x] Grid with multiple summary rows — **Casting Schedule Dashboard view_3015 (2 totals rows)**
- [ ] Grid after page navigation (re-render)
- [ ] Grid with "Hidden Elements: Show" mode toggled
- [ ] Grid with _hsc (hide/show columns) feature

---

## Revision History

- 2026-02-26 (Session 1): Initial investigation and documentation
  - Fixed `$view` undefined bug
  - Moved fixTableRowsAlignment call to after keyword processing
  - Added synthetic column detection and insertion for totals rows
  - Identified remaining count mismatch issue (26 vs 25)

- 2026-02-26 (Session 2): Complete rewrite of fixTableRowsAlignment
  - Removed heuristic synthetic column detection (KTL no longer knows about app-specific columns)
  - Added pristine totals cell capture in `finalizeSummaryPostProcessing()`
  - Implemented schema-based positional rebuild with forward-search matching
  - Unified blankCell, hidden-column, and filler-cell handling into single rebuild loop
  - Fixed "Hide empty columns" / _cgc support (forward-search skips non-rendered schema columns)
  - Fixed filler cell styling (all filler cells get totals-row background)
  - Converted label repositioning to vanilla JS, broadened hidden class detection

- 2026-02-27 (Session 3): Matching refinements and simplification
  - Removed pristine cell capture (unnecessary — Knack re-renders totals fresh each time)
  - Fixed checkbox header stealing schema matches via empty-text collision (Bug 7)
  - Fixed synthetic "Color" header matching real schema "Color" column (Bug 8)
  - Fixed trailing spaces in Knack schema headers breaking text comparison (Bug 9)
  - Refined header classification: field_* class → match by field key; kn-table-link → match by text; neither → filler cell
  - Verified on SKUs (view_217), Backtender Report (view_1569), and All Orders (view_626)

- 2026-02-28 (Session 4): Grouping columns and hideColumns index mismatch
  - Added direct lookup mode: `originalCells[matchedSchemaIdx]` when all schema columns are rendered
  - Keeps sequential `cellIdx` for "Hide empty columns" views where cells are a subset
  - Fixed hideColumns nth-child targeting wrong totals cell (Bug 12)
  - Fixed double-run issue by making strip-then-propagate idempotent (Bug 13)
  - Verified on Casting Schedule Dashboard (view_3015) — grouped grid, _nbo, cieLabColor, 2 totals rows
