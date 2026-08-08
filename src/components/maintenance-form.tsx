"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  createMaintenanceRequest,
  type MaintenanceState,
} from "@/app/(resident)/portal/maintenance/actions";

const initial: MaintenanceState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function MaintenanceForm() {
  const [state, action, pending] = useActionState(createMaintenanceRequest, initial);
  const [phase, setPhase] = useState<"gate" | "emergency" | "form">("gate");
  const [isEmergency, setIsEmergency] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  // ---- Triage gate: route true emergencies before the form ----
  if (phase === "gate") {
    return (
      <Card className="space-y-4 p-6 text-center">
        <h2 className="font-display text-lg font-semibold text-ink">
          Is this an emergency happening right now?
        </h2>
        <p className="mx-auto max-w-sm text-sm text-ink-soft">
          Things like active flooding, sewage backup, no heat in freezing weather,
          no water, or a door that won&apos;t lock.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setPhase("emergency")}
            className="rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Yes — it&apos;s urgent
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEmergency(false);
              setPhase("form");
            }}
            className="rounded-xl border border-clay-deep px-5 py-3 text-sm font-semibold text-ink hover:bg-sand"
          >
            No — it can wait for the queue
          </button>
        </div>
      </Card>
    );
  }

  if (phase === "emergency") {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-center font-display text-lg font-semibold text-ink">
          Get help fast
        </h2>
        <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
          <strong>Smell gas, see fire or smoke, or a carbon-monoxide alarm?</strong>{" "}
          Leave the building and call <a href="tel:911" className="font-bold underline">911</a> first.
        </div>
        <a
          href="tel:+17205272596"
          className="block rounded-xl bg-terracotta px-6 py-4 text-center text-lg font-bold text-cream hover:bg-terracotta-dark"
        >
          📞 Call us now — (720) 527-2596
        </a>
        <p className="text-center text-sm text-ink-soft">
          For flooding, sewage, no heat, no water, or lock-outs — call first, then log it below
          so it&apos;s on record.
        </p>
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsEmergency(true);
              setPhase("form");
            }}
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            Log the emergency request →
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">
        {isEmergency ? "Log the emergency" : "Submit a request"}
      </h2>
      {isEmergency && (
        <p className="mb-3 rounded-lg bg-terracotta-soft px-3 py-2 text-xs text-terracotta-dark">
          Marked as an <strong>emergency</strong> — the owners are alerted immediately. If you
          haven&apos;t called yet: (720) 527-2596.
        </p>
      )}
      <form ref={formRef} action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-sm text-pine-dark">
            Request submitted — track its progress below.
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">What&apos;s going on?</span>
          <input name="title" className={inputClass} placeholder="e.g. Kitchen faucet is leaking" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Category</span>
            <select name="category" className={inputClass} defaultValue="general">
              <option value="general">General</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="hvac">Heating / cooling</option>
              <option value="appliance">Appliance</option>
              <option value="structural">Structural</option>
              <option value="pest">Pest</option>
              <option value="other">Other</option>
            </select>
          </label>
          {isEmergency ? (
            <input type="hidden" name="priority" value="emergency" />
          ) : (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Priority</span>
              <select name="priority" className={inputClass} defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Details</span>
          <textarea
            name="description"
            rows={3}
            className={inputClass}
            placeholder="Where is it, when did it start, anything we should know…"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Photos (optional)</span>
          <span className="block text-xs text-ink-faint">
            A photo helps us bring the right parts on the first trip.
          </span>
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-pine file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-pine-dark"
          />
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Submitting…" : isEmergency ? "Submit emergency request" : "Submit request"}
        </Button>
      </form>
    </Card>
  );
}
