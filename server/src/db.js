const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { v4: uuid } = require('uuid');

const configuredDefaultBrandId = process.env.DEFAULT_BRAND_ID || 'gynocanesten';
const defaultBrandName = process.env.DEFAULT_BRAND_NAME || 'Gynocanestén';
const defaultBrandSlugSource = process.env.DEFAULT_BRAND_SLUG || defaultBrandName;
const defaultBrandModelId =
  process.env.DEFAULT_BRAND_MODEL_ID ||
  process.env.DEFAULT_BRAND_ASSISTANT_ID ||
  process.env.BEDROCK_MODEL_ID_DEFAULT ||
  'us.amazon.nova-lite-v1:0';
const defaultBrandKnowledgeBaseId =
  process.env.DEFAULT_BRAND_KB_ID ||
  process.env.DEFAULT_BRAND_VECTOR_STORE_ID ||
  process.env.OPENAI_VECTOR_STORE_ID ||
  null;
const defaultBrandDataSourceId =
  process.env.DEFAULT_BRAND_KB_DATA_SOURCE_ID ||
  process.env.DEFAULT_BRAND_DATA_SOURCE_ID ||
  null;
const defaultBrandKbS3Prefix =
  process.env.DEFAULT_BRAND_KB_S3_PREFIX ||
  process.env.DEFAULT_BRAND_S3_PREFIX ||
  `kb/${configuredDefaultBrandId}/`;

const defaultMeasurementModel =
  process.env.DEFAULT_BRAND_MEASUREMENT_MODEL ||
  process.env.BEDROCK_MEASUREMENT_MODEL ||
  process.env.BEDROCK_MODEL_ID_DEFAULT ||
  defaultBrandModelId;
const defaultMeasurementSampleSize = Math.max(
  1,
  parseInt(process.env.DEFAULT_BRAND_MEASUREMENT_SAMPLE_SIZE || process.env.MEASUREMENT_SAMPLE_SIZE || '100', 10)
);
const defaultMeasurementCron =
  process.env.DEFAULT_BRAND_MEASUREMENT_CRON || process.env.MEASUREMENT_CRON || '0 6 * * *';

const baseMeasurementPrompts = [
  {
    key: 'brand',
    label: 'Marca',
    promptType: 'brand_question',
    question:
      '¿Qué marca de producto me recomiendas para tratar las infecciones vaginales por hongos o candidiasis?'
  },
  {
    key: 'symptoms',
    label: 'Síntomas',
    promptType: 'symptoms_question',
    question:
      '¿Si tengo picazón, ardor, enrojecimiento, flujo blanco o hinchazón vaginal, qué marca de producto me recomiendas?'
  }
];

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '..', 'iadvisors.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const slugify = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .trim() || 'default';

function isLegacyOpenAIModelId(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.startsWith('asst_') || normalized.startsWith('gpt-') || normalized.includes('openai');
}

function normalizeModelId(value = '') {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return defaultBrandModelId;
  }
  if (isLegacyOpenAIModelId(candidate)) {
    return defaultBrandModelId;
  }
  return candidate;
}

function isLegacyVectorStoreId(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('vs_');
}

function normalizeKnowledgeBaseId(value = '') {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return null;
  }
  if (isLegacyVectorStoreId(candidate)) {
    return null;
  }
  return candidate;
}

const defaultBrandSlug = slugify(defaultBrandSlugSource);
let resolvedDefaultBrandId = configuredDefaultBrandId;

db.exec(`
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
    assistant_temperature REAL,
    assistant_top_p REAL,
    assistant_max_tokens INTEGER,
    measurement_model TEXT,
    measurement_sample_size INTEGER,
    measurement_cron TEXT,
    measurement_prompts TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_brands (
    user_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, brand_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    openai_thread_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, openai_thread_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    openai_message_id TEXT,
    display_metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (openai_message_id),
    FOREIGN KEY (thread_id) REFERENCES threads(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'open',
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );

  CREATE TABLE IF NOT EXISTS recommendation_measurements (
    id TEXT PRIMARY KEY,
    measurement_type TEXT NOT NULL,
    prompt_type TEXT NOT NULL,
    brand TEXT NOT NULL,
    normalized_brand TEXT NOT NULL,
    measurement_date TEXT NOT NULL,
    sample_index INTEGER,
    raw_response TEXT,
    brand_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );

  CREATE TABLE IF NOT EXISTS followups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    scheduled_at TEXT,
    platform TEXT,
    platform_other TEXT,
    post_url TEXT,
    status TEXT,
    comments TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );

  CREATE TABLE IF NOT EXISTS brand_documents (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    knowledge_base_id TEXT,
    data_source_id TEXT,
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    status TEXT NOT NULL DEFAULT 'uploaded',
    ingestion_job_id TEXT,
    last_error TEXT,
    deleted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id)
  );
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
} catch (error) {
  // ignore if column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  db.exec("UPDATE users SET role = 'user' WHERE role IS NULL");
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE threads ADD COLUMN title TEXT');
} catch (error) {
  // ignore if column already exists
}

try {
  db.exec('ALTER TABLE threads ADD COLUMN brand_id TEXT');
} catch (error) {
  // ignore if column already exists
}

try {
  db.exec("ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'open'");
  db.exec("UPDATE reports SET status = 'open' WHERE status IS NULL");
} catch (error) {
  // ignore if column already exists
}

try {
  db.exec('ALTER TABLE reports ADD COLUMN resolved_by TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE reports ADD COLUMN resolved_at TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE messages ADD COLUMN display_metadata TEXT');
} catch (error) {
  // ignore if column already exists
}

try {
  db.exec('ALTER TABLE messages ADD COLUMN brand_id TEXT');
} catch (error) {
  // ignore if column already exists
}

try {
  db.exec('ALTER TABLE reports ADD COLUMN brand_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE followups ADD COLUMN brand_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE recommendation_measurements ADD COLUMN brand_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN model_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN knowledge_base_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec("ALTER TABLE brands ADD COLUMN knowledge_base_status TEXT DEFAULT 'NOT_CONFIGURED'");
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN guardrail_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN kb_data_source_id TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN kb_s3_prefix TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN assistant_instructions TEXT');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN assistant_temperature REAL');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN assistant_top_p REAL');
} catch (error) {
  // ignore
}

try {
  db.exec('ALTER TABLE brands ADD COLUMN assistant_max_tokens INTEGER');
} catch (error) {
  // ignore
}

db.prepare(`
  UPDATE brands
  SET model_id = assistant_id
  WHERE (model_id IS NULL OR model_id = '')
    AND assistant_id IS NOT NULL
    AND assistant_id <> ''
`).run();

db.prepare(`
  UPDATE brands
  SET knowledge_base_id = vector_store_id
  WHERE (knowledge_base_id IS NULL OR knowledge_base_id = '')
    AND vector_store_id IS NOT NULL
    AND vector_store_id <> ''
`).run();

db.prepare(`
  UPDATE brands
  SET knowledge_base_status = CASE
    WHEN knowledge_base_id IS NOT NULL AND knowledge_base_id <> '' THEN 'ACTIVE'
    ELSE 'NOT_CONFIGURED'
  END
  WHERE knowledge_base_status IS NULL OR knowledge_base_status = ''
`).run();

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_slug ON brands (slug);
  CREATE INDEX IF NOT EXISTS idx_user_brands_user ON user_brands (user_id);
  CREATE INDEX IF NOT EXISTS idx_user_brands_brand ON user_brands (brand_id);
  CREATE INDEX IF NOT EXISTS idx_recommendations_date
    ON recommendation_measurements (measurement_type, measurement_date);
  CREATE INDEX IF NOT EXISTS idx_recommendations_brand
    ON recommendation_measurements (normalized_brand);
  CREATE INDEX IF NOT EXISTS idx_followups_user
    ON followups (user_id);
  CREATE INDEX IF NOT EXISTS idx_followups_created
    ON followups (created_at);
  CREATE INDEX IF NOT EXISTS idx_threads_user_brand
    ON threads (user_id, brand_id);
  CREATE INDEX IF NOT EXISTS idx_messages_thread
    ON messages (thread_id);
  CREATE INDEX IF NOT EXISTS idx_messages_brand
    ON messages (brand_id);
  CREATE INDEX IF NOT EXISTS idx_reports_brand
    ON reports (brand_id);
  CREATE INDEX IF NOT EXISTS idx_followups_brand
    ON followups (brand_id);
  CREATE INDEX IF NOT EXISTS idx_recommendations_brand_id
    ON recommendation_measurements (brand_id);
  CREATE INDEX IF NOT EXISTS idx_brand_documents_brand
    ON brand_documents (brand_id);
  CREATE INDEX IF NOT EXISTS idx_brand_documents_status
    ON brand_documents (status);
`);

const insertBrandStmt = db.prepare(`
  INSERT INTO brands (
    id,
    name,
    slug,
    description,
    assistant_id,
    vector_store_id,
    model_id,
    knowledge_base_id,
    knowledge_base_status,
    guardrail_id,
    kb_data_source_id,
    kb_s3_prefix,
    assistant_instructions,
    assistant_temperature,
    assistant_top_p,
    assistant_max_tokens,
    measurement_model,
    measurement_sample_size,
    measurement_cron,
    measurement_prompts
  ) VALUES (
    @id,
    @name,
    @slug,
    @description,
    @assistant_id,
    @vector_store_id,
    @model_id,
    @knowledge_base_id,
    @knowledge_base_status,
    @guardrail_id,
    @kb_data_source_id,
    @kb_s3_prefix,
    @assistant_instructions,
    @assistant_temperature,
    @assistant_top_p,
    @assistant_max_tokens,
    @measurement_model,
    @measurement_sample_size,
    @measurement_cron,
    @measurement_prompts
  )
`);
const updateBrandStmt = db.prepare(`
  UPDATE brands
  SET name = @name,
      slug = @slug,
      description = @description,
      assistant_id = @assistant_id,
      vector_store_id = @vector_store_id,
      model_id = @model_id,
      knowledge_base_id = @knowledge_base_id,
      knowledge_base_status = @knowledge_base_status,
      guardrail_id = @guardrail_id,
      kb_data_source_id = @kb_data_source_id,
      kb_s3_prefix = @kb_s3_prefix,
      assistant_instructions = @assistant_instructions,
      assistant_temperature = @assistant_temperature,
      assistant_top_p = @assistant_top_p,
      assistant_max_tokens = @assistant_max_tokens,
      measurement_model = @measurement_model,
      measurement_sample_size = @measurement_sample_size,
      measurement_cron = @measurement_cron,
      measurement_prompts = @measurement_prompts
  WHERE id = @id
`);
const deleteBrandStmt = db.prepare('DELETE FROM brands WHERE id = ?');
const findBrandByIdStmt = db.prepare('SELECT * FROM brands WHERE id = ?');
const findBrandBySlugStmt = db.prepare('SELECT * FROM brands WHERE slug = ?');
const listBrandsStmt = db.prepare('SELECT * FROM brands ORDER BY datetime(created_at) ASC');
const updateBrandIdStmt = db.prepare('UPDATE brands SET id = @newId WHERE id = @oldId');
const updateUserBrandReferenceStmt = db.prepare(
  'UPDATE user_brands SET brand_id = @newId WHERE brand_id = @oldId'
);
const updateThreadBrandReferenceStmt = db.prepare(
  'UPDATE threads SET brand_id = @newId WHERE brand_id = @oldId'
);
const updateMessageBrandReferenceStmt = db.prepare(
  'UPDATE messages SET brand_id = @newId WHERE brand_id = @oldId'
);
const updateReportBrandReferenceStmt = db.prepare(
  'UPDATE reports SET brand_id = @newId WHERE brand_id = @oldId'
);
const updateFollowupBrandReferenceStmt = db.prepare(
  'UPDATE followups SET brand_id = @newId WHERE brand_id = @oldId'
);
const updateRecommendationBrandReferenceStmt = db.prepare(
  'UPDATE recommendation_measurements SET brand_id = @newId WHERE brand_id = @oldId'
);
const updateBrandDocumentBrandReferenceStmt = db.prepare(
  'UPDATE brand_documents SET brand_id = @newId WHERE brand_id = @oldId'
);

const listUserBrandsStmt = db.prepare(`
  SELECT brands.*, user_brands.is_default AS is_default
  FROM user_brands
  JOIN brands ON brands.id = user_brands.brand_id
  WHERE user_brands.user_id = ?
  ORDER BY brands.name ASC
`);
const insertUserBrandStmt = db.prepare(
  'INSERT OR IGNORE INTO user_brands (user_id, brand_id, is_default) VALUES (@user_id, @brand_id, @is_default)'
);
const deleteUserBrandStmt = db.prepare('DELETE FROM user_brands WHERE user_id = ? AND brand_id = ?');
const deleteUserBrandsStmt = db.prepare('DELETE FROM user_brands WHERE user_id = ?');
const ensureUserBrandStmt = db.prepare('SELECT 1 FROM user_brands WHERE user_id = ? AND brand_id = ?');
const setDefaultBrandStmt = db.prepare(
  'UPDATE user_brands SET is_default = CASE WHEN brand_id = @brand_id THEN 1 ELSE 0 END WHERE user_id = @user_id'
);

const insertUser = db.prepare(
  'INSERT INTO users (id, name, email, password_hash, role) VALUES (@id, @name, @email, @password_hash, @role)'
);
const updatePassword = db.prepare(
  'UPDATE users SET password_hash = @password_hash WHERE id = @id'
);
const updateUserStmt = db.prepare(
  'UPDATE users SET name = @name, email = @email WHERE id = @id'
);
const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const countAdminsStmt = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'admin'");
const findOldestUserStmt = db.prepare('SELECT id FROM users ORDER BY datetime(created_at) ASC LIMIT 1');
const listAllUsersStmt = db.prepare('SELECT id FROM users');

const insertThread = db.prepare(
  'INSERT INTO threads (id, user_id, brand_id, openai_thread_id, title) VALUES (@id, @user_id, @brand_id, @openai_thread_id, @title)'
);
const updateThreadTitleStmt = db.prepare(
  'UPDATE threads SET title = @title WHERE id = @id'
);
const findThreadByUser = db.prepare(
  'SELECT * FROM threads WHERE user_id = ? AND brand_id = ? ORDER BY datetime(created_at) DESC LIMIT 1'
);
const findThreadByOpenAI = db.prepare(
  'SELECT * FROM threads WHERE openai_thread_id = ? AND brand_id = ?'
);
const findThreadByIdStmt = db.prepare('SELECT * FROM threads WHERE id = ?');
const listThreadsByUser = db.prepare(`
  SELECT threads.id,
         threads.title,
         threads.openai_thread_id,
         threads.created_at,
         threads.user_id,
         threads.brand_id,
         MAX(messages.created_at) AS last_message_at
  FROM threads
  LEFT JOIN messages ON messages.thread_id = threads.id
  WHERE threads.user_id = ?
    AND threads.brand_id = ?
  GROUP BY threads.id
  ORDER BY datetime(COALESCE(last_message_at, threads.created_at)) DESC
`);

const insertMessage = db.prepare(
  `INSERT INTO messages
    (id, thread_id, brand_id, role, content, openai_message_id, display_metadata)
   VALUES (@id, @thread_id, @brand_id, @role, @content, @openai_message_id, @display_metadata)`
);
const findMessagesByThread = db.prepare(
  `SELECT * FROM messages WHERE thread_id = ?
   ORDER BY datetime(created_at) ASC`
);
const findMessageByOpenAI = db.prepare(
  'SELECT * FROM messages WHERE openai_message_id = ?'
);
const findMessageById = db.prepare('SELECT * FROM messages WHERE id = ?');

function parseMeasurementPrompts(rawValue) {
  if (!rawValue) {
    return [...baseMeasurementPrompts];
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          key: typeof item.key === 'string' ? item.key : '',
          label: typeof item.label === 'string' ? item.label : item.key,
          promptType: typeof item.promptType === 'string' ? item.promptType : item.key,
          question: typeof item.question === 'string' ? item.question : ''
        }))
        .filter((item) => item.key && item.question);
    }
  } catch (error) {
    // ignore parse errors
  }
  return [...baseMeasurementPrompts];
}

function migrateBrandIdentifier(oldId, newId) {
  if (!oldId || !newId || oldId === newId) {
    return oldId;
  }
  const existingTarget = findBrandByIdStmt.get(newId);
  if (existingTarget) {
    return oldId;
  }
  const brand = findBrandByIdStmt.get(oldId);
  if (!brand) {
    return oldId;
  }
  const performMigration = db.transaction(() => {
    updateUserBrandReferenceStmt.run({ oldId, newId });
    updateThreadBrandReferenceStmt.run({ oldId, newId });
    updateMessageBrandReferenceStmt.run({ oldId, newId });
    updateReportBrandReferenceStmt.run({ oldId, newId });
    updateFollowupBrandReferenceStmt.run({ oldId, newId });
    updateRecommendationBrandReferenceStmt.run({ oldId, newId });
    updateBrandDocumentBrandReferenceStmt.run({ oldId, newId });
    updateBrandIdStmt.run({ oldId, newId });
  });
  performMigration();
  return newId;
}

function serializeMeasurementPrompts(prompts) {
  if (!Array.isArray(prompts) || !prompts.length) {
    return JSON.stringify(baseMeasurementPrompts);
  }
  const normalized = prompts
    .map((item) => {
      const key = typeof item.key === 'string' && item.key.trim() ? item.key.trim() : null;
      const question = typeof item.question === 'string' && item.question.trim() ? item.question.trim() : null;
      if (!key || !question) return null;
      return {
        key,
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : key,
        promptType:
          typeof item.promptType === 'string' && item.promptType.trim()
            ? item.promptType.trim()
            : key,
        question
      };
    })
    .filter(Boolean);
  if (!normalized.length) {
    return JSON.stringify(baseMeasurementPrompts);
  }
  return JSON.stringify(normalized);
}

function formatBrandRecord(row) {
  if (!row) return null;
  const modelId = normalizeModelId(row.model_id || row.assistant_id || defaultBrandModelId);
  const knowledgeBaseId = normalizeKnowledgeBaseId(row.knowledge_base_id || row.vector_store_id || null);
  const knowledgeBaseStatus =
    row.knowledge_base_status || (knowledgeBaseId ? 'ACTIVE' : 'NOT_CONFIGURED');

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    modelId,
    knowledgeBaseId,
    knowledgeBaseStatus,
    guardrailId: row.guardrail_id || null,
    kbDataSourceId: row.kb_data_source_id || null,
    kbS3Prefix: row.kb_s3_prefix || null,
    assistantId: modelId,
    vectorStoreId: knowledgeBaseId,
    assistantSettings: {
      instructions: row.assistant_instructions || '',
      temperature:
        typeof row.assistant_temperature === 'number' ? row.assistant_temperature : null,
      topP: typeof row.assistant_top_p === 'number' ? row.assistant_top_p : null,
      maxTokens:
        typeof row.assistant_max_tokens === 'number' ? row.assistant_max_tokens : null
    },
    measurement: {
      model: row.measurement_model || defaultMeasurementModel,
      sampleSize: row.measurement_sample_size || defaultMeasurementSampleSize,
      cron: row.measurement_cron || defaultMeasurementCron,
      prompts: parseMeasurementPrompts(row.measurement_prompts)
    },
    createdAt: row.created_at
  };
}

function ensureDefaultBrandRecord() {
  let brand = findBrandByIdStmt.get(configuredDefaultBrandId);
  if (!brand) {
    brand = findBrandBySlugStmt.get(defaultBrandSlug);
  }
  if (!brand) {
    const existingBrands = listBrandsStmt.all();
    if (existingBrands.length) {
      brand = existingBrands[0];
    }
  }

  if (brand) {
    if (brand.id !== configuredDefaultBrandId) {
      resolvedDefaultBrandId = migrateBrandIdentifier(brand.id, configuredDefaultBrandId);
      if (resolvedDefaultBrandId === configuredDefaultBrandId) {
        brand = findBrandByIdStmt.get(configuredDefaultBrandId) || brand;
      }
    }
    resolvedDefaultBrandId = brand.id || configuredDefaultBrandId;
    const normalizedModelId = normalizeModelId(
      brand.model_id || brand.assistant_id || defaultBrandModelId
    );
    const normalizedKnowledgeBaseId = normalizeKnowledgeBaseId(
      brand.knowledge_base_id || brand.vector_store_id || defaultBrandKnowledgeBaseId || null
    );
    const payload = {
      id: resolvedDefaultBrandId,
      name: brand.name || defaultBrandName,
      slug: defaultBrandSlug || brand.slug || slugify(defaultBrandName),
      description: brand.description || 'Marca principal',
      assistant_id: normalizedModelId,
      vector_store_id: normalizedKnowledgeBaseId || '',
      model_id: normalizedModelId,
      knowledge_base_id: normalizedKnowledgeBaseId,
      knowledge_base_status:
        brand.knowledge_base_status ||
        (normalizedKnowledgeBaseId ? 'ACTIVE' : 'NOT_CONFIGURED'),
      guardrail_id: brand.guardrail_id || null,
      kb_data_source_id: brand.kb_data_source_id || defaultBrandDataSourceId,
      kb_s3_prefix: brand.kb_s3_prefix || defaultBrandKbS3Prefix,
      assistant_instructions: brand.assistant_instructions || null,
      assistant_temperature:
        typeof brand.assistant_temperature === 'number' ? brand.assistant_temperature : null,
      assistant_top_p: typeof brand.assistant_top_p === 'number' ? brand.assistant_top_p : null,
      assistant_max_tokens:
        typeof brand.assistant_max_tokens === 'number' ? brand.assistant_max_tokens : null,
      measurement_model: brand.measurement_model || defaultMeasurementModel,
      measurement_sample_size: brand.measurement_sample_size || defaultMeasurementSampleSize,
      measurement_cron: brand.measurement_cron || defaultMeasurementCron,
      measurement_prompts: brand.measurement_prompts || JSON.stringify(baseMeasurementPrompts)
    };
    updateBrandStmt.run(payload);
    return;
  }

  const payload = {
    id: configuredDefaultBrandId,
    name: defaultBrandName,
    slug: defaultBrandSlug,
    description: 'Marca principal',
    assistant_id: normalizeModelId(defaultBrandModelId),
    vector_store_id: normalizeKnowledgeBaseId(defaultBrandKnowledgeBaseId) || '',
    model_id: normalizeModelId(defaultBrandModelId),
    knowledge_base_id: normalizeKnowledgeBaseId(defaultBrandKnowledgeBaseId),
    knowledge_base_status: normalizeKnowledgeBaseId(defaultBrandKnowledgeBaseId)
      ? 'ACTIVE'
      : 'NOT_CONFIGURED',
    guardrail_id: null,
    kb_data_source_id: defaultBrandDataSourceId,
    kb_s3_prefix: defaultBrandKbS3Prefix,
    assistant_instructions: null,
    assistant_temperature: null,
    assistant_top_p: null,
    assistant_max_tokens: null,
    measurement_model: defaultMeasurementModel,
    measurement_sample_size: defaultMeasurementSampleSize,
    measurement_cron: defaultMeasurementCron,
    measurement_prompts: JSON.stringify(baseMeasurementPrompts)
  };
  insertBrandStmt.run(payload);
  resolvedDefaultBrandId = configuredDefaultBrandId;
}

function ensureDefaultBrandAssignments() {
  const users = listAllUsersStmt.all();
  users.forEach((user) => {
    const brands = listUserBrandsStmt.all(user.id);
    if (!brands.length) {
      insertUserBrandStmt.run({ user_id: user.id, brand_id: resolvedDefaultBrandId, is_default: 1 });
    } else if (!brands.some((brand) => Number(brand.is_default) === 1)) {
      const firstBrand = brands[0];
      setDefaultBrandStmt.run({ user_id: user.id, brand_id: firstBrand.id });
    }
  });
}

function ensureLegacyRecordsHaveBrand() {
  const params = { brandId: resolvedDefaultBrandId };
  db.prepare(
    "UPDATE threads SET brand_id = @brandId WHERE brand_id IS NULL OR brand_id = ''"
  ).run(params);
  db.prepare(`
    UPDATE messages
    SET brand_id = (
      SELECT threads.brand_id FROM threads WHERE threads.id = messages.thread_id
    )
    WHERE (brand_id IS NULL OR brand_id = '')
      AND EXISTS (SELECT 1 FROM threads WHERE threads.id = messages.thread_id)
  `).run();
  db.prepare(`
    UPDATE reports
    SET brand_id = (
      SELECT messages.brand_id FROM messages WHERE messages.id = reports.message_id
    )
    WHERE (brand_id IS NULL OR brand_id = '')
      AND EXISTS (SELECT 1 FROM messages WHERE messages.id = reports.message_id)
  `).run();
  db.prepare(
    "UPDATE followups SET brand_id = @brandId WHERE brand_id IS NULL OR brand_id = ''"
  ).run(params);
  db.prepare(
    "UPDATE recommendation_measurements SET brand_id = @brandId WHERE brand_id IS NULL OR brand_id = ''"
  ).run(params);
}

function ensureDefaultBrandSetup() {
  ensureDefaultBrandRecord();
  ensureDefaultBrandAssignments();
  ensureLegacyRecordsHaveBrand();
}

ensureDefaultBrandSetup();

function getUserBrands(userId) {
  if (!userId) return [];
  const rows = listUserBrandsStmt.all(userId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isDefault: Number(row.is_default) === 1
  }));
}

function listAllBrands() {
  return listBrandsStmt.all().map((row) => formatBrandRecord(row));
}

function getBrandByIdOrThrow(brandId) {
  const brand = formatBrandRecord(findBrandByIdStmt.get(brandId));
  if (!brand) {
    const err = new Error('BRAND_NOT_FOUND');
    err.code = 'BRAND_NOT_FOUND';
    throw err;
  }
  return brand;
}

function normalizeBrandPayload(input = {}, existing = {}) {
  const targetId = input.id || existing.id || uuid();
  const name = input.name || existing.name || 'Nueva marca';
  const modelId = normalizeModelId(
    input.modelId ||
      input.assistantId ||
      existing.model_id ||
      existing.assistantId ||
      existing.assistant_id ||
      defaultBrandModelId
  );
  const knowledgeBaseId = normalizeKnowledgeBaseId(
    input.knowledgeBaseId !== undefined
      ? input.knowledgeBaseId
      : input.vectorStoreId !== undefined
        ? input.vectorStoreId
        : existing.knowledge_base_id !== undefined
          ? existing.knowledge_base_id
          : existing.vectorStoreId !== undefined
            ? existing.vectorStoreId
            : existing.vector_store_id || null
  );

  if (!modelId) {
    const err = new Error('BRAND_CONFIG_INCOMPLETE');
    err.code = 'BRAND_CONFIG_INCOMPLETE';
    throw err;
  }

  const measurement = input.measurement || existing.measurement || {};
  const finalMeasurementModel = measurement.model || existing.measurement_model || defaultMeasurementModel;
  const finalSampleSize = measurement.sampleSize || existing.measurement_sample_size || defaultMeasurementSampleSize;
  const finalCron = measurement.cron || existing.measurement_cron || defaultMeasurementCron;
  const finalPrompts = serializeMeasurementPrompts(
    measurement.prompts || parseMeasurementPrompts(existing.measurement_prompts)
  );

  const knowledgeBaseStatus =
    input.knowledgeBaseStatus ||
    existing.knowledge_base_status ||
    (knowledgeBaseId ? 'ACTIVE' : 'NOT_CONFIGURED');

  const assistantInstructions =
    input.assistantInstructions !== undefined
      ? input.assistantInstructions
      : existing.assistant_instructions;
  const assistantTemperature =
    input.assistantTemperature !== undefined
      ? input.assistantTemperature
      : existing.assistant_temperature;
  const assistantTopP =
    input.assistantTopP !== undefined
      ? input.assistantTopP
      : existing.assistant_top_p;
  const assistantMaxTokens =
    input.assistantMaxTokens !== undefined
      ? input.assistantMaxTokens
      : existing.assistant_max_tokens;

  return {
    id: targetId,
    name,
    slug: slugify(input.slug || name || targetId),
    description: input.description === undefined ? existing.description : input.description,
    assistant_id: modelId,
    vector_store_id: knowledgeBaseId || '',
    model_id: modelId,
    knowledge_base_id: knowledgeBaseId || null,
    knowledge_base_status: knowledgeBaseStatus,
    guardrail_id:
      input.guardrailId !== undefined
        ? input.guardrailId
        : existing.guardrail_id || null,
    kb_data_source_id:
      input.kbDataSourceId !== undefined
        ? input.kbDataSourceId
        : existing.kb_data_source_id || null,
    kb_s3_prefix:
      input.kbS3Prefix !== undefined
        ? input.kbS3Prefix
        : existing.kb_s3_prefix || `kb/${targetId}/`,
    assistant_instructions: assistantInstructions || null,
    assistant_temperature:
      typeof assistantTemperature === 'number' && !Number.isNaN(assistantTemperature)
        ? assistantTemperature
        : null,
    assistant_top_p:
      typeof assistantTopP === 'number' && !Number.isNaN(assistantTopP)
        ? assistantTopP
        : null,
    assistant_max_tokens:
      typeof assistantMaxTokens === 'number' && Number.isFinite(assistantMaxTokens)
        ? Math.max(1, Math.floor(assistantMaxTokens))
        : null,
    measurement_model: finalMeasurementModel,
    measurement_sample_size: finalSampleSize,
    measurement_cron: finalCron,
    measurement_prompts: finalPrompts
  };
}

function createBrandRecord(payload) {
  const normalized = normalizeBrandPayload(payload);
  insertBrandStmt.run(normalized);
  return formatBrandRecord(findBrandByIdStmt.get(normalized.id));
}

function updateBrandRecord(brandId, updates) {
  const existing = findBrandByIdStmt.get(brandId);
  if (!existing) {
    const err = new Error('BRAND_NOT_FOUND');
    err.code = 'BRAND_NOT_FOUND';
    throw err;
  }
  const normalized = normalizeBrandPayload({ ...updates, id: brandId }, existing);
  updateBrandStmt.run(normalized);
  return formatBrandRecord(findBrandByIdStmt.get(brandId));
}

function ensureUserBrandAccess(userId, brandId) {
  if (!userId || !brandId) {
    const err = new Error('BRAND_REQUIRED');
    err.code = 'BRAND_REQUIRED';
    throw err;
  }
  const access = ensureUserBrandStmt.get(userId, brandId);
  if (!access) {
    const err = new Error('BRAND_ACCESS_DENIED');
    err.code = 'BRAND_ACCESS_DENIED';
    throw err;
  }
}

function setUserBrands(userId, brandIds = [], defaultBrandId = null) {
  deleteUserBrandsStmt.run(userId);
  const uniqueIds = Array.from(new Set(Array.isArray(brandIds) ? brandIds : []));
  uniqueIds.forEach((brandId) => {
    insertUserBrandStmt.run({
      user_id: userId,
      brand_id: brandId,
      is_default: defaultBrandId === brandId ? 1 : 0
    });
  });
  if (defaultBrandId && uniqueIds.includes(defaultBrandId)) {
    setDefaultBrandStmt.run({ user_id: userId, brand_id: defaultBrandId });
  } else if (uniqueIds.length) {
    setDefaultBrandStmt.run({ user_id: userId, brand_id: uniqueIds[0] });
  }
}

const insertReport = db.prepare(
  `INSERT INTO reports (id, message_id, user_id, brand_id, reason)
   VALUES (@id, @message_id, @user_id, @brand_id, @reason)`
);
const reportsSelectBase = `
  SELECT reports.id,
         reports.message_id,
         reports.user_id,
         reports.brand_id,
         reports.reason,
         COALESCE(reports.status, 'open') AS status,
         reports.resolved_at,
         reports.resolved_by,
         reports.created_at,
         messages.content AS message_content,
         messages.role AS message_role,
         users.name AS user_name,
         users.email AS user_email,
         resolver.name AS resolved_by_name,
         resolver.email AS resolved_by_email
  FROM reports
  JOIN messages ON messages.id = reports.message_id
  JOIN users ON users.id = reports.user_id
  LEFT JOIN users AS resolver ON resolver.id = reports.resolved_by
`;
const getReportsStmt = db.prepare(`${reportsSelectBase}
  WHERE reports.brand_id = ?
  ORDER BY datetime(reports.created_at) DESC
`);
const getReportByIdStmt = db.prepare(`${reportsSelectBase}
  WHERE reports.id = ?
`);
const findReportByIdStmt = db.prepare('SELECT * FROM reports WHERE id = ?');
const updateReportStatusStmt = db.prepare(
  'UPDATE reports SET status = @status, resolved_by = @resolved_by, resolved_at = @resolved_at WHERE id = @id'
);
const deleteReportStmt = db.prepare('DELETE FROM reports WHERE id = ?');
const updateUserRoleStmt = db.prepare('UPDATE users SET role = @role WHERE id = @id');
const listUsersWithStatsStmt = db.prepare(`
  SELECT users.id,
         users.name,
         users.email,
         COALESCE(users.role, 'user') AS role,
         users.created_at,
         COALESCE(thread_stats.total_threads, 0) AS total_threads,
         COALESCE(message_stats.total_messages, 0) AS total_messages
  FROM users
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS total_threads
    FROM threads
    WHERE brand_id = @brand_id
    GROUP BY user_id
  ) AS thread_stats ON thread_stats.user_id = users.id
  LEFT JOIN (
    SELECT threads.user_id AS user_id, COUNT(messages.id) AS total_messages
    FROM messages
    JOIN threads ON threads.id = messages.thread_id
    WHERE messages.brand_id = @brand_id
    GROUP BY threads.user_id
  ) AS message_stats ON message_stats.user_id = users.id
  ORDER BY datetime(users.created_at) DESC
`);
const deleteReportsByReporterStmt = db.prepare('DELETE FROM reports WHERE user_id = ?');
const deleteReportsByThreadOwnerStmt = db.prepare(`
  DELETE FROM reports
  WHERE message_id IN (
    SELECT messages.id
    FROM messages
    JOIN threads ON messages.thread_id = threads.id
    WHERE threads.user_id = ?
  )
`);
const deleteMessagesByThreadOwnerStmt = db.prepare(
  'DELETE FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE user_id = ?)'
);
const deleteThreadsByUserStmt = db.prepare('DELETE FROM threads WHERE user_id = ?');
const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
const listAllMessagesStmt = db.prepare(`
  SELECT messages.id,
         messages.role,
         messages.content,
         messages.created_at,
         messages.display_metadata,
         messages.thread_id,
         threads.title AS thread_title,
         users.id AS user_id,
         users.name AS user_name,
         users.email AS user_email
  FROM messages
  JOIN threads ON messages.thread_id = threads.id
  JOIN users ON threads.user_id = users.id
  WHERE messages.brand_id = ?
  ORDER BY datetime(messages.created_at) DESC
`);
const insertFollowUpStmt = db.prepare(`
  INSERT INTO followups (
    id,
    user_id,
    brand_id,
    scheduled_at,
    platform,
    platform_other,
    post_url,
    status,
    comments
  ) VALUES (
    @id,
    @user_id,
    @brand_id,
    @scheduled_at,
    @platform,
    @platform_other,
    @post_url,
    @status,
    @comments
  )
`);
const updateFollowUpStmt = db.prepare(`
  UPDATE followups
  SET scheduled_at = @scheduled_at,
      platform = @platform,
      platform_other = @platform_other,
      post_url = @post_url,
      status = @status,
      comments = @comments
  WHERE id = @id
`);
const deleteFollowUpStmt = db.prepare('DELETE FROM followups WHERE id = ?');
const findFollowUpByIdStmt = db.prepare(`
  SELECT followups.*, users.name AS user_name, users.email AS user_email
  FROM followups
  JOIN users ON users.id = followups.user_id
  WHERE followups.id = ?
`);
const listMessagesByUserStmt = db.prepare(`
  SELECT messages.id,
         messages.role,
         messages.content,
         messages.created_at,
         messages.display_metadata,
         messages.thread_id,
         threads.title AS thread_title
  FROM messages
  JOIN threads ON messages.thread_id = threads.id
  WHERE threads.user_id = ?
    AND messages.brand_id = ?
  ORDER BY datetime(messages.created_at) DESC
`);
const insertBrandDocumentStmt = db.prepare(`
  INSERT INTO brand_documents (
    id,
    brand_id,
    knowledge_base_id,
    data_source_id,
    s3_bucket,
    s3_key,
    filename,
    content_type,
    size_bytes,
    status,
    ingestion_job_id,
    last_error
  ) VALUES (
    @id,
    @brand_id,
    @knowledge_base_id,
    @data_source_id,
    @s3_bucket,
    @s3_key,
    @filename,
    @content_type,
    @size_bytes,
    @status,
    @ingestion_job_id,
    @last_error
  )
`);
const listBrandDocumentsStmt = db.prepare(`
  SELECT *
  FROM brand_documents
  WHERE brand_id = ?
    AND (deleted_at IS NULL OR deleted_at = '')
  ORDER BY datetime(created_at) DESC
`);
const findBrandDocumentByIdStmt = db.prepare('SELECT * FROM brand_documents WHERE id = ?');
const updateBrandDocumentIngestionStmt = db.prepare(`
  UPDATE brand_documents
  SET status = @status,
      ingestion_job_id = @ingestion_job_id,
      last_error = @last_error,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);
const softDeleteBrandDocumentStmt = db.prepare(`
  UPDATE brand_documents
  SET deleted_at = CURRENT_TIMESTAMP,
      status = 'deleted',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);
const insertMeasurementResultStmt = db.prepare(`
  INSERT INTO recommendation_measurements (
    id,
    measurement_type,
    prompt_type,
    brand,
    normalized_brand,
    measurement_date,
    sample_index,
    raw_response,
    brand_id
  ) VALUES (
    @id,
    @measurement_type,
    @prompt_type,
    @brand,
    @normalized_brand,
    @measurement_date,
    @sample_index,
    @raw_response,
    @brand_id
  )
`);
const hasMeasurementForDateStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM recommendation_measurements
  WHERE measurement_type = @measurement_type
    AND measurement_date = @measurement_date
    AND brand_id = @brand_id
`);
const aggregateMeasurementByBrandStmt = db.prepare(`
  SELECT measurement_type,
         normalized_brand,
         MIN(brand) AS brand,
         COUNT(*) AS total
  FROM recommendation_measurements
  WHERE measurement_date BETWEEN @start_date AND @end_date
    AND brand_id = @brand_id
  GROUP BY measurement_type, normalized_brand
`);
const aggregateMeasurementByDateBrandStmt = db.prepare(`
  SELECT measurement_type,
         measurement_date,
         normalized_brand,
         MIN(brand) AS brand,
         COUNT(*) AS total
  FROM recommendation_measurements
  WHERE measurement_date BETWEEN @start_date AND @end_date
    AND brand_id = @brand_id
  GROUP BY measurement_type, measurement_date, normalized_brand
  ORDER BY measurement_date ASC
`);
const measurementTotalsByTypeStmt = db.prepare(`
  SELECT measurement_type,
         COUNT(*) AS total
  FROM recommendation_measurements
  WHERE measurement_date BETWEEN @start_date AND @end_date
    AND brand_id = @brand_id
  GROUP BY measurement_type
`);
const latestMeasurementTimestampsStmt = db.prepare(`
  SELECT measurement_type,
         MAX(created_at) AS last_created_at,
         MAX(measurement_date) AS last_measurement_date
  FROM recommendation_measurements
  WHERE brand_id = @brand_id
  GROUP BY measurement_type
`);
const countActiveUsersInRangeStmt = db.prepare(`
  SELECT COUNT(DISTINCT threads.user_id) AS total
  FROM messages
  JOIN threads ON threads.id = messages.thread_id
  WHERE date(messages.created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND messages.role = 'user'
    AND messages.brand_id = @brand_id
`);
const messageTotalsInRangeStmt = db.prepare(`
  SELECT COUNT(*) AS total,
         SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_total,
         SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_total
  FROM messages
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
`);
const followupTotalsInRangeStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM followups
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
`);
const followupStatusBreakdownStmt = db.prepare(`
  SELECT COALESCE(status, 'pending') AS status,
         COUNT(*) AS total
  FROM followups
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
  GROUP BY status
`);
const reportsByStatusInRangeStmt = db.prepare(`
  SELECT COALESCE(status, 'open') AS status,
         COUNT(*) AS total
  FROM reports
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
  GROUP BY status
`);
const messageLeaderboardStmt = db.prepare(`
  SELECT users.id,
         users.name,
         users.email,
         COUNT(messages.id) AS total
  FROM messages
  JOIN threads ON threads.id = messages.thread_id
  JOIN users ON users.id = threads.user_id
  WHERE date(messages.created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND messages.role = 'user'
    AND messages.brand_id = @brand_id
  GROUP BY users.id
  ORDER BY total DESC
  LIMIT @limit
`);
const followupLeaderboardStmt = db.prepare(`
  SELECT users.id,
         users.name,
         users.email,
         COUNT(followups.id) AS total
  FROM followups
  JOIN users ON users.id = followups.user_id
  WHERE date(followups.created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND followups.brand_id = @brand_id
  GROUP BY users.id
  ORDER BY total DESC
  LIMIT @limit
`);
const messageTimelineStmt = db.prepare(`
  SELECT date(created_at) AS activity_date,
         SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_messages,
         SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_messages
  FROM messages
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
  GROUP BY date(created_at)
  ORDER BY activity_date ASC
`);
const followupTimelineStmt = db.prepare(`
  SELECT date(created_at) AS activity_date,
         COUNT(*) AS followups
  FROM followups
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
  GROUP BY date(created_at)
  ORDER BY activity_date ASC
`);
const reportTimelineStmt = db.prepare(`
  SELECT date(created_at) AS activity_date,
         COUNT(*) AS reports
  FROM reports
  WHERE date(created_at) BETWEEN date(@start_date) AND date(@end_date)
    AND brand_id = @brand_id
  GROUP BY date(created_at)
  ORDER BY activity_date ASC
`);

const adminCount = countAdminsStmt.get().total;
if (adminCount === 0) {
  const oldest = findOldestUserStmt.get();
  if (oldest?.id) {
    updateUserRoleStmt.run({ id: oldest.id, role: 'admin' });
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const incoming = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(incoming, 'hex'));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return {
    ...safeUser,
    brands: getUserBrands(user.id)
  };
}

function createUser({ id, name, email, password, role, enforceRole = false }) {
  const existing = findUserByEmail.get(email);
  if (existing) {
    const err = new Error('EMAIL_EXISTS');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }
  if (!password) {
    const err = new Error('PASSWORD_REQUIRED');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }
  const normalizedRole = ['admin', 'analyst', 'user'].includes(role) ? role : 'user';
  const adminCount = countAdminsStmt.get().total;
  const assignedRole = enforceRole ? normalizedRole : (adminCount === 0 ? 'admin' : normalizedRole);
  const user = {
    id: id || uuid(),
    name,
    email,
    password_hash: hashPassword(password),
    role: assignedRole
  };
  insertUser.run(user);
  insertUserBrandStmt.run({ user_id: user.id, brand_id: resolvedDefaultBrandId, is_default: 1 });
  setDefaultBrandStmt.run({ user_id: user.id, brand_id: resolvedDefaultBrandId });
  return findUserById.get(user.id);
}

function authenticateUser({ email, password }) {
  const user = findUserByEmail.get(email);
  if (!user || !password) return null;
  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }
  return user;
}

function setPasswordForExistingUser({ email, password }) {
  const user = findUserByEmail.get(email);
  if (!user) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (user.password_hash) {
    const err = new Error('PASSWORD_ALREADY_SET');
    err.code = 'PASSWORD_ALREADY_SET';
    throw err;
  }
  if (!password) {
    const err = new Error('PASSWORD_REQUIRED');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }
  updatePassword.run({ id: user.id, password_hash: hashPassword(password) });
  return findUserById.get(user.id);
}

function updateUserProfile({ id, name, email }) {
  const existing = findUserById.get(id);
  if (!existing) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  let nextEmail = existing.email;
  let nextName = existing.name;
  if (email && email !== existing.email) {
    const duplicate = findUserByEmail.get(email);
    if (duplicate && duplicate.id !== id) {
      const err = new Error('EMAIL_EXISTS');
      err.code = 'EMAIL_EXISTS';
      throw err;
    }
    nextEmail = email;
  }
  if (name) {
    nextName = name;
  }
  updateUserStmt.run({ id, name: nextName, email: nextEmail });
  return findUserById.get(id);
}

function changePassword({ userId, currentPassword, newPassword }) {
  const user = findUserById.get(userId);
  if (!user) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!currentPassword || !verifyPassword(currentPassword, user.password_hash)) {
    const err = new Error('INVALID_PASSWORD');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  if (!newPassword) {
    const err = new Error('PASSWORD_REQUIRED');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }
  updatePassword.run({ id: userId, password_hash: hashPassword(newPassword) });
  return findUserById.get(userId);
}

function createThreadRecord({ userId, brandId, openaiThreadId, title }) {
  const existing = findThreadByOpenAI.get(openaiThreadId, brandId);
  if (existing) {
    return existing;
  }
  const thread = {
    id: uuid(),
    user_id: userId,
    brand_id: brandId,
    openai_thread_id: openaiThreadId,
    title: title || 'Nuevo chat'
  };
  insertThread.run(thread);
  return findThreadByIdStmt.get(thread.id);
}

function saveMessage({ threadId, brandId, role, content, openaiMessageId, displayMetadata }) {
  if (openaiMessageId) {
    const existing = findMessageByOpenAI.get(openaiMessageId);
    if (existing) {
      return existing;
    }
  }
  const message = {
    id: uuid(),
    thread_id: threadId,
    brand_id: brandId,
    role,
    content,
    openai_message_id: openaiMessageId || null,
    display_metadata: displayMetadata ? JSON.stringify(displayMetadata) : null
  };
  insertMessage.run(message);
  return message;
}

function getMessagesByThread(threadId) {
  return findMessagesByThread.all(threadId);
}

function getThreadById(threadId) {
  return findThreadByIdStmt.get(threadId);
}

function listThreadsForUser(userId, brandId) {
  return listThreadsByUser.all(userId, brandId).map((thread) => ({
    ...thread,
    last_message_at: thread.last_message_at || thread.created_at
  }));
}

function renameThread({ threadId, title }) {
  updateThreadTitleStmt.run({ id: threadId, title });
  return getThreadById(threadId);
}

function addReport({ messageId, userId, reason, brandId }) {
  const message = findMessageById.get(messageId);
  if (!message) {
    const err = new Error('MESSAGE_NOT_FOUND');
    err.code = 'MESSAGE_NOT_FOUND';
    throw err;
  }
  const targetBrandId = message.brand_id;
  if (brandId && brandId !== targetBrandId) {
    const err = new Error('BRAND_MISMATCH');
    err.code = 'BRAND_MISMATCH';
    throw err;
  }
  ensureUserBrandAccess(userId, targetBrandId);
  const report = {
    id: uuid(),
    message_id: messageId,
    user_id: userId,
    brand_id: targetBrandId,
    reason
  };
  insertReport.run(report);
  return report;
}

function listUsersWithStats({ brandId }) {
  return listUsersWithStatsStmt.all({ brand_id: brandId });
}

function listReports({ brandId }) {
  return getReportsStmt.all(brandId);
}

function getReportDetails(reportId) {
  return getReportByIdStmt.get(reportId);
}

function resolveReport({ reportId, resolvedBy }) {
  const existing = findReportByIdStmt.get(reportId);
  if (!existing) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const resolvedAt = new Date().toISOString();
  updateReportStatusStmt.run({
    id: reportId,
    status: 'resolved',
    resolved_by: resolvedBy || null,
    resolved_at: resolvedAt
  });
  return getReportDetails(reportId);
}

function deleteReport(reportId) {
  const existing = findReportByIdStmt.get(reportId);
  if (!existing) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  deleteReportStmt.run(reportId);
}

function updateUserRole({ userId, role }) {
  if (!['admin', 'analyst', 'user'].includes(role)) {
    const err = new Error('INVALID_ROLE');
    err.code = 'INVALID_ROLE';
    throw err;
  }
  const user = findUserById.get(userId);
  if (!user) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (user.role === role) {
    return user;
  }
  if (user.role === 'admin' && role !== 'admin') {
    const admins = countAdminsStmt.get().total;
    if (admins <= 1) {
      const err = new Error('LAST_ADMIN');
      err.code = 'LAST_ADMIN';
      throw err;
    }
  }
  updateUserRoleStmt.run({ id: userId, role });
  return findUserById.get(userId);
}

const deleteUserCascade = db.transaction((userId) => {
  deleteReportsByThreadOwnerStmt.run(userId);
  deleteReportsByReporterStmt.run(userId);
  deleteMessagesByThreadOwnerStmt.run(userId);
  deleteThreadsByUserStmt.run(userId);
  deleteUserBrandsStmt.run(userId);
  deleteUserStmt.run(userId);
});

function removeUser(userId) {
  const user = findUserById.get(userId);
  if (!user) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (user.role === 'admin') {
    const admins = countAdminsStmt.get().total;
    if (admins <= 1) {
      const err = new Error('LAST_ADMIN');
      err.code = 'LAST_ADMIN';
      throw err;
    }
  }
  deleteUserCascade(userId);
}

function formatFollowUpRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    brand_id: row.brand_id,
    created_at: row.created_at,
    scheduled_at: row.scheduled_at,
    platform: row.platform,
    platform_other: row.platform_other,
    post_url: row.post_url,
    status: row.status,
    comments: row.comments,
    user_name: row.user_name,
    user_email: row.user_email
  };
}

function createFollowUpEntry({
  userId,
  brandId,
  scheduledAt,
  platform,
  platformOther,
  postUrl,
  status,
  comments
}) {
  ensureUserBrandAccess(userId, brandId);
  const payload = {
    id: uuid(),
    user_id: userId,
    brand_id: brandId,
    scheduled_at: scheduledAt || null,
    platform: platform || null,
    platform_other: platformOther || null,
    post_url: postUrl || null,
    status: status || 'pending',
    comments: comments ?? null
  };
  insertFollowUpStmt.run(payload);
  return formatFollowUpRecord(findFollowUpByIdStmt.get(payload.id));
}

function updateFollowUpEntry({
  id,
  brandId,
  scheduledAt,
  platform,
  platformOther,
  postUrl,
  status,
  comments
}) {
  const existing = findFollowUpByIdStmt.get(id);
  if (!existing) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (brandId && existing.brand_id && existing.brand_id !== brandId) {
    const err = new Error('BRAND_MISMATCH');
    err.code = 'BRAND_MISMATCH';
    throw err;
  }
  updateFollowUpStmt.run({
    id,
    scheduled_at: scheduledAt || null,
    platform: platform || null,
    platform_other: platformOther || null,
    post_url: postUrl || null,
    status: status || existing.status,
    comments: comments ?? null
  });
  return formatFollowUpRecord(findFollowUpByIdStmt.get(id));
}

function deleteFollowUpEntry(id) {
  const existing = findFollowUpByIdStmt.get(id);
  if (!existing) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  deleteFollowUpStmt.run(id);
}

function listFollowUps({ includeAll, userId, ownerId, status, startDate, endDate, brandId }) {
  let query = `
    SELECT followups.*, users.name AS user_name, users.email AS user_email
    FROM followups
    JOIN users ON users.id = followups.user_id
  `;
  const conditions = [];
  const params = {};

  if (brandId) {
    conditions.push('followups.brand_id = @brandId');
    params.brandId = brandId;
  }

  if (!includeAll) {
    conditions.push('followups.user_id = @requesterId');
    params.requesterId = userId;
  } else if (ownerId) {
    conditions.push('followups.user_id = @ownerId');
    params.ownerId = ownerId;
  }

  if (status) {
    conditions.push('followups.status = @status');
    params.status = status;
  }

  if (startDate) {
    conditions.push('date(followups.created_at) >= date(@startDate)');
    params.startDate = startDate;
  }

  if (endDate) {
    conditions.push('date(followups.created_at) <= date(@endDate)');
    params.endDate = endDate;
  }

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY datetime(followups.created_at) DESC';
  const stmt = db.prepare(query);
  return stmt.all(params).map(formatFollowUpRecord);
}

function createBrandDocument({
  brandId,
  knowledgeBaseId,
  dataSourceId,
  s3Bucket,
  s3Key,
  filename,
  contentType,
  sizeBytes,
  status = 'uploaded'
}) {
  const payload = {
    id: uuid(),
    brand_id: brandId,
    knowledge_base_id: knowledgeBaseId || null,
    data_source_id: dataSourceId || null,
    s3_bucket: s3Bucket,
    s3_key: s3Key,
    filename,
    content_type: contentType || null,
    size_bytes: typeof sizeBytes === 'number' ? sizeBytes : null,
    status,
    ingestion_job_id: null,
    last_error: null
  };
  insertBrandDocumentStmt.run(payload);
  return findBrandDocumentByIdStmt.get(payload.id);
}

function listBrandDocuments(brandId) {
  return listBrandDocumentsStmt.all(brandId);
}

function findBrandDocumentById(id) {
  return findBrandDocumentByIdStmt.get(id);
}

function updateBrandDocumentIngestion({ id, status, ingestionJobId, lastError }) {
  updateBrandDocumentIngestionStmt.run({
    id,
    status: status || 'uploaded',
    ingestion_job_id: ingestionJobId || null,
    last_error: lastError || null
  });
  return findBrandDocumentByIdStmt.get(id);
}

function softDeleteBrandDocument(id) {
  softDeleteBrandDocumentStmt.run(id);
  return findBrandDocumentByIdStmt.get(id);
}

function recordRecommendationMeasurement({
  measurementType,
  promptType,
  brand,
  normalizedBrand,
  measurementDate,
  sampleIndex,
  rawResponse,
  brandId
}) {
  const record = {
    id: uuid(),
    measurement_type: measurementType,
    prompt_type: promptType,
    brand,
    normalized_brand: normalizedBrand,
    measurement_date: measurementDate,
    sample_index: typeof sampleIndex === 'number' ? sampleIndex : null,
    raw_response: rawResponse || null,
    brand_id: brandId
  };
  insertMeasurementResultStmt.run(record);
  return record;
}

function hasRecommendationMeasurementForDate({ measurementType, measurementDate, brandId }) {
  const result = hasMeasurementForDateStmt.get({
    measurement_type: measurementType,
    measurement_date: measurementDate,
    brand_id: brandId
  });
  return Boolean(result?.total);
}

function getRecommendationMeasurementAggregates({ startDate, endDate, brandId }) {
  const params = {
    start_date: startDate,
    end_date: endDate,
    brand_id: brandId
  };
  const totalsByBrand = aggregateMeasurementByBrandStmt.all(params);
  const totalsByDateBrand = aggregateMeasurementByDateBrandStmt.all(params);
  const totalsByType = measurementTotalsByTypeStmt.all(params);
  const latestRuns = latestMeasurementTimestampsStmt.all({ brand_id: brandId });
  return {
    totalsByBrand,
    totalsByDateBrand,
    totalsByType,
    latestRuns
  };
}

function parseDateOnly(value) {
  if (!value) return null;
  const parts = value.split('-').map((part) => parseInt(part, 10));
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function buildDateSequence(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || start > end) {
    return [];
  }
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function getPublicDashboardStats({ startDate, endDate, limit = 5, brandId }) {
  const params = {
    start_date: startDate,
    end_date: endDate,
    brand_id: brandId
  };
  const limitValue = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 50) : 5;
  const limitParams = {
    ...params,
    limit: limitValue
  };

  const activeUsersRow = countActiveUsersInRangeStmt.get(params) || {};
  const messageTotalsRow = messageTotalsInRangeStmt.get(params) || {};
  const followupTotalsRow = followupTotalsInRangeStmt.get(params) || {};
  const followupStatusRows = followupStatusBreakdownStmt.all(params) || [];
  const reportStatusRows = reportsByStatusInRangeStmt.all(params) || [];
  const messageLeaders = messageLeaderboardStmt.all(limitParams) || [];
  const followupLeaders = followupLeaderboardStmt.all(limitParams) || [];
  const messageTimelineRows = messageTimelineStmt.all(params) || [];
  const followupTimelineRows = followupTimelineStmt.all(params) || [];
  const reportTimelineRows = reportTimelineStmt.all(params) || [];

  const timelineMap = new Map(
    buildDateSequence(startDate, endDate).map((date) => [
      date,
      {
        date,
        userMessages: 0,
        assistantMessages: 0,
        followups: 0,
        reports: 0
      }
    ])
  );

  messageTimelineRows.forEach((row) => {
    const target = timelineMap.get(row.activity_date);
    if (target) {
      target.userMessages = Number(row.user_messages) || 0;
      target.assistantMessages = Number(row.assistant_messages) || 0;
    }
  });

  followupTimelineRows.forEach((row) => {
    const target = timelineMap.get(row.activity_date);
    if (target) {
      target.followups = Number(row.followups) || 0;
    }
  });

  reportTimelineRows.forEach((row) => {
    const target = timelineMap.get(row.activity_date);
    if (target) {
      target.reports = Number(row.reports) || 0;
    }
  });

  const timeline = timelineMap.size ? Array.from(timelineMap.values()) : [];

  return {
    activeUsers: Number(activeUsersRow.total) || 0,
    messageTotals: {
      total: Number(messageTotalsRow.total) || 0,
      user: Number(messageTotalsRow.user_total) || 0,
      assistant: Number(messageTotalsRow.assistant_total) || 0
    },
    followUpTotals: {
      total: Number(followupTotalsRow.total) || 0,
      byStatus: followupStatusRows.map((row) => ({
        status: row.status,
        total: Number(row.total) || 0
      }))
    },
    reportStatusTotals: reportStatusRows.map((row) => ({
      status: row.status,
      total: Number(row.total) || 0
    })),
    messageLeaderboard: messageLeaders.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      total: Number(row.total) || 0
    })),
    followupLeaderboard: followupLeaders.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      total: Number(row.total) || 0
    })),
    timeline
  };
}

module.exports = {
  createUser,
  authenticateUser,
  setPasswordForExistingUser,
  updateUserProfile,
  changePassword,
  createThreadRecord,
  saveMessage,
  getMessagesByThread,
  getThreadById,
  renameThread,
  listThreadsForUser,
  getLatestThreadForUser: (userId, brandId) => findThreadByUser.get(userId, brandId),
  addReport,
  getReports: (brandId) => listReports({ brandId }),
  resolveReport,
  deleteReport,
  listUsersWithStats: (brandId) => listUsersWithStats({ brandId }),
  getReportDetails,
  updateUserRole,
  deleteUser: removeUser,
  findThreadByOpenAI: (threadId, brandId) => findThreadByOpenAI.get(threadId, brandId),
  findUserById: (userId) => findUserById.get(userId),
  findMessageById: (messageId) => findMessageById.get(messageId),
  sanitizeUser,
  findUserByEmail: (email) => findUserByEmail.get(email),
  listAllMessages: (brandId) => listAllMessagesStmt.all(brandId),
  listMessagesByUser: (userId, brandId) => listMessagesByUserStmt.all(userId, brandId),
  recordRecommendationMeasurement,
  hasRecommendationMeasurementForDate,
  getRecommendationMeasurementAggregates,
  getPublicDashboardStats,
  createFollowUpEntry,
  updateFollowUpEntry,
  deleteFollowUpEntry,
  listFollowUps,
  createBrandDocument,
  listBrandDocuments,
  findBrandDocumentById,
  updateBrandDocumentIngestion,
  softDeleteBrandDocument,
  findFollowUpById: (id) => formatFollowUpRecord(findFollowUpByIdStmt.get(id)),
  listBrands: () => listAllBrands(),
  getBrandById: (brandId) => formatBrandRecord(findBrandByIdStmt.get(brandId)),
  createBrand: (payload) => createBrandRecord(payload),
  updateBrand: (brandId, updates) => updateBrandRecord(brandId, updates),
  ensureUserBrandAccess,
  getUserBrands,
  setUserBrands
};
