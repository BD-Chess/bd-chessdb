-- Explicit operator migration only; application startup never runs this file.
-- Use a private server database role. Do not expose this table through a public API.
CREATE TABLE IF NOT EXISTS dualframe_operator_ledger (
  ledger_id text PRIMARY KEY CHECK (ledger_id = 'dualframe-operator-v1'),
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object'),
  revision bigint NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- No policy, users, monetary allowances, or reservations are seeded.
