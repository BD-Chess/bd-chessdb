# MyDeepSeekRHP · spletni klepet

Kratek spletni naslov je https://www.mdlxdcc.org/DS/. Odpre zaščiteni klepet na `/deepseek-chat/` tudi s telefona. Lokalni klepet in RHP na WORK sta na `http://127.0.0.1:8888/` in uporabljata lokalni arhiv.

Spletna prijava uporablja strežniško nastavljen račun lastnika, namenski strežniški scrypt zapis in namenski podpisni ključ. Prijava poteče po osmih urah. Odjava odstrani sejo iz trenutnega brskalnika. Pri nujnem preklicu vseh sej zamenjaj namenski podpisni ključ in objavi novo različico.

Na projektu Netlify mdlxdcc so nastavitve DEEPSEEK_CHAT_OWNER_EMAIL, DEEPSEEK_CHAT_PASSWORD_HASH in DEEPSEEK_CHAT_SESSION_SECRET nastavljene v produkcijskem okolju. Strežnik uporablja vrednosti ob preverjanju prijave. Podpisni ključ in zgoščena vrednost gesla sta označena kot skrivnosti. Za pripravo novega gesla uporabi funkcijo passwordHash iz functions/lib/mdlxdcc-guide/access.mjs. Spremenjeni strežniški vrednosti začneta veljati po naslednji objavi.

## Nabiralnik

Poziv na zaščiteni spletni strani potuje v namenski Google Drive nabiralnik. Izvajalnik na WORK zapiše prevzem, pokliče službeni DeepSeek in shrani odgovor v isti nabiralnik. Spletna stran odčita prevzem in odgovor z istim ID-jem. Lokalni zagon 8888 pokliče službeni DeepSeek neposredno.

Pri nastavljeni povezavi `available` potrdi dostop do Drive map. Tekoči prevzem na WORK potrdi prvi ACK za konkretno vprašanje. Če povezava z Driveom še ni aktivirana, produkcijski handler vrne `available: false`.

API si deli obstoječo lastnikovo sejo. `GET /deepseek-chat/api/messages` preveri razpoložljivost. `POST` sprejme samo UUID v4, besedilni poziv in stikalo Reasoning. `GET /deepseek-chat/api/messages/{id}` vrne samo pripadajoči poziv, stanje in končni odgovor. `POST` na isti poti zahteva STOP. `queued`, `acknowledged`, `running` in `complete` pomenijo različne stopnje. `stopping` je zahteva. `stopped` je potrditev izvajalnika. Izid `uncertain` se ne ponovi samodejno.

Spletna pogodba predvideva izolacijo po prijavljenem lastniku, enoličnost istega UUID, trajen odgovor na ponovni odčitek in identifikator v vsakem izidu. Prejšnje besedilo ni kontekst novega modelnega klica. Brskalnik hrani zadnji ID v zavihku, da ga lahko po osvežitvi ponovno odčita. Sintetični adapter je samo v testih.

Če brskalnik izgubi potrditev oddaje ali STOP, do tri minute preverja stanje po istem UUID. Besedilo v odprtem zavihku ostane v vnosu do potrditve oddaje. Brskalnik med preverjanjem pošilja samo zahteve `GET`.

### Nastavitev spletnega adapterja

Obstoječe nastavitve lastnikove seje veljajo tudi za nabiralnik. Za adapter nastavi ločeno identiteto Google OAuth, namenjeno temu nabiralniku.

| Nastavitev | Vrednost |
| --- | --- |
| `DEEPSEEK_CHAT_DRIVE_ENABLED` | Točno `true` za vklop. |
| `DEEPSEEK_CHAT_DRIVE_INBOX_ID` | ID zasebne mape za zahteve in STOP. Spletna identiteta potrebuje zapis. |
| `DEEPSEEK_CHAT_DRIVE_RESULTS_ID` | ID druge zasebne mape. Spletna identiteta potrebuje branje datotek, ki jih vanjo zapiše izvajalnik. |
| `DEEPSEEK_CHAT_DRIVE_PERMISSION_ID` | Vrednost `user.permissionId` iz Google Drive `about.get` za isto identiteto. Adapter primerja identiteto ob osvežitvi žetona. |
| `DEEPSEEK_CHAT_DRIVE_CLIENT_ID` | ID namenskega Google OAuth odjemalca. |
| `DEEPSEEK_CHAT_DRIVE_CLIENT_SECRET`, `DEEPSEEK_CHAT_DRIVE_REFRESH_TOKEN` | Skrivnosti okolja Netlify Functions za isti namenski račun. |

OAuth obseg mora dovoliti ustvarjanje datotek v inboxu ter branje potrdil drugega izvajalnika v results. Obseg `drive.file` uporabi samo, če v celotnem toku potrdiš dostop do teh datotek. Za obseg `drive` uporabi namenski račun, katerega dovoljenja so omejena na ta nabiralnik. Poverilnice za povezavo WORK/rclone ostanejo pri izvajalniku. Mapi naj bosta dostopni samo predvidenima identitetama in pooblaščenim vzdrževalcem.

Spletni adapter posreduje samo besedilni poziv in stikalo Reasoning. V inboxu hrani `<id>.json` in po potrebi `<id>.stop.json`. Iz results bere `<id>.ack.json` in `<id>.result.json`. Vsaka UTF-8 datoteka vsebuje lastnika, UUID, čas UTC in namensko različico sheme. Brskalnik vidi odgovor pri stanju `complete`. `uncertain` je končno stanje brez samodejne ponovitve. Ohrani pooblastila map in revizijsko sled. Dogovori hrambo datotek Drive in rezervacij v storitvi Netlify Blobs `mydeepseekrhp-drive-ids-v1`. Vsaka rezervacija vsebuje Drive ID, čas in prstni odtis zahteve. Za čas ponovnih poskusov morajo ostati tako datoteke kot rezervacije.

Za celotni prevzem uporabi svež testni poziv v pravem spletnem vmesniku. Potrdi isti UUID pri zapisani zahtevi, ACK izvajalnika, odgovoru DeepSeeka in prikazu po osvežitvi brskalnika. Preveri še, da ponovljeni UUID ne ustvari dodatne modelne zahteve in da STOP razlikuje zahtevo od potrditve. Ročni izvoz lokalnega arhiva je ločena funkcija.


## R5 · mobilni Plan, Build in RHP

Funkcije ostanejo za obstoječo vstopno pot in sejo lastnika. Za namenski
nabiralnik nastavi obstoječe OAuth spremenljivke ter dodaj
`DEEPSEEK_CHAT_WORK_ENABLED=true` v produkcijsko Functions okolje. Dokler je
stikalo izklopljeno, stran in ovojnice v1 delujejo kot prej. Novo stikalo vključi
po preverjenem povratnem klepetu s službenim modelom, delavcu R5 in vnaprej
registriranem testnem projektu, ki ga WORK izrecno izpostavi v nabiralnik.

V mobilnem **Delo na projektu** izberi Plan ali Build in pridobi seznam projektov.
Po načrtu lahko zahtevaš RHP presojo. Po Build preberi diff in odloči. Če želiš
RHP presojo diffa pred potrditvijo, jo izvedi in nato v **Zadnje zahteve** znova
odpri ustrezni Build. Potrditev zahteva prikazani Build, njegov UUID, projekt,
ID predloga in SHA-256 osnove in diffa. Zapis in test izvede WORK. Rezultat
prikaže tudi SHA-256 ponovnega odčitka, kadar ga izvajalnik vrne. Brez uspešnega
končnega potrdila strani ne uporabljaj za sklepanje o stanju datoteke. Ob
negotovi oddaji stran preverja isti UUID. ACK in rezultat morata pripadati istemu
pozivu, zaščiten prenos ZIP pa preveri še dolžino in SHA-256.

Spremenljivka samo za MDLxDCC. Uporabi [obstoječo objavo](NETLIFY_DEPLOYMENT.md).
Varnost poti, sej, map in skrivnosti ohranjajo trenutni GitHub CI in prebuilt
Netlify. Pri vračanju najprej izklopi R5 stikalo za Functions, uveljavi prek
obstoječe objave in uskladi morebitne odprte zahteve z WORK. Obstoječe zahteve v1
in produkcijske mape ostanejo uporabne. Objava javnega projekta je samostojna
odobritev in ohrani PR, CI in Netlify postopek.
