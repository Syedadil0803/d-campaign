'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';

/**
 * Sign-in.
 *
 * Email and password today, against a single seeded account. The form is
 * deliberately the only thing that knows about passwords: everything past
 * /api/auth/login deals in a session cookie, so moving to Google means adding
 * a button here and a callback route — not touching the editor, the draft, or
 * the presence flag.
 */
function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Set when the idle timer ended the session rather than the user did. Worth
  // saying out loud: someone who did not sign themselves out will otherwise
  // read this screen as the tool having lost their work.
  const timedOut = params.get('reason') === 'timeout';
  /**
   * Where to land after signing in — but only somewhere on this site.
   *
   * The value is read from the query string, so anyone can put anything in it.
   * Unchecked, a link to /login?next=https://evil.com sends someone who has
   * just signed in legitimately to an attacker's page, which then asks them to
   * sign in "again" — borrowing the trust of this domain to do it.
   *
   * Middleware only ever writes same-origin paths here, but that is not a
   * guarantee about what arrives: the guarantee has to be made where the value
   * is used.
   *
   * A leading slash is required and a second one rejected, because "//evil.com"
   * is a protocol-relative URL that browsers treat as another host.
   */
  const requested = params.get('next') || '/';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not sign you in.');
        setBusy(false);
        return;
      }
      // A full load, not a client transition: the editor reads the session on
      // mount, and router.push would leave it holding the signed-out state.
      window.location.href = next;
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-on-surface">Campaign Admin</h1>
          <p className="mt-1.5 text-sm text-on-surface-variant">
            Sign in to manage your announcements and promo cards.
          </p>
        </div>

        {timedOut && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-on-surface">
            <p className="font-medium">You were signed out after a while away.</p>
            {/* Names the place. "Still here" pointed at the login screen, which
                is not where the work is and not somewhere it could be. It says
                "anything" because this shows on every timeout, including ones
                where nothing was left unsaved — promising work back to someone
                who had none is worse than saying nothing. */}
            <p className="mt-1 text-on-surface-variant">
              Anything you hadn&apos;t saved is kept on this browser — sign back
              in and it goes straight back on the canvas.
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <label className="block text-xs font-medium text-on-surface-variant" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
          />

          <label className="mt-4 block text-xs font-medium text-on-surface-variant" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
          />

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep the route from being
  // forced fully dynamic at build time.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
