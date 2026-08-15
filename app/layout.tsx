// @ts-nocheck
export const metadata = {
  title: 'MySazz — Your story. Your connections.',
  description: 'A private, stigma-free community for adults moving forward with lived experience.',
  icons: { icon: '/brand/mysazz-mark.svg' }
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <a className="brandLockup" href="/" aria-label="MySazz home">
            <img src="/brand/mysazz-mark.svg" alt="" width="52" height="52" />
            <span><strong>MySazz</strong><small>Everyone is going through something.</small></span>
          </a>
          <a className="helpLink" href="/resources">Find support</a>
        </header>
        {children}
        <footer className="siteFooter">
          <div><strong>MySazz</strong><span>A private community for moving forward.</span></div>
          <nav aria-label="Footer links"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/rules-of-conduct">Community rules</a><a href="/contact">Contact</a></nav>
        </footer>
      </body>
    </html>
  );
}
