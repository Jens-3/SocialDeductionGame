# Entwicklerhandbuch

## 1. Zweck und Abgrenzung

Dieses Handbuch beschreibt die Einrichtung der Entwicklungsumgebung,
verbindliche Architekturregeln, typische Entwicklungsabläufe sowie Build-,
Release- und Testverfahren.

Andere Informationen stehen bewusst in getrennten Dokumenten:

- [Benutzerhandbuch](benutzerhandbuch.md): Bedienung und sichtbares Verhalten
  der App;
- [Modulübersicht](moduluebersicht.md): Zuständigkeiten der Quellmodule,
  zentrale Verträge und Datenflüsse;
- [Projektübersicht](../../README.md): Kurzüberblick und Schnellstart.

Änderungen an Bedienabläufen werden im Benutzerhandbuch dokumentiert. Neue
Module, verschobene Zuständigkeiten und schichtübergreifende Datenflüsse werden
in der Modulübersicht nachgeführt.

## 2. Architekturregeln

Das Projekt verwendet TypeScript im Strict-Modus. Fachfunktionen werden direkt
aus ihrem verantwortlichen Modul importiert; es gibt keine zentrale
Barrel-Datei.

Die Schichten dürfen nur in den vorgesehenen Richtungen voneinander abhängen:

- `shared` importiert keine andere Projektschicht.
- `domain` verwendet nur Domain-Module und `shared`.
- `serialization` darf `domain` und `shared` verwenden, aber keine
  Laufzeit-, Storage-, Application- oder GUI-APIs.
- `persistence` verwendet Domain, Serialization und die eigenen Ports, jedoch
  weder Application noch konkrete Adapter.
- `application` koordiniert Domain und Persistence-Verträge. Sie importiert
  weder GUI noch konkrete Storage-, Platform- oder Capacitor-Adapter.
- Module unter `application/internal` sind privat. Andere Schichten importieren
  nur öffentliche Module direkt unter `application` oder dessen Ports.
- `gui` greift schichtübergreifend ausschließlich auf öffentliche
  Application-Module und fachlich neutrale Hilfen aus `shared` zu.
- `storage` implementiert Datei-Ports aus `persistence/ports` sowie Bild- und
  Einstellungsports aus `application/ports`.
- `platform` implementiert ausgewiesene technische Ports aus Domain oder
  Application und erzeugt keine Application-Services.
- Nur `src/bootstrapApplication.tsx` darf GUI, Application und konkrete Adapter
  gemeinsam auswählen und verdrahten; `src/main.tsx` startet ausschließlich
  diesen Bootstrap.

Öffentliche Use-Case-Verträge liegen in `*UseCaseContracts.ts`. Die
`*UseCases.ts`-Fassaden re-exportieren diese Verträge und die jeweilige interne
Factory. Interne Implementierungen importieren das Vertragsmodul und nicht ihre
eigene Fassade; so entstehen keine Zyklen zwischen Vertrag und Verdrahtung.

Die Architekturregeln werden von
`tests/architectureBoundaries.test.ts` und
`tests/applicationContracts.test.ts` abgesichert:

```powershell
pnpm run architecture:check
```

Änderungen an Serialization werden zusätzlich mit den Format-, Codec-,
Import-, Export- und Reparaturverträgen geprüft:

```powershell
pnpm run serialization:check
```

## 3. Entwicklungsumgebung

### 3.1 Voraussetzungen

Die Engine-Anforderungen des Lockfiles unterstützen derzeit Node.js
`^22.22.2`, `^24.15.0` oder `>=26.0.0`. Das Projekt verwendet pnpm
`11.24.0`; `package.json` fixiert diese Version im Feld `packageManager`.
`pnpm-lock.yaml` ist das maßgebliche Lockfile.

Abhängigkeiten und Entwicklungswerkzeuge werden lokal im Projekt installiert:

```powershell
pnpm install
pnpm add <paket>
pnpm add --save-dev <paket>
```

Globale Installationen von React, Vite, TypeScript, ESLint, Biome, Vitest oder
deren Plugins sind nicht erforderlich. Die Projektskripte verwenden die lokal
festgelegten Versionen.

### 3.2 Webentwicklung

```powershell
pnpm run dev
```

Vite bindet an `127.0.0.1`; die Standardadresse ist
`http://127.0.0.1:5173/`.
Fehlt `dev-data/library.json`, kopiert der Start sie automatisch aus
`app-seed`. Eine vorhandene Entwicklungs-Library lässt sich einschließlich
ihrer temporären Recovery- und Backup-Dateien gezielt zurücksetzen:

```powershell
pnpm run dev --reset-library
```

Spielstände, Vorlagen und andere Entwicklungsdaten bleiben dabei erhalten.

Der Produktions-Build wird mit folgendem Befehl erzeugt:

```powershell
pnpm run build
```

Der Befehl prüft die GUI-Typen, erzeugt `dist` und kopiert den
Capacitor-Startbestand. Er erzeugt weder APK noch AAB.

## 4. Entwicklungskonventionen

### 4.1 IDs und Referenzen

Reguläre Fach-IDs folgen grundsätzlich diesem Muster:

```text
^[a-z][a-z0-9_]*$
```

Die Präfixe zeigen den Bereich der ID:

| Präfix | Bedeutung |
| --- | --- |
| `t_` | Team |
| `r_` | Rolle |
| `p_` | Spieler |
| `d_` | Statusdefinition |
| `s_` | Statusinstanz |
| `game_` | Spiel |
| `template_` | Vorlage |
| `log_` | Logeintrag |
| `ruleset_` | Regelwerk |
| `x_` | ausdrücklich generischer Bereich |

`t_unknown` ist für das System-Team reserviert. `p_empty` ist ein
mehrfach erlaubter Platzhalter in `seatOrder` und darf keine echte
`Player`-ID sein. Sichtbare Namen und interne Dateinamen werden nicht als
Referenzschlüssel verwendet.

Statusdefinitionen und Statusinstanzen besitzen getrennte IDs. Mehrere
Instanzen dürfen auf dieselbe Definition verweisen.

### 4.2 Namen und Sprachen

Das Feld `name` bleibt bei Regelwerken, Teams, Rollen, Spielern und
Statusdefinitionen verpflichtend. Optionale Übersetzungen liegen in `names`
und verwenden Sprach- beziehungsweise Gebietscodes als Schlüssel.

Domain-Funktionen erhalten die gewünschte Sprache explizit. Globale
Konfiguration und gespeicherte Einstellungen werden nicht in die Domain
importiert. Neue GUI-Texte werden im typisierten Katalog
`src/gui/i18n/messages.ts` ergänzt und in jedem Locale-Modul bereitgestellt.
Die Schlüsselreihenfolge wird automatisch geprüft.

### 4.3 Zustandsänderungen

Reguläre Bearbeitungs-, Sitz-, Zeit- und Verteilungsfunktionen liefern meist
einen neuen `GameState`. Der Aufrufer übernimmt den Rückgabewert:

```ts
const result = editPlayer(game, {
  playerId: "p_player1",
  name: "Erika",
});

game = result.game;
```

Reparaturfunktionen und Spieleraktionen können den übergebenen Zustand
kontrolliert verändern. Der jeweilige Vertrag muss im Typ, im Modul und in
Tests eindeutig sein. Lesende Präsentations- und Lokalisierungsfunktionen
mutieren ihre Eingaben nicht.

### 4.4 Fehler, Warnungen und Recovery

- Programmierfehler und ungültige Eingabestrukturen führen zu Exceptions.
- Erwartbare fachliche Konflikte werden als typisierte Ergebnisse oder
  Warnungen zurückgegeben.
- Technische Fehler werden an der Schichtgrenze übersetzt; GUI-Code wertet
  keine Storage- oder Serialization-Exceptions direkt aus.
- Ein abgebrochener Import oder Export ist kein technischer Fehler.
- Reparaturen müssen idempotent sein und dürfen gültige Daten nicht unnötig
  verändern.
- Ein fehlgeschlagener Schreibvorgang darf weder als Erfolg erscheinen noch
  einen veralteten Sessionzustand als gespeichert markieren.

## 5. Typische Entwicklungsabläufe

### 5.1 Fachliche Funktion ergänzen

1. Zuständigkeit anhand der Modulübersicht bestimmen.
2. Fachliche Regel in Domain oder Application implementieren.
3. Öffentliche Typen nur in der zuständigen Schicht veröffentlichen.
4. Standardfall, Grenzfälle, Warnungen und Mutationsvertrag testen.
5. Bei sichtbarem Verhalten das Benutzerhandbuch aktualisieren.
6. Bei neuen Modulen oder Datenflüssen die Modulübersicht aktualisieren.

### 5.2 Persistentes Feld oder Dokumentformat ändern

Ein persistentes Feld wird nicht nur am Domain-Modell ergänzt. Zu prüfen sind
Draft, Decoder, Validierung, Reparatur, Export, Versionsbehandlung und
Roundtrip-Tests. Fremde JSON-Werte dürfen nie direkt als Domain-Objekte
gecastet werden.

Bei einer inkompatiblen Formatänderung ist eine neue Schemaversion mit
eindeutiger Versionsprüfung erforderlich. Golden Files werden bewusst geprüft
und nicht nebenbei durch Formatter oder Tests neu geschrieben.

Anschließend mindestens ausführen:

```powershell
pnpm run serialization:check
pnpm run check
pnpm run build
```

### 5.3 Lokalisierung ändern

Neue Nachrichtenschlüssel zuerst im Nachrichtenvertrag und danach in den
Locale-Modulen ergänzen. Die kanonische Reihenfolge wird mit folgenden
Befehlen gepflegt:

```powershell
pnpm run i18n:order
pnpm run i18n:order:check
```

Die `i18n:generate-*`-Skripte sind gezielte Wartungswerkzeuge. Vor einer
schreibenden Ausführung den zugehörigen `probe`- oder `check`-Befehl verwenden,
sofern vorhanden. Abgeschlossene einmalige Wartungswerkzeuge liegen mit einer
Begründung unter `archive/scripts`.

### 5.4 Entwicklungsdaten

`dev-data` ist ausschließlich für lokale Entwicklung vorgesehen.
Produktionsdaten stammen aus `app-seed`. Dessen Manifest listet alle
auszuliefernden Daten und Bildressourcen explizit auf; nicht gelistete oder
fehlende Dateien lassen den Build abbrechen. Der Web-Entwicklungsserver legt
`dev-data` bei Bedarf an und ergänzt daraus fehlende Startdaten, ohne vorhandene
Entwicklungsdaten zu überschreiben.

## 6. Capacitor und Android

### 6.1 Voraussetzungen und Synchronisierung

Die App verwendet Capacitor 8. `capacitor.config.ts` definiert die Paket-ID
`io.github.jens_3.socialdeductiongame` und `dist` als Web-Ausgabe. Das native
Projekt liegt unter `android`.

Kommandozeilen-Builds benötigen:

- Android SDK und Build-Tools;
- `sdk.dir` in `android/local.properties`;
- ein vollständiges JDK `^21.0.10`;
- `JAVA_HOME` auf dieses JDK;
- `java`, `javac`, `keytool` und `jarsigner` im `PATH`;
- für Emulatorläufe zusätzlich `adb` und `emulator` im `PATH`.

Nach Änderungen am Web-Code oder an Capacitor-Plugins wird das native Projekt
neu synchronisiert:

```powershell
pnpm run android:sync
pnpm run android:open
```

`android:sync` führt zuerst den Web-Build aus. Plattform-Plugins werden nur in
`src/platform` oder `src/storage` angesprochen; Application und GUI verwenden
deren Ports.

### 6.2 Entwicklungsstart auf einem Emulator

```powershell
.\dev-start-android.ps1
```

Das Skript prüft die Drittanbieter-Lizenzen, baut und synchronisiert die App,
startet bei Bedarf den AVD `Pixel_8`, wartet auf den vollständigen Boot und
installiert die App. Ein anderer AVD wird so gewählt:

```powershell
.\dev-start-android.ps1 -EmulatorName Pixel_10_Pro
```

Vorhandene App-Daten bleiben standardmäßig erhalten. Für einen Test mit dem
Startbestand kann der private App-Speicher bewusst gelöscht werden:

```powershell
.\dev-start-android.ps1 -ResetAppData
```

Dieser Schalter löscht alle in der App angelegten Spiele, Vorlagen und
Einstellungen.

Nach Änderungen an npm- oder Android-Laufzeitabhängigkeiten wird der
Lizenzbestand getrennt aktualisiert:

```powershell
.\update-third-party-licenses.ps1
```

Der normale Entwicklungsstart und `pnpm run licenses:check` verändern
`THIRD_PARTY_LICENSES.txt` nicht.

### 6.3 Native Startdaten und Ressourcen

Der Produktions-Build kopiert nur die in `app-seed/manifest.json`
aufgeführten Dateien. Veränderbare Datendateien werden beim ersten nativen
Start in den privaten App-Speicher übernommen und später nicht erneut
eingespielt. Unveränderliche Bildressourcen verbleiben im Bundle.

Launcher-Icons liegen als Android-Ressourcen unter
`android/app/src/main/res/mipmap-*`. Quellen und reproduzierbare
Erzeugungsskripte befinden sich unter `dev-data/assets/icons`. Generierte
Ressourcen werden nicht manuell einzeln bearbeitet.

### 6.4 Signierter Release

Die Upload-Signatur wird außerhalb des Repositorys in der
benutzerspezifischen Gradle-Konfiguration hinterlegt:

```properties
socialDeductionUploadStoreFile=<absoluter Keystore-Pfad>
socialDeductionUploadStorePassword=<Store-Passwort>
socialDeductionUploadKeyAlias=<Schlüsselalias>
socialDeductionUploadKeyPassword=<Schlüsselpasswort>
```

Keystore und Passwörter dürfen nicht in das Repository gelangen. Der
vollständige Release läuft über:

```powershell
.\build-release-android.ps1
```

Das Skript leert ausschließlich `release-artifacts`, prüft Lockfile,
Qualität und Lizenzen, bereinigt und synchronisiert den Android-Build, führt
Android Lint aus, baut die Artefakte und prüft deren Signaturen. Bei Erfolg
enthält das Verzeichnis exakt:

- `app-debug.apk`;
- `social-deduction-game-<Version>.apk`;
- `social-deduction-game-<Version>.aab`.

Das AAB ist für Google Play vorgesehen, das Release-APK für direkte
Verteilung. Das Skript gibt SHA-256 und Größe jedes Artefakts aus.

### 6.5 Instrumentierter Release-Smoke-Test

```powershell
.\test-release-android.ps1
```

Der Test baut standardmäßig einen vollständigen Release und prüft
`releaseSmoke` auf den vorhandenen AVDs `Pixel_8` und `Pixel_10_Pro`. Andere
AVDs können angegeben werden:

```powershell
.\test-release-android.ps1 -EmulatorNames Pixel_8
```

Die Emulatoren laufen flüchtig, schreibgeschützt und ohne Fenster. Berichte
liegen unter
`android/app/build/reports/release-smoke/<AVD-Name>/index.html`.
`-SkipBuild` ist nur zulässig, wenn im selben Arbeitsstand bereits ein
aktueller synchronisierter Release-Build vorliegt.

## 7. Qualitätssicherung

Der vollständige Projektcheck lautet:

```powershell
pnpm run check
```

Er führt in dieser Reihenfolge aus:

1. TypeScript-Prüfung für Quellcode, GUI und Tests;
2. Prüfung der Schlüsselreihenfolge aller GUI-Lokalisierungen;
3. Biome-Prüfung;
4. ESLint-Prüfung;
5. vollständige Vitest-Suite;
6. Prüfung der npm- und Android-Drittanbieter-Lizenzen.

Die Lizenzprüfung ermittelt Android-Artefakte über Gradle. Der Gesamtcheck
benötigt deshalb neben Node.js und pnpm auch die unter Abschnitt 6.1
beschriebene JDK- und SDK-Konfiguration.

Einzelprüfungen:

```powershell
pnpm run typecheck
pnpm run i18n:order:check
pnpm run biome:check
pnpm run lint
pnpm test
pnpm run test:watch
pnpm run licenses:check
```

Vor Abschluss einer Änderung werden mindestens `pnpm run check` und
`pnpm run build` ausgeführt. Bei rein dokumentarischen Änderungen genügt der
Dokument-Lint, sofern keine Projektkonfiguration oder generierte Datei berührt
wurde.

## 8. Tests

Die Tests unter `tests` spiegeln die Fach- und Anwendungsmodule.
`tests/fixtures.ts` erzeugt kleine konsistente Regelwerke und reproduzierbare
Spielstände.

Neue oder geänderte Logik deckt passend zum Vertrag ab:

- erfolgreichen Standardfall und relevante Varianten;
- fehlende Referenzen und ID-Kollisionen;
- Warnungen, erwartete Fehler und unerwartete Fehler;
- Mutation oder Unveränderlichkeit;
- Roundtrips bei persistenten Feldern;
- Schemaversionen und ungültige Dokumenttypen;
- Idempotenz von Reparaturen;
- fehlende optionale Adapterfähigkeiten.

Storage-Tests arbeiten in temporären Verzeichnissen und verändern weder
`dev-data` noch eine echte Entwicklungs-Library. Tests für Imports und Exporte
prüfen nach Möglichkeit auch Dateiname, Bytes und Abbruchverhalten.

---

**Navigation:**
[Projektübersicht](../../README.md) | [Benutzerhandbuch](benutzerhandbuch.md) | Entwicklerhandbuch | [Modulübersicht](moduluebersicht.md)
