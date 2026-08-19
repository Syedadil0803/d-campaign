'use client';

/**
 * Last resort: a render error in the root layout itself, which error.tsx sits
 * inside and so cannot catch. It replaces the whole document, which is why it
 * has to render its own <html> and <body> and cannot rely on globals.css
 * having been applied.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif',
          background: '#f5f5f4',
          color: '#1c1917',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 24,
            border: '1px solid #e7e5e4',
            borderRadius: 12,
            background: '#fff',
          }}
        >
          <h1 style={{ fontSize: 18, margin: 0 }}>The admin panel failed to start</h1>
          <p style={{ fontSize: 14, color: '#57534e', marginTop: 8 }}>
            Your saved campaign is untouched. Try again, and if this keeps
            happening the message below is the detail worth reporting.
          </p>
          {error?.message && (
            <pre
              style={{
                marginTop: 12,
                padding: 8,
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                background: '#fafaf9',
                border: '1px solid #e7e5e4',
                borderRadius: 6,
                maxHeight: 160,
                overflow: 'auto',
              }}
            >
              {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ''}
            </pre>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              height: 36,
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: '#9a3412',
              border: 0,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
