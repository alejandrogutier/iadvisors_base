-- Bootstrap inicial para Aurora PostgreSQL (entorno limpio)
-- Ejecutar con psql sobre la base objetivo, por ejemplo:
-- psql "$PG_CONNECTION_STRING" -f server/scripts/bootstrap_aurora.sql

BEGIN;

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  assistant_id TEXT NOT NULL,
  vector_store_id TEXT NOT NULL DEFAULT '',
  model_id TEXT,
  knowledge_base_id TEXT,
  knowledge_base_status TEXT,
  guardrail_id TEXT,
  kb_data_source_id TEXT,
  kb_s3_prefix TEXT,
  assistant_instructions TEXT,
  assistant_temperature DOUBLE PRECISION,
  assistant_top_p DOUBLE PRECISION,
  assistant_max_tokens INTEGER,
  measurement_model TEXT,
  measurement_sample_size INTEGER,
  measurement_cron TEXT,
  measurement_prompts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_brands (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, brand_id)
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  openai_thread_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, openai_thread_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  openai_message_id TEXT UNIQUE,
  display_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'open',
  resolved_by TEXT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  platform TEXT,
  platform_other TEXT,
  post_url TEXT,
  status TEXT,
  comments TEXT
);

CREATE TABLE IF NOT EXISTS recommendation_measurements (
  id TEXT PRIMARY KEY,
  measurement_type TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  normalized_brand TEXT NOT NULL,
  measurement_date DATE NOT NULL,
  sample_index INTEGER,
  raw_response TEXT,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_documents (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  knowledge_base_id TEXT,
  data_source_id TEXT,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  ingestion_job_id TEXT,
  last_error TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_brands_user ON user_brands (user_id);
CREATE INDEX IF NOT EXISTS idx_user_brands_brand ON user_brands (brand_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_brand ON threads (user_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_brand ON messages (brand_id);
CREATE INDEX IF NOT EXISTS idx_reports_brand ON reports (brand_id);
CREATE INDEX IF NOT EXISTS idx_followups_brand ON followups (brand_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON followups (user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_date ON recommendation_measurements (measurement_type, measurement_date);
CREATE INDEX IF NOT EXISTS idx_recommendations_brand ON recommendation_measurements (normalized_brand);
CREATE INDEX IF NOT EXISTS idx_recommendations_brand_id ON recommendation_measurements (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_documents_brand ON brand_documents (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_documents_status ON brand_documents (status);

COMMIT;
