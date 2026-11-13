# MyDeepSeekRHP · spletni klepet

Kratek spletni naslov je https://www.mdlxdcc.org/DS/. Odpre spletni klepet na `/deepseek-chat/`. Lokalna aplikacija na `127.0.0.1:8102` ima svoj arhiv in omizje RHP.

Spletna prijava uporablja strežniško nastavljen račun lastnika, namenski strežniški scrypt zapis in namenski podpisni ključ. Prijava poteče po osmih urah. Odjava odstrani sejo iz trenutnega brskalnika. Pri nujnem preklicu vseh sej zamenjaj namenski podpisni ključ in objavi novo različico.

Na projektu Netlify mdlxdcc so nastavitve DEEPSEEK_CHAT_OWNER_EMAIL, DEEPSEEK_CHAT_PASSWORD_HASH in DEEPSEEK_CHAT_SESSION_SECRET nastavljene v produkcijskem okolju. Strežnik uporablja vrednosti ob preverjanju prijave. Podpisni ključ in zgoščena vrednost gesla sta označena kot skrivnosti. Za pripravo novega gesla uporabi funkcijo passwordHash iz functions/lib/mdlxdcc-guide/access.mjs. Spremenjeni strežniški vrednosti začneta veljati po naslednji objavi.

## Nabiralnik

Dogovorjeni tok je spletni klepet → Google Drive → 8zListener → DeepSeek → Google Drive → spletni klepet. V tej izdaji je vmesnik za en odprti poziv in strežniška pogodba preverjena s sintetičnim nabiralnikom. Produkcijski handler vrne `available: false`, vmesnik pa zaklene pošiljanje, dokler ni povezan dejanski nabiralnik.

API si deli obstoječo lastnikovo sejo. `GET /deepseek-chat/api/messages` preveri razpoložljivost. `POST` sprejme samo UUID v4, besedilni poziv in stikalo Reasoning. `GET /deepseek-chat/api/messages/{id}` vrne samo pripadajoči poziv, stanje in končni odgovor. `POST` na isti poti zahteva STOP. `queued`, `acknowledged`, `running` in `complete` pomenijo različne stopnje. `stopping` je zahteva. `stopped` je potrditev izvajalnika. Izid `uncertain` se ne ponovi samodejno.

Spletna pogodba predvideva izolacijo po prijavljenem lastniku, enoličnost istega UUID, trajen odgovor na ponovni odčitek in identifikator v vsakem izidu. Prejšnje besedilo ni kontekst novega modelnega klica. Brskalnik hrani zadnji ID v zavihku, da ga lahko po osvežitvi ponovno odčita. Sintetični adapter je samo v testih.

Za celotni prevzem so odprti dejanski namenski Drive inbox in results, preveritev obstoječega 8zListenerja na WORK ter ena sveža sintetična povratna naloga z ločenim ACK in rezultatom. Ročni izvoz arhiva v lokalni izdaji 8102 je druga funkcija.
