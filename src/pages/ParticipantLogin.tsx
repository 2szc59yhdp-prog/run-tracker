import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';
import { Hash, Lock, Check } from 'lucide-react';

export default function ParticipantLogin() {
  const navigate = useNavigate();
  const { isParticipant, loginParticipant } = useApp();
  const [serviceNumber, setServiceNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    const ok = await loginParticipant(serviceNumber.trim(), pin.trim());
    setLoading(false);
    if (ok) {
      setSuccess(true);
      navigate('/add-run', { replace: true });
    } else {
      setError('Invalid service number or PIN.');
    }
  };

  if (isParticipant) {
    navigate('/add-run', { replace: true });
    return null;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary-700 text-accent-400">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="font-display text-xl font-semibold text-white">Participant Login</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Service Number"
            value={serviceNumber}
            onChange={(e) => setServiceNumber(e.target.value)}
            icon={<Hash className="w-5 h-5" />}
            placeholder="Enter your service number"
            required
          />
          <Input
            label="PIN"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            icon={<Lock className="w-5 h-5" />}
            placeholder="Enter your PIN"
            required
          />
          {error && <p className="text-danger-500 text-sm font-medium">{error}</p>}
          {success && (
            <p className="text-success-500 text-sm font-medium flex items-center gap-2">
              <Check className="w-4 h-4" /> Logged in
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </Card>
      <p className="text-primary-400 text-xs mt-4">
        Tip: Use the assigned PIN to log in.
      </p>
    </div>
  );
}
