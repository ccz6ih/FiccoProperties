"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card } from "@/components/ui";
import { addVehicle, deleteVehicle, type VehicleState } from "@/app/account/actions";

const initial: VehicleState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

type Vehicle = {
  id: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  plate: string | null;
  state: string | null;
};

/** "2019 Honda Civic · Silver · CO ABC-123" */
function describe(v: Vehicle): string {
  const head = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (head) parts.push(head);
  if (v.color) parts.push(v.color);
  const plate = [v.state, v.plate].filter(Boolean).join(" ");
  if (plate) parts.push(plate);
  return parts.join(" · ") || "Vehicle";
}

export function VehiclesManager({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, action, pending] = useActionState(addVehicle, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <Card className="p-6">
      {vehicles.length > 0 ? (
        <ul className="mb-6 divide-y divide-clay">
          {vehicles.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm text-ink">{describe(v)}</span>
              <form action={deleteVehicle}>
                <input type="hidden" name="id" value={v.id} />
                <Button type="submit" variant="ghost" className="h-8 px-3 text-xs text-terracotta-dark">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-ink-soft">No vehicles on file yet.</p>
      )}

      <form ref={formRef} action={action} className="space-y-4 border-t border-clay pt-6">
        <h3 className="font-display text-base font-semibold text-ink">Add a vehicle</h3>

        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Make</span>
            <input name="make" className={inputClass} placeholder="Honda" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Model</span>
            <input name="model" className={inputClass} placeholder="Civic" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Color</span>
            <input name="color" className={inputClass} placeholder="Silver" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Year</span>
            <input name="year" inputMode="numeric" className={inputClass} placeholder="2019" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Plate</span>
            <input name="plate" className={inputClass} placeholder="ABC-123" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">State</span>
            <input name="state" className={inputClass} placeholder="CO" />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Notes</span>
          <input name="notes" className={inputClass} placeholder="Optional — e.g. parking spot 4" />
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Adding…" : "Add vehicle"}
        </Button>
      </form>
    </Card>
  );
}
