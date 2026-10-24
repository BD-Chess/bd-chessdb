# CLI Loops public status export

The public page shows published snapshots, not a live connection to the listener.
`tools/export-cli-loops.py` opens the operator-supplied journal using SQLite
`mode=ro`, `query_only=ON`, and one consistent read transaction. It does not import
listener code, inspect ACTIVE, read requests or turn files, traverse PRIVATE,
start a listener, call a model, or install a scheduled task.

Only four explicitly approved short job IDs in `APPROVED` can be updated. Titles,
summaries, selected events and next steps stay editorial in
`public/AI8/cli-loops-data.json`. New jobs require an explicit editorial review and
addition to that allowlist. Runtime JSON is parsed locally; only validated mode,
effort enums and accumulated work seconds are copied. Session details, bodies,
paths, Drive IDs, emails and all other runtime data are discarded.

Exported fields: short public ID, executor state, presentation state, mode/RHP,
confirmed turn count, accumulated active seconds at the last checkpoint,
next author, requested/client-reported effort, observation time. The next author
follows the current two-author protocol; a future multi-seat protocol requires
review before exporting. `null` reported effort means the client did not confirm
it. `VALIDATED` is shown as queued. `READY_NEXT`/`STARTING` remain in progress.
Only COMPLETE is shown as complete; partial, paused and uncertain states retain
their own labels. Queue waiting is excluded from active work.

From a clean checkout, using CMD (replace the journal placeholder locally):

```bat
py -3 tools\test-export-cli-loops.py
py -3 tools\export-cli-loops.py --journal "<absolute journal.sqlite path>"
```

The exporter prints `CHANGED`, `UNCHANGED` or `THROTTLED`. It writes atomically,
refuses concurrent editorial changes, and has no throttle override: at least 15
minutes must have passed since the previous export. Observation time alone never
triggers another export. An error leaves the feed intact and emits no private
source details. The source journal is never modified.

When `CHANGED`, review the public diff, run the small syntax/boundary checks, then
commit only the feed on main and push through the existing Pages/Netlify path:

```bat
node --check public\AI8\cli-loops.js
git diff -- public/AI8/cli-loops-data.json
git add public/AI8/cli-loops-data.json
git commit -m "Refresh approved CLI loop status snapshots"
git push origin main
```

There is no automatic commit/push or scheduler. Repeated local invocations can
automatically extract status, but publishing remains an explicit reviewed step.
The page checks for a newly published feed every three minutes while visible.
An old snapshot must never be interpreted as proof that a job is still running.

DGTE's four-turn loop produced a local reviewed HTML file. At this release the
public DGTE page still contains an older version, so no product link claims that
the LOOP output is deployed. The S option is disabled until installation is
confirmed separately.
