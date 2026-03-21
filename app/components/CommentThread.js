'use client';

import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

function relativeTime(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return new Date(timestamp).toLocaleDateString();
}

function avatarColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function Avatar({ username, size = 32 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: avatarColor(username),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 600,
        color: '#fff',
        textTransform: 'uppercase',
      }}
    >
      {username[0]}
    </div>
  );
}

function StatusDot({ replyStatus }) {
  const colors = {
    unreplied: 'var(--error)',
    replied: 'var(--success)',
    ignored: 'var(--text-dim)',
  };
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[replyStatus] || colors.unreplied,
        display: 'inline-block',
        flexShrink: 0,
      }}
      title={replyStatus}
    />
  );
}

export default function CommentThread({
  comment,
  onReply,
  onHide,
  onDelete,
  isReplying: isReplyingProp = false,
  connectedUsername,
  selected = false,
  onSelect,
}) {
  const [showReplyInput, setShowReplyInput] = useState(isReplyingProp);
  const [replyText, setReplyText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSendReply = () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    onReply(comment.id, trimmed);
    setReplyText('');
    setShowReplyInput(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const isHidden = comment.isHidden;

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          opacity: isHidden ? 0.55 : 1,
        }}
      >
        {/* Checkbox */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            paddingTop: '4px',
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(comment.id, e.target.checked)}
            style={{
              width: 16,
              height: 16,
              accentColor: 'var(--accent)',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px',
            }}
          >
            <Avatar username={comment.username} />
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text)',
              }}
            >
              {comment.username}
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-dim)',
              }}
            >
              {relativeTime(comment.timestamp)}
            </span>
            <StatusDot replyStatus={comment.replyStatus} />
            {isHidden && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--warning-soft)',
                  color: 'var(--warning)',
                  fontWeight: 500,
                }}
              >
                Hidden
              </span>
            )}
          </div>

          {/* Comment text */}
          <p
            style={{
              margin: '0 0 6px 0',
              fontSize: '0.88rem',
              color: isHidden ? 'var(--text-dim)' : 'var(--text)',
              lineHeight: 1.5,
              textDecoration: isHidden ? 'line-through' : 'none',
            }}
          >
            {comment.text}
          </p>

          {/* Post context */}
          {comment.postContext && (
            <p
              style={{
                margin: '0 0 10px 0',
                fontSize: '0.78rem',
                color: 'var(--text-dim)',
              }}
            >
              on:{' '}
              {comment.postContext.topic || comment.postContext.captionPreview}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Reply
            </button>
            <button
              onClick={() => onHide(comment.id, !isHidden)}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--warning)';
                e.currentTarget.style.color = 'var(--warning)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {isHidden ? 'Unhide' : 'Hide'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--error)';
                e.currentTarget.style.color = 'var(--error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Delete
            </button>
          </div>

          {/* Reply thread */}
          {comment.replies?.length > 0 && (
            <div
              style={{
                marginTop: '14px',
                paddingLeft: '16px',
                borderLeft: '2px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {comment.replies.map((reply) => (
                <div
                  key={reply.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: reply.isOwnReply
                      ? '3px solid var(--accent-soft)'
                      : 'none',
                  }}
                >
                  <Avatar username={reply.username} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          color: reply.isOwnReply
                            ? 'var(--accent)'
                            : 'var(--text)',
                        }}
                      >
                        {reply.username}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                        }}
                      >
                        {relativeTime(reply.timestamp)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.84rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.45,
                      }}
                    >
                      {reply.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          {showReplyInput && (
            <div style={{ marginTop: '12px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  color: 'var(--text-dim)',
                  marginBottom: '6px',
                }}
              >
                Replying to @{comment.username}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a reply..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-active)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.83rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: replyText.trim()
                      ? 'var(--accent)'
                      : 'var(--bg-elevated)',
                    color: replyText.trim() ? '#fff' : 'var(--text-dim)',
                    cursor: replyText.trim() ? 'pointer' : 'default',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(comment.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Comment"
        message={`Delete this comment from @${comment.username}? This action cannot be undone.`}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </>
  );
}
