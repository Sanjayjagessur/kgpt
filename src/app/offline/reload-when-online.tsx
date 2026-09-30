"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Reloads as soon as the connection comes back, with a manual retry too. */
export function ReloadWhenOnline({ label }: { label: string }) {
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);
  return (
    <Button size="lg" className="mt-8" onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
