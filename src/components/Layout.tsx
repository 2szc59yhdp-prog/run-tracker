import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-primary-900 flex flex-col">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl" />
      </div>
      
      <Navbar />
      
      <main className="flex-1 relative z-[60]">
        <Outlet />
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-primary-400 text-sm border-t border-primary-800/50">
        <p>© {new Date().getFullYear()} Madaveli Police • 100K Run Challenge 🏃</p>
      </footer>
    </div>
  );
}
