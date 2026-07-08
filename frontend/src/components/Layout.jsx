import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  FileText,
  Warehouse,
  User,
  Sparkles,
  LogOut,
  Menu,
  ChevronDown
} from 'lucide-react';
import AICopilotPanel from './AICopilotPanel.jsx';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Retrieve user from localStorage (or fallback to dummy for preview)
  const storedUser = localStorage.getItem('user');
  const user = storedUser
    ? JSON.parse(storedUser)
    : {
        name: 'Rahul Sharma',
        role: 'CLIENT', // CLIENT, SUPER_ADMIN, WAREHOUSE_MANAGER, WAREHOUSE_STAFF
        company: { name: 'Samsung India' },
        warehouseId: null
      };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Nav items with conditional rendering based on role
  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      allowed: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'CLIENT']
    },
    {
      name: 'Inventory',
      path: '/inventory',
      icon: Boxes,
      allowed: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'CLIENT']
    },
    {
      name: 'Warehouse Grid',
      path: '/warehouse',
      icon: Warehouse,
      allowed: ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'CLIENT']
    },
    {
      name: 'Billing & Invoices',
      path: '/billing',
      icon: FileText,
      allowed: ['SUPER_ADMIN', 'CLIENT'] // Hidden from WAREHOUSE_STAFF and WAREHOUSE_MANAGER
    }
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 flex">
      {/* 1. Left Sidebar */}
      <aside className="w-64 bg-[#09090b] border-r border-[#1f1f23] flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-16 flex items-center px-6 gap-2.5 border-b border-[#1f1f23]">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
            W
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
            WareMind AI
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems
            .filter(item => item.allowed.includes(user.role))
            .map(item => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
        </nav>

        {/* User context selector (for testing / role toggling easily) */}
        <div className="p-4 border-t border-[#1f1f23] bg-[#0c0c0e]/50">
          <div className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mb-2">
            Workspace Mode
          </div>
          <select
            value={user.role}
            onChange={(e) => {
              const updated = {
                ...user,
                role: e.target.value,
                company: e.target.value === 'CLIENT' ? { name: 'Samsung India' } : null,
                name: e.target.value === 'SUPER_ADMIN' ? 'Super Admin User' : e.target.value === 'CLIENT' ? 'Rahul Sharma' : 'Amit Patel'
              };
              localStorage.setItem('user', JSON.stringify(updated));
              window.location.reload();
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-600"
          >
            <option value="CLIENT">Client Role</option>
            <option value="SUPER_ADMIN">Super Admin Role</option>
            <option value="WAREHOUSE_MANAGER">Manager Role</option>
            <option value="WAREHOUSE_STAFF">Staff Role</option>
          </select>
        </div>
      </aside>

      {/* 2. Main Page Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-[#1f1f23] bg-[#0c0c0e]/30 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-100 capitalize">
              {location.pathname.substring(1).replace('/', ' ') || 'Home'}
            </h2>
            {user.company && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 border border-indigo-900 text-indigo-300">
                {user.company.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* AI Copilot Button */}
            <button
              onClick={() => setIsAiOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Ask Copilot
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(prev => !prev)}
                className="flex items-center gap-2 hover:bg-zinc-900/60 px-3 py-1.5 rounded-xl transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-300 uppercase border border-zinc-700">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-semibold text-gray-200">{user.name}</div>
                  <div className="text-[10px] text-gray-500 font-medium">{user.role}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl p-1 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/20 rounded-lg hover:text-red-300 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#09090b]">
          <Outlet />
        </main>
      </div>

      {/* 3. Global AI Copilot Slideout */}
      <AICopilotPanel isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}
