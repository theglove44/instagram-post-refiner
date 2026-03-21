'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { computeDiff } from '@/lib/diff';

export default function ViewPostPage() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Instagram linking states
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [loadingInstagram, setLoadingInstagram] = useState(false);
  const [linkingPost, setLinkingPost] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [matchSuggestions, setMatchSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      const found = (data.posts || []).find(p => String(p.id) === String(id));
      setPost(found || null);
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const loadInstagramPosts = async () => {
    setLoadingInstagram(true);
    try {
      const res = await fetch('/api/instagram/recent?limit=25');
      const data = await res.json();
      if (data.posts) setInstagramPosts(data.posts);
    } catch (error) {
      console.error('Failed to load Instagram posts:', error);
    } finally {
      setLoadingInstagram(false);
    }
  };

  const linkToInstagram = async (instagramPost) => {
    if (!post) return;
    setLinkingPost(true);
    try {
      const res = await fetch('/api/posts/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          instagramMediaId: instagramPost.id,
          instagramPermalink: instagramPost.permalink,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Post linked to Instagram!');
        setPost({
          ...post,
          instagramMediaId: instagramPost.id,
          instagramPermalink: instagramPost.permalink,
        });
        setShowLinkModal(false);
      } else {
        showToast(data.error || 'Failed to link', 'error');
      }
    } catch {
      showToast('Failed to link post', 'error');
    } finally {
      setLinkingPost(false);
    }
  };

  const unlinkFromInstagram = async () => {
    if (!post) return;
    setLinkingPost(true);
    try {
      const res = await fetch(`/api/posts/link?postId=${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Post unlinked from Instagram');
        setPost({ ...post, instagramMediaId: null, instagramPermalink: null });
      } else {
        showToast(data.error || 'Failed to unlink', 'error');
      }
    } catch {
      showToast('Failed to unlink post', 'error');
    } finally {
      setLinkingPost(false);
    }
  };

  const loadMatchSuggestions = async (postId) => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/posts/match?postId=${postId}`);
      const data = await res.json();
      if (data.suggestions) setMatchSuggestions(data.suggestions);
    } catch (error) {
      console.error('Failed to load match suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const resolveSuggestion = async (suggestionId, action) => {
    setLinkingPost(true);
    try {
      const res = await fetch('/api/posts/match', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'accept') {
          const accepted = matchSuggestions.find(s => s.id === suggestionId);
          if (accepted) {
            showToast('Post linked to Instagram!');
            setPost({
              ...post,
              instagramMediaId: accepted.instagramMediaId,
              instagramPermalink: accepted.instagramPermalink,
            });
          }
          setShowLinkModal(false);
        } else {
          showToast('Suggestion dismissed');
        }
        setMatchSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      } else {
        showToast(data.error || 'Failed to resolve suggestion', 'error');
      }
    } catch {
      showToast('Failed to resolve suggestion', 'error');
    } finally {
      setLinkingPost(false);
    }
  };

  const openLinkModal = () => {
    setShowLinkModal(true);
    if (post) loadMatchSuggestions(post.id);
    if (instagramPosts.length === 0) loadInstagramPosts();
  };

  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>View Post</h1>
          </div>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>Post Not Found</h1>
          </div>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>This post could not be found.</p>
          <button className="btn btn-primary" onClick={() => router.push('/history')}>
            {'\u2190'} Back to History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>{post.topic || 'Untitled Post'}</h1>
          <p>
            {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
            {' \u2022 '}{post.editCount} edit{post.editCount !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <div className="main-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{'\uD83E\uDD16'} Original (Claude)</h2>
            <button
              className="btn btn-secondary"
              onClick={() => copyToClipboard(post.aiVersion)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              {'\uD83D\uDCCB'} Copy
            </button>
          </div>
          <div className="post-content">
            {post.aiVersion}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{'\u2705'} Final Version</h2>
            <button
              className="btn btn-secondary"
              onClick={() => copyToClipboard(post.finalVersion)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              {'\uD83D\uDCCB'} Copy
            </button>
          </div>
          <div className="post-content">
            {post.finalVersion}
          </div>
        </div>
      </div>

      {/* Diff for selected post */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">{'\uD83D\uDCCA'} Changes Made</h2>
          <span className="history-item-edits">
            {'\u270F\uFE0F'} {post.editCount} edit{post.editCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="diff-container">
          {computeDiff(post.aiVersion, post.finalVersion).map((line, i) => (
            <div key={i} className={`diff-line ${line.type}`}>
              {line.type === 'added' && '+ '}
              {line.type === 'removed' && '\u2212 '}
              {line.content || ' '}
            </div>
          ))}
        </div>
      </div>

      {/* Instagram Link Section */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">{'\uD83D\uDCF8'} Instagram Link</h2>
        </div>
        {post.instagramPermalink ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: 'var(--success)' }}>{'\u2713'} Linked to Instagram</span>
              <a
                href={post.instagramPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                View on IG {'\u2192'}
              </a>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={unlinkFromInstagram}
              disabled={linkingPost}
              style={{ color: 'var(--error)' }}
            >
              {linkingPost ? 'Unlinking...' : '\u2715 Unlink'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Link this post to an Instagram post to track performance metrics
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={openLinkModal}>
                {'\uD83D\uDD17'} Link to Instagram Post
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
        <button className="btn btn-secondary" onClick={() => router.push('/history')}>
          {'\u2190'} Back to History
        </button>
        {!post.instagramMediaId && (
          <button className="btn btn-primary" onClick={() => router.push(`/compose?sourcePostId=${post.id}`)}>
            {'\uD83D\uDCDD'} Compose & Publish
          </button>
        )}
      </div>

      {/* Instagram Link Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Link to Instagram Post</h2>
              <button className="modal-close" onClick={() => setShowLinkModal(false)}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Select the Instagram post that matches this logged post:
              </p>
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{post.topic}</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {post.finalVersion.substring(0, 100)}...
                </p>
              </div>

              {/* Match Suggestions */}
              {loadingSuggestions ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <span className="loading-spinner" style={{ width: '24px', height: '24px' }} />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Checking for matches...</p>
                </div>
              ) : matchSuggestions.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Suggested Matches
                  </h3>
                  {matchSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="instagram-post-option"
                      style={{ border: suggestion.confidenceScore >= 0.85 ? '1px solid var(--success)' : '1px solid var(--warning)', position: 'relative' }}
                    >
                      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontWeight: 600,
                          background: suggestion.confidenceScore >= 0.85 ? 'var(--success-soft)' : 'var(--warning-soft)',
                          color: suggestion.confidenceScore >= 0.85 ? 'var(--success)' : 'var(--warning)',
                        }}>
                          {suggestion.confidenceScore >= 0.85 ? 'High Match' : 'Possible Match'} ({Math.round(suggestion.confidenceScore * 100)}%)
                        </span>
                      </div>
                      <div className="instagram-post-caption" style={{ paddingRight: '8rem' }}>
                        {suggestion.instagramCaption || '(No caption)'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <div className="instagram-post-meta">
                          <span>{new Date(suggestion.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => { e.stopPropagation(); resolveSuggestion(suggestion.id, 'accept'); }}
                            disabled={linkingPost}
                          >
                            Link
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); resolveSuggestion(suggestion.id, 'reject'); }}
                            disabled={linkingPost}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All Instagram Posts */}
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {matchSuggestions.length > 0 ? 'All Instagram Posts' : 'Instagram Posts'}
              </h3>
              {loadingInstagram ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading Instagram posts...</p>
                </div>
              ) : instagramPosts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No Instagram posts found. Make sure your Instagram account is connected in Settings.</p>
                </div>
              ) : (
                <div className="instagram-posts-list">
                  {instagramPosts.map((igPost) => (
                    <div
                      key={igPost.id}
                      className="instagram-post-option"
                      onClick={() => linkToInstagram(igPost)}
                    >
                      <div className="instagram-post-caption">
                        {igPost.caption || '(No caption)'}
                      </div>
                      <div className="instagram-post-meta">
                        <span>{'\u2764\uFE0F'} {igPost.likes}</span>
                        <span>{'\uD83D\uDCAC'} {igPost.comments}</span>
                        <span>{new Date(igPost.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-secondary"
                onClick={loadInstagramPosts}
                disabled={loadingInstagram}
              >
                {loadingInstagram ? 'Refreshing...' : '\uD83D\uDD04 Refresh'}
              </button>
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
