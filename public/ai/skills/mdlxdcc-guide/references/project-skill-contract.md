# Skupna pogodba projektnih veščin

Uporabi pri pripravi ali vključevanju DGTE in drugih projektnih veščin.

## Paket

- Uporabi enolično ime z malimi črkami, številkami in vezaji, npr. dgte-advisor.
- Ime mape naj bo isto kot name v YAML glavi.
- V SKILL.md vključi samo YAML polji name in description ter navodila.
- V description opiši vsebino in kdaj uporabiti veščino, v slovenščini ali angleščini z relevantnimi imeni.
- Jasno pokrij tudi vprašanja brez izrecnega imena projekta, če trenutna stran ali prejšnji pogovor določa projekt.
- Obširne javne podatke postavi v references/, ponovljive račune po potrebi v scripts/.
- V samem paketu navedi različico in datum ter povezave na javne vire.
- Pripravi paket brez odvisnosti od zasebnega Drivea ali spomina avtorjeve seje.

## Odgovori

Pojasni princip, uporabljene formule, predpostavke, izvedbo in odprta vprašanja. Podatke označi kot cilj, model, meritev ali drugo ustrezno raven. Razlike s starejšimi javnimi stranmi izrecno razreši.

Vključi postopek za pogosta in nepričakovana vprašanja. Pri DGTE zajemi velikost, toplotni vir/ponor, neto izgube, faktor delovanja in ekonomske predpostavke; ne zakleni odgovorov na eno številko iz starega primera.

Ohrani navodila združljiva z osnovnim Guide. Ne prepisuj njegovih jezikovnih, navigacijskih in pogovornih pravil brez projektnega razloga.

## Registracija

Guide pričakuje zapis:
- id, name, description, version;
- availability: ready samo za obstoječe preverjene datoteke;
- skill_path: relativno na mapo public/ai/skills/;
- project_ids, page_prefixes, topic_hints;
- reference_paths in file_hashes za vse datoteke paketa.

Pot za predvideni DGTE paket je dgte-advisor/SKILL.md. Dokler paket ni dodan in preverjen, mora ostati v planned_skills.

Metapodatki pomagajo agentu izbrati veščino. Projektna veščina ne potrebuje drugega modela ali novega pogovora.

## Preverjanje

Pripravi vsaj deset realnih vprašanj z merili preverjanja: osnovna razlaga, strokovno vprašanje, račun, manjkajoč podatek, sprememba predpostavke, primerjava, star vir, nasprotujoča si vira in nejasen follow-up.

Pred integracijo preveri poti, veljavnost glave, javnost virov in računske skripte. Pri oceni odgovorov preveri pravilnost in uporabnost; podprt zaključek je lahko tudi negativen ali pogojen.
