import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Shield, LogOut, Users, X, Lock, AlertCircle, Users2, Hash } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Navbar() {
  const { isAdmin, adminUser, loginAdmin, loginAdminLegacy, logoutAdmin } = useApp();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
      isActive
        ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/25'
        : 'text-primary-300 hover:bg-primary-800 hover:text-white'
    }`;

  const handleAdminClick = (e: React.MouseEvent) => {
    if (!isAdmin) {
      e.preventDefault();
      setShowPasswordModal(true);
      setServiceNumber('');
      setPassword('');
      setError('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
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
      
      // Fallback to legacy login if new method fails
      if (!success) {
        success = await loginAdminLegacy(password);
      }
      
      if (success) {
        setShowPasswordModal(false);
        setServiceNumber('');
        setPassword('');
        navigate('/admin');
      } else {
        setError('Invalid credentials');
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowPasswordModal(false);
    setServiceNumber('');
    setPassword('');
    setError('');
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-primary-900/90 backdrop-blur-md border-b border-primary-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
          {/* Logo with Team Icon */}
          <NavLink to="/dashboard" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-600/20 group-hover:shadow-accent-500/30 transition-shadow flex-shrink-0">
              <Users2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            {/* Short version on mobile, full on desktop */}
            <span 
              className="hidden md:block text-sm font-bold text-primary-100 border-l border-primary-700 pl-3 tracking-wide"
              style={{ textShadow: '0 0 10px rgba(33, 134, 235, 0.6), 0 0 20px rgba(33, 134, 235, 0.4), 0 0 30px rgba(33, 134, 235, 0.2)' }}
            >
              RUN.PROTECT.SERVE.INSPIRE
            </span>
            <span 
              className="block md:hidden text-[10px] font-bold text-primary-100 border-l border-primary-700 pl-2 tracking-tight leading-tight"
              style={{ textShadow: '0 0 8px rgba(33, 134, 235, 0.5)' }}
            >
              RUN.PROTECT<br/>SERVE.INSPIRE
            </span>
          </NavLink>

            {/* Navigation Links */}
            <div className="flex items-center gap-2">
              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-2">
                <NavLink to="/dashboard" className={navLinkClass}>
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </NavLink>
                <NavLink to="/add-run" className={navLinkClass}>
                  <PlusCircle size={18} />
                  <span>Add Run</span>
                </NavLink>
                <NavLink 
                  to="/admin" 
                  className={navLinkClass}
                  onClick={handleAdminClick}
                  end
                >
                  <Shield size={18} />
                  <span>Admin</span>
                </NavLink>
                {isAdmin && (
                  <>
                    <NavLink to="/admin/users" className={navLinkClass}>
                      <Users size={18} />
                      <span>Users</span>
                    </NavLink>
                    <div className="flex items-center gap-3 pl-2 border-l border-primary-700 ml-2">
                      {adminUser?.name && (
                        <span className="text-sm text-primary-300">
                          Welcome, <span className="text-accent-400 font-medium">{adminUser.name}</span>
                        </span>
                      )}
                      <button
                        onClick={logoutAdmin}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-primary-300 hover:bg-danger-600/20 hover:text-danger-500 transition-all duration-200 font-medium"
                      >
                        <LogOut size={18} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile Navigation */}
              <div className="flex md:hidden items-center gap-1">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-accent-600 text-white'
                        : 'text-primary-300 hover:bg-primary-800'
                    }`
                  }
                >
                  <LayoutDashboard size={20} />
                </NavLink>
                <NavLink
                  to="/add-run"
                  className={({ isActive }) =>
                    `p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-accent-600 text-white'
                        : 'text-primary-300 hover:bg-primary-800'
                    }`
                  }
                >
                  <PlusCircle size={20} />
                </NavLink>
                {isAdmin ? (
                  <NavLink
                    to="/admin"
                    end
                    className={({ isActive }) =>
                      `p-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-accent-600 text-white'
                          : 'text-primary-300 hover:bg-primary-800'
                      }`
                    }
                  >
                    <Shield size={20} />
                  </NavLink>
                ) : (
                  <button
                    onClick={handleAdminClick}
                    className="p-3 rounded-lg transition-all text-primary-300 hover:bg-primary-800"
                  >
                    <Shield size={20} />
                  </button>
                )}
                {isAdmin && (
                  <>
                    <NavLink
                      to="/admin/users"
                      className={({ isActive }) =>
                        `p-3 rounded-lg transition-all ${
                          isActive
                            ? 'bg-accent-600 text-white'
                            : 'text-primary-300 hover:bg-primary-800'
                        }`
                      }
                    >
                      <Users size={20} />
                    </NavLink>
                    <button
                      onClick={logoutAdmin}
                      className="p-3 rounded-lg text-primary-300 hover:bg-danger-600/20 hover:text-danger-500 transition-all"
                    >
                      <LogOut size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Admin Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-primary-900 border border-primary-700 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent-500/20 rounded-xl flex items-center justify-center">
                    <Lock className="w-5 h-5 text-accent-400" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-white">Admin Access</h2>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg text-primary-400 hover:bg-primary-800 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin}>
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-danger-500 flex-shrink-0" />
                    <p className="text-danger-500 text-sm">{error}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-primary-300 mb-2">
                    Service Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400">
                      <Hash size={18} />
                    </div>
                    <input
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
                      className="w-full px-4 py-3 pl-10 bg-primary-800/50 border border-primary-700 rounded-xl text-white placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-primary-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 pl-10 bg-primary-800/50 border border-primary-700 rounded-xl text-white placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-accent-600 hover:bg-accent-500 disabled:bg-primary-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Shield size={18} />
                      <span>Login</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
