# KTL Agent Instructions

These instructions apply to work inside `LIB/KTL/`.

## First Step
- Before editing KTL files, read `KTL_AI_Instructions.md` in this folder.
- Use `CLAUDE.md` in this folder alongside `KTL_AI_Instructions.md` when the task affects architecture, style rules, prompts, or user-facing behavior.

## Core Rules
- Keep changes consistent with the KTL singleton and module pattern used in `KTL.js`.
- Reuse existing helpers in `ktl.core`, `ktl.views`, `ktl.fields`, `ktl.log`, and related modules before adding new functionality.
- Add broadly useful functionality to the appropriate existing `ktl.*` module instead of creating new globals.
- Prefer vanilla JavaScript for new code, but keep jQuery where existing Knack event hooks or Chosen integrations require it.
- Never use `alert()`; use the existing KTL prompt and confirmation patterns instead.

## CSS And Keywords
- Prefix new CSS classes with `ktl` and follow the existing naming and grouping conventions in `KTL.css`.
- For keyword-driven features, keep underscore-prefixed keyword conventions and reuse the existing keyword parsing helpers.

## Documentation
- Before changing an existing feature, check `Docs/` for related documentation and update it in the same change when needed.
- If a feature is complex and undocumented, add a focused doc under `Docs/` instead of creating scattered notes elsewhere.

## Source Of Truth
- `KTL_AI_Instructions.md` is the detailed KTL-specific instruction file for this folder.
- If any repository-wide guidance conflicts with this folder's rules, follow the KTL-local guidance for files under `LIB/KTL/`.