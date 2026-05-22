'use client';
import { useEffect, useState, useCallback } from 'react';
import { API } from '@/lib/config';

interface Provider {
  _id: string;
  name: string;
  monthlyQuota: number;
  leadsReceived: number;
}

interface Lead {
  _id: string;
  customerName: string;
  phone: string;
  city: string;
  serviceId: { _id: string; name: string };
  description: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  createdAt: string;
  assignedProviders: { _id: string; name: string }[];
}

interface Service { _id: string; name: string; }

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
};

const SERVICE_STYLES: Record<string, string> = {
  'Service 1': 'bg-violet-100 text-violet-700',
  'Service 2': 'bg-sky-100 text-sky-700',
  'Service 3': 'bg-amber-100 text-amber-700',
};

const STATUS_OPTIONS = ['new', 'contacted', 'converted', 'closed'] as const;

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filterService, setFilterService] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    const res = await fetch(`${API}/providers`);
    setProviders(await res.json());
  }, []);

  const fetchLeads = useCallback(async (providerId: string) => {
    const res = await fetch(`${API}/providers/${providerId}/leads`);
    setLeads(await res.json());
  }, []);

  useEffect(() => {
    fetch(`${API}/services`).then((r) => r.json()).then(setServices);
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (selected) fetchLeads(selected);
  }, [selected, fetchLeads]);

  // SSE
  useEffect(() => {
    const es = new EventSource(`${API}/events`);
    es.addEventListener('new-lead', () => {
      setLastUpdate(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 1500);
      fetchProviders();
      if (selected) fetchLeads(selected);
    });
    es.addEventListener('quota-reset', (e) => {
      setProviders(JSON.parse(e.data));
      setLastUpdate(new Date());
    });
    es.addEventListener('lead-updated', (e) => {
      const updated: Lead = JSON.parse(e.data);
      setLeads((prev) => prev.map((l) => l._id === updated._id ? updated : l));
    });
    return () => es.close();
  }, [selected, fetchProviders, fetchLeads]);

  const updateStatus = async (leadId: string, status: string) => {
    setUpdatingStatus(leadId);
    await fetch(`${API}/leads/${leadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(null);
    if (selected) fetchLeads(selected);
  };

  const selectedProvider = providers.find((p) => p._id === selected);
  const totalLeads = providers.reduce((s, p) => s + p.leadsReceived, 0);
  const totalCapacity = providers.reduce((s, p) => s + p.monthlyQuota, 0);
  const fullProviders = providers.filter((p) => p.leadsReceived >= p.monthlyQuota).length;

  // Filtered leads — compare as strings since _id may be an object
  const filteredLeads = leads.filter((l) => {
    if (filterService && String(l.serviceId?._id) !== filterService) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Provider Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Select a provider to view their assigned leads.</p>
        </div>
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
          pulse ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
          : lastUpdate ? 'bg-slate-50 border-slate-200 text-slate-500'
          : 'bg-slate-50 border-slate-200 text-slate-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-emerald-500 animate-ping' : lastUpdate ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          {lastUpdate ? `Live · ${lastUpdate.toLocaleTimeString()}` : 'Listening for updates…'}
        </div>
      </div>

      {/* Platform stats bar */}
      {providers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Leads', value: totalLeads, color: 'text-indigo-600' },
            { label: 'Quota Used', value: `${totalLeads}/${totalCapacity}`, color: 'text-amber-600' },
            { label: 'Providers Active', value: `${providers.filter(p => p.leadsReceived > 0).length}/8`, color: 'text-emerald-600' },
            { label: 'Providers Full', value: fullProviders, color: fullProviders > 0 ? 'text-red-500' : 'text-slate-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Provider grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {providers.length === 0
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)
          : providers.map((p) => {
              const remaining = p.monthlyQuota - p.leadsReceived;
              const pct = Math.round((p.leadsReceived / p.monthlyQuota) * 100);
              const isSelected = selected === p._id;
              const isFull = remaining === 0;
              return (
                <button
                  key={p._id}
                  onClick={() => setSelected(isSelected ? null : p._id)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    isSelected ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {p.name.replace('Provider ', 'P')}
                    </span>
                    {isFull && <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Full</span>}
                  </div>
                  <p className="font-bold text-slate-900 text-xl leading-none">{p.leadsReceived}</p>
                  <p className="text-xs text-slate-400 mt-0.5">leads received</p>
                  <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isFull ? 'bg-red-400' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-[11px] mt-1 font-medium ${isFull ? 'text-red-500' : 'text-slate-400'}`}>
                    {remaining}/{p.monthlyQuota} remaining
                  </p>
                </button>
              );
            })}
      </div>

      {/* Leads panel */}
      {selected && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-semibold text-slate-900">{selectedProvider?.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{leads.length} lead{leads.length !== 1 ? 's' : ''} total</p>
              </div>
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:border-indigo-400"
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                >
                  <option value="">All Services</option>
                  {services.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
                <select
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:border-indigo-400"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 transition-colors ml-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">No leads match the current filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((lead) => (
                  <div key={lead._id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 hover:bg-white hover:border-slate-200 transition-all">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      {/* Left: customer info */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {lead.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{lead.customerName}</p>
                          <p className="text-xs text-slate-400">{lead.phone} · {lead.city}</p>
                        </div>
                      </div>

                      {/* Right: service + time + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SERVICE_STYLES[lead.serviceId?.name] ?? 'bg-slate-100 text-slate-600'}`}>
                          {lead.serviceId?.name}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[lead.status]}`}>
                          {lead.status}
                        </span>
                        <p className="text-[11px] text-slate-400">{new Date(lead.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {lead.description && (
                      <p className="text-xs text-slate-500 mt-2 pl-12">{lead.description}</p>
                    )}

                    {/* Footer: co-assigned + status update */}
                    <div className="mt-3 pl-12 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[11px] text-slate-400">
                        Also assigned to:{' '}
                        {lead.assignedProviders.filter((p) => p._id !== selected).map((p) => p.name).join(', ') || '—'}
                      </p>

                      {/* Status update */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Update:</span>
                        <select
                          disabled={updatingStatus === lead._id}
                          value={lead.status}
                          onChange={(e) => updateStatus(lead._id, e.target.value)}
                          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none focus:border-indigo-400 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                        {updatingStatus === lead._id && (
                          <svg className="w-3 h-3 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
