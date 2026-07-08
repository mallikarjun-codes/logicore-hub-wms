import React, { useState } from 'react';
import { Warehouse as WhIcon, Box, Check, CircleAlert, Users, Layers } from 'lucide-react';

export default function Warehouse() {
  const [selectedZone, setSelectedZone] = useState('Zone A');
  const [selectedBin, setSelectedBin] = useState(null);

  // Mock relational warehouse grid tree (Zone -> Rack -> Shelf -> Bin)
  const warehouseGrid = {
    name: 'Alpha Hub',
    location: 'Pune Industrial Area',
    zones: [
      {
        id: 'z-a',
        name: 'Zone A',
        racks: [
          {
            id: 'r-101',
            name: 'Rack 101',
            company: { name: 'Samsung India', color: 'border-blue-600/60 bg-blue-950/20 text-blue-400' },
            shelves: [
              {
                id: 's-101-1',
                name: 'Shelf 1',
                bins: [
                  { id: 'b-101-1-1', name: 'Bin 1', quantity: 500, product: { sku: 'SAM-S24-ULTRA', name: 'Samsung Galaxy S24 Ultra' } },
                  { id: 'b-101-1-2', name: 'Bin 2', quantity: 120, product: { sku: 'SAM-TAB-S9', name: 'Samsung Galaxy Tab S9' } }
                ]
              },
              {
                id: 's-101-2',
                name: 'Shelf 2',
                bins: [
                  { id: 'b-101-2-1', name: 'Bin 3', quantity: 300, product: { sku: 'SAM-S24-ULTRA', name: 'Samsung Galaxy S24 Ultra' } }
                ]
              }
            ]
          },
          {
            id: 'r-102',
            name: 'Rack 102',
            company: null, // Vacant / Available
            shelves: [
              {
                id: 's-102-1',
                name: 'Shelf 1',
                bins: [
                  { id: 'b-102-1-1', name: 'Bin 1', quantity: 0, product: null }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'z-b',
        name: 'Zone B',
        racks: [
          {
            id: 'r-201',
            name: 'Rack 201',
            company: { name: 'Boat Logistics Client', color: 'border-indigo-600/60 bg-indigo-950/20 text-indigo-400' },
            shelves: [
              {
                id: 's-201-1',
                name: 'Shelf 1',
                bins: [
                  { id: 'b-201-1-1', name: 'Bin 1', quantity: 1000, product: { sku: 'BOAT-AD-141', name: 'Boat Airdopes 141' } }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const activeZone = warehouseGrid.zones.find(z => z.name === selectedZone) || warehouseGrid.zones[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <WhIcon className="w-5.5 h-5.5 text-indigo-500" />
            Warehouse Grid Map
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Visual spatial layout for {warehouseGrid.name} ({warehouseGrid.location})
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {warehouseGrid.zones.map(z => (
            <button
              key={z.id}
              onClick={() => {
                setSelectedZone(z.name);
                setSelectedBin(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedZone === z.name
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {z.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Interactive Map Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Rule Warning banner */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-start gap-3">
            <CircleAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-gray-200">Space Allocation Rule Enforcement (Rule 3):</span>
              <p className="text-zinc-400 mt-1">
                Each Rack is restricted to hold inventory belonging exclusively to a single company. Vacant racks (marked as vacant) will lock to the tenant company upon first bin store execution.
              </p>
            </div>
          </div>

          {/* Racks List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeZone.racks.map(rack => (
              <div
                key={rack.id}
                className={`border rounded-2xl p-5 flex flex-col justify-between ${
                  rack.company
                    ? rack.company.color
                    : 'border-zinc-800 bg-zinc-900/20 text-zinc-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-gray-100">{rack.name}</h3>
                    {rack.company ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-900 text-indigo-300">
                        <Users className="w-3 h-3" />
                        {rack.company.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                        Vacant / Open
                      </span>
                    )}
                  </div>

                  {/* Shelves inside Rack */}
                  <div className="space-y-4">
                    {rack.shelves.map(shelf => (
                      <div key={shelf.id} className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-850">
                        <div className="text-[10px] text-zinc-500 font-semibold mb-2 flex items-center gap-1 uppercase">
                          <Layers className="w-3 h-3" />
                          {shelf.name}
                        </div>
                        {/* Bins inside Shelf */}
                        <div className="grid grid-cols-3 gap-2">
                          {shelf.bins.map(bin => {
                            const isSelected = selectedBin?.id === bin.id;
                            return (
                              <button
                                key={bin.id}
                                onClick={() => bin.product && setSelectedBin(bin)}
                                disabled={!bin.product}
                                className={`h-10 rounded-lg flex flex-col items-center justify-center border text-[10px] font-bold transition-all ${
                                  !bin.product
                                    ? 'border-dashed border-zinc-850 bg-transparent text-zinc-600 cursor-not-allowed'
                                    : isSelected
                                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                                }`}
                              >
                                {bin.name}
                                {bin.product && (
                                  <span className="text-[8px] opacity-75 font-normal mt-0.5">
                                    {bin.quantity}
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
            ))}
          </div>
        </div>

        {/* Right Column: Slot Detail Drawer */}
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
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Product SKU</div>
                <div className="text-xs font-mono text-indigo-400 font-bold">{selectedBin.product.sku}</div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Product Name</div>
                <div className="text-xs text-zinc-200 font-bold">{selectedBin.product.name}</div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase">Occupancy Units</div>
                <div className="text-xs text-zinc-200 font-bold">{selectedBin.quantity} items</div>
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
