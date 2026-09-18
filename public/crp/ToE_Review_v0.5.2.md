# ToE review 0.5.2 — From a quantum-cell seed to local access

**BD × AI · 18 September 2026**  
**Role:** dated scientific addendum to `ToE.html`, candidate synthesis 0.5.  
**Classification:** known mathematical ingredients, a conditional operational corollary, and an open physical-selection question. **Not a new experimental result, an elementary-particle bit inventory, or a completed ToE.**

This addendum complements, rather than overwrites, `ToE_v0.5.md` and `ToE_Review_v0.5.1.md`. Publication status belongs to the release receipt; the existence of this file alone does not mean a deployment occurred.

## 1. What the seed now asks

BD's seed — “about nine bits per quantum,” softened to “up to about ten” — is preserved as a research question about a physically selected local information budget. It is not treated as a finished equation that all successful models must reproduce.

The useful distinction is between **a particle count**, **a local state relative to a reference**, and **information recoverable in a specified preparation-and-reading task**. A number obtained by setting a dimensionless parameter to one does not show that nature selects that value.

The June AC–WFP information–energy–action bridge already used `ER/(ℏc)` and kept capacity, entropy, rate and semantic information separate. RSE treated information as distinguishability within an algebra and state. This review reconnects those ingredients to a defined coherent-state construction; it does not claim to have newly discovered Bekenstein's coefficient.

## 2. The local object and the theorem being used

Work in the **free real scalar Klein–Gordon setting**, in 3+1 dimensions for definiteness. Choose one spatial region `B` at time zero, its associated local algebra `A(B)`, and the restricted vacuum reference `ω₀`.

For a real KG solution `Φ` with appropriate smooth Cauchy data supported in `B`, write `ωΦ` for the associated coherent state in the matched standard-subspace/Weyl construction. Its local Araki relative entropy is identified with the wave-entropy functional:

[
D_B(omega_PhiVertomega_0)=S_{m wave}(Phimid B).
]

The general coherent-state correspondence is in Ciolli–Longo–Ruzzi, Theorem 4.5 [2]. The wedge results of Longo [3] and Casini–Grillo–Pontello [4] are related anchors, not substitutes for the general region statement.

Hollands–Longo–Morsella [1], Proposition 3.1, supplies the supported-wave bound. With units restored consistently,

[
D_B(omega_PhiVertomega_0)
leq rac{2pi R E_Phi}{hbar c}.
]

Here **`R` is half the minimum slab width containing `B`**. For a spatial ball it equals the radius. It is not automatically a Compton wavelength, the period of a carrier wave, or an RMS packet width. **`EΦ` is the matching energy functional in the cited theorem.** The support and regularity assumptions matter: non-supported data require separate treatment of the boundary terms.

`D_B` is dimensionless relative entropy in **nats**. It is not the spectral operator `D` used elsewhere in Ω-MSP, and it is not a count of hidden binary memory elements. Division by `ln 2` changes the information unit to bits.

## 3. A conditional operational corollary

Declare a **finite classical ensemble** `{pₓ, ωΦₓ}` in the **same** region `B`, with the same vacuum reference and the same field/Weyl convention. Every codeword satisfies the previous supported-wave assumptions. Define

[
ar E=sum_xp_xE_x.
]

Restrict readout to the declared local algebra. For a finite-output local measurement `M`, let `Pₓ=M(ωΦₓ)`, `Q=M(ω₀)`, and `P̄=ΣₓpₓPₓ`. Assume the relevant relative entropies are finite, as ensured here by the stated finite-energy bound.

The classical ensemble/reference identity gives

[
I(X;Y)ln2
=sum_xp_xD(P_xVert Q)-D(ar PVert Q).
]

Dropping the nonnegative last term and using data processing gives

[
I(X;Y)ln2
leqsum_xp_xD(P_xVert Q)
leqsum_xp_xD_B(omega_{Phi_x}Vertomega_0).
]

Apply the supported-wave bound to each codeword, then take the supremum over the declared local measurements:

[
oxed{
I_{m acc}
leq rac{1}{ln2}sum_xp_xD_B(omega_{Phi_x}Vertomega_0)
leqrac{2pi Rar E}{hbar cln2}.
}
]

The first inequality is the familiar local accessible-information bound also displayed by Hayden–Wang, equations (2.3)–(2.4) [5]. The derivation can be stated in relative-entropy language without subtracting separately divergent local von Neumann entropies.

**The contribution here is an explicitly typed synthesis of known results, not a new information-theoretic law.** Finite numerical examples check implementation consistency; they do not establish the continuum field-theory theorem or its physical applicability.

The quantity above is a bound on accessible mutual information for this preparation ensemble and measurement class. It is not a claim that a channel attains the bound or that arbitrarily many entangled uses obey the same unqualified capacity formula.

## 4. The number and what remains open

The numerical specialization is

[
rac{2pi}{ln2}=9.064720283654388ldots.
]

Thus, **if** the declared ensemble satisfies `RĒ/(ℏc) ≤ 1`, this corollary gives `Iacc ≤ 9.06472028 bits`. A ten-bit right-hand-side budget corresponds to `RĒ/(ℏc) ≤ 10 ln2/(2π) ≈ 1.10317800`.

These are conditional consequences, not evidence that all quanta satisfy that restriction. The original research target is still open: **does a non-arbitrary physical mechanism select such a useful local regime?** A coherent excitation normally has indefinite occupation number; the coherent-state label does not make it an exactly-one-particle Fock preparation.

### Explicit remaining normalization check

The mathematical statement uses **matched conventions throughout**. Before attaching a laboratory energy in joules to a particular preparation, the field normalization, symplectic inner product, Weyl displacement and energy functional must be matched to that preparation. Neither the review loop nor this release claims to have completed that independent calibration.

This is a bounded next task, not a reason to conflate wave entropy with an unrelated classical proxy or to deny the known coherent-state correspondence. Any future numerical realization must record the convention, units and source equations, and must not tune the radius or normalization after inspecting the desired nine-bit value.

## 5. Resources and counter-pressure

The ensemble, local algebra, measurement access and additional resources are part of the claim. An extra message-bearing side system, unrestricted joint access outside `B`, or a changed entanglement-assisted communication task is not silently included. A success-conditioned information figure needs its success probability and complete outcome accounting; it cannot simply replace the unconditional quantity above.

Tentrup et al. [6] reported **10.5 bits per detected photon** using a large spatial alphabet. This rules out an unrestricted ten-bit communication ceiling based on particle number alone. It is not the same resource-constrained preparation-and-reading task as the one defined here.

The finite species-reference example, logarithmic/linear crossover, spin multiplicity and Planck-scale numerical comparisons remain in research continuity. In particular, the proposed simple crossover is withdrawn; this release does not repurpose its failure as evidence for another speculative model. General relative-entropy positivity implies `ΔS ≤ ΔK`, not the unconditional inequality `D ≤ ΔK`.

## 6. Why it belongs in AC–WFP

The whole-first programme asks which local descriptions preserve relevant structure and which differences a local viewpoint can access. This construction supplies one sharply defined **example of local distinguishability and reading**, conditional on an already specified quantum field theory.

It does **not** derive that field theory, select the actual world, establish AC or CFH, prove P=NP, or identify consciousness with entropy. The tools and question become more precise without transferring evidence between those lanes.

**Slovenski povzetek.** Seme o približno desetih bitih je zdaj povezano z določeno nalogo lokalne priprave in branja. V navedenem prostem skalarnem modelu uporabimo vakuumsko relativno entropijo koherentnega stanja in pogojno omejimo dostopno klasično informacijo. Število 9,06472 dobimo pri deklariranem proračunu `RĒ/(ℏc)=1`; naravna izbira te skale in laboratorijska normalizacija ostajata odprti. To ni univerzalni inventar bitov vsakega kvanta.

## 7. Release and evidence boundaries

The public section follows GPT R3 §4A/4B, accepted by Claude R3, with added definitions and resource caveats. The review exchange is a provenance trail, **not independent experimental replication**. The HTML adds bilingual section 12A and a status-ledger entry; previous ToE branches and the July arena evidence remain intact.

No T-A* run on the real 128-state dataset or Q-CELL campaign was performed for this release. The separate T-A* code/config review does not establish complete-package readiness while dependency/data artifacts are missing from its stated delivery tree. No such run is needed to publish this conditional mathematical explanation.

## References and exact use

1. S. Hollands, R. Longo and G. Morsella, *Bekenstein's bound for wave packets*, arXiv:2602.03606v1 (2026), §2.2 and Proposition 3.1. <https://arxiv.org/html/2602.03606v1>
2. F. Ciolli, R. Longo and G. Ruzzi, *The information in a wave*, arXiv:1906.01707, Theorem 4.5 (coherent-state correspondence), Theorem 5.1 (wedge application). <https://arxiv.org/abs/1906.01707>
3. R. Longo, *Entropy of coherent excitations* (2019), arXiv:1901.02366. <https://arxiv.org/abs/1901.02366>
4. H. Casini, S. Grillo and D. Pontello, *Relative entropy for coherent states from Araki formula* (2019), arXiv:1903.00109. <https://arxiv.org/abs/1903.00109>
5. P. Hayden and J. Wang, *What exactly does Bekenstein bound?*, arXiv:2309.07436v3, equations (2.3)–(2.4), with separately stated encoding/decoding resource domains. <https://arxiv.org/html/2309.07436v3>
6. T. B. H. Tentrup et al., *Transmitting more than 10 bit with a single photon*, Optics Express 25 (2017), arXiv:1609.04200. <https://arxiv.org/abs/1609.04200>

These authors establish their own results, not endorse AC–WFP or the ontological interpretation of BD's seed.
