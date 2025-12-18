import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AddRun from './pages/AddRun';
import AdminLogin from './pages/AdminLogin';
import ParticipantLogin from './pages/ParticipantLogin';
import Admin from './pages/Admin';
import AdminReport from './pages/AdminReport';
import { RegisteredUsers } from './pages/RegisteredUsers';
import Sponsors from './pages/Sponsors';
import Outstanding from './pages/Outstanding';
import PinList from './pages/PinList';
import ActiveDays from './pages/ActiveDays';
import FinishersList from './pages/FinishersList';
import SponsorsView from './pages/SponsorsView';

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/participant-login" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="add-run" element={<AddRun />} />
          <Route path="participant-login" element={<ParticipantLogin />} />
          <Route path="admin-login" element={<AdminLogin />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/report" element={<AdminReport />} />
          <Route path="admin/active-days" element={<ActiveDays />} />
          <Route path="active-days" element={<ActiveDays />} />
          <Route path="admin/finishers" element={<FinishersList />} />
          <Route path="admin/pins" element={<PinList />} />
          <Route path="admin/users" element={<RegisteredUsers />} />
          <Route path="admin/sponsors" element={<Sponsors />} />
          <Route path="sponsors-view" element={<SponsorsView />} />
          <Route path="admin/outstanding" element={<Outstanding />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default App;
