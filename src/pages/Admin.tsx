import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, Clock, XCircle, Image, Filter, ChevronDown, MessageSquare, RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApp } from '../context/AppContext';
import { updateRun, deleteRun, updateRunStatus } from '../services/api';
import type { Run, RunStatus } from '../types';
import { REJECTION_REASONS } from '../types';

type FilterStatus = 'all' | RunStatus;

// Status badge component
function StatusBadge({ status, rejectionReason, approvedBy, approvedByName }: { 
  status: RunStatus; 
  rejectionReason?: string;
  approvedBy?: string;
  approvedByName?: string;
}) {
  const config = {
    pending: {
      icon: Clock,
      text: 'Pending',
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    approved: {
      icon: CheckCircle,
      text: 'Approved',
      className: 'bg-success-500/20 text-success-400 border-success-500/30',
    },
    rejected: {
      icon: XCircle,
      text: 'Rejected',
      className: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
    },
  };

  const { icon: Icon, text, className } = config[status] || config.pending;

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${className}`}>
        <Icon className="w-3 h-3" />
        {text}
      </span>
      {(status === 'approved' || status === 'rejected') && approvedByName && (
        <span className="text-xs text-primary-500">
          by {approvedByName} #{approvedBy}
        </span>
      )}
      {status === 'rejected' && rejectionReason && (
        <span className="text-xs text-danger-400/80 italic max-w-[200px] leading-tight">
          "{rejectionReason}"
        </span>
      )}
    </div>
  );
}

export default function Admin() {
  const { isAdmin, adminToken, adminUser, runs, isLoading, isRefreshing, error, refreshData } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Run>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<{ id: string; action: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState<Run | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<Run | null>(null);

  // Auto-refresh runs every 5 seconds (silent - no loading spinner)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData(true); // silent refresh
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Auto-dismiss message after 4 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  // Filter and sort runs
  const filteredRuns = runs
    .filter(run => filterStatus === 'all' || run.status === filterStatus)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Count by status
  const statusCounts = {
    all: runs.length,
    pending: runs.filter(r => r.status === 'pending').length,
    approved: runs.filter(r => r.status === 'approved').length,
    rejected: runs.filter(r => r.status === 'rejected').length,
  };

  // Calculate admin approval statistics
  const adminStats = (() => {
    const statsMap = new Map<string, { name: string; serviceNumber: string; approved: number; rejected: number }>();
    
    runs.forEach(run => {
      if (run.approvedByName && (run.status === 'approved' || run.status === 'rejected')) {
        const key = run.approvedBy || run.approvedByName;
        const existing = statsMap.get(key);
        
        if (existing) {
          if (run.status === 'approved') existing.approved++;
          if (run.status === 'rejected') existing.rejected++;
        } else {
          statsMap.set(key, {
            name: run.approvedByName,
            serviceNumber: run.approvedBy || '',
            approved: run.status === 'approved' ? 1 : 0,
            rejected: run.status === 'rejected' ? 1 : 0,
          });
        }
      }
    });
    
    return Array.from(statsMap.values()).sort((a, b) => (b.approved + b.rejected) - (a.approved + a.rejected));
  })();

  const handleEdit = (run: Run) => {
    setEditingId(run.id);
    setEditForm({
      id: run.id,
      date: run.date,
      serviceNumber: run.serviceNumber,
      name: run.name,
      station: run.station,
      distanceKm: run.distanceKm,
      distanceDisplay: run.distanceDisplay ?? run.distanceKm.toFixed(2),
    });
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editForm.id || !adminToken) return;

    setIsSaving(true);
    setMessage(null);

      try {
        const response = await updateRun(
          {
            id: editForm.id,
            date: editForm.date!,
            serviceNumber: editForm.serviceNumber!,
            name: editForm.name!,
            station: editForm.station!,
            distanceKm: editForm.distanceKm!,
            distanceDisplay: editForm.distanceDisplay ?? editForm.distanceKm?.toFixed(2),
          },
          adminToken
        );

      if (response.success) {
        setMessage({ type: 'success', text: 'Run updated successfully!' });
        await refreshData();
        setEditingId(null);
        setEditForm({});
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to update run' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Approve - instant, no confirmation
  const handleApprove = async (runId: string) => {
    if (!adminToken) return;

    setIsUpdatingStatus({ id: runId, action: 'approve' });
    setMessage(null);

    try {
      const response = await updateRunStatus(runId, 'approved', adminToken, adminUser || undefined);

      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: 'Run approved! Leaderboard updated.' 
        });
        await refreshData(); // This updates leaderboard and dashboard
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to approve run' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while approving' });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Handle Reject - with confirmation modal
  const handleRejectConfirm = async () => {
    if (!adminToken || !rejectConfirm) return;

    // Validate rejection reason
    const finalReason = rejectionReason === 'Other' ? customRejectionReason.trim() : rejectionReason;
    if (!finalReason) {
      setMessage({ type: 'error', text: 'Please select a rejection reason' });
      return;
    }

    setIsUpdatingStatus({ id: rejectConfirm.id, action: 'reject' });
    setMessage(null);

    try {
      const response = await updateRunStatus(rejectConfirm.id, 'rejected', adminToken, adminUser || undefined, finalReason);

      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: 'Run rejected successfully.' 
        });
        await refreshData();
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to reject run' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while rejecting' });
    } finally {
      setIsUpdatingStatus(null);
      setRejectConfirm(null);
      setRejectionReason('');
      setCustomRejectionReason('');
    }
  };

  // Close reject modal and reset
  const closeRejectModal = () => {
    setRejectConfirm(null);
    setRejectionReason('');
    setCustomRejectionReason('');
  };

  // Handle status change for reverting
  const handleStatusChange = async (runId: string, newStatus: RunStatus) => {
    if (!adminToken) return;

    setIsUpdatingStatus({ id: runId, action: newStatus });
    setMessage(null);

    try {
      const response = await updateRunStatus(runId, newStatus, adminToken, adminUser || undefined);

      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: `Run status updated to ${newStatus}.` 
        });
        await refreshData();
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to update status' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while updating status' });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleDelete = (run: Run) => {
    setDeleteConfirm(run);
  };

  const handleDeleteConfirm = async () => {
    if (!adminToken || !deleteConfirm) return;

    setIsDeleting(deleteConfirm.id);
    setMessage(null);

    try {
      const response = await deleteRun(deleteConfirm.id, adminToken);

      if (response.success) {
        setMessage({ type: 'success', text: 'Run deleted successfully!' });
        await refreshData();
        setDeleteConfirm(null);
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to delete run' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while deleting' });
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPhotoFullUrl = (photoUrl: string) => {
    // For Google Drive thumbnails, just increase the size parameter for a larger version
    // This uses the same CDN (already connected) so it loads much faster
    if (photoUrl.includes('sz=w')) {
      return photoUrl.replace(/sz=w\d+/, 'sz=w1200');
    }
    // If no size param, just return the original URL
    return photoUrl;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <LoadingSpinner size="lg" message="Loading runs..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-accent-600/20 text-accent-400">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">
            Admin Panel
          </h1>
          {isRefreshing && (
            <RefreshCw className="w-5 h-5 text-accent-400 animate-spin" />
          )}
        </div>
        <p className="text-primary-400">
          Review, approve or reject run submissions
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl mb-6 animate-fade-in ${
            message.type === 'success'
              ? 'bg-success-500/10 border border-success-500/30'
              : 'bg-danger-500/10 border border-danger-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-success-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-danger-500" />
          )}
          <p className={message.type === 'success' ? 'text-success-500' : 'text-danger-500'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="mb-6">
          <p className="text-danger-500">{error}</p>
          <Button onClick={() => refreshData()} variant="secondary" className="mt-4">
            Try Again
          </Button>
        </Card>
      )}

      {/* Admin Approval Statistics */}
      {adminStats.length > 0 && (
        <Card className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-500/20 text-accent-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">Admin Activity</h2>
                <p className="text-xs text-primary-500">Who approved/rejected runs</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            {adminStats.map((admin) => (
              <div 
                key={admin.serviceNumber || admin.name} 
                className="flex items-center justify-between py-2 px-3 bg-primary-800/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{admin.name}</span>
                  {admin.serviceNumber && (
                    <span className="text-xs text-primary-500">#{admin.serviceNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-success-400" />
                    <span className="text-success-400 font-bold">{admin.approved}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-danger-400" />
                    <span className="text-danger-400 font-bold">{admin.rejected}</span>
                  </div>
                  <span className="text-primary-400 text-sm w-16 text-right">
                    Total: {admin.approved + admin.rejected}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 animate-fade-in">
        {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2
              ${filterStatus === status 
                ? 'bg-accent-600 text-white' 
                : 'bg-primary-800/50 text-primary-300 hover:bg-primary-700/50'}
            `}
          >
            {status === 'all' && <Filter className="w-4 h-4" />}
            {status === 'pending' && <Clock className="w-4 h-4 text-amber-400" />}
            {status === 'approved' && <CheckCircle className="w-4 h-4 text-success-400" />}
            {status === 'rejected' && <XCircle className="w-4 h-4 text-danger-400" />}
            <span className="capitalize">{status}</span>
            <span className={`
              px-2 py-0.5 rounded-full text-xs
              ${filterStatus === status ? 'bg-white/20' : 'bg-primary-700'}
            `}>
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Runs List */}
      <Card className="animate-fade-in stagger-1">
        <h2 className="font-display text-xl font-semibold text-white mb-6">
          {filterStatus === 'all' ? 'All Runs' : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Runs`} ({filteredRuns.length})
        </h2>

        {filteredRuns.length === 0 ? (
          <p className="text-primary-400 text-center py-8">
            No {filterStatus === 'all' ? '' : filterStatus + ' '}runs found.
          </p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredRuns.map((run) => (
              <div
                key={run.id}
                className={`p-4 rounded-xl border transition-all ${
                  editingId === run.id
                    ? 'bg-primary-700/50 border-accent-500/50'
                    : run.duplicateOf
                    ? 'bg-red-500/5 border-red-500/30 ring-1 ring-red-500/20'
                    : run.status === 'pending'
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-primary-800/30 border-primary-700/30 hover:border-primary-600/50'
                }`}
              >
                {editingId === run.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input
                        label="Service Number"
                        value={editForm.serviceNumber || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, serviceNumber: e.target.value }))
                        }
                      />
                      <Input
                        label="Name"
                        value={editForm.name || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                      <Input
                        label="Station"
                        value={editForm.station || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, station: e.target.value }))
                        }
                      />
                      <Input
                        label="Distance (KM)"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={(editForm.distanceDisplay ?? editForm.distanceKm?.toString()) || ''}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^0-9.]/g, '');
                          if (value.includes('.')) {
                            const [i, d] = value.split('.');
                            value = d !== undefined ? `${i}.${d.slice(0, 2)}` : i;
                          }
                          setEditForm((prev) => ({
                            ...prev,
                            distanceKm: value ? parseFloat(value) : 0,
                            distanceDisplay: value,
                          }));
                        }}
                      />
                      <Input
                        label="Date"
                        type="date"
                        value={editForm.date || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, date: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        icon={<X className="w-4 h-4" />}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        loading={isSaving}
                        icon={<Save className="w-4 h-4" />}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-4">
                    {/* Duplicate Badge - Top of Card */}
                    {run.duplicateOf && (
                      <div className="flex items-center gap-2 -mt-1 -mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                          ⚠️ DUPLICATE SCREENSHOT
                        </span>
                      </div>
                    )}

                    {/* Photo Preview Section - Large and Prominent */}
                    {run.photoUrl && (
                      <div className={`rounded-xl p-4 border ${run.duplicateOf ? 'bg-red-900/20 border-red-500/30' : 'bg-primary-900/50 border-primary-700/50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Image className="w-4 h-4 text-accent-400" />
                            <span className="text-sm font-medium text-primary-300">Run Proof (Strava/Nike Screenshot)</span>
                          </div>
                          {run.duplicateOf && (
                            <span className="text-xs text-red-400 font-medium">Previously used</span>
                          )}
                        </div>
                        <button 
                          type="button"
                          className="relative rounded-lg overflow-hidden bg-primary-800 cursor-pointer group w-full text-left"
                          onClick={() => setSelectedPhoto(getPhotoFullUrl(run.photoUrl!))}
                        >
                          <img 
                            src={run.photoUrl} 
                            alt="Run proof screenshot" 
                            className="w-full max-h-64 object-contain"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center gap-2 text-white">
                              <Image className="w-5 h-5" />
                              <span className="font-medium">Tap to Enlarge</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* No Photo Warning */}
                    {!run.photoUrl && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="text-amber-400 font-medium text-sm">No proof uploaded</p>
                          <p className="text-amber-400/70 text-xs">This run has no screenshot attached for verification</p>
                        </div>
                      </div>
                    )}

                    {/* Duplicate Screenshot Warning */}
                    {run.duplicateOf && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <div>
                          <p className="text-red-400 font-medium text-sm">⚠️ Duplicate Screenshot Detected</p>
                          <p className="text-red-400/70 text-xs">This screenshot was previously used: {run.duplicateOf}</p>
                        </div>
                      </div>
                    )}

                    {/* Run Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="bg-primary-800/30 rounded-lg p-3">
                        <p className="text-xs text-primary-500 mb-1">Date</p>
                        <p className="text-white text-sm font-medium">{formatDate(run.date)}</p>
                      </div>
                      <div className="bg-primary-800/30 rounded-lg p-3">
                        <p className="text-xs text-primary-500 mb-1">Service #</p>
                        <p className="text-white text-sm font-medium">{run.serviceNumber}</p>
                      </div>
                      <div className="bg-primary-800/30 rounded-lg p-3">
                        <p className="text-xs text-primary-500 mb-1">Name</p>
                        <p className="text-white text-sm font-medium">{run.name}</p>
                      </div>
                      <div className="bg-primary-800/30 rounded-lg p-3">
                        <p className="text-xs text-primary-500 mb-1">Station</p>
                        <p className="text-white text-sm font-medium truncate">{run.station}</p>
                      </div>
                      <div className="bg-primary-800/30 rounded-lg p-3">
                        <p className="text-xs text-primary-500 mb-1">Distance</p>
                        <p className="text-white text-lg font-bold">{(run.distanceDisplay && run.distanceDisplay.trim() !== '' ? run.distanceDisplay : run.distanceKm.toFixed(2))} <span className="text-sm font-normal text-primary-400">km</span></p>
                      </div>
                      <div className="bg-primary-800/30 rounded-lg p-3">
                        <p className="text-xs text-primary-500 mb-1">Status</p>
                        <StatusBadge 
                          status={run.status || 'pending'} 
                          rejectionReason={run.rejectionReason}
                          approvedBy={run.approvedBy}
                          approvedByName={run.approvedByName}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-primary-700/50">
                      {/* Approve/Reject buttons for pending runs */}
                      {(run.status === 'pending' || !run.status) && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleApprove(run.id)}
                            loading={isUpdatingStatus?.id === run.id && isUpdatingStatus?.action === 'approve'}
                            disabled={isUpdatingStatus?.id === run.id}
                            icon={<CheckCircle className="w-4 h-4" />}
                            className="bg-success-500/20 hover:bg-success-500/30 text-success-400 border-success-500/30"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRejectConfirm(run)}
                            disabled={isUpdatingStatus?.id === run.id}
                            icon={<XCircle className="w-4 h-4" />}
                            className="bg-danger-500/20 hover:bg-danger-500/30 text-danger-400 border-danger-500/30"
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {/* Revert buttons for approved/rejected runs */}
                      {run.status === 'approved' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChange(run.id, 'pending')}
                          loading={isUpdatingStatus?.id === run.id && isUpdatingStatus?.action === 'pending'}
                          icon={<Clock className="w-4 h-4" />}
                        >
                          Revert to Pending
                        </Button>
                      )}
                      {run.status === 'rejected' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStatusChange(run.id, 'approved')}
                          loading={isUpdatingStatus?.id === run.id && isUpdatingStatus?.action === 'approved'}
                          icon={<CheckCircle className="w-4 h-4" />}
                          className="bg-success-500/20 hover:bg-success-500/30 text-success-400 border-success-500/30"
                        >
                          Approve Instead
                        </Button>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Edit & Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(run)}
                        icon={<Edit2 className="w-4 h-4" />}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(run)}
                        loading={isDeleting === run.id}
                        icon={<Trash2 className="w-4 h-4" />}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 sm:p-8 z-50 animate-fade-in cursor-pointer"
          onClick={() => { setSelectedPhoto(null); setPhotoLoaded(false); }}
          onTouchEnd={(e) => { e.preventDefault(); setSelectedPhoto(null); setPhotoLoaded(false); }}
        >
          {/* Close Button - Fixed at top right corner, always visible */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedPhoto(null); setPhotoLoaded(false); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setSelectedPhoto(null); setPhotoLoaded(false); }}
            className="fixed top-4 right-4 z-50 p-4 bg-white/30 active:bg-white/50 rounded-full text-white transition-colors shadow-lg"
          >
            <X className="w-7 h-7" />
          </button>
          
          <div className="relative max-w-3xl w-full flex flex-col items-center pointer-events-none">
            {/* Image Container */}
            <div className="relative w-full flex items-center justify-center">
              {/* Loading Spinner - Only show while loading */}
              {!photoLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-white/20 border-t-accent-500 rounded-full animate-spin" />
                </div>
              )}
              
              {/* Image - Reduced size on mobile for easier tap-to-close */}
              <img 
                src={selectedPhoto} 
                alt="Run proof - Full size" 
                className={`max-w-[90%] sm:max-w-full max-h-[60vh] sm:max-h-[75vh] rounded-xl object-contain shadow-2xl transition-opacity duration-200 ${photoLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setPhotoLoaded(true)}
                onError={() => setPhotoLoaded(true)}
              />
            </div>
            
            {/* Close hint */}
            <p className="mt-6 text-white/60 text-sm text-center">
              Tap anywhere to close
            </p>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {rejectConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-danger-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-danger-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Reject This Run?
              </h3>
              <p className="text-primary-400 mb-4">
                Are you sure you want to reject the run by <span className="text-white font-medium">{rejectConfirm.name}</span>?
                <br />
                <span className="text-sm">({rejectConfirm.distanceKm} km on {formatDate(rejectConfirm.date)})</span>
              </p>
              
              {/* Rejection Reason Dropdown */}
              <div className="mb-4 text-left">
                <label className="block text-sm font-medium text-primary-200 mb-2">
                  Rejection Reason *
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
                    <MessageSquare size={18} />
                  </div>
                  <select
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value);
                      if (e.target.value !== 'Other') {
                        setCustomRejectionReason('');
                      }
                    }}
                    className="w-full px-4 py-3 bg-primary-800/50 border border-primary-700 rounded-xl text-white outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-danger-500 transition-all duration-200 pl-12 pr-10 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-primary-800">Select a reason...</option>
                    {REJECTION_REASONS.map(reason => (
                      <option key={reason} value={reason} className="bg-primary-800">
                        {reason}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              {/* Custom Reason Text Field (shown when "Other" is selected) */}
              {rejectionReason === 'Other' && (
                <div className="mb-4 text-left animate-fade-in">
                  <label className="block text-sm font-medium text-primary-200 mb-2">
                    Please specify the reason *
                  </label>
                  <textarea
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Enter the rejection reason..."
                    rows={3}
                    className="w-full px-4 py-3 bg-primary-800/50 border border-primary-700 rounded-xl text-white placeholder-primary-500 outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-danger-500 transition-all duration-200 resize-none"
                  />
                </div>
              )}
              
              <div className="bg-primary-800/50 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-primary-400 mb-2">This run will:</p>
                <ul className="text-sm text-primary-300 space-y-1">
                  <li>• Not be counted in the leaderboard</li>
                  <li>• Show as "Rejected" in recent runs</li>
                  <li>• Can be approved later if needed</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={closeRejectModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={handleRejectConfirm}
                  loading={isUpdatingStatus?.id === rejectConfirm.id && isUpdatingStatus?.action === 'reject'}
                  icon={<XCircle className="w-4 h-4" />}
                  disabled={!rejectionReason || (rejectionReason === 'Other' && !customRejectionReason.trim())}
                >
                  Yes, Reject
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-danger-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-danger-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Delete This Run?
              </h3>
              <p className="text-primary-400 mb-4">
                Are you sure you want to delete the run by <span className="text-white font-medium">{deleteConfirm.name}</span>?
                <br />
                <span className="text-sm">({deleteConfirm.distanceKm} km on {formatDate(deleteConfirm.date)})</span>
              </p>
              
              <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-danger-400 font-medium mb-2">⚠️ Warning</p>
                <p className="text-sm text-primary-400">
                  This action cannot be undone. The run data will be permanently removed from the system.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={handleDeleteConfirm}
                  loading={isDeleting === deleteConfirm.id}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Yes, Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
