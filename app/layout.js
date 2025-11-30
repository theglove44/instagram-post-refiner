import './globals.css';
import { Analytics } from "@vercel/analytics/next";

// Note: Supabase is configured in lib/supabase.js and used by API routes
// for persistent data storage (posts, analysis data). It's not directly imported
// in this layout but is a core dependency for the application backend.

export const metadata = {
  title: 'Instagram Post Refiner',
  description: 'Refine Instagram posts to match your authentic voice',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
