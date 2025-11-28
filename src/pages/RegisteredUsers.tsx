import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Edit2, Trash2, Search, X, Save, Hash, User, Award, Mail, Phone, MapPin, ChevronDown } from 'lucide-react';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useApp } from '../context/AppContext';
import { fetchAllUsers, addUser, updateUser, deleteUser } from '../services/api';
import type { RegisteredUser } from '../types';

// Station options for dropdown
const STATIONS = [
  'Thinadhoo City Police Station',
  'Gdh.Madaveli Police Station',
  'Gdh.Rathafandhoo Police Station',
  'Gdh.Fiyoari Police Station',
  'Gdh.Faresmaathoda Police Station',
  'Gdh.Vaadhoo Police Station',
  'Gdh.Gadhdhoo Police Station',
];

export function RegisteredUsers() {
  const navigate = useNavigate();
  const { isAdmin, adminToken } = useApp();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<RegisteredUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RegisteredUser | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    serviceNumber: '',
    name: '',
    rank: '',
    email: '',
    phone: '',
    station: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin-login');
    }
  }, [isAdmin, navigate]);

  // Fetch users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Filter users when search term changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.serviceNumber.toLowerCase().includes(term) ||
            user.name.toLowerCase().includes(term) ||
            user.station.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, users]);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    
    const result = await fetchAllUsers();
    
    if (result.success && result.data) {
      setUsers(result.data);
      setFilteredUsers(result.data);
    } else {
      setError(result.error || 'Failed to load users');
    }
    
    setLoading(false);
  }

  function openAddModal() {
    setFormData({ serviceNumber: '', name: '', rank: '', email: '', phone: '', station: '' });
    setFormError(null);
    setShowAddModal(true);
  }

  function openEditModal(user: RegisteredUser) {
    setFormData({
      serviceNumber: user.serviceNumber,
      name: user.name,
      rank: user.rank || '',
      email: user.email || '',
      phone: user.phone || '',
      station: user.station,
    });
    setFormError(null);
    setEditingUser(user);
  }

  function closeModals() {
    setShowAddModal(false);
    setEditingUser(null);
    setDeleteConfirm(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!adminToken) {
      setFormError('Admin session expired. Please login again.');
      setFormLoading(false);
      return;
    }

    if (editingUser) {
      // Update existing user
      const result = await updateUser(
        { id: editingUser.id, ...formData },
        adminToken
      );
      
      if (result.success) {
        await loadUsers();
        closeModals();
      } else {
        setFormError(result.error || 'Failed to update user');
      }
    } else {
      // Add new user
      const result = await addUser(formData, adminToken);
      
      if (result.success) {
        await loadUsers();
        closeModals();
      } else {
        setFormError(result.error || 'Failed to add user');
      }
    }

    setFormLoading(false);
  }

  async function handleDelete() {
    if (!deleteConfirm || !adminToken) return;

    setFormLoading(true);
    const result = await deleteUser(deleteConfirm.id, adminToken);
    
    if (result.success) {
      await loadUsers();
      closeModals();
    } else {
      setFormError(result.error || 'Failed to delete user');
    }
    
    setFormLoading(false);
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Registered Users
          </h1>
          <p className="text-primary-400 text-sm sm:text-base mt-1">Manage staff members who can log runs</p>
        </div>
        <Button onClick={openAddModal} className="flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg">
          <Plus className="w-5 h-5" />
          Add New User
        </Button>
      </div>

      {/* Search & Stats Bar */}
      <Card className="!p-3 sm:!p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
              <input
                type="text"
                placeholder="Search by name, service # or station..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-primary-800/50 border border-primary-700 rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-12 pr-10 text-sm sm:text-base text-white placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
            
            {/* User Count Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-accent-500/10 border border-accent-500/30 rounded-xl">
              <Users className="w-4 h-4 text-accent-400" />
              <span className="text-accent-400 font-semibold text-sm">
                {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
              </span>
            </div>
          </div>
        </Card>

      {/* Users List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={loadUsers} variant="secondary">
              Try Again
            </Button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <p className="text-primary-400">
              {searchTerm ? 'No users match your search' : 'No registered users yet'}
            </p>
            {!searchTerm && (
              <Button onClick={openAddModal} className="mt-4">
                Add First User
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-700">
                    <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Service #</th>
                    <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Name</th>
                    <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Rank</th>
                    <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Email</th>
                    <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Phone</th>
                    <th className="text-left py-3 px-4 text-primary-400 font-medium text-sm">Station</th>
                    <th className="text-right py-3 px-4 text-primary-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-primary-700/50 hover:bg-primary-700/30 transition-colors"
                    >
                      <td className="py-4 px-4 text-accent-400 font-mono font-semibold">{user.serviceNumber}</td>
                      <td className="py-4 px-4 text-white font-medium">{user.name}</td>
                      <td className="py-4 px-4 text-primary-300">{user.rank || '-'}</td>
                      <td className="py-4 px-4 text-primary-300">{user.email || '-'}</td>
                      <td className="py-4 px-4 text-primary-300">{user.phone || '-'}</td>
                      <td className="py-4 px-4 text-primary-300 max-w-[200px] truncate">{user.station}</td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-accent-400 hover:bg-accent-500/20 rounded-lg transition-colors"
                            title="Edit user"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(user)}
                            className="p-2 text-danger-500 hover:bg-danger-500/20 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-primary-800/50 rounded-xl p-4 border border-primary-700/50"
                >
                  {/* Header with name and actions */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-primary-700/50">
                    <div>
                      <p className="text-white font-semibold text-lg">{user.name}</p>
                      <p className="text-accent-400 text-sm font-mono">#{user.serviceNumber}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-accent-400 hover:bg-accent-500/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user)}
                        className="p-2 text-danger-500 hover:bg-danger-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* User details grid */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      <span className="text-primary-400">Rank:</span>
                      <span className="text-primary-200">{user.rank || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      <span className="text-primary-400">Email:</span>
                      <span className="text-primary-200 truncate">{user.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      <span className="text-primary-400">Phone:</span>
                      <span className="text-primary-200">{user.phone || '-'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                      <span className="text-primary-400">Station:</span>
                      <span className="text-primary-200">{user.station}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
      </Card>

      {/* Add/Edit Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="w-full max-w-lg my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={closeModals}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Row 1: Service Number & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Service Number"
                  inputMode="numeric"
                  maxLength={4}
                  value={formData.serviceNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setFormData({ ...formData, serviceNumber: value });
                  }}
                  placeholder="e.g., 5568"
                  icon={<Hash className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                  icon={<User className="w-4 h-4" />}
                  required
                />
              </div>

              {/* Row 2: Rank & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Rank"
                  value={formData.rank}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  placeholder="e.g., Sergeant"
                  icon={<Award className="w-4 h-4" />}
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  icon={<Mail className="w-4 h-4" />}
                />
              </div>

              {/* Row 3: Phone */}
              <Input
                label="Phone No"
                type="tel"
                inputMode="numeric"
                maxLength={7}
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                  setFormData({ ...formData, phone: value });
                }}
                placeholder="e.g., 7XXXXXX"
                icon={<Phone className="w-4 h-4" />}
              />

              {/* Station Dropdown */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-primary-200">
                  Station <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <select
                    value={formData.station}
                    onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-primary-800/50 border border-primary-700 rounded-xl text-white 
                      outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-accent-500
                      transition-all duration-200 pl-12 pr-10 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-primary-800">Select a station...</option>
                    {STATIONS.map((station) => (
                      <option key={station} value={station} className="bg-primary-800">
                        {station}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-red-400 text-sm">{formError}</p>
              )}

              <div className="flex gap-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModals}
                  className="flex-1 min-h-[48px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={formLoading}
                  loading={formLoading}
                  className="flex-1 min-h-[48px]"
                >
                  <Save className="w-4 h-4" />
                  {editingUser ? 'Update' : 'Add User'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Confirm Delete</h2>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">{deleteConfirm.name}</span>{' '}
              (Service #: {deleteConfirm.serviceNumber})?
            </p>
            <p className="text-amber-400 text-sm mb-6">
              ⚠️ This action cannot be undone.
            </p>

            {formError && (
              <p className="text-red-400 text-sm mb-4">{formError}</p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModals}
                className="flex-1 min-h-[48px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={formLoading}
                loading={formLoading}
                className="flex-1 min-h-[48px]"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

