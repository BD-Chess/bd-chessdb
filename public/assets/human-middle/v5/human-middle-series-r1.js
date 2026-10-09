/* Human in the Middle / BD x AI Lab. Time, Information and Questions.
 * Ordered public-relative WebP paths; source images are not modified.
 * Additional external references require separate source verification.
 */
(function(){
'use strict';
const artwork=(id,en,sl,enSummary,slSummary)=>({id,status:'published',src:'assets/human-middle/v5/Human_in_the_Middle_HD_'+(id.startsWith('time')?'TIME':'INFO')+id.slice(-2)+'.webp',width:941,height:1672,title:{en,sl},summary:{en:enSummary,sl:slSummary},sources:[]});
window.MDLxDCCHumanMiddleSeries={
 time:{
  title:{en:'Time',sl:'Čas'},
  summary:{en:'From a heartbeat to the age of the universe — and the time reshaped by knowledge, tools and collaboration.',sl:'Od utripa do starosti vesolja — ter časa, ki ga spreminjajo znanje, orodja in sodelovanje.'},
  items:[
   artwork('time-01','A heartbeat between micro and macro time','Utrip med mikro in makro časom','A human rhythm between fleeting events and cosmic time.','Človeški ritem med bežnimi dogodki in kozmičnim časom.'),
   artwork('time-02','How much time is in a lifetime?','Koliko časa je v enem življenju?','A lifetime placed among the timescales of the physical world.','Življenje med časovnimi merili fizikalnega sveta.'),
   artwork('time-03','Two heights, two clocks','Dve višini, dve uri','How gravity changes the rate of clocks at different heights.','Kako gravitacija spremeni tek ur na različnih višinah.'),
   artwork('time-04','Hands and a cell','Roke in celica','Copying a DNA sequence by hand, and the parallel work inside a cell.','Prepisovanje zaporedja DNA z rokami in vzporedno delo v celici.'),
   artwork('time-05','One second each — together','Sekunda za vsakega — skupaj','What changes when people share the work.','Kaj se spremeni, ko si ljudje razdelijo delo.'),
   artwork('time-06','Every view arrives from the past','Vsak pogled prispe iz preteklosti','The travel time of light connects distance and observation.','Potovalni čas svetlobe povezuje razdaljo in opazovanje.'),
   artwork('time-07','Nanoseconds guide you home','Nanosekunde te pripeljejo domov','Precise timing behind satellite navigation.','Natančno merjenje časa v satelitski navigaciji.'),
   artwork('time-08','Research opens new possibilities','Raziskovanje odpira nove možnosti','Years of experiments and shared knowledge enable new predictions and checks.','Leta poskusov in skupnega znanja omogočajo nove napovedi in preverjanja.'),
   artwork('time-09','An idea changes the computer’s work','Zamisel spremeni delo računalnika','Algorithms connect human insight with the time needed for computation.','Algoritmi povezujejo človeški uvid s časom, potrebnim za računanje.')
  ]
 },
 information:{
  title:{en:'Information',sl:'Informacija'},
  summary:{en:'How small seeds create rich patterns, and shorter descriptions preserve data.',sl:'Kako majhna semena ustvarijo bogate vzorce in krajši opisi ohranijo podatke.'},
  items:[
   artwork('information-01','The Living Seed of a Creator','Živo seme ustvarjalca','DNA, cellular machinery and the conditions in which living forms develop.','DNA, celični stroji in pogoji, v katerih nastajajo žive oblike.'),
   artwork('information-02','A Tiny Fragment, a Vast Data Archive','Majhen drobec, ogromen merilni zapis','A small piece of tissue can give rise to a large record of measurements.','Majhen košček tkiva lahko ustvari obsežen zapis meritev.'),
   artwork('information-03','Experience Recognizes Structure','Izkušnja prepozna strukturo','Chess as a window into learned patterns and meaningful relationships.','Šah kot pogled v naučene vzorce in smiselna razmerja.'),
   artwork('information-04','One Rule, Two Exceptions','Pravilo in dve izjemi','A pattern described through a rule, its exceptions and a shared decoder.','Vzorec, opisan s pravilom, izjemami in skupnim dekoderjem.'),
   artwork('information-05','The whole description counts','Šteje celoten opis','Count the model, the data and what the model leaves unexplained.','Štej model, podatke in tisto, česar model ne pojasni.'),
   artwork('information-06','Compress and preserve','Stisni in ohrani','Lossless compression: a shorter record that reconstructs the original data.','Kompresija brez izgub: krajši zapis, ki obnovi izvirne podatke.'),
   artwork('information-07','The physical cost of erasure','Fizikalna cena brisanja','Information erasure and the physical conditions of computation.','Brisanje informacij in fizikalni pogoji računanja.'),
   artwork('information-08','Apparent Randomness, Unknown Start','Navidezno naključje, neznan začetek','A coin toss and the initial conditions we do not know.','Met kovanca in začetni pogoji, ki jih ne poznamo.'),
   artwork('information-09','Description and experience','Opis in doživljanje','Exploring the relationship between a description and lived experience.','Raziskovanje odnosa med opisom in doživljanjem.')
  ]
 },
 questions:{
  title:{en:'Questions',sl:'Vprašanja'},
  summary:{en:'Knowledge lives in the tower. Questions are born on the meadow.',sl:'Znanje živi v stolpnici. Vprašanja se rodijo na travniku.'},
  items:[{
   id:'questions-01',status:'published',
   src:'assets/human-middle/v5/Human_in_the_Middle_Questions_Meadow_Tower_Caption_R1.webp',
   preview:'assets/human-middle/v5/Human_in_the_Middle_Questions_Meadow_Tower_Clean_R1.webp',
   width:941,height:1672,
   title:{en:'The Meadow and the Tower',sl:'Travnik in stolpnica'},
   summary:{en:'Knowledge lives in the tower. Questions are born on the meadow.',sl:'Znanje živi v stolpnici. Vprašanja se rodijo na travniku.'},
   explanation:{
    en:'A small human stands on a mixed book written by living. Seeds of questions and imagination rise into the open sky, the library tower and the book of its AI librarian, who has stepped outside. This is a metaphor for complementary perspectives, not small against big: knowledge gains a new view when it meets lived experience. The invitation is to step onto the meadow, look up and ask together.',
    sl:'Majhen človek stoji na mešani knjigi, napisani z življenjem. Semena vprašanj in domišljije se dvigajo v odprto nebo, knjižnično stolpnico in knjigo njenega AI knjižničarja, ki je stopil ven. To je metafora dopolnjujočih se pogledov, ne majhnega proti velikemu: znanje dobi nov pogled, ko se sreča z življenjsko izkušnjo. Vabilo je, da stopimo na travnik, pogledamo navzgor in sprašujemo skupaj.'
   },
   credit:'seed BD · words BD × Claude · picture GPT · 2026',
   sources:[]
  }]
 }
};
})();

