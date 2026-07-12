import LoginForm from './LoginForm';

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/edit';
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand" aria-hidden="true">📸</div>
        <h1>Post Logger</h1>
        <p>Sign in with Supabase Auth.</p>
        {params?.error && <p className="auth-message auth-error" role="alert">Authentication failed. Try again.</p>}
        <LoginForm
          nextPath={safeNext(params?.next)}
          signupEnabled={process.env.SUPABASE_AUTH_SIGNUP_ENABLED === 'true'}
        />
      </section>
    </main>
  );
}
