'use client';

import { useActionState } from 'react';
import { authenticate } from './actions';

export default function LoginForm({ nextPath, signupEnabled }) {
  const [state, formAction, pending] = useActionState(authenticate, {});

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" minLength={6} required />
      {state?.error && <p className="auth-message auth-error" role="alert">{state.error}</p>}
      {state?.message && <p className="auth-message auth-success" role="status">{state.message}</p>}
      <div className="auth-actions">
        <button type="submit" name="intent" value="signin" disabled={pending}>
          {pending ? 'Working…' : 'Sign in'}
        </button>
        {signupEnabled && (
          <button type="submit" name="intent" value="signup" className="secondary" disabled={pending}>
            Sign up
          </button>
        )}
      </div>
    </form>
  );
}
