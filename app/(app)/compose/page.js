'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MediaUploader from '../../components/MediaUploader';
import CaptionEditor from '../../components/CaptionEditor';
import SchedulePicker from '../../components/SchedulePicker';
import PostPreview from '../../components/PostPreview';
import HashtagPicker from '../../components/HashtagPicker';
import TemplatePicker from '../../components/TemplatePicker';
import PublishStatus from '../../components/PublishStatus';

// Determine the effective media type from the media array
function deriveMediaType(mediaItems) {
  if (!mediaItems || mediaItems.length === 0) return 'IMAGE';
  const hasVideo = mediaItems.some(
    (m) => m.mime_type?.startsWith('video/') || m.mimeType?.startsWith('video/')
  );
  if (hasVideo) return 'REELS';
  if (mediaItems.length > 1) return 'CAROUSEL';
  return 'IMAGE';
}

// Extract public URLs from media upload records
function getMediaUrls(mediaItems) {
  if (!mediaItems || mediaItems.length === 0) return [];
  return mediaItems.map((m) => m.public_url || m.publicUrl || '').filter(Boolean);
}

export default function ComposePage() {
  return (
    <Suspense fallback={
      <div className="container">
        <header className="header"><div className="header-main"><h1>Compose</h1></div></header>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        </div>
      </div>
    }>
      <ComposePageInner />
    </Suspense>
  );
}

function ComposePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Core state
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [media, setMedia] = useState([]);
  const [scheduledPostId, setScheduledPostId] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showHashtagPicker, setShowHashtagPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [bestTimes, setBestTimes] = useState([]);
  const [account, setAccount] = useState(null);
  const [rateLimit, setRateLimit] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [toast, setToast] = useState(null);

  // Draft save tracking
  const [draftStatus, setDraftStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [existingStatus, setExistingStatus] = useState(null); // for PublishStatus badge
  const autoSaveTimer = useRef(null);
  const toastTimer = useRef(null);
  const pollTimer = useRef(null);
  const sourcePostId = useRef(null);
  const isInitialLoad = useRef(true);

  // ------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ------------------------------------------------------------------
  // Data fetching on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    const editId = searchParams.get('id');
    const fromPostId = searchParams.get('sourcePostId');

    // Load existing draft
    if (editId) {
      fetch(`/api/publish/draft?id=${editId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.post) {
            setScheduledPostId(data.post.id);
            setCaption(data.post.caption || '');
            setAltText(data.post.alt_text || '');
            setMedia(data.media || []);
            setExistingStatus(data.post.status);
            sourcePostId.current = data.post.source_post_id || null;
          }
        })
        .catch(() => {});
    }

    // Pre-fill caption from Edit page flow
    if (fromPostId) {
      sourcePostId.current = fromPostId;
      fetch('/api/posts')
        .then((res) => res.json())
        .then((data) => {
          const posts = data.posts || data.data || [];
          const match = posts.find(
            (p) => String(p.post_id) === fromPostId || String(p.id) === fromPostId
          );
          if (match) {
            setCaption(match.final_version || match.finalVersion || '');
          }
        })
        .catch(() => {});
    }

    // Account info
    fetch('/api/instagram/account')
      .then((res) => res.json())
      .then((data) => {
        if (data.account || data.username) {
          setAccount(data.account || data);
        }
      })
      .catch(() => {});

    // Best posting times
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/publish/best-times?timezone=${encodeURIComponent(tz)}&limit=5`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bestTimes) setBestTimes(data.bestTimes);
      })
      .catch(() => {});

    // Publishing rate limit
    fetch('/api/publish/limit')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRateLimit(data);
      })
      .catch(() => {});

    // Mark initial load complete after a tick so auto-save doesn't fire immediately
    const t = setTimeout(() => {
      isInitialLoad.current = false;
    }, 500);

    return () => {
      clearTimeout(t);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Auto-save draft (debounced 2s)
  // ------------------------------------------------------------------
  const saveDraft = useCallback(
    async (opts = {}) => {
      const currentCaption = opts.caption ?? caption;
      const currentAltText = opts.altText ?? altText;
      const currentMediaType = deriveMediaType(media);

      setDraftStatus('saving');

      try {
        const body = {
          caption: currentCaption,
          mediaType: currentMediaType,
          altText: currentAltText || null,
          sourcePostId: sourcePostId.current || null,
        };

        if (scheduledPostId) {
          body.id = scheduledPostId;
        }

        const res = await fetch('/api/publish/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setDraftStatus('error');
          return null;
        }

        if (!scheduledPostId && data.post?.id) {
          setScheduledPostId(data.post.id);
        }

        setDraftStatus('saved');
        return data.post?.id || scheduledPostId;
      } catch {
        setDraftStatus('error');
        return null;
      }
    },
    [caption, altText, media, scheduledPostId]
  );

  // Trigger auto-save when caption or altText changes (debounced)
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (!caption.trim()) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft();
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [caption, altText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleInsertHashtags = useCallback(
    (hashtag) => {
      const tag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
      setCaption((prev) => {
        const separator = prev.endsWith('\n') || prev.endsWith(' ') || !prev ? '' : ' ';
        return prev + separator + tag;
      });
    },
    []
  );

  // Ensure a draft exists, creating one if needed. Returns the draft ID.
  const ensureDraftExists = useCallback(async () => {
    if (scheduledPostId) return scheduledPostId;

    try {
      const res = await fetch('/api/publish/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: caption || '',
          mediaType: 'IMAGE',
          sourcePostId: sourcePostId.current || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.post?.id) {
        setScheduledPostId(data.post.id);
        return data.post.id;
      }
    } catch {
      // fall through
    }
    return null;
  }, [scheduledPostId, caption]);

  const handleMediaChange = useCallback(async (postId) => {
    const id = postId || scheduledPostId;
    if (!id) return;
    try {
      const res = await fetch(`/api/publish/draft?id=${id}`);
      const data = await res.json();
      if (data.success) {
        setMedia(data.media || []);
      }
    } catch {
      // Silent fail — media state will be stale but non-blocking
    }
  }, [scheduledPostId]);

  const handleLoadTemplate = useCallback(
    (templateCaption) => {
      setCaption(templateCaption);
      setShowTemplatePicker(false);
    },
    []
  );

  const ensureDraftSaved = useCallback(async () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    const id = await saveDraft();
    return id;
  }, [saveDraft]);

  const handlePublishNow = useCallback(async () => {
    setIsPublishing(true);
    setPublishResult(null);

    try {
      const id = await ensureDraftSaved();
      if (!id) {
        showToast('Failed to save draft before publishing', 'error');
        setIsPublishing(false);
        return;
      }

      const res = await fetch('/api/publish/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to start publishing', 'error');
        setIsPublishing(false);
        return;
      }

      // Poll for completion
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/publish/status?id=${id}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'published') {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
            setIsPublishing(false);
            setExistingStatus('published');
            setPublishResult({
              type: 'success',
              permalink: statusData.igPermalink,
            });
            showToast('Post published successfully!');
          } else if (statusData.status === 'failed') {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
            setIsPublishing(false);
            setExistingStatus('failed');
            showToast(statusData.publishError || 'Publishing failed', 'error');
          }
        } catch {
          // Keep polling on network errors
        }
      }, 2000);
    } catch (err) {
      showToast(err.message || 'Publishing failed', 'error');
      setIsPublishing(false);
    }
  }, [ensureDraftSaved, showToast]);

  const handleSchedule = useCallback(
    async ({ scheduledAt, timezone }) => {
      try {
        const id = await ensureDraftSaved();
        if (!id) {
          showToast('Failed to save draft before scheduling', 'error');
          return;
        }

        const res = await fetch('/api/publish/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, scheduledAt, timezone }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          showToast(data.error || 'Failed to schedule post', 'error');
          return;
        }

        const d = new Date(scheduledAt);
        const formatted = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        showToast(`Post scheduled for ${formatted}`);

        setTimeout(() => router.push('/queue'), 2000);
      } catch (err) {
        showToast(err.message || 'Scheduling failed', 'error');
      }
    },
    [ensureDraftSaved, showToast, router]
  );

  const handleSaveDraft = useCallback(async () => {
    const id = await ensureDraftSaved();
    if (id) {
      showToast('Draft saved');
    } else {
      showToast('Failed to save draft', 'error');
    }
  }, [ensureDraftSaved, showToast]);

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------
  const mediaType = deriveMediaType(media);
  const mediaUrls = getMediaUrls(media);
  const username = account?.username || account?.name || '';
  const profilePicture = account?.profile_picture_url || account?.profilePicture || '';
  const showAltText = mediaType === 'IMAGE';

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          paddingTop: '0.5rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: 'var(--text)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Compose
          </h1>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              margin: '0.25rem 0 0',
            }}
          >
            Create and publish content
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Draft save indicator */}
          {draftStatus && (
            <span
              style={{
                fontSize: '0.75rem',
                color:
                  draftStatus === 'saved'
                    ? 'var(--success)'
                    : draftStatus === 'error'
                      ? 'var(--error)'
                      : 'var(--text-muted)',
                transition: 'opacity 0.3s ease',
              }}
            >
              {draftStatus === 'saving' && 'Saving...'}
              {draftStatus === 'saved' && 'Saved'}
              {draftStatus === 'error' && 'Save failed'}
            </span>
          )}

          {/* Status badge for existing drafts */}
          {existingStatus && existingStatus !== 'draft' && (
            <PublishStatus status={existingStatus} />
          )}
        </div>
      </header>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '1.5rem',
        }}
        className="compose-grid"
      >
        {/* ============ LEFT COLUMN: Editor ============ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            minWidth: 0,
          }}
          className="compose-editor"
        >
          {/* Section 1: Media Upload */}
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <h2 style={sectionHeadingStyle}>Media</h2>
            <MediaUploader
              scheduledPostId={scheduledPostId}
              media={media}
              onMediaChange={handleMediaChange}
              onEnsureDraft={ensureDraftExists}
            />
          </section>

          {/* Section 2: Caption Editor */}
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <h2 style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Caption</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowHashtagPicker(true)}
                  style={toolButtonStyle}
                  title="Insert hashtags"
                >
                  #
                </button>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  style={toolButtonStyle}
                  title="Load template"
                >
                  <TemplateIcon />
                </button>
              </div>
            </div>
            <CaptionEditor
              caption={caption}
              onCaptionChange={setCaption}
              onInsertHashtags={() => setShowHashtagPicker(true)}
              onLoadTemplate={() => setShowTemplatePicker(true)}
            />
          </section>

          {/* Section 3: Alt Text (images only) */}
          {showAltText && (
            <section
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
              }}
            >
              <h2 style={sectionHeadingStyle}>Alt Text</h2>
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  margin: '0 0 0.5rem',
                }}
              >
                Describe the image for accessibility
              </p>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe what's in this image..."
                maxLength={1000}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--border-hover)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                }}
              />
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.35rem',
                }}
              >
                {altText.length}/1000
              </div>
            </section>
          )}

          {/* Section 4: Schedule / Publish */}
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
            }}
          >
            <h2 style={sectionHeadingStyle}>Publish</h2>
            <SchedulePicker
              onSchedule={handleSchedule}
              onPublishNow={handlePublishNow}
              onSaveDraft={handleSaveDraft}
              isPublishing={isPublishing}
              bestTimes={bestTimes}
            />
          </section>
        </div>

        {/* ============ RIGHT COLUMN: Preview ============ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            minWidth: 0,
          }}
          className="compose-preview"
        >
          {/* Phone preview */}
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              position: 'sticky',
              top: '1rem',
            }}
          >
            <h2 style={sectionHeadingStyle}>Preview</h2>
            <PostPreview
              caption={caption}
              mediaUrls={mediaUrls}
              mediaType={mediaType}
              username={username}
              profilePicture={profilePicture}
            />

            {/* Publishing rate limit */}
            <div
              style={{
                marginTop: '1rem',
                padding: '0.65rem 0.85rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Publishing limit (24h)</span>
              {rateLimit ? (
                <span
                  style={{
                    fontWeight: '600',
                    color:
                      rateLimit.remaining <= 5
                        ? 'var(--error)'
                        : rateLimit.remaining <= 20
                          ? 'var(--warning)'
                          : 'var(--text-secondary)',
                  }}
                >
                  {rateLimit.quotaUsage}/{rateLimit.quotaTotal}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>--/--</span>
              )}
            </div>

            {/* Publish result with permalink */}
            {publishResult?.type === 'success' && publishResult.permalink && (
              <a
                href={publishResult.permalink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  color: 'var(--success)',
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontWeight: '500',
                  transition: 'background 0.2s ease',
                }}
              >
                View on Instagram
              </a>
            )}
          </section>
        </div>
      </div>

      {/* ============ MODALS ============ */}

      {/* Hashtag Picker */}
      <HashtagPicker
        isOpen={showHashtagPicker}
        onClose={() => setShowHashtagPicker(false)}
        onInsert={handleInsertHashtags}
      />

      {/* Template Picker */}
      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleLoadTemplate}
        currentCaption={caption}
      />

      {/* ============ TOAST ============ */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            maxWidth: '380px',
            padding: '0.85rem 1.1rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${toast.type === 'error' ? 'var(--error)' : 'var(--success)'}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text)',
            fontSize: '0.85rem',
            zIndex: 9999,
            animation: 'composeToastSlideIn 0.25s ease-out',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              color: toast.type === 'error' ? 'var(--error)' : 'var(--success)',
              fontWeight: '600',
              fontSize: '0.9rem',
              flexShrink: 0,
            }}
          >
            {toast.type === 'error' ? '\u2715' : '\u2713'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Responsive + animation styles */}
      <style jsx>{`
        @keyframes composeToastSlideIn {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (min-width: 1024px) {
          .compose-grid {
            grid-template-columns: 3fr 2fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ------------------------------------------------------------------
// Shared styles
// ------------------------------------------------------------------

const sectionHeadingStyle = {
  fontSize: '0.82rem',
  fontWeight: '600',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.75rem',
  marginTop: 0,
};

const toolButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  fontSize: '0.85rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  padding: 0,
  lineHeight: 1,
};

// ------------------------------------------------------------------
// Inline SVG icons
// ------------------------------------------------------------------

function TemplateIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}
