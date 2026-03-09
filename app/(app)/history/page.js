'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { computeDiff } from '@/lib/diff';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEditCount, setFilterEditCount] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      setHistory(data.posts || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getFilteredHistory = () => {
    let filtered = [...history];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.topic?.toLowerCase().includes(query) ||
        post.finalVersion?.toLowerCase().includes(query) ||
        post.aiVersion?.toLowerCase().includes(query)
      );
    }

    if (filterEditCount !== 'all') {
      filtered = filtered.filter(post => {
        const edits = post.editCount;
        switch (filterEditCount) {
          case 'low': return edits <= 3;
          case 'medium': return edits > 3 && edits <= 7;
          case 'high': return edits > 7;
          default: return true;
        }
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.publishedAt || a.createdAt) - new Date(b.publishedAt || b.createdAt);
        case 'most-edits':
          return b.editCount - a.editCount;
        case 'least-edits':
          return a.editCount - b.editCount;
        case 'topic':
          return (a.topic || '').localeCompare(b.topic || '');
        default:
          return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);
      }
    });

    return filtered;
  };

  const toggleCompareSelection = (post) => {
    if (compareSelection.find(p => p.id === post.id)) {
      setCompareSelection(compareSelection.filter(p => p.id !== post.id));
    } else if (compareSelection.length < 2) {
      setCompareSelection([...compareSelection, post]);
    }
  };

  const clearCompare = () => {
    setCompareMode(false);
    setCompareSelection([]);
    setShowCompare(false);
  };

  const exportAsJSON = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    downloadBlob(blob, 'instagram-posts-export.json');
    showToast('Exported as JSON!');
  };

  const exportAsCSV = () => {
    const headers = ['id', 'topic', 'aiVersion', 'finalVersion', 'editCount', 'createdAt'];
    const csvRows = [headers.join(',')];

    history.forEach(post => {
      const row = headers.map(header => {
        let value = post[header] || '';
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""');
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`;
          }
        }
        return value;
      });
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    downloadBlob(blob, 'instagram-posts-export.csv');
    showToast('Exported as CSV!');
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const viewPost = (post) => {
    router.push(`/history/${post.id}`);
  };

  const filteredHistory = getFilteredHistory();

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>Post History</h1>
          <p>Browse and search all your logged posts</p>
        </div>
      </header>

      {/* Compare View */}
      {showCompare && compareSelection.length === 2 && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">{'\u2696\uFE0F'} Post Comparison</h2>
              <button className="btn btn-secondary btn-sm" onClick={clearCompare}>
                {'\u2715'} Clear Comparison
              </button>
            </div>
            <div className="compare-stats">
              <div className="compare-stat-item">
                <span className="compare-stat-label">Post 1 Edits</span>
                <span className="compare-stat-value">{compareSelection[0].editCount}</span>
              </div>
              <div className="compare-stat-item">
                <span className="compare-stat-label">Post 2 Edits</span>
                <span className="compare-stat-value">{compareSelection[1].editCount}</span>
              </div>
              <div className="compare-stat-item">
                <span className="compare-stat-label">Difference</span>
                <span className="compare-stat-value" style={{
                  color: compareSelection[0].editCount === compareSelection[1].editCount
                    ? 'var(--text-muted)'
                    : 'var(--warning)'
                }}>
                  {Math.abs(compareSelection[0].editCount - compareSelection[1].editCount)} edits
                </span>
              </div>
            </div>
          </div>

          <div className="main-grid">
            {compareSelection.map((post, index) => (
              <div key={post.id} className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <span className="compare-number">{index + 1}</span>
                    {post.topic}
                  </h3>
                  <span className="history-item-edits">{'\u270F\uFE0F'} {post.editCount}</span>
                </div>
                <div className="compare-section">
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Original (Claude)</h4>
                  <div className="post-content" style={{ fontSize: '0.85rem', maxHeight: '150px', overflow: 'auto' }}>
                    {post.aiVersion}
                  </div>
                </div>
                <div className="compare-section">
                  <h4 style={{ color: 'var(--success)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Final Version</h4>
                  <div className="post-content" style={{ fontSize: '0.85rem', maxHeight: '150px', overflow: 'auto' }}>
                    {post.finalVersion}
                  </div>
                </div>
                <div className="compare-section">
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Changes</h4>
                  <div className="diff-container" style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {computeDiff(post.aiVersion, post.finalVersion).map((line, i) => (
                      <div key={i} className={`diff-line ${line.type}`}>
                        {line.type === 'added' && '+ '}
                        {line.type === 'removed' && '\u2212 '}
                        {line.content || ' '}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setShowCompare(false)}>
              {'\u2190'} Back to History
            </button>
          </div>
        </>
      )}

      {/* History list */}
      {!showCompare && (
        <div className="card">
          <div className="history-header">
            <h2 className="card-title">{'\uD83D\uDCDA'} Post History</h2>
            <div className="history-actions">
              <button
                className={`btn btn-secondary btn-sm ${compareMode ? 'active' : ''}`}
                onClick={() => {
                  setCompareMode(!compareMode);
                  setCompareSelection([]);
                }}
              >
                {'\u2696\uFE0F'} {compareMode ? 'Cancel Compare' : 'Compare'}
              </button>
              <div className="export-dropdown">
                <button className="btn btn-secondary btn-sm">
                  {'\uD83D\uDCE5'} Export
                </button>
                <div className="export-menu">
                  <button onClick={exportAsJSON}>Export as JSON</button>
                  <button onClick={exportAsCSV}>Export as CSV</button>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="filter-bar">
            <div className="search-box">
              <span className="search-icon">{'\uD83D\uDD0D'}</span>
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>{'\u00D7'}</button>
              )}
            </div>
            <select
              value={filterEditCount}
              onChange={(e) => setFilterEditCount(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Edits</option>
              <option value="low">Low (1-3)</option>
              <option value="medium">Medium (4-7)</option>
              <option value="high">High (8+)</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="most-edits">Most Edits</option>
              <option value="least-edits">Least Edits</option>
              <option value="topic">By Topic</option>
            </select>
          </div>

          {compareMode && (
            <div className="compare-banner">
              <span>Select 2 posts to compare ({compareSelection.length}/2 selected)</span>
              {compareSelection.length === 2 && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowCompare(true)}>
                  View Comparison {'\u2192'}
                </button>
              )}
            </div>
          )}

          <div className="history-count">
            {filteredHistory.length} of {history.length} post{history.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>

          {filteredHistory.length === 0 ? (
            <div className="empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/>
                <path d="M12 8v8"/>
                <path d="M8 12h8"/>
              </svg>
              <p>{history.length === 0 ? 'No posts logged yet.' : 'No posts match your filters.'}<br/>
              {history.length === 0 && 'Edit and log your first post to get started!'}</p>
            </div>
          ) : (
            <div className="history-list">
              {filteredHistory.map((post) => (
                <div
                  key={post.id}
                  className={`history-item ${compareMode ? 'compare-mode' : ''} ${compareSelection.find(p => p.id === post.id) ? 'selected' : ''}`}
                  onClick={() => compareMode ? toggleCompareSelection(post) : viewPost(post)}
                >
                  {compareMode && (
                    <div className="compare-checkbox">
                      {compareSelection.find(p => p.id === post.id) ? '\u2611\uFE0F' : '\u2610'}
                    </div>
                  )}
                  <div className="history-item-content">
                    <div className="history-item-header">
                      <span className="history-item-topic">
                        {post.topic}
                        {post.mediaProductType === 'REELS' ? (
                          <span style={{
                            background: 'rgba(168, 85, 247, 0.15)',
                            color: '#a855f7',
                            fontSize: '0.65rem',
                            marginLeft: '0.5rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            verticalAlign: 'middle',
                          }}>
                            REEL
                          </span>
                        ) : post.mediaType === 'CAROUSEL_ALBUM' ? (
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            fontSize: '0.65rem',
                            marginLeft: '0.5rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            verticalAlign: 'middle',
                          }}>
                            CAROUSEL
                          </span>
                        ) : post.mediaType === 'IMAGE' ? (
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                            fontSize: '0.65rem',
                            marginLeft: '0.5rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            verticalAlign: 'middle',
                          }}>
                            POST
                          </span>
                        ) : post.mediaType === 'VIDEO' ? (
                          <span style={{
                            background: 'rgba(234, 179, 8, 0.15)',
                            color: '#eab308',
                            fontSize: '0.65rem',
                            marginLeft: '0.5rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            verticalAlign: 'middle',
                          }}>
                            VIDEO
                          </span>
                        ) : null}
                        {post.instagramMediaId && (
                          <span title="Linked to Instagram" style={{
                            color: '#22c55e',
                            fontSize: '0.7rem',
                            marginLeft: '0.35rem',
                            fontWeight: 500,
                            verticalAlign: 'middle',
                          }}>
                            {'\uD83D\uDD17'}
                          </span>
                        )}
                      </span>
                      <div className="history-item-meta">
                        <span className="history-item-edits">
                          {'\u270F\uFE0F'} {post.editCount}
                        </span>
                        <span className="history-item-date">
                          {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="history-item-preview">
                      {post.finalVersion.substring(0, 120)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '\u2713' : '\u2715'} {toast.message}
        </div>
      )}
    </div>
  );
}
