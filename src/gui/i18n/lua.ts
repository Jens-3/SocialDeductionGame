// Machine-translated Tshiluba localization; native-speaker review recommended.
import type { GuiTranslationKey } from "./de";
import type { GuiTranslationMessage } from "./messages";

export const tshilubaGuiMessages = {
	"common.back": "Kunyima",
	"common.cancel": "Kulekela",
	"common.close": "Kukanga",
	"common.later": "Pashishe",
	"common.import": "Kubueja",
	"common.export": "Kupatula",
	"common.share": "Abanya",
	"common.rename": "Kushintulula dina",
	"common.duplicate": "Dipingaja",
	"common.delete": "Supula",
	"common.deletePermanently": "Kujimija bua kashidi",
	"common.name": "Dîna",
	"common.unknown": "kayi mumanyike",
	"common.detailsParenthetical": "(Malu)",
	"common.schemaVersion": "Tshimfuanyi tshia tshimfuanyi",
	"common.actionsFor": "Bienzedi bia",
	"common.moreActionsFor": "Malu makuabu a kuenza bua {name}",
	"common.cancelImport": "Kulekela dibueja dia bintu",
	"common.tryRepair": "Teta kulongolola",
	"common.keepBoth": "Lama bionso bibidi",
	"common.restored": "Mupingaja {index}",
	"common.ok": "Biyampe",
	"common.next": "Tshidi tshilonda",
	"common.save": "Lama",
	"common.saving": "Kulama ...",
	"common.select": "Sungula …",
	"common.overwrite": "Kufunda",
	"common.retry": "Teta kabidi",
	"common.yes": "Eyowa",
	"common.no": "Tòo",

	"home.eyebrow": "Mulombodi wa manaya",
	"home.mainMenu": "Menu munene",
	"home.continueGame": "Tungunuka ne manaya",
	"home.latestSave": "Dinaya dia lelu dilama",
	"home.noCurrentGame": "Kakuena manaya a mpindieu adiku to",
	"home.newGame": "Manaya mapiamapia",
	"home.loadGame": "Teka manaya",
	"home.manageScenarios": "Kulombola malu",
	"home.settings": "Malongolola",
	"home.exitApp": "Patuka mu app",
	"home.exitQuestion": "Kupatuka mu app?",
	"home.exitConfirm": "Patuka",
	"home.exitAnyway": "Patuka nansha nanku",
	"home.activeWrites": {
		plural: {
			one: "{count} mudimu wa dilama dia bintu udi anu wenzeka.",
			other: "{count} midimu ya dilama dia bintu idi anu yenzeka.",
		},
	},

	"newGame.title": "Manaya mapiamapia",
	"newGame.startingPoint": "Tshibangidilu",
	"newGame.useRuleSet": "Enza mudimu ne mikenji ({count})",
	"newGame.ruleSetDetail": "Sungula nomba ne dina dia muena manaya mupiamupia",
	"newGame.useTemplate": "Enza mudimu ne tshilejilu ({count})",
	"newGame.templateDetail": "Enza mudimu ne tshiamu tshia manaya tshilongolola",
	"newGame.ruleSet": "Mikenji milongolola",
	"newGame.template": "Tshilejilu",
	"newGame.noEntries": "Kakuena bintu bidiku to",
	"newGame.noRuleSets": "Kakuena mikenji idiku to.",
	"newGame.noTemplates": "Kakuena tshilejelu tshidiku to.",
	"newGame.playerCount": "Bungi bua banayi",
	"newGame.gameName": "Dîna dia manaya",
	"newGame.generatedName": "Bifukibua nkayabi",
	"newGame.prepare": "Longolola manaya",
	"newGame.noRuleSetSelected": "Kakuena mikenji misungula to.",
	"newGame.noTemplateSelected": "Kakuena tshilejelu tshisungula to.",

	"loadGame.title": "Teka manaya",
	"loadGame.search": "Keba manaya adibu balame",
	"loadGame.reading": "Kubala manaya adibu balame ...",
	"loadGame.repairImportQuestion":
		"Kulongolola tshikandakanda tshia dibueja anyi?",
	"loadGame.alreadyExists": "Manaya adibu balame adiku kale",
	"loadGame.existingFile": "Mukanda udiku",
	"loadGame.importedFile": "Mukanda mubueja",
	"loadGame.overwriteExisting": "Kufunda mukanda udiku",
	"loadGame.players": {
		plural: {
			one: "{count} muena manaya",
			other: "{count} ba manaya",
		},
	},
	"loadGame.loading": "Loading ...",
	"loadGame.noMatches": "Kakuena manaya adibu balame adi apetangana to.",
	"loadGame.deleteQuestion": 'Udi mua kumbusha "{name}" anyi?',
	"loadGame.setup": "Kulongolola",
	"loadGame.night": "Butuku {number}",
	"loadGame.day": "Dituku {number}",
	"loadGame.readError": "Dinaya dilama kadivua mua kubala to.",

	"scenarios.title": "Kulombola malu",
	"scenarios.filter": "Malu a tshikebelu",
	"scenarios.filter.all": "Bionso",
	"scenarios.filter.ruleSets": "Mikenji",
	"scenarios.filter.templates": "Bilejilu",
	"scenarios.ruleSet": "Mikenji milongolola",
	"scenarios.template": "Tshilejilu",
	"scenarios.reading": "Dibala dia malu ...",
	"scenarios.empty": "Kakuena malu adi mua kuenzeka to.",
	"scenarios.create": "Fuka",
	"scenarios.newRuleSet": "Mikenji mipiamipia",
	"scenarios.invalidRuleSet": "Mikenji mibi",
	"scenarios.ruleSetMetadata":
		"Version {version} · {teams} teams · {roles} roles",
	"scenarios.templateMetadata": {
		plural: {
			one: "{count} nkuasa · {ruleSet}",
			other: "{count} nkuasa · {ruleSet}",
		},
	},
	"scenarios.savedAt": "Mulama: {date}",
	"scenarios.newWorkingCopy": "Tshikandakanda tshipiatshipia tshia mudimu",
	"scenarios.duplicated": "Bienza misangu ibidi",
	"scenarios.detailsReading": "Dibala dia malu …",
	"scenarios.loadError": "Tshienzedi katshivua mua kuikala tshibueja to.",
	"scenarios.exportUnsupported":
		"Tshilaminu tshia mpindieu katshiena tshianyisha dituma dia bintu ku babende to.",
	"scenarios.exported": '"{name}" mupatula.',
	"scenarios.shared": '"{name}" muabanya.',
	"scenarios.copySaved": "Tshikandakanda tshipiatshipia tshilama.",
	"scenarios.changesSaved": "Mashintuluka adi malama.",
	"scenarios.justSaved": "Anu mulamibue",
	"scenarios.detailExported": "Tshienzedi tshipatula.",
	"scenarios.detailShared": "Tshienzedi tshiabanya.",
	"scenarios.deleted": '"{name}" mujimija.',
	"scenarios.renamed": 'Bakashintulula dina dia "{name}".',
	"scenarios.duplicatedMessage": '"{name}" muenza misangu ibidi.',
	"scenarios.restoredRestriction":
		"Tshilejelu tshipingajibua tshidi mua kuikala anu tshienza misangu ibidi anyi tshituma pambelu.",
	"scenarios.repairImportQuestion":
		"Kulongolola tshikandakanda tshia dibueja anyi?",
	"scenarios.ruleSetExists": "Mikenji idiku kale",
	"scenarios.templateExists": "Tshilejelu tshidiku kale",
	"scenarios.existingObject": "Tshintu tshidiku",
	"scenarios.importedObject": "Tshintu tshibueja",
	"scenarios.overwriteExisting": "Kufunda pa mutu pa tshintu tshidiku",
	"scenarios.deleteQuestion": 'Udi mua kumbusha "{name}" anyi?',

	"settings.title": "Malongolola",
	"settings.general": "Tshionso",
	"settings.language": "Luaku",
	"settings.language.system": "Muakulu wa bulongolodi",
	"settings.appearance": "Tshimuenekelu",
	"settings.theme.system": "Nsombelu",
	"settings.theme.light": "Butoke",
	"settings.theme.dark": "Mufitu",
	"settings.duringGame": "Mu tshikondo tshia manaya",
	"settings.hideExpiredStatuses": "Sokoka malu adi mapite",
	"settings.seatCircleNorthFirst": "Orient first seat at the top.", // This value isn't accurate translated, yet.
	"settings.seatCircleNorthLast":
		"Teka nkuasa wa ndekelu ku mutu kua kazubu ka nkuasa ka tshijengu.",
	"settings.seatCircleClockwise": "Clockwise", // This value isn't accurate translated, yet.
	"settings.seatCircleCounterClockwise": "Counterclockwise", // This value isn't accurate translated, yet.
	"settings.keepScreenAwake": "Lama tshibuelelu tshitabale",
	"settings.hapticFeedback": "Diandamuna dia tshianza",
	"settings.autoRotate": "Dishintulula nkayadi",
	"settings.accessibility": "Difika",
	"settings.textSize": "Bunene bua meyi",
	"settings.textSize.small": "Mukese",
	"settings.textSize.standard": "Tshipiminu",
	"settings.textSize.large": "Munene",
	"settings.reduceMotion": "Kukepesha dienda",
	"settings.data": "Malu",
	"settings.createBackup": "Enza tshilaminu",
	"settings.exportLibrary": "Tshilaminu tshia mikanda tshia pambelu",
	"settings.shareBackup": "Share backup",
	"settings.shareLibrary":
		"Tuma tshilaminu tshia mikanda ku diambuluisha dia programe mukuabu",
	"settings.backupShared": "Backup shared.",
	"settings.restoreLibrary": "Kupingaja tshilaminu tshia mikanda",
	"settings.replaceLibrary": "Pingaja tshilaminu tshia mikanda",
	"settings.deleteAllData": "Supula bintu bionso",
	"settings.about": "Pa bidi bitangila",
	"settings.version": "Mushindu",
	"settings.licenseSummaryDisclaimer":
		"This notice is only a summary and does not replace the full license text. Only the full license text is authoritative.", // This value isn't accurate translated, yet.
	"settings.viewLicense": "Tangila bukenji",
	"settings.copyrightHolder": "Muena bukenji bwa mufundi",
	"settings.softwareLicense": "Software license", // This value isn't accurate translated, yet.
	"settings.openSourceLicenses": "Open-source licenses",
	"settings.licenseNotice":
		"Programe eu udi ulua kayi ne tshijadiki. AGPL-3.0-only udi ukuanyishila bua kuenza nende mudimu, kushintulula, ne kuabanya kabidi.",
	"settings.backupCreated": "Tshilaminu tshia mikanda tshienza.",
	"settings.restoreComplete":
		"Tshilaminu tshia mikanda tshilongolola tshishiki.",
	"settings.restoreDiscarded": {
		plural: {
			one: "Tshilaminu tshia mikanda tshilongolola. {count} tshisumbu tshia mikenji tshidi katshiyi tshikumbane tshivua tshilekeledibue.",
			other:
				"Tshilaminu tshia mikanda tshilongolola. {count} mikenji mibi ivua mipangile.",
		},
	},
	"settings.replaceQuestion": "Kupingaja nzubu wa mikanda mujima anyi?",
	"settings.replaceDescription":
		'Tshilaminu tshia mikanda tshidiku mpindieu netshipingajibue kudi "{fileName}".',
	"settings.currentStorageVersion": "Tshilaminu tshia mpindieu",
	"settings.importedStorageVersion": "Tshilaminu tshia bintu tshibueja",
	"settings.unknown": "kayi mumanyike",
	"settings.validRuleSets": "Mikenji mikumbane",
	"settings.discardedRuleSets": "Mikenji idi milongolola bua kuimanyika",
	"settings.invalidRuleSetsDiscarded":
		"Mikenji idi kayiyi mimpe neyikale milekeledibua: {ids}",
	"settings.importValidOnly": "Dibueja didi dikumbane anu",
	"settings.tryRepair": "Teta kulongolola",
	"settings.saveFailedTitle": "Malongolola kaavua mua kulama to.",
	"settings.saveFailedQuestion": "Udi musue kuteta kabidi anyi?",

	"error.unknown": "Tshilema tshidi katshiyi tshimanyike.",
	"error.technicalDetails": "Malu a tekiniki",
	"error.technicalInline": "malu a tekiniki: {details}",
	"error.details.copy": "Kopa malu",
	"error.details.copied": "Mukopolola",
	"error.details.source": "Tshifukilu",
	"error.details.operation": "Mudimu",
	"error.details.subject": "Tshiena bualu",
	"error.details.reason": "Bualu",
	"error.details.diagnostic": "Diagnostic",
	"error.details.type": "Mushindu wa tshilema",
	"error.details.message": "Mukenji wa tshilema",
	"error.details.cause": "Bualu",
	"error.details.stack": "Stack trace",
	"error.unexpected":
		"Tshilema tshia mudimu tshidi katshiyi tshitekemena. Tuasakidila bua kumanyisha tshilema etshi.",
	"error.dataNotFound": "Malu adibu balame kaena mua kupetekibua to.",
	"error.dataUnreadable": "Malu adibu balame kaena mua kubala to.",
	"error.storageUnavailable": "Tshilaminu katshienaku mpindieu to.",
	"error.diskFull":
		"Tshilaminu tshidi tshiuwule tente. Lekela muaba ne uteta kabidi.",
	"error.writeFailed": "Malu kaavua mua kulama bimpe to.",
	"error.targetExists": "Malu adiku kale ku tshipatshila tshia kulama.",
	"error.invalidFileReference":
		"Tshimanyinu tshia mukanda katshiena tshimpe to.",
	"error.incompleteRecovery": "Malu a dipingaja kaena makumbane to.",
	"error.invalidJson": "Mukanda kawena ne JSON muimpe to.",
	"error.invalidDocument": "Mukanda kawena ne bulongolodi buimpe to.",
	"error.unsupportedVersion":
		"Tshitupa tshia mukanda katshiena tshianyishibue to.",
	"error.encodingFailed": "Difunda dia mukanda kadivua mua kubala to.",
	"error.invalidObject": "Tshintu tshilama katshiena tshimpe to.",
	"error.repairFailed": "Tshintu tshilama katshivua mua kulongolola to.",
	"error.decisionExpired":
		"Dipangadika dilomba kadiena kabidi dienza mudimu to.",
	"error.decisionRequired":
		"Dipangadika didi dikengedibua kumpala kua mudimu ewu kutungunuka.",
	"error.invalidDecision":
		"Dipangadika edi kadienaku bua mudimu udi wenzeka mpindieu to.",
	"error.wrongObjectKind":
		"Mukanda musungula kawena ne tshintu tshidibu batekemene to.",
	"error.invalidValue": "Mushinga wa tshibuelelu ki mmuakane to.",
	"error.preconditionNotMet":
		"Mudimu kawena mua kuenzeka mu nsombelu udiku mpindieu to.",
	"error.protectedObject":
		"Tshintu tshidibu benza natshi mudimu mpindieu katshiena mua kushintuluka anyi kujimijibua to.",
	"error.entityNotFound": "Tshintu tshilomba katshivua tshipeta to.",
	"error.unsupportedMediaType":
		"Mushindu wa mukanda musungula kawena witaba to.",
	"error.invalidResourceSource":
		"Muaba udi tshimfuanyi tshifumina ki mmuakane to.",
	"error.unsafeResourceSource":
		"Muaba uvua tshimfuanyi tshifumina uvua mubenga bua malu a bukubi.",
	"error.ruleSetInvalid":
		"Tshisumbu tshia mikenji tshilama katshiena ne bulongolodi buimpe to.",
	"error.fileNameInvalid": "Dîna dia mukanda kadiena diakane to.",
	"error.savedDataUnreadable": "Malu adibu balame kaavua mua kubadibua to.",
	"error.savedDataInvalidJson": "Malu adibu balame kaena ne JSON muimpe to.",
	"error.savedObjectInvalid":
		"Tshintu tshilama katshiena ne tshilongolola tshimpe to.",
	"error.savedObjectUnsupportedVersion":
		"Tshintu tshilama katshiena tshianyishibue to.",
	"error.savedObjectEncodingFailed":
		"Difunda dia tshintu tshilama kadivua mua kubala to.",
	"error.savedObjectProcessingFailed":
		"Tshintu tshilama katshivua mua kulongololwa to.",
	"error.objectStoreMissing": "Tshilaminu tshia bintu katshivua tshipeta to.",
	"error.objectStoreUnreadable":
		"Tshilaminu tshia bintu katshivua mua kubala to.",
	"error.objectStoreInvalidJson":
		"Tshilaminu tshia bintu katshiena ne JSON muimpe to.",
	"error.objectStoreInvalid":
		"Tshilaminu tshia bintu katshiena ne tshilongolola tshimpe to.",
	"error.objectStoreUnsupportedVersion":
		"Tshilaminu tshia bintu katshiena tshianyishibua to.",
	"error.objectStoreEncodingFailed":
		"Difunda dia tshilaminu tshia bintu kadivua mua kubala to.",
	"error.objectStoreProcessingFailed":
		"Tshilaminu tshia bintu katshivua mua kuenzeka to.",
	"error.newFileMissing": "Mukanda mupiamupia kawenaku to.",
	"error.incompleteWrite": "Mudimu wa dilama udi kauyi mujikije.",
	"error.ruleSetStoreInvalidJson":
		"Tshilaminu tshia mikenji katshiena ne JSON muimpe to.",
	"error.ruleSetsUnreadable": "Mikenji milama kayivua mua kubala to.",
	"error.ruleSetStoreInvalid":
		"Tshilaminu tshia mikenji katshiena ne tshilongolola tshimpe to.",
	"errorBoundary.eyebrow": "Tshilema tshia dilomba",
	"errorBoundary.title": "Tshiamu tshia mudimu katshivua mua kuleja to.",
	"errorBoundary.retry": "Teta kabidi",

	"success.imported.game": 'Dinaya dilama dia "{name}" dibueja.',
	"success.imported.template": 'Tshilejilu "{name}" tshibueja.',
	"success.imported.ruleSet": 'Mukenji wa "{name}" mubueja.',
	"success.imported.library": "Tshilaminu tshia mikanda tshibueja.",
	"success.recovered.game": 'Dinaya dilama dia "{name}" dipingajibua.',
	"success.recovered.template": 'Tshilejilu tshia "{name}" tshipeta.',
	"success.recovered.ruleSet": 'Mukenji wa "{name}" mupeta.',
	"success.recovered.library": "Tshilaminu tshia mikanda tshiakapingajibua.",
	"success.restored.library":
		"Tshilaminu tshia mikanda tshipingajibua ku tshilaminu.",
	"success.repaired.game": 'Dinaya dilama dia "{name}" dilongolola.',
	"success.repaired.template": 'Tshilejilu tshia "{name}" tshilongolola.',
	"success.repaired.ruleSet": 'Mukenji wa "{name}" mulongolola.',
	"success.repaired.library": "Nzubu wa mikanda mulongolola.",

	"repairReport.title": "Tshilaminu tshia mikanda tshilongolola",
	"repairReport.acceptedRuleSets": {
		plural: {
			one: "{count} tshisumbu tshia mikenji tshivua tshiitabijibua.",
			other: "{count} mikenji ivua mitabijibua.",
		},
	},
	"repairReport.removedRuleSets": "Bisumbu bia mikenji bivua biumbushibue",
	"repairReport.removed.notAnObject":
		"Tshibumba tshia mikenji tshilama ki ntshintu to.",
	"repairReport.removed.repairFailed":
		"Tshisumbu tshia mikenji katshivua mua kulongolola to.",
	"repairReport.change.missingStatusDefinitionAdded":
		'Mukenji wa {ruleSetLabel}: udi mubueja diumvuija dia nsombelu udi kayiku "{status}".',
	"repairReport.change.ruleSetUnknownFieldsRemoved":
		"Mukenji {ruleSetLabel}: kumbusha miaba idi kayiyi mimanyike ({fields}).",
	"repairReport.change.teamUnknownFieldsRemoved":
		"Tshisumbu tshia {index} mu {ruleSetLabel}: mbambushe miaba idi kayiyi mimanyike ({fields}).",
	"repairReport.change.roleUnknownFieldsRemoved":
		"Mudimu {index} mu {ruleSetLabel}: mumbusha miaba idi kayiyi mimanyike ({fields}).",
	"repairReport.change.statusUnknownFieldsRemoved":
		"Status {index} mu {ruleSetLabel}: mbambushe miaba idi kayiyi mimanyike ({fields}).",
	"repairReport.change.ruleSetIdCollisionResolved":
		'Mukenji wa {storedId}: mushintulule ID wa dikokangana ku "{newId}".',
	"repairReport.change.ruleSetsContainerReplaced":
		"Kupingaja ruleSetsById udi kayiku anyi udi kayi ne mushinga ne tshintu tshidi katshiyi ne tshintu.",
	"repairReport.change.libraryUnknownFieldsRemoved":
		"Tshilaminu tshia mikanda: tshiumusha miaba idi kayiyi mimanyike ({fields}).",
	"repairReport.change.insertedMissingQuote":
		"Mubueja tshimanyishilu tshidi katshiyi tshimueneka pa muaba wa {position}.",
	"repairReport.change.addedClosingBraces": {
		plural: {
			one: "Kusakidila tshintu tshimue tshia kujika natshi tshidi tshipangile.",
			other: "Kusakidila bipese {count} bia kujika nabi bidi kabiyiku.",
		},
	},
	"repairReport.change.addedOpeningBraces": {
		plural: {
			one: "Kusakidila tshintu tshimue tshia ku tshibangidilu tshidi tshipangile.",
			other: "Kusakidila bipese {count} bia tshibangidilu bidi kabiyiku.",
		},
	},

	"game.menu.open": "Kangula menu wa manaya",
	"game.menu.title": "Menu wa manaya",
	"game.menu.actions": "Bienzedi bia manaya",
	"game.menu.save": "Lama manaya",
	"game.menu.saveAs": "Lama manaya bu",
	"game.menu.saveAsTemplate": "Lama manaya bu tshilejelu",
	"game.menu.exit": "Patuka mu manaya",
	"game.menu.manageEntities": "Kulombola bisumbu, midimu ne nsombelu",
	"game.menu.randomizeRoles": "Pesha midimu ku mpukapuka",
	"game.menu.shufflePlayers": "Longolola miaba ya banayi ku mpukapuka", // This value isn't accurate translated, yet.
	"game.menu.rolesForShowing": "Midimu idi ne tshia kuleja",
	"game.menu.showLog": "Leja tshikandakanda",
	"game.menu.settings": "Malongolola",
	"game.currentGame": "Dinaya dia mpindieu",
	"game.unlockSeatOrder": "Kangula mulongo wa miaba ya kusomba",
	"game.lockSeatOrder": "Kukanga muaba wa kusomba",
	"game.playerOverview": "Tshikoso tshia muena manaya",
	"game.seatOrder": "Mulongo wa miaba ya kusomba",
	"game.zoomControls": "Tshijengu tshia miaba ya kusomba",
	"game.zoomOut": "Kupatuka mu tshijengu tshia miaba ya kusomba",
	"game.zoomIn": "Tangila mu tshijengu tshia miaba ya kusomba",
	"game.zoomLevel": "Zoom level: {percent} percent",
	"game.showSeatCircle": "Leja tshijengu tshia miaba ya kusomba",
	"game.showPlayerOverview": "Leja tshikoso tshia muena manaya",
	"game.seatAccessible": "Nkuasa {seat}{marker}",
	"game.sourceAndTargetSuffix": ", tshibangidilu ne tshipatshila",
	"game.sourceSuffix": ", source",
	"game.targetSuffix": ", tshipatshila",
	"game.deleteSeat": "Supula nkuasa {seat}",
	"game.addPlayerAfterSeat": "Weja muena manaya kunyima kua nkuasa {seat}",
	"game.flow": "Dienda dia manaya",
	"game.showRoles": "Leja midimu",
	"game.nightList": "Mulongo wa butuku",
	"game.seat": "Nkuasa {seat}",
	"game.details": "Bintu",
	"game.actionsForSeat": "Bienzedi bia muaba {seat}",
	"game.deleteSelectedSeat": "Supula nkuasa musungula {seat}",
	"game.addPlayerAfterSelectedSeat":
		"Weja muena manaya kunyima kua muaba musungula {seat}",
	"game.restoreSplitView": "Kupingaja tshimuenekelu tshitapuluke",
	"game.showDetailsFullscreen": "Leja malu mu tshiamu tshijima",
	"game.manualSeat": "Nomba ya nkuasa",
	"game.selectSeat": "Sungula muaba",
	"game.lifeState": "Nsombelu wa muoyo",
	"game.life.alive": "Muoyo",
	"game.life.deadVoteAvailable": "Mufue – vote udiku",
	"game.life.deadVoteSpent": "Mufue – vote mupita",
	"game.life.doubleDeadVoteAvailable": "Bafue babidi – vote udiku",
	"game.life.doubleDeadVoteSpent": "Bantu babidi bafue – vote mupitshishe",
	"game.life.aliveShort": "Muoyo",
	"game.life.deadVoteAvailableShort": "Mufue · vote udiku",
	"game.life.deadVoteSpentShort": "Mufue · vote mupita",
	"game.life.doubleDeadVoteAvailableShort": "Bafua babidi · vote udiku",
	"game.life.doubleDeadVoteSpentShort": "Bantu babidi bafue · vote mupitshishe",
	"game.noRole": "Kakuyi mudimu",
	"game.team": "Tshisumbu",
	"game.rolesWithoutTeam": "Kakuyi tshisumbu",
	"game.role.actual": "Mudimu mulelela",
	"game.role.shown": "Mudimu muleja",
	"game.role.night": "Mudimu wa butuku",
	"game.role.claimed": "Mudimu udibu bamba",
	"game.statuses": "Nsombelu",
	"game.status": "Nsombelu",
	"game.statusDuration": "Butuku {from}–{until}",
	"game.openEnded": "kukangula",
	"game.newStatus": "Nsombelu mupiamupia",
	"game.deletePlayer": "Kujimija tshiamu",
	"game.player": "Muena manaya",
	"game.selectPlayer": "Sungula muena manaya ...",
	"game.addPlayer": "+ Muena manaya",
	"game.deleteEmptySeat": "Supula nkuasa mutupu",
	"game.emptySeat": "Nkuasa eu udi mutupu.",
	"game.selectSeatPrompt": "Sungula muaba wa kusomba.",
	"game.playerWithName": "Muena manaya: {name}",
	"game.deleteQuestion": "kumbusha?",
	"game.newSeatAfter": "nkuasa mupiamupia kunyima kua",
	"game.addQuestion": "kusakidila?",
	"game.seatActionCancel": "Kulekela",
	"game.unsavedTitle": "Dinaya kadiena dianji kulama to.",
	"game.saveAndExit": "Lama ne patuka mu manaya",
	"game.exitWithoutSaving": "Patuka mu manaya kuyi ulama",
	"game.saveFailedTitle": "Mukanda kauvua mua kulama to.",
	"game.targetExists": "Mukanda udi ne dina edi udiku kale.",
	"game.saveRecoveryQuestion":
		"Ntshinyi tshiudi musue kuenza ne mudimu wa dilama udi mupangile?",
	"game.storageCommandInactive":
		"Dîyi dia kulama bintu kadiena kabidi dienza mudimu to.",
	"game.decideLater": "Angata dipangadika pashishe",
	"game.setup": "Kulongolola",
	"game.nightNumber": "Butuku {number}",
	"game.dayNumber": "Dituku {number}",
	"game.backToGame": "Kupingana ku manaya",
	"game.log.title": "Log",
	"game.log.empty": "Kakuena difunda dia malu to.",
	"game.log.timeAdvanced": "Dîba dipita: {oldTime} → {newTime}.",
	"game.log.timeRewound": "Tshikondo tshia kupingaja: {oldTime} → {newTime}.",
	"game.log.lifeStateChanged":
		"Nsombelu wa muoyo wa {player}: {oldState} → {newState}.",
	"game.log.statusApplied": "Applied status {status} to {player}.",
	"game.log.rolesDistributed": {
		plural: {
			one: "{count} mudimu muabanya ku mpukapuka.",
			other: "{count} midimu miabanya ku mpukapuka.",
		},
	},
	"game.log.selectedRolesDistributed": {
		plural: {
			one: "{count} mudimu musungula muabanya ku mpukapuka.",
			other: "{count} midimu misungula miabanya ku mpukapuka.",
		},
	},
	"game.log.seatMoved":
		"Mmumbushe muena manaya {playerName} ku nkuasa {fromSeat} too ne ku nkuasa {toSeat}.",
	"game.log.seatsSwapped": "Kushintulula nkuasa {seatA} ne nkuasa {seatB}.",
	"game.log.playerAppended":
		"Muteka muena manaya {playerName} mu nkuasa {toSeat}.",
	"game.log.playerInserted":
		"Mubueja muena manaya {playerName} mu nkuasa {toSeat}.",
	"game.log.playerRemoved":
		"Mumbusha muena manaya {playerName} mu nkuasa {fromSeat}.",
	"game.log.seatOrderChanged": "Mulongo wa miaba ya kusomba mmushintuluke.",
	"game.roleReveal.navigation": "Dimanyisha dia mudimu",
	"game.roleReveal.prompt":
		"Leja {player} (nkuasa {seat}) mudimu wabu. Fina bua kuleja.",
	"game.overview.seat": "Nkuasa",
	"game.overview.role": "Mudimu",
	"game.sourceAndTarget": "Tshifukilu/tshipatshila",
	"game.source": "Tshifukilu",
	"game.target": "Tshipatshila",
	"game.overview.playerAccessible": "{name}, nkuasa {seat}{marker}",
	"game.overview.shownRole": "Tshileja: {role}",
	"game.overview.nightRole": "Butuku: {role}",
	"game.night.noActiveRoles": "Kakuena mudimu wa butuku bua butuku ebu to.",
	"game.night.actionFor": "Tshienzedi tshia {player}",
	"game.night.action": "Tshienzedi",
	"game.night.on": "pa",
	"game.night.targetPlayer": "Muena mudimu wa tshipatshila",
	"game.night.noEffect": "Tshienzedi katshivua ne tshipeta nansha tshimue.",
	"game.night.execute": "Enza",
	"game.night.kill": "Udi ushipa",
	"game.night.resurrect": "Ubisha ku lufu",
	"game.action.kill": "kushipa",
	"game.action.resurrect": "kubisha",
	"game.action.applyStatus": "enza mudimu",
	"game.action.unknown":
		"tshienzedi tshidi katshiyi tshimanyike (kode wa munda: {action})",
	"game.life.dead": "Mufue",
	"game.warning.playerNotFound": 'Muena manaya "{playerId}" kenaku to.',
	"game.warning.statusNotFound": 'Tshitupa tshia "{statusId}" katshienaku to.',
	"game.warning.actorNotFound": 'Muena manaya "{playerId}" kenaku to.',
	"game.warning.targetNotFound":
		'Muena mudimu wa tshipatshila "{playerId}" kenaku to.',
	"game.warning.actualRoleNotFound":
		'Kakuena mudimu mulelela uvuabu bapeta bua muena manaya "{playerId}".',
	"game.warning.abilityAmbiguous":
		'Bukole bua mudimu wa "{roleName}" budi kabuyi bumvuika bimpe.',
	"game.warning.statusAmbiguous": "Nsombelu wa kulomba ki mmuumvuike bimpe to.",
	"game.warning.voteAlreadySpent": "Disungula dia nyuma ndimane kujika.",
	"game.warning.abilityNotAllowed":
		'Mudimu "{roleName}" kawena witaba tshienzedi tshia "{action}".',
	"game.warning.statusNotAllowed":
		'Mudimu "{roleName}" kena mua kuikala ne tshitupa tshia "{statusId}".',
	"game.statusEditor.title": "Shintulula nsombelu",
	"game.statusEditor.status": "Nsombelu",
	"game.statusEditor.fromNight": "Kubangila butuku",
	"game.statusEditor.untilNight": "Too ne butuku",
	"game.statusEditor.note": "Note",
	"game.playerName": "Dîna dia muena manaya",
	"recovery.kind.game": "manaya alama",
	"recovery.kind.template": "tshilejelu",
	"recovery.kind.ruleSet": "mikenji milongolola",
	"recovery.backupFile": "mukanda wa tshilaminu",
	"recovery.temporaryFile": "mukanda wa dipingaja dia tshitupa tshîpi",
	"recovery.incompleteSave": "Mudimu wa dilama udi kauyi mujikije",
	"recovery.openCount": "({count} open)",
	"recovery.orphanedFile":
		"{recoveryFile} uvua mupeta, kadi tshikandakanda tshia {kind} katshienaku to.",
	"recovery.twoFiles":
		'Mukanda wa kale ne udi mua kuikala mupiamupia uvua mupeta bua {kind} "{id}".',
	"recovery.keepOld": "Lama mukanda wa kale",
	"recovery.keepNew": "Lama mukanda mupiamupia",
	"recovery.keepBothFiles": "Lama mikanda yonso ibidi",
	"recovery.exportBrokenFile": "Kutuma mukanda munyanguke",
	"recovery.decideLater": "Angata dipangadika pashishe",
	"recovery.invalidObjectTitle": "Tshintu tshilama tshibi tshipeta",
	"recovery.affectedObject":
		"Tshintu tshidi tshinyanguka ({kind}): “{reference}”",
	"recovery.file": "Mukanda",
	"recovery.suggestedFileName": "Dîna dia mukanda didibu bafila",
	"recovery.repairObject": "Kulongolola tshintu",
	"recovery.repairFileName": "Dina dia mukanda wa kulongolola",
	"recovery.exportObject": "Tshintu tshia kupatula",
	"recovery.deleteObject": "Supula tshintu",
	"recovery.reason.invalidRuleSet":
		"Tshisumbu tshia mikenji tshilama katshiena ne bulongolodi buimpe to.",
	"recovery.reason.invalidFileName":
		"Mukanda wa JSON kawena ulonda mikenji ya dibikila to.",
	"recovery.reason.decodeFailed": "Mukanda kauvua mua kuikala mufunda to.",
	"recovery.reason.invalidJson": "Mukanda kawena ne JSON muimpe to.",
	"recovery.reason.invalidTemplate": "JSON ki tshilejelu tshimpe to.",
	"recovery.reason.invalidGame":
		"JSON ki mmushindu muimpe wa manaya mulama to.",
	"recovery.rememberDecision":
		"Vuluka dipangadika edi ne uditumikile ku bilema bionso bia mushindu umue",
	"recovery.library.missing": "Tshilaminu tshia mikanda katshivua tshipeta to.",
	"recovery.library.orphanedTemporary":
		"Mukanda wa dipingaja dia tshitupa tshîpi uvua mupeta, kadi tshilaminu tshia mikanda tshidi tshipetangana natshi katshienaku to.",
	"recovery.library.orphanedBackup":
		"Mukanda wa tshilaminu uvua mupeta, kadi tshilaminu tshia mikanda tshidi tshipetangana natshi katshienaku to.",
	"recovery.library.decodeFailed":
		"Mukanda wa tshilaminu tshia mikanda kauvua mua kuikala mufunda to.",
	"recovery.library.invalidJson":
		"Mukanda wa tshilaminu tshia mikanda kawena ne JSON muimpe to.",
	"recovery.library.invalidRuleSet":
		"Mu nzubu wa mikanda mudi mikenji idi kayiyi mimpe.",
	"recovery.library.invalidDocument":
		"JSON ki tshilaminu tshia mikanda tshiakane to.",
	"recovery.library.title": "Tshilaminu tshia mikanda katshiena mua kubala to",
	"recovery.library.restoreBackup": "Kupingaja tshilaminu",
	"recovery.library.repair": "Longolola nzubu wa mikanda",
	"recovery.library.createEmpty":
		"Enza nzubu mupiamupia wa mikanda udi kayi ne tshintu",
	"recovery.library.export": "Tshilaminu tshia mikanda tshia pambelu",
	"rolesForShowing.title": "Midimu idi ne tshia kuleja",
	"rolesForShowing.closePreview": "Kukanga tshilejelu",
	"rolesForShowing.freeText": "Mêyi a tshianana",
	"rolesForShowing.roles": "Midimu",
	"rolesForShowing.removeRole": "Umbusha {name}",
	"rolesForShowing.empty": "Kakuena mudimu musungula to.",
	"rolesForShowing.addRole": "＋ Mudimu",
	"rolesForShowing.showSymbol": "Leja tshimanyishilu tshia mudimu",
	"rolesForShowing.preview": "Tshia kumpala",
	"rolesForShowing.addRoleTitle": "Weja mudimu",
	"roleDistribution.title": "Pesha midimu ku mpukapuka",
	"roleDistribution.teamDistribution": "Diabanya dia tshisumbu",
	"roleDistribution.roleSelection": "Disungula dia mudimu",
	"roleDistribution.type": "Mushindu wa diabanya dia midimu",
	"roleDistribution.random.title": "Diabanya midimu ya mpukapuka ku mpukapuka",
	"roleDistribution.random.detail": "Teka bunene bua tshisumbu ne enza mudimu",
	"roleDistribution.selected.title": "Abanya midimu misungula ku mpukapuka",
	"roleDistribution.selected.detail":
		"Sungula midimu misunguluke ne uyipeshe ku mpukapuka",
	"roleDistribution.manual.title": "Pesha midimu ku bianza",
	"roleDistribution.manual.detail":
		"Ufila midimu pashishe pa tshiamu tshia manaya",
	"roleDistribution.overwriteRunning":
		"Dinaya didi dienda dienda. Midimu idiku ya bushuwa, ya kuleja ne ya butuku neyikale mifunda pa mutu.",
	"roleDistribution.overwriteAssigned":
		"Midimu ivuabu bamane kufila neyikale mifunda pa mutu.",
	"roleDistribution.redistribute": "Kuabanya kabidi midimu",
	"roleDistribution.uniqueRoleMultiple":
		"Mudimu wa pa buawu musungula misangu mipite pa umue",
	"roleDistribution.decrease": "Kukepesha {name}",
	"roleDistribution.count": "Bala bua {name}",
	"roleDistribution.increase": "Kubandisha {name}",
	"roleDistribution.freePlayers": "Bantu badi kabayi basungula",
	"roleDistribution.distribute": "Diabanya midimu",
	"roleDistribution.error.teamHasNoRoles": {
		plural: {
			one: "Diabanya dia midimu diakapanga: {count} muena manaya uvua mulomba bua tshisumbu tshia “{teamName}”, kadi tshisumbu katshiena ne midimu to.",
			other:
				"Role distribution failed: {count} players were requested for team “{teamName}”, but the team has no roles.",
		},
	}, // This value isn't accurate translated, yet.
	"roleDistribution.error.insufficientDistinctRoles": {
		plural: {
			one: "Role distribution failed: {requestedCount} players were requested for team “{teamName}”, but there is only {count} distinct role and no repeatable role.",
			other:
				"Role distribution failed: {requestedCount} players were requested for team “{teamName}”, but there are only {count} distinct roles and no repeatable role.",
		},
	}, // This value isn't accurate translated, yet.
	"scenarioEditor.objectType": "Mushindu wa tshintu",
	"scenarioEditor.teams": "Bisumbu",
	"scenarioEditor.roles": "Midimu",
	"scenarioEditor.players": "Bena manaya",
	"scenarioEditor.statuses": "Nsombelu",
	"scenarioEditor.readingDetails": "Dibala dia malu …",
	"scenarioEditor.create": "＋ Fuka",
	"scenarioEditor.new.teams": "Tshisumbu tshipiatshipia",
	"scenarioEditor.new.roles": "Mudimu mupiamupia",
	"scenarioEditor.new.players": "Muena manaya mupiamupia",
	"scenarioEditor.new.statuses": "Nsombelu mupiamupia",
	"scenarioEditor.saveChange": "Lama dishintuluka",
	"scenarioEditor.saveAsNewRuleSet":
		"Lama dishintuluka bu tshisumbu tshipiatshipia tshia mikenji",
	"scenarioEditor.saveAsNewTemplate":
		"Lama dishintuluka bu tshilejelu tshipiatshipia",
	"scenarioEditor.newGameWithRuleSet": "Dinaya dipiadipia ne mikenji eyi",
	"scenarioEditor.newGameFromTemplate":
		"Manaya mapiamapia a mu tshilejelu etshi",
	"scenarioEditor.saveCopy": "Lama bu kopi",
	"scenarioEditor.unsavedChanges": "Mashintuluka kaena muanji kulama to.",
	"scenarioEditor.unsavedRuleSet":
		"Tshisumbu tshia mikenji katshiena tshilama to.",
	"scenarioEditor.unsavedTemplate": "Tshilejilu katshiena tshilama to.",
	"scenarioEditor.saveAndContinue": "Lama ne utungunuke", // This value isn't accurate translated, yet.
	"scenarioEditor.continueWithoutSaving": "Tungunuka kuyi ulama", // This value isn't accurate translated, yet.
	"scenarioEditor.saveAndExit": "Lama ne patuka",
	"scenarioEditor.exitWithoutSaving": "Patuka kuyi ulama",
	"scenarioEditor.editDetails": "Shintulula malu",
	"scenarioEditor.closeDetails": "Kujika malu onso",
	"scenarioEditor.displayName": "Display name ({language})",
	"scenarioEditor.teamOrder": "Bulongolodi bua tshisumbu",
	"scenarioEditor.defaultDuration":
		"Bule bua matuku butuku (0 = kabuyi ne ndekelu)",
	"scenarioEditor.team": "Tshisumbu",
	"scenarioEditor.firstNightOrder": "Komanda butuku bua kumpala",
	"scenarioEditor.otherNightOrder": "Dilomba dia butuku buibidi",
	"scenarioEditor.unique": "Wa pa buende?",
	"scenarioEditor.activeAbilities": "Bipedi bia mudimu",
	"scenarioEditor.canKill": "Udi mua kushipa",
	"scenarioEditor.canResurrect": "Udi mua kubisha",
	"scenarioEditor.canApplyStatuses": "Udi mua kuenza mudimu ne nsombelu",
	"scenarioEditor.noStatuses":
		"Kakuena nsombelu nansha umua udibu banji kumvuija to.",
	"scenarioEditor.unicodeSymbol": "Tshimanyishilu tshia Unicode",
	"scenarioEditor.unicodePreview": "Unicode preview",
	"scenarioEditor.useColor": "Enza mudimu ne dikala",
	"scenarioEditor.editColor": "Kushintulula dikala",
	"scenarioEditor.colorPickerTitle": "Sungula dikala",
	"scenarioEditor.colorCode": "RGB hex code",
	"scenarioEditor.colorPreview": "Dimona dia mekala",
	"scenarioEditor.apply": "Enza",
	"scenarioEditor.deleteQuestion": 'Udi mua kumbusha "{name}" anyi?',
	"scenarioEditor.workingCopy": "Tshikandakanda tshia mudimu",
	"app.closeError": "Kukanga mukenji wa tshilema",
	"app.exited": "App mmupatuke.",
	"app.restart": "Tuadija kabidi programe",
	"appError.checkFiles": "Kabena mua kukontonona mikanda to.",
	"appError.settingsUpdate": "Malongolola kaavua mua kushintuluka to.",
	"appError.settingsOpen": "Malongolola kaavua mua kunzulula to.",
	"appError.continueLastGame": "Dinaya dia ndekelu kadivua mua kutungunuka to.",
	"appError.continueGame": "Dinaya kadivua mua kutungunuka to.",
	"appError.openPreparedGame": "Dinaya dilongolola kadivua mua kunzulula to.",
	"appError.restoreOldFile": "Mukanda wa kale kauvua mua kupingajibua to.",
	"appError.retryStorageCommand":
		"Dîyi dia kulama bintu kadiena mua kuteta kabidi to.",
	"appError.finishStorageCommand":
		"Dîyi dia kulama bintu kadiena mua kujika to.",
	"appError.continueStorageCommand":
		"Dîyi dia kulama bintu kadiena mua kutungunuka to.",
	"appError.saveGamesUnavailable": "Manaya adibu balame kaena mua kulama to.",
	"appError.saveTemplatesUnavailable": "Bimfuanyi kabiena mua kulama to.",
	"appError.changeSeatOrder":
		"Bulongolodi bua miaba ya kusomba kabuvua mua kushintuluka to.",
	"appError.savePlayer": "Muena manaya kavua mua kusungidibua to.",
	"appError.deleteEmptySeat": "Nkuasa uvua mutupu kavua mua kujimijibua to.",
	"appError.deletePlayer": "Tshiamu tshia manaya katshivua mua kujimijibua to.",
	"appError.advanceTime": "Dîba dia manaya kadivua mua kuya kumpala to.",
	"appError.rewindTime": "Dîba dia manaya kadivua mua kupingajibua to.",
	"appError.applyGameChanges": "Mashintuluka a manaya kaavua mua kuenzeka to.",
	"appError.distributeRoles": "Midimu kayivua mua kuabanyangana to.",
	"startup.initializeFiles": "Mikanda ya app kayivua mua kutuadija to.",
	"startup.repairFileNames":
		"Mêna a mikanda ya munda kaavua mua kulongolola to.",
	"startup.loadSettings":
		"Malu adibu balongolole kaena mua kubueja to. Nebenze mudimu ne mishinga ya kumpala.",
	"startup.rootMissing":
		'Tshintu tshia HTML tshidi ne ID "muji" katshienaku to.',
} satisfies Record<GuiTranslationKey, GuiTranslationMessage>;
