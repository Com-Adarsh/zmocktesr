import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "SFI CUSAT | Practice with purpose",
  description: "Focused mock tests and clear results for confident exam preparation.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="SFI CUSAT Mock Test home">
            <span className="brand-mark">SFI</span>
            <span>SFI CUSAT <small>Mock Test</small></span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/courses">Courses</Link>
            <Link href="/enter-test">Enter test</Link>
            {session ? <Link href="/dashboard">Dashboard</Link> : <Link className="nav-action" href="/login">Sign in</Link>}
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>SFI CUSAT Mock Test</span>
            <span>Independent mock-test platform</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
