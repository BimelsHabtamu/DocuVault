import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import GeneratorSidebar from './GeneratorSidebar';
import GeneratorNavbar  from './GeneratorNavbar';

export default function GeneratorLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden bg-black/40 backdrop-blur-[1px]"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40
        lg:static lg:z-auto lg:flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <GeneratorSidebar onClose={() => setMobileOpen(false)} />
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <GeneratorNavbar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-5 sm:py-7">
            <Outlet />
          </div>
        </main>

        <footer className="flex-shrink-0 px-6 py-2.5 flex items-center justify-between
          bg-white border-t border-gray-200">
          <p className="text-[11px] text-gray-400">DocuVault Generator</p>
          <p className="text-[11px] text-gray-400">© {new Date().getFullYear()} DocuVault</p>
        </footer>
      </div>
    </div>
  );
}
