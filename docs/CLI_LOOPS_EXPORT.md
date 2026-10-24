# CLI Loops public status and command builder

The page shows published snapshots, not a direct listener connection.
The exporter reads SQLite in read-only mode and the bounded typed USAGE.json
sidecar. It never reads PRIVATE, turn bodies, credentials or request content,
and never starts a model or listener.

Six approved short IDs and two exact historical aliases bind the eight existing
published debates. New run content requires editorial approval. Text, selected events
and role contribution findings remain curated in the public feed.

Current discussions use one detail panel, a 1 / N counter and left/right arrows.
The default view is Current; archive links still open their selected debate.
Zero discussions shows 0 / 0, and one discussion disables both arrows. Selection
survives refresh by public ID; previous/next wrap around without auto-advancing.
The archive keeps its list. Capacity is shown separately (HOME: occupied / limit),
so a single active debate is 1 / 1, not five fictional discussions.

Beside the read-only journal, an optional 8zlistener.status.v2 listener_status.json
provides the exact admitted request_ids and host capacity. The exporter copies
only typed host/capacity/time fields. It does not discover unapproved jobs by SQL
state. Leased unreviewed runs get stable hashed public aliases, generic titles
and numeric status in current_debates; their topics and turn bodies stay private.
Reviewed active entries are marked current, without duplicating their usage.
Exporting one host preserves the other host's current snapshot. Stopped listeners
clear their own current selection. Current counters cover returned calls only;
the in-flight call is not yet included. These are published observations, not
a real-time monitor, and retain their source observation time.

Only validated enums, numbers and generated aliases are exported: state, mode, confirmed turns,
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
