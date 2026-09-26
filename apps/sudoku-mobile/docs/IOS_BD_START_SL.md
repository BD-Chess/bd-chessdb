# 8zSudoku na iPhonu brez Maca — BD začetek

25. september 2026 · nadaljevanje PR #26, brez združitve v main.

**Najprej naredi samo to:** na iPhonu odpri Applovo aplikacijo **Apple Developer → Account → prijava z Apple računom → Enroll Now**. Dokončaj preverjanje identitete in članstvo. Potrebuješ vklopljeno dvostopenjsko preverjanje. Obstoječega aktivnega članstva ne kupuj ponovno. Apple navaja 99 USD/leto oziroma lokalno ceno, ki jo pokaže ob vpisu; naročnina v aplikaciji se samodejno podaljšuje.

Pri **Individual** bo prodajalec v App Storu tvoje pravno ime. Pri **Organization** moraš vpisati ustrezno pravno osebo in opraviti njeno preverjanje. Ime igre ostane **8zSudoku**.

Ko Apple potrdi članstvo, se prijavi v **Apple Developer Account** in **App Store Connect**. Sam login še ni vse: za avtomatsko gradnjo potrebujemo še podpisno potrdilo/profil ter API ključ za nalaganje. Pripravljeni Windows pomočnik odstrani potrebo po Macu tudi pri izdelavi podpisnih datotek.

Celotna navodila s kliki in PowerShell ukazi so v [IOS_CLOUD_TESTFLIGHT.md](IOS_CLOUD_TESTFLIGHT.md). Najkrajši nadaljnji tok:

1. V Applovem portalu registriraš 8zSudoku in ustvariš API ključ. `.p8` preneseš le enkrat ter ga shraniš zasebno.
2. Windows pomočnik izdela CSR; Apple izda potrdilo. Pomočnik ga poveže s tvojim zasebnim ključem v šifriran `.p12`. Preneseš še App Store Connect profil.
3. V GitHubu pripraviš okolje `8zsudoku-testflight` z odobritvijo **BD-Chess**. Pomočnik vanj varno shrani ključe in pusti nalaganje izključeno.
4. Odobriš točno različico, sprožiš namensko TestFlight oznako in potrdiš **Review deployments → Approve and deploy**. GitHubov Mac izvede gradnjo/podpis/nalaganje; tvojega Maca ne potrebujemo.
5. Po Applovi obdelavi dodaš sebe in build v interno TestFlight skupino ter namestiš **8zSudoku** prek aplikacije **TestFlight**.

**Gesla za Apple, kod 2FA, `.p8`, `.p12` ali zasebnega `.pem` ne pošiljaj v klepet.** Apple prijavo potrjuješ pri Applu, GitHub prijavo pri GitHubu; podpisne skrivnosti sodijo v zaščiteno GitHub okolje. Priprava še ne pomeni objave v App Storu in ne zagotavlja odobritve trgovine.

Status gradnje in omejitve preverjanja so v ločenem datiranem poročilu ter rezultatu GitHub Actions. Koda pripravljena ≠ iOS build uspešen ≠ TestFlight dostavljen ≠ iPhone preizkušen.

Apple: https://developer.apple.com/help/account/membership/enrolling-in-the-app
GitHub PR: https://github.com/BD-Chess/bd-chessdb/pull/26
