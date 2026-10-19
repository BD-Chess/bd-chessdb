# Fizikalna referenca R2

BD × AI Lab · 2026-10-19. Izpeljave in idealizirani modeli, brez strojne meritve DGTE.

## Vzgon

F_up=(rho V_external−m_total)g. Pri prostem vzponu zahtevaj m<rho_hot V_hot, pri spustu m>rho_cold V_cold po celotni poti. Pri sklopljenem paru preverjaj celoten mehanizem in blažilnik.

Pri isti gostoti in stalnih volumnah na obeh poteh višine H:
W_up=(rho V_hot−m)gH; W_down=(m−rho V_cold)gH; vsota rho gH DeltaV.
Pri V(z) integriraj silo po poti. Teža stalne mase se na zaprti višinski poti izniči. Različna stolpca zahtevata še bilanco tlakov, prehodov, mešanja in obnove tekočin.

Valj d=0,04 m, l=0,12 m ima 0,000150796447 m³. Privzetih 12,5 % zunanje ekspanzije da DeltaV=0,000018849556 m³. N=40 vseh kapsul, rho=850, g=9,81, v=0,4 daje 1,2574 W mehansko pri času 2H/v brez čakanja. Ne posploši na druge fazne ali tlačne obhode.

## Tlačni proračun

W=∮p dV. Pravokotnik Delta_p DeltaV ni izmerjena oblika zanke. 100 g ×11 % /900 kg/m³=12,222 mL; pri 50 bar je 61,111 J. Privzetih 30 % daje 18,333 J, lastna raba 0,005 W ×900 s=4,5 J, preostanek 13,833 J ali 15,370 mW. Pri 50 mW je bilanca negativna.

Rubitherm RT64HC: 11 % ekspanzije in 250 kJ/kg v 57–72 °C sta nazivna podatka; drugi vsebuje latentni in senzibilni del. To ni podatek o zunanjem hodu končne kapsule pri 50 bar. Toplota ovoja je dodatna.

Isti DeltaV=10 mL pri 3 m in rho=850 pomeni 0,2502 J vzgonskega proračuna, pri novem obhodu s 50 bar pa 50 J pravokotnika. Razmerje ≈200 ni dokaz izvedbe. Oba izraza nista seštevna izhoda iste hidrostatične poti.

## Skupni nadomestni fazni EOS

Molske enote: R=8,314462618 J/(mol K), p_ref=101325 Pa, T_ref=309,21801777809947 K, L_ref=25790 J/mol, c_pg=130, c_pl=167,19 J/(mol K), v_l=0,0721488/620 m³/mol.

```
h_l=c_pl(T−T_ref)+v_l(p−p_ref)
s_l=c_pl ln(T/T_ref)
h_g=L_ref+c_pg(T−T_ref)
s_g=L_ref/T_ref+c_pg ln(T/T_ref)−R ln(p/p_ref)
```

Saturacijo določi z enakostjo Gibbsovih energij h_g−T s_g=h_l−T s_l. Idealna para, nestisljiva tekočina in konstantni Cp so približki; model ni validiran EOS pentana ali izbor fluida.

**VS:** tekočina na vrhu pri Tc →izentropni spust/kompresija →izobarno segrevanje/izparevanje na dnu do Th →izentropni dvig pare →izobarno hlajenje/kondenzacija na vrhu. p_b=p_ref+rho gH; n=p_b V_bottom_hot/(R Th); T4=Th(p_ref/p_b)^(R/c_pg).

Qh=n(h_g(Th,p_b)−h_l(Tc,p_b)); Qc=n(h_g(T4,p_ref)−h_l(Tc,p_ref)); W=n[c_pg(Th−T4)−v_l(p_b−p_ref)].

Pri H=4 m, rho=1000, V=1 L, Th=333,15 K, Tc=298,15 K: W=45,302077872 J, Qh=1560,294919616 J, Qc=1514,992841743 J, Sgen=Qc/Tc−Qh/Th≈0,39785 J/K. Vrh doseže okoli 1,359 L. Čas in neto elektrika nista izračunana. Kondenzacija med potjo in konvekcija lahko spremenita model.

**VP:** isti EOS, saturacijska p_h pri Th in p_c pri Tc. Tekočina →izentropna kompresija →izobarno segrevanje do 1 L vroče pare →izohorno hlajenje →izobarna kondenzacija. Oba toplotna odvoda sta obvezna.

v3=R Th/p_h; n=0,001/v3; v_gc=R Tc/p_c; x4=(v3−v_l)/(v_gc−v_l); W=n(p_h−p_c)(v3−v_l).
Izračunaj Q34 iz notranje energije pri stalnem volumnu ter Q41=−n x4(h_gc−h_lc). W=135,992106476 J, Qh=2293,740854431 J, Qc=2157,748747954 J, Sgen≈0,352115 J/K. Absolutna tlaka ≈2,066919/0,695086 bar.

Oba modela preveri z Qh−Qc=W in nenegativnim Sgen; ne seštevaj izhodov alternativnih obhodov. 10 g dodatne kovine s cp=500 in ΔT=35 K potrebuje 175 J toplote; 100 g pa 1750 J.

## Sklopljen idealni plin

Ericsson brez regeneracije: hladna izotermna kompresija, izobarno segrevanje, vroča izotermna ekspanzija, izobarno hlajenje. nR=p_b V_hot_bottom/Th, Cp=3,5R.
W=nR(Th−Tc)ln(p_b/p_t); Qh=nR Th ln(p_b/p_t)+n Cp(Th−Tc).

Za 20 m vode, 90/25 °C, 1 L vročega plina na dnu, p_t=101325 Pa: W≈57,36 J, Qh≈506,87 J. Prosta kapsula ne prestane vseh silnih pogojev. Pravi nasprotni par:

F(z)=rho g nR[Th/(p_t+rho g(H−z))−Tc/(p_t+rho gz)].

Kumulativno delo=nR[Th ln(p_b/(p_b−rho gz))−Tc ln((p_t+rho gz)/p_t)]. Negativni minimum pomeni približno 49 J minimalnega idealnega blažilnika. Reset, trenje in odvzem ga povečajo. Fazni zamik več parov ni strojna potrditev.

## Izmenjevalnik in ekonomika

Protitok: ε=(1−exp(−NTU(1−Cr)))/(1−Cr exp(−NTU(1−Cr))). Pri Cr=1 je limita NTU/(1+NTU): za ε=0,9 potrebuješ NTU=9. Visoka učinkovitost stene ne zagotavlja vračanja latentne toplote.

E_electric=∫V(t)I(t)dt. Primerjaj enaka začetna/končna stanja in odštej vso obvezno lastno rabo. Morebitno izločeno laboratorijsko opremo posebej opiši.

1 kW neto pri faktorju 0,85 in 0,20 €/kWh pomeni 1489,2 €/leto pred stroški. 40–80 tisoč € zato pomeni 26,9–53,7 let, ne zgodovinskih 12–18. To so pogojne predpostavke, ne DGTE meritve.

Ponovi s `python scripts/calculate.py`; mesečni scenarij: `--power-w 1 --hours-day 8 --days 30 --price 0.2`.
