import type { GuiTranslationKey } from "./de";
import type { GuiTranslationMessage } from "./messages";

export const scottishGaelicGuiMessages = {
	"common.back": "Air ais",
	"common.cancel": "Sguir dheth",
	"common.close": "Dùin",
	"common.later": "Nas fhaide air adhart",
	"common.import": "Ion-phortaich",
	"common.export": "Às-phortaich",
	"common.share": "Co-roinn",
	"common.rename": "Ath-ainmich",
	"common.duplicate": "Dùblaich",
	"common.delete": "Sguab às",
	"common.deletePermanently": "Sguab às gu buan",
	"common.name": "Ainm",
	"common.unknown": "neo-aithnichte",
	"common.detailsParenthetical": "(Mion-fhiosrachadh)",
	"common.schemaVersion": "Tionndadh na sgeama",
	"common.actionsFor": "Gnìomhan airson",
	"common.moreActionsFor": "Barrachd ghnìomhan airson {name}",
	"common.cancelImport": "Sguir dhen ion-phortadh",
	"common.tryRepair": "Feuch ri càradh",
	"common.keepBoth": "Cum an dà chuid",
	"common.restored": "Air ath-nuadhachadh {index}",
	"common.ok": "Ceart ma-thà",
	"common.next": "Air adhart",
	"common.save": "Sàbhail",
	"common.saving": "’Ga shàbhaladh …",
	"common.select": "Tagh …",
	"common.overwrite": "Sgrìobh thairis air",
	"common.retry": "Feuch ris a-rithist",
	"common.yes": "Tha",
	"common.no": "Chan eil",

	"home.eyebrow": "Modaràtor a’ gheama",
	"home.mainMenu": "Prìomh chlàr-taice",
	"home.continueGame": "Lean air adhart leis a’ gheama",
	"home.latestSave": "An geama sàbhailte as ùire",
	"home.noCurrentGame": "Chan eil geama làithreach ri fhaighinn",
	"home.newGame": "Geama ùr",
	"home.loadGame": "Luchdaich geama",
	"home.manageScenarios": "Stiùirich suidheachaidhean",
	"home.settings": "Roghainnean",
	"home.exitApp": "Fàg an aplacaid",
	"home.exitQuestion": "Fàg an aplacaid?",
	"home.exitConfirm": "Fàg",
	"home.exitAnyway": "Fàg co-dhiù",
	"home.activeWrites": {
		plural: {
			one: "Tha {count} obrachadh sàbhalaidh fhathast gnìomhach.",
			two: "Tha {count} obrachaidhean sàbhalaidh fhathast gnìomhach.",
			few: "Tha {count} obrachaidhean sàbhalaidh fhathast gnìomhach.",
			other: "Tha {count} obrachaidhean sàbhalaidh fhathast gnìomhach.",
		},
	},

	"newGame.title": "Geama ùr",
	"newGame.startingPoint": "Puing tòiseachaidh",
	"newGame.useRuleSet": "Cleachd seata riaghailtean ({count})",
	"newGame.ruleSetDetail": "Tagh àireamh ùr de chluicheadairean agus ainm",
	"newGame.useTemplate": "Cleachd teamplaid ({count})",
	"newGame.templateDetail": "Cleachd rèiteachadh geama ullaichte",
	"newGame.ruleSet": "Seata riaghailtean",
	"newGame.template": "Teamplaid",
	"newGame.noEntries": "Chan eil innteartan ri fhaighinn",
	"newGame.noRuleSets": "Chan eil seataichean riaghailtean ri fhaighinn.",
	"newGame.noTemplates": "Chan eil teamplaidean ri fhaighinn.",
	"newGame.playerCount": "Àireamh nan cluicheadairean",
	"newGame.gameName": "Ainm a’ gheama",
	"newGame.generatedName": "Air a ghineadh gu fèin-obrachail",
	"newGame.prepare": "Ullaich an geama",
	"newGame.noRuleSetSelected": "Cha deach seata riaghailtean a thaghadh.",
	"newGame.noTemplateSelected": "Cha deach teamplaid a thaghadh.",

	"loadGame.title": "Luchdaich geama",
	"loadGame.search": "Lorg geamannan sàbhailte",
	"loadGame.reading": "A’ leughadh gheamannan sàbhailte …",
	"loadGame.repairImportQuestion": "Càraich am faidhle ion-phortaidh?",
	"loadGame.alreadyExists": "Tha an geama sàbhailte ann mu thràth",
	"loadGame.existingFile": "Faidhle a tha ann",
	"loadGame.importedFile": "Faidhle air ion-phortadh",
	"loadGame.overwriteExisting": "Sgrìobh thairis air an fhaidhle a tha ann",
	"loadGame.players": {
		plural: {
			one: "{count} cluicheadair",
			two: "{count} chluicheadair",
			few: "{count} cluicheadairean",
			other: "{count} cluicheadairean",
		},
	},
	"loadGame.loading": "’Ga luchdadh …",
	"loadGame.noMatches": "Cha deach geamannan sàbhailte freagarrach a lorg.",
	"loadGame.deleteQuestion":
		"A bheil thu cinnteach gu bheil thu airson “{name}” a sguabadh às?",
	"loadGame.setup": "Rèiteachadh",
	"loadGame.night": "Oidhche {number}",
	"loadGame.day": "Latha {number}",
	"loadGame.readError": "Cha b’ urrainn dhuinn an geama sàbhailte a leughadh.",

	"scenarios.title": "Stiùirich suidheachaidhean",
	"scenarios.filter": "Criathraich suidheachaidhean",
	"scenarios.filter.all": "Na h-uile",
	"scenarios.filter.ruleSets": "Seataichean riaghailtean",
	"scenarios.filter.templates": "Teamplaidean",
	"scenarios.ruleSet": "Seata riaghailtean",
	"scenarios.template": "Teamplaid",
	"scenarios.reading": "A’ leughadh shuidheachaidhean …",
	"scenarios.empty": "Chan eil suidheachaidhean ri fhaighinn.",
	"scenarios.create": "Cruthaich",
	"scenarios.newRuleSet": "Seata riaghailtean ùr",
	"scenarios.invalidRuleSet": "Seata riaghailtean mì-dhligheach",
	"scenarios.ruleSetMetadata":
		"Tionndadh {version} · {teams} sgiobaidhean · {roles} dreuchdan",
	"scenarios.templateMetadata": {
		plural: {
			one: "{count} suidheachan · {ruleSet}",
			two: "{count} suidheachan · {ruleSet}",
			few: "{count} suidheachain · {ruleSet}",
			other: "{count} suidheachain · {ruleSet}",
		},
	},
	"scenarios.savedAt": "Air a shàbhaladh: {date}",
	"scenarios.newWorkingCopy": "Lethbhreac obrach ùr",
	"scenarios.duplicated": "Air a dhùblachadh",
	"scenarios.detailsReading": "A’ leughadh mion-fhiosrachaidh …",
	"scenarios.loadError": "Cha b’ urrainn dhuinn an suidheachadh a luchdadh.",
	"scenarios.exportUnsupported":
		"Chan eil an stòradh làithreach a’ cur taic ri às-phortadh.",
	"scenarios.exported": "Chaidh “{name}” às-phortadh.",
	"scenarios.shared": "Chaidh “{name}” a cho-roinn.",
	"scenarios.copySaved": "Chaidh lethbhreac ùr a shàbhaladh.",
	"scenarios.changesSaved": "Chaidh na h-atharraichean a shàbhaladh.",
	"scenarios.justSaved": "Air a shàbhaladh an-dràsta",
	"scenarios.detailExported": "Chaidh an suidheachadh às-phortadh.",
	"scenarios.detailShared": "Chaidh an suidheachadh a cho-roinn.",
	"scenarios.deleted": "Chaidh “{name}” a sguabadh às.",
	"scenarios.renamed": "Chaidh ath-ainmeachadh gu “{name}”.",
	"scenarios.duplicatedMessage": "Chaidh “{name}” a dhùblachadh.",
	"scenarios.restoredRestriction":
		"Chan urrainnear teamplaid ath-nuadhaichte ach a dhùblachadh no às-phortadh.",
	"scenarios.repairImportQuestion": "Càraich am faidhle ion-phortaidh?",
	"scenarios.ruleSetExists": "Tha an seata riaghailtean ann mu thràth",
	"scenarios.templateExists": "Tha an teamplaid ann mu thràth",
	"scenarios.existingObject": "Oibseact a tha ann",
	"scenarios.importedObject": "Oibseact air ion-phortadh",
	"scenarios.overwriteExisting": "Sgrìobh thairis air an oibseact a tha ann",
	"scenarios.deleteQuestion":
		"A bheil thu cinnteach gu bheil thu airson “{name}” a sguabadh às?",

	"settings.title": "Roghainnean",
	"settings.general": "Coitcheann",
	"settings.language": "Cànan",
	"settings.language.system": "Cànan an t-siostaim",
	"settings.appearance": "Coltas",
	"settings.theme.system": "Siostam",
	"settings.theme.light": "Soilleir",
	"settings.theme.dark": "Dorcha",
	"settings.duringGame": "Rè a’ gheama",
	"settings.hideExpiredStatuses": "Falaich staidean a dh’fhalbh an ùine",
	"settings.seatCircleNorthFirst":
		"Cuir a’ chiad chathair aig mullach a’ chlàr suidheachain cruinn.",
	"settings.seatCircleNorthLast":
		"Cuir an suidheachan mu dheireadh aig mullach a’ chlàr suidheachain cruinn.",
	"settings.seatCircleClockwise": "Deiseal",
	"settings.seatCircleCounterClockwise": "tuathal",
	"settings.keepScreenAwake": "Cum an sgrìn dùisg",
	"settings.hapticFeedback": "Fios-air-ais haptach",
	"settings.autoRotate": "Cuairteachadh fèin-obrachail",
	"settings.accessibility": "So-ruigsinneachd",
	"settings.textSize": "Meud an teacsa",
	"settings.textSize.small": "Beag",
	"settings.textSize.standard": "Coitcheann",
	"settings.textSize.large": "Mòr",
	"settings.reduceMotion": "Lùghdaich gluasad",
	"settings.data": "Dàta",
	"settings.createBackup": "Cruthaich cùl-taic",
	"settings.exportLibrary": "Às-phortaich an leabharlann",
	"settings.shareBackup": "Co-roinn an cùl-taic",
	"settings.shareLibrary": "Cuir an leabharlann le aplacaid eile",
	"settings.backupShared": "Chaidh an cùl-taic a cho-roinn.",
	"settings.restoreLibrary": "Ath-nuadhaich an leabharlann",
	"settings.replaceLibrary": "Cuir leabharlann na àite",
	"settings.deleteAllData": "Sguab às an dàta gu lèir",
	"settings.about": "Mu dhèidhinn",
	"settings.version": "Tionndadh",
	"settings.licenseSummaryDisclaimer":
		"Chan eil an seo ach geàrr-chunntas, chan ann an àite teacsa iomlan a’ cheadachais. Bidh teacsa iomlan a’ cheadachais a’ riaghladh.",
	"settings.viewLicense": "Fosgail an cead bathar-bog",
	"settings.copyrightHolder": "Neach-seilbh an dlighe-sgrìobhaidh",
	"settings.softwareLicense": "Cead bathar-bog",
	"settings.openSourceLicenses": "Ceadachasan còd fosgailte",
	"settings.licenseNotice":
		"Chan eil barantas sam bith air a thoirt seachad. Faodaidh tu am bathar-bog seo a chleachdadh, atharrachadh agus ath-riarachadh fo chumhachan AGPL-3.0-only.",
	"settings.backupCreated": "Chaidh cùl-taic na leabharlainn a chruthachadh.",
	"settings.restoreComplete": "Chaidh an leabharlann ath-nuadhachadh gu tur.",
	"settings.restoreDiscarded": {
		plural: {
			one: "Chaidh an leabharlann ath-nuadhachadh. Chaidh {count} seata riaghailtean mì-dhligheach a thilgeil air falbh.",
			two: "Chaidh an leabharlann ath-nuadhachadh. Chaidh {count} sheata riaghailtean neo-dhligheach a thilgeil air falbh.",
			few: "Chaidh an leabharlann ath-nuadhachadh. Chaidh {count} seataichean riaghailtean neo-dhligheach a thilgeil air falbh.",
			other:
				"Chaidh an leabharlann ath-nuadhachadh. Chaidh {count} seataichean riaghailtean mì-dhligheach a thilgeil air falbh.",
		},
	},
	"settings.replaceQuestion": "Cuir an leabharlann gu lèir na àite?",
	"settings.replaceDescription":
		"Thèid “{fileName}” a chur an àite na leabharlainn làithreach.",
	"settings.currentStorageVersion": "storageVersion làithreach",
	"settings.importedStorageVersion": "storageVersion air ion-phortadh",
	"settings.unknown": "neo-aithnichte",
	"settings.validRuleSets": "Seataichean riaghailtean dligheach",
	"settings.discardedRuleSets":
		"Seataichean riaghailtean ri thilgeil air falbh",
	"settings.invalidRuleSetsDiscarded":
		"Thèid na seataichean riaghailtean mì-dhligheach a thilgeil air falbh: {ids}",
	"settings.importValidOnly": "Ion-phortaich feadhainn dhligheach a-mhàin",
	"settings.tryRepair": "Feuch ri càradh",
	"settings.saveFailedTitle":
		"Cha b’ urrainn dhuinn na roghainnean a shàbhaladh.",
	"settings.saveFailedQuestion": "A bheil thu airson feuchainn ris a-rithist?",

	"error.unknown": "Mearachd neo-aithnichte.",
	"error.technicalDetails": "Mion-fhiosrachadh teicnigeach",
	"error.technicalInline": "Mion-fhiosrachadh teicnigeach: {details}",
	"error.details.copy": "Dèan lethbhreac dhen mhion-fhiosrachadh",
	"error.details.copied": "Air a chopaigeadh",
	"error.details.source": "Tùs",
	"error.details.operation": "Obrachadh",
	"error.details.subject": "Cuspair",
	"error.details.reason": "Adhbhar",
	"error.details.diagnostic": "Breithneachadh",
	"error.details.type": "Seòrsa mearachd",
	"error.details.message": "Teachdaireachd mearachd",
	"error.details.cause": "Adhbhar",
	"error.details.stack": "Lorg na staca",
	"error.unexpected":
		"Mearachd aplacaid ris nach robh dùil. Dèan aithris air a’ mhearachd seo.",
	"error.dataNotFound": "Cha b’ urrainn dhuinn an dàta sàbhailte a lorg.",
	"error.dataUnreadable": "Cha ghabh an dàta sàbhailte a leughadh.",
	"error.storageUnavailable": "Chan eil an stòradh ri fhaighinn an-dràsta.",
	"error.diskFull":
		"Tha an stòradh làn. Saor beagan rùim agus feuch ris a-rithist.",
	"error.writeFailed":
		"Cha b’ urrainn dhuinn an dàta a shàbhaladh gu tèarainte.",
	"error.targetExists": "Tha dàta aig ceann-uidhe an stòraidh mu thràth.",
	"error.invalidFileReference": "Tha iomradh an fhaidhle mì-dhligheach.",
	"error.incompleteRecovery": "Tha dàta an ath-bheothachaidh neo-choileanta.",
	"error.invalidJson": "Chan eil JSON dligheach san fhaidhle.",
	"error.invalidDocument": "Chan eil structar dligheach aig an fhaidhle.",
	"error.unsupportedVersion":
		"Chan eil taic ris an tionndadh seo dhen fhaidhle.",
	"error.encodingFailed":
		"Cha b’ urrainn dhuinn còdachadh an fhaidhle a leughadh.",
	"error.invalidObject": "Tha an t-oibseact sàbhailte mì-dhligheach.",
	"error.repairFailed":
		"Cha b’ urrainn dhuinn an t-oibseact sàbhailte a chàradh.",
	"error.decisionExpired":
		"Chan eil an co-dhùnadh a chaidh iarraidh gnìomhach tuilleadh.",
	"error.decisionRequired":
		"Tha co-dhùnadh a dhìth mus urrainn dhan obrachadh seo leantainn air adhart.",
	"error.invalidDecision":
		"Chan eil an co-dhùnadh seo ri fhaighinn airson an obrachaidh làithrich.",
	"error.wrongObjectKind":
		"Chan eil an seòrsa oibseact ris an robh dùil san fhaidhle a chaidh a thaghadh.",
	"error.invalidValue": "Tha luach cuir-a-steach mì-dhligheach.",
	"error.preconditionNotMet":
		"Chan urrainnear an obrachadh a dhèanamh anns an staid làithreach.",
	"error.protectedObject":
		"Chan urrainnear an t-oibseact a tha ga chleachdadh an-dràsta atharrachadh no a sguabadh às.",
	"error.entityNotFound":
		"Cha b’ urrainn dhuinn an t-oibseact a chaidh iarraidh a lorg.",
	"error.unsupportedMediaType":
		"Chan eil taic ris an t-seòrsa faidhle a chaidh a thaghadh.",
	"error.invalidResourceSource": "Tha tùs na h-ìomhaighe mì-dhligheach.",
	"error.unsafeResourceSource":
		"Chaidh tùs na h-ìomhaighe a dhiùltadh air adhbharan tèarainteachd.",
	"error.ruleSetInvalid":
		"Chan eil structar dligheach aig an t-seata riaghailtean sàbhailte.",
	"error.fileNameInvalid": "Tha ainm an fhaidhle mì-dhligheach.",
	"error.savedDataUnreadable":
		"Cha b’ urrainn dhuinn an dàta sàbhailte a leughadh.",
	"error.savedDataInvalidJson": "Chan eil JSON dligheach san dàta sàbhailte.",
	"error.savedObjectInvalid":
		"Chan eil structar dligheach aig an oibseact sàbhailte.",
	"error.savedObjectUnsupportedVersion":
		"Chan eil taic ri tionndadh an oibseict shàbhailte.",
	"error.savedObjectEncodingFailed":
		"Cha b’ urrainn dhuinn còdachadh an oibseict shàbhailte a leughadh.",
	"error.savedObjectProcessingFailed":
		"Cha b’ urrainn dhuinn an t-oibseact sàbhailte a phròiseasadh.",
	"error.objectStoreMissing":
		"Cha b’ urrainn dhuinn stòr nan oibseactan a lorg.",
	"error.objectStoreUnreadable":
		"Cha b’ urrainn dhuinn stòr nan oibseactan a leughadh.",
	"error.objectStoreInvalidJson":
		"Chan eil JSON dligheach ann an stòr nan oibseactan.",
	"error.objectStoreInvalid":
		"Chan eil structar dligheach aig stòr nan oibseactan.",
	"error.objectStoreUnsupportedVersion":
		"Chan eil taic ri tionndadh stòr nan oibseactan.",
	"error.objectStoreEncodingFailed":
		"Cha b’ urrainn dhuinn còdachadh stòr nan oibseactan a leughadh.",
	"error.objectStoreProcessingFailed":
		"Cha b’ urrainn dhuinn stòr nan oibseactan a phròiseasadh.",
	"error.newFileMissing": "Tha am faidhle ùr a dhìth.",
	"error.incompleteWrite": "Obrachadh sàbhalaidh neo-choileanta.",
	"error.ruleSetStoreInvalidJson":
		"Chan eil JSON dligheach ann an stòr nan seataichean riaghailtean.",
	"error.ruleSetsUnreadable":
		"Cha b’ urrainn dhuinn na seataichean riaghailtean sàbhailte a leughadh.",
	"error.ruleSetStoreInvalid":
		"Chan eil structar dligheach aig stòr nan seataichean riaghailtean.",
	"errorBoundary.eyebrow": "Mearachd aplacaid",
	"errorBoundary.title":
		"Cha b’ urrainn dhuinn an eadar-aghaidh a shealltainn.",
	"errorBoundary.retry": "Feuch ris a-rithist",

	"success.imported.game": "Chaidh an geama sàbhailte “{name}” ion-phortadh.",
	"success.imported.template": "Chaidh an teamplaid “{name}” ion-phortadh.",
	"success.imported.ruleSet":
		"Chaidh an seata riaghailtean “{name}” ion-phortadh.",
	"success.imported.library": "Chaidh an leabharlann ion-phortadh.",
	"success.recovered.game":
		"Chaidh an geama sàbhailte “{name}” fhaighinn air ais.",
	"success.recovered.template":
		"Chaidh an teamplaid “{name}” fhaighinn air ais.",
	"success.recovered.ruleSet":
		"Chaidh an seata riaghailtean “{name}” fhaighinn air ais.",
	"success.recovered.library": "Chaidh an leabharlann fhaighinn air ais.",
	"success.restored.library":
		"Chaidh an leabharlann ath-nuadhachadh on chùl-taic.",
	"success.repaired.game": "Chaidh an geama sàbhailte “{name}” a chàradh.",
	"success.repaired.template": "Chaidh an teamplaid “{name}” a chàradh.",
	"success.repaired.ruleSet":
		"Chaidh an seata riaghailtean “{name}” a chàradh.",
	"success.repaired.library": "Chaidh an leabharlann a chàradh.",

	"repairReport.title": "Leabharlann air a càradh",
	"repairReport.acceptedRuleSets": {
		plural: {
			one: "Chaidh gabhail ri {count} seata riaghailtean.",
			two: "Chaidh {count} sheata riaghailtean a ghabhail.",
			few: "Chaidh gabhail ri {count} seataichean riaghailtean.",
			other: "Chaidh gabhail ri {count} seataichean riaghailtean.",
		},
	},
	"repairReport.removedRuleSets":
		"Seataichean riaghailtean a chaidh a thoirt air falbh",
	"repairReport.removed.notAnObject":
		"Chan e oibseact a tha san innteart stòraichte dhen t-seata riaghailtean.",
	"repairReport.removed.repairFailed":
		"Cha b’ urrainn dhuinn an seata riaghailtean a chàradh.",
	"repairReport.change.missingStatusDefinitionAdded":
		"Seata riaghailtean {ruleSetLabel}: chaidh mìneachadh na staide “{status}” a bha a dhìth a chur ris.",
	"repairReport.change.ruleSetUnknownFieldsRemoved":
		"Seata riaghailtean {ruleSetLabel}: chaidh raointean neo-aithnichte a thoirt air falbh ({fields}).",
	"repairReport.change.teamUnknownFieldsRemoved":
		"Sgioba {index} ann an {ruleSetLabel}: chaidh raointean neo-aithnichte a thoirt air falbh ({fields}).",
	"repairReport.change.roleUnknownFieldsRemoved":
		"Dreuchd {index} ann an {ruleSetLabel}: chaidh raointean neo-aithnichte a thoirt air falbh ({fields}).",
	"repairReport.change.statusUnknownFieldsRemoved":
		"Staid {index} ann an {ruleSetLabel}: chaidh raointean neo-aithnichte a thoirt air falbh ({fields}).",
	"repairReport.change.ruleSetIdCollisionResolved":
		"Seata riaghailtean {storedId}: chaidh an ID a bha ann an còmhstri atharrachadh gu “{newId}”.",
	"repairReport.change.ruleSetsContainerReplaced":
		"Chaidh soitheach falamh a chur an àite ruleSetsById a bha a dhìth no mì-dhligheach.",
	"repairReport.change.libraryUnknownFieldsRemoved":
		"Leabharlann: chaidh raointean neo-aithnichte a thoirt air falbh ({fields}).",
	"repairReport.change.insertedMissingQuote":
		"Chaidh comharra-labhairt a bha a dhìth a chur a-steach aig ionad {position}.",
	"repairReport.change.addedClosingBraces": {
		plural: {
			one: "Chaidh aon lùib dhùnaidh a bha a dhìth a chur ris.",
			two: "Chaidh {count} camagan dùnaidh a dhìth a chur ris.",
			few: "Chaidh {count} camagan dùnaidh a dhìth a chur ris.",
			other: "Chaidh {count} lùban dùnaidh a bha a dhìth a chur ris.",
		},
	},
	"repairReport.change.addedOpeningBraces": {
		plural: {
			one: "Chaidh aon lùib fhosglaidh a bha a dhìth a chur ris.",
			two: "Chaidh {count} camagan fosglaidh a dhìth a chur ris.",
			few: "Chaidh {count} camagan fosglaidh a dhìth a chur ris.",
			other: "Chaidh {count} lùban fosglaidh a bha a dhìth a chur ris.",
		},
	},

	"game.menu.open": "Fosgail clàr-taice a’ gheama",
	"game.menu.title": "Clàr-taice a’ gheama",
	"game.menu.actions": "Gnìomhan a’ gheama",
	"game.menu.save": "Sàbhail an geama",
	"game.menu.saveAs": "Sàbhail an geama mar",
	"game.menu.saveAsTemplate": "Sàbhail an geama mar theamplaid",
	"game.menu.exit": "Fàg an geama",
	"game.menu.manageEntities": "Stiùirich sgiobaidhean, dreuchdan agus staidean",
	"game.menu.randomizeRoles": "Sònraich dreuchdan air thuaiream",
	"game.menu.shufflePlayers":
		"Dèan ath-rèiteachadh air thuaiream na cluicheadairean am measg nan suidheachan còmhnaidh", // This value isn't accurate translated, yet.
	"game.menu.rolesForShowing": "Dreuchdan ri shealltainn",
	"game.menu.showLog": "Seall an loga",
	"game.menu.settings": "Roghainnean",
	"game.currentGame": "Geama làithreach",
	"game.unlockSeatOrder": "Neo-ghlais òrdugh nan suidheachan",
	"game.lockSeatOrder": "Glais òrdugh nan suidheachan",
	"game.playerOverview": "Foir-shealladh nan cluicheadairean",
	"game.seatOrder": "Òrdugh nan suidheachan",
	"game.zoomControls": "Sùm cearcall nan suidheachan",
	"game.zoomOut": "Sùm a-mach à cearcall nan suidheachan",
	"game.zoomIn": "Sùm a-steach air cearcall nan suidheachan",
	"game.zoomLevel": "Ìre an t-sùim: {percent} sa cheud",
	"game.showSeatCircle": "Seall cearcall nan suidheachan",
	"game.showPlayerOverview": "Seall foir-shealladh nan cluicheadairean",
	"game.seatAccessible": "Suidheachan {seat}{marker}",
	"game.sourceAndTargetSuffix": ", tùs agus targaid",
	"game.sourceSuffix": ", tùs",
	"game.targetSuffix": ", targaid",
	"game.deleteSeat": "Sguab às suidheachan {seat}",
	"game.addPlayerAfterSeat":
		"Cuir cluicheadair ris às dèidh suidheachan {seat}",
	"game.flow": "Sruth a’ gheama",
	"game.showRoles": "Seall dreuchdan",
	"game.nightList": "Liosta na h-oidhche",
	"game.seat": "Suidheachan {seat}",
	"game.details": "Mion-fhiosrachadh",
	"game.actionsForSeat": "Gnìomhan airson suidheachan {seat}",
	"game.deleteSelectedSeat":
		"Sguab às an suidheachan {seat} a chaidh a thaghadh",
	"game.addPlayerAfterSelectedSeat":
		"Cuir cluicheadair ris às dèidh an t-suidheachain {seat} a chaidh a thaghadh",
	"game.restoreSplitView": "Ath-nuadhaich an sealladh roinnte",
	"game.showDetailsFullscreen": "Seall mion-fhiosrachadh air làn-sgrìn",
	"game.manualSeat": "Àireamh an t-suidheachain",
	"game.selectSeat": "Tagh suidheachan",
	"game.lifeState": "Staid beatha",
	"game.life.alive": "Beò",
	"game.life.deadVoteAvailable": "Marbh – bhòt ri fhaighinn",
	"game.life.deadVoteSpent": "Marbh – bhòt air a chleachdadh",
	"game.life.doubleDeadVoteAvailable": "Marbh dà uair – bhòt ri fhaighinn",
	"game.life.doubleDeadVoteSpent": "Marbh dà uair – bhòt air a chleachdadh",
	"game.life.aliveShort": "Beò",
	"game.life.deadVoteAvailableShort": "Marbh · bhòt ri fhaighinn",
	"game.life.deadVoteSpentShort": "Marbh · bhòt air a chleachdadh",
	"game.life.doubleDeadVoteAvailableShort": "Marbh dà uair · bhòt ri fhaighinn",
	"game.life.doubleDeadVoteSpentShort":
		"Marbh dà uair · bhòt air a chleachdadh",
	"game.noRole": "Gun dreuchd",
	"game.team": "Sgioba",
	"game.rolesWithoutTeam": "Gun sgioba",
	"game.role.actual": "Fìor dhreuchd",
	"game.role.shown": "Dreuchd a tha air a shealltainn",
	"game.role.night": "Dreuchd na h-oidhche",
	"game.role.claimed": "Dreuchd a chaidh a thagradh",
	"game.statuses": "Staidean",
	"game.status": "Staid",
	"game.statusDuration": "Oidhche {from}–{until}",
	"game.openEnded": "fosgailte",
	"game.newStatus": "Staid ùr",
	"game.deletePlayer": "Sguab às cluicheadair",
	"game.player": "Cluicheadair",
	"game.selectPlayer": "Tagh cluicheadair …",
	"game.addPlayer": "+ Cluicheadair",
	"game.deleteEmptySeat": "Sguab às suidheachan falamh",
	"game.emptySeat": "Tha an suidheachan seo falamh.",
	"game.selectSeatPrompt": "Tagh suidheachan.",
	"game.playerWithName": "Cluicheadair: {name}",
	"game.deleteQuestion": "sguab às?",
	"game.newSeatAfter": "suidheachan ùr às dèidh",
	"game.addQuestion": "cuir ris?",
	"game.seatActionCancel": "Sguir dheth",
	"game.unsavedTitle": "Cha deach an geama a shàbhaladh fhathast.",
	"game.saveAndExit": "Sàbhail agus fàg an geama",
	"game.exitWithoutSaving": "Fàg an geama gun a shàbhaladh",
	"game.saveFailedTitle": "Cha b’ urrainn dhuinn am faidhle a shàbhaladh.",
	"game.targetExists": "Tha faidhle leis an ainm seo ann mu thràth.",
	"game.saveRecoveryQuestion":
		"Dè bu toigh leat a dhèanamh leis an obrachadh sàbhalaidh a dh’fhàillig?",
	"game.storageCommandInactive":
		"Chan eil àithne an stòraidh gnìomhach tuilleadh.",
	"game.decideLater": "Dèan co-dhùnadh nas fhaide air adhart",
	"game.setup": "Rèiteachadh",
	"game.nightNumber": "Oidhche {number}",
	"game.dayNumber": "Latha {number}",
	"game.backToGame": "Air ais dhan gheama",
	"game.log.title": "Loga",
	"game.log.empty": "Chan eil innteartan san loga fhathast.",
	"game.log.timeAdvanced": "Chaidh an t-àm air adhart: {oldTime} → {newTime}.",
	"game.log.timeRewound": "Chaidh an t-àm air ais: {oldTime} → {newTime}.",
	"game.log.lifeStateChanged":
		"Staid beatha {player}: {oldState} → {newState}.",
	"game.log.statusApplied": "Chaidh staid {status} a chur air {player}.",
	"game.log.rolesDistributed": {
		plural: {
			one: "Chaidh {count} dreuchd a sgaoileadh air thuaiream.",
			two: "{count} dreuchd air an sgaoileadh air thuaiream.",
			few: "{count} dreuchdan air an sgaoileadh air thuaiream.",
			other: "Chaidh {count} dreuchdan a sgaoileadh air thuaiream.",
		},
	},
	"game.log.selectedRolesDistributed": {
		plural: {
			one: "Chaidh {count} dreuchd thaghte a sgaoileadh air thuaiream.",
			two: "{count} dreuchd taghte air an sgaoileadh air thuaiream.",
			few: "{count} dreuchdan taghte air an sgaoileadh air thuaiream.",
			other: "Chaidh {count} dreuchdan taghte a sgaoileadh air thuaiream.",
		},
	},
	"game.log.seatMoved":
		"Chaidh cluicheadair {playerName} a ghluasad o shuidheachan {fromSeat} gu suidheachan {toSeat}.",
	"game.log.seatsSwapped":
		"Chaidh suidheachan {seatA} agus suidheachan {seatB} a chur an àite a chèile.",
	"game.log.playerAppended":
		"Chaidh cluicheadair {playerName} a chur ann an suidheachan {toSeat}.",
	"game.log.playerInserted":
		"Chaidh cluicheadair {playerName} a chur a-steach ann an suidheachan {toSeat}.",
	"game.log.playerRemoved":
		"Chaidh cluicheadair {playerName} a thoirt air falbh o shuidheachan {fromSeat}.",
	"game.log.seatOrderChanged": "Chaidh òrdugh nan suidheachan atharrachadh.",
	"game.roleReveal.navigation": "Foillseachadh dreuchd",
	"game.roleReveal.prompt":
		"Seall an dreuchd aig {player} (suidheachan {seat}). Tap air gus a foillseachadh.",
	"game.overview.seat": "Suidheachan",
	"game.overview.role": "Dreuchd",
	"game.sourceAndTarget": "Tùs/targaid",
	"game.source": "Tùs",
	"game.target": "Targaid",
	"game.overview.playerAccessible": "{name}, suidheachan {seat}{marker}",
	"game.overview.shownRole": "Air a shealltainn: {role}",
	"game.overview.nightRole": "Oidhche: {role}",
	"game.night.noActiveRoles":
		"Chan eil dreuchdan gnìomhach air an oidhche airson na h-oidhche seo.",
	"game.night.actionFor": "Gnìomh airson {player}",
	"game.night.action": "Gnìomh",
	"game.night.on": "air",
	"game.night.targetPlayer": "Cluicheadair targaid",
	"game.night.noEffect": "Cha robh buaidh aig a’ ghnìomh.",
	"game.night.execute": "Cuir an gnìomh",
	"game.night.kill": "Marbhaidh",
	"game.night.resurrect": "Ath-bheothaichidh",
	"game.action.kill": "marbh",
	"game.action.resurrect": "ath-bheothaich",
	"game.action.applyStatus": "cuir staid an sàs",
	"game.action.unknown": "gnìomh neo-aithnichte (còd taobh a-staigh: {action})",
	"game.life.dead": "Marbh",
	"game.warning.playerNotFound": "Chan eil cluicheadair “{playerId}” ann.",
	"game.warning.statusNotFound": "Chan eil staid “{statusId}” ann.",
	"game.warning.actorNotFound": "Chan eil cluicheadair “{playerId}” ann.",
	"game.warning.targetNotFound":
		"Chan eil cluicheadair targaid “{playerId}” ann.",
	"game.warning.actualRoleNotFound":
		"Cha deach fìor dhreuchd a lorg airson cluicheadair “{playerId}”.",
	"game.warning.abilityAmbiguous":
		"Tha comas na dreuchd “{roleName}” dà-sheaghach.",
	"game.warning.statusAmbiguous":
		"Tha an staid a tha ri cur an sàs dà-sheaghach.",
	"game.warning.voteAlreadySpent":
		"Chaidh bhòt an taibhse a chleachdadh mu thràth.",
	"game.warning.abilityNotAllowed":
		"Chan eil dreuchd “{roleName}” a’ ceadachadh a’ ghnìomha “{action}”.",
	"game.warning.statusNotAllowed":
		"Chan fhaod dreuchd “{roleName}” staid “{statusId}” a chur an sàs.",
	"game.statusEditor.title": "Deasaich staid",
	"game.statusEditor.status": "Staid",
	"game.statusEditor.fromNight": "Bhon oidhche",
	"game.statusEditor.untilNight": "Gus an oidhche",
	"game.statusEditor.note": "Nòta",
	"game.playerName": "Ainm a’ chluicheadair",

	"recovery.kind.game": "geama sàbhailte",
	"recovery.kind.template": "teamplaid",
	"recovery.kind.ruleSet": "seata riaghailtean",
	"recovery.backupFile": "faidhle cùl-taic",
	"recovery.temporaryFile": "faidhle ath-bheothachaidh sealach",
	"recovery.incompleteSave": "Obrachadh sàbhalaidh neo-choileanta",
	"recovery.openCount": " ({count} fosgailte)",
	"recovery.orphanedFile":
		"Chaidh {recoveryFile} a lorg, ach tha am faidhle co-fhreagarrach airson {kind} a dhìth.",
	"recovery.twoFiles":
		"Chaidh seann fhaidhle agus faidhle a dh’fhaodadh a bhith ùr a lorg airson {kind} “{id}”.",
	"recovery.keepOld": "Cum an seann fhaidhle",
	"recovery.keepNew": "Cum am faidhle ùr",
	"recovery.keepBothFiles": "Cum an dà fhaidhle",
	"recovery.exportBrokenFile": "Às-phortaich am faidhle millte",
	"recovery.decideLater": "Dèan co-dhùnadh nas fhaide air adhart",
	"recovery.invalidObjectTitle":
		"Chaidh oibseact sàbhailte mì-dhligheach a lorg",
	"recovery.affectedObject":
		"Oibseact air a bheil buaidh ({kind}): “{reference}”",
	"recovery.file": "Faidhle",
	"recovery.suggestedFileName": "Ainm faidhle a thathar a’ moladh",
	"recovery.repairObject": "Càraich an t-oibseact",
	"recovery.repairFileName": "Càraich ainm an fhaidhle",
	"recovery.exportObject": "Às-phortaich an t-oibseact",
	"recovery.deleteObject": "Sguab às an t-oibseact",
	"recovery.reason.invalidRuleSet":
		"Chan eil structar dligheach aig an t-seata riaghailtean sàbhailte.",
	"recovery.reason.invalidFileName":
		"Chan eil am faidhle JSON a’ leantainn nan gnàthasan ainmeachaidh.",
	"recovery.reason.decodeFailed":
		"Cha b’ urrainn dhuinn am faidhle a dhì-chòdachadh.",
	"recovery.reason.invalidJson": "Chan eil JSON dligheach san fhaidhle.",
	"recovery.reason.invalidTemplate":
		"Chan e teamplaid dhligheach a tha san JSON.",
	"recovery.reason.invalidGame":
		"Chan e geama sàbhailte dligheach a tha san JSON.",
	"recovery.rememberDecision":
		"Cuimhnich an co-dhùnadh seo agus cuir an sàs e air gach mearachd dhen aon seòrsa",
	"recovery.library.missing": "Cha b’ urrainn dhuinn an leabharlann a lorg.",
	"recovery.library.orphanedTemporary":
		"Chaidh faidhle ath-bheothachaidh sealach a lorg, ach tha an leabharlann cho-fhreagarrach a dhìth.",
	"recovery.library.orphanedBackup":
		"Chaidh faidhle cùl-taic a lorg, ach tha an leabharlann cho-fhreagarrach a dhìth.",
	"recovery.library.decodeFailed":
		"Cha b’ urrainn dhuinn faidhle na leabharlainn a dhì-chòdachadh.",
	"recovery.library.invalidJson":
		"Chan eil JSON dligheach ann am faidhle na leabharlainn.",
	"recovery.library.invalidRuleSet":
		"Tha seata riaghailtean mì-dhligheach san leabharlann.",
	"recovery.library.invalidDocument":
		"Chan e leabharlann dhligheach a tha san JSON.",
	"recovery.library.title": "Cha ghabh an leabharlann a leughadh",
	"recovery.library.restoreBackup": "Ath-nuadhaich an cùl-taic",
	"recovery.library.repair": "Càraich an leabharlann",
	"recovery.library.createEmpty": "Cruthaich leabharlann fhalamh ùr",
	"recovery.library.export": "Às-phortaich an leabharlann",

	"rolesForShowing.title": "Dreuchdan ri shealltainn",
	"rolesForShowing.closePreview": "Dùin an ro-shealladh",
	"rolesForShowing.freeText": "Teacsa saor",
	"rolesForShowing.roles": "Dreuchdan",
	"rolesForShowing.removeRole": "Thoir {name} air falbh",
	"rolesForShowing.empty": "Cha deach dreuchdan a thaghadh fhathast.",
	"rolesForShowing.addRole": "＋ Dreuchd",
	"rolesForShowing.showSymbol": "Seall samhla na dreuchd",
	"rolesForShowing.preview": "Ro-shealladh",
	"rolesForShowing.addRoleTitle": "Cuir dreuchd ris",

	"roleDistribution.title": "Sònraich dreuchdan air thuaiream",
	"roleDistribution.teamDistribution": "Sgaoileadh sgiobaidhean",
	"roleDistribution.roleSelection": "Taghadh dhreuchdan",
	"roleDistribution.type": "Dòigh sgaoilidh dhreuchdan",
	"roleDistribution.random.title": "Sgaoil dreuchdan air thuaiream",
	"roleDistribution.random.detail":
		"Suidhich meudan nan sgiobaidhean agus tarraing dreuchdan",
	"roleDistribution.selected.title": "Sgaoil na dreuchdan taghte air thuaiream",
	"roleDistribution.selected.detail":
		"Tagh dreuchdan sònraichte agus sònraich iad air thuaiream",
	"roleDistribution.manual.title": "Sònraich dreuchdan a làimh",
	"roleDistribution.manual.detail":
		"Sònraich dreuchdan nas fhaide air adhart air sgrìn a’ gheama",
	"roleDistribution.overwriteRunning":
		"Tha an geama a’ ruith mu thràth. Thèid na fìor dhreuchdan, na dreuchdan a tha air an sealltainn agus dreuchdan na h-oidhche a sgrìobhadh thairis orra.",
	"roleDistribution.overwriteAssigned":
		"Thèid dreuchdan a chaidh a shònrachadh mu thràth a sgrìobhadh thairis orra.",
	"roleDistribution.redistribute": "Ath-sgaoil dreuchdan",
	"roleDistribution.uniqueRoleMultiple":
		"Chaidh dreuchd shònraichte a thaghadh barrachd air aon turas",
	"roleDistribution.decrease": "Lùghdaich {name}",
	"roleDistribution.count": "Àireamh airson {name}",
	"roleDistribution.increase": "Meudaich {name}",
	"roleDistribution.freePlayers": "Cluicheadairean gun sònrachadh",
	"roleDistribution.distribute": "Sgaoil dreuchdan",

	"roleDistribution.error.teamHasNoRoles": {
		plural: {
			one: "Dh’ fhàillig cuairteachadh dreuchd: chaidh cluicheadair {count} iarraidh airson sgioba “{teamName}”, ach chan eil dreuchdan aig an sgioba.",
			two: "Dh’fhàillig cuairteachadh dreuchd: {count} chaidh cluicheadairean iarraidh airson sgioba “{teamName}”, ach chan eil dreuchdan sam bith aig an sgioba.",
			few: "Dh’fhàillig cuairteachadh dreuchd: {count} chaidh cluicheadairean iarraidh airson sgioba “{teamName}”, ach chan eil dreuchdan aig an sgioba.",
			other:
				"Dh’fhàillig cuairteachadh dreuchd: {count} chaidh cluicheadairean iarraidh airson sgioba “{teamName}”, ach chan eil dreuchdan sam bith aig an sgioba.",
		},
	},
	"roleDistribution.error.insufficientDistinctRoles": {
		plural: {
			one: "Role distribution failed: {requestedCount} players were requested for team “{teamName}”, but there is only {count} distinct role and no repeatable role.",
			two: "Dh’ iarr an sgioba “{teamName}” cluicheadairean {requestedCount}, ach chan eil ach {count} dreuchdan sònraichte rim faighinn agus chan fhaodar dreuchd sam bith a dhèanamh a-rithist, agus mar sin dh’ fhàillig cuairteachadh dreuchd.",
			few: "Role distribution failed: {requestedCount} players were requested for team “{teamName}”, but there are only {count} distinct roles and no repeatable role.",
			other:
				"Dh’ iarr an sgioba “{teamName}” cluicheadairean {requestedCount}, ach chan eil ach {count} dreuchdan sònraichte rim faighinn agus chan fhaodar dreuchd sam bith a dhèanamh a-rithist, agus mar sin dh’ fhàillig cuairteachadh dreuchd.",
		},
	}, // This value isn't accurate translated, yet.
	"scenarioEditor.objectType": "Seòrsa oibseict",
	"scenarioEditor.teams": "Sgiobaidhean",
	"scenarioEditor.roles": "Dreuchdan",
	"scenarioEditor.players": "Cluicheadairean",
	"scenarioEditor.statuses": "Staidean",
	"scenarioEditor.readingDetails": "A’ leughadh mion-fhiosrachaidh …",
	"scenarioEditor.create": "＋ Cruthaich",
	"scenarioEditor.new.teams": "Sgioba ùr",
	"scenarioEditor.new.roles": "Dreuchd ùr",
	"scenarioEditor.new.players": "Cluicheadair ùr",
	"scenarioEditor.new.statuses": "Staid ùr",
	"scenarioEditor.saveChange": "Sàbhail an t-atharrachadh",
	"scenarioEditor.saveAsNewRuleSet":
		"Sàbhail an t-atharrachadh mar sheata riaghailtean ùr",
	"scenarioEditor.saveAsNewTemplate":
		"Sàbhail an t-atharrachadh mar theamplaid ùr",
	"scenarioEditor.newGameWithRuleSet":
		"Geama ùr leis an t-seata riaghailtean seo",
	"scenarioEditor.newGameFromTemplate": "Geama ùr on teamplaid seo",
	"scenarioEditor.saveCopy": "Sàbhail mar lethbhreac",
	"scenarioEditor.unsavedChanges":
		"Cha deach na h-atharraichean a shàbhaladh fhathast.",
	"scenarioEditor.unsavedRuleSet":
		"Cha deach an seata riaghailtean a shàbhaladh fhathast.",
	"scenarioEditor.unsavedTemplate":
		"Cha deach an teamplaid a shàbhaladh fhathast.",
	"scenarioEditor.saveAndContinue": "Sàbhail & lean air adhart",
	"scenarioEditor.continueWithoutSaving":
		"Lean air adhart gun a bhith a 'sàbhaladh",
	"scenarioEditor.saveAndExit": "Sàbhail agus fàg",
	"scenarioEditor.exitWithoutSaving": "Fàg gun sàbhaladh",
	"scenarioEditor.editDetails": "Deasaich mion-fhiosrachadh",
	"scenarioEditor.closeDetails": "Dùin sealladh a’ mhion-fhiosrachaidh",
	"scenarioEditor.displayName": "Ainm taisbeanaidh ({language})",
	"scenarioEditor.teamOrder": "Òrdugh nan sgiobaidhean",
	"scenarioEditor.defaultDuration":
		"Fad bunaiteach ann an oidhcheannan (0 = gun chrìoch)",
	"scenarioEditor.team": "Sgioba",
	"scenarioEditor.firstNightOrder": "Òrdugh air a’ chiad oidhche",
	"scenarioEditor.otherNightOrder": "Òrdugh on dàrna oidhche air adhart",
	"scenarioEditor.unique": "Sònraichte?",
	"scenarioEditor.activeAbilities": "Comasan gnìomhach",
	"scenarioEditor.canKill": "Faodaidh marbhadh",
	"scenarioEditor.canResurrect": "Faodaidh ath-bheothachadh",
	"scenarioEditor.canApplyStatuses": "Faodaidh staidean a chur an sàs",
	"scenarioEditor.noStatuses": "Cha deach staidean a mhìneachadh fhathast.",
	"scenarioEditor.unicodeSymbol": "Samhla Unicode",
	"scenarioEditor.unicodePreview": "Ro-shealladh Unicode",
	"scenarioEditor.useColor": "Cleachd dath",
	"scenarioEditor.editColor": "Deasaich an dath",
	"scenarioEditor.colorPickerTitle": "Tagh dath",
	"scenarioEditor.colorCode": "Còd heics RGB",
	"scenarioEditor.colorPreview": "Ro-shealladh an datha",
	"scenarioEditor.apply": "Cuir an sàs",
	"scenarioEditor.deleteQuestion":
		"A bheil thu cinnteach gu bheil thu airson “{name}” a sguabadh às?",
	"scenarioEditor.workingCopy": "Lethbhreac obrach",

	"app.closeError": "Dùin teachdaireachd na mearachd",
	"app.exited": "Tha an aplacaid air dùnadh.",
	"app.restart": "Ath-thòisich an aplacaid",
	"appError.checkFiles": "Cha b’ urrainn dhuinn na faidhlichean a sgrùdadh.",
	"appError.settingsUpdate":
		"Cha b’ urrainn dhuinn na roghainnean atharrachadh.",
	"appError.settingsOpen": "Cha b’ urrainn dhuinn na roghainnean fhosgladh.",
	"appError.continueLastGame":
		"Cha b’ urrainn dhuinn leantainn air adhart leis a’ gheama mu dheireadh.",
	"appError.continueGame":
		"Cha b’ urrainn dhuinn leantainn air adhart leis a’ gheama.",
	"appError.openPreparedGame":
		"Cha b’ urrainn dhuinn an geama ullaichte fhosgladh.",
	"appError.restoreOldFile":
		"Cha b’ urrainn dhuinn an seann fhaidhle ath-nuadhachadh.",
	"appError.retryStorageCommand":
		"Cha ghabh àithne an stòraidh fheuchainn a-rithist.",
	"appError.finishStorageCommand":
		"Cha ghabh àithne an stòraidh a chrìochnachadh.",
	"appError.continueStorageCommand":
		"Cha ghabh leantainn air adhart le àithne an stòraidh.",
	"appError.saveGamesUnavailable":
		"Cha ghabh geamannan sàbhailte a shàbhaladh.",
	"appError.saveTemplatesUnavailable": "Cha ghabh teamplaidean a shàbhaladh.",
	"appError.changeSeatOrder":
		"Cha b’ urrainn dhuinn òrdugh nan suidheachan atharrachadh.",
	"appError.savePlayer": "Cha b’ urrainn dhuinn an cluicheadair a shàbhaladh.",
	"appError.deleteEmptySeat":
		"Cha b’ urrainn dhuinn an suidheachan falamh a sguabadh às.",
	"appError.deletePlayer":
		"Cha b’ urrainn dhuinn an cluicheadair a sguabadh às.",
	"appError.advanceTime":
		"Cha b’ urrainn dhuinn àm a’ gheama a chur air adhart.",
	"appError.rewindTime": "Cha b’ urrainn dhuinn àm a’ gheama a chur air ais.",
	"appError.applyGameChanges":
		"Cha b’ urrainn dhuinn atharraichean a’ gheama a chur an sàs.",
	"appError.distributeRoles":
		"Cha b’ urrainn dhuinn na dreuchdan a sgaoileadh.",
	"startup.initializeFiles":
		"Cha b’ urrainn dhuinn faidhlichean na h-aplacaid a thòiseachadh.",
	"startup.repairFileNames":
		"Cha b’ urrainn dhuinn ainmean faidhle taobh a-staigh a chàradh.",
	"startup.loadSettings":
		"Cha b’ urrainn dhuinn na roghainnean a luchdadh. Thèid na luachan bunaiteach a chleachdadh.",
	"startup.rootMissing": "Tha an eileamaid HTML leis an ID “root” a dhìth.",
} satisfies Record<GuiTranslationKey, GuiTranslationMessage>;
