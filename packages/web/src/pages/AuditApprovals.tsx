import React, { useState } from 'react';

const PENDING_AUDITS = [
  {
    id: 'AUD-001',
    title: 'Disaster Relief Fund Expenditure Review',
    description: 'Review of all expenditures from the Clearwater Ridge Wildfire relief fund including Class D estimates and financial disbursements.',
    requestedBy: 'Regional District Recovery Office',
    date: 'Aug 20, 2026',
    category: 'Financial',
    priority: 'High',
  },
  {
    id: 'AUD-002',
    title: 'Impact Assessment Verification',
    description: 'Third-party verification of reported impact scores across all PPOST categories — Human Wellness, Housing, Environment, Economy, and Infrastructure.',
    requestedBy: 'Provincial Emergency Management',
    date: 'Aug 22, 2026',
    category: 'Assessment',
    priority: 'High',
  },
  {
    id: 'AUD-003',
    title: 'Recovery Plan Compliance Audit',
    description: 'Audit of the Initial Recovery Plan to confirm alignment with provincial disaster recovery guidelines and eligibility requirements.',
    requestedBy: 'Ministry of Emergency Management',
    date: 'Sep 1, 2026',
    category: 'Compliance',
    priority: 'Medium',
  },
  {
    id: 'AUD-004',
    title: 'Class D Estimate Documentation',
    description: 'Review of all Class D cost estimates submitted for infrastructure and housing recovery. Credentials and supporting documents required.',
    requestedBy: 'Insurance and Risk Management Office',
    date: 'Sep 5, 2026',
    category: 'Financial',
    priority: 'Medium',
  },
  {
    id: 'AUD-005',
    title: 'Governance & Decision Log Review',
    description: 'Audit of all recorded decisions, approvals, and escalations during the active recovery period for accountability and transparency.',
    requestedBy: 'Internal Audit Committee',
    date: 'Sep 12, 2026',
    category: 'Governance',
    priority: 'Low',
  },
];

const categoryColors: Record<string, string> = {
  Financial:  'bg-orange-900/40 text-orange-400 border-orange-800',
  Assessment: 'bg-blue-900/40 text-blue-400 border-blue-800',
  Compliance: 'bg-purple-900/40 text-purple-400 border-purple-800',
  Governance: 'bg-gray-800 text-gray-400 border-gray-700',
};

const priorityColors: Record<string, string> = {
  High:   'text-red-400',
  Medium: 'text-yellow-400',
  Low:    'text-gray-400',
};

const FILTERS = ['All', 'Financial', 'Assessment', 'Compliance', 'Governance'];

const AuditApprovals = () => {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? PENDING_AUDITS : PENDING_AUDITS.filter(a => a.category === filter);

  const counts = {
    total: PENDING_AUDITS.length,
    high: PENDING_AUDITS.filter(a => a.priority === 'High').length,
    financial: PENDING_AUDITS.filter(a => a.category === 'Financial').length,
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit & Approvals</h1>
          <p className="text-gray-400 text-sm mt-1">Pending audit requests · Clearwater Ridge Wildfire recovery operation</p>
        </div>
        <span className="bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs px-3 py-1.5 rounded-full font-medium">
          SYNTHETIC DATA
        </span>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-white">{counts.total}</div>
          <div className="text-gray-400 text-sm mt-1">Pending audits</div>
          <div className="text-gray-500 text-xs mt-0.5">Awaiting credentials</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-red-400">{counts.high}</div>
          <div className="text-gray-400 text-sm mt-1">High priority</div>
          <div className="text-gray-500 text-xs mt-0.5">Requires immediate attention</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-orange-400">{counts.financial}</div>
          <div className="text-gray-400 text-sm mt-1">Financial reviews</div>
          <div className="text-gray-500 text-xs mt-0.5">Expenditure & estimates</div>
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-5 py-4 flex items-start gap-3">
        <div className="text-yellow-400 text-lg mt-0.5">⚠</div>
        <div>
          <div className="text-yellow-300 font-semibold text-sm">Credentials Required</div>
          <div className="text-yellow-200/70 text-xs mt-1">
            These audits are pending credential verification from the requesting authority. No action can be taken until the appropriate audit credentials are supplied. All items are <span className="font-semibold">SYNTHETIC DATA</span> for demonstration purposes.
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Audit list — 2 column grid */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {filtered.map(audit => (
          <div key={audit.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs font-mono">{audit.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[audit.category]}`}>
                  {audit.category}
                </span>
                <span className={`text-xs font-medium ${priorityColors[audit.priority]}`}>
                  {audit.priority} priority
                </span>
              </div>
              <span className="shrink-0 bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs px-2.5 py-1 rounded-full font-medium">
                PENDING
              </span>
            </div>

            <div>
              <h3 className="text-white font-semibold text-sm">{audit.title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed mt-1.5">{audit.description}</p>
            </div>

            <div className="mt-auto pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>Requested by: <span className="text-gray-400">{audit.requestedBy}</span></span>
              <span>{audit.date}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default AuditApprovals;
