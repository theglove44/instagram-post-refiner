'use client';

import { useState, useEffect } from 'react';
import { computeDiff, countEdits } from '@/lib/diff';

export default function EditPage() {
  const [topic, setTopic] = useState('');
  const [original, setOriginal] = useState('');
  const [edited, setEdited] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

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

  const diff = original && edited && isLocked ? computeDiff(original, edited) : [];
  const editCount = original && edited && isLocked ? countEdits(original, edited) : 0;
  const hasChanges = original !== edited;

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>Edit Post</h1>
          <p>Paste from Claude Chat, edit to your voice, log for training</p>
        </div>
      </header>

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
                {'\uD83D\uDD12'} Locked
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
                {'\u270F\uFE0F'} Start Editing
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
                {'\uD83D\uDCCB'} Copy
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
                '\uD83D\uDCBE Log & Save'
              )}
            </button>
            {isLocked && (
              <button
                className="btn btn-secondary"
                onClick={handleReset}
              >
                {'\uD83D\uDD04'} Start Over
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Diff View */}
      {isLocked && hasChanges && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">{'\uD83D\uDCCA'} Your Changes</h2>
            <div className="diff-stats">
              <span className="diff-stat edits">
                {'\u270F\uFE0F'} {editCount} edit{editCount !== 1 ? 's' : ''}
              </span>
              <span className="diff-stat added">
                + {diff.filter(d => d.type === 'added').length}
              </span>
              <span className="diff-stat removed">
                {'\u2212'} {diff.filter(d => d.type === 'removed').length}
              </span>
            </div>
          </div>

          <div className="diff-container">
            {diff.map((line, i) => (
              <div key={i} className={`diff-line ${line.type}`}>
                {line.type === 'added' && '+ '}
                {line.type === 'removed' && '\u2212 '}
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
              <span className="workflow-icon">{'\uD83D\uDCAC'}</span>
              <span className="workflow-label">Get post from<br/>Claude Chat</span>
            </div>
            <span className="workflow-arrow">{'\u2192'}</span>
            <div className="workflow-step">
              <span className="workflow-icon">{'\uD83D\uDCCB'}</span>
              <span className="workflow-label">Paste &<br/>lock original</span>
            </div>
            <span className="workflow-arrow">{'\u2192'}</span>
            <div className="workflow-step">
              <span className="workflow-icon">{'\u270F\uFE0F'}</span>
              <span className="workflow-label">Edit to<br/>your voice</span>
            </div>
            <span className="workflow-arrow">{'\u2192'}</span>
            <div className="workflow-step">
              <span className="workflow-icon">{'\uD83D\uDCBE'}</span>
              <span className="workflow-label">Log for<br/>training</span>
            </div>
          </div>
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
