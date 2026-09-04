import type { GuiTranslationKey } from "./de";
import type { GuiTranslationMessage } from "./messages";
export const kalaallisutGuiMessages = {
	"common.back": "Taarsiullugu",
	"common.cancel": "Annaasaqarneq",
	"common.close": "Suliaq",
	"common.later": "Kingusinnerusukkut",
	"common.import": "Tunisassiorneq",
	"common.export": "Avammut tuniniaaneq",
	"common.share": "Dele",
	"common.rename": "Aaqqissuussineq",
	"common.duplicate": "Marloqiusamik",
	"common.delete": "Pilersitsineq",
	"common.deletePermanently": "Piujuartumik piiaaneq",
	"common.name": "Aqqa",
	"common.unknown": "ilisimaneqanngilaq",
	"common.detailsParenthetical": "(Immikkuualuttut)",
	"common.schemaVersion": "Pilersaarusiorneq",
	"common.actionsFor": "Suliassat pillugit",
	"common.moreActionsFor": "{name}-imut iliuuseqarnissaq amerlanerusoq",
	"common.cancelImport": "Tunisassiorneq unitsiguk",
	"common.tryRepair": "Iluarsaassinissaq misilerarneqarpoq",
	"common.keepBoth": "Marluullutik pigiinnaruk",
	"common.restored": "Taarserneqarpoq {index}",
	"common.ok": "OK",
	"common.next": "Taava",
	"common.save": "Sipaarneq",
	"common.saving": "Sipaarneq ...",
	"common.select": "Toqqaruk ...",
	"common.overwrite": "Allaaserisaq",
	"common.retry": "Misilittariaqarpat",
	"common.yes": "Aap",
	"common.no": "Nr",
	"home.eyebrow": "Spilleder",
	"home.mainMenu": "Pingaarnertut nerisassiorneq",
	"home.continueGame": "Ingerlaqqigit spilleq",
	"home.latestSave": "Spillit kingullermik annaaneqarsimasut",
	"home.noCurrentGame": "Ullumikkut spilleqanngilaq",
	"home.newGame": "Spil nutaaq",
	"home.loadGame": "Last spille",
	"home.manageScenarios": "Scenarios-inik aqutsineq",
	"home.settings": "Inniminniinerit",
	"home.exitApp": "App-imiit anigit",
	"home.exitQuestion": "App-imiit anissavit?",
	"home.exitConfirm": "Angerlarsimaffik",
	"home.exitAnyway": "Taamaakkaluartoq anigit",
	"home.activeWrites": {
		plural: {
			one: "{count}-imik annaasaqarneq suli atuuppoq.",
			other: "{count}-inik annaasaqarnerit suli atuupput.",
		},
	},
	"newGame.title": "Spil nutaaq",
	"newGame.startingPoint": "Aallaqqaasiut",
	"newGame.useRuleSet": "Maleruagassat atorlugit ({count})",
	"newGame.ruleSetDetail": "Sungiusaasunik nutaanik aamma aqqinik toqqaagit",
	"newGame.useTemplate": "Atorlugu qalipaat ({count})",
	"newGame.templateDetail": "Piareersimasumik spille-mik atortulersuut atoruk",
	"newGame.ruleSet": "Maleruagassat",
	"newGame.template": "Qalipaat",
	"newGame.noEntries": "Allattorsimaffiit pissarsiarineqarsinnaanngillat",
	"newGame.noRuleSets": "Maleruagassat atorneqarsinnaanngillat.",
	"newGame.noTemplates": "Qalipaatit atorneqarsinnaanngillat.",
	"newGame.playerCount": "Arsaattartut amerlassusaat",
	"newGame.gameName": "Spilnavn",
	"newGame.generatedName": "Nammineerluni pilersinneqartoq",
	"newGame.prepare": "Piareersarlugu spilleq",
	"newGame.noRuleSetSelected": "Maleruagassat toqqarneqanngillat.",
	"newGame.noTemplateSelected": "Qalipaat toqqarneqanngilaq.",
	"loadGame.title": "Last spille",
	"loadGame.search": "Spillit annaaneqarsimasut ujarlugit",
	"loadGame.reading": "Spillit annaaneqarsimasut ikkussorneqarput...",
	"loadGame.repairImportQuestion": "Iluarsaassineq tunisassiornermut fili?",
	"loadGame.alreadyExists": "Spil annaaneqarsimasoq pioreerpoq",
	"loadGame.existingFile": "Arkivik pioreersoq",
	"loadGame.importedFile": "Fileq tunineqarsimasoq",
	"loadGame.overwriteExisting": "Allattorsimaffik pioreersoq",
	"loadGame.players": {
		plural: {
			one: "{count} spiller",
			other: "{count}-inik sungiusaasunik",
		},
	},
	"loadGame.loading": "Last...",
	"loadGame.noMatches":
		"Spillit annaaneqarsimasut naleqquttut nassaarineqanngillat.",
	"loadGame.deleteQuestion": "Ilumut ”{name}”-imik piiaasinnaavit?",
	"loadGame.setup": "Atorneqarnera",
	"loadGame.night": "Unnuk {number}",
	"loadGame.day": "Ulloq {number}",
	"loadGame.readError": "Spil-i annaaneqarsimasoq atuarneqarsinnaasimanngilaq.",
	"scenarios.title": "Scenarios-inik aqutsineq",
	"scenarios.filter": "Filterimik pissutsit",
	"scenarios.filter.all": "Tamarmik",
	"scenarios.filter.ruleSets": "Maleruagassat",
	"scenarios.filter.templates": "Skabelonit",
	"scenarios.ruleSet": "Maleruagassat",
	"scenarios.template": "Qalipaat",
	"scenarios.reading": "Ikkussuussinermi pissutsit...",
	"scenarios.empty": "Scenarios-inik pissarsisoqanngilaq.",
	"scenarios.create": "Pilersitsineq",
	"scenarios.newRuleSet": "Maleruagassat nutaat",
	"scenarios.invalidRuleSet": "Maleruagassat atuunneq ajortut",
	"scenarios.ruleSetMetadata":
		"Version {version} · {teams} holdit · {roles} roller",
	"scenarios.templateMetadata": {
		plural: {
			one: "{count} seat · {ruleSet}",
			other: "{count} siat · {ruleSet}",
		},
	},
	"scenarios.savedAt": "Annaaneqarpoq: {date}",
	"scenarios.newWorkingCopy": "Suliassaq nutaaq",
	"scenarios.duplicated": "Marloqiusamik",
	"scenarios.detailsReading": "Atuarnissamut kisitsisit ...",
	"scenarios.loadError": "Scenarios-i ilanngunneqarsinnaasimanngilaq.",
	"scenarios.exportUnsupported":
		"Ullumikkut allaffimmi avammut tuniniaaneq tapersersorneqanngilaq.",
	"scenarios.exported": "”{name}” tunineqarpoq.",
	"scenarios.shared": "”{name}” avitseqatigiissutigineqarpoq.",
	"scenarios.copySaved": "Nutaamik assilisaq annaaneqarpoq.",
	"scenarios.changesSaved": "Allanngortiterinerit annaaneqarput.",
	"scenarios.justSaved": "Aatsaat annaaneqarpoq",
	"scenarios.detailExported": "Scenarioq tunineqarpoq.",
	"scenarios.detailShared": "Scenarioq avitseqatigiissutigineqarpoq.",
	"scenarios.deleted": "”{name}” piiarneqarpoq.",
	"scenarios.renamed": "Aqqa allanngortinneqarpoq ”{name}”.",
	"scenarios.duplicatedMessage": "”{name}”-mik marloqiusamik.",
	"scenarios.restoredRestriction":
		"Qalipaat iluarsineqarsimasoq taamaallaat kopierneqarsinnaavoq imaluunniit avammut tunineqarsinnaavoq.",
	"scenarios.repairImportQuestion": "Tunisassiaq iluarsiniarlugu?",
	"scenarios.ruleSetExists": "Maleruagassaq atuuttoq pioreerpoq",
	"scenarios.templateExists": "Qalipaat pioreerpoq",
	"scenarios.existingObject": "Objekti pioreersoq",
	"scenarios.importedObject": "Tunisassiaq tunineqartoq",
	"scenarios.overwriteExisting": "Objektimik pioreersumik allattorlugu",
	"scenarios.deleteQuestion": "Qularnanngilaq ”{name}”-imik piiaasoqarnissaa?",
	"settings.title": "Inniminniinerit",
	"settings.general": "Tamakkiisumik",
	"settings.language": "Oqaatsit",
	"settings.language.system": "Systemip oqaasii",
	"settings.appearance": "Isikkoq",
	"settings.theme.system": "Systemimik",
	"settings.theme.light": "Qinngorneq",
	"settings.theme.dark": "Taarsiullugu",
	"settings.duringGame": "Spillep nalaani",
	"settings.hideExpiredStatuses": "Status-it atuuttut toqqoqqapput",
	"settings.seatCircleNorthFirst":
		"Issiavik siulleq issiaviit diagrammiata qulaani inissiguk.",
	"settings.seatCircleNorthLast":
		"Issiavik kingulleq issiaviit diagrammiata qulaani inissiguk.",
	"settings.seatCircleClockwise":
		"Issiaviit ur-ip tungaanut cirkel-ip eqqaani aaqqissuutikkit.",
	"settings.seatCircleCounterClockwise": "Ulloriarsiornermut illuatungaanut",
	"settings.keepScreenAwake": "Skærmi eqqissisimatinniarlugu",
	"settings.hapticFeedback": "Haptisk feedback",
	"settings.autoRotate": "Nammineq atorlugu atorlugu",
	"settings.accessibility": "Atorsinnaassuseq",
	"settings.textSize": "Allattorsimaffiup annertussusaa",
	"settings.textSize.small": "Kisitsisit",
	"settings.textSize.standard": "Nalinginnaasumik",
	"settings.textSize.large": "Annertooq",
	"settings.reduceMotion": "Inuussutissarsiorneq annikillisarlugu",
	"settings.data": "Paasissutissat",
	"settings.createBackup": "Pilersitsineq sillimmasiissut",
	"settings.exportLibrary": "Atuagaarniarfik avammut tuniniaaneq",
	"settings.shareBackup": "Sillimmasiissut avitseqatigiissutigiuk",
	"settings.shareLibrary": "Atuagaarniarfik allamik app-imik nassiuk",
	"settings.backupShared": "Sillimmasiissut avitseqatigiissutigineqarpoq.",
	"settings.restoreLibrary": "Atuagaarniarfik iluarsiniarlugu",
	"settings.replaceLibrary": "Atuagaarniarfik taarserlugu",
	"settings.deleteAllData": "Paasissutissat tamarmik piiaruk",
	"settings.about": "pillugu",
	"settings.version": "-mik saqqummersitsineq",
	"settings.licenseSummaryDisclaimer":
		"Nalunaarusiaq una naatsumik allaaserineqarpoq akuersissummillu allaaserisaq tamakkerlugu taarserneqanngilaq. Akuersissummi allaaserisaq tamakkerlugu kisimi oqartussaassuseqarpoq.",
	"settings.viewLicense": "Software-imut akuersissut ammaruk",
	"settings.copyrightHolder": "Pisinnaatitaaffimmik piginnittuusoq",
	"settings.softwareLicense": "Softwaremut akuersissut",
	"settings.openSourceLicenses": "Avammut akuersissutit",
	"settings.licenseNotice":
		"Qularnaveeqquteqanngilaq. Software una AGPL-3.0-only-imi malittarisassat malillugit atorsinnaavat, allanngortissinnaavat aammalu siammartersinnaavat.",
	"settings.backupCreated":
		"Atuagaarniarfimmi sillimmasiissut pilersinneqarpoq.",
	"settings.restoreComplete": "Atuagaarniarfik tamakkerlugu iluarsineqarpoq.",
	"settings.restoreDiscarded": {
		plural: {
			one: "Atuagaarniarfik iluarsineqarpoq. {count} atuunneq ajortoq malittarisassaq peerneqarpoq.",
			other:
				"Atuagaarniarfik iluarsineqarpoq. {count} atuunneqanngitsut malittarisassat tunuartinneqarput.",
		},
	},
	"settings.replaceQuestion": "Atuagaarniarfik tamakkerlugu taarseruk?",
	"settings.replaceDescription":
		"Atuagaarniarfik ullumikkut atuuttoq ”{fileName}”-imik taarserneqassaaq.",
	"settings.currentStorageVersion": "Ullumikkut toqqorsivikVersion",
	"settings.importedStorageVersion": "Tunineqarsimasoq allagartaqVersion",
	"settings.unknown": "ilisimaneqanngilaq",
	"settings.validRuleSets": "Maleruagassat atuuttut",
	"settings.discardedRuleSets": "Maleruagassat atorneqartussat",
	"settings.invalidRuleSetsDiscarded":
		"Maleruagassat atuunneqanngitsut tunuartinneqarput: {ids}",
	"settings.importValidOnly": "Atuuttut kisimik tunisassiariuk",
	"settings.tryRepair": "Iluarsaassinissaq misilerarneqarpoq",
	"settings.saveFailedTitle": "Inniminniinerit annaanneqarsinnaasimanngillat.",
	"settings.saveFailedQuestion": "Misilittariaqarpiuk?",
	"error.unknown": "Ilisimaneqanngilaq kukkuneq.",
	"error.technicalDetails": "Teknikkikkut paasissutissat",
	"error.technicalInline": "Teknikkikkut paasissutissat: {details}",
	"error.details.copy": "Kopi Detaljer",
	"error.details.copied": "Kopierneqarpoq",
	"error.details.source": "Killeq",
	"error.details.operation": "Suliaq",
	"error.details.subject": "Sammisaq",
	"error.details.reason": "Pissutaasoq",
	"error.details.diagnostic": "Nappaatip suussusaa",
	"error.details.type": "Fejltype",
	"error.details.message": "Kukkunermik nalunaaruteqarneq",
	"error.details.cause": "Pissutaasoq",
	"error.details.stack": "Stack spor",
	"error.unexpected":
		"Naatsorsuutigineqanngitsumik qinnuteqaammi kukkuneq. Kukkuneq una nalunaarutigiuk.",
	"error.dataNotFound":
		"Paasissutissat annaaneqarsimasut nassaarineqarsinnaasimanngillat.",
	"error.dataUnreadable":
		"Paasissutissat annaaneqarsimasut atuarneqarsinnaanngillat.",
	"error.storageUnavailable": "Toqqorsivik ullumikkut atorneqarsinnaanngilaq.",
	"error.diskFull":
		"Toqqorsivik tamakkersimavoq. Inissaq annaakkit misiliillutillu.",
	"error.writeFailed":
		"Paasissutissat isumannaatsumik annaanneqarsinnaasimanngillat.",
	"error.targetExists": "Paasissutissat toqqorsivimmi pioreerput.",
	"error.invalidFileReference": "Filemut najoqqutassiaq atuunneqanngilaq.",
	"error.incompleteRecovery":
		"Taarsiivigineqarnermi paasissutissat naammassineqanngillat.",
	"error.invalidJson": "Fileq JSON-imik atuuttumik imaqanngilaq.",
	"error.invalidDocument": "Fileq atuuttumik sananeqaateqanngilaq.",
	"error.unsupportedVersion": "File-p versionia tapersersorneqanngilaq.",
	"error.encodingFailed": "File-p kode-a atuarneqarsinnaanngilaq.",
	"error.invalidObject": "Objekt annaaneqarsimasoq atorneqanngilaq.",
	"error.repairFailed": "Atortoq annaaneqartoq iluarsineqarsinnaasimanngilaq.",
	"error.decisionExpired": "Aalajangiineq piumasarineqartoq atuunneqanngilaq.",
	"error.decisionRequired":
		"Suliaq taanna ingerlaqqissinnaannginnerani aalajangiisoqarnissaa pisariaqarpoq.",
	"error.invalidDecision":
		"Aalajangiineq taanna ullumikkut iliuuseqarnissamut atorneqarsinnaanngilaq.",
	"error.wrongObjectKind":
		"File toqqarneqarsimasoq objekttype-mik naatsorsuutigineqartumik imaqanngilaq.",
	"error.invalidValue": "Pingaarnertut allanneqarsimasoq atuunneqanngilaq.",
	"error.preconditionNotMet":
		"Ingerlatsineq ullumikkut inissisimaffimmi ingerlanneqarsinnaanngilaq.",
	"error.protectedObject":
		"Objekti ullumikkut atorneqartoq allanngortinneqarsinnaanngilaq aammalu piiarneqarsinnaanngilaq.",
	"error.entityNotFound": "Piumasaqaat nassaarineqarsinnaasimanngilaq.",
	"error.unsupportedMediaType":
		"Filtype toqqarneqarsimasoq tapersersorneqanngilaq.",
	"error.invalidResourceSource": "Assilisaq atorneqanngilaq.",
	"error.unsafeResourceSource":
		"Assilisaq isumannaallisaanermut tunngatillugu itigartinneqarpoq.",
	"error.ruleSetInvalid":
		"Regelset-i annaaneqartoq atuuttumik sananeqaateqanngilaq.",
	"error.fileNameInvalid": "Filep aqqa atorneqanngilaq.",
	"error.savedDataUnreadable":
		"Paasissutissat allanneqarsimasut atuarneqarsinnaasimanngillat.",
	"error.savedDataInvalidJson":
		"Paasissutissat allanneqarsimasut JSON-imik atuuttumik imaqanngillat.",
	"error.savedObjectInvalid":
		"Objekti annaaneqartoq atuuttumik sananeqaateqanngilaq.",
	"error.savedObjectUnsupportedVersion":
		"Objektip annaanneqarsimasup versionia tapersersorneqanngilaq.",
	"error.savedObjectEncodingFailed":
		"Objektip annaanneqarsimasup kode-a atuarneqarsinnaasimanngilaq.",
	"error.savedObjectProcessingFailed":
		"Objekt annaaneqarsimasoq suliarineqarsinnaasimanngilaq.",
	"error.objectStoreMissing":
		"Objekt-imik pisiniarfik nassaarineqarsinnaasimanngilaq.",
	"error.objectStoreUnreadable":
		"Objekt-imik pisiniarfik atuarneqarsinnaasimanngilaq.",
	"error.objectStoreInvalidJson":
		"Objekt-imik pisiniarfik JSON-imik atuuttumik imaqanngilaq.",
	"error.objectStoreInvalid":
		"Objekt-imik pisiniarfik atuuttumik sananeqaateqanngilaq.",
	"error.objectStoreUnsupportedVersion":
		"Objektbutikkip versionia tapersersorneqanngilaq.",
	"error.objectStoreEncodingFailed":
		"Objektbutikkimik kode-q atuarneqarsinnaasimanngilaq.",
	"error.objectStoreProcessingFailed":
		"Objekt-imik pisiniarfik suliarineqarsinnaasimanngilaq.",
	"error.newFileMissing": "File nutaaq amigaatigineqarput.",
	"error.incompleteWrite": "Save-mik ingerlatsineq naammassineqanngilaq.",
	"error.ruleSetStoreInvalidJson":
		"Regelset-ip pisiniarfiani JSON-imik atuuttumik imaqanngilaq.",
	"error.ruleSetsUnreadable":
		"Maleruagassat annaaneqarsimasut atuarneqarsinnaasimanngillat.",
	"error.ruleSetStoreInvalid":
		"Ruleset-imik pisiniarfik atuuttumik sananeqaateqanngilaq.",
	"errorBoundary.eyebrow": "Qinnuteqaammi kukkuneq",
	"errorBoundary.title": "Atuisoq takuneqarsinnaasimanngilaq.",
	"errorBoundary.retry": "Misilittariaqarpat",
	"success.imported.game": "Spil-i annaaneqarsimasoq ”{name}” tunineqarpoq.",
	"success.imported.template": "Qalipaat ”{name}” tunineqarpoq.",
	"success.imported.ruleSet": "Maleruagassaq ”{name}” tunineqarpoq.",
	"success.imported.library": "Atuagaarniarfik tunineqarpoq.",
	"success.recovered.game":
		"Spil-i ”{name}” annaaneqarsimasoq iluarsineqarpoq.",
	"success.recovered.template": "Qalipaat ”{name}” iluarsineqarpoq.",
	"success.recovered.ruleSet": "Maleruagassaq ”{name}” iluarsineqarpoq.",
	"success.recovered.library": "Atuagaarniarfik iluarsineqarpoq.",
	"success.restored.library":
		"Atuagaarniarfik sillimmasiisarfimmiit iluarsineqarpoq.",
	"success.repaired.game": "Spil-i annaaneqartoq ”{name}” iluarsineqarpoq.",
	"success.repaired.template": "Qalipaat ”{name}” iluarsineqarpoq.",
	"success.repaired.ruleSet": "Maleruagassaq ”{name}” iluarsineqarpoq.",
	"success.repaired.library": "Atuagaarniarfik iluarsartuunneqarsimavoq.",
	"repairReport.title": "Atuagaarniarfik iluarsartuunneqarsimavoq",
	"repairReport.acceptedRuleSets": {
		plural: {
			one: "{count} malittarisassaq akuerineqarpoq.",
			other: "{count} malittarisassat akuerineqarput.",
		},
	},
	"repairReport.removedRuleSets": "Maleruagassat peerneqarput",
	"repairReport.removed.notAnObject":
		"Regelset-imik allattorsimaffik annaaneqartoq objektinngilaq.",
	"repairReport.removed.repairFailed":
		"Maleruagassat iluarsineqarsinnaasimanngillat.",
	"repairReport.change.missingStatusDefinitionAdded":
		"Maleruagassat {ruleSetLabel}: ilanngunneqarpoq amigaatigineqartut statusdefinition ”{status}”.",
	"repairReport.change.ruleSetUnknownFieldsRemoved":
		"Maleruagassat {ruleSetLabel}: ilisimaneqanngitsunik allagartat ({fields}) peerneqarput.",
	"repairReport.change.teamUnknownFieldsRemoved":
		"{ruleSetLabel}-imi {index}-imik tigummigit: ilisimaneqanngitsunik allagartat ({fields}) peerneqarput.",
	"repairReport.change.roleUnknownFieldsRemoved":
		"Rolle {index} {ruleSetLabel}-imi: ilisimaneqanngitsunik allagartat ({fields}) peerneqarput.",
	"repairReport.change.statusUnknownFieldsRemoved":
		"Status {index} {ruleSetLabel}-imi: ilisimaneqanngitsunik allagartat ({fields}) peerneqarput.",
	"repairReport.change.ruleSetIdCollisionResolved":
		"Regelset {storedId}: allanngortinneqarpoq ID-mik ”{newId}”-imik.",
	"repairReport.change.ruleSetsContainerReplaced":
		"Taarserneqarpoq ruleSetsById-imik amigaateqartumik imaluunniit atuunneqanngitsumik container-imik imaqanngitsumik.",
	"repairReport.change.libraryUnknownFieldsRemoved":
		"Atuagaarniarfik: ilisimaneqanngitsunik allagartat ({fields}) peerneqarput.",
	"repairReport.change.insertedMissingQuote":
		"Ilanngunneqarpoq {position}-imi inissisimaffimmi amigaatigisaq.",
	"repairReport.change.addedClosingBraces": {
		plural: {
			one: "Ilanngunneqarpoq ataaseq amigaatigisaq.",
			other:
				"Ilanngunneqarput {count}-it amigaatigineqartut kingullermik tuborg-imik ikkussorneqartut.",
		},
	},
	"repairReport.change.addedOpeningBraces": {
		plural: {
			one: "Ilanngunneqarpoq ataaseq amigaatigisaq avammut tuborg-imik holderi.",
			other:
				"Ilanngunneqarput {count}-it amigaatigineqartut ammasut tuborg-it.",
		},
	},
	"game.menu.open": "Avammut spillemeny",
	"game.menu.title": "Spilmeny",
	"game.menu.actions": "Spil-imik iliuuseqarneq",
	"game.menu.save": "Spil-imik annaasaqarneq",
	"game.menu.saveAs": "Spil-imik annaasaqarneq soorlu",
	"game.menu.saveAsTemplate": "Spil-imik Skabelon-imik annaasaqartoq",
	"game.menu.exit": "Angerlarsimaffik",
	"game.menu.manageEntities":
		"Team-inik, rollerinik aamma inissisimaffinnik aqutsineq",
	"game.menu.randomizeRoles": "Rollerinik tilfeldig-imik tunniussineq",
	"game.menu.shufflePlayers": "Shuffle-mik sungiusaasunik",
	"game.menu.rolesForShowing": "Rollerit takutinneqartussat",
	"game.menu.showLog": "Takuuk nalunaarsuiffik",
	"game.menu.settings": "Inniminniinerit",
	"game.currentGame": "Ullumikkut spilleq",
	"game.unlockSeatOrder": "Issiavimmik inniminniineq",
	"game.lockSeatOrder": "Issiavimmik inniminniineq",
	"game.playerOverview": "Arsaattartoq pillugu nassuiaat",
	"game.seatOrder": "Issiavimmik inniminniineq",
	"game.zoomControls": "Zoom-imik issiavimmi cirkel-imut",
	"game.zoomOut": "Issiaviup cirkel-ianiit annertussuseq",
	"game.zoomIn": "Zoom-imik issiavimmut cirkel-imut",
	"game.zoomLevel": "Zoomniveau: {percent} Procent",
	"game.showSeatCircle": "Takuuk Issiavik Cirkel",
	"game.showPlayerOverview": "Spillerimik nassuiaat takuuk",
	"game.seatAccessible": "Sumiiffimmi {seat}{marker}",
	"game.sourceAndTargetSuffix": ", killeq aamma mål",
	"game.sourceSuffix": ", killeq",
	"game.targetSuffix": ", mål",
	"game.deleteSeat": "Piffissaq {seat} piiaruk",
	"game.addPlayerAfterSeat": "Sungiusaasoq {seat} atorlugu ilanngukkit",
	"game.flow": "Spillep ingerlanera",
	"game.showRoles": "Rollerit takutikkit",
	"game.nightList": "Unnukkut allattorsimaffik",
	"game.seat": "Slot {seat}",
	"game.details": "Immikkuualuttut",
	"game.actionsForSeat": "Suliassat {seat}-imut",
	"game.deleteSelectedSeat": "Toqqakkat inissisimaffiat {seat} piiaruk",
	"game.addPlayerAfterSelectedSeat":
		"Toqqarneqarsimasup kingorna spiller ilanngukkit {seat}",
	"game.restoreSplitView": "Iluarsaassineq immikkoortinneqartoq",
	"game.showDetailsFullscreen": "Skærmi tamakkerlugu kisitsisit takutikkit",
	"game.manualSeat": "Issiaviup normua",
	"game.selectSeat": "Issiavik toqqaruk",
	"game.lifeState": "Inuunermi inissisimaneq",
	"game.life.alive": "Uumasoq",
	"game.life.deadVoteAvailable": "Toqusoq - qinersisoqarsinnaavoq",
	"game.life.deadVoteSpent": "Toqusoq - qinersineq atorneqarpoq",
	"game.life.doubleDeadVoteAvailable":
		"Marloqiusamik toqusoq - qinersisoqarsinnaavoq",
	"game.life.doubleDeadVoteSpent":
		"Marloqiusamik toqusoq - qinersineq atorneqarpoq",
	"game.life.aliveShort": "Uumasoq",
	"game.life.deadVoteAvailableShort": "Toqusoq · qinersisoqarsinnaavoq",
	"game.life.deadVoteSpentShort": "Toqusoq · qinersineq atorneqartoq",
	"game.life.doubleDeadVoteAvailableShort":
		"Marloqiusamik toqusoq · qinersisoqarsinnaavoq",
	"game.life.doubleDeadVoteSpentShort":
		"Marloriaq toqusoq · qinersineq atorneqartoq",
	"game.noRole": "Rolleqanngilaq",
	"game.team": "Team",
	"game.rolesWithoutTeam": "Holdimik peqanngilaq",
	"game.role.actual": "Ilumut rolle",
	"game.role.shown": "Rolle takutinneqarpoq",
	"game.role.night": "Unnukkut rolle",
	"game.role.claimed": "Rolle-mik taaneqartartoq",
	"game.statuses": "Pissutsit",
	"game.status": "Pissutsit",
	"game.statusDuration": "Unnuk {from}–{until}",
	"game.openEnded": "ammavoq",
	"game.newStatus": "Nutaamik inissisimaneq",
	"game.deletePlayer": "Spillerimik piiaaneq",
	"game.player": "Arsaattartoq",
	"game.selectPlayer": "Sungiusaasoq toqqaruk ...",
	"game.addPlayer": "+ Arsaattartoq",
	"game.deleteEmptySeat": "Slot-imik imaqanngitsumik piiaaneq",
	"game.emptySeat": "Una slot-i imaqanngilaq.",
	"game.selectSeatPrompt": "Slot-imik toqqaagit.",
	"game.playerWithName": "Sungiusaasoq: {name}",
	"game.deleteQuestion": "piiaruk?",
	"game.newSeatAfter": "nutaaq slot kingorna",
	"game.addQuestion": "ilanngussaq?",
	"game.seatActionCancel": "Annaasaqarneq",
	"game.unsavedTitle": "Spil suli annaanneqanngilaq.",
	"game.saveAndExit": "Spil-imik annaasaqarneq aamma anineq",
	"game.exitWithoutSaving": "Spil-imiit aninissaq annaasaqanngitsumik",
	"game.saveFailedTitle": "Fileq annaanneqarsinnaanngilaq.",
	"game.targetExists": "Fili taamatut ateqartoq pioreerpoq.",
	"game.saveRecoveryQuestion":
		"Save-mik suliaqarneq kukkuneqartoq qanoq iliorfigisinnaaviuk?",
	"game.storageCommandInactive": "Peqqussut annaasaqarneq atuutinngilaq.",
	"game.decideLater": "Kingusinnerusukkut aalajangissavat",
	"game.setup": "Atorneqarnera",
	"game.nightNumber": "Unnuk {number}",
	"game.dayNumber": "Ulloq {number}",
	"game.backToGame": "Utertitsineq spillemut",
	"game.log.title": "Nalunaarsuiffik",
	"game.log.empty": "Suli log-imut allattuisoqanngilaq.",
	"game.log.timeAdvanced":
		"Piffissaq siumut ingerlaqqinneqartoq: {oldTime} → {newTime}.",
	"game.log.timeRewound":
		"Piffissaq kinguartinneqarpoq: {oldTime} → {newTime}.",
	"game.log.lifeStateChanged":
		"Inuunermi inissisimaneq {player}-imi: {oldState} → {newState}.",
	"game.log.statusApplied": "Pissutsit {status} {player}-imut atuupput.",
	"game.log.rolesDistributed": {
		plural: {
			one: "{count} rolle tilfældigt tunniunneqarpoq.",
			other: "{count} rollerit randomimik tunniunneqarput.",
		},
	},
	"game.log.selectedRolesDistributed": {
		plural: {
			one: "{count} toqqarneqarsimasoq rolle-mik random-imik tunniussisoqarpoq.",
			other: "{count} toqqarneqarsimasut rollerit randomimik tunniunneqarput.",
		},
	},
	"game.log.seatMoved":
		"Sungiusaasoq {playerName} inissisimaffimmiit {fromSeat}-imiit inissisimaffimmut {toSeat}-imut nuunneqarpoq.",
	"game.log.seatsSwapped": "Atorfiit {seatA} aamma {seatB} taarserneqarput.",
	"game.log.playerAppended":
		"Sungiusaasoq {playerName} inissisimaffimmi {toSeat}-imi inissinneqarpoq.",
	"game.log.playerInserted":
		"Isertitsivoq spiller {playerName} inissisimaffimmi {toSeat}-imi.",
	"game.log.playerRemoved":
		"Sungiusaasoq {playerName} inissisimaffimmiit {fromSeat}-imiit peerneqarpoq.",
	"game.log.seatOrderChanged":
		"Atorfiit aaqqissugaanerat allanngortinneqarpoq.",
	"game.roleReveal.navigation": "Saqqummersitsisoq rolle",
	"game.roleReveal.prompt":
		"Takutiguk {player} (inissisimaffik {seat}) taakku suliassaat. Saqqummissallugu tooruk.",
	"game.overview.seat": "Sumiiffimmi",
	"game.overview.role": "Rolle",
	"game.sourceAndTarget": "Killeq/Nalunaarsuiffik",
	"game.source": "Killeq",
	"game.target": "Atorfik",
	"game.overview.playerAccessible": "{name}, plads {seat}{marker}",
	"game.overview.shownRole": "Takutinneqartoq: {role}",
	"game.overview.nightRole": "Unnuk: {role}",
	"game.night.noActiveRoles":
		"Unnuk manna unnukkut aktive rollerinik peqanngilaq.",
	"game.night.actionFor": "{player}-imut iliuuseqarneq",
	"game.night.action": "Suliaq",
	"game.night.on": "pillugu",
	"game.night.targetPlayer": "Targetspiller",
	"game.night.noEffect": "Suliaq sunniuteqanngilaq.",
	"game.night.execute": "Ingerlatsineq",
	"game.night.kill": "Toqutsivoq",
	"game.night.resurrect": "Uummatilerpaa",
	"game.action.kill": "toqutsineq",
	"game.action.resurrect": "utertitsineq",
	"game.action.applyStatus": "qinnuteqarnissamut inissisimaneq",
	"game.action.unknown":
		"iliuuseq ilisimaneqanngitsoq (kode-p iluani: {action})",
	"game.life.dead": "Toqusoq",
	"game.warning.playerNotFound": "Spiller ”{playerId}” atorneqanngilaq.",
	"game.warning.statusNotFound": "Pissutsit ”{statusId}” atorneqanngilaq.",
	"game.warning.actorNotFound": "Spiller ”{playerId}” atorneqanngilaq.",
	"game.warning.targetNotFound": "Targetspiller ”{playerId}” peqanngilaq.",
	"game.warning.actualRoleNotFound":
		"Sungiusaasumut ”{playerId}”-mut ilumut rolle nassaarineqanngilaq.",
	"game.warning.abilityAmbiguous":
		"Rollemut ”{roleName}”-imut piginnaaneq marlunnik isumaqarpoq.",
	"game.warning.statusAmbiguous":
		"Status atorneqartussaq marlunnik isumaqarpoq.",
	"game.warning.voteAlreadySpent": "Spøgelsstemme atorneqareersimavoq.",
	"game.warning.abilityNotAllowed":
		"Rolle ”{roleName}”-ip iliuuseq ”{action}” salliunngilaa.",
	"game.warning.statusNotAllowed":
		"Rolle ”{roleName}”-ip inissisimanera ”{statusId}” atorsinnaanngilaa.",
	"game.statusEditor.title": "Status-imik allanngortitsineq",
	"game.statusEditor.status": "Pissutsit",
	"game.statusEditor.fromNight": "Unnukkut",
	"game.statusEditor.untilNight": "Unnuk taanna",
	"game.statusEditor.note": "Oqaaseqaatit",
	"game.playerName": "Arsaattartup aqqa",
	"recovery.kind.game": "spil annaaneqartoq",
	"recovery.kind.template": "-mik qalipaat",
	"recovery.kind.ruleSet": "malittarisassat",
	"recovery.backupFile": "-mik sillimmaserneq",
	"recovery.temporaryFile": "piffissap ilaani iluarsaaqqinnermut fili",
	"recovery.incompleteSave": "Save-mik ingerlatsineq naammassineqanngilaq",
	"recovery.openCount": "({count} ammasoq)",
	"recovery.orphanedFile":
		"A {recoveryFile} nassaarineqarpoq, kisianni {kind}-imut naleqquttoq peqanngilaq.",
	"recovery.twoFiles":
		"{kind}-imut ”{id}”-mut filimik pisoqaasumik aammalu immaqa nutaamik nassaartoqarpoq.",
	"recovery.keepOld": "Arkivik qangarnisaq pigiuk",
	"recovery.keepNew": "Nutaamik filimik ingerlatsineq",
	"recovery.keepBothFiles": "Filit marluk paariuk",
	"recovery.exportBrokenFile": "Fil-imik ajoqusersimasumik avammut niuerneq",
	"recovery.decideLater": "Kingusinnerusukkut aalajangissavat",
	"recovery.invalidObjectTitle":
		"Atorneqanngitsoq annaaneqarsimasoq nassaarineqarpoq",
	"recovery.affectedObject": "Suliaq sunniuteqartoq ({kind}): ”{reference}”",
	"recovery.file": "Arkiv",
	"recovery.suggestedFileName": "Siunnersuutigineqartoq filip aqqa",
	"recovery.repairObject": "Iluarsaassineq",
	"recovery.repairFileName": "Iluarsaaqqinnermi filip aqqa",
	"recovery.exportObject": "Objektimik tuniniaaneq",
	"recovery.deleteObject": "Objektimik piiaaneq",
	"recovery.reason.invalidRuleSet":
		"Regelset-i annaaneqarsimasoq atuuttumik sananeqaateqanngilaq.",
	"recovery.reason.invalidFileName":
		"JSON-fil-ip taaguuteqarnissamut malittarisassat malinngilai.",
	"recovery.reason.decodeFailed": "Fileq dekodeqarsinnaasimanngilaq.",
	"recovery.reason.invalidJson": "Fileq JSON-imik atuuttumik imaqanngilaq.",
	"recovery.reason.invalidTemplate": "JSON-data-t atortussaanngillat.",
	"recovery.reason.invalidGame": "JSON-data-t atuuttumik spillerfiunngillat.",
	"recovery.rememberDecision":
		"Aalajangiineq una eqqaamajuk aammalu kukkunernut tamanut assigiimmik nalinginnaasumik atuutsinniarlugu",
	"recovery.library.missing": "Atuagaarniarfik nassaarineqarsinnaasimanngilaq.",
	"recovery.library.orphanedTemporary":
		"Piffissap ilaani iluarsaaqqinnissamut fili nassaarineqarpoq, kisianni atuakkiorfik tassunga attuumassuteqartoq peqanngilaq.",
	"recovery.library.orphanedBackup":
		"Sillimmasiissut nassaarineqarpoq, kisianni atuakkiorfik tassunga attuumassuteqartoq peqanngilaq.",
	"recovery.library.decodeFailed":
		"Atuagaarniarfiup filia dekodeqarsinnaasimanngilaq.",
	"recovery.library.invalidJson":
		"Atuagaarniarfimmi filimi JSON-imik atuuttumik imaqanngilaq.",
	"recovery.library.invalidRuleSet":
		"Atuagaarniarfimmi malittarisassanik atuinngitsunik imaqarpoq.",
	"recovery.library.invalidDocument": "JSON-data-t atuakkiorfiunngillat.",
	"recovery.library.title": "Atuagaarniarfik atuarneqarsinnaanngilaq",
	"recovery.library.restoreBackup": "Sillimmasiissut iluarsiniarlugu",
	"recovery.library.repair": "Atuagaarniarfik iluarsaassineq",
	"recovery.library.createEmpty":
		"Atuagaarniarfimmik nutaamik imaqanngitsumik pilersitsineq",
	"recovery.library.export": "Atuagaarniarfik avammut tuniniaaneq",
	"rolesForShowing.title": "Rollerit takutinneqartussat",
	"rolesForShowing.closePreview": "Qanittukkut takussutissiaq",
	"rolesForShowing.freeText": "Allaaserisaq akeqanngitsoq",
	"rolesForShowing.roles": "Rollerit",
	"rolesForShowing.removeRole": "{name}-imik piiaaneq",
	"rolesForShowing.empty": "Suli rollerit toqqarneqanngillat.",
	"rolesForShowing.addRole": "+ Rolle",
	"rolesForShowing.showSymbol": "Rollesymboli takuuk",
	"rolesForShowing.preview": "Siullermeerneq",
	"rolesForShowing.addRoleTitle": "Rolle ilanngukkit",
	"roleDistribution.title": "Rollerit tilfældigt toqqakkit",
	"roleDistribution.teamDistribution": "Team-imik immikkoortitsineq",
	"roleDistribution.roleSelection": "Rolle-mik toqqaaneq",
	"roleDistribution.type": "Rolle-nik immikkoortitsinermi periuseq",
	"roleDistribution.random.title": "Tilfældig rollerinik immikkoortitsineq",
	"roleDistribution.random.detail":
		"Holdit annertussusaat aalajangersarlugit aammalu rollerinik titartaasarneq",
	"roleDistribution.selected.title":
		"Rollerit toqqarneqarsimasut toqqaannartumik immikkoortiterlugit",
	"roleDistribution.selected.detail":
		"Rollit immikkut ittut toqqakkit aammalu random-imik toqqakkit",
	"roleDistribution.manual.title": "Rollerit manuelt toqqakkit",
	"roleDistribution.manual.detail":
		"Spilleskærmimi kingusinnerusukkut rollerinik toqqaagit",
	"roleDistribution.overwriteRunning":
		"Spilleq ingerlaqqippoq. Rollerit pioreersut, takutinneqartut, aamma unnukkut rollit allanngortinneqassapput.",
	"roleDistribution.overwriteAssigned":
		"Rollerit tunniunneqareersut allanngortinneqassapput.",
	"roleDistribution.redistribute": "Rollerit allanngortinneqassapput",
	"roleDistribution.uniqueRoleMultiple":
		"Rolle immikkuullarissumik ataasiaannarluni toqqarneqarsimavoq",
	"roleDistribution.decrease": "Annikillisaaneq {name}",
	"roleDistribution.count": "{name}-imut amerlassuseq",
	"roleDistribution.increase": "Annertusineq {name}",
	"roleDistribution.freePlayers": "Arsaattartut immikkoortinneqanngitsut",
	"roleDistribution.distribute": "Rollerinik tunniussineq",
	"roleDistribution.error.teamHasNoRoles": {
		plural: {
			one: "Role distribution failed: {count} player was requested for team “{teamName}”, but the team has no roles.",
			other:
				"Rolle-nik agguaassineq iluatsinngilaq: {count}-mik sungiusaasunik holdimut ”{teamName}”-mut piumasaqartoqarpoq, kisianni holdimi rollerinik peqanngilaq.",
		},
	}, // This value isn't accurate translated, yet.
	"roleDistribution.error.insufficientDistinctRoles": {
		plural: {
			one: "Rolle-nik agguaassineq iluatsinngilaq: {requestedCount}-nik sungiusaasunik holdimut “{teamName}”-mut piumasaqartoqarpoq, kisianni {count}-mik immikkut ittumik rolleqarpoq aammalu rolle-mik uteqqissinnaasumik peqanngilaq.",
			other:
				"Rolle-nik agguaassineq iluatsinngilaq: {requestedCount}-nik sungiusaasunik hold-imut ”{teamName}”-mut piumasaqartoqarpoq, kisianni {count}-nik immikkuullarissunik rolleqarpoq aammalu rolle-mik uteqqissinnaasumik peqanngilaq.",
		},
	},
	"scenarioEditor.objectType": "Objektip suussusaa",
	"scenarioEditor.teams": "Holdit",
	"scenarioEditor.roles": "Rollerit",
	"scenarioEditor.players": "Arsaattartut",
	"scenarioEditor.statuses": "Pissutsit",
	"scenarioEditor.readingDetails": "Atuarnissamut kisitsisit ...",
	"scenarioEditor.create": "+ Pilersitsineq",
	"scenarioEditor.new.teams": "Nutaaq Team",
	"scenarioEditor.new.roles": "Nutaaq Rolle",
	"scenarioEditor.new.players": "Nutaaq atorlugu",
	"scenarioEditor.new.statuses": "Nutaamik inissisimaneq",
	"scenarioEditor.saveChange": "Allanngortitsineq allattorlugu",
	"scenarioEditor.saveAsNewRuleSet":
		"Allanngortitsineq nutaamik malittarisassatut allattorlugu",
	"scenarioEditor.saveAsNewTemplate":
		"Allanngortitsineq nutaamik qalipaatitut allattukkit",
	"scenarioEditor.newGameWithRuleSet":
		"Spil nutaaq malittarisassanik una atorlugu",
	"scenarioEditor.newGameFromTemplate": "Spil nutaaq skabelonimit una",
	"scenarioEditor.saveCopy": "Kopitut allattorlugu",
	"scenarioEditor.unsavedChanges": "Allannguutit suli allanneqanngillat.",
	"scenarioEditor.unsavedRuleSet": "Regelset suli annaanneqanngilaq.",
	"scenarioEditor.unsavedTemplate": "Qalipaat suli annaanneqanngilaq.",
	"scenarioEditor.saveAndContinue": "Save & ingerlaqqigit", // This value isn't accurate translated, yet.
	"scenarioEditor.continueWithoutSaving": "Ingerlaqqigit annaasaqarnani", // This value isn't accurate translated, yet.
	"scenarioEditor.saveAndExit": "Annaasaqarneq aamma anineq",
	"scenarioEditor.exitWithoutSaving": "Angerlarneq annaasaqanngitsumik",
	"scenarioEditor.editDetails": "Immikkuualuttut allanngortikkit",
	"scenarioEditor.closeDetails": "Qanittumik kisitsisit takusinnaavatit",
	"scenarioEditor.displayName": "Aqqa takutinneqartoq ({language})",
	"scenarioEditor.teamOrder": "Teamtilbud",
	"scenarioEditor.defaultDuration":
		"Unnuit atorlugit sivisussuseq nalinginnaasoq (0 = naassaanngitsoq)",
	"scenarioEditor.team": "Team",
	"scenarioEditor.firstNightOrder": "Unnuk siulleq inniminniineq",
	"scenarioEditor.otherNightOrder": "Unnuk aappaat inniminniineq",
	"scenarioEditor.unique": "Immikkuullarissumik?",
	"scenarioEditor.activeAbilities": "Pisinnaassutsit aallaaviusut",
	"scenarioEditor.canKill": "Toqutsisinnaavoq",
	"scenarioEditor.canResurrect": "Uummatilersinnaavoq",
	"scenarioEditor.canApplyStatuses": "Status-inik atuisinnaavoq",
	"scenarioEditor.noStatuses":
		"Suli inissisimaffiit aalajangersarneqanngillat.",
	"scenarioEditor.unicodeSymbol": "Unikode-mik ilisarnaat",
	"scenarioEditor.unicodePreview": "Unicode-mik siullermeerneq",
	"scenarioEditor.useColor": "Atorlugu Farve",
	"scenarioEditor.editColor": "Qalipaat allanngortiguk",
	"scenarioEditor.colorPickerTitle": "Toqqaruk Farve",
	"scenarioEditor.colorCode": "RGB-mik hex-kode",
	"scenarioEditor.colorPreview": "Qalipaatit siullermeerneqarnerat",
	"scenarioEditor.apply": "Qinnuteqarit",
	"scenarioEditor.deleteQuestion":
		"Qularnanngilaq ”{name}”-imik piiaasoqarnissaa?",
	"scenarioEditor.workingCopy": "Suliassaq",
	"app.closeError": "Suliaq pillugu nalunaarusiaq",
	"app.exited": "App-i unitsinneqarpoq.",
	"app.restart": "App-imik aallartitsineq",
	"appError.checkFiles": "Filit uppernarsarneqarsinnaasimanngillat.",
	"appError.settingsUpdate":
		"Inissiissutit allanngortinneqarsinnaasimanngillat.",
	"appError.settingsOpen": "Inniminniinerit ammarneqarsinnaasimanngillat.",
	"appError.continueLastGame":
		"Unammineq kingulleq ingerlateqqinneqarsinnaasimanngilaq.",
	"appError.continueGame": "Spilleq ingerlateqqinneqarsinnaasimanngilaq.",
	"appError.openPreparedGame":
		"Piareersarneqarsimasoq spilleq ammarneqarsinnaasimanngilaq.",
	"appError.restoreOldFile": "Fileq siulleq iluarsineqarsinnaasimanngilaq.",
	"appError.retryStorageCommand":
		"Peqqussut annaasaqarneq misilerarneqarsinnaanngilaq.",
	"appError.finishStorageCommand":
		"Save-mik peqqussut naammassineqarsinnaanngilaq.",
	"appError.continueStorageCommand":
		"Peqqussut annaasaqarneq ingerlateqqinneqarsinnaanngilaq.",
	"appError.saveGamesUnavailable":
		"Spillit annaaneqarsimasut annaanneqarsinnaanngillat.",
	"appError.saveTemplatesUnavailable": "Qalipaatit annaanneqarsinnaanngillat.",
	"appError.changeSeatOrder":
		"Issiaviit aaqqissugaanerat allanngortinneqarsinnaasimanngilaq.",
	"appError.savePlayer": "Arsaattartoq annaanneqarsinnaasimanngilaq.",
	"appError.deleteEmptySeat": "Issiavik imaqartoq piiarneqarsinnaasimanngilaq.",
	"appError.deletePlayer": "Spiller-i pissarsiarineqarsinnaasimanngilaq.",
	"appError.advanceTime":
		"Piffissaq sungiusarfiusoq siuarsarneqarsinnaasimanngilaq.",
	"appError.rewindTime":
		"Piffissaq sungiusarfiusoq siuarsarneqarsinnaasimanngilaq.",
	"appError.applyGameChanges":
		"Spillemi allanngortitsinerit atorneqarsinnaasimanngillat.",
	"appError.distributeRoles": "Rollerit agguataarneqarsinnaasimanngillat.",
	"startup.initializeFiles":
		"App-imi filit aallartisarneqarsinnaasimanngillat.",
	"startup.repairFileNames":
		"Inernermi filit aqqi iluarsineqarsinnaasimanngillat.",
	"startup.loadSettings":
		"Inniminniinerit atorneqarsinnaasimanngillat. Default-it atorneqarput.",
	"startup.rootMissing":
		"HTML-imi elementi id-mik ”root”-imik imaqartoq peqanngilaq.",
} satisfies Record<GuiTranslationKey, GuiTranslationMessage>;
