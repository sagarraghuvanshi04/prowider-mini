'use client';
import { useEffect, useState } from 'react';
import { API } from '@/lib/config';

interface Service { _id: string; name: string; }
type FormState = { customerName: string; phone: string; city: string; serviceId: string; description: string; };

interface SubmittedLead {
  customerName: string;
  serviceId: { name: string };
  assignedProviders: { _id: string; name: string }[];
  city: string;
  createdAt: string;
}

const MANDATORY: Record<string, string[]> = {
  'Service 1': ['Provider 1'],
  'Service 2': ['Provider 5'],
  'Service 3': ['Provider 1', 'Provider 4'],
};

export default function RequestServicePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<FormState>({ customerName: '', phone: '', city: '', serviceId: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedLead | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/services`).then((r) => r.json()).then(setServices);
  }, []);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Submission failed.');
      } else {
        setSubmitted(data);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (submitted) {
    const serviceName = submitted.serviceId?.name ?? '';
    const mandatory = MANDATORY[serviceName] ?? [];
    const poolProviders = submitted.assignedProviders.filter((p) => !mandatory.includes(p.name));
    const mandatoryProviders = submitted.assignedProviders.filter((p) => mandatory.includes(p.name));

    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Green header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-6 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg">Enquiry Submitted!</p>
            <p className="text-emerald-100 text-sm mt-1">Your lead has been saved and assigned to providers.</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <Row label="Customer" value={submitted.customerName} />
              <Row label="Service" value={serviceName} />
              <Row label="City" value={submitted.city} />
              <Row label="Submitted" value={new Date(submitted.createdAt).toLocaleString()} />
            </div>

            {/* Assigned providers */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Assigned Providers ({submitted.assignedProviders.length})
              </p>
              <div className="space-y-2">
                {mandatoryProviders.map((p) => (
                  <div key={p._id} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                        {p.name.replace('Provider ', '')}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Mandatory</span>
                  </div>
                ))}
                {poolProviders.map((p) => (
                  <div key={p._id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                        {p.name.replace('Provider ', '')}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Round-robin</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setSubmitted(null); setForm({ customerName: '', phone: '', city: '', serviceId: '', description: '' }); }}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              Submit Another Enquiry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Request a Service</h1>
        <p className="text-slate-500 text-sm mt-1">Fill in your details and we'll connect you with the right providers instantly.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4">
          <p className="text-white font-semibold text-sm">New Service Enquiry</p>
          <p className="text-indigo-200 text-xs mt-0.5">Fields marked * are required</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Full Name *">
              <input required placeholder="John Smith" className="input" value={form.customerName} onChange={set('customerName')} />
            </Field>
            <Field label="Phone Number *">
              <input required placeholder="9876543210" className="input" value={form.phone} onChange={set('phone')} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="City *">
              <input required placeholder="Mumbai" className="input" value={form.city} onChange={set('city')} />
            </Field>
            <Field label="Service Type *">
              <select required className="input" value={form.serviceId} onChange={set('serviceId')}>
                <option value="">Select a service…</option>
                {services.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea placeholder="Briefly describe what you need…" className="input resize-none" rows={3} value={form.description} onChange={set('description')} />
          </Field>

          {/* Allocation preview */}
          {form.serviceId && (() => {
            const svc = services.find((s) => s._id === form.serviceId);
            const mandatory = svc ? (MANDATORY[svc.name] ?? []) : [];
            return mandatory.length > 0 ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700">
                <span className="font-semibold">Mandatory assignment:</span> {mandatory.join(', ')} will always receive this lead.
                {' '}Remaining slots filled by fair round-robin.
              </div>
            ) : null;
          })()}

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Submitting…</>
            ) : 'Submit Enquiry'}
          </button>
        </form>
      </div>
      <p className="text-xs text-slate-400 text-center mt-3">
        Same phone number cannot submit duplicate enquiries for the same service.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
