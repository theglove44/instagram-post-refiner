import './globals.css';

export const metadata = {
  title: 'Instagram Post Refiner',
  description: 'Refine Instagram posts to match your authentic voice',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
