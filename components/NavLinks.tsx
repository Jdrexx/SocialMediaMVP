// @ts-nocheck
export default function NavLinks() {
  const links = [
    { href: '/about-us', label: 'Our Story', description: 'Why MySazz exists' },
    { href: '/rules-of-conduct', label: 'Community', description: 'How we care for this space' },
    { href: '/pricing', label: 'Membership', description: 'Plans and sponsored access' },
    { href: '/resources', label: 'Resources', description: 'Immediate and local support' },
    { href: '/privacy', label: 'Privacy', description: 'Your choices and protections' },
    { href: '/contact', label: 'Contact', description: 'Questions and partnerships' }
  ];

  return (
    <nav className="frontLinks" aria-label="Front page links">
      {links.map((link) => (
        <a key={link.href} href={link.href}>
          <strong>{link.label}</strong>
          <span>{link.description}</span>
        </a>
      ))}
    </nav>
  );
}
