"use client";

import { useLanguage } from "@/i18n/provider";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { dictionary: t } = useLanguage();
  return <main id="main" className="shell error-page"><h1>{t.globalError.title}</h1><p>{t.globalError.body}</p><button onClick={reset}>{t.globalError.retry}</button></main>;
}
