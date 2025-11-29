'use client';

import { useState, useEffect } from 'react';

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

  // Load history on mount
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

  return (
    <div className="container">
      <header className="header">
        <h1>📸 Instagram Post Logger</h1>
        <p>Paste from Claude Chat → Edit to your voice → Log for training</p>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          ✏️ Edit Post
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📚 History ({history.length})
        </button>
        {selectedPost && (
          <button 
            className={`tab ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            👁️ View Post
          </button>
        )}
      </div>

      {activeTab === 'edit' && (
        <>
          <div className="main-grid">
            {/* Left Column - Original from Claude */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="step">1</span>
                  Original (from Claude)
                </h2>
                {isLocked && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--warning)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px'
                  }}>
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
                style={isLocked ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
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
                  >
                    📋 Copy
                  </button>
                )}
              </div>
              
              <div className="input-group" style={{ visibility: 'hidden' }}>
                <label>Spacer</label>
                <input type="text" disabled />
              </div>
              
              <textarea
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                placeholder={isLocked ? "Edit the post here to match your voice..." : "Click 'Start Editing' first to lock the original..."}
                disabled={!isLocked}
                style={!isLocked ? { opacity: 0.5 } : {}}
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
                    + {diff.filter(d => d.type === 'added').length} added
                  </span>
                  <span className="diff-stat removed">
                    - {diff.filter(d => d.type === 'removed').length} removed
                  </span>
                </div>
              </div>
              
              <div className="diff-container">
                {diff.map((line, i) => (
                  <div key={i} className={`diff-line ${line.type}`}>
                    {line.type === 'added' && '+ '}
                    {line.type === 'removed' && '- '}
                    {line.content || ' '}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow reminder */}
          {!isLocked && !original && (
            <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Workflow</h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Get post from<br/>Claude Chat</div>
                </div>
                <div style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>→</div>
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Paste &<br/>lock original</div>
                </div>
                <div style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>→</div>
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✏️</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Edit to<br/>your voice</div>
                </div>
                <div style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>→</div>
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💾</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Log for<br/>training</div>
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {history.length} post{history.length !== 1 ? 's' : ''} logged
            </span>
          </div>
          
          {history.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/>
                <path d="M12 8v8"/>
                <path d="M8 12h8"/>
              </svg>
              <p>No posts logged yet. Edit and log your first post!</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((post) => (
                <div 
                  key={post.id} 
                  className="history-item"
                  onClick={() => viewPost(post)}
                >
                  <div className="history-item-header">
                    <span className="history-item-topic">{post.topic}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="history-item-edits">
                        ✏️ {post.editCount} edit{post.editCount !== 1 ? 's' : ''}
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
                    {post.finalVersion.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'view' && selectedPost && (
        <div className="main-grid">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🤖 Original (Claude)</h2>
              <button 
                className="btn btn-secondary"
                onClick={() => copyToClipboard(selectedPost.aiVersion)}
              >
                📋 Copy
              </button>
            </div>
            <div style={{ 
              background: 'var(--bg-input)', 
              padding: '1rem', 
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              {selectedPost.aiVersion}
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">✅ Final Version</h2>
              <button 
                className="btn btn-secondary"
                onClick={() => copyToClipboard(selectedPost.finalVersion)}
              >
                📋 Copy
              </button>
            </div>
            <div style={{ 
              background: 'var(--bg-input)', 
              padding: '1rem', 
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              {selectedPost.finalVersion}
            </div>
          </div>
          
          {/* Diff for selected post */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
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
                  {line.type === 'removed' && '- '}
                  {line.content || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
