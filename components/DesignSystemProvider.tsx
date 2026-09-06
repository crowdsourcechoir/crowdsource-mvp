"use client";

import { useEffect } from "react";
import {
  DESIGN_SYSTEM_EVENT,
  DESIGN_SYSTEM_STORAGE_KEY,
  applyDesignTokensToDocument,
  readStoredDesignTokens,
  type DesignSystemTokens,
} from "@/lib/design-system/tokens";

/**
 * Applies persisted design tokens on mount and when Settings broadcasts changes.
 * Mount once in the admin shell so every admin page inherits the same chrome.
 */
export default function DesignSystemProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyDesignTokensToDocument(readStoredDesignTokens());

    function onChange(event: Event) {
      const detail = (event as CustomEvent<DesignSystemTokens>).detail;
      if (detail) applyDesignTokensToDocument(detail);
      else applyDesignTokensToDocument(readStoredDesignTokens());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === DESIGN_SYSTEM_STORAGE_KEY) {
        applyDesignTokensToDocument(readStoredDesignTokens());
      }
    }

    window.addEventListener(DESIGN_SYSTEM_EVENT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DESIGN_SYSTEM_EVENT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <>{children}</>;
}
