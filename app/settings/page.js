'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const CATEGORY_PRESETS = ['food', 'location', 'lifestyle', 'seasonal', 'niche', 'branded'];

export default function SettingsPage() {
  const [instagramAccount, setInstagramAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // Hashtag library state
  const [libraryHashtags, setLibraryHashtags] = useState([]);
  const [libraryCategories, setLibraryCategories] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryFilter, setLibraryFilter] = useState(null);
  const [hashtagInput, setHashtagInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [addingHashtags, setAddingHashtags] = useState(false);
  const [libraryError, setLibraryError] = useState(null);
  const [librarySuccess, setLibrarySuccess] = useState(null);

  const loadLibrary = useCallback(async (category = null) => {
    setLibraryLoading(true);
    try {
      const url = category
        ? `/api/hashtags/library?category=${encodeURIComponent(category)}`
        : '/api/hashtags/library';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLibraryHashtags(data.hashtags);
        setLibraryCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to load hashtag library:', err);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstagramAccount();
    loadLibrary();
  }, [loadLibrary]);

  const loadInstagramAccount = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instagram/account');
      const data = await res.json();
      
      if (data.connected) {
        setInstagramAccount(data.account);
      } else {
        setInstagramAccount(null);
      }
    } catch (err) {
      console.error('Failed to load Instagram account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram/auth');
      const data = await res.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Instagram account?')) {
      return;
    }
    
    setDisconnecting(true);
    try {
      await fetch('/api/instagram/disconnect', { method: 'POST' });
      setInstagramAccount(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const startImport = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      const res = await fetch('/api/instagram/import', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setImportStatus({ status: 'running', syncId: data.syncId });
        // Poll for completion
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch('/api/instagram/import');
          const statusData = await statusRes.json();
          if (statusData.status && statusData.status !== 'running') {
            setImportStatus(statusData);
            setImporting(false);
            clearInterval(pollInterval);
          }
        }, 5000);
      } else {
        setImportStatus({ status: 'error', error: data.error || 'Failed to start import' });
        setImporting(false);
      }
    } catch (err) {
      setImportStatus({ status: 'error', error: err.message });
      setImporting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleFilterCategory = (cat) => {
    const next = cat === libraryFilter ? null : cat;
    setLibraryFilter(next);
    loadLibrary(next);
  };

  const handleAddHashtags = async () => {
    setLibraryError(null);
    setLibrarySuccess(null);
    const raw = hashtagInput.trim();
    if (!raw) {
      setLibraryError('Enter at least one hashtag');
      return;
    }

    // Split on whitespace, commas, or newlines
    const tags = raw.split(/[\s,]+/).filter(Boolean);
    const resolvedCategory = categoryInput === '__custom__'
      ? customCategory.trim()
      : categoryInput;

    setAddingHashtags(true);
    try {
      const res = await fetch('/api/hashtags/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags: tags,
          category: resolvedCategory || null,
          source: sourceInput.trim() || null,
          notes: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add hashtags');
      setLibrarySuccess(`Added ${data.added} hashtag${data.added !== 1 ? 's' : ''}`);
      setHashtagInput('');
      setSourceInput('');
      loadLibrary(libraryFilter);
      setTimeout(() => setLibrarySuccess(null), 3000);
    } catch (err) {
      setLibraryError(err.message);
    } finally {
      setAddingHashtags(false);
    }
  };

  const handleRemoveHashtag = async (id) => {
    try {
      const res = await fetch('/api/hashtags/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      loadLibrary(libraryFilter);
    } catch (err) {
      setLibraryError(err.message);
    }
  };

  const handleCopyVisible = () => {
    const text = libraryHashtags.map(h => h.hashtag).join(' ');
    navigator.clipboard.writeText(text);
    setLibrarySuccess('Copied to clipboard');
    setTimeout(() => setLibrarySuccess(null), 2000);
  };

  // Group hashtags by category for display
  const grouped = libraryHashtags.reduce((acc, h) => {
    const cat = h.category || 'uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(h);
    return acc;
  }, {});

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>⚙️ Settings</h1>
          <p>Configure your Instagram connection and app preferences</p>
        </div>
      </header>

      <Link href="/" className="back-link">
        ← Back to Logger
      </Link>

      {/* Instagram Connection */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📸 Instagram Connection</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
          </div>
        ) : instagramAccount ? (
          <div>
            <div className="instagram-account-card">
              {instagramAccount.profilePicture && (
                <img 
                  src={instagramAccount.profilePicture} 
                  alt={instagramAccount.username}
                  className="instagram-profile-pic"
                />
              )}
              <div className="instagram-account-info">
                <div className="instagram-username">@{instagramAccount.username}</div>
                {instagramAccount.followersCount && (
                  <div className="instagram-stats">
                    <span>{instagramAccount.followersCount.toLocaleString()} followers</span>
                    <span>•</span>
                    <span>{instagramAccount.mediaCount} posts</span>
                  </div>
                )}
                <div className="instagram-connected-date">
                  Connected {formatDate(instagramAccount.connectedAt)}
                </div>
                {instagramAccount.needsReconnect && (
                  <div className="instagram-warning">
                    ⚠️ Token expired - please reconnect
                  </div>
                )}
              </div>
            </div>
            
            <div className="btn-group" style={{ marginTop: '1.5rem' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting...' : '🔌 Disconnect Account'}
              </button>
              {instagramAccount.needsReconnect && (
                <button 
                  className="btn btn-primary"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  🔄 Reconnect
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Connect your Instagram Business or Creator account to:
            </p>
            <ul style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li>Track post performance and engagement</li>
              <li>View insights (reach, impressions, saves)</li>
              <li>Correlate your edits with post performance</li>
              <li>Publish posts directly from the app</li>
            </ul>
            
            <div className="instagram-requirements">
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Requirements:</h4>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                <li>Instagram Business or Creator account</li>
                <li>Connected to a Facebook Page</li>
                <li>Meta Developer app configured</li>
              </ul>
            </div>

            {error && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                {error}
              </div>
            )}

            <button 
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connecting}
              style={{ marginTop: '1.5rem' }}
            >
              {connecting ? (
                <>
                  <span className="loading-spinner" />
                  Connecting...
                </>
              ) : (
                '🔗 Connect Instagram Account'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Account History Import */}
      {instagramAccount && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">📥 Account History Import</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Import all posts from your Instagram account into the tool. This enriches analytics with your full post history. Posts already linked won&apos;t be duplicated.
          </p>

          <button
            className="btn btn-primary"
            onClick={startImport}
            disabled={importing}
          >
            {importing ? (
              <>
                <span className="loading-spinner" />
                Importing...
              </>
            ) : (
              'Import Account History'
            )}
          </button>

          {importStatus && (
            <div style={{ marginTop: '1rem' }}>
              {importStatus.status === 'running' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                }}>
                  <span className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                  Import in progress... This may take a moment.
                </div>
              )}
              {importStatus.status === 'success' && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--success-soft)',
                  color: 'var(--success)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                }}>
                  Import complete — {importStatus.postsProcessed} post{importStatus.postsProcessed !== 1 ? 's' : ''} imported.
                </div>
              )}
              {importStatus.status === 'error' && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--error-soft)',
                  color: 'var(--error)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                }}>
                  Import failed: {importStatus.error || importStatus.errorDetails?.message || 'Unknown error'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* API Configuration Info */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">🔧 API Configuration</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          To enable Instagram integration, you need to configure these environment variables:
        </p>
        <div className="code-block" style={{ fontSize: '0.85rem' }}>
          {`INSTAGRAM_APP_ID=your-facebook-app-id
INSTAGRAM_APP_SECRET=your-facebook-app-secret
INSTAGRAM_REDIRECT_URI=${typeof window !== 'undefined' ? window.location.origin : ''}/api/instagram/callback`}
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.9rem' }}>
          Create a Meta app at{' '}
          <a
            href="https://developers.facebook.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            developers.facebook.com
          </a>
        </p>
      </div>

      {/* Hashtag Library */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title"># Hashtag Library</h2>
        </div>

        {/* Add hashtags form */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Paste hashtags (space, comma, or newline separated)
          </label>
          <textarea
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            placeholder="#food #london #lifestyle&#10;#seasonal #niche"
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.9rem',
              fontFamily: "'JetBrains Mono', monospace",
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                Category
              </label>
              <select
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">No category</option>
                {CATEGORY_PRESETS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {libraryCategories
                  .filter(c => !CATEGORY_PRESETS.includes(c))
                  .map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))
                }
                <option value="__custom__">+ Custom...</option>
              </select>
              {categoryInput === '__custom__' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category"
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                  }}
                />
              )}
            </div>

            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                Source (optional)
              </label>
              <input
                type="text"
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                placeholder='e.g. "competitor: @account"'
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {libraryError && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--error-soft)', color: 'var(--error)', borderRadius: '6px', fontSize: '0.85rem' }}>
              {libraryError}
            </div>
          )}
          {librarySuccess && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: '6px', fontSize: '0.85rem' }}>
              {librarySuccess}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleAddHashtags}
            disabled={addingHashtags || !hashtagInput.trim()}
            style={{ marginTop: '0.75rem' }}
          >
            {addingHashtags ? 'Adding...' : 'Add to Library'}
          </button>
        </div>

        {/* Category filter pills + summary */}
        {libraryCategories.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => handleFilterCategory(null)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  background: !libraryFilter ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: !libraryFilter ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                All
              </button>
              {libraryCategories.map(cat => {
                const count = libraryFilter === cat
                  ? libraryHashtags.length
                  : (grouped[cat]?.length || 0);
                return (
                  <button
                    key={cat}
                    onClick={() => handleFilterCategory(cat)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border)',
                      background: libraryFilter === cat ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: libraryFilter === cat ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {libraryHashtags.length} hashtag{libraryHashtags.length !== 1 ? 's' : ''}
              {libraryFilter ? ` in "${libraryFilter}"` : ' total'}
            </p>
          </div>
        )}

        {/* Library browser */}
        {libraryLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="loading-spinner" style={{ width: '24px', height: '24px' }} />
          </div>
        ) : libraryHashtags.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            No hashtags in your library yet. Add some above.
          </p>
        ) : (
          <div>
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, tags]) => (
              <div key={cat} style={{ marginBottom: '1rem' }}>
                <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                  {cat}
                </h4>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {tags.map(tag => (
                    <span
                      key={tag.id}
                      title={[tag.source && `Source: ${tag.source}`, tag.notes && `Notes: ${tag.notes}`].filter(Boolean).join('\n') || undefined}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.3rem 0.6rem',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        color: 'var(--text)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {tag.hashtag}
                      <button
                        onClick={() => handleRemoveHashtag(tag.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0',
                          fontSize: '0.9rem',
                          lineHeight: '1',
                        }}
                        title="Remove"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* Bulk actions */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-secondary"
                onClick={handleCopyVisible}
                style={{ fontSize: '0.85rem' }}
              >
                Copy All ({libraryHashtags.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
