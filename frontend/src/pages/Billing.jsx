import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { CreditCard, CheckCircle, Clock, WifiOff, Loader2 } from 'lucide-react';

export default function Billing() {
  const { user, apiFetch } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [payingId, setPayingId] = useState(null);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setIsOffline(false);
    try {
      const res = await apiFetch('/api/billing/invoices');
      if (res.ok) {
        const result = await res.json();
        setInvoices(result.data || []);
      } else {
        setIsOffline(true);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handlePayInvoice = async (id) => {
    setPayingId(id);
    try {
      const res = await apiFetch(`/api/billing/invoices/${id}/pay`, {
        method: 'PUT',
      });
      if (res.ok) {
        // Success -> refresh
        await fetchInvoices();
      } else {
        alert('Failed to pay invoice. Server returned an error.');
      }
    } catch (err) {
      console.error('Error paying invoice:', err);
      alert('Failed to process payment. Backend server is offline.');
    } finally {
      setPayingId(null);
    }
  };

  const getMonthName = (m) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[m - 1] || 'Unknown';
  };

  const outstanding = invoices
    .filter(inv => inv.status === 'UNPAID')
    .reduce((acc, inv) => acc + inv.totalAmount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="p-4 bg-red-950/40 border border-red-900 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold">
          <WifiOff className="w-5 h-5 shrink-0" />
          <div>
            <span>Backend Server Offline:</span>
            <p className="font-normal text-zinc-400 mt-0.5">
              Cannot fetch billing statements. Showing cached static history.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Billing & Invoices</h1>
          <p className="text-xs text-zinc-400 mt-1">Review storage fees, handling charges, and payment histories</p>
        </div>
      </div>

      {/* Top billing stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold text-zinc-500 uppercase">Billing Plan</div>
          <div className="text-xl font-bold text-gray-200 mt-2">
            {user.company?.billingPlan ? `${user.company.billingPlan} Plan` : 'Basic Plan'}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Base rate: $20.0 per stored pallet</p>
        </div>

        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold text-zinc-500 uppercase">Outstanding Balance</div>
          <div className="text-xl font-bold text-red-400 mt-2">${outstanding.toLocaleString()}</div>
          <p className="text-xs text-zinc-500 mt-1">Due immediately</p>
        </div>

        <div className="bg-[#18181b]/40 border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold text-zinc-500 uppercase">Tenant Priority Tier</div>
          <div className="text-xl font-bold text-indigo-400 mt-2">
            {user.company?.priority ? `${user.company.priority} Priority` : 'Normal Priority'}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Guaranteed SLA dispatch response</p>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-[#18181b]/20 border border-[#27272a] rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-zinc-200">Invoice History</h3>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Loading ledger invoices...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 font-semibold text-xs">
                  <th className="p-4 pl-6">Invoice ID</th>
                  <th className="p-4">Billing Period</th>
                  <th className="p-4">Storage Charges</th>
                  <th className="p-4">Handling Charges</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300 text-xs divide-y divide-zinc-800/80">
                {invoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="p-4 pl-6 font-mono text-zinc-400 uppercase">{invoice.id.substring(0, 8)}...</td>
                    <td className="p-4 font-semibold text-zinc-200">
                      {getMonthName(invoice.month)} {invoice.year}
                    </td>
                    <td className="p-4">${invoice.storageCharges.toLocaleString()}</td>
                    <td className="p-4">${invoice.handlingCharges.toLocaleString()}</td>
                    <td className="p-4 font-bold text-zinc-100">${invoice.totalAmount.toLocaleString()}</td>
                    <td className="p-4">
                      {invoice.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-900 text-[10px] text-emerald-400 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-900 text-[10px] text-amber-400 font-semibold animate-pulse">
                          <Clock className="w-3.5 h-3.5" />
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {invoice.status === 'UNPAID' ? (
                        <button
                          onClick={() => handlePayInvoice(invoice.id)}
                          disabled={payingId === invoice.id}
                          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/10 transition-all"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {payingId === invoice.id ? 'Processing...' : 'Pay Now'}
                        </button>
                      ) : (
                        <span className="text-zinc-500 font-semibold text-xs mr-3">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-zinc-500 font-semibold">
                      No invoices on file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
