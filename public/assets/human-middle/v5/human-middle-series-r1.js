/* Human in the Middle: working topics for the two forthcoming series.
 * To publish an approved image, set status to 'published', src to a path
 * relative to public/ (assets/human-middle/...), width/height, and sources.
 * A planned item never requests an image or opens the image viewer.
 */
(function(){
'use strict';
const planned=(id,en,sl,enSummary,slSummary)=>({id,status:'planned',src:null,title:{en,sl},summary:{en:enSummary,sl:slSummary},sources:[]});
window.MDLxDCCHumanMiddleSeries={
 time:{
  title:{en:'Time',sl:'Čas'},
  summary:{en:'From a heartbeat to the age of the universe — and the time reshaped by knowledge, tools and collaboration.',sl:'Od utripa do starosti vesolja — ter časa, ki ga spreminjajo znanje, orodja in sodelovanje.'},
  items:[
   planned('time-01','A heartbeat between micro and macro time','Utrip med mikro in makro časom','A human rhythm between fleeting events and cosmic time.','Človeški ritem med bežnimi dogodki in kozmičnim časom.'),
   planned('time-02','How much time is in a lifetime?','Koliko časa je v enem življenju?','A lifetime placed among the timescales of the physical world.','Življenje med časovnimi merili fizikalnega sveta.'),
   planned('time-03','Two heights, two clocks','Dve višini, dve uri','How gravity changes the rate of clocks at different heights.','Kako gravitacija spremeni tek ur na različnih višinah.'),
   planned('time-04','Hands and a cell','Roke in celica','Copying a DNA sequence by hand, and the parallel work inside a cell.','Prepisovanje zaporedja DNA z rokami in vzporedno delo v celici.'),
   planned('time-05','One second each — together','Sekunda za vsakega — skupaj','What changes when people share the work.','Kaj se spremeni, ko si ljudje razdelijo delo.'),
   planned('time-06','Every view arrives from the past','Vsak pogled prispe iz preteklosti','The travel time of light connects distance and observation.','Potovalni čas svetlobe povezuje razdaljo in opazovanje.'),
   planned('time-07','Nanoseconds guide you home','Nanosekunde te pripeljejo domov','Precise timing behind satellite navigation.','Natančno merjenje časa v satelitski navigaciji.'),
   planned('time-08','Research opens new possibilities','Raziskovanje odpira nove možnosti','Years of experiments and shared knowledge enable new predictions and checks.','Leta poskusov in skupnega znanja omogočajo nove napovedi in preverjanja.'),
   planned('time-09','An idea changes the computer’s work','Zamisel spremeni delo računalnika','Algorithms connect human insight with the time needed for computation.','Algoritmi povezujejo človeški uvid s časom, potrebnim za računanje.')
  ]
 },
 information:{
  title:{en:'Generators and data',sl:'Generatorji in podatki'},
  summary:{en:'How small seeds create rich patterns, and shorter descriptions preserve data.',sl:'Kako majhna semena ustvarijo bogate vzorce in krajši opisi ohranijo podatke.'},
  items:[
   planned('information-01','A living seed of creation','Živo seme ustvarjalca','DNA, cellular machinery and the conditions in which living forms develop.','DNA, celični stroji in pogoji, v katerih nastajajo žive oblike.'),
   planned('information-02','A tiny fragment, a vast measurement record','Majhen drobec, ogromen merilni zapis','A small piece of tissue can give rise to a large record of measurements.','Majhen košček tkiva lahko ustvari obsežen zapis meritev.'),
   planned('information-03','Experience recognises structure','Izkušnja prepozna strukturo','Chess as a window into learned patterns and meaningful relationships.','Šah kot pogled v naučene vzorce in smiselna razmerja.'),
   planned('information-04','A rule and two exceptions','Pravilo in dve izjemi','A pattern described through a rule, its exceptions and a shared decoder.','Vzorec, opisan s pravilom, izjemami in skupnim dekoderjem.'),
   planned('information-05','The whole description counts','Šteje celoten opis','Count the model, the data and what the model leaves unexplained.','Štej model, podatke in tisto, česar model ne pojasni.'),
   planned('information-06','Compress and preserve','Stisni in ohrani','Lossless compression: a shorter record that reconstructs the original data.','Kompresija brez izgub: krajši zapis, ki obnovi izvirne podatke.'),
   planned('information-07','The physical cost of erasure','Fizikalna cena brisanja','Information erasure and the physical conditions of computation.','Brisanje informacij in fizikalni pogoji računanja.'),
   planned('information-08','Apparent randomness, an unknown start','Navidezno naključje, neznan začetek','A coin toss and the initial conditions we do not know.','Met kovanca in začetni pogoji, ki jih ne poznamo.'),
   planned('information-09','Description and experience','Opis in doživljanje','Exploring the relationship between a description and lived experience.','Raziskovanje odnosa med opisom in doživljanjem.')
  ]
 }
};
})();
