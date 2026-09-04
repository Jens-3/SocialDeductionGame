# Social Deduction Game

Eine vollständig offline nutzbare Smartphone-App, die Spielleitungen bei
Social-Deduction-Spielen wie *Werwölfe* oder *Mafia* unterstützt.

**Rechtlicher Hinweis:** Diese App ist ein unabhängiges, inoffizielles
Hilfswerkzeug und steht in keiner geschäftlichen, organisatorischen oder
rechtlichen Verbindung zu den Urhebern, Verlagen oder Rechteinhabern von
*Werwölfe* oder *Mafia*. Die genannten Namen und Marken werden ausschließlich
verwendet, um die von der App unterstützten Spiele und deren Kompatibilität
zu beschreiben. Etwaige Marken- und sonstige Schutzrechte verbleiben bei
den jeweiligen Rechteinhabern.

Die App bietet insbesondere:

- eine Übersicht über Rollen und Lebensstatus aller Spieler;
- eine Vollbildansicht, in der jedem Spieler ausschließlich seine eigene
  Rolle gezeigt werden kann;
- die Reihenfolge der Rollen und Aktionen während der Nachtphase;
- die Verwaltung von Regelwerken, Vorlagen und Spielständen.

## 📚 Dokumentation

Alle ausführlichen Handbücher befinden sich im Verzeichnis `docs`:

- [Benutzerhandbuch](./docs/de/benutzerhandbuch.md) – Bedienung und sichtbares
  Verhalten;
- [Entwicklerhandbuch](./docs/de/entwicklerhandbuch.md) – Entwicklungsumgebung,
  Architekturregeln, Build und Tests;
- [Modulübersicht](./docs/de/moduluebersicht.md) – Module, Verträge und technische
  Datenflüsse.

## Projektstruktur

- `src/` enthält den App-Code.
- `dev-data/` enthält simulierte interne App-Daten für die lokale Entwicklung.
- `app-seed/` enthält die mit der Android-App ausgelieferten Startdaten.
- `tests/` enthält die automatisierten Tests.

## Entwicklung

### Voraussetzungen

- Node.js `^22.22.2`, `^24.15.0` oder `>=26.0.0`;
- pnpm `11.24.0`.

Abhängigkeiten installieren:

```powershell
pnpm install
```

### Web-App

Entwicklungsserver starten:

```powershell
pnpm run dev
```

Die App ist anschließend unter `http://127.0.0.1:5173/` erreichbar.
Änderungen am Quellcode werden automatisch übernommen.
Bei jedem Start werden fehlende Startdaten aus `app-seed/` nach `dev-data/`
kopiert; vorhandene Entwicklungsdaten bleiben dabei unverändert. Die Library
kann gezielt auf den mitgelieferten Ausgangszustand zurückgesetzt werden:

```powershell
pnpm run dev --reset-library
```

Dabei bleiben Spielstände, Vorlagen und andere Entwicklungsdaten erhalten.

Produktions-Build erzeugen:

```powershell
pnpm run build
```

Der Befehl prüft den TypeScript-Code der GUI, erzeugt die Web-App unter
`dist/` und kopiert die mit der Android-App ausgelieferten Startdaten.

### Android

Die App automatisiert in einem Emulator bauen und starten:

```powershell
.\dev-start-android.ps1
```

Dafür werden Android Studio mit Android SDK sowie `adb` und `emulator.exe`
im `PATH` benötigt. Das Skript prüft die Drittanbieter-Lizenzen, baut und
synchronisiert die App, startet standardmäßig den Emulator `Pixel_8` und
installiert die Debug-App.

Einen anderen vorhandenen Android-Emulator auswählen:

```powershell
.\dev-start-android.ps1 -EmulatorName <AVD-Name>
```

Mit `-ResetAppData` werden vor dem Start zusätzlich die vorhandenen App-Daten
gelöscht.

Alternativ kann das Android-Projekt synchronisiert und in Android Studio
geöffnet werden:

```powershell
pnpm run android:sync
pnpm run android:open
```

## Qualitätssicherung

Alle Qualitätsprüfungen ausführen:

```powershell
pnpm run check
```

Einzelne Prüfungen:

```powershell
pnpm run typecheck
pnpm run biome:check
pnpm run lint
pnpm test
pnpm run test:watch
```

## Lizenz

Copyright (C) 2026 Jens Aßmus

Diese Software ist ausschließlich unter der
[GNU Affero General Public License, Version 3](./LICENSE) veröffentlicht.

SPDX-License-Identifier: `AGPL-3.0-only`

Die Lizenzhinweise der Produktionsabhängigkeiten stehen in
[`THIRD_PARTY_LICENSES.txt`](./THIRD_PARTY_LICENSES.txt) und sind in der App
unter **Einstellungen → Über → Open-Source-Lizenzen** offline einsehbar.

Nach Änderungen an npm- oder Android-Abhängigkeiten wird die Datei neu erzeugt:

```powershell
pnpm run licenses:generate
```

Der Generator liest die installierten npm-Pakete, ermittelt die tatsächlich in
den Android-Release-Build aufgenommenen AAR- und JAR-Artefakte, prüft deren
Maven-POM-Lizenzangaben und übernimmt eingebettete Lizenz- und Hinweisdateien.
Für den Abruf der Maven-POMs ist eine Internetverbindung erforderlich.

Prüfen, ob die eingecheckte Datei aktuell ist:

```powershell
pnpm run licenses:check
```

---

**Navigation:**
Projektübersicht | [Benutzerhandbuch](./docs/benutzerhandbuch.md) | [Entwicklerhandbuch](./docs/entwicklerhandbuch.md) | [Modulübersicht](./docs/moduluebersicht.md)
