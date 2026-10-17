import {archiveBackup,readArchiveBackup} from './archive-backup.mjs?v=3.0-r4.14';
import {createCartoons} from './dfc-reader.mjs?v=3.0-r4.20';
import * as API from './api-client.mjs?v=3.0-r4.11';
import {verifyEnhancementBackup} from './enhancement-backup.mjs?v=3.0-r4.11';
import {createEnhancementClient} from './enhancement-client.mjs?v=3.0-r4.11';
import {readEnhancementSettings,writeEnhancementSettings} from './enhancement-settings.mjs?v=3.0-r4.11';
import {createSyncEngine} from './sync.mjs?v=3.0-r4.17';
import {orderedGallery} from './gallery-order.mjs?v=3.0-r4.17';
import { SCHEMA, MAX_BYTES, MAX_PIXELS, MAX_ORIGINALS, RATIOS, sha256, opposite, orientation, geometry, deviceOrientation, selectAsset, sniff, headerSize, transition, publicManifest, checkPair, comparisonEligibility, blindOrder, csv, canonicalMode, comparisonRubric, taskGeometry, verifiedFourK } from './core.mjs?v=3.0-r4.11';
import { getPairs, putPair, updatePair, removePair, getScores, addScore, prepareForUpdate, cancelUpdatePreparation, storageEstimate, getStoredBlob, hydratePair, hasStoredBlobs, setStorageOwner, storageOwner, captureStorageScope } from './store.mjs?v=3.0-r4.11';
import { createImageLoader } from './image-loader.mjs?v=3.0-r4.15';
import { readSettings, writeSettings, DEFAULT_SETTINGS, DEFAULT_ENABLED_MODELS, orientationTransition, estimateHydrationSafety, readModelHealth, recordModelHealth, remoteTransferBytes } from './settings.mjs?v=3.0-r3';
import { adjacentImageIndices, syncImageCache } from './image-cache.mjs?v=3.0-r1';
import { normalizedImage, demoFixture, mockExpand, baseline, toBlob, verifySavedProtectedPixels } from './mock.mjs?v=3.0-r4.11';
import { MODELS, modelFor, supportsMode } from './models.mjs?v=3.0-r4.11';
import { loadReferenceGallery, verifyReferenceAsset } from './showcase.mjs?v=3.0-r4';
import { jobIdempotencyKey, gatewayStateAction, liveModelAvailable } from './jobs.mjs?v=3.0-r4.11';
import { collectOrientationAssets, zipStore } from './zip-store.mjs?v=3.0-r4.1';

const $ = id => document.getElementById(id);
const dictionary = {
  en: {
    skip:'Skip to workspace',installApp:'Install',pwaTitle:'Install DualFrame Photos',pwaDescription:'Your original images and pairs stay in this browser. The app shell, local gallery and demo work offline after first load. Image generation, cloud Sync and the remote Nara reference gallery need internet.',pwaInstallHelp:'On iPhone or iPad, open this page in Safari and choose Share → Add to Home Screen. On Android or desktop, use Install or your browser menu. Your local gallery stays on this device; Sync is needed to move images between devices.',pwaClose:'Close',pwaPreparing:'Preparing the offline app shell…',pwaReady:'Offline app shell is ready.',pwaUnavailable:'Offline install is unavailable in this browser or context.',pwaOffline:'Offline app shell is ready. Image generation, Sync and remote references need internet.',pwaInstallAccepted:'DualFrame Photos is installed.',pwaUpdateReady:'An update is ready. The app will wait until you choose Save & update.',pwaOtherUpdate:'Another tab activated the update. This tab stays open until you choose Save & update.',pwaUpdateAction:'Save & update',pwaUpdateBusy:'An image job is still running. Wait for it to finish, then retry.',pwaNoUpdate:'No new update is waiting.',pwaUpdateUnavailable:'The update could not be activated. Your saved images are unchanged.',referenceOffline:'The reference gallery needs internet. Your local images remain available.',localOnly:'Private · on this device',eyebrow:'ONE ORIGINAL. ROOM FOR BOTH WORLDS.',headline1:'A wider view.',headline2:'A different frame.',intro:'Turn one image into a portrait and a landscape pair. Keep the original, explore new surroundings, then compare without the labels.',addOriginal:'＋ Add an original',tryDemo:'Try the demo ↗',demoDisclosure:'The demo simulates canvas expansion. It does not generate AI scenery.',sameIdentity:'Two frames. One identity.',creationGallery:'Creation gallery',comparisonLab:'Blind comparison lab',yourSource:'Your original',dropTitle:'Drop an image here',dropSubtitle:'or choose a file · PNG, JPEG, WebP',uploadLimit:'Up to 12 MB · 24 megapixels · 100 originals',localNotice:'Originals stay in this browser. Nothing is uploaded until you connect a private gateway and explicitly consent.',copyHash:'Copy original SHA-256',composition:'Composition',mode:'Expansion mode',faithful:'Faithful · preserve original pixels',cinematic:'Cinematic · creative reconstruction',faithfulNote:'The normalized original is composited back at native size. New regions may have visible seams.',cinematicNote:'Creative reconstruction can alter surroundings and placement. It cannot recover unseen reality. Demo mode remains a simulation.',placement:'Placement',center:'Center',left:'Left',right:'Right',top:'Top',bottom:'Bottom',seed:'Seed',prompt:'Scene direction (optional)',pipeline:'Pipeline',simulation:'Demo · local deterministic simulation',briaGateway:'Bria · private gateway',gatewayUrl:'Gateway URL',invite:'Invite token',connect:'Check gateway',consent:'I own this image and consent to Bria processing. Hosted results normally expire after 3 days; account-specific terms apply.',createOpposite:'Create the other frame ↗',selectFirst:'Choose an original to begin.',pairedGallery:'Your paired gallery',galleryHelp:'Accept a preview to add its second composition.',previewDevice:'Preview',thisDevice:'This device',desktop:'Desktop · landscape',phoneP:'Phone · portrait',phoneL:'Phone · landscape',emptyTitle:'Every frame starts with an original.',emptyBody:'Add your first image, or explore the two synthetic demo fixtures.',queue:'Preview & job queue',noJobs:'Your expansion jobs will appear here.',provenanceTitle:'Provenance, backup & privacy',provenanceBody:'AI regions are disclosed in metadata; the camera did not capture them. HD and 4K are separate assets. Browser storage can be cleared by the browser: download originals, variants and sidecars to keep them.',exportManifests:'Export manifests',backup:'Export private backup',restore:'Restore backup',ownership:'Concept: Bojan Dobrečevič (BD) · Built with GPT Work · v1.0 LAB',reviewEyebrow:'SAME SOURCE. EQUAL SCALE. HIDDEN LABELS.',reviewTitle:'Let the images speak first.',reviewIntro:'Import the two outputs and their provenance sidecars. Unknown sources remain illustrative and never enter the controlled aggregate.',exportJson:'Export JSON',exportCsv:'Export CSV',chooseOriginal:'Choose original',importWeb:'Import web AI output',importReference:'Import GPT Work reference',importSidecar:'Import source sidecar JSON',beginBlind:'Begin blind review ↗',sidecarHelp:'Sidecar: kind (web/reference), source_sha256, output_sha256, direction, target_ratio, provider, model_or_version and review_scale_policy. A hash-matched sidecar is an uploader provenance declaration.',compareEmpty:'Ready for your originals.',compareEmptyBody:'An accepted demo plus an imported reference can exercise the review flow. It will remain an illustrative comparison.',view:'View',sideBySide:'Side by side',zoom:'Shared zoom',original:'Original',baseline:'Deterministic control · contain / center crop',contain:'Contain',crop:'Center crop',rateTitle:'Review before revealing',scoreHelp:'1 = poor · 5 = excellent. Scores lock when submitted.',preference:'Overall preference',tie:'Tie',reviewNote:'Failure cases / observations',submitReveal:'Lock score & reveal ↗',footer:'Your original stays yours. Generated surroundings are an interpretation.',autoFrame:'Auto frame',autoQuality:'Auto · DPR',showRegions:'Show added regions',downloadOriginal:'↓ Original',downloadL:'↓ Landscape (all)',downloadP:'↓ Portrait (all)',zipDone:'Downloaded all saved variants in one ZIP.',zipEmpty:'No saved variants are available for this orientation.',zipTooLarge:'The saved variants exceed the standard ZIP limit (4 GB).',zipFailed:'Could not build a ZIP from the saved images.',downloadSidecar:'↓ Sidecar',useSource:'Use as source',viewPair:'View pair',delete:'Delete',accept:'Accept',reject:'Reject',regenerate:'Regenerate',cancel:'Cancel',resume:'Resume',candidate:'Preview awaiting acceptance',added:'Original added privately.',duplicate:'This exact original is already in your gallery.',accepted:'Composition accepted.',rejected:'Preview rejected; original retained.',deleted:'Local pair deleted.',missing:'Requested variant unavailable · showing available source/HD.',copied:'Original hash copied.',held:'LIVE_PROVIDER_HELD · no verified gateway entitlement.',connected:'Gateway connected.',paused:'Job safely paused. Connect the same private gateway to resume.',unknown:'Unknown source',ready:'Ready',pairCount:'pairs',sourceOnly:'Original only',paired:'Paired',target:'Opposite target',demo:'DEMO · not AI',sourceVerified:'SOURCE_VERIFIED · hash-bound declaration',illustrative:'ILLUSTRATIVE_ONLY · excluded from controlled score',identity:'Subject identity',seams:'Artifacts / seams',naturalness:'Natural surroundings',subjectSize:'Useful subject size',quality:'Overall quality',scoreLocked:'Score locked. Providers revealed below.',scores:'reviews',eligible:'controlled',sourceHash:'Original SHA-256',regionNote:'Outline = preserved source. Tinted area = added surroundings.',imported:'Output imported. Attach its matching sidecar before a controlled review.',badSidecar:'Sidecar does not bind the exact imported output and original.',missingCompare:'Accept or import a web output and import a GPT Work reference first.',backupDone:'Private backup exported. It contains your images.',restored:'Backup restored and hashes verified.',saved:'Saved locally',localRetention:'Local only · browser storage',failed:'Failed',promptPlaceholder:'Continue the light, atmosphere and environment…',unavailable4k:'4K not available. No upscaling was performed.',jobRunning:'Job in progress',timeout:'Gateway timed out. Retry/resume uses the same job ID.',checkGateway:'Connect and consent first.',boundaryUnavailable:'Source boundary is available for generated variants with known placement.',deleteConfirm:'Delete this image and its saved variants from your gallery and this device? Download a backup first if you want to keep them.',errorGeneric:'Operation failed. Your existing images are retained.',ILLUSTRATIVE_ONLY:'Illustrative only',SOURCE_VERIFIED:'Source verified',PENDING:'Pending',RUNNING:'Running',READY:'Ready',FAILED:'Failed',HELD:'Held',CANCELLED:'Cancelled',ACCEPTED:'Accepted',REJECTED:'Rejected',SIZE_LIMIT:'Image exceeds 12 MB.',IMAGE_PIXEL_LIMIT:'Image exceeds the pixel limit.',CANVAS_PIXEL_LIMIT:'Preserving this original would exceed the canvas pixel limit.',UNSUPPORTED_OR_CORRUPT:'Unsupported or corrupt image. Use a valid JPEG, PNG or WebP.',STORAGE_UNAVAILABLE:'Private browser storage is unavailable.',STORAGE_QUOTA_OR_FAILURE:'Browser storage is full or unavailable. Export a backup and free space.',PAIR_LIMIT:'The LAB holds at most 100 originals.',INVALID_SEED:'Seed must be an integer from 0 to 2147483647.',INVALID_BACKUP:'Backup failed validation; no images were imported.',BACKUP_LIMIT:'Backup exceeds 64 MB. Download individual originals and compositions instead.'
  },
  sl: {
    skip:'Preskoči na delovno površino',installApp:'Namesti',pwaTitle:'Namesti DualFrame Photos',pwaDescription:'Izvirniki in pari slik ostanejo v tem brskalniku. Po prvem nalaganju brez povezave delujejo lupina aplikacije, lokalna galerija in demo. Ustvarjanje slik, oblak Sync in oddaljena referenčna galerija Nara potrebujejo internet.',pwaInstallHelp:'Na iPhonu ali iPadu odpri stran v Safariju in izberi Deli → Dodaj na začetni zaslon. V Androidu ali računalniku uporabi Namesti ali meni brskalnika. Lokalna galerija ostane v tej napravi; Sync prenese slike med napravami.',pwaClose:'Zapri',pwaPreparing:'Pripravljam paket aplikacije za uporabo brez povezave …',pwaReady:'Paket aplikacije za uporabo brez povezave je pripravljen.',pwaUnavailable:'Namestitev brez povezave v tem brskalniku ali načinu ni na voljo.',pwaOffline:'Paket aplikacije je pripravljen. Ustvarjanje slik, Sync in oddaljene reference potrebujejo internet.',pwaInstallAccepted:'DualFrame Photos je nameščen.',pwaUpdateReady:'Na voljo je posodobitev. Aplikacija počaka, da izbereš Shrani in posodobi.',pwaOtherUpdate:'Drug zavihek je aktiviral posodobitev. Ta zavihek ostane odprt, dokler ne izbereš Shrani in posodobi.',pwaUpdateAction:'Shrani in posodobi',pwaUpdateBusy:'Ustvarjanje slike še poteka. Počakaj na konec in poskusi znova.',pwaNoUpdate:'Nobena nova posodobitev ne čaka.',pwaUpdateUnavailable:'Posodobitve ni bilo mogoče aktivirati. Shranjene slike so ostale nespremenjene.',referenceOffline:'Referenčna galerija potrebuje internet. Lokalne slike so še vedno na voljo.',localOnly:'Zasebno · v tej napravi',eyebrow:'EN IZVIRNIK. PROSTOR ZA OBA SVETOVA.',headline1:'Širši pogled.',headline2:'Drugačen okvir.',intro:'Iz ene slike ustvari pokončno in ležečo kompozicijo. Ohrani izvirnik, razišči novo okolico in nato primerjaj brez oznak ponudnikov.',addOriginal:'＋ Dodaj izvirnik',tryDemo:'Preizkusi demo ↗',demoDisclosure:'Demo simulira razširitev platna. Ne ustvarja AI okolice.',sameIdentity:'Dva okvirja. Ena identiteta.',creationGallery:'Ustvarjalna galerija',comparisonLab:'Laboratorij slepe primerjave',yourSource:'Tvoj izvirnik',dropTitle:'Spusti sliko sem',dropSubtitle:'ali izberi datoteko · PNG, JPEG, WebP',uploadLimit:'Do 12 MB · 24 megapikslov · 100 izvirnikov',localNotice:'Izvirniki ostanejo v tem brskalniku. Prenos se začne šele po povezavi zasebnega strežnika in izrecnem soglasju.',copyHash:'Kopiraj SHA-256 izvirnika',composition:'Kompozicija',mode:'Način razširitve',faithful:'Zvesto · ohrani izvirne piksle',cinematic:'Filmsko · ustvarjalna rekonstrukcija',faithfulNote:'Normalizirani izvirnik se vstavi nazaj v izvirni velikosti. Robovi nove okolice so lahko vidni.',cinematicNote:'Ustvarjalna rekonstrukcija lahko spremeni okolico in postavitev. Ne obnovi nevidene resničnosti. Demo ostane simulacija.',placement:'Postavitev',center:'Sredina',left:'Levo',right:'Desno',top:'Zgoraj',bottom:'Spodaj',seed:'Seme',prompt:'Usmeritev prizora (neobvezno)',pipeline:'Izvedba',simulation:'Demo · lokalna deterministična simulacija',briaGateway:'Bria · zasebni strežnik',gatewayUrl:'URL strežnika',invite:'Vstopni žeton',connect:'Preveri strežnik',consent:'Slika je moja in dovoljujem obdelavo pri Bria. Gostovani rezultati običajno potečejo po 3 dneh; veljajo pogoji računa.',createOpposite:'Ustvari drugi okvir ↗',selectFirst:'Za začetek izberi izvirnik.',pairedGallery:'Tvoja galerija parov',galleryHelp:'Potrdi predogled, da dodaš drugo kompozicijo.',previewDevice:'Predogled',thisDevice:'Ta naprava',desktop:'Računalnik · ležeče',phoneP:'Telefon · pokončno',phoneL:'Telefon · ležeče',emptyTitle:'Vsak okvir se začne z izvirnikom.',emptyBody:'Dodaj prvo sliko ali preizkusi dva sintetična demo vzorca.',queue:'Predogledi in opravila',noJobs:'Tukaj se bodo prikazala opravila razširitve.',provenanceTitle:'Izvor, varnostna kopija in zasebnost',provenanceBody:'AI območja so označena v metapodatkih; kamera jih ni zajela. HD in 4K sta ločeni datoteki. Brskalnik lahko izbriše lokalno hrambo: prenesi izvirnike, različice in spremne zapise.',exportManifests:'Izvozi manifeste',backup:'Izvozi zasebno kopijo',restore:'Obnovi kopijo',ownership:'Zamisel: Bojan Dobrečevič (BD) · Izvedba z GPT Work · v1.0 LAB',reviewEyebrow:'ISTI VIR. ENAKO MERILO. SKRITE OZNAKE.',reviewTitle:'Najprej naj spregovorijo slike.',reviewIntro:'Uvozi oba rezultata in spremna zapisa o izvoru. Neznani viri ostanejo ilustrativni in se ne vključijo v nadzorovano skupno oceno.',exportJson:'Izvozi JSON',exportCsv:'Izvozi CSV',chooseOriginal:'Izberi izvirnik',importWeb:'Uvozi rezultat spletne AI',importReference:'Uvozi referenco GPT Work',importSidecar:'Uvozi spremni JSON',beginBlind:'Začni slepi pregled ↗',sidecarHelp:'Spremni zapis: kind (web/reference), source_sha256, output_sha256, direction, target_ratio, provider, model_or_version in review_scale_policy. Ujemajoči se hashi potrjujejo izjavo o izvoru, ki jo poda uporabnik.',compareEmpty:'Pripravljeno za tvoje izvirnike.',compareEmptyBody:'Potrjeni demo in uvožena referenca omogočata preizkus postopka. Primerjava ostane ilustrativna.',view:'Pogled',sideBySide:'Drug ob drugem',zoom:'Skupna povečava',original:'Izvirnik',baseline:'Deterministična kontrola · umestitev / sredinski izrez',contain:'Umestitev brez izreza',crop:'Sredinski izrez',rateTitle:'Oceni pred razkritjem',scoreHelp:'1 = slabo · 5 = odlično. Ocene se ob oddaji zaklenejo.',preference:'Celotna prednost',tie:'Izenačeno',reviewNote:'Napake in opažanja',submitReveal:'Zakleni oceno in razkrij ↗',footer:'Tvoj izvirnik ostane tvoj. Ustvarjena okolica je interpretacija.',autoFrame:'Samodejni okvir',autoQuality:'Samodejno · DPR',showRegions:'Prikaži dodana območja',downloadOriginal:'↓ Izvirnik',downloadL:'↓ Ležeče (vse)',downloadP:'↓ Pokončno (vse)',zipDone:'Vse shranjene različice so prenesene v eni ZIP-datoteki.',zipEmpty:'Za to usmeritev ni shranjenih različic.',zipTooLarge:'Različice presegajo omejitev standardnega ZIP-a (4 GB).',zipFailed:'ZIP-a iz shranjenih slik ni bilo mogoče pripraviti.',downloadSidecar:'↓ Spremni zapis',useSource:'Uporabi kot vir',viewPair:'Ogled para',delete:'Izbriši',accept:'Potrdi',reject:'Zavrni',regenerate:'Ponovno ustvari',cancel:'Prekliči',resume:'Nadaljuj',candidate:'Predogled čaka potrditev',added:'Izvirnik je dodan zasebno.',duplicate:'Ta izvirnik je že v tvoji galeriji.',accepted:'Kompozicija je potrjena.',rejected:'Predogled je zavrnjen; izvirnik ostane.',deleted:'Lokalni par je izbrisan.',missing:'Želena različica manjka · prikazan je razpoložljivi vir/HD.',copied:'Hash izvirnika je kopiran.',held:'LIVE_PROVIDER_HELD · ni preverjenih pogojev za AI klic.',connected:'Strežnik je povezan.',paused:'Opravilo je varno zadržano. Poveži isti zasebni strežnik za nadaljevanje.',unknown:'Neznani izvor',ready:'Pripravljeno',pairCount:'parov',sourceOnly:'Samo izvirnik',paired:'Par',target:'Drugi okvir',demo:'DEMO · ni AI',sourceVerified:'SOURCE_VERIFIED · izjava vezana na hash',illustrative:'ILLUSTRATIVE_ONLY · izključeno iz nadzorovane ocene',identity:'Identiteta osebe',seams:'Artefakti in robovi',naturalness:'Naravna okolica',subjectSize:'Uporabna velikost motiva',quality:'Celotna kakovost',scoreLocked:'Ocena je zaklenjena. Ponudnika sta razkrita spodaj.',scores:'pregledov',eligible:'nadzorovanih',sourceHash:'SHA-256 izvirnika',regionNote:'Obris = ohranjeni vir. Obarvano = dodana okolica.',imported:'Rezultat je uvožen. Pred nadzorovano primerjavo dodaj ujemajoči se spremni zapis.',badSidecar:'Spremni zapis ni vezan na ta rezultat in ta izvirnik.',missingCompare:'Najprej potrdi ali uvozi spletni rezultat in uvozi referenco GPT Work.',backupDone:'Zasebna kopija je izvožena. Vsebuje tvoje slike.',restored:'Kopija je obnovljena; hashi so preverjeni.',saved:'Shranjeno lokalno',localRetention:'Lokalno · hramba brskalnika',failed:'Napaka',promptPlaceholder:'Nadaljuj svetlobo, vzdušje in okolico…',unavailable4k:'4K ni na voljo. Povečava ni bila izvedena.',jobRunning:'Opravilo poteka',timeout:'Strežnik se ni odzval pravočasno. Nadaljevanje uporabi isto opravilo.',checkGateway:'Najprej poveži strežnik in podaj soglasje.',boundaryUnavailable:'Obris vira je na voljo pri ustvarjeni različici z znano postavitvijo.',deleteConfirm:'Izbrišem to sliko in shranjene različice iz galerije in te naprave? Če jih želiš ohraniti, prej prenesi kopijo.',errorGeneric:'Opravilo ni uspelo. Obstoječe slike so ohranjene.',ILLUSTRATIVE_ONLY:'Samo ilustrativno',SOURCE_VERIFIED:'Vir preverjen',PENDING:'V čakanju',RUNNING:'Poteka',READY:'Pripravljeno',FAILED:'Napaka',HELD:'Zadržano',CANCELLED:'Preklicano',ACCEPTED:'Potrjeno',REJECTED:'Zavrnjeno',SIZE_LIMIT:'Slika presega 12 MB.',IMAGE_PIXEL_LIMIT:'Slika presega omejitev pikslov.',CANVAS_PIXEL_LIMIT:'Ohranitev izvirnika bi presegla omejitev platna.',UNSUPPORTED_OR_CORRUPT:'Nepodprta ali poškodovana slika. Uporabi veljaven JPEG, PNG ali WebP.',STORAGE_UNAVAILABLE:'Zasebna hramba v brskalniku ni na voljo.',STORAGE_QUOTA_OR_FAILURE:'Hramba brskalnika je polna ali ni dostopna. Izvozi kopijo in sprosti prostor.',PAIR_LIMIT:'LAB sprejme največ 100 izvirnikov.',INVALID_SEED:'Seme mora biti celo število med 0 in 2147483647.',INVALID_BACKUP:'Kopija ni prestala preverjanja; slike niso bile uvožene.',BACKUP_LIMIT:'Kopija presega 64 MB. Prenesi posamezne izvirnike in kompozicije.'
  }
};

Object.assign(dictionary.en,{
  tryGallery:'Explore the gallery ↗',referenceGallery:'Reference gallery',referenceEyebrow:'THE DUALFRAME EXPERIENCE',referenceTitle:'A gallery that follows your screen.',referenceNote:'Existing Nara / Illuminara artworks demonstrate paired compositions and supplied HD/4K assets. They are references, not new DualFrame outputs or benchmark originals.',reference:'Nara reference',referenceLoading:'Loading the reference gallery…',referenceReady:'30 paired artworks · reference assets · no generation request',model:'Image model',smart:'Smart Reframe · composition first',infographic:'Infographic / Text · layout and words',smartNote:'Creative composition can change the whole frame. Subject consistency and composition are reviewed separately from pixel preservation.',infographicNote:'Build a visual layout around exact text. The text layer is rendered locally for readability. This task has its own review rubric.',outputQuality:'Output quality',creativity:'Direction',naturalStyle:'Natural continuation',cinematicStyle:'Cinematic atmosphere',minimalStyle:'Minimal surroundings',headlineText:'Exact headline',bodyText:'Exact body text',textNote:'Your text is rendered locally as a readable overlay; image-model text is reviewed separately.',proofGuide:'Faithful checks every normalized source pixel after saving. Creative modes disclose whole-frame changes.',reviewTask:'Comparison task',taskRule:'Each task has its own criteria. Different tasks never share an aggregate.',candidateA:'First candidate',candidateB:'Second candidate',resultDetails:'Result details & provenance',immersiveHint:'Double-tap an open image for a pure immersive view. Double-tap again to return.',localSimulation:'Local simulation · no AI · €0',modelHeld:'AI model prepared · activation held',gatewayRequired:'Requires your private gateway and verified processing terms. No image is sent by selecting a model.',liveReady:'Private gateway ready for this model.',pixelPass:'Protected pixels: 0 changed',pixelUnknown:'Pixel protection not verified',creativeChanged:'Creative reconstruction · whole frame may change',localText:'Local text overlay',referenceProvided:'Supplied reference asset',composition:'Composition',textAccuracy:'Text accuracy',textReadability:'Text readability',layout:'Layout',hierarchy:'Visual hierarchy',METHOD_MISMATCH:'Tasks differ · illustrative review only',selectCandidate:'Select a result',SAME_CANDIDATE:'Select two different results.',REFERENCE_UNAVAILABLE:'Reference gallery is temporarily unavailable.',REFERENCE_DIMENSION_MISMATCH:'Reference dimensions differ from the manifest.',MODEL_MODE_UNSUPPORTED:'This model does not support the selected task.',DEMO_4K_UNAVAILABLE:'Local simulation produces an HD preview. It does not create native 4K.',upscaled:'Upscaled · disclosed',native:'Native provider output',proof:'Pixel protection',PROTECTED_PIXELS_CHANGED:'Protected pixels differ from this browser’s normalized original. Server/browser decoding may differ. No result was accepted; the job is held for review.',OUTPUT_DIMENSION_MISMATCH:'Returned image geometry did not pass validation.',UNVERIFIED_4K:'The result does not have verified 4K provenance.',unknownCost:'Actual cost unavailable',processing:'Preparing…',receiptDownload:'Download result receipt',consent:'I own this image and allow this original and prompt to be sent to the selected provider through my private gateway. Retention terms must be verified before activation.',sourceVerified:'VERIFIED SAME TASK · authenticated gateway lineage',declared:'DECLARED SAME SOURCE · uploader statement',ownership:'Concept: Bojan Dobrečevič (BD) · Built with GPT Work · v2.0 R4 LAB',tryDemo:'Try local simulation',demoDisclosure:'The reference gallery uses existing artwork. Local simulation tests the workflow; live AI calls need a verified private gateway.',imported:'Result imported. Its task and lineage must be bound before a controlled review.',qualityVerified:'Dimensions verified',qualityPending:'Checking dimensions…',BODY_REQUIRED:'Add a headline or body text for this layout.',noCandidate:'No result for this task yet.',unsupportedModel:'Unsupported task',taskStats:'Task-specific reviews',heroReference:'Nara / Illuminara reference'
});
Object.assign(dictionary.sl,{
  tryGallery:'Razišči galerijo ↗',referenceGallery:'Referenčna galerija',referenceEyebrow:'IZKUŠNJA DUALFRAME',referenceTitle:'Galerija, ki sledi tvojemu zaslonu.',referenceNote:'Obstoječa dela Nara / Illuminara prikazujejo L/P kompozicije in pripravljene HD/4K datoteke. To so reference, ne novi rezultati DualFrame ali izvirniki za meritve.',reference:'Nara referenca',referenceLoading:'Nalagam referenčno galerijo…',referenceReady:'30 parov umetniških del · referenčne slike · brez AI klica',model:'Slikovni model',smart:'Smart Reframe · nova kompozicija',infographic:'Infographic / Text · postavitev in besedilo',smartNote:'Ustvarjalna kompozicija lahko spremeni celotno sliko. Identiteto motiva in postavitev ocenjujemo ločeno od ohranitve pikslov.',infographicNote:'Pripravi slikovno postavitev okoli točnega besedila. Besedilni sloj se izriše lokalno zaradi berljivosti. Ta naloga ima svoja merila.',outputQuality:'Kakovost izhoda',creativity:'Usmeritev',naturalStyle:'Naravno nadaljevanje',cinematicStyle:'Filmsko vzdušje',minimalStyle:'Minimalna okolica',headlineText:'Točen naslov',bodyText:'Točno besedilo',textNote:'Besedilo se izriše lokalno kot berljiv sloj; besedilo slikovnega modela ocenjujemo ločeno.',proofGuide:'Faithful po shranjevanju preveri vsak normalizirani piksel izvirnika. Ustvarjalna načina označita spremembe celotne slike.',reviewTask:'Naloga primerjave',taskRule:'Vsaka naloga ima svoja merila. Različnih nalog ne združujemo v eno oceno.',candidateA:'Prvi kandidat',candidateB:'Drugi kandidat',resultDetails:'Podrobnosti rezultata in izvor',immersiveHint:'Dvojni dotik odprte slike vključi čisti celozaslonski pogled. Ponovni dvojni dotik te vrne.',localSimulation:'Lokalna simulacija · ni AI · 0 €',modelHeld:'AI model je pripravljen · aktivacija zadržana',gatewayRequired:'Potreben je tvoj zasebni strežnik in preverjeni pogoji obdelave. Izbira modela ne prenese slike.',liveReady:'Zasebni strežnik je pripravljen za ta model.',pixelPass:'Zaščiteni piksli: 0 spremenjenih',pixelUnknown:'Zaščita pikslov ni preverjena',creativeChanged:'Ustvarjalna rekonstrukcija · spremeni se lahko celotna slika',localText:'Lokalni besedilni sloj',referenceProvided:'Pripravljena referenčna datoteka',composition:'Kompozicija',textAccuracy:'Točnost besedila',textReadability:'Berljivost besedila',layout:'Postavitev',hierarchy:'Vizualna hierarhija',METHOD_MISMATCH:'Različni nalogi · samo ilustrativni pregled',selectCandidate:'Izberi rezultat',SAME_CANDIDATE:'Izberi dva različna rezultata.',REFERENCE_UNAVAILABLE:'Referenčna galerija trenutno ni dostopna.',REFERENCE_DIMENSION_MISMATCH:'Dimenzije reference se ne ujemajo z manifestom.',MODEL_MODE_UNSUPPORTED:'Ta model ne podpira izbrane naloge.',DEMO_4K_UNAVAILABLE:'Lokalna simulacija izdela HD predogled. Ne ustvarja izvirne 4K slike.',upscaled:'Povečano · označeno',native:'Izvirni izhod ponudnika',proof:'Zaščita pikslov',PROTECTED_PIXELS_CHANGED:'Zaščiteni piksli se razlikujejo od normaliziranega izvirnika v tem brskalniku. Dekodiranje strežnika in brskalnika se lahko razlikuje. Rezultat ni potrjen; opravilo je zadržano za pregled.',OUTPUT_DIMENSION_MISMATCH:'Geometrija rezultata ni prestala preverjanja.',UNVERIFIED_4K:'Rezultat nima preverjenega izvora 4K.',unknownCost:'Dejanski strošek ni na voljo',processing:'Pripravljam…',receiptDownload:'Prenesi potrdilo rezultata',consent:'Slika je moja in dovoljujem prenos tega izvirnika ter poziva izbranemu ponudniku prek svojega zasebnega strežnika. Pogoji hrambe morajo biti preverjeni pred aktivacijo.',sourceVerified:'ISTA PREVERJENA NALOGA · izvor prek zasebnega strežnika',declared:'IZJAVLJEN ISTI VIR · navedba uporabnika',ownership:'Zamisel: Bojan Dobrečevič (BD) · Izvedba z GPT Work · v2.0 R4 LAB',tryDemo:'Preizkusi lokalno simulacijo',demoDisclosure:'Referenčna galerija uporablja obstoječa dela. Lokalna simulacija preveri postopek; AI klici potrebujejo preverjen zasebni strežnik.',imported:'Rezultat je uvožen. Za nadzorovano primerjavo je treba povezati nalogo in izvor.',qualityVerified:'Dimenzije preverjene',qualityPending:'Preverjam dimenzije…',BODY_REQUIRED:'Za postavitev dodaj naslov ali besedilo.',noCandidate:'Za to nalogo še ni rezultata.',unsupportedModel:'Nepodprta naloga',taskStats:'Ocene po nalogah',heroReference:'Nara / Illuminara referenca'
});

Object.assign(dictionary.en,{importCounterpart:'Import the other frame',counterpartNote:'Already have its portrait or landscape version? Pair it locally. Imported pixels are not a verified AI generation.',counterpartImported:'Other composition imported privately. Its declared relationship is not independently verified.',importedFrame:'Imported composition · relationship declared',SELECT_ORIGINAL:'Choose your original first.',WRONG_ORIENTATION:'Choose an image in the opposite orientation.',immersiveExit:'Double-tap to return'});
Object.assign(dictionary.sl,{importCounterpart:'Uvozi drugo kompozicijo',counterpartNote:'Že imaš pokončno ali ležečo različico? Poveži jo lokalno. Uvoženi piksli niso dokaz preverjenega AI ustvarjanja.',counterpartImported:'Druga kompozicija je uvožena zasebno. Povezava z izvirnikom ni neodvisno preverjena.',importedFrame:'Uvožena kompozicija · povezava je navedena',SELECT_ORIGINAL:'Najprej izberi izvirnik.',WRONG_ORIENTATION:'Izberi sliko v nasprotni orientaciji.',immersiveExit:'Dvojni dotik za vrnitev'});

Object.assign(dictionary.en,{
 settingsTitle:'⚙ Settings',settingsCreate:'Create defaults',settingsDefaultNote:'Choose how new tasks begin. Saved images and jobs never change.',settingsModels:'Image models & API',
 settingsGallery:'Gallery & viewer',settingsStorage:'Storage & Sync',settingsSave:'Save settings',settingsRememberLast:'Remember the last Create choices',modelsNote:'Enable models shown in Create and Compare. A configured key is not proof the model works.',
 profile:'Quick recipe',profilePhoto:'Faithful photo',profileArt:'Creative composition',profileText:'Infographic / text',applyProfile:'Apply to defaults',
 checkApiFree:'Check API access · no generation',apiTestNote:'Checks gateway, account session and configured keys only. No generation, provider spend or assertion of model availability.',
 defaultCollection:'Starting collection',defaultViewerQuality:'Fullscreen quality',delayLabel:'Delay',delayOff:'Off',
 delayHelp:'After turning the screen or changing Gallery Preview, keep the previous image composition visible for 0.5–5 seconds before switching. Off (0s) changes immediately.',
 metadataAuto:'On launch, sync image names and cloud catalog only, never image bytes.',storageSafeHelp:'Sync lists cloud images first. Load individual photos on demand. Local-only originals are never evicted.',
 storageCheck:'Check local storage',clearMemory:'Clear image memory cache',preloadAdjacent:'Prefetch one previous and next image',
 estimateUnavailable:'Browser storage estimate unavailable (not proof of free or full device storage).',
 storageEstimate:'Approximate browser storage',storagePending:'Cloud-only images',storageLocal:'Local images',settingsAtLeastOne:'Keep at least one model enabled.',
 configured:'Key configured; model generation not tested',missingKey:'Key not configured',apiAuthNeeded:'Unlock API to check your session.',apiSessionValid:'Account session valid · model generation not tested',apiSessionFailed:'Account session check failed.',
 storageEstimatedLow:'Estimated browser space too low for this download. Originals were not deleted.',
 STORAGE_ESTIMATED_LOW:'Estimated browser quota is too low for this photo. No originals were deleted.',
 cloudCatalog:'Cloud catalog synchronized. Photos load only when chosen.',
 loadCloudVariants:'Load cloud variants',cloudLoadOne:'Load on this device',cloudOnly:'Cloud-only · not downloaded',cloudLoading:'Downloading selected photo…',cloudDownloaded:'Selected photo downloaded.',remoteUnavailable:'Cloud download failed; existing images retained.',
 STORAGE_QUOTA_EXCEEDED:'Browser storage quota exceeded. Your device may still have free disk space.',STORAGE_TRANSACTION_ABORTED:'Browser database transaction was aborted. Retry without deleting originals.',
 STORAGE_ACCESS_DENIED:'Browser blocked private storage. Check browser/private-mode permissions.',STORAGE_CONNECTION_CLOSED:'Browser database connection closed. Reload and try again.',
 STORAGE_RECORD_CONFLICT:'Browser database record conflict.',STORAGE_SCHEMA_ERROR:'Local image database schema error. Back up available images.',
 STORAGE_IO_FAILURE:'Browser database I/O failed, not necessarily full.',STORAGE_OPERATION_FAILED:'Browser database operation failed; not confirmed as a quota issue.',STORAGE_REMOTE_SIZE_UNKNOWN:'Cloud metadata does not declare image sizes; no download started.',STORAGE_TRANSFER_TOO_LARGE:'This image set exceeds the 192 MiB per-download guard. Your images remain unchanged.',
 STORAGE_DB_BLOCKED:'Another tab is blocking the image database. Close other tabs and retry.'
});
Object.assign(dictionary.sl,{
 settingsTitle:'⚙ Nastavitve',settingsCreate:'Privzeto ustvarjanje',settingsDefaultNote:'Izberi privzeto za nova opravila. Shranjene slike in opravila se ne spremenijo.',settingsModels:'Slikovni modeli in API',
 settingsGallery:'Galerija in ogled',settingsStorage:'Shramba in Sync',settingsSave:'Shrani nastavitve',settingsRememberLast:'Zapomni si zadnje izbire v Create',modelsNote:'V Create in Compare prikaži samo vključene modele. Nastavljen ključ še ne dokazuje delovanja.',
 profile:'Hiter recept',profilePhoto:'Fotografija · ohrani',profileArt:'Umetniška kompozicija',profileText:'Infografika / besedilo',applyProfile:'Uporabi kot privzeto',
 checkApiFree:'Preveri API · brez generiranja',apiTestNote:'Preveri strežnik, sejo in prisotnost ključev. Brez ustvarjanja slik, stroškov ali neutemeljenih trditev o delovanju modela.',
 defaultCollection:'Začetna zbirka',defaultViewerQuality:'Kakovost celozaslonskega ogleda',delayLabel:'Delay',delayOff:'Izključeno',
 delayHelp:'Ko obrneš zaslon ali spremeniš Preview, stara kompozicija ostane vidna še 0,5–5 sekund. Izključeno (0 s) preklopi takoj.',
 metadataAuto:'Ob zagonu uskladi samo katalog in imena, nikoli bajtov slik.',storageSafeHelp:'Sync najprej prikaže oblačne slike. Posamezno fotografijo naložiš po izbiri. Izvirnikov, ki so samo lokalni, nikoli ne brišemo samodejno.',
 storageCheck:'Preveri shrambo',clearMemory:'Izprazni slikovni predpomnilnik v RAM-u',preloadAdjacent:'Prednaloži eno prejšnjo in eno naslednjo sliko',
 estimateUnavailable:'Brskalnik ne razkriva ocene svoje shrambe (to ni dokaz prostega/zasedenega prostora naprave).',
 storageEstimate:'Ocenjena shramba brskalnika',storagePending:'Slike samo v oblaku',storageLocal:'Lokalne slike',settingsAtLeastOne:'Vsaj en model mora ostati vključen.',
 configured:'Ključ nastavljen; generiranje ni preverjeno',missingKey:'Ključ ni nastavljen',apiAuthNeeded:'Za preverjanje seje najprej odkleni API.',apiSessionValid:'Seja velja · ustvarjanje z modelom ni preverjeno',apiSessionFailed:'Preverjanje seje ni uspelo.',
 storageEstimatedLow:'Ocena preostalega prostora brskalnika je prenizka. Izvirniki niso bili izbrisani.',
 STORAGE_ESTIMATED_LOW:'Ocenjena preostala kvota brskalnika je prenizka. Izvirniki niso bili izbrisani.',
 cloudCatalog:'Katalog v oblaku usklajen. Slike se prenesejo šele po izbiri.',
 loadCloudVariants:'Prenesi oblačne različice',cloudLoadOne:'Prenesi na napravo',cloudOnly:'Samo v oblaku · še ni preneseno',cloudLoading:'Prenašam izbrano fotografijo …',cloudDownloaded:'Izbrana fotografija je prenesena.',remoteUnavailable:'Prenos iz oblaka ni uspel; shranjene slike so ohranjene.',
 STORAGE_QUOTA_EXCEEDED:'Kvota brskalnikove shrambe je presežena. Na napravi je lahko še prost prostor.',STORAGE_TRANSACTION_ABORTED:'Zapis v brskalnikovo bazo je bil prekinjen. Poskusi ponovno brez brisanja izvirnikov.',
 STORAGE_ACCESS_DENIED:'Brskalnik je blokiral zasebno shrambo. Preveri dovoljenja in zasebni način.',STORAGE_CONNECTION_CLOSED:'Povezava s shrambo se je zaprla. Osveži stran.',
 STORAGE_RECORD_CONFLICT:'Konflikt zapisa v lokalni bazi.',STORAGE_SCHEMA_ERROR:'Napaka sheme lokalne baze. Izvozi dosegljive slike.',
 STORAGE_IO_FAILURE:'Napaka vhoda/izhoda lokalne baze; ni nujno pomanjkanje prostora.',STORAGE_OPERATION_FAILED:'Napaka shranjevanja; ni potrjeno, da gre za kvoto.',STORAGE_REMOTE_SIZE_UNKNOWN:'Oblak ne navaja velikosti slik; prenosa nisem začel.',STORAGE_TRANSFER_TOO_LARGE:'Komplet presega omejitev prenosa 192 MiB. Obstoječe slike ostanejo nedotaknjene.',
 STORAGE_DB_BLOCKED:'Drug zavihek blokira shrambo. Zapri druge zavihke in ponovi.'
});

Object.assign(dictionary.en,{
 apiCheckRunning:'Checking enabled models with read-only provider requests…',
 apiCheckTitle:'Provider API access check',apiCheckModel:'Image model',apiCheckStatus:'Verification',apiCheckProbe:'Read-only test',
 apiModelAccessible:'Model listed for this API key',apiProviderReachable:'Provider API responds · model not confirmed',apiKeyMissing:'Key not configured',
 apiAuthFailed:'Provider authentication rejected',apiPermissionDenied:'Provider access forbidden',apiModelNotFound:'Model not found / not accessible via this endpoint',
 apiRateLimited:'Provider rate limited',apiProviderError:'Provider server error',apiNetworkError:'Network / timeout',apiProbeUnsupported:'Read-only test unavailable',apiCatalogUnavailable:'Provider catalog endpoint unavailable',
 apiConfigError:'Provider probe host invalid',apiCheckCount:'models listed',apiTestNote:'Checks enabled image models through provider read-only catalog APIs where available. Listed ≠ successful image creation/editing. Zero image generation calls.',
 switchPortrait:'Show portrait composition',switchLandscape:'Show landscape composition',frameNotSaved:'No saved counterpart for this orientation; showing the available original.'
});
Object.assign(dictionary.sl,{
 apiCheckRunning:'Preverjam vključene modele z bralnimi zahtevki pri ponudnikih…',
 apiCheckTitle:'Preverjanje dostopa pri ponudnikih',apiCheckModel:'Slikovni model',apiCheckStatus:'Preverjanje',apiCheckProbe:'Bralni test',
 apiModelAccessible:'Model je naveden za ta API ključ',apiProviderReachable:'API ponudnika se odziva · model ni potrjen',apiKeyMissing:'Ključ ni nastavljen',
 apiAuthFailed:'Ponudnik je zavrnil prijavo',apiPermissionDenied:'Ponudnik je zavrnil dovoljenje',apiModelNotFound:'Model ni najden oziroma dostopen prek tega endpointa',
 apiRateLimited:'Ponudnik omejuje zahtevke',apiProviderError:'Napaka strežnika ponudnika',apiNetworkError:'Omrežje / časovna omejitev',apiProbeUnsupported:'Bralni test ni na voljo',apiCatalogUnavailable:'Kataloga ponudnika ni mogoče prebrati',
 apiConfigError:'Neveljaven naslov preverjanja',apiCheckCount:'modelov je potrjenih',apiTestNote:'Vključene slikovne modele preveri z bralnimi zahtevki pri ponudnikih, kjer je to podprto. Najden model še ne potrjuje uspešnega ustvarjanja/urejanja. Brez generacij.',
 switchPortrait:'Pokaži pokončno kompozicijo',switchLandscape:'Pokaži ležečo kompozicijo',frameNotSaved:'Druga kompozicija ni shranjena; prikazan je razpoložljivi izvirnik.'
});
let language = new URLSearchParams(location.search).get('lang') === 'sl' ? 'sl' : 'en';
let pwaRegistration=null,pwaInstallEvent=null,pwaBuildId=null,pwaReloadRequested=false,pwaStatusKey='pwaPreparing',pwaUpdateKey=null;
try { if (!new URLSearchParams(location.search).has('lang') && localStorage.getItem('dualframe-language') === 'sl') language='sl'; } catch {}
const t = key => dictionary[language][key] || key;
let pairs=[],scores=[],selected=null,viewerPair=null,reviewState=null,originFocus=null,originScroll=0;
let gateway=null,capabilities=null,referencePairs=[],referenceLoaded=false,viewerLoad=0,activeView='showcase';
let activeProduct='photos',cartoons=null;
const modelKeys=MODELS.filter(m=>m.direct).map(m=>m.key);
let preferenceStorage=accountPreferences(null),enhancePrefs=readEnhancementSettings(preferenceStorage);
let prefs=readSettings(preferenceStorage,modelKeys),remotePairs=[],remoteJobs=[],galleryDisplayedFrame=null,galleryFrameTimer=null,viewerShownTarget=null,viewerShownPair=null,viewerFrameTimer=null;
const controllers=new Map(),urls=new Set();let urlCache=new WeakMap();
const selectedPair = () => pairs.find(p=>p.pair_id===selected);
const comparePair = () => pairs.find(p=>p.pair_id===$('compare-pair').value);
const safeName = name => name.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,100) || 'image';
const displayTitle = pair => pair.display_name || pair.title || pair.original?.filename || 'Untitled';
function assetUrl(asset, normalized=false) {
  const blob=normalized ? asset.normalized||asset.blob : asset.blob||asset.normalized;
  if(!(blob instanceof Blob))return asset.remote_url||'';
  if(!urlCache.has(blob)){const url=URL.createObjectURL(blob);urlCache.set(blob,url);urls.add(url);}
  return urlCache.get(blob);
}
const imageLoader=createImageLoader({readBlob:getStoredBlob});
function bindImage(img,asset,normalized=false,immediate=false){imageLoader.bind(img,asset,normalized,immediate).catch(()=>notify('STORAGE_ASSET_MISSING',true));}
new MutationObserver(()=>imageLoader.sweep()).observe(document.body,{childList:true,subtree:true});
const pairHydrations=new WeakMap();
async function ensurePair(pair){if(!pair||!hasStoredBlobs(pair))return pair;if(!pairHydrations.has(pair))pairHydrations.set(pair,hydratePair(pair).then(full=>{Object.assign(pair,full);return pair;}).finally(()=>pairHydrations.delete(pair)));return pairHydrations.get(pair);}
function notify(key,error=false){$('notice').textContent=t(key);$('notice').classList.toggle('error',error);$('notice').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('notice').hidden=true,6500);}
function guard(fn){return async (...args)=>{try{await fn(...args);}catch(e){notify(dictionary[language][e.message]?e.message:'errorGeneric',true);console.error('DualFrame:', /^[A-Z_]+$/.test(e.message)?e.message:'REDACTED_ERROR');}};}
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function button(text,fn,className='secondary'){const b=node('button',text,className);b.type='button';b.addEventListener('click',guard(fn));return b;}
Object.assign(dictionary.en,{appTitle:'DualFrame Photos — Gallery · Create · Compare',brandHome:'DualFrame Photos home',productLabel:'DualFrame products',cartoonsSoon:'Coming soon'});
Object.assign(dictionary.sl,{appTitle:'DualFrame Photos — Galerija · Ustvari · Primerjaj',brandHome:'DualFrame Photos · domov',productLabel:'Izdelki DualFrame',cartoonsSoon:'V pripravi'});
function setLanguage(){document.documentElement.lang=language;document.title=t('appTitle');document.querySelector('.brand').setAttribute('aria-label',t('brandHome'));document.querySelector('.product-switch').setAttribute('aria-label',t('productLabel'));document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('language').textContent=language==='en'?'SL':'EN';$('prompt').placeholder=t('promptPlaceholder');$('workspace').setAttribute('aria-label',t('creationGallery'));$('comparison').setAttribute('aria-label',t('comparisonLab'));updateModelControls();render();renderReference();if(viewerPair)updateViewer();if(reviewState)renderReview();if($('pwa-status'))$('pwa-status').textContent=t(pwaStatusKey);if(pwaUpdateKey&&$('pwa-update-text'))$('pwa-update-text').textContent=t(pwaUpdateKey);if(syncPaused)$('sync-pause').textContent=t('syncResume');cartoons?.setShellLanguage(language);updateProductBrand();}
function updateProductBrand(){const comic=activeProduct==='cartoons',brand=document.querySelector('.brand');brand.querySelector('.brand-ai').textContent=comic?'Cartoons':'Photos';brand.querySelector('.badge').textContent=comic?'DFC':'DFP';brand.setAttribute('aria-label',comic?'DualFrame Cartoons':t('brandHome'));document.title=comic?'DualFrame Cartoons — Illuminara':t('appTitle');}
function switchProduct(product){if(!['photos','cartoons'].includes(product)||activeProduct===product)return;if(viewerPair)closeViewer();activeProduct=product;document.body.dataset.product=product;$('cartoons-gallery').hidden=product!=='cartoons';for(const value of ['photos','cartoons']){$('product-'+value).setAttribute('aria-pressed',String(product===value));$('product-'+value).classList.toggle('active',product===value);}updateProductBrand();if(product==='cartoons')cartoons.activate();else {cartoons.deactivate();setLanguage();}}

function pwaSetStatus(key){pwaStatusKey=key;const el=$('pwa-status');if(el)el.textContent=t(key);}
function pwaShowUpdate(key){pwaUpdateKey=key;$('pwa-update').hidden=false;$('pwa-update-text').textContent=t(key);}
function pwaRPC(worker,type){return new Promise((resolve,reject)=>{if(!worker)return reject(Error('PWA_WORKER_NOT_READY'));const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('PWA_VERIFY_TIMEOUT'));},6000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage({type},[channel.port2]);});}
async function pwaRefreshStatus(){if(!pwaRegistration?.active){pwaSetStatus('pwaPreparing');return;}try{const result=await pwaRPC(pwaRegistration.active,'VERIFY_PACKAGE');pwaSetStatus(result?.ready?(navigator.onLine?'pwaReady':'pwaOffline'):'pwaUnavailable');}catch{pwaSetStatus('pwaUnavailable');}}
async function pwaSaveAndUpdate(){
 const button=$('pwa-update-button');button.disabled=true;
 try{
  if(!pwaRegistration)throw Error('PWA_WORKER_NOT_READY');
  let waiting=pwaRegistration.waiting;
  if(!waiting){await pwaRegistration.update();waiting=pwaRegistration.waiting;}
  const deadline=Date.now()+12000;
  while(controllers.size&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,200));
  if(controllers.size||cloudBusy||enhancementBusy){pwaShowUpdate('pwaUpdateBusy');return;}
  if(!waiting){
   if(pwaUpdateKey==='pwaOtherUpdate'){
    await prepareForUpdate();
    await Promise.all([getPairs(),getScores()]);
    pwaReloadRequested=true;
    location.reload();
    return;
   }
   $('pwa-update').hidden=true;pwaUpdateKey=null;pwaSetStatus('pwaNoUpdate');return;
  }
  await prepareForUpdate();
  if(controllers.size||enhancementBusy)throw Error('PWA_ACTIVE_JOB');
  await Promise.all([getPairs(),getScores()]);
  pwaReloadRequested=true;
  const activated=new Promise(resolve=>{
   const finish=value=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve(value);};
   const changed=()=>finish(true),timer=setTimeout(()=>finish(false),10000);
   navigator.serviceWorker.addEventListener('controllerchange',changed,{once:true});
  });
  waiting.postMessage({type:'ACTIVATE_SAVED'});
  if(await activated){location.reload();return;}
  throw Error('PWA_ACTIVATION_TIMEOUT');
 }catch{
  pwaReloadRequested=false;cancelUpdatePreparation();pwaShowUpdate('pwaUpdateUnavailable');
 }finally{if(!pwaReloadRequested)button.disabled=false;}
}
async function initPWA(){
 const install=$('pwa-install'),dialog=$('pwa-help');
 install.addEventListener('click',async()=>{
  if(pwaInstallEvent){const prompt=pwaInstallEvent;pwaInstallEvent=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted')pwaSetStatus('pwaInstallAccepted');}
  else{dialog.showModal();await pwaRefreshStatus();}
 });
 $('pwa-close').addEventListener('click',()=>dialog.close());
 $('pwa-update-button').addEventListener('click',pwaSaveAndUpdate);
 addEventListener('beforeinstallprompt',event=>{event.preventDefault();pwaInstallEvent=event;});
 addEventListener('appinstalled',()=>{install.hidden=true;pwaSetStatus('pwaInstallAccepted');});
 if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)install.hidden=true;
 if(!('serviceWorker'in navigator)||!isSecureContext){pwaSetStatus('pwaUnavailable');return;}
 navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='PAGE_BUILD')event.ports[0]?.postMessage({build:pwaBuildId});});
 try{const response=await fetch('./release.json');if(response.ok){const release=await response.json();if(release.pwa?.build_label&&release.pwa?.offline_package_sha256)pwaBuildId=release.pwa.build_label+':'+release.pwa.offline_package_sha256;}}catch{}
 let hadController=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(pwaReloadRequested)return;if(hadController){pwaShowUpdate('pwaOtherUpdate');}hadController=!!navigator.serviceWorker.controller;pwaRefreshStatus().catch(()=>{});});
 try{
  pwaRegistration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  try{await pwaRegistration.update();}catch{}
  if(pwaRegistration.waiting)pwaShowUpdate('pwaUpdateReady');
  pwaRegistration.addEventListener('updatefound',()=>{const worker=pwaRegistration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&pwaRegistration.waiting&&navigator.serviceWorker.controller)pwaShowUpdate('pwaUpdateReady');if(worker.state==='activated')pwaRefreshStatus().catch(()=>{});});});
  if(pwaRegistration.active)await pwaRefreshStatus();
  addEventListener('focus',()=>{if(pwaRegistration)pwaRegistration.update().catch(()=>{});});
  addEventListener('online',()=>{pwaRefreshStatus().catch(()=>{});if(pwaRegistration)pwaRegistration.update().catch(()=>{});});
  addEventListener('offline',()=>pwaRefreshStatus().catch(()=>{}));
 }catch{pwaSetStatus('pwaUnavailable');}
}

function currentDevice(){const ua=navigator.userAgent;return /iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)||(/Android/.test(ua)&&!/Mobile/.test(ua))?'tablet':navigator.userAgentData?.mobile||/iPhone|iPod|Android.*Mobile/.test(ua)?'phone':'desktop';}
function targetFrame(override='auto'){return deviceOrientation({device:currentDevice(),width:window.innerWidth,height:window.innerHeight,override,simulation:$('device').value});}
function galleryFrame(){const target=deviceOrientation({device:currentDevice(),width:window.innerWidth,height:window.innerHeight,simulation:$('reference-device').value});return galleryDisplayedFrame||target;}
function actualGalleryFrame(){return deviceOrientation({device:currentDevice(),width:window.innerWidth,height:window.innerHeight,simulation:$('reference-device').value});}
// The same personal-photo controls are used in Gallery and Create.
let galleryMoveBusy=false;
function visiblePhotoIds(view){return pairs.filter(pair=>view!=='showcase'||$('collection-filter').value!=='favorites'||favorites.has(pair.pair_id)).map(pair=>pair.pair_id);}
function imageActionList(pair,view){
 const list=node('div',undefined,'image-action-list');list.dataset.pairId=pair.pair_id;list.dataset.galleryView=view;list.setAttribute('role','group');list.setAttribute('aria-label',t('imageActions')+': '+displayTitle(pair));
 const use=()=>{selected=pair.pair_id;if(view==='showcase')switchTab('create');render();$('source-details').scrollIntoView({block:'nearest',behavior:'smooth'});};
 const actions=[['viewPair',()=>openViewer(pair.pair_id)],['useSource',use],['rename',()=>openRename(pair)],['moveUp',()=>movePhoto(pair.pair_id,'up',view),'up'],['moveDown',()=>movePhoto(pair.pair_id,'down',view),'down'],['moveTop',()=>movePhoto(pair.pair_id,'top',view),'top'],['moveBottom',()=>movePhoto(pair.pair_id,'bottom',view),'bottom'],['delete',()=>deleteGalleryPair(pair)]];
 for(const [index,[label,run,move]] of actions.entries()){
  const item=node('span',undefined,'image-action');if(index){const pipe=node('span','|','action-separator');pipe.setAttribute('aria-hidden','true');item.append(pipe);}
  const control=button(t(label),run,label==='delete'?'text-button card-delete':'text-button');control.dataset.action=move||label;
  if(move){control.dataset.move=move;const ids=visiblePhotoIds(view),at=ids.indexOf(pair.pair_id);control.disabled=galleryMoveBusy||at<0||(['up','top'].includes(move)?at===0:at===ids.length-1);}
  item.append(control);list.append(item);
 }return list;
}
function refreshMoveButtons(){for(const list of document.querySelectorAll('.image-action-list')){const ids=visiblePhotoIds(list.dataset.galleryView),at=ids.indexOf(list.dataset.pairId);for(const control of list.querySelectorAll('[data-move]'))control.disabled=galleryMoveBusy||at<0||(['up','top'].includes(control.dataset.move)?at===0:at===ids.length-1);}}
async function movePhoto(id,action,view){
 if(galleryMoveBusy)return;
 const scope=scopedStore,signal=scopeController.signal;
 galleryMoveBusy=true;refreshMoveButtons();
 try{
  const result=await scope.movePair(id,action,{baselineIds:pairs.map(pair=>pair.pair_id),visibleIds:visiblePhotoIds(view)});
  if(signal.aborted)return;
  pairs=result;galleryMoveBusy=false;render();
  const list=[...document.querySelectorAll('.image-action-list')].find(item=>item.dataset.pairId===id&&item.dataset.galleryView===view);
  const control=list?.querySelector('[data-move="'+action+'"]:not(:disabled)')||list?.querySelector('button');control?.focus({preventScroll:true});list?.closest('.card')?.scrollIntoView({block:'nearest',behavior:'smooth'});
  notify('orderSaved');
 }finally{galleryMoveBusy=false;refreshMoveButtons();}
}
Object.assign(dictionary.en,{imageActions:'Image actions',moveUp:'Move up',moveDown:'Move down',moveTop:'Move to top',moveBottom:'Move to bottom',orderSaved:'Order saved on this device. Press Sync to share it with your other devices.'});
Object.assign(dictionary.sl,{imageActions:'Ukazi za sliko',moveUp:'Premakni gor',moveDown:'Premakni dol',moveTop:'Premakni na vrh',moveBottom:'Premakni na dno',orderSaved:'Vrstni red je shranjen v tej napravi. S Sync ga prenesi še na druge naprave.'});
function repaintGallery(){if(referenceLoaded)renderReference();else renderOwnGallery();}
function scheduleGalleryOrientation(){
 const target=actualGalleryFrame(),shown=galleryDisplayedFrame||target;
 clearTimeout(galleryFrameTimer);galleryFrameTimer=null;
 if(orientationTransition(shown,target,prefs.delaySeconds)==='delay'){
  // Preserve raster L/P while the browser naturally changes the shape of the screen.
  galleryFrameTimer=setTimeout(()=>{galleryFrameTimer=null;galleryDisplayedFrame=actualGalleryFrame();repaintGallery();},prefs.delaySeconds*1000);
 }else galleryDisplayedFrame=target;
 repaintGallery();
}
async function persist(pair){checkPair(pair);await putPair(pair);render();}

async function syncPendingTitle(pair){
  if(!pair.title_sync_pending || !pair.display_name)return;
  const title=pair.display_name;
  const receipt=await API.request('/titles/'+pair.original.sha256,{method:'PUT',body:{title,base_revision:pair.title_revision||0}});
  if(receipt.source_sha256!==pair.original.sha256||receipt.title!==title)throw Error('TITLE_SYNC_MISMATCH');
  if(pair.display_name===title){const saved=await updatePair(pair.pair_id,current=>current?.display_name===title?{...current,title_sync_pending:false,title_revision:receipt.revision}:current);if(saved)Object.assign(pair,saved);}
}
let renamingPairId=null;
function openRename(pair){
  if(pair.reference_only)return;
  renamingPairId=pair.pair_id;
  $('rename-input').value=displayTitle(pair);
  $('rename-error').textContent='';
  $('rename-dialog').showModal();
  $('rename-input').focus();$('rename-input').select();
}
async function saveRename(event){
  event.preventDefault();
  const pair=pairs.find(p=>p.pair_id===renamingPairId),input=$('rename-input'),submit=$('rename-save'),name=input.value.trim();
  if(!pair){$('rename-dialog').close();return;}
  if(!name||name.length>120||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name)){$('rename-error').textContent=t('renameInvalid');return;}
  if(name===displayTitle(pair)){$('rename-dialog').close();return;}
  submit.disabled=true;
  const oldName=pair.display_name,oldPending=pair.title_sync_pending;
  try{
    pair.display_name=name;pair.title_sync_pending=true;
    try{const saved=await updatePair(pair.pair_id,current=>({...current,display_name:name,title_sync_pending:true}));Object.assign(pair,saved);}catch(e){pair.display_name=oldName;pair.title_sync_pending=oldPending;throw e;}
    let synced=false;
    if(API.apiUnlocked())try{await syncPendingTitle(pair);synced=true;}catch{ /* Keep a durable pending local rename for the next Sync. */ }
    $('rename-dialog').close();renamingPairId=null;
    render();
    if(viewerPair===pair.pair_id)updateViewer();
    notify(synced?'renameSaved':'renameLocalPending');
  }catch(e){
    $('rename-error').textContent=t('renameFailed');
    console.error('DualFrame rename:',/^[A-Z_]+$/.test(e.message)?e.message:'REDACTED_ERROR');
  }finally{submit.disabled=false;}
}
async function deleteGalleryPair(pair){
  if(!confirm(t('deleteConfirm')))return;
  for(const job of pair.jobs){
    controllers.get(job.job_id)?.abort();
    if(job.gateway_job_id&&gateway)await api(`/api/jobs/${job.gateway_job_id}/cancel`,{method:'POST',body:{}}).catch(()=>{});
  }
  if(pair.upload_id||pair.cloud_source_saved){
    if(!gateway)await connectGateway();
    if(pair.upload_id)await api(`/api/pairs/${pair.upload_id}`,{method:'DELETE'});
    else await API.request('/sync/records/'+pair.original.sha256,{method:'DELETE'});
  }
  await removePair(pair.pair_id);
  pairs=pairs.filter(item=>item.pair_id!==pair.pair_id);
  favorites.delete(pair.pair_id);
  try{preferenceStorage.setItem('bd-df-favorites',JSON.stringify([...favorites]));}catch{}
  if(selected===pair.pair_id)selected=pairs[0]?.pair_id||null;
  if(viewerPair===pair.pair_id)closeViewer();
  render();notify('deleted');
}
async function addOriginal(file,isDemo=false,disk=captureStorageScope()){
  if(file.size>MAX_BYTES)throw Error('SIZE_LIMIT');if(!file.size)throw Error('UNSUPPORTED_OR_CORRUPT');
  const bytes=await file.arrayBuffer();headerSize(bytes);const mime=sniff(bytes),hash=await sha256(bytes);
  const duplicate=pairs.find(p=>p.original.sha256===hash);if(duplicate){selected=duplicate.pair_id;render();notify('duplicate');return duplicate;}
  if(new Set(pairs.map(p=>p.original.sha256)).size>=MAX_ORIGINALS)throw Error('PAIR_LIMIT');
  const normalized=await normalizedImage(new Blob([bytes],{type:mime}));if(normalized.width*normalized.height>MAX_PIXELS)throw Error('IMAGE_PIXEL_LIMIT');
  const direction=orientation(normalized.width,normalized.height),derivedHash=await sha256(normalized.blob);
  const pair={schema:SCHEMA,pair_id:`df_${hash.slice(0,24)}`,created_at:new Date().toISOString(),original:{sha256:hash,filename:safeName(file.name),mime,width:normalized.width,height:normalized.height,source_orientation:direction,visibility:'private',bytes:file.size,blob:new Blob([bytes],{type:mime}),normalized:normalized.blob,path:`originals/${hash}.${mime.split('/')[1]}`,normalization:'browser EXIF-aware decode; canvas sRGB; display metadata removed',demo_fixture:isDemo},variants:{portrait:{},landscape:{}},jobs:[],references:[],comparison_seed:crypto.randomUUID()};
  pair.variants[direction].hd={blob:normalized.blob,sha256:derivedHash,width:normalized.width,height:normalized.height,path:`variants/${direction}/${derivedHash}.png`,origin:'original',resolution_origin:'normalized-original',resolution_verified:false};
  await disk.putOriginal(pair);await disk.getPairs();pairs.push(pair);selected=pair.pair_id;render();notify('added');return pair;
}
let localImportQueue=Promise.resolve();
async function uploadMany(files){const selectedFiles=[...files];const result=localImportQueue.catch(()=>{}).then(()=>importLocalFiles(selectedFiles));localImportQueue=result;return result;}
async function importLocalFiles(files){await accountTransition;const disk=captureStorageScope();for(const file of files){try{await addOriginal(file,false,disk);}catch(e){notify(e.message,true);}}$('upload').value='';}
async function importCounterpart(file){
 const pair=await ensurePair(selectedPair());if(!pair)throw Error('SELECT_ORIGINAL');if(!file)return;if(file.size>MAX_BYTES)throw Error('SIZE_LIMIT');
 const bytes=await file.arrayBuffer();headerSize(bytes);const decoded=await normalizedImage(new Blob([bytes],{type:sniff(bytes)})),target=opposite(pair.original.source_orientation);
 if(orientation(decoded.width,decoded.height)!==target)throw Error('WRONG_ORIENTATION');
 const hash=await sha256(decoded.blob),asset={blob:decoded.blob,sha256:hash,width:decoded.width,height:decoded.height,path:`variants/${target}/${hash}.png`,origin:'imported',provider:'user-import',model_or_version:'user-supplied-composition',mode:null,source_sha256:pair.original.sha256,direction:target,source_relationship:'uploader-declared',provenance_verified:false,resolution_origin:'imported-unverified',resolution_verified:false,changed_region:'unknown',imported_at:new Date().toISOString(),input_file_sha256:await sha256(bytes)};
 if(pair.variants[target].hd)rememberResult(pair,pair.variants[target].hd,'previous_'+crypto.randomUUID());rememberResult(pair,asset,'import_'+crypto.randomUUID());pair.variants[target].hd=asset;await persist(pair);notify('counterpartImported');
}
function render(){
  pairs=orderedGallery(pairs);
  const pair=selectedPair();$('pair-count').textContent=`${pairs.length} ${t('pairCount')}`;$('gallery-empty').hidden=pairs.length>0;$('generate').disabled=enhancementBusy||creationBusy||(!pair&&$('create-kind').value!=='generate');
  $('source-details').hidden=!pair;if(pair){bindImage($('source-preview'),pair.original,true,true);$('source-name').textContent=displayTitle(pair);$('source-size').textContent=`${pair.original.width} × ${pair.original.height} · ${pair.original.source_orientation==='portrait'?'P':'L'} · ${(pair.original.bytes/1048576).toFixed(2)} MB`;$('target-info').textContent=`${t('target')}: ${RATIOS[opposite(pair.original.source_orientation)]}`;}else{imageLoader.unbind($('source-preview'));$('target-info').textContent=t('selectFirst');}
  const gallery=$('gallery');gallery.replaceChildren();
  for(const p of pairs){const card=node('article',undefined,`card${p.pair_id===selected?' selected':''}`),preview=selectAsset(p,targetFrame(),'hd');const photo=button('',()=>openViewer(p.pair_id),'card-image'),img=node('img');bindImage(img,preview.asset,true);img.alt=displayTitle(p);img.loading='lazy';photo.setAttribute('aria-label',`${t('viewPair')}: ${displayTitle(p)}`);photo.append(img);card.append(photo);const body=node('div',undefined,'card-content');body.append(node('p',displayTitle(p),'card-title'));const meta=node('div',undefined,'card-meta');const paired=Boolean((p.variants.portrait.hd||verifiedFourK(p.variants.portrait.fourK))&&(p.variants.landscape.hd||verifiedFourK(p.variants.landscape.fourK)));meta.append(node('span',paired?`L + P · ${t('paired')}`:t('sourceOnly')),node('span',p.jobs.some(j=>j.status==='ACCEPTED'&&j.provider==='demo')?t('demo'):t('saved')));body.append(meta);const actions=node('div',undefined,'card-controls');actions.append(imageActionList(p,'create'));body.append(actions);card.append(body);gallery.append(card);}
  renderJobs();renderEnhancementFamilies();renderOwnGallery();renderBenchResults();const previous=$('compare-pair').value;$('compare-pair').replaceChildren();for(const p of pairs){const opt=node('option',displayTitle(p));opt.value=p.pair_id;$('compare-pair').append(opt);}if(pairs.some(p=>p.pair_id===previous))$('compare-pair').value=previous;else if(selected)$('compare-pair').value=selected;association();scoreSummary();updateEnhancementControls();renderBenchModels();
}

function resultProof(asset){if(!asset)return '';return canonicalMode(asset.mode)==='faithful'?t(asset.pixel_proof?.verified&&asset.pixel_proof.channel_difference_count===0?'pixelPass':'pixelUnknown'):t('creativeChanged');}
function resultLabel(asset){const model=modelFor(asset.model_key||asset.model);return `${model?.label||asset.model_or_version||asset.provider||t('unknown')} · ${t(canonicalMode(asset.mode)||'unknown')} · ${asset.width} × ${asset.height}`;}
function rememberResult(pair,asset,id){pair.candidates||=[];if(!pair.candidates.some(x=>x.sha256===asset.sha256))pair.candidates.push({...asset,candidate_id:id});}
function renderJobs(){const list=$('jobs');list.replaceChildren();const jobs=pairs.flatMap(p=>p.jobs.filter(j=>!j.enhancement_plan_id&&!['enhance','derive'].includes(j.operation)).map(j=>({p,j}))).sort((a,b)=>b.j.created_at.localeCompare(a.j.created_at));if(!jobs.length){list.append(node('p',t('noJobs'),'small muted'));return;}
 for(const {p,j} of jobs){const el=node('article',undefined,'job');el.dataset.jobId=j.job_id;const head=node('div',undefined,'job-header');head.append(node('strong',`${displayTitle(p)} → ${RATIOS[j.target]}`),node('span',t(j.status),`job-status${j.status==='RUNNING'?' running-dot':''}`));el.append(head,node('p',`${modelFor(j.model)?.label||j.model_or_version||j.provider} · ${t(canonicalMode(j.mode)||'unknown')} · ${j.quality||'hd'} · ${j.created_at.slice(11,19)}`));
 const cost=j.provider_cost===null||j.provider_cost===undefined?t('unknownCost'):`${j.provider_cost} ${j.cost_currency||'EUR'}`;el.append(node('p',`${j.latency_ms===undefined?'—':(j.latency_ms/1000).toFixed(1)+' s'} · ${cost}`,'small muted'));if(j.error)el.append(node('p',t(j.error),'small'));if(j.detail)el.append(node('p',`${j.provider_status||''} ${j.detail}`,'small'));
 const actions=node('div',undefined,'button-row');if(j.status==='READY'&&j.candidate){const img=node('img');bindImage(img,j.candidate);img.alt=t('candidate');img.loading='lazy';el.append(img,node('p',resultProof(j.candidate),'job-proof'),node('p',j.candidate.provider==='demo'?t('demo'):j.candidate.local_text_overlay?t('localText'):'','candidate-note'));actions.append(button(t('accept'),async()=>{const key=j.quality==='4k'?'fourK':'hd';if(key==='fourK'&&!verifiedFourK(j.candidate))throw Error('UNVERIFIED_4K');rememberResult(p,j.candidate,j.job_id);p.variants[j.target][key]=j.candidate;Object.assign(j,transition(j,'ACCEPTED'));j.output_sha256=j.candidate.sha256;j.result_receipt=publicManifest(j.candidate);delete j.candidate;await persist(p);if(j.gateway_job_id&&gateway){try{await api(`/api/jobs/${j.gateway_job_id}/accept`,{method:'POST',body:{}});j.gateway_accept_pending=false;}catch{j.gateway_accept_pending=true;}await putPair(p);}notify('accepted');}),button(t('reject'),async()=>{Object.assign(j,transition(j,'REJECTED'));rememberResult(p,j.candidate,j.job_id);delete j.candidate;await persist(p);notify('rejected');}));}
 if(['RUNNING','PENDING'].includes(j.status))actions.append(button(t('cancel'),async()=>{controllers.get(j.job_id)?.abort();if(j.gateway_job_id&&gateway)await api(`/api/jobs/${j.gateway_job_id}/cancel`,{method:'POST',body:{}});Object.assign(j,transition(j,'CANCELLED'));await persist(p);}));
 if(j.status==='HELD'&&j.gateway_job_id)actions.append(button(t('resume'),()=>runGateway(p,j)));if(['FAILED','REJECTED','CANCELLED','HELD','ACCEPTED'].includes(j.status))actions.append(button(t('regenerate'),()=>generate(p,{...j,job_id:undefined,created_at:undefined,gateway_job_id:undefined,generation_attempt_id:crypto.randomUUID()})));
 if(j.result_receipt||j.candidate)actions.append(button(t('receiptDownload'),()=>jsonDownload(publicManifest({job:j,result:j.candidate||j.result_receipt}),`${j.job_id}.receipt.json`),'text-button'));if(actions.children.length)el.append(actions);list.append(el);}
}

function refreshCreateModels(preserve=true){
 const select=$('pipeline'),previous=preserve?select.value:null;
 select.replaceChildren();
 for(const m of MODELS.filter(m=>m.direct&&prefs.enabledModels.includes(m.key))){const option=node('option',m.label);option.value=m.key;select.append(option);}
 select.value=[previous,prefs.model,prefs.enabledModels[0]].find(key=>key&&[...select.options].some(o=>o.value===key))||prefs.enabledModels[0];
}
function persistPrefs(){
 prefs=writeSettings(prefs,preferenceStorage,modelKeys);
 $('delay-quick').value=String(prefs.delaySeconds);
}
function rememberCreateChoice(){
 if(!prefs.rememberLast)return;
 prefs={...prefs,mode:$('mode').value,model:$('pipeline').value,quality:$('output-quality').value,position:$('position').value};
 try{persistPrefs();}catch{notify('STORAGE_OPERATION_FAILED',true);}
}
function settingsModelSelect(){
 const select=$('settings-model'),prior=select.value||prefs.model,enabled=[...$('settings-enabled-models').querySelectorAll('input:checked')].map(x=>x.value);
 select.replaceChildren();
 for(const key of enabled){const m=modelFor(key);if(!m)continue;const option=node('option',m.label);option.value=key;select.append(option);}
 if(select.options.length)select.value=enabled.includes(prior)?prior:enabled.includes(prefs.model)?prefs.model:enabled[0];
}
function renderSettingsUI(){
 renderEnhancementSettings();
 $('settings-mode').value=prefs.mode;$('settings-quality').value=prefs.quality;$('settings-position').value=prefs.position;
 $('settings-remember-last').checked=prefs.rememberLast;$('settings-collection').value=prefs.galleryCollection;
 $('settings-viewer-quality').value=prefs.viewerQuality;$('settings-delay').value=String(prefs.delaySeconds);
 $('settings-auto-metadata').checked=prefs.autoSyncMetadata;$('settings-preload-adjacent').checked=prefs.preloadAdjacent;
 const holder=$('settings-enabled-models');holder.replaceChildren();
 const health=readModelHealth(preferenceStorage);
 for(const model of MODELS.filter(m=>m.direct)){
  const label=node('label',undefined,'model-toggle'),input=node('input');input.type='checkbox';input.value=model.key;input.checked=prefs.enabledModels.includes(model.key);
  const content=node('span'),head=node('strong',model.label),recent=health[model.key],detail=node('small',recent?recent.lastStatus+' · '+recent.lastTask+' · '+new Date(recent.lastAt).toLocaleDateString(language):t('apiChecking'));
  content.append(head,detail);label.append(input,content);holder.append(label);
  input.addEventListener('change',settingsModelSelect);
 }
 settingsModelSelect();
 $('settings-error').textContent='';$('settings-api-status').textContent='';
}
function applySettings(){
 $('mode').value=prefs.mode;$('position').value=prefs.position;$('output-quality').value=prefs.quality;
 refreshCreateModels(false);$('pipeline').value=prefs.model;
 $('collection-filter').value=prefs.galleryCollection;$('delay-quick').value=String(prefs.delaySeconds);
 updateModelControls();renderOwnGallery();if(referenceLoaded)renderReference();
}
function saveSettingsFromDialog(event){
 event.preventDefault();const enabled=[...$('settings-enabled-models').querySelectorAll('input:checked')].map(x=>x.value);
 if(!enabled.length){$('settings-error').textContent=t('settingsAtLeastOne');return;}
 try{
  prefs=writeSettings({...prefs,enabledModels:enabled,mode:$('settings-mode').value,model:$('settings-model').value,
   quality:$('settings-quality').value,position:$('settings-position').value,rememberLast:$('settings-remember-last').checked,
   galleryCollection:$('settings-collection').value,viewerQuality:$('settings-viewer-quality').value,
   delaySeconds:Number($('settings-delay').value),autoSyncMetadata:$('settings-auto-metadata').checked,preloadAdjacent:$('settings-preload-adjacent').checked},preferenceStorage,modelKeys);
  enhancePrefs=writeEnhancementSettings({...enhancePrefs,tier:$('settings-enhance-tier').value,model:$('settings-enhance-model').value},preferenceStorage);if(enhancePrefs.tier==='premium'&&prefs.enabledModels.includes(enhancePrefs.model))prefs=writeSettings({...prefs,model:enhancePrefs.model},preferenceStorage,modelKeys);applyEnhancementControls();
  applySettings();$('settings-dialog').close();scheduleGalleryOrientation();if(viewerPair)updateViewer();
 }catch{ $('settings-error').textContent=t('STORAGE_OPERATION_FAILED');}
}
async function diagnoseStorage(){
 const estimate=await storageEstimate(),count=pairs.length,cloud=remotePairs.filter(r=>!pairs.some(p=>p.original.sha256===r.original.sha256)).length;
 const human=n=>n===null?'—':(n/1048576).toFixed(1)+' MiB';
 $('settings-storage-status').textContent=(estimate.supported?`${t('storageEstimate')}: ${human(estimate.usage)} / ${human(estimate.quota)} (≈${Math.round(100*estimate.usage/estimate.quota)}%)`:t('estimateUnavailable'))
  +` · ${t('storageLocal')}: ${count} · ${t('storagePending')}: ${cloud}`;
}
async function checkApiAccess(){
 const status=$('settings-api-status'),holder=$('settings-api-table'),check=$('settings-api-check');
 const active=[...$('settings-enabled-models').querySelectorAll('input:checked')].map(x=>x.value).filter(k=>modelKeys.includes(k));
 holder.hidden=true;holder.replaceChildren();
 if(!active.length){status.textContent=t('settingsNeedModel');return;}
 if(!API.apiUnlocked()){status.textContent=t('apiAuthNeeded');return;}
 check.disabled=true;status.textContent=t('apiCheckRunning');
 try{
  await API.request('/session'); // Actual authenticated session verification, not a stored-token assumption.
  const response=await API.request('/model-probe',{method:'POST',body:{models:active}});
  if(response.schema!=='bd.dualframe.provider-probes.v1'||!Array.isArray(response.models))throw Error('API_PROBE_RESPONSE_INVALID');
  const table=node('table',undefined,'api-check-table'),head=node('thead'),heading=node('tr'),tbody=node('tbody');
  for(const key of ['apiCheckModel','apiCheckStatus','apiCheckProbe'])heading.append(node('th',t(key)));
  head.append(heading);
  const words={MODEL_ACCESSIBLE:'apiModelAccessible',PROVIDER_REACHABLE:'apiProviderReachable',KEY_MISSING:'apiKeyMissing',AUTH_FAILED:'apiAuthFailed',PERMISSION_DENIED:'apiPermissionDenied',MODEL_NOT_FOUND:'apiModelNotFound',RATE_LIMITED:'apiRateLimited',PROVIDER_ERROR:'apiProviderError',NETWORK_ERROR:'apiNetworkError',PROBE_UNAVAILABLE:'apiProbeUnsupported',CATALOG_NOT_AVAILABLE:'apiCatalogUnavailable',PROBE_CONFIG_ERROR:'apiConfigError'};
  for(const item of response.models){
   const tr=node('tr'),label=modelFor(item.key)?.label||item.key,kind=item.probe==='read_only_model_get'?'GET · model':item.probe==='read_only_model_catalog'?'GET · catalog':'—';
   tr.append(node('td',label),node('td',t(words[item.status]||'apiProbeUnsupported')),node('td',kind));tbody.append(tr);
  }
  table.append(head,tbody);holder.append(table);holder.hidden=false;
  const verified=response.models.filter(x=>x.status==='MODEL_ACCESSIBLE').length;
  status.textContent=t('apiSessionValid')+' · '+verified+'/'+response.models.length+' '+t('apiCheckCount')+' · '+(language==='sl'?'Samo bralni klici, brez generacij.':'Read-only calls; no generation.');
 }catch(e){status.textContent=t(e.message==='UNAUTHORIZED'?'apiSessionFailed':'apiNetworkError');holder.hidden=true;}
 finally{check.disabled=false;}
}
function initSettingsUI(){
 $('delay-quick').value=String(prefs.delaySeconds);$('delay-quick').addEventListener('change',()=>{
  try{prefs.delaySeconds=Number($('delay-quick').value);persistPrefs();scheduleGalleryOrientation();if(viewerPair)updateViewer();}catch{notify('STORAGE_OPERATION_FAILED',true);}
 });
 $('settings-open').addEventListener('click',()=>{renderSettingsUI();$('settings-dialog').showModal();diagnoseStorage().catch(()=>{});});
 $('settings-close').addEventListener('click',()=>{renderBenchModels();$('settings-dialog').close();});
 $('settings-form').addEventListener('submit',saveSettingsFromDialog);
 $('settings-profile-apply').addEventListener('click',()=>{
  const profile=$('settings-profile').value,mode=profile==='photo'?'faithful':profile==='text'?'infographic':'smart';
  $('settings-mode').value=mode;$('settings-quality').value='hd';$('settings-position').value='center';
 });
 $('settings-api-check').addEventListener('click',checkApiAccess);
 $('settings-storage-check').addEventListener('click',()=>diagnoseStorage());
 $('settings-clear-memory').addEventListener('click',()=>{
  clearWarmImages();imageLoader.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();urlCache=new WeakMap();
  render();if(referenceLoaded)renderReference();if(viewerPair)updateViewer();diagnoseStorage();
 });
 for(const id of ['mode','pipeline','position','output-quality'])$(id).addEventListener('change',rememberCreateChoice);
}
function updateModelControls(){
 const mode=canonicalMode($('mode').value)||'smart',newImage=$('create-kind').value==='generate';
 $('text-generation-options').hidden=!newImage;$('mode-note').textContent=t(mode+'Note');$('text-fields').hidden=mode!=='infographic';$('gateway-fields').hidden=true;
 for(const option of $('pipeline').options){const m=modelFor(option.value);option.disabled=!supportsMode(option.value,mode)||(!newImage&&m?.edit===false)||(newImage&&m?.provider==='demo');}
 if($('pipeline').selectedOptions[0]?.disabled)$('pipeline').value=[...$('pipeline').options].find(o=>!o.disabled)?.value||prefs.enabledModels[0];
 const model=modelFor($('pipeline').value);$('output-quality').options[1].disabled=model.provider==='demo';if(model.provider==='demo'&&$('output-quality').value==='4k')$('output-quality').value='hd';
 const known=capabilities?.models?.find(x=>x.key===model.key),status=model.provider==='demo'?t('localSimulation'):known?(known.available?t('configured'):t('missingKey')):t('apiChecking');
 $('model-status').textContent=`${model.label} · ${status}${(model.max_edge&&model.max_edge<3840||!newImage&&model.edit_max_edge&&model.edit_max_edge<3840)&&$('output-quality').value==='4k'?' · '+t('scaled4K'):''}${model.reference_type?' · '+t('characterReference'):''}`;
 updateEnhancementControls();
 $('model-status').classList.toggle('held',known?.available===false);$('generate').disabled=enhancementBusy||creationBusy||(!selectedPair()&&!newImage);updateAuthLabel();renderBenchModels();
}

async function generate(pair=selectedPair(),frozen=null){if(!pair)return;const initialModel=modelFor(frozen?.model||$('pipeline').value);if(initialModel?.direct){const source=pair.original.sha256;frozen=frozen||{model:initialModel.key,mode:$('mode').value,position:$('position').value,quality:$('output-quality').value,seed:Number($('seed').value),user_prompt:$('prompt').value,direction_style:$('direction-style').value,text_layout:{headline:$('headline-text').value,body:$('body-text').value}};await connectGateway();pair=pairs.find(p=>p.original.sha256===source);if(!pair)throw Error('STORAGE_OWNER_CHANGED');}await ensurePair(pair);const seed=frozen?.seed??Number($('seed').value);if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw Error('INVALID_SEED');const model=modelFor(frozen?.model||(frozen?.provider==='demo'?'demo':frozen?.provider==='bria'?'bria-direct':$('pipeline').value))||modelFor('demo'),mode=canonicalMode(frozen?.mode||$('mode').value);if(!supportsMode(model.key,mode))throw Error('MODEL_MODE_UNSUPPORTED');const target=opposite(pair.original.source_orientation),quality=frozen?.quality||$('output-quality').value;if(model.provider==='demo'&&quality==='4k')throw Error('DEMO_4K_UNAVAILABLE');
 const text=frozen?.text_layout||{headline:$('headline-text').value.trim(),body:$('body-text').value.trim()};if(mode==='infographic'&&!text.headline&&!text.body)throw Error('BODY_REQUIRED');const basePrompt=(frozen?.user_prompt??$('prompt').value),style=frozen?.direction_style||$('direction-style').value;const prompt=(frozen?.prompt??`${style==='cinematic'?'Cinematic atmosphere. ':style==='minimal'?'Minimal calm surroundings. ':''}${mode==='infographic'?'Create a clean visual background with space for a readable text overlay. Do not draw any text. ':''}${basePrompt}`);if(prompt.length>1500)throw Error('PROMPT_TOO_LONG');
 const params={input_sha256:pair.original.sha256,target,target_ratio:RATIOS[target],mode,position:frozen?.position||$('position').value,prompt,user_prompt:basePrompt,direction_style:style,seed,provider:model.provider,model:model.key,model_or_version:model.endpoint,quality,parameters:{},text_layout:mode==='infographic'?text:null,upload_consent:model.provider==='demo'?{external:false}:{external:$('consent').checked,provider:model.provider,model:model.key,at:new Date().toISOString()}};
 const placement=taskGeometry(pair.original.width,pair.original.height,target,params.position,mode,quality),task_parameters_hash=await sha256(JSON.stringify({source:params.input_sha256,target,mode,position:params.position,prompt,quality,seed,parameters:params.parameters,text:params.text_layout}));const key=await jobIdempotencyKey(params,frozen?.generation_attempt_id??null);if(pair.jobs.some(j=>j.idempotency_key===key&&['PENDING','RUNNING'].includes(j.status))){notify('jobRunning');return;}
 const job={...params,generation_attempt_id:frozen?.generation_attempt_id??null,task_parameters_hash,job_id:crypto.randomUUID(),idempotency_key:key,status:'PENDING',created_at:new Date().toISOString(),provider_cost:model.provider==='demo'?0:null,cost_currency:model.provider==='demo'?'EUR':null,provider_request_id:null,source_placement:placement};pair.jobs.push(job);await persist(pair);
 if(job.provider!=='demo'){try{if(!pairs.includes(pair))throw Error('STORAGE_OWNER_CHANGED');await runGateway(pair,job);}catch(e){if(!pairs.includes(pair))throw e;job.status=e.message==='AUTH_CANCELLED'?'CANCELLED':'FAILED';job.error=e.message;await persist(pair);}return;}await runDemo(pair,job);
}
async function localTextOverlay(asset,layout){if(!layout)return asset;const image=await createImageBitmap(asset.blob),canvas=document.createElement('canvas');canvas.width=asset.width;canvas.height=asset.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);image.close();const pad=Math.round(canvas.width*.055),width=canvas.width-pad*2,titleSize=Math.round(Math.min(canvas.width,canvas.height)*.047),bodySize=Math.round(titleSize*.57);
 const lines=(text,size,weight)=>{ctx.font=`${weight} ${size}px system-ui, sans-serif`;const all=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;let parts=[word];if(ctx.measureText(word).width>width){parts=[];let part='';for(const ch of word){if(ctx.measureText(part+ch).width>width&&part){parts.push(part);part='';}part+=ch;}if(part)parts.push(part);}for(const part of parts){const next=line?line+' '+part:part;if(ctx.measureText(next).width>width&&line){all.push(line);line=part;}else line=next;}}all.push(line);}return all;};
 let title=lines(layout.headline,titleSize,700),body=lines(layout.body,bodySize,400);const block=pad*2+title.length*titleSize*1.25+body.length*bodySize*1.45;let fontScale=Math.min(1,(canvas.height*.48)/Math.max(1,block));const ts=Math.max(16,Math.round(titleSize*fontScale)),bs=Math.max(12,Math.round(bodySize*fontScale));title=lines(layout.headline,ts,700);body=lines(layout.body,bs,400);const h=pad*2+title.length*ts*1.25+body.length*bs*1.45,y=canvas.height-h-pad;ctx.fillStyle='rgba(7,20,24,.91)';ctx.fillRect(pad*.5,y-pad*.4,canvas.width-pad,h+pad*.8);ctx.textBaseline='top';let top=y;ctx.font=`700 ${ts}px system-ui,sans-serif`;ctx.fillStyle='#eff3df';for(const line of title){ctx.fillText(line,pad,top,width);top+=ts*1.25;}top+=bs*.4;ctx.font=`400 ${bs}px system-ui,sans-serif`;ctx.fillStyle='#d5e2dc';for(const line of body){ctx.fillText(line,pad,top,width);top+=bs*1.45;}const blob=await toBlob(canvas),hash=await sha256(blob);return {...asset,blob,sha256:hash,path:`variants/${asset.direction}/${hash}.png`,local_text_overlay:{...layout,renderer:'canvas-text-v1',font:'system-ui',exact_text_preserved:true},parent_output_sha256:asset.sha256,provenance_verified:false,provenance_basis:'local-text-overlay-on-recorded-parent',resolution_origin:asset.resolution_origin==='simulation'?'simulation':verifiedFourK(asset)?'provider-native-composite':'local-composite',native_4k:verifiedFourK(asset),resolution_verified:verifiedFourK(asset),changed_region:'whole-frame-creative-with-local-text'};
}
async function runDemo(pair,job){const jobId=job.job_id;await ensurePair(pair);job=pair.jobs.find(item=>item.job_id===jobId)||job;const controller=new AbortController();controllers.set(job.job_id,controller);if(job.status==='PENDING')Object.assign(job,transition(job,'RUNNING'));await persist(pair);const started=performance.now();try{const candidate=await mockExpand(pair,job,controller.signal);if(job.status==='CANCELLED'||!pairs.includes(pair))return;job.candidate=await localTextOverlay({...candidate,mode:job.mode,model_key:job.model,task_parameters_hash:job.task_parameters_hash},job.mode==='infographic'?job.text_layout:null);job.latency_ms=Math.round(performance.now()-started);Object.assign(job,transition(job,'READY'));}catch(e){if(job.status!=='CANCELLED'){Object.assign(job,transition(job,e.message==='CANCELLED'?'CANCELLED':'FAILED'));job.error=e.message;}}finally{controllers.delete(job.job_id);if(pairs.includes(pair))await persist(pair);}}
async function api(path,options={}){return API.compatibleAPI(path,options);}
async function connectGateway(){await API.ensureAuth(language);await accountTransition;gateway={url:API.API_BASE,version:'v3'};capabilities=await API.capabilities();updateModelControls();return gateway;}

async function runGateway(pair,job){
 const jobId=job.job_id;await ensurePair(pair);job=pair.jobs.find(item=>item.job_id===jobId)||job;
 const controller=new AbortController();controllers.set(job.job_id,controller);
 try{
  await connectGateway();if(!pairs.includes(pair))throw Error('STORAGE_OWNER_CHANGED');const client=API.captureAPI(),disk=captureStorageScope();
  const safePersist=async value=>{await disk.putPair(value);await disk.getPairs();render();};
  if(!pair.upload_id||pair.gateway_version!=='v3'){const uploaded=await client.uploadPair(pair);if(uploaded.original.sha256!==pair.original.sha256)throw Error('INPUT_HASH_MISMATCH');pair.upload_id=uploaded.pair_id;pair.gateway_version='v3';await safePersist(pair);}
  if(!job.gateway_job_id){const receipt=await client.request('/expand',{method:'POST',body:{pair_id:pair.upload_id,idempotency_key:job.idempotency_key,input_sha256:job.input_sha256,target:job.target,mode:job.mode,position:job.position,prompt:job.prompt,seed:job.seed,provider:job.provider,model:job.model,quality:job.quality||'hd',task_parameters_hash:job.task_parameters_hash,text_layout:job.text_layout||null}});job.gateway_job_id=receipt.job_id;}
  job.status='RUNNING';delete job.error;await safePersist(pair);
  const state=await client.awaitJob(job.gateway_job_id,{signal:controller.signal});
  if(['READY','ACCEPTED'].includes(state.status)){
   const blob=await client.asset(state.output.asset_id),hash=await sha256(blob);if(hash!==state.output.sha256)throw Error('OUTPUT_HASH_MISMATCH');const n=await normalizedImage(blob);
   if(n.width!==state.output.width||n.height!==state.output.height)throw Error('OUTPUT_DIMENSION_MISMATCH');
   if(job.mode==='faithful'){const proof=await verifySavedProtectedPixels(pair.original.normalized,blob,state.output.source_placement,pair.original.sha256);if(!proof.verified)throw Error('PROTECTED_PIXELS_CHANGED');state.output.pixel_proof=proof;}
   job.candidate=await localTextOverlay({...state.output,blob,path:`variants/${job.target}/${hash}.png`,source_sha256:pair.original.sha256,direction:job.target,target_ratio:job.target_ratio,review_scale_policy:'equal-canvas-v1',lineage_status:state.output.normalization_proof?.verified?'SOURCE_VERIFIED':'NORMALIZED_SOURCE_VERIFIED',provider:job.provider,mode:job.mode,model_key:job.model,task_parameters_hash:job.task_parameters_hash,provenance_verified:state.output.normalization_proof?.verified===true,provenance_basis:'authenticated-gateway-response',provenance_evidence:{source_sha256:pair.original.sha256,output_sha256:hash},origin:'generated'},job.mode==='infographic'?job.text_layout:null);
   job.status='READY';job.provider_request_id=state.provider_request_id;job.provider_cost=state.provider_cost;job.cost_currency=state.cost_currency;job.provider_parameters=state.provider_parameters;job.latency_ms=state.latency_ms;rememberResult(pair,job.candidate,job.job_id);
  }else{job.status=state.status;job.error=state.error||state.status;job.detail=state.detail||'';job.provider_status=state.provider_status;}
  await safePersist(pair);
 }catch(e){if(!pairs.includes(pair)||['AUTH_SESSION_CHANGED','STORAGE_OWNER_CHANGED'].includes(e.message))return;if(job.status!=='CANCELLED'){job.status=e.message==='CANCELLED'?'CANCELLED':job.gateway_job_id?'HELD':'FAILED';job.error=e.message;await persist(pair);notify(e.message,true);}}finally{controllers.delete(job.job_id);if(job.gateway_job_id&&['READY','ACCEPTED','FAILED'].includes(job.status))recordModelHealth(job.model,'expand',job.status,preferenceStorage);}
}

const viewerPairData=()=>[...pairs,...referencePairs].find(p=>p.pair_id===viewerPair);
function swapViewerFrame(){
 const pair=viewerPairData();if(!pair)return;
 const chosen=$('viewer-orientation').value,shown=chosen==='portrait'||chosen==='landscape'?chosen:($('viewer-image').dataset.orientation||pair.original.source_orientation);
 const next=shown==='portrait'?'landscape':'portrait';
 // This is an explicit comparison: do not apply the automatic rotation delay.
 $('viewer-orientation').value=next;
 clearTimeout(viewerFrameTimer);viewerFrameTimer=null;viewerShownPair=pair.pair_id;viewerShownTarget=next;
 const state=selectAsset(pair,next,$('quality').value,devicePixelRatio);
 if(state.missing)notify('frameNotSaved');
 updateViewer();
}

function openViewer(id){clearTimeout(viewerFrameTimer);viewerFrameTimer=null;viewerShownPair=null;viewerShownTarget=null;viewerPair=id;originFocus=document.activeElement;originScroll=window.scrollY;$('viewer-orientation').value='auto';$('quality').value=prefs.viewerQuality;$('viewer').showModal();document.body.classList.add('viewer-open');$('viewer-floating-close').focus();positionMobileClose();updateViewer();}
function closeViewer(){if(!$('viewer').open)return;clearTimeout(viewerFrameTimer);viewerFrameTimer=null;viewerShownTarget=null;viewerShownPair=null;stopTour();setImmersive(false);if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});++viewerLoad;clearWarmImages();imageLoader.unbind($('viewer-image'));$('viewer').close();}
function setImmersive(on){document.querySelector('.viewer-shell').classList.toggle('immersive',on);document.body.classList.toggle('immersion-open',on);$('viewer-stage').setAttribute('aria-label',on?t('immersiveExit'):t('immersiveHint'));if(!on&&document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});positionMobileClose();requestAnimationFrame(()=>{if(viewerPair)updateViewer();});}
function positionMobileClose(){
 const button=$('viewer-floating-close'),visual=window.visualViewport;
 if(!button||!$('viewer').open)return;
 if(!matchMedia('(max-width:700px)').matches){button.style.removeProperty('left');button.style.removeProperty('top');button.style.removeProperty('right');button.style.removeProperty('transform');return;}
 const scale=Math.max(1,Number(visual?.scale)||1),left=visual?.offsetLeft||0,top=visual?.offsetTop||0,width=visual?.width||innerWidth;
 button.style.right='auto';
 button.style.left='calc('+Math.max(8,left+width-56/scale-12)+'px - env(safe-area-inset-right))';
 button.style.top='calc('+Math.max(8,top+12)+'px + env(safe-area-inset-top))';
 button.style.transform='scale('+(1/scale)+')';
}
async function updateViewer(){const pair=viewerPairData();if(!pair)return;const token=++viewerLoad,simulation=activeView==='showcase'||pair.reference_only?$('reference-device').value:$('device').value;const target=deviceOrientation({device:currentDevice(),width:innerWidth,height:innerHeight,override:$('viewer-orientation').value,simulation});
 if(pair.reference_only){const wanted=$('quality').value==='4k'||($('quality').value==='auto'&&devicePixelRatio>1.5)?'fourK':'hd';const asset=pair.variants[target==='original'?pair.original.source_orientation:target]?.[wanted];if(asset){try{await verifyReferenceAsset(asset);}catch(e){if(token===viewerLoad)notify(e.message,true);}if(token!==viewerLoad)return;}}
 const state=selectAsset(pair,target,$('quality').value,devicePixelRatio),img=$('viewer-image');await imageLoader.bind(img,state.asset,false,true);if(token!==viewerLoad)return;img.alt=`${displayTitle(pair)} · ${state.orientation}`;img.dataset.pairId=pair.pair_id;img.dataset.orientation=state.orientation;img.dataset.quality=state.quality;$('viewer-title').textContent=displayTitle(pair);
 const swapTitle=target==='portrait'?t('switchLandscape'):t('switchPortrait');$('viewer-swap').setAttribute('aria-label',swapTitle);$('viewer-swap').title=swapTitle;
 const label=pair.reference_only?t('referenceProvided'):state.asset.origin==='demo'?t('demo'):state.asset.origin==='original'?t('original'):state.asset.origin==='imported'?t('importedFrame'):state.upscaled?t('upscaled'):state.asset.native_4k?t('native'):t('creativeChanged');$('viewer-status').textContent=`${state.orientation==='portrait'?'P':'L'} · ${state.asset.width} × ${state.asset.height} · ${state.quality.toUpperCase()} · ${label}${state.missing?' · '+t('missing'):''}`;
 $('download-original').disabled=Boolean(pair.reference_only);$('download-landscape').disabled=!collectOrientationAssets(pair,'landscape').length;$('download-portrait').disabled=!collectOrientationAssets(pair,'portrait').length;$('mask').disabled=!state.asset.source_placement||canonicalMode(state.asset.mode)!=='faithful';$('result-details').textContent=JSON.stringify(publicManifest({task:state.asset.mode||null,model:state.asset.provider_model_id||state.asset.model_or_version||null,size:[state.asset.width,state.asset.height],resolution_origin:state.asset.resolution_origin,sha256:state.asset.sha256||null,pixel_proof:state.asset.pixel_proof||null,changed_region:state.asset.changed_region||null,parameters:state.asset.parameters||null,provider_cost:state.asset.provider_cost??null,reference_only:Boolean(pair.reference_only),text_overlay:state.asset.local_text_overlay||null}),null,2);drawBoundary(state);
}
function drawBoundary(state){const boundary=$('source-boundary'),p=state.asset.source_placement;boundary.hidden=$('mask').getAttribute('aria-pressed')!=='true'||!p||canonicalMode(state.asset.mode)!=='faithful';if(boundary.hidden)return;const stage=$('viewer-stage'),scale=Math.min(stage.clientWidth/state.asset.width,stage.clientHeight/state.asset.height),dx=(stage.clientWidth-state.asset.width*scale)/2,dy=(stage.clientHeight-state.asset.height*scale)/2;Object.assign(boundary.style,{left:`${dx+p.x*scale}px`,top:`${dy+p.y*scale}px`,width:`${p.source_width*scale}px`,height:`${p.source_height*scale}px`});}
function moveViewer(delta){const items=viewerPairData()?.reference_only?referencePairs:pairs;const index=items.findIndex(p=>p.pair_id===viewerPair);viewerPair=items[(index+delta+items.length)%items.length]?.pair_id;updateViewer();}
function download(blob,filename){const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download=safeName(filename);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function jsonDownload(data,name){download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);}

function archiveSlug(value,fallback,max=40){const slug=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^[-_]+|[-_]+$/g,'').slice(0,max);return slug||fallback;}
function archiveExtension(asset){const type=String(asset.blob?.type||'').toLowerCase();if(type==='image/jpeg'||type==='image/jpg')return 'jpg';if(type==='image/png')return 'png';if(type==='image/webp')return 'webp';if(type==='image/avif')return 'avif';if(type==='image/gif')return 'gif';const path=String(asset.path||asset.filename||'');const match=path.match(/\.(png|jpe?g|webp|avif|gif)$/i);return match?match[1].toLowerCase().replace('jpeg','jpg'):'png';}
async function downloadAllVariants(direction){const p=await ensurePair(viewerPairData());if(!p)return;const control=$(`download-${direction}`);control.disabled=true;try{let variants=collectOrientationAssets(p,direction);for(const row of variants)if(!row.asset.blob)await verifyReferenceAsset(row.asset);variants=collectOrientationAssets(p,direction);if(!variants.length)throw Error('zipEmpty');const base=archiveSlug(safeName(displayTitle(p)).replace(/\.[^.]+$/,''),'image',48),used=new Set(),files=[];for(let i=0;i<variants.length;i++){const row=variants[i],asset=row.asset;if(!asset.blob)throw Error('zipFailed');const model=modelFor(asset.model_key||asset.model)?.label||asset.model_or_version||asset.provider||'variant',quality=row.quality||asset.quality||(asset.native_4k?'4k':'output'),hash=String(asset.sha256||'').toLowerCase(),suffix=/^[a-f0-9]{12,}$/.test(hash)?hash.slice(0,12):archiveSlug(asset.candidate_id||`v${i+1}`,`v${i+1}`,12),stem=`${base}_${direction}_${archiveSlug(model,'variant',36)}_${archiveSlug(quality,'output',16)}_${suffix}`;let name=`${stem}.${archiveExtension(asset)}`,n=2;while(used.has(name))name=`${stem}_${n++}.${archiveExtension(asset)}`;used.add(name);files.push({name,blob:asset.blob});}const archive=await zipStore(files);download(archive,`${base}_${direction}_all.zip`);notify('zipDone');}catch(error){if(error.message==='ZIP_TOO_LARGE'||error.message==='ZIP_TOO_MANY_FILES')throw Error('zipTooLarge');if(error.message?.startsWith('ZIP_')||error.message==='REFERENCE_UNAVAILABLE'||error.message==='REFERENCE_DIMENSION_MISMATCH')throw Error('zipFailed');throw error;}finally{if(viewerPairData())updateViewer();}}
function comparisonCandidates(pair){if(!pair)return [];const mode=$('compare-task').value,items=[...(pair.candidates||[]),...Object.values(pair.variants).flatMap(x=>Object.values(x)),pair.web_output,pair.reference_output].filter(x=>x&&x.origin!=='original'&&(canonicalMode(x.mode)===mode||!canonicalMode(x.mode))),seen=new Set();return items.filter(x=>{if(seen.has(x.sha256))return false;seen.add(x.sha256);return true;});}
function chosenCandidates(){const p=comparePair(),items=comparisonCandidates(p);return {p,web:items.find(x=>x.sha256===$('candidate-a').value),reference:items.find(x=>x.sha256===$('candidate-b').value)};}

function association(){const p=comparePair();if(!p){$('association-status').textContent='';return;}const items=comparisonCandidates(p);for(const id of ['candidate-a','candidate-b']){const old=$(id).value;$(id).replaceChildren();const none=node('option',t('selectCandidate'));none.value='';$(id).append(none);for(const a of items){const opt=node('option',resultLabel(a));opt.value=a.sha256;$(id).append(opt);}if(items.some(a=>a.sha256===old))$(id).value=old;}if(!$('candidate-a').value&&items[0])$('candidate-a').value=items[0].sha256;if(!$('candidate-b').value&&items[1])$('candidate-b').value=items[1].sha256;$('association-status').textContent=`${t('sourceHash')}: ${p.original.sha256}\n${t($('compare-task').value)} · ${items.length} ${t('candidate')} · ${t('localRetention')}`;}
async function importOutput(file,kind){const p=comparePair();if(!p)throw Error('selectFirst');if(file.size>MAX_BYTES)throw Error('SIZE_LIMIT');const bytes=await file.arrayBuffer();headerSize(bytes);const n=await normalizedImage(file);const output={blob:new Blob([bytes],{type:sniff(bytes)}),sha256:await sha256(bytes),width:n.width,height:n.height,direction:orientation(n.width,n.height),target_ratio:RATIOS[orientation(n.width,n.height)],source_sha256:null,lineage_status:'SOURCE_UNVERIFIED',origin:'imported',provider:kind==='web'?'web-import':'gpt-work-import',model_or_version:'UNKNOWN',review_scale_policy:'equal-canvas-v1',filename:safeName(file.name),imported_at:new Date().toISOString(),kind,mode:$('compare-task').value,task_parameters_hash:null,provenance_verified:false};p[kind==='web'?'web_output':'reference_output']=output;p.references.push({kind,output_sha256:output.sha256,lineage_status:'SOURCE_UNVERIFIED'});await persist(p);notify('imported');}
async function importSidecar(file){if(file.size>100000)throw Error('badSidecar');const s=JSON.parse(await file.text()),p=comparePair();if(!p||!['web','reference'].includes(s.kind))throw Error('badSidecar');const out=p[s.kind==='web'?'web_output':'reference_output'];if(!out||s.source_sha256!==p.original.sha256||s.output_sha256!==out.sha256||s.direction!==out.direction||s.target_ratio!==RATIOS[out.direction]||s.review_scale_policy!=='equal-canvas-v1'||typeof s.provider!=='string'||typeof s.model_or_version!=='string')throw Error('badSidecar');Object.assign(out,{mode:canonicalMode(s.mode)||null,task_parameters_hash:/^[a-f0-9]{64}$/.test(s.task_parameters_hash||'')?s.task_parameters_hash:null,provenance_verified:false,source_sha256:s.source_sha256,lineage_status:'DECLARED_SAME_SOURCE',target_ratio:s.target_ratio,provider:s.provider.slice(0,80),model_or_version:s.model_or_version.slice(0,80),provenance_basis:'uploader-sidecar-with-exact-input-and-output-hashes',provider_cost:typeof s.provider_cost==='number'&&s.provider_cost>=0?s.provider_cost:null,latency_ms:typeof s.latency_ms==='number'&&s.latency_ms>=0?s.latency_ms:null,cost_currency:['USD','EUR'].includes(s.cost_currency)?s.cost_currency:null});await persist(p);notify('declared');}
async function reviewId(original,a,b,seed,mode){return sha256([original,a,b,seed,'equal-canvas-v1',canonicalMode(mode)||'unknown','task-rubric-r3'].join('|'));}
async function beginReview(){await ensurePair(comparePair());const {p,web,reference}=chosenCandidates();if(web&&reference&&web.sha256===reference.sha256)throw Error('SAME_CANDIDATE');if(!p||!web||!reference){notify('missingCompare',true);return;}
  const order=await blindOrder(p.pair_id,p.comparison_seed,[web.sha256,reference.sha256]),id=await reviewId(p.original.sha256,web.sha256,reference.sha256,p.comparison_seed,$('compare-task').value);
  if(reviewState?.comparison_id!==id){$('metrics').replaceChildren();$('score-form').reset();}
  reviewState={pair:p,web,reference,order,comparison_id:id,eligibility:comparisonEligibility(p,web,reference),locked:scores.find(s=>s.comparison_id===id)||null};$('review').hidden=false;$('compare-empty').hidden=true;$('review-zoom').value='100';renderReview();await updateBaseline();$('review').scrollIntoView({block:'start',behavior:'smooth'});}
function renderReview(){if(!reviewState)return;const r=reviewState;$('eligibility').textContent=t(r.eligibility.eligible?'sourceVerified':'illustrative');bindImage($('review-original'),r.pair.original,true);bindImage($('review-a'),r[r.order[0]]);bindImage($('review-b'),r[r.order[1]]);for(const id of ['review-a','review-b'])$(''+id).style.transform=`scale(${Number($('review-zoom').value)/100})`;
  const view=$('review-view').value;$('a-figure').hidden=view==='b';$('b-figure').hidden=view==='a';document.querySelector('.review-images').classList.toggle('toggle',view!=='side');
  const metrics=$('metrics');const existing=Object.fromEntries([...metrics.querySelectorAll('select')].map(x=>[x.name,x.value]));metrics.replaceChildren();const head=node('div',undefined,'metric metric-head');head.append(node('span',''),node('span','A'),node('span','B'));metrics.append(head);for(const key of comparisonRubric($('compare-task').value)){const row=node('div',undefined,'metric');row.append(node('span',t(key)));for(const label of ['A','B']){const select=node('select');select.name=key+label;select.setAttribute('aria-label',`${t(key)} ${label}`);for(let i=1;i<=5;i++){const opt=node('option',String(i));opt.value=String(i);select.append(opt);}select.value=r.locked?.scores[key+label]||existing[key+label]||'3';select.disabled=Boolean(r.locked);row.append(select);}metrics.append(row);}
  $('score-submit').disabled=Boolean(r.locked);$('score-note').disabled=Boolean(r.locked);$('preference').disabled=Boolean(r.locked);if(r.locked){$('preference').value=r.locked.preference;$('score-note').value=r.locked.note;$('reveal').textContent=`${t('scoreLocked')} A: ${r[r.order[0]].provider} / ${r[r.order[0]].model_or_version}; B: ${r[r.order[1]].provider} / ${r[r.order[1]].model_or_version}. ${r.eligibility.reasons.join(', ')}`;}else{$('reveal').textContent='';}
}
async function updateBaseline(){if(!reviewState)return;const blob=await baseline(reviewState.pair,opposite(reviewState.pair.original.source_orientation),$('baseline-mode').value);bindImage($('baseline-image'),{blob});}
async function submitScore(event){event.preventDefault();if(!reviewState||reviewState.locked)return;const r=reviewState,score={schema:'bd.dualframe.comparison.v1',mode:$('compare-task').value,rubric:comparisonRubric($('compare-task').value),method_group:r.eligibility.method_group,comparison_id:r.comparison_id,created_at:new Date().toISOString(),pair_id:r.pair.pair_id,original_sha256:r.pair.original.sha256,direction:opposite(r.pair.original.source_orientation),target_ratio:RATIOS[opposite(r.pair.original.source_orientation)],review_scale_policy:'equal-canvas-v1',randomization_seed:r.pair.comparison_seed,label_order:r.order,eligible:r.eligibility.eligible,classification:r.eligibility.classification,exclusion_reasons:r.eligibility.reasons,scores:Object.fromEntries(new FormData(event.target)),preference:$('preference').value,note:$('score-note').value,outputs:{web:publicManifest(r.web),reference:publicManifest(r.reference)},baseline:[$('baseline-mode').value],locked:true};await addScore(score);scores.push(score);r.locked=score;renderReview();scoreSummary();}
function scoreSummary(){ $('task-summary').replaceChildren();for(const mode of ['faithful','smart','infographic']){const records=scores.filter(x=>canonicalMode(x.mode)===mode);const box=node('div');box.append(node('strong',t(mode)),node('p',`${records.length} ${t('scores')} · ${records.filter(x=>x.eligible).length} ${t('eligible')}`));$('task-summary').append(box);} $('score-summary').textContent=`${scores.length} ${t('scores')} · ${scores.filter(s=>s.eligible).length} ${t('eligible')} · ${scores.filter(s=>!s.eligible).length} ${t('ILLUSTRATIVE_ONLY')}`;}
async function encodeBlob(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {base64:btoa(binary),mime:blob.type};}
async function encodeObject(value){if(value instanceof Blob)return encodeBlob(value);if(Array.isArray(value))return Promise.all(value.map(encodeObject));if(value&&typeof value==='object'){const out={};for(const [key,v] of Object.entries(value)){if(['upload_id','gateway_job_id','url'].includes(key))continue;out[key]=await encodeObject(v);}return out;}return value;}
function serializedBlobBytes(value){if(value?.__df_blob===1)return value.size;if(value instanceof Blob)return value.size;if(Array.isArray(value))return value.reduce((n,v)=>n+serializedBlobBytes(v),0);if(value&&typeof value==='object')return Object.values(value).reduce((n,v)=>n+serializedBlobBytes(v),0);return 0;}
async function exportBackup(){if(serializedBlobBytes(pairs)>40*1048576){const disk=captureStorageScope(),blob=await archiveBackup(pairs,scores,{getBlob:disk.getStoredBlob,onProgress:p=>{$('notice').textContent=t('backupProgress')+' '+p.done+'/'+p.total;$('notice').hidden=false;}});download(blob,'DualFrame-private-backup.zip');notify('backupDone');return;}const full=[];for(const pair of pairs)full.push(await hydratePair(pair));const payload={schema:'bd.dualframe.backup.v1',pairs:full,scores};if(serializedBlobBytes(payload)>40*1048576)throw Error('BACKUP_LIMIT');const data=await encodeObject(payload),blob=new Blob([JSON.stringify(data)],{type:'application/json'});if(blob.size>64*1048576)throw Error('BACKUP_LIMIT');download(blob,'DualFrame-private-backup.json');notify('backupDone');}
function decodeObject(value){if(value&&typeof value==='object'&&typeof value.base64==='string'){const raw=atob(value.base64);if(raw.length>32*1048576)throw Error('INVALID_BACKUP');return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:value.mime});}if(Array.isArray(value))return value.map(decodeObject);if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype','upload_id','gateway_job_id','url'].includes(k))continue;out[k]=decodeObject(v);}return out;}return value;}
async function restoreBackup(file){await accountTransition;const disk=captureStorageScope(),archive=new DataView(await file.slice(0,4).arrayBuffer()).getUint32(0,true)===0x04034b50;if(!archive&&file.size>64*1048576)throw Error('BACKUP_LIMIT');const data=archive?await readArchiveBackup(file):decodeObject(JSON.parse(await file.text()));if(data.schema!=='bd.dualframe.backup.v1'||!Array.isArray(data.pairs)||new Set([...pairs,...data.pairs].map(p=>p.original?.sha256)).size>MAX_ORIGINALS)throw Error('INVALID_BACKUP');
  for(const p of data.pairs){checkPair(p);for(const a of [...(p.candidates||[]),...Object.values(p.variants).flatMap(x=>Object.values(x)),p.web_output,p.reference_output].filter(Boolean)){a.provenance_verified=false;a.provenance_basis='restored-backup-unverified';}if(!(p.original.blob instanceof Blob)||await sha256(p.original.blob)!==p.original.sha256)throw Error('INVALID_BACKUP');headerSize(await p.original.blob.arrayBuffer());p.original.normalized=(await normalizedImage(p.original.blob)).blob;for(const v of Object.values(p.variants))for(const a of Object.values(v)){if(!(a.blob instanceof Blob)||await sha256(a.blob)!==a.sha256)throw Error('INVALID_BACKUP');const n=await normalizedImage(a.blob);if(n.width!==a.width||n.height!==a.height)throw Error('INVALID_BACKUP');}for(const k of ['web_output','reference_output'])if(p[k]&&(!(p[k].blob instanceof Blob)||await sha256(p[k].blob)!==p[k].sha256))throw Error('INVALID_BACKUP');if((p.candidates||[]).length>40)throw Error('INVALID_BACKUP');for(const a of p.candidates||[]){if(!(a.blob instanceof Blob)||a.blob.size>(archive?64:32)*1048576||await sha256(a.blob)!==a.sha256)throw Error('INVALID_BACKUP');headerSize(await a.blob.arrayBuffer());const d=await normalizedImage(a.blob);if(d.width!==a.width||d.height!==a.height)throw Error('INVALID_BACKUP');}p.jobs=p.jobs.filter(j=>['ACCEPTED','REJECTED','FAILED','HELD','CANCELLED'].includes(j.status));Object.assign(p,await verifyEnhancementBackup(p,{sha256,inspectImage:normalizedImage}));}
  const allPairs=[...pairs,...data.pairs];const restoredScores=[];
  if(data.scores!==undefined&&!Array.isArray(data.scores))throw Error('INVALID_BACKUP');
  for(const score of data.scores||[]){const p=allPairs.find(x=>x.pair_id===score.pair_id&&x.original.sha256===score.original_sha256);if(!p||score.schema!=='bd.dualframe.comparison.v1'||!score.locked||!score.outputs?.web||!score.outputs?.reference||!score.scores||typeof score.randomization_seed!=='string')throw Error('INVALID_BACKUP');const legacyId=await sha256([p.original.sha256,score.outputs.web.sha256,score.outputs.reference.sha256,score.randomization_seed,'equal-canvas-v1'].join('|')),expectedId=await reviewId(p.original.sha256,score.outputs.web.sha256,score.outputs.reference.sha256,score.randomization_seed,score.mode);if(score.comparison_id!==expectedId&&score.comparison_id!==legacyId)throw Error('INVALID_BACKUP');for(const key of score.rubric||['identity','seams','naturalness','subjectSize','quality'])for(const label of ['A','B'])if(!['1','2','3','4','5'].includes(String(score.scores[key+label])))throw Error('INVALID_BACKUP');for(const a of [score.outputs.web,score.outputs.reference]){a.provenance_verified=false;a.provenance_basis='restored-backup-unverified';}const checked=comparisonEligibility(p,score.outputs.web,score.outputs.reference);restoredScores.push({...score,eligible:checked.eligible,classification:checked.classification,exclusion_reasons:checked.reasons,restored_revalidated:true});}
  for(const p of data.pairs)if(!pairs.some(x=>x.original.sha256===p.original.sha256)){await disk.putOriginal(p);pairs.push(p);}for(const score of restoredScores)if(!scores.some(x=>x.comparison_id===score.comparison_id)){await disk.addScore(score);scores.push(score);}selected=pairs[0]?.pair_id||null;render();notify('restored');}

function switchTab(view){activeView=view;for(const [id,section] of [['tab-create','workspace'],['tab-compare','comparison'],['tab-showcase','reference-gallery']]){const active=(id==='tab-create'&&view==='create')||(id==='tab-compare'&&view==='compare')||(id==='tab-showcase'&&view==='showcase');$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));$(section).hidden=!active;}if(view==='compare'){association();renderBenchModels();renderBenchResults();}renderOwnGallery();if(view==='showcase')ensureReference().catch(e=>notify(e.message,true));}
async function ensureReference(){if(referenceLoaded){renderReference();return;}$('reference-status').textContent=t('referenceLoading');try{referencePairs=await loadReferenceGallery();referenceLoaded=true;renderReference();}catch(error){if(!navigator.onLine||error?.name==='TypeError'||error?.message==='REFERENCE_UNAVAILABLE'){$('reference-status').textContent=t('referenceOffline');renderOwnGallery();return;}throw error;}}
function renderReference(){if(!referenceLoaded)return;$('reference-status').textContent=`${referencePairs.length} · ${t('referenceReady')}`;const list=$('reference-cards');list.replaceChildren();const target=deviceOrientation({device:currentDevice(),width:innerWidth,height:innerHeight,simulation:$('reference-device').value});list.classList.toggle('portrait',target==='portrait');for(const p of referencePairs){const card=node('article',undefined,'card');const photo=button('',()=>openViewer(p.pair_id),'card-image');photo.setAttribute('aria-label',`${t('viewPair')}: ${p.title}`);const image=node('img');bindImage(image,p.variants[target].hd);image.alt=p.title;image.style.height='100%';image.loading='lazy';image.decoding='async';photo.append(image);const body=node('div',undefined,'card-content');body.append(node('p',p.title,'card-title'),node('span','L + P · HD / 4K','reference-badge'),node('p',language==='sl'?p.captionSl:p.caption,'reference-caption'),button(t('viewPair'),()=>openViewer(p.pair_id),'text-button'));card.append(photo,body);list.append(card);}}
async function init(){pairs=await getPairs();scores=(await getScores()).map(score=>{
  const pair=pairs.find(p=>p.pair_id===score.pair_id&&p.original.sha256===score.original_sha256);
  const checked=pair?comparisonEligibility(pair,score.outputs?.web,score.outputs?.reference):{eligible:false,classification:'ILLUSTRATIVE_ONLY',reasons:['SOURCE_UNVERIFIED']};
  return {...score,eligible:checked.eligible,classification:checked.classification,exclusion_reasons:checked.reasons,eligibility_rule_version:'20261013-R2'};
});selected=pairs[0]?.pair_id||null;setLanguage();for(const p of pairs)for(const j of p.jobs)if(!j.enhancement_plan_id&&!['enhance','derive'].includes(j.operation)&&['PENDING','RUNNING'].includes(j.status)){if(j.provider==='demo'){j.recovered_from_status=j.status;j.status='PENDING';runDemo(p,j).catch(()=>notify('errorGeneric',true));}else{j.recovered_from_status=j.status;j.status='HELD';j.error='paused';await putPair(p);}}render();}

$('language').addEventListener('click',()=>{language=language==='en'?'sl':'en';try{localStorage.setItem('dualframe-language',language);}catch{}setLanguage();});
$('start').addEventListener('click',()=>{switchTab('create');$('upload').click();});$('upload').addEventListener('change',guard(e=>uploadMany(e.target.files)));$('counterpart-import').addEventListener('change',guard(async e=>{try{await importCounterpart(e.target.files[0]);}finally{e.target.value='';}}));$('drop-zone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('upload').click();}});
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('dragging');});for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');});$('drop-zone').addEventListener('drop',guard(e=>uploadMany(e.dataTransfer.files)));
$('demo').addEventListener('click',guard(async()=>{const a=await addOriginal(await demoFixture('landscape'),true),b=await addOriginal(await demoFixture('portrait'),true);await generate(a,{provider:'demo',mode:'faithful',position:'center',seed:42,prompt:''});await generate(b,{provider:'demo',mode:'faithful',position:'center',seed:42,prompt:''});selected=a.pair_id;render();$('workspace').scrollIntoView({behavior:'smooth'});}));
$('generate').addEventListener('click',guard(()=>$('create-kind').value==='generate'?generateFromPrompt():enhancementActive()?planEnhancement(false):generate()));$('mode').addEventListener('change',updateModelControls);$('pipeline').addEventListener('change',updateModelControls);$('output-quality').addEventListener('change',updateModelControls);$('connect').addEventListener('click',guard(connectGateway));$('copy-hash').addEventListener('click',guard(async()=>{await navigator.clipboard.writeText(selectedPair().original.sha256);notify('copied');}));
$('device').addEventListener('change',()=>{render();if(viewerPair)updateViewer();});for(const id of ['viewer-orientation','quality'])$(id).addEventListener('change',()=>{updateViewer();if(id==='quality'&&$('quality').value==='4k'&&!viewerPairData()?.reference_only&&!verifiedFourK(viewerPairData()?.variants[targetFrame($('viewer-orientation').value)]?.fourK))notify('unavailable4k');});$('mask').addEventListener('click',()=>{$('mask').setAttribute('aria-pressed',String($('mask').getAttribute('aria-pressed')!=='true'));updateViewer();});$('viewer-swap').addEventListener('click',swapViewerFrame);$('viewer-close').addEventListener('click',closeViewer);$('viewer-floating-close').addEventListener('click',closeViewer);$('viewer').addEventListener('cancel',e=>{e.preventDefault();closeViewer();});$('viewer').addEventListener('close',()=>{stopTour();setImmersive(false);viewerPair=null;document.body.classList.remove('viewer-open');$('viewer-image').removeAttribute('src');originFocus?.focus({preventScroll:true});requestAnimationFrame(()=>window.scrollTo(0,originScroll));});$('viewer').addEventListener('click',e=>{if(e.target===$('viewer'))closeViewer();});$('next').addEventListener('click',()=>moveViewer(1));$('previous').addEventListener('click',()=>moveViewer(-1));$('fullscreen').addEventListener('click',guard(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else {setImmersive(true);await $('viewer-stage').requestFullscreen?.().catch(()=>{});}}));
let swipe=null;$('viewer-stage').addEventListener('touchstart',e=>{if(e.touches.length===1)swipe={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});$('viewer-stage').addEventListener('touchend',e=>{if(!swipe||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-swipe.x,dy=e.changedTouches[0].clientY-swipe.y;swipe=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)moveViewer(dx<0?1:-1);},{passive:true});$('viewer-stage').addEventListener('touchcancel',()=>swipe=null);
document.addEventListener('keydown',e=>{if(!viewerPair||e.target.matches('input,select,textarea'))return;if(e.key==='ArrowRight'){e.preventDefault();moveViewer(1);}if(e.key==='ArrowLeft'){e.preventDefault();moveViewer(-1);}});
let resizeTimer;const resize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{scheduleGalleryOrientation();if(viewerPair)updateViewer();else render();},100);};window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);window.visualViewport?.addEventListener('resize',positionMobileClose);window.visualViewport?.addEventListener('scroll',positionMobileClose);document.addEventListener('fullscreenchange',resize);$('viewer-image').addEventListener('load',()=>{if(viewerPair)updateBoundaryOnly();});function updateBoundaryOnly(){const p=viewerPairData();if(p)drawBoundary(selectAsset(p,$('viewer-image').dataset.orientation||p.original.source_orientation,$('quality').value,devicePixelRatio));}
$('download-original').addEventListener('click',guard(async()=>{const p=viewerPairData();if(p&&!p.reference_only)download(await getStoredBlob(p.original.blob),p.original.filename);}));$('download-landscape').addEventListener('click',guard(()=>downloadAllVariants('landscape')));$('download-portrait').addEventListener('click',guard(()=>downloadAllVariants('portrait')));$('download-sidecar').addEventListener('click',()=>{const p=viewerPairData();if(p)jsonDownload(publicManifest(p),`${p.pair_id}.manifest.json`);});
$('manifest-export').addEventListener('click',()=>jsonDownload({schema:'bd.dualframe.collection.v1',pairs:pairs.map(publicManifest)},'DualFrame-manifests.json'));$('bundle-export').addEventListener('click',guard(exportBackup));$('backup-import').addEventListener('change',guard(e=>restoreBackup(e.target.files[0])));
$('tab-create').addEventListener('click',()=>switchTab('create'));$('tab-compare').addEventListener('click',()=>switchTab('compare'));$('compare-pair').addEventListener('change',()=>{reviewState=null;$('review').hidden=true;$('compare-empty').hidden=false;association();});for(const [id,kind] of [['import-web','web'],['import-reference','reference']])$(id).addEventListener('change',guard(async e=>{if(e.target.files[0])await importOutput(e.target.files[0],kind);e.target.value='';}));$('import-sidecar').addEventListener('change',guard(async e=>{if(e.target.files[0])await importSidecar(e.target.files[0]);e.target.value='';}));$('start-comparison').addEventListener('click',guard(beginReview));$('review-view').addEventListener('change',renderReview);$('review-zoom').addEventListener('input',renderReview);$('baseline-mode').addEventListener('change',guard(updateBaseline));$('score-form').addEventListener('submit',guard(submitScore));
$('scores-json').addEventListener('click',()=>{const controlled=scores.filter(x=>x.eligible&&canonicalMode(x.mode));const grouped=Object.fromEntries(['faithful','smart','infographic'].map(mode=>[mode,controlled.filter(x=>canonicalMode(x.mode)===mode)]));const byMethod={};for(const item of controlled){const key=item.method_group||'UNKNOWN_METHOD';(byMethod[key]||=[]).push(item);}jsonDownload({schema:'bd.dualframe.comparison-export.v2',scores,controlled_by_task:grouped,controlled_by_method:byMethod,combined_score:null,winner:null},'DualFrame-blind-reviews.json');});$('scores-csv').addEventListener('click',()=>download(new Blob([csv(scores.map(s=>({...s,outputs:JSON.stringify(s.outputs)})))],{type:'text/csv;charset=utf-8'}),'DualFrame-blind-reviews.csv'));
window.addEventListener('beforeunload',()=>{imageLoader.clear();clearWarmImages();for(const url of urls)URL.revokeObjectURL(url);});

$('showcase').addEventListener('click',()=>{switchTab('showcase');$('reference-gallery').scrollIntoView({behavior:'smooth'});});$('tab-showcase').addEventListener('click',()=>switchTab('showcase'));$('reference-device').addEventListener('change',()=>{scheduleGalleryOrientation();if(viewerPair)updateViewer();});
$('compare-task').addEventListener('change',()=>{reviewState=null;$('review').hidden=true;$('compare-empty').hidden=false;association();});for(const id of ['candidate-a','candidate-b'])$(id).addEventListener('change',()=>{reviewState=null;$('review').hidden=true;});
let lastTouchToggle=-Infinity;$('viewer-stage').addEventListener('dblclick',e=>{e.preventDefault();if(performance.now()-lastTouchToggle<700)return;setImmersive(!document.querySelector('.viewer-shell').classList.contains('immersive'));});let lastTap=null;$('viewer-stage').addEventListener('touchend',e=>{if(!e.changedTouches.length)return;const touch=e.changedTouches[0],now=performance.now();if(lastTap&&now-lastTap.at<300&&Math.hypot(touch.clientX-lastTap.x,touch.clientY-lastTap.y)<25){e.preventDefault();lastTouchToggle=now;setImmersive(!document.querySelector('.viewer-shell').classList.contains('immersive'));lastTap=null;}else lastTap={at:now,x:touch.clientX,y:touch.clientY};},{passive:false});document.addEventListener('keydown',e=>{if(e.key==='Escape')setImmersive(false);});
let dragReview=null;for(const id of ['review-a','review-b']){const img=$(id),frame=img.parentElement;frame.addEventListener('pointerdown',e=>{if(Number($('review-zoom').value)<=100)return;dragReview={x:e.clientX,y:e.clientY,startX:Number(frame.dataset.panX||0),startY:Number(frame.dataset.panY||0)};frame.setPointerCapture(e.pointerId);});frame.addEventListener('pointermove',e=>{if(!dragReview)return;const x=Math.max(-frame.clientWidth,Math.min(frame.clientWidth,dragReview.startX+e.clientX-dragReview.x)),y=Math.max(-frame.clientHeight,Math.min(frame.clientHeight,dragReview.startY+e.clientY-dragReview.y));for(const a of ['review-a','review-b']){const f=$(a).parentElement;f.dataset.panX=x;f.dataset.panY=y;$(a).style.transform=`translate(${x}px,${y}px) scale(${Number($('review-zoom').value)/100})`;}});for(const type of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(type,()=>dragReview=null);}
Object.assign(dictionary.en,{creationGallery:'Create',comparisonLab:'Compare',referenceTitle:'One collection. Every perspective.',referenceNote:'Explore the Nara / Illuminara reference collection and your own compositions. AUTO follows your screen; choose L or P to see another frame.',referenceEyebrow:'DUALFRAME · GALLERY',referenceGallery:'Gallery',localOnly:'R&D · your image collection',localNotice:'Sign in before adding originals to your private library. Files stay on this device until you explicitly Sync or approve an AI operation.',referenceDisclosure:'Your gallery and image creation share the same originals and compositions.',createKind:'What would you like to create?',expandKind:'The other composition',generateKind:'A new image from a prompt',targetFrame:'Composition',collection:'Collection',allImages:'All images',myImages:'My images',referenceImages:'Nara · Illuminara',favorites:'Favorites',cloudLoad:'Sync my saved images',modelBench:'One source. Several interpretations.',modelBenchNote:'Choose models to create alternatives from the same original, prompt and composition settings. Review the outputs side by side or hide the labels.',benchGenerate:'Create comparison candidates',authTitle:'Unlock image creation',authNote:'Sign in once on this device. Your saved session lets you create and compare images without entering the password again.',passwordLabel:'Password',unlockAPI:'Unlock API',lockAPI:'Lock API',authStorage:'A session token is stored on this device for 30 days. Lock API removes it.',manualReady:'Ready for your manual test',keyMissing:'Key connection required',apiChecking:'Checking API connection',scaled4K:'4K export may be enlarged',characterReference:'Character reference',playTour:'Play tour',pauseTour:'Pause tour',PROMPT_REQUIRED:'Enter a description of the new image.',KEY_NOT_CONFIGURED:'The adapter is installed; its existing account key has not been connected yet.',AUTH_NOT_CONFIGURED:'The API authentication configuration is not available yet.',AUTH_CANCELLED:'API sign-in cancelled.',MODEL_GENERATION_ONLY:'This model creates new images. Choose New image from a prompt.',PROVIDER_REJECTED:'The provider rejected the request. Its response is shown with the job.',PROVIDER_STATE_UNKNOWN:'The request may have reached the provider. It will not be sent again automatically.',PROVIDER_TRANSPORT_UNCERTAIN:'The provider response was interrupted. This request will not be charged again by an automatic retry.',JOB_STILL_RUNNING:'The job is still pending; use Resume to check the same job.',cloudSaved:'Saved images restored',apiLocked:'API locked',benchQueued:'Comparison jobs started',referenceReady:'artworks · your screen, your pace',gatewayRequired:'',demoDisclosure:'The reference collection is ready to explore. Choose Create or Compare to work with your images.',reviewIntro:'Choose two results from the same task. Compare side by side, inspect details, or rate them with the model labels hidden.',ownership:'Concept: Bojan Dobrečevič · DualFrame Photos 3.0 · R&D'});
Object.assign(dictionary.sl,{creationGallery:'Ustvari',comparisonLab:'Primerjaj',referenceTitle:'Ena zbirka. Vsak pogled.',referenceNote:'Razišči referenčno zbirko Nara / Illuminara in svoje kompozicije. AUTO sledi zaslonu; izberi L ali P in odkrij drugi okvir.',referenceEyebrow:'DUALFRAME · GALERIJA',referenceGallery:'Galerija',localOnly:'R&D · tvoja zbirka slik',localNotice:'Pred dodajanjem izvirnikov se prijavi v svojo zasebno knjižnico. Datoteke ostanejo v napravi do izrecnega Synca ali potrditve AI opravila.',referenceDisclosure:'Galerija in ustvarjanje uporabljata iste izvirnike in kompozicije.',createKind:'Kaj želiš ustvariti?',expandKind:'Drugo kompozicijo izvirnika',generateKind:'Novo sliko iz opisa',targetFrame:'Kompozicija',collection:'Zbirka',allImages:'Vse slike',myImages:'Moje slike',referenceImages:'Nara · Illuminara',favorites:'Priljubljene',cloudLoad:'Uskladi moje shranjene slike',modelBench:'En izvirnik. Več interpretacij.',modelBenchNote:'Izberi modele za različice istega izvirnika z enakim pozivom in nastavitvami kompozicije. Rezultate preglej skupaj ali skrij oznake.',benchGenerate:'Ustvari primerjalne različice',authTitle:'Odkleni ustvarjanje slik',authNote:'Na tej napravi se prijavi enkrat. Shranjena prijava omogoča ustvarjanje in primerjave brez ponovnega vnosa gesla.',passwordLabel:'Geslo',unlockAPI:'Odkleni API',lockAPI:'Zakleni API',authStorage:'V tej napravi se za 30 dni shrani prijavni žeton. Zakleni API ga odstrani.',manualReady:'Pripravljen za tvoj ročni test',keyMissing:'Potrebuje povezavo ključa',apiChecking:'Preverjam povezavo API',scaled4K:'4K izvoz je lahko povečan',characterReference:'Referenca lika',playTour:'Predvajaj ogled',pauseTour:'Ustavi ogled',PROMPT_REQUIRED:'Vnesi opis nove slike.',KEY_NOT_CONFIGURED:'Adapter je vgrajen; obstoječi ključ računa še ni povezan.',AUTH_NOT_CONFIGURED:'Nastavitev prijave API še ni dosegljiva.',AUTH_CANCELLED:'Prijava API je preklicana.',MODEL_GENERATION_ONLY:'Ta model ustvarja nove slike. Izberi Novo sliko iz opisa.',PROVIDER_REJECTED:'Ponudnik je zavrnil klic. Njegov odgovor je prikazan ob opravilu.',PROVIDER_STATE_UNKNOWN:'Klic je morda že prispel ponudniku. Samodejno ga ne bomo ponovno poslali.',PROVIDER_TRANSPORT_UNCERTAIN:'Odgovor ponudnika se je prekinil. Samodejna ponovitev ne bo sprožila novega plačljivega klica.',JOB_STILL_RUNNING:'Opravilo še teče; z Nadaljuj preveri isto opravilo.',cloudSaved:'Shranjene slike so obnovljene',apiLocked:'API je zaklenjen',benchQueued:'Primerjalna opravila so sprožena',referenceReady:'umetniških del · tvoj zaslon, tvoj ritem',gatewayRequired:'',demoDisclosure:'Referenčna zbirka je pripravljena za ogled. Za svoje slike izberi Ustvari ali Primerjaj.',reviewIntro:'Izberi dva rezultata iste naloge. Primerjaj ju skupaj, razišči podrobnosti ali ju oceni s skritimi oznakami modelov.',ownership:'Zamisel: Bojan Dobrečevič · DualFrame Photos 3.0 · R&D'});

Object.assign(dictionary.en,{rename:'Rename',renameTitle:'Rename image',renameLabel:'Image name',renameHelp:'The original file and SHA-256 stay unchanged. Your title is saved on this device and synchronized when the private API is available.',renameSave:'Save name',renameInvalid:'Enter a name of at most 120 characters without control characters.',renameFailed:'Could not save the name to this device.',renameSaved:'Name saved and cloud-synced.',renameLocalPending:'Name saved here. Use Sync to update your other devices.',frameMissing:'No portrait/landscape counterpart saved · showing the original in this frame.'});
Object.assign(dictionary.sl,{rename:'Preimenuj',renameTitle:'Preimenuj sliko',renameLabel:'Ime slike',renameHelp:'Izvirna datoteka in SHA-256 ostaneta nespremenjena. Ime se shrani na napravi, v oblak pa se uskladi ob povezavi.',renameSave:'Shrani ime',renameInvalid:'Vnesi ime do 120 znakov, brez krmilnih znakov.',renameFailed:'Imena ni bilo mogoče shraniti na napravo.',renameSaved:'Ime shranjeno in sinhronizirano z oblakom.',renameLocalPending:'Ime shranjeno na napravi. Za prenos na druge naprave uporabi Sync.',frameMissing:'Druga kompozicija še ni shranjena · prikazan je cel izvirnik v izbranem okvirju.'});
let favorites=new Set(),tourTimer=null,benchBusy=false,cloudBusy=false;
try{favorites=new Set(JSON.parse(preferenceStorage.getItem('bd-df-favorites')||'[]'));}catch{}
function updateAuthLabel(){$('api-toggle').textContent=t(API.apiUnlocked()?'lockAPI':'unlockAPI');$('api-toggle').setAttribute('aria-pressed',String(API.apiUnlocked()));}
function favorite(id){if(favorites.has(id))favorites.delete(id);else favorites.add(id);try{preferenceStorage.setItem('bd-df-favorites',JSON.stringify([...favorites]));}catch{}renderOwnGallery();renderReference();$('viewer-favorite').textContent=favorites.has(viewerPair)?'♥':'♡';}
function galleryCard(pair,reference=false){const target=galleryFrame(),state=selectAsset(pair,target,'hd'),card=node('article',undefined,'card gallery-artwork'),photo=button('',()=>openViewer(pair.pair_id),'card-image'),img=node('img');bindImage(img,state.asset);img.alt=displayTitle(pair);img.loading='lazy';img.decoding='async';photo.append(img);photo.setAttribute('aria-label',`${t('viewPair')}: ${img.alt}`);const body=node('div',undefined,'card-content');body.append(node('p',img.alt,'card-title'),node('p',reference?(language==='sl'?pair.captionSl:pair.caption):pair.description||'', 'reference-caption'));if(!reference&&state.missing&&state.orientation!==target)body.append(node('p',t('frameMissing'),'gallery-missing'));const row=node('div',undefined,'card-controls');row.append(button(favorites.has(pair.pair_id)?'♥':'♡',()=>favorite(pair.pair_id),'favorite-button'));if(reference)row.append(button(t('viewPair'),()=>openViewer(pair.pair_id),'text-button'));if(!reference){const remote=remotePairs.find(x=>x.original?.sha256===pair.original.sha256);if(remote&&remoteJobs.some(j=>j.pair_id===remote.pair_id&&j.output?.asset_id&&['READY','ACCEPTED'].includes(j.status)&&!(pair.candidates||[]).some(a=>a.sha256===j.output.sha256||a.parent_output_sha256===j.output.sha256)))row.append(button(t('loadCloudVariants'),()=>loadRemotePair(remote),'text-button'));row.append(imageActionList(pair,'showcase'));}body.append(row);card.classList.toggle('portrait',actualGalleryFrame()==='portrait');card.append(photo,body);return card;}
function renderOwnGallery(){pairs=orderedGallery(pairs);const filter=$('collection-filter')?.value||'all',box=$('own-gallery');if(!box)return;box.replaceChildren();box.hidden=filter==='reference';box.classList.toggle('portrait',actualGalleryFrame()==='portrait');for(const p of pairs){if(filter==='favorites'&&!favorites.has(p.pair_id))continue;box.append(galleryCard(p));}for(const remote of remotePairs){if(pairs.some(p=>p.original.sha256===remote.original?.sha256))continue;if(filter==='favorites'&&!favorites.has(remote.pair_id))continue;box.append(remoteCard(remote));}for(const job of remoteJobs.filter(j=>j.operation==='generate'&&['READY','ACCEPTED'].includes(j.status)&&j.output?.sha256&&!pairs.some(p=>p.original.sha256===j.output.sha256))){if(filter==='favorites'&&!favorites.has(job.job_id))continue;box.append(remoteCard(job,true));}$('reference-cards').hidden=filter==='own';}
const originalRenderReference=renderReference;
renderReference=function(){if(!referenceLoaded)return;originalRenderReference();$('reference-cards').classList.toggle('portrait',actualGalleryFrame()==='portrait');const filter=$('collection-filter').value;if(filter==='favorites'){const wanted=referencePairs.filter(p=>favorites.has(p.pair_id));$('reference-cards').replaceChildren(...wanted.map(p=>galleryCard(p,true)));}else if(filter!=='own'){$('reference-cards').replaceChildren(...referencePairs.map(p=>galleryCard(p,true)));}renderOwnGallery();};
function stopTour(){if(tourTimer)clearInterval(tourTimer);tourTimer=null;$('viewer-play').textContent=t('playTour');}
function startTour(){if(tourTimer){stopTour();return;}tourTimer=setInterval(()=>moveViewer(1),6500);$('viewer-play').textContent=t('pauseTour');}
const warmImages=new Map();
const warmUrls=new Map();let warmLoad=0;
function clearWarmImages(){++warmLoad;syncImageCache(warmImages,[]);for(const url of warmUrls.values())URL.revokeObjectURL(url);warmUrls.clear();}
async function warmViewer(){
 const token=++warmLoad,p=viewerPairData();
 if(!prefs.preloadAdjacent||!p){clearWarmImages();return;}
 const list=p.reference_only?referencePairs:pairs,index=list.findIndex(x=>x.pair_id===p.pair_id);
 if(index<0)return;
 const orientation=$('viewer-image').dataset.orientation||p.original.source_orientation,quality=$('quality').value;
 const assets=adjacentImageIndices(list.length,index).map(adjacent=>selectAsset(list[adjacent],orientation,quality,devicePixelRatio).asset),wanted=[];
 for(const asset of assets){
  const value=asset.blob||asset.normalized,key=value?.id||value||asset.remote_url;
  if(!key)continue;wanted.push(key);
  if(warmUrls.has(key))continue;
  const blob=await getStoredBlob(value);if(token!==warmLoad||viewerPair!==p.pair_id)return;
  warmUrls.set(key,blob?URL.createObjectURL(blob):asset.remote_url);
 }
 if(token!==warmLoad)return;
 for(const [key,url] of warmUrls)if(!wanted.includes(key)){if(String(url).startsWith('blob:'))URL.revokeObjectURL(url);warmUrls.delete(key);}
 syncImageCache(warmImages,wanted.map(key=>warmUrls.get(key)).filter(Boolean));
 $('viewer-favorite').textContent=favorites.has(p.pair_id)?'♥':'♡';
}
const priorUpdateViewer=updateViewer;
updateViewer=async function(){
 const pair=viewerPairData();if(!pair)return;
 const simulation=activeView==='showcase'||pair.reference_only?$('reference-device').value:$('device').value;
 const target=deviceOrientation({device:currentDevice(),width:innerWidth,height:innerHeight,override:$('viewer-orientation').value,simulation});
 if(viewerShownPair!==pair.pair_id){clearTimeout(viewerFrameTimer);viewerFrameTimer=null;viewerShownPair=pair.pair_id;viewerShownTarget=target;}
 else if(target!==viewerShownTarget){
  clearTimeout(viewerFrameTimer);viewerFrameTimer=null;
  if(prefs.delaySeconds>0 && viewerShownTarget!==null){
   ++viewerLoad; // Discard a superseded asynchronous reference decode.
   const id=pair.pair_id,token=target;
   viewerFrameTimer=setTimeout(()=>{if(viewerPair!==id)return;viewerFrameTimer=null;viewerShownTarget=token;updateViewer();},prefs.delaySeconds*1000);
   return;
  }
  viewerShownTarget=target;
 }else if(viewerFrameTimer){clearTimeout(viewerFrameTimer);viewerFrameTimer=null;}
 await priorUpdateViewer();if(viewerPair&&$('viewer-image').dataset.pairId===viewerPair)await warmViewer();
};
const benchSelectionMemory=new Map();
function renderBenchModels(tierOverride){
 const holder=$('bench-models');if(!holder)return;
 const mode=canonicalMode($('compare-task').value),enhancing=mode==='smart'&&(enhancePrefs.natural||enhancePrefs.artistic),tier=['free','premium'].includes(tierOverride)?tierOverride:enhancePrefs.tier;
 const context=`${scopeOwner||'local'}:${enhancing?'enhance:'+tier:'legacy'}`,previous=holder.dataset.context,checked=new Set([...holder.querySelectorAll('input:checked')].map(input=>input.value));
 if(previous)benchSelectionMemory.set(previous,checked);const remembered=benchSelectionMemory.get(context);
 const models=enhancing&&tier==='free'?[{key:'cloudflare-flux-free',label:'Cloudflare · FLUX.2 klein 4B'}]:MODELS.filter(model=>model.direct&&model.edit!==false&&prefs.enabledModels.includes(model.key)&&(!enhancing||['openai-sunburst','openai-flare'].includes(model.key)));
 holder.replaceChildren();holder.dataset.context=context;
 for(const model of models){
  const label=node('label',undefined,'bench-model'),input=node('input');input.type='checkbox';input.value=model.key;input.checked=remembered?remembered.has(model.key):true;input.disabled=!(enhancing&&tier==='free')&&!supportsMode(model.key,mode);
  input.addEventListener('change',()=>{const count=[...holder.querySelectorAll('input:checked:not(:disabled)')].length*(enhancing?plannedCallCount(comparePair()||selectedPair()):1);$('bench-call-summary').textContent=t('upToCalls').replace('{n}',count)+' · '+t('unknownCost');});label.append(input,node('span',model.label+(enhancing&&tier==='free'?' · '+enhancementStatus('free'):'')));holder.append(label);
 }
 if(!models.length)holder.append(node('p',language==='sl'?'Noben vključen model ne podpira te obdelave.':'No enabled model supports this operation.','small muted'));
 $('bench-generate').disabled=benchBusy||enhancementBusy||!models.length||enhancing&&tier==='free';
 const count=[...holder.querySelectorAll('input:checked:not(:disabled)')].length*(enhancing?plannedCallCount(comparePair()||selectedPair()):1);$('bench-call-summary').textContent=t('upToCalls').replace('{n}',count)+' · '+t('unknownCost');
}
function renderBenchResults(){const holder=$('bench-results');if(!holder)return;const p=comparePair()||selectedPair();holder.replaceChildren();if(!p)return;
 for(const job of p.jobs.slice().reverse().filter(j=>j.provider!=='demo').slice(0,18)){const card=node('article',undefined,'bench-result');card.append(node('strong',modelFor(job.model)?.label||job.model),node('span',`${t(job.status)} · ${job.quality}`,'small'));const image=job.candidate||(p.candidates||[]).find(x=>x.candidate_id===job.job_id);if(image){const img=node('img');bindImage(img,image);img.alt=modelFor(job.model)?.label||job.model;img.loading='lazy';card.append(img,button(t('useAsA'),()=>{$('candidate-a').value=image.sha256;association();},'text-button'),button(t('useAsB'),()=>{$('candidate-b').value=image.sha256;association();},'text-button'));}if(job.error)card.append(node('p',t(job.error),'small'));holder.append(card);}
}
async function runBench(){
 if(benchBusy||enhancementBusy)return;const p=comparePair()||selectedPair();if(!p)throw Error('SELECT_ORIGINAL');
 const chosen=[...$('bench-models').querySelectorAll('input:checked:not(:disabled)')].map(x=>x.value);if(!chosen.length)throw Error('NO_MODELS_SELECTED');
 const enhancing=canonicalMode($('compare-task').value)==='smart'&&(enhancePrefs.natural||enhancePrefs.artistic),requests=chosen.map(model=>frozenEnhancementOptions(false,model));
 const frozen={mode:$('compare-task').value,position:$('position').value,seed:Number($('seed').value),user_prompt:$('prompt').value,quality:$('output-quality').value,direction_style:$('direction-style').value,text_layout:{headline:$('headline-text').value,body:$('body-text').value}};
 benchBusy=true;enhancementBusy=enhancing;$('bench-generate').disabled=true;updateEnhancementControls();
 try{
  await connectGateway();const pair=pairs.find(item=>item.original.sha256===p.original.sha256);if(!pair)throw Error('STORAGE_OWNER_CHANGED');
  if(enhancing){await planEnhancementComparison(pair,chosen,requests);return;}
  $('bench-status').textContent=t('benchQueued');
  await Promise.allSettled(chosen.map(model=>generate(pair,{...frozen,model,generation_attempt_id:crypto.randomUUID()})));association();renderBenchResults();
 }finally{benchBusy=false;enhancementBusy=false;updateEnhancementControls();renderBenchModels();}
}

Object.assign(dictionary.en,{useAsA:'Use as A',useAsB:'Use as B',NO_MODELS_SELECTED:'Choose at least one model.'});Object.assign(dictionary.sl,{useAsA:'Izberi kot A',useAsB:'Izberi kot B',NO_MODELS_SELECTED:'Izberi vsaj en model.'});
async function generateFromPrompt(){if(creationBusy)return;creationBusy=true;try{return await generateFromPromptInternal();}finally{creationBusy=false;updateEnhancementControls();}}
async function generateFromPromptInternal(){const prompt=$('prompt').value.trim();if(!prompt)throw Error('PROMPT_REQUIRED');const model=modelFor($('pipeline').value),target=$('text-target').value,quality=$('output-quality').value,seed=Number($('seed').value),mode=canonicalMode($('mode').value);await connectGateway();if(new Set(pairs.map(p=>p.original.sha256)).size>=MAX_ORIGINALS)throw Error('PAIR_LIMIT');const client=API.captureAPI(),disk=captureStorageScope(),parameters={model:model.key,target,quality,seed,mode,prompt,position:$('position').value,text_layout:mode==='infographic'?{headline:$('headline-text').value,body:$('body-text').value}:null,generation_attempt_id:crypto.randomUUID()};const idempotency_key=await sha256(JSON.stringify(parameters));$('generate').disabled=true;notify('RUNNING');
 try{const receipt=await client.request('/generate',{method:'POST',body:{...parameters,idempotency_key}}),state=await client.awaitJob(receipt.job_id);if(!['READY','ACCEPTED'].includes(state.status))throw Error(state.error||state.status);const blob=await client.asset(state.output.asset_id);if(await sha256(blob)!==state.output.sha256)throw Error('OUTPUT_HASH_MISMATCH');const file=new File([blob],`${safeName(prompt.slice(0,70))}.png`,{type:'image/png'}),p=await addOriginal(file,false,disk);p.original.creation_receipt={...state,output:state.output};p.original.origin='generated';p.description=prompt;p.generated_from_prompt=true;
  const candidate=await localTextOverlay({...state.output,blob,path:`variants/${target}/${state.output.sha256}.png`,origin:'generated',provider:model.provider,model_key:model.key,direction:target,target_ratio:RATIOS[target],mode,provider_cost:state.provider_cost,cost_currency:state.cost_currency},parameters.text_layout);p.variants[target][quality==='4k'?'fourK':'hd']=candidate;rememberResult(p,candidate,receipt.job_id);await client.request(`/jobs/${receipt.job_id}/accept`,{method:'POST',body:{}});await disk.putPair(p);await disk.getPairs();render();recordModelHealth(model.key,'generate','READY',preferenceStorage);selected=p.pair_id;switchTab('showcase');openViewer(p.pair_id);
 }finally{$('generate').disabled=false;}
}

// Manual Sync reconciles bytes. Automatic startup only refreshes metadata.
let syncRequests=0,activeSyncController=null,syncPaused=false;
let syncEngine;
function newSyncEngine(){return createSyncEngine({api:API.captureAPI().syncTransport,store:scopedStore,owner:scopeOwner||'anonymous-device',onProgress:progress=>{
 const sl=language==='sl',state=progress.synced?(sl?'Usklajeno':'Synced'):(sl?'Usklajujem':'Syncing');
 const amount=n=>Number.isFinite(n)?(n/1048576).toFixed(1)+' MB':'?';
 $('cloud-status').textContent=`${state} · ${progress.photos||0} ${sl?'fotografij':'photos'} · ${progress.completed||0}/${progress.files||0} ${sl?'datotek':'files'} · ↑ ${amount(progress.upload_bytes||0)} ↓ ${amount(progress.download_bytes||0)} · ${sl?'čaka':'queued'} ${progress.queued||0} / ${sl?'teče':'running'} ${progress.running||0} / ${sl?'napake':'failed'} ${progress.failed||0}${progress.unknown_bytes?' · '+(sl?'neznana velikost':'unknown size'):''}`;
}});}
function applyCloudCatalog(data){
 const deleted=(pairId,source)=>(data.tombstones||[]).some(t=>(pairId&&t.pair_id===pairId)||(source&&t.source_sha256===source));
 remotePairs=Array.isArray(data.pairs)?data.pairs.filter(p=>!deleted(p.pair_id,p.original?.sha256)).map(p=>({...p,display_name:data.titles?.[p.original.sha256]||p.title})):[];
 remoteJobs=Array.isArray(data.jobs)?data.jobs.filter(j=>j.status!=='REJECTED'&&!deleted(j.pair_id,j.input_sha256||(j.operation==='generate'?j.output?.sha256:null))):[];
}
function showSyncConflicts(result){
 const box=$('sync-conflicts');box.replaceChildren();
 for(const conflict of result.conflicts||[]){
  const pair=pairs.find(p=>p.pair_id===conflict.pair_id||p.sync_conflicts?.some(x=>JSON.stringify(x)===JSON.stringify(conflict)));
  if(!pair)continue;
  const row=node('div',displayTitle(pair)+' · '+(conflict.kind==='title'?(language==='sl'?'Ime spremenjeno na drugi napravi.':'Name changed on another device.'):conflict.kind==='tombstone'?(language==='sl'?'Izbrisano v oblaku; lokalni izvirnik je ohranjen.':'Deleted in cloud; local original retained.'):(language==='sl'?'Ohranjeni sta obe izbrani različici.':'Both selected variants were retained.')));
  const refresh=async()=>{pairs=await getPairs();render();repaintGallery();await syncCloud(true);};
  if(conflict.kind==='title')for(const local of [true,false])row.append(button(language==='sl'?(local?'Obdrži to ime':'Uporabi ime iz oblaka'):(local?'Keep this name':'Use cloud name'),guard(async()=>{
   const catalog=await syncEngine.catalog(),remote=catalog.title_records.find(x=>x.source_sha256===pair.original.sha256);
   if(!remote)throw Error('TITLE_CONFLICT');
   if(local){const saved=await API.syncTransport.putTitle(pair.original.sha256,{title:pair.display_name,base_revision:remote.revision||0});await updatePair(pair.pair_id,current=>({...current,title_sync_pending:false,title_revision:saved.revision}));}
   else await updatePair(pair.pair_id,current=>({...current,display_name:remote.title,title_sync_pending:false,title_revision:remote.revision||0}));
   await refresh();
  }),'text-button'));
  else if(conflict.kind==='selection')row.append(button(language==='sl'?'Potrdi trenutno izbiro':'Confirm current selection',guard(async()=>{
   const slot=conflict.direction+'.'+conflict.quality;
   await updatePair(pair.pair_id,current=>({...current,sync_selection_resolutions:{...current.sync_selection_resolutions,[slot]:current.variants[conflict.direction][conflict.quality].sha256}}));await refresh();
  }),'text-button'));
  else if(conflict.kind==='tombstone')row.append(button(language==='sl'?'Odstrani tudi lokalno kopijo':'Remove retained local copy',guard(async()=>{
   if(!confirm(t('deleteConfirm')))return;await removePair(pair.pair_id);await refresh();
  }),'text-button'));
  box.append(row);
 }
}
async function syncCloud(ask=true){
 if(!API.sessionOwner()&&!ask)return;
 syncRequests++;cloudBusy=true;$('sync-pause').hidden=false;$('cloud-status').textContent=language==='sl'?'Sync je v čakalni vrsti…':'Sync queued…';
 try{
  if(ask)await connectGateway();
  if(ask){
   const engine=syncEngine,scope=scopedStore,scopeSignal=scopeController.signal;const run=async()=>{if(syncPaused)throw Error('SYNC_PAUSED');const transferController=new AbortController(),abort=()=>transferController.abort();activeSyncController=transferController;scopeSignal.addEventListener('abort',abort,{once:true});if(scopeSignal.aborted)abort();try{return await engine.sync({signal:transferController.signal});}finally{scopeSignal.removeEventListener('abort',abort);if(activeSyncController===transferController)activeSyncController=null;}};
   const result=navigator.locks?.request?await navigator.locks.request('dualframe-full-sync',run):await run();
   pairs=await scope.getPairs();
   applyCloudCatalog(await engine.catalog());
   showSyncConflicts(result);
   if(!selected||!pairs.some(p=>p.pair_id===selected))selected=pairs[0]?.pair_id||null;
   render();repaintGallery();
   if(!result.synced){
    const details=[...(result.errors||[]),...(result.conflicts||[])].map(x=>x.code||x.error||'SYNC_CONFLICT');
    $('cloud-status').textContent+=(language==='sl'?' · Nepopolno; ponovi Sync: ':' · Incomplete; retry Sync: ')+[...new Set(details)].join(', ');
   }
   return result;
  }
  const data=await syncEngine.catalog();applyCloudCatalog(data);
  // Catalog refresh never overwrites a pending local title or downloads photographs.
  for(const p of pairs){
   const row=data.title_records?.find(x=>x.source_sha256===p.original.sha256);
   const cloudName=data.titles?.[p.original.sha256];
   if(cloudName){const saved=await updatePair(p.pair_id,current=>current&&!current.title_sync_pending?{...current,display_name:cloudName,title_revision:row?.revision||0}:current);if(saved)Object.assign(p,saved);}
  }
  render();repaintGallery();
  $('cloud-status').textContent=t('cloudCatalog')+' · '+(language==='sl'?'Za datoteke pritisni Sync.':'Press Sync to transfer files.');
 }catch(e){$('cloud-status').textContent=(language==='sl'?'Sync ni dokončan: ':'Sync incomplete: ')+t(e.message);if(ask)throw e;}
 finally{syncRequests--;cloudBusy=syncRequests>0;$('sync-pause').hidden=!cloudBusy&&!syncPaused;diagnoseStorage().catch(()=>{});}
}
async function loadRemotePair(remote){
 await syncCloud(true);
 const local=pairs.find(p=>p.original.sha256===remote.original.sha256);
 if(local){selected=local.pair_id;render();repaintGallery();}
}
async function loadRemoteGenerated(job){
 await syncCloud(true);
 const local=pairs.find(p=>p.original.sha256===job.output.sha256);
 if(local){selected=local.pair_id;render();repaintGallery();}
}
function remoteCard(remote,generated=false){
 const card=node('article',undefined,'card gallery-artwork'),photo=node('div',undefined,'cloud-placeholder'),target=actualGalleryFrame();
 card.classList.toggle('portrait',target==='portrait');
 photo.append(node('strong','☁'),node('span',t('cloudOnly')));
 const body=node('div',undefined,'card-content'),title=generated?(remote.prompt?.slice(0,90)||'Generated image'):(remote.display_name||remote.title);
 body.append(node('p',title,'card-title'));
 const actions=node('div',undefined,'card-controls'),buttonLoad=button(t('cloudLoadOne'),()=>generated?loadRemoteGenerated(remote):loadRemotePair(remote),'text-button');
 actions.append(buttonLoad);body.append(actions);card.append(photo,body);return card;
}
async function initR5(){
 if(API.apiUnlocked())try{await API.validateSession();}catch(e){if(e.status!==401){offlineSessionFallback=true;notify(e.message,true);}}
 await accountTransition;await activateSessionScope();
 initSettingsUI();initEnhancementUI();applyEnhancementControls();refreshCreateModels(false);galleryDisplayedFrame=actualGalleryFrame();applySettings();$('consent').checked=true;
 await init();appInitialized=true;switchTab('showcase');updateModelControls();document.documentElement.dataset.appReady='true';
 API.capabilities().then(value=>{capabilities=value;updateModelControls();}).catch(()=>{$('model-status').textContent=t('apiChecking');});
 if(API.sessionOwner()){gateway={url:API.API_BASE,version:'v3'};if(prefs.autoSyncMetadata)syncCloud(false).catch(()=>{});for(const p of pairs)for(const j of p.jobs)if(!j.enhancement_plan_id&&!['enhance','derive'].includes(j.operation)&&j.gateway_job_id&&['HELD','RUNNING','PENDING'].includes(j.status)&&modelFor(j.model)?.direct)runGateway(p,j).catch(()=>{});}
}
$('api-auth-cancel').addEventListener('click',()=>$('api-auth').close());
$('rename-form').addEventListener('submit',saveRename);
$('rename-cancel').addEventListener('click',()=>$('rename-dialog').close());
$('rename-dialog').addEventListener('close',()=>{renamingPairId=null;});
$('api-toggle').addEventListener('click',guard(async()=>{if(API.apiUnlocked()){API.lockAPI();gateway=null;notify('apiLocked');}else{await connectGateway();await syncCloud(false);}updateAuthLabel();}));
document.addEventListener('df-auth-change',()=>{accountTransition=accountTransition.catch(()=>{}).then(()=>activateSessionScope(true));accountTransition.catch(e=>notify(e.message,true));updateAuthLabel();});
$('create-kind').addEventListener('change',()=>{updateModelControls();render();});
$('collection-filter').addEventListener('change',()=>{renderReference();renderOwnGallery();});
$('cloud-load').addEventListener('click',guard(()=>{syncPaused=false;$('sync-pause').textContent=t('syncPause');return syncCloud(true);}));
$('sync-pause').addEventListener('click',guard(()=>{if(syncPaused){syncPaused=false;$('sync-pause').textContent=t('syncPause');return syncCloud(true);}syncPaused=true;activeSyncController?.abort();$('sync-pause').textContent=t('syncResume');}));
$('bench-generate').addEventListener('click',guard(runBench));
$('compare-pair').addEventListener('change',renderBenchResults);
$('compare-task').addEventListener('change',renderBenchModels);
$('viewer-play').addEventListener('click',startTour);
$('viewer-favorite').addEventListener('click',()=>favorite(viewerPair));
document.addEventListener('keydown',e=>{if(viewerPair&&e.key===' '&&!e.target.matches('input,textarea,select')){e.preventDefault();startTour();}});

function accountPreferences(owner){
 const prefix=owner==='bd-research-owner'?'':`df-account:${owner||'local-unassigned'}:`;
 return {getItem:key=>localStorage.getItem(prefix+key),setItem:(key,value)=>localStorage.setItem(prefix+key,value),removeItem:key=>localStorage.removeItem(prefix+key)};
}
let scopeOwner,scopedStore,enhancementClient,scopeController=new AbortController(),accountTransition=Promise.resolve(),appInitialized=false,offlineSessionFallback=false,enhancementBusy=false,creationBusy=false,activeEnhancementPlan=null;
async function activateSessionScope(force=false){
 const owner=API.sessionOwner()||(offlineSessionFallback?API.cachedSessionOwner():null);if(!force&&scopeOwner===owner&&scopedStore)return;
 document.documentElement.dataset.libraryState='switching';$('api-toggle').setAttribute('aria-busy','true');
 const previousSelection=selected;const localClaim=scopeOwner===null&&owner==='bd-research-owner'&&API.sessionOwner()===owner&&API.sessionMethod()==='legacy-password'?await snapshotUnassigned():null;
 scopeController.abort();activeSyncController?.abort();syncPaused=false;$('sync-pause').hidden=true;$('sync-pause').textContent=t('syncPause');for(const controller of controllers.values())controller.abort();controllers.clear();
 closeViewer();imageLoader.clear();clearWarmImages();for(const url of urls)URL.revokeObjectURL(url);urls.clear();urlCache=new WeakMap();
 pairs=[];scores=[];selected=null;remotePairs=[];remoteJobs=[];reviewState=null;activeEnhancementPlan=null;
 $('enhancement-families').replaceChildren();$('source-preview').removeAttribute('src');$('source-details').hidden=true;
 await setStorageOwner(owner);scopeOwner=owner;scopedStore=captureStorageScope();scopeController=new AbortController();
 if(localClaim)await claimUnassigned(localClaim,scopedStore);
 preferenceStorage=accountPreferences(owner);prefs=readSettings(preferenceStorage,modelKeys);enhancePrefs=readEnhancementSettings(preferenceStorage);
 try{favorites=new Set(JSON.parse(preferenceStorage.getItem('bd-df-favorites')||'[]'));}catch{favorites=new Set();}
 const client=API.captureAPI();syncEngine=newSyncEngine();enhancementClient=createEnhancementClient({api:client,store:scopedStore,signal:scopeController.signal,onChange:async()=>{if(scopeController.signal.aborted)return;pairs=await scopedStore.getPairs();render();renderEnhancementFamilies();}});
 if(appInitialized){pairs=await scopedStore.getPairs();scores=await scopedStore.getScores();selected=pairs.some(p=>p.pair_id===previousSelection)?previousSelection:pairs[0]?.pair_id||null;applySettings();applyEnhancementControls();render();repaintGallery();}
 document.documentElement.dataset.libraryOwner=owner||'local';document.documentElement.dataset.libraryState='ready';$('api-toggle').removeAttribute('aria-busy');
}
function enhancementActive(){return $('create-kind').value==='expand'&&canonicalMode($('mode').value)==='smart'&&(enhancePrefs.natural||enhancePrefs.artistic);}
function applyEnhancementControls(){
 $('enhance-natural').checked=enhancePrefs.artistic?false:enhancePrefs.natural;$('enhance-natural').disabled=enhancePrefs.artistic;
 $('enhance-artistic').checked=enhancePrefs.artistic;$('enhance-background').value=enhancePrefs.artistic?'ai':enhancePrefs.background;$('enhance-background').disabled=enhancePrefs.artistic;
 $('enhance-strength').value=enhancePrefs.strength;$('enhance-review').checked=enhancePrefs.reviewMaster;$('enhance-hd-copy').checked=enhancePrefs.includeHD;updateEnhancementControls();renderBenchModels();
}
function updateEnhancementControls(){
 const photo=$('create-kind').value==='expand'&&canonicalMode($('mode').value)==='smart';$('enhancement-controls').hidden=!photo;
 $('generate').disabled=enhancementBusy||creationBusy||(!selectedPair()&&$('create-kind').value!=='generate');$('enhance-only').disabled=!selectedPair()||enhancementBusy||creationBusy||!enhancementActive();$('enhance-hd-copy').disabled=$('output-quality').value!=='4k';
 $('enhance-tier-summary').textContent=(enhancePrefs.tier==='free'?`Free AI Enhance · ${t(enhancementStatus('free'))}`:`${modelFor($('pipeline').value)?.label||$('pipeline').value} · ${t(enhancementStatus('premium'))}`);
 if(enhancementActive()&&enhancePrefs.tier==='premium'&&!['openai-sunburst','openai-flare'].includes($('pipeline').value))$('enhance-tier-summary').textContent=t('ENHANCEMENT_MODEL_UNSUPPORTED');
 const calls=plannedCallCount(selectedPair());$('operation-summary').textContent=(enhancementActive()?t('enhancePair')+' · '+t('upToCalls').replace('{n}',calls)+' · '+t('enhanceOnly')+': 1 '+t('aiCall'):t('upToCalls').replace('{n}',1))+' · '+t('unknownCost');
 if(enhancementActive())$('generate').textContent=t('enhancePair');else $('generate').textContent=t($('create-kind').value==='generate'?'generateKind':'createOpposite');
}
function enhancementStatus(tier){return tier==='free'?(capabilities?.free_provider?.status||'FREE_PROVIDER_NOT_CONFIGURED'):(capabilities?.enhancement_policy?.status||'ENHANCE_POLICY_NOT_CONFIGURED');}
function renderEnhancementSettings(){
 $('settings-enhance-tier').value=enhancePrefs.tier;const free=enhancePrefs.tier==='free';
 for(const option of $('settings-enhance-model').options){option.hidden=free?option.value!=='cloudflare-flux-free':option.value==='cloudflare-flux-free';option.disabled=option.hidden;}
 $('settings-enhance-model').value=free?'cloudflare-flux-free':enhancePrefs.model;
 $('settings-enhance-status').textContent=t(enhancementStatus(free?'free':'premium'));
 const freeOption=$('settings-enhance-tier').querySelector('[value=free]');freeOption.disabled=!capabilities?.free_provider?.zero_spend_route_verified;freeOption.textContent='Free AI Enhance'+(freeOption.disabled?' · '+t('unavailableService'):'');
}
function renderPlan(plan){
 const box=$('enhancement-plan-content');box.replaceChildren();
 const text=(key,value)=>{box.append(node('p',`${t(key)}: ${value}`));};
 text('enhanceService',plan.tier||enhancePrefs.tier);text('model',plan.model);text('sourceHash',plan.source_sha256);text('enhanceFamily',plan.family_id);
 text('enhanceCalls',String(plan.maximum_api_calls));text('enhanceOperations',(plan.calls||[]).map(call=>`${call.operation} ${call.target||'master'} (${call.model_calls||0})`).join(' → '));
 const size=g=>g?.width&&g?.height?`${g.width} × ${g.height}`:'—';text('enhanceGeometry',`${t('enhanceMaster')}: ${size(plan.geometry?.master_export||plan.geometry?.master)} · ${t('enhanceRequest')}: ${size(plan.geometry?.master_request)} · ${(plan.calls||[]).filter(call=>call.target!=='master').map(call=>`${call.target}: ${size(call.geometry)}`).join(' / ')}`);text('enhanceCost',plan.cost?.maximum!==undefined?`${plan.cost.maximum} ${plan.cost.currency||''}`:t('unknownCost'));
 box.append(node('p',t('enhanceProcessing'),'small muted'));if(plan.recipe?.kind==='artistic')box.append(node('p',t('artisticDisclosure'),'small'));
 $('enhancement-plan-status').textContent=plan.available?t('enhanceReady'):t(plan.blocked_reason||'ENHANCE_POLICY_NOT_CONFIGURED');
 $('enhancement-plan-status').classList.toggle('error',!plan.available);
}
function frozenEnhancementOptions(enhanceOnly,model=$('pipeline').value){
 return {recipe:{kind:enhancePrefs.artistic?'artistic':'natural',strength:enhancePrefs.strength,background:enhancePrefs.artistic?'free':enhancePrefs.background},direction:$('prompt').value.trim(),model:enhancePrefs.tier==='free'?'cloudflare-flux-free':model,service_tier:enhancePrefs.tier,quality:$('output-quality').value,seed:Number($('seed').value),enhance_only:enhanceOnly,include_hd:enhancePrefs.includeHD,review_master:enhancePrefs.reviewMaster,same_orientation_fit:'model'};
}
async function planEnhancement(enhanceOnly){
 if(enhancementBusy)return;const pair=selectedPair();if(!pair)throw Error('SELECT_ORIGINAL');
 const options=frozenEnhancementOptions(enhanceOnly);if(options.service_tier==='premium'&&!['openai-sunburst','openai-flare'].includes(options.model))throw Error('ENHANCEMENT_MODEL_UNSUPPORTED');enhancementBusy=true;updateEnhancementControls();
 try{
  await connectGateway();if(!pairs.some(p=>p.pair_id===pair.pair_id))throw Error('STORAGE_OWNER_CHANGED');
  const client=enhancementClient,plan=await client.plan(pair.pair_id,options);renderPlan(plan);
  if(!plan.available)throw Error(plan.blocked_reason||'ENHANCE_POLICY_NOT_CONFIGURED');
  $('enhancement-plan-status').textContent=t('RUNNING');
  await client.start(pair.pair_id,plan);$('enhancement-plan-status').textContent=t('saved');
 }finally{enhancementBusy=false;updateEnhancementControls();}
}
async function runEnhancementAction(action){
 if(enhancementBusy)return;enhancementBusy=true;updateEnhancementControls();
 try{await action();pairs=await scopedStore.getPairs();render();renderEnhancementFamilies();}
 finally{enhancementBusy=false;updateEnhancementControls();}
}
function renderEnhancementFamilies(){
 const box=$('enhancement-families');box.replaceChildren();
 for(const pair of pairs)for(const family of pair.enhancement_families||[]){
  const el=node('article',undefined,'job');el.append(node('strong',`${displayTitle(pair)} · ${(family.plan?.recipe?.kind||family.restored_plan?.recipe?.kind||family.master?.recipe?.kind)==='artistic'?t('enhanceArtistic'):t('enhanceNatural')}`),node('p',family.status||'PLANNED','small'));
  if(family.error||family.plan?.blocked_reason)el.append(node('p',family.error||family.plan.blocked_reason,'small'));
  const master=family.master||(pair.masters||[]).find(m=>m.family_id===family.family_id);
  if(master&&selected===pair.pair_id&&((pair.enhancement_families||[]).at(-1)===family||family.status==='MASTER_READY')){const compare=node('div',undefined,'master-compare');for(const [asset,label,normalized] of [[pair.original,t('original'),true],[master,t('enhanceMaster'),false]]){const figure=node('figure'),img=node('img');img.alt=label;bindImage(img,asset,normalized);figure.append(img,node('figcaption',label));compare.append(figure);}el.append(compare,node('p',`${master.width} × ${master.height} · ${master.resolution_origin||'export'} · ${master.native_4k?'native 4K':t('exportNotNative')}`,'small'));
   const actions=node('div',undefined,'button-row');
   if(family.plan_id&&family.status!=='RESTORED'&&(master.acceptance==='READY'||family.status==='MASTER_READY')){
    actions.append(button(t('accept'),guard(()=>runEnhancementAction(()=>enhancementClient.acceptMaster(pair.pair_id,family.plan_id)))),button(t('reject'),guard(()=>runEnhancementAction(()=>enhancementClient.rejectMaster(pair.pair_id,family.plan_id)))));
   }
   el.append(actions);
  }
  if(master?.blob)el.append(button(t('downloadMaster'),guard(async()=>{const disk=captureStorageScope(),blob=await disk.getStoredBlob(master.blob);download(blob,`${safeName(displayTitle(pair))}-${master.recipe?.kind||'enhanced'}-master.${blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png'}`);}),'text-button'));
  if(family.plan_id&&family.plan?.available&&!['COMPLETE','REJECTED','RESTORED'].includes(family.status))el.append(button(t('resume'),guard(()=>runEnhancementAction(()=>enhancementClient.resume(pair.pair_id,family.plan_id))),'text-button'));
  if(family.plan?.recipe?.kind==='artistic')el.append(node('p',t('artisticDisclosure'),'small'));box.append(el);
 }
}
function initEnhancementUI(){
 for(const id of ['enhance-natural','enhance-artistic','enhance-background','enhance-strength','enhance-review','enhance-hd-copy'])$(id).addEventListener('change',()=>{
  enhancePrefs=writeEnhancementSettings({...enhancePrefs,natural:$('enhance-natural').disabled?enhancePrefs.natural:$('enhance-natural').checked,artistic:$('enhance-artistic').checked,background:$('enhance-background').value==='ai'?enhancePrefs.background:$('enhance-background').value,strength:$('enhance-strength').value,reviewMaster:$('enhance-review').checked,includeHD:$('enhance-hd-copy').checked},preferenceStorage);applyEnhancementControls();
 });
 $('settings-enhance-tier').addEventListener('change',()=>{const free=$('settings-enhance-tier').value==='free';for(const option of $('settings-enhance-model').options){option.hidden=free?option.value!=='cloudflare-flux-free':option.value==='cloudflare-flux-free';option.disabled=option.hidden;}$('settings-enhance-model').value=free?'cloudflare-flux-free':enhancePrefs.model;$('settings-enhance-status').textContent=t(enhancementStatus(free?'free':'premium'));
 const freeOption=$('settings-enhance-tier').querySelector('[value=free]');freeOption.disabled=!capabilities?.free_provider?.zero_spend_route_verified;freeOption.textContent='Free AI Enhance'+(freeOption.disabled?' · '+t('unavailableService'):'');renderBenchModels(free?'free':'premium');});
 $('settings-dialog').addEventListener('close',()=>renderBenchModels());
 $('settings-dialog').addEventListener('cancel',()=>renderBenchModels());
 $('enhance-only').addEventListener('click',guard(()=>planEnhancement(true)));

}
Object.assign(dictionary.en,{enhanceTitle:'Photo treatment',enhanceNatural:'Enhance photo naturally',enhanceArtistic:'Create artistic photo',enhanceBackground:'Background',backgroundKeep:'Keep original',backgroundCleanup:'Clean up existing',backgroundReplace:'Replace realistically',backgroundStudio:'Simple studio',backgroundAI:'AI chooses',enhanceStrength:'Strength',strengthSubtle:'Subtle',strengthNatural:'Natural',strengthStrong:'Stronger',reviewMaster:'Review enhancement before creating the second frame',includeHDCopy:'Include HD copy from accepted 4K · no extra AI call',enhancePlanNotice:'Review the source, model, processing and maximum calls before rendering. An empty artistic direction means Surprise me.',enhanceOnly:'Enhance only',enhancePair:'Enhance & create pair',enhanceService:'AI enhancement service',enhanceEntitlement:'Preferences do not grant paid access. Free never falls back to a paid model. New accounts have no paid entitlement.',accountSignIn:'Sign in with a verified account',operatorPolicy:'Operator policy',enhancePlan:'Review enhancement plan',enhanceConsent:'I own this image and approve this exact provider plan and its disclosed processing.',enhanceStart:'Approve & render',enhanceFamily:'Concept family',enhanceCalls:'Maximum AI API calls',enhanceOperations:'Operations',enhanceGeometry:'Request and export sizes',enhanceCost:'Maximum cost',enhanceProcessing:'Your selected original and references are sent only to the named hosted provider after approval. Processing terms and retention must be verified before access is enabled. The original stays unchanged; exports may be enlarged.',artisticDisclosure:'AI artistic recreation of recognizable people; this is a new interpretation, not a recovered historical photograph.',enhanceReady:'Ready for explicit approval',syncPause:'Pause Sync',syncResume:'Resume Sync',downloadMaster:'Download master',enhanceMaster:'Enhanced master',enhanceRequest:'Provider request',exportNotNative:'Export size; native detail is not guaranteed'});
Object.assign(dictionary.sl,{enhanceTitle:'Obdelava fotografije',enhanceNatural:'Naravno izboljšaj fotografijo',enhanceArtistic:'Ustvari umetniško fotografijo',enhanceBackground:'Ozadje',backgroundKeep:'Ohrani izvirno',backgroundCleanup:'Uredi obstoječe',backgroundReplace:'Realistično zamenjaj',backgroundStudio:'Preprost studio',backgroundAI:'Izbere AI',enhanceStrength:'Moč',strengthSubtle:'Nežno',strengthNatural:'Naravno',strengthStrong:'Močneje',reviewMaster:'Preglej izboljšavo pred ustvarjanjem drugega okvirja',includeHDCopy:'Dodaj HD kopijo sprejetega 4K · brez dodatnega AI klica',enhancePlanNotice:'Pred ustvarjanjem preglej vir, model, obdelavo in največje število klicev. Prazna umetniška usmeritev pomeni Preseneti me.',enhanceOnly:'Samo izboljšaj',enhancePair:'Izboljšaj in ustvari par',enhanceService:'Storitev AI izboljšave',enhanceEntitlement:'Nastavitve ne podelijo plačljivega dostopa. Free nikoli samodejno ne preklopi na plačljiv model. Novi računi nimajo plačljive pravice.',accountSignIn:'Prijava s preverjenim računom',operatorPolicy:'Politika upravljavca',enhancePlan:'Preglej načrt izboljšave',enhanceConsent:'Slika je moja in potrjujem ta načrt ponudnika ter opisano obdelavo.',enhanceStart:'Potrdi in ustvari',enhanceFamily:'Družina zasnove',enhanceCalls:'Največ AI API klicev',enhanceOperations:'Opravila',enhanceGeometry:'Velikosti zahteve in izvoza',enhanceCost:'Najvišji strošek',enhanceProcessing:'Izbrani izvirnik in reference se šele po potrditvi pošljejo navedenemu ponudniku. Pred vklopom morajo biti preverjeni pogoji obdelave in hrambe. Izvirnik ostane nespremenjen; izvoz je lahko povečan.',artisticDisclosure:'AI umetniška poustvaritev prepoznavnih oseb; nova interpretacija, ne obnovljena zgodovinska fotografija.',enhanceReady:'Pripravljeno za izrecno potrditev',syncPause:'Začasno ustavi Sync',syncResume:'Nadaljuj Sync',downloadMaster:'Prenesi master',enhanceMaster:'Izboljšani master',enhanceRequest:'Zahteva ponudniku',exportNotNative:'Velikost izvoza; izvirna raven podrobnosti ni zagotovljena'});

async function planEnhancementComparison(pair,models,requests){
 if(models.some(key=>!['openai-sunburst','openai-flare'].includes(key))&&enhancePrefs.tier==='premium')throw Error('MODEL_ENHANCE_UNSUPPORTED');
 if(enhancePrefs.tier==='free')throw Error('FREE_PROVIDER_NOT_CONFIGURED');
 const client=enhancementClient,plans=[];
 for(const options of requests)plans.push(await client.plan(pair.pair_id,options));
 const first=plans[0],available=plans.every(plan=>plan.available),currencies=new Set(plans.map(plan=>plan.cost?.currency)),known=plans.every(plan=>Number.isFinite(plan.cost?.maximum))&&currencies.size===1;
 const aggregate={...first,available,blocked_reason:plans.find(plan=>!plan.available)?.blocked_reason,maximum_api_calls:plans.reduce((n,plan)=>n+plan.maximum_api_calls,0),cost:known?{maximum:plans.reduce((n,plan)=>n+plan.cost.maximum,0),currency:first.cost.currency}:null,calls:plans.flatMap(plan=>plan.calls),model:plans.map(plan=>plan.model).join(' + '),family_id:plans.map(plan=>plan.family_id).join(' + ')};
 renderPlan(aggregate);$('bench-status').textContent=t('enhanceCalls')+': '+aggregate.maximum_api_calls+' · '+(aggregate.cost?aggregate.cost.maximum+' '+aggregate.cost.currency:t('unknownCost'));
 if(!available)throw Error(aggregate.blocked_reason||'ENHANCE_POLICY_NOT_CONFIGURED');
 for(const plan of plans)await client.start(pair.pair_id,plan);
}

let operatorPolicyVersion=null;
async function readOperatorPolicy(){
 const box=$('admin-policy-status');box.hidden=false;$('admin-policy-editor-field').hidden=true;$('admin-policy-save').hidden=true;
 try{const value=await API.request('/admin/policy');operatorPolicyVersion=value.policy?.version??null;box.textContent=JSON.stringify({audit:value.audit,atomic_quota_backend:value.atomic_quota_backend},null,2);$('admin-policy-editor').value=JSON.stringify(value.policy,null,2);$('admin-policy-editor-field').hidden=false;$('admin-policy-save').hidden=false;}
 catch(e){box.textContent=e.message;if(e.message==='ENHANCE_POLICY_NOT_CONFIGURED'){operatorPolicyVersion=null;$('admin-policy-editor').value='';$('admin-policy-editor').placeholder=t('operatorPolicyRequired');$('admin-policy-editor-field').hidden=false;$('admin-policy-save').hidden=false;}}
}
async function saveOperatorPolicy(){
 const policy=JSON.parse($('admin-policy-editor').value),value=await API.request('/admin/policy',{method:'PUT',body:{expected_version:operatorPolicyVersion,policy}});operatorPolicyVersion=value.policy?.version??null;$('admin-policy-status').textContent=JSON.stringify(value.audit,null,2);
}
Object.assign(dictionary.en,{operatorPolicyRequired:'Enter a complete versioned policy with explicit approved limits and cost ceilings. No allowances are prefilled.',retentionDisclosure:'Cloud deletion hides the library record; stored bytes are retained under the current restricted service. Export a private backup before removing a local copy. Public processing and retention terms are awaiting verification.'});
Object.assign(dictionary.sl,{operatorPolicyRequired:'Vnesi celotno različico pravil z izrecno odobrenimi omejitvami in stroškovnimi mejami. Pravice niso vnaprej izpolnjene.',retentionDisclosure:'Izbris v oblaku skrije zapis knjižnice; shranjene datoteke se v sedanji omejeni storitvi ohranijo. Pred odstranitvijo lokalne kopije izvozi zasebno varnostno kopijo. Javni pogoji obdelave in hrambe še čakajo na preverjanje.'});



function plannedCallCount(pair){if(!pair)return 3;const w=pair.original.width,h=pair.original.height;return w*9===h*16||w*16===h*9?2:3;}
async function snapshotUnassigned(){const rows=await scopedStore.getPairs(),full=[];for(const p of rows)full.push(await scopedStore.hydratePair(p));const clone=value=>value instanceof Blob?value.slice(0,value.size,value.type):Array.isArray(value)?value.map(clone):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)])):value;return {pairs:clone(full),scores:await scopedStore.getScores()};}
async function claimUnassigned(local,disk){
 const known=await disk.getPairs(),hashes=new Set(known.map(p=>p.original.sha256));let incomplete=false;
 for(const pair of local.pairs){if(hashes.has(pair.original.sha256))continue;try{await disk.putOriginal(pair);hashes.add(pair.original.sha256);}catch{incomplete=true;break;}}
 const scores=new Set((await disk.getScores()).map(s=>s.comparison_id));for(const score of local.scores)if(!scores.has(score.comparison_id)&&hashes.has(score.original_sha256))try{await disk.addScore(score);}catch{incomplete=true;}
 if(incomplete)notify('localClaimPending',true);
}
Object.assign(dictionary.en,{localNotice:'Import up to 100 originals here, even offline. Unlock API once when you choose Create, Compare or Sync.',storageSafeHelp:'Press Sync to transfer every saved original and variant. Startup refreshes names only. Local-only originals are never evicted.',enhancePlanNotice:'One click starts the selected operation. An empty artistic direction means Surprise me.',enhanceEntitlement:'Your private API password unlocks supported configured models. Free never falls back to a paid model.',enhanceReady:'Ready',enhanceProcessing:'Your explicit Create click sends the selected original and references to this hosted provider. The original stays unchanged; exports may be enlarged.',PRIVATE_OWNER_PASSWORD_READY:'Private API ready · unlock once to create',ENHANCE_KILL_SWITCH:'Image processing is paused on the server.',ENHANCE_POLICY_NOT_CONFIGURED:'The server authorization is unavailable. Existing images are safe.',FREE_PROVIDER_NOT_CONFIGURED:'Free AI is unavailable; choose the configured Premium service in Settings.',ENHANCEMENT_MODEL_UNSUPPORTED:'This model does not support photo enhancement. Choose Sunburst or Flare.',MODEL_ENHANCE_UNSUPPORTED:'Select a compatible photo enhancement model.',OWNER_ACTIVE_PLANS_HELD:'Two plans are still active or awaiting a known outcome. Resume those plans before starting more.',OWNER_RATE_LIMITED:'Two new plans were started this minute. Wait a minute before a new task.',OWNER_CALL_ALREADY_CLAIMED:'This model call was already claimed. Check the saved job; it will not be sent again.',unavailableService:'unavailable',upToCalls:'Up to {n} AI calls',aiCall:'AI call',backupProgress:'Preparing private backup',BACKUP_ASSET_LIMIT:'One saved image exceeds the 64 MiB archive guard. Use its original/variant download and Sync; nothing was deleted.',BACKUP_ARCHIVE_LIMIT:'This archive exceeds 4 GiB. Use full Sync and individual image downloads. Existing images are unchanged.',BACKUP_METADATA_LIMIT:'Backup metadata exceeds the safe limit. Export individual images and Sync; existing data is unchanged.',localClaimPending:'Some local imports could not be added to the unlocked gallery. All imports remain recoverable in the locked local collection.'});
Object.assign(dictionary.sl,{localNotice:'Tukaj uvozi do 100 izvirnikov, tudi brez interneta. API enkrat odkleni šele ob Create, Compare ali Sync.',storageSafeHelp:'Pritisni Sync za prenos vseh shranjenih izvirnikov in različic. Ob zagonu se osvežijo le imena. Lokalni izvirniki se ne odstranjujejo samodejno.',enhancePlanNotice:'En klik zažene izbrano obdelavo. Prazna umetniška usmeritev pomeni Preseneti me.',enhanceEntitlement:'Tvoje zasebno API geslo odklene podprte nastavljene modele. Free nikoli ne preklopi na plačljiv model.',enhanceReady:'Pripravljeno',enhanceProcessing:'Izrecni klik Ustvari pošlje izbrani izvirnik in reference temu ponudniku. Izvirnik ostane nespremenjen; izvozi so lahko povečani.',PRIVATE_OWNER_PASSWORD_READY:'Zasebni API je pripravljen · odkleni enkrat',ENHANCE_KILL_SWITCH:'Obdelava slik je na strežniku začasno ustavljena.',ENHANCE_POLICY_NOT_CONFIGURED:'Strežniška avtorizacija ni na voljo. Obstoječe slike so varne.',FREE_PROVIDER_NOT_CONFIGURED:'Brezplačni AI ni na voljo; v Nastavitvah izberi nastavljeno storitev Premium.',ENHANCEMENT_MODEL_UNSUPPORTED:'Model ne podpira izboljšave fotografij. Izberi Sunburst ali Flare.',MODEL_ENHANCE_UNSUPPORTED:'Izberi model, ki podpira izboljšavo fotografij.',OWNER_ACTIVE_PLANS_HELD:'Dva načrta še potekata ali čakata na znan izid. Najprej nadaljuj shranjena načrta.',OWNER_RATE_LIMITED:'V tej minuti sta bila zagnana dva nova načrta. Za novo opravilo počakaj minuto.',OWNER_CALL_ALREADY_CLAIMED:'Ta klic je že prevzet. Preveri shranjeno opravilo; ne bo samodejno ponovljen.',unavailableService:'ni na voljo',upToCalls:'Do {n} AI klicev',aiCall:'AI klic',backupProgress:'Pripravljam zasebno kopijo',BACKUP_ASSET_LIMIT:'Ena slika presega varovalo arhiva 64 MiB. Uporabi njen prenos in Sync; nič ni izbrisano.',BACKUP_ARCHIVE_LIMIT:'Arhiv presega 4 GiB. Uporabi polni Sync in prenose posameznih slik. Obstoječe slike so ohranjene.',BACKUP_METADATA_LIMIT:'Metapodatki kopije presegajo varno omejitev. Uporabi posamezne prenose in Sync; podatki so ohranjeni.',localClaimPending:'Nekaterih lokalnih uvozov ni bilo mogoče dodati odklenjeni galeriji. Vsi ostanejo ohranjeni v ločeni lokalni zbirki.'});

cartoons=createCartoons({container:$('cartoons-gallery'),getLanguage:()=>language,onStoryLanguage:lang=>{if(language===lang)return;language=lang;try{localStorage.setItem('dualframe-language',language);}catch{}document.documentElement.lang=language;$('language').textContent=language==='en'?'SL':'EN';}});
$('product-cartoons').addEventListener('click',()=>switchProduct('cartoons'));
$('product-photos').addEventListener('click',()=>switchProduct('photos'));
// Public, read-only diagnostic surface: DFC content/state only, no owner data.
window.DFCReader={getState:cartoons.getState,getEdition:cartoons.getEdition,getCacheStats:cartoons.getCacheStats};
initPWA().catch(()=>pwaSetStatus('pwaUnavailable'));
initR5().catch(e=>notify(e.message,true));
