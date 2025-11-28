import { Link } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Trophy, Users, TrendingUp } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';
import { useApp } from '../context/AppContext';

export default function Home() {
  const { dashboardStats, isLoading } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
      {/* Hero Section */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-accent-400 to-accent-600 rounded-3xl shadow-2xl shadow-accent-600/30 mb-6">
          <span className="text-4xl">🏃</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
          Run Tracker
        </h1>
        <p className="text-primary-300 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
          Daily run log and leaderboard for staff. Track your progress, compete with colleagues, and stay fit together.
        </p>
      </div>

      {/* Quick Stats */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-10 animate-fade-in stagger-1">
          <Card className="text-center py-4 sm:py-6">
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-accent-400 mx-auto mb-2" />
            <p className="text-xl sm:text-2xl font-display font-bold text-white">
              {dashboardStats.totalDistance.toFixed(1)}
            </p>
            <p className="text-xs sm:text-sm text-primary-400">Total KM</p>
          </Card>
          <Card className="text-center py-4 sm:py-6">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-success-500 mx-auto mb-2" />
            <p className="text-xl sm:text-2xl font-display font-bold text-white">
              {dashboardStats.uniqueRunners}
            </p>
            <p className="text-xs sm:text-sm text-primary-400">Runners</p>
          </Card>
          <Card className="text-center py-4 sm:py-6">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-warning-500 mx-auto mb-2" />
            <p className="text-xl sm:text-2xl font-display font-bold text-white">
              {dashboardStats.totalRuns}
            </p>
            <p className="text-xs sm:text-sm text-primary-400">Runs</p>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in stagger-2">
        <Link to="/add-run" className="w-full sm:w-auto">
          <Button
            size="lg"
            icon={<PlusCircle className="w-5 h-5" />}
            className="w-full"
          >
            Add Today's Run
          </Button>
        </Link>
        <Link to="/dashboard" className="w-full sm:w-auto">
          <Button
            variant="secondary"
            size="lg"
            icon={<LayoutDashboard className="w-5 h-5" />}
            className="w-full"
          >
            View Dashboard
          </Button>
        </Link>
      </div>

      {/* Info Cards */}
      <div className="mt-16 grid sm:grid-cols-2 gap-6 animate-fade-in stagger-3">
        <Card hover>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-accent-600/20 text-accent-400">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white text-lg mb-2">
                Log Your Run
              </h3>
              <p className="text-primary-400 text-sm leading-relaxed">
                Record your daily run with your service number, name, station, and distance. One entry per day keeps it fair!
              </p>
            </div>
          </div>
        </Card>
        <Card hover>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-success-500/20 text-success-500">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white text-lg mb-2">
                Climb the Leaderboard
              </h3>
              <p className="text-primary-400 text-sm leading-relaxed">
                See how you rank against your colleagues. Total distance determines your position. Keep running to stay on top!
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

