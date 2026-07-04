// @ts-nocheck
export const metadata = {
  title: 'Social Media MVP',
  description: 'A modular full-stack social media platform MVP'
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
