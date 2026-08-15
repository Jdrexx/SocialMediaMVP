// @ts-nocheck
export const metadata = {
  title: 'MySazz — Your story. Your connections.',
  description: 'A private, stigma-free community for adults moving forward with lived experience.'
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
