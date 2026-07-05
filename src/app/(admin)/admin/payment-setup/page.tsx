import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { requireProfile, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          ok ? "bg-pine text-cream" : "bg-clay text-ink-faint"
        }`}
      >
        {ok ? "✓" : "•"}
      </span>
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="text-xs text-ink-faint">{hint}</div>}
      </div>
    </li>
  );
}

export default async function PaymentSetup() {
  const { profile } = await requireProfile("/admin/payment-setup");
  if (!isStaff(profile)) redirect("/portal");

  const provider = process.env.PAYMENTS_PROVIDER ?? "mock";
  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const wh = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");

  const mode = sk.startsWith("sk_live") ? "live" : sk.startsWith("sk_test") ? "test" : null;
  const stripeSelected = provider === "stripe";
  const allKeys = !!sk && !!pk && !!wh;
  const live = stripeSelected && allKeys;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Online payments (Stripe)"
        subtitle="Wire up ACH bank payments. Nothing is live until you switch it on — residents use the current flow until then."
        action={
          <Link
            href="/admin/payments"
            className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
          >
            ← Payments
          </Link>
        }
      />

      {/* Status banner */}
      <div
        className={`mb-6 rounded-2xl border p-5 ${
          live
            ? "border-pine/30 bg-pine-soft"
            : "border-clay bg-sand/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              live ? "bg-pine" : "bg-clay-deep"
            }`}
          />
          <div className="font-display text-lg font-semibold text-ink">
            {live
              ? `Stripe is ON · ${mode} mode`
              : stripeSelected
                ? "Stripe selected — finish the setup below"
                : "Online payments are OFF (safe)"}
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {live
            ? "Residents can pay rent by ACH from their portal. Payments flow into the same charges, ledger, rent board, and owner report as manual entries."
            : "The portal currently uses a built-in test flow — no real money moves. Add the keys below and set PAYMENTS_PROVIDER=stripe to go live."}
        </p>
      </div>

      {/* Config checklist */}
      <Card className="mb-6 p-6">
        <h2 className="mb-1 font-display text-base font-semibold text-ink">Configuration</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Keys are stored as environment variables in Vercel (never in the app or database).
          Add them under Project → Settings → Environment Variables, then redeploy.
        </p>
        <ul className="divide-y divide-clay">
          <Check
            ok={stripeSelected}
            label="PAYMENTS_PROVIDER = stripe"
            hint={stripeSelected ? "Set — Stripe is the active provider." : "Still on the mock. Set to “stripe” to activate."}
          />
          <Check
            ok={!!sk}
            label="STRIPE_SECRET_KEY"
            hint={mode ? `Set — ${mode} key detected (sk_${mode}_…).` : "Not set. Use sk_test_… while testing, sk_live_… to go live."}
          />
          <Check
            ok={!!pk}
            label="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
            hint={pk ? "Set." : "Not set. pk_test_… / pk_live_… — powers the bank-link screen."}
          />
          <Check
            ok={!!wh}
            label="STRIPE_WEBHOOK_SECRET"
            hint={wh ? "Set." : "Not set. From the webhook endpoint you create in Stripe (whsec_…)."}
          />
        </ul>
      </Card>

      {/* Webhook */}
      <Card className="mb-6 p-6">
        <h2 className="mb-1 font-display text-base font-semibold text-ink">Webhook endpoint</h2>
        <p className="mb-2 text-sm text-ink-soft">
          ACH clears in 1–3 business days, so Stripe tells us when it settles. In the Stripe
          dashboard → Developers → Webhooks, add an endpoint pointing to:
        </p>
        <code className="block break-all rounded-lg border border-clay-deep bg-cream px-3 py-2 text-sm text-ink">
          {appUrl}/api/webhooks/stripe
        </code>
        <p className="mt-2 text-xs text-ink-faint">
          Send events: <span className="font-medium">payment_intent.succeeded</span> and{" "}
          <span className="font-medium">payment_intent.payment_failed</span>. Copy the signing
          secret into STRIPE_WEBHOOK_SECRET.
        </p>
      </Card>

      {/* Go-live checklist */}
      <Card className="p-6">
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Go-live checklist</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
          <li>Create the Stripe account; complete business verification (EIN, payout bank).</li>
          <li>Enable <span className="font-medium">ACH Direct Debit</span> + Financial Connections.</li>
          <li>Add the <span className="font-medium">test</span> keys here and set PAYMENTS_PROVIDER=stripe.</li>
          <li>We finish the resident bank-link screen (SetupIntent + Financial Connections) and test a payment end-to-end in test mode.</li>
          <li>Register the webhook (above) and confirm a test payment settles automatically.</li>
          <li>Swap test keys for <span className="font-medium">live</span> keys and pilot with a few tenants.</li>
        </ol>
        <p className="mt-4 rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink-soft">
          Manual entry (cash, check, money order) always stays available — online pay is an added
          option, not a replacement.
        </p>
      </Card>
    </div>
  );
}
