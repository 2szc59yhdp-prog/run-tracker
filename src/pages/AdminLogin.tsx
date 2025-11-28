import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, AlertCircle } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin, isAdmin } = useApp();
  
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
    
    if (!password.trim()) {
      setError('Please enter the admin password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await loginAdmin(password);
      
      if (success) {
        navigate('/admin');
      } else {
        setError('Invalid password. Please try again.');
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
            Enter the admin password to access management features
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/30">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
              <p className="text-danger-500 text-sm">{error}</p>
            </div>
          )}

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            icon={<Lock className="w-5 h-5" />}
          />

          <Button
            type="submit"
            size="lg"
            loading={isLoading}
            className="w-full"
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </Button>
        </form>

        <p className="text-center text-primary-500 text-xs mt-6">
          Contact your system administrator if you need access
        </p>
      </Card>
    </div>
  );
}

