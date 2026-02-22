# KTL API (`this.api`) Reference

This document describes the `this.api` module in `KTL.js`.

## Overview

`this.api` is a Knack REST helper with:

- Unified GET/POST/PUT/DELETE wrappers
- Automatic retries with exponential backoff (including HTTP 429 support)
- Optional debug logging with developer-role gating
- Write queue controls (concurrency + rate limiting)
- Bulk helpers for create/update/delete operations

The module exposes a shared singleton API instance plus `create(options)` for custom instances.

---

## Quick Start

```js
// Fetch records from a view
const records = await ktl.api.getRecords('view_123');

// Update one record
await ktl.api.updateRecord('view_123', '64f...', { field_1: 'Updated' }, ['view_123']);

// Bulk update with progress
const result = await ktl.api.updateRecords('view_123', recIds, { field_2: 'Yes' }, [], {
  continueOnError: false,
  staggerMs: 40,
  onProgress: ({ updated, failed, total }) => {
    console.log(`Updated ${updated}/${total}, failed ${failed}`);
  }
});
```

---

## Public API Surface

## Instance control

### `ktl.api.create(options)`
Creates a new independent API instance with custom settings.

### `ktl.api.setDebug(enabled)`
Enables/disables debug logging on the shared instance.

### `ktl.api.canLog()`
Returns whether logs are allowed for the current user (developer-role aware when configured).

---

## Read methods

### `getRecords(viewId, options?)`
Gets records from one view/page.

- Returns: `records[]` by default
- Returns full response when `options.rawResponse === true`

### `getAllRecords(viewId, options?)`
Gets all pages from a view.

- Supports `onProgress({ page, totalPages, recordsLoaded, totalRecords, percentage })`

### `getRecord(viewId, recordId, options?)`
Gets a single record by record id.

### `getChildRecords(viewId, recordId, connectionSlug, options?)`
Gets child records linked by a connection field.

### `getAllChildRecords(viewId, recordId, connectionSlug, options?)`
Gets all pages of child records.

---

## Write methods

### `createRecord(viewId, recordData, refreshViews?, options?)`
Creates one record.

### `createRecords(viewId, recordsData, refreshViews?, options?)`
Creates many records using write queue controls.

- Returns: `{ total, created, failed, records }`
- Supports `continueOnError`, `staggerMs`, `onProgress`

### `updateRecord(viewId, recordId, recordData, refreshViews?, options?)`
Updates one record.

### `updateRecords(viewId, recordIds, recordData, refreshViews?, options?)`
Updates many records with queue controls.

- Returns: `{ total, updated, failed }`

### `deleteRecord(viewId, recordId, refreshViews?, options?)`
Deletes one record.

### `deleteRecords(viewId, recordIds, refreshViews?, options?)`
Deletes many records with queue controls.

- Returns: `{ total, deleted, failed }`

### `refreshView(viewId | viewId[])`
Refreshes one or many views.

---

## Utility methods

### `buildFilters(filters)`
Builds Knack filter query params.

### `buildSorters(sorters)`
Builds Knack sorter query params.

### `getApplication(applicationId?, options?)`
Fetches Knack application details.

---

## Common Options

Many methods share these options:

- `timeout` (ms): request timeout override
- `filters`: Knack filter object/array
- `sorters`: Knack sorter object/array
- `page`: page number
- `rows`: rows per page
- `rawResponse`: return Knack raw payload instead of records array
- `onProgress`: callback for paged or bulk operations

Bulk write options:

- `continueOnError` (default `false`)
- `staggerMs` (default `0`)

---

## Configuration (`create(options)`)

Defaults for a new instance:

- `showSpinner: false`
- `timeout: 60000`
- `debug: false`
- `developerOnly: false` (or auto-enabled when `cfg.developerRoles` exists)
- `developerRoles: ['Developer']`
- `maxRetries: 2`
- `retryDelayBase: 300`
- `retryDelayMax: 20000`
- `retryDelayMin429: 1000`
- `retryOnStatus: [429, 500, 502, 503, 504]`
- `writeConcurrency: 6`
- `writeRatePerSecond: 9`
- `writeMinConcurrency: 1`
- `writeMaxConcurrency: 8`
- `writeRampDelayMs: 2000`

---

## Retry and Rate-Limit Behavior

- Retries are attempted for `retryOnStatus` until `maxRetries` is exhausted.
- Backoff uses jittered exponential delays.
- HTTP 429 also honors `Retry-After` when present.
- Write queue adapts concurrency down on 429, then ramps back up.

---

## Error Handling Notes

- Single write methods throw `Error` with `error.status` and `error.body` when available.
- Bulk methods aggregate progress and return counts; with `continueOnError: false`, scheduling stops after first failure (already-started requests may still finish).
- Bulk failure logging uses operation-specific KEC codes (`KEC_1028` create, `KEC_1029` update, `KEC_1030` delete, `KEC_1031` tags).

---

## Example: Custom Instance

```js
const api = ktl.api.create({
  debug: true,
  developerOnly: true,
  maxRetries: 1,
  writeConcurrency: 4,
  writeRatePerSecond: 6
});

const app = await api.getApplication();
console.log(app);
```
