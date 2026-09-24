"use client";

import { useEffect } from "react";
import { logStudyTime } from "@/server/actions/activity";

const TICK_SECONDS = 60;
const IDLE_AFTER_MS = 3 * 60 * 1000;

/**
 * Counts time only while the tab is visible and the student has interacted
 * recently, then reports it once a minute. Drives streaks and "time studied".
 */
export function StudyHeartbeat() {
  useEffect(() => {
    let lastInput = Date.now();
    let active = 0;
    const markInput = () => {
      lastInput = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, markInput, { passive: true }));

    const second = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInput < IDLE_AFTER_MS) active += 1;
    }, 1000);

    const flush = () => {
      if (active >= 5) {
        const s = active;
        active = 0;
        void logStudyTime(s);
      }
    };
    const report = window.setInterval(flush, TICK_SECONDS * 1000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markInput));
      window.clearInterval(second);
      window.clearInterval(report);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  return null;
}
