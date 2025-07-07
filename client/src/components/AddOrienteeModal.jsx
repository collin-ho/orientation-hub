import React, { useState, useEffect } from 'react';

export default function AddOrienteeModal({ listId, onClose, onAdded }) {
  const [name, setName] = useState('');
  const [pillar, setPillar] = useState('');
  const [email, setEmail] = useState('');
  const [pillars, setPillars] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchPillars() {
      try {
        const resp = await fetch('/api/config/field-options/PILLAR');
        if (resp.ok) {
          const data = await resp.json();
          const opts = (data.options || []).map(o=>o.name ?? o);
          setPillars(opts);
        } else {
          setPillars(['PM','Measurement','People','Operations','Biz Dev','Strategy','Internal']);
        }
      } catch {
        setPillars(['PM','Measurement','People','Operations','Biz Dev','Strategy','Internal']);
      }
    }
    fetchPillars();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const resp = await fetch(`/api/class/${listId}/orientees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pillar, email })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to add orientee');
      }
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 w-full max-w-md p-6 rounded-lg" onClick={e=>e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Add Orientee</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Name *</label>
            <input className="w-full bg-slate-700 text-white px-3 py-2 rounded" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Pillar</label>
            <select className="w-full bg-slate-700 text-white px-3 py-2 rounded" value={pillar} onChange={e=>setPillar(e.target.value)}>
              <option value="">Select</option>
              {pillars.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Cogent Email</label>
            <input className="w-full bg-slate-700 text-white px-3 py-2 rounded" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded disabled:bg-slate-500">
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 