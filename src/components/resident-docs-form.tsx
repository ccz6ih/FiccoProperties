"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { addResidentDocument, type DocState } from "@/app/(admin)/admin/residents/actions";

const initial: DocState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export function ResidentDocsForm({ residentId }: { residentId: string }) {
  const [state, action, pending] = useActionState(addResidentDocument, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="md" onClick={() => setOpen(true)}>
        + Add file or note
      </Button>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-xl border border-clay bg-white/70 p-4">
      <input type="hidden" name="resident_id" value={residentId} />
      <label className="block text-xs font-medium text-ink-faint">
        Label
        <input name="label" placeholder="Credit report, background check…" className={field} />
      </label>
      <label className="block text-xs font-medium text-ink-faint">
        Note (optional)
        <textarea name="note" rows={2} placeholder="Internal notes — staff only" className={field} />
      </label>
      <label className="block text-xs font-medium text-ink-faint">
        File (optional)
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          className="mt-1 block text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
        />
      </label>
      {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
