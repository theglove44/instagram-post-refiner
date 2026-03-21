'use client';

import { useState, useRef, useCallback } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';

function getMediaTypeBadge(media) {
  if (!media || media.length === 0) return null;
  const hasVideo = media.some((m) => m.mimeType?.startsWith('video/'));
  if (hasVideo) return 'REEL';
  if (media.length > 1) return `CAROUSEL (${media.length})`;
  return 'IMAGE';
}

function UploadProgress({ fileName, progress }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '4px',
          }}
        >
          {fileName}
        </div>
        <div
          style={{
            height: '3px',
            background: 'var(--bg-input)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
        {progress}%
      </span>
    </div>
  );
}

export default function MediaUploader({ scheduledPostId, media = [], onMediaChange, onEnsureDraft, disabled }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const fileInputRef = useRef(null);

  const uploadFile = useCallback(
    async (file) => {
      // Ensure a draft exists before uploading
      let postId = scheduledPostId;
      if (!postId && onEnsureDraft) {
        postId = await onEnsureDraft();
      }
      if (!postId) return;

      const uploadId = `${file.name}-${Date.now()}`;

      setUploads((prev) => [...prev, { id: uploadId, fileName: file.name, progress: 0 }]);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('scheduledPostId', postId);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u))
          );
        }
      });

      xhr.addEventListener('load', () => {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        if (xhr.status >= 200 && xhr.status < 300) {
          onMediaChange?.(postId);
        }
      });

      xhr.addEventListener('error', () => {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      });

      xhr.open('POST', '/api/publish/upload');
      xhr.send(formData);
    },
    [scheduledPostId, onMediaChange, onEnsureDraft]
  );

  const handleFiles = useCallback(
    async (files) => {
      if (disabled) return;
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
    },
    [disabled, uploadFile]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileSelect = (e) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDelete = async (mediaId) => {
    try {
      await fetch(`/api/publish/upload?id=${mediaId}`, { method: 'DELETE' });
      onMediaChange?.();
    } catch {
      // Silently fail, parent can re-fetch
    }
  };

  const handleReorder = async (mediaId, direction) => {
    // Build new order by swapping the item with its neighbor
    const sorted = [...media].sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0));
    const idx = sorted.findIndex((m) => m.id === mediaId);
    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Swap positions
    const newOrder = sorted.map((m, i) => {
      if (i === idx) return { id: m.id, sortOrder: swapIdx };
      if (i === swapIdx) return { id: m.id, sortOrder: idx };
      return { id: m.id, sortOrder: i };
    });

    const postId = scheduledPostId || sorted[0]?.scheduled_post_id;
    if (!postId) return;

    try {
      await fetch('/api/publish/upload/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledPostId: postId, order: newOrder }),
      });
      onMediaChange?.(postId);
    } catch {
      // Silently fail
    }
  };

  const badge = getMediaTypeBadge(media);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        transition: `opacity 0.2s var(--ease-out)`,
      }}
    >
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '32px 16px',
          border: `2px dashed ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          background: isDragOver ? 'var(--accent-soft)' : 'var(--bg-input)',
          cursor: 'pointer',
          transition: `all 0.2s var(--ease-out)`,
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDragOver ? 'var(--accent)' : 'var(--text-muted)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span
          style={{
            fontSize: '13px',
            color: isDragOver ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Drop files here or click to upload
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {uploads.map((u) => (
            <UploadProgress key={u.id} fileName={u.fileName} progress={u.progress} />
          ))}
        </div>
      )}

      {/* Media type badge */}
      {badge && (
        <div
          style={{
            alignSelf: 'flex-start',
            padding: '3px 10px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.5px',
          }}
        >
          {badge}
        </div>
      )}

      {/* Media grid */}
      {media.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              media.some((m) => m.mimeType?.startsWith('video/')) ? '1fr' : '1fr 1fr',
            gap: '10px',
          }}
        >
          {media.map((item, index) => {
            const isVideo = item.mimeType?.startsWith('video/');
            return (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                {isVideo ? (
                  <video
                    src={item.publicUrl}
                    controls
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <img
                    src={item.publicUrl}
                    alt={item.fileName}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}

                {/* File name */}
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {item.fileName}
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: 'none',
                    borderRadius: '50%',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    lineHeight: 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {/* Reorder arrows */}
                {media.length > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    {index > 0 && (
                      <button
                        onClick={() => handleReorder(item.id, 'up')}
                        style={{
                          width: '22px',
                          height: '22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                    )}
                    {index < media.length - 1 && (
                      <button
                        onClick={() => handleReorder(item.id, 'down')}
                        style={{
                          width: '22px',
                          height: '22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
