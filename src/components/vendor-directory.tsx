"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  saveVendor,
  toggleVendorActive,
  type VendorState,
} from "@/app/(admin)/admin/vendors/actions";

const initial: VendorState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type Vendor = {
  id: string;
  name: string;
  trade: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  coi_expires_on: string | null;
  w9_on_file: boolean;
  active: boolean;
};

function coiStatus(v: Vendor): { label: string; cls: string } {
  if (!v.coi_expires_on) return { label: "No COI on file", cls: "bg-sand text-ink-soft" };
  const [y, m, d] = v.coi_expires_on.split("-").map(Number);
  const days = Math.round((new Date(y, m - 1, d).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Insurance expired ${formatDate(v.coi_expires_on)}`, cls: "bg-terracotta text-cream" };
  if (days <= 30) return { label: `Insurance expires in ${days}d`, cls: "bg-gold/25 text-ink" };
  return { label: `Insured thru ${formatDate(v.coi_expires_on)}`, cls: "bg-pine/15 text-pine" };
}

function VendorFields({ vendor }: { vendor?: Vendor }) {
  return (
    <>
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Name</span>
          <input name="name" defaultValue={vendor?.name} required className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Trade</span>
          <input name="trade" defaultValue={vendor?.trade ?? ""} placeholder="Plumber, electrician…" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Phone</span>
          <input name="phone" type="tel" defaultValue={vendor?.phone ?? ""} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Email</span>
          <input name="email" type="email" defaultValue={vendor?.email ?? ""} className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Insurance (COI) expires
          </span>
          <input type="date" name="coi_expires_on" defaultValue={vendor?.coi_expires_on ?? ""} className={field} />
        </label>
        <label className="mt-5 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="w9_on_file"
            defaultChecked={vendor?.w9_on_file}
            className="h-4 w-4 rounded border-clay-deep accent-pine"
          />
          W-9 on file
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Notes</span>
          <input name="notes" defaultValue={vendor?.notes ?? ""} placeholder="Rates, preferences…" className={field} />
        </label>
      </div>
    </>
  );
}

export function VendorAddForm() {
  const [state, action, pending] = useActionState(saveVendor, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <VendorFields />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Add vendor"}
        </Button>
        {state.ok && <span className="text-sm font-medium text-pine">Added ✓</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}

function VendorEditForm({ vendor, onDone }: { vendor: Vendor; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveVendor, initial);
  return (
    <form action={action} className="space-y-3">
      <VendorFields vendor={vendor} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <button type="button" onClick={onDone} className="text-sm text-ink-soft hover:text-ink">
          Close
        </button>
        {state.ok && <span className="text-sm font-medium text-pine">Saved ✓</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}

export function VendorTable({ vendors }: { vendors: Vendor[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = vendors.filter((v) => (showArchived ? true : v.active));
  const archivedCount = vendors.filter((v) => !v.active).length;

  return (
    <div>
      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((s) => !s)}
          className="mb-3 text-xs font-medium text-ink-faint hover:text-ink"
        >
          {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
        </button>
      )}
      <div className="overflow-hidden rounded-2xl border border-clay bg-cream">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Insurance</th>
                <th className="px-5 py-3 font-medium">W-9</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-clay">
              {visible.map((v) => {
                const coi = coiStatus(v);
                return (
                  <Fragment key={v.id}>
                    <tr className={v.active ? "hover:bg-sand/30" : "opacity-60"}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{v.name}</div>
                        <div className="text-xs text-ink-faint">{v.trade ?? "—"}</div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {v.phone && (
                          <a href={`tel:${v.phone.replace(/[^0-9+]/g, "")}`} className="block font-medium text-pine hover:underline">
                            {v.phone}
                          </a>
                        )}
                        {v.email && <div className="text-xs text-ink-soft">{v.email}</div>}
                        {!v.phone && !v.email && <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${coi.cls}`}>
                          {coi.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {v.w9_on_file ? (
                          <span className="text-xs font-medium text-pine">✓ On file</span>
                        ) : (
                          <span className="text-xs text-ink-faint">Missing</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setEditing((p) => (p === v.id ? null : v.id))}
                            className="text-xs font-medium text-pine hover:underline"
                          >
                            {editing === v.id ? "Close" : "Edit"}
                          </button>
                          <form action={toggleVendorActive}>
                            <input type="hidden" name="id" value={v.id} />
                            <input type="hidden" name="active" value={v.active ? "0" : "1"} />
                            <button type="submit" className="text-xs text-ink-faint hover:text-terracotta-dark">
                              {v.active ? "Archive" : "Restore"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    {editing === v.id && (
                      <tr className="bg-sand/30">
                        <td colSpan={5} className="px-5 py-4">
                          <VendorEditForm vendor={v} onDone={() => setEditing(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-ink-faint">
                    No vendors yet — add your regulars above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
