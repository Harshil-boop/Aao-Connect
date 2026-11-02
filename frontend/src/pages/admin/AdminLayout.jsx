import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  GraduationCap,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { getApiUrl } from '../../utils/api';

export default function AdminLayout() {
  const { admin, logout, isAuthenticated, loading: authLoading, token } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Check auth
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin-panel/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch count for sidebar badge
  useEffect(() => {
    if (!token) return;
    fetch(getApiUrl('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats?.totalApplications !== undefined) {
          setTotalCount(data.stats.totalApplications);
        }
      })
      .catch(() => {});
  }, [token, location.pathname]);

  const navItems = [
    { name: 'Dashboard Overview', path: '/admin-panel', icon: LayoutDashboard, end: true },
    { name: 'Applicants', path: '/admin-panel/applicants', icon: Users, badge: totalCount },
    { name: 'Account Settings', path: '/admin-panel/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-800">
      
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 p-5 justify-between">
        <div>
          {/* Brand */}
          <div className="flex items-center space-x-3 px-2 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 flex-shrink-0">
              <GraduationCap className="w-6 h-6 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-rose-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                  Aao Seekhe
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-400">Admin Management Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`
                  }
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer / Profile / Logout */}
        <div className="pt-6 border-t border-slate-800 space-y-3">
          <div className="px-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Logged In As</p>
            <p className="text-xs font-mono text-slate-300 truncate mt-0.5">{admin?.email}</p>
          </div>

          <Link
            to="/"
            target="_blank"
            className="flex items-center space-x-2 text-xs text-indigo-400 hover:text-indigo-300 px-2 transition font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Public Form</span>
          </Link>

          <button
            onClick={logout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/25 flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-sm bg-gradient-to-r from-amber-400 via-rose-400 to-indigo-400 bg-clip-text text-transparent">
              Aao Seekhe
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Admin Portal</p>
          </div>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="md:hidden bg-slate-800 text-white p-4 border-b border-slate-700 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`
              }
            >
              <span>{item.name}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
          <div className="pt-2 border-t border-slate-700 flex justify-between items-center text-xs">
            <Link to="/" target="_blank" className="text-indigo-400 font-medium">View Public Form</Link>
            <button onClick={logout} className="text-rose-400 font-bold cursor-pointer">Sign Out</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-7 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  );
}

