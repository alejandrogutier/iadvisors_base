const { Pool } = require('pg');

const pgConfig = {
  host: process.env.PGHOST || process.env.AURORA_HOST || undefined,
  port: parseInt(process.env.PGPORT || process.env.AURORA_PORT || '5432', 10),
  user: process.env.PGUSER || process.env.AURORA_USER || undefined,
  password: process.env.PGPASSWORD || process.env.AURORA_PASSWORD || undefined,
  database: process.env.PGDATABASE || process.env.AURORA_DATABASE || undefined,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.PGPOOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_TIMEOUT_MS || '30000', 10)
};

let poolInstance = null;

function isAuroraConfigured() {
  return Boolean(pgConfig.host && pgConfig.user && pgConfig.password && pgConfig.database);
}

function getAuroraPool() {
  if (!isAuroraConfigured()) {
    return null;
  }
  if (!poolInstance) {
    poolInstance = new Pool(pgConfig);
  }
  return poolInstance;
}

async function testAuroraConnection() {
  const pool = getAuroraPool();
  if (!pool) {
    return { ok: false, reason: 'AURORA_NOT_CONFIGURED' };
  }
  const result = await pool.query('SELECT NOW() as now');
  return {
    ok: true,
    now: result.rows?.[0]?.now || null
  };
}

module.exports = {
  isAuroraConfigured,
  getAuroraPool,
  testAuroraConnection
};
