"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ImportResult } from "@/lib/model";
import type { TmdbMovieMetadata } from "@/lib/tmdb";

type DiaryContextValue = {
  data: ImportResult | null;
  metadata: ReadonlyMap<string, TmdbMovieMetadata>;
  metadataCache: RefObject<Map<string, TmdbMovieMetadata>>;
  setDiary: (result: ImportResult) => void;
  clearDiary: () => void;
  publishMetadata: (results?: TmdbMovieMetadata[]) => void;
};

const DiaryContext = createContext<DiaryContextValue | null>(null);

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ImportResult | null>(null);
  const [metadata, setMetadata] = useState<ReadonlyMap<string, TmdbMovieMetadata>>(new Map());
  const metadataCache = useRef(new Map<string, TmdbMovieMetadata>());

  const clearDiary = useCallback(() => {
    metadataCache.current.clear();
    setMetadata(new Map());
    setData(null);
  }, []);

  const setDiary = useCallback((result: ImportResult) => {
    metadataCache.current.clear();
    setMetadata(new Map());
    setData(result);
  }, []);

  const publishMetadata = useCallback((results: TmdbMovieMetadata[] = []) => {
    for (const result of results) metadataCache.current.set(result.key, result);
    setMetadata(new Map(metadataCache.current));
  }, []);

  const value = useMemo(() => ({ data, metadata, metadataCache, setDiary, clearDiary, publishMetadata }),
    [data, metadata, setDiary, clearDiary, publishMetadata]);
  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

export function useDiary() {
  const context = useContext(DiaryContext);
  if (!context) throw new Error("useDiary must be used inside DiaryProvider");
  return context;
}
