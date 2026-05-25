'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatNumber, formatPercent, formatDate } from '../../../lib/utils.js';

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState([]);
  const [ownAccount, setOwnAccount] = useState(null);
  const [ownGrowth, setOwnGrowth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null);
  const [snapshotResult, setSnapshotResult] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, accRes] = await Promise.all([
        fetch('/api/competitors'),
        fetch('/api/account'),
      ]);
      const compData = await compRes.json();
      const accData = await accRes.json();
      if (compData.success) setCompetitors(compData.competitors || []);
      if (accData.success) setOwnAccount(accData.account);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, display_name: newDisplayName }),
      });
      const data = await res.json();
      if (data.success) {
        setNewUsername('');
        setNewDisplayName('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (username) => {
    if (!confirm(`Stop tracking @${username}?`)) return;
    try {
      const res = await fetch(`/api/competitors?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchData();
      else setMessage({ type: 'error', text: data.error });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSnapshot = async () => {
    setSnapshotting(true);
    setSnapshotResult(null);
    setMessage(null);
    try {
      const res = await fetch('/api/competitors/snapshot', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnapshotResult(data);
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSnapshotting(false);
    }
  };

  const ownFollowers = ownAccount?.followersCount;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Competitor Benchmarking</h1>
          <p>Monthly follower counts, engagement rates, and growth vs @tuckinandtalk</p>
        </div>
        <button className="btn btn-secondary" onClick={handleSnapshot} disabled={snapshotting || competitors.filter(c => c.active).length === 0}>
          {snapshotting ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Snapshotting…</> : 'Run Snapshot'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      {snapshotResult && (
        <div className="alert alert-success">
          Snapshot complete — {snapshotResult.processed} competitors updated, {snapshotResult.errors} errors
        </div>
      )}

      {/* Your own stats for comparison */}
      {ownAccount && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent-terra)', borderWidth: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Your Account
              </div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem', color: 'var(--accent-terra)' }}>
                @{ownAccount.username || 'tuckinandtalk'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', color: 'var(--text-number)' }}>
                {formatNumber(ownFollowers)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>followers</div>
            </div>
          </div>
        </div>
      )}

      {/* Add competitor */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontWeight: 400 }}>Track a Competitor</h3>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Username</label>
              <input
                className="form-input"
                placeholder="manchesterfoodscene"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Display Name (optional)</label>
              <input
                className="form-input"
                placeholder="Manchester Food Scene"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={adding}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
      ) : competitors.length === 0 ? (
        <div className="empty-state">
          <h3>No competitors tracked yet</h3>
          <p>
            Add competitor handles above. Once added, run a snapshot to pull their
            follower count, post count, and median engagement rate via the
            Business Discovery API.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Followers</th>
                <th>vs You</th>
                <th>Posts</th>
                <th>Median Eng %</th>
                <th>MoM Growth</th>
                <th>Last Snapshot</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => {
                const snap = comp.latestSnapshot;
                const ratio = ownFollowers && snap?.followers_count
                  ? snap.followers_count / ownFollowers
                  : null;
                const growthPct = comp.growthRate;

                return (
                  <tr key={comp.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>@{comp.username}</div>
                      {comp.display_name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comp.display_name}</div>
                      )}
                    </td>
                    <td className="td-mono">
                      {snap?.followers_count != null ? formatNumber(snap.followers_count) : '—'}
                    </td>
                    <td className="td-mono">
                      {ratio !== null ? (
                        <span style={{ color: ratio > 1 ? '#c05050' : '#6abf84' }}>
                          {ratio > 1 ? '+' : ''}{((ratio - 1) * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="td-mono">
                      {snap?.media_count != null ? formatNumber(snap.media_count) : '—'}
                    </td>
                    <td className="td-mono">
                      {snap?.median_engagement_rate != null
                        ? formatPercent(snap.median_engagement_rate)
                        : '—'}
                    </td>
                    <td className="td-mono">
                      {growthPct !== null ? (
                        <span style={{ color: growthPct > 0 ? '#6abf84' : '#c05050' }}>
                          {growthPct > 0 ? '+' : ''}{growthPct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="td-muted">
                      {snap?.snapshot_date ? formatDate(snap.snapshot_date) : 'Never'}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(comp.username)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
