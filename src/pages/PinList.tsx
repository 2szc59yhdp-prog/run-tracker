import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { fetchAllUsersWithPins, sendPinEmailsList, getEmailQuota, getPinEmailQueueStatus } from '../services/api';
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
  const [sending, setSending] = useState(false);
  const [sendInfo, setSendInfo] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<{
    sent: Array<{ email: string; name: string; sentAt?: string }>;
    failed: Array<{ email: string; name: string; error?: string }>;
    pending: Array<{ email: string; name: string }>;
    counts?: { sent: number; failed: number; pending: number };
    remaining?: number;
  } | null>(null);

  const sn = (adminUser?.serviceNumber?.toString().trim() || '');
  const isPinsAdmin = !!(isAdmin && adminToken && (['5568', '4059', '6149'].includes(sn)));
  const isSenderAdmin = sn === '5568';

  useEffect(() => {
    if (!isPinsAdmin) {
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
  }, [isPinsAdmin, adminToken, adminUser]);

  useEffect(() => {
    if (!isPinsAdmin) return;
    let timer: number | undefined;
    const fetchQueue = async () => {
      const res = await getPinEmailQueueStatus(adminToken!, adminUser!.serviceNumber);
      if (res.success && res.data) {
        setQueueStatus(res.data);
      }
    };
    fetchQueue();
    timer = window.setInterval(fetchQueue, 15000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isPinsAdmin, adminToken, adminUser]);

  const participants = useMemo(() => {
    return users.filter(u => u.station && u.station !== 'General Admin');
  }, [users]);

  const rows = useMemo(() => {
    return participants.map(u => ({
      name: u.name,
      serviceNumber: u.serviceNumber,
      station: u.station,
      phone: (u.phone || '').trim(),
      email: (u.email || '').trim(),
      pin: (u.pin && u.pin.trim()) || generatePin(u),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants]);

  const sendPins = async () => {
    if (!isSenderAdmin) {
      setError('Unauthorized');
      return;
    }
    setSending(true);
    setSendInfo(null);
    try {
      const entries = rows.map(r => ({ name: r.name, serviceNumber: r.serviceNumber, station: r.station, email: r.email || '', pin: r.pin }));
      const res = await sendPinEmailsList(entries, adminToken!, adminUser!.serviceNumber);
      if (res && res.success && res.data) {
        const quota = await getEmailQuota(adminToken!);
        const remaining = quota.success && quota.data ? quota.data.remaining : undefined;
        const parts = [`Queued: ${entries.length}`];
        if (typeof remaining === 'number') parts.push(`Remaining daily quota: ${remaining}`);
        setSendInfo(parts.join(', '));
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

  const exportWhatsappCsv = () => {
    const header = 'Name,Phone,Message,Link';
    const lines = rows.map(r => {
      const phone = r.phone || '';
      const msg = `Hi ${r.name}, your PIN is ${r.pin}. Station: ${r.station}. Login: https://run.huvadhoofulusclub.events/participant-login`;
      const enc = encodeURIComponent(msg);
      const link = phone ? `https://wa.me/${phone}?text=${enc}` : `https://wa.me/?text=${enc}`;
      return `${JSON.stringify(r.name)},${JSON.stringify(phone)},${JSON.stringify(msg)},${JSON.stringify(link)}`;
    });
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_messages.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white">Participant PINs</h1>
        {isSenderAdmin && (
          <div className="flex items-center gap-2">
            <Button onClick={sendPins} disabled={sending}>{sending ? 'Sending…' : 'Send PINs'}</Button>
          </div>
        )}
        {isPinsAdmin && (
          <div className="flex items-center gap-2">
            <Button onClick={exportCsv} className="hidden sm:inline-flex">Export CSV</Button>
            <Button onClick={exportWhatsappCsv} className="hidden sm:inline-flex">Export WhatsApp CSV</Button>
          </div>
        )}
      </div>
      <Card>
        {loading && <p className="text-primary-300">Loading...</p>}
        {error && !loading && <p className="text-danger-500">{error}</p>}
        {!error && sendInfo && <p className="text-success-500">{sendInfo}</p>}
        {!error && queueStatus && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <h2 className="text-primary-200 font-semibold mb-2">Sent</h2>
              <div className="space-y-1 max-h-56 overflow-auto pr-2">
                {queueStatus.sent.length === 0 && <p className="text-primary-400">None</p>}
                {queueStatus.sent.map((e, idx) => (
                  <div key={`sent-${idx}`} className="text-success-500 text-sm">{e.email}</div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-primary-200 font-semibold mb-2">Failed</h2>
              <div className="space-y-1 max-h-56 overflow-auto pr-2">
                {queueStatus.failed.length === 0 && <p className="text-primary-400">None</p>}
                {queueStatus.failed.map((e, idx) => (
                  <div key={`failed-${idx}`} className="text-danger-500 text-sm">{e.email}</div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-primary-200 font-semibold mb-2">Pending</h2>
              <div className="space-y-1 max-h-56 overflow-auto pr-2">
                {queueStatus.pending.length === 0 && <p className="text-primary-400">None</p>}
                {queueStatus.pending.map((e, idx) => (
                  <div key={`pending-${idx}`} className="text-primary-300 text-sm">{e.email}</div>
                ))}
              </div>
            </div>
          </div>
        )}
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
