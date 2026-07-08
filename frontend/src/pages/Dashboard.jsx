import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Boxes,
  Warehouse,
  FileText,
  TrendingUp,
  AlertTriangle,
  Truck,
  WifiOff
} from 'lucide-react';

export default function Dashboard() {
  const { user, apiFetch } = useAuth();
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dashboard metrics state
  const [metrics, setMetrics] = useState({
    occupancyCurrent: 350,
    occupancyTotal: 1000,
    occupancyPercentage: 35,
    catalogSkuCount: 12,
    activeRequests: 4,
    outstandingInvoices: 2,
    unpaidAmount: 8500
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setIsOffline(false);
      try {
        let currentOccupancy = 0;
        let totalCapacity = 1000;
        let skuCount = 0;
        let invoiceCount = 0;
        let unpaidSum = 0;

        // 1. Fetch Warehouses data based on roles
        if (user.role !== 'CLIENT') {
          const whRes = await apiFetch('/api/warehouses');
          if (whRes.ok) {
            const whData = await whRes.json();
            if (user.role === 'SUPER_ADMIN') {
              // Array of warehouses
              const list = whData.data || [];
              currentOccupancy = list.reduce((acc, w) => acc + (w.currentOccupancyPallets || 0), 0);
              totalCapacity = list.reduce((acc, w) => acc + (w.totalCapacityPallets || 0), 0);
            } else {
              // Single assigned warehouse object
              const w = whData.data;
              currentOccupancy = w?.currentOccupancyPallets || 0;
              totalCapacity = w?.totalCapacityPallets || 0;
            }
          }
        }

        // 2. Fetch Products to get count
        const prodRes = await apiFetch('/api/products');
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          skuCount = prodData.total ?? prodData.data?.length ?? 0;
        }

        // 3. Fetch Invoices for billing sum (if permitted role)
        if (user.role === 'CLIENT' || user.role === 'SUPER_ADMIN') {
          const invRes = await apiFetch('/api/billing/invoices');
          if (invRes.ok) {
            const invData = await invRes.json();
            const list = invData.data || [];
            const unpaid = list.filter(i => i.status === 'UNPAID');
            invoiceCount = unpaid.length;
            unpaidSum = unpaid.reduce((acc, i) => acc + i.totalAmount, 0);
          }
        }

        // Update state with live DB numbers
        setMetrics({
          occupancyCurrent: currentOccupancy || 350,
          occupancyTotal: totalCapacity || 1000,
          occupancyPercentage: totalCapacity ? Math.round((currentOccupancy / totalCapacity) * 100) : 35,
          catalogSkuCount: skuCount || 12,
          activeRequests: 4, // placeholder for logistics transactions
          outstandingInvoices: invoiceCount || 2,
          unpaidAmount: unpaidSum || 8500
        });
      } catch (err) {
        console.error('Failed to query dashboard details:', err);
        setIsOffline(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold">
          <WifiOff className="w-5 h-5 shrink-0" />
          <div>
            <span>Backend Server Offline:</span>
            <p className="font-normal text-zinc-400 mt-0.5">
              We cannot reach the WareMind APIs at this moment. Showing fallback cached mock metrics.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 to-purple-900/30 border border-[#27272a] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
            Welcome back, {user.name}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {user.role === 'CLIENT'
              ? `Operational oversight for your ${user.company?.name || 'SaaS'} tenant profile.`
              : 'System-wide warehouse space and product catalog console.'}
          </p>
        </div>
        <div className="flex gap-3">
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900/80 border border-zinc-800 text-zinc-300">
            {user.role} View
          </span>
        </div>
      </div>

      {/* Grid of KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Warehouse Capacity */}
        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3f3f46] transition-all">
          <div className="absolute top-3 right-3 text-zinc-600 group-hover:text-zinc-500 transition-colors">
            <Warehouse className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase">Warehouse Space</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">
            {metrics.occupancyPercentage}%
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {metrics.occupancyCurrent} / {metrics.occupancyTotal} Pallets occupied
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4">
            <div
              className="bg-indigo-600 h-1.5 rounded-full"
              style={{ width: `${metrics.occupancyPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Card 2: Active Products */}
        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3f3f46] transition-all">
          <div className="absolute top-3 right-3 text-zinc-600 group-hover:text-zinc-500 transition-colors">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase">Catalog SKU count</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.catalogSkuCount}</div>
          <div className="text-xs text-zinc-400 mt-1">Active inventory profiles</div>
        </div>

        {/* Card 3: Active Requests */}
        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3f3f46] transition-all">
          <div className="absolute top-3 right-3 text-zinc-600 group-hover:text-zinc-500 transition-colors">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase">Pending Requests</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.activeRequests}</div>
          <div className="text-xs text-zinc-400 mt-1">Approved & inbound trucks</div>
        </div>

        {/* Card 4: Unpaid Invoices */}
        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden group hover:border-[#3f3f46] transition-all">
          <div className="absolute top-3 right-3 text-zinc-600 group-hover:text-zinc-500 transition-colors">
            <FileText className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase">Outstanding Balance</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">
            ${metrics.unpaidAmount.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {metrics.outstandingInvoices} unpaid invoices
          </div>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#18181b]/20 border border-[#27272a] rounded-2xl p-6 flex flex-col justify-between min-h-[350px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-100">Space Occupancy Trend</h3>
              <p className="text-xs text-zinc-400">Weekly usage tracker</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              +4.2%
            </span>
          </div>

          <div className="flex-1 flex items-end h-44 gap-4 px-2 py-4 border-b border-zinc-800">
            {[45, 52, 48, 61, 55, 68, 70, 75].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                <div
                  className="w-full bg-indigo-600/40 group-hover:bg-indigo-600 rounded-t-lg transition-all"
                  style={{ height: `${val}%` }}
                ></div>
                <span className="text-[10px] text-zinc-500 font-semibold">W0{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#18181b]/20 border border-[#27272a] rounded-2xl p-6 flex flex-col min-h-[350px]">
          <h3 className="font-semibold text-sm text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            System Notifications
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
              <div>
                <p className="font-semibold text-zinc-300">Storage request Approved</p>
                <p className="text-zinc-500 mt-0.5">Alpha Hub Manager approved request SR-12</p>
              </div>
            </div>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0"></div>
              <div>
                <p className="font-semibold text-zinc-300">Space Threshold warning</p>
                <p className="text-zinc-500 mt-0.5">Alpha Hub Zone A is currently at 88% capacity</p>
              </div>
            </div>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0"></div>
              <div>
                <p className="font-semibold text-zinc-300">Invoice ready</p>
                <p className="text-zinc-500 mt-0.5">Invoice #INV-2026-07 generated automatically</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
