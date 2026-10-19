import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          <span className="brand-mark">SFI</span>
          <span>
            Mock Test Platform
            <small>Computer-based test simulator</small>
          </span>
        </Link>
        <nav aria-label="Main">
          <Link href="/#register">Register</Link>
          <Link href="/admin">Control room</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">SFI Mock Test Platform · Answers are graded on the server; the answer key never reaches your browser.</div>
    </footer>
  );
}
