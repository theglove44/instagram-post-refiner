'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PostCard from '../../components/PostCard';
import PublishStatus from '../../components/PublishStatus';

function formatRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = date - now;
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) return 'Overdue';
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHr < 24) return `in ${diffHr}h`;
  if (diffDays === 1) {
    return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPublishedTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function QueuePage() {
  const router = useRouter();
  const [rateLimit, setRateLimit] = useState(null);
  const [failedPosts, setFailedPosts] = useState([]);
  const [publishingPosts, setPublishingPosts] = useState([]);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPublished, setShowPublished] = useState(false);
  const [retrying, setRetrying] = useState(null);
  const publishingPollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [limitRes, failedRes, publishingRes, scheduledRes] = await Promise.all([
        fetch('/api/publish/limit'),
        fetch('/api/publish/list?status=failed'),
        fetch('/api/publish/list?status=publishing'),
        fetch('/api/publish/list?status=scheduled'),
      ]);

      if (limitRes.ok) {
        const data = await limitRes.json();
        setRateLimit(data);
      }
      if (failedRes.ok) {
        const data = await failedRes.json();
        setFailedPosts(data.posts || []);
      }
      if (publishingRes.ok) {
        const data = await publishingRes.json();
        setPublishingPosts(data.posts || []);
      }
      if (scheduledRes.ok) {
        const data = await scheduledRes.json();
        const sorted = (data.posts || []).sort(
          (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)
        );
        setScheduledPosts(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch queue data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPublished = useCallback(async () => {
    try {
      const res = await fetch('/api/publish/list?status=published&limit=10');
      if (res.ok) {
        const data = await res.json();
        setPublishedPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to fetch published posts:', err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (showPublished && publishedPosts.length === 0) {
      fetchPublished();
    }
  }, [showPublished, publishedPosts.length, fetchPublished]);

  // Poll publishing posts every 5 seconds
  useEffect(() => {
    if (publishingPosts.length > 0) {
      publishingPollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/publish/list?status=publishing');
          if (res.ok) {
            const data = await res.json();
            const current = data.posts || [];
            setPublishingPosts(current);
            if (current.length === 0) {
              clearInterval(publishingPollRef.current);
              fetchAll();
            }
          }
        } catch (err) {
          console.error('Failed to poll publishing status:', err);
        }
      }, 5000);
    }

    return () => {
      if (publishingPollRef.current) {
        clearInterval(publishingPollRef.current);
      }
    };
  }, [publishingPosts.length, fetchAll]);

  async function handleRetry(postId) {
    setRetrying(postId);
    try {
      await fetch('/api/publish/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId }),
      });
      await fetchAll();
    } catch (err) {
      console.error('Failed to retry publish:', err);
    } finally {
      setRetrying(null);
    }
  }

  async function handlePublishNow(postId) {
    try {
      await fetch('/api/publish/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId }),
      });
      await fetchAll();
    } catch (err) {
      console.error('Failed to publish now:', err);
    }
  }

  async function handleCancel(postId) {
    try {
      await fetch(`/api/publish/draft?id=${postId}`, { method: 'DELETE' });
      await fetchAll();
    } catch (err) {
      console.error('Failed to cancel post:', err);
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '60px 0',
        color: 'var(--text-muted)',
        fontSize: '14px',
      }}>
        Loading queue...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}>
            Queue
          </h1>
          {rateLimit && (
            <span style={{
              fontSize: '13px',
              color: rateLimit.used >= 80 ? 'var(--warning)' : 'var(--text-muted)',
              background: rateLimit.used >= 80 ? 'var(--warning-soft)' : 'var(--bg-input)',
              padding: '4px 12px',
              borderRadius: '12px',
              fontWeight: 500,
            }}>
              {rateLimit.used}/100 posts in last 24h
            </span>
          )}
        </div>
        <Link
          href="/compose"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
        >
          + New Post
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Failed Posts */}
        {failedPosts.length > 0 && (
          <div style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--error)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 18px',
              borderBottom: '1px solid var(--error)',
              background: 'var(--error-soft)',
            }}>
              <h2 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--error)',
                margin: 0,
              }}>
                Failed
              </h2>
              <span style={{
                background: 'var(--error)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                padding: '1px 8px',
                borderRadius: '10px',
              }}>
                {failedPosts.length}
              </span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {failedPosts.map(post => (
                <div key={post.id}>
                  <PostCard post={post} showActions={false} />
                  {post.publishError && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: 'var(--error-soft)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      color: 'var(--error)',
                      lineHeight: 1.4,
                    }}>
                      {post.publishError}
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px',
                  }}>
                    <button
                      onClick={() => handleRetry(post.id)}
                      disabled={retrying === post.id}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '13px',
                        fontWeight: 500,
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        cursor: retrying === post.id ? 'default' : 'pointer',
                        opacity: retrying === post.id ? 0.6 : 1,
                      }}
                    >
                      {retrying === post.id ? 'Retrying...' : 'Retry'}
                    </button>
                    <button
                      onClick={() => router.push(`/compose?id=${post.id}`)}
                      style={{
                        flex: 1,
                        padding: '7px 0',
                        fontSize: '13px',
                        fontWeight: 500,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: Publishing */}
        {publishingPosts.length > 0 && (
          <div style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--warning)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 18px',
              borderBottom: '1px solid var(--warning)',
              background: 'var(--warning-soft)',
            }}>
              <h2 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--warning)',
                margin: 0,
              }}>
                Publishing
              </h2>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--warning)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {publishingPosts.map(post => (
                <div key={post.id}>
                  <PostCard post={post} showActions={false} />
                  <div style={{ marginTop: '8px' }}>
                    <PublishStatus post={post} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Upcoming (Timeline) */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}>
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}>
              Upcoming
            </h2>
          </div>

          {scheduledPosts.length === 0 ? (
            <div style={{
              padding: '40px 24px',
              textAlign: 'center',
            }}>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                margin: '0 0 14px',
              }}>
                Queue empty. Schedule some content!
              </p>
              <Link
                href="/compose"
                style={{
                  display: 'inline-block',
                  padding: '8px 18px',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Schedule a Post
              </Link>
            </div>
          ) : (
            <div style={{ padding: '18px' }}>
              {scheduledPosts.map((post, index) => (
                <div
                  key={post.id}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    position: 'relative',
                    paddingBottom: index < scheduledPosts.length - 1 ? '20px' : '0',
                  }}
                >
                  {/* Timeline line */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100px',
                    flexShrink: 0,
                    position: 'relative',
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                      marginBottom: '6px',
                    }}>
                      {formatRelativeTime(post.scheduledAt)}
                    </span>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      border: '2px solid var(--bg-card)',
                      boxShadow: '0 0 0 2px var(--accent-soft)',
                      flexShrink: 0,
                    }} />
                    {index < scheduledPosts.length - 1 && (
                      <div style={{
                        width: '2px',
                        flex: 1,
                        background: 'var(--border)',
                        marginTop: '4px',
                      }} />
                    )}
                  </div>

                  {/* Post content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PostCard post={post} showActions={false} />
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '8px',
                    }}>
                      <button
                        onClick={() => router.push(`/compose?id=${post.id}`)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => handleCancel(post.id)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'var(--error-soft)',
                          border: '1px solid var(--error)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--error)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        style={{
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'var(--success-soft)',
                          border: '1px solid var(--success)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--success)',
                          cursor: 'pointer',
                        }}
                      >
                        Publish Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Recently Published (Collapsible) */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowPublished(prev => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              margin: 0,
            }}>
              Recently Published
            </h2>
            <span style={{
              fontSize: '18px',
              color: 'var(--text-muted)',
              transform: showPublished ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              lineHeight: 1,
            }}>
              &#9660;
            </span>
          </button>

          {showPublished && (
            <div style={{
              borderTop: '1px solid var(--border)',
              padding: '14px 18px',
            }}>
              {publishedPosts.length === 0 ? (
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  textAlign: 'center',
                  padding: '16px 0',
                  margin: 0,
                }}>
                  No published posts yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {publishedPosts.map(post => (
                    <div
                      key={post.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-sm)',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <PostCard post={post} showActions={false} compact />
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}>
                          {formatPublishedTime(post.publishedAt || post.published_at)}
                        </span>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '12px',
                              color: 'var(--ig-pink)',
                              textDecoration: 'none',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            View on IG
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
