import React from 'react';
import { supabase } from '../supabase'

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
  <div className="flex items-center justify-between p-2 bg-gray-800 rounded mb-2 text-xs cursor-pointer hover:bg-gray-700">
    <div>
      <span className="text-gray-300 font-medium">{code}</span>
      <span className="ml-2 bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">{tag}</span>
      <div className="text-gray-500 mt-0.5">{issue}</div>
    </div>
    <span className="text-gray-500">›</span>
  </div>
);

const ActivityItem = ({ name, initials, action, time }: { name: string; initials: string; action: string; time: string }) => (
  <div className="flex items-start gap-3 py-2 border-b border-gray-800">
    <div className="w-7 h-7 bg-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{initials}</div>
    <div className="flex-1">
      <span className="text-xs text-gray-300"><span className="text-white font-medium">{name}</span> {action}</span>
      <div className="text-xs text-gray-500 mt-0.5">{time}</div>
    </div>
  </div>
);

const DeadlineItem = ({ day: date, month, title, sub, urgent }: { day: string; month: string; title: string; sub: string; urgent?: boolean }) => (
  <div className="flex items-start gap-3 py-2 border-b border-gray-800">
    <div className="text-center flex-shrink-0 w-10">
      <div className="text-lg font-bold text-white">{date}</div>
      <div className="text-xs text-gray-500">{month}</div>
    </div>
    <div className="flex-1">
      <div className="text-xs text-white font-medium">{title}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
    {urgent && <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded">Due soon</span>}
  </div>
);

const Dashboard = () => {
  React.useEffect(() => {
    const fetchDisasters = async () => {
      const { data, error } = await supabase.from('disasters').select('*')
      console.log('Disasters:', data, error)
    }
    fetchDisasters()
  }, [])

  return (
    <div className="p-6 bg-gray-950 min-h-full">

      {/* Event header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
            <span className="text-xs text-gray-400">ACTIVE RECOVERY EVENT</span>
            <span className="bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-300">Initial Recovery Planning</span>
          </div>
          <h1 className="text-2xl font-bold">Clearwater Ridge Wildfire</h1>
          <p className="text-sm text-gray-400 mt-1">Interior British Columbia, Canada · Declared August 14, 2026 · Regional District Recovery Office</p>
        </div>
        <div className="flex gap-2">
          <button className="border border-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-800 text-gray-300">View event details</button>
          <button className="bg-green-600 hover:bg-green-500 text-sm px-4 py-2 rounded text-white">Continue Recovery Planning →</button>
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

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">

        {/* Impact overview placeholder */}
        <div className="col-span-2 bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-medium text-sm">Impact overview</h3>
              <p className="text-xs text-gray-500">Operational layers · Updated 22 min ago</p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs border border-gray-700 px-2 py-1 rounded text-gray-400 hover:bg-gray-800">Map</button>
              <button className="text-xs border border-gray-700 px-2 py-1 rounded text-gray-400 hover:bg-gray-800">View as table</button>
            </div>
          </div>
          <div className="bg-gray-800 rounded h-48 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-500 text-sm">🗺️ Impact Map</div>
              <div className="text-gray-600 text-xs mt-1">Burn perimeter · Evacuation zone · Critical assets</div>
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 bg-red-500 rounded-sm inline-block"></span>Burn perimeter</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 bg-yellow-500 rounded-sm inline-block"></span>Evacuation order</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 bg-gray-400 rounded-full inline-block"></span>Critical asset</div>
          </div>
        </div>

        {/* Recovery progress */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="font-medium text-sm mb-1">Recovery planning progress</h3>
          <p className="text-xs text-gray-500 mb-3">PPOST chain completeness</p>
          <div className="text-3xl font-bold mb-0.5">67%</div>
          <div className="text-xs text-gray-400 mb-4">Overall completeness
            <span className="ml-2 bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded text-xs">12 records need action</span>
          </div>
          <ProgressBar label="Human Wellness" value={74} />
          <ProgressBar label="Housing" value={62} />
          <ProgressBar label="Environment" value={81} />
          <ProgressBar label="Economy" value={48} color="bg-yellow-500" />
          <ProgressBar label="Critical Infrastructure" value={69} />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Governance</span><span>Inactive</span>
          </div>
          <button className="text-xs text-green-400 hover:text-green-300 mt-3">View Recovery Matrix →</button>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* Recent activity */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm">Recent activity</h3>
            <button className="text-xs text-green-400 hover:text-green-300">View audit log</button>
          </div>
          <ActivityItem initials="AS" name="A. Singh" action="updated Tactic T-014" time="12 min ago" />
          <ActivityItem initials="RO" name="R. Okafor" action="created Estimate v1.1" time="34 min ago" />
          <ActivityItem initials="LT" name="L. Tremblay" action="resolved assessment Q-18" time="1 hr ago" />
          <ActivityItem initials="JM" name="J. Miller" action="approved Objective O-07" time="2 hr ago" />
        </div>

        {/* Upcoming deadlines */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm">Upcoming deadlines</h3>
            <button className="text-xs text-green-400 hover:text-green-300">View all</button>
          </div>
          <DeadlineItem day="22" month="SEP" title="Water intake field verification" sub="Critical Infrastructure · 18h remaining" urgent />
<DeadlineItem day="24" month="SEP" title="Housing strategy approval" sub="Assigned to J. Miller" />
<DeadlineItem day="28" month="SEP" title="Class D estimate submission" sub="Finance · Daniel" />
        </div>

        {/* Planning gaps + Quick actions */}
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm">Planning gaps</h3>
              <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded">✦ AI</span>
            </div>
            <GapItem code="O-09" tag="Environment" issue="No strategy linked" />
            <GapItem code="T-022" tag="Housing" issue="No accountable owner" />
            <GapItem code="P-17" tag="Economy" issue="Missing objective" />
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium text-sm mb-3">Quick actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 px-3 py-2 rounded text-left">Start assessment ›</button>
              <button className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 px-3 py-2 rounded text-left">Open PPOST ›</button>
              <button className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 px-3 py-2 rounded text-left">Build estimate ›</button>
              <button className="bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 px-3 py-2 rounded text-left">Generate plan ›</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;