# ChessBest: enake CDB ocene, ChessDCC 0.8 razlikuje med potezami

**Stanje:** raziskovalni kandidati, brez sklepa o boljši igralni moči DCC. 26. 9. 2026.  
**Izvor:** [natančen JSON](chessbest-tie-current-dcc08-receipt-20260926.json) in trije pripadajoči surovi [SF Lite izpisi](chessbest-tie-ljubojevic-kasparov-1983-sf-lite-20260926.json), [Nakamura](chessbest-tie-nakamura-carlsen-2020-sf-lite-20260926.json), [Caissa](chessbest-tie-caissa-stockfish16-2023-sf-lite-20260926.json).

## Metoda in dejanski obseg

`tools/chessbest_power/tie_scan.py` v arhivu ChessDCC z dne 4. 9. prebere originalne PGN in isto korensko poizvedbo CDB `qa:`. Sprejme samo zakonite ocenjene poteze pod mejo kod za mat, razpon največ 10 centikmetov in najmanj dva shranjena naslednja PV. Ohranjen je **izvirni vrstni red ponudnika**, tudi kadar sta oceni enaki. Z lokalnim, dejanskim `public/chess/new/js/8zc-dcc-core.js` (ChessDCC **0.8.0-new**, balanced, 5 plies, 10 cp guard) vzorči poteze s `pv:` in `sc:` in dosledno pretvarja rezultat v perspektivo igralca na korenski poziciji. `sc:0` je veljavna numerična ocena, ne manjkajoča vrednost. Pregleda le popolnoma pokrite primerljive kandidate. Če se shranjena `pv:` in `sc:` ocena **istega otrokovega FEN** razlikujeta za več kot 20 cp, izloči primer iz ožjega izbora.

Obseg tega omejenega zagona: 303 prebrane partije; 20 z neveljavnimi glavami in 3 z napakami PGN izločene; 742 korenskih izenačitev z dvema PV, 112 drugih vezi brez dveh PV; 657 pozicij po zgornji meji na partijo, vzorčenih **600**; **3 popolne drugačne izbire DCC** po izvirnem vrstnem redu CDB, brez večjega zaznanega konflikta `pv:`/`sc:` pri prvi kandidatni poziciji. Preostalih 57 predizbranih pozicij ni bilo analiziranih. Številke ne merijo uspešnosti DCC na vseh partijah.

| Partija in pozicija | Zgodovinski CDB, prvi izbor → drugi | Trenutni DCC 0.8 (ocena izbire, ne centikmetje) | Neodvisni SF Lite d21, vidik belega | Branje |
|---|---|---|---|---|
| Ljubojević–Kasparov, Nikšić 1983, pred 13. potezo | 13.cxd4 −19 → **13.e5 −21** | e5 −15.308; cxd4 −20.052 | e5 −24, cxd4 −25 | DCC izbere drugače; pri d21 je razlika 1 cp, globina spreminja velikost razlike. |
| Nakamura–Carlsen, 2020, pred 12. potezo | 12.Qd3 +1 → **12.Qc3 +1** | Qc3 9.000; Qd3 7.955 | Qc3 +27, Qd3 +28 | DCC izbere drugače; pri d21 je **1 cp slabše**, pri d15/d18 je vrstni red obrnjen. |
| Caissa 1.9–Stockfish 16, 2023, pred 13. potezo | 13.Be2 0 → **13.Qb1 0** | Qb1 8.000; Be2 7.786 | Qb1 −66, Be2 −37 | **Negativni primer za DCC:** d21 daje njegovi izbiri 29 cp manj. Pri d15 je vrstni red spet obrnjen. |

Vse tri korenske vrednosti CDB prihajajo iz **arhiva**, to niso sveže ocene storitve. SF 18 Lite: ena nit, Hash 16 MB, MultiPV 8, **ločena** analiza depth 15/18/21. DCC za vsak primer izbere potezo po **popolnih petih vzorčenih polpotezah**, vendar si širši izbor neocenjenih legalnih potez in drugačen rezultat pri večji globini pridržujeta prvenstvo analize. Npr. v primeru Caissa sta v arhivski korenski poizvedbi ocenjeni le 2 od 25 zakonitih potez; SF izpiše še druge možnosti.

**FEN za ročno ponovitev:**

- Ljubojević: `2bqk2r/r3npb1/1pn1p1pp/p1p5/P2pP2P/1NPP1NP1/1P3PB1/R1BQR1K1 w k - 0 13`
- Nakamura: `1rbqk2r/2p2ppp/p1np1n2/1p6/P2QPP2/1B6/1PP3PP/RNB2RK1 w k - 1 12`
- Caissa: `rnb1kb1r/1p1p1ppp/8/1p2P3/2p2P2/P7/2P2PPP/Q3KBNR w Kkq - 0 13`

Arhivski SHA-256: `26a485ec597e108e8cd6c5a9a4e7fc25b9626faf20095e016eb166497653f001`; DCC core SHA-256: `21e8e9f1f4a51a5d57f9f1b6e17db1a6016ee649fedfc58101ce9e69e7a42520`; SF Lite JS SHA-256: `2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe`. V JSON so tudi SHA PGN, posamični FEN/vzorci in hashi skript/izpisov.

Zgodovinskih povzetkov `2.115 ties` oziroma razmerja `736:188` tukaj **ne potrjujemo**. Stari `Games/8zc-headless-v2.js` je pri tistem eksperimentu dodal oceno iz nasprotnikove perspektive `pvResult.score` k korenski oceni `mv.score` iz perspektive igralca, sklepni `EndEval` pa je nastal iz iste vzorčene poti; zato starega izida ne uporabimo kot neodvisno mero.

## Ponovitev

```bash
python -m unittest discover -s tools/chessbest_power -p test_tie_scan.py -v
python tools/chessbest_power/tie_scan.py \
  --pack /path/to/ChessDCC_HOME_EVIDENCE_SOURCE_PACK_20260904.zip \
  --repo . --out /path/to/run/tie_scan_depth5.json \
  --max-positions 600 --min-ply 18 --per-game 20 --dcc-depth 5
```

Arhiv mora biti na lokalnem disku; koda ne pošilja poizvedb v CDB in ne spreminja spletne knjižnice. DCC rank je **hevristično preferenčno število**. Za trditev o izboljšanju izbire bi potrebovali prospektivni test z boljšim neodvisnim referenčnim virom in analizo vseh primernih pozicij, vključno z neuspehi.
