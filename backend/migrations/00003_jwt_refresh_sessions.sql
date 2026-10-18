-- +goose Up
-- Existing opaque access tokens are invalidated when switching to JWT sessions.
DELETE FROM sessions;
ALTER TABLE sessions RENAME COLUMN token_hash TO id;
ALTER TABLE sessions ADD COLUMN csrf_hash char(64) NOT NULL;

CREATE TABLE refresh_tokens (
  token_hash char(64) PRIMARY KEY,
  session_id char(64) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_session_idx ON refresh_tokens(session_id);
CREATE INDEX refresh_tokens_expiry_idx ON refresh_tokens(expires_at);

-- +goose Down
DROP TABLE refresh_tokens;
DELETE FROM sessions;
ALTER TABLE sessions DROP COLUMN csrf_hash;
ALTER TABLE sessions RENAME COLUMN id TO token_hash;
