import React, { useState } from 'react';

const FUNDING_SOURCES = [
  {
    id: 'FS-001',
    program: 'Disaster Financial Assistance Arrangements (DFAA)',
    authority: 'Public Safety Canada — Federal',
    maxAmount: 8500000,
    applied: true,
    status: 'Under Review',
    submitted: 'Aug 18, 2026',
    category: 'Federal',
  },
  {
    id: 'FS-002',
    program: 'BC Disaster Recovery Program (DRP)',
    authority: 'Ministry of Emergency Management — Provincial',
    maxAmount: 4200000,
    applied: true,
    status: 'Approved',
    submitted: 'Aug 15, 2026',
    category: 'Provincial',
  },
  {
    id: 'FS-003',
    program: 'Red Cross Emergency Relief Fund',
    authority: 'Canadian Red Cross',
    maxAmount: 500000,
    applied: true,
    status: 'Approved',
    submitted: 'Aug 14, 2026',
    category: 'Non-Profit',
  },
  {
    id: 'FS-004',
    program: 'Infrastructure Canada — Disaster Mitigation',
    authority: 'Infrastructure Canada — Federal',
    maxAmount: 3000000,
    applied: false,
    status: 'Not Applied',
    submitted: null,
    category: 'Federal',
  },
  {
    id: 'FS-005',
    program: 'Regional District Emergency Reserve Fund',
    authority: 'Thompson-Nicola Regional District',
    maxAmount: 750000,
    applied: true,
    status: 'Pending Credentials',
    submitted: 'Aug 20, 2026',
    category: 'Regional',
  },
  {
    id: 'FS-006',
    program: 'Insurance Property Claim — Commercial',
    authority: 'Intact Financial Corporation',
    maxAmount: 1200000,
    applied: true,
    status: 'Pending Credentials',
    submitted: 'Aug 16, 2026',
    category: 'Insurance',
  },
];

const statusStyles: Record<string, string> = {
  'Approved':            'bg-green-900/40 border-green-700 text-green-400',
  'Under Review':        'bg-blue-900/40 border-blue-700 text-blue-400',
  'Pending Credentials': 'bg-yellow-900/40 border-yellow-700 text-yellow-400',
  'Not Applied':         'bg-gray-800 border-gray-700 text-gray-500',
};

const categoryColors: Record<string, string> = {
  Federal:    'bg-blue-900/40 text-blue-400 border-blue-800',
  Provincial: 'bg-purple-900/40 text-purple-400 border-purple-800',
  Regional:   'bg-orange-900/40 text-orange-400 border-orange-800',
  Insurance:  'bg-gray-800 text-gray-400 border-gray-700',
  'Non-Profit': 'bg-green-900/40 text-green-400 border-green-800',
};

const fmt = (n: number) =>
  n >= 1000000
    ? `$${(n / 1000000).toFixed(1)}M`
    : `$${(n / 1000).toFixed(0)}K`;

const FILTERS = ['All', 'Federal', 'Provincial', 'Regional', 'Insurance', 'Non-Profit'];

const FundingAssistance = () => {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? FUNDING_SOURCES : FUNDING_SOURCES.filter(f => f.category === filter);

  const totalAvailable = FUNDING_SOURCES.reduce((s, f) => s + f.maxAmount, 0);
  const totalApproved  = FUNDING_SOURCES.filter(f => f.status === 'Approved').reduce((s, f) => s + f.maxAmount, 0);
  const totalPending   = FUNDING_SOURCES.filter(f => f.status === 'Under Review' || f.status === 'Pending Credentials').reduce((s, f) => s + f.maxAmount, 0);

  return (
    <div className="p-6 h-full flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Funding & Assistance</h1>
          <p className="text-gray-400 text-sm mt-1">Funding programs and applications · Clearwater Ridge Wildfire</p>
        </div>
        <span className="bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs px-3 py-1.5 rounded-full font-medium">
          SYNTHETIC DATA
        </span>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-white">{fmt(totalAvailable)}</div>
          <div className="text-gray-400 text-sm mt-1">Total available</div>
          <div className="text-gray-500 text-xs mt-0.5">Across {FUNDING_SOURCES.length} programs</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-green-400">{fmt(totalApproved)}</div>
          <div className="text-gray-400 text-sm mt-1">Approved</div>
          <div className="text-gray-500 text-xs mt-0.5">Secured funding</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-yellow-400">{fmt(totalPending)}</div>
          <div className="text-gray-400 text-sm mt-1">Under review</div>
          <div className="text-gray-500 text-xs mt-0.5">Awaiting decision</div>
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-5 py-4 flex items-start gap-3">
        <div className="text-yellow-400 text-lg mt-0.5">⚠</div>
        <div>
          <div className="text-yellow-300 font-semibold text-sm">Credentials Required for Some Programs</div>
          <div className="text-yellow-200/70 text-xs mt-1">
            Several funding programs are marked <span className="font-semibold">Pending Credentials</span> — official authorization from the requesting authority is required before these can be processed. All amounts shown are <span className="font-semibold">SYNTHETIC DATA</span> for demonstration purposes.
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Funding cards — 2 column grid */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {filtered.map(fund => (
          <div key={fund.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs font-mono">{fund.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[fund.category]}`}>
                  {fund.category}
                </span>
              </div>
              <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium ${statusStyles[fund.status]}`}>
                {fund.status}
              </span>
            </div>

            <div>
              <h3 className="text-white font-semibold text-sm">{fund.program}</h3>
              <p className="text-gray-500 text-xs mt-1">{fund.authority}</p>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs">Max amount</div>
                <div className="text-white font-semibold">{fmt(fund.maxAmount)}</div>
              </div>
              {fund.submitted && (
                <div>
                  <div className="text-gray-500 text-xs">Submitted</div>
                  <div className="text-gray-300 text-sm">{fund.submitted}</div>
                </div>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-gray-800 text-xs text-gray-500">
              {fund.applied
                ? <span>Application submitted · awaiting response</span>
                : <span className="text-gray-600">No application submitted yet</span>
              }
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default FundingAssistance;
