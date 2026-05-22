'use client';
import { useState, useRef } from 'react';
import { API } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';

interface Result {
  toolId: string;
  title: string;
  data: unknown;
  ok: boolean;
  ts: string;
  callNumber: number;
}

// Simulated provider plans — mirrors real payment gateway UI
const PLANS = [
  { id: 'basic', name: 'Basic Plan', price: '₹999', leads: 10, color: 'border-slate-200 bg-white' },
  { id: 'pro', name: 'Pro Plan', price: '₹2,499', leads: 10, color: 'border-indigo-400 bg-indigo-50', popular: true },
  { id: 'enterprise', name: 'Enterprise', price: '₹4,999', leads: 10, color: 'border-slate-200 bg-white' },
];

export default function TestToolsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('pro');

  // Fixed event ID — simulates the same payment confirmation being retried
  const [quotaEventId] = useState(() => uuidv4());
  const callCounts = useRef<Record<string, number>>({});

  const run = async (toolId: string, title: string, fn: () => Promise<Response>) => {
    setLoading(toolId);
    callCounts.current[toolId] = (callCounts.current[toolId] || 0) + 1;
    const callNumber = callCounts.current[toolId];
    try {
      const res = await fn();
      const data = await res.json();
      setResults((prev) => [{ toolId, title, data, ok: res.ok, ts: new Date().toLocaleTimeString(), callNumber }, ...prev]);
    } catch (e) {
      setResults((prev) => [{ toolId, title, data: String(e), ok: false, ts: new Date().toLocaleTimeString(), callNumber }, ...prev]);
    } finally {
      setLoading(null);
    }
  };

  const confirmPayment = () =>
    run('confirm-payment', 'Payment Confirmed', () =>
      fetch(`${API}/webhook/reset-quota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: quotaEventId }),
      })
    );

  const retryPayment = () =>
    run('retry-payment', 'Payment Retry (Idempotency)', () =>
      fetch(`${API}/webhook/reset-quota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: quotaEventId }),
      })
    );

  const bulkLeads = () =>
    run('bulk-leads', 'Generate 10 Leads', () =>
      fetch(`${API}/webhook/bulk-leads`, { method: 'POST' })
    );

  return (
    <div className="max-w-3xl mx-auto">

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Gateway Simulator</h1>
        </div>
        <p className="text-slate-500 text-sm">
          Simulates a payment gateway confirming a provider subscription. On successful payment, the webhook resets the provider's monthly lead quota.
        </p>
      </div>

      {/* ── Section 1: Payment simulation ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
          <p className="text-white font-semibold">Select a Subscription Plan</p>
          <p className="text-emerald-100 text-xs mt-0.5">Confirming payment triggers the webhook and resets provider quota to 10</p>
        </div>

        <div className="p-6">
          {/* Plan selector */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  selectedPlan === plan.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : plan.color
                } hover:border-emerald-400`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                )}
                <p className="font-semibold text-slate-900 text-sm">{plan.name}</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">{plan.price}</p>
                <p className="text-xs text-slate-400 mt-0.5">{plan.leads} leads / month</p>
                {selectedPlan === plan.id && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Payment details */}
          <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-800">{PLANS.find(p => p.id === selectedPlan)?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Quota granted</span>
              <span className="font-medium text-slate-800">10 leads / month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Webhook event ID</span>
              <span className="font-mono text-xs text-slate-500">{quotaEventId.slice(0, 24)}…</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="font-bold text-slate-900">{PLANS.find(p => p.id === selectedPlan)?.price}</span>
            </div>
          </div>

          {/* Confirm payment button */}
          <button
            onClick={confirmPayment}
            disabled={loading === 'confirm-payment'}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading === 'confirm-payment' ? (
              <><Spinner />Processing Payment…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Confirm Payment & Activate Subscription</>
            )}
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">
            This triggers <code className="bg-slate-100 px-1 rounded">POST /api/webhook/reset-quota</code> with the event ID above
          </p>
        </div>
      </div>

      {/* ── Section 2: Idempotency test ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Retry Payment (Idempotency Test)</p>
              <p className="text-xs text-slate-400">Simulates the payment gateway retrying the same webhook call</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-slate-500 mb-4">
            In real payment gateways, network failures cause the same webhook to be sent multiple times with the same event ID.
            This button sends the <strong>same event ID</strong> as "Confirm Payment" above — the system must process it only once.
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs font-mono bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg flex-1 truncate">
              Event ID: {quotaEventId}
            </div>
            <button
              onClick={retryPayment}
              disabled={loading === 'retry-payment'}
              className="shrink-0 bg-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {loading === 'retry-payment' ? <><Spinner />Running…</> : 'Retry Webhook'}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-2 font-medium">
            💡 Expected: returns <code className="bg-amber-100 px-1 rounded">idempotent: true</code> — quota is NOT reset again
          </p>
        </div>
      </div>

      {/* ── Section 3: Concurrency test ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Generate 10 Leads Simultaneously</p>
              <p className="text-xs text-slate-400">Tests concurrency safety of the allocation engine</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-slate-500 mb-4">
            Fires 10 lead creation requests at the same time using <code className="bg-slate-100 px-1 rounded text-xs">Promise.allSettled</code>.
            Verifies that MongoDB transactions prevent quota overflow and allocation remains correct under simultaneous load.
          </p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-orange-600 font-medium">
              💡 Check the Dashboard after running — all providers must stay within their quota of 10
            </p>
            <button
              onClick={bulkLeads}
              disabled={loading === 'bulk-leads'}
              className="shrink-0 bg-orange-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {loading === 'bulk-leads' ? <><Spinner />Running…</> : 'Generate 10 Leads'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Response log ── */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-semibold text-slate-800">Webhook Response Log</p>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{results.length}</span>
            </div>
            <button onClick={() => setResults([])} className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium">
              Clear
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-semibold text-slate-800">{r.title}</span>
                  <span className="text-xs text-slate-400">call #{r.callNumber}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-slate-400">{r.ts}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {r.ok ? '200 OK' : 'ERROR'}
                    </span>
                  </div>
                </div>
                <ResultSummary toolId={r.toolId} data={r.data} />
                <details className="mt-2">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">View raw JSON</summary>
                  <pre className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                    {JSON.stringify(r.data, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultSummary({ toolId, data }: { toolId: string; data: unknown }) {
  const d = data as Record<string, unknown>;

  if (toolId === 'confirm-payment' || toolId === 'retry-payment') {
    if (d?.idempotent) {
      return (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          <span>🔁</span>
          <span><strong>Duplicate webhook detected</strong> — this payment was already processed. Quota was NOT reset again.</span>
        </div>
      );
    }
    if (d?.providers && Array.isArray(d.providers)) {
      const providers = d.providers as { name: string; leadsReceived: number; monthlyQuota: number }[];
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <p className="text-sm font-medium text-emerald-800 mb-2">✓ Payment confirmed — quota reset for {providers.length} providers</p>
          <div className="grid grid-cols-4 gap-1.5">
            {providers.map((p) => (
              <div key={p.name} className="bg-white rounded-lg px-2 py-1.5 text-center border border-emerald-100">
                <p className="text-[11px] font-semibold text-slate-600">{p.name.replace('Provider ', 'P')}</p>
                <p className="text-xs text-emerald-600 font-bold">{p.monthlyQuota - p.leadsReceived}/{p.monthlyQuota}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  if (toolId === 'bulk-leads') {
    const created = d?.created as number;
    const failed = d?.failed as string[];
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
        <p className="font-medium text-blue-800 mb-1">⚡ Concurrency test complete</p>
        <div className="flex gap-4 text-xs">
          <span className="text-emerald-700 font-semibold">✓ {created} leads created</span>
          {failed?.length > 0
            ? <span className="text-red-600 font-semibold">✗ {failed.length} failed</span>
            : <span className="text-slate-500">0 failures — no quota overflow</span>}
        </div>
        {failed?.length > 0 && (
          <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
            {failed.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
      </div>
    );
  }

  return null;
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
