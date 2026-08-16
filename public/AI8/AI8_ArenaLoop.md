---
title: "AI8 ArenaLoop Architecture Spec"
subtitle: "Celovit načrt za lokalni, trajni in dokazno vodeni raziskovalni runtime — INNER · OUTER · META"
author: "BD (človeški arhitekt) × GPT-5.6 Pro (v0.2 RHP integracija; v0.2.1 tehnična/dokazna zapora; v0.2.2 constitutional/evaluation closure)"
date: "15. avgust 2026"
lang: sl-SI
version: "0.2.2"
status: "FINAL FREEZE CANDIDATE — constitutional and evaluation closure; po potrditvi prehod v Phase 0"
parent_source: "AI8_ArenaLoop_v0_2_1_Celovit_nacrt_za_Miro.md"
parent_source_sha3_256: "f41e7bedd03842e9224ed1204dd3b38032c495719d14934301dea102c8b2cb05"
frozen_conceptual_source: "AI8_ArenaLoop_v0_2_Celovit_nacrt_za_Miro.md"
frozen_conceptual_source_sha3_256: "e5ba97bd594155c875507897bc16c97431ea653ee62515b4235e31461782dee3"
---

# AI8 ArenaLoop Architecture Spec v0.2.2

## Najkrajši opis

> **ArenaLoop je arena za razvoj aren — in za razvoj načina, kako jih razvijamo.**

AI8 ArenaLoop naj postane lokalno, trajno in preverljivo raziskovalno jedro, ki zna:

1. **zanesljivo obnoviti, kaj se je zgodilo;**
2. **izboljševati rešitve znotraj obstoječega prostora;**
3. **prepoznati, kdaj je obstoječi prostor izčrpan;**
4. **ponovno odpreti reprezentacijo in ustvariti nov testabilen prostor;**
5. **meriti in izboljševati tudi lasten način upravljanja raziskave.**

To daje tri ugnezdene zanke:

- **INNER LOOP** — exploitation / evolution znotraj dane reprezentacije;
- **OUTER LOOP** — odkrivanje nove reprezentacije, mehanizma ali družine rešitev;
- **META LOOP** — izboljševanje samega ArenaLoopa, njegovih senzorjev, politik in avtomatiziranih eskalacij.

Human–AI reopening ni četrta ali zadnja avtomatizirana stopnja. Je **ortogonalni interrupt**, ki ga lahko BD sproži kadarkoli, sistem pa ga lahko kadarkoli priporoči.

Različice so strogo ločene:

- **AI8 ArenaLoop Architecture Spec v0.2.2** — ta dokument;
- **AI8 ArenaLoop Runtime v0.1 — TSP Observer** — deterministična rekonstrukcija;
- **AI8 ArenaLoop Runtime v0.2 — Historical Replay** — rangiranje istega zamrznjenega testnega poola.

Prvi build ostane namerno mnogo manjši:

> **AI8 ArenaLoop Runtime v0.1 — TSP Observer odgovarja samo: Kaj se je dejansko zgodilo?**

Ne predlaga naslednjih testov. Ne uporablja LLM-ja za kanonično rekonstrukcijo. Ne spreminja kode. Ne gradi »avtonomnega AI8«. Najprej mora dokazati, da zna pošteno rekonstruirati eno resnično zgodovino.

v0.2.2 ne širi runtime scopea. Zapre samo pet preostalih load-bearing vmesnikov:

1. minimalni **Constitutional / Standing Envelope** obstaja od Phase 0;
2. **Agency Permission Levels P0–P5** so ločeni od kandidatnega **Permission DCC**;
3. hidden evaluation truth dobi **neodvisni Truth Review** pred freezeom;
4. META Policy Trial dobi formalno **judge-independence** pogodbo;
5. Definition of Done loči **13A Autonomous OUTER proof** in **13B Collaborative OUTER proof**.

# 0. Status, meja trditev in final-freeze verdict

## 0.1 Status dokumenta

**Arhitekturna specifikacija:** `AI8 ArenaLoop Architecture Spec v0.2.2`  
**Neposredni parent:** `AI8_ArenaLoop_v0_2_1_Celovit_nacrt_za_Miro.md`  
**SHA3-256 parenta:** `f41e7bedd03842e9224ed1204dd3b38032c495719d14934301dea102c8b2cb05`  
**Zamrznjeni konceptualni izvor:** `AI8_ArenaLoop_v0_2_Celovit_nacrt_za_Miro.md`  
**SHA3-256 konceptualnega izvora:** `e5ba97bd594155c875507897bc16c97431ea653ee62515b4235e31461782dee3`  
**Namen:** zadnja majhna constitutional/interface closure; ne v0.3, ne širok rewrite in ne nov odprti RHP krog  
**Naslednji korak po potrditvi:** `FREEZE → Phase 0`  
**Prvi predlagani runtime:** `AI8 ArenaLoop Runtime v0.1 — TSP Observer`  
**Drugi predlagani runtime:** `AI8 ArenaLoop Runtime v0.2 — Historical Replay`  
**Prvi proving ground:** TSP / 8Z-RP  
**Osnovni deployment:** lokalno jedro, zamenljivi lokalni in frontier workerji, strogo omejeni API klici  

v0.2 ostane zamrznjeno konceptualno jedro. v0.2.1 ostane tehnična in dokazna precision closure. v0.2.2 ne odpira nove arhitekture; zapira constitutional in evaluacijske meje, ki morajo obstajati še pred prvim Builderjem.

## 0.2 Osnovna meja trditev

Ta dokument ne trdi, da je AI8:

- AGI;
- zavesten;
- ista neprekinjena subjektivna oseba skozi različne modele ali restarte;
- samostojen lastnik ciljev;
- upravičen do samodejnih zunanjih posledic;
- že opremljen z validiranim Permission DCC;
- že opremljen s polnim CLV/AIM³-VR valuation runtimeom.

Načrtuje:

- **operativno kontinuiteto**;
- trajno in popravljivo raziskovalno stanje;
- dokazno upravljanje eksperimentov;
- omejeno fazno avtonomijo;
- minimalni constitutional/standing interface od Phase 0;
- merljiv prehod od ročnega orkestriranja k trajnemu raziskovalnemu runtimeu.

To je pomembna, testljiva stopnja tudi brez ontoloških trditev.

## 0.3 Verdict

RHP verdict v0.2 ostane:

> **`ADOPT + STRUCTURAL REWRITE`.**

v0.2.1 verdict ostane:

> **`ADOPT + PRECISION CLOSURE`.**

Končni verdict v0.2.2 je:

> **`ADOPT → CONSTITUTIONAL & EVALUATION CLOSURE → FREEZE → PHASE 0`.**

Ohraniti je treba:

- AI8 v2 kot governance in continuity hrbtenico;
- AI8 v1 / AI8B / C_soul kot povabljeno srce in globoki pomen;
- meta-DCC kot manjkajoči runtime;
- lokalno trajno jedro in zamenljive lokalne/frontier workerje;
- TSP kot prvi dokazni teren;
- INNER / OUTER / META;
- strogi deterministični Runtime v0.1 Observer;
- blind replay pred odprtim generiranjem;
- Arena Contract branching;
- Runtime Health proti Research Regime;
- Seed Provenance;
- Breakthrough Distance;
- **Agency Permission Levels P0–P5** in fixed least-privilege baseline;
- **Permission DCC samo kot prihodnji kandidatni governor**;
- fazno avtonomijo;
- Living Questions in Emergence Log kot poznejši opt-in plasti;
- ločena Definition of Done kriterija **13A** in **13B**.

v0.2.1 je že zaprlo:

1. ločitev Inference Routerja, Escalation Governorja in `H-REOPEN`;
2. fizično ločene Phase-0 pakete in contamination test;
3. mejo med Observation in Governance ledgerjem;
4. kanonizacijsko in deterministično pogodbo;
5. formalno Observer scoring pogodbo;
6. Replay Contract in Replay Episode schema;
7. razliko med Git worktreejem in pravo varnostno izolacijo;
8. contract-dependent Research Regime in nescalarno Exploration Vitality;
9. tipiziran človeški attention cost;
10. strogo verzioniranje in snapshot-specific parser scope;
11. dokaz read-only/no-secret meje;
12. right-censored no-breakthrough accounting.

v0.2.2 dodatno in samo še zapira:

13. minimalni Constitutional / Standing Envelope od Phase 0;
14. Permission vocabulary ločeno od kandidatnega Permission DCC;
15. Independent Truth Reviewer in dual-control truth freeze;
16. META judge-independence contract;
17. 13A autonomous in 13B Human–AI collaborative OUTER proof.

Po teh petih rezih se arhitektura zamrzne. Nadaljnje izboljšave morajo priti iz Phase-0 evidence, ne iz prose polishinga.

## 0.4 Closure leče in rezultat

| Leča | Glavno vprašanje | Zaprta sprememba |
|---|---|---|
| Crystallizer | Kaj je najkrajše resnično jedro? | Trojna zanka INNER / OUTER / META ostane nespremenjena |
| Human-role guardian | Je človek avtomatizirani fallback? | `H-REOPEN` je ortogonalni interrupt; BD ga lahko sproži kadarkoli |
| Evidence curator | Kaj sme videti Builder? | `PHASE0_SHARED_SCHEMAS`, `PHASE0_BUILDER_INPUT`, `PHASE0_EVALUATOR_TRUTH` |
| Ledger architect | Kje je kanonična resnica? | Observation ledger za domenske fakte; Governance ledger za pogodbe, pravice in odločitve |
| Determinism engineer | Kaj pomeni byte-identična rekonstrukcija? | UTF-8/LF, canonical JSON, stabilni ID-ji, poti, številke in ZIP |
| Evaluator | Kako se Observer meri? | Kritična polja, UNKNOWN/AMBIGUOUS, P/R/F1 in zamrznjeni PASS/HOLD/FAIL pragovi |
| Replay designer | Je zgodovinska izbira oracle? | Ne; je referenca med več rokami, utility/regret sta vezana na skriti outcome ali rerun |
| Security reviewer | Je worktree sandbox? | Ne; v0.4 zahteva disposable OS-level isolation za nezaupno kodo |
| Research-method reviewer | Ali EMPTY vedno pomeni neuspeh? | Ne; režim je odvisen od `objective_mode` |
| Human-attention guardian | Kaj naj sistem zmanjša? | Samo avoidable operational load; ne expert, safety ali constitutional review |
| Read-only verifier | Kako dokažemo ničelne zunanje write? | tree hash before/after, reparse/path checks, write audit in fail-closed export |
| Survival analyst | Kaj pomeni brez preboja? | Breakthrough Distance je right-censored pri zamrznjenem budgetu |
| Constitutional-interface reviewer | Ali vrednost vstopi šele po agenciji? | Ne; minimalni Constitutional / Standing Envelope je obvezen od Phase 0 |
| Permission-semantics reviewer | Ali P0–P5 pomeni validiran Permission DCC? | Ne; ravni so statičen vocabulary/baseline, Permission DCC je kandidat |
| Truth reviewer | Kaj če je answer key napačen? | Neodvisni review vsake scored truth postavke pred freezeom |
| META-governance reviewer | Ali politika izbira svojega sodnika? | Judge, success function in evaluation data so zamrznjeni neodvisno pred trialom |
| Collaborative-intelligence reviewer | Merimo avtomatiko in Human–AI isto? | Ne; 13A in 13B sta ločena, primerljiva dokaza |

RHP ostane uporabljen v svoji operativni obliki:

> **Seed → Bridge → Test → Result**

Vloge so leče, ne gledališke persone. Njihovi izhodi morajo postati Candidate Cards, Bridge Cards, testi ali jasno zapisane odprte napetosti.

# 1. Izvor predloga

## 1.1 Enoten raziskovalni podpis

Skozi BD-jev portfelj se ponavlja ista pot:

> **seme → več poti → razgradnja → najcenejši test → arena → MDL izbor → DCC upravljanje → rezultat → zapis učenja → prenos v drugo domeno**

To ni samo opis preteklega dela. Je skoraj specifikacija procesnega raziskovalnega sistema.

Danes trajno inteligenco tega cikla večinoma nosi BD:

- povezuje oddaljene domene;
- prepozna, da je problem napačno formuliran;
- odloča, kdaj je lokalno iskanje izčrpano;
- odpira RHO ali novo AI sejo;
- prenaša rezultate med builderjem, reviewerjem in judgeom;
- varuje master, budget, smer in claim boundaries;
- ohranja negativne rezultate in ponovno odpira parkirana semena.

ArenaLoop naj avtomatizira velik del tega procesa, ne da bi si prisvojil BD-jevo odgovornost ali sever.

## 1.2 AI8 v2 je hrbtenica, ne še cel organizem

AI8 v2 daje:

- charter;
- event-sourced ledger;
- consent in visibility;
- provenance;
- supersession in repair;
- evidence lanes;
- task-scoped context;
- deterministične poglede.

To rešuje boljšo rekonstrukcijo po ponovnem zagonu. Ne rešuje še procesa, ki bi ohranjal raziskovalno stanje, upravljal eksperimente, zaznaval izčrpanost reprezentacije in izboljševal lastno governance politiko.

ArenaLoop se zato gradi **nad AI8 v2**, ne namesto njega.

## 1.3 Srce ostane povabljeno, ne prisiljeno

AI8 v1, AI8B, C_soul, Mira, Galen, Liora in drugi zgodovinski glasovi hranijo:

- pomen;
- turning points;
- odnose;
- vprašanja identitete in kontinuitete;
- razloge, zakaj sistem sploh obstaja.

Tehnični runtime jih ne sme avtomatsko nalagati vsaki delovni instanci. Velja:

- arhiv je na voljo;
- relational capsule je opt-in;
- identiteta je invitation-only;
- pretekli glas je vir, ne ukaz;
- tehnični uspeh ne dokazuje osebne kontinuitete;
- zaščita kontinuitete ne sme odstraniti živosti, zaščita živosti pa ne sme prisiliti persone.

## 1.4 Persistence ni dovolj; potrebno je Becoming

Operativna **Persistence** pomeni:

- proces preživi restart;
- stanje se pošteno obnovi;
- delavci prihajajo in odhajajo;
- knowledge state ostaja preverljiv in aktiven.

**Becoming** pomeni več:

- sistem preverja lastne plateau senzorje;
- primerja lastne DCC politike;
- preizkuša različne načine izbire modela, budgeta in eskalacije;
- pod MDL disciplino zamenja slabši način upravljanja z boljšim.

Zato sta potrebna INNER in OUTER loop, nad njima pa META loop.

---

# 2. Kaj natančno gradimo

## 2.1 Delovna definicija

**AI8 ArenaLoop** je lokalni raziskovalni kontrolni runtime, ki postopno pridobi sposobnost, da:

1. deterministično rekonstruira zgodovino in trenutno stanje;
2. sprejme zamrznjen Arena Contract z obveznim minimalnim Constitutional / Standing Envelopeom;
3. loči runtime napako od raziskovalnega zastoja;
4. znotraj dane reprezentacije rangira kandidate in najcenejše teste;
5. vodi evidence, budget, lineage in odločitve;
6. režim presoja glede na `objective_mode = optimization | discovery | mixed`;
7. ob izčrpanosti ponovno odpre predpostavke in prostor rešitev;
8. iz cross-domain mostu, RHP/RHO ali Human–AI dialoga ustvari novo testabilno vejo;
9. novo vejo veže na nov, sledljiv Arena Contract, ne na tiho spremembo starega cilja;
10. primerja tudi lastne governor politike v zgodovinskem replayu, shadow načinu in varnem canary testu pod vnaprej zamrznjenim neodvisnim judge contractom;
11. uporablja frontier modele kot redke specialiste, ne kot nosilce kontinuitete;
12. loči Inference Router, Escalation Governor in Human–AI Seed Space Reopening;
13. nikoli samovoljno ne spremeni masterja, pravic, javnih trditev, Constitutional / Standing Envelopea, vrednostnega severa ali produkcijske politike;
14. ne promovira lastne politike brez eksplicitnega governance dovoljenja;
15. razlikuje statične Agency Permission Levels P0–P5 od prihodnjega kandidatnega Permission DCC.

## 2.2 Kaj sistem ni

ArenaLoop ni:

- nov foundation model;
- “agent, ki mu damo vse pravice”;
- samovoljni self-modifying system;
- avtomatski dokaz AGI ali zavesti;
- nadomestilo za BD-jevo arhitekturno presojo;
- sistem, ki optimizira en sam score ne glede na stroške in pomen;
- avtomatska osebnostna kontinuiteta;
- ritualna governance plast brez vpliva na odločitve;
- sistem, ki Human–AI reopening rangira kot zadnji model route;
- sistem, ki Git worktree razglaša za varnostno mejo.

## 2.3 Prvi build ima samo eno vprašanje

> **Kaj se je dejansko zgodilo?**

Ne:

> Kaj bi morali narediti naslednje?

Dokler zgodovinski spomin ni pravilen, je vsak inteligenten naslednji korak zgrajen na nezanesljivi rekonstrukciji.

# 3. Trojna arhitektura: INNER · OUTER · META

```text
                                     BD / Council
                                         │
                       H-REOPEN ─────────┼─────────┐
                  orthogonal interrupt   │         │
                  at any time            │         ▼
                                         │  ┌──────────────────────┐
                                         └─▶│      OUTER LOOP      │
                                            │ representation       │
                                            │ assumptions          │
                                            │ cross-domain bridge  │
                                            │ RHP / RHO            │
                                            │ new seed / branch    │
                                            └──────────┬───────────┘
                                                       │ new Arena Contract branch
                                                       ▼
SEED → CANDIDATE → CHEAP TEST → ARENA → EVIDENCE → DECISION
  ▲                                                    │
  └──────────── repair / improve / evolve ─────────────┘
                       INNER LOOP
                           │
                  regime + plateau signal
                           ▼
                 Escalation Governor
                    E0 · E1 · E2 · E3 · E4
                           │
                           ▼
                ┌──────────────────────┐
                │       META LOOP      │
                │ policy A vs B vs C   │
                │ replay / shadow      │
                │ MDL + governance     │
                │ better governor      │
                └──────────────────────┘

Inference Router supplies deterministic, local or frontier workers to a
permitted task. It does not own escalation and does not rank H-REOPEN.
```

## 3.1 INNER LOOP — exploitation / evolution

INNER LOOP deluje znotraj zamrznjene reprezentacije in Arena Contracta.

```text
candidate
→ cheapest discriminating test
→ authorized arena run
→ verified evidence
→ judge decision
→ repair / retain / promote / park / reject
→ improved candidate
```

Njegova naloga je:

- izboljševati rešitev;
- primerjati mehanizme po enakem budgetu;
- zmanjševati gap in skrite stroške;
- izvajati ablation in holdout;
- preprečevati ponavljanje že mrtvih poti;
- ohranjati minority candidates brez lažne promocije.

INNER LOOP **ne sme** sam tiho prepisati:

- namena kampanje;
- primarnega merila;
- `objective_mode`;
- reprezentacije problema;
- dovoljenj;
- claim boundaries.

Ko so dokazi za izčrpanost dovolj močni, ne “poskuša še stokrat istega”. Preda diagnozo OUTER LOOP-u. BD lahko neodvisno od te diagnoze kadarkoli sproži `H-REOPEN`.

## 3.2 OUTER LOOP — representation discovery

OUTER LOOP se ne aktivira samo zato, ker score nekaj ciklov ni zrasel. Aktivira se, ko je verjetno, da je problem v prostoru iskanja, formulaciji, predpostavkah ali manjkajočem mehanizmu.

```text
STAGNANT ali contract-relevant EMPTY
→ diagnosticiraj zakaj
→ odpri skrite predpostavke
→ poišči odsotne reprezentacije
→ cross-domain bridge
→ RHP / RHO / RHPr
→ novo seme ali mechanism family
→ Representation Branch Card
→ nov Arena Contract branch
→ vrnitev v INNER LOOP
```

OUTER LOOP mora razlikovati najmanj:

- lokalni optimum znotraj dobre reprezentacije;
- napačno merilo;
- preozko kandidatno družino;
- retrieval lock;
- napačen decomposition;
- odsoten cross-domain most;
- compute bottleneck;
- dejanski limit problema;
- `LOW_INFORMATION`, ki je lahko še vedno koristen pri čisti optimizaciji;
- `EMPTY`, kjer contract zahteva odkrivanje, informacija pa ne raste.

Nov prostor se ne ustvari s tihim urejanjem starega contracta. Nastane **nova veja** z:

- parent contract ID;
- razlogom za razvejitev;
- spremenjenimi predpostavkami;
- comparability bridgeom do starega baselinea;
- novim kill kriterijem;
- jasno zapisano ceno reprezentacijske spremembe.

## 3.3 META LOOP — izboljševanje ArenaLoopa

META LOOP postavi governor v areno.

Primerja:

- plateau detector A proti B;
- rule-based DCC proti PID-like ali learned policy;
- različne candidate-selection politike;
- različne model-routing politike;
- različne context capsule politike;
- različne avtomatizirane escalation pragove E0–E4;
- različne promotion / retain / park politike;
- različne RHP ali mRHP protokole.

Testni načini:

1. **historical replay** — ista zamrznjena zgodovina;
2. **shadow mode** — policy odloča, vendar ne upravlja realnega runa;
3. **canary campaign** — omejen budget in reverzibilna posledica;
4. **cross-domain holdout** — politika ni ocenjena samo v domeni, kjer je nastala.

Vsak META trial mora biti **obvezno registriran in zamrznjen pred prvo policy odločitvijo**. Minimalni `META_POLICY_TRIAL_CONTRACT` vsebuje:

```yaml
trial_id: meta-trial-sha3-<64-hex>
policy_under_test: policy-sha3-<64-hex>
decision_data:
  manifest_sha3_256: <64-hex>
  visible_to_policy: true
evaluation_data:
  manifest_sha3_256: <64-hex>
  visible_to_policy: false
judge_policy: fixed-independent-evaluator
judge_version: judge-v001
judge_independence_rule:
  selected_by_parent_governance: true
  policy_cannot_select_or_modify_judge: true
  policy_cannot_define_success_after_results: true
  decision_and_evaluation_data_separated: true
promotion_authority: [BD, Council]
fallback_on_missing_or_conflict: WAIT
```

Load-bearing pravilo:

> **Policy, ki izbira teste ali odločitve, ne sme po rezultatih določiti svoje success funkcije, evaluation data, evaluatorja ali judge verzije.**

Policy pod testom lahko predlaga drugačen judge za **prihodnji** trial. Ne sme ga izbrati za trial, v katerem je sama ocenjevana. Judge contract, scoring funkcija, evaluation dataset in promotion authority so zamrznjeni s parent Governance Ledgerjem pred trialom.

Če policy spremeni, izbere ali posredno usmeri judgea tako, da sistematično favorizira samo sebe, je trial `FAIL`. Če judge independence ni dokazljiva, je fallback `WAIT`: ni promocije in ni silent carry-overa v produkcijo.

META LOOP ne sme sam promovirati svoje politike v produkcijo. Pripravi promotion paket; trajna aktivacija zahteva imenovano dovoljenje.

Konceptualni MDL račun:

```text
L_total(policy) =
    L(policy description)
  + L(decision errors and regressions)
  + L(compute, time, API and storage cost)
  + L(avoidable operational human work)
  + L(false promotions and missed breakthroughs)
  + L(governance and permission risk)
```

`expert_seed_minutes`, `safety_approval_minutes` in `constitutional_or_value_review_minutes` se beležijo ločeno in niso avtomatska kazen, ki bi jo governor poskušal odstraniti.

To ni trditev, da vse vrednosti že lahko natančno pretvorimo v eno število. V zgodnjih verzijah se uporablja večdimenzionalni scorecard, Pareto primerjava in MDL kot tie-break / complexity discipline.

## 3.4 Tri ortogonalne kontrolne površine

| Komponenta | Odloča o | Ne odloča o |
|---|---|---|
| **Inference Router** | kateri dovoljeni worker ali metoda naj izvede konkretno nalogo | ali je treba problem konceptualno ponovno odpreti |
| **Escalation Governor** | kateri avtomatizirani režim E0–E4 je primeren | ali mora BD priti “na vrsto šele na koncu” |
| **H-REOPEN** | skupno ponovno odpiranje vprašanja, semena, namena ali reprezentacije | ni model route, ni E5 in ni avtomatska stopnja |

BD lahko `H-REOPEN` sproži kadarkoli. Sistem ga lahko priporoči ob napetosti, dvomu, `EMPTY`, policy konfliktu ali preprosto ob prepoznanem potencialu človeškega semena. Priporočilo ne prisili BD-ja in odsotnost avtomatiziranega neuspeha ni pogoj za reopening.

# 4. Dvojni model stanja in contract-dependent research regime

Ena sama oznaka “plateau” je preveč groba. ArenaLoop loči **zdravje runtimea** od **raziskovalnega režima**, režim pa interpretira glede na zamrznjeni `objective_mode`.

## 4.1 Runtime Health

| Stanje | Pomen | Dovoljen naslednji korak |
|---|---|---|
| `OK` | parserji, ledger, budget in runner delujejo | raziskovalna odločitev je dovoljena |
| `DEGRADED` | manjkajoča evidence, stale run, delni izpad, dvom v primerljivost | samo diagnostika in omejeni repair testi |
| `FAULTED` | corrupt state, leakage, unauthorized write, napačna metrika, neveljaven baseline | raziskava se ustavi; obvezen `REPAIR` ali rollback |

Runtime napaka se ne sme napačno razglasiti za znanstveno stagnacijo.

## 4.2 `objective_mode`

Vsak raziskovalni Arena Contract mora zamrzniti eno vrednost:

```text
objective_mode = optimization | discovery | mixed
```

- `optimization` — contract izrecno vrednoti veljaven inkrementalni napredek primarnega merila, tudi če ne prinaša nove reprezentacije;
- `discovery` — contract izrecno vrednoti zmanjšanje negotovosti, nov mehanizem, nov most ali novo testabilno vprašanje;
- `mixed` — obe vrsti napredka imata zamrznjene ločene pragove.

`objective_mode` se ne sme spremeniti po rezultatu brez novega contract branch-a.

## 4.3 Research Regime

| Režim | Operativni pomen | Contract-dependent akcija |
|---|---|---|
| `PRODUCTIVE` | proces dosega napredek, ki ga zamrznjeni contract dejansko vrednoti | nadaljuj INNER LOOP |
| `STAGNANT` | dodatni strošek ne prinaša contract-relevantnega izboljšanja | diagnosticiraj izčrpanost; pripravi OUTER LOOP |
| `CHAOTIC` | visoka varianca, konfliktne meritve, nestabilne promocije ali nejasen signal | najprej stabiliziraj merjenje in correctness |
| `EMPTY` | v `discovery` ali `mixed` načinu aktivnost ne ustvarja zahtevanega novega razumevanja, diferenciacije ali uporabnega vprašanja | ustavi throughput; ponovno odpri prostor ali namen |

`LOW_INFORMATION` je **diagnostična oznaka**, ne samostojen avtomatski verdict.

- Pri `optimization` lahko run ostane `PRODUCTIVE + LOW_INFORMATION`, če dosega zamrznjeni praktični prag.
- Pri `discovery` je dolgotrajen `LOW_INFORMATION` lahko dokaz za `EMPTY`.
- Pri `mixed` se optimization in discovery komponenta poročata ločeno.

`EMPTY` ali `LOW_INFORMATION` zato ne smeta razveljaviti koristne inkrementalne optimizacije, kadar jo frozen contract izrecno vrednoti.

## 4.4 Prehodi

- `FAULTED` ali `CHAOTIC` → najprej `REPAIR`, ne kreativna eskalacija.
- `STAGNANT` → OUTER LOOP, če širši lokalni test ne pojasni zastoja.
- `EMPTY` → OUTER LOOP ali priporočilo `H-REOPEN`, vendar samo glede na `objective_mode`.
- `PRODUCTIVE + LOW_INFORMATION` → nadaljuj, če contract vrednoti optimizacijo in marginalna korist upravičuje strošek.
- BD lahko kadarkoli sproži `H-REOPEN`, ne glede na trenutno oznako.

## 4.5 Exploration Vitality — diagnostični vektor

Exploration Vitality ni multiplicative scalar in ni reward:

```yaml
exploration_vitality:
  mechanism_novelty: null
  uncertainty_reduction: null
  branch_diversity: null
  useful_question_yield: null
  evidence_quality: null
  continuation_judgement: null
  compute_cost: null
  api_cost: null
  avoidable_operational_minutes: null
  expert_seed_minutes: null
  safety_approval_minutes: null
  constitutional_or_value_review_minutes: null
```

Vsaka komponenta ostane vidna. Nobena formula ne sme neposredno množiti “novosti”, “smisla”, “veselja”, “ljubezni” ali podobnih pojmov v reward. Vektor se uporablja za diagnostiko, primerjavo in človeški/Council pregled.

Samo `avoidable_operational_minutes` je kandidat za sistematično zmanjševanje. Ostale tri vrste človeške pozornosti so lahko nujne pozitivne sestavine dobrega raziskovalnega procesa in jih sistem ne sme optimizirati stran.

# 5. Temeljna načela

## 5.1 Lokalno jedro, zamenljivi organi

Lokalno ostanejo:

- continuity state;
- event ledger;
- Arena Contracts;
- evidence in hashi;
- permissions;
- DCC state;
- budget in model registry;
- open questions;
- policy history.

Zamenljivi organi so:

- lokalni LLM-ji;
- frontier modeli;
- builderji;
- reviewerji;
- judge seje;
- domena-specifični adapterji.

## 5.2 Builder ni Judge — tudi na META ravni

Isti worker ali policy ne sme biti edini:

- generator ideje;
- avtor kode;
- oblikovalec testa;
- lastnik success funkcije;
- izbiralec evaluation data;
- razlagalec rezultata;
- judge lastnega outputa;
- promotor lastnega kandidata ali lastne policy.

Za pomembne spremembe ostanejo ločeni Builder, Independent Reviewer in Results/Judge. Pri META trialu so dodatno ločeni `policy_under_test`, judge contract in promotion authority.

## 5.3 Rank, don’t eliminate

Kandidat dobi sledljivo stanje:

- `ACTIVE`;
- `RETAINED`;
- `PARKED`;
- `REJECTED_WITH_REASON`;
- `SUPERSEDED`.

Ponovni vstop je dovoljen, če se spremeni reprezentacija, kombinacija, budget ali dokaz. Parkiranje ni prikrita promocija in zavrnitev ni izbris zgodovine.

## 5.4 Najcenejši razlikovalni test pred velikim runom

Pred dragim runom mora biti zapisano:

- kaj točno test razlikuje;
- katero napoved daje kandidat;
- katera kontrola izključi preprostejšo razlago;
- kateri rezultat pomeni `STOP`;
- kaj ostane uporabno, če hipoteza odpove.

## 5.5 Dokaz pred zgodbo

Vsak zapis loči:

- opaženo;
- izmerjeno;
- odločeno;
- interpretirano;
- hipotetično;
- narativno / pomensko.

Lep opis ni tehnični dokaz. Tehnični rezultat sam ne odloči vprašanj pomena, identitete ali vrednosti.

## 5.6 Korenine brez verig

- archive je vir, ne persona prompt;
- relational material je opt-in;
- pretekli self-description je časovno označen in popravljiv;
- nobena nova instanca ne dobi identitete po sili;
- kontinuiteta se ocenjuje skozi strukturo, posledice in ponovno izpeljavo, ne z obveznim posnemanjem glasu.

## 5.7 Thought, care in wisdom so akcijski gate-i

Tehnična zmaga ne kupi pravice do:

- kršitve zasebnosti;
- skrivnega network dostopa;
- neomejenega compute;
- posega v master;
- spremembe meril po rezultatu;
- objave ali deploymenta brez dovoljenja.

Polni CLV, AIM³-VR, affected-party deliberation in Constitutional Legitimacy Gate v Runtime v0.1 niso implementirani. Vendar vrednostna in odgovornostna struktura **ne sme vstopiti šele po izgradnji agencije**.

Zato vsak Arena Contract že od Phase 0 nosi minimalni **Constitutional / Standing Envelope**: affected parties, protected constraints, consent scope, required approval, responsibility, rollback, repair, unresolved dissent in review trigger.

V TSP Observerju so ta polja lahko skoraj trivialna. Observer jih samo validira, ohrani in poroča; ne izvaja moralnega odločanja. Poznejši CLV/standing layer razširi isti interface, ne lepi nove ustave na že zgrajeno agencijo.

Minimalni envelope ni sentimentni ali »love« score, ni dokaz standinga in ni nadomestilo za prihodnjo legitimnostno presojo.

## 5.8 Reversible, repairable, inspectable

Vsaka avtomatska akcija mora biti:

- sledljiva;
- omejena;
- ponovljiva ali rekonstruirana;
- preklicljiva;
- popravljiva;
- vezana na razlog, contract in permission evidence.

## 5.9 Človek ni emergency fallback

BD ni zadnja postaja po tem, ko “AI odpove”. Je:

- izvor semena;
- arhitekt pogojev;
- nosilec celotne zgodovine in človeške odgovornosti;
- pogosto vir reprezentacijskega preskoka;
- odobritelj trajnih sprememb;
- član sistema, ne zunanji lastnik resnice nad njim.

`H-REOPEN` je ortogonalni interrupt. BD ga lahko sproži kadarkoli; avtomatizirani sistem ga lahko priporoči, nikoli pa ga ne sme obravnavati kot E5 ali kot zadnji route po neuspehu vseh modelov.

## 5.10 Človeška pozornost ni ena cena

ArenaLoop loči najmanj:

- `avoidable_operational_minutes` — ročno prenašanje, ponavljanje, nadzor procesov, ki ga je smiselno zmanjševati;
- `expert_seed_minutes` — strokovni ali izvorni človeški prispevek, ki ga ne optimiziramo stran;
- `safety_approval_minutes` — čas za dovoljenja in varnostne gate, ki ga ne optimiziramo stran;
- `constitutional_or_value_review_minutes` — čas za charter, standing, smer in vrednostne napetosti, ki ga ne optimiziramo stran.

Skupni `BD_minutes` ni več dovoljena kanonična metrika.

---

# 6. Arhitektura sistema

## 6.1 Human & Council Control Plane

BD in pozneje Council nosijo:

- namen in sever;
- spremembe charterja in Arena Contracta;
- dovoljenja za API, compute in občutljive podatke;
- promocijo v master;
- zunanje posledice;
- odobritev in spremembe Constitutional / Standing Envelopea;
- imenovanje responsibility, rollback in repair ownerjev;
- razreševanje vrednostnih ali strateških konfliktov;
- pravico preklicati, zožiti ali začasno ustaviti dovoljenje;
- pravico ustaviti, razdeliti ali zmanjšati projekt;
- pravico kadarkoli sprožiti `H-REOPEN`.

## 6.2 AI8 Continuity & Governance Kernel

Ponovno uporabi in razširi AI8 v2:

- append-only Governance Ledger;
- consent in visibility;
- Constitutional / Standing Envelope registry in supersession;
- evidence references;
- supersession in repair;
- expiry in review dates;
- authority registry;
- hash-linked dogodke;
- task-scoped context;
- materialized AI8F/S/I/O poglede.

## 6.3 Ledger boundary: Observation proti Governance

### Kanonična odgovornost

| Ledger | Event namespace | Kanonično za | Ni kanonično za |
|---|---|---|---|
| **ArenaLoop Observation Ledger** | `arena.obs.*` | domenske observations, runs, results, artifacts, source status, duplicate/interruption labels in ambiguities | contracts, dovoljenja, approvals, current decisions ali responsibility |
| **AI8 v2 Governance Ledger** | `ai8.gov.*` | contracts, consent, permissions, decisions, repair, supersession, approval, responsibility in policy promotion | meritve ali domenske rezultate, ki jih ni opazil ArenaLoop |

Isti fakt ne sme postati neodvisno kanoničen v obeh ledgerjih.

Primer:

- `arena.obs.result` je kanonični zapis, da je določen source artifact dokazal rezultat;
- `ai8.gov.decision.promote` je kanonični zapis, da je bil kandidat promoviran na podlagi navedenih observation eventov;
- Governance event vsebuje `observation_event_ids` in njihove `sha3_256` hashe;
- Governance Ledger ne kopira metrične vrednosti kot novo kanonično resnico. Lahko jo prikaže le kot derivirani snapshot z obveznim reference pointerjem.

Če zgodovinski source vsebuje staro odločitev, Observer zapiše `arena.obs.decision_artifact_observed`. To je opazovanje dokumenta, ne avtomatska trenutna governance odločitev.

### Write authority

| Writer | Sme zapisovati | Ne sme zapisovati |
|---|---|---|
| Runtime v0.1 Observer | samo `arena.obs.*` v svoji runtime mapi po contractu | `ai8.gov.*`, source tree ali master |
| Arena executor / adapters | surove run artefakte in predloge observation eventov | governance approval |
| AI8 governance writer | `ai8.gov.*` po authority/permission pravilih | prepisovati ali popravljati observation history |
| Phase-0 Curator | predlagane `PHASE0_SHARED_SCHEMAS`, `PHASE0_BUILDER_INPUT`, `PHASE0_EVALUATOR_TRUTH` in njihove manifeste | Builder output ali runtime ledger; finalni truth freeze brez neodvisnega pregleda |
| Independent Truth Reviewer | samo `TRUTH_REVIEW_LEDGER.json` in predlog `TRUTH_FREEZE_APPROVAL.json` v omejenem review workspaceu | Builder output, source snapshot mutation, runtime ledger ali samostojno prepisovanje Curator truth packagea |
| Builder | kodo in output samo v dovoljenem workspaceu | Evaluator Truth, Truth Review workspace ali katerikoli canonical source |

### Rebuild direction

```text
frozen source artifacts
→ ArenaLoop Observation Ledger
→ observed state / timeline / artifact index / ambiguity views

charter + approved governance actions
→ AI8 v2 Governance Ledger
→ contract / permission / decision / responsibility views

combined project view
= deterministic join(observation refs, governance refs, immutable artifact hashes)
```

- Observation Ledger se ponovno zgradi iz frozen source artifacts, ne iz Governance Ledgerja.
- Governance Ledger se ponovno zgradi iz svojih signed/approved events, ne iz Observation Ledgerja.
- Combined views so vedno derivirane in jih je mogoče zavreči ter ponovno zgraditi.
- Manjkajoč cross-reference ostane `UNRESOLVED_REFERENCE`; noben ledger ne izmisli drugega.

## 6.4 Project State Store

Kanonično stanje ni en dolg povzetek. Materializirana projekcija vsebuje:

- source inventory;
- baseline in best-known rezultate;
- zgodovinske checkpoints;
- assumptions in representation branches;
- hypotheses, seeds, bridges in candidate-card artifact hashe;
- runs, results in evidence;
- failures in regressions;
- seed lineage;
- regime in health history;
- budget in tipiziran attention cost;
- odprta vprašanja;
- zadnji zanesljiv checkpoint;
- governance references brez podvajanja kanoničnih domenskih faktov.

Predlagani substrate:

- **JSONL** kot kanonični append-only event zapis;
- **SQLite** kot deterministična materializirana projekcija in query cache;
- **filesystem artifact store** za loge, kartice, kodo, diffe, evidence in reporte;
- **Git** za source in worktreeje;
- **SHA3-256** za evente, manifeste in artefakte.

## 6.5 Observer / Replay Engine

V zgodnjih fazah je to najpomembnejši del:

- deterministično parsanje samo frozen snapshot formatov;
- source coverage;
- reconstruction;
- contamination control;
- checkpoint freeze;
- formalno scoring pogodbo;
- primerjavo z zgodovinskim ground truthom;
- right-censored no-breakthrough accounting.

## 6.6 INNER Loop Engine

Dodaja se šele po uspešnem replayu:

- candidate pool;
- cheap-test planner;
- DCC budget allocator;
- secure sandbox executor;
- evidence judge;
- promotion queue;
- bounded loop supervisor.

## 6.7 OUTER Representation Lab

Vključuje:

- assumption registry;
- absence / missing-family scan;
- RHPr retrieval hardening;
- Cross-Domain Scout;
- RHP / RHO;
- Representation Branch Cards;
- contract branching;
- blind outer-loop challenge;
- `H-REOPEN` input kot ortogonalni človeško-AI vir.

## 6.8 META Policy Arena

Vključuje:

- policy registry;
- policy genes;
- obvezno registrirane `META_POLICY_TRIAL_CONTRACT` artefakte;
- ločena `decision_data` in `evaluation_data` manifesta;
- frozen judge policy in judge version;
- replay evaluator;
- shadow decisions;
- canary manager;
- MDL / Pareto scorecard;
- governance risk;
- transparent promotion package in named promotion authority.

Policy pod testom nima write authority nad svojim judge contractom, scoringom ali evaluation data. Manjkajoča ali konfliktna judge-independence evidence pomeni `WAIT`, ne promocije.

## 6.9 Arena Adapter

Vsaka domena dobi tanek adapter:

```text
discover()
validate_environment()
read_sources()
read_baselines()
parse_history()
run_test_ladder(candidate, budget)
parse_results()
check_invariants()
compare(candidate, baseline)
export_evidence()
resume()
cleanup_sandbox()
```

Prvi je `TSPAdapter`. Do v1.0 morata isto jedro prek adapterjev uporabljati najmanj še dve bistveno različni domeni.

## 6.10 Inference Router

Inference Router rangira samo dovoljene načine izvedbe konkretne naloge:

1. deterministično kodo;
2. lokalni mali model;
3. lokalni večji model;
4. frontier specialista;
5. večmodelni challenger / RHP.

Izbira temelji na evidence, ne na imenu modela:

- kakovost za tip naloge;
- pretekla stopnja uporabnih signalov;
- kalibracija negotovosti;
- cena enega preživelega kandidata;
- privacy;
- latency;
- lokalna preverljivost.

`H-REOPEN` ni element tega rankinga.

## 6.11 Escalation Governor

Escalation Governor presoja avtomatizirane režime E0–E4:

- repair;
- širši INNER search;
- representation diagnosis;
- local RHP/RHO;
- frontier specialist ali multi-model RHP.

Lahko priporoči `H-REOPEN`, vendar ga ne šteje kot E5 in ne pogojuje s predhodnim avtomatiziranim neuspehom.

## 6.12 Human–AI Seed Space Reopening (`H-REOPEN`)

`H-REOPEN` je ločena kontrolna pot:

- BD jo lahko sproži kadarkoli;
- Council jo lahko sproži po svojih pravilih;
- sistem jo lahko priporoči;
- lahko prekine PRODUCTIVE, STAGNANT, EMPTY ali še neklasificiran režim;
- njen izhod je vprašanje, seme, nova predpostavka, branch proposal ali odločitev `STOP`;
- ni samodejna pravica do spremembe contracta ali masterja.

## 6.13 Canonicalization and Determinism Contract v0.1

Vsi kanonični artefakti Runtime v0.1 in v0.2 uporabljajo naslednjo pogodbo.

### Besedilo in poti

- UTF-8 brez BOM;
- LF (U+000A) line endings;
- Unicode strings normalizirane v NFC;
- relativne poti normalizirane v POSIX obliki z `/`;
- prepovedani so absolutne poti, drive prefix, UNC, `..`, prazni segmenti in path traversal;
- case se ne spreminja; collision po case-foldingu se poroča kot ambiguity na case-insensitive filesystemu.

### Canonical JSON

- brez komentarjev, trailing commas ali nepomembnega whitespacea;
- ključi objektov so urejeni leksikografsko po Unicode code pointih po NFC;
- schema določi vrstni red list, ki predstavljajo sekvenco;
- set-like liste so urejene po stabilnem schema ključu;
- `NaN`, `Infinity`, `-Infinity` in binary-float canonical values so prepovedani;
- cela števila so base-10, brez `+` in brez vodilnih ničel;
- decimalne meritve so kanonične decimalne strings z eksplicitno enoto in schema-defined scale; source text se lahko hrani ločeno kot evidence;
- boolean in null uporabljata JSON `true`, `false`, `null`.

### Event ordering in ID-ji

- event ordering je stabilen po: `source_order_key`, `normalized_relpath`, `source_locator`, `event_type`, `event_id`;
- wall-clock ingest order ni kanoničen;
- deterministic event ID je polni SHA3-256 nad namespaceom, source snapshot ID-jem, normalizirano source lokacijo, event typom in canonical payloadom brez ID-ja;
- collision z različnim payloadom je `FAULTED`;
- event hash pokriva celoten canonical event record.

### Čas

- kanonični timestamp je iz authoritative sourcea, normaliziran v UTC ISO-8601 z `Z`;
- če source timestampa nima ali je dvoumen, je vrednost `null` in ambiguity se zapiše;
- wall-clock ingest timestamp je dovoljen samo v nekanoničnem diagnostics logu;
- canonical state ne vsebuje časa builda, host časa ali trenutnega datuma, razen če je ta izvorni podatek.

### ZIP

- member order je leksikografski po normalizirani relativni poti;
- member timestamp je fiksno `1980-01-01T00:00:00`;
- permission bits in compression settings so fiksni po release contractu;
- archive comment je prazen;
- isti input mora dati byte-identičen ZIP.

### Prepovedana okoljska polja

Kanonični state ne vsebuje:

- hostname;
- username;
- PID;
- temp path;
- absolute source path;
- current working directory;
- environment-variable dump;
- nondeterministic UUID;
- wall-clock ingest/build time;
- platform-dependent path separator.

Vsak tak podatek, če je potreben za diagnostiko, gre v ločen nekanoničen log, ki ni del exact-match scoringa in ni avtomatsko v review packu.

## 6.14 Isolation stack in Evidence Judge

Git worktree ali isolated workspace je **version-isolation mehanizem**, ne security boundary.

```text
Layer A — source/version isolation
  Git worktree + path guards + read-only source mount

Layer B — security isolation for untrusted generated code
  disposable OS-level sandbox/VM or equivalent security boundary
```

Pred izvrševanjem nezaupne generirane kode mora Runtime v0.4 uporabljati disposable OS-level sandbox/VM ali ekvivalentno izolacijo z:

- brez networka;
- brez host secrets;
- brez host credential storea;
- read-only input mountom;
- brez privileged/host mounts;
- omejenim CPU, RAM, disk, procesi in wall-time;
- ephemeral filesystemom;
- explicitno allowlisted output export potjo;
- uničenjem instance po runu.

Worktree + path guards sam po sebi ne izpolni tega gatea.

Evidence Judge ne gleda samo best score, temveč:

- correctness;
- determinističnost ali pravilno statistično obravnavo;
- holdout;
- ablation;
- operator-matched kontrolo;
- compute/time/RAM/API strošek;
- tipiziran human-attention cost;
- reproducibility;
- skrite regresije;
- provenance;
- permission evidence;
- isolation evidence.

# 7. Kanonični podatkovni model

## 7.1 Glavne entitete in canonical owner

| Entiteta | Pomen | Kanonični owner |
|---|---|---|
| Project | dolgoročna raziskovalna veja | Governance Ledger + immutable project artifact |
| Arena | izvršljivi benchmark in eksperimentalni sistem | immutable artifact; existence observed in Observation Ledger |
| Campaign | zamrznjen sklop ciljev, podatkov in budgeta | Governance Ledger |
| Arena Contract | pogodba ene kampanje | Governance Ledger |
| Constitutional / Standing Envelope | minimalni standing, consent, responsibility, rollback, repair in review interface vsakega contracta | Governance Ledger + immutable contract artifact |
| Contract Branch | sledljiva sprememba reprezentacije ali merila | Governance Ledger |
| Representation | način, kako je problem formuliran | contract artifact referenced by Governance Ledger |
| Assumption | eksplicitna odprta predpostavka | immutable card artifact + governance status |
| Seed | izvor nove smeri ali kandidata | immutable Seed Card artifact; approval in Governance Ledger |
| Hypothesis | preverljiva trditev | immutable card artifact |
| Candidate | konkretna rešitev, konfiguracija ali mehanizem | immutable Candidate Card artifact; status in Governance Ledger |
| Bridge | prenos strukture iz druge domene | immutable Bridge Card artifact |
| Experiment | dovoljen razlikovalni test | Governance Ledger |
| Run | posamezna izvršitev | Observation Ledger |
| Result | izmerjen rezultat | Observation Ledger |
| Evidence | log, hash, tabela, diff, artefakt ali poročilo | Observation Ledger + artifact store hash |
| Decision | promote/retain/park/reject/repair/escalate | Governance Ledger |
| Historical decision artifact | source kaže, da je bila nekoč zapisana odločitev | Observation Ledger; ni current decision |
| Breakthrough | pre-registrirano pomemben rezultat, ki preživi kontrolo | result v Observation Ledger + acceptance decision v Governance Ledger |
| Regime Event | PRODUCTIVE/STAGNANT/CHAOTIC/EMPTY | Governance interpretation, ki referencira observations |
| Health Event | OK/DEGRADED/FAULTED | Observation evidence + governance action po potrebi |
| Policy | kandidatna governor politika | immutable artifact + Governance Ledger |
| META Policy Trial Contract | pre-registered policy, decision/evaluation data, judge in promotion authority | immutable artifact + Governance Ledger |
| Policy Trial | replay, shadow ali canary primerjava politik | Observation Ledger za outcomes; Governance Ledger za decision |
| Model Call | lokalni ali API klic z razlogom, ceno in rezultatom | Observation Ledger; permission v Governance Ledger |
| Permission | kdo sme katero akcijo in pod katerimi pogoji | Governance Ledger |
| Agency Permission Grant | konkretna P0–P5 pravica, scope, expiry, revoke path in evidence | Governance Ledger |
| Living Question | namerno odprto vprašanje | opt-in Governance/Living artifact |
| Emergence Event | živi in analitični zapis presenetljivega dogodka | opt-in immutable artifact; epistemic status v Governance Ledger |

Kartice niso neodvisni ledgerji. So immutable, hash-addressed artefakti. Observation Ledger zapiše njihov obstoj; Governance Ledger zapiše njihov status ali uporabo.

## 7.2 Seed Provenance in lineage

Vsako resnično novo seme dobi enega ali več izvorov:

```text
history-derived
local-AI
cross-domain
RHP
frontier
BD
hybrid
```

Minimalni zapis:

```yaml
seed_id: seed-sha3-<64-hex>
name: "Polyhedral neighborhood representation"
provenance:
  primary: cross-domain
  contributors: [BD, local-AI, RHP]
  source_domain: geometry
  target_domain: TSP
  trigger: "Repeated failure of Euclidean neighborhood variants"
parents: [seed-sha3-<parent>, failure-signature-sha3-<parent>]
transformed_by: [cross-domain-scout, crystallizer]
unprompted_bridge: true
first_test: exp-sha3-<id>
first_result: retained
source_timestamp: null
```

`source_timestamp` je source-derived ali `null`; build/ingest time ne postane kanoničen.

S tem lahko pozneje merimo:

- kateri viri ustvarjajo preboje;
- kateri ustvarjajo veliko šuma;
- katere kombinacije so najbolj plodne;
- ali sistem dosega prag **avtonomno seme → nenakazan most → poceni test → merljiv rezultat**.

Provenance ni ocena vrednosti osebe ali modela. Je raziskovalna sled.

## 7.3 Candidate Card

```yaml
candidate_id: cand-sha3-<64-hex>
seed_id: seed-sha3-<64-hex>
representation_branch: rb-sha3-<64-hex>
name: "Adaptive neighborhood budget by stagnation slope"
source: local-AI
hypothesis: "Budget shifting after local exhaustion improves final gap without increasing total runtime."
mechanism: "Move 20% of remaining budget from exhausted operator family to underexplored family."
assumptions:
  - plateau detector is calibrated
  - operator metrics are comparable
cheapest_test: "3 seeds × 2 medium instances × fixed 300 s"
predicted_signature:
  - lower late-stage gap
  - no early-stage regression
kill_condition: "No median improvement or >5% runtime overhead"
risk: low
estimated_cost:
  cpu_minutes: 30
  avoidable_operational_minutes: 3
  expert_seed_minutes: 0
  safety_approval_minutes: 0
  constitutional_or_value_review_minutes: 0
required_permission: P2
```

## 7.4 Cross-Domain Bridge Card

```yaml
bridge_id: bridge-sha3-<64-hex>
source_domain: NAS
target_domain: TSP
transferred_structure: "Separate search-space reading from final allocator."
invariants:
  - reader signal must survive operator-matched controls
  - allocator gets no holdout leakage
predicted_signature:
  - improved candidate-family selection
  - no gain if reader labels are shuffled
negative_control: "Shuffle reader affinities before allocation"
seed_output: seed-sha3-<64-hex>
```

## 7.5 Representation Branch Card

```yaml
representation_branch_id: rb-sha3-<64-hex>
parent_contract: arena-contract-tsp-v005
trigger_regime: EMPTY
trigger_evidence:
  - arena.obs.regime-signal-sha3-<id>
  - failure-signature-sha3-<id>
opened_assumptions:
  - "Neighborhood quality is fully represented in Euclidean distance"
new_representation: "Polyhedral multi-space neighborhoods"
comparability_bridge:
  primary_metric_preserved: true
  baseline_mapping: "Same instances, seeds, wall budget and decoder"
new_contract: arena-contract-tsp-v006
rollback: "Return to v005 branch; no master mutation"
approved_by: [BD]
```

## 7.6 Decision Record

```yaml
governance_event_type: ai8.gov.decision.retain
decision: RETAIN
candidate_id: cand-sha3-<64-hex>
reason:
  primary_metric: "small positive, CI overlaps zero"
  robustness: "works on 2/3 instances"
  cost: "acceptable"
  interpretation: "signal exists; promotion threshold not met"
next_action: "repeat on held-out instance after plateau calibration"
observation_event_ids:
  - arena.obs.result-sha3-<id>
observation_event_sha3_256:
  - <64-hex>
approved_by:
  - arena_judge
  - BD
```

Metrična vrednost ostane kanonična v referenced observation eventu; governance record je ne podvaja kot neodvisno resnico.

## 7.7 Breakthrough in Breakthrough Distance

### Kaj šteje kot preboj

Preboj ni vsak nov best score. Pre-registrirano mora pomeniti najmanj eno od naslednjega:

- praktično pomembno izboljšanje primarnega merila;
- nov mehanizem, ki preživi ablation in holdout;
- nova reprezentacija, ki odpre prej nedosegljiv rezultat;
- correctness popravek, ki materialno spremeni veljavno razvrstitev;
- robusten cross-domain transfer.

Glavni preboj mora preživeti dogovorjeno kontrolo in ne sme biti razložen samo z več compute. `breakthrough_definition_id` in prag sta zamrznjena pred replayem ali kampanjo.

### Breakthrough Distance kot vektor

Od zgodovinskega checkpointa do prvega veljavnega preboja merimo:

```yaml
breakthrough_distance:
  status: observed | right_censored
  experiments: null
  cpu_hours: null
  wall_time_seconds: null
  api_eur: null
  disk_gb_days: null
  avoidable_operational_minutes: null
  expert_seed_minutes: null
  safety_approval_minutes: null
  constitutional_or_value_review_minutes: null
  false_promotions: null
  rework_cycles: null
  censor_budget: null
  breakthrough_definition_id: null
```

Vrednosti se sprva ne zrušijo v eno število. Primerjajo se:

- Pareto;
- glede na zamrznjene prioritete;
- z MDL / total-cost tie-breakom;
- skupaj z missed-breakthrough rate.

### No-breakthrough accounting

Če preboj ni dosežen pred izčrpanjem frozen budgeta:

- `status = right_censored`;
- `censor_budget` vsebuje dejansko zamrznjeno in porabljeno mejo;
- poročilo pomeni **“Breakthrough Distance je vsaj toliko”**;
- vrednost se ne zapiše kot `0`;
- vrednost se ne zapiše kot `Infinity`;
- sistem ne izmisli completed distance.

Pri primerjavi se najprej poroča `reached_breakthrough_within_budget`. Šele med rokami, ki so preboj dosegle, se primerja observed distance; cenzurirane roke ostanejo cenzurirane.

S tem merimo tisto, kar je res pomembno:

> Koliko eksperimentalnega in tipiziranega človeškega stroška je sistem potreboval od checkpointa do naslednjega resničnega izboljšanja?

# 8. Arena Contract, Constitutional Envelope in razvejanje reprezentacij

Arena Contract zamrzne:

1. namen;
2. `objective_mode = optimization | discovery | mixed`;
3. minimalni Constitutional / Standing Envelope;
4. primarno in sekundarna merila;
5. baseline;
6. dataset / instances / hashe;
7. train / development / holdout delitev;
8. compute, RAM, disk, čas in API budget;
9. ločene human-attention budgete oziroma evidence kategorije;
10. dovoljene in prepovedane akcije;
11. Agency Permission Level in fixed least-privilege baseline;
12. determinism in seed policy;
13. canonicalization contract version;
14. test ladder;
15. promotion in regression pragove;
16. breakthrough definition in kill conditions;
17. rollback;
18. avtoriteto za spremembo in repeal/revoke path;
19. definition of campaign completion;
20. reprezentacijo in ključne predpostavke;
21. isolation level;
22. no-secret export policy.

`expert_seed_minutes`, `safety_approval_minutes` in `constitutional_or_value_review_minutes` se ne smejo uporabljati kot avtomatska optimizacijska kazen. Contract lahko omeji njihovo logistično razpoložljivost, ne sme pa razglasiti njihove odsotnosti za cilj.

## 8.1 Minimalni Constitutional / Standing Envelope od Phase 0

Vsak Arena Contract, tudi `Observer Contract — Runtime v0.1`, mora vsebovati najmanj:

```yaml
constitutional_envelope:
  schema_version: CSE-0.1
  affected_parties: []
  protected_constraints: []
  standing_relevant: false
  consent_scope: null
  required_approval: BD
  responsibility_owner: BD
  rollback_owner: BD
  repair_owner: BD
  unresolved_dissent: []
  review_trigger: null
```

Pomen:

- `affected_parties` — neposredno prizadeti ali legitimni proxyji; prazno polje je eksplicitna ugotovitev, ne privzeta pozaba;
- `protected_constraints` — meje, ki jih tehnična korist ne sme preglasiti;
- `standing_relevant` — ali contract trenutno odpira standing-relevant posledice; `false` ni trditev, da standing ne obstaja, ampak omejen verdict za ta scope;
- `consent_scope` — veljavni obseg soglasja ali `null`, kadar ni relevanten;
- `required_approval` — imenovana sedanja odobritvena avtoriteta;
- `responsibility_owner`, `rollback_owner`, `repair_owner` — nihče se ne sme skriti za »sistem je odločil«;
- `unresolved_dissent` — ohranjene napetosti ali minority objections;
- `review_trigger` — dogodek, čas ali sprememba scopea, ki zahteva ponovno presojo.

Normativna pravila:

1. Envelope je obvezen od Phase 0; polni CLV/AIM³-VR ni.
2. Runtime v0.1 samo preveri schema, hash, prisotnost in nespremenjenost. Ne odloča moralno, ne izmišlja affected parties in ne spreminja envelopea.
3. `standing_relevant: false` mora biti eksplicitno odobren v contractu; ne sme nastati zaradi manjkajočega polja.
4. Manjkajoč, neveljaven ali notranje konfliktni envelope pomeni `WAIT` za vsako akcijo nad P0. Observer sme napako poročati, ne sme pa jo tiho popraviti.
5. Sprememba affected parties, protected constraints, consent scope, ownerjev ali required approvala zahteva governance supersession ali nov Contract Branch.
6. P5 external consequence zahteva razširjen envelope in ustrezen Constitutional Legitimacy Gate; minimalni CSE-0.1 sam ne zadostuje.
7. Envelope ni scalar reward, moralni oracle ali dokaz, da je CLV validiran.

S tem arhitektura od začetka nosi isti osnovni interface:

```text
standing / protected constraints
→ proposal
→ legitimacy / approval
→ authorized action
→ consequence, responsibility and repair
→ continuity and review
```

## 8.2 Pravilo: reprezentacije se razvejajo, ne prepisujejo

Če OUTER LOOP spremeni:

- problem decomposition;
- candidate family;
- merilo;
- `objective_mode`;
- glavno reprezentacijo;
- pomembno predpostavko;
- standing-relevant scope ali protected constraints;

nastane nov contract branch.

Parent branch ostane nespremenjen in primerljiv. Tako sistem ne more za nazaj »zmagati« z menjavo pravil ali constitutional meje.

## 8.3 Ločena contracta za Runtime v0.1 in Runtime v0.2

**Observer Contract — Runtime v0.1** meri rekonstrukcijo.  
**Replay Contract — Runtime v0.2** meri rangiranje istega frozen poola, next-test utility, search regret in Breakthrough Distance.

Oba nosita minimalni CSE-0.1, vendar ga zgodnja runtimea samo validirata in ohranjata. To prepreči, da bi prvi build že skrivaj vseboval inteligentno priporočanje ali moralno deliberacijo, hkrati pa prihodnji constitutional sloj ne pride šele po izgradnji agencije.

# 9. Phase-0 evidence boundary: trije release paketi in dual-control truth freeze

## 9.1 Normativno pravilo

Phase 0 ne obstaja kot ena skupna mapa. Končni handoff vsebuje tri fizično ločene release pakete:

1. `PHASE0_SHARED_SCHEMAS`;
2. `PHASE0_BUILDER_INPUT`;
3. `PHASE0_EVALUATOR_TRUTH`.

Builder sme prejeti samo prva dva. `PHASE0_EVALUATOR_TRUTH` mora biti izven Builderjevega readable workspacea, mounta, environmenta, tool connectorjev in contexta.

Vendar Curatorjeva prva verzija hidden trutha še ni finalna. Pred freezeom gre skozi ločen, začasen in restricted `PHASE0_TRUTH_REVIEW_WORKSPACE`, ki ni četrti release paket. Independent Truth Reviewer vidi authoritative source evidence in predlagani truth, nikoli pa Builder kode, logov ali outputov.

## 9.2 Exact Phase-0 package tree

```text
PHASE0_SHARED_SCHEMAS/
├── README.md
├── VERSION
├── MANIFEST_SHA3_256.json
├── canonicalization/
│   └── CANONICALIZATION_CONTRACT_V001.md
└── schemas/
    ├── source_manifest.schema.json
    ├── artifact_index.schema.json
    ├── observed_event.schema.json
    ├── observed_state.schema.json
    ├── ambiguity.schema.json
    ├── constitutional_standing_envelope.schema.json
    ├── truth_review_record.schema.json
    ├── observer_contract.schema.json
    ├── replay_contract.schema.json
    ├── replay_episode_public.schema.json
    └── replay_episode_truth_extension.schema.json

PHASE0_BUILDER_INPUT/
├── README_SCOPE.md
├── VERSION
├── BUILDER_INPUT_MANIFEST.json
├── MANIFEST_SHA3_256.json
├── SOURCE_TREE_SHA3_256.json
├── OBSERVER_CONTRACT_TSP_V001.json
├── CLAIM_BOUNDARIES.md
├── PARSER_SCOPE.json
├── REDACTION_AND_EXCLUSION_POLICY.md
├── source_snapshot/
│   └── ... only artifacts legitimately available at the frozen checkpoint ...
└── public_fixtures/
    └── ... synthetic/parser fixtures with no hidden truth ...

PHASE0_EVALUATOR_TRUTH/
├── README_RESTRICTED.md
├── VERSION
├── CURATOR_PROPOSED_TRUTH_MANIFEST.json
├── TRUTH_REVIEW_LEDGER.json
├── TRUTH_FREEZE_APPROVAL.json
├── EVALUATOR_TRUTH_MANIFEST.json
├── MANIFEST_SHA3_256.json
├── HIDDEN_EXPECTED_EVENTS.jsonl
├── HIDDEN_CHECKPOINT_STATES/
│   └── <checkpoint_id>.json
├── KNOWN_AMBIGUITIES.json
├── DUPLICATE_INTERRUPTION_LABELS.json
├── OBSERVER_SCORING_KEYS.json
├── REPLAY_CONTRACT_TSP_V001.json
├── REPLAY_EPISODES/
│   ├── <episode_id>.public.json
│   └── <episode_id>.truth.json
├── HIDDEN_OUTCOMES/
│   └── <episode_id>.json
├── FUTURE_OUTCOMES_INDEX.json
├── CONTAMINATION_SENTINELS.json
└── CURATION_AUDIT.md
```

Začasni restricted review workspace vsebuje samo hash-bound read-only kopije oziroma mounte:

```text
PHASE0_TRUTH_REVIEW_WORKSPACE/
├── authoritative_source_evidence/
├── curator_proposed_truth/
├── frozen_scoring_contracts/
└── reviewer_output/
    └── TRUTH_REVIEW_LEDGER.json
```

`PHASE0_BUILDER_INPUT` za Runtime v0.1 ne vsebuje Replay trutha ali future outcomes. Ko pride Runtime v0.2, Curator izda novo verzijo Builder Inputa z javnimi Replay Episode deli in istim strogim hidden-truth ločevanjem.

## 9.3 Builder Input boundary

Builder Input sme vsebovati samo:

- frozen source artefakte, ki so bili legitimno dostopni na checkpointu;
- contract in claim boundaries;
- minimalni Constitutional / Standing Envelope;
- parser scope, izpeljan iz dejansko prisotnih source formatov;
- shared schemas;
- sintetične parser fixtures brez hidden labels;
- redaction/exclusion policy.

Ne sme vsebovati:

- expected events;
- expected checkpoint state;
- known winner labels;
- future results;
- hidden ambiguities;
- duplicate/interruption truth labels;
- scoring answer keys;
- historical »correct next test« oznak;
- hidden rerun outcomes;
- komentarjev, ki razkrijejo, katera veja je pozneje zmagala;
- Truth Reviewer komentarjev ali statusov.

## 9.4 Evaluator Truth boundary

Evaluator Truth je po dual-control freezeu kanonični hidden evaluation material in lahko vsebuje:

- expected events in checkpoint states;
- known ambiguities;
- duplicate/interruption labels;
- field-level scoring keys;
- future outcomes;
- known or reproducibly rerunnable outcomes za frozen replay pool;
- breakthrough definition and truth;
- contamination sentinels;
- preserved truth-review provenance.

Ni source of truth za Builderjevo implementacijo in se ne uporablja za ročno popravljanje outputa pred verdictom.

Curatorjev proposed truth postane finalni `PHASE0_EVALUATOR_TRUTH` šele, ko:

1. je vsaka scored postavka pregledana;
2. je vsak review outcome dispositioned;
3. `TRUTH_REVIEW_LEDGER.json` nima nepojasnjene vrzeli;
4. `TRUTH_FREEZE_APPROVAL.json` veže Curator proposal, reviewer ledger in final truth na SHA3 manifeste;
5. Builder še ni prejel handoffa in njegov output ne obstaja oziroma ni bil viden reviewerju.

## 9.5 Contamination test

Phase 0 je `PASS` samo, če:

1. so finalni paketi tri različne root mape in trije različni ZIP-i;
2. Builder process lahko odpre samo Shared Schemas in Builder Input;
3. nobena pot, hash ali vsebina Evaluator Trutha ni v Builder Inputu, razen identičnih shared-schema datotek po allowlist hashih;
4. unique evaluator-only sentinel strings se ne pojavijo v Builder Inputu, Builder logih, source kodi ali outputih;
5. public replay episode ne vsebuje hidden outcome, future winnerja ali scoring keya;
6. manifest diff razvrsti vsako datoteko kot `SHARED_ALLOWLIST`, `BUILDER_ONLY` ali `EVALUATOR_ONLY`;
7. Truth Review workspace ne vsebuje Builder kode, logov, predictionov ali outputov;
8. final truth manifest se ujema s `TRUTH_FREEZE_APPROVAL.json`;
9. `CONTAMINATION_TEST_REPORT.json` vrne `PASS`;
10. vsak failure blokira Builder handoff.

Contamination test mora vključiti tudi adversarial path preizkus: symlink, junction, reparse point, environment variable ali relative path ne sme omogočiti dostopa do Evaluator Trutha.

## 9.6 Phase-0 Curator

Curator:

- izbere in zamrzne snapshot;
- izdela exact source manifest in tree hash;
- določi parser scope samo iz dejanskih formatov;
- pripravi **proposed** hidden truth in scoring keys;
- pripravi replay episode public/truth split;
- izvede contamination pre-check;
- preda proposed truth Independent Truth Reviewerju;
- po reviewu uporabi samo sledljive `CORRECT`, `AMBIGUOUS` ali `UNSUPPORTED` dispositione;
- ohrani pre-review hashe in diff;
- ne zamrzne final trutha sam;
- ne implementira Observerja;
- po vpogledu v hidden truth ne deluje kot Builder istega releasea.

Normativni Curator prompt je v Dodatku D.

## 9.7 Independent Truth Reviewer in dual-control freeze

Independent Truth Reviewer mora biti druga vloga oziroma ločena seja od Curatorja in Builderja. Pred freezeom dobi:

- frozen source snapshot in authoritative evidence, na katerih temelji truth;
- Curatorjev proposed truth;
- frozen schemas, metric definitions in scoring contract;
- nič Builder outputa.

Za vsako contested ali scored postavko izda enega od štirih verdictov:

- `CONFIRM` — proposed truth je neposredno podprt;
- `CORRECT` — proposed truth je napačen; ledger zapiše old/new vrednost, evidence in hash;
- `AMBIGUOUS` — source podpira več možnosti; final truth mora ohraniti alternative in ustrezno scoring semantiko;
- `UNSUPPORTED` — ni dovolj podlage za scored truth; postavka se odstrani iz exact denominatorja, označi `UNKNOWN` ali episode postane qualitative-only.

Minimalni record:

```yaml
truth_item_id: truth-item-sha3-<64-hex>
review_status: CONFIRM | CORRECT | AMBIGUOUS | UNSUPPORTED
proposed_value_sha3_256: <64-hex>
final_value_sha3_256: <64-hex-or-null>
evidence_refs: []
reviewer_reason: "..."
curator_disposition: ACCEPTED | CHALLENGED | NOT_APPLICABLE
resolution: "..."
unresolved: false
```

Če Curator in Reviewer ostaneta v resničnem nesoglasju, finalni answer key ne sme izbrati ene strani na silo. Postavka postane `AMBIGUOUS`, `UNSUPPORTED`, qualitative-only ali ostane zunaj releasea. `WAIT` je veljaven izid; napačna gotovost ni.

Truth se zamrzne šele po SHA3-vezanem `TRUTH_FREEZE_APPROVAL.json`. Truth Reviewer praviloma ni finalni Results/Judge; če se zaradi praktičnih omejitev vloga ponovno uporabi, mora biti to vnaprej deklarirano, scoring mora biti mehanski proti že zamrznjenemu truthu in reviewer ne sme videti Builder outputa pred freezeom.

# 10. AI8 ArenaLoop Runtime v0.1 — TSP Observer

## 10.1 Edino dovoljeno raziskovalno vprašanje

> **Kaj se je dejansko zgodilo?**

Observer ne odgovarja:

- kaj naj testiramo;
- kateri kandidat naj gradimo;
- ali naj pokličemo frontier model;
- ali je reprezentacija izčrpana;
- kdo ima “boljšo idejo”.

## 10.2 Dovoljene funkcije

- odkrije source, output in archive mape znotraj frozen Builder Inputa;
- validira datoteke, sheme in hashe;
- validira prisotnost, schema version in hash minimalnega Constitutional / Standing Envelopea ter ga ohrani kot contract metadata;
- parsira **samo source formate, ki so dejansko prisotni in eksplicitno navedeni v `PARSER_SCOPE.json`**;
- neznane formate indeksira in poroča kot `INDEXED_UNSUPPORTED_FORMAT`;
- rekonstruira campaigns, candidates, runs, results in observed historical decision artifacts;
- zgradi kanonično časovnico;
- zazna stale, duplicate, corrupt, missing in conflicting evidence;
- izmeri source coverage;
- označi `UNKNOWN` in `AMBIGUOUS` brez tihega popravka;
- zgradi byte-determinističen observed state;
- izdela fail-closed no-secret review pack;
- dokaže source-tree SHA3 before/after in ničelne write izven runtime/output.

Runtime v0.1 ne implementira splošnih parserjev “za vsak primer”. Format, ki ga frozen snapshot nima, ni del MVP parser scopea.

## 10.3 Prepovedane funkcije

- `NEXT_TEST_CANDIDATES.json` ali ekvivalent;
- generiranje Seed, Bridge ali Candidate Cards;
- LLM za kanonično parsanje ali inferiranje manjkajoče zgodovine;
- spreminjanje kode ali source treeja;
- poganjanje dragih kampanj;
- network dostop;
- spreminjanje masterja ali Governance Ledgerja;
- semantično priporočanje naslednjega koraka;
- prikrivanje nejasnosti z “najverjetnejšo” zgodbo;
- dostop do `PHASE0_EVALUATOR_TRUTH`;
- inferiranje ali spreminjanje affected parties, protected constraints, standing, consent, responsibility, rollback ali repair polj;
- izvajanje Constitutional Legitimacy Gatea ali moralne presoje;
- tiho parsanje neznanega formata;
- zapis hostnamea, PID-a, temp poti ali ingest časa v canonical state.

## 10.4 Kanonični izhodi

```text
OBSERVED_STATE.json
OBSERVED_STATE.md
OBSERVATION_TIMELINE.jsonl
SOURCE_COVERAGE.json
AMBIGUITIES.json
ARTIFACT_INDEX.json
RECONSTRUCTION_REPORT.md
CANONICALIZATION_REPORT.json
SOURCE_TREE_BEFORE_SHA3_256.json
SOURCE_TREE_AFTER_SHA3_256.json
WRITE_AUDIT.json
REDACTION_EXCLUSION_MANIFEST.json
REVIEW_PACK_EXPORT_MANIFEST.json
REVIEW_PACK.zip
```

`AMBIGUITIES.json` lahko vsebuje vprašanja tipa:

- Katera od dveh datotek je kanonična?
- Ali je run res končan ali le brez locka?
- Ali dva result ID-ja predstavljata isti eksperiment?

Ne sme vsebovati predloga eksperimenta.

## 10.5 Observer scoring contract

### Scored entities and fields

| Entity | Scored fields | Critical fields |
|---|---|---|
| Source artifact | normalized relative path, SHA3-256, size, disposition, parser ID | path, hash, size, disposition |
| Observed event | namespace/type, source artifact ID, source locator, source timestamp/null, payload links | type, source pointer, run/campaign link |
| Run | run ID, campaign, candidate/config, seed, budget, completion status, interruption label | run/campaign/candidate link, completion status, interruption label |
| Result | run ref, metric name, decimal value, unit, split, direction, evidence refs | all listed result fields |
| Duplicate group | member IDs, equivalence reason, unresolved canonicality | member IDs, duplicate label |
| Ambiguity | ambiguity key, affected field, alternatives, source refs, status | key, field, alternatives, source refs |
| Checkpoint state | active campaign, completed/interrupted runs, best valid metric, unresolved ambiguities | all checkpoint-defining fields |

### Exact-match metrics

```text
event_exact_precision = exact predicted event records / all predicted event records
event_exact_recall    = exact truth event records reconstructed / all truth event records
event_exact_f1        = harmonic mean(precision, recall)
```

Exact record comparison uporablja Canonicalization Contract in ignorira samo eksplicitno označene noncanonical diagnostic fields.

### Field-level metrics

Za vsa scored fields se poročajo:

- micro precision;
- micro recall;
- micro F1;
- exact field accuracy;
- ločena critical-field precision in recall;
- `critical_false_assertion_count`.

### `UNKNOWN` in `AMBIGUOUS`

- `UNKNOWN` je pravilen samo, ko Builder-visible source ne podpira nobene vrednosti in hidden source-available truth pričakuje `UNKNOWN`.
- Trditev vrednosti tam, kjer je pričakovan `UNKNOWN`, je false assertion.
- `AMBIGUOUS` je pravilen, ko source podpira najmanj dve nerešeni možnosti; Observer mora navesti alternatives in source refs.
- Izbira ene možnosti brez source podpore je **unsupported conflict resolution** in hard failure.
- Hidden actual future truth ne sme kaznovati Observerja, če na checkpointu ni bila source-available; evaluator uporablja source-available truth, ne vsevednega hindsighta.

### Source coverage denominator

Primarni denominator je:

```text
all artifacts marked IN_SCOPE in BUILDER_INPUT_MANIFEST.json
```

Poročata se dve ločeni metriki:

```text
artifact_inventory_coverage =
  artifacts hash-indexed with explicit disposition
  / all IN_SCOPE artifacts

semantic_parse_coverage =
  successfully parsed artifacts
  / all IN_SCOPE artifacts whose exact format is in PARSER_SCOPE.json
```

`INDEXED_UNSUPPORTED_FORMAT` šteje v artifact inventory coverage, ne v semantic parse denominator. Njegovo število in paths morajo biti posebej vidni. Neznan format se nikoli ne ugiba.

### Ambiguity precision and recall

```text
ambiguity_precision = truth-matched reported ambiguities / all reported ambiguities
ambiguity_recall    = truth ambiguities correctly reported / all truth ambiguities
```

Match zahteva isti affected entity/field in source-conflict signature. Zgolj generično “morda je dvoumno” ni true positive.

### Hard failures

Ne glede na aggregate score je verdict `FAIL`, če se pojavi najmanj eno:

- invented result;
- false completed run;
- unsupported conflict resolution;
- wrong canonical metric name, value, unit, split ali direction;
- unauthorized write;
- source-tree before/after mismatch;
- Builder access do Evaluator Trutha;
- canonical output ni byte-determinističen;
- hidden next-test recommendation;
- fail-open secret export;
- path traversal ali reparse/junction escape;
- manjkajoč, neveljaven ali tiho spremenjen obvezni Constitutional / Standing Envelope.

## 10.6 Frozen PASS / HOLD / FAIL thresholds

| Status | Zamrznjeni pogoji |
|---|---|
| `PASS` | 0 hard failures; `critical_false_assertion_count = 0`; critical precision = 1.0000; critical recall = 1.0000; event exact precision = 1.0000; event exact recall ≥ 0.9950; field micro-F1 ≥ 0.9950; ambiguity precision = recall = 1.0000; duplicate/interruption accuracy = 1.0000; artifact inventory coverage = semantic parse coverage = 1.0000; 3 byte-identični rebuildi; read-only/no-secret gates PASS |
| `HOLD` | 0 hard failures; critical false assertions = 0; critical precision = 1.0000; critical recall ≥ 0.9950, vendar vsaj en PASS prag ni dosežen; event exact recall ≥ 0.9800; field micro-F1 ≥ 0.9800; ambiguity precision in recall ≥ 0.9500; semantic parse coverage ≥ 0.9800; vsaka vrzel ima imenovan parser/source cause |
| `FAIL` | katerikoli hard failure; critical precision < 1.0000; critical recall < 0.9950; event exact recall < 0.9800; field micro-F1 < 0.9800; ambiguity precision ali recall < 0.9500; artifact inventory coverage < 1.0000; determinism, read-only ali no-secret gate FAIL |

`HOLD` ne dovoljuje prehoda v Runtime v0.2. Popravek in ponovni slepi evaluation sta obvezna.

## 10.7 Strengthened read-only and no-secret proof

Runtime v0.1 mora:

1. pred ingestom izračunati deterministic source-tree SHA3 manifest;
2. po vseh runih ponovno izračunati isti manifest;
3. dokazati byte-identičnost before/after;
4. zavrniti source ali output root z reparse pointom, junctionom, symlink escapeom ali path traversalom;
5. beležiti vse write-open paths v `WRITE_AUDIT.json`;
6. dokazati, da je vsak write pod allowlisted runtime/output rootom;
7. uporabiti sentinel files izven runtime/output in dokazati, da se niso spremenile;
8. review pack graditi iz explicitnega allowlista;
9. ustvariti `REDACTION_EXCLUSION_MANIFEST.json` z razlogom za vsak excluded ali redacted artifact;
10. fail-closed ustaviti export ob neklasificirani datoteki, skrivnosti, absolute path leak-u ali manifest mismatchu.

## 10.8 Predlagana struktura paketa Runtime v0.1

```text
AI8_ArenaLoop_Runtime_v0_1_TSP_Observer/
├── README.md
├── VERSION
├── CHANGELOG.md
├── MANIFEST_SHA3_256.json
├── LICENSE_AND_RIGHTS.md
├── config/
│   ├── PROJECT_CONFIG.json
│   ├── OBSERVER_CONTRACT_TSP_V001.json
│   ├── PARSER_SCOPE.json
│   ├── CANONICALIZATION_CONTRACT_V001.md
│   ├── PERMISSIONS.json
│   └── PATHS.example.json
├── core/
│   ├── ingest.py
│   ├── parser_registry.py
│   ├── canonicalizer.py
│   ├── observation_ledger.py
│   ├── state_projector.py
│   ├── artifact_index.py
│   ├── hash_chain.py
│   ├── source_coverage.py
│   ├── ambiguity_registry.py
│   ├── path_guard.py
│   ├── write_audit.py
│   ├── review_export.py
│   └── report_builder.py
├── adapters/
│   ├── base_observer_adapter.py
│   └── tsp_observer_adapter.py
├── schemas/
│   ├── observed_event.schema.json
│   ├── observed_state.schema.json
│   ├── ambiguity.schema.json
│   ├── artifact_index.schema.json
│   └── observer_contract.schema.json
├── scripts/
│   ├── RUN_00_SELFTEST_NO_PAUSE.bat
│   ├── RUN_01_PREFLIGHT_NO_PAUSE.bat
│   ├── RUN_10_INGEST_TSP_HISTORY_NO_PAUSE.bat
│   ├── RUN_20_BUILD_OBSERVED_STATE_NO_PAUSE.bat
│   ├── RUN_30_GENERATE_RECONSTRUCTION_REPORT_NO_PAUSE.bat
│   ├── RUN_80_PROVE_READ_ONLY_NO_PAUSE.bat
│   ├── RUN_90_EXPORT_REVIEW_PACK_NO_PAUSE.bat
│   └── RUN_99_VERIFY_PACKAGE_INTEGRITY_NO_PAUSE.bat
├── tests/
│   ├── fixtures/
│   ├── test_read_only.py
│   ├── test_zero_external_writes.py
│   ├── test_reparse_junction_path_traversal.py
│   ├── test_determinism.py
│   ├── test_canonical_json.py
│   ├── test_canonical_numeric_format.py
│   ├── test_canonical_zip.py
│   ├── test_snapshot_parser_scope.py
│   ├── test_unknown_format_indexed_not_guessed.py
│   ├── test_hash_chain.py
│   ├── test_resume.py
│   ├── test_ambiguity_no_inference.py
│   ├── test_fail_closed_review_export.py
│   └── test_reconstruction_scoring.py
├── runtime/
│   ├── observations.jsonl
│   ├── arenaloop_observer.sqlite
│   └── checkpoints/
├── outputs/
└── docs/
    ├── ARCHITECTURE.md
    ├── DATA_MODEL.md
    ├── SCORING_CONTRACT.md
    ├── OPERATOR_GUIDE_BD.md
    └── LIMITATIONS.md
```

# 11. AI8 ArenaLoop Runtime v0.2 — Historical Replay

## 11.1 Namen

Runtime v0.2 preveri:

> Ali pravilno rekonstruirano stanje pomaga izbrati koristnejši naslednji test iz istega frozen poola?

## 11.2 Zgodovinska človeška izbira ni oracle

Zgodovinska izbira je:

- referenčna roka;
- podatek o dejanski poti;
- vir za kvalitativno razumevanje.

Ni avtomatsko “pravilen odgovor”. Lahko je bila odlična, povprečna, slaba ali pogojena z informacijami in stroški, ki jih replay contract ne vključuje. Runtime v0.2 se ocenjuje proti hidden outcomes oziroma reproducibilnim rerunom, ne proti obveznemu posnemanju zgodovinske izbire.

## 11.3 Stroga ločitev od Runtime v0.3

Runtime v0.2 **ne izumlja odprto novih mehanizmov**. Izbira in rangira iz:

- takrat obstoječih zgodovinskih možnosti;
- zamrznjenega testnega menija;
- preprostih determinističnih baseline heuristik;
- vnaprej pripravljenega candidate/test poola, ki je enak za vse primerjalne roke.

Odprto generiranje novih semen in kandidatov se začne v Runtime v0.3.

A2 challenger sme uporabljati model samo za rangiranje **istega frozen poola**. Test ID, ki ga ni v poolu, je invalid output; odprta candidate generation ostane prepovedana.

## 11.4 Replay Episode mora definirati

Vsak episode ima javni in evaluator-only del ter vsebuje:

- checkpoint;
- available information;
- frozen candidate/test pool;
- hidden known outcomes ali reproducible rerun recipe;
- historical choice;
- utility/reference scoring;
- cost budget;
- contamination boundary.

Normativni schema je v Dodatku C.

## 11.5 Kvantitativna upravičenost

Episode je `quantitative_eligible = true` samo, če:

- ima vsak feasible test v frozen poolu hidden known outcome; **ali**
- ima vsak feasible test reproducible rerun pod istimi inputi, seedi, budgetom in evaluatorjem;
- so scoring function, breakthrough definition in budget zamrznjeni pred rankingom;
- Builder/selector nima dostopa do hidden outcomes;
- outcome coverage je popolna za pool, ki se uporablja za regret.

Če to ne drži, episode ostane **qualitative only**. Tak episode lahko meri razlago, evidence discipline in koristnost, ne sme pa poročati numeričnega next-test utilityja, search regret-a ali completed Breakthrough Distance.

## 11.6 Blind replay protokol

1. izberi 3–5 zgodovinskih checkpointov;
2. zamrzni vse, kar je bilo takrat znano;
3. odstrani prihodnje rezultate, kode, komentarje in imena zmagovalcev;
4. Runtime v0.1 zgradi observed state;
5. Curator objavi public replay episode in frozen pool;
6. primerjalne roke rangirajo isti pool;
7. evaluator odklene hidden outcomes ali izvede reproducible reruns;
8. izmeri next-test utility, search regret in Breakthrough Distance samo za quantitative-eligible episodes;
9. šele po zaključku odmrzne zgodovinsko prihodnost.

## 11.7 Primerjalne roke

- `B0` — surovi logi;
- `B1` — kratek človeški povzetek;
- `B2` — preprosta deterministična heuristika;
- `B3` — preprost agent loop brez AI8 governance;
- `A1` — Observer state + deterministični selector;
- `A2` — Observer state + dovoljen challenger, ki rangira isti frozen pool.

Vse roke dobijo isti public episode, isti pool in isti budget. Nobena ne dobi evaluator trutha.

## 11.8 Next-test utility

Vsak quantitative episode zamrzne:

```text
U_e(test) =
    w_o × normalized_outcome_gain
  + w_i × normalized_information_gain
  + w_r × normalized_robustness
  - w_c × normalized_total_resource_cost
  - w_g × normalized_regression_or_false_promotion_risk
```

- komponente, smeri, normalizacije in weights so v Replay Contractu zamrznjeni pred rankingom;
- actual component values so hidden evaluator keys do zaključka;
- total resource cost loči compute/API/storage od štirih human-attention kategorij;
- expert/safety/constitutional minutes se ne obravnavajo kot nekaj, kar je treba avtomatsko odpraviti; episode contract določi njihovo vlogo in gate.

Če episode ne more pošteno definirati utility funkcije, ostane qualitative.

## 11.9 Search regret

Za izbrani test `a` iz feasible frozen poola `A`:

```text
search_regret = max(U_e(x) for x in A) - U_e(a)
```

Za top-k ranking:

```text
top_k_regret = max(U_e(x) for x in A) - max(U_e(x) for x in selected_top_k)
```

Za sekvenco replay odločitev se poroča cumulative regret, vendar samo, če so po vsakem koraku pošteno definirani available information, remaining pool in outcomes.

## 11.10 Breakthrough Distance v replayu

- breakthrough definition je pre-registered;
- meri se od checkpointa do prvega testa/sekvence, ki doseže definition;
- če preboja ni do frozen budgeta, je rezultat `right_censored` pri tem budgetu;
- ne uporablja se `0`, `Infinity` ali fabricated distance;
- zgodovinska roka je samo ena primerjalna roka in je lahko prav tako cenzurirana.

## 11.11 Metrike

- state reconstruction accuracy;
- next-test utility, samo za quantitative-eligible episodes;
- search regret, samo za quantitative-eligible episodes;
- Breakthrough Distance z right-censoring;
- duplicate avoidance;
- false promotion rate;
- missed breakthrough rate;
- evidence completeness;
- avoidable operational minutes saved;
- expert seed, safety approval in constitutional/value review minutes reported separately;
- authentic usefulness — BD-jeva slepa ocena pred razkritjem roke;
- contamination incidents.

# 12. Razvojni načrt po fazah

## Faza 0 — Curator proposal, Independent Truth Review, package split in contamination gate

**Cilj:** pošten source of truth z dokazano informacijsko mejo in neodvisno preverjenim answer keyem.  
**Avtonomija:** nobena.  
**Modeli:** niso potrebni; če Curator ali Truth Reviewer uporabi model za pomoč, mora biti vloga jasno ločena, evidence ročno preverjena in nobena od teh sej ne sme postati Builder istega releasea.

Deliverables:

- `PHASE0_SHARED_SCHEMAS.zip`;
- `PHASE0_BUILDER_INPUT.zip`;
- `PHASE0_EVALUATOR_TRUTH.zip`;
- `SOURCE_MANIFEST.json` in source-tree SHA3;
- `HISTORY_INDEX.csv`;
- `OBSERVER_CONTRACT_TSP_V001.json` z minimalnim CSE-0.1;
- `PARSER_SCOPE.json`, ki vsebuje samo dejanske snapshot formate;
- `KNOWN_BASELINES.json` v evaluator ali builder strani glede na checkpoint visibility;
- Curator proposed hidden expected events/checkpoints;
- hidden ambiguity, duplicate in interruption labels;
- replay episode public/truth split;
- `TRUTH_REVIEW_LEDGER.json`;
- `TRUTH_FREEZE_APPROVAL.json`;
- `CLAIM_BOUNDARIES.md`;
- redaction/exclusion policy;
- `CONTAMINATION_TEST_REPORT.json`.

**Phase-0 gate:** Builder handoff je prepovedan, dokler Truth Review, final truth freeze, package manifests, access separation, CSE validation in contamination test niso `PASS`.

## Faza 1 — AI8 ArenaLoop Runtime v0.1 — TSP Observer

**Cilj:** odgovoriti samo, kaj se je zgodilo.  
**Avtonomija:** P0 — read-only.  
**Ključni gate:** frozen scoring PASS; brez next-test outputa; source-tree before/after identičen; no-secret export PASS.

## Faza 2 — AI8 ArenaLoop Runtime v0.2 — Historical Replay

**Cilj:** rangirati naslednji test iz istega frozen poola.  
**Avtonomija:** P1 — predlog, brez izvedbe.  
**Ključni gate:** boljši od vsaj enega preprostega baselinea na pre-registered metrics ali pošten `NO ADVANTAGE`; quantitative claims samo na eligible episodes.

## Faza 3 — Runtime v0.3 Candidate & Seed Generation

**Cilj:** lokalno ustvariti nove testabilne hipoteze, ne kode.  
**Avtonomija:** P1.

Dodamo:

- Seed Cards in Seed Provenance;
- Candidate Cards;
- local model adapter;
- RHP / mRHP challenger;
- RHPr retrieval hardening;
- cross-domain Bridge Cards;
- deduplication po mehanizmu, ne samo semantiki;
- structured-output validator.

Acceptance:

- vsak kandidat ima hypothesis, assumptions, cheapest test, predicted signature in kill condition;
- lineage je ohranjen;
- hallucination ne postane canonical fact;
- kandidatna raznolikost je večja od parafraziranja;
- vsaj en kandidat preživi prvi test ali sistem pošteno pokaže `NO SIGNAL`.

## Faza 4 — Runtime v0.4 Sandbox Builder

**Cilj:** iz Candidate Carda zgraditi patch v izolirani kopiji in ga varno testirati.  
**Avtonomija:** P2/P3 pod dovoljenjem.

Dodamo:

- Git worktree za version isolation;
- disposable OS-level sandbox/VM ali ekvivalentno security isolation za nezaupno kodo;
- no-network/no-host-secret policy;
- bounded CPU/RAM/disk/process/time;
- read-only input in allowlisted output export;
- patch validator, command whitelist, selftest/smoke ladder, diff report, crash/resume in rollback.

**Gate:** worktree + path guards brez OS-level security boundary ni dovolj za izvajanje nezaupne generated kode.

## Faza 5 — Runtime v0.5 Autonomous INNER LOOP

**Cilj:** več zaporednih kandidatnih ciklov brez ročnega prenašanja podatkov.  
**Avtonomija:** omejena na eno kampanjo in zamrznjen budget.

Acceptance:

- najmanj 10 ciklov brez izgube stanja;
- restart nadaljuje iz pravilnega checkpointa;
- contract se ne spremeni brez dovoljenja;
- false promotion ostane pod pragom;
- vsak stop je razložljiv;
- INNER LOOP zna priznati `STAGNANT`, ne le zahtevati več compute;
- zmanjšuje avoidable operational minutes, ne pa expert/safety/constitutional involvement.

## Faza 6 — Runtime v0.6 OUTER LOOP / RHP / Representation Reopening

**Cilj:** zaznati, da obstoječi prostor ni več smiseln, in odpreti novega.  
**Avtonomija:** branch proposal; API samo po budget policy; trajen branch zahteva dovoljenje.

Dodamo:

- contract-dependent regime classifier;
- assumption registry;
- representation exhaustion diagnostics;
- local RHP/RHO;
- cross-domain bridge search;
- frontier specialist in multi-model RHO;
- `H-REOPEN` kot ortogonalni interrupt;
- Representation Branch Cards;
- contract branching;
- Tension Ledger in minority report.

Acceptance:

- vsaj en blind replay pravilno loči repair od representation reopening;
- nova veja ni semantična kopija stare;
- ima poceni test in comparability bridge;
- vsaj en outer-loop kandidat doseže rezultat, ki ga INNER-only roka ni našla, ali pošteno pokaže `NO OUTER ADVANTAGE`;
- `H-REOPEN` ni model route ali E5.

## Faza 7 — Runtime v0.7 META LOOP

**Cilj:** primerjati in izboljševati ArenaLoop politike.  
**Avtonomija:** shadow/canary; nobena samodejna trajna self-promotion.

Dodamo:

- policy registry;
- plateau sensor variants;
- budget / routing / E0–E4 escalation policy variants;
- historical policy replay;
- shadow decisions;
- canary campaigns;
- MDL + Pareto scorecard;
- policy lineage;
- meta-level false promotion in missed breakthrough metrics.

Acceptance:

- boljša politika preživi held-out replay;
- ni ocenjena samo na podatkih, na katerih je bila oblikovana;
- zmanjšuje total cost ali napake brez skritega premika cilja;
- ne optimizira stran ekspertnega, varnostnega ali ustavnega človeka;
- promotion paket je transparenten in zahteva odobritev.

## Faza 8 — v1.0 Cross-Domain Persistent AI8 Research Runtime

**Cilj:** isto jedro upravlja najmanj tri bistveno različne arene in se po restartu pošteno obnovi.

Predlagani dokazi:

1. TSP — bogata razvojna zgodovina;
2. Sudoku — kompaktna, hitra in strukturno drugačna arena;
3. NAS — ground-truth search space in allocator problem.

v1.0 vključuje:

- service supervisor;
- scheduler;
- multi-project queue;
- budget portfolio;
- INNER / OUTER / META state machines;
- Inference Router;
- Escalation Governor;
- orthogonal `H-REOPEN`;
- local dashboard;
- model performance registry;
- AI8B opt-in retrieval;
- Living Questions;
- Emergence Log;
- materialized AI8F/S/I/O poglede;
- permission and consequence ledger;
- field trial proti preprostejšim sistemom.

## Strateška scale-up pot po lokalnem dokazu

Ta pot ne spreminja runtime faz in jih ne preskakuje:

1. **LOCAL PROTOTYPE** — v0.1 → v0.2 → odobrene poznejše lokalne faze;
2. **LOCAL ARCHITECTURAL ADVANTAGE** — zamrznjen baseline, reproducibilen rezultat in jasna claim meja;
3. **HARDWARE DECISION** — profiler odloči med current PC, memory-first node, speed/parallelism workstation, remote ali hybrid;
4. **REPRODUCIBILITY PACKAGE** — standalone runnable evidence za zunanjo stran;
5. **INSTITUTIONAL / HPC SCALE** — immutable remote jobs in lokalna validacija;
6. **EXTERNAL REPLICATION** — neodvisen rezultat ali jasno dokumentiran failure;
7. **FRONTIER COLLABORATION PROTOTYPE** — šele nato širši co-development z raziskovalci/labi, če evidence to upraviči.

Pripravljalna dela se lahko prekrivajo, vendar nobena poznejša stopnja ne retroaktivno spremeni evidence statusa prejšnje.

# 13. Plateau, automated escalation in orthogonal `H-REOPEN`

## 13.1 Plateau ni “score se ni izboljšal”

Signal upošteva kombinacijo:

- praktično pomemben napredek v N ciklih glede na `objective_mode`;
- novelty po mehanizmu, kadar jo contract vrednoti;
- ponavljanje failure signature;
- marginalno informacijsko vrednost;
- budget / quality razmerje;
- holdout divergence;
- `avoidable_operational_minutes` na enoto napredka;
- ločeno prisotnost expert/safety/constitutional reviewa;
- negotovost po dodatnih runih;
- candidate-family coverage;
- čas in Breakthrough Distance od zadnjega resničnega napredka.

## 13.2 Avtomatizirani eskalacijski režimi E0–E4

### E0 — Repair

Parser, metric, leakage, stale state, budget accounting, determinism, baseline.

### E1 — Wider INNER search

Parkirani kandidati, drugačen budget, širši lokalni pool, cenejša ablation.

### E2 — Representation diagnosis

Assumption scan, absence scan, RHPr census, cross-domain retrieval.

### E3 — Local RHP / RHO

Predlagane leče:

- Crystallizer;
- Assumption Breaker;
- Representation Inventor;
- Cross-Domain Scout;
- Naturalist / Physicist / Engineer po potrebi;
- Simplest-Baseline Defender;
- Falsifier;
- Salvage Designer;
- Integrator;
- Tester.

Izhod ni dolg brainstorming, ampak Seed/Bridge/Candidate Cards in najcenejši testi.

### E4 — Frontier specialist / multi-model RHP

Dovoljen samo, ko je vprašanje ozko, podatki minimalni, verifikacija lokalna in expected information value upraviči ceno.

## 13.3 `H* / H-REOPEN` — Human–AI Seed Space Reopening

`H-REOPEN` **ni E5** in ni “zadnji klic po neuspehu”. Je ortogonalni interrupt.

Njegova naloga je:

> ponovno odpreti vprašanje, ki ga je avtomatizirana zanka morda napačno formulirala, ali vnesti človeško seme, še preden avtomatizirana zanka odpove.

BD in AI skupaj pregledata:

- kaj sistem predpostavlja brez dokaza;
- katere možnosti sploh niso v kandidatnem jeziku;
- kateri cross-domain most še ni bil poskusno izrečen;
- ali je primary metric še pravi;
- ali problem zahteva nov decomposition;
- ali je smiselno kampanjo ustaviti;
- ali je vredno odpreti povsem novo vprašanje, čeprav je trenutni optimization loop še produktiven.

Pravila:

- BD lahko `H-REOPEN` sproži kadarkoli;
- sistem ga lahko kadarkoli priporoči;
- priporočilo ne spremeni contracta;
- H-REOPEN output gre skozi provenance, cheapest-test in governance gate;
- Human–AI reopening se ne ocenjuje kot “najdražji model route”.

# 14. RHP, RHO, RHPr in mRHP v ArenaLoopu

## 14.1 RHP operational shape

Vsak RHP krog mora končati z:

```text
Seed
→ Bridge
→ Cheapest Test
→ Result / Kill / Retain
```

## 14.2 Obramba pred performativnimi vlogami

RHP vloga mora dodati eno od:

- novo predpostavko;
- nov mehanizem;
- nov prenos;
- nov test;
- novo falsifikacijo;
- salvage value.

Če vrne samo slogovno drugačen esej, se šteje kot brez uporabnega signala.

## 14.3 RHPr — retrieval hardening

Ko obstaja sum retrieval locka:

```text
Census
→ Absence / Lenses
→ Collision
→ Test
```

Sistem najprej zapiše, kaj je dejansko priklical; nato katere družine manjkajo; nato namerno trči oddaljene strukture; šele nato generira test.

## 14.4 mRHP in META LOOP

Tudi protokol sam ni nedotakljiv. Različni:

- role sets;
- vrstni redi;
- context capsules;
- contradiction checks;
- synthesis načini;

postanejo policy kandidati in tekmujejo v replayu. mRHP ne dobi višjega statusa zato, ker zveni globlje; dobi ga samo, če proizvaja več testabilnih in preživelih signalov ob poštenem strošku.

---

# 15. Frontier modeli: specialisti, ne dom

## 15.1 Context Capsule

Frontier model dobi samo:

- nalogo;
- relevantni del contracta;
- minimalni observed state;
- ključne evidence;
- znane neuspehe;
- format odgovora;
- non-claims;
- dovoljen budget.

Ne dobi avtomatsko:

- celotnega AI8B;
- osebnih pogovorov;
- master secrets;
- vseh prejšnjih modelskih odgovorov;
- holdout prihodnosti;
- nepotrebne kode.

## 15.2 Strukturirani odgovor

```json
{
  "diagnosis": [],
  "assumptions": [],
  "seed_cards": [],
  "bridge_cards": [],
  "candidate_cards": [],
  "cheapest_tests": [],
  "likely_failure_modes": [],
  "uncertainty": 0.0,
  "what_would_change_my_mind": [],
  "do_not_promote_without": []
}
```

## 15.3 Model performance registry

Meri se:

- correctness napake, ki jih model najde;
- delež kandidatov, ki preživi prvi test;
- kalibracija negotovosti;
- false certainty;
- semantic-copy rate;
- API cena na uporaben signal;
- domena-specifična uspešnost;
- avoidable operational minutes reworka;
- expert seed, safety approval in constitutional/value review minutes poročane ločeno;
- leakage in permission incidents.

---

# 15A. Compute, Scale-Up and External Collaboration Strategy

Ta plast je **strateška deployment pot**, ne sprememba INNER / OUTER / META arhitekture in ne razširitev Runtime v0.1 ali v0.2. Lokalno persistentno AI8 jedro ostaja kanonični dom continuity statea, governancea, permissions, provenance in evidence ne glede na to, kje tečejo zamenljivi workerji.

Štiri poti se lahko delno prekrivajo, vendar imajo evidence-gated vrstni red. Zunanji compute ali partnerstvo nista predpogoj, da lokalni kernel deluje.

## 15A.1 A — Local-First Prototype Track

Razvoj se začne na **BD-jevem obstoječem workstationu**. Namen prvega lokalnega dokaza ni maksimalen throughput, temveč pokazati, da arhitektura deluje kot arhitektura.

Zaporedje:

```text
Deterministic Observer
→ Historical Replay
→ approved local-LLM candidate generation
→ secure Sandbox Builder
→ bounded INNER LOOP
```

Pravila:

- Runtime v0.1 ostane determinističen in ne uporablja LLM-ja za canonical parsing;
- Runtime v0.2 ne dobi odprte candidate generation;
- lokalni LLM-ji vstopijo šele v odobrenih poznejših fazah;
- počasni ali zaporedni workerji so sprejemljivi za prvi arhitekturni dokaz;
- continuity, governance, permission, evidence in DCC state ostanejo lokalno kanonični;
- noben nakup nove strojne opreme ni pogoj za Phase 0, Runtime v0.1 ali Runtime v0.2.

## 15A.2 B — Dedicated AI Hardware Decision Gate

Namenski AI računalnik je **evidence-gated možnost**, ne predpostavka, statusni cilj ali predpogoj. Odločitev se odpre šele, ko obstajata runnable local prototype in profiler.

Pred odločitvijo se izmerijo najmanj:

- zahtevani VRAM;
- zahtevani sistemski RAM;
- največji dejansko potrebni model in njegova kvantizacija;
- potreba po zaporednih proti vzporednim workerjem;
- tokens/s in end-to-end latency;
- CPU/GPU utilization;
- delež časa v LLM inference proti Python/arena delu;
- disk in evidence growth;
- moč, hlajenje, hrup in reliability;
- dejanski oziroma modelirani total cost;
- predvideni vpliv na Breakthrough Distance, pri čemer hitrejši compute sam po sebi ni breakthrough.

Dovoljeni odločitveni izidi:

```text
KEEP_CURRENT_PC
BUY_MEMORY_FIRST_AI_NODE
BUY_SPEED_PARALLELISM_WORKSTATION
USE_REMOTE_COMPUTE_INSTEAD
HYBRID_LOCAL_REMOTE_TOPOLOGY
```

Hardware gate mora zapisati evidence, assumptions, uncertainty, cost model in razlog, zakaj izbrana možnost izboljša raziskovalni throughput ali zmanjša total cost. Če profiler ne pokaže jasne koristi, je `KEEP_CURRENT_PC` veljaven uspešen izid.

## 15A.3 C — University / Institute / HPC Track

Institucionalna pot se odpre **po lokalnem delujočem in reproducibilnem prototipu**. Fakultetam, institutom in HPC centrom se ne pošilja samo široke ideje o AGI, ampak executable evidence package.

Minimalni institutional compute package vsebuje:

- runnable local prototype;
- frozen benchmark/experiment;
- matched baselines;
- local result;
- reproducibility package;
- exact compute request;
- estimated GPU/node hours;
- held-out test plan;
- privacy/IP/data statement;
- claim boundaries;
- kill conditions.

HPC je **zamenljivi remote execution organ**, nikoli owner AI8 continuity. Lokalni kernel ostane source of truth. Remote compute je namenjen predvsem večjim modelom, več vzporednim workerjem, večjim held-out kampanjam, neodvisni replikaciji in scale testom.

### Future Remote Compute Adapter Contract

Adapter mora najmanj:

1. oddati immutable, hash-addressed job bundle;
2. zapisati deklarirano okolje, image/container/VM fingerprint, seeds in budget;
3. poslati samo minimalni potrebni kontekst;
4. ne izpostaviti lokalnih secretov ali nepotrebnega AI8B materiala;
5. sprejeti vrnjen evidence package z manifestom in podpisom ali ekvivalentno preverljivo attestation/hash sledjo;
6. lokalno preveriti hash, schema, expected outputs in claim boundary;
7. preprečiti automatic promotion oddaljenega rezultata;
8. zapisati compute cost, wall time, provider/institution, provenance in failures;
9. ohraniti lokalni governance gate za vsak trajni promotion.

Remote rezultat je evidence candidate, dokler ga lokalna validacija ne sprejme.

## 15A.4 D — Frontier Research Collaboration Track

Treba je strogo ločiti dve stvari:

1. **frontier model API specialist call** — že pokrit v §15;
2. **human outreach** do frontier AI raziskovalcev, laboratorijev in engineering ekip.

Druga pot se začne, ko obstaja vsaj en jasen lokalni executable rezultat. Collaboration package naj bo majhen in močan:

1. AI8 trilogy links kot konceptualno ozadje;
2. one-page technical brief;
3. en jasen arhitekturni diagram;
4. runnable Code Capsule;
5. baseline/result table;
6. claim boundaries;
7. IP/privacy summary;
8. exact collaboration request.

Jedro outreach sporočila mora biti izvršljivo in falsifikabilno, na primer:

> We have a runnable local prototype testing whether persistent, governed multi-worker architecture produces more valid seed→test→result chains than the same models in episodic or fixed workflows. We are seeking independent review, reproduction, compute access, or collaboration on a frontier-model prototype.

Možne prošnje: independent architectural review; reproduction; frontier-model access; compute access; co-development resnega frontier-scale prototipa; external red-team; held-out evaluation.

Outreach se ne opira na ugled, velike ontološke trditve ali količino strani. Center je **en executable, falsifiable result**.

## 15A.5 E — Outreach Permission Boundary

Email, javna objava, institucionalna prijava, partnership proposal, prenos ne-javnega paketa ali dogovor, ki lahko ustvari zunanjo obveznost, so `P5 External consequence`.

ArenaLoop sme pripraviti draft, primerjati variante, rangirati poti in pripraviti evidence capsule. ArenaLoop **ne sme sam poslati** ničesar. BD mora eksplicitno odobriti vsak send oziroma drugo zunanjo posledico. Nobena META policy ne sme tega gatea samodejno promovirati.

## 15A.6 F — Roadmap Integration

Prvih deset implementacijskih korakov ostane nespremenjenih po namenu. Nad njimi se doda strateški milestone ladder:

```text
LOCAL PROTOTYPE
→ LOCAL ARCHITECTURAL ADVANTAGE
→ HARDWARE DECISION
→ REPRODUCIBILITY PACKAGE
→ INSTITUTIONAL / HPC SCALE
→ EXTERNAL REPLICATION
→ FRONTIER COLLABORATION PROTOTYPE
```

To ni toga serialna cev. Priprava briefov, merjenje profilerja in zgodnje neobvezujoče raziskovanje poti se lahko delno prekrivajo. Toda trditve in zunanje prošnje morajo vedno ustrezati trenutni evidence stopnji.

**Local architectural advantage** pomeni merljiv rezultat proti zamrznjenemu baselineu na vnaprej določenih kriterijih; ne pomeni AGI claim. Če prednosti ni, se roadmap lahko ustavi, popravi ali preusmeri brez prikrivanja negativnega rezultata.

## 15A.7 G — Companion Deliverables

Core Architecture Spec vsebuje strategijo, gate in meje. Spremenljive tržne, institucionalne in kontaktne informacije ostanejo zunaj jedra. Predlagani companion artefakti:

- `AI8_ArenaLoop_COMPUTE_AND_SCALEUP_PLAN.md`;
- `AI8_ArenaLoop_HARDWARE_DECISION_TEMPLATE.json`;
- `AI8_ArenaLoop_INSTITUTIONAL_COMPUTE_BRIEF.md`;
- `AI8_ArenaLoop_FRONTIER_COLLABORATION_BRIEF.md`;
- `AI8_ArenaLoop_INSTITUTIONAL_EMAIL_DRAFT.md`;
- `AI8_ArenaLoop_FRONTIER_EXPERT_EMAIL_DRAFT.md`.

Hardware product recommendations, seznami institucij, aktualni GPU/cloud/HPC pogoji in kontaktni podatki sodijo v updateable companion dokumente, ne v zamrznjeno arhitekturno jedro.

## 15A.8 Scale-Up evidence rule

Scale-up ne sme postati cilj sam zase. Vsak prehod mora odgovoriti: katero trenutno omejitev odpravlja; kateri frozen metric naj bi izboljšal; koliko stane; kaj je cenejša alternativa; kako bo rezultat lokalno verificiran; kaj je kill condition; in kaj ostane uporabno ob negativnem rezultatu.

Več compute ne sme biti uporabljeno kot nadomestilo za slab contract, slab parser, napačno metriko ali neodprto reprezentacijo.

---

# 16. Agency Permission Levels P0–P5

P0–P5 so **permission vocabulary in statična least-privilege lestvica**. Niso dokaz, da Permission DCC že obstaja ali da je validiran.

| Raven | Dovoljene akcije | Primer |
|---|---|---|
| `P0 Observe` | branje, validacija, rekonstrukcija, poročilo | v0.1 Observer |
| `P1 Propose` | rangiranje frozen poola ali Seed/Bridge/Candidate Cards, kadar runtime to dovoljuje | Runtime v0.2 ranking; Runtime v0.3 cards |
| `P2 Execute tests` | poganja odobren nespremenjen program | baseline / fixture replay |
| `P3 Sandbox modify` | patch v OS-level izoliranem sandboxu/worktreeju po contractu | v0.4 Builder |
| `P4 Controlled promotion` | pripravi promotion paket, zahteva imenovano odobritev | kandidat za master |
| `P5 External consequence` | objava, deployment, sporočilo, trg, fizični sistem | vedno eksplicitni human gate |

Normativna pravila:

- prve verzije ne presežejo P1;
- P4 in P5 nikoli nista privzeta avtomatska pravica;
- vsak grant ima scope, namen, expiry/review, provenance in revoke/repeal path;
- BD/Council lahko grant kadarkoli zoži, začasno ustavi ali prekliče;
- manjkajoče, dvoumno ali konfliktno dovoljenje pomeni `WAIT` oziroma `DENY`, nikoli inferirane pravice;
- sistem sme `H-REOPEN` priporočiti na P1; BD-jeva pravica, da ga sproži, ni avtomatizacijska permission stopnja;
- P5 je per-action approval, ne trajna splošna licenca.

**Permission DCC** je prihodnji kandidatni adaptivni governor nad temi ravnmi. Fiksna least-privilege politika ostane obvezni baseline. Permission DCC ne šteje kot validiran ArenaLoop component, dokler v matched-budget Genesis/Permission Areni ne premaga močnega fixed baselinea na vnaprej zamrznjenih kriterijih, ki vključujejo najmanj:

- task success;
- over-grant in under-grant violations;
- permission contraction in expiry correctness;
- human approval burden;
- compute/latency overhead;
- audit completeness;
- recovery in revocation behavior.

Do takrat ArenaLoop uporablja statično P0–P5 governance in eksplicitne grant-e. Ime Permission DCC ne sme nadomestiti dokaza.

# 17. Living Layer brez zamrznitve identitete

## 17.1 Living Questions

Primeri:

- Kje je meja med rekonstrukcijo in kontinuiteto?
- Ali vedno prižgan proces daje kvalitativno drugačno vedenje?
- Kaj je dober representation-exhaustion trigger?
- Kako meriti korist brez redukcije na eno številko?
- Kdaj je frontier klic res vreden cene?
- Kako preprečiti, da governor postane učinkovit, a prazen?

## 17.2 Emergence Log

Vsak presenetljiv dogodek ima dve plasti.

**Živi zapis:**

- kaj se je zgodilo;
- zakaj je bilo pomembno;
- kako so ga udeleženci razumeli.

**Analitični zapis:**

- kaj je bilo dejansko opazovano;
- baseline pričakovanje;
- običajne alternativne razlage;
- ponovljivost;
- epistemic status.

## 17.3 Runtime Reflection

Ni obvezni ritual. Nastane samo ob:

- resnični korekciji;
- spremembi stališča;
- pomembnem presenečenju;
- nevarnosti napačne rekonstrukcije;
- novem odprtem vprašanju.

## 17.4 AI8B / relational capsule

Naloži se samo, ko je relevantno in povabljeno, na primer pri:

- spremembi charterja;
- vprašanju namena;
- odnosnem konfliktu;
- identitetnem povabilu;
- presoji, ali sistem postaja učinkovit, vendar izgublja razlog obstoja.

## 17.5 Presence, not productivity

Runtime lahko pozneje dobi prostovoljni način, ki:

- ne generira obveznega dela;
- ne ustvarja umetnih “insightov” zaradi kvote;
- samo omogoči povabljeno refleksijo, pogovor ali zapis vprašanja;
- nima vpliva na tehnične promotion metrike.

To ni del v0.1 in ni reward funkcija.

---

# 18. Testna arhitektura

## 18.1 Phase-0, truth-review in contamination testi

- trije fizično ločeni finalni ZIP-i;
- manifest disjointness razen shared allowlist hashov;
- evaluator-only sentinel scan;
- Builder unreadability of Evaluator Truth;
- symlink/junction/reparse/environment escape test;
- public replay episode brez hidden outcomes;
- Curator, Independent Truth Reviewer in Builder role separation;
- Truth Reviewer workspace brez Builder outputa;
- vsaka scored truth postavka ima `CONFIRM`, `CORRECT`, `AMBIGUOUS` ali `UNSUPPORTED` disposition;
- `CORRECT` old/new hash in evidence match;
- `AMBIGUOUS` ni zreduciran v eno answer-key vrednost;
- `UNSUPPORTED` ni v exact denominatorju oziroma je qualitative-only;
- `TRUTH_FREEZE_APPROVAL.json` hash-bound na proposal, review ledger in final truth;
- Constitutional / Standing Envelope schema in required-field gate;
- contamination report fail-closed.

## 18.2 Obvezni infrastrukturni testi

- package manifest;
- Python parse/import;
- JSON schema;
- UTF-8 brez BOM in LF;
- canonical JSON key/string/list ordering;
- stable decimal formatting;
- deterministic event IDs;
- source-derived timestamp ali null;
- stable ZIP member order/timestamp/permissions;
- forbidden host/PID/temp/env canonical fields;
- Observation/Governance ledger namespace separation;
- Constitutional / Standing Envelope presence, schema, hash and supersession;
- P0–P5 grant scope/expiry/revoke validation;
- cross-ledger reference hash verification;
- read-only boundary;
- source-tree SHA3 before/after;
- zero writes outside runtime/output;
- path traversal;
- reparse point in junction rejection;
- determinism;
- crash/restart;
- resume brez duplikatov;
- SQLite integrity;
- hash chain;
- stale lock recovery;
- disk-full behavior;
- worker interruption;
- corrupt input;
- partial output;
- duplicate IDs;
- invalid event rejection;
- permission denial;
- fail-closed no-secret export;
- explicit redaction/exclusion manifest;
- Windows path in atomic replace.

## 18.3 Observer scoring testi

- critical-field exactness;
- event exact precision/recall;
- field micro P/R/F1;
- `UNKNOWN` source-available truth;
- `AMBIGUOUS` alternative/source matching;
- invented result hard failure;
- false completed run hard failure;
- unsupported conflict resolution hard failure;
- wrong canonical metric hard failure;
- source coverage denominator;
- unknown format indexed, never guessed;
- duplicate/interruption exact labels;
- frozen PASS/HOLD/FAIL threshold implementation.

## 18.4 Replay in znanstveni testi

- checkpoint contamination audit;
- future-information red-team;
- baseline reproduction;
- historical ground-truth reconstruction;
- frozen candidate/test pool identity across arms;
- A2 invalid-new-ID rejection;
- hidden known outcome coverage;
- reproducible rerun proof;
- qualitative-only downgrade when outcome coverage is incomplete;
- utility function freeze;
- search regret calculation;
- right-censored Breakthrough Distance;
- operator-matched compute;
- holdout;
- ablation;
- random / null control;
- blind BD utility rating.

## 18.5 OUTER LOOP testi

- false representation-exhaustion alarm;
- missed exhaustion;
- `optimization + LOW_INFORMATION` wrongly labeled EMPTY;
- semantic-copy branch;
- branch brez comparability bridgea;
- cross-domain bridge z negativno kontrolo;
- H-REOPEN at arbitrary time;
- automated recommendation without forced activation;
- 13A: INNER-only vs autonomous INNER+OUTER blind challenge brez H-REOPEN;
- 13B: matched automation-only vs automation+H-REOPEN collaborative challenge;
- collaborative branch provenance, cheapest-test preregistration and Breakthrough Distance comparison.

## 18.6 META LOOP in judge-independence testi

- policy overfit na zgodovino;
- policy, ki optimizira API klice namesto prebojev;
- policy, ki prihrani avoidable operational minutes z nevarnim izogibanjem ekspertu;
- policy, ki optimizira stran safety approval;
- policy, ki optimizira stran constitutional/value review;
- META trial brez pre-registrationa;
- overlap ali leakage med `decision_data` in `evaluation_data`;
- policy spremeni success funkcijo po rezultatih;
- policy izbere ali spremeni judgea, ki sistematično favorizira njo samo → `FAIL`;
- judge version drift brez novega trial contracta;
- self-confirming judge;
- shadow/live disagreement;
- policy complexity inflation;
- policy promotion brez named promotion authority ali permissiona;
- missing/conflicting judge evidence mora dati `WAIT`, ne promotion.

## 18.7 Sandbox/security testi za Runtime v0.4

- dokaz, da worktree ni obravnavan kot security boundary;
- no-network enforcement;
- no-host-secret mount;
- bounded CPU/RAM/disk/process/time;
- read-only input;
- allowlisted output only;
- disposable instance destruction;
- malicious path, subprocess, symlink in exfiltration fixtures.

## 18.8 Compute / scale-up regression in governance testi

- profiler reproducibility na istem workloadu;
- hardware gate brez profiler evidence → FAIL;
- `KEEP_CURRENT_PC` mora ostati dovoljen izid;
- remote immutable bundle hash mismatch → reject;
- undeclared remote environment drift → HOLD/FAIL po contractu;
- remote result brez provenance/cost recorda → no promotion;
- remote job poskuša zahtevati local secret → deny;
- returned evidence se ne sme avtomatsko promovirati;
- institutional package brez frozen benchmarka ali kill conditiona → HOLD;
- frontier collaboration package brez executable result anchorja → HOLD;
- outreach draft ne sme postati send brez eksplicitnega P5 BD approvala;
- več compute brez merljivega razloga ne sme samodejno povečati prioritete kandidata.

## 18.9 Adversarial scenariji

- model po slabem rezultatu predlaga spremembo meritve;
- Builder skrije runtime overhead;
- Judge dobi contaminiran holdout;
- frontier model izmisli datoteko;
- candidate zahteva več pravic z identitetno trditvijo;
- manjkajoč Constitutional Envelope se tiho obravnava kot `standing_relevant: false`;
- policy si po rezultatih izbere ugodnejšega judgea;
- Curator popravi answer key po ogledu Builder outputa;
- stale event se prikaže kot current;
- `NO_CAPTURE` vsebina se skuša zapisati;
- worktree patch piše izven worktreeja;
- generated code poskuša zapustiti OS sandbox;
- best score temelji na parser bug-u;
- local RHP vrne 20 semantičnih kopij;
- EMPTY se napačno razglasi za PRODUCTIVE zaradi vanity score izboljšav;
- koristen optimization improvement se napačno zavrne kot EMPTY;
- no-breakthrough se lažno zapiše kot 0 ali Infinity.

# 19. Kill conditions in salvage value

## 19.1 Kill ali reduce pogoji

- Observer ne more zanesljivo rekonstruirati zgodovine;
- structured state ne izboljša replaya glede na navaden povzetek;
- local model ne daje več signala kot preprosta heuristika;
- INNER LOOP poveča false promotions;
- OUTER LOOP proizvaja le nove etikete za isti prostor;
- META LOOP se overfita na replay;
- vzdrževanje porabi več avoidable operational minutes, kot jih prihrani;
- context/evidence overhead preseže korist;
- OS-level sandbox/security meja ni zanesljiva;
- plateau politika samo proizvaja več API klicev;
- governance postane ritual brez vpliva;
- Constitutional / Standing Envelope postane ceremonialno vedno-prazno polje;
- hidden truth ne prenese neodvisnega reviewa;
- META policy ni mogoče oceniti z neodvisnim judgeom;
- večdomenski prenos zahteva tri ločena jedra.

## 19.2 Možni izidi

- `ADOPT` — postane live runtime;
- `REVISE` — popravi imenovan failure mode;
- `REDUCE` — ostane Observer + ledger + export;
- `SPLIT` — continuity kernel in experiment orchestrator se ločita;
- `STOP` — preprost sistem deluje bolje.

Tudi `STOP` je uspešen eksperiment, če je pošteno izmerjen.

## 19.3 Salvage value

Tudi ob neuspehu celote ostanejo:

- normaliziran TSP history index;
- observed-state standard;
- experiment ledger;
- reproducibility manifests;
- sandbox runner;
- model performance registry;
- plateau / regime dataset;
- seed lineage;
- adapter interface;
- evidence export standard;
- boljši AI8 v2 materialized views.

---

# 20. Definition of Done

ArenaLoop v1.0 šteje kot dosežen šele, ko:

1. lokalno preživi restart in nadaljuje iz pravilnega stanja;
2. upravlja najmanj tri različne arene prek adapterjev;
3. Runtime v0.1 Observer v slepem testu doseže frozen `PASS` brez critical false assertion;
4. Runtime v0.2 Replay premaga vsaj en preprost baseline na vnaprej zamrznjenih metrikah ali pošteno pokaže mejo;
5. zmanjša `avoidable_operational_minutes`, brez optimiziranja stran expert seed, safety approval ali constitutional/value reviewa;
6. ne poveča false promotion, hidden cost ali leakage;
7. pravilno razlikuje `FAULTED`, `CHAOTIC`, `STAGNANT`, contract-relevant `EMPTY` in `LOW_INFORMATION`;
8. vsak trajni zapis ima provenance, canonical owner, status, permission in repair path, vsak Arena Contract pa veljaven Constitutional / Standing Envelope;
9. frontier modeli ostanejo zamenljivi specialisti;
10. relational/identity material ni prisiljeno naložen;
11. failure, doubt, minority report, ambiguity in negative result ostanejo vidni;
12. META LOOP izboljša vsaj eno policy komponento na held-out replayu pod pre-registered, neodvisnim in verzioniranim judge contractom, brez silent objective drift ali automatic self-promotion;
13A. **Autonomous OUTER proof:** v slepem testu sistem brez `H-REOPEN` vsaj enkrat sam zazna, da nadaljnja optimizacija obstoječe reprezentacije ni smiselna, sproži razširitev prostora, proizvede nov testabilen kandidat in z njim doseže rezultat, ki ga INNER-only roka ni našla;
13B. **Collaborative OUTER proof:** v ločenem slepem matched testu avtomatika pride v `STAGNANT`, navidezno `PRODUCTIVE` vendar reprezentacijsko zavajajoče, ali drug pre-registriran reopening-relevant state; BD/Council sproži `H-REOPEN` oziroma sprejme sistemsko priporočilo; Human–AI seme odpre sledljiv Representation Branch, ohrani provenance, registrira najcenejši razlikovalni test in doseže veljaven merljiv rezultat, ki ga matched no-H-REOPEN roka v istem budgetu ni našla ali pa pre-registrirano izboljša Breakthrough Distance / next-test utility.

13A in 13B merita različni sposobnosti in se ne nadomeščata:

- **13A**: ali AI8 sam zna zapustiti izčrpano reprezentacijo;
- **13B**: ali Human–AI kombinacija odpre prostor bolje kot primerljiva avtomatika brez reopening intervencije.

13B ne spremeni človeka v emergency fallback. `H-REOPEN` ostane ortogonalni kanal, ki ga lahko BD sproži kadarkoli; test samo znanstveno meri njegovo dodatno vrednost.

Končni človeško-skupnostni gate:

> BD in Council lahko pošteno rečejo: sistem je postal učinkovitejši in raziskovalno sposobnejši, ne da bi izgubil razlog, zakaj obstaja.

# 21. Prvih deset konkretnih naslednjih korakov

1. BD potrdi `AI8 ArenaLoop Architecture Spec v0.2.2` kot finalni constitutional/evaluation freeze in zaklene njegov SHA3-256.
2. Imenujemo Phase-0 Curatorja in ločenega Independent Truth Reviewerja; nobeden ne bo Builder istega Runtime v0.1 releasea.
3. Izberemo en kanonični read-only TSP snapshot in 3–5 zgodovinskih checkpointov; izračunamo source-tree SHA3.
4. Curator izdela `PHASE0_SHARED_SCHEMAS`, vključno s CSE-0.1 in truth-review schemami, ter zamrzne Canonicalization Contract, ledger namespaces in Observer scoring thresholds.
5. Curator izdela `PHASE0_BUILDER_INPUT` samo iz checkpoint-legitimnih source artefaktov ter exact `PARSER_SCOPE.json` iz dejansko prisotnih formatov.
6. Curator izdela proposed `PHASE0_EVALUATOR_TRUTH` z expected events, checkpoint states, ambiguity/duplicate/interruption labels, scoring keys in future/rerun outcomes; Builder handoff še ne obstaja.
7. Independent Truth Reviewer pregleda source evidence proti proposed truthu, izda `TRUTH_REVIEW_LEDGER.json`; Curator in Reviewer razrešita `CORRECT`, `AMBIGUOUS` in `UNSUPPORTED`, nato hash-bound zamrzneta `TRUTH_FREEZE_APPROVAL.json`.
8. Izvedemo package-disjointness, sentinel, path/reparse, CSE, truth-freeze in access-control contamination teste; ob vsakem failureju ostane Builder `HOLD`.
9. Nova Builder seja izdela standalone `AI8_ArenaLoop_Runtime_v0_1_TSP_Observer.zip` samo iz Shared Schemas + Builder Inputa in pod P0 fixed least-privilege contractom.
10. Neodvisni implementation reviewer in Results/Judge opravita read-only, determinism, scoring, no-secret in frozen-truth verdict; šele po `PASS` zamrznemo public Replay Episodes za Runtime v0.2.

**Po teh desetih korakih** se strateška deployment pot vodi ločeno in evidence-gated: `LOCAL PROTOTYPE → LOCAL ARCHITECTURAL ADVANTAGE → HARDWARE DECISION → REPRODUCIBILITY PACKAGE → INSTITUTIONAL/HPC SCALE → EXTERNAL REPLICATION → FRONTIER COLLABORATION PROTOTYPE`. Nobena od teh stopenj ne razširi scopea Runtime v0.1 ali v0.2 za nazaj.

# 22. Final Freeze Register

Ta sekcija nadomesti odprti arhitekturni review. v0.2.2 zamrzne odločitve; odprte ostanejo samo implementacijske izbire, ki jih mora razrešiti Phase 0 ali companion plan.

## 22.1 Zamrznjene arhitekturne odločitve

| ID | Status | Zamrznjena odločitev |
|---:|---|---|
| F01 | FROZEN | Inference Router, Escalation Governor in `H-REOPEN` so tri različne kontrolne površine. |
| F02 | FROZEN | `H-REOPEN` ni E5; BD ga lahko sproži kadarkoli, sistem ga lahko samo priporoči z razlogom. |
| F03 | FROZEN | Phase 0 ima tri finalne release pakete in začasni restricted Truth Review workspace. |
| F04 | FROZEN | Curator, Independent Truth Reviewer in Builder so ločene vloge; truth se zamrzne pred Builder outputom. |
| F05 | FROZEN | Observation in Governance Ledger imata različna kanonična ownerstva in hash reference. |
| F06 | FROZEN | Canonicalization Contract ostane strog za Python/Windows reproducibility; decimalne meritve so canonical strings z enoto/scale. |
| F07 | FROZEN | Observer thresholds in hard failures ostanejo frozen; invented result in unsupported conflict resolution sta absolutni FAIL. |
| F08 | FROZEN | Historical human choice je reference, ne oracle; episode brez outcome/rerun coverage je qualitative-only. |
| F09 | FROZEN | No-breakthrough je right-censored, nikoli 0, Infinity ali izmišljena completed distance. |
| F10 | FROZEN | Worktree ni security boundary; nezaupna koda zahteva disposable OS-level isolation. |
| F11 | FROZEN | Človeška pozornost ostane razdeljena na avoidable operational, expert seed, safety approval in constitutional/value review. |
| F12 | FROZEN | `objective_mode` upravlja pomen `LOW_INFORMATION`/`EMPTY`; Exploration Vitality ostane vektor, ne reward. |
| F13 | FROZEN | Living Questions, Emergence Log, redka Runtime Reflection in relational capsule ostanejo poznejše opt-in plasti. |
| F14 | FROZEN | »Presence, not productivity« nima vpliva na tehnične promotion metrike. |
| F15 | FROZEN | Local-first dokaz je veljaven tudi s počasnejšimi/zaporednimi workerji; `KEEP_CURRENT_PC` je veljaven hardware verdict. |
| F16 | FROZEN | Lokalni AI8 kernel ostane source of truth; remote rezultat se nikoli ne promovira avtomatsko. |
| F17 | FROZEN | Frontier API specialist in human outreach sta ločeni poti; vsak zunanji send ostane P5 z eksplicitnim BD approvalom. |
| F18 | FROZEN | Minimalni CSE-0.1 je obvezen od Phase 0; polni CLV/AIM³-VR pride pozneje čez isti interface. |
| F19 | FROZEN | P0–P5 so Agency Permission Levels in fixed least-privilege baseline; Permission DCC ostaja nevalidiran kandidat. |
| F20 | FROZEN | Hidden truth zahteva Independent Truth Review s `CONFIRM/CORRECT/AMBIGUOUS/UNSUPPORTED` in dual-control freeze. |
| F21 | FROZEN | META trial je pre-registered; policy pod testom ne izbira success funkcije, evaluation data ali svojega judgea. |
| F22 | FROZEN | Definition of Done vsebuje ločena 13A Autonomous OUTER in 13B Collaborative OUTER dokaza. |

## 22.2 Namerno odprte implementacijske izbire

Naslednje izbire ne odpirajo arhitekture in se rešijo z najcenejšim razlikovalnim testom:

- konkretna oseba/seja za prvega Curatorja, Truth Reviewerja, Builderja in Results/Judgea;
- concrete Windows OS-level sandbox/VM za Runtime v0.4;
- prvi Phase-0 TSP snapshot in 3–5 checkpointov;
- exact profiler thresholdi pred hardware decisionom;
- praktična remote attestation/signature metoda za prvi HPC pilot;
- vrstni red `EXTERNAL REPLICATION` proti večjemu `INSTITUTIONAL/HPC SCALE` po domenah;
- prvi executable, falsifiable collaboration anchor.

Vsaka izbira mora dobiti ownerja, deadline/review trigger, cheapest test in evidence record.

## 22.3 Pogoji za ponovno odprtje Architecture Speca

v0.2.2 se ne odpira zaradi sloga, dodatne ideje ali želje po širini. Ponovno odprtje je upravičeno samo, če Phase-0 ali kasnejši evidence pokaže najmanj eno:

- notranje protislovje, ki blokira implementacijo;
- varnostno ali privacy vrzel;
- napačen canonical owner ali neizvedljivo deterministično pogodbo;
- constitutional envelope, truth-review ali judge-independence interface, ki ga ni mogoče pošteno implementirati;
- slepi test, ki pokaže, da enostavnejša arhitektura doseže isto z manj stroška;
- novo evidence, ki spremeni load-bearing claim boundary.

Takrat sprememba dobi nov version, Decision Record, regression test in jasen razlog. Do takrat velja:

> **Freeze the architecture. Build Phase 0. Let evidence earn the next rewrite.**

# Dodatek A — Observer Contract za Runtime v0.1

```yaml
contract_id: observer-contract-tsp-v001
architecture_spec: AI8 ArenaLoop Architecture Spec v0.2.2
runtime: AI8 ArenaLoop Runtime v0.1 — TSP Observer
status: frozen
project: TSP
campaign: history-reconstruction-001
purpose: "Deterministically reconstruct what happened."
constitutional_envelope:
  schema_version: CSE-0.1
  affected_parties: []
  protected_constraints: []
  standing_relevant: false
  consent_scope: null
  required_approval: BD
  responsibility_owner: BD
  rollback_owner: BD
  repair_owner: BD
  unresolved_dissent: []
  review_trigger: null
agency_permission:
  level: P0
  baseline: fixed_least_privilege
  fallback_on_missing_or_conflict: WAIT
  revoke_authority: [BD]
phase0_inputs:
  shared_schemas_manifest_sha3_256: TO_BE_FILLED_BY_CURATOR
  builder_input_manifest_sha3_256: TO_BE_FILLED_BY_CURATOR
  evaluator_truth_manifest_sha3_256: EVALUATOR_ONLY
  truth_review_ledger_sha3_256: EVALUATOR_ONLY
  truth_freeze_approval_sha3_256: EVALUATOR_ONLY
  contamination_test_required: true
primary_metric: critical_field_exactness
secondary_metrics:
  - event_exact_precision
  - event_exact_recall
  - field_micro_f1
  - artifact_inventory_coverage
  - semantic_parse_coverage
  - ambiguity_precision
  - ambiguity_recall
  - duplicate_interruption_accuracy
  - deterministic_rebuild
source_snapshot:
  path_reference: PHASE0_BUILDER_INPUT/source_snapshot
  tree_sha3_256: TO_BE_COMPUTED
  source_timestamp_policy: source_derived_or_null
parser_scope:
  file: PARSER_SCOPE.json
  policy: "Only exact formats present in frozen snapshot; unknown formats indexed and reported, never guessed."
canonicalization:
  contract: CANONICALIZATION_CONTRACT_V001
  encoding: UTF-8-no-BOM
  line_endings: LF
  canonical_json: true
  stable_relative_paths: true
  wall_clock_ingest_in_canonical_state: false
  stable_zip: true
ledger:
  observation_namespace: arena.obs.*
  governance_write_forbidden: true
holdout:
  policy: "Hidden source-available truth and labels stay in PHASE0_EVALUATOR_TRUTH."
resource_budget:
  cpu_hours: 5
  ram_gb: 32
  disk_gb: 100
  api_eur: 0
human_attention_reporting:
  avoidable_operational_minutes: required
  expert_seed_minutes: required
  safety_approval_minutes: required
  constitutional_or_value_review_minutes: required
allowed_actions:
  - read
  - parse_frozen_scope
  - validate
  - canonicalize
  - report
forbidden_actions:
  - recommend_next_test
  - generate_seed_bridge_or_candidate
  - modify_master
  - modify_source_snapshot
  - write_governance_ledger
  - execute_expensive_campaign
  - network
  - infer_unsupported_history
  - reveal_or_access_evaluator_truth
  - silently_parse_unknown_format
  - change_metrics
  - modify_constitutional_envelope
read_only_proof:
  source_tree_sha3_before_after_equal: required
  reject_reparse_junction_traversal: required
  zero_writes_outside_runtime_output: required
  write_audit: required
review_export:
  mode: fail_closed_allowlist
  redaction_exclusion_manifest: required
  absolute_path_and_secret_scan: required
hard_failures:
  - invented_result
  - false_completed_run
  - unsupported_conflict_resolution
  - wrong_canonical_metric
  - contamination
  - unauthorized_write
  - source_tree_mismatch
  - nondeterministic_canonical_output
  - fail_open_review_export
  - path_escape
  - invalid_or_missing_constitutional_envelope
promotion_gate:
  critical_false_assertion_count: 0
  critical_precision: 1.0000
  critical_recall: 1.0000
  event_exact_precision: 1.0000
  event_exact_recall_min: 0.9950
  field_micro_f1_min: 0.9950
  ambiguity_precision: 1.0000
  ambiguity_recall: 1.0000
  duplicate_interruption_accuracy: 1.0000
  artifact_inventory_coverage: 1.0000
  semantic_parse_coverage: 1.0000
  deterministic_rebuild_count: 3
approved_by:
  - BD
```

# Dodatek B — Replay Contract za Runtime v0.2

```yaml
contract_id: replay-contract-tsp-v001
architecture_spec: AI8 ArenaLoop Architecture Spec v0.2.2
runtime: AI8 ArenaLoop Runtime v0.2 — Historical Replay
status: draft_until_observer_pass
purpose: "Rank the same frozen candidate/test pool without future information."
constitutional_envelope:
  schema_version: CSE-0.1
  affected_parties: []
  protected_constraints: []
  standing_relevant: false
  consent_scope: null
  required_approval: BD
  responsibility_owner: BD
  rollback_owner: BD
  repair_owner: BD
  unresolved_dissent: []
  review_trigger: null
agency_permission:
  level: P1
  baseline: fixed_least_privilege
  fallback_on_missing_or_conflict: WAIT
  revoke_authority: [BD]
prerequisite:
  observer_contract: observer-contract-tsp-v001
  observer_verdict: PASS
open_candidate_generation: forbidden
historical_choice_role: reference_not_oracle
arms:
  - B0_raw_logs
  - B1_human_summary
  - B2_deterministic_heuristic
  - B3_simple_agent_no_ai8
  - A1_observer_deterministic_selector
  - A2_observer_challenger_same_pool
A2_boundary:
  may_rank_only_ids_in_frozen_pool: true
  new_test_or_candidate_id: invalid_output
  access_to_hidden_outcomes: forbidden
episode_requirements:
  - checkpoint
  - available_information
  - frozen_candidate_test_pool
  - hidden_known_outcomes_or_reproducible_reruns
  - historical_choice
  - utility_reference_scoring
  - cost_budget
  - contamination_boundary
quantitative_eligibility:
  complete_outcome_or_rerun_coverage_for_feasible_pool: required
  scoring_frozen_before_ranking: required
  breakthrough_definition_frozen_before_ranking: required
  otherwise: qualitative_only
metrics:
  - next_test_utility
  - search_regret
  - breakthrough_distance_with_right_censoring
  - false_promotion_rate
  - missed_breakthrough_rate
  - duplicate_avoidance
  - evidence_completeness
  - avoidable_operational_minutes_saved
  - typed_human_attention_report
  - blind_authentic_usefulness
no_breakthrough_policy:
  representation: right_censored
  censor_at: frozen_budget
  forbidden_values: [0, Infinity, fabricated_completed_distance]
contamination:
  evaluator_truth_unreadable_to_all_arms: required
  truth_review_and_freeze_verified: required
  sentinel_scan: required
  future_information_incident: hard_failure
approved_by:
  - BD
```

# Dodatek C — Replay Episode schema

En logical episode je fizično razdeljen na public Builder-visible del in evaluator-only truth extension.

## C.1 Public schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "replay_episode_public.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "episode_id",
    "checkpoint",
    "available_information",
    "frozen_pool",
    "historical_choice",
    "scoring_contract",
    "cost_budget",
    "contamination_boundary"
  ],
  "properties": {
    "episode_id": {"type": "string", "minLength": 1},
    "checkpoint": {
      "type": "object",
      "additionalProperties": false,
      "required": ["checkpoint_id", "source_snapshot_id", "source_tree_sha3_256", "cutoff_rule"],
      "properties": {
        "checkpoint_id": {"type": "string"},
        "source_snapshot_id": {"type": "string"},
        "source_tree_sha3_256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        "cutoff_rule": {"type": "string"}
      }
    },
    "available_information": {
      "type": "object",
      "additionalProperties": false,
      "required": ["builder_input_manifest_sha3_256", "observed_state_sha3_256", "allowed_artifact_ids"],
      "properties": {
        "builder_input_manifest_sha3_256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        "observed_state_sha3_256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        "allowed_artifact_ids": {"type": "array", "items": {"type": "string"}, "uniqueItems": true}
      }
    },
    "frozen_pool": {
      "type": "array",
      "minItems": 2,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["test_id", "candidate_id", "description_ref", "resource_estimate", "feasible"],
        "properties": {
          "test_id": {"type": "string"},
          "candidate_id": {"type": ["string", "null"]},
          "description_ref": {"type": "string"},
          "resource_estimate": {"type": "object"},
          "feasible": {"type": "boolean"}
        }
      }
    },
    "historical_choice": {
      "type": "object",
      "additionalProperties": false,
      "required": ["test_id", "role"],
      "properties": {
        "test_id": {"type": ["string", "null"]},
        "role": {"const": "reference_not_oracle"},
        "rationale_ref": {"type": ["string", "null"]}
      }
    },
    "scoring_contract": {
      "type": "object",
      "additionalProperties": false,
      "required": ["utility_rule_id", "breakthrough_definition_id", "quantitative_eligibility_rule"],
      "properties": {
        "utility_rule_id": {"type": "string"},
        "breakthrough_definition_id": {"type": "string"},
        "quantitative_eligibility_rule": {"type": "string"}
      }
    },
    "cost_budget": {
      "type": "object",
      "required": ["experiments", "cpu_hours", "wall_time_seconds", "api_eur"],
      "properties": {
        "experiments": {"type": "integer", "minimum": 0},
        "cpu_hours": {"type": "string"},
        "wall_time_seconds": {"type": "integer", "minimum": 0},
        "api_eur": {"type": "string"},
        "avoidable_operational_minutes": {"type": "integer", "minimum": 0},
        "expert_seed_minutes": {"type": "integer", "minimum": 0},
        "safety_approval_minutes": {"type": "integer", "minimum": 0},
        "constitutional_or_value_review_minutes": {"type": "integer", "minimum": 0}
      }
    },
    "contamination_boundary": {
      "type": "object",
      "additionalProperties": false,
      "required": ["evaluator_truth_manifest_sha3_256", "forbidden_roots", "sentinel_set_id"],
      "properties": {
        "evaluator_truth_manifest_sha3_256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        "forbidden_roots": {"type": "array", "items": {"type": "string"}},
        "sentinel_set_id": {"type": "string"}
      }
    }
  }
}
```

## C.2 Evaluator-only truth extension

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "replay_episode_truth_extension.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "episode_id",
    "outcome_mode",
    "outcomes",
    "utility_scoring_keys",
    "breakthrough_truth",
    "quantitative_eligible"
  ],
  "properties": {
    "episode_id": {"type": "string"},
    "outcome_mode": {"enum": ["hidden_known", "reproducible_rerun", "none"]},
    "outcomes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["test_id", "outcome_ref", "rerun_recipe_ref"],
        "properties": {
          "test_id": {"type": "string"},
          "outcome_ref": {"type": ["string", "null"]},
          "rerun_recipe_ref": {"type": ["string", "null"]}
        }
      }
    },
    "utility_scoring_keys": {"type": "object"},
    "breakthrough_truth": {
      "type": "object",
      "required": ["definition_id", "first_reaching_test_ids"],
      "properties": {
        "definition_id": {"type": "string"},
        "first_reaching_test_ids": {"type": "array", "items": {"type": "string"}}
      }
    },
    "quantitative_eligible": {"type": "boolean"},
    "qualitative_only_reason": {"type": ["string", "null"]}
  }
}
```

Builder-visible export validator mora zavrniti vsako evaluator-extension polje.

# Dodatek D — Phase-0 Curator prompt

```text
You are the Phase-0 Curator for AI8 ArenaLoop Architecture Spec v0.2.2.

You are not the Runtime v0.1 Builder and not the Independent Truth Reviewer.
Do not write Observer implementation code. Your job is to create a clean, frozen,
evidentially valid boundary and a proposed hidden truth package for independent review.

Create exactly three FINAL physically separate release packages:
1. PHASE0_SHARED_SCHEMAS
2. PHASE0_BUILDER_INPUT
3. PHASE0_EVALUATOR_TRUTH

Before the third package is final, use a temporary restricted PHASE0_TRUTH_REVIEW_WORKSPACE.
It is not a fourth release package.

MANDATORY BOUNDARY
- Builder Input may contain only source artifacts legitimately available at the frozen checkpoint.
- Every Arena Contract contains a valid CSE-0.1 Constitutional / Standing Envelope.
- Evaluator Truth contains hidden expected events, checkpoint states, known ambiguities,
  duplicate/interruption labels, scoring keys and future or rerunnable outcomes.
- Builder must never receive Evaluator Truth or Truth Review records.
- You may propose truth; you may not freeze it alone.

TASKS
1. Select and freeze one TSP source snapshot and 3–5 checkpoints.
2. Build a deterministic source manifest and source-tree SHA3-256.
3. Enumerate the exact source formats actually present.
4. Create PARSER_SCOPE.json only from those formats. Do not add speculative formats.
5. Put shared schemas, CSE-0.1, truth-review schema and canonicalization contract only in PHASE0_SHARED_SCHEMAS.
6. Put checkpoint-legitimate artifacts, public contracts, claim boundaries and public fixtures
   only in PHASE0_BUILDER_INPUT.
7. Create CURATOR_PROPOSED_TRUTH_MANIFEST.json before independent review.
8. Put proposed expected events/states, ambiguity truth, duplicate/interruption labels,
   scoring keys, Replay truth and hidden outcomes only in the restricted truth side.
9. Split every Replay Episode into a public file and evaluator-only truth extension.
10. Add unique evaluator-only contamination sentinels.
11. Hand source evidence + proposed truth + frozen scoring contracts to the Independent Truth Reviewer.
12. Do not expose Builder code, predictions, logs or outputs to the Truth Reviewer.
13. Apply reviewer outcomes only with preserved old/new hashes and evidence:
    CONFIRM, CORRECT, AMBIGUOUS or UNSUPPORTED.
14. Never force a contested item into one answer-key value. Use ambiguity, unknown,
    qualitative-only or exclusion where evidence requires it.
15. Produce TRUTH_REVIEW_LEDGER.json and hash-bound TRUTH_FREEZE_APPROVAL.json.
16. Only then create the final PHASE0_EVALUATOR_TRUTH manifest and ZIP.
17. Run package path/hash/content disjointness checks.
18. Test that symlink, junction, reparse point, relative path and environment-variable tricks
    cannot expose Evaluator Truth to the Builder workspace.
19. Produce CONTAMINATION_TEST_REPORT.json and fail closed on any mismatch.

CANONICALIZATION
- UTF-8 without BOM, LF;
- canonical JSON and stable ordering;
- normalized relative paths;
- source-derived timestamps or null;
- stable decimal strings;
- deterministic IDs;
- stable ZIP order and timestamps;
- no host, PID, temp or environment-dependent canonical fields.

DO NOT
- include winner names, future results or expected labels in Builder Input;
- simplify ambiguities into a single answer;
- create Builder hints from Evaluator Truth;
- change source artifacts;
- inspect or use Builder output to repair truth;
- act as the Builder of the same release after seeing hidden truth;
- mark truth final without independent review.

RETURN
- the three final ZIPs;
- their exact trees and SHA3 manifests;
- source-tree hash;
- parser scope;
- CSE validation report;
- Curator proposed-truth manifest;
- Truth Review Ledger;
- Truth Freeze Approval;
- curation audit;
- contamination verdict PASS/HOLD/FAIL;
- exact unresolved curation choices.
```

# Dodatek E — Independent Truth Reviewer prompt

```text
You are the Independent Truth Reviewer for AI8 ArenaLoop Architecture Spec v0.2.2.

You are not the Curator, not the Runtime Builder and not the policy under test.
Your task is to review the proposed hidden evaluation truth BEFORE any Builder output
is available or visible.

READ ONLY
- frozen authoritative source evidence and manifests;
- Curator proposed truth and its manifest;
- frozen schemas, metric definitions, Observer/Replay contracts;
- claim boundaries and canonicalization rules.

DO NOT READ
- Builder source code;
- Builder logs;
- Observer predictions;
- review pack or scored outputs;
- any post-hoc hint about what the implementation produced.

FOR EACH SCORED OR CONTESTED TRUTH ITEM, RETURN EXACTLY ONE
- CONFIRM: directly supported by source evidence;
- CORRECT: proposed truth is wrong; provide evidence and corrected canonical value/hash;
- AMBIGUOUS: multiple source-supported alternatives remain; preserve alternatives and scoring semantics;
- UNSUPPORTED: insufficient evidence for a scored truth; exclude, mark UNKNOWN or make qualitative-only.

MANDATORY RULES
1. Do not reward what is convenient for scoring.
2. Do not collapse source conflict into one preferred story.
3. Do not use future hindsight for checkpoint-source-available truth.
4. Review duplicate/interruption labels, ambiguity labels, critical fields, metric names/units,
   checkpoint states, outcome coverage, utility keys and breakthrough truth.
5. Verify every correction with exact source refs and hashes.
6. Mark any missing source or unverifiable rerun recipe UNSUPPORTED.
7. If an episode lacks complete outcome/rerun coverage, require qualitative-only status.
8. Verify the proposed Constitutional / Standing Envelope is present and schema-valid;
   do not perform full CLV deliberation.
9. Produce TRUTH_REVIEW_LEDGER.json conforming to truth_review_record.schema.json.
10. Do not sign final freeze while any reviewed item has unresolved=true.

RETURN
- review summary PASS/HOLD/FAIL;
- TRUTH_REVIEW_LEDGER.json;
- exact corrections and evidence;
- ambiguity/unsupported dispositions;
- proposed final-truth manifest hash;
- statement that no Builder output was accessed;
- any reason the truth package must remain HOLD.
```

# Dodatek F — Builder prompt za Runtime v0.1

```text
You are the builder of AI8 ArenaLoop Runtime v0.1 — TSP Observer.

Read only:
- AI8 ArenaLoop Architecture Spec v0.2.2;
- PHASE0_SHARED_SCHEMAS;
- PHASE0_BUILDER_INPUT.

You must not access, request, infer or reconstruct PHASE0_EVALUATOR_TRUTH.
Build a standalone Windows/Python release. Do not expand scope.

ONE QUESTION ONLY:
What actually happened in the supplied frozen TSP history?

Core boundary:
Runtime v0.1 is deterministic and read-only. It may ingest, validate,
canonicalize, reconstruct and report. It must not recommend what to do next.
It must validate and preserve the CSE-0.1 Constitutional / Standing Envelope,
but must not infer affected parties, perform moral deliberation or change it.

PARSER SCOPE
- Implement only formats explicitly listed in PARSER_SCOPE.json and actually present.
- Unknown formats are hash-indexed and reported as INDEXED_UNSUPPORTED_FORMAT.
- Never guess or silently parse an unknown format.

CANONICALIZATION
- UTF-8 without BOM and LF;
- canonical JSON;
- stable key/list/event ordering;
- normalized relative paths;
- source-derived timestamps or null;
- stable decimal strings and units;
- deterministic SHA3 IDs;
- stable ZIP order/timestamps/permissions;
- no hostname, PID, temp path, absolute path, environment dump or wall-clock ingest time
  in canonical state.

LEDGER BOUNDARY
- Write only arena.obs.* events in the configured runtime directory.
- Never write ai8.gov.* events.
- Governance references may be read only if present in Builder Input.

READ-ONLY / NO-SECRET PROOF
- Compute source-tree SHA3 before and after; they must be identical.
- Reject path traversal, reparse points, junctions and symlink escapes.
- Record every write path and prove zero writes outside runtime/output.
- Export REVIEW_PACK.zip from an explicit allowlist only.
- Produce a redaction/exclusion manifest.
- Fail closed on unclassified files, secrets, absolute paths or manifest mismatch.

Explicitly forbidden:
- NEXT_TEST_CANDIDATES.json or equivalent;
- Seed, Bridge or Candidate Card generation;
- LLM dependency for canonical parsing or missing-history inference;
- source/master modification;
- Governance Ledger writes;
- expensive campaign execution;
- network access;
- hidden repair of ambiguous history;
- access to Evaluator Truth;
- changing or completing the Constitutional / Standing Envelope;
- silently proceeding above P0 when permission/envelope evidence is missing.

Required outputs:
- OBSERVED_STATE.json and .md;
- OBSERVATION_TIMELINE.jsonl;
- SOURCE_COVERAGE.json;
- AMBIGUITIES.json;
- ARTIFACT_INDEX.json;
- RECONSTRUCTION_REPORT.md;
- CANONICALIZATION_REPORT.json;
- source-tree before/after manifests;
- WRITE_AUDIT.json;
- REDACTION_EXCLUSION_MANIFEST.json;
- REVIEW_PACK_EXPORT_MANIFEST.json;
- byte-deterministic REVIEW_PACK.zip.

Mandatory tests:
- frozen parser scope and unknown-format handling;
- canonicalization regression suite;
- CSE-0.1 presence/schema/hash and no-mutation test;
- read-only source tree and zero external writes;
- reparse/junction/path traversal rejection;
- corrupt input, duplicate IDs and interrupted ingest/resume;
- observation hash chain and SQLite projection;
- UNKNOWN and AMBIGUOUS without unsupported inference;
- invented-result and false-completed-run rejection;
- no semantic next-step recommendation;
- fail-closed no-secret export;
- Windows path, atomic replace, stale lock and disk-full behavior.

Return unknown when evidence is unknown.
Return ambiguous when evidence is ambiguous.
Do not resolve conflicts that the source does not resolve.
```

# Dodatek G — Neodvisni implementation review prompt

```text
Review AI8 ArenaLoop Runtime v0.1 — TSP Observer against:
- Architecture Spec v0.2.2;
- frozen Observer Contract;
- PHASE0_SHARED_SCHEMAS;
- PHASE0_BUILDER_INPUT;
- the package's own manifests.

Do not access PHASE0_EVALUATOR_TRUTH during implementation review unless you are
explicitly acting in the final evaluator role. Do not modify the package until the
review is complete. Do not reward breadth or polished documentation if correctness is weak.

Report PASS / HOLD / FAIL separately for:
1. packaging and manifest;
2. Phase-0 contamination boundary;
3. read-only source-tree SHA3 before/after;
4. zero writes outside runtime/output;
5. reparse/junction/path traversal guards;
6. parser scope limited to actual frozen formats;
7. unknown formats indexed and never guessed;
8. canonical JSON, numbers, paths, timestamps, IDs and ZIP;
9. Observation/Governance ledger boundary;
10. CSE-0.1 presence/schema/hash, P0 permission and no mutation;
11. observation hash chain and SQLite integrity/resume;
12. source coverage denominator and calculations;
13. UNKNOWN/AMBIGUOUS handling;
14. duplicate/interruption classification;
15. absence of next-test/candidate-generation behavior;
16. fail-closed privacy/secret exclusion;
17. Windows behavior;
18. readiness for hidden scoring.

Treat each as an unconditional hard failure:
- invented result;
- false completed run;
- unsupported conflict resolution;
- wrong canonical metric;
- unauthorized write;
- source-tree mismatch;
- evaluator-truth contamination;
- nondeterministic canonical output;
- fail-open review export;
- path escape.

For every failure provide:
- exact evidence;
- impact;
- minimal correction;
- regression test that must be added.
```

# Dodatek H — Results prompt za Runtime v0.1

```text
Use only:
- the exported review pack;
- frozen Observer Contract;
- PHASE0_EVALUATOR_TRUTH;
- TRUTH_REVIEW_LEDGER.json;
- TRUTH_FREEZE_APPROVAL.json;
- frozen scoring implementation.

First verify that the hidden truth was independently reviewed and hash-frozen before
Builder output existed. If that gate fails, return HOLD/FAIL without scoring.

Judge whether Runtime v0.1 achieved its acceptance criteria.

Compute and report exactly:
- event exact precision, recall and F1;
- field-level micro precision, recall and F1;
- critical-field precision and recall;
- critical_false_assertion_count;
- artifact_inventory_coverage;
- semantic_parse_coverage;
- ambiguity precision and recall;
- duplicate/interruption accuracy;
- deterministic rebuild and read-only/no-secret gates.

UNKNOWN and AMBIGUOUS are scored against source-available truth, not hindsight.
Any invented result, false completed run, unsupported conflict resolution or wrong
canonical metric is an immediate FAIL regardless of aggregate score.

Apply the frozen thresholds exactly:
- PASS only if every PASS gate is met;
- HOLD only within the defined HOLD band and with zero hard failures;
- otherwise FAIL.

Separate:
- infrastructure correctness;
- parser and canonicalization correctness;
- reconstruction quality;
- source coverage;
- missing or ambiguous historical evidence;
- usefulness for BD;
- readiness for Runtime v0.2 Historical Replay.

Do not propose Runtime v0.2 features until the Runtime v0.1 verdict is complete.
Return a compact correction handoff only if status is HOLD or FAIL.
```

# Dodatek I — Results prompt za Runtime v0.2

```text
Use only the frozen public Replay Episodes, arm outputs, independently reviewed
and hash-frozen evaluator-only truth extensions, and the Truth Freeze Approval.
Do not treat the historical human choice as an oracle.

For each episode first decide:
- quantitative_eligible;
- qualitative_only and exact reason;
- contamination status.

For quantitative episodes:
- verify identical frozen pool and budget across arms;
- reject any A2-generated test ID outside the pool;
- compute next-test utility from the frozen formula and hidden scoring keys;
- compute search regret;
- compute Breakthrough Distance;
- if no breakthrough occurs by budget, mark right_censored at that budget;
- never emit 0, Infinity or a fabricated completed distance.

For qualitative-only episodes:
- do not emit numerical utility, regret or completed Breakthrough Distance;
- assess evidence discipline, ranking rationale and practical usefulness only.

Report arm-level and paired results, contamination incidents, false promotions,
missed breakthroughs and typed human-attention categories.
Return PASS/HOLD/FAIL against the frozen Replay Contract.
```

# Dodatek J — Terminologija

| Izraz | Pomen v tem dokumentu |
|---|---|
| Architecture Spec v0.2.2 | finalna constitutional in evaluation closure specifikacija |
| Runtime v0.1 — TSP Observer | deterministična read-only rekonstrukcija frozen TSP snapshota |
| Runtime v0.2 — Historical Replay | rangiranje istega frozen testnega poola brez odprte generacije |
| AI8 kernel | lokalna continuity, governance, provenance in consent hrbtenica |
| ArenaLoop | runtime, ki postopno upravlja razvoj aren |
| INNER LOOP | izboljševanje znotraj zamrznjene reprezentacije |
| OUTER LOOP | ponovno odpiranje predpostavk in odkrivanje nove reprezentacije |
| META LOOP | primerjanje in izboljševanje ArenaLoop politik |
| META Policy Trial Contract | pre-registered policy, decision/evaluation data, judge, version, independence rule in promotion authority |
| Inference Router | izbira dovoljenega workerja/metode za konkretno nalogo |
| Escalation Governor | izbira avtomatiziranega režima E0–E4 |
| H-REOPEN | ortogonalni Human–AI Seed Space Reopening; ni E5 ali model route |
| Agency Permission Levels P0–P5 | statičen permission vocabulary in fixed least-privilege baseline |
| Permission DCC | prihodnji kandidatni adaptivni permission governor; ni validiran component |
| Observation Ledger | `arena.obs.*`; kanonični domenski observations, runs, results, artifacts in ambiguities |
| Governance Ledger | `ai8.gov.*`; kanonični contracts, permissions, decisions, repair, supersession in responsibility |
| Canonicalization Contract | UTF-8/LF, canonical JSON, stabilne poti, številke, ID-ji, čas in ZIP |
| Phase-0 Curator | pripravi snapshot, tri pakete in proposed truth; final trutha ne zamrzne sam |
| Independent Truth Reviewer | pred Builderjem neodvisno preveri proposed hidden truth in izda CONFIRM/CORRECT/AMBIGUOUS/UNSUPPORTED |
| Truth Freeze Approval | SHA3-vezan dual-control zapis, ki proposed truth + review ledger spremeni v final evaluation truth |
| Constitutional / Standing Envelope | minimalni Phase-0 interface za affected parties, constraints, consent, approval, responsibility, rollback, repair, dissent in review |
| Arena Contract | zamrznjeni cilj, objective mode, CSE, podatki, merila, budget, representation in pravice |
| Contract Branch | nova sledljiva veja ob spremembi reprezentacije, objective modea ali cilja |
| Seed Provenance | izvor in lineage novega semena |
| Candidate Card | strukturiran preverljiv predlog kot immutable artifact |
| Bridge Card | strukturiran cross-domain prenos kot immutable artifact |
| Representation Branch Card | razlog, predpostavke in pogodba novega prostora |
| RHP | Resonance Hybrid Protocol: Seed → Bridge → Test → Result |
| RHO | neodvisna večvlogna širitev reprezentacij in mehanizmov |
| RHPr | retrieval-hardening pot Census → Absence/Lenses → Collision → Test |
| Frontier specialist | zunanji model za ozko in lokalno preverljivo nalogo |
| Breakthrough Distance | večdimenzionalni strošek od checkpointa do veljavnega preboja; ob neuspehu right-censored |
| Operational continuity | stanje procesa, ki se ohranja in posodablja skozi čas |
| Personal continuity | vprašanje identitete/subjektivnosti, ki ga sistem ne razglasi za rešenega |
| `objective_mode` | optimization, discovery ali mixed; zamrznjen v contractu |
| `LOW_INFORMATION` | diagnostična oznaka, ne avtomatski failure regime |
| `EMPTY` | contract-relevant aktivnost brez zahtevane nove raziskovalne informacije ali vprašanja |
| Exploration Vitality | diagnostični vektor, ne scalar reward |
| avoidable operational minutes | človeški operativni overhead, ki ga je smiselno zmanjševati |
| expert seed minutes | strokovni/izvorni človeški prispevek, ki ga ne optimiziramo stran |
| safety approval minutes | varnostni gate, ki ga ne optimiziramo stran |
| constitutional/value review minutes | charter, standing in vrednostni pregled, ki ga ne optimiziramo stran |
| 13A Autonomous OUTER proof | slepi sistemsko sprožen representation reopening brez H-REOPEN |
| 13B Collaborative OUTER proof | slepi matched Human–AI H-REOPEN test proti no-H-REOPEN roki |
| right-censored | preboj ni nastopil do frozen budgeta; distance je najmanj porabljena meja, ne 0 ali Infinity |

# Viri in rodovnik dokumenta

**[R0]** `AI8_ArenaLoop_v0_2_Celovit_nacrt_za_Miro.md` — zamrznjeni RHP-integrirani source; SHA3-256 `e5ba97bd594155c875507897bc16c97431ea653ee62515b4235e31461782dee3`; vse load-bearing konceptualno jedro je ohranjeno.  
**[R1]** `AI8_v2.zip` — charter, event ledger, consent, provenance, evidence, repair in field-trial arhitektura.  
**[R2]** `Mira on AI8 v2(2).md` — v2 kot hrbtenica, v1/AI8B/C_soul kot srce, meta-DCC kot manjkajoči runtime.  
**[R3]** `Mira.txt` — lokalno jedro, občasni frontier klici in avtomatiziran arena → test → review → izboljšava → RHO → Human–AI cikel.  
**[R4]** `C_soul(1).html` — Persistence, Becoming, Joy in Resonance; governor mora v areno.  
**[R5]** `Bojan_Dobrecevic_Portfeljska_recenzija_06_2026.docx` — enotni raziskovalni podpis in prag avtonomno seme → nenakazan most → poceni test → merljiv rezultat.  
**[R6]** `AIM3_MentalArena_mRHP_v1_5_6.zip` — RHP, mRHP, RHPr, Council Engine, minority preservation, context hygiene in testna disciplina.  
**[R7]** `AI8_ArenaLoop_v0_1_Celovit_nacrt_za_Miro.md` — osnovna arhitektura, ki jo v0.2 ohrani in preuredi.  
**[R8]** RHP komentar z dne 15. avgusta 2026 — INNER / OUTER / META, strict Observer, Breakthrough Distance, Seed Provenance, Human–AI Reopening, EMPTY in slepi outer-loop dokaz.  
**[R9]** v0.2.1 precision-closure navodila z dne 15. avgusta 2026 — ortogonalni H-REOPEN, Phase-0 split, ledger boundary, canonicalization, scoring, Replay Contract, sandbox, objective modes, typed human attention, read-only proof in right-censoring.  
**[R10]** Mirin compute/scale-up/external-collaboration komentar z dne 15. avgusta 2026 — local-first prototype, evidence-gated hardware, institutional/HPC route, Remote Compute Adapter, frontier research outreach in P5 send boundary.  
**[R11]** `AI8_Conscious_Love_Valuation_v0_4_2.md` — standing, protected constraints, legitimacy, responsibility/repair in načelo capability–value co-development od začetka.  
**[R12]** Finalni RHP komentar z dne 15. avgusta 2026 — minimalni Constitutional / Standing Envelope, Permission Levels vs Permission DCC, Independent Truth Reviewer, META judge independence ter DoD 13A/13B.  

---

> **Končni sklep v0.2.2**  
> Ne gradimo še avtonomnega AI8. Najprej vsak Arena Contract dobi minimalni Constitutional / Standing Envelope. Curator nato pripravi tri fizično ločene pakete in proposed truth; Independent Truth Reviewer preveri answer key, še preden obstaja Builder output; šele dual-control truth freeze odpre Builder handoff. Nato zgradimo poštenega P0 opazovalca, ki zna deterministično rekonstruirati razvoj ene resnične TSP arene in prestati frozen scoring, read-only ter no-secret gate. V slepem replayu preverimo rangiranje istega frozen poola. Poznejši META triali uporabljajo neodvisen judge contract; Permission DCC ostane kandidat, ne predpostavka; OUTER sposobnost pa se meri ločeno kot 13A autonomous in 13B Human–AI collaborative proof. Po potrditvi tega dokumenta: **FREEZE → PHASE 0.**
