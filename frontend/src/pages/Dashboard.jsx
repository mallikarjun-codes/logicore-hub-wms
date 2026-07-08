import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Boxes,
  Warehouse,
  FileText,
  TrendingUp,
  AlertTriangle,
  Truck,
  Loader2
} from 'lucide-react';

export default function Dashboard() {
  const { user, apiFetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let currentOccupancy = 0;
        let totalCapacity = 0;
        let skuCount = 0;
        let invoiceCount = 0;
        let unpaidSum = 0;

        // 1. Fetch Warehouses (non-CLIENT roles)
        if (user.role !== 'CLIENT') {
          const whRes = await apiFetch('/api/warehouses');
          if (!whRes.ok) throw new Error('Failed to load warehouse data.');
          const whData = await whRes.json();
          if (user.role === 'SUPER_ADMIN') {
            const list = Array.isArray(whData.data) ? whData.data : [];
            currentOccupancy = list.reduce((acc, w) => acc + (w.currentOccupancyPallets || 0), 0);
            totalCapacity = list.reduce((acc, w) => acc + (w.totalCapacityPallets || 0), 0);
          } else {
            const w = whData.data;
            currentOccupancy = w?.currentOccupancyPallets || 0;
            totalCapacity = w?.totalCapacityPallets || 0;
          }
        }

        // 2. Fetch Products count
        const prodRes = await apiFetch('/api/products');
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          skuCount = prodData.total ?? (prodData.data?.length ?? 0);
        }

        // 3. Fetch Invoices (CLIENT and SUPER_ADMIN only)
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

        setMetrics({
          occupancyCurrent: currentOccupancy,
          occupancyTotal: totalCapacity,
          occupancyPercentage: totalCapacity > 0 ? Math.round((currentOccupancy / totalCapacity) * 100) : 0,
          catalogSkuCount: skuCount,
          outstandingInvoices: invoiceCount,
          unpaidAmount: unpaidSum
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err.message || 'Unable to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Loading operational dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-zinc-500">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-medium text-zinc-300">Unable to load dashboard</p>
        <p className="text-xs text-zinc-500 max-w-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
            Welcome back, {user.name}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {user.role === 'CLIENT'
              ? `Operational oversight for your ${user.company?.name || 'account'} tenant profile.`
              : 'System-wide warehouse space and product catalog console.'}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-950 border border-zinc-800 text-zinc-300 shrink-0">
          {user.role} View
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
          <div className="absolute top-4 right-4 text-zinc-600">
            <Warehouse className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Warehouse Space</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.occupancyPercentage}%</div>
          <div className="text-xs text-zinc-400 mt-1">
            {metrics.occupancyCurrent} / {metrics.occupancyTotal} pallets occupied
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${metrics.occupancyPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
          <div className="absolute top-4 right-4 text-zinc-600">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Catalog SKUs</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.catalogSkuCount}</div>
          <div className="text-xs text-zinc-400 mt-1">Registered product profiles</div>
        </div>

        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
          <div className="absolute top-4 right-4 text-zinc-600">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pending Requests</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">—</div>
          <div className="text-xs text-zinc-400 mt-1">Active storage & dispatch jobs</div>
        </div>

        {(user.role === 'CLIENT' || user.role === 'SUPER_ADMIN') && (
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
            <div className="absolute top-4 right-4 text-zinc-600">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Outstanding Balance</div>
            <div className="text-2xl font-bold text-gray-100 mt-2">
              {metrics.unpaidAmount > 0 ? `$${metrics.unpaidAmount.toLocaleString()}` : '—'}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {metrics.outstandingInvoices > 0
                ? `${metrics.outstandingInvoices} unpaid invoice${metrics.outstandingInvoices > 1 ? 's' : ''}`
                : 'All invoices settled'}
            </div>
          </div>
        )}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Occupancy Bar Chart */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm text-gray-100">Space Occupancy Trend</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Weekly usage tracker</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              Live
            </span>
          </div>

          <div className="flex-1 flex items-end gap-3 px-1 border-b border-zinc-800 pb-2">
            {[45, 52, 48, 61, 55, 68, 70, metrics.occupancyPercentage || 0].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-36 justify-end group cursor-default">
                <div
                  className="w-full bg-indigo-600/30 group-hover:bg-indigo-600/60 rounded-t transition-all"
                  style={{ height: `${val}%` }}
                ></div>
                <span className="text-[9px] text-zinc-600 font-medium">W{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications Panel */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-h-[320px] flex flex-col">
          <h3 className="font-semibold text-sm text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            System Notifications
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-zinc-500 font-medium">No new system notifications</p>
          </div>
        </div>
      </div>
    </div>
  );
}
