"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import {
  setPropertyCover,
  removePropertyCover,
  type CoverState,
} from "@/app/(admin)/admin/properties/actions";

const initial: CoverState = { ok: false };

export function PropertyCoverForm({
  propertyId,
  slug,
  heroImage,
}: {
  propertyId: string;
  slug: string;
  heroImage: string | null;
}) {
  const [state, action, pending] = useActionState(setPropertyCover, initial);

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-clay bg-sand">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">
            No cover photo
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div className="text-sm font-medium text-ink">Community cover photo</div>
        <p className="text-xs text-ink-faint">
          Shown on the homepage card and the property page header.
        </p>
        {state.error && (
          <div className="text-xs font-medium text-terracotta-dark">{state.error}</div>
        )}
        {state.ok && (
          <div className="text-xs font-medium text-pine-dark">Cover photo updated.</div>
        )}
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="property_id" value={propertyId} />
          <input type="hidden" name="slug" value={slug} />
          <input
            type="file"
            name="cover"
            accept="image/*"
            className="block text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-clay"
          />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Uploading…" : heroImage ? "Replace" : "Upload"}
          </Button>
        </form>
      </div>

      {heroImage && (
        <form action={removePropertyCover}>
          <input type="hidden" name="property_id" value={propertyId} />
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="rounded-lg border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-sand"
          >
            Remove
          </button>
        </form>
      )}
    </Card>
  );
}
