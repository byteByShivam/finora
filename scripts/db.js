const { default: EmbeddedPostgres } = require('embedded-postgres');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'finora';
const DB_DIR = path.resolve(__dirname, '../.postgres_data');

async function ensureDatabase() {
  const adminClient = new Client({
    host: '127.0.0.1',
    port: PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`[Database] Created database: ${DB_NAME}`);
    } else {
      console.log(`[Database] Database '${DB_NAME}' already exists.`);
    }
  } catch (err) {
    console.error('[Database] Error checking/creating database:', err);
  } finally {
    await adminClient.end().catch(() => {});
  }
}

async function startServer() {
  const isInitialized = fs.existsSync(path.join(DB_DIR, 'PG_VERSION'));
  
  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    port: PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    persistent: true,
  });

  if (!isInitialized) {
    console.log('[Database] Initialising PostgreSQL cluster in .postgres_data...');
    await pg.initialise();
  }

  console.log(`[Database] Starting PostgreSQL on port ${PORT}...`);
  await pg.start();
  console.log(`[Database] PostgreSQL is ready on 127.0.0.1:${PORT}!`);

  await ensureDatabase();

  console.log(`[Database] Ready to accept connections: postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}`);

  const shutdown = async () => {
    console.log('\n[Database] Stopping PostgreSQL...');
    try {
      await pg.stop();
      console.log('[Database] Stopped cleanly.');
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (process.argv.includes('--daemon')) {
    setInterval(() => {}, 100000);
  }
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[Database] Startup error:', err);
    process.exit(1);
  });
}

module.exports = { startServer, ensureDatabase };
