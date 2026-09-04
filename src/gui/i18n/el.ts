import type { GuiTranslationKey } from "./de";
import type { GuiTranslationMessage } from "./messages";

export const greekGuiMessages = {
	"common.back": "Πίσω",
	"common.cancel": "Ακύρωση",
	"common.close": "Κλείσιμο",
	"common.later": "Αργότερα",
	"common.import": "Εισαγωγή",
	"common.export": "Εξαγωγή",
	"common.share": "Κοινοποίηση",
	"common.rename": "Μετονομασία",
	"common.duplicate": "Δημιουργία αντιγράφου",
	"common.delete": "Διαγραφή",
	"common.deletePermanently": "Οριστική διαγραφή",
	"common.name": "Όνομα",
	"common.unknown": "άγνωστο",
	"common.detailsParenthetical": "(Λεπτομέρειες)",
	"common.schemaVersion": "Έκδοση σχήματος",
	"common.actionsFor": "Ενέργειες για",
	"common.moreActionsFor": "Περισσότερες ενέργειες για {name}",
	"common.cancelImport": "Ακύρωση εισαγωγής",
	"common.tryRepair": "Προσπάθεια επιδιόρθωσης",
	"common.keepBoth": "Διατήρηση και των δύο",
	"common.restored": "Επαναφέρθηκε {index}",
	"common.ok": "OK",
	"common.next": "Επόμενο",
	"common.save": "Αποθήκευση",
	"common.saving": "Αποθήκευση …",
	"common.select": "Επιλογή …",
	"common.overwrite": "Αντικατάσταση",
	"common.retry": "Δοκιμή ξανά",
	"common.yes": "Ναι",
	"common.no": "Όχι",

	"home.eyebrow": "Συντονιστής παιχνιδιού",
	"home.mainMenu": "Κύριο μενού",
	"home.continueGame": "Συνέχεια παιχνιδιού",
	"home.latestSave": "Τελευταίο αποθηκευμένο παιχνίδι",
	"home.noCurrentGame": "Δεν υπάρχει διαθέσιμο τρέχον παιχνίδι",
	"home.newGame": "Νέο παιχνίδι",
	"home.loadGame": "Φόρτωση παιχνιδιού",
	"home.manageScenarios": "Διαχείριση σεναρίων",
	"home.settings": "Ρυθμίσεις",
	"home.exitApp": "Έξοδος από την εφαρμογή",
	"home.exitQuestion": "Έξοδος από την εφαρμογή;",
	"home.exitConfirm": "Έξοδος",
	"home.exitAnyway": "Έξοδος ούτως ή άλλως",
	"home.activeWrites": {
		plural: {
			one: "{count} λειτουργία αποθήκευσης είναι ακόμη ενεργή.",
			other: "{count} λειτουργίες αποθήκευσης είναι ακόμη ενεργές.",
		},
	},

	"newGame.title": "Νέο παιχνίδι",
	"newGame.startingPoint": "Σημείο εκκίνησης",
	"newGame.useRuleSet": "Χρήση συνόλου κανόνων ({count})",
	"newGame.ruleSetDetail": "Επιλέξτε νέο αριθμό παικτών και όνομα",
	"newGame.useTemplate": "Χρήση προτύπου ({count})",
	"newGame.templateDetail": "Χρήση έτοιμης ρύθμισης παιχνιδιού",
	"newGame.ruleSet": "Σύνολο κανόνων",
	"newGame.template": "Πρότυπο",
	"newGame.noEntries": "Δεν υπάρχουν διαθέσιμες καταχωρίσεις",
	"newGame.noRuleSets": "Δεν υπάρχουν διαθέσιμα σύνολα κανόνων.",
	"newGame.noTemplates": "Δεν υπάρχουν διαθέσιμα πρότυπα.",
	"newGame.playerCount": "Αριθμός παικτών",
	"newGame.gameName": "Όνομα παιχνιδιού",
	"newGame.generatedName": "Δημιουργείται αυτόματα",
	"newGame.prepare": "Προετοιμασία παιχνιδιού",
	"newGame.noRuleSetSelected": "Δεν έχει επιλεγεί σύνολο κανόνων.",
	"newGame.noTemplateSelected": "Δεν έχει επιλεγεί πρότυπο.",

	"loadGame.title": "Φόρτωση παιχνιδιού",
	"loadGame.search": "Αναζήτηση αποθηκευμένων παιχνιδιών",
	"loadGame.reading": "Ανάγνωση αποθηκευμένων παιχνιδιών …",
	"loadGame.repairImportQuestion": "Επιδιόρθωση αρχείου εισαγωγής;",
	"loadGame.alreadyExists": "Το αποθηκευμένο παιχνίδι υπάρχει ήδη",
	"loadGame.existingFile": "Υπάρχον αρχείο",
	"loadGame.importedFile": "Εισαγμένο αρχείο",
	"loadGame.overwriteExisting": "Αντικατάσταση υπάρχοντος αρχείου",
	"loadGame.players": {
		plural: {
			one: "{count} παίκτης",
			other: "{count} παίκτες",
		},
	},
	"loadGame.loading": "Φόρτωση …",
	"loadGame.noMatches":
		"Δεν βρέθηκαν αποθηκευμένα παιχνίδια που να ταιριάζουν.",
	"loadGame.deleteQuestion": "Να διαγραφεί οριστικά το «{name}»;",
	"loadGame.setup": "Ρύθμιση",
	"loadGame.night": "Νύχτα {number}",
	"loadGame.day": "Ημέρα {number}",
	"loadGame.readError":
		"Δεν ήταν δυνατή η ανάγνωση του αποθηκευμένου παιχνιδιού.",

	"scenarios.title": "Διαχείριση σεναρίων",
	"scenarios.filter": "Φιλτράρισμα σεναρίων",
	"scenarios.filter.all": "Όλα",
	"scenarios.filter.ruleSets": "Σύνολα κανόνων",
	"scenarios.filter.templates": "Πρότυπα",
	"scenarios.ruleSet": "Σύνολο κανόνων",
	"scenarios.template": "Πρότυπο",
	"scenarios.reading": "Ανάγνωση σεναρίων …",
	"scenarios.empty": "Δεν υπάρχουν διαθέσιμα σενάρια.",
	"scenarios.create": "Δημιουργία",
	"scenarios.newRuleSet": "Νέο σύνολο κανόνων",
	"scenarios.invalidRuleSet": "Μη έγκυρο σύνολο κανόνων",
	"scenarios.ruleSetMetadata":
		"Έκδοση {version} · {teams} ομάδες · {roles} ρόλοι",
	"scenarios.templateMetadata": {
		plural: {
			one: "{count} θέση · {ruleSet}",
			other: "{count} θέσεις · {ruleSet}",
		},
	},
	"scenarios.savedAt": "Αποθηκεύτηκε: {date}",
	"scenarios.newWorkingCopy": "Νέο αντίγραφο εργασίας",
	"scenarios.duplicated": "Δημιουργήθηκε αντίγραφο",
	"scenarios.detailsReading": "Ανάγνωση λεπτομερειών …",
	"scenarios.loadError": "Δεν ήταν δυνατή η φόρτωση του σεναρίου.",
	"scenarios.exportUnsupported":
		"Ο τρέχων χώρος αποθήκευσης δεν υποστηρίζει εξαγωγή.",
	"scenarios.exported": "Το «{name}» εξήχθη.",
	"scenarios.shared": "Το «{name}» κοινοποιήθηκε.",
	"scenarios.copySaved": "Το νέο αντίγραφο αποθηκεύτηκε.",
	"scenarios.changesSaved": "Οι αλλαγές αποθηκεύτηκαν.",
	"scenarios.justSaved": "Μόλις αποθηκεύτηκε",
	"scenarios.detailExported": "Το σενάριο εξήχθη.",
	"scenarios.detailShared": "Το σενάριο κοινοποιήθηκε.",
	"scenarios.deleted": "Το «{name}» διαγράφηκε.",
	"scenarios.renamed": "Μετονομάστηκε σε «{name}».",
	"scenarios.duplicatedMessage": "Δημιουργήθηκε αντίγραφο του «{name}».",
	"scenarios.restoredRestriction":
		"Ένα επαναφερμένο πρότυπο μπορεί μόνο να αντιγραφεί ή να εξαχθεί.",
	"scenarios.repairImportQuestion": "Επιδιόρθωση αρχείου εισαγωγής;",
	"scenarios.ruleSetExists": "Το σύνολο κανόνων υπάρχει ήδη",
	"scenarios.templateExists": "Το πρότυπο υπάρχει ήδη",
	"scenarios.existingObject": "Υπάρχον αντικείμενο",
	"scenarios.importedObject": "Εισαγμένο αντικείμενο",
	"scenarios.overwriteExisting": "Αντικατάσταση υπάρχοντος αντικειμένου",
	"scenarios.deleteQuestion": "Να διαγραφεί οριστικά το «{name}»;",

	"settings.title": "Ρυθμίσεις",
	"settings.general": "Γενικά",
	"settings.language": "Γλώσσα",
	"settings.language.system": "Γλώσσα συστήματος",
	"settings.appearance": "Εμφάνιση",
	"settings.theme.system": "Σύστημα",
	"settings.theme.light": "Φωτεινό",
	"settings.theme.dark": "Σκοτεινό",
	"settings.duringGame": "Κατά τη διάρκεια του παιχνιδιού",
	"settings.hideExpiredStatuses": "Απόκρυψη ληγμένων καταστάσεων",
	"settings.seatCircleNorthFirst":
		"Τοποθετήστε το πρώτο κάθισμα στην κορυφή του κυκλικού διαγράμματος καθισμάτων.",
	"settings.seatCircleNorthLast":
		"Τοποθετήστε το τελευταίο κάθισμα στην κορυφή του κυκλικού διαγράμματος καθισμάτων.",
	"settings.seatCircleClockwise": "Δεξιόστροφα",
	"settings.seatCircleCounterClockwise": "Αριστερόστροφα",
	"settings.keepScreenAwake": "Διατήρηση οθόνης ενεργής",
	"settings.hapticFeedback": "Απτική ανάδραση",
	"settings.autoRotate": "Αυτόματη περιστροφή",
	"settings.accessibility": "Προσβασιμότητα",
	"settings.textSize": "Μέγεθος κειμένου",
	"settings.textSize.small": "Μικρό",
	"settings.textSize.standard": "Τυπικό",
	"settings.textSize.large": "Μεγάλο",
	"settings.reduceMotion": "Μείωση κίνησης",
	"settings.data": "Δεδομένα",
	"settings.createBackup": "Δημιουργία αντιγράφου ασφαλείας",
	"settings.exportLibrary": "Εξαγωγή βιβλιοθήκης",
	"settings.shareBackup": "Κοινοποίηση αντιγράφου ασφαλείας",
	"settings.shareLibrary": "Αποστολή της βιβλιοθήκης μέσω άλλης εφαρμογής",
	"settings.backupShared": "Το αντίγραφο ασφαλείας κοινοποιήθηκε.",
	"settings.restoreLibrary": "Επαναφορά βιβλιοθήκης",
	"settings.replaceLibrary": "Αντικατάσταση βιβλιοθήκης",
	"settings.deleteAllData": "Διαγραφή όλων των δεδομένων",
	"settings.about": "Σχετικά",
	"settings.version": "Έκδοση",
	"settings.licenseSummaryDisclaimer":
		"Αυτή είναι μόνο μια περίληψη, όχι ένα υποκατάστατο για το πλήρες κείμενο της άδειας. Το πλήρες κείμενο της άδειας διέπει.",
	"settings.viewLicense": "Προβολή άδειας",
	"settings.copyrightHolder": "Κάτοχος πνευματικών δικαιωμάτων",
	"settings.softwareLicense": "Άδεια χρήσης λογισμικού",
	"settings.openSourceLicenses": "Άδειες ανοικτού κώδικα",
	"settings.licenseNotice":
		"Δεν παρέχεται καμία εγγύηση. Μπορείτε να χρησιμοποιήσετε, να τροποποιήσετε και να αναδιανείμετε αυτό το λογισμικό σύμφωνα με τους όρους του AGPL-3.0-only.",
	"settings.backupCreated":
		"Δημιουργήθηκε αντίγραφο ασφαλείας της βιβλιοθήκης.",
	"settings.restoreComplete": "Η βιβλιοθήκη επαναφέρθηκε πλήρως.",
	"settings.restoreDiscarded": {
		plural: {
			one: "Η βιβλιοθήκη επαναφέρθηκε. Απορρίφθηκε {count} μη έγκυρο σύνολο κανόνων.",
			other:
				"Η βιβλιοθήκη επαναφέρθηκε. Απορρίφθηκαν {count} μη έγκυρα σύνολα κανόνων.",
		},
	},
	"settings.replaceQuestion": "Αντικατάσταση ολόκληρης της βιβλιοθήκης;",
	"settings.replaceDescription":
		"Η τρέχουσα βιβλιοθήκη θα αντικατασταθεί από το «{fileName}».",
	"settings.currentStorageVersion": "Τρέχον storageVersion",
	"settings.importedStorageVersion": "Εισαγμένο storageVersion",
	"settings.unknown": "άγνωστο",
	"settings.validRuleSets": "Έγκυρα σύνολα κανόνων",
	"settings.discardedRuleSets": "Σύνολα κανόνων προς απόρριψη",
	"settings.invalidRuleSetsDiscarded":
		"Τα μη έγκυρα σύνολα κανόνων θα απορριφθούν: {ids}",
	"settings.importValidOnly": "Εισαγωγή μόνο έγκυρων",
	"settings.tryRepair": "Προσπάθεια επιδιόρθωσης",
	"settings.saveFailedTitle": "Δεν ήταν δυνατή η αποθήκευση των ρυθμίσεων.",
	"settings.saveFailedQuestion": "Θέλετε να δοκιμάσετε ξανά;",

	"error.unknown": "Άγνωστο σφάλμα.",
	"error.technicalDetails": "Τεχνικές λεπτομέρειες",
	"error.technicalInline": "Τεχνικές λεπτομέρειες: {details}",
	"error.details.copy": "Αντιγραφή λεπτομερειών",
	"error.details.copied": "Αντιγράφηκε",
	"error.details.source": "Πηγή",
	"error.details.operation": "Λειτουργία",
	"error.details.subject": "Θέμα",
	"error.details.reason": "Αιτία",
	"error.details.diagnostic": "Διάγνωση",
	"error.details.type": "Τύπος σφάλματος",
	"error.details.message": "Μήνυμα σφάλματος",
	"error.details.cause": "Αιτία",
	"error.details.stack": "Ίχνος στοίβας",
	"error.unexpected":
		"Μη αναμενόμενο σφάλμα εφαρμογής. Αναφέρετε αυτό το σφάλμα.",
	"error.dataNotFound": "Δεν ήταν δυνατή η εύρεση των αποθηκευμένων δεδομένων.",
	"error.dataUnreadable":
		"Δεν είναι δυνατή η ανάγνωση των αποθηκευμένων δεδομένων.",
	"error.storageUnavailable":
		"Ο χώρος αποθήκευσης δεν είναι διαθέσιμος αυτή τη στιγμή.",
	"error.diskFull":
		"Ο χώρος αποθήκευσης είναι γεμάτος. Ελευθερώστε χώρο και δοκιμάστε ξανά.",
	"error.writeFailed": "Δεν ήταν δυνατή η ασφαλής αποθήκευση των δεδομένων.",
	"error.targetExists": "Υπάρχουν ήδη δεδομένα στον προορισμό αποθήκευσης.",
	"error.invalidFileReference": "Η αναφορά αρχείου δεν είναι έγκυρη.",
	"error.incompleteRecovery": "Τα δεδομένα ανάκτησης είναι ελλιπή.",
	"error.invalidJson": "Το αρχείο δεν περιέχει έγκυρο JSON.",
	"error.invalidDocument": "Το αρχείο δεν έχει έγκυρη δομή.",
	"error.unsupportedVersion": "Η έκδοση του αρχείου δεν υποστηρίζεται.",
	"error.encodingFailed":
		"Δεν ήταν δυνατή η ανάγνωση της κωδικοποίησης του αρχείου.",
	"error.invalidObject": "Το αποθηκευμένο αντικείμενο δεν είναι έγκυρο.",
	"error.repairFailed":
		"Δεν ήταν δυνατή η επιδιόρθωση του αποθηκευμένου αντικειμένου.",
	"error.decisionExpired": "Η ζητούμενη απόφαση δεν είναι πλέον ενεργή.",
	"error.decisionRequired":
		"Απαιτείται απόφαση πριν συνεχιστεί αυτή η λειτουργία.",
	"error.invalidDecision":
		"Αυτή η απόφαση δεν είναι διαθέσιμη για την τρέχουσα λειτουργία.",
	"error.wrongObjectKind":
		"Το επιλεγμένο αρχείο δεν περιέχει τον αναμενόμενο τύπο αντικειμένου.",
	"error.invalidValue": "Μια τιμή εισόδου δεν είναι έγκυρη.",
	"error.preconditionNotMet":
		"Η λειτουργία δεν μπορεί να εκτελεστεί στην τρέχουσα κατάσταση.",
	"error.protectedObject":
		"Το αντικείμενο που χρησιμοποιείται αυτή τη στιγμή δεν μπορεί να αλλάξει ή να διαγραφεί.",
	"error.entityNotFound":
		"Δεν ήταν δυνατή η εύρεση του ζητούμενου αντικειμένου.",
	"error.unsupportedMediaType":
		"Ο επιλεγμένος τύπος αρχείου δεν υποστηρίζεται.",
	"error.invalidResourceSource": "Η πηγή της εικόνας δεν είναι έγκυρη.",
	"error.unsafeResourceSource":
		"Η πηγή της εικόνας απορρίφθηκε για λόγους ασφαλείας.",
	"error.ruleSetInvalid":
		"Το αποθηκευμένο σύνολο κανόνων δεν έχει έγκυρη δομή.",
	"error.fileNameInvalid": "Το όνομα αρχείου δεν είναι έγκυρο.",
	"error.savedDataUnreadable":
		"Δεν ήταν δυνατή η ανάγνωση των αποθηκευμένων δεδομένων.",
	"error.savedDataInvalidJson":
		"Τα αποθηκευμένα δεδομένα δεν περιέχουν έγκυρο JSON.",
	"error.savedObjectInvalid":
		"Το αποθηκευμένο αντικείμενο δεν έχει έγκυρη δομή.",
	"error.savedObjectUnsupportedVersion":
		"Η έκδοση του αποθηκευμένου αντικειμένου δεν υποστηρίζεται.",
	"error.savedObjectEncodingFailed":
		"Δεν ήταν δυνατή η ανάγνωση της κωδικοποίησης του αποθηκευμένου αντικειμένου.",
	"error.savedObjectProcessingFailed":
		"Δεν ήταν δυνατή η επεξεργασία του αποθηκευμένου αντικειμένου.",
	"error.objectStoreMissing":
		"Δεν ήταν δυνατή η εύρεση του χώρου αποθήκευσης αντικειμένων.",
	"error.objectStoreUnreadable":
		"Δεν ήταν δυνατή η ανάγνωση του χώρου αποθήκευσης αντικειμένων.",
	"error.objectStoreInvalidJson":
		"Ο χώρος αποθήκευσης αντικειμένων δεν περιέχει έγκυρο JSON.",
	"error.objectStoreInvalid":
		"Ο χώρος αποθήκευσης αντικειμένων δεν έχει έγκυρη δομή.",
	"error.objectStoreUnsupportedVersion":
		"Η έκδοση του χώρου αποθήκευσης αντικειμένων δεν υποστηρίζεται.",
	"error.objectStoreEncodingFailed":
		"Δεν ήταν δυνατή η ανάγνωση της κωδικοποίησης του χώρου αποθήκευσης αντικειμένων.",
	"error.objectStoreProcessingFailed":
		"Δεν ήταν δυνατή η επεξεργασία του χώρου αποθήκευσης αντικειμένων.",
	"error.newFileMissing": "Το νέο αρχείο λείπει.",
	"error.incompleteWrite": "Ελλιπής λειτουργία αποθήκευσης.",
	"error.ruleSetStoreInvalidJson":
		"Ο χώρος αποθήκευσης συνόλων κανόνων δεν περιέχει έγκυρο JSON.",
	"error.ruleSetsUnreadable":
		"Δεν ήταν δυνατή η ανάγνωση των αποθηκευμένων συνόλων κανόνων.",
	"error.ruleSetStoreInvalid":
		"Ο χώρος αποθήκευσης συνόλων κανόνων δεν έχει έγκυρη δομή.",
	"errorBoundary.eyebrow": "Σφάλμα εφαρμογής",
	"errorBoundary.title": "Δεν ήταν δυνατή η εμφάνιση της διεπαφής.",
	"errorBoundary.retry": "Δοκιμή ξανά",

	"success.imported.game": "Το αποθηκευμένο παιχνίδι «{name}» εισήχθη.",
	"success.imported.template": "Το πρότυπο «{name}» εισήχθη.",
	"success.imported.ruleSet": "Το σύνολο κανόνων «{name}» εισήχθη.",
	"success.imported.library": "Η βιβλιοθήκη εισήχθη.",
	"success.recovered.game": "Το αποθηκευμένο παιχνίδι «{name}» ανακτήθηκε.",
	"success.recovered.template": "Το πρότυπο «{name}» ανακτήθηκε.",
	"success.recovered.ruleSet": "Το σύνολο κανόνων «{name}» ανακτήθηκε.",
	"success.recovered.library": "Η βιβλιοθήκη ανακτήθηκε.",
	"success.restored.library":
		"Η βιβλιοθήκη επαναφέρθηκε από το αντίγραφο ασφαλείας.",
	"success.repaired.game": "Το αποθηκευμένο παιχνίδι «{name}» επιδιορθώθηκε.",
	"success.repaired.template": "Το πρότυπο «{name}» επιδιορθώθηκε.",
	"success.repaired.ruleSet": "Το σύνολο κανόνων «{name}» επιδιορθώθηκε.",
	"success.repaired.library": "Η βιβλιοθήκη επιδιορθώθηκε.",

	"repairReport.title": "Η βιβλιοθήκη επιδιορθώθηκε",
	"repairReport.acceptedRuleSets": {
		plural: {
			one: "Έγινε αποδεκτό {count} σύνολο κανόνων.",
			other: "Έγιναν αποδεκτά {count} σύνολα κανόνων.",
		},
	},
	"repairReport.removedRuleSets": "Καταργημένα σύνολα κανόνων",
	"repairReport.removed.notAnObject":
		"Η αποθηκευμένη καταχώριση συνόλου κανόνων δεν είναι αντικείμενο.",
	"repairReport.removed.repairFailed":
		"Δεν ήταν δυνατή η επιδιόρθωση του συνόλου κανόνων.",
	"repairReport.change.missingStatusDefinitionAdded":
		"Σύνολο κανόνων {ruleSetLabel}: προστέθηκε ο ορισμός κατάστασης «{status}» που έλειπε.",
	"repairReport.change.ruleSetUnknownFieldsRemoved":
		"Σύνολο κανόνων {ruleSetLabel}: αφαιρέθηκαν άγνωστα πεδία ({fields}).",
	"repairReport.change.teamUnknownFieldsRemoved":
		"Ομάδα {index} στο {ruleSetLabel}: αφαιρέθηκαν άγνωστα πεδία ({fields}).",
	"repairReport.change.roleUnknownFieldsRemoved":
		"Ρόλος {index} στο {ruleSetLabel}: αφαιρέθηκαν άγνωστα πεδία ({fields}).",
	"repairReport.change.statusUnknownFieldsRemoved":
		"Κατάσταση {index} στο {ruleSetLabel}: αφαιρέθηκαν άγνωστα πεδία ({fields}).",
	"repairReport.change.ruleSetIdCollisionResolved":
		"Σύνολο κανόνων {storedId}: το ID που συγκρουόταν άλλαξε σε «{newId}».",
	"repairReport.change.ruleSetsContainerReplaced":
		"Το ruleSetsById που έλειπε ή δεν ήταν έγκυρο αντικαταστάθηκε με κενό κοντέινερ.",
	"repairReport.change.libraryUnknownFieldsRemoved":
		"Βιβλιοθήκη: αφαιρέθηκαν άγνωστα πεδία ({fields}).",
	"repairReport.change.insertedMissingQuote":
		"Εισήχθη εισαγωγικό που έλειπε στη θέση {position}.",
	"repairReport.change.addedClosingBraces": {
		plural: {
			one: "Προστέθηκε μία αγκύλη κλεισίματος που έλειπε.",
			other: "Προστέθηκαν {count} αγκύλες κλεισίματος που έλειπαν.",
		},
	},
	"repairReport.change.addedOpeningBraces": {
		plural: {
			one: "Προστέθηκε μία αγκύλη ανοίγματος που έλειπε.",
			other: "Προστέθηκαν {count} αγκύλες ανοίγματος που έλειπαν.",
		},
	},

	"game.menu.open": "Άνοιγμα μενού παιχνιδιού",
	"game.menu.title": "Μενού παιχνιδιού",
	"game.menu.actions": "Ενέργειες παιχνιδιού",
	"game.menu.save": "Αποθήκευση παιχνιδιού",
	"game.menu.saveAs": "Αποθήκευση παιχνιδιού ως",
	"game.menu.saveAsTemplate": "Αποθήκευση παιχνιδιού ως πρότυπο",
	"game.menu.exit": "Έξοδος από το παιχνίδι",
	"game.menu.manageEntities": "Διαχείριση ομάδων, ρόλων και καταστάσεων",
	"game.menu.randomizeRoles": "Τυχαία ανάθεση ρόλων",
	"game.menu.shufflePlayers": "Τυχαία διάταξη παικτών",
	"game.menu.rolesForShowing": "Ρόλοι προς εμφάνιση",
	"game.menu.showLog": "Εμφάνιση αρχείου καταγραφής",
	"game.menu.settings": "Ρυθμίσεις",
	"game.currentGame": "Τρέχον παιχνίδι",
	"game.unlockSeatOrder": "Ξεκλείδωμα σειράς θέσεων",
	"game.lockSeatOrder": "Κλείδωμα σειράς θέσεων",
	"game.playerOverview": "Επισκόπηση παικτών",
	"game.seatOrder": "Σειρά θέσεων",
	"game.zoomControls": "Ζουμ κύκλου θέσεων",
	"game.zoomOut": "Σμίκρυνση κύκλου θέσεων",
	"game.zoomIn": "Μεγέθυνση κύκλου θέσεων",
	"game.zoomLevel": "Επίπεδο ζουμ: {percent} τοις εκατό",
	"game.showSeatCircle": "Εμφάνιση κύκλου θέσεων",
	"game.showPlayerOverview": "Εμφάνιση επισκόπησης παικτών",
	"game.seatAccessible": "Θέση {seat}{marker}",
	"game.sourceAndTargetSuffix": ", πηγή και στόχος",
	"game.sourceSuffix": ", πηγή",
	"game.targetSuffix": ", στόχος",
	"game.deleteSeat": "Διαγραφή θέσης {seat}",
	"game.addPlayerAfterSeat": "Προσθήκη παίκτη μετά τη θέση {seat}",
	"game.flow": "Ροή παιχνιδιού",
	"game.showRoles": "Εμφάνιση ρόλων",
	"game.nightList": "Νυχτερινή λίστα",
	"game.seat": "Θέση {seat}",
	"game.details": "Λεπτομέρειες",
	"game.actionsForSeat": "Ενέργειες για τη θέση {seat}",
	"game.deleteSelectedSeat": "Διαγραφή επιλεγμένης θέσης {seat}",
	"game.addPlayerAfterSelectedSeat":
		"Προσθήκη παίκτη μετά την επιλεγμένη θέση {seat}",
	"game.restoreSplitView": "Επαναφορά διαιρεμένης προβολής",
	"game.showDetailsFullscreen": "Εμφάνιση λεπτομερειών σε πλήρη οθόνη",
	"game.manualSeat": "Αριθμός θέσης",
	"game.selectSeat": "Επιλογή θέσης",
	"game.lifeState": "Κατάσταση ζωής",
	"game.life.alive": "Ζωντανός",
	"game.life.deadVoteAvailable": "Νεκρός – διαθέσιμη ψήφος",
	"game.life.deadVoteSpent": "Νεκρός – ψήφος χρησιμοποιήθηκε",
	"game.life.doubleDeadVoteAvailable": "Διπλά νεκρός – διαθέσιμη ψήφος",
	"game.life.doubleDeadVoteSpent": "Διπλά νεκρός – ψήφος χρησιμοποιήθηκε",
	"game.life.aliveShort": "Ζωντανός",
	"game.life.deadVoteAvailableShort": "Νεκρός · διαθέσιμη ψήφος",
	"game.life.deadVoteSpentShort": "Νεκρός · ψήφος χρησιμοποιήθηκε",
	"game.life.doubleDeadVoteAvailableShort": "Διπλά νεκρός · διαθέσιμη ψήφος",
	"game.life.doubleDeadVoteSpentShort": "Διπλά νεκρός · ψήφος χρησιμοποιήθηκε",
	"game.noRole": "Χωρίς ρόλο",
	"game.team": "Ομάδα",
	"game.rolesWithoutTeam": "Χωρίς ομάδα",
	"game.role.actual": "Πραγματικός ρόλος",
	"game.role.shown": "Εμφανιζόμενος ρόλος",
	"game.role.night": "Νυχτερινός ρόλος",
	"game.role.claimed": "Δηλωμένος ρόλος",
	"game.statuses": "Καταστάσεις",
	"game.status": "Κατάσταση",
	"game.statusDuration": "Νύχτα {from}–{until}",
	"game.openEnded": "χωρίς λήξη",
	"game.newStatus": "Νέα κατάσταση",
	"game.deletePlayer": "Διαγραφή παίκτη",
	"game.player": "Παίκτης",
	"game.selectPlayer": "Επιλογή παίκτη …",
	"game.addPlayer": "+ Παίκτης",
	"game.deleteEmptySeat": "Διαγραφή κενής θέσης",
	"game.emptySeat": "Αυτή η θέση είναι κενή.",
	"game.selectSeatPrompt": "Επιλέξτε μια θέση.",
	"game.playerWithName": "Παίκτης: {name}",
	"game.deleteQuestion": "διαγραφή;",
	"game.newSeatAfter": "νέα θέση μετά",
	"game.addQuestion": "προσθήκη;",
	"game.seatActionCancel": "Ακύρωση",
	"game.unsavedTitle": "Το παιχνίδι δεν έχει αποθηκευτεί ακόμη.",
	"game.saveAndExit": "Αποθήκευση και έξοδος από το παιχνίδι",
	"game.exitWithoutSaving": "Έξοδος από το παιχνίδι χωρίς αποθήκευση",
	"game.saveFailedTitle": "Δεν ήταν δυνατή η αποθήκευση του αρχείου.",
	"game.targetExists": "Υπάρχει ήδη αρχείο με αυτό το όνομα.",
	"game.saveRecoveryQuestion":
		"Τι θέλετε να κάνετε με την αποτυχημένη λειτουργία αποθήκευσης;",
	"game.storageCommandInactive": "Η εντολή αποθήκευσης δεν είναι πλέον ενεργή.",
	"game.decideLater": "Απόφαση αργότερα",
	"game.setup": "Ρύθμιση",
	"game.nightNumber": "Νύχτα {number}",
	"game.dayNumber": "Ημέρα {number}",
	"game.backToGame": "Πίσω στο παιχνίδι",
	"game.log.title": "Αρχείο καταγραφής",
	"game.log.empty": "Δεν υπάρχουν ακόμη καταχωρίσεις στο αρχείο καταγραφής.",
	"game.log.timeAdvanced": "Ο χρόνος προχώρησε: {oldTime} → {newTime}.",
	"game.log.timeRewound": "Ο χρόνος γύρισε πίσω: {oldTime} → {newTime}.",
	"game.log.lifeStateChanged":
		"Κατάσταση ζωής του {player}: {oldState} → {newState}.",
	"game.log.statusApplied": "Εφαρμόστηκε η κατάσταση {status} στον {player}.",
	"game.log.rolesDistributed": {
		plural: {
			one: "{count} ρόλος κατανεμήθηκε τυχαία.",
			other: "{count} ρόλοι κατανεμήθηκαν τυχαία.",
		},
	},
	"game.log.selectedRolesDistributed": {
		plural: {
			one: "{count} επιλεγμένος ρόλος κατανεμήθηκε τυχαία.",
			other: "{count} επιλεγμένοι ρόλοι κατανεμήθηκαν τυχαία.",
		},
	},
	"game.log.seatMoved":
		"Ο παίκτης {playerName} μετακινήθηκε από τη θέση {fromSeat} στη θέση {toSeat}.",
	"game.log.seatsSwapped": "Οι θέσεις {seatA} και {seatB} ανταλλάχθηκαν.",
	"game.log.playerAppended":
		"Ο παίκτης {playerName} τοποθετήθηκε στη θέση {toSeat}.",
	"game.log.playerInserted":
		"Ο παίκτης {playerName} εισήχθη στη θέση {toSeat}.",
	"game.log.playerRemoved":
		"Ο παίκτης {playerName} αφαιρέθηκε από τη θέση {fromSeat}.",
	"game.log.seatOrderChanged": "Η σειρά των θέσεων άλλαξε.",
	"game.roleReveal.navigation": "Αποκάλυψη ρόλου",
	"game.roleReveal.prompt":
		"Δείξτε στον {player} (θέση {seat}) τον ρόλο του. Πατήστε για αποκάλυψη.",
	"game.overview.seat": "Θέση",
	"game.overview.role": "Ρόλος",
	"game.sourceAndTarget": "Πηγή/στόχος",
	"game.source": "Πηγή",
	"game.target": "Στόχος",
	"game.overview.playerAccessible": "{name}, θέση {seat}{marker}",
	"game.overview.shownRole": "Εμφανιζόμενος: {role}",
	"game.overview.nightRole": "Νύχτα: {role}",
	"game.night.noActiveRoles":
		"Δεν υπάρχουν νυχτερινά ενεργοί ρόλοι για αυτή τη νύχτα.",
	"game.night.actionFor": "Ενέργεια για {player}",
	"game.night.action": "Ενέργεια",
	"game.night.on": "σε",
	"game.night.targetPlayer": "Παίκτης-στόχος",
	"game.night.noEffect": "Η ενέργεια δεν είχε αποτέλεσμα.",
	"game.night.execute": "Εκτέλεση",
	"game.night.kill": "Σκοτώνει",
	"game.night.resurrect": "Ανασταίνει",
	"game.action.kill": "σκότωσε",
	"game.action.resurrect": "ανάστησε",
	"game.action.applyStatus": "εφάρμοσε κατάσταση",
	"game.action.unknown": "άγνωστη ενέργεια (εσωτερικός κωδικός: {action})",
	"game.life.dead": "Νεκρός",
	"game.warning.playerNotFound": "Ο παίκτης «{playerId}» δεν υπάρχει.",
	"game.warning.statusNotFound": "Η κατάσταση «{statusId}» δεν υπάρχει.",
	"game.warning.actorNotFound": "Ο παίκτης «{playerId}» δεν υπάρχει.",
	"game.warning.targetNotFound": "Ο παίκτης-στόχος «{playerId}» δεν υπάρχει.",
	"game.warning.actualRoleNotFound":
		"Δεν βρέθηκε πραγματικός ρόλος για τον παίκτη «{playerId}».",
	"game.warning.abilityAmbiguous":
		"Η ικανότητα του ρόλου «{roleName}» είναι ασαφής.",
	"game.warning.statusAmbiguous": "Η κατάσταση που θα εφαρμοστεί είναι ασαφής.",
	"game.warning.voteAlreadySpent":
		"Η ψήφος φαντάσματος έχει ήδη χρησιμοποιηθεί.",
	"game.warning.abilityNotAllowed":
		"Ο ρόλος «{roleName}» δεν επιτρέπει την ενέργεια «{action}».",
	"game.warning.statusNotAllowed":
		"Ο ρόλος «{roleName}» δεν μπορεί να εφαρμόσει την κατάσταση «{statusId}».",
	"game.statusEditor.title": "Επεξεργασία κατάστασης",
	"game.statusEditor.status": "Κατάσταση",
	"game.statusEditor.fromNight": "Από νύχτα",
	"game.statusEditor.untilNight": "Έως νύχτα",
	"game.statusEditor.note": "Σημείωση",
	"game.playerName": "Όνομα παίκτη",

	"recovery.kind.game": "αποθηκευμένο παιχνίδι",
	"recovery.kind.template": "πρότυπο",
	"recovery.kind.ruleSet": "σύνολο κανόνων",
	"recovery.backupFile": "αρχείο αντιγράφου ασφαλείας",
	"recovery.temporaryFile": "προσωρινό αρχείο ανάκτησης",
	"recovery.incompleteSave": "Ελλιπής λειτουργία αποθήκευσης",
	"recovery.openCount": " ({count} ανοιχτά)",
	"recovery.orphanedFile":
		"Βρέθηκε ένα {recoveryFile}, αλλά λείπει το αντίστοιχο αρχείο για το {kind}.",
	"recovery.twoFiles":
		"Βρέθηκαν ένα παλιό και ένα πιθανώς νέο αρχείο για το {kind} «{id}».",
	"recovery.keepOld": "Διατήρηση παλιού αρχείου",
	"recovery.keepNew": "Διατήρηση νέου αρχείου",
	"recovery.keepBothFiles": "Διατήρηση και των δύο αρχείων",
	"recovery.exportBrokenFile": "Εξαγωγή κατεστραμμένου αρχείου",
	"recovery.decideLater": "Απόφαση αργότερα",
	"recovery.invalidObjectTitle":
		"Εντοπίστηκε μη έγκυρο αποθηκευμένο αντικείμενο",
	"recovery.affectedObject": "Επηρεαζόμενο αντικείμενο ({kind}): «{reference}»",
	"recovery.file": "Αρχείο",
	"recovery.suggestedFileName": "Προτεινόμενο όνομα αρχείου",
	"recovery.repairObject": "Επιδιόρθωση αντικειμένου",
	"recovery.repairFileName": "Επιδιόρθωση ονόματος αρχείου",
	"recovery.exportObject": "Εξαγωγή αντικειμένου",
	"recovery.deleteObject": "Διαγραφή αντικειμένου",
	"recovery.reason.invalidRuleSet":
		"Το αποθηκευμένο σύνολο κανόνων δεν έχει έγκυρη δομή.",
	"recovery.reason.invalidFileName":
		"Το αρχείο JSON δεν ακολουθεί τις συμβάσεις ονοματοδοσίας.",
	"recovery.reason.decodeFailed":
		"Δεν ήταν δυνατή η αποκωδικοποίηση του αρχείου.",
	"recovery.reason.invalidJson": "Το αρχείο δεν περιέχει έγκυρο JSON.",
	"recovery.reason.invalidTemplate": "Το JSON δεν είναι έγκυρο πρότυπο.",
	"recovery.reason.invalidGame":
		"Το JSON δεν είναι έγκυρο αποθηκευμένο παιχνίδι.",
	"recovery.rememberDecision":
		"Απομνημόνευση αυτής της απόφασης και εφαρμογή της σε όλα τα σφάλματα του ίδιου τύπου",
	"recovery.library.missing": "Δεν ήταν δυνατή η εύρεση της βιβλιοθήκης.",
	"recovery.library.orphanedTemporary":
		"Βρέθηκε προσωρινό αρχείο ανάκτησης, αλλά λείπει η αντίστοιχη βιβλιοθήκη.",
	"recovery.library.orphanedBackup":
		"Βρέθηκε αρχείο αντιγράφου ασφαλείας, αλλά λείπει η αντίστοιχη βιβλιοθήκη.",
	"recovery.library.decodeFailed":
		"Δεν ήταν δυνατή η αποκωδικοποίηση του αρχείου βιβλιοθήκης.",
	"recovery.library.invalidJson":
		"Το αρχείο βιβλιοθήκης δεν περιέχει έγκυρο JSON.",
	"recovery.library.invalidRuleSet":
		"Η βιβλιοθήκη περιέχει μη έγκυρο σύνολο κανόνων.",
	"recovery.library.invalidDocument": "Το JSON δεν είναι έγκυρη βιβλιοθήκη.",
	"recovery.library.title": "Δεν είναι δυνατή η ανάγνωση της βιβλιοθήκης",
	"recovery.library.restoreBackup": "Επαναφορά αντιγράφου ασφαλείας",
	"recovery.library.repair": "Επιδιόρθωση βιβλιοθήκης",
	"recovery.library.createEmpty": "Δημιουργία νέας κενής βιβλιοθήκης",
	"recovery.library.export": "Εξαγωγή βιβλιοθήκης",

	"rolesForShowing.title": "Ρόλοι προς εμφάνιση",
	"rolesForShowing.closePreview": "Κλείσιμο προεπισκόπησης",
	"rolesForShowing.freeText": "Ελεύθερο κείμενο",
	"rolesForShowing.roles": "Ρόλοι",
	"rolesForShowing.removeRole": "Αφαίρεση {name}",
	"rolesForShowing.empty": "Δεν έχουν επιλεγεί ακόμη ρόλοι.",
	"rolesForShowing.addRole": "＋ Ρόλος",
	"rolesForShowing.showSymbol": "Εμφάνιση συμβόλου ρόλου",
	"rolesForShowing.preview": "Προεπισκόπηση",
	"rolesForShowing.addRoleTitle": "Προσθήκη ρόλου",

	"roleDistribution.title": "Τυχαία ανάθεση ρόλων",
	"roleDistribution.teamDistribution": "Κατανομή ομάδων",
	"roleDistribution.roleSelection": "Επιλογή ρόλων",
	"roleDistribution.type": "Μέθοδος κατανομής ρόλων",
	"roleDistribution.random.title": "Τυχαία κατανομή τυχαίων ρόλων",
	"roleDistribution.random.detail": "Ορίστε μεγέθη ομάδων και κληρώστε ρόλους",
	"roleDistribution.selected.title": "Τυχαία κατανομή επιλεγμένων ρόλων",
	"roleDistribution.selected.detail":
		"Επιλέξτε συγκεκριμένους ρόλους και αναθέστε τους τυχαία",
	"roleDistribution.manual.title": "Χειροκίνητη ανάθεση ρόλων",
	"roleDistribution.manual.detail":
		"Αναθέστε ρόλους αργότερα στην οθόνη παιχνιδιού",
	"roleDistribution.overwriteRunning":
		"Το παιχνίδι βρίσκεται ήδη σε εξέλιξη. Οι υπάρχοντες πραγματικοί, εμφανιζόμενοι και νυχτερινοί ρόλοι θα αντικατασταθούν.",
	"roleDistribution.overwriteAssigned":
		"Οι ρόλοι που έχουν ήδη ανατεθεί θα αντικατασταθούν.",
	"roleDistribution.redistribute": "Ανακατανομή ρόλων",
	"roleDistribution.uniqueRoleMultiple":
		"Ένας μοναδικός ρόλος επιλέχθηκε περισσότερες από μία φορές",
	"roleDistribution.decrease": "Μείωση {name}",
	"roleDistribution.count": "Πλήθος για {name}",
	"roleDistribution.increase": "Αύξηση {name}",
	"roleDistribution.freePlayers": "Μη ανατεθειμένοι παίκτες",
	"roleDistribution.distribute": "Κατανομή ρόλων",

	"roleDistribution.error.teamHasNoRoles": {
		plural: {
			one: "Role distribution failed: {count} player was requested for team “{teamName}”, but the team has no roles.",
			other:
				"Role distribution failed: {count} players were requested for team “{teamName}”, but the team has no roles.",
		},
	}, // This value isn't accurate translated, yet.
	"roleDistribution.error.insufficientDistinctRoles": {
		plural: {
			one: 'Η ομάδα "{teamName}" ζήτησε {requestedCount} παίκτες, αλλά μόνο {count} διακριτός ρόλος είναι διαθέσιμος και κανένας ρόλος δεν μπορεί να επαναληφθεί, επομένως η διανομή ρόλων απέτυχε.',
			other:
				'Η ομάδα "{teamName}" ζήτησε {requestedCount} παίκτες, αλλά μόνο {count} διακριτοί ρόλοι είναι διαθέσιμοι και κανένας ρόλος δεν μπορεί να επαναληφθεί, επομένως η διανομή ρόλων απέτυχε.',
		},
	},
	"scenarioEditor.objectType": "Τύπος αντικειμένου",
	"scenarioEditor.teams": "Ομάδες",
	"scenarioEditor.roles": "Ρόλοι",
	"scenarioEditor.players": "Παίκτες",
	"scenarioEditor.statuses": "Καταστάσεις",
	"scenarioEditor.readingDetails": "Ανάγνωση λεπτομερειών …",
	"scenarioEditor.create": "＋ Δημιουργία",
	"scenarioEditor.new.teams": "Νέα ομάδα",
	"scenarioEditor.new.roles": "Νέος ρόλος",
	"scenarioEditor.new.players": "Νέος παίκτης",
	"scenarioEditor.new.statuses": "Νέα κατάσταση",
	"scenarioEditor.saveChange": "Αποθήκευση αλλαγής",
	"scenarioEditor.saveAsNewRuleSet": "Αποθήκευση αλλαγής ως νέο σύνολο κανόνων",
	"scenarioEditor.saveAsNewTemplate": "Αποθήκευση αλλαγής ως νέο πρότυπο",
	"scenarioEditor.newGameWithRuleSet": "Νέο παιχνίδι με αυτό το σύνολο κανόνων",
	"scenarioEditor.newGameFromTemplate": "Νέο παιχνίδι από αυτό το πρότυπο",
	"scenarioEditor.saveCopy": "Αποθήκευση ως αντίγραφο",
	"scenarioEditor.unsavedChanges": "Οι αλλαγές δεν έχουν αποθηκευτεί ακόμη.",
	"scenarioEditor.unsavedRuleSet":
		"Το σύνολο κανόνων δεν έχει αποθηκευτεί ακόμη.",
	"scenarioEditor.unsavedTemplate": "Το πρότυπο δεν έχει αποθηκευτεί ακόμη.",
	"scenarioEditor.saveAndContinue": "Αποθήκευση και συνέχεια",
	"scenarioEditor.continueWithoutSaving": "Συνεχίστε χωρίς αποθήκευση",
	"scenarioEditor.saveAndExit": "Αποθήκευση και έξοδος",
	"scenarioEditor.exitWithoutSaving": "Έξοδος χωρίς αποθήκευση",
	"scenarioEditor.editDetails": "Επεξεργασία λεπτομερειών",
	"scenarioEditor.closeDetails": "Κλείσιμο προβολής λεπτομερειών",
	"scenarioEditor.displayName": "Εμφανιζόμενο όνομα ({language})",
	"scenarioEditor.teamOrder": "Σειρά ομάδων",
	"scenarioEditor.defaultDuration":
		"Προεπιλεγμένη διάρκεια σε νύχτες (0 = άπειρο)",
	"scenarioEditor.team": "Ομάδα",
	"scenarioEditor.firstNightOrder": "Σειρά την πρώτη νύχτα",
	"scenarioEditor.otherNightOrder": "Σειρά από τη δεύτερη νύχτα",
	"scenarioEditor.unique": "Μοναδικός;",
	"scenarioEditor.activeAbilities": "Ενεργές ικανότητες",
	"scenarioEditor.canKill": "Μπορεί να σκοτώνει",
	"scenarioEditor.canResurrect": "Μπορεί να ανασταίνει",
	"scenarioEditor.canApplyStatuses": "Μπορεί να εφαρμόζει καταστάσεις",
	"scenarioEditor.noStatuses": "Δεν έχουν οριστεί ακόμη καταστάσεις.",
	"scenarioEditor.unicodeSymbol": "Σύμβολο Unicode",
	"scenarioEditor.unicodePreview": "Προεπισκόπηση Unicode",
	"scenarioEditor.useColor": "Χρήση χρώματος",
	"scenarioEditor.editColor": "Επεξεργασία χρώματος",
	"scenarioEditor.colorPickerTitle": "Επιλογή χρώματος",
	"scenarioEditor.colorCode": "Δεκαεξαδικός κωδικός RGB",
	"scenarioEditor.colorPreview": "Προεπισκόπηση χρώματος",
	"scenarioEditor.apply": "Εφαρμογή",
	"scenarioEditor.deleteQuestion": "Να διαγραφεί οριστικά το «{name}»;",
	"scenarioEditor.workingCopy": "Αντίγραφο εργασίας",

	"app.closeError": "Κλείσιμο μηνύματος σφάλματος",
	"app.exited": "Η εφαρμογή έκλεισε.",
	"app.restart": "Επανεκκίνηση εφαρμογής",
	"appError.checkFiles": "Δεν ήταν δυνατός ο έλεγχος των αρχείων.",
	"appError.settingsUpdate": "Δεν ήταν δυνατή η αλλαγή των ρυθμίσεων.",
	"appError.settingsOpen": "Δεν ήταν δυνατό το άνοιγμα των ρυθμίσεων.",
	"appError.continueLastGame":
		"Δεν ήταν δυνατή η συνέχιση του τελευταίου παιχνιδιού.",
	"appError.continueGame": "Δεν ήταν δυνατή η συνέχιση του παιχνιδιού.",
	"appError.openPreparedGame":
		"Δεν ήταν δυνατό το άνοιγμα του προετοιμασμένου παιχνιδιού.",
	"appError.restoreOldFile": "Δεν ήταν δυνατή η επαναφορά του παλιού αρχείου.",
	"appError.retryStorageCommand":
		"Δεν είναι δυνατή η επανάληψη της εντολής αποθήκευσης.",
	"appError.finishStorageCommand":
		"Δεν είναι δυνατή η ολοκλήρωση της εντολής αποθήκευσης.",
	"appError.continueStorageCommand":
		"Δεν είναι δυνατή η συνέχιση της εντολής αποθήκευσης.",
	"appError.saveGamesUnavailable":
		"Δεν είναι δυνατή η αποθήκευση αποθηκευμένων παιχνιδιών.",
	"appError.saveTemplatesUnavailable":
		"Δεν είναι δυνατή η αποθήκευση προτύπων.",
	"appError.changeSeatOrder": "Δεν ήταν δυνατή η αλλαγή της σειράς των θέσεων.",
	"appError.savePlayer": "Δεν ήταν δυνατή η αποθήκευση του παίκτη.",
	"appError.deleteEmptySeat": "Δεν ήταν δυνατή η διαγραφή της κενής θέσης.",
	"appError.deletePlayer": "Δεν ήταν δυνατή η διαγραφή του παίκτη.",
	"appError.advanceTime":
		"Δεν ήταν δυνατή η προώθηση του χρόνου του παιχνιδιού.",
	"appError.rewindTime":
		"Δεν ήταν δυνατή η επιστροφή του χρόνου του παιχνιδιού.",
	"appError.applyGameChanges":
		"Δεν ήταν δυνατή η εφαρμογή των αλλαγών του παιχνιδιού.",
	"appError.distributeRoles": "Δεν ήταν δυνατή η κατανομή των ρόλων.",
	"startup.initializeFiles":
		"Δεν ήταν δυνατή η αρχικοποίηση των αρχείων της εφαρμογής.",
	"startup.repairFileNames":
		"Δεν ήταν δυνατή η επιδιόρθωση των εσωτερικών ονομάτων αρχείων.",
	"startup.loadSettings":
		"Δεν ήταν δυνατή η φόρτωση των ρυθμίσεων. Θα χρησιμοποιηθούν οι προεπιλεγμένες τιμές.",
	"startup.rootMissing": "Λείπει το στοιχείο HTML με ID «root».",
} satisfies Record<GuiTranslationKey, GuiTranslationMessage>;
