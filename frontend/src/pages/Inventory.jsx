import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Plus, Search, AlertOctagon, Snowflake, Loader2, PackageSearch, Building2 } from 'lucide-react';

export default function Inventory() {
  const { user, apiFetch } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  // For SUPER_ADMIN product creation — must pick a company
  const [companies, setCompanies] = useState([]);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    category: 'Electronics',
    weight: '',
    dimensions: '',
    isHazardous: false,
    isTemperatureSensitive: false,
    companyId: '',  // required for SUPER_ADMIN
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/products');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to load product catalog.');
      }
      const result = await res.json();
      setProducts(result.data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await apiFetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.data || []);
      }
    } catch (err) {
      console.error('Could not fetch companies:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCompanies();
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.sku || !newProduct.name) return;
    if (isSuperAdmin && !newProduct.companyId) {
      setSubmitError('As Super Admin you must select a client company for this product.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        sku: newProduct.sku,
        name: newProduct.name,
        category: newProduct.category,
        weight: parseFloat(newProduct.weight) || 0.1,
        dimensions: newProduct.dimensions || 'N/A',
        isHazardous: newProduct.isHazardous,
        isTemperatureSensitive: newProduct.isTemperatureSensitive,
      };
      if (isSuperAdmin) payload.companyId = newProduct.companyId;

      const res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create product.');
      }

      setShowAddModal(false);
      setNewProduct({
        sku: '', name: '', category: 'Electronics', weight: '',
        dimensions: '', isHazardous: false, isTemperatureSensitive: false, companyId: '',
      });
      await fetchProducts();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.company?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Product Catalog</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {isSuperAdmin
              ? 'All registered SKUs across every client tenant'
              : 'Manage and register your company\'s item profiles'}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder={isSuperAdmin ? 'Search by SKU, name, or company...' : 'Search by SKU or product name...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
      </div>

      {/* Table Container */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-zinc-400">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">Loading product catalog...</span>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-zinc-500">
            <PackageSearch className="w-8 h-8 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">Could not load catalog</p>
            <p className="text-xs text-zinc-600 max-w-xs text-center">{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 gap-3 text-zinc-500">
            <PackageSearch className="w-8 h-8 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">
              {searchTerm
                ? 'No products match your search'
                : isSuperAdmin
                  ? 'No client products registered yet.'
                  : 'No products in your catalog yet'}
            </p>
            {!searchTerm && (
              <p className="text-xs text-zinc-600">
                {isSuperAdmin
                  ? 'Products are created by client accounts or by you on their behalf.'
                  : 'Click "Add Product" to register your first SKU.'}
              </p>
            )}
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && filteredProducts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold text-xs">
                  <th className="p-4 pl-6">SKU</th>
                  <th className="p-4">Product Name</th>
                  {/* Client Owner column — only visible to SUPER_ADMIN */}
                  {isSuperAdmin && (
                    <th className="p-4">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Client Owner
                      </span>
                    </th>
                  )}
                  <th className="p-4">Category</th>
                  <th className="p-4">Weight</th>
                  <th className="p-4">Dimensions</th>
                  <th className="p-4">Attributes</th>
                  <th className="p-4 pr-6 text-right">Active Inventory</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300 text-xs divide-y divide-zinc-800/60">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-zinc-900/40 transition-all">
                    <td className="p-4 pl-6 font-mono text-zinc-400">{product.sku}</td>
                    <td className="p-4 font-semibold text-zinc-100">{product.name}</td>
                    {/* Client Owner — SUPER_ADMIN only */}
                    {isSuperAdmin && (
                      <td className="p-4">
                        {product.company ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-violet-950/50 border border-violet-900/60 text-violet-300">
                            <Building2 className="w-3 h-3" />
                            {product.company.name}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-zinc-400">{product.category}</td>
                    <td className="p-4">{product.weight} kg</td>
                    <td className="p-4 text-zinc-400">{product.dimensions || '—'}</td>
                    <td className="p-4">
                      <div className="flex gap-1.5 items-center flex-wrap">
                        {product.isHazardous && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/50 border border-red-900/60 text-[10px] text-red-400 font-semibold">
                            <AlertOctagon className="w-3 h-3" />
                            Hazardous
                          </span>
                        )}
                        {product.isTemperatureSensitive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/50 border border-blue-900/60 text-[10px] text-blue-400 font-semibold">
                            <Snowflake className="w-3 h-3" />
                            Cold Storage
                          </span>
                        )}
                        {!product.isHazardous && !product.isTemperatureSensitive && (
                          <span className="text-zinc-600 text-[10px]">Standard</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right font-bold text-indigo-400">
                      {product._count?.inventories ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-100">Register New Product</h3>

            {submitError && (
              <div className="p-3 bg-red-950/20 border border-red-900/60 text-red-400 rounded-xl text-xs font-medium">
                {submitError}
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4">
              {/* SUPER_ADMIN must pick a company */}
              {isSuperAdmin && (
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1.5">
                    <Building2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Client Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newProduct.companyId}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, companyId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Select the owning company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1.5">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="e.g. SAM-S24-ULTRA"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1.5">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Power Sources">Power Sources</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Pharma">Pharma</option>
                    <option value="FMCG">FMCG</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1.5">Product Name</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Samsung Galaxy S24 Ultra"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1.5">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newProduct.weight}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="0.250"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1.5">Dimensions</label>
                  <input
                    type="text"
                    value={newProduct.dimensions}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, dimensions: e.target.value }))}
                    placeholder="e.g. 15 × 8 × 1 cm"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProduct.isHazardous}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, isHazardous: e.target.checked }))}
                    className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Hazardous Material</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProduct.isTemperatureSensitive}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, isTemperatureSensitive: e.target.checked }))}
                    className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-xs text-zinc-400">Requires Cold Storage</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setSubmitError(''); }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
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
