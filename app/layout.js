import './globals.css';
import { Analytics } from "@vercel/analytics/next";

// Note: Supabase is configured in lib/supabase.js and used by API routes
// for persistent data storage (posts, analysis data). It's not directly imported
// in this layout but is a core dependency for the application backend.

export const metadata = {
  title: 'Voice Workshop',
  description: 'Turn notes into Tuck In and Talk captions, then copy the final into Keep',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Karla:wght@400;500;700&family=Caveat:wght@600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
