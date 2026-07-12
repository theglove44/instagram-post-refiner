import Sidebar from '../components/Sidebar.js';
import { Toaster } from '@/components/ui/toaster.jsx';

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
      <Toaster />
    </div>
  );
}
