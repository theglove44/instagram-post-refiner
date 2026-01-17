'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [instagramAccount, setInstagramAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInstagramAccount();
  }, []);

  const loadInstagramAccount = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instagram/account');
      const data = await res.json();
      
      if (data.connected) {
        setInstagramAccount(data.account);
      } else {
        setInstagramAccount(null);
      }
    } catch (err) {
      console.error('Failed to load Instagram account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram/auth');
      const data = await res.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Instagram account?')) {
      return;
    }
    
    setDisconnecting(true);
    try {
      await fetch('/api/instagram/disconnect', { method: 'POST' });
      setInstagramAccount(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-main">
          <h1>⚙️ Settings</h1>
          <p>Configure your Instagram connection and app preferences</p>
        </div>
      </header>

      <Link href="/" className="back-link">
        ← Back to Logger
      </Link>

      {/* Instagram Connection */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">📸 Instagram Connection</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="loading-spinner" style={{ width: '32px', height: '32px' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
          </div>
        ) : instagramAccount ? (
          <div>
            <div className="instagram-account-card">
              {instagramAccount.profilePicture && (
                <img 
                  src={instagramAccount.profilePicture} 
                  alt={instagramAccount.username}
                  className="instagram-profile-pic"
                />
              )}
              <div className="instagram-account-info">
                <div className="instagram-username">@{instagramAccount.username}</div>
                {instagramAccount.followersCount && (
                  <div className="instagram-stats">
                    <span>{instagramAccount.followersCount.toLocaleString()} followers</span>
                    <span>•</span>
                    <span>{instagramAccount.mediaCount} posts</span>
                  </div>
                )}
                <div className="instagram-connected-date">
                  Connected {formatDate(instagramAccount.connectedAt)}
                </div>
                {instagramAccount.needsReconnect && (
                  <div className="instagram-warning">
                    ⚠️ Token expired - please reconnect
                  </div>
                )}
              </div>
            </div>
            
            <div className="btn-group" style={{ marginTop: '1.5rem' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting...' : '🔌 Disconnect Account'}
              </button>
              {instagramAccount.needsReconnect && (
                <button 
                  className="btn btn-primary"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  🔄 Reconnect
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Connect your Instagram Business or Creator account to:
            </p>
            <ul style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li>Track post performance and engagement</li>
              <li>View insights (reach, impressions, saves)</li>
              <li>Correlate your edits with post performance</li>
              <li>Publish posts directly from the app</li>
            </ul>
            
            <div className="instagram-requirements">
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Requirements:</h4>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                <li>Instagram Business or Creator account</li>
                <li>Connected to a Facebook Page</li>
                <li>Meta Developer app configured</li>
              </ul>
            </div>

            {error && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                {error}
              </div>
            )}

            <button 
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connecting}
              style={{ marginTop: '1.5rem' }}
            >
              {connecting ? (
                <>
                  <span className="loading-spinner" />
                  Connecting...
                </>
              ) : (
                '🔗 Connect Instagram Account'
              )}
            </button>
          </div>
        )}
      </div>

      {/* API Configuration Info */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">🔧 API Configuration</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          To enable Instagram integration, you need to configure these environment variables:
        </p>
        <div className="code-block" style={{ fontSize: '0.85rem' }}>
          {`INSTAGRAM_APP_ID=your-facebook-app-id
INSTAGRAM_APP_SECRET=your-facebook-app-secret
INSTAGRAM_REDIRECT_URI=${typeof window !== 'undefined' ? window.location.origin : ''}/api/instagram/callback`}
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.9rem' }}>
          Create a Meta app at{' '}
          <a 
            href="https://developers.facebook.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
          >
            developers.facebook.com
          </a>
        </p>
      </div>
    </div>
  );
}
