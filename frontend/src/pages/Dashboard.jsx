import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Boxes,
  Warehouse,
  FileText,
  TrendingUp,
  AlertTriangle,
  Truck,
  Loader2,
  Building2,
  Activity
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
        let totalCapacity = 0;
        let currentOccupancy = 0;
        let warehouseCount = 0;
        let companyCount = 0;
        let skuCount = 0;
        let invoiceCount = 0;
        let unpaidSum = 0;

        // 1. Fetch Warehouses
        if (user.role !== 'CLIENT') {
          const whRes = await apiFetch('/api/warehouses');
          if (whRes.ok) {
            const whData = await whRes.json();
            const list = Array.isArray(whData.data) ? whData.data : [whData.data].filter(Boolean);
            warehouseCount = list.length;
            totalCapacity = list.reduce((acc, w) => acc + (w.totalCapacityPallets || 0), 0);
            currentOccupancy = list.reduce((acc, w) => acc + (w.currentOccupancyPallets || 0), 0);
          }
        }

        // 2. Fetch Companies count (SUPER_ADMIN only)
        if (user.role === 'SUPER_ADMIN') {
          const coRes = await apiFetch('/api/companies');
          if (coRes.ok) {
            const coData = await coRes.json();
            companyCount = (coData.data || []).length;
          }
        }

        // 3. Fetch Products
        const prodRes = await apiFetch('/api/products');
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          skuCount = prodData.total ?? (prodData.data?.length ?? 0);
        }

        // 4. Fetch Invoices (CLIENT and SUPER_ADMIN only)
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
          warehouseCount,
          companyCount,
          catalogSkuCount: skuCount,
          outstandingInvoices: invoiceCount,
          unpaidAmount: unpaidSum,
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
              ? `Operational overview for ${user.company?.name || 'your account'}.`
              : user.role === 'SUPER_ADMIN'
                ? `Managing ${metrics.companyCount} client tenant${metrics.companyCount !== 1 ? 's' : ''} across ${metrics.warehouseCount} warehouse${metrics.warehouseCount !== 1 ? 's' : ''}.`
                : 'Warehouse operations console — spatial & inventory status.'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/40 border border-emerald-900/60 rounded-xl shrink-0">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400">Live Data</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Warehouse Occupancy — shown to non-CLIENT roles */}
        {user.role !== 'CLIENT' && (
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
            <div className="absolute top-4 right-4 text-zinc-600">
              <Warehouse className="w-5 h-5" />
            </div>
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Warehouse Space</div>
            <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.occupancyPercentage}%</div>
            <div className="text-xs text-zinc-400 mt-1">
              {metrics.occupancyCurrent.toLocaleString()} / {metrics.occupancyTotal.toLocaleString()} pallets
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-4">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  metrics.occupancyPercentage > 80
                    ? 'bg-amber-500'
                    : metrics.occupancyPercentage > 50
                      ? 'bg-indigo-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(metrics.occupancyPercentage, 1)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 leading-tight">
              Real-time occupancy driven by active physical storage allocations.
            </p>
          </div>
        )}

        {/* Total SKUs */}
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
          <div className="absolute top-4 right-4 text-zinc-600">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {isSuperAdmin(user) ? 'Total Catalog SKUs' : 'Your Catalog SKUs'}
          </div>
          <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.catalogSkuCount}</div>
          <div className="text-xs text-zinc-400 mt-1">Registered product profiles</div>
        </div>

        {/* Active Requests placeholder */}
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
          <div className="absolute top-4 right-4 text-zinc-600">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Storage Pipeline</div>
          <div className="text-2xl font-bold text-gray-100 mt-2">—</div>
          <div className="text-xs text-zinc-400 mt-1">Active storage & dispatch jobs</div>
        </div>

        {/* Outstanding Balance — CLIENT and SUPER_ADMIN */}
        {(user.role === 'CLIENT' || user.role === 'SUPER_ADMIN') && (
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
            <div className="absolute top-4 right-4 text-zinc-600">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Outstanding Balance</div>
            <div className="text-2xl font-bold text-gray-100 mt-2">
              {metrics.unpaidAmount > 0 ? `$${metrics.unpaidAmount.toLocaleString()}` : '$0'}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {metrics.outstandingInvoices > 0
                ? `${metrics.outstandingInvoices} unpaid invoice${metrics.outstandingInvoices !== 1 ? 's' : ''}`
                : 'All invoices settled'}
            </div>
          </div>
        )}

        {/* Client Tenants — SUPER_ADMIN only */}
        {user.role === 'SUPER_ADMIN' && (
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 relative group hover:border-zinc-700 transition-all">
            <div className="absolute top-4 right-4 text-zinc-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Client Tenants</div>
            <div className="text-2xl font-bold text-gray-100 mt-2">{metrics.companyCount}</div>
            <div className="text-xs text-zinc-400 mt-1">Registered 3PL client organisations</div>
          </div>
        )}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Occupancy Visualiser */}
        {user.role !== 'CLIENT' && (
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-h-[300px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-sm text-gray-100">Space Utilisation</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Live pallet occupancy across all warehouses</p>
              </div>
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                Live
              </span>
            </div>

            {/* Single-bar occupancy visualiser */}
            <div className="flex-1 flex flex-col justify-center gap-5 px-2">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Occupied Pallets</span>
                  <span className="font-semibold text-gray-200">
                    {metrics.occupancyCurrent.toLocaleString()} / {metrics.occupancyTotal.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all duration-700 flex items-center justify-end pr-3 text-[10px] font-bold text-white ${
                      metrics.occupancyPercentage > 80
                        ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                        : metrics.occupancyPercentage > 50
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500'
                          : 'bg-gradient-to-r from-emerald-700 to-emerald-500'
                    }`}
                    style={{ width: `${Math.max(metrics.occupancyPercentage, 3)}%` }}
                  >
                    {metrics.occupancyPercentage > 10 ? `${metrics.occupancyPercentage}%` : ''}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 leading-tight">
                  Occupancy percentage is updated in real-time as storage requests progress to STORED status.
                  {metrics.occupancyCurrent === 0 && ' No items are physically stored yet — submit a storage request to begin.'}
                </p>
              </div>

              {/* Warehouse breakdown for SUPER_ADMIN */}
              {user.role === 'SUPER_ADMIN' && (
                <div className="pt-4 border-t border-zinc-800/60 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-100">{metrics.warehouseCount}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Total Warehouses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-100">{metrics.companyCount}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Active Tenants</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications / Info Panel */}
        <div className={`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-h-[300px] flex flex-col ${user.role === 'CLIENT' ? 'lg:col-span-3' : ''}`}>
          <h3 className="font-semibold text-sm text-gray-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            System Notifications
          </h3>
          <div className="flex-1 flex flex-col justify-center items-center text-center gap-2">
            {metrics.occupancyCurrent === 0 && user.role !== 'CLIENT' && (
              <div className="p-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl text-left w-full">
                <p className="text-xs font-semibold text-amber-400 mb-1">0% Occupancy Explained</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  No storage requests have been advanced to <span className="text-zinc-300 font-mono">STORED</span> status yet.
                  Once a CLIENT submits a storage request and it is approved and physically stored by warehouse staff, occupancy figures will update automatically.
                </p>
              </div>
            )}
            {metrics.occupancyCurrent === 0 && user.role === 'CLIENT' && (
              <div className="p-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl text-left w-full">
                <p className="text-xs font-semibold text-indigo-400 mb-1">Get started</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  You have no active inventory stored yet. Navigate to the <span className="text-zinc-300 font-semibold">Warehouse</span> page to submit your first storage request.
                </p>
              </div>
            )}
            {metrics.occupancyCurrent > 0 && (
              <p className="text-xs text-zinc-500 font-medium">No new system notifications</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper — avoids repeating role string
function isSuperAdmin(user) {
  return user?.role === 'SUPER_ADMIN';
}
