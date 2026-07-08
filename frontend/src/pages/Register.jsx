import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Shield, Building2, Loader2, CheckCircle2 } from 'lucide-react';

const ROLES = [
  { value: 'CLIENT', label: 'Client', description: 'Manage your own inventory & billing' },
  { value: 'WAREHOUSE_STAFF', label: 'Warehouse Staff', description: 'Handle physical storage & dispatch' },
  { value: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager', description: 'Approve requests & oversee operations' },
  { value: 'SUPER_ADMIN', label: 'Super Administrator', description: 'Full platform access & configuration' },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    companyId: '',
  });
  const [companies, setCompanies] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch companies list when CLIENT role is selected
  useEffect(() => {
    if (form.role !== 'CLIENT') {
      setCompanies([]);
      setForm(prev => ({ ...prev, companyId: '' }));
      return;
    }

    const loadCompanies = async () => {
      setIsLoadingCompanies(true);
      try {
        const res = await fetch('http://localhost:3000/api/companies');
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.data || []);
        }
      } catch (err) {
        console.error('Could not fetch companies:', err);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    loadCompanies();
  }, [form.role]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.password || !form.role) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (form.role === 'CLIENT' && !form.companyId) {
      setError('Please select the company you belong to.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.role === 'CLIENT') payload.companyId = form.companyId;

      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-indigo-600 items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/30 mb-4">
            W
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create an account</h1>
          <p className="text-sm text-zinc-400 mt-1.5">Join WareMind AI — your 3PL operations hub</p>
        </div>

        {/* Success State */}
        {success && (
          <div className="flex flex-col items-center gap-3 p-6 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-emerald-300 font-semibold text-sm">Account created successfully!</p>
            <p className="text-xs text-zinc-500">Redirecting you to the login page...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-950/30 border border-red-900/60 text-red-400 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="reg-name">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="reg-email">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="reg-password">
                Password <span className="text-zinc-600 normal-case font-normal">(min. 8 characters)</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                <Shield className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => handleChange('role', r.value)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      form.role === r.value
                        ? 'bg-indigo-950/60 border-indigo-600 shadow-inner'
                        : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`text-xs font-semibold ${form.role === r.value ? 'text-indigo-300' : 'text-zinc-300'}`}>
                      {r.label}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{r.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Company Dropdown — only for CLIENT role */}
            {form.role === 'CLIENT' && (
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="reg-company">
                  <Building2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Associated Company
                </label>
                {isLoadingCompanies ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading companies...
                  </div>
                ) : (
                  <select
                    id="reg-company"
                    required
                    value={form.companyId}
                    onChange={(e) => handleChange('companyId', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  >
                    <option value="" disabled>Select your company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    {companies.length === 0 && (
                      <option value="" disabled>No companies found — contact your admin</option>
                    )}
                  </select>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Login Link */}
        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
