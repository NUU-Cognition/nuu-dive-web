"use client";

import { useEffect, useState } from "react";

/** A tiny, typed localStorage hook with SSR guards. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);

  // Read once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setState(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState] as const;
}