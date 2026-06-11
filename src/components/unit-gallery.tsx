"use client";

import { useState } from "react";
import { cn } from "@/components/ui";

type Photo = { url: string; caption: string | null };

export function UnitGallery({
  photos,
  label,
}: {
  photos: Photo[];
  label: string;
}) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) return null;

  const current = photos[active] ?? photos[0];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-clay bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.caption ?? `${label} — photo ${active + 1}`}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>

      {photos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, i) => (
            <button
              key={photo.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View ${label} photo ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "h-16 w-20 shrink-0 overflow-hidden rounded-xl border transition-all",
                i === active
                  ? "border-pine ring-2 ring-pine/30"
                  : "border-clay opacity-80 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption ?? `${label} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
