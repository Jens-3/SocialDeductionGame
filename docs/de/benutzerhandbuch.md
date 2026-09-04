# Benutzerhandbuch

Zur übrigen Projektdokumentation führt die [Projektübersicht](../../README.md).

## 1. Zweck der App

Social Deduction Game unterstützt Spielleitungen bei Spielen wie Werwolf,
Mafia und anderen Social-Deduction-Varianten. Die App verwaltet Regelwerke,
Vorlagen und laufende Spiele vollständig offline.

Mit der App lassen sich insbesondere:

- Spieler, Teams, Rollen und Zustände verwalten;
- Rollen zufällig oder manuell verteilen;
- Rollen einzeln im Vollbild zeigen;
- Sitzordnung, Lebensstatus und Zustände während des Spiels pflegen;
- Nachtaktionen in der vorgesehenen Reihenfolge abarbeiten;
- Spielstände, Vorlagen und Regelwerke sichern und übertragen.

## 2. Grundbegriffe

- **Regelwerk:** Enthält Teams, Rollen, Zustände und Regeln für ein Spiel.
- **Vorlage:** Ein vorbereiteter Spielaufbau mit Spielern und optional bereits
  zugewiesenen Rollen.
- **Spielstand:** Ein laufendes oder vorbereitetes Spiel einschließlich
  Sitzordnung, Rollen, Zuständen und aktueller Spielphase.
- **Library:** Die interne Sammlung aller Regelwerke.
- **Tatsächliche Rolle:** Die Rolle, welche die Spiellogik für einen Spieler
  verwendet.
- **Gezeigte Rolle:** Die Rolle, welche dem Spieler bei der Rollenanzeige
  präsentiert wird.
- **Nachtrolle:** Die Rolle, welche die Position in der Nachtliste bestimmt.
- **Behauptete Rolle:** Eine optionale, öffentlich behauptete Rolle.

## 3. Hauptmenü und Navigation

Vom Hauptmenü aus können ein neues Spiel vorbereitet, ein gespeichertes Spiel
geladen, Szenarien verwaltet und die Einstellungen geöffnet werden. Solange ein
Spiel im Arbeitsspeicher liegt, steht außerdem „Spiel fortsetzen“ zur
Verfügung.

Die Zurück-Funktion von Android entspricht grundsätzlich dem sichtbaren
Zurück-Button. Bei offenen Dialogen schließt sie zuerst den Dialog. Ungespeicherte
Änderungen werden nicht ohne Rückfrage verworfen.

Beim Beenden der App erscheint im Hauptmenü eine Bestätigung. Im Browser wird
anstelle eines nativen App-Endes eine Abschlussansicht mit einer Möglichkeit
zum Neustart gezeigt.

## 4. Szenarien verwalten

Unter „Szenarien verwalten“ werden Regelwerke und Vorlagen getrennt angezeigt.
Es erscheinen nur tatsächlich gespeicherte Einträge; leere Kategorien enthalten
keine Beispiel- oder Platzhalterkarten.

### 4.1 Regelwerk oder Vorlage öffnen

Ein Klick auf eine Karte öffnet den Vollbild-Editor. Änderungen bleiben
zunächst in einer Arbeitskopie. Erst „Änderung speichern“ schreibt sie in den
internen Speicher.

Der Editor bietet je nach Szenario:

- Teams mit Name und optionaler Farbe;
- Rollen mit Team, Nachtposition, Eindeutigkeit, Symbol und Fähigkeiten;
- Statusdefinitionen mit Standarddauer;
- bei Vorlagen zusätzlich Spieler, Sitzplätze und Rollenzuordnungen.

„Übernehmen“ übernimmt ein bearbeitetes Detail in die Arbeitskopie. Der
Schließen-Button des Detailformulars verwirft dagegen nur die noch nicht
übernommenen Formulareingaben.

Beim Verlassen eines geänderten Editors stehen „Speichern & Beenden“, „Beenden
ohne Speichern“ und „Abbrechen“ zur Verfügung. Nach einem Speicherfehler bleibt
der Editor geöffnet.

### 4.2 Neues Regelwerk erstellen

„＋ Erstellen“ legt eine neue, noch nicht gespeicherte Regelwerk-Arbeitskopie
an. Teams, Rollen und Zustände können anschließend im normalen Editor ergänzt
werden. Zurückgehen ohne Speichern verwirft das neue Regelwerk vollständig.

### 4.3 Aktionen im Drei-Punkte-Menü

- **Umbenennen:** Ändert Namen und interne Identität des Eintrags. Bei einer
  Namenskollision bleibt das Original unverändert.
- **Duplizieren:** Erstellt eine unabhängige Kopie mit einem freien
  Namensvorschlag.
- **Exportieren:** Speichert das ausgewählte Regelwerk beziehungsweise die
  Vorlage als externe Datei.
- **Löschen:** Entfernt den Eintrag nach einer Sicherheitsabfrage.

### 4.4 Regelwerk oder Vorlage importieren

Beim Import prüft die App Dateityp, Version und Inhalt. Ist der vorgeschlagene
Name bereits belegt, kann je nach Situation überschrieben, eine Kopie behalten
oder abgebrochen werden. Reparierbare ältere oder beschädigte Dokumente werden
nur nach einer ausdrücklichen Entscheidung übernommen.

## 5. Neues Spiel vorbereiten

„Neues Spiel“ beginnt mit der Auswahl eines Regelwerks oder einer Vorlage.
Danach werden Spielerzahl und Spielname festgelegt.

Für die Rollenverteilung stehen drei Wege zur Verfügung:

1. **Zufällige Rollen nach Teamzahlen:** Für jedes Team wird die gewünschte
   Spielerzahl festgelegt. Die Verteilung kann beginnen, sobald keine freien
   Spieler mehr verbleiben.
2. **Ausgewählte Rollen zufällig verteilen:** Einzelne Rollen und ihre Anzahl
   werden gewählt. Ein Warndreieck weist darauf hin, wenn eine als eindeutig
   markierte Rolle mehrfach ausgewählt wurde.
3. **Rollen manuell verteilen:** Das Spiel wird ohne automatische
   Rollenzuweisung geöffnet und anschließend im Spielbildschirm bearbeitet.

Bei einer Vorlage werden deren Spieler und Einstellungen als unabhängige Kopie
übernommen. Die gespeicherte Vorlage selbst wird dadurch nicht verändert.

## 6. Der Spielbildschirm

Der Spielbildschirm besteht aus Sitzkreis, Zeitsteuerung und Detailbereich. Im
Querformat werden Sitzkreis und Details nebeneinander angeordnet; im Hochformat
liegen sie untereinander.

### 6.1 Sitzkreis

Sitz 1 liegt standardmäßig oben, weitere Sitze folgen im Uhrzeigersinn. Diese
beiden Vorgaben können in den Einstellungen geändert werden.

Die wichtigsten Symbole sind:

- `○`: leerer Sitz;
- `◇`: Spieler ohne tatsächliche Rolle;
- Rollensymbol oder `◆`: lebender Spieler mit Rolle;
- `☠`: nicht lebender Spieler;
- `✦`: mindestens ein Zustand vorhanden;
- `◐`: gezeigte und tatsächliche Rolle unterscheiden sich.

Der Sitzkreis kann vergrößert, verkleinert und im vergrößerten Zustand
verschoben werden. Die Sitzordnung lässt sich nach dem Entsperren per Maus,
Touch oder Stift verändern.

Ein Klick auf einen besetzten Sitz öffnet dessen Details. Dort lassen sich
Spielername, Sitzplatz, Rollen, Lebensstatus und konkrete Zustände bearbeiten.

### 6.2 Rollen zeigen

In der Vorbereitungsphase öffnet „Rollen zeigen“ eine schrittweise
Vollbildanzeige. Zuerst wird der Spielername angezeigt, danach die für diesen
Spieler bestimmte gezeigte Rolle. So kann das Gerät weitergereicht werden,
ohne die Rollen anderer Spieler offenzulegen.

### 6.3 Spielzeit

Die App unterscheidet Vorbereitung, Nacht und Tag. In der Vorbereitung stehen
„Rollen zeigen“, „Nachtliste“ und „Weiter“ zur Verfügung. Später kann mit
„Zurück“ und „Weiter“ zwischen den Phasen gewechselt werden.

Die Häkchen der Nachtliste sind Arbeitshilfen der aktuellen App-Sitzung und
werden nicht im Spielstand gespeichert. Beim Beginn einer späteren Nacht werden
die Häkchen für den neuen Durchlauf zurückgesetzt.

### 6.4 Nachtliste und Fähigkeiten

Die Nachtliste zeigt Spieler in der für ihre Nachtrolle festgelegten
Reihenfolge. Einträge ohne positive Nachtposition erscheinen nicht.

Besitzt eine tatsächliche Rolle eine aktive Fähigkeit, öffnet ihr Rollenname
die Aktionsauswahl. Je nach Rolle stehen Töten, Wiederbeleben oder das Anwenden
eines erlaubten Zustands zur Verfügung. Als Ziel kann jeder besetzte Sitz
gewählt werden, einschließlich toter Spieler und des handelnden Spielers
selbst.

Eine erfolgreiche Aktion sperrt die Auswahl und setzt das Häkchen des
Nachtlisteneintrags. Eine Warnung lässt die Auswahl geöffnet und setzt kein
Häkchen. Abbrechen schließt die Auswahl ohne Änderung.

### 6.5 Öffentlich zu zeigende Rollen

„Rollen, die gezeigt werden“ öffnet eine eigene Liste für öffentlich sichtbare
Rollen. Rollen können mehrfach und in einer frei gewählten Reihenfolge
aufgenommen werden. Ein optionaler Hinweistext wird gemeinsam mit der Liste
angezeigt.

## 7. Spiel speichern und beenden

Das Drei-Punkte-Menü des Spielbildschirms enthält die Speicher- und
Verwaltungsaktionen.

- **Spiel speichern:** Aktualisiert den geladenen internen Spielstand.
- **Spiel speichern unter:** Legt eine neue interne Kopie unter einem freien
  Namen an und arbeitet anschließend mit dieser Kopie weiter.
- **Spiel als Vorlage speichern unter:** Erstellt aus dem aktuellen Aufbau eine
  neue Vorlage.
- **Spiel beenden:** Verlässt den Spielbildschirm. Bei ungespeicherten
  Änderungen wird vorher nachgefragt.

Das bloße Navigieren aus der Spielansicht entfernt das aktuelle Spiel nicht aus
dem Arbeitsspeicher. Es kann über „Spiel fortsetzen“ erneut geöffnet werden.

Wiederhergestellte Kopien können nicht direkt über „Spiel speichern“ das
Original ersetzen. Sie müssen zuerst über „Spiel speichern unter“ als reguläre
Kopie gesichert werden.

## 8. Gespeicherte Spiele verwalten

„Spielstand laden“ zeigt die vorhandenen Spielstände. Ein Klick lädt den
gewählten Stand. Das Drei-Punkte-Menü eines Eintrags bietet Umbenennen,
Duplizieren, Exportieren und Löschen.

Beim Laden prüft die App den vollständigen Inhalt. Beschädigte oder
unvollständige Dateien werden nicht stillschweigend übernommen. Soweit möglich,
bietet die App Reparatur, Wiederherstellung einer Sicherung, Export der
Originaldatei oder eine spätere Entscheidung an.

## 9. Library sichern und wiederherstellen

Unter „Einstellungen → Daten“ stehen zwei zentrale Aktionen zur Verfügung:

- **Backup erstellen:** Exportiert die vollständige aktuelle Regelwerk-Library
  als `library_backup.json`.
- **Bibliothek wiederherstellen:** Prüft eine ausgewählte Backup-Datei und
  zeigt vor dem Ersetzen eine Vorschau.

Ungültige einzelne Regelwerke werden in der Vorschau aufgeführt. Erst nach der
Bestätigung wird die interne Library ersetzt. Ein Fehler vor oder während der
Prüfung verändert die bestehende Library nicht.

Kann die interne Library beim Start nicht gelesen werden, bietet die App je
nach vorhandenen Daten folgende Möglichkeiten:

- eine gültige interne Sicherung wiederherstellen;
- die ursprüngliche Library reparieren;
- eine leere Library neu erstellen;
- die unveränderte Originaldatei exportieren;
- die Entscheidung verschieben und vorübergehend mit einer leeren Library
  weiterarbeiten.

„Später entscheiden“ überschreibt die beschädigte Datei nicht. Die Entscheidung
kann in derselben App-Sitzung erneut aufgerufen werden.

## 10. Einstellungen

Die Einstellungen umfassen:

- App-Sprache oder Systemsprache;
- System-, helles oder dunkles Farbschema;
- kleine, normale oder große Textdarstellung;
- reduzierte Bewegung;
- abgelaufene Zustände ausblenden;
- Sitzordnung standardmäßig entsperren;
- den ersten oder letzten Sitzplatz oben ausrichten;
- Sitzreihenfolge im oder gegen den Uhrzeigersinn;
- Rollensymbole anzeigen;
- Bildschirm während des Spiels wach halten;
- haptisches Feedback;
- automatische Bildschirmdrehung.

Änderungen werden zunächst als Vorschau angewendet. Sie werden beim Wechsel
zum Hauptmenü gespeichert. Schlägt das Speichern fehl, kann es erneut versucht
oder für diesen Zeitpunkt abgebrochen werden.

## 11. Import, Export und Teilen

Regelwerke, Vorlagen, Spielstände und Library-Backups können als Dateien
exportiert werden. Auf Android steht zusätzlich die Systemfunktion zum Teilen
zur Verfügung. Exporte verändern die internen Daten nicht.

Beim Import werden Dateiname und Speicherort durch den Android- beziehungsweise
Browser-Dateidialog bestimmt. Die App zeigt keine absoluten lokalen
Browser-Dateipfade an.

## 12. Datenschutz und Offline-Nutzung

Die App ist für die vollständige Offline-Nutzung ausgelegt. Interne
Spielstände, Vorlagen, Regelwerke und Einstellungen liegen im privaten
App-Speicher. Externe Dateien entstehen nur durch eine ausdrücklich gewählte
Import-, Export-, Backup- oder Teilen-Aktion.

Beim Zurücksetzen der App-Daten durch Android werden alle internen
Spielstände, Vorlagen, Regelwerke und Einstellungen gelöscht. Extern
exportierte Sicherungen bleiben davon unberührt.

---

**Navigation:**
[Projektübersicht](../../README.md) | Benutzerhandbuch | [Entwicklerhandbuch](entwicklerhandbuch.md) | [Modulübersicht](moduluebersicht.md)
