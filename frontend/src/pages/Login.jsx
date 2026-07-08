import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Mail, Lock, Key } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role, name, companyName, testEmail) => {
    setIsLoading(true);
    // Simulates role session instantiation directly to ease review workflows
    setTimeout(() => {
      setIsLoading(false);
      const mockedUser = {
        id: `mock-${role.toLowerCase()}`,
        name,
        role,
        email: testEmail,
        company: companyName ? { name: companyName } : null
      };
      localStorage.setItem('user', JSON.stringify(mockedUser));
      localStorage.setItem('token', 'mocked-jwt-token-string');
      // Update global context directly
      setUser(mockedUser);
      navigate('/dashboard');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#18181b]/50 backdrop-blur-xl border border-[#27272a] rounded-3xl p-8 shadow-2xl z-10">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/30 mb-4">
            W
          </div>
          <h2 className="text-2xl font-bold text-gray-100 tracking-tight">Welcome back</h2>
          <p className="text-sm text-zinc-400 mt-1.5">Sign in to manage your 3PL warehouse operations</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-950/20 border border-red-900 text-red-400 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Mail className="w-4.5 h-4.5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-[#0c0c0e]/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0c0c0e]/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mb-3 flex items-center gap-1.5 justify-center">
            <Key className="w-3.5 h-3.5" />
            Quick Demo Logins
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('CLIENT', 'Rahul Sharma', 'Samsung India', 'manager@samsung.in')}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-left hover:border-indigo-600 hover:bg-zinc-800/50 transition-all text-xs"
            >
              <div className="font-semibold text-zinc-300">Client User</div>
              <div className="text-[10px] text-zinc-500">Samsung India</div>
            </button>

            <button
              onClick={() => handleQuickLogin('SUPER_ADMIN', 'Super Admin User', null, 'admin@waremind.ai')}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-left hover:border-indigo-600 hover:bg-zinc-800/50 transition-all text-xs"
            >
              <div className="font-semibold text-zinc-300">Super Admin</div>
              <div className="text-[10px] text-zinc-500">System Dashboard</div>
            </button>

            <button
              onClick={() => handleQuickLogin('WAREHOUSE_MANAGER', 'Amit Patel', null, 'manager@alphahub.waremind.ai')}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-left hover:border-indigo-600 hover:bg-zinc-800/50 transition-all text-xs"
            >
              <div className="font-semibold text-zinc-300">Manager User</div>
              <div className="text-[10px] text-zinc-500">Alpha Hub manager</div>
            </button>

            <button
              onClick={() => handleQuickLogin('WAREHOUSE_STAFF', 'Suresh Kumar', null, 'staff1@alphahub.waremind.ai')}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-left hover:border-indigo-600 hover:bg-zinc-800/50 transition-all text-xs"
            >
              <div className="font-semibold text-zinc-300">Staff User</div>
              <div className="text-[10px] text-zinc-500">Alpha Hub crew</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
