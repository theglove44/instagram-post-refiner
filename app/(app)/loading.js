export default function AppLoading() {
  return (
    <div className="container route-state" role="status" aria-live="polite">
      <div className="card route-state-card">
        <span className="loading-spinner" aria-hidden="true" />
        <p className="route-loading-label">Loading workspace...</p>
      </div>
    </div>
  );
}
