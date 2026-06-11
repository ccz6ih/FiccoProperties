"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card } from "@/components/ui";
import {
  uploadUnitPhotos,
  deleteUnitPhoto,
  type PhotoState,
} from "@/app/(admin)/admin/units/[id]/photos-actions";

type Photo = { id: string; url: string; caption: string | null };

const initial: PhotoState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

function PhotoSection({
  unitId,
  kind,
  title,
  subtitle,
  photos,
}: {
  unitId: string;
  kind: "listing" | "condition";
  title: string;
  subtitle: string;
  photos: Photo[];
}) {
  const [state, action, pending] = useActionState(uploadUnitPhotos, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <Card className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-faint">{subtitle}</p>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? "Unit photo"}
                className="aspect-square w-full rounded-xl border border-clay object-cover"
              />
              {p.caption && (
                <div className="mt-1 truncate text-xs text-ink-faint">{p.caption}</div>
              )}
              <form action={deleteUnitPhoto} className="absolute right-1.5 top-1.5">
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  aria-label="Delete photo"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity hover:bg-terracotta-dark group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No photos yet.</p>
      )}

      <form ref={formRef} action={action} className="space-y-3 border-t border-clay pt-4">
        <input type="hidden" name="unit_id" value={unitId} />
        <input type="hidden" name="kind" value={kind} />

        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-sm text-pine-dark">
            {state.uploaded === 1 ? "Photo uploaded." : `${state.uploaded} photos uploaded.`}
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Add photos</span>
          <input
            type="file"
            name="photos"
            multiple
            accept="image/*"
            className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-clay"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Caption (optional)</span>
          <input name="caption" className={inputClass} placeholder="Applied to the photos in this upload" />
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </Card>
  );
}

export function UnitPhotosManager({
  unitId,
  listing,
  condition,
}: {
  unitId: string;
  listing: Photo[];
  condition: Photo[];
}) {
  return (
    <div className="space-y-6">
      <PhotoSection
        unitId={unitId}
        kind="listing"
        title="Listing photos"
        subtitle="Shown to the public for vacant-unit marketing."
        photos={listing}
      />
      <PhotoSection
        unitId={unitId}
        kind="condition"
        title="Move-in / condition photos"
        subtitle="Private record — not shown publicly."
        photos={condition}
      />
    </div>
  );
}
