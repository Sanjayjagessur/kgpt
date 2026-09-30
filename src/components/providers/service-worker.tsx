"use client";

import { useEffect } from "react";

/** Registers the service worker (production only), for install and an offline page. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app works without it.
    });
  }, []);
  return null;
}
