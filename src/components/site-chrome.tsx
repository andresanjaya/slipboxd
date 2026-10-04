"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "@/i18n/provider";
import type { Language } from "@/i18n";

export function SiteHeader() {
  const pathname = usePathname();
  const { language, dictionary: t, setLanguage } = useLanguage();
  return <>
    <a className="skip-link" href="#main">{t.nav.skip}</a>
    <header className="site-header shell">
      <Link href="/" className="wordmark" aria-label={t.nav.homeLabel}>slipboxd<span>.</span></Link>
      <span className="header-note">{t.header.note}</span>
      <div className="header-actions">
        <nav className="site-nav" aria-label={t.nav.primary}>
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>{t.nav.create}</Link>
          <Link href="/about" aria-current={pathname === "/about" ? "page" : undefined}>{t.nav.about}</Link>
        </nav>
        <div className="language-toggle" role="group" aria-label={t.nav.language}>
          {(["id", "en"] as Language[]).map(option => <span className="language-option" key={option}>{option === "en" && <span className="language-separator" aria-hidden="true">/</span>}<button type="button" aria-pressed={language === option} onClick={() => setLanguage(option)}>{option.toUpperCase()}</button></span>)}
        </div>
      </div>
    </header>
  </>;
}

export function SiteFooter() {
  const { dictionary: t, language } = useLanguage();
  return <footer className="site-footer shell">
    <div className="footer-brand"><span className="wordmark">slipboxd<span>.</span></span><p>{language === "en" ? "For the films that stay with you." : "Untuk film yang tetap bersamamu."}</p></div>
    <Link className="footer-help" href="/about#faq">{language === "en" ? "Need a hand? ↗" : "Butuh bantuan? ↗"}</Link>
    <span className="small">{t.footer.disclaimer}</span>
  </footer>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dictionary: t } = useLanguage();
  useEffect(() => {
    const about = pathname === "/about";
    document.title = about ? t.meta.aboutTitle : t.meta.homeTitle;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) { description = document.createElement("meta"); description.name = "description"; document.head.append(description); }
    description.content = about ? t.meta.aboutDescription : t.meta.homeDescription;
  }, [pathname, t]);
  return <><SiteHeader/>{children}<SiteFooter/></>;
}
