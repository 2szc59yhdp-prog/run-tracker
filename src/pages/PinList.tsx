import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { fetchAllUsersWithPins, updateUserPin, sendPinEmails } from '../services/api';
import { useApp } from '../context/AppContext';
import type { RegisteredUser } from '../types';

function generatePin(user: RegisteredUser): string {
  const base = `${user.serviceNumber}|${user.email || ''}|pins-v1`;
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (h * 31 + base.charCodeAt(i)) >>> 0;
  }
  const n = (h % 9000) + 1000;
  return n.toString();
}

export default function PinList() {
  const { isAdmin, adminToken, adminUser } = useApp();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignedCount, setAssignedCount] = useState(0);
  const [assignTotal, setAssignTotal] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendInfo, setSendInfo] = useState<string | null>(null);

  const isSuperAdmin = !!(isAdmin && adminToken && (adminUser?.serviceNumber?.toString().trim() === '5568'));

  useEffect(() => {
    if (!isSuperAdmin) {
      setError('Unauthorized');
      setLoading(false);
      return;
    }
    fetchAllUsersWithPins(adminToken!, adminUser!.serviceNumber).then((res) => {
      if (res.success && res.data) {
        setUsers(res.data);
        setError(null);
      } else {
        setError(res.error || 'Failed to fetch users');
      }
      setLoading(false);
    }).catch(() => {
      setError('Failed to fetch users');
      setLoading(false);
    });
  }, [isSuperAdmin, adminToken, adminUser]);

  const participants = useMemo(() => {
    return users.filter(u => u.station && u.station !== 'General Admin');
  }, [users]);

  const rows = useMemo(() => {
    return participants.map(u => ({
      name: u.name,
      serviceNumber: u.serviceNumber,
      station: u.station,
      email: (u.email || '').trim(),
      pin: (u.pin && u.pin.trim()) || generatePin(u),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants]);

  const assignPins = async () => {
    if (!isSuperAdmin) {
      setError('Unauthorized');
      return;
    }
    setAssigning(true);
    setAssignedCount(0);
    setAssignTotal(participants.length);
    try {
      for (const u of participants) {
        const existing = (u.pin || '').trim();
        const pin = generatePin(u);
        const needsAssign = !existing || existing.length !== 4 || existing.startsWith('0');
        if (needsAssign || existing !== pin) {
          try {
            await Promise.race([
              updateUserPin(u.id, pin, adminToken!, adminUser!.serviceNumber),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
            ]);
          } catch {
          }
        }
        setAssignedCount((c) => c + 1);
      }
      let refreshed;
      try {
        refreshed = await Promise.race([
          fetchAllUsersWithPins(adminToken!, adminUser!.serviceNumber),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ]);
      } catch {
        refreshed = null as any;
      }
      if (refreshed.success && refreshed.data) {
        setUsers(refreshed.data);
      }
    } finally {
      setAssigning(false);
    }
  };

  const sendPins = async () => {
    if (!isSuperAdmin) {
      setError('Unauthorized');
      return;
    }
    setSending(true);
    setSendInfo(null);
    try {
      const res = await sendPinEmails(adminToken!, adminUser!.serviceNumber);
      if (res && res.success && res.data) {
        const d = res.data;
        const parts = [`Sent: ${d.sent}`, `Skipped: ${d.skipped}`];
        if (typeof d.autoAssigned === 'number') parts.push(`Auto-assigned PINs: ${d.autoAssigned}`);
        if (typeof d.missingEmail === 'number') parts.push(`Missing emails: ${d.missingEmail}`);
        if (typeof d.excludedAdmin === 'number') parts.push(`Excluded admin: ${d.excludedAdmin}`);
        setSendInfo(parts.join(', '));
        const failedCount = (d.failed?.length ?? 0);
        if (failedCount > 0) {
          const top = (d.failed ?? []).slice(0, 5).map(f => `${f.email} (${f.serviceNumber})`).join(', ');
          setSendInfo(prev => `${prev}. Failures: ${failedCount}${top ? ` — e.g., ${top}` : ''}`);
        }
      } else {
        setError(res?.error || 'Failed to send PIN emails');
      }
    } finally {
      setSending(false);
    }
  };

  const exportCsv = () => {
    const header = 'Name,Service Number,Station,Email,PIN';
    const lines = rows.map(r => `${JSON.stringify(r.name)},${JSON.stringify(r.serviceNumber)},${JSON.stringify(r.station)},${JSON.stringify(r.email)},${JSON.stringify(r.pin)}`);
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participant_pins.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Participant PINs</h1>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Button onClick={assignPins} disabled={assigning || sending}>{assigning ? `Assigning… (${assignedCount}/${assignTotal})` : 'Assign Pins'}</Button>
            <Button onClick={sendPins} disabled={assigning || sending}>{sending ? 'Sending…' : 'Send PINs'}</Button>
            <Button onClick={exportCsv} className="hidden sm:inline-flex">Export CSV</Button>
          </div>
        )}
      </div>
      <Card>
        {loading && <p className="text-primary-300">Loading...</p>}
        {error && !loading && <p className="text-danger-500">{error}</p>}
        {!error && sendInfo && <p className="text-success-500">{sendInfo}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[14%]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="text-primary-200">
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-center px-3 py-2">Service #</th>
                  <th className="text-left px-3 py-2">Station</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-center px-3 py-2">PIN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.serviceNumber} className="border-t border-primary-700/50">
                    <td className="px-3 py-2 text-white">{r.name}</td>
                    <td className="px-3 py-2 text-primary-100 text-center">{r.serviceNumber}</td>
                    <td className="px-3 py-2 text-primary-100">{r.station}</td>
                    <td className="px-3 py-2 text-primary-100 truncate">{r.email || '-'}</td>
                    <td className="px-3 py-2 text-accent-300 text-center font-mono">{r.pin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
