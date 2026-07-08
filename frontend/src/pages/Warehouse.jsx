import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Warehouse as WhIcon,
  Box,
  CircleAlert,
  Users,
  Layers,
  Loader2,
  PackagePlus,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X
} from 'lucide-react';

// ─── Sub-component: CLIENT storage request form ───────────────────────────────
function StorageRequestForm({ apiFetch, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [form, setForm] = useState({ productId: '', quantity: '', requestedPallets: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoadingProducts(true);
      try {
        const res = await apiFetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.productId || !form.quantity || !form.requestedPallets) {
      setError('All fields are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/storage/requests', {
        method: 'POST',
        body: JSON.stringify({
          productId: form.productId,
          quantity: parseInt(form.quantity, 10),
          requestedPallets: parseInt(form.requestedPallets, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Submission failed.');
      setSuccess(true);
      setForm({ productId: '', quantity: '', requestedPallets: '' });
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <PackagePlus className="w-5 h-5 text-indigo-400" />
        <div>
          <h2 className="text-sm font-bold text-gray-100">New Storage Request</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Select a product and specify how many pallets you need to store</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Storage request submitted successfully. Awaiting warehouse manager approval.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-950/20 border border-red-900/60 rounded-xl text-red-400 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
            Product / SKU
          </label>
          {isLoadingProducts ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading your products...
            </div>
          ) : products.length === 0 ? (
            <div className="px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-600">
              No products registered yet — add a product in the Inventory catalog first.
            </div>
          ) : (
            <select
              required
              value={form.productId}
              onChange={(e) => setForm(prev => ({ ...prev, productId: e.target.value }))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="" disabled>Select a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Quantity (units)
            </label>
            <input
              type="number"
              required
              min="1"
              value={form.quantity}
              onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="e.g. 500"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Requested Pallets
            </label>
            <input
              type="number"
              required
              min="1"
              value={form.requestedPallets}
              onChange={(e) => setForm(prev => ({ ...prev, requestedPallets: e.target.value }))}
              placeholder="e.g. 10"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || products.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 cursor-pointer"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isSubmitting ? 'Submitting...' : 'Submit Storage Request'}
        </button>
      </form>
    </div>
  );
}

// ─── Sub-component: PENDING requests list for MANAGER/ADMIN ──────────────────
function PendingRequestsPanel({ apiFetch, onApprove }) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/storage/requests');
      if (res.ok) {
        const data = await res.json();
        const all = data.data || [];
        setRequests(all.filter(r => r.status === 'PENDING'));
      } else {
        setError('Failed to load storage requests.');
      }
    } catch (err) {
      setError('Connection error loading requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (requestId) => {
    setApprovingId(requestId);
    try {
      const res = await apiFetch(`/api/storage/requests/${requestId}/approve`, { method: 'PUT' });
      if (res.ok) {
        await load();
        if (onApprove) onApprove();
      } else {
        const data = await res.json();
        alert(data.message || 'Approval failed.');
      }
    } catch (err) {
      alert('Network error during approval.');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-gray-100">Incoming Storage Requests</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Review and approve pending client allocation requests</p>
          </div>
        </div>
        <button
          onClick={load}
          className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">Loading requests...</span>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex items-center gap-2 p-3.5 bg-red-950/20 border border-red-900/60 rounded-xl text-red-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!isLoading && !error && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-600">
          <CheckCircle2 className="w-7 h-7 text-zinc-700" />
          <p className="text-xs font-semibold text-zinc-500">No pending requests</p>
          <p className="text-[10px] text-zinc-600">All storage requests have been processed.</p>
        </div>
      )}

      {!isLoading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-950/50 border border-zinc-800/60 rounded-xl hover:border-zinc-700 transition-all"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-900/60 text-amber-400">
                    <Clock className="w-3 h-3" />
                    PENDING
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 truncate">
                    {req.product?.name || 'Unknown Product'}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {req.product?.sku}
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] text-zinc-500">
                  <span>
                    <span className="text-zinc-400 font-semibold">{req.requestedPallets}</span> pallets requested
                  </span>
                  <span>
                    <span className="text-zinc-400 font-semibold">{req.quantity?.toLocaleString()}</span> units
                  </span>
                  <span className="truncate">
                    Client: <span className="text-zinc-400 font-semibold">{req.company?.name || '—'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleApprove(req.id)}
                disabled={approvingId === req.id}
                className="flex items-center gap-1.5 shrink-0 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                {approvingId === req.id
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving...</>
                  : <><CheckCircle2 className="w-3.5 h-3.5" /> Approve & Allocate</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Warehouse Page ──────────────────────────────────────────────────────
export default function Warehouse() {
  const { user, apiFetch } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [gridData, setGridData] = useState(null);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedBin, setSelectedBin] = useState(null);
  const [isLoadingGrid, setIsLoadingGrid] = useState(true);
  const [gridError, setGridError] = useState(null);

  const isClient = user?.role === 'CLIENT';
  const canApprove = user?.role === 'SUPER_ADMIN' || user?.role === 'WAREHOUSE_MANAGER';

  // 1. Fetch Warehouses list
  useEffect(() => {
    const fetchWarehousesList = async () => {
      setIsLoadingGrid(true);
      setGridError(null);
      try {
        const res = await apiFetch('/api/warehouses');
        if (res.ok) {
          const result = await res.json();
          const list = Array.isArray(result.data) ? result.data : [result.data].filter(Boolean);
          setWarehouses(list);
          if (list.length > 0) setSelectedWarehouseId(list[0].id);
        } else {
          setGridError('Could not load warehouse list.');
        }
      } catch (err) {
        console.error('Failed to load warehouses:', err);
        setGridError('Connection error. Is the backend server running?');
      } finally {
        setIsLoadingGrid(false);
      }
    };
    fetchWarehousesList();
  }, []);

  // 2. Fetch grid when selection changes
  useEffect(() => {
    if (!selectedWarehouseId) return;
    const fetchGrid = async () => {
      setIsLoadingGrid(true);
      setGridError(null);
      try {
        const res = await apiFetch(`/api/warehouses/${selectedWarehouseId}/grid`);
        if (res.ok) {
          const result = await res.json();
          const wh = result.data;
          setGridData(wh);
          if (wh?.zones?.length > 0) setSelectedZone(wh.zones[0].name);
        } else {
          setGridError('Could not load grid layout for this warehouse.');
        }
      } catch (err) {
        console.error('Failed to load grid:', err);
        setGridError('Connection error loading grid layout.');
      } finally {
        setIsLoadingGrid(false);
      }
    };
    fetchGrid();
  }, [selectedWarehouseId]);

  const activeZone = gridData?.zones?.find(z => z.name === selectedZone) || gridData?.zones?.[0];

  return (
    <div className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <WhIcon className="w-5 h-5 text-indigo-500" />
            Warehouse Operations
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {isClient
              ? 'Submit storage requests and view your inventory allocations'
              : 'Manage spatial layout and approve incoming client storage requests'}
          </p>
        </div>

        {/* Zone/Warehouse selectors */}
        <div className="flex gap-3 flex-wrap">
          {warehouses.length > 1 && (
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-600"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
          {gridData?.zones && gridData.zones.length > 0 && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {gridData.zones.map(z => (
                <button
                  key={z.id}
                  onClick={() => { setSelectedZone(z.name); setSelectedBin(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedZone === z.name ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {z.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CLIENT: Storage Request Form ─────────────────────────────────── */}
      {isClient && (
        <StorageRequestForm apiFetch={apiFetch} />
      )}

      {/* ── ADMIN/MANAGER: Pending Requests Panel ─────────────────────────── */}
      {canApprove && (
        <PendingRequestsPanel apiFetch={apiFetch} />
      )}

      {/* ── Spatial Grid Map ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Spatial Grid Map</h2>
          {gridData && (
            <span className="text-xs text-zinc-500 font-medium">
              {gridData.name} — {gridData.location}
            </span>
          )}
        </div>

        {/* Rule info banner */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-start gap-3">
          <CircleAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-gray-200">Single-Tenant Rack Rule:</span>
            <p className="text-zinc-400 mt-1">
              Each rack is restricted to hold inventory belonging to one client company exclusively.
              Vacant racks bind to a tenant automatically upon first physical storage allocation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Grid */}
          <div className="lg:col-span-2">
            {isLoadingGrid ? (
              <div className="flex flex-col items-center justify-center p-24 gap-2 bg-zinc-950/20 border border-zinc-900 rounded-2xl text-zinc-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">Loading spatial matrix...</span>
              </div>
            ) : gridError ? (
              <div className="flex flex-col items-center justify-center p-20 gap-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl text-zinc-500">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
                <p className="text-xs font-medium text-zinc-400">{gridError}</p>
              </div>
            ) : activeZone?.racks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeZone.racks.map(rack => {
                  const companyName = rack.currentCompany?.name;
                  const allocationBorder = companyName
                    ? 'border-indigo-600/60 bg-indigo-950/20'
                    : 'border-zinc-800 bg-zinc-900/20';

                  return (
                    <div key={rack.id} className={`border rounded-2xl p-5 flex flex-col justify-between ${allocationBorder}`}>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-sm text-gray-100">{rack.name}</h3>
                          {companyName ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-900 text-indigo-300">
                              <Users className="w-3 h-3" />
                              {companyName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                              Vacant / Open
                            </span>
                          )}
                        </div>

                        <div className="space-y-4">
                          {(rack.shelves || []).map(shelf => (
                            <div key={shelf.id} className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/60">
                              <div className="text-[10px] text-zinc-500 font-semibold mb-2 flex items-center gap-1 uppercase">
                                <Layers className="w-3 h-3" />
                                {shelf.name}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {(shelf.bins || []).map(bin => {
                                  const activeStock = bin.inventories?.find(inv => inv.status === 'STORED');
                                  const isSelected = selectedBin?.id === bin.id;
                                  return (
                                    <button
                                      key={bin.id}
                                      onClick={() => activeStock && setSelectedBin({ ...bin, activeStock })}
                                      disabled={!activeStock}
                                      className={`h-10 rounded-lg flex flex-col items-center justify-center border text-[10px] font-bold transition-all cursor-pointer ${
                                        !activeStock
                                          ? 'border-dashed border-zinc-800 bg-transparent text-zinc-700 cursor-not-allowed'
                                          : isSelected
                                            ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                                      }`}
                                    >
                                      {bin.name}
                                      {activeStock && (
                                        <span className="text-[8px] opacity-75 font-normal mt-0.5">
                                          {activeStock.quantity}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-500 text-xs font-semibold bg-zinc-950/20 border border-zinc-900 rounded-2xl">
                No space mappings configured for this warehouse yet.
              </div>
            )}
          </div>

          {/* Bin Detail Panel */}
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 h-fit space-y-5">
            <h3 className="font-semibold text-sm text-zinc-200 border-b border-zinc-800/80 pb-3 flex items-center gap-2">
              <Box className="w-4 h-4 text-indigo-400" />
              Bin Allocation Details
            </h3>

            {selectedBin ? (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedBin(null)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Clear selection
                </button>

                {[
                  { label: 'Bin ID', value: selectedBin.id, mono: true },
                  { label: 'Bin Name', value: selectedBin.name },
                  { label: 'Product Name', value: selectedBin.activeStock?.product?.name || 'General Inventory' },
                  { label: 'Product SKU', value: selectedBin.activeStock?.product?.sku || 'N/A', mono: true, accent: true },
                  { label: 'Stored Units', value: `${selectedBin.activeStock?.quantity ?? 0} items` },
                  { label: 'Status', value: selectedBin.activeStock?.status || '—' },
                ].map(({ label, value, mono, accent }) => (
                  <div key={label} className="space-y-1">
                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">{label}</div>
                    <div className={`text-xs font-bold ${mono ? 'font-mono' : ''} ${accent ? 'text-indigo-400' : 'text-zinc-200'}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-600 text-xs font-medium">
                Click an allocated bin on the grid map to inspect its inventory contents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
