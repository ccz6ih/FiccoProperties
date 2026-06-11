"use client";

import { Button } from "@/components/ui";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
