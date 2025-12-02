import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, User, MapPin, Calendar, Route, CheckCircle, AlertCircle, Search, Loader2, Camera, X, Image } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { useApp } from '../context/AppContext';
import { addRun, checkDuplicateRun, getUserByServiceNumber, warmupApi } from '../services/api';

interface FormData {
  serviceNumber: string;
  name: string;
  station: string;
  date: string;
  distanceKm: string;
}

interface FormErrors {
  serviceNumber?: string;
  date?: string;
  distanceKm?: string;
  photo?: string;
  general?: string;
}

interface UserData {
  name: string;
  station: string;
  rank?: string;
}

export default function AddRun() {
  const navigate = useNavigate();
  const { refreshData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get today's date in Maldives timezone (UTC+5) to match backend validation
  const getTodayInMaldives = () => {
    const now = new Date();
    // Format date in Maldives timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Indian/Maldives',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now); // Returns YYYY-MM-DD format
  };
  
  const [today, setToday] = useState(getTodayInMaldives());
  
  const [formData, setFormData] = useState<FormData>({
    serviceNumber: '',
    name: '',
    station: '',
    date: getTodayInMaldives(),
    distanceKm: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  
  // Update date when page gains focus or every minute (in case user leaves page open)
  useEffect(() => {
    const updateDate = () => {
      const newToday = getTodayInMaldives();
      setToday(newToday);
      setFormData(prev => ({ ...prev, date: newToday }));
    };
    
    // Update when page gains focus
    window.addEventListener('focus', updateDate);
    
    // Also check every minute in case date changes while on page
    const interval = setInterval(updateDate, 60000);
    
    return () => {
      window.removeEventListener('focus', updateDate);
      clearInterval(interval);
    };
  }, []);
  
  // Pre-warm the API when page loads to reduce cold start delay
  useEffect(() => {
    warmupApi();
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Show toast when there's a general error
  useEffect(() => {
    if (errors.general) {
      setToast({ message: errors.general, type: 'error' });
    }
  }, [errors.general]);
  const [userFound, setUserFound] = useState<UserData | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Search for user by service number
  const handleSearch = async () => {
    const serviceNumber = formData.serviceNumber.trim();
    
    if (!serviceNumber) {
      setErrors({ serviceNumber: 'Please enter a service number' });
      return;
    }

    setIsSearching(true);
    setUserNotFound(false);
    setErrors({});
    
    try {
      const result = await getUserByServiceNumber(serviceNumber);
      if (result.success && result.data) {
        setUserFound({
          name: result.data.name,
          station: result.data.station,
          rank: result.data.rank,
        });
        setFormData(prev => ({
          ...prev,
          name: result.data!.name,
          station: result.data!.station,
        }));
      } else {
        setUserFound(null);
        setUserNotFound(true);
      }
    } catch {
      setUserFound(null);
      setUserNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, photo: 'Please select an image file' }));
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, photo: 'Image must be less than 5MB' }));
        return;
      }
      
      setPhoto(file);
      setErrors(prev => ({ ...prev, photo: undefined }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo
  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Reset search
  const resetSearch = () => {
    setFormData({
      serviceNumber: '',
      name: '',
      station: '',
      date: today,
      distanceKm: '',
    });
    setUserFound(null);
    setUserNotFound(false);
    setPhoto(null);
    setPhotoPreview(null);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.serviceNumber.trim()) {
      newErrors.serviceNumber = 'Service number is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else if (formData.date !== today) {
      newErrors.date = 'You can only log runs for today';
    }

    const distance = parseFloat(formData.distanceKm);
    if (!formData.distanceKm || isNaN(distance)) {
      newErrors.distanceKm = 'Distance is required';
    } else if (!/^\d+(\.\d{1,2})?$/.test(formData.distanceKm)) {
      newErrors.distanceKm = 'Use up to two decimals (e.g., 6.12)';
    } else if (distance <= 0) {
      newErrors.distanceKm = 'Distance must be greater than 0';
    } else if (distance > 10) {
      newErrors.distanceKm = 'Single run cannot exceed 10 km (daily limit)';
    }

    // Photo is required
    if (!photo) {
      newErrors.photo = 'Screenshot proof is required';
    }

    setErrors(newErrors);
    
    // Show toast for any validation error
    const errorMessages = Object.values(newErrors).filter(Boolean);
    if (errorMessages.length > 0) {
      setToast({ message: errorMessages[0] as string, type: 'error' });
    }
    
    return Object.keys(newErrors).length === 0;
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Calculate SHA-256 hash of image for duplicate detection
  const calculateImageHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // First check for duplicate
      const duplicateCheck = await checkDuplicateRun(
        formData.serviceNumber.trim(),
        formData.date
      );

      if (duplicateCheck.success && duplicateCheck.data?.maxRunsReached) {
        setErrors({
          general: 'You have already logged 2 runs for today. Maximum 2 runs per day allowed.',
        });
        setIsSubmitting(false);
        return;
      }
      
      // Check if adding this run would exceed 10km daily limit
      const newDistance = parseFloat(formData.distanceKm);
      const currentTotal = duplicateCheck.data?.totalDistance || 0;
      const newTotal = currentTotal + newDistance;
      
      if (newTotal > 10) {
        const remaining = duplicateCheck.data?.remainingDistance || 0;
        if (remaining <= 0) {
          setErrors({
            general: 'You have already reached your 10 km daily limit.',
          });
        } else {
          setErrors({
            general: `This run would exceed your 10 km daily limit. You can only add up to ${remaining.toFixed(2)} km more today.`,
          });
        }
        setIsSubmitting(false);
        return;
      }

      // Prepare photo data if a photo was selected
      let photoPayload = undefined;
      if (photo) {
        try {
          const base64 = await fileToBase64(photo);
          const hash = await calculateImageHash(photo);
          photoPayload = {
            base64,
            mimeType: photo.type,
            hash, // SHA-256 hash for duplicate detection
          };
        } catch (photoError) {
          console.error('Error converting photo:', photoError);
          // Continue without photo if conversion fails
        }
      }

      // If no duplicate, submit the run
      const response = await addRun({
        serviceNumber: formData.serviceNumber.trim(),
        name: formData.name.trim(),
        station: formData.station.trim(),
        date: formData.date,
        distanceKm: parseFloat(formData.distanceKm),
        photo: photoPayload,
      });

      if (response.success) {
        setIsSuccess(true);
        // Refresh dashboard data in background (don't wait)
        refreshData(true);
        // Navigate to dashboard after short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setErrors({
          general: response.error || 'Failed to add run. Please try again.',
        });
      }
    } catch (error) {
      setErrors({
        general: 'An unexpected error occurred. Please try again.',
      });
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="text-center py-12 animate-fade-in">
          <div className="w-20 h-20 bg-success-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success-500" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            Run Logged Successfully!
          </h2>
          <p className="text-primary-400 mb-6">
            Great job! Your {formData.distanceKm} km run has been recorded.
          </p>
          <p className="text-primary-500 text-sm">
            Redirecting to dashboard...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      {/* Fixed Toast Notification - positioned below navbar */}
      {toast && (
        <div className="fixed top-20 left-0 right-0 z-50 animate-fade-in px-4 flex justify-center">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg max-w-[calc(100vw-2rem)] ${
            toast.type === 'error' 
              ? 'bg-danger-500 text-white border border-danger-400' 
              : 'bg-success-500 text-white border border-success-400'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button 
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="text-center mb-6 animate-fade-in">
        <p className="text-sm font-medium text-accent-400 tracking-widest uppercase mb-1">
          Madaveli Police
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          100K RUN CHALLENGE
        </h1>
      </div>

      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h2 className="font-display text-2xl font-bold text-white mb-2">
          Log Your Run
        </h2>
        <p className="text-primary-400">
          Search your service number to get started
        </p>
      </div>

      {/* General Error - keep for inline display too */}
      {errors.general && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-danger-500/10 border border-danger-500/30 mb-6 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
          <p className="text-danger-500 text-sm">{errors.general}</p>
        </div>
      )}

      {/* Container 1: Search */}
      <Card className="animate-fade-in stagger-1 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-accent-400" />
          <h2 className="font-display text-lg font-semibold text-white">Find Your Profile</h2>
        </div>

        <div className="space-y-4">
          {/* Service Number Search */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-primary-200">
              Service Number
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
                  <Hash className="w-5 h-5" />
                </div>
                <input
                  name="serviceNumber"
                  type="text"
                  maxLength={5}
                  value={formData.serviceNumber}
                  onChange={(e) => {
                    // Allow C + 4 digits (civil staff) or just 4 digits (police)
                    let value = e.target.value.toUpperCase();
                    if (value.startsWith('C')) {
                      value = 'C' + value.slice(1).replace(/\D/g, '').slice(0, 4);
                    } else {
                      value = value.replace(/\D/g, '').slice(0, 4);
                    }
                    setFormData(prev => ({ ...prev, serviceNumber: value }));
                    setErrors(prev => ({ ...prev, serviceNumber: undefined }));
                    if (userFound) {
                      resetSearch();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="e.g. 5568"
                  disabled={!!userFound}
                  className={`
                    w-full px-4 py-3 bg-primary-800/50 border rounded-xl text-white placeholder-primary-500
                    outline-none ring-0 focus:ring-2 focus:ring-inset transition-all duration-200 pl-12
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${errors.serviceNumber ? 'border-danger-500 focus:ring-danger-500' : 
                      userFound ? 'border-success-500 focus:ring-success-500' : 'border-primary-700 focus:ring-accent-500'}
                  `}
                />
              </div>
              {!userFound ? (
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-6"
                >
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetSearch}
                  className="px-4"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
            {errors.serviceNumber && (
              <p className="text-danger-500 text-sm font-medium">{errors.serviceNumber}</p>
            )}
          </div>

          {/* User Not Found Message */}
          {userNotFound && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                User not found. Please check your service number or contact admin to register.
              </p>
            </div>
          )}

          {/* User Found - Show Details */}
          {userFound && (
            <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/30 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-success-400 mb-3">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Profile Found</span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Name */}
                <div className="flex items-center gap-3 p-3 bg-primary-800/50 rounded-lg">
                  <User className="w-5 h-5 text-primary-400" />
                  <div>
                    <p className="text-xs text-primary-400">Name</p>
                    <p className="text-white font-medium">{userFound.name}</p>
                  </div>
                </div>
                
                {/* Rank */}
                {userFound.rank && (
                  <div className="flex items-center gap-3 p-3 bg-primary-800/50 rounded-lg">
                    <Hash className="w-5 h-5 text-primary-400" />
                    <div>
                      <p className="text-xs text-primary-400">Rank</p>
                      <p className="text-white font-medium">{userFound.rank}</p>
                    </div>
                  </div>
                )}

                {/* Station */}
                <div className="flex items-center gap-3 p-3 bg-primary-800/50 rounded-lg">
                  <MapPin className="w-5 h-5 text-primary-400" />
                  <div>
                    <p className="text-xs text-primary-400">Station</p>
                    <p className="text-white font-medium">{userFound.station}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Container 2: Run Details - Only shown when user is found */}
      {userFound && (
        <Card className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Route className="w-5 h-5 text-accent-400" />
            <h2 className="font-display text-lg font-semibold text-white">Run Details</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Date (Today Only)"
              name="date"
              type="date"
              value={formData.date}
              onChange={() => {
                // Date is locked to today - show error if user tries to change
                setErrors(prev => ({ ...prev, date: 'You can only log runs for today' }));
              }}
              min={today}
              max={today}
              error={errors.date}
              icon={<Calendar className="w-5 h-5" />}
              disabled
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-primary-200">
                Distance (KM) <span className="text-primary-500 text-xs">Max 10 KM</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-400">
                  <Route className="w-5 h-5" />
                </div>
                <input
                  name="distanceKm"
                  type="number"
                  value={formData.distanceKm}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^0-9.]/g, '');
                    if (value.includes('.')) {
                      const [i, d] = value.split('.');
                      value = d !== undefined ? `${i}.${d.slice(0, 2)}` : i;
                    }
                    // Prevent entering more than 10
                    if (parseFloat(value) > 10) {
                      setErrors(prev => ({ ...prev, distanceKm: 'Distance cannot exceed 10 KM' }));
                    } else {
                      setErrors(prev => ({ ...prev, distanceKm: undefined }));
                    }
                    setFormData(prev => ({ ...prev, distanceKm: value }));
                  }}
                  placeholder="e.g., 5.5"
                  step="0.01"
                  min="0.1"
                  max="10"
                  inputMode="decimal"
                  className={`
                    w-full px-4 py-3 bg-primary-800/50 border rounded-xl text-white placeholder-primary-500
                    outline-none ring-0 focus:ring-2 focus:ring-inset transition-all duration-200 pl-12
                    ${errors.distanceKm ? 'border-danger-500 focus:ring-danger-500' : 'border-primary-700 focus:ring-accent-500'}
                  `}
                />
              </div>
              {errors.distanceKm && (
                <p className="text-danger-500 text-sm font-medium">{errors.distanceKm}</p>
              )}
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-primary-200">
                Screenshot Proof <span className="text-danger-500">*</span>
              </label>
              
              {!photoPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                    hover:border-accent-500 hover:bg-accent-500/5 transition-all duration-200
                    ${errors.photo ? 'border-danger-500 bg-danger-500/5' : 'border-primary-700'}`}
                >
                  <Camera className={`w-10 h-10 mx-auto mb-3 ${errors.photo ? 'text-danger-500' : 'text-primary-500'}`} />
                  <p className="text-primary-300 font-medium mb-1">Upload screenshot from Strava</p>
                  <p className="text-primary-500 text-sm">Click to browse or drag and drop</p>
                  <p className="text-primary-600 text-xs mt-2">JPG, PNG up to 5MB</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={photoPreview}
                    alt="Run preview"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="flex items-center gap-2 text-white text-sm">
                      <Image className="w-4 h-4" />
                      <span className="truncate">{photo?.name}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              
              {errors.photo && (
                <p className="text-danger-500 text-sm font-medium">{errors.photo}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-6"
            >
              {isSubmitting ? 'Saving...' : 'Log Run'}
            </Button>
          </form>
        </Card>
      )}

      {/* Tips - Always visible */}
      <div className="mt-6 p-4 rounded-xl bg-primary-800/30 border border-primary-700/30 animate-fade-in stagger-2">
        <h3 className="font-medium text-primary-200 mb-2">💡 Tips</h3>
        <ul className="text-sm text-primary-400 space-y-1">
          <li>• You can only log one run per day</li>
          <li>• Maximum distance is 10 KM per run</li>
          <li>• Screenshot proof from Strava is <span className="text-accent-400 font-medium">required</span></li>
        </ul>
      </div>
    </div>
  );
}
