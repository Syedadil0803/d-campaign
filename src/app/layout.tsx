import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerGuard } from '@/components/shell/ServiceWorkerGuard';

export const metadata: Metadata = {
  title: 'Campaign Admin Panel',
  description: 'Dynamic marketing campaign management system',
  applicationName: 'Campaign Admin Panel',
  appleWebApp: {
    // iOS ignores the manifest and reads these instead. Without them, adding
    // the tool to the Home Screen opens it in a Safari tab with full browser
    // chrome — installed in name only.
    capable: true,
    title: 'Campaigns',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  // Tints the window frame of the installed app. Next requires this to live in
  // `viewport` rather than `metadata`; it is silently ignored in the wrong one.
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Hand-written, and it has to be.

          A manifest.ts route generates this link through Next's metadata,
          which for a dynamically-rendered page is *streamed* — it arrives
          after </head> has already closed, and React hoists it into the head
          later. By then Chrome has run its installability check, found no
          manifest, and silently declined to offer installation. The link was
          present in the DOM the whole time, which is what made this so hard
          to see: every check by hand said it was there.

          Verified against headless Chrome: streamed, it reports
          "no-manifest"; here in the real head, it reports no errors at all.
        */}
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/*
          Catches the install offer before React exists.

          Chrome fires `beforeinstallprompt` as soon as it has read the
          manifest and the worker — often before this app has hydrated. A
          listener added inside a component would simply miss it, and the
          event is never re-fired, so the Install button would be absent on
          exactly the loads where the app is most installable. Parking it on
          `window` from a script that runs during parse means the button finds
          it whenever it mounts.

          preventDefault() suppresses Chrome's own mini-infobar on Android, so
          the offer appears once, in our UI, rather than twice.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__installPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event('installpromptready'));});",
          }}
        />
        <ServiceWorkerGuard />
        {children}
      </body>
    </html>
  );
}
