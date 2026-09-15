import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

/** Sidebar is open by default on desktop (≥1024px), closed on mobile/tablet. */
const DESKTOP_BP = 1024;

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= DESKTOP_BP
  );

  useEffect(() => {
    let userToggled = false;
    const handleResize = () => {
      if (userToggled) return;
      setSidebarOpen(window.innerWidth >= DESKTOP_BP);
    };
    const markUserToggled = () => { userToggled = true; };
    window.addEventListener('resize', handleResize);
    window.addEventListener('sidebar-toggle', markUserToggled);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('sidebar-toggle', markUserToggled);
    };
  }, []);

  const toggleSidebar = () => {
    window.dispatchEvent(new Event('sidebar-toggle'));
    setSidebarOpen((o) => !o);
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}
      <div className={`app-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <Navbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
