# 8zSudoku — naslednja posodobitev na iPhonu

27. september 2026 · nadaljevanje draft PR #26.

Prva namestitev TestFlight že obstaja: zgodovinsko potrjena različica **1.0 (1.2.1)**, podpisani run **36254855860**, stari SHA **4a6d0bc19dd2ac2de06c89aecaf3748f5d8630c2**. Vpisa v Apple, registracije aplikacije in izdelave ključev ne ponavljaj.

1. Po checkpointu faze A preklopi na **GPT-6 Luna / Max** in napiši **CONTINUE_TESTS**. Takrat se preveri celoten zamrznjeni APP in zažene obstoječa nepodpisana macOS gradnja.
2. Po uspešnih zahtevanih preverjanjih dobiš **nov polni SHA**, rezultate in načrt build številke. Odobritev velja samo za ta kandidat. Stari »GO TestFlight« ne velja.
3. Šele po novi odobritvi se preveri trenutna veja, nastavi IOS_APPROVED_SHA, enkratno vključi upload in ustvari nova unikatna oznaka. Obstoječe okolje 8zsudoku-testflight še vedno zahteva **Review deployments → Approve and deploy**. Točna navodila bodo vezana na preverjeni SHA.
4. Po nalaganju se ločeno preveri Applova obdelava in vključitev builda v obstoječo interno skupino **BD**. Nato v TestFlight na iPhonu 16 Pro izberi **Update** za 8zSudoku. Aplikacije ne odstranjuj.
5. Preveri nadaljevanje stare igre, kratek dotik, hold prazne/polne celice, slide, Notes/Undo, Hint/Why, Stop/Return, vrnitev iz ozadja, izvoz/uvoz in hladni zagon v letalskem načinu. Brisanje preverjamo na testnih podatkih.

Trenutni checkpoint še ni novi podpisani build. Marketing ostaja 1.0; CFBundleVersion izračuna obstoječi ios_ci.py iz dejanskega run/attempt. PR ostane draft in se ne združuje v main. Gesel, 2FA ali podpisnih datotek ne pošiljaj v klepet.
