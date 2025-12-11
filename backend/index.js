// index.js
require('dotenv').config();
const express = require('express');
const pool = require('./db');
const cors = require('cors');
const { customAlphabet } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 4000;
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 7);

app.use(express.json());
// Allow all origins (you can restrict by FRONTEND URL in production)
app.use(cors());

// Helpers
function isValidUrl(url) {
  try {
    const u = new URL(url);
    // require http or https
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

// Create a short URL mapping
app.post('/api/shorten', async (req, res) => {
  const { longUrl } = req.body;
  if (!longUrl || typeof longUrl !== 'string') {
    return res.status(400).json({ error: 'longUrl is required' });
  }
  if (!isValidUrl(longUrl)) {
    return res.status(400).json({ error: 'Invalid URL. Include protocol (http/https).' });
  }

  try {
    // First, check if this longUrl already exists; if yes return existing record
    const existing = await pool.query('SELECT code, long_url FROM urls WHERE long_url = $1 LIMIT 1', [longUrl]);
    if (existing.rows.length > 0) {
      const code = existing.rows[0].code;
      return res.json({
        code,
        longUrl,
        shortUrl: `${process.env.BACKEND_BASE_URL?.replace(/\/$/, '') || ''}/s/${code}`
      });
    }

    // generate unique code (loop to avoid rare collision)
    let code = nanoid();
    let tries = 0;
    while (tries < 5) {
      const r = await pool.query('SELECT 1 FROM urls WHERE code = $1 LIMIT 1', [code]);
      if (r.rows.length === 0) break;
      code = nanoid();
      tries++;
    }

    await pool.query('INSERT INTO urls (code, long_url) VALUES ($1, $2)', [code, longUrl]);
    const shortUrl = `${process.env.BACKEND_BASE_URL?.replace(/\/$/, '') || ''}/s/${code}`;
    res.json({ code, longUrl, shortUrl });
  } catch (err) {
    console.error('Error in /api/shorten', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        long_url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        hits INTEGER DEFAULT 0
      );
    `);
    res.send("Database table created successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating table");
  }
});


// Return list of all urls (ordered newest first)
app.get('/api/urls', async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT 
    id, 
    code, 
    long_url AS "longUrl", 
    created_at AS "createdAt", 
    hits 
  FROM urls 
  ORDER BY created_at DESC
`);

    // attach shortUrl for each
    const base = process.env.BACKEND_BASE_URL?.replace(/\/$/, '') || '';
    const rows = result.rows.map(r => ({
      ...r,
      shortUrl: `${base}/s/${r.code}`
    }));
    res.json(rows);
  } catch (err) {
    console.error('Error in /api/urls', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Redirect route
app.get('/s/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('SELECT id, long_url FROM urls WHERE code = $1 LIMIT 1', [code]);
    if (result.rows.length === 0) {
      return res.status(404).send('Short URL not found.');
    }
    const row = result.rows[0];
    // increment hit count (non-blocking — but we await for simplicity)
    await pool.query('UPDATE urls SET hits = hits + 1 WHERE id = $1', [row.id]);
    // redirect
    return res.redirect(302, row.long_url);
  } catch (err) {
    console.error('Error in /s/:code', err);
    return res.status(500).send('Server error');
  }
});

app.get('/', (req, res) => {
  res.send('URL Shortener backend is running.');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
