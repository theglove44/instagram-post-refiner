'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PostCard from '../../components/PostCard';

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/publish/list?status=draft');
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const sortedDrafts = [...drafts].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at);
    const dateB = new Date(b.createdAt || b.created_at);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  async function handleDelete(id) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/publish/draft?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        await fetchDrafts();
      }
    } catch (err) {
      console.error('Failed to delete draft:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}>
            Drafts
          </h1>
          {!loading && drafts.length > 0 && (
            <span style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              fontSize: '13px',
              fontWeight: 600,
              padding: '2px 10px',
              borderRadius: '12px',
            }}>
              {drafts.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {drafts.length > 1 && (
            <div style={{
              display: 'flex',
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setSortOrder('newest')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: sortOrder === 'newest' ? 'var(--accent)' : 'transparent',
                  color: sortOrder === 'newest' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Newest
              </button>
              <button
                onClick={() => setSortOrder('oldest')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: sortOrder === 'oldest' ? 'var(--accent)' : 'transparent',
                  color: sortOrder === 'oldest' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Oldest
              </button>
            </div>
          )}

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
            + New Draft
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '60px 0',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          Loading drafts...
        </div>
      ) : drafts.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '15px',
            margin: '0 0 16px',
          }}>
            No drafts yet. Start writing your next post!
          </p>
          <Link
            href="/compose"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Start Composing
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
        }}>
          {sortedDrafts.map(draft => (
            <div
              key={draft.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              <PostCard post={draft} showActions={false} />

              {deleteConfirmId === draft.id ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--error-soft)',
                  borderTop: '1px solid var(--error)',
                }}>
                  <span style={{
                    fontSize: '13px',
                    color: 'var(--error)',
                    fontWeight: 500,
                  }}>
                    Delete this draft?
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={deleting}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        opacity: deleting ? 0.5 : 1,
                      }}
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      disabled={deleting}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'var(--error)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        cursor: 'pointer',
                        opacity: deleting ? 0.5 : 1,
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '10px 14px',
                  borderTop: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => router.push(`/compose?id=${draft.id}`)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: '13px',
                      fontWeight: 500,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(draft.id)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: '13px',
                      fontWeight: 500,
                      background: 'var(--error-soft)',
                      border: '1px solid var(--error)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--error)',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => router.push(`/compose?id=${draft.id}`)}
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
                    Schedule
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 1024px) {
          .drafts-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
