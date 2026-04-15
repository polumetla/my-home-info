"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Ctx = {
  q: string;
  setQ: (v: string) => void;
  flushSearch: () => void;
  panelOpen: boolean;
  closePanel: () => void;
};

const SiteSearchContext = createContext<Ctx | null>(null);

export function useSiteSearch() {
  const ctx = useContext(SiteSearchContext);
  if (!ctx) throw new Error("useSiteSearch must be used within SiteSearchProvider");
  return ctx;
}

export function SiteSearchProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [q, setQState] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Deep link / legacy `?q=` opens the panel and strips the param from the URL without navigating away. */
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q") ?? "";
    if (!qParam) return;
    setQState(qParam);
    setPanelOpen(true);
    const clean = pathname + (window.location.hash || "");
    window.history.replaceState(null, "", clean);
  }, [pathname]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const flushSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next = qRef.current.trim();
    setQState(next);
    setPanelOpen(true);
  }, []);

  const setQ = useCallback((v: string) => {
    setQState(v);
    if (v.trim().length > 0) setPanelOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = v.trim();
      if (next.length > 0) setPanelOpen(true);
    }, 200);
  }, []);

  const value = useMemo(
    () => ({ q, setQ, flushSearch, panelOpen, closePanel }),
    [q, setQ, flushSearch, panelOpen, closePanel],
  );

  return <SiteSearchContext.Provider value={value}>{children}</SiteSearchContext.Provider>;
}
