# CLI Loops public status and command builder

The page shows reviewed published snapshots, not a direct listener connection.
The exporter reads SQLite in read-only mode and the bounded typed USAGE.json
sidecar. It never reads PRIVATE, turn bodies, credentials or request content,
and never starts a model or listener.

Six approved short IDs and two exact historical aliases bind the eight existing
published debates. New runs require editorial approval. Text, selected events
and role contribution findings remain curated in the public feed.

Only validated enums and numbers are exported: state, mode, confirmed turns,
active seconds, effort, S/FullRHP/DEEP flags, 2/4/6 seats, phase and next seat.
Only COMPLETE is complete. Unknown effort and missing usage remain unknown.
Usage is a numeric whitelist by provider, seat and phase: no private identifiers.

Codex resume counters use one cumulative high-water value per native session.
Claude counters are per invocation, including cache read/write input. Cached
input and reasoning are subsets, never added again. Partial sums are measured
lower bounds, not exact bills. Global sums cover only the displayed debates.
Historical recovery adds sidecars without rewriting original evidence. Future
0.4 calls also meter failures, repairs and build/review calls when usage exists.
Missing counters are not zero.

The command builder uses the shared release cli-loops-command-spec.json. Basic
controls remain visible; build target, activation and budgets are collapsible.
It previews/copies commands only; it never submits jobs. Reset keeps the topic.
HOME supports 0.4 after verified activation; WORK needs its first local bootstrap.
VM remains unavailable.

Minimal CMD checks:

    py -3 tools\test-export-cli-loops.py
    node tools\test-cli-loops-command.cjs
    py -3 tools\export-cli-loops.py --journal "<absolute journal.sqlite path>"

Export writes atomically, refuses concurrent editorial changes and retains the
15-minute throttle. Observation time alone never triggers export. There is no
automatic commit/push or scheduled export. Review the diff and use the existing
Pages/Netlify GitHub pipeline. The visible page polls the published feed every
three minutes; an old snapshot is not evidence of a currently active run.
Product deployment remains separate from debate completion.

0.4.1: host default is 5 concurrent DIFFERENT debates, one journal writer. Turns inside each debate stay serial. CAPACITY is a host control, separate from request budgets.
