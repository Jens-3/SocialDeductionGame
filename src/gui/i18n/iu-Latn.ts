import type { GuiTranslationKey } from "./de";
import type { GuiTranslationMessage } from "./messages";
export const inuktitutLatinGuiMessages = {
	"common.back": "Tunu",
	"common.cancel": "Qujanaarniq",
	"common.close": "Qanittuq",
	"common.later": "Uattiarukkanniq",
	"common.import": "Kanataup silataani",
	"common.export": "Kanataup silataanut",
	"common.share": "Amiqqaaqatiqarniq",
	"common.rename": "Atiliukkannirlugu",
	"common.duplicate": "Ajjinga",
	"common.delete": "Piijaqtaujuq",
	"common.deletePermanently": "Piiqtaunginnarniaqtuq",
	"common.name": "Atinga",
	"common.unknown": "Nalujaujuq",
	"common.detailsParenthetical": "(Ilulingit)",
	"common.schemaVersion": "Aaqqiksimaninga aaqqiksimaninga",
	"common.actionsFor": "Qanuiliurutiksat ukununga",
	"common.moreActionsFor": "Qanuiliurutiksakkanniit {name}-mut",
	"common.cancelImport": "Nuqqaqtitauluni tikititauninga",
	"common.tryRepair": "Sananasuarlugu",
	"common.keepBoth": "Tamakkiik pisimalugit",
	"common.restored": "Utiqtitausimajuq {index}",
	"common.ok": "ATII",
	"common.next": "Kingulliq",
	"common.save": "Piulikhliniq",
	"common.saving": "Kiinaujanik atunnginiqsauniq...",
	"common.select": "Niruarniq …",
	"common.overwrite": "Titirakkannirlugu",
	"common.retry": "Uuktukkannirit",
	"common.yes": "Ii",
	"common.no": "Aakka",
	"home.eyebrow": "Pinnguarniujunik aulattiji",
	"home.mainMenu": "Nirijaksait",
	"home.continueGame": "Kajusiluni pinnguarniq",
	"home.latestSave": "Kingulliqpaaq sanirvaktausimajuq pinnguagaq",
	"home.noCurrentGame": "Maannaujuq pinnguagaq atuinnaunngilaq",
	"home.newGame": "Nutaaq pinnguagaq",
	"home.loadGame": "Pinnguarniujuq",
	"home.manageScenarios": "Aulattiluni qanuinniujunik",
	"home.settings": "Aaqqiksimaningit",
	"home.exitApp": "Anilutit qaritaujakkut tuksirautimik",
	"home.exitQuestion": "Anilutit qaritaujakkut tuksirautimik?",
	"home.exitConfirm": "Anivvik",
	"home.exitAnyway": "Anilutit qanutuinnaq",
	"home.activeWrites": {
		plural: {
			one: "{count} sanirvainiq aulaniujuq suli kajusijuq.",
			two: "{count} sanirvainirmut aulaniujut suli kajusijut.",
			other: "{count} sanirvainirmut aulaniujut suli kajusijut.",
		},
	},
	"newGame.title": "Nutaaq pinnguagaq",
	"newGame.startingPoint": "Pigiarviksaq",
	"newGame.useRuleSet": "Aturlugit maligait aaqqiktausimajut ({count})",
	"newGame.ruleSetDetail":
		"Niruarlutit nutaamik pinnguaqtiup naasautinganik atinganillu",
	"newGame.useTemplate": "Aturlugu aaqqiksimaninga ({count})",
	"newGame.templateDetail":
		"Aturlugu parnaktausimajuq pinnguagaq aaqqiksimaninga",
	"newGame.ruleSet": "Maligait aaqqiktausimajut",
	"newGame.template": "Aaqqiksimaninga",
	"newGame.noEntries": "Titiraqsimajut atuinnaunngittut",
	"newGame.noRuleSets": "Maligarnik atuinnaqtaqanngilaq.",
	"newGame.noTemplates": "Uuttuutiksait atuinnaunngilat.",
	"newGame.playerCount": "Pinnguaqtiit naasaqtauningit",
	"newGame.gameName": "Pinnguarutiup atinga",
	"newGame.generatedName": "Saqqitaukautigijuq",
	"newGame.prepare": "Upalungaijainiq pinnguarnirmik",
	"newGame.noRuleSetSelected": "Maligarnik niruaqtuqanngittuq.",
	"newGame.noTemplateSelected": "Niruaqtausimanngittuq aaqqiksimaninga.",
	"loadGame.title": "Pinnguarniujuq",
	"loadGame.search": "Qinirlutit sanirvaktausimajunik pinnguagarnik",
	"loadGame.reading": "Uqalimaarniq sapujjausimajunik pinnguagarnik ...",
	"loadGame.repairImportQuestion":
		"Sanajaujariaqaqpat tikititausimajut paippaat?",
	"loadGame.alreadyExists": "Sanirvaktausimajuq pinnguagaq pitaqariiqtuq",
	"loadGame.existingFile": "Maannaujuq paippaaq",
	"loadGame.importedFile": "Tikititausimajuq paippaaq",
	"loadGame.overwriteExisting": "Titirakkannirlugu maannaujuq paippaaq",
	"loadGame.players": {
		plural: {
			one: "{count} pinnguaqti",
			two: "{count} pinnguaqtiit",
			other: "{count} pinnguaqtiit",
		},
	},
	"loadGame.loading": "Usijauninga...",
	"loadGame.noMatches":
		"Ajjigiiktunik sanirvaktausimajunik pinnguagarnik nanisilaunngittut.",
	"loadGame.deleteQuestion": "Piijaillarikkavit “{name}”?",
	"loadGame.setup": "Aaqqiksuiniq",
	"loadGame.night": "Unnukkut {number}",
	"loadGame.day": "Ulluq {number}",
	"loadGame.readError":
		"Sanirvaktausimajuq pinnguagaq uqalimaaqtaujunnalaunngilaq.",
	"scenarios.title": "Aulattiluni qanuinniujunik",
	"scenarios.filter": "Salummaqsaijjutit qanuinniujut",
	"scenarios.filter.all": "Tamarmik",
	"scenarios.filter.ruleSets": "Maligait aaqqiktausimajut",
	"scenarios.filter.templates": "Aaqqiksimaningit",
	"scenarios.ruleSet": "Maligait aaqqiktausimajut",
	"scenarios.template": "Aaqqiksimaninga",
	"scenarios.reading": "Uqalimaarniq takunnagaksanik ...",
	"scenarios.empty": "Takunnagaksanik atuinnaqtaqanngilaq.",
	"scenarios.create": "Sanalutit",
	"scenarios.newRuleSet": "Nutaaq maligaq aaqqiktausimajuq",
	"scenarios.invalidRuleSet": "Atunngittuq maligaq aaqqiktausimajuq",
	"scenarios.ruleSetMetadata":
		"Aaqqiksimaninga {version} · {teams} tapiriit · {roles} piliriaksat",
	"scenarios.templateMetadata": {
		plural: {
			one: "{count} iksivautaq · {ruleSet}",
			two: "{count} iksivautait · {ruleSet}",
			other: "{count} iksivautait · {ruleSet}",
		},
	},
	"scenarios.savedAt": "Sanirvaktausimajuq: {date}",
	"scenarios.newWorkingCopy": "Nutaaq piliriangujunnaqtuq ajjinga",
	"scenarios.duplicated": "Ajjiliuqtausimajut",
	"scenarios.detailsReading": "Uqalimaarniq nalunaijaqsimajunik ...",
	"scenarios.loadError": "Takunnagaksaq qarasaujarmut ilijaujunnalaunngimmat.",
	"scenarios.exportUnsupported":
		"Maannaujuq tuqquivik ikajuqtuinngilaq aullaqtittinirmik.",
	"scenarios.exported": "“{name}” aullaqtitausimajut.",
	"scenarios.shared": "“{name}” katujjaujuq.",
	"scenarios.copySaved": "Nutaaq ajjinga sanirvaktausimajuq.",
	"scenarios.changesSaved": "Asijjiqtausimajut sanirvaktausimajut.",
	"scenarios.justSaved": "Sanirvaqtaurataaqtuq",
	"scenarios.detailExported": "Takunnagaksaq aullaqtitausimajuq.",
	"scenarios.detailShared": "Takunnagaksaq katujjaujuq.",
	"scenarios.deleted": "“{name}” piiqtaujuq.",
	"scenarios.renamed": "Atinga asijjiqtaulluni “{name}”.",
	"scenarios.duplicatedMessage": "“{name}” ajjiliuqtausimajuq.",
	"scenarios.restoredRestriction":
		"Utiqtitausimajuq aaqqiksimaninga kisiani ajjiliuqtaujunnaqtuq uvvaluunniit aullaqtitauluni.",
	"scenarios.repairImportQuestion":
		"Sanajaujariaqaqpat tikititausimajut paippaat?",
	"scenarios.ruleSetExists": "Maligaq aaqqiktausimajuq pitaqariiqtuq",
	"scenarios.templateExists": "Aaqqiksimaninga pitaqariiqtuq",
	"scenarios.existingObject": "Maannaujuq piquti",
	"scenarios.importedObject": "Tikititausimajuq piquti",
	"scenarios.overwriteExisting": "Titirakkannirlugu maannaujuq piquti",
	"scenarios.deleteQuestion": "Piiqsillarikkavit “{name}”?",
	"settings.title": "Aaqqiksimaningit",
	"settings.general": "Kisutuinnat",
	"settings.language": "Uqausiqtaq",
	"settings.language.system": "Qaritaujakkut uqausiq",
	"settings.appearance": "Takunnarninga",
	"settings.theme.system": "Pilirijjusiq",
	"settings.theme.light": "Uqittuq",
	"settings.theme.dark": "Taaqtuq",
	"settings.duringGame": "Pinnguaqtillugit",
	"settings.hideExpiredStatuses": "Ijiqsimalugit isulisimajut qanuilinganingit",
	"settings.seatCircleNorthFirst": "Orient first seat at the top.", // This value isn't accurate translated, yet.
	"settings.seatCircleNorthLast":
		"ᑭᖑᓪᓕᖅᐹᖅ ᐃᒃᓯᕙᐅᑕᖅ ᖁᓛᓅᕐᓗᒍ ᓴᕕᕋᔭᒃ ᐃᒃᓯᕙᐅᑕᖅ ᑎᑎᕋᖅᓯᒪᔪᖅ.",
	"settings.seatCircleClockwise":
		"ᐋᖅᑭᒃᓱᕐᓗᒋᑦ ᐃᒃᓯᕙᐅᑕᐃᑦ ᓯᕿᙳᔭᐅᑉ ᓴᖑᓂᖓᓄᑦ ᓴᓂᕌᓂ ᓯᕐᓈᖅᑎᐅᑉ.",
	"settings.seatCircleCounterClockwise": "ᓯᕿᙳᔭᐅᑉ ᓴᖑᓂᖓᓄᑦ",
	"settings.keepScreenAwake": "Tarraqtuuti tupaksimatillugu",
	"settings.hapticFeedback": "Timikkut kiujjutit",
	"settings.autoRotate": "Nangminiq naliannurauti",
	"settings.accessibility": "Atuinnaujunnarniq",
	"settings.textSize": "Titiraqsimajut anginingit",
	"settings.textSize.small": "Mikittuq",
	"settings.textSize.standard": "Piusiq",
	"settings.textSize.large": "Angijuq",
	"settings.reduceMotion": "Mikilligiarlugu piqujivungaarut",
	"settings.data": "Titiraqsimajut qaujisaqtaunikuit",
	"settings.createBackup": "Saqqittilutit nalliukkumaanik",
	"settings.exportLibrary": "Aullaqtittiniq uqalimaagaqarvingmik",
	"settings.shareBackup": "Katujjiniq nalliukkumaanik",
	"settings.shareLibrary":
		"Aullaqtittilutit uqalimaagaqarvingmut aturlutit asianik qaritaujakkut tuksirautimik",
	"settings.backupShared": "Nalliukkumaaq katujjaujuq.",
	"settings.restoreLibrary": "Utiqtitauluni uqalimaagaqarvik",
	"settings.replaceLibrary": "Kinguvvirlugu uqalimaagaqarvik",
	"settings.deleteAllData": "Piijarlugit tukisigiarutilimaat",
	"settings.about": "Miksaanut",
	"settings.version": "Qanuittuuninga",
	"settings.licenseSummaryDisclaimer":
		"This notice is only a summary and does not replace the full license text. Only the full license text is authoritative.", // This value isn't accurate translated, yet.
	"settings.viewLicense": "ᒪᑐᐃᕐᓗᒍ ᖃᕆᑕᐅᔭᒃᑯᑦ ᓚᐃᓴᓐᓯ",
	"settings.copyrightHolder": "ᑎᑎᕋᖅᑕᐅᓯᒪᔪᓄᑦ ᐱᔪᓐᓇᐅᑎᖃᖅᑎ",
	"settings.softwareLicense": "ᖃᕆᑕᐅᔭᕐᒧᑦ ᓚᐃᓴᓐᓯ",
	"settings.openSourceLicenses": "Matuingajut laisansiit",
	"settings.licenseNotice":
		"ᑖᓐᓇ ᖃᕋᓴᐅᔭᓕᕆᔾᔪᑎ ᓇᓪᓕᐅᒃᑯᒫᖃᕋᓂ. AGPL-3.0-only ᐱᔪᓐᓇᖅᑎᑦᑎᕗᖅ ᐊᑐᕈᓐᓇᕐᓂᕐᒥᒃ, ᐊᓯᔾᔨᕈᓐᓇᕐᓂᕐᒥᒃ, ᐊᒻᒪᓗ ᑐᓂᐅᖅᑲᐃᒃᑲᓐᓂᕈᓐᓇᕐᓂᕐᒥᒃ.",
	"settings.backupCreated": "Uqalimaagaqarvik nalliukkumaaq saqqitausimajuq.",
	"settings.restoreComplete": "Uqalimaagaqarvik sanajaukkanniqsimajuq.",
	"settings.restoreDiscarded": {
		plural: {
			one: "Uqalimaagaqarvik sanajaukkanniqtuq. {count} atunngittuq maligaq aaqqiktausimajuq qujanaaqtaulauqtuq.",
			two: "Uqalimaagaqarvik sanajaukkanniqtuq. {count} atunngittut maligait piiqtaulauqput.",
			other:
				"Uqalimaagaqarvik sanajaukkanniqtuq. {count} atunngittut maligait piiqtaulauqput.",
		},
	},
	"settings.replaceQuestion": "Kinguvviqtauluni uqalimaagaqarvilimaaq?",
	"settings.replaceDescription":
		"Maannaujuq uqalimaagaqarvik kinguvviqtauniaqtuq “{fileName}”-mut.",
	"settings.currentStorageVersion": "Maannaujuq tuqquivik aaqqiksimaninga",
	"settings.importedStorageVersion":
		"Tikititausimajuq tuqquivik aaqqiksimaninga",
	"settings.unknown": "Nalujaujuq",
	"settings.validRuleSets": "Atuqtut maligait aaqqiktausimajut",
	"settings.discardedRuleSets":
		"Maligait aaqqiktausimajut igitaujariaqarninginnut",
	"settings.invalidRuleSetsDiscarded":
		"Atunngittut maligait igitauniaqput: {ids}",
	"settings.importValidOnly": "Tikitittiniq atuqtuq kisiani",
	"settings.tryRepair": "Sananasuarlugu",
	"settings.saveFailedTitle": "Aaqqiksimaningit sanirvaktaujunnalaunngilat.",
	"settings.saveFailedQuestion": "Uuttukkannirumaviit?",
	"error.unknown": "Qaujimajaunngittuq tammaqsimajuq.",
	"error.technicalDetails": "Pijarningittunut nalunaijaqsimajut",
	"error.technicalInline": "Qaritaujakkut nalunaijaqsimajut: {details}",
	"error.details.copy": "Ajjiliuriniq nalunaijaqsimajunik",
	"error.details.copied": "Ajjiliuqtaujuq",
	"error.details.source": "Nakinngaarvik",
	"error.details.operation": "Aulaniq",
	"error.details.subject": "Pijjutinga",
	"error.details.reason": "Pijjuti",
	"error.details.diagnostic": "Qaujisarniq",
	"error.details.type": "Tammaqsimajuq qanuittuuninga",
	"error.details.message": "Tammaqsimajuq tusagaksaq",
	"error.details.cause": "Pijjutinga",
	"error.details.stack": "Tuqhluraqtausimajut maliktaujarialiit",
	"error.unexpected":
		"Niriunanngittumik tuksirautimik tammaqsimajuq. Atii unikkaarilugu taanna tammaqsimajuq.",
	"error.dataNotFound": "Sanirvaktausimajut nanijaujunnalaunngilat.",
	"error.dataUnreadable":
		"Sanirvaktausimajut tukisigiarutiksat uqalimaaqtaujunnanngilat.",
	"error.storageUnavailable": "Tuqquivik maannaujuq atuinnaunngilaq.",
	"error.diskFull":
		"Tuqquivik tatattuq. Iniksaqaqtittilutit uuktukkannirlutit.",
	"error.writeFailed":
		"Tukisigiarutiksait sanirvaktaujunnalaunngimmata attarnaqtumiittailimalutik.",
	"error.targetExists":
		"Tukisigiarutiksait pitaqariiqtut tuqquqtausimajuni turaagarijaujuni.",
	"error.invalidFileReference": "Titiqqaqutiup nalunaikkutanga atunngilaq.",
	"error.incompleteRecovery":
		"Utiqtittinirmut titiraqsimajut pijariiqsimanngimmata.",
	"error.invalidJson": "Titiqqaq iluliqanngilaq naammaktumik JSON-mik.",
	"error.invalidDocument": "Titiqqait aaqqiksimaniqattianngimmata.",
	"error.unsupportedVersion":
		"Titiqqaqutiup aaqqiksimaninga ikajuqsuqtaunngilaq.",
	"error.encodingFailed":
		"Titiqqait nalunaikkutangit uqalimaaqtaujunnalaunngilat.",
	"error.invalidObject": "Sanirvaktausimajuq sunakkutaaq atunngilaq.",
	"error.repairFailed": "Sapujjausimajuq sanajaujunnalaunngilaq.",
	"error.decisionExpired": "Tuksirautausimajuq isumaliurutaujuq aturunniirmat.",
	"error.decisionRequired":
		"Isumaliurutaujariaqaqpuq tamanna aulaniujuq kajusilaunnginningani.",
	"error.invalidDecision":
		"Taanna isumaliurutaujuq atuinnaunngilaq maannaujuq aulaniujumut.",
	"error.wrongObjectKind":
		"Niruaqtausimajuq titiqqaquti iluliqanngilaq niriugijaujumik qanuittuuninganik.",
	"error.invalidValue": "Titiraqtausimajuq qassiuninga atunngilaq.",
	"error.preconditionNotMet":
		"Aulaniujuq kajusititaujunnanngilaq maannaujuq qanuilinganiujumi.",
	"error.protectedObject":
		"Maanna atuqtaujuq sunakkutaaq asijjiqtaujunnangittuq piiqtaujunnangittuq.",
	"error.entityNotFound": "Tuksirautaujuq nanijaujunnalaunngilaq.",
	"error.unsupportedMediaType":
		"Niruaqtausimajuq titiqqaqutiup qanuittuuninga ikajuqtuqtaunngilaq.",
	"error.invalidResourceSource":
		"Ajjiliuqtausimajuq tunngavinga naammanngilaq.",
	"error.unsafeResourceSource":
		"Ajjiliuqtausimajuq qipiluktaulauqtuq attanajjaiqsimanirmut pijjutiqaqhluni.",
	"error.ruleSetInvalid":
		"Sanirvaktausimajut maligait aaqqiksimaniqanngimmata.",
	"error.fileNameInvalid": "Titiqqaqutiup atinga atunngilaq.",
	"error.savedDataUnreadable":
		"Sanirvaktausimajut tukisigiarutiksat uqalimaaqtaujunnalaunngilat.",
	"error.savedDataInvalidJson":
		"Sanirvaktausimajut tukisigiarutiksat iluliqanngilat naammaktunik JSON-nik.",
	"error.savedObjectInvalid": "Sanirvaktausimajuq aaqqiksimaniqanngilaq.",
	"error.savedObjectUnsupportedVersion":
		"Sanirvaktausimajuq sunakkutaaq aaqqiksimaninga ikajuqtuqtaunngilaq.",
	"error.savedObjectEncodingFailed":
		"Sanirvaktausimajuq nalunaikkutanga uqalimaaqtaujunnalaunngilaq.",
	"error.savedObjectProcessingFailed":
		"Sanirvaktausimajuq kamagijaujunnalaunngilaq.",
	"error.objectStoreMissing": "Niuvirvik nanijaujunnalaunngilaq.",
	"error.objectStoreUnreadable":
		"Tainna niuvirvik uqalimaaqtaujunnalaunngimmat.",
	"error.objectStoreInvalidJson":
		"Sunakkutaat niuvirvik iluliqanngilaq naammaktumik JSON-mik.",
	"error.objectStoreInvalid": "Tainna niuvirvik aaqqiksimaniqattianngimmat.",
	"error.objectStoreUnsupportedVersion":
		"Niuvirvik aaqqiksimaninga ikajuqtuqtaunngilaq.",
	"error.objectStoreEncodingFailed":
		"Niuvirviup nalunaikkutanga uqalimaaqtaujunnalaunngilaq.",
	"error.objectStoreProcessingFailed":
		"Tainna niuvirvik kamagijaujunnalaunngimmat.",
	"error.newFileMissing": "Nutaaq paippaaq pitaqanngimmat.",
	"error.incompleteWrite": "Pijariiqsimanngittuq sapujjisimanirmut aulaniujuq.",
	"error.ruleSetStoreInvalidJson":
		"Maligaq aaqqiktausimajuq niuvirvik iluliqanngilaq naammaktumik JSON-mik.",
	"error.ruleSetsUnreadable":
		"Sanirvaktausimajut maligait uqalimaaqtaujunnalaunngilat.",
	"error.ruleSetStoreInvalid":
		"Maligait aaqqiktausimajut niuvirvik aaqqiksimaniqattianngimmata.",
	"errorBoundary.eyebrow": "Tuksirauti tammaqsimajuq",
	"errorBoundary.title": "Takuksautittijunnalaunngilaq.",
	"errorBoundary.retry": "Uuktukkannirit",
	"success.imported.game":
		"Sanirvaktausimajuq pinnguagaq “{name}” tikititausimajuq.",
	"success.imported.template": "Aaqqiksimaninga “{name}” tikititausimajuq.",
	"success.imported.ruleSet":
		"Maligaq aaqqiktausimajuq “{name}” tikititausimajuq.",
	"success.imported.library": "Uqalimaagaqarvik tikititausimajuq.",
	"success.recovered.game": "Sapujjausimajuq pinnguagaq “{name}” utiqtitauvuq.",
	"success.recovered.template": "Aaqqiksimaninga “{name}” utiqtitauvuq.",
	"success.recovered.ruleSet":
		"Maligaq aaqqiktausimajuq “{name}” utiqtitauvuq.",
	"success.recovered.library": "Uqalimaagaqarvik utiqtitauvuq.",
	"success.restored.library":
		"Uqalimaagaqarvik utiqtitausimajuq nalliukkumaangujumik.",
	"success.repaired.game":
		"Sapujjausimajuq pinnguagaq “{name}” sanajausimajuq.",
	"success.repaired.template": "Aaqqiksimaninga “{name}” sanajausimajuq.",
	"success.repaired.ruleSet":
		"Maligaq aaqqiktausimajuq “{name}” sanajausimajuq.",
	"success.repaired.library": "Uqalimaagaqarvik sanajaugiaqtuq.",
	"repairReport.title": "Uqalimaagaqarvik sanajaukkanniqtuq",
	"repairReport.acceptedRuleSets": {
		plural: {
			one: "{count} maligaq aaqqiktausimajuq angiqtaulauqtuq.",
			two: "{count} maligait angiqtaulauqtut.",
			other: "{count} maligait angiqtaulauqtut.",
		},
	},
	"repairReport.removedRuleSets": "Piiqtausimajut maligait",
	"repairReport.removed.notAnObject":
		"Tuqquqtausimajuq maligaq titiraqsimajuq kisutuinnaunngilaq.",
	"repairReport.removed.repairFailed":
		"Maligaq aaqqittausimajuq aaqqittaujunnalaunngilaq.",
	"repairReport.change.missingStatusDefinitionAdded":
		"Maligaq aaqqiktausimajuq {ruleSetLabel}: ilajausimajuq pitaqanngittuq qanuilinganinganut tukinga “{status}”.",
	"repairReport.change.ruleSetUnknownFieldsRemoved":
		"Maligaq aaqqiktausimajuq {ruleSetLabel}: piiqtausimajut qaujimajaunngittut nalunaikkutait ({fields}).",
	"repairReport.change.teamUnknownFieldsRemoved":
		"Katujjiqatigiit {index} {ruleSetLabel}-mi: piijaqtausimajut qaujimajaunngittut nalunaikkutait ({fields}).",
	"repairReport.change.roleUnknownFieldsRemoved":
		"Piliriaksaq {index} {ruleSetLabel}-mi: piiqtausimajut qaujimajaunngittut nalunaikkutait ({fields}).",
	"repairReport.change.statusUnknownFieldsRemoved":
		"Qanuilinganinga {index} {ruleSetLabel}-mi: piiqtausimajut qaujimajaunngittut nalunaikkutait ({fields}).",
	"repairReport.change.ruleSetIdCollisionResolved":
		"Maligaq aaqqiktausimajuq {storedId}: asijjiqtaujuq kataktuq nalunaikkutaq “{newId}”-mut.",
	"repairReport.change.ruleSetsContainerReplaced":
		"Inangiqtausimajuq pitaqanngittuq uvvaluunniit atunngittuq ruleSetsById iluliqanngittumut puuksamut.",
	"repairReport.change.libraryUnknownFieldsRemoved":
		"Uqalimaagaqarvik: piiqtausimajut qaujimajaunngittut nalunaikkutait ({fields}).",
	"repairReport.change.insertedMissingQuote":
		"Ilisisimajuq pitaqanngittumik nalunaikkutarmik iqqanaijaamut {position}.",
	"repairReport.change.addedClosingBraces": {
		plural: {
			one: "Ilagiaqsijuq atausirmik pitaqanngittumik matusijjutimik.",
			two: "Ilajausimajut {count} pitaqanngittut matusijjutinik.",
			other: "Ilajausimajut {count} pitaqanngittut matusijjutit.",
		},
	},
	"repairReport.change.addedOpeningBraces": {
		plural: {
			one: "Ilagiaqsijuq atausirmik pitaqanngittumik matuiqsijjutimik.",
			two: "Ilajausimajut {count} pitaqanngittut matuiqsijjutinut savirajait.",
			other:
				"Ilajausimajut {count} pitaqanngittut matuiqsijjutinut savirajait.",
		},
	},
	"game.menu.open": "Matuingajuq pinnguarutinut nirijaksait",
	"game.menu.title": "Pinnguarutinut nirijaksait",
	"game.menu.actions": "Pinnguarniujut qanuiliurniujut",
	"game.menu.save": "Saputilugu pinnguarusiq",
	"game.menu.saveAs": "Sanirvailutit pinnguagarmik imanna",
	"game.menu.saveAsTemplate": "Sanirvaktauluni pinnguagaq uuktuutiuluni",
	"game.menu.exit": "Nuqqarlutit pinnguarniujumit",
	"game.menu.manageEntities":
		"Aulattiluni katujjiqatigiinik, piliriaksanik ammalu qanuilinganinginnik",
	"game.menu.randomizeRoles": "Tunisilutit piliriaksanik naliangnutuinnaq",
	"game.menu.shufflePlayers":
		"Naliannutuinnaq aaqqiksurlugit pinnguaqtiit iksivautangit", // This value isn't accurate translated, yet.
	"game.menu.rolesForShowing": "Piliriaksait takuksautitauniaqtut",
	"game.menu.showLog": "Takuksautittiluni titiraqsimajunik",
	"game.menu.settings": "Aaqqiksimaningit",
	"game.currentGame": "Maannaujuq pinnguarniujuq",
	"game.unlockSeatOrder": "Matuiqsiniq iksivautarnut tikisaijjutinik",
	"game.lockSeatOrder": "Kiiksimaluni iksivautaq tilisijjuti",
	"game.playerOverview": "Pinnguaqtiup nainaaqsimaninga",
	"game.seatOrder": "Iksivautait aaqqiksimaningit",
	"game.zoomControls": "Iksivautaq sirlaanga angigligiaqtauninga",
	"game.zoomOut": "Angilligiarlugu iksivautaup sirnaaqtinga",
	"game.zoomIn": "Angilligiarlugu iksivautaup sirnaaqtinga",
	"game.zoomLevel": "Angilligiaqtauningata quttingninga: {percent} pusanti",
	"game.showSeatCircle": "Takuksautittiluni iksivautaup sirnaaqtinganik",
	"game.showPlayerOverview":
		"Takuksautittiluni pinnguaqtiup nainaaqsimaninganik",
	"game.seatAccessible": "Iksivautaq {seat}{marker}",
	"game.sourceAndTargetSuffix": ", tunngavinga amma turaaganga",
	"game.sourceSuffix": ", Nakinngaarvik",
	"game.targetSuffix": ", Tikitaujumajuq",
	"game.deleteSeat": "Piirlugu iksivautaq {seat}",
	"game.addPlayerAfterSeat":
		"Ilaliutilugu pinnguaqti iksivautaup kinguniani {seat}",
	"game.flow": "Pinnguarniujut ingirraningit",
	"game.showRoles": "Takuksautittiluni piliriaksanik",
	"game.nightList": "Unnukkut titiraqsimajut",
	"game.seat": "Iksivautaq {seat}",
	"game.details": "Ilulingit",
	"game.actionsForSeat": "Qanuiliurutauniaqtut iksivautarmut {seat}",
	"game.deleteSelectedSeat": "Piirlugu niruaqtausimajuq iksivautaq {seat}",
	"game.addPlayerAfterSelectedSeat":
		"Ilaliutilugu pinnguaqti niruaqtaulauqtillugu iksivautaq {seat}",
	"game.restoreSplitView": "Utiqtillugu aviksimajuq takunnagaq",
	"game.showDetailsFullscreen":
		"Takuksautittiluni nalunaijaqsimajunik takuksaujulimaami",
	"game.manualSeat": "Iksivautaup naasautinga",
	"game.selectSeat": "Niruarlugu iksivautaq",
	"game.lifeState": "Inuusingata qanuilinganinga",
	"game.life.alive": "Uumaniq",
	"game.life.deadVoteAvailable": "Tuqungajuq – niruarunnarniq atuinnaujuq",
	"game.life.deadVoteSpent": "Tuqungajuq – niruarniujuq atuqtaujuq",
	"game.life.doubleDeadVoteAvailable":
		"Marruaqti tuqungajuq – niruarunnarniq atuinnaujuq",
	"game.life.doubleDeadVoteSpent":
		"Marruaqti tuqujuq – niruarniujuq atuqtaujuq",
	"game.life.aliveShort": "Uumaniq",
	"game.life.deadVoteAvailableShort": "Tuqungajuq · niruarniq atuinnaujuq",
	"game.life.deadVoteSpentShort": "Tuqungajuq · niruarniujuq atuqtaujuq",
	"game.life.doubleDeadVoteAvailableShort":
		"Marruaqti tuqungajuq · niruarniq atuinnaujuq",
	"game.life.doubleDeadVoteSpentShort":
		"Marruaqti tuqujuq · niruarniujuq atuqtaujuq",
	"game.noRole": "Piliriaksaqanngittuq",
	"game.team": "Piliriqatigiit",
	"game.rolesWithoutTeam": "Tapiriiqanngillutik",
	"game.role.actual": "Piliriallarik",
	"game.role.shown": "Takuksautittijuq piliriaksanganik",
	"game.role.night": "Unnukkut piliriaksaq",
	"game.role.claimed": "Pinasuaqtaujuq piliriaksaq",
	"game.statuses": "Qanuilinganingit",
	"game.status": "Qanuilinganinga",
	"game.statusDuration": "Unnuk {from}-{until}",
	"game.openEnded": "Matuinngaaqtuq",
	"game.newStatus": "Nutaaq qanuilinganinga",
	"game.deletePlayer": "Piirlugu pinnguaqti",
	"game.player": "Pinnguaqti",
	"game.selectPlayer": "Niruarlugu pinnguaqti ...",
	"game.addPlayer": "+ pinnguaqti",
	"game.deleteEmptySeat": "Piirlugu inuqanngittuq iksivautaq",
	"game.emptySeat": "Taanna iksivautaq inuqanngimmat.",
	"game.selectSeatPrompt": "Niruarlutit iksivautarmik.",
	"game.playerWithName": "Pinnguaqti: {name}",
	"game.deleteQuestion": "Piijaqtaujuq?",
	"game.newSeatAfter": "Nutaaq iksivautaq kinguniagut",
	"game.addQuestion": "Ilalugu?",
	"game.seatActionCancel": "Qujanaarniq",
	"game.unsavedTitle": "Pinnguagaq suli sanirvaktausimanngittuq.",
	"game.saveAndExit": "Sanirvailutit anilutillu pinnguarnirmik",
	"game.exitWithoutSaving": "Anilutit pinnguarniujumit sanirvainngillutit",
	"game.saveFailedTitle": "Titiqqaq sanirvaktaujunnalaunngilaq.",
	"game.targetExists": "Titiqqaq taimanna atilik pitaqariiqtuq.",
	"game.saveRecoveryQuestion":
		"Qanuiliurumavisi taiksumunga kajusittiangittumut?",
	"game.storageCommandInactive": "Tuqquivik tiliurutinga aturunniirmat.",
	"game.decideLater": "Isumaliuriniaqputit uattiarukkanniq",
	"game.setup": "Aaqqiksuiniq",
	"game.nightNumber": "Unnuk {number}",
	"game.dayNumber": "Ulluq {number}",
	"game.backToGame": "Utirluta pinnguarniujumut",
	"game.log.title": "Napaaqtuq",
	"game.log.empty": "Titiraqsimajuqanngilaq suli.",
	"game.log.timeAdvanced":
		"Siqinngujaq sivumuaksimajuq: {oldTime} → {newTime}.",
	"game.log.timeRewound":
		"Siqinngujaq utiqtitausimajuq: {oldTime} → {newTime}.",
	"game.log.lifeStateChanged":
		"Inuusingata qanuilinganinga {player}: {oldState} → {newState}.",
	"game.log.statusApplied":
		"Tuksirautausimajuq qanuilinganinga {status} tikillugu {player}.",
	"game.log.rolesDistributed": {
		plural: {
			one: "{count} piliriaksaq tuniuqqaqtaujuq naliangnutuinnaq.",
			two: "{count} piliriaksait tuniuqqaqtaujut naliangnutuinnaq.",
			other: "{count} piliriaksait tuniuqqaqtaujut naliangnutuinnaq.",
		},
	},
	"game.log.selectedRolesDistributed": {
		plural: {
			one: "{count} niruaqtausimajuq piliriaksaq tuniuqqaqtaujuq naliangnutuinnaq.",
			two: "{count} niruaqtausimajut piliriaksat tuniuqqaqtaujut naliangnutuinnaq.",
			other:
				"{count} niruaqtausimajut piliriaksat tuniuqqaqtaujut naliangnutuinnaq.",
		},
	},
	"game.log.seatMoved":
		"Nuutaulauqtuq pinnguaqti {playerName} iksivautanganik {fromSeat} iksivautanganut {toSeat}.",
	"game.log.seatsSwapped":
		"Tauqsiijuq iksivautaq {seatA} amma iksivautaq {seatB}.",
	"game.log.playerAppended":
		"Ilijausimajuq pinnguaqti {playerName} iksivautanganut {toSeat}.",
	"game.log.playerInserted":
		"Ilijausimajuq pinnguaqti {playerName} iksivautanganut {toSeat}.",
	"game.log.playerRemoved":
		"Piiqtaujuq pinnguaqti {playerName} iksivautanganik {fromSeat}.",
	"game.log.seatOrderChanged": "Iksivautait aaqqiksimaningit asijjiqtauvut.",
	"game.roleReveal.navigation": "Piliriaksaq saqqitauninga",
	"game.roleReveal.prompt":
		"Takuksautittiluni {player} (iksivautaq {seat}) piliriaksanganik. Naqillugu saqqittiniarlutit.",
	"game.overview.seat": "Iksivautaq",
	"game.overview.role": "Piliriaksat",
	"game.sourceAndTarget": "Tukisigiarvik/turaagaksaq",
	"game.source": "Nakinngaarvik",
	"game.target": "Tikitaujumajuq",
	"game.overview.playerAccessible": "{name}, iksivautaq {seat}{marker}",
	"game.overview.shownRole": "Takuksaujuq: {role}",
	"game.overview.nightRole": "Unnuk: {role}",
	"game.night.noActiveRoles": "Unnukkut qanuiliurniqtaqajjaangittuq unnuk.",
	"game.night.actionFor": "Qanuiliurutiksaq uvunga {player}",
	"game.night.action": "Piliriaq",
	"game.night.on": "Qaangani",
	"game.night.targetPlayer": "Turaagarijaujuq pinnguaqti",
	"game.night.noEffect": "Qanuiliurniujuq attuiniqalaunngilaq.",
	"game.night.execute": "Atuliqtitauninga",
	"game.night.kill": "Tuquttijuq",
	"game.night.resurrect": "Makitittijut",
	"game.action.kill": "Tuqutaujut",
	"game.action.resurrect": "Makitittiniq",
	"game.action.applyStatus": "Tuksirauti qanuilinganinga",
	"game.action.unknown":
		"Qaujimajaunngittuq qanuiliurniujuq (iluani nalunaikkutaq: {action})",
	"game.life.dead": "Tuqungajuq",
	"game.warning.playerNotFound": "Pinnguaqti “{playerId}” pitaqanngilaq.",
	"game.warning.statusNotFound": "Qanuilinganinga “{statusId}” pitaqanngittuq.",
	"game.warning.actorNotFound": "Pinnguaqti “{playerId}” pitaqanngilaq.",
	"game.warning.targetNotFound":
		"Turaagarijaujuq pinnguaqti “{playerId}” pitaqanngilaq.",
	"game.warning.actualRoleNotFound":
		"Nanisilaunngittut pinnguaqtimut “{playerId}”.",
	"game.warning.abilityAmbiguous":
		"Pijunnarnirijanga piliriaksaup “{roleName}” nalunaiqsimattianngilaq.",
	"game.warning.statusAmbiguous": "Qanuilinganinga tuksirautiup nalunaqtuq.",
	"game.warning.voteAlreadySpent": "Niruarniujuq atuqtaugiiqsimalirmat.",
	"game.warning.abilityNotAllowed":
		"Piliriaksaq “{roleName}” pijunnaqtittinngilaq qanuiliurutiksamik “{action}”.",
	"game.warning.statusNotAllowed":
		"Piliriaksaq “{roleName}” atuqtaujunnangittuq qanuilinganinganut “{statusId}”.",
	"game.statusEditor.title": "Aaqqigiarlugu qanuilinganinga",
	"game.statusEditor.status": "Qanuilinganinga",
	"game.statusEditor.fromNight": "Unnuanganit",
	"game.statusEditor.untilNight": "Unnuarusungningani",
	"game.statusEditor.note": "Ujjirijarialik",
	"game.playerName": "Pinnguaqtiup atinga",
	"recovery.kind.game": "Piulijausimajuq pinnguagaq",
	"recovery.kind.template": "Aaqqiksimaninga",
	"recovery.kind.ruleSet": "Maligait aaqqiktausimajut",
	"recovery.backupFile": "Nalliukkumaangujuq paippaaq",
	"recovery.temporaryFile": "Utiqtitaukainnaqtuq paippaaq",
	"recovery.incompleteSave":
		"Pijariiqsimanngittuq sapujjisimanirmut aulaniujuq",
	"recovery.openCount": "({count} matuingajuq)",
	"recovery.orphanedFile":
		"{recoveryFile} nanijaulauqtuq, kisiani tainna titiqqaq {kind}-mut pitaqanngimmat.",
	"recovery.twoFiles":
		"Pituqaq ammalu nutaangutuinnarialik titiqqaq nanijaulauqtuq {kind}-mut “{id}”.",
	"recovery.keepOld": "Titiqqaqutituqait pisimalugit",
	"recovery.keepNew": "Nutaanik titiqqanik pisimattilutit",
	"recovery.keepBothFiles": "Tamakkiik paippaaqutitit pisimalugit",
	"recovery.exportBrokenFile": "Aullaqtillugu suraksimajuq paippaaq",
	"recovery.decideLater": "Isumaliuriniaqputit uattiarukkanniq",
	"recovery.invalidObjectTitle": "Atunngittuq sanirvaktausimajuq nanijaujuq",
	"recovery.affectedObject": "Aktuqtaujuq piquti ({kind}): “{reference}”",
	"recovery.file": "Tuqquqsimajuq",
	"recovery.suggestedFileName": "Isumagijaujuq titiqqaqutiup atinga",
	"recovery.repairObject": "Aaqqigiaqtauluni piquti",
	"recovery.repairFileName": "Aaqqigiaqtaujuq titiqqaqutiup atinga",
	"recovery.exportObject": "Aullaqtittiniq kisutuinnarmik",
	"recovery.deleteObject": "Piijainiq kisutuinnarmik",
	"recovery.reason.invalidRuleSet":
		"Sanirvaktausimajut maligait aaqqiksimaniqanngimmata.",
	"recovery.reason.invalidFileName":
		"JSON paippaaq malinngilaq atiliurinirmut maliktaujariaqaqtunik.",
	"recovery.reason.decodeFailed": "Titiqqaq naqittaqtaujunnalaunngilaq.",
	"recovery.reason.invalidJson":
		"Titiqqaq iluliqanngilaq naammaktumik JSON-mik.",
	"recovery.reason.invalidTemplate": "JSON naammanngilaq aaqqiksimaniujuq.",
	"recovery.reason.invalidGame":
		"JSON sulinngilaq sanirvaktausimajuq pinnguagaq.",
	"recovery.rememberDecision":
		"Iqqaumalugu taanna isumaliurutaujuq ammalu aturlugu tammaqsimajulimaanut taimaittusainnarnut",
	"recovery.library.missing": "Uqalimaagaqarvik nanijaujunnalaunngilaq.",
	"recovery.library.orphanedTemporary":
		"Utiqtitaukainnaqtuq paippaaq nanijaulauqtuq, kisianili tainna turaangajuq uqalimaagaqarvik pitaqanngimmat.",
	"recovery.library.orphanedBackup":
		"Nanijaulauqtuq nalliukkumaaq, kisianili tainna turaangajuq uqalimaagaqarvik pitaqanngimmat.",
	"recovery.library.decodeFailed":
		"Uqalimaagaqarviup titiqqaqutingit naqittaqtaujunnalaunngilat.",
	"recovery.library.invalidJson":
		"Uqalimaagaqarviup titiqqaqutinga iluliqanngilaq naammaktumik JSON-mik.",
	"recovery.library.invalidRuleSet":
		"Uqalimaagaqarvik iluliqaqpuq atunngittunik maligarnik.",
	"recovery.library.invalidDocument": "JSON sulinngilaq uqalimaagaqarvik.",
	"recovery.library.title": "Uqalimaagaqarvik uqalimaaqtaujunnanngilaq",
	"recovery.library.restoreBackup": "Utiqtillugu nalliukkumaaq",
	"recovery.library.repair": "Aaqqigiarlugu uqalimaagaqarvik",
	"recovery.library.createEmpty":
		"Saqqittiluni nutaamik inuqanngittumik uqalimaagaqarvingmik",
	"recovery.library.export": "Aullaqtittiniq uqalimaagaqarvingmik",
	"rolesForShowing.title": "Piliriaksait takuksautitauniaqtut",
	"rolesForShowing.closePreview": "Matulugu sivurngagut",
	"rolesForShowing.freeText": "Akiqanngittuq titiraqsimajuq",
	"rolesForShowing.roles": "Piliriaksangit",
	"rolesForShowing.removeRole": "Piirlugu {name}",
	"rolesForShowing.empty": "Niruaqtausimanngittut suli.",
	"rolesForShowing.addRole": "+ piliriaksaq",
	"rolesForShowing.showSymbol":
		"Takuksautittiluni piliriaksaup nalunaikkutanganik",
	"rolesForShowing.preview": "Sivurngagut takunnagaksaq",
	"rolesForShowing.addRoleTitle": "Ilaliutilugu piliriaksaq",
	"roleDistribution.title": "Tunisilutit piliriaksanik naliangnutuinnaq",
	"roleDistribution.teamDistribution": "Tapiriit tuniuqqainingit",
	"roleDistribution.roleSelection": "Piliriaksanut niruarniq",
	"roleDistribution.type": "Piliriaksanik tuniuqqainirmut atuqtauvaktuq",
	"roleDistribution.random.title":
		"Tuniuqqailutit naliangnituinnaq piliriaksanik naliangnituinnaq",
	"roleDistribution.random.detail":
		"Aaqqiksilutit tapiriit angininginnik ammalu titiqtugarlutit piliriaksanik",
	"roleDistribution.selected.title":
		"Tuniuqqailutit niruaqtausimajunik piliriaksanik naliangnutuinnaq",
	"roleDistribution.selected.detail":
		"Niruarlugit nalunaiqtausimajut piliriaksat tunilugillu naliangnutuinnaq",
	"roleDistribution.manual.title": "Tunisilutit piliriaksanik aggakkut",
	"roleDistribution.manual.detail":
		"Tunisilutit piliriaksanik uattiarukkanniq pinnguarniujumi",
	"roleDistribution.overwriteRunning":
		"Pinnguarniq ingirraliriiqpuq. Maannaujuq takuksautittijut, takuksautittijut ammalu unnukkut piliriaksait titiraqtaukkannirniaqtut.",
	"roleDistribution.overwriteAssigned":
		"Piliriaksait tunijausimaliriiqtut titiraqtaukkannirniaqtut.",
	"roleDistribution.redistribute": "Tuniuqqaikkannirniq piliriaksanik",
	"roleDistribution.uniqueRoleMultiple":
		"Ajjiungittuq piliriaksaq niruaqtausimajuq atausiarnani",
	"roleDistribution.decrease": "Mikilligiaqtaujuq {name}",
	"roleDistribution.count": "Naasaqtaujut {name}-mut",
	"roleDistribution.increase": "Unuqsigiarutit {name}",
	"roleDistribution.freePlayers": "Tilijausimanngittut pinnguaqtiit",
	"roleDistribution.distribute": "Tuniuqqailuni piliriaksanik",
	"roleDistribution.error.teamHasNoRoles": {
		plural: {
			one: "Role distribution failed: {count} player was requested for team “{teamName}”, but the team has no roles.",
			two: "Role distribution failed: {count} players were requested for team “{teamName}”, but the team has no roles.",
			other:
				"Role distribution failed: {count} players were requested for team “{teamName}”, but the team has no roles.",
		},
	}, // This value isn't accurate translated, yet.
	"roleDistribution.error.insufficientDistinctRoles": {
		plural: {
			one: "ᐱᓕᕆᐊᒃᓴᑦ ᑐᓂᐅᖅᑲᖅᑕᐅᓂᖏᑦ ᑲᔪᓯᑦᑎᐊᓚᐅᙱᓚᑦ: {requestedCount} ᐱᙳᐊᖅᑏᑦ ᑐᒃᓯᕋᖅᑕᐅᓚᐅᖅᐳᑦ ᑕᐱᕇᓄᑦ “{teamName}”, ᑭᓯᐊᓂ {count} ᑭᓯᐊᓂ ᐊᔾᔨᐅᙱᑦᑐᒥᒃ ᐱᓕᕆᐊᒃᓴᖅᑕᖃᖅᐳᖅ ᐊᒻᒪ ᑕᐃᒪᐃᒃᑲᓐᓂᕈᓐᓇᖅᑐᒥᒃ ᐱᓕᕆᐊᒃᓴᖅᑕᖃᙱᓚᖅ.",
			two: "ᐱᓕᕆᐊᒃᓴᑦ ᑐᓂᐅᖅᑲᖅᑕᐅᓂᖏᑦ ᑲᔪᓯᑦᑎᐊᓚᐅᙱᓚᑦ: {requestedCount} ᐱᙳᐊᖅᑏᑦ ᑐᒃᓯᕋᖅᑕᐅᓚᐅᖅᐳᑦ ᑕᐱᕇᓄᑦ “{teamName}”, ᑭᓯᐊᓂ {count}-ᑐᐃᓐᓇᐅᕗᑦ ᐊᔾᔨᒌᙱᑦᑐᑦ ᐱᓕᕆᐊᒃᓴᑦ ᐊᒻᒪ ᑕᐃᒪᐃᒃᑲᓐᓂᕈᓐᓇᖅᑐᒥᒃ ᐱᓕᕆᐊᒃᓴᖅᑕᖃᙱᓚᖅ.",
			other:
				"ᐱᓕᕆᐊᒃᓴᑦ ᑐᓂᐅᖅᑲᖅᑕᐅᓂᖏᑦ ᑲᔪᓯᑦᑎᐊᓚᐅᙱᓚᑦ: {requestedCount} ᐱᙳᐊᖅᑏᑦ ᑐᒃᓯᕋᖅᑕᐅᓚᐅᖅᐳᑦ ᑕᐱᕇᓄᑦ “{teamName}”, ᑭᓯᐊᓂ {count}-ᑐᐃᓐᓇᐅᕗᑦ ᐊᔾᔨᒌᙱᑦᑐᑦ ᐱᓕᕆᐊᒃᓴᑦ ᐊᒻᒪ ᑕᐃᒪᐃᒃᑲᓐᓂᕈᓐᓇᖅᑐᒥᒃ ᐱᓕᕆᐊᒃᓴᖅᑕᖃᙱᓚᖅ.",
		},
	},
	"scenarioEditor.objectType": "Piqutiup qanuittuuninga",
	"scenarioEditor.teams": "Tapiriit",
	"scenarioEditor.roles": "Piliriaksangit",
	"scenarioEditor.players": "Pinnguaqtiit",
	"scenarioEditor.statuses": "Qanuilinganingit",
	"scenarioEditor.readingDetails": "Uqalimaarniq nalunaijaqsimajunik ...",
	"scenarioEditor.create": "+ saqqittiluni",
	"scenarioEditor.new.teams": "Nutaat tapiriit",
	"scenarioEditor.new.roles": "Nutaaq piliriaksaq",
	"scenarioEditor.new.players": "Nutaaq pinnguaqti",
	"scenarioEditor.new.statuses": "Nutaaq qanuilinganinga",
	"scenarioEditor.saveChange": "Sanirvailutit asijjiqtaujunik",
	"scenarioEditor.saveAsNewRuleSet":
		"Sanirvaktauluni asijjiqtaujuq nutaanguluni maligaq aaqqiktausimajuq",
	"scenarioEditor.saveAsNewTemplate":
		"Sanirvaktauluni asijjiqtaujuq nutaanguluni aaqqiksimaninga",
	"scenarioEditor.newGameWithRuleSet":
		"Nutaaq pinnguagaq taassuminga maligaqarluni",
	"scenarioEditor.newGameFromTemplate":
		"Nutaaq pinnguagaq tavvanngat aaqqiksimaniujumik",
	"scenarioEditor.saveCopy": "Sanirvaktauluni ajjinganut",
	"scenarioEditor.unsavedChanges":
		"Asijjiqtausimajut suli sanirvaktausimanngilat.",
	"scenarioEditor.unsavedRuleSet": "Maligait suli sanirvaqtausimanngilat.",
	"scenarioEditor.unsavedTemplate":
		"Aaqqiksimaninga suli sanirvaktausimanngilaq.",
	"scenarioEditor.saveAndContinue": "Sanirvailutit kajusilutillu", // This value isn't accurate translated, yet.
	"scenarioEditor.continueWithoutSaving": "Kajusilutit sanirvainngillutit",
	"scenarioEditor.saveAndExit": "Sanirvailutit anilutillu",
	"scenarioEditor.exitWithoutSaving": "Anilutit sanirvainngillutit",
	"scenarioEditor.editDetails": "Aaqqigiarlugit nalunaijaqsimajut",
	"scenarioEditor.closeDetails": "Matulugu nalunaijaqsimajuq takunnagaq",
	"scenarioEditor.displayName": "Takuksautittijuq atinga ({language})",
	"scenarioEditor.teamOrder": "Tapiriit tikisainingit",
	"scenarioEditor.defaultDuration":
		"Aaqqiksimanirijanga akuniuninga unnukkut (0 = isuqanngittuq)",
	"scenarioEditor.team": "Piliriqatigiit",
	"scenarioEditor.firstNightOrder": "Tikisailutit sivulliqpaami unnungani",
	"scenarioEditor.otherNightOrder": "Tikisainiq tugliani unnuangani",
	"scenarioEditor.unique": "Ajjiunngittuq?",
	"scenarioEditor.activeAbilities": "Pilirijunnarniq",
	"scenarioEditor.canKill": "Tuquttijunnaqtuq",
	"scenarioEditor.canResurrect": "Uummaqtittijunnaqtuq",
	"scenarioEditor.canApplyStatuses": "Tuksirarunnaqtut qanuilinganinginnik",
	"scenarioEditor.noStatuses": "Qanuilinganingit nalunaiqtausimanngittut suli.",
	"scenarioEditor.unicodeSymbol": "Unikut nalunaikkutaq",
	"scenarioEditor.unicodePreview": "Unicode sivurngagut",
	"scenarioEditor.useColor": "Aturlugu amianga",
	"scenarioEditor.editColor": "Aaqqigiarlugu amianga",
	"scenarioEditor.colorPickerTitle": "Niruarlugu amianga",
	"scenarioEditor.colorCode": "RGB sisamalik nalunaikkutaq",
	"scenarioEditor.colorPreview": "Amianga sivurngagut",
	"scenarioEditor.apply": "Ilisiniq",
	"scenarioEditor.deleteQuestion": "Piiqsillarikpiit “{name}”?",
	"scenarioEditor.workingCopy": "Piliriangujuq ajjinga",
	"app.closeError": "Matulugu tammaqsimajuq tusagaksaq",
	"app.exited": "Qaritaujakkut tuksirauti anisimaliqtuq.",
	"app.restart": "Pigiakkannirlugu qaritaujakkut tuksirauti",
	"appError.checkFiles": "Titiqqait qaujisaqtaujunnalaunngilat.",
	"appError.settingsUpdate": "Aaqqiksimaningit asijjiqtaujunnalaunngilat.",
	"appError.settingsOpen": "Aaqqiksimaningit matuiqtaujunnalaunngilat.",
	"appError.continueLastGame":
		"Kingulliqpaami pinnguarniujuq kajusititaujunnalaunngilaq.",
	"appError.continueGame": "Pinnguarniq kajusititaujunnalaunngilaq.",
	"appError.openPreparedGame":
		"Parnaktausimajuq pinnguarniujuq matuiqtaujunnalaunngilaq.",
	"appError.restoreOldFile": "Titiqqaqutituqaq utiqtitaujunnalaunngilaq.",
	"appError.retryStorageCommand":
		"Tuqquivik tiliurutinga uuktuqtaukkannirunnanngilaq.",
	"appError.finishStorageCommand":
		"Tuqquivik tiliurutinga pijariiqtaujunnanngilaq.",
	"appError.continueStorageCommand": "Tuqquivik kajusititaujunnanngilaq.",
	"appError.saveGamesUnavailable":
		"Sanirvaktausimajut pinnguarutiit sanirvaktaujunnanngilat.",
	"appError.saveTemplatesUnavailable":
		"Aaqqiksimaningit sanirvaktaujunnanngilat.",
	"appError.changeSeatOrder":
		"Iksivautait aaqqiksimaningit asijjiqtaujunnalaunngilat.",
	"appError.savePlayer": "Pinnguaqti sapujjaujunnalaunngilaq.",
	"appError.deleteEmptySeat":
		"Inuqanngittuq iksivautaq piiqtaujunnalaunngilaq.",
	"appError.deletePlayer": "Pinnguaqti piiqtaujunnalaunngilaq.",
	"appError.advanceTime": "Pinnguarniujuq sivumuaqtaujunnalaunngilaq.",
	"appError.rewindTime": "Pinnguarniujuq utiqtitaujunnalaunngilaq.",
	"appError.applyGameChanges":
		"Pinnguarutiit asijjiqtauningit atuqtaujunnalaunngilat.",
	"appError.distributeRoles": "Piliriaksait tuniuqqaqtaujunnalaunngilat.",
	"startup.initializeFiles":
		"Qaritaujakkut titiqqaqutingit pigiaqtitaujunnalaunngilat.",
	"startup.repairFileNames":
		"Iluani titiqqait atingit aaqqiktaujunnalaunngilat.",
	"startup.loadSettings":
		"Aaqqiksimaningit qaritaujarmut ilijaujunnalaunngilat. Aaqqiksimaningit atuqtauniaqtut.",
	"startup.rootMissing":
		"HTML-nguniraqtaujuq nalunaikkutalik “root” pitaqanngimmat.",
} satisfies Record<GuiTranslationKey, GuiTranslationMessage>;
