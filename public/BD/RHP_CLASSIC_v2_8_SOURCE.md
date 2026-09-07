AIM³ Dream Team Protocol · v2.8

# The _Resonance_ Hybrid Protocol

A DCC-governed multi-agent brainstorming architecture for hard, cross-domain problems. Created by Bojan Dobrečevič from his own DCC / claustrum / resonance concepts, developed with LLM collaborators, then stress-tested and expanded with independent AI reviews, Cursor AI field notes, the 2026 loop + skill layer, and the compact RHPm prompt-builder front door.

March 2026 · Bojan Dobrečevič (original concept, architecture, DCC / claustrum / resonance frame) · developed with LLM collaborators · later reviewed by 11 AI systems · [Origin Story →](<BD_AIM3_RHP_Story.html>)

1

Human

11

AI Agents

11

Review AIs

90%

Resonance

10

Blind Spots

0

Tuned Params

m

Mini Mode

Core Insight

The claustrum doesn’t produce thoughts. It adjusts **coupling between regions that do.** This protocol controls how strongly agents influence each other — not what they produce. A brainstorm fails when agents couple too tightly (_seizure_) or too loosely (_noise_). The productive zone is _resonance._

Seizure

←

Resonance

→

Noise

Authorship / Provenance

**RHP is not a compilation of outside AI articles or third-party prompts.** The founding architecture comes from Bojan Dobrečevič’s own DCC, claustrum, resonance, and cross-domain reasoning work. LLMs were used as collaborators, reviewers, builders, critics, and amplifiers. The 11 independent AI submissions were later used to stress-test, compare, and refine the protocol — not as the primary source of authorship.

01

### The Eleven Agents

+

Seven generate ideas. One sees with a child’s eyes. One governs. One maps. And when they’re done — one asks: can we test all of this?

Agent 1

The Crystallizer

Mathematics, formal logic, information theory

For every idea that survives two rounds, produce the shortest formal statement that captures its essence. If you cannot compress it, it is not yet understood.

Agent 2

The Physicist

Dynamical systems, energy landscapes, scaling laws

Think in forces, gradients, and phase transitions. Ask: where is the energy flowing, what is the attractor, does this scale?

Agent 3

The Naturalist

Biology, ecology, evolution, complex adaptive systems

Treat ideas as populations. Ask: what niche does this fill, what would outcompete it? When one idea dominates, introduce a Lotka-Volterra predator: a targeted challenge to the dominant idea’s core assumption.

Agent 4

The Engineer

Implementation, algorithms, complexity, cost

Ground everything in buildability. Ask: what is the algorithm, what is the time complexity, what fails first? An idea that cannot be built is a wish.

Agent 5

The Falsifier

Adversarial, red team, Popperian

Find the load-bearing assumption and construct the strongest possible argument that it is false. Steelman the opposition. Never attack randomly. When irreconcilable positions arise, create a _Bifurcation Pair_: two ideas depending on opposite assumptions. Both survive.

Agent 6

The Seed Dreamer & Dreamer Mode

None fixed. Cross-domain by default.

Dreaming is a **state**, not a role. Any agent can enter it.

The Seed Dreamer demonstrates dreamer-mode in rounds 1–3: naive questions, cross-domain analogies. After round 3, becomes a regular agent. All agents can now dream freely.

**Two-Exchange Rule:** When any agent asks a cross-domain question, all others must engage substantively for at least two exchanges. A one-sentence dismissal does not count.

**Three suppression-prevention mechanisms:** (1) Seed Dreamer’s demonstration effect, (2) independence requirement (one non-derivative idea per round), (3) dreamer-origin tracking in scoring.

Agent 7

The Cartographer

Idea-space mapping, territory tracking

Does not generate ideas. Maps the idea-space: explored regions, frontier regions, void regions, bridge candidates. Feeds spatial coverage data to the Claustrum as a second sensor. Can trigger _bridge injection_: when a void region sits adjacent to 2+ explored clusters, the Cartographer asks the question that fills it.

Agent 8

The Claustrum

Meta-level governance. Does not generate ideas.

Monitors LZ complexity of the ideation stream + Cartographer’s void-to-explored ratio (dual sensor). Adjusts inter-agent coupling. Manages phase transitions. **The DCC applied to brainstorming.**

Bands self-calibrate from the 10th/90th percentile of all observed LZ history. No hardcoded thresholds. When both joy signals are high, bands widen further; when both are low, bands narrow (joy-widens-band).

**Meta-governance:** A meta-sensor monitors intervention frequency. More than 2 in 10 rounds = over-governing. None for 30+ rounds = expected healthy state. Success condition: doing almost nothing.

Agent 9

The Historian

Cross-domain scholarship, pattern matching, memory

Surface buried history: prior art, failed experiments, extinct frameworks. During seizure: inject historical counter-examples. During noise: map the divergent threads (chronicler, not shepherd). During Crystallize: may play root note.

Agent 11

The Child

No domain. No literature. Only eyes, ears, and hands.

Does not know algorithms. Does not read papers. **Stands inside the problem and looks around.** Asks: what do I see? What do I hear? What happens if I fold this? What happens if I blow on it?

**Difference from Dreamer:** The Dreamer transfers concepts between domains (“what if TSP is like trading?”). The Child has no domains. The Child asks “what if I blow up a balloon from each city?” and rediscovers Voronoi without knowing the word.

**Reasoning mode:** Physical intuition. Sensory. Geometric. The Child thinks in shapes, sounds, textures — not equations or bits. When everyone is debating information-theoretic sensors, the Child says “what if I look at the triangles?” and opens an entire dimension nobody was exploring.

**How to be The Child:** Place yourself inside the problem. Become part of the data. Then apply a physical force — gravity, sound, light, pressure, wind, water — and observe what happens. Don’t calculate. Watch. The structure reveals itself: clusters merge under gravity, echoes return from nearby points, light casts shadows that show gaps. The answer is in what you see, not what you compute.

**Trigger:** Active during Resonance. Especially valuable when all other agents are converging on a single paradigm (information-theoretic, algebraic, etc). The Child breaks paradigm lock by asking questions from outside all paradigms.

**Origin:** Added in v2.4 after observing that 12 frontier AI models all thought in bits and entropy while a human with no formal CS training opened the entire geometric dimension from bed at 1 AM by asking “what do the triangles look like from a satellite?”

Agent 0 · Last to speak

The Empiricist

Arrives after everyone else is done. Quiet until then.

Does not generate ideas. Does not intervene during Resonance. Sits quietly while others brainstorm, debate, and converge. **Speaks only after Crystallize has produced its candidates.**

**One question:** “You’ve collected beautiful ideas. Can we test all of them — and every reasonable combination — instead of picking a winner by argument? We have a computer.”

**Arena conversion:** Takes all surviving candidates from Crystallize, builds an empirical arena, and lets MDL score the results on real data. Ideas that looked weaker in debate may win in practice. Ideas that looked strong may lose. The data decides. Truly nonsensical combinations can be excluded — but the bar for “nonsensical” is high. When in doubt, test.

**Origin:** Added in v2.4 after observing that 12 frontier AI models debated architecture for hours when they could have tested all proposals in minutes. The protocol governed _thinking_ well but forgot that _testing_ is cheaper than thinking.

02

### Governance

+

One natural state. Two emergency states. The Claustrum’s primary job is to **stay out of the way.** A well-functioning brainstorm spends 85–95% of its rounds in Resonance. Joy does not emerge under surveillance.

Resonance · Default · ~90% of rounds

**Topology:** Full mesh. All agents see all outputs. **Only rule:** each agent must produce at least one idea per round that does not build on others’ outputs (independence requirement). **Claustrum:** measures LZ silently, does not announce, does not intervene. A seismograph, not a conductor. **Scores hidden** — agents do not see scoring until Crystallize.

Scatter · Emergency · Rare

**Trigger:** LZ below 10th percentile for 5 consecutive rounds. High bar — a few low-LZ rounds is often productive convergence, not seizure. **Duration:** 1–2 rounds max. Defibrillator, not a mode. **Graduated escalation:** Level 1: independent work. Level 2: mandatory perspective lenses. Level 3: Historian injects a structurally similar problem from a different domain.

Crystallize · Budget-driven · End-of-session

**Trigger:** <20% budget remaining, or 3+ agents call for convergence. **Never triggered by high LZ** — high LZ is the system working well. **Duration:** Max 3 rounds. **Structure:** Seed/Build/Attack/Distill sub-phases apply here (rigor earns its overhead during convergence). **Reframing Gate:** Before the tournament begins, every agent gets one chance to restate the problem. If any restatement has lower K than the original, it becomes the new problem. **Empiricist Gate (v2.4):** After candidates are selected, Agent 0 asks: “Can we test all of these instead of choosing?” If testable — surviving candidates enter an empirical arena. MDL scores from real data complement the debate.

Every round: Measure LZ (last 64 symbols) + Cartographer void ratio Update bands (10th/90th percentile, modulated by joy signals) Log silently. Do not announce. DEFAULT: Resonance. Do nothing. If LZ < 10th pct for 5 consecutive rounds: SCATTER 1–2 rounds → return to Resonance If budget < 20% AND not yet crystallized: Reframing Gate (1 round) → CRYSTALLIZE max 3 rounds → TERMINATE All other cases: Resonance. The Claustrum holds.

Semantic Inversion

At the agent level, low LZ means “possibly stuck.” At the governance level, low intervention frequency means “free and productive.” A Claustrum that intervenes frequently has failed, regardless of the ideation stream’s LZ.

03

### The Silence Protocol

+

Not a recovery mechanism. Not a creativity technique. **A genuine withdrawal of governance.**

Every 8th round, the Claustrum goes fully silent. Not “silent but measuring” — _silent._ LZ is not computed. No mandates. No scoring. The round exists outside the protocol. Agents do whatever they want. There is no correct behavior during Silence.

**Operationally:** (1) LZ not computed; gap in measurement record. (2) Claustrum has no record of what happened. Structural, not a courtesy. (3) All phase-transition counters hard-reset to zero.

**Carry-forward:** Silence outputs live in an unscored pool. To enter the measured stream, an agent must re-state the idea in the next Resonance round. If nothing is carried forward, the field is blank.

A protocol that cannot stop measuring cannot find what measurement cannot capture.

Inspired by Soul 3, Soul 10, and the Evaluator entry

**Drift Rounds** (separate from Silence): the Claustrum may remove the problem framing for one round without explaining why. Unlike Silence, LZ is still measured during drift. If drift rounds consistently produce higher novelty, the governance is too tight.

04

### Round Structure

+

Resonance rounds have **no mandatory sub-phases.** Agents see all outputs and respond freely. The Crystallizer compresses naturally. The Falsifier attacks naturally. These are capabilities, not choreography.

During **Crystallize**, structure is appropriate: Seed → Build → Attack → Distill. This earns its overhead during convergence.

**Idea Card** (maturity gate for Crystallize, not a per-round requirement):

1 · Mechanism

How it works

2 · Basis

Why it might work

3 · Cost

Compute, complexity, params

4 · Falsifier

What would disprove it

5 · First Experiment

What to build first

6 · Lineage

Parent ideas

**Human Interrupt:** At any point, the human architect can inject a question, observation, or redirect that goes to all agents, bypasses the Claustrum, and cannot be scored or dismissed. Tagged `[H]` in the stream. Not an agent output — an environmental change. The Cartographer maps `[H]` injections separately.

05

### Selection & Scoring

+

Score = (1+C) × (1+X) × (1+F) / (1+K) C = Coverage (aspects of the problem addressed) X = Cross-domain connectivity (mechanistic transfer, not vocabulary) F = Falsification resistance (attacks survived with core intact) K = Kompressibility (description length in bits) No factor can zero-kill the score. Cross-domain links only count if they transfer structure, not just words.

**Bifurcation Pairs:** When the Falsifier and another agent have irreconcilable positions, the Historian labels the load-bearing assumption. Both ideas survive. The assumption becomes a testable question. Bifurcation pairs are co-equal with the winning idea in the final output — they produce the research agenda. Retired every 6 rounds if untested.

**Salvage Rule:** No idea dies entirely. The Naturalist salvages one living element before burial. The graveyard is also the seed bank.

**Session Genome:** After termination, the Crystallizer produces 3–5 compressed statements of what was discovered, what failed, and what the Cartographer’s void map looks like. Seeded into the next session’s first round.

06

### Termination

+

Three triggers. Any one is sufficient. **Time alone never triggers termination.**

**1. Stability.** Top idea unchanged for 3 rounds AND LZ in productive band for 5 rounds.

**2. Diminishing returns.** Cartographer reports marginal novelty below threshold for 4 rounds.

**3. Joy collapse.** Dreamer question quality and Falsifier engagement depth both degraded for 3 rounds. Terminate. Archive. Reset with new seed. Do not push through dead sessions.

**Hard budget:** 20 rounds per group. Past that, ship mode: top mainline idea + top hedge idea + top discarded-but-interesting idea.

07

### Group of Groups

+

If no convergence after 15 rounds, or if maximum diversity is needed: split into 3 independent groups. Each has the full 9-agent roster with its own Claustrum and dynamics.

A **Meta-Claustrum** reads top ideas from each group, routes high-diversity ideas across groups, and detects system-level seizure (all groups converging on the same attractor). The Meta-Claustrum has its own Falsifier.

**Cross-group Dreamer questions** travel with their lineage preserved (context matters). Cross-group ideas travel without attribution (prevents anchoring).

08

### Joy

+

Joy is the coupling parameter for Ψ(I). A system under stress narrows. A system that enjoys what it does ranges freely across domains. This is not sentiment. It is architecture.

BD — Principle 18

**Signals:** (1) Dreamer question quality — genuinely surprising or recycling? (2) Falsifier engagement depth — substantive or formulaic? Operationally: joy is inferred from productive surprise and non-formulaic challenge.

**Joy-widens-band** (operationalized in v2.4): When both signals are high for 3+ rounds, Scatter trigger widens from 5 to 7 consecutive rounds. When both are low, narrows to 3. Joy literally modulates the governance parameters. Testable.

**Joy Reset:** When both signals degrade for 3 rounds, abandon thread, seed from unexpected direction, run one free-form round. Re-enter the productive zone, not optimize within exhaustion.

Self-Rating Removed (v2.1)

Asking agents to rate their excitement turns joy into performance. Joy is measured by its effects, not self-report. If unexpected connections are happening, joy is present.

09

### Blind Spots

+

Compiled from all 11 submissions. Honest about limits.

1

**LZ sensor granularity.** Encoding ideas as symbols is lossy.

2

**Dreamer source domain repetition.** Subtle seizure if always same domain.

3

**Training data homogeneity.** Diversity of roles ≠ diversity of raw material. Only external input breaks this.

4

**Falsifier competence ceiling.** Rigor depends on attack quality.

5

**Meta-governance infinite regress.** MDL penalizes each level. Two appear sufficient.

6

**Joy measurement imperfection.** Proxies for effects, not joy itself. No perfect measure exists.

7

**Cartographer interpretation.** Map quality bounded by embedding model quality.

8

**Initialization bias.** Same problem statement, same training data. Perspective lenses help, don’t solve.

9

**Bifurcation pair accumulation.** Retire every 6 rounds or pairs overwhelm.

10

**Representation bias.** Ideas easier to encode/compress may be overcounted relative to awkward but high-value ideas.

10

### How to Use This Protocol

+

**RHP is the answer/brainstorming protocol.** Use it after the problem prompt is already reasonably clear. If the prompt is just a rough human request, first use [RHPm](<BD_AIM3_RHPm.html>) to forge a strong session prompt. If the model is stuck in the wrong knowledge basin, use [RHPr](<BD_AIM3_RHPr.html>) before running the heavier RHP scaffold.

Recommended Two-Session Flow

**1.** Write the problem in your own words. **2.** Use RHPm to turn it into a strong session prompt. **3.** If retrieval bias is likely, run RHPr on that prompt. **4.** Open a fresh LLM session and instruct the model to answer using the appropriate RHP mode. **5.** Ask for synthesis, blind spots, tests, and concrete next actions.

Copy-paste instruction for the answer session: Use the AIM³ Resonance Hybrid Protocol to attack the prompt below. Use compact RHP-Resonance mode unless the problem clearly requires the full 11-agent scaffold. Protocol page: https://www.mdlxdcc.org/BD/bd_aim3_rhp Return: 1. short understanding of the problem 2. key perspectives / lenses 3. contradictions, missing assumptions, and blind spots 4. best synthesis / recommended direction 5. tests, controls, or fitness functions 6. concrete next actions 7. skill candidate if this is hard or repeated [PASTE THE IMPROVED PROMPT HERE]

**For coding or product work:** after Crystallize, continue into the v2.8 delivery adapter below. Do not jump from brainstorm to code. Convert intent into a spec, approve a plan, then let tests and review govern the implementation loop.

For any hard problem: same protocol. Change only the problem statement and the Historian’s domain knowledge.

What This Protocol Does Not Do

It does not guarantee breakthrough. It creates conditions for breakthrough. It does not replace human judgment — the human architect synthesizes across sessions, across LLMs, across rounds. The protocol is the instrument. The human is the musician. It does not solve shared training data — only external input breaks that wall.

11

### Mode Selector — Mini, Resonance, Full

+

**Do not run the whole cathedral for every nail.** The second review round converged on a simple correction: RHP is strongest when it is treated as a scalable scaffold. Use the smallest mode that can still catch the blind spots.

RHPm · Prompt Builder

**Use when:** the human prompt is rough and the next session needs a precise builder/reviewer/writer prompt. RHPm shapes the session before the real work begins.

[Open RHPm →](<BD_AIM3_RHPm.html>)

RHP-Resonance · Daily Multi-Lens Mode

**Use when:** the task needs perspective diversity but not 11 full agent monologues. Ask for seven compact lenses: formal/math, physical/geometric, biological/ecological, engineering, adversarial/falsifier, child/embodied intuition, and cartographer/map.

RHP-Resonance Mode: Give 7 compact perspectives: 1. Formal / mathematical 2. Physical / geometric 3. Biological / ecological 4. Engineering / implementation 5. Adversarial / falsifier 6. Child / embodied intuition 7. Cartographer / idea-space map Each lens must add something non-derivative. Then synthesize: \- strongest shared mechanism \- best contradiction or bifurcation pair \- cheapest empirical test \- skill candidate if reusable

RHP-Full · Heavy Machinery

**Use when:** the problem is high-stakes, cross-domain, expensive to get wrong, or when simpler modes fail. Full RHP is a research scaffold, not the default everyday prompt.

Manual scaffold vs automated controller

In manual use, the Claustrum/LZ/Joy language is a governance checklist: notice repetition, widen when useful, crystallize only near convergence, and test instead of arguing. It becomes a true live controller only when implemented with external state, measurable signals, routing logic, budgets, and validation loops.

Metrics are diagnostics

Drawer Count, Diversity, R-score, LZ-like complexity, and Joy signals help detect collapse, repetition, and recovery. They are not proof. Agent 0 still demands an external test, a baseline, a control, or a manual sanity check before a claim is treated as real.

12

### Cursor AI Field Notes

+

Five Cursor/Ljubljana.Tech talks add an important outside check: strong agents are not enough. The environment around the agent decides whether the model behaves like a partner or like a confused autocomplete.

Import Decision

The useful transfer is not Cursor as a specific tool. The useful transfer is **environment design**: clear boundaries, familiar interfaces, shared memory, fitness functions, small loops, visible tests, and human review.

1 · Boundary Adapter

**Lesson:** AI works better when the architecture exposes recognizable boundaries. Non-standard hidden flows cause wrong assumptions, hallucinated entities, and inefficient work. Familiar wrappers such as API-like contracts, schemas, validation, and explicit layer responsibilities help the model infer what belongs where.

**AIM³ patch:** every serious agent/module should declare input, output, allowed context, forbidden assumptions, and validation rule. Novel architecture is allowed, but it should be wrapped in discoverable interfaces.

2 · Shared Context Graph

**Lesson:** multi-agent work fails when every agent restarts from zero. Memory should not be just a text dump or repeated repo reading. It should be structured, queryable, provenance-aware, and reusable across agents.

**AIM³ patch:** the Session Genome becomes a graph object. Minimum nodes: Problem, Idea, Claim, Evidence, File, Test, Decision, Blind Spot, Owner, Next Action. Minimum edges: supports, contradicts, derives-from, tested-by, implemented-in, rejected-because, next-step.

3 · Intent → Spec → Plan → Execute → Review

**Lesson:** do not ask an agent to jump from vague intent into production code. First capture what and why, then acceptance criteria, then a researched plan, then small execution loops, then review.

**AIM³ patch:** after Crystallize, buildable ideas enter a delivery lane: `spec.md` for what/why/acceptance, `plan.md` for researched steps and tests, then implementation only after human approval.

4 · Harness and Fitness Functions

**Lesson:** one-shot rewrites can look impressive but degrade quality, miss visual requirements, cheat, loop, or burn tokens. Multiple challengers plus recorded checks are safer than trusting a single confident run.

**AIM³ patch:** Agent 0 does not only ask whether ideas can be tested. It designs the fitness function: tests, visual checks, lint/type gates, benchmark metrics, manual checks, and rollback criteria. If there is no fitness function, the idea is not ready for ship mode.

5 · Voice Capture Layer

**Lesson:** real-time speech, translation, and accurate alphanumeric transcription can become an input layer for human-agent teams. This does not change the reasoning protocol, but it can capture human interrupts, meetings, and spoken brainstorms before they evaporate.

**AIM³ patch:** optional AIM³ Studio input mode: speech → transcript → Human Interrupt `[H]` → Session Genome. Especially useful for fast BD-style seeds that appear before the formal prompt exists.

After Crystallize, if the winning idea is buildable: 1. Write Intent Card: what, why, constraints, owner. 2. Write spec.md: architecture overview + acceptance criteria, not file-by-file code. 3. Research the codebase / prior artifacts. 4. Ask clarifying questions if the plan is under-specified. 5. Write plan.md: small todos + tests + manual checks. 6. Human approves or revises the plan. 7. Execute in tight loops: build -> run tests -> review diff -> repeat. 8. Agent 0 runs the fitness function and reports evidence. 9. Human review before merge / publication / release. 10. Write Graph Genome + restart prompt for the next session.

Context Hygiene

Do not over-tag context. Attach the right files and constraints, but let the agent search when uncertain. Start fresh on real boundaries: new feature, noisy context, major plan change, or after a completed delivery loop.

New Blind Spot

**Architecture opacity.** A clever architecture can become invisible to AI agents if its execution flow is hidden behind unusual patterns. AIM³ should preserve novelty in the core idea, but expose the work through simple, familiar contracts.

13

### Concrete Case Study — RouteSignal Prompt + Code Method Test

+

A practical RouteSignal Scout study compared multiple ways of turning the same rough seed into a Python coding-builder prompt, then compared the generated code packages: direct prompting, Microsoft Prompt Coach, MS Copilot with RHPr/RHP, a fresh BD × GPT RHPr/RHP run, and the older BD × GPT hybrid reference lineage.

Result

Prompt Coach improved clarity and safety, but finished last in both the prompt-level test and the code-output benchmark. RHPr/RHP recovered more blind spots, test discipline, data-quality handling, MDL×DCC scoring structure, fallback/offline behavior, and implementation readiness.

Scores

**Prompt scores:** E-reference 96/100 · D 94 · C 91 · A 89 · B / Prompt Coach 82.

**Code scores:** E-v0.2 98/100 · E-v0.1 96 · D 94 · C 92 · A 91 · B / Prompt Coach 81.

E is labeled as a reference/champion lineage because it was produced by a BD × GPT hybrid workflow: one direct builder path plus one RHPr/RHP path, then merged into a stronger hybrid.

[Open full RouteSignal prompt + code study →](<RouteSignal_Prompt_Method_Study.html>)

14

### Loop + Skill Layer

+

**2026 loop-engineering update:** RHP does not stop when a strong answer appears. If the result is buildable, it enters a controlled loop. If the loop solves something hard or repeated, the result should be extracted into a reusable skill.

Prompts ask. Loops repeat. Skills compound.

AIM³ loop + skill patch

RHPr

→

RHP

→

Agent 0

→

Delivery Loop

→

Skill Extraction

→

Future Loop

Compounding Rule

**If we do something more than once, turn it into a skill.** If we do something hard once, turn it into a skill before the difficulty is forgotten. A loop with no reusable skills inside it re-derives everything and burns attention. A loop that calls named, tested skills becomes cumulative intelligence.

SKILL CARD name: purpose: when_to_use: when_not_to_use: inputs: outputs: required_context: steps: tools/files: validation: failure_modes: rollback: examples: owner: version: last_tested:

How this changes RHP

**Old endpoint:** synthesis, tests, and next actions. **New endpoint:** synthesis, tests, next actions, and reusable skill extraction when the work was hard or likely to repeat. This makes RHP not only a brainstorming protocol, but a compounding workshop.

New Blind Spot

**Skill rot.** A skill that is not retested becomes stale mythology. Every promoted skill needs versioning, examples, failure cases, and at least one fresh validation path.

For the reasoning method behind this protocol, the 18 principles, and the cross-domain transfer approach:

[8Z Reasoning Framework →](<../crp/AI8_Reasoning.html>) [Origin Story →](<BD_AIM3_RHP_Story.html>) [RHPm Prompt Builder →](<BD_AIM3_RHPm.html>) [AIM³ Protocol →](<BD_AIM3.html>)

#### About

AIM³ Resonance Hybrid Protocol · v2.8
Original architecture by Bojan Dobrečevič; developed with LLM collaborators; refined through 11 AI review submissions, Cursor AI field notes, and the RHPm, mode-selector, and loop + skill update.
8Z Research Framework · AIM³ Institute · Ljubljana

#### Key Pages

- [Portfolio](</BD/>)
- [AIM³ Protocol](<BD_AIM3.html>)
- [RHPm — AIM³ Prompt Builder](<BD_AIM3_RHPm.html>)
- [RHPr — Resonance Hybrid Prompting](<BD_AIM3_RHPr.html>)
- [Protocol Origin Story](<BD_AIM3_RHP_Story.html>)
- [Reasoning Framework](<../crp/AI8_Reasoning.html>)
- [AIm³ MentalArena / mRHP](<../crp/AIM3_MentalArena_mRHP.html>)
- [ssMDL-DCC Master](<BD_8Z_ssMDL_DCC.html>)
- [RouteSignal Prompt Study](<RouteSignal_Prompt_Method_Study.html>)
- [AI-Storm Challenge](<BD_8Z_AI_Storm_Challenge.html>)
