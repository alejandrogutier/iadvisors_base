#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Client } = require('pg');

const envCandidates = [
  path.resolve(__dirname, '..', '.env.migration'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), '.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath, override: true });
    break;
  }
}

const sqlitePath = process.env.SQLITE_PATH || path.resolve(__dirname, '..', 'iadvisors.db');
if (!fs.existsSync(sqlitePath)) {
  console.error(`No se encontró el archivo SQLite en ${sqlitePath}`);
  process.exit(1);
}

const pgConnectionString = process.env.PG_CONNECTION_STRING;
const pgConfig = pgConnectionString
  ? { connectionString: pgConnectionString }
  : {
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'iadvisors'
    };

if (!pgConnectionString && (!pgConfig.host || !pgConfig.user || !pgConfig.password)) {
  console.error('Faltan variables para conectarse a PostgreSQL. Define PG_CONNECTION_STRING o PGHOST/PGUSER/PGPASSWORD.');
  process.exit(1);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const client = new Client(pgConfig);

const asJson = (value, fallback = []) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('No se pudo parsear JSON, se deja el valor original como texto.');
    return value;
  }
};

const tables = [
  {
    name: 'brands',
    columns: [
      'id',
      'name',
      'slug',
      'description',
      'assistant_id',
      'vector_store_id',
      'measurement_model',
      'measurement_sample_size',
      'measurement_cron',
      'measurement_prompts',
      'created_at'
    ],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        assistant_id TEXT NOT NULL,
        vector_store_id TEXT NOT NULL,
        measurement_model TEXT,
        measurement_sample_size INTEGER,
        measurement_cron TEXT,
        measurement_prompts JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    transform: (row) => ({
      ...row,
      measurement_prompts: asJson(row.measurement_prompts, [])
    })
  },
  {
    name: 'users',
    columns: ['id', 'name', 'email', 'password_hash', 'role', 'created_at'],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  },
  {
    name: 'user_brands',
    columns: ['user_id', 'brand_id', 'is_default', 'created_at'],
    conflict: '(user_id, brand_id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS user_brands (
        user_id TEXT NOT NULL REFERENCES users(id),
        brand_id TEXT NOT NULL REFERENCES brands(id),
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, brand_id)
      );
    `,
    transform: (row) => ({ ...row, is_default: Boolean(row.is_default) })
  },
  {
    name: 'threads',
    columns: ['id', 'user_id', 'brand_id', 'openai_thread_id', 'title', 'created_at'],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        brand_id TEXT NOT NULL REFERENCES brands(id),
        openai_thread_id TEXT NOT NULL,
        title TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, openai_thread_id)
      );
    `
  },
  {
    name: 'messages',
    columns: [
      'id',
      'thread_id',
      'brand_id',
      'role',
      'content',
      'openai_message_id',
      'display_metadata',
      'created_at'
    ],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id),
        brand_id TEXT NOT NULL REFERENCES brands(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        openai_message_id TEXT UNIQUE,
        display_metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    transform: (row) => ({
      ...row,
      display_metadata: asJson(row.display_metadata, null)
    })
  },
  {
    name: 'reports',
    columns: [
      'id',
      'message_id',
      'user_id',
      'brand_id',
      'reason',
      'status',
      'resolved_by',
      'resolved_at',
      'created_at'
    ],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        brand_id TEXT NOT NULL REFERENCES brands(id),
        reason TEXT,
        status TEXT DEFAULT 'open',
        resolved_by TEXT REFERENCES users(id),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  },
  {
    name: 'followups',
    columns: [
      'id',
      'user_id',
      'brand_id',
      'scheduled_at',
      'platform',
      'platform_other',
      'post_url',
      'status',
      'comments',
      'created_at'
    ],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS followups (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        brand_id TEXT NOT NULL REFERENCES brands(id),
        scheduled_at TIMESTAMPTZ,
        platform TEXT,
        platform_other TEXT,
        post_url TEXT,
        status TEXT,
        comments TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  },
  {
    name: 'recommendation_measurements',
    columns: [
      'id',
      'measurement_type',
      'prompt_type',
      'brand',
      'normalized_brand',
      'measurement_date',
      'sample_index',
      'raw_response',
      'brand_id',
      'created_at'
    ],
    conflict: '(id)',
    ddl: `
      CREATE TABLE IF NOT EXISTS recommendation_measurements (
        id TEXT PRIMARY KEY,
        measurement_type TEXT NOT NULL,
        prompt_type TEXT NOT NULL,
        brand TEXT NOT NULL,
        normalized_brand TEXT NOT NULL,
        measurement_date DATE NOT NULL,
        sample_index INTEGER,
        raw_response JSONB,
        brand_id TEXT NOT NULL REFERENCES brands(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
    transform: (row) => ({
      ...row,
      raw_response: asJson(row.raw_response, row.raw_response)
    })
  }
];

const chunkedInsert = async (table, rows) => {
  if (!rows.length) return 0;
  const placeholders = table.columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const conflict = table.conflict ? ` ON CONFLICT ${table.conflict} DO NOTHING` : '';
  const sql = `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})${conflict}`;
  let inserted = 0;
  for (const row of rows) {
    const normalized = table.transform ? table.transform(row) : row;
    const values = table.columns.map((column) => {
      const value = normalized[column];
      if (value === undefined) return null;
      if (column === 'measurement_prompts' || column === 'display_metadata' || column === 'raw_response') {
        return value === null ? null : JSON.stringify(value);
      }
      return value;
    });
    await client.query(sql, values);
    inserted += 1;
  }
  return inserted;
};

const migrate = async () => {
  console.log('Conectando a PostgreSQL...');
  await client.connect();
  await client.query('BEGIN');

  try {
    for (const table of tables) {
      console.log(`Preparando tabla ${table.name}...`);
      await client.query(table.ddl);
      const rows = sqlite.prepare(`SELECT ${table.columns.join(', ')} FROM ${table.name}`).all();
      console.log(`Encontrados ${rows.length} registros en ${table.name}`);
      const inserted = await chunkedInsert(table, rows);
      console.log(`Insertados ${inserted} registros en ${table.name}`);
    }

    await client.query('COMMIT');
    console.log('Migración completada con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
    sqlite.close();
  }
};

migrate();
