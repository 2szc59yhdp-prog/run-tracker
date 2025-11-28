import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AddRun from './pages/AddRun';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import { RegisteredUsers } from './pages/RegisteredUsers';

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="add-run" element={<AddRun />} />
          <Route path="admin-login" element={<AdminLogin />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/users" element={<RegisteredUsers />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default App;

