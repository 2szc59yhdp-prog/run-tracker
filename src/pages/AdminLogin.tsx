import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, AlertCircle, Hash } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin, loginAdminLegacy, isAdmin } = useApp();
  
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already admin, redirect
  if (isAdmin) {
    navigate('/admin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serviceNumber.trim()) {
      setError('Please enter your service number');
      return;
    }
    
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Try new login method first
      let success = await loginAdmin(serviceNumber, password);
      
      // Fallback to legacy login if new method fails (for backwards compatibility)
      if (!success) {
        success = await loginAdminLegacy(password);
      }
      
      if (success) {
        navigate('/admin');
      } else {
        setError('Invalid credentials. Please check your service number and password.');
      }
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Card className="animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-accent-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            Admin Access
          </h1>
          <p className="text-primary-400 text-sm">
            Enter your credentials to access management features
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/30">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
              <p className="text-danger-500 text-sm">{error}</p>
            </div>
          )}

          <Input
            label="Service Number"
            type="text"
            maxLength={5}
            value={serviceNumber}
            onChange={(e) => {
              let value = e.target.value.toUpperCase();
              if (value.startsWith('C')) {
                value = 'C' + value.slice(1).replace(/\D/g, '').slice(0, 4);
              } else {
                value = value.replace(/\D/g, '').slice(0, 4);
              }
              setServiceNumber(value);
            }}
            placeholder="e.g., 5568 or C1234"
            icon={<Hash className="w-5 h-5" />}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your admin password"
            icon={<Lock className="w-5 h-5" />}
          />

          <Button
            type="submit"
            size="lg"
            loading={isLoading}
            className="w-full mt-6"
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </Button>
        </form>

        <p className="text-center text-primary-500 text-xs mt-6">
          Contact system administrator if you need admin access
        </p>
      </Card>
    </div>
  );
}
