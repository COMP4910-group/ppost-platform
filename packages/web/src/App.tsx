import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

// Auth
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Pages
import Dashboard from './pages/Dashboard';
import DemoDashboard from './pages/DemoDashboard';
import WelcomePage from './pages/WelcomePage';
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
    { label: 'Financial Tracking', path: '/financial' },
  ]},
  { section: 'GOVERNANCE', items: [
    { label: 'Documents', path: '/documents' },
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
    '/documents': 'Documents',
    '/audit': 'Audit & Approvals',
    '/settings': 'Settings',
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : '??';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
      <div className="text-sm text-gray-400">
        Overview / <span className="text-white">{pageNames[location.pathname] || 'Dashboard'}</span>
      </div>
      <div className="flex items-center gap-3">
        <div
          title={user?.email ?? ''}
          className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold cursor-default"
        >
          {initials}
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
        >
          Sign out
        </button>
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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route path="/" element={<ProtectedRoute><WelcomePage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/demo" element={<ProtectedRoute><DemoDashboard /></ProtectedRoute>} />
          <Route path="/assessment" element={<ProtectedRoute><ImpactAssessment /></ProtectedRoute>} />
          <Route path="/matrix" element={<ProtectedRoute><RecoveryMatrix /></ProtectedRoute>} />
          <Route path="/ppost" element={<ProtectedRoute><PPOSTWorkspace /></ProtectedRoute>} />
          <Route path="/estimates" element={<ProtectedRoute><ClassDEstimates /></ProtectedRoute>} />
          <Route path="/funding" element={<ProtectedRoute><FundingAssistance /></ProtectedRoute>} />
          <Route path="/recovery-plan" element={<ProtectedRoute><InitialRecoveryPlan /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><RecoveryProjects /></ProtectedRoute>} />
          <Route path="/financial" element={<ProtectedRoute><FinancialTracking /></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute><AICopilot /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsEvidence /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditApprovals /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
