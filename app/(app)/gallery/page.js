'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GalleryPage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      setHistory(data.posts || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBestTransformations = () => {
    return [...history]
      .filter(p => p.editCount >= 3)
      .sort((a, b) => b.editCount - a.editCount)
      .slice(0, 6);
  };

  const viewPost = (post) => {
    router.push(`/history/${post.id}`);
  };

  if (loading) {
    return (
      <div className="container">
        <header className="header">
          <div className="header-main">
            <h1>Gallery</h1>
            <p>Best transformations from your editing</p>
          </div>
        </header>
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        </div>
      </div>
    );
  }

  const transformations = getBestTransformations();

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>Gallery</h1>
          <p>Posts with the most significant edits</p>
        </div>
      </header>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{'\uD83D\uDDBC\uFE0F'} Best Transformations</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Posts with the most significant edits
          </p>
        </div>

        {transformations.length === 0 ? (
          <div className="empty-state">
            <p>No significant transformations yet.<br/>Posts with 3+ edits will appear here.</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {transformations.map((post) => (
              <div key={post.id} className="gallery-card" onClick={() => viewPost(post)}>
                <div className="gallery-card-header">
                  <span className="gallery-topic">{post.topic}</span>
                  <span className="gallery-edits">{'\u270F\uFE0F'} {post.editCount} edits</span>
                </div>
                <div className="gallery-preview">
                  <div className="gallery-before">
                    <span className="gallery-label">Before</span>
                    <p>{post.aiVersion.substring(0, 100)}...</p>
                  </div>
                  <div className="gallery-arrow">{'\u2192'}</div>
                  <div className="gallery-after">
                    <span className="gallery-label">After</span>
                    <p>{post.finalVersion.substring(0, 100)}...</p>
                  </div>
                </div>
                <div className="gallery-date">
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
