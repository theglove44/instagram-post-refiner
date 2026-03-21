'use client';

import { useMemo } from 'react';

const CAPTION_TRUNCATE = 125;

function separateHashtags(text) {
  if (!text) return { body: '', hashtags: '' };
  const lines = text.split('\n');
  const hashtagLines = [];
  const bodyLines = [];
  let foundHashtagBlock = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!foundHashtagBlock && (trimmed === '' || /^[#\s]+$/.test(trimmed) || /^(#\w+\s*)+$/.test(trimmed))) {
      if (trimmed) {
        hashtagLines.unshift(trimmed);
        foundHashtagBlock = true;
      }
    } else if (foundHashtagBlock && /^(#\w+\s*)+$/.test(trimmed)) {
      hashtagLines.unshift(trimmed);
    } else {
      bodyLines.push(lines[i]);
      if (foundHashtagBlock) break;
      // If we hit non-hashtag content without finding hashtags, put everything back
    }
  }

  if (!foundHashtagBlock) {
    return { body: text, hashtags: '' };
  }

  const remaining = lines.slice(0, lines.length - hashtagLines.length).join('\n').trimEnd();
  return { body: remaining, hashtags: hashtagLines.join(' ') };
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export default function PostPreview({ caption, mediaUrls = [], mediaType, username, profilePicture }) {
  const { body, hashtags } = useMemo(() => separateHashtags(caption), [caption]);

  const isTruncated = body && body.length > CAPTION_TRUNCATE;
  const displayBody = isTruncated ? body.slice(0, CAPTION_TRUNCATE) : body;

  const isCarousel = mediaType === 'CAROUSEL' || mediaUrls.length > 1;
  const isVideo = mediaType === 'REELS' || mediaType === 'VIDEO';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        fontFamily: "'Outfit', sans-serif",
        boxShadow: 'var(--shadow-md)',
        maxWidth: '468px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {profilePicture ? (
            <img
              src={profilePicture}
              alt={username}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
            />
          )}
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
            {username || 'username'}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="var(--text-secondary)"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </div>

      {/* Media area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '200px',
          maxHeight: '400px',
          background: 'var(--bg-input)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {mediaUrls.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '60px 0',
            }}
          >
            <CameraIcon />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No media</span>
          </div>
        ) : isVideo ? (
          <video
            src={mediaUrls[0]}
            controls
            style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <img
            src={mediaUrls[0]}
            alt="Post media"
            style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      {/* Carousel dots */}
      {isCarousel && mediaUrls.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '4px',
            padding: '8px 0',
          }}
        >
          {mediaUrls.map((_, i) => (
            <div
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: i === 0 ? 'var(--accent)' : 'var(--text-muted)',
                opacity: i === 0 ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      {/* Action icons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px 4px',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', gap: '14px' }}>
          <HeartIcon />
          <CommentIcon />
          <ShareIcon />
        </div>
        <BookmarkIcon />
      </div>

      {/* Caption */}
      {(body || hashtags) && (
        <div style={{ padding: '6px 14px 10px' }}>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text)' }}>
            <span style={{ fontWeight: 600, marginRight: '6px' }}>{username || 'username'}</span>
            {displayBody}
            {isTruncated && (
              <span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>... more</span>
            )}
          </div>
          {hashtags && (
            <div
              style={{
                marginTop: '4px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: '1.5',
                wordBreak: 'break-word',
              }}
            >
              {hashtags}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '0 14px 12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          View all 0 comments
        </span>
      </div>
    </div>
  );
}
