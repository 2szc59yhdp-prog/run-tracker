import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Building2, HandCoins, Plus, X, Wallet, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fetchSponsors, fetchFundUsages, addSponsorApi, addFundUsageApi, type Sponsor as SponsorApi, type FundUsageEntry } from '../services/api';

interface Sponsor {
  id: string;
  businessName: string;
  details?: string;
  amountSponsored: number;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface FundUsage {
  id: string;
  purpose: string;
  amountUsed: number;
  serviceNumber: string;
  sponsorId?: string;
  date: string;
}

export default function Sponsors() {
  const { adminToken, isAdmin } = useApp();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [fundUsages, setFundUsages] = useState<FundUsage[]>([]);
  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [showUseFunds, setShowUseFunds] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [sponsorForm, setSponsorForm] = useState<Partial<Sponsor>>({});
  const [fundForm, setFundForm] = useState<Partial<FundUsage>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetchSponsors();
      if (s.success && s.data) setSponsors(s.data as SponsorApi[] as Sponsor[]);
      const f = await fetchFundUsages();
      if (f.success && f.data) setFundUsages(f.data as FundUsageEntry[] as FundUsage[]);
    })();
  }, []);

  const totalSponsors = sponsors.length;
  const totalSponsoredAmount = useMemo(() => sponsors.reduce((sum, s) => sum + (s.amountSponsored || 0), 0), [sponsors]);
  const totalUsed = useMemo(() => fundUsages.reduce((sum, u) => sum + (u.amountUsed || 0), 0), [fundUsages]);
  const balance = Math.max(0, totalSponsoredAmount - totalUsed);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const openAddSponsor = () => {
    setSponsorForm({});
    setErrors({});
    setShowAddSponsor(true);
  };

  const openUseFunds = () => {
    setFundForm({});
    setErrors({});
    setShowUseFunds(true);
  };

  const closeModals = () => {
    setShowAddSponsor(false);
    setShowUseFunds(false);
    setDropdownOpen(false);
  };

  const validateEmail = (email?: string) => {
    if (!email) return true;
    return /.+@.+\..+/.test(email);
  };

  const handleSaveSponsor = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!sponsorForm.businessName?.trim()) errs.businessName = 'Business name is required';
    if (sponsorForm.amountSponsored == null || isNaN(Number(sponsorForm.amountSponsored))) errs.amountSponsored = 'Amount is required';
    if (!sponsorForm.contactName?.trim()) errs.contactName = 'Contact name is required';
    if (!validateEmail(sponsorForm.contactEmail)) errs.contactEmail = 'Invalid email';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const newSponsor: Sponsor = {
      id: crypto.randomUUID(),
      businessName: sponsorForm.businessName!.trim(),
      details: sponsorForm.details?.trim() || undefined,
      amountSponsored: Number(sponsorForm.amountSponsored),
      contactName: sponsorForm.contactName!.trim(),
      contactPhone: sponsorForm.contactPhone?.trim() || undefined,
      contactEmail: sponsorForm.contactEmail?.trim() || undefined,
    };

    if (!adminToken || !isAdmin) {
      setMessage({ type: 'error', text: 'Admin session required' });
      return;
    }
    addSponsorApi({
      businessName: newSponsor.businessName,
      details: newSponsor.details,
      amountSponsored: newSponsor.amountSponsored,
      contactName: newSponsor.contactName,
      contactPhone: newSponsor.contactPhone,
      contactEmail: newSponsor.contactEmail,
    }, adminToken).then(async (res) => {
      if (res.success) {
        const s = await fetchSponsors();
        if (s.success && s.data) setSponsors(s.data as SponsorApi[] as Sponsor[]);
        setMessage({ type: 'success', text: 'Sponsor added' });
        setShowAddSponsor(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add sponsor' });
      }
    });
  };

  const handleSaveUsage = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fundForm.purpose?.trim()) errs.purpose = 'Purpose is required';
    if (fundForm.amountUsed == null || isNaN(Number(fundForm.amountUsed))) errs.amountUsed = 'Amount is required';
    if (!fundForm.serviceNumber?.trim()) errs.serviceNumber = 'Service number is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const newUsage: FundUsage = {
      id: crypto.randomUUID(),
      purpose: fundForm.purpose!.trim(),
      amountUsed: Number(fundForm.amountUsed),
      serviceNumber: fundForm.serviceNumber!.trim(),
      sponsorId: fundForm.sponsorId || undefined,
      date: new Date().toISOString(),
    };

    if (!adminToken || !isAdmin) {
      setMessage({ type: 'error', text: 'Admin session required' });
      return;
    }
    addFundUsageApi({
      purpose: newUsage.purpose,
      amountUsed: newUsage.amountUsed,
      serviceNumber: newUsage.serviceNumber,
      sponsorId: newUsage.sponsorId,
    }, adminToken).then(async (res) => {
      if (res.success) {
        const f = await fetchFundUsages();
        if (f.success && f.data) setFundUsages(f.data as FundUsageEntry[] as FundUsage[]);
        setMessage({ type: 'success', text: 'Usage recorded' });
        setShowUseFunds(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to record usage' });
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-700/50 text-accent-400"><HandCoins className="w-6 h-6" /></div>
        <h1 className="font-display text-3xl font-bold text-white">Sponsors</h1>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mb-6 ${message.type === 'success' ? 'bg-success-500/10 border border-success-500/30' : 'bg-danger-500/10 border border-danger-500/30'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-success-500" /> : <AlertCircle className="w-5 h-5 text-danger-500" />}
          <span className={message.type === 'success' ? 'text-success-500' : 'text-danger-500'}>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-700/50 text-accent-400"><Building2 className="w-5 h-5" /></div>
          <div>
            <p className="text-primary-400 text-sm font-medium">Total Sponsors</p>
            <p className="text-2xl font-display font-bold text-white">{totalSponsors}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-700/50 text-success-400"><HandCoins className="w-5 h-5" /></div>
          <div>
            <p className="text-primary-400 text-sm font-medium">Total Sponsored Amount</p>
            <p className="text-2xl font-display font-bold text-white">{totalSponsoredAmount.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-700/50 text-warning-400"><Wallet className="w-5 h-5" /></div>
          <div>
            <p className="text-primary-400 text-sm font-medium">Balance</p>
            <p className="text-2xl font-display font-bold text-white">{balance.toLocaleString()}</p>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Button onClick={openAddSponsor} icon={<Plus className="w-4 h-4" />}>Add Sponsor</Button>
        <Button variant="secondary" onClick={openUseFunds}>Use Funds</Button>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary-700/50 text-accent-400"><Building2 className="w-5 h-5" /></div>
        <h2 className="font-display text-xl font-bold text-white">Sponsors List</h2>
      </div>
      <Card className="mb-8">
        <div className="overflow-x-auto min-h-[140px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary-700">
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Business Name</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Details</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Amount Sponsored</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Contact Name</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Contact</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Email</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-primary-400" colSpan={6}>No sponsors added yet</td>
                </tr>
              ) : (
                sponsors.map((s) => (
                  <tr key={s.id} className="border-b border-primary-700/50 hover:bg-primary-700/30 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{s.businessName}</td>
                    <td className="py-3 px-4 text-primary-300">{s.details || '-'}</td>
                    <td className="py-3 px-4 text-accent-400 font-semibold">{s.amountSponsored.toLocaleString()}</td>
                    <td className="py-3 px-4 text-primary-300">{s.contactName}</td>
                    <td className="py-3 px-4 text-primary-300">{s.contactPhone || '-'}</td>
                    <td className="py-3 px-4 text-primary-300">{s.contactEmail || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary-700/50 text-warning-400"><Wallet className="w-5 h-5" /></div>
        <h2 className="font-display text-xl font-bold text-white">Fund Usage</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-700/50 text-danger-400"><Wallet className="w-5 h-5" /></div>
          <div>
            <p className="text-primary-400 text-sm font-medium">Total Used</p>
            <p className="text-2xl font-display font-bold text-white">{totalUsed.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-700/50 text-primary-400"><HandCoins className="w-5 h-5" /></div>
          <div>
            <p className="text-primary-400 text-sm font-medium">Usage Entries</p>
            <p className="text-2xl font-display font-bold text-white">{fundUsages.length}</p>
          </div>
        </Card>
      </div>
      <Card className="mb-8">
        <div className="overflow-x-auto min-h-[160px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary-700">
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Date</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Purpose</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Amount Used</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Requesting Officer</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Sponsor</th>
              </tr>
            </thead>
            <tbody>
              {fundUsages.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-primary-400" colSpan={5}>No fund usage recorded yet</td>
                </tr>
              ) : (
                fundUsages.map(u => (
                  <tr key={u.id} className="border-b border-primary-700/50 hover:bg-primary-700/30 transition-colors">
                    <td className="py-3 px-4 text-primary-300">{new Date(u.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-white font-medium">{u.purpose}</td>
                    <td className="py-3 px-4 text-danger-400 font-semibold">{u.amountUsed.toLocaleString()}</td>
                    <td className="py-3 px-4 text-primary-300">#{u.serviceNumber}</td>
                    <td className="py-3 px-4 text-primary-300">{u.sponsorId ? (sponsors.find(s => s.id === u.sponsorId)?.businessName || '-') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showAddSponsor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <Card className="w-full max-w-[600px] md:max-w-[720px] my-8 relative z-[10000] !overflow-visible">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add Sponsor</h2>
              <button onClick={closeModals} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSaveSponsor} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <Input label="Business Name" value={sponsorForm.businessName || ''} onChange={(e) => setSponsorForm({ ...sponsorForm, businessName: e.target.value })} required error={errors.businessName} />
              <Input label="Details" value={sponsorForm.details || ''} onChange={(e) => setSponsorForm({ ...sponsorForm, details: e.target.value })} />
              <Input label="Amount Sponsored" type="number" inputMode="numeric" value={sponsorForm.amountSponsored as any || ''} onChange={(e) => setSponsorForm({ ...sponsorForm, amountSponsored: Number(e.target.value) })} required error={errors.amountSponsored} />
              <Input label="Contact Name" value={sponsorForm.contactName || ''} onChange={(e) => setSponsorForm({ ...sponsorForm, contactName: e.target.value })} required error={errors.contactName} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Contact" value={sponsorForm.contactPhone || ''} onChange={(e) => setSponsorForm({ ...sponsorForm, contactPhone: e.target.value })} />
                <Input label="Email Address" type="email" value={sponsorForm.contactEmail || ''} onChange={(e) => setSponsorForm({ ...sponsorForm, contactEmail: e.target.value })} error={errors.contactEmail} />
              </div>
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="secondary" onClick={closeModals} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Save</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showUseFunds && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <Card className="w-full max-w-[600px] md:max-w-[720px] my-8 relative z-[10000] !overflow-visible">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Use Funds</h2>
              <button onClick={closeModals} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSaveUsage} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <Input label="Purpose" value={fundForm.purpose || ''} onChange={(e) => setFundForm({ ...fundForm, purpose: e.target.value })} required error={errors.purpose} />
              <Input label="Amount Used" type="number" inputMode="numeric" value={fundForm.amountUsed as any || ''} onChange={(e) => setFundForm({ ...fundForm, amountUsed: Number(e.target.value) })} required error={errors.amountUsed} />
              <Input label="Requesting Officer Service Number" value={fundForm.serviceNumber || ''} onChange={(e) => setFundForm({ ...fundForm, serviceNumber: e.target.value })} required error={errors.serviceNumber} />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-primary-200">Select Sponsor (optional)</label>
                <div className="relative">
                  <button type="button" onClick={() => setDropdownOpen(v => !v)} className="w-full px-4 py-3 bg-primary-800/50 border border-primary-700 rounded-xl text-white outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500 transition-all duration-200 pl-12 pr-10 cursor-pointer text-left flex items-center justify-between">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400"><Building2 className="w-4 h-4" /></div>
                    <span className={fundForm.sponsorId ? 'text-white' : 'text-primary-400'}>{fundForm.sponsorId ? sponsors.find(s => s.id === fundForm.sponsorId)?.businessName : 'Select a sponsor (optional)'}</span>
                    <ChevronDown className={`w-4 h-4 text-primary-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-50 w-full bg-primary-800 border border-primary-700 rounded-xl shadow-xl overflow-hidden top-full mt-2 max-h-60 overflow-y-auto py-2">
                      <button onClick={() => { setFundForm({ ...fundForm, sponsorId: undefined }); setDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-primary-300 hover:bg-primary-700/50">None</button>
                      {sponsors.map(s => (
                        <button key={s.id} onClick={() => { setFundForm({ ...fundForm, sponsorId: s.id }); setDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-white hover:bg-primary-700/50">
                          {s.businessName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="secondary" onClick={closeModals} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Save</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
