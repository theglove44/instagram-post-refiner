'use client';

import { useState } from 'react';
import { computeDiff, countEdits } from '@/lib/diff';

const NOTES_TEMPLATE = `VENUE:
WHERE:
TYPE: Feed post / Reel
GIFTED: Yes / No
HAD:
LEAD ON:
HONEST NOTE:
MEDIA NOTES:
HANDLES:
DON'T MENTION:
NOTES/BRAIN DUMP:
`;

export default function EditPage() {
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState(NOTES_TEMPLATE);
  const [original, setOriginal] = useState('');
  const [edited, setEdited] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;

    if (original.trim()) {
      const replace = window.confirm('Replace the current AI draft with a new generate?');
      if (!replace) return;
    }

    setIsGenerating(true);
    setJustSaved(false);
    try {
      const res = await fetch('/api/caption/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'Untitled',
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate caption');
      }
      if (!data.caption?.trim()) {
        throw new Error('Generate returned an empty caption');
      }

      setOriginal(data.caption);
      setEdited('');
      setIsLocked(false);
      showToast('Draft ready — review it, then start editing final');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartEditing = () => {
    if (!original.trim()) {
      showToast('Generate or paste an AI draft first', 'error');
      return;
    }
    setEdited(original);
    setIsLocked(true);
    setJustSaved(false);
  };

  const handleSave = async () => {
    if (!original.trim() || !edited.trim()) {
      showToast('AI draft and final caption are both required', 'error');
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
          notes,
          aiVersion: original,
          finalVersion: edited,
          editCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save post');
      }

      setJustSaved(true);
      showToast(`Saved (${editCount} edit${editCount !== 1 ? 's' : ''}). Copy final into Keep for Michelle.`);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTopic('');
    setNotes(NOTES_TEMPLATE);
    setOriginal('');
    setEdited('');
    setIsLocked(false);
    setJustSaved(false);
  };

  const copyFinalForKeep = async () => {
    if (!edited.trim()) {
      showToast('Nothing to copy yet', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(edited);
      showToast('Copied — paste into Keep for Michelle');
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
          <h1>Voice Workshop</h1>
          <p>Notes in → generate → edit final → copy to Keep for Michelle</p>
        </div>
      </header>

      <div className="input-group editor-topic-field">
        <label htmlFor="post-topic">Topic</label>
        <input
          id="post-topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Berry and Rye, Lidl ice cream, wing night..."
          disabled={isLocked && justSaved}
        />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">
            <span className="step">1</span>
            Notes
          </h2>
        </div>
        <div className="editor-field">
          <label htmlFor="post-notes">Notes template (saved with the pair when you log it)</label>
          <textarea
            id="post-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={14}
            spellCheck
          />
        </div>
        <div className="btn-group" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="loading-spinner" />
                Generating...
              </>
            ) : (
              '\u2728 Generate caption'
            )}
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          Photos stay in Google Keep. Generate fills the AI draft below (or paste from ChatGPT/Claude if you prefer).
        </p>
      </div>

      <div className="main-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="step">2</span>
              AI Draft
            </h2>
            {isLocked && (
              <span className="status-badge status-locked">
                {'\uD83D\uDD12'} Locked
              </span>
            )}
          </div>

          <div className="editor-field">
            <label htmlFor="ai-draft">AI-generated draft</label>
            <textarea
              id="ai-draft"
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              placeholder="Hit Generate caption, or paste a draft here..."
              disabled={isLocked}
              style={isLocked ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            />
          </div>

          {!isLocked && (
            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={handleStartEditing}
                disabled={!original.trim()}
              >
                {'\u270F\uFE0F'} Start editing final
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="step">3</span>
              Final caption
            </h2>
          </div>

          <div className="editor-field">
            <label htmlFor="refined-version">Your final caption (what Michelle posts)</label>
            <textarea
              id="refined-version"
              value={edited}
              onChange={(e) => {
                setEdited(e.target.value);
                setJustSaved(false);
              }}
              placeholder={isLocked ? 'Edit until it sounds like you...' : 'Lock the AI draft first, then refine here...'}
              disabled={!isLocked}
              style={!isLocked ? { opacity: 0.4 } : {}}
            />
          </div>

          <div className="btn-group" style={{ flexWrap: 'wrap' }}>
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
                '\uD83D\uDCBE Save pair'
              )}
            </button>
            <button
              className="btn btn-primary"
              onClick={copyFinalForKeep}
              disabled={!edited.trim()}
            >
              {'\uD83D\uDCCB'} Copy final for Keep
            </button>
            {isLocked && (
              <button
                className="btn btn-secondary"
                onClick={handleReset}
              >
                {'\uD83D\uDD04'} New post
              </button>
            )}
          </div>

          {justSaved && (
            <p style={{ color: 'var(--success)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
              Pair saved. Hit Copy final for Keep, paste into Google Keep, Michelle posts from there.
            </p>
          )}
        </div>
      </div>

      {isLocked && hasChanges && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">{'\uD83D\uDCCA'} Your changes</h2>
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

      {!isLocked && !original && (
        <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Daily loop
          </h3>
          <div className="workflow-container">
            <div className="workflow-step">
              <span className="workflow-icon">{'\uD83D\uDDBC\uFE0F'}</span>
              <span className="workflow-label">Photos<br/>in Keep</span>
            </div>
            <span className="workflow-arrow">{'\u2192'}</span>
            <div className="workflow-step">
              <span className="workflow-icon">{'\u2728'}</span>
              <span className="workflow-label">Notes +<br/>Generate</span>
            </div>
            <span className="workflow-arrow">{'\u2192'}</span>
            <div className="workflow-step">
              <span className="workflow-icon">{'\u270F\uFE0F'}</span>
              <span className="workflow-label">Edit to<br/>your voice</span>
            </div>
            <span className="workflow-arrow">{'\u2192'}</span>
            <div className="workflow-step">
              <span className="workflow-icon">{'\uD83D\uDCCB'}</span>
              <span className="workflow-label">Copy final<br/>to Keep</span>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          {toast.type === 'success' ? '\u2713' : '\u2715'} {toast.message}
        </div>
      )}
    </div>
  );
}
