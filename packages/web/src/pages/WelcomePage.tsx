import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const name = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : 'there';

  return (
    <div className="min-h-full bg-gray-950 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center space-y-8">

        {/* Logo mark */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            P
          </div>
        </div>

        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome, {name}</h1>
          <p className="text-gray-400 mt-2 text-base">
            Your recovery workspace is ready. Start by assessing the impact of the active disaster event.
          </p>
        </div>

        {/* Active event badge */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4 text-left">
          <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full shrink-0 mt-0.5"></div>
          <div>
            <div className="text-white font-medium text-sm">Clearwater Ridge Wildfire</div>
            <div className="text-gray-400 text-xs mt-0.5">Active recovery event · Interior British Columbia</div>
          </div>
          <span className="ml-auto text-yellow-400 text-xs font-semibold tracking-wide">ACTIVE</span>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/assessment')}
          className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3.5 rounded-xl transition-colors text-base shadow"
        >
          Begin Recovery Planning →
        </button>

        {/* Secondary links */}
        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <button onClick={() => navigate('/matrix')} className="hover:text-gray-300 transition-colors">
            Recovery Matrix
          </button>
          <button onClick={() => navigate('/ppost')} className="hover:text-gray-300 transition-colors">
            PPOST Workspace
          </button>
          <button onClick={() => navigate('/settings')} className="hover:text-gray-300 transition-colors">
            Settings
          </button>
        </div>

        <div className="flex justify-center mt-2 text-xs text-gray-600">
          <button onClick={() => navigate('/demo')} className="hover:text-gray-400 transition-colors">
            (Demo Dashboard)
          </button>
        </div>

      </div>
    </div>
  );
};

export default WelcomePage;
