# User Guide

For the rest of the project documentation, see the
[project overview](../../README.md).

## 1. Purpose of the App

Social Deduction Game assists moderators in games such as Werewolf, Mafia, and
other social-deduction variants. The app manages rule sets, templates, and
ongoing games entirely offline.

In particular, the app can be used to:

- manage players, teams, roles, and statuses;
- assign roles randomly or manually;
- show roles individually in full-screen mode;
- maintain the seating order, life states, and statuses during the game;
- process night actions in their intended order;
- back up and transfer saved games, templates, and rule sets.

## 2. Basic Terms

- **Rule set:** Contains the teams, roles, statuses, and rules for a game.
- **Template:** A prepared game setup with players and, optionally, roles that
  have already been assigned.
- **Saved game:** An ongoing or prepared game, including its seating order,
  roles, statuses, and current game phase.
- **Library:** The internal collection of all rule sets.
- **Actual role:** The role used by the game logic for a player.
- **Shown role:** The role presented to the player when roles are revealed.
- **Night role:** The role that determines the position in the night list.
- **Claimed role:** An optional role that is publicly claimed by a player.

## 3. Main Menu and Navigation

From the main menu, you can prepare a new game, load a saved game, manage
scenarios, and open the settings. As long as a game remains in memory,
"Continue game" is also available.

The Android back action generally corresponds to the visible Back button. If a
dialog is open, it closes the dialog first. Unsaved changes are not discarded
without confirmation.

When you exit the app from the main menu, a confirmation appears. In the
browser, an exit screen with an option to restart is shown instead of closing a
native app.

## 4. Managing Scenarios

Under "Manage scenarios," rule sets and templates are displayed separately.
Only entries that have actually been saved are shown; empty categories do not
contain example or placeholder cards.

### 4.1 Opening a Rule Set or Template

Selecting a card opens the full-screen editor. Changes initially remain in a
working copy. They are written to internal storage only when you select "Save
change."

Depending on the scenario, the editor provides:

- teams with a name and optional color;
- roles with a team, night position, uniqueness setting, symbol, and abilities;
- status definitions with a default duration;
- for templates, additional players, seats, and role assignments.

"Apply" transfers an edited detail to the working copy. By contrast, the close
button in the detail form discards only form input that has not yet been
applied.

When leaving a modified editor, "Save and exit," "Exit without saving," and
"Cancel" are available. The editor remains open after a save error.

### 4.2 Creating a New Rule Set

"＋ Create" creates a new, unsaved rule-set working copy. Teams, roles, and
statuses can then be added in the regular editor. Going back without saving
discards the new rule set completely.

### 4.3 Actions in the Three-Dot Menu

- **Rename:** Changes the entry's name and internal identity. If the name
  conflicts with an existing entry, the original remains unchanged.
- **Duplicate:** Creates an independent copy with an available name
  suggestion.
- **Export:** Saves the selected rule set or template as an external file.
- **Delete:** Removes the entry after a confirmation prompt.

### 4.4 Importing a Rule Set or Template

During import, the app checks the file type, version, and contents. If the
suggested name is already in use, you can overwrite the existing entry, keep a
copy, or cancel, depending on the situation. Repairable older or damaged
documents are accepted only after an explicit decision.

## 5. Preparing a New Game

"New game" begins with the selection of a rule set or template. You then set
the number of players and the game name.

There are three ways to assign roles:

1. **Random roles by team counts:** Set the desired number of players for each
   team. Assignment can begin once no unassigned players remain.
2. **Randomly assign selected roles:** Select individual roles and their
   quantities. A warning triangle indicates when a role marked as unique has
   been selected more than once.
3. **Assign roles manually:** The game opens without automatic role assignment
   and can then be edited on the game screen.

When using a template, its players and settings are copied into an independent
game. The saved template itself is not changed.

## 6. The Game Screen

The game screen consists of the seating circle, time controls, and a detail
area. In landscape orientation, the seating circle and details appear side by
side; in portrait orientation, they appear one below the other.

### 6.1 Seating Circle

By default, seat 1 is at the top and the remaining seats continue clockwise.
Both settings can be changed in the app settings.

The most important symbols are:

- `○`: empty seat;
- `◇`: player without an actual role;
- role symbol or `◆`: living player with a role;
- `☠`: player who is not alive;
- `✦`: at least one status is present;
- `◐`: shown role and actual role differ.

The seating circle can be zoomed in and out and panned while enlarged. After
the seating order has been unlocked, it can be changed with a mouse, touch, or
pen.

Selecting an occupied seat opens its details. There you can edit the player
name, seat, roles, life state, and individual statuses.

### 6.2 Showing Roles

During the setup phase, "Show roles" opens a step-by-step full-screen view. It
first displays the player's name and then the shown role intended for that
player. This allows the device to be passed around without revealing other
players' roles.

### 6.3 Game Time

The app distinguishes between setup, night, and day. During setup, "Show
roles," "Night list," and "Next" are available. Later, "Back" and "Next" can
be used to move between phases.

The check marks in the night list are working aids for the current app session
and are not saved in the game. When a later night begins, the check marks are
reset for the new pass.

### 6.4 Night List and Abilities

The night list shows players in the order defined by their night roles. Entries
without a positive night position are omitted.

If an actual role has an active ability, selecting its role name opens the
action selection. Depending on the role, the available actions are killing,
resurrecting, or applying an allowed status. Any occupied seat can be selected
as the target, including dead players and the acting player.

A successful action locks the selection and checks the night-list entry. A
warning leaves the selection open and does not set a check mark. Cancel closes
the selection without making a change.

### 6.5 Roles to Be Shown Publicly

"Roles to be shown" opens a separate list of publicly visible roles. Roles can
be added more than once and arranged in any order. An optional notice is shown
together with the list.

## 7. Saving and Exiting a Game

The three-dot menu on the game screen contains the save and management
actions.

- **Save game:** Updates the loaded internal saved game.
- **Save game as:** Creates a new internal copy under an available name and
  continues working with that copy.
- **Save game as template:** Creates a new template from the current setup.
- **Exit game:** Leaves the game screen. If there are unsaved changes, the app
  asks for confirmation first.

Simply navigating away from the game view does not remove the current game from
memory. It can be reopened through "Continue game."

Recovered copies cannot overwrite the original directly through "Save game."
They must first be stored as a regular copy through "Save game as."

## 8. Managing Saved Games

"Load game" shows the available saved games. Selecting an entry loads it. The
three-dot menu for an entry provides Rename, Duplicate, Export, and Delete.

When loading, the app checks the complete contents. Damaged or incomplete files
are not accepted silently. Where possible, the app offers repair, restoration
from a backup, export of the original file, or the option to decide later.

## 9. Backing Up and Restoring the Library

Two central actions are available under "Settings → Data":

- **Create backup:** Exports the complete current rule-set library as
  `library_backup.json`.
- **Restore library:** Checks a selected backup file and displays a preview
  before replacing the library.

Invalid individual rule sets are listed in the preview. The internal library
is replaced only after confirmation. An error before or during validation does
not change the existing library.

If the internal library cannot be read at startup, the app offers the following
options depending on the available data:

- restore a valid internal backup;
- repair the original library;
- create a new empty library;
- export the unchanged original file;
- postpone the decision and temporarily continue with an empty library.

"Decide later" does not overwrite the damaged file. The decision can be opened
again during the same app session.

## 10. Settings

The settings include:

- app language or system language;
- system, light, or dark color scheme;
- small, standard, or large text;
- reduced motion;
- hiding expired statuses;
- unlocking the seating order by default;
- aligning the first or last seat at the top;
- clockwise or counterclockwise seating order;
- showing role symbols;
- keeping the screen awake during the game;
- haptic feedback;
- automatic screen rotation.

Changes are initially applied as a preview. They are saved when you return to
the main menu. If saving fails, it can be retried or canceled for the time
being.

## 11. Import, Export, and Sharing

Rule sets, templates, saved games, and library backups can be exported as
files. On Android, the system sharing function is also available. Exports do
not change internal data.

During import, the file name and storage location are determined by the Android
or browser file dialog. The app does not display absolute local browser file
paths.

## 12. Privacy and Offline Use

The app is designed for completely offline use. Internal saved games,
templates, rule sets, and settings are stored in the app's private storage.
External files are created only through an explicitly selected import, export,
backup, or sharing action.

Resetting the app data through Android deletes all internal saved games,
templates, rule sets, and settings. Externally exported backups are not
affected.

---

**Navigation:**
[Project overview](../../README.md) | User Guide | [Developer Guide](developer-guide.md) | [Module Overview](module-overview.md)
