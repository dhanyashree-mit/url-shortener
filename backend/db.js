// db.js
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Exiting.');
  process.exit(1);
}

const pool = new Pool({
  connectionString
});

module.exports = pool;
