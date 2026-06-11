"use client";

import { useActionState, useEffect, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">
        Submit a request
      </h2>
      <form ref={formRef} action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-sm text-pine-dark">
            Request submitted — we&apos;ll be in touch.
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
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Priority</span>
            <select name="priority" className={inputClass} defaultValue="normal">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
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

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </Card>
  );
}
