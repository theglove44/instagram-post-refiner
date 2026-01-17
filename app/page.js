'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Simple diff computation
function computeDiff(oldText, newText) {
  const oldLines = oldText.trim().split('\n');
  const newLines = newText.trim().split('\n');
  
  const changes = [];
  let oldIndex = 0;
  let newIndex = 0;
  
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      changes.push({ type: 'added', content: newLines[newIndex] });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      changes.push({ type: 'removed', content: oldLines[oldIndex] });
      oldIndex++;
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      changes.push({ type: 'unchanged', content: oldLines[oldIndex] });
      oldIndex++;
      newIndex++;
    } else {
      changes.push({ type: 'removed', content: oldLines[oldIndex] });
      changes.push({ type: 'added', content: newLines[newIndex] });
      oldIndex++;
      newIndex++;
    }
  }
  
  return changes;
}

function countEdits(oldText, newText) {
  if (!oldText || !newText) return 0;
  const diff = computeDiff(oldText, newText);
  const edits = diff.filter(d => d.type !== 'unchanged').length;
  return Math.max(1, Math.ceil(edits / 2));
}

export default function Home() {
  const [topic, setTopic] = useState('');
  const [original, setOriginal] = useState('');
  const [edited, setEdited] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('edit');
  const [selectedPost, setSelectedPost] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  
  // New UI enhancement states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEditCount, setFilterEditCount] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState([]);
  const [quickStats, setQuickStats] = useState(null);
  const [theme, setTheme] = useState('dark');
  
  // Instagram linking states
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [loadingInstagram, setLoadingInstagram] = useState(false);
  const [linkingPost, setLinkingPost] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Load history and stats on mount
  useEffect(() => {
    loadHistory();
    loadQuickStats();
    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
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

  const loadQuickStats = async () => {
    try {
      const res = await fetch('/api/analyse');
      const data = await res.json();
      if (data.analysis) {
        setQuickStats({
          totalPosts: data.analysis.totalPosts,
          avgEdits: data.analysis.avgEditCount,
          voiceScore: data.analysis.voiceScore?.score || null
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Load recent Instagram posts for linking
  const loadInstagramPosts = async () => {
    setLoadingInstagram(true);
    try {
      const res = await fetch('/api/instagram/recent?limit=25');
      const data = await res.json();
      if (data.posts) {
        setInstagramPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to load Instagram posts:', error);
    } finally {
      setLoadingInstagram(false);
    }
  };

  // Link a logged post to an Instagram post
  const linkToInstagram = async (instagramPost) => {
    if (!selectedPost) return;
    setLinkingPost(true);
    try {
      const res = await fetch('/api/posts/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPost.id,
          instagramMediaId: instagramPost.id,
          instagramPermalink: instagramPost.permalink,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Post linked to Instagram!');
        setSelectedPost({ 
          ...selectedPost, 
          instagramMediaId: instagramPost.id,
          instagramPermalink: instagramPost.permalink,
        });
        setShowLinkModal(false);
        loadHistory();
      } else {
        showToast(data.error || 'Failed to link', 'error');
      }
    } catch (error) {
      showToast('Failed to link post', 'error');
    } finally {
      setLinkingPost(false);
    }
  };

  // Unlink a post from Instagram
  const unlinkFromInstagram = async () => {
    if (!selectedPost) return;
    setLinkingPost(true);
    try {
      const res = await fetch(`/api/posts/link?postId=${selectedPost.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast('Post unlinked from Instagram');
        setSelectedPost({ 
          ...selectedPost, 
          instagramMediaId: null,
          instagramPermalink: null,
        });
        loadHistory();
      } else {
        showToast(data.error || 'Failed to unlink', 'error');
      }
    } catch (error) {
      showToast('Failed to unlink post', 'error');
    } finally {
      setLinkingPost(false);
    }
  };

  // Open link modal and load Instagram posts
  const openLinkModal = () => {
    setShowLinkModal(true);
    if (instagramPosts.length === 0) {
      loadInstagramPosts();
    }
  };

  // Export functions
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
        // Escape quotes and wrap in quotes if contains comma or newline
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

  // Filter and sort history
  const getFilteredHistory = () => {
    let filtered = [...history];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => 
        post.topic?.toLowerCase().includes(query) ||
        post.finalVersion?.toLowerCase().includes(query) ||
        post.aiVersion?.toLowerCase().includes(query)
      );
    }
    
    // Edit count filter
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
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'most-edits':
          return b.editCount - a.editCount;
        case 'least-edits':
          return a.editCount - b.editCount;
        case 'topic':
          return (a.topic || '').localeCompare(b.topic || '');
        default: // newest
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
    
    return filtered;
  };

  // Compare mode handlers
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
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStartEditing = () => {
    if (!original.trim()) {
      showToast('Please paste a post first', 'error');
      return;
    }
    setEdited(original);
    setIsLocked(true);
  };

  const handleSave = async () => {
    if (!original.trim() || !edited.trim()) {
      showToast('Both original and edited versions are required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const editCount = countEdits(original, edited);
      
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'Untitled',
          aiVersion: original,
          finalVersion: edited,
          editCount,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save post');
      }
      
      showToast(`Post logged! (${editCount} edits tracked)`);
      loadHistory();
      
      // Reset form
      setTopic('');
      setOriginal('');
      setEdited('');
      setIsLocked(false);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setOriginal('');
    setEdited('');
    setTopic('');
    setIsLocked(false);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const viewPost = (post) => {
    setSelectedPost(post);
    setActiveTab('view');
  };

  const diff = original && edited && isLocked ? computeDiff(original, edited) : [];
  const editCount = original && edited && isLocked ? countEdits(original, edited) : 0;
  const hasChanges = original !== edited;

  const filteredHistory = getFilteredHistory();
  // Get best transformations for gallery (posts with most edits that show significant change)
  const getBestTransformations = () => {
    return [...history]
      .filter(p => p.editCount >= 3)
      .sort((a, b) => b.editCount - a.editCount)
      .slice(0, 6);
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>📸 Instagram Post Logger</h1>
          <p>Paste from Claude Chat → Edit to your voice → Log for training</p>
        </div>
        <div className="header-actions">
          {quickStats && (
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="quick-stat-value">{quickStats.totalPosts}</span>
                <span className="quick-stat-label">Posts</span>
              </div>
              <div className="quick-stat">
                <span className="quick-stat-value">{quickStats.avgEdits}</span>
                <span className="quick-stat-label">Avg Edits</span>
              </div>
              {quickStats.voiceScore && (
                <div className="quick-stat">
                  <span className="quick-stat-value" style={{ color: quickStats.voiceScore >= 80 ? 'var(--success)' : quickStats.voiceScore >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                    {quickStats.voiceScore}%
                  </span>
                  <span className="quick-stat-label">Voice</span>
                </div>
              )}
            </div>
          )}
          <button 
            className="btn btn-icon" 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="tabs">
        <div className="tabs-inner">
          <button 
            className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <span className="tab-icon">✏️</span>
            Edit Post
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="tab-icon">📚</span>
            History
            {history.length > 0 && <span className="tab-badge">{history.length}</span>}
          </button>
          <button 
            className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <span className="tab-icon">🖼️</span>
            Gallery
          </button>
          {selectedPost && (
            <button 
              className={`tab ${activeTab === 'view' ? 'active' : ''}`}
              onClick={() => setActiveTab('view')}
            >
              <span className="tab-icon">👁️</span>
              View Post
            </button>
          )}
          {compareSelection.length === 2 && (
            <button 
              className={`tab ${activeTab === 'compare' ? 'active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              <span className="tab-icon">⚖️</span>
              Compare
            </button>
          )}
          <Link href="/analysis" className="tab">
            <span className="tab-icon">📊</span>
            Analysis
          </Link>
          <Link href="/performance" className="tab">
            <span className="tab-icon">📈</span>
            Performance
          </Link>
          <Link href="/settings" className="tab">
            <span className="tab-icon">⚙️</span>
            Settings
          </Link>
        </div>
      </div>

      {activeTab === 'edit' && (
        <>
          <div className="main-grid">
            {/* Left Column - Original from Claude */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="step">1</span>
                  Original from Claude
                </h2>
                {isLocked && (
                  <span className="status-badge status-locked">
                    🔒 Locked
                  </span>
                )}
              </div>
              
              <div className="input-group">
                <label>Topic (optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Selfridges Food Hall, M&S Night..."
                  disabled={isLocked}
                />
              </div>
              
              <textarea
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="Paste the Instagram post from Claude Chat here..."
                disabled={isLocked}
                style={isLocked ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              />
              
              {!isLocked && (
                <div className="btn-group">
                  <button 
                    className="btn btn-primary"
                    onClick={handleStartEditing}
                    disabled={!original.trim()}
                  >
                    ✏️ Start Editing
                  </button>
                </div>
              )}
            </div>

            {/* Right Column - Your Edited Version */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="step">2</span>
                  Your Version
                </h2>
                {edited && (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(edited)}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                  >
                    📋 Copy
                  </button>
                )}
              </div>
              
              <div className="input-group" style={{ visibility: 'hidden', height: '72px' }}>
                <label>Spacer</label>
                <input type="text" disabled />
              </div>
              
              <textarea
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                placeholder={isLocked ? "Edit the post here to match your voice..." : "Click 'Start Editing' first to lock the original..."}
                disabled={!isLocked}
                style={!isLocked ? { opacity: 0.4 } : {}}
              />
              
              <div className="btn-group">
                <button 
                  className="btn btn-success"
                  onClick={handleSave}
                  disabled={isSaving || !isLocked || !edited.trim()}
                >
                  {isSaving ? (
                    <>
                      <span className="loading-spinner" />
                      Saving...
                    </>
                  ) : (
                    '💾 Log & Save'
                  )}
                </button>
                {isLocked && (
                  <button 
                    className="btn btn-secondary"
                    onClick={handleReset}
                  >
                    🔄 Start Over
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Diff View */}
          {isLocked && hasChanges && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header">
                <h2 className="card-title">📊 Your Changes</h2>
                <div className="diff-stats">
                  <span className="diff-stat edits">
                    ✏️ {editCount} edit{editCount !== 1 ? 's' : ''}
                  </span>
                  <span className="diff-stat added">
                    + {diff.filter(d => d.type === 'added').length}
                  </span>
                  <span className="diff-stat removed">
                    − {diff.filter(d => d.type === 'removed').length}
                  </span>
                </div>
              </div>
              
              <div className="diff-container">
                {diff.map((line, i) => (
                  <div key={i} className={`diff-line ${line.type}`}>
                    {line.type === 'added' && '+ '}
                    {line.type === 'removed' && '− '}
                    {line.content || ' '}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow reminder */}
          {!isLocked && !original && (
            <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2.5rem 2rem' }}>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workflow</h3>
              <div className="workflow-container">
                <div className="workflow-step">
                  <span className="workflow-icon">💬</span>
                  <span className="workflow-label">Get post from<br/>Claude Chat</span>
                </div>
                <span className="workflow-arrow">→</span>
                <div className="workflow-step">
                  <span className="workflow-icon">📋</span>
                  <span className="workflow-label">Paste &<br/>lock original</span>
                </div>
                <span className="workflow-arrow">→</span>
                <div className="workflow-step">
                  <span className="workflow-icon">✏️</span>
                  <span className="workflow-label">Edit to<br/>your voice</span>
                </div>
                <span className="workflow-arrow">→</span>
                <div className="workflow-step">
                  <span className="workflow-icon">💾</span>
                  <span className="workflow-label">Log for<br/>training</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="history-header">
            <h2 className="card-title">📚 Post History</h2>
            <div className="history-actions">
              <button 
                className={`btn btn-secondary btn-sm ${compareMode ? 'active' : ''}`}
                onClick={() => {
                  setCompareMode(!compareMode);
                  setCompareSelection([]);
                }}
              >
                ⚖️ {compareMode ? 'Cancel Compare' : 'Compare'}
              </button>
              <div className="export-dropdown">
                <button className="btn btn-secondary btn-sm">
                  📥 Export
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
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
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
                <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('compare')}>
                  View Comparison →
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
                      {compareSelection.find(p => p.id === post.id) ? '☑️' : '☐'}
                    </div>
                  )}
                  <div className="history-item-content">
                    <div className="history-item-header">
                      <span className="history-item-topic">{post.topic}</span>
                      <div className="history-item-meta">
                        <span className="history-item-edits">
                          ✏️ {post.editCount}
                        </span>
                        <span className="history-item-date">
                          {new Date(post.createdAt).toLocaleDateString('en-GB', {
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

      {activeTab === 'view' && selectedPost && (
        <>
          <div className="main-grid">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">🤖 Original (Claude)</h2>
                <button 
                  className="btn btn-secondary"
                  onClick={() => copyToClipboard(selectedPost.aiVersion)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                >
                  📋 Copy
                </button>
              </div>
              <div className="post-content">
                {selectedPost.aiVersion}
              </div>
            </div>
            
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">✅ Final Version</h2>
                <button 
                  className="btn btn-secondary"
                  onClick={() => copyToClipboard(selectedPost.finalVersion)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                >
                  📋 Copy
                </button>
              </div>
              <div className="post-content">
                {selectedPost.finalVersion}
              </div>
            </div>
          </div>
          
          {/* Diff for selected post */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">📊 Changes Made</h2>
              <span className="history-item-edits">
                ✏️ {selectedPost.editCount} edit{selectedPost.editCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="diff-container">
              {computeDiff(selectedPost.aiVersion, selectedPost.finalVersion).map((line, i) => (
                <div key={i} className={`diff-line ${line.type}`}>
                  {line.type === 'added' && '+ '}
                  {line.type === 'removed' && '− '}
                  {line.content || ' '}
                </div>
              ))}
            </div>
          </div>

          {/* Instagram Link Section */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">📸 Instagram Link</h2>
            </div>
            {selectedPost.instagramPermalink ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--success)' }}>✓ Linked to Instagram</span>
                  <a 
                    href={selectedPost.instagramPermalink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    View on IG →
                  </a>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={unlinkFromInstagram}
                  disabled={linkingPost}
                  style={{ color: 'var(--error)' }}
                >
                  {linkingPost ? 'Unlinking...' : '✕ Unlink'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Link this post to an Instagram post to track performance metrics
                </p>
                <button 
                  className="btn btn-primary"
                  onClick={openLinkModal}
                >
                  🔗 Link to Instagram Post
                </button>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setActiveTab('history')}
            >
              ← Back to History
            </button>
          </div>
        </>
      )}

      {/* Gallery Tab - Best Transformations */}
      {activeTab === 'gallery' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🖼️ Best Transformations</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Posts with the most significant edits
            </p>
          </div>
          
          {getBestTransformations().length === 0 ? (
            <div className="empty-state">
              <p>No significant transformations yet.<br/>Posts with 3+ edits will appear here.</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {getBestTransformations().map((post) => (
                <div key={post.id} className="gallery-card" onClick={() => viewPost(post)}>
                  <div className="gallery-card-header">
                    <span className="gallery-topic">{post.topic}</span>
                    <span className="gallery-edits">✏️ {post.editCount} edits</span>
                  </div>
                  <div className="gallery-preview">
                    <div className="gallery-before">
                      <span className="gallery-label">Before</span>
                      <p>{post.aiVersion.substring(0, 100)}...</p>
                    </div>
                    <div className="gallery-arrow">→</div>
                    <div className="gallery-after">
                      <span className="gallery-label">After</span>
                      <p>{post.finalVersion.substring(0, 100)}...</p>
                    </div>
                  </div>
                  <div className="gallery-date">
                    {new Date(post.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === 'compare' && compareSelection.length === 2 && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">⚖️ Post Comparison</h2>
              <button className="btn btn-secondary btn-sm" onClick={clearCompare}>
                ✕ Clear Comparison
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
                  <span className="history-item-edits">✏️ {post.editCount}</span>
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
                        {line.type === 'removed' && '− '}
                        {line.content || ' '}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button className="btn btn-secondary" onClick={() => setActiveTab('history')}>
              ← Back to History
            </button>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Instagram Link Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Link to Instagram Post</h2>
              <button className="modal-close" onClick={() => setShowLinkModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Select the Instagram post that matches this logged post:
              </p>
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{selectedPost?.topic}</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {selectedPost?.finalVersion.substring(0, 100)}...
                </p>
              </div>
              
              {loadingInstagram ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading Instagram posts...</p>
                </div>
              ) : instagramPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No Instagram posts found. Make sure your Instagram account is connected in Settings.</p>
                </div>
              ) : (
                <div className="instagram-posts-list">
                  {instagramPosts.map((post) => (
                    <div 
                      key={post.id} 
                      className="instagram-post-option"
                      onClick={() => linkToInstagram(post)}
                    >
                      <div className="instagram-post-caption">
                        {post.caption || '(No caption)'}
                      </div>
                      <div className="instagram-post-meta">
                        <span>❤️ {post.likes}</span>
                        <span>💬 {post.comments}</span>
                        <span>{new Date(post.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={loadInstagramPosts}
                disabled={loadingInstagram}
              >
                {loadingInstagram ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
