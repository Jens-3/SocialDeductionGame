# Developer Guide

## 1. Purpose and Scope

This guide describes how to set up the development environment, the mandatory
architecture rules, typical development workflows, and the build, release, and
test procedures.

Other information is intentionally kept in separate documents:

- [User Guide](user-guide.md): operation and visible app behavior;
- [Module Overview](module-overview.md): responsibilities of the source
  modules, central contracts, and data flows;
- [Project overview](../../README.md): brief overview and quick start.

Changes to user-facing workflows are documented in the User Guide. New
modules, moved responsibilities, and cross-layer data flows are added to the
Module Overview.

## 2. Architecture Rules

The project uses TypeScript in strict mode. Domain functions are imported
directly from their responsible module; there is no central barrel file.

The layers may depend on one another only in the intended directions:

- `shared` does not import any other project layer.
- `domain` uses only Domain modules and `shared`.
- `serialization` may use `domain` and `shared`, but no runtime, Storage,
  Application, or GUI APIs.
- `persistence` uses Domain, Serialization, and its own ports, but neither
  Application nor concrete adapters.
- `application` coordinates Domain and Persistence contracts. It imports
  neither GUI nor concrete Storage, Platform, or Capacitor adapters.
- Modules under `application/internal` are private. Other layers import only
  public modules directly under `application` or its ports.
- Across layer boundaries, `gui` accesses only public Application modules and
  domain-neutral helpers from `shared`.
- `storage` implements file ports from `persistence/ports` and image and
  settings ports from `application/ports`.
- `platform` implements designated technical ports from Domain or Application
  and does not create Application services.
- Only `src/bootstrapApplication.tsx` may select and wire the GUI, Application,
  and concrete adapters together; `src/main.tsx` only starts this bootstrap.

Public use-case contracts reside in `*UseCaseContracts.ts`. The `*UseCases.ts`
facades re-export these contracts and their respective internal factory.
Internal implementations import the contract module rather than their own
facade, preventing cycles between contracts and wiring.

The architecture rules are enforced by
`tests/architectureBoundaries.test.ts` and
`tests/applicationContracts.test.ts`:

```powershell
pnpm run architecture:check
```

Changes to Serialization are additionally checked against the format, codec,
import, export, and repair contracts:

```powershell
pnpm run serialization:check
```

## 3. Development Environment

### 3.1 Prerequisites

The engine requirements of the lockfile currently support Node.js
`^22.22.2`, `^24.15.0`, or `>=26.0.0`. The project uses pnpm `11.24.0`;
`package.json` pins this version in the `packageManager` field.
`pnpm-lock.yaml` is the authoritative lockfile.

Dependencies and development tools are installed locally in the project:

```powershell
pnpm install
pnpm add <package>
pnpm add --save-dev <package>
```

Global installations of React, Vite, TypeScript, ESLint, Biome, Vitest, or
their plugins are not required. The project scripts use the locally pinned
versions.

### 3.2 Web Development

```powershell
pnpm run dev
```

Vite binds to `127.0.0.1`; the default address is
`http://127.0.0.1:5173/`.
If `dev-data/library.json` is missing, startup automatically copies it from
`app-seed`. An existing development library, including its temporary recovery
and backup files, can be reset selectively:

```powershell
pnpm run dev --reset-library
```

Saved games, templates, and other development data are retained.

Create the production build with:

```powershell
pnpm run build
```

This command checks the GUI types, creates `dist`, and copies the Capacitor
seed data. It creates neither an APK nor an AAB.

## 4. Development Conventions

### 4.1 IDs and References

Regular domain IDs generally follow this pattern:

```text
^[a-z][a-z0-9_]*$
```

The prefixes identify the area of the ID:

| Prefix | Meaning |
| --- | --- |
| `t_` | Team |
| `r_` | Role |
| `p_` | Player |
| `d_` | Status definition |
| `s_` | Status instance |
| `game_` | Game |
| `template_` | Template |
| `log_` | Log entry |
| `ruleset_` | Rule set |
| `x_` | Explicitly generic area |

`t_unknown` is reserved for the system team. `p_empty` is a placeholder that
may occur multiple times in `seatOrder` and must not be a real `Player` ID.
Display names and internal file names are not used as reference keys.

Status definitions and status instances have separate IDs. Multiple instances
may refer to the same definition.

### 4.2 Names and Languages

The `name` field remains mandatory for rule sets, teams, roles, players, and
status definitions. Optional translations reside in `names` and use language
or regional codes as keys.

Domain functions receive the desired language explicitly. Global configuration
and stored settings are not imported into Domain. New GUI text is added to the
typed catalog in `src/gui/i18n/messages.ts` and supplied by every locale
module. Key order is checked automatically.

### 4.3 State Changes

Regular editing, seating, time, and assignment functions usually return a new
`GameState`. The caller adopts the return value:

```ts
const result = editPlayer(game, {
  playerId: "p_player1",
  name: "Erika",
});

game = result.game;
```

Repair functions and player actions may modify the supplied state in a
controlled manner. The respective contract must be unambiguous in the type,
module, and tests. Read-only presentation and localization functions do not
mutate their inputs.

### 4.4 Errors, Warnings, and Recovery

- Programming errors and invalid input structures cause exceptions.
- Expected domain conflicts are returned as typed results or warnings.
- Technical errors are translated at the layer boundary; GUI code does not
  evaluate Storage or Serialization exceptions directly.
- A canceled import or export is not a technical error.
- Repairs must be idempotent and must not modify valid data unnecessarily.
- A failed write operation must neither appear as successful nor mark a stale
  session state as saved.

## 5. Typical Development Workflows

### 5.1 Adding Domain Functionality

1. Determine responsibility using the Module Overview.
2. Implement the domain rule in Domain or Application.
3. Publish public types only in the responsible layer.
4. Test the standard case, edge cases, warnings, and mutation contract.
5. Update the User Guide for visible behavior.
6. Update the Module Overview for new modules or data flows.

### 5.2 Changing a Persistent Field or Document Format

A persistent field is not added only to the Domain model. The draft, decoder,
validation, repair, export, version handling, and round-trip tests must all be
checked. External JSON values must never be cast directly to Domain objects.

An incompatible format change requires a new schema version with an
unambiguous version check. Golden files are reviewed deliberately and are not
rewritten incidentally by formatters or tests.

Run at least the following afterward:

```powershell
pnpm run serialization:check
pnpm run check
pnpm run build
```

### 5.3 Changing Localization

Add new message keys to the message contract first and then to the locale
modules. Maintain canonical order with:

```powershell
pnpm run i18n:order
pnpm run i18n:order:check
```

The `i18n:generate-*` scripts are targeted maintenance tools. Before running a
writing operation, use its corresponding `probe` or `check` command where one
is available. Completed one-time maintenance tools are stored under
`archive/scripts` together with a rationale.

### 5.4 Development Data

`dev-data` is intended exclusively for local development. Production data
comes from `app-seed`. Its manifest explicitly lists all data and image
resources to be shipped; unlisted or missing files cause the build to fail. The
web development server creates `dev-data` when required and supplements
missing seed data from it without overwriting existing development data.

## 6. Capacitor and Android

### 6.1 Prerequisites and Synchronization

The app uses Capacitor 8. `capacitor.config.ts` defines the package ID
`io.github.jens_3.socialdeductiongame` and `dist` as the web output. The native
project resides under `android`.

Command-line builds require:

- Android SDK and build tools;
- `sdk.dir` in `android/local.properties`;
- a complete JDK `^21.0.10`;
- `JAVA_HOME` pointing to this JDK;
- `java`, `javac`, `keytool`, and `jarsigner` in `PATH`;
- additionally, `adb` and `emulator` in `PATH` for emulator runs.

Synchronize the native project after changes to web code or Capacitor plugins:

```powershell
pnpm run android:sync
pnpm run android:open
```

`android:sync` runs the web build first. Platform plugins are accessed only in
`src/platform` or `src/storage`; Application and GUI use their ports.

### 6.2 Development Start on an Emulator

```powershell
.\dev-start-android.ps1
```

The script checks third-party licenses, builds and synchronizes the app, starts
the `Pixel_8` AVD if necessary, waits for it to finish booting, and installs the
app. Select a different AVD as follows:

```powershell
.\dev-start-android.ps1 -EmulatorName Pixel_10_Pro
```

Existing app data is retained by default. To test with the seed data, you can
deliberately clear the app's private storage:

```powershell
.\dev-start-android.ps1 -ResetAppData
```

This option deletes all games, templates, and settings created in the app.

After changing npm or Android runtime dependencies, update the license data
separately:

```powershell
.\update-third-party-licenses.ps1
```

Normal development startup and `pnpm run licenses:check` do not modify
`THIRD_PARTY_LICENSES.txt`.

### 6.3 Native Seed Data and Resources

The production build copies only the files listed in
`app-seed/manifest.json`. Mutable data files are copied to the app's private
storage on the first native start and are not reapplied later. Immutable image
resources remain in the bundle.

Launcher icons are Android resources under
`android/app/src/main/res/mipmap-*`. Sources and reproducible generation
scripts reside under `dev-data/assets/icons`. Generated resources are not
edited individually by hand.

### 6.4 Signed Release

The upload signature is configured outside the repository in the user-specific
Gradle configuration:

```properties
socialDeductionUploadStoreFile=<absolute-keystore-path>
socialDeductionUploadStorePassword=<store-password>
socialDeductionUploadKeyAlias=<key-alias>
socialDeductionUploadKeyPassword=<key-password>
```

The keystore and passwords must not enter the repository. Run the complete
release with:

```powershell
.\build-release-android.ps1
```

The script clears only `release-artifacts`, checks the lockfile, quality, and
licenses, cleans and synchronizes the Android build, runs Android Lint, builds
the artifacts, and verifies their signatures. On success, the directory
contains exactly:

- `app-debug.apk`;
- `social-deduction-game-<Version>.apk`;
- `social-deduction-game-<Version>.aab`.

The AAB is intended for Google Play and the release APK for direct
distribution. The script prints the SHA-256 hash and size of each artifact.

### 6.5 Instrumented Release Smoke Test

```powershell
.\test-release-android.ps1
```

By default, the test builds a complete release and runs `releaseSmoke` on the
existing `Pixel_8` and `Pixel_10_Pro` AVDs. Other AVDs can be specified:

```powershell
.\test-release-android.ps1 -EmulatorNames Pixel_8
```

The emulators run ephemerally, read-only, and without a window. Reports reside
under `android/app/build/reports/release-smoke/<AVD-Name>/index.html`.
`-SkipBuild` is permitted only if an up-to-date, synchronized release build
already exists in the same working state.

## 7. Quality Assurance

The complete project check is:

```powershell
pnpm run check
```

It performs the following steps in order:

1. TypeScript checks for source code, GUI, and tests;
2. key-order checks for all GUI localizations;
3. Biome checks;
4. ESLint checks;
5. the complete Vitest suite;
6. npm and Android third-party license checks.

The license check resolves Android artifacts through Gradle. Consequently, the
complete check requires not only Node.js and pnpm but also the JDK and SDK
configuration described in section 6.1.

Individual checks:

```powershell
pnpm run typecheck
pnpm run i18n:order:check
pnpm run biome:check
pnpm run lint
pnpm test
pnpm run test:watch
pnpm run licenses:check
```

Before completing a change, run at least `pnpm run check` and
`pnpm run build`. For documentation-only changes, the documentation lint is
sufficient as long as no project configuration or generated file was touched.

## 8. Tests

The tests under `tests` mirror the Domain and Application modules.
`tests/fixtures.ts` creates small, consistent rule sets and reproducible saved
games.

New or changed logic covers the following as appropriate for its contract:

- the successful standard case and relevant variants;
- missing references and ID collisions;
- warnings, expected errors, and unexpected errors;
- mutation or immutability;
- round trips for persistent fields;
- schema versions and invalid document types;
- idempotence of repairs;
- missing optional adapter capabilities.

Storage tests work in temporary directories and modify neither `dev-data` nor
a real development library. Where possible, import and export tests also check
the file name, bytes, and cancellation behavior.

---

**Navigation:**
[Project overview](../../README.md) | [User Guide](user-guide.md) | Developer Guide | [Module Overview](module-overview.md)
