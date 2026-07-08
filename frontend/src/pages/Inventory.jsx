import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Plus, Search, AlertOctagon, Snowflake, WifiOff, Loader2 } from 'lucide-react';

export default function Inventory() {
  const { apiFetch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    category: 'Electronics',
    weight: '',
    dimensions: '',
    isHazardous: false,
    isTemperatureSensitive: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchProducts = async () => {
    setIsLoading(true);
    setIsOffline(false);
    try {
      const res = await apiFetch('/api/products');
      if (res.ok) {
        const result = await res.json();
        // The API returns { success: true, data: [...] }
        setProducts(result.data || []);
      } else {
        setIsOffline(true);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.sku || !newProduct.name) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...newProduct,
          weight: parseFloat(newProduct.weight) || 0.1,
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create product.');
      }

      // Success -> Close modal, refetch, reset fields
      setShowAddModal(false);
      setNewProduct({
        sku: '',
        name: '',
        category: 'Electronics',
        weight: '',
        dimensions: '',
        isHazardous: false,
        isTemperatureSensitive: false
      });
      await fetchProducts();
    } catch (err) {
      setSubmitError(err.message || 'Failed to communicate with catalog database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold">
          <WifiOff className="w-5 h-5 shrink-0" />
          <div>
            <span>Backend Server Offline:</span>
            <p className="font-normal text-zinc-400 mt-0.5">
              Cannot fetch active catalog. Showing temporary static items.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Product Catalog</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage and register multi-tenant item profiles</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
        >
          <Plus className="w-4.5 h-4.5" />
          Add Product
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by SKU or Product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#18181b]/30 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#18181b]/20 border border-[#27272a] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Loading product catalog...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 font-semibold text-xs">
                  <th className="p-4 pl-6">SKU</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Weight</th>
                  <th className="p-4">Dimensions</th>
                  <th className="p-4">Attributes</th>
                  <th className="p-4 pr-6 text-right">Stored Units</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300 text-xs divide-y divide-zinc-800/80">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="p-4 pl-6 font-mono text-zinc-400">{product.sku}</td>
                    <td className="p-4 font-semibold text-zinc-100">{product.name}</td>
                    <td className="p-4 text-zinc-400">{product.category}</td>
                    <td className="p-4">{product.weight} kg</td>
                    <td className="p-4 text-zinc-400">{product.dimensions}</td>
                    <td className="p-4 flex gap-1.5 items-center">
                      {product.isHazardous && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 border border-red-900 text-[10px] text-red-400 font-semibold">
                          <AlertOctagon className="w-3 h-3" />
                          Hazardous
                        </span>
                      )}
                      {product.isTemperatureSensitive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-900 text-[10px] text-blue-400 font-semibold">
                          <Snowflake className="w-3 h-3" />
                          Temp Controlled
                        </span>
                      )}
                      {!product.isHazardous && !product.isTemperatureSensitive && (
                        <span className="text-zinc-500 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right font-bold text-indigo-400">
                      {/* Show active inventory count if available, or fall back */}
                      {product._count?.inventories ?? product.stockCount ?? 0}
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-zinc-500 font-semibold">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Product Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <h3 className="text-base font-bold text-gray-100">Register New Product Profile</h3>
            
            {submitError && (
              <div className="p-3 bg-red-950/20 border border-red-900 text-red-400 rounded-xl text-xs font-semibold">
                {submitError}
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="e.g. SAM-S24-ULTRA"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Power Sources">Power Sources</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Clothing">Clothing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Samsung Galaxy S24 Ultra"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newProduct.weight}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="0.250"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">Dimensions (LxWxH)</label>
                  <input
                    type="text"
                    value={newProduct.dimensions}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, dimensions: e.target.value }))}
                    placeholder="e.g. 15x8x1 cm"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProduct.isHazardous}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, isHazardous: e.target.checked }))}
                    className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400">Contains Hazardous Material</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProduct.isTemperatureSensitive}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, isTemperatureSensitive: e.target.checked }))}
                    className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400">Requires Cold Storage</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
