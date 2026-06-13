"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import {
  updateResidentContact,
  type ContactState,
} from "@/app/(admin)/admin/residents/actions";
import { useActionState } from "react";

const initial: ContactState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium text-ink-faint";

export type ResidentContact = {
  id: string;
  full_name: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export function ResidentContactEdit({ resident }: { resident: ResidentContact }) {
  const [state, action, pending] = useActionState(updateResidentContact, initial);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs font-medium text-pine hover:text-pine-dark"
    >
      Edit
    </button>
  );

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="my-8 w-full max-w-md rounded-2xl bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            Edit contact
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-sand"
          >
            ✕
          </button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="profile_id" value={resident.id} />
          <label className={lbl}>
            Full name
            <input name="full_name" defaultValue={resident.full_name ?? ""} className={field} />
          </label>
          <label className={lbl}>
            Phone
            <input name="phone" defaultValue={resident.phone ?? ""} className={field} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Emergency contact
              <input
                name="emergency_contact_name"
                defaultValue={resident.emergency_contact_name ?? ""}
                className={field}
              />
            </label>
            <label className={lbl}>
              Emergency phone
              <input
                name="emergency_contact_phone"
                defaultValue={resident.emergency_contact_phone ?? ""}
                className={field}
              />
            </label>
          </div>
          <p className="text-[11px] text-ink-faint">
            The resident&apos;s sign-in email is managed by their account and
            can&apos;t be changed here.
          </p>
          {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {open && mounted && createPortal(dialog, document.body)}
    </>
  );
}
