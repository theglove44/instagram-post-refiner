'use client';

import { useState, useEffect, useCallback } from 'react';
import EngagementSubNav from '../../../components/EngagementSubNav';

function MentionCard({ mention, onMarkSeen }) {
  const isSeen = mention.status === 'seen';

  return (
    <div
      onClick={() => { if (!isSeen) onMarkSeen(mention.id); }}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isSeen ? 'var(--border)' : 'var(--accent)'}`,
        padding: '16px',
        cursor: isSeen ? 'default' : 'pointer',
        transition: 'border-color 0.15s ease, opacity 0.15s ease',
        opacity: isSeen ? 0.7 : 1,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>
            {mention.username}
          </span>
          {!isSeen && (
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'inline-block',
            }} />
          )}
        </div>
        <span style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          background: mention.type === 'tag' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
          color: mention.type === 'tag' ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          {mention.type === 'tag' ? 'Tagged' : 'Mentioned'}
        </span>
      </div>

      {mention.caption && (
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          lineHeight: 1.5,
          margin: '0 0 10px 0',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}>
          {mention.caption}
        </p>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {mention.timestamp ? new Date(mention.timestamp).toLocaleDateString('en-AU', {
            day: 'numeric', month: 'short', year: 'numeric',
          }) : ''}
        </span>
        {mention.permalink && (
          <a
            href={mention.permalink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '12px',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            View on Instagram
          </a>
        )}
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      padding: '12px 20px',
      borderRadius: 'var(--radius-sm)',
      background: type === 'error' ? 'var(--error)' : 'var(--success)',
      color: '#fff',
      fontSize: '14px',
      fontWeight: 500,
      zIndex: 200,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      {message}
    </div>
  );
}

export default function MentionsPage() {
  const [mentions, setMentions] = useState([]);
  const [type, setType] = useState('tag');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, toastType = 'success') => {
    setToast({ message, type: toastType });
  }, []);

  const fetchMentions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mentions?type=${type}`);
      const data = await res.json();
      if (data.success) {
        setMentions((data.mentions || []).map(m => ({
          id: m.id,
          username: m.username,
          caption: m.caption,
          timestamp: m.timestamp || m.created_at,
          type: m.type,
          status: m.status,
          permalink: m.permalink ?? null,
        })));
      }
    } catch {
      showToast('Failed to fetch mentions', 'error');
    } finally {
      setLoading(false);
    }
  }, [type, showToast]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/mentions/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Mentions synced');
        setTimeout(() => fetchMentions(), 5000);
      } else {
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkSeen = async (id) => {
    try {
      const res = await fetch(`/api/mentions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seen' }),
      });
      const data = await res.json();
      if (data.success) {
        setMentions(prev => prev.map(m =>
          m.id === id ? { ...m, status: 'seen' } : m
        ));
      }
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const tabs = [
    { key: 'tag', label: 'Tags' },
    { key: 'mention', label: '@Mentions' },
  ];

  const emptyMessage = type === 'tag'
    ? 'No one has tagged you in their posts yet'
    : 'No @mentions found';

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <EngagementSubNav />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <h1 style={{ color: 'var(--text)', fontSize: '28px', fontWeight: 700, margin: 0 }}>
          Mentions & Tags
        </h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: syncing ? 'var(--bg-elevated)' : 'var(--accent)',
            color: syncing ? 'var(--text-muted)' : '#fff',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--bg-input)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        marginBottom: '20px',
        width: 'fit-content',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: type === tab.key ? 'var(--accent-soft)' : 'transparent',
              color: type === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: type === tab.key ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: '15px',
        }}>
          Loading...
        </div>
      ) : mentions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: '15px',
        }}>
          {emptyMessage}
        </div>
      ) : (
        <div className="mentions-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}>
          <style>{`
            @media (max-width: 768px) {
              .mentions-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
          {mentions.map(mention => (
            <MentionCard
              key={mention.id}
              mention={mention}
              onMarkSeen={handleMarkSeen}
            />
          ))}
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
