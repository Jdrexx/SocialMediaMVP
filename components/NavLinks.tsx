// @ts-nocheck
export default function NavLinks() {
  const links = [
    { href: '/about-us', label: 'About Us', description: 'Learn who we are' },
    { href: '/contact', label: 'Contact', description: 'Get in touch' },
    { href: '/rules-of-conduct', label: 'Rules Of Conduct', description: 'Community guidelines' },
    { href: '/resources', label: 'Get Help', description: 'Immediate and local resources' },
    { href: '/pricing', label: 'Membership', description: 'Plans and sponsored access' },
    { href: '/privacy', label: 'Privacy', description: 'How MySazz protects you' }
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
