# Contributing to Social Deduction Game

Thank you for contributing to Social Deduction Game. This guide summarizes the
project's development workflow and the checks expected before a change is
submitted.

## Before You Start

Please read the following documentation before making substantial changes:

- [Project overview](../README.md) for setup and common commands;
- [Developer Guide](en/developer-guide.md) for architecture rules, development
  conventions, Android builds, and testing;
- [Module Overview](en/module-overview.md) for module responsibilities,
  contracts, and data flows;
- [User Guide](en/user-guide.md) for current user-visible behavior.

The project is licensed under the
[GNU Affero General Public License v3.0 only](../LICENSE). By contributing, you
agree that your contribution may be distributed under this license.

## Development Setup

The supported runtime versions are:

- Node.js `^22.22.2`, `^24.15.0`, or `>=26.0.0`;
- pnpm `11.24.0`.

Install dependencies and start the development server:

```powershell
pnpm install
pnpm run dev
```

The app is then available at `http://127.0.0.1:5173/`.

Development data resides in `dev-data`. Missing seed data is copied from
`app-seed` without overwriting existing development data. To reset only the
development library and its recovery files, use:

```powershell
pnpm run dev --reset-library
```

Saved games, templates, and other development data are retained by this
command.

## Working on a Change

Keep each change focused on one coherent purpose. Before editing code:

1. Identify the responsible layer and module in the Module Overview.
2. Check existing contracts and tests near that module.
3. Decide whether the change affects persisted data, visible behavior,
   localization, architecture boundaries, or third-party dependencies.

Preserve unrelated changes already present in the working tree. Do not include
generated output, local development data, credentials, signing keys, or build
artifacts in a contribution.

## Architecture

Follow these layer boundaries:

- `shared` has no dependencies on other project layers.
- `domain` contains the domain model and pure game logic and may use `shared`.
- `serialization` owns document formats, JSON processing, versioning, and
  structural repair.
- `persistence` orchestrates reads, writes, imports, exports, and recovery
  through its ports.
- `application` coordinates use cases, Domain, and Persistence contracts.
- `gui` uses public Application modules and domain-neutral helpers from
  `shared`.
- `storage` and `platform` contain concrete technical adapters.
- `src/bootstrapApplication.tsx` is the only composition root;
  `src/main.tsx` only starts it.

Modules under `src/application/internal` are private. Other layers must use the
public modules directly under `src/application` or its ports.

Run the architecture checks after changing imports, ports, public contracts, or
wiring:

```powershell
pnpm run architecture:check
```

## Implementation Conventions

- Keep TypeScript compatible with strict mode.
- Import functions and types directly from their responsible modules; do not
  introduce a central barrel file.
- Use stable IDs for references rather than display names or file names.
- Make mutation behavior explicit in types, implementation, and tests.
- Translate technical failures at layer boundaries instead of exposing
  Storage or Serialization exceptions to GUI code.
- Keep repair operations idempotent and avoid changing valid data
  unnecessarily.
- Treat canceled imports and exports as cancellations, not technical errors.

Regular domain IDs use lowercase ASCII letters, digits, and underscores and
generally match:

```text
^[a-z][a-z0-9_]*$
```

Existing prefixes and reserved IDs are documented in the Developer Guide.

## Persistent Data and Document Formats

A persistent field usually requires coordinated changes to the draft model,
decoder, validation, repair, export, version handling, and round-trip tests.
Never cast external JSON directly to a Domain object.

Incompatible format changes require a new schema version and explicit version
checks. Review golden-file changes deliberately. For Serialization changes,
run:

```powershell
pnpm run serialization:check
```

## Tests and Quality Checks

Add or update tests for changed behavior. Depending on the contract, cover:

- the successful standard case and relevant variants;
- edge cases, missing references, and ID collisions;
- expected warnings and failures;
- mutation or immutability;
- persistence round trips and schema versions;
- repair idempotence;
- missing optional adapter capabilities.

Useful individual checks are:

```powershell
pnpm run typecheck
pnpm run i18n:order:check
pnpm run biome:check
pnpm run lint
pnpm test
pnpm run test:coverage
pnpm run build
```

Run the complete project check before submitting a code change:

```powershell
pnpm run check
```

The complete check also validates third-party licenses and therefore requires
the Android SDK and JDK configuration described in the Developer Guide. For a
documentation-only change, the documentation lint is sufficient as long as no
project configuration or generated file was changed.

## Documentation

Keep documentation synchronized with the implementation:

- update the User Guide for visible behavior or workflows;
- update the Developer Guide for tooling, conventions, build, release, or test
  changes;
- update the Module Overview for new modules, moved responsibilities,
  architecture boundaries, or cross-layer data flows;
- keep the German files under `docs/de` and their English counterparts under
  `docs/en` semantically equivalent.

Verify commands, paths, links, labels, and diagrams against the current source
instead of copying outdated examples.

## Localization

Add new GUI message keys to `src/gui/i18n/messages.ts` first and then provide
them in every locale module. Maintain canonical key order with:

```powershell
pnpm run i18n:order
pnpm run i18n:order:check
```

Use writing localization scripts only after their corresponding `probe` or
`check` operation where available. Completed one-time maintenance scripts
belong under `archive/scripts` with a rationale.

## Dependencies and Licenses

Keep dependencies narrowly scoped and explain why a new dependency is needed.
After changing npm or Android runtime dependencies, regenerate and verify the
third-party license inventory:

```powershell
.\update-third-party-licenses.ps1
pnpm run licenses:check
```

Commit the resulting `THIRD_PARTY_LICENSES.txt` update when it changes.

## Submitting a Change

Before submitting, make sure that:

- the change has a clear and focused purpose;
- relevant tests were added or updated;
- applicable quality checks pass;
- user-visible and technical documentation is current in both languages;
- persistent-format and localization requirements were handled where
  applicable;
- no credentials, private app data, signing material, or unrelated generated
  files are included.

In the change description, explain the problem, the chosen solution, important
trade-offs, and the checks you ran. Mention any checks that could not be run
and why.

---

**Documentation:**
[Project overview](../README.md) | [User Guide](en/user-guide.md) | [Developer Guide](en/developer-guide.md) | [Module Overview](en/module-overview.md)
