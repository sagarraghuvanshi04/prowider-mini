'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API } from '@/lib/config';

interface Stats {
  totalLeads: number;
  activeProviders: number;
  capacityUsed: number;
  capacityTotal: number;
  byService: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`${API}/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.totalLeads ?? '—',
      sub: 'submitted to date',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Active Providers',
      value: stats ? `${stats.activeProviders} / ${8}` : '—',
      sub: 'have received leads',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Quota Used',
      value: stats ? `${stats.capacityUsed} / ${stats.capacityTotal}` : '—',
      sub: 'slots filled this month',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-14 px-4">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-indigo-100">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Live Lead Distribution System
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4 leading-tight">
          Connect customers with<br />
          <span className="text-indigo-600">the right providers</span>
        </h1>
        <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto mb-8">
          Prowider automatically routes service enquiries to qualified providers using fair, rule-based allocation — in real time.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/request-service" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm">
            Submit an Enquiry
          </Link>
          <Link href="/dashboard" className="bg-white text-slate-700 px-6 py-3 rounded-xl font-semibold text-sm border border-slate-200 hover:bg-slate-50 transition-colors">
            Provider Dashboard →
          </Link>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
              <span className={`text-lg font-bold ${s.color}`}>#</span>
            </div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label} · {s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Service breakdown */}
      {stats?.byService && stats.byService.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-4">Leads by Service</p>
          <div className="space-y-3">
            {stats.byService.map((s) => {
              const pct = stats.totalLeads > 0 ? Math.round((s.count / stats.totalLeads) * 100) : 0;
              return (
                <div key={s._id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{s._id}</span>
                    <span className="text-slate-400">{s.count} leads · {pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { step: '01', title: 'Customer Submits', desc: 'Customer fills the enquiry form with their name, phone, city, and service type.' },
          { step: '02', title: 'Auto-Assigned', desc: 'System assigns exactly 3 providers — mandatory first, then fair round-robin from the pool.' },
          { step: '03', title: 'Live Dashboard', desc: 'Providers see the new lead instantly on their dashboard via Server-Sent Events.' },
        ].map((item) => (
          <div key={item.step} className="bg-white rounded-2xl border border-slate-200 p-5">
            <span className="text-xs font-bold text-indigo-400 tracking-widest">{item.step}</span>
            <p className="font-semibold text-slate-900 mt-1 mb-1">{item.title}</p>
            <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA banner */}
      <div className="bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-white font-semibold">Ready to test the system?</p>
          <p className="text-slate-400 text-sm mt-0.5">Simulate concurrency, webhook idempotency, and quota resets.</p>
        </div>
        <Link href="/test-tools" className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors shrink-0">
          Open Test Tools
        </Link>
      </div>
    </div>
  );
}
