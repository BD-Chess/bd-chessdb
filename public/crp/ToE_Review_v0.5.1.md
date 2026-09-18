# AC–WFP × 8Z — ToE v0.5.1: source continuity and the mass–information seed

**Date:** 18 September 2026  
**Authors:** BD × AI  
**Role:** reviewed addendum to the unchanged v0.5 manuscript; the public HTML incorporates these changes.  
**Status:** source reconciliation, known physics, reproducible arithmetic and exploratory comparisons. No new physical law, particle-capacity measurement, solver campaign or AC-specific result.

## 1. Preserve the question and recover its corpus

BD's `i = E c² = m c⁴` is a relational research seed about mass, energy and information, not an asserted universally applicable bit equation. A useful successor may be restricted to a specified regime. Its validity does not require applying to every scale, particle or information measure. It does require a well-defined observable, independently justified calibration and a prediction that survives equivalent changes of units.

The project's June 21 **AC–WFP v0.5 §8** already distinguishes the original seed from its operational bridges. It develops χ = EL/(ℏc*), the Bekenstein capacity bound, the Margolus–Levitin change-rate bound, Landauer erasure and Schwarzschild saturation. The June council archive demotes χ as a new universal law; this does not invalidate χ as a dimensionless scaling variable. The July living document preserves these distinctions in [§18, Information, energy and action](AC-WFP.html#information-energy-and-action).

The September discussion reconnected some of this earlier work without initially carrying the complete June corpus. The correction is provenance, not a claim of a new derivation. **Every continuing seed should carry its latest source pointer, prior tested formulations, and remaining question.** This protects the seed from both repeated rediscovery and repeated criticism of a formulation that was already superseded.

## 2. Four different meanings of “how many bits?”

1. **A numerical description of energy.** The length depends on a code, a known range, precision, units, exponent and shared model. Around 40 significant binary digits resolve a relative grid of order 10⁻¹² in a fixed normalized range; this is not a universal 40-bit description of an arbitrary energy.
2. **State entropy or storage capacity.** These require an ensemble, distinguishable alternatives and a physical system. A known pure state has zero von Neumann entropy even when its rest energy is nonzero. Capacity is not the actual information in one specified state.
3. **Erasure budget.** In the ideal thermal setting, erasing one unbiased unknown bit costs at least kBT ln 2. The number E/(kBT ln 2) is a conditional ideal reset-budget equivalent, assuming that energy can actually be supplied as work; it is not information already stored in the source of that energy.
4. **Dynamical distinguishability.** The Margolus–Levitin bound depends on energy above the ground of the chosen Hamiltonian, not an arbitrary additive rest-energy constant. It is a limit, not an achieved transition count.

The equation seed cannot be verified by substituting one of these meanings for another after seeing the numbers. These are different promising branches, not competing names for one already known quantity.

## 3. Hydrogen: independent numerical check

Inputs are the NIST 2022 CODATA constants and NIST hydrogen ionization energy [1–2]. We use the mass of neutral protium calculated as mH = mp + me − Eion/c². Rounded results are:

| Quantity | Result | Meaning |
|---|---:|---|
| Hydrogen mass | 1.67353284 × 10⁻²⁷ kg | neutral atom, ground state |
| Rest energy | 1.50409631 × 10⁻¹⁰ J = 938.783075 MeV | includes rest energy |
| Ionization energy | 13.5984346 eV = 2.17870942 × 10⁻¹⁸ J | not the rest energy |
| Bohr radius a0 | 5.29177211 × 10⁻¹¹ m | characteristic Coulomb-model length |
| qSI = numerical value of mc⁴ in the declared SI convention | 1.35181435 × 10⁷ | an index, **not measured bits** |
| B(Erest,a0) = 2πErest a0/(ℏc ln 2) | 2.28209816 × 10⁶ | formal evaluation of the bound's RHS |
| qSI / B(Erest,a0) | 5.92355916 | not a six-percent match |
| Erest/(kB·300 K·ln 2) | 5.23896680 × 10¹⁰ | conditional ideal reset-budget equivalent |
| Eion/(kB·300 K·ln 2) | 758.873 | same operation, different energy budget |

### Why the atom is not thereby a 2.28-million-bit memory

The elementary Bekenstein expression constrains entropy for appropriately bounded complete systems [3]. The Bohr radius is not a hard enclosing surface. In the nonrelativistic 1s Coulomb model, the probability inside a0 is only

`1 − 5 exp(−2) = 0.32332358`.

The atom's wavefunction has a tail outside every finite radius. Confinement, a chosen containment tolerance, field/boundary energy and the definition of entropy matter. Modern quantum-field formulations use appropriately defined relative entropy rather than a naive scalar “bits in a particle” [4]. Consequently the table evaluates a familiar expression at a characteristic length; it does **not** establish the atom's actual capacity, entropy, semantic content, or the bits needed to print its energy.

### Correction to the quoted transition rate

The formal rest-energy substitution gives 2Erest/(πℏ) ≈ 9.08 × 10²³ s⁻¹. For a time-independent Hamiltonian, the actual Margolus–Levitin bound is

`τ⊥ ≥ πℏ / [2(⟨H⟩ − E0)]`.

Adding a constant mc² to H shifts both ⟨H⟩ and E0 equally. A ground-state atom does not cycle through orthogonal internal states at the quoted rest-energy rate; its internal state is stationary. A prepared superposition/excitation or a larger conversion-and-computing apparatus is a different physical system and must be specified [5]. The June project document already uses E−E0 correctly.

## 4. What was checked for named particles and atomic scales

To make the comparison reproducible, define a dimensionless numerical index

`qSI = (m / 1 kg) [c / (1 m s⁻¹)]⁴`.

Its numerical value equals the raw SI product mc⁴. It is not assigned physical bit content. Separately define

`B(E,L) = 2πEL/(ℏc ln 2)`.

B is the RHS of a bound; plugging in an rms radius or wavelength does not establish that the bound's hypotheses describe the particle. An electron is elementary in the Standard Model; protons and neutrons are composite. A Compton wavelength is not a measured particle boundary.

| Object and explicitly chosen scale | qSI | B(Erest,L), formal bit-equivalent RHS | qSI/B |
|---|---:|---:|---:|
| Electron, reduced Compton scale | 7.3582 × 10³ | 9.06472 | 811.741 |
| Proton, reduced Compton scale | 1.35108 × 10⁷ | 9.06472 | 1.49048 × 10⁶ |
| Neutron, reduced Compton scale | 1.35294 × 10⁷ | 9.06472 | 1.49253 × 10⁶ |
| Proton, rms charge radius 0.84075 fm | 1.35108 × 10⁷ | 36.23795 | 372,835 |
| Hydrogen, scale a0 | 1.35181 × 10⁷ | 2.28210 × 10⁶ | 5.92356 |
| Hydrogen, 2s mean radius 6a0 | 1.35181 × 10⁷ | 1.36926 × 10⁷ | 0.98726 |

There is no near-exact match for the electron/proton/neutron under the common reduced-Compton convention. Indeed B = 2π/ln 2 for **every** mass when L = ℏ/(mc); this is an algebraic cancellation, not three measurements.

### A closer, but exploratory, numerical comparison: hydrogen 2s

In the nonrelativistic Coulomb model with an infinitely heavy nucleus,

`⟨r⟩2s = 6a0 = 3.17506326 Å`.

At that characteristic scale, B is **1.29045% larger than qSI**. Finite proton-mass correction makes the discrepancy about **1.34562%**, not smaller. The tiny 2s rest-mass correction changes both expressions by the same factor and does not change their ratio.

The mean radius was inspected during this exploratory search, not selected before the numerical target was known. Other legitimate 2s summaries differ: the outer radial-probability maximum is (3+√5)a0, giving B/qSI ≈ 0.88394; the rms radius is √42 a0, giving ≈ 1.09406. The neighbouring 2p mean 5a0 gives ≈ 0.84409. These alternatives are disclosed rather than choosing only the most favourable one.

The 2s radial density in x = r/a0 is `p(x) = x²(2−x)² exp(−x)/8`. Exact factorial integrals give normalization 1, mean 6 and second moment 42. Its radial function `(2−x) exp(−x/2)` satisfies the s-wave Coulomb equation at energy −Ry/4. These are calculable properties of the selected model, not a new experiment.

**Interpretation:** a numerical proximity has been found in a named state/length convention. It is not an established information identity: the length is a mean rather than a bounding radius, qSI has not acquired an independently measured information meaning, and the comparison was selected exploratorily.

## 5. Why finding the “right mass” cannot explain this comparison

Write explicitly the dimensional normalization hidden by the raw SI-number comparison:

`κ0 = 1 / [(1 J)(1 m s⁻¹)²]`.

Then qSI = κ0 E c². Comparing with B gives

`qSI/B = κ0 ℏ c³ ln 2 / (2πL) = L*/L`.

Here `L* = κ0 ℏ c³ ln 2/(2π) = 3.13461251 Å` in the declared convention. **Energy and mass cancel completely.** At fixed L every mass has the same ratio. The closeness at 2s is equivalent to saying 6a0 is numerically close to this convention-defined length.

Without κ0, the expression `ℏc³ ln 2/(2π)` is **not a length**: it has units kg·m⁵·s⁻⁴. The raw product mc⁴ increases by 10¹¹ when one changes its numerical input units from kg/m/s to g/cm/s, while B does not. Keeping the same dimensional κ0 and transforming it correctly restores the equality across units, but then κ0 is a specified extra conversion factor; its physical origin remains unexplained. Setting its numerical value to one independently in both systems changes the proposed law.

This does not forbid a physical law with a dimensional coefficient. It locates the missing explanatory step. A successor `I = κ E c²` can be physically meaningful if κ and I are independently defined. Choosing κ from the desired match is calibration, not confirmation. The bare c⁴ power alone is not an invariant result.

## 6. What can survive as a restricted research hypothesis?

The strongest known operational relation is

`B(E,L) = (2π/ln 2) EL/(ℏc) = (2π/ln 2) L/λ̄C` for E = mc².

At fixed L, the **upper-bound expression** is linear in E. This does not prove that the actual entropy of every system grows linearly with E or saturates the bound. At gravitational saturation a different regime relates energy and radius, producing the familiar area law. The seed's useful direction is the coupled mass–energy–information–geometry question, not an already verified coefficient.

A narrow correspondence could become valuable even without universality. Freeze the information observable, physical preparation, size definition, domain and calibration **before** choosing the successful case; derive a dimensionless invariant; then predict an unused neighbouring state, perturbation or ratio. A second successful consequence not used to choose those ingredients is more informative than searching many masses and radius conventions for one match.

For example, if a proposed capacity mechanism operates in a declared family, the normalized quantity `η = I ℏc ln 2/(2πEL)` is dimensionless. The usual bound constrains η under its own assumptions; it does not predict its value or saturation for atoms. A new mechanism would need to predict η, or an independently motivated relationship among η values, rather than simply reproduce the known RHS.

## 7. Claude review: adopted, refined, left open

| Review point | Action in v0.5.1 |
|---|---|
| Recover June §8 provenance | Adopted; linked to the living public §18 and distinguished from September integration. |
| Show rates rather than counts alone | Adopted; recalculated from the archived report, with all denominators and no new p-value. |
| Mark the physical evidence horizon | Refined: no new physical-core result beyond the available July evidence is claimed; this is not a claim that no later work exists. |
| Name a place to measure PC−CQ | Adopted as a specified finite Ω-neutral closure target, planned rather than already executed. |
| Transfer evaluation hygiene | Refined: audit and reuse the existing June/July machinery; add missing gates, do not claim its prior safeguards were absent. |
| Selection is the only architecture-changing gap | Not adopted as an exclusive claim. Quantum reconstruction, dynamics, local perspective/recovery and AC discrimination also remain open. |
| Hydrogen capacity, ML rate and “six-percent” wording | Corrected as in §§2–5; no measured atom capacity or rest-energy clock claimed. |
| One restricted match could matter | Accepted as a research criterion; the present numerical proximity does not yet satisfy it. |

## 8. Archived rates: sensitivity and specificity are not the same

The July 21 Rich3 multiday archive has 384 structured and 192 matched-null systems. Its “wins” count includes null wins. Structured wins below are `total wins − null wins`. A codebook is a sensitivity view of the same system, not a new independent system.

| Mechanism | Structured | Null | Structured/null rate ratio |
|---|---:|---:|---:|
| MPRC2_FULL | 37/384 = 9.64% | 8/192 = 4.17% | 2.31× |
| MPRC2_NON_TEMPORAL | 40/384 = 10.42% | 11/192 = 5.73% | 1.82× |
| ENVELOPE_MPRC_SYNERGY | 11/384 = 2.86% | 9/192 = 4.69% | 0.61× |
| SINGLETON | 81/384 = 21.09% | 47/192 = 24.48% | 0.86× |
| LEC_PROPOSAL_ONLY | 0/384 = 0% | 3/192 = 1.56% | 0× |
| MSR2_FINITE_PROXY | 0/384 = 0% | 3/192 = 1.56% | 0× |

These descriptive ratios are not significance tests, causal effects, confirmation probabilities or a new promotion gate. They support a better-framed development question: more wins do not necessarily mean greater structured-system specificity. FULL's lower raw coverage and higher descriptive ratio motivate a temporal-identity comparison; they do not establish its mechanism.

The inherited **secondary max-statistic p = 1.0** is retained and **is not a p-value for this newly displayed rate ratio**. Intervention remains RESERVED_UNEARNED, and status remains DEVELOPMENT_ONLY_NOT_CONFIRMATION / AC0 / NOT_ARENA_0A. No solver or arena was rerun here.

## 9. A named measurement target for the exact bridge

**Target: Ω-neutral finite closure bench, EPC axis T/I precursor.** Extend the four-state known-answer fixture on ToE.html to a declared family of finite controlled Markov systems, including coarse-closed positives, hidden-difference negatives and observationally identical intervention twins.

For a fixed candidate reduction C and allowed action a, measure

`εa = max_x TV((Pa C)[x,:], (C Qa)[x,:])`.

Fit or select C and Qa using only the declared training information. Evaluate independent initial microstates, held-out transition realizations and common action sequences; compare against random partitions and matched simpler reductions. Keep recovery as a separate axis. Known-answer examples with exact matrices verify ε = 0 or a specified nonzero lower bound before any learned-model claims.

For a uniform one-step error ε and a common open-loop action sequence, the finite bound is `min(1,tε)`. It does not automatically cover policies using hidden microstate information or quantum channels. A later Ω-MSP channel toy needs a separately typed quantum reduction/recovery and norm. An MSTD pyramid requires its own micro/coarse update dictionary and metric. No MSTD or physical-core experiment is implied by displaying this plan.

## References

[1] NIST, 2022 CODATA complete constants: https://physics.nist.gov/cuu/Constants/Table/allascii.txt

[2] NIST, Hydrogen elemental data: https://physics.nist.gov/cgi-bin/Elements/elInfo.pl?element=1

[3] J. D. Bekenstein (1981), Universal upper bound on the entropy-to-energy ratio for bounded systems. https://doi.org/10.1103/PhysRevD.23.287

[4] H. Casini (2008), Relative entropy and the Bekenstein bound. https://arxiv.org/abs/0804.2182

[5] N. Margolus and L. B. Levitin (1998), The maximum speed of dynamical evolution. https://arxiv.org/abs/quant-ph/9710043

[6] R. Landauer (1961), Irreversibility and Heat Generation in the Computing Process. https://doi.org/10.1147/rd.53.0183

[7] B. C. Geiger and C. Temmel, Lumpings of Markov chains, entropy rate preservation, and higher-order lumpability. https://arxiv.org/abs/1212.4375

Project sources: AC–WFP June v0.5 §8; June council full audit; July V4-DRAFT.6 §18; July 21 Rich3 archived multiday summary; public ToE v0.5 and its preserved September source package. These identify prior project content and development evidence, not external endorsement.
