import React from 'react';

const App: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-950 text-white">
      
      {/* SIDEBAR */}
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded flex items-center justify-center text-xs font-bold">P</div>
            <span className="font-semibold text-sm">PPOST RecoveryOS</span>
          </div>
        </div>

        {/* Disaster selector */}
        <div className="p-3 border-b border-gray-800">
          <div className="bg-gray-800 rounded px-3 py-2 text-xs">
            <div className="text-white font-medium">Clearwater Ridge Wildfire</div>
            <div className="text-yellow-400 text-xs">SYNTHETIC DATA</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="text-xs text-gray-500 px-2 py-2 font-medium">OVERVIEW</div>
          <NavItem label="Dashboard" active />
          <NavItem label="Disaster Events" />

          <div className="text-xs text-gray-500 px-2 py-2 mt-2 font-medium">PLANNING</div>
          <NavItem label="Impact Assessment" badge="6" />
          <NavItem label="Recovery Matrix" />
          <NavItem label="PPOST Workspace" />
          <NavItem label="Class D Estimates" />
          <NavItem label="Funding & Assistance" />
          <NavItem label="Initial Recovery Plan" />

          <div className="text-xs text-gray-500 px-2 py-2 mt-2 font-medium">IMPLEMENTATION</div>
          <NavItem label="Recovery Projects" />
          <NavItem label="Financial Tracking" />

          <div className="text-xs text-gray-500 px-2 py-2 mt-2 font-medium">INTELLIGENCE</div>
          <NavItem label="AI Copilot" />
          <NavItem label="Reports" />

          <div className="text-xs text-gray-500 px-2 py-2 mt-2 font-medium">GOVERNANCE</div>
          <NavItem label="Documents & Evidence" />
          <NavItem label="Audit & Approvals" badge="5" />
          <NavItem label="Settings" />
        </nav>

        {/* Bottom user */}
        <div className="p-3 border-t border-gray-800 text-xs text-gray-400">
          Recovery team · 4 members online
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOPBAR */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="text-sm text-gray-400">Overview / <span className="text-white">Dashboard</span></div>
          <div className="flex items-center gap-3">
            <input className="bg-gray-800 text-xs text-gray-400 rounded px-3 py-1.5 w-48 outline-none" placeholder="Search records, plans..." />
            <button className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1">
              ✦ AI Copilot
            </button>
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">JM</div>
          </div>
        </div>

        {/* DASHBOARD */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-950">
          
          {/* Event header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                <span className="text-xs text-gray-400">ACTIVE RECOVERY EVENT</span>
                <span className="bg-gray-800 text-xs px-2 py-0.5 rounded">Initial Recovery Planning</span>
              </div>
              <h1 className="text-2xl font-bold">Clearwater Ridge Wildfire</h1>
              <p className="text-sm text-gray-400 mt-1">Interior British Columbia, Canada · Declared August 14, 2026 · Regional District Recovery Office</p>
            </div>
            <div className="flex gap-2">
              <button className="border border-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-800">View event details</button>
              <button className="bg-green-600 hover:bg-green-500 text-sm px-4 py-2 rounded">Continue Recovery Planning →</button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-8 gap-3 mb-6">
            <StatCard value="8" label="Active priorities" sub="All priorities configured" />
            <StatCard value="23" label="Open problems" sub="4 high severity" color="text-red-400" />
            <StatCard value="17" label="Objectives" sub="2 awaiting review" />
            <StatCard value="41" label="Tactics" sub="9 pending action" />
            <StatCard value="$14.6M" label="Class D requirement" sub="Across 28 estimates" />
            <StatCard value="$5.4M" label="Unfunded gap" sub="External assistance" color="text-orange-400" />
            <StatCard value="6" label="Unknown assessments" sub="Verification required" color="text-yellow-400" unknown />
            <StatCard value="5" label="Pending approvals" sub="Oldest: 18 hours" />
          </div>

          {/* Bottom panels */}
          <div className="grid grid-cols-3 gap-4">
            
            {/* Recovery progress */}
            <div className="col-span-1 bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-medium text-sm mb-4">Recovery planning progress</h3>
              <div className="text-3xl font-bold mb-1">67%</div>
              <div className="text-xs text-gray-400 mb-4">Overall completeness</div>
              <ProgressBar label="Human Wellness" value={74} />
              <ProgressBar label="Housing" value={62} />
              <ProgressBar label="Environment" value={81} />
              <ProgressBar label="Economy" value={48} color="bg-yellow-500" />
              <ProgressBar label="Critical Infrastructure" value={69} />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Governance</span><span>Inactive</span>
              </div>
            </div>

            {/* Planning gaps */}
            <div className="col-span-1 bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-sm">Planning gaps</h3>
                <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded">✦ AI</span>
              </div>
              <GapItem code="O-09" tag="Environment" issue="No strategy linked" />
              <GapItem code="T-022" tag="Housing" issue="No accountable owner" />
              <GapItem code="P-17" tag="Economy" issue="Missing objective" />
            </div>

            {/* Quick actions */}
            <div className="col-span-1 bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-medium text-sm mb-4">Quick actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction label="Start assessment" />
                <QuickAction label="Open PPOST" />
                <QuickAction label="Build estimate" />
                <QuickAction label="Generate plan" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ label, active, badge }: { label: string; active?: boolean; badge?: string }) => (
  <div className={`flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer ${active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
    <span>{label}</span>
    {badge && <span className="bg-gray-700 text-xs px-1.5 py-0.5 rounded-full">{badge}</span>}
  </div>
);

const StatCard = ({ value, label, sub, color, unknown }: { value: string; label: string; sub: string; color?: string; unknown?: boolean }) => (
  <div className={`bg-gray-900 rounded-lg p-3 border ${unknown ? 'border-yellow-600 border-dashed' : 'border-gray-800'}`}>
    <div className={`text-xl font-bold ${color || 'text-white'}`}>{value}</div>
    <div className="text-xs text-gray-300 mt-1">{label}</div>
    <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
  </div>
);

const ProgressBar = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-gray-300">{label}</span>
      <span className="text-gray-400">{value}%</span>
    </div>
    <div className="h-1.5 bg-gray-700 rounded-full">
      <div className={`h-1.5 rounded-full ${color || 'bg-green-500'}`} style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

const GapItem = ({ code, tag, issue }: { code: string; tag: string; issue: string }) => (
  <div className="flex items-center justify-between p-2 bg-gray-800 rounded mb-2 text-xs">
    <div>
      <span className="text-gray-300 font-medium">{code}</span>
      <span className="ml-2 bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">{tag}</span>
      <div className="text-gray-500 mt-0.5">{issue}</div>
    </div>
    <span className="text-gray-500">›</span>
  </div>
);

const QuickAction = ({ label }: { label: string }) => (
  <button className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 px-3 py-2 rounded text-left w-full">
    {label} ›
  </button>
);

export default App;