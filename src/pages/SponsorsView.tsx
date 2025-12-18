import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import { Building2, HandCoins, Wallet, ArrowLeft } from 'lucide-react';
import { fetchSponsors, fetchFundUsages, type Sponsor as SponsorApi, type FundUsageEntry } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

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

export default function SponsorsView() {
  const navigate = useNavigate();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [fundUsages, setFundUsages] = useState<FundUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, f] = await Promise.all([
          fetchSponsors(),
          fetchFundUsages()
        ]);
        if (s.success && s.data) setSponsors(s.data as SponsorApi[] as Sponsor[]);
        if (f.success && f.data) setFundUsages(f.data as FundUsageEntry[] as FundUsage[]);
      } catch (error) {
        console.error('Failed to load sponsor data', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const totalSponsors = sponsors.length;
  const totalSponsoredAmount = useMemo(() => sponsors.reduce((sum, s) => sum + (s.amountSponsored || 0), 0), [sponsors]);
  const totalUsed = useMemo(() => fundUsages.reduce((sum, u) => sum + (u.amountUsed || 0), 0), [fundUsages]);
  const balance = Math.max(0, totalSponsoredAmount - totalUsed);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-primary-400">
        Loading sponsorship data...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
         <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-4 text-primary-400 hover:text-white pl-0 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-700/50 text-accent-400"><HandCoins className="w-6 h-6" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Sponsorship Dashboard</h1>
            <p className="text-primary-400">Transparent view of our sponsors and fund allocation</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
            <p className="text-primary-400 text-sm font-medium">Total Raised</p>
            <p className="text-2xl font-display font-bold text-white">{totalSponsoredAmount.toLocaleString()}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-700/50 text-warning-400"><Wallet className="w-5 h-5" /></div>
          <div>
            <p className="text-primary-400 text-sm font-medium">Available Balance</p>
            <p className="text-2xl font-display font-bold text-white">{balance.toLocaleString()}</p>
          </div>
        </Card>
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary-700/50 text-accent-400"><Building2 className="w-5 h-5" /></div>
            <h2 className="font-display text-xl font-bold text-white">Our Sponsors</h2>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-700 bg-primary-800/50">
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Business Name</th>
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Details</th>
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Amount Sponsored</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-700/50">
                  {sponsors.length === 0 ? (
                    <tr>
                      <td className="py-8 px-6 text-center text-primary-400" colSpan={3}>No sponsors added yet</td>
                    </tr>
                  ) : (
                    sponsors.map((s) => (
                      <tr key={s.id} className="hover:bg-primary-800/30 transition-colors">
                        <td className="py-4 px-6 text-white font-medium">{s.businessName}</td>
                        <td className="py-4 px-6 text-primary-300">{s.details || '-'}</td>
                        <td className="py-4 px-6 text-accent-400 font-semibold">{s.amountSponsored.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary-700/50 text-warning-400"><Wallet className="w-5 h-5" /></div>
            <h2 className="font-display text-xl font-bold text-white">Fund Usage</h2>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-700 bg-primary-800/50">
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Date</th>
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Purpose</th>
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Amount Used</th>
                    <th className="text-left py-4 px-6 text-primary-400 font-bold text-xs uppercase tracking-wider">Sponsor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-700/50">
                  {fundUsages.length === 0 ? (
                    <tr>
                      <td className="py-8 px-6 text-center text-primary-400" colSpan={4}>No fund usage recorded yet</td>
                    </tr>
                  ) : (
                    fundUsages.map(u => (
                      <tr key={u.id} className="hover:bg-primary-800/30 transition-colors">
                        <td className="py-4 px-6 text-primary-300">{new Date(u.date).toLocaleDateString()}</td>
                        <td className="py-4 px-6 text-white font-medium">{u.purpose}</td>
                        <td className="py-4 px-6 text-danger-400 font-semibold">{u.amountUsed.toLocaleString()}</td>
                        <td className="py-4 px-6 text-primary-300">{u.sponsorId ? (sponsors.find(s => s.id === u.sponsorId)?.businessName || '-') : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
