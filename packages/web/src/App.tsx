import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Pages
import Dashboard from './pages/Dashboard';
import RecoveryMatrix from './pages/RecoveryMatrix';
import ImpactAssessment from './pages/ImpactAssessment';
import PPOSTWorkspace from './pages/PPOSTWorkspace';
import ClassDEstimates from './pages/ClassDEstimates';
import FundingAssistance from './pages/FundingAssistance';
import InitialRecoveryPlan from './pages/InitialRecoveryPlan';
import RecoveryProjects from './pages/RecoveryProjects';
import FinancialTracking from './pages/FinancialTracking';
import AICopilot from './pages/AICopilot';
import Reports from './pages/Reports';
import DocumentsEvidence from './pages/DocumentsEvidence';
import AuditApprovals from './pages/AuditApprovals';
import Settings from './pages/Settings';

const navItems = [
  { section: 'OVERVIEW', items: [
    { label: 'Dashboard', path: '/' },
    { label: 'Disaster Events', path: '/disasters' },
  ]},
  { section: 'PLANNING', items: [
    { label: 'Impact Assessment', path: '/assessment', badge: '6' },
    { label: 'Recovery Matrix', path: '/matrix' },
    { label: 'PPOST Workspace', path: '/ppost' },
    { label: 'Class D Estimates', path: '/estimates' },
    { label: 'Funding & Assistance', path: '/funding' },
    { label: 'Initial Recovery Plan', path: '/recovery-plan' },
  ]},
  { section: 'IMPLEMENTATION', items: [
    { label: 'Recovery Projects', path: '/projects' },
    { label: 'Financial Tracking', path: '/financial' },
  ]},
  { section: 'INTELLIGENCE', items: [
    { label: 'AI Copilot', path: '/ai' },
    { label: 'Reports', path: '/reports' },
  ]},
  { section: 'GOVERNANCE', items: [
    { label: 'Documents & Evidence', path: '/documents' },
    { label: 'Audit & Approvals', path: '/audit', badge: '5' },
    { label: 'Settings', path: '/settings' },
  ]},
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded flex items-center justify-center text-xs font-bold">P</div>
          <span className="font-semibold text-sm">PPOST RecoveryOS</span>
        </div>
      </div>

      <div className="p-3 border-b border-gray-800">
        <div className="bg-gray-800 rounded px-3 py-2 text-xs">
          <div className="text-white font-medium">Clearwater Ridge Wildfire</div>
          <div className="text-yellow-400 text-xs">SYNTHETIC DATA</div>
        </div>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {navItems.map((group) => (
          <div key={group.section}>
            <div className="text-xs text-gray-500 px-2 py-2 mt-2 font-medium">{group.section}</div>
            {group.items.map((item) => (
              <div
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer mb-0.5 ${
                  location.pathname === item.path
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="bg-gray-700 text-xs px-1.5 py-0.5 rounded-full">{item.badge}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800 text-xs text-gray-400">
        Recovery team · 4 members online
      </div>
    </div>
  );
};

const Topbar = () => {
  const location = useLocation();
  const pageNames: Record<string, string> = {
    '/': 'Dashboard',
    '/assessment': 'Impact Assessment',
    '/matrix': 'Recovery Matrix',
    '/ppost': 'PPOST Workspace',
    '/estimates': 'Class D Estimates',
    '/funding': 'Funding & Assistance',
    '/recovery-plan': 'Initial Recovery Plan',
    '/projects': 'Recovery Projects',
    '/financial': 'Financial Tracking',
    '/ai': 'AI Copilot',
    '/reports': 'Reports',
    '/documents': 'Documents & Evidence',
    '/audit': 'Audit & Approvals',
    '/settings': 'Settings',
  };

  return (
    <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
      <div className="text-sm text-gray-400">
        Overview / <span className="text-white">{pageNames[location.pathname] || 'Dashboard'}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          className="bg-gray-800 text-xs text-gray-400 rounded px-3 py-1.5 w-48 outline-none"
          placeholder="Search records, plans..."
        />
        <button className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded">
          ✦ AI Copilot
        </button>
        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">JM</div>
      </div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen bg-gray-950 text-white">
    <Sidebar />
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assessment" element={<ImpactAssessment />} />
          <Route path="/matrix" element={<RecoveryMatrix />} />
          <Route path="/ppost" element={<PPOSTWorkspace />} />
          <Route path="/estimates" element={<ClassDEstimates />} />
          <Route path="/funding" element={<FundingAssistance />} />
          <Route path="/recovery-plan" element={<InitialRecoveryPlan />} />
          <Route path="/projects" element={<RecoveryProjects />} />
          <Route path="/financial" element={<FinancialTracking />} />
          <Route path="/ai" element={<AICopilot />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/documents" element={<DocumentsEvidence />} />
          <Route path="/audit" element={<AuditApprovals />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;