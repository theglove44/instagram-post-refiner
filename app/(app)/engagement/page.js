'use client';

import { useState, useEffect, useCallback } from 'react';
import EngagementSubNav from '../../components/EngagementSubNav';

function CommentFilters({ filter, onFilterChange, search, onSearchChange }) {
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unreplied', label: 'Unreplied' },
    { key: 'replied', label: 'Replied' },
    { key: 'hidden', label: 'Hidden' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--bg-input)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
      }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: filter === f.key ? 'var(--accent-soft)' : 'transparent',
              color: filter === f.key ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: filter === f.key ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search comments..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: '200px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'var(--bg-input)',
          color: 'var(--text)',
          fontSize: '14px',
          outline: 'none',
        }}
      />
    </div>
  );
}

function CommentThread({ comment, isSelected, onSelect, onReply, replyingTo, onHide, onDelete }) {
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isReplying = replyingTo === comment.id;

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await onReply(comment.id, replyText.trim());
    setReplyText('');
    setSubmitting(false);
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
      padding: '16px',
      transition: 'border-color 0.15s ease',
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(comment.id)}
          style={{ marginTop: '4px', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>
                {comment.username}
              </span>
              {comment.isHidden && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-muted)',
                }}>
                  Hidden
                </span>
              )}
              {comment.hasReply && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}>
                  Replied
                </span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {comment.timestamp ? new Date(comment.timestamp).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              }) : ''}
            </span>
          </div>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            lineHeight: 1.5,
            margin: '0 0 8px 0',
            wordBreak: 'break-word',
          }}>
            {comment.text}
          </p>

          {comment.postCaption && (
            <p style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              margin: '0 0 10px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              On: {comment.postCaption}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onReply(comment.id, null)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: isReplying ? 'var(--accent-soft)' : 'transparent',
                color: isReplying ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Reply
            </button>
            <button
              onClick={() => onHide(comment.id, !comment.isHidden)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {comment.isHidden ? 'Unhide' : 'Hide'}
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--error)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Delete
            </button>
          </div>

          {isReplying && (
            <div style={{
              marginTop: '12px',
              display: 'flex',
              gap: '8px',
            }}>
              <input
                type="text"
                placeholder="Write a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSubmitReply(); }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || submitting}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: replyText.trim() && !submitting ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: replyText.trim() && !submitting ? '#fff' : 'var(--text-muted)',
                  cursor: replyText.trim() && !submitting ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkActions({ selectedCount, onHide, onMarkRead, onClearSelection }) {
  if (selectedCount === 0) return null;

  return (
    <div style={{
      position: 'sticky',
      bottom: '20px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 20px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 10,
    }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginRight: '8px' }}>
        {selectedCount} selected
      </span>
      <button
        onClick={onHide}
        style={{
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Hide All
      </button>
      <button
        onClick={onMarkRead}
        style={{
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        Mark Read
      </button>
      <button
        onClick={onClearSelection}
        style={{
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Clear
      </button>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ color: 'var(--text)', margin: '0 0 8px 0', fontSize: '18px' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', fontSize: '14px', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--error)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
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

export default function EngagementInboxPage() {
  const [comments, setComments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const normalizeComment = (c) => ({
    id: c.id,
    username: c.username,
    text: c.text,
    timestamp: c.timestamp || c.created_at,
    isHidden: c.is_hidden ?? false,
    hasReply: c.has_reply ?? false,
    postCaption: c.post_caption ?? null,
    instagramMediaId: c.instagram_media_id,
  });

  const fetchComments = useCallback(async (pageNum, append = false) => {
    if (!append) setLoading(true);
    try {
      const params = new URLSearchParams({
        filter,
        search,
        page: String(pageNum),
        limit: '30',
      });
      const res = await fetch(`/api/comments?${params}`);
      const data = await res.json();
      if (data.success) {
        const normalized = (data.comments || []).map(normalizeComment);
        setComments(prev => append ? [...prev, ...normalized] : normalized);
        setTotal(data.total || 0);
      }
    } catch {
      showToast('Failed to fetch comments', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, search, showToast]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    fetchComments(1);
  }, [filter, search, fetchComments]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/comments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Comments synced successfully');
        setPage(1);
        await fetchComments(1);
      } else {
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleReply = async (commentId, message) => {
    if (message === null) {
      setReplyingTo(prev => prev === commentId ? null : commentId);
      return;
    }
    try {
      const res = await fetch('/api/comments/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, message }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Reply sent');
        setReplyingTo(null);
        await fetchComments(1);
      } else {
        showToast(data.error || 'Reply failed', 'error');
      }
    } catch {
      showToast('Reply failed', 'error');
    }
  };

  const handleHide = async (commentId, hide) => {
    try {
      const res = await fetch('/api/comments/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, hide }),
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.map(c =>
          c.id === commentId ? { ...c, isHidden: hide } : c
        ));
        showToast(hide ? 'Comment hidden' : 'Comment unhidden');
      } else {
        showToast(data.error || 'Failed to update comment', 'error');
      }
    } catch {
      showToast('Failed to update comment', 'error');
    }
  };

  const handleDelete = async (commentId) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setTotal(prev => prev - 1);
        setDeleteTarget(null);
        showToast('Comment deleted');
      } else {
        showToast(data.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const handleSelect = (commentId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleBulkHide = async () => {
    try {
      await Promise.all(
        [...selected].map(id =>
          fetch('/api/comments/hide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commentId: id, hide: true }),
          })
        )
      );
      showToast(`${selected.size} comments hidden`);
      setSelected(new Set());
      await fetchComments(1);
    } catch {
      showToast('Bulk hide failed', 'error');
    }
  };

  const handleBulkMarkRead = () => {
    setComments(prev => prev.map(c =>
      selected.has(c.id) ? { ...c, hasReply: true } : c
    ));
    showToast(`${selected.size} comments marked as read`);
    setSelected(new Set());
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments(nextPage, true);
  };

  const hasMore = total > page * 30;

  const emptyMessage = () => {
    if (search) return `No comments matching '${search}'`;
    if (filter === 'unreplied') return 'All caught up! No unreplied comments.';
    return 'No comments yet. Sync to pull in comments from your posts.';
  };

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
          Inbox
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
          {syncing ? 'Syncing...' : 'Refresh Comments'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <CommentFilters
          filter={filter}
          onFilterChange={f => { setFilter(f); setPage(1); }}
          search={search}
          onSearchChange={s => { setSearch(s); setPage(1); }}
        />
      </div>

      {loading && comments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: '15px',
        }}>
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: '15px',
        }}>
          {emptyMessage()}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {comments.map(comment => (
              <CommentThread
                key={comment.id}
                comment={comment}
                isSelected={selected.has(comment.id)}
                onSelect={handleSelect}
                onReply={handleReply}
                replyingTo={replyingTo}
                onHide={handleHide}
                onDelete={id => setDeleteTarget(id)}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                onClick={handleLoadMore}
                disabled={loading}
                style={{
                  padding: '12px 32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      <BulkActions
        selectedCount={selected.size}
        onHide={handleBulkHide}
        onMarkRead={handleBulkMarkRead}
        onClearSelection={() => setSelected(new Set())}
      />

      {deleteTarget && (
        <ConfirmModal
          title="Delete Comment"
          message="Are you sure you want to delete this comment? This action cannot be undone."
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
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
