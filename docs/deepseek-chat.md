# my DeepSeek Chat · spletna prijava

Ciljna stran je https://www.mdlxdcc.org/deepseek-chat/. Prijava lastnika pokaže stanje oddaljene povezave. Službeni model je dosegljiv prek obstoječega lokalnega Chata.

Spletna prijava uporablja strežniško nastavljen račun lastnika, namenski strežniški scrypt zapis in namenski podpisni ključ. Prijava poteče po osmih urah. Odjava odstrani sejo iz trenutnega brskalnika. Pri nujnem preklicu vseh sej zamenjaj namenski podpisni ključ in objavi novo različico.

Na projektu Netlify mdlxdcc so nastavitve DEEPSEEK_CHAT_OWNER_EMAIL, DEEPSEEK_CHAT_PASSWORD_HASH in DEEPSEEK_CHAT_SESSION_SECRET omejene na strežniško funkcijo v produkciji. Za pripravo novega gesla uporabi funkcijo passwordHash iz functions/lib/mdlxdcc-guide/access.mjs. Spremenjeni strežniški vrednosti začneta veljati po naslednji objavi.

Ta izdaja pokriva spletno prijavo. Oddaljeni pogovor potrebuje podatkovno pot, namenjeno oddaljeni uporabi službenega modela, in ločen prevzem te povezave.
