"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, isLanguage, type Dictionary, type Language } from ".";

const STORAGE_KEY = "slipboxd-language";
type LanguageContextValue = { language: Language; dictionary: Dictionary; setLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setLanguageState(isLanguage(saved) ? saved : navigator.language.toLowerCase().startsWith("id") ? "id" : "en");
  }, []);

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  function setLanguage(value: Language) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setLanguageState(value);
  }

  const value = useMemo(() => ({ language, dictionary: dictionaries[language], setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
