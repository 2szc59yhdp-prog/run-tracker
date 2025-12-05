import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Award, Hash, User, MapPin, Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getUserByServiceNumber } from '../services/api';
import type { RegisteredUser } from '../types';

interface OutstandingEntry {
  id: string;
  serviceNumber: string;
  name: string;
  station?: string;
  reason: string;
  addedByServiceNumber: string;
  date: string;
}

export default function Outstanding() {
  const navigate = useNavigate();
  const { isAdmin } = useApp();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchSN, setSearchSN] = useState('');
  const [foundUser, setFoundUser] = useState<RegisteredUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [list, setList] = useState<OutstandingEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', reason: '', addedByServiceNumber: '' });

  useEffect(() => {
    if (!isAdmin) navigate('/admin-login');
  }, [isAdmin, navigate]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('outstandings') || '[]');
      setList(Array.isArray(stored) ? stored : []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const openAdd = () => {
    setShowAddModal(true);
    setSearchSN('');
    setFoundUser(null);
    setForm({ name: '', reason: '', addedByServiceNumber: '' });
    setErrors({});
  };

  const closeModal = () => {
    setShowAddModal(false);
  };

  const handleSearch = async () => {
    if (!searchSN.trim()) {
      setFoundUser(null);
      return;
    }
    setLoadingUser(true);
    try {
      const res = await getUserByServiceNumber(searchSN.trim());
      if (res.success) {
        setFoundUser(res.data || null);
        if (res.data) setForm((f) => ({ ...f, name: res.data!.name }));
      }
    } finally {
      setLoadingUser(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!searchSN.trim()) errs.serviceNumber = 'Service number is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.reason.trim()) errs.reason = 'Reason is required';
    if (!form.addedByServiceNumber.trim()) errs.addedByServiceNumber = 'Your service number is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const entry: OutstandingEntry = {
      id: crypto.randomUUID(),
      serviceNumber: searchSN.trim(),
      name: form.name.trim(),
      station: foundUser?.station,
      reason: form.reason.trim(),
      addedByServiceNumber: form.addedByServiceNumber.trim(),
      date: new Date().toISOString(),
    };

    const next = [entry, ...list];
    setList(next);
    localStorage.setItem('outstandings', JSON.stringify(next));
    setMessage({ type: 'success', text: 'Outstanding added' });
    setShowAddModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-700/50 text-warning-400"><Award className="w-6 h-6" /></div>
        <h1 className="font-display text-3xl font-bold text-white">Outstanding</h1>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mb-6 ${message.type === 'success' ? 'bg-success-500/10 border border-success-500/30' : 'bg-danger-500/10 border border-danger-500/30'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-success-500" /> : <AlertCircle className="w-5 h-5 text-danger-500" />}
          <span className={message.type === 'success' ? 'text-success-500' : 'text-danger-500'}>{message.text}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>Add Outstanding</Button>
      </div>

      <Card className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary-700">
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Service #</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Name</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Station</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Reason</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Added By</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Date</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-primary-400" colSpan={6}>No outstanding entries yet</td>
                </tr>
              ) : (
                list.map((o) => (
                  <tr key={o.id} className="border-b border-primary-700/50 hover:bg-primary-700/30 transition-colors">
                    <td className="py-3 px-4 text-accent-400 font-mono font-semibold">{o.serviceNumber}</td>
                    <td className="py-3 px-4 text-white font-medium">{o.name}</td>
                    <td className="py-3 px-4 text-primary-300">{o.station || '-'}</td>
                    <td className="py-3 px-4 text-primary-300">{o.reason}</td>
                    <td className="py-3 px-4 text-primary-300">#{o.addedByServiceNumber}</td>
                    <td className="py-3 px-4 text-primary-300">{new Date(o.date).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <Card className="w-full max-w-[600px] md:max-w-[720px] my-8 relative z-[10000] !overflow-visible">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add Outstanding</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <Input label="Service Number" value={searchSN} onChange={(e) => setSearchSN(e.target.value)} placeholder="e.g., 5568 or C1234" icon={<Hash className="w-4 h-4" />} error={errors.serviceNumber} />
                <Button type="button" onClick={handleSearch} className="sm:col-span-1">Search</Button>
              </div>
              {loadingUser && <p className="text-primary-400 text-sm">Searching...</p>}
              {foundUser && (
                <div className="rounded-xl border border-primary-700/50 p-3 bg-primary-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-primary-500" />
                    <span className="text-white font-medium">{foundUser.name}</span>
                    <span className="text-primary-500 text-xs">#{foundUser.serviceNumber}</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary-300">
                    <MapPin className="w-4 h-4" />
                    <span>{foundUser.station}</span>
                  </div>
                </div>
              )}
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} icon={<User className="w-4 h-4" />} required error={errors.name} />
              <Input label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required error={errors.reason} />
              <Input label="Your Service Number" value={form.addedByServiceNumber} onChange={(e) => setForm({ ...form, addedByServiceNumber: e.target.value })} icon={<Hash className="w-4 h-4" />} required error={errors.addedByServiceNumber} />
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="secondary" onClick={closeModal} className="flex-1">Cancel</Button>
                <Button type="submit" className="flex-1">Save</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

