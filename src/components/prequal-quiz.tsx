"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { submitPrequal, type GrowthState } from "@/app/(public)/availability/actions";
import { getFunnelSessionId } from "@/components/funnel-ping";

const initial: GrowthState = { ok: false };

const big =
  "flex-1 min-w-[8rem] rounded-xl border px-4 py-3 text-center text-sm font-medium transition";
const on = "border-pine bg-pine text-cream";
const off = "border-clay-deep bg-white/80 text-ink hover:bg-sand";

type Props = { properties: { id: string; name: string }[] };

export function PrequalQuiz({ properties }: Props) {
  const [state, action, pending] = useActionState(submitPrequal, initial);
  const [fsid, setFsid] = useState("");
  const [started, setStarted] = useState(false);

  const [moveIn, setMoveIn] = useState("");
  const [income, setIncome] = useState("");
  const [occupants, setOccupants] = useState("");
  const [pets, setPets] = useState("");
  const [voucher, setVoucher] = useState("");
  const [eviction, setEviction] = useState("");
  const [propertyId, setPropertyId] = useState("");

  useEffect(() => {
    setFsid(getFunnelSessionId());
  }, []);

  // First interaction = prequal_start (once).
  function markStarted() {
    if (started) return;
    setStarted(true);
    const sessionId = getFunnelSessionId();
    if (!sessionId) return;
    fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "prequal_start", sessionId, propertyId: propertyId || undefined }),
      keepalive: true,
    }).catch(() => {});
  }

  const answered = moveIn && income && occupants && pets && voucher && eviction;
  const strongFit = income !== "under2x" && eviction !== "yes";

  if (state.ok) {
    return (
      <Card className="p-6 text-center sm:p-8">
        {strongFit ? (
          <>
            <div className="text-3xl">🎉</div>
            <h3 className="mt-2 font-display text-xl font-semibold text-ink">
              You look like a strong fit
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              Based on your answers you meet our typical guidelines. The application takes about
              10 minutes — no fee to apply.
            </p>
            <Link
              href="/apply"
              className="mt-4 inline-block rounded-xl bg-pine px-6 py-3.5 text-sm font-semibold text-cream hover:bg-pine-dark"
            >
              Start your application →
            </Link>
          </>
        ) : (
          <>
            <div className="text-3xl">🤝</div>
            <h3 className="mt-2 font-display text-xl font-semibold text-ink">
              Worth a conversation
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              A couple of your answers may need a closer look, but everyone is welcome to apply —
              we review every application individually, and a chat with our team often clears
              things up fast.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/apply"
                className="rounded-xl bg-pine px-6 py-3.5 text-sm font-semibold text-cream hover:bg-pine-dark"
              >
                Apply anyway →
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border border-clay-deep px-6 py-3.5 text-sm font-semibold text-ink hover:bg-sand"
              >
                Talk to us first
              </Link>
            </div>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-ink">
        See if you qualify — 60 seconds
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Six quick questions, instant answer. Nothing is recorded against you.
      </p>

      <form action={action} className="mt-5 space-y-5" onChange={markStarted}>
        <input type="hidden" name="fsid" value={fsid} />

        <Q label="When do you want to move?">
          {[
            ["asap", "ASAP"],
            ["1-2mo", "1–2 months"],
            ["3mo+", "3+ months"],
          ].map(([v, l]) => (
            <Pick key={v} name="move_in" value={v} label={l} current={moveIn} set={setMoveIn} />
          ))}
        </Q>

        <Q label="Monthly household income (before taxes)?" hint="We look for about 2× the rent — most of our homes run $1,325–$1,700.">
          {[
            ["under2x", "Under $2,800"],
            ["2to3x", "$2,800 – $4,500"],
            ["over3x", "$4,500+"],
          ].map(([v, l]) => (
            <Pick key={v} name="income_band" value={v} label={l} current={income} set={setIncome} />
          ))}
        </Q>

        <Q label="How many people would live here?">
          {[
            ["1", "Just me"],
            ["2", "Two"],
            ["3+", "Three or more"],
          ].map(([v, l]) => (
            <Pick key={v} name="occupants" value={v} label={l} current={occupants} set={setOccupants} />
          ))}
        </Q>

        <Q label="Any pets?" hint="Our communities are pet-free. Assistance animals are always welcome with documentation.">
          {[
            ["no", "No pets"],
            ["yes", "Yes"],
          ].map(([v, l]) => (
            <Pick key={v} name="has_pets" value={v} label={l} current={pets} set={setPets} />
          ))}
        </Q>

        <Q label="Using a housing voucher?" hint="Vouchers are welcome — this just helps us prep paperwork.">
          {[
            ["no", "No"],
            ["yes", "Yes"],
          ].map(([v, l]) => (
            <Pick key={v} name="has_voucher" value={v} label={l} current={voucher} set={setVoucher} />
          ))}
        </Q>

        <Q label="Any evictions in the last 5 years?">
          {[
            ["no", "No"],
            ["yes", "Yes"],
          ].map(([v, l]) => (
            <Pick key={v} name="had_eviction" value={v} label={l} current={eviction} set={setEviction} />
          ))}
        </Q>

        <Q label="Which community interests you?">
          <select
            name="property_id"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-3 text-sm text-ink"
          >
            <option value="">No preference</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Q>

        <Button type="submit" size="lg" variant="primary" className="w-full" disabled={!answered || pending}>
          {pending ? "Checking…" : answered ? "Get my answer" : "Answer the questions above"}
        </Button>
        {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
      </form>
    </Card>
  );
}

function Q({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pick({
  name, value, label, current, set,
}: {
  name: string; value: string; label: string; current: string; set: (v: string) => void;
}) {
  return (
    <label className={`${big} cursor-pointer ${current === value ? on : off}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => set(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
