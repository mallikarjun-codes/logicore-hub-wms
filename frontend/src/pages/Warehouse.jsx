import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Warehouse as WhIcon, Box, CircleAlert, Users, Layers, WifiOff, Loader2 } from 'lucide-react';

export default function Warehouse() {
  const { user, apiFetch } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [gridData, setGridData] = useState(null);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedBin, setSelectedBin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // 1. Fetch Warehouses list
  useEffect(() => {
    const fetchWarehousesList = async () => {
      setIsLoading(true);
      setIsOffline(false);
      try {
        const res = await apiFetch('/api/warehouses');
        if (res.ok) {
          const result = await res.json();
          const list = Array.isArray(result.data) ? result.data : [result.data].filter(Boolean);
          setWarehouses(list);
          if (list.length > 0) {
            setSelectedWarehouseId(list[0].id);
          }
        } else {
          setIsOffline(true);
        }
      } catch (err) {
        console.error('Failed to load warehouses:', err);
        setIsOffline(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWarehousesList();
  }, []);

  // 2. Fetch specific Grid layout once selectedWarehouseId changes
  useEffect(() => {
    if (!selectedWarehouseId) return;

    const fetchWarehouseGrid = async () => {
      setIsLoading(true);
      setIsOffline(false);
      try {
        const res = await apiFetch(`/api/warehouses/${selectedWarehouseId}/grid`);
        if (res.ok) {
          const result = await res.json();
          const whGrid = result.data;
          setGridData(whGrid);
          if (whGrid?.zones?.length > 0) {
            setSelectedZone(whGrid.zones[0].name);
          }
        } else {
          setIsOffline(true);
        }
      } catch (err) {
        console.error('Failed to load grid layout:', err);
        setIsOffline(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWarehouseGrid();
  }, [selectedWarehouseId]);

  const activeZone = gridData?.zones?.find(z => z.name === selectedZone) || gridData?.zones?.[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold">
          <WifiOff className="w-5 h-5 shrink-0" />
          <div>
            <span>Backend Server Offline:</span>
            <p className="font-normal text-zinc-400 mt-0.5">
              Cannot fetch spatial map layout. Showing offline fallback dashboard views.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <WhIcon className="w-5.5 h-5.5 text-indigo-500" />
            Warehouse Grid Map
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {gridData
              ? `Visual spatial layout for ${gridData.name} (${gridData.location})`
              : 'Visual spatial layout console'}
          </p>
        </div>

        <div className="flex gap-3">
          {/* Warehouse Selector (if multiple exist) */}
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

          {/* Zone Selector */}
          {gridData?.zones && gridData.zones.length > 0 && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {gridData.zones.map(z => (
                <button
                  key={z.id}
                  onClick={() => {
                    setSelectedZone(z.name);
                    setSelectedBin(null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedZone === z.name
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {z.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Interactive Map Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-start gap-3">
            <CircleAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-gray-200">Space Allocation Rule Enforcement (Rule 3):</span>
              <p className="text-zinc-400 mt-1">
                Each Rack is restricted to hold inventory belonging exclusively to a single company. Vacant racks will automatically bind to the tenant company upon product storage.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-24 text-zinc-400 gap-2 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Loading spatial matrix layout...</span>
            </div>
          ) : activeZone?.racks ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeZone.racks.map(rack => {
                // Determine company owner color codes
                const companyName = rack.currentCompany?.name;
                const allocationBorder = companyName
                  ? 'border-indigo-600/60 bg-indigo-950/20 text-indigo-400'
                  : 'border-zinc-800 bg-zinc-900/20 text-zinc-500';

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

                      {/* Shelves */}
                      <div className="space-y-4">
                        {(rack.shelves || []).map(shelf => (
                          <div key={shelf.id} className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-850">
                            <div className="text-[10px] text-zinc-500 font-semibold mb-2 flex items-center gap-1 uppercase">
                              <Layers className="w-3 h-3" />
                              {shelf.name}
                            </div>
                            
                            {/* Bins */}
                            <div className="grid grid-cols-3 gap-2">
                              {(shelf.bins || []).map(bin => {
                                const activeStock = bin.inventories?.find(inv => inv.status === 'STORED');
                                const isSelected = selectedBin?.id === bin.id;
                                return (
                                  <button
                                    key={bin.id}
                                    onClick={() => activeStock && setSelectedBin({ ...bin, activeStock })}
                                    disabled={!activeStock}
                                    className={`h-10 rounded-lg flex flex-col items-center justify-center border text-[10px] font-bold transition-all ${
                                      !activeStock
                                        ? 'border-dashed border-zinc-850 bg-transparent text-zinc-600 cursor-not-allowed'
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

        {/* Right Column: Bin details */}
        <div className="bg-[#18181b]/20 border border-[#27272a] rounded-2xl p-6 h-fit space-y-6">
          <h3 className="font-semibold text-sm text-zinc-200 border-b border-zinc-800/80 pb-3 flex items-center gap-2">
            <Box className="w-4.5 h-4.5 text-indigo-400" />
            Bin Allocation Details
          </h3>

          {selectedBin ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Bin ID</div>
                <div className="text-xs font-mono text-zinc-300 font-bold">{selectedBin.id}</div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Product Name</div>
                <div className="text-xs text-zinc-200 font-bold">
                  {selectedBin.activeStock?.product?.name || 'General Inventory'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Product SKU</div>
                <div className="text-xs font-mono text-indigo-400 font-bold">
                  {selectedBin.activeStock?.product?.sku || 'N/A'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Occupancy Units</div>
                <div className="text-xs text-zinc-200 font-bold">{selectedBin.activeStock.quantity} items</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500 text-xs font-semibold">
              Select an allocated bin on the map grid to view its inventory contents.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
