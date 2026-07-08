import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Boxes,
  FileText,
  Warehouse,
  LogOut,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import AICopilotPanel from './AICopilotPanel.jsx';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Nav items with allowed roles — user.role is the single source of truth from AuthContext
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
      allowed: ['SUPER_ADMIN', 'CLIENT']  // Hidden from WAREHOUSE_MANAGER and WAREHOUSE_STAFF
    }
  ];

  const activeRole = user?.role || 'CLIENT';
  const userName = user?.name || 'User';
  const companyName = user?.company?.name || null;

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Left Sidebar */}
      <aside className="w-64 h-full shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center px-6 gap-2.5 border-b border-zinc-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
            W
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
            WareMind AI
          </span>
        </div>

        {/* Navigation links — filtered strictly by authenticated user's real role */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems
            .filter(item => item.allowed.includes(activeRole))
            .map(item => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
        </nav>

        {/* Role Badge — read-only display, no switcher */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 uppercase border border-zinc-700 shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-zinc-200 truncate">{userName}</div>
              <div className="text-[10px] text-zinc-500 font-medium">{activeRole}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-100 capitalize">
              {location.pathname.substring(1).replace('/', ' ') || 'Home'}
            </h2>
            {companyName && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 border border-indigo-900 text-indigo-300">
                {companyName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* AI Copilot Button */}
            <button
              onClick={() => setIsAiOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Ask Copilot
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(prev => !prev)}
                className="flex items-center gap-2 hover:bg-zinc-800/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-300 uppercase border border-zinc-700">
                  {userName.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-semibold text-gray-200">{userName}</div>
                  <div className="text-[10px] text-zinc-500 font-medium">{activeRole}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-1 z-20">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/20 rounded-lg hover:text-red-300 transition-colors cursor-pointer"
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

        {/* Scrollable Content Viewport */}
        <main className="flex-1 h-full overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

      {/* AI Copilot Fixed Overlay Drawer */}
      <AICopilotPanel isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}
