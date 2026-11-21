import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { ShellMotion } from "./marketing-motion";

const nav = [
  ["Features", "/features"],
  ["How it works", "/how-it-works"],
  ["About", "/about"],
  ["FAQ", "/faq"],
] as const;

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="NeuralPath home">
        <Image
          className="brand-symbol brand-image"
          src="/icon.svg"
          alt=""
          width={36}
          height={36}
          priority
        />
        <span className="brand-word">
          Neural<span className="brand-accent">Path</span>
        </span>
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {nav.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link className="header-login" href="/auth/sign-in">
          Sign in
        </Link>
        <Link className="site-button small" href="/auth/sign-up">
          Get started <ArrowUpRight size={15} />
        </Link>
      </div>
      <MobileNav />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand-block">
        <Link href="/" className="site-brand">
          <span className="brand-symbol">N</span>
          <span className="brand-word">
            neural<span className="brand-accent">path</span>
          </span>
        </Link>
        <p>Your goals. Your path. Your growth.</p>
        <small>Make room for what you want to become.</small>
      </div>
      <div className="footer-links">
        {[
          ["Explore", "/features", "/how-it-works", "/about"],
          ["Support", "/faq", "/contact"],
          ["Legal", "/privacy", "/terms"],
        ].map(([title, ...hrefs]) => (
          <section key={title}>
            <b>{title}</b>
            {hrefs.map((href) => (
              <Link key={href} href={href}>
                {href.slice(1).replaceAll("-", " ")}
              </Link>
            ))}
          </section>
        ))}
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} NeuralPath</span>
        <span>Built for every kind of learner.</span>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <ShellMotion>{children}</ShellMotion>
      <Footer />
    </>
  );
}

export function Intro({
  tag,
  title,
  desc,
}: {
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <section className="page-intro">
      <span className="eyebrow">
        <i /> {tag}
      </span>
      <h1>{title}</h1>
      <p>{desc}</p>
    </section>
  );
}
