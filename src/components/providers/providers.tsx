"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorker } from "./service-worker";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* "user" makes every Framer Motion animation respect prefers-reduced-motion. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          {children}
          <Toaster position="top-center" />
          <ServiceWorker />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
