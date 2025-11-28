'use client';

import { useState, useEffect, useCallback } from 'react';

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
  const [draft, setDraft] = useState('');
  const [refined, setRefined] = useState('');
  const [final, setFinal] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('refine');
  const [selectedPost, setSelectedPost] = useState(null);

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

  const handleRefine = async () => {
    if (!draft.trim()) {
      showToast('Please enter a draft post', 'error');
      return;
    }

    setIsRefining(true);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, topic }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refine post');
      }
      
      setRefined(data.refined);
      setFinal(data.refined); // Pre-fill final with refined
      showToast('Post refined successfully!');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsRefining(false);
    }
  };

  const handleSave = async () => {
    if (!refined || !final.trim()) {
      showToast('Please refine a post first', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const editCount = countEdits(refined, final);
      
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'Untitled',
          aiVersion: refined,
          finalVersion: final,
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
      setDraft('');
      setRefined('');
      setFinal('');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
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

  const diff = refined && final ? computeDiff(refined, final) : [];
  const editCount = refined && final ? countEdits(refined, final) : 0;
  const hasChanges = refined !== final;

  return (
    <div className="container">
      <header className="header">
        <h1>📸 Instagram Post Refiner</h1>
        <p>Paste your Claude draft → Refine to your voice → Edit & Log for training</p>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'refine' ? 'active' : ''}`}
          onClick={() => setActiveTab('refine')}
        >
          ✨ Refine Post
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

      {activeTab === 'refine' && (
        <>
          <div className="main-grid">
            {/* Left Column - Input */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="step">1</span>
                  Paste Draft
                </h2>
              </div>
              
              <div className="input-group">
                <label>Topic (optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Selfridges Food Hall, M&S Night..."
                />
              </div>
              
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste the draft Instagram post from Claude here..."
              />
              
              <div className="btn-group">
                <button 
                  className="btn btn-primary"
                  onClick={handleRefine}
                  disabled={isRefining || !draft.trim()}
                >
                  {isRefining ? (
                    <>
                      <span className="loading-spinner" />
                      Refining...
                    </>
                  ) : (
                    '✨ Refine Post'
                  )}
                </button>
              </div>
            </div>

            {/* Right Column - Output */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <span className="step">2</span>
                  Edit & Finalize
                </h2>
                {refined && (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(final)}
                  >
                    📋 Copy
                  </button>
                )}
              </div>
              
              <textarea
                value={final}
                onChange={(e) => setFinal(e.target.value)}
                placeholder="Refined post will appear here. Edit it to perfect your voice..."
                disabled={!refined}
              />
              
              <div className="btn-group">
                <button 
                  className="btn btn-success"
                  onClick={handleSave}
                  disabled={isSaving || !refined || !final.trim()}
                >
                  {isSaving ? (
                    <>
                      <span className="loading-spinner" />
                      Saving...
                    </>
                  ) : (
                    '💾 Log Post'
                  )}
                </button>
                {refined && (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setFinal(refined)}
                  >
                    ↩️ Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Diff View */}
          {refined && hasChanges && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header">
                <h2 className="card-title">📊 Changes Preview</h2>
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
              <p>No posts logged yet. Refine and log your first post!</p>
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
              <h2 className="card-title">🤖 AI Version</h2>
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
