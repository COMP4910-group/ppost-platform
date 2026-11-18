import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const DISASTER_EVENTS = [
  'Clearwater Ridge Wildfire',
  'Fraser Valley Flooding',
  'Okanagan Earthquake 2026',
  'Coastal Storm Surge - Vancouver Island',
];

const TEAM_MEMBERS = [
  { name: 'Earl',   role: 'Core Platform Lead',         initials: 'E',  color: 'bg-blue-600' },
  { name: 'Daniel', role: 'Class D Estimator',           initials: 'D',  color: 'bg-purple-600' },
  { name: 'Johnny', role: 'Financial Tracking',          initials: 'J',  color: 'bg-orange-600' },
  { name: 'Qiaomu', role: 'AI Recovery Plan Generator',  initials: 'Q',  color: 'bg-green-600' },
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
    <h2 className="text-white font-semibold text-base">{title}</h2>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs text-gray-400">{label}</label>
    {children}
  </div>
);

const Settings = () => {
  const { user, signOut } = useAuth();

  const [displayName, setDisplayName]     = useState(user?.username ?? 'Earl');
  const [email, setEmail]                 = useState(user?.email ?? '');
  const [activeEvent, setActiveEvent]     = useState(DISASTER_EVENTS[0]);
  const [saved, setSaved]                 = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your profile and workspace preferences</p>
      </div>

      {/* ── Profile ── */}
      <Section title="Profile">
        <Field label="Display name">
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors"
          />
        </Field>

        <Field label="Username">
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
            {user?.username ?? 'test'}
          </div>
        </Field>

        <Field label="Change password">
          <input
            type="password"
            placeholder="Enter new password"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors"
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {saved ? '✓ Saved' : 'Save changes'}
          </button>
          <button
            onClick={signOut}
            className="text-red-400 hover:text-red-300 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </Section>

      {/* ── Active Disaster Event ── */}
      <Section title="Active Disaster Event">
        <p className="text-gray-400 text-xs">
          All pages will show data for this event. Switching affects the whole workspace.
        </p>
        <Field label="Current event">
          <select
            value={activeEvent}
            onChange={e => setActiveEvent(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors"
          >
            {DISASTER_EVENTS.map(ev => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
        </Field>
        <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
          <span className="text-white text-sm font-medium">{activeEvent}</span>
          <span className="ml-auto text-yellow-400 text-xs font-medium">ACTIVE</span>
        </div>
      </Section>

      {/* ── Team Members ── */}
      <Section title="Team Members">
        <p className="text-gray-400 text-xs">COMP 4910 Capstone Group — Thompson Rivers University</p>
        <div className="space-y-3 pt-1">
          {TEAM_MEMBERS.map(member => (
            <div key={member.name} className="flex items-center gap-4">
              <div className={`w-9 h-9 ${member.color} rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0`}>
                {member.initials}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{member.name}</div>
                <div className="text-gray-400 text-xs">{member.role}</div>
              </div>
              {member.name === (user?.username ?? 'Earl') && (
                <span className="ml-auto text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── About ── */}
      <Section title="About">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Application</span>
            <span className="text-white">PPOST RecoveryOS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white">1.0.0-capstone</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Course</span>
            <span className="text-white">COMP 4910 — Capstone Project</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Institution</span>
            <span className="text-white">Thompson Rivers University</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Stack</span>
            <span className="text-white">React · Django · PostgreSQL · Supabase</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Database</span>
            <span className="text-green-400">● Connected</span>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default Settings;
