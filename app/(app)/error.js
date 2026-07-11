'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error('App route error:', error);
  }, [error]);

  return (
    <div className="container route-state">
      <div className="card route-state-card" role="alert">
        <h1>Couldn&apos;t load this page</h1>
        <p>Your work is still safe. Try loading this section again.</p>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
