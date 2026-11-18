import React from 'react';
import { useNavigate } from 'react-router-dom';

const StatTile = ({ value, label, sub, color }: { value: string; label: string; sub: string; color?: string }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
    <div className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</div>
    <div className="text-gray-300 text-sm mt-1">{label}</div>
    <div className="text-gray-500 text-xs mt-0.5">{sub}</div>
  </div>
);

const ProgressBar = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-gray-300">{label}</span>
      <span className="text-gray-400">{value}%</span>
    </div>
    <div className="h-1.5 bg-gray-700 rounded-full">
      <div className={`h-1.5 rounded-full ${color || 'bg-green-500'}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const DemoDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Demo Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Clearwater Ridge Wildfire · Interior British Columbia · Declared Aug 14, 2026
          </p>
        </div>
        <span className="bg-yellow-900/40 border border-yellow-700 text-yellow-400 text-xs px-3 py-1.5 rounded-full font-medium">
          SYNTHETIC DATA
        </span>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile value="8"      label="Active priorities"    sub="All configured"           />
        <StatTile value="23"     label="Open problems"        sub="4 high severity"  color="text-red-400" />
        <StatTile value="$14.6M" label="Class D requirement"  sub="Across 28 estimates"      />
        <StatTile value="$5.4M"  label="Unfunded gap"         sub="External assistance needed" color="text-yellow-400" />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-3 gap-4">

        {/* PPOST Chain Completeness */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">PPOST Chain Completeness</h2>
            <span className="bg-red-900/40 border border-red-800 text-red-400 text-xs px-2 py-0.5 rounded-full">
              12 need action
            </span>
          </div>
          <ProgressBar label="Human Wellness"       value={74} color="bg-green-500" />
          <ProgressBar label="Housing"              value={62} color="bg-green-500" />
          <ProgressBar label="Environment"          value={81} color="bg-green-500" />
          <ProgressBar label="Economy"              value={48} color="bg-yellow-500" />
          <ProgressBar label="Critical Infrastructure" value={69} color="bg-green-500" />
          <div className="text-gray-500 text-xs mt-2">Governance · Inactive</div>
        </div>

        {/* Funding Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 col-span-1">
          <h2 className="text-white font-semibold text-sm mb-4">Funding Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total required</span>
              <span className="text-white font-semibold">$14.6M</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Approved funding</span>
              <span className="text-green-400 font-semibold">$4.7M</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Under review</span>
              <span className="text-blue-400 font-semibold">$12.5M</span>
            </div>
            <div className="border-t border-gray-800 pt-3 flex justify-between text-sm">
              <span className="text-gray-400">Unfunded gap</span>
              <span className="text-yellow-400 font-semibold">$5.4M</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/funding')}
            className="mt-4 w-full text-xs text-green-400 hover:text-green-300 transition-colors text-left"
          >
            View all funding programs →
          </button>
        </div>

        {/* Pending Audits */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 col-span-1">
          <h2 className="text-white font-semibold text-sm mb-4">Pending Audits</h2>
          <div className="space-y-3">
            {[
              { id: 'AUD-001', title: 'Disaster Relief Fund Expenditure Review', priority: 'High' },
              { id: 'AUD-002', title: 'Impact Assessment Verification',           priority: 'High' },
              { id: 'AUD-003', title: 'Recovery Plan Compliance Audit',           priority: 'Medium' },
            ].map(a => (
              <div key={a.id} className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-gray-500 font-mono">{a.id}</div>
                  <div className="text-white text-xs mt-0.5">{a.title}</div>
                </div>
                <span className={`shrink-0 text-xs font-medium ${a.priority === 'High' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {a.priority}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/audit')}
            className="mt-4 w-full text-xs text-green-400 hover:text-green-300 transition-colors text-left"
          >
            View all audits →
          </button>
        </div>
      </div>

      {/* Activity + Quick Nav */}
      <div className="grid grid-cols-3 gap-4">

        {/* Recent activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 col-span-2">
          <h2 className="text-white font-semibold text-sm mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { initials: 'AS', color: 'bg-blue-600',   name: 'A. Singh',    action: 'updated Tactic T-014',         time: '12 min ago' },
              { initials: 'RO', color: 'bg-purple-600', name: 'R. Okafor',   action: 'created Estimate v1.1',        time: '34 min ago' },
              { initials: 'LT', color: 'bg-orange-600', name: 'L. Tremblay', action: 'resolved assessment Q-18',     time: '1 hr ago' },
              { initials: 'JM', color: 'bg-green-600',  name: 'J. Miller',   action: 'approved Objective O-07',      time: '2 hr ago' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 ${a.color} rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                  {a.initials}
                </div>
                <div>
                  <span className="text-white text-xs font-medium">{a.name}</span>
                  <span className="text-gray-400 text-xs"> {a.action}</span>
                  <div className="text-gray-600 text-xs">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Quick Access</h2>
          <div className="space-y-2">
            {[
              { label: 'Impact Assessment',   path: '/assessment' },
              { label: 'Recovery Matrix',     path: '/matrix' },
              { label: 'PPOST Workspace',     path: '/ppost' },
              { label: 'Class D Estimates',   path: '/estimates' },
              { label: 'Financial Tracking',  path: '/financial' },
              { label: 'Settings',            path: '/settings' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full text-left text-xs text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-2 rounded-lg transition-colors"
              >
                {item.label} →
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export default DemoDashboard;
