import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function App() {
  const [longUrl, setLongUrl] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [urls, setUrls] = useState([]);

  const fetchUrls = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/urls`);
      setUrls(res.data);
    } catch (err) {
      console.error('Failed to fetch urls', err);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  const handleCreate = async () => {
    setError('');
    if (!longUrl) {
      setError('Please enter a URL.');
      return;
    }
    // client-side quick validation
    try {
      new URL(longUrl);
    } catch {
      setError('Invalid URL. Include protocol (http/https).');
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API_BASE}/api/shorten`, { longUrl: longUrl.trim() });
      // update list
      await fetchUrls();
      setLongUrl('');
    } catch (err) {
      console.error('Create failed', err);
      setError(err?.response?.data?.error || 'Failed to create short URL');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container">
      <h1>URL Shortener</h1>

      <div className="card">
        <label>Enter long URL</label>
        <div className="row">
          <input
            type="text"
            placeholder="https://example.com/long/path"
            value={longUrl}
            onChange={(e) => setLongUrl(e.target.value)}
          />
          <button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Short URL'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <h2>All URLs</h2>
        <table>
          <thead>
            <tr>
              <th>Original URL</th>
              <th>Short URL</th>
              <th>Created</th>
              <th>Hits</th>
            </tr>
          </thead>
          <tbody>
            {urls.length === 0 ? (
              <tr><td colSpan="4">No URLs yet.</td></tr>
            ) : (
              urls.map(u => (
                <tr key={u.id}>
                  <td><a href={u.longUrl} target="_blank" rel="noreferrer">{u.longUrl}</a></td>
                  <td><a href={u.shortUrl} target="_blank" rel="noreferrer">{u.shortUrl}</a></td>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                  <td>{u.hits ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
