"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/provider";
import { ChevronDown } from "lucide-react";

const RECEIPTIFY_URL = "https://receiptify.herokuapp.com/";
const MICHELLE_URL = "https://www.liumichelle.com/";
const ANDRE_URL = "https://www.instagram.com/skinnydookie/";
const TMDB_URL = "https://www.themoviedb.org/";

export function About() {
  const { dictionary: t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);

  return <main id="main" className="about-page">
    <div className="about-main-card">
    <header className="about-hero"><p className="eyebrow"><span className="dot"/> {t.about.eyebrow}</p><h1>{t.about.title}</h1><p className="about-lead">{t.about.lead}</p></header>
    <section className="about-panel" aria-labelledby="ways-heading"><h2 id="ways-heading" className="about-panel-heading">{t.about.waysIntro}</h2><div className="about-panel-body"><ol className="about-numbered-list">{t.about.ways.map(item => <li key={item}>{item}</li>)}</ol></div></section>
    <section id="privacy" className="about-panel" aria-labelledby="privacy-heading"><h2 id="privacy-heading" className="about-panel-heading">{t.about.privacyTitle}</h2><div className="about-panel-body"><ol className="about-numbered-list">{t.about.privacy.map(paragraph => <li key={paragraph}>{paragraph}</li>)}</ol></div></section>
    <section className="about-panel faq-section" aria-labelledby="faq-heading"><h2 id="faq-heading" className="about-panel-heading">{t.about.faqTitle}</h2>
      <div className="about-panel-body">
      <div className="faq-list">{t.about.faqs.map((faq, index) => {
        const expanded = open === index;
        const triggerId = `faq-trigger-${index}`;
        const panelId = `faq-panel-${index}`;
        return <article className="faq-item" key={faq.question}>
          <h3><button id={triggerId} type="button" aria-expanded={expanded} aria-controls={panelId} aria-label={t.about.expand(faq.question)} onClick={() => setOpen(expanded ? null : index)}><span>{faq.question}</span><ChevronDown size={16} aria-hidden="true" className={expanded ? "faq-chevron open" : "faq-chevron"}/></button></h3>
          <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!expanded} className="faq-panel">
            {faq.answer.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {faq.exportLink ? <p><a href="https://letterboxd.com/user/exportdata/" target="_blank" rel="noopener noreferrer">https://letterboxd.com/user/exportdata/ ↗</a></p> : null}
            {faq.steps && <ol>{faq.steps.map(step => <li key={step}>{step}</li>)}</ol>}
          </div>
        </article>;
      })}</div></div>
    </section>
    <section className="about-panel credits-section" aria-labelledby="credits-heading"><h2 id="credits-heading" className="about-panel-heading">{t.about.creditsTitle}</h2><div className="about-panel-body">
      <p>{t.about.creditsInspired.split("Receiptify")[0]}<a href={RECEIPTIFY_URL} target="_blank" rel="noopener noreferrer">Receiptify</a>{t.about.creditsInspired.split("Receiptify")[1]?.split("Michelle Liu")[0]}<a href={MICHELLE_URL} target="_blank" rel="noopener noreferrer">Michelle Liu</a>.</p>
      <p>{t.about.creditsData}</p><p className="about-disclaimer">{t.about.disclaimer}</p>
      <a className="tmdb-credit" href={TMDB_URL} target="_blank" rel="noopener noreferrer">
        <img src="/assets/tmdb-logo.svg" alt="The Movie Database (TMDB)"/>
        <span>{t.about.tmdbAttribution}</span>
      </a>
      <p>{t.about.madeBy.replace("Andre Sanjaya.", "")}<a href={ANDRE_URL} target="_blank" rel="noopener noreferrer">Andre Sanjaya</a>.</p></div>
    </section>
    </div>
  </main>;
}
