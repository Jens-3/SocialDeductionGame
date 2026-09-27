# Changelog

This changelog records user-facing changes to Social Deduction Game.
New entries are collected under "Unreleased" in the "Added", "Changed", and
"Fixed" categories. On release, these entries move to a section with the
version number and release date (YYYY-MM-DD).
The latest version appears first; empty categories are omitted.

The format is based on [Keep a Changelog](https://keepachangelog.com)
and this project follows [Semantic Versioning](https://semver.org).

## [1.0.0] - 2026-09-27

### Added

- Open-source licenses in Settings now offer an expandable HTML overview
  alongside the text view. Both views are available offline.

### Changed

- Localization updated.
- Layout updated.

### Fixed

- Rule set cards now display the current team and role counts immediately
  after saving.
- When saving a game as a template, the suggested name now uses the current
  interface language for the "Template" suffix. The game name is preserved.
- Unchanged detail fields no longer trigger another unsaved-changes warning
  after saving. Saving also includes pending edits in open detail fields.

## [0.9.0] - 2026-09-04

### Added

- Fully offline game-master assistance
- Rule sets and role and team assignment
- Seating circle, role display, and night list
- Localized and accessible interface

[1.0.0]: https://github.com/Jens-3/SocialDeductionGame/releases/tag/v1.0.0
[0.9.0]: https://github.com/Jens-3/SocialDeductionGame/releases/tag/v0.9.0
