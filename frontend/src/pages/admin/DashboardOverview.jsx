import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Clock,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  Mail,
  Phone,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatIndianDateTime, getAvatarGradient, getInitials } from '../../utils/adminHelpers';

export default function DashboardOverview({ onNavigateToApplicants }) {
  const { token } = useAdminAuth();
  const navigate = useNavigate();

  const handleGoToApplicants = onNavigateToApplicants || (() => navigate('/admin-panel/applicants'));

  const [stats, setStats] = useState({
    totalApplications: 0,
    todayApplications: 0,
    monthApplications: 0,
    latestApplication: null,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [recentApplicants, setRecentApplicants] = useState([]);
  const [viewingApplicant, setViewingApplicant] = useState(null);

  const fetchStatsAndRecent = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const [statsRes, applicantsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/applicants?limit=5&sortBy=newest', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (applicantsRes.ok) {
        const applicantsData = await applicantsRes.json();
        setRecentApplicants(applicantsData.records || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard overview data:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatsAndRecent();
  }, [fetchStatsAndRecent]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Dashboard Overview
            </h1>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Database</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time statistics of candidate registrations stored in Neon PostgreSQL
          </p>
        </div>

        <button
          onClick={fetchStatsAndRecent}
          disabled={statsLoading}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:shadow transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${statsLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 4 Dynamic & Colorful Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Total Applications */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition duration-200 group">
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Candidates</span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition duration-200">
                <Layers className="w-5 h-5 drop-shadow-sm" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {stats.totalApplications}
            </p>
            <div className="mt-2 flex items-center space-x-1.5">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                All-Time
              </span>
              <span className="text-[11px] text-slate-400">Persistent records in DB</span>
            </div>
          </div>
        </div>

        {/* Card 2: Today's Applications */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition duration-200 group">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-400"></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Activity</span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition duration-200">
                <Clock className="w-5 h-5 drop-shadow-sm" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {stats.todayApplications}
            </p>
            <div className="mt-2 flex items-center space-x-1.5">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                Today (IST)
              </span>
              <span className="text-[11px] text-slate-400">Indian Standard Time</span>
            </div>
          </div>
        </div>

        {/* Card 3: This Month */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition duration-200 group">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month</span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-105 transition duration-200">
                <Calendar className="w-5 h-5 drop-shadow-sm" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {stats.monthApplications}
            </p>
            <div className="mt-2 flex items-center space-x-1.5">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                Monthly
              </span>
              <span className="text-[11px] text-slate-400">Current calendar cycle</span>
            </div>
          </div>
        </div>

        {/* Card 4: Latest Received */}
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition duration-200 group">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600"></div>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latest Received</span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 group-hover:scale-105 transition duration-200">
                <Sparkles className="w-5 h-5 drop-shadow-sm" />
              </div>
            </div>
            {stats.latestApplication ? (
              <div>
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${getAvatarGradient(stats.latestApplication.full_name)} text-white font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0`}>
                    {getInitials(stats.latestApplication.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{stats.latestApplication.full_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{stats.latestApplication.email}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                    <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    <span>{formatIndianDateTime(stats.latestApplication.created_at)}</span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No applications yet</p>
            )}
          </div>
        </div>

      </div>

      {/* Recent Applications Snapshot */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
            <h3 className="text-base font-black text-slate-900">Recent Applications Snapshot</h3>
          </div>
          <button
            onClick={handleGoToApplicants}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer"
          >
            <span>View All Candidates</span>
            <span className="text-indigo-500 font-extrabold">&rarr;</span>
          </button>
        </div>

        {recentApplicants.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">No applicants have registered yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentApplicants.map((app) => (
              <div key={app.id} className="p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition duration-150">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${getAvatarGradient(app.full_name)} text-white font-black text-xs flex items-center justify-center shadow-md flex-shrink-0`}>
                    {getInitials(app.full_name)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{app.full_name}</h4>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center space-x-1 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{app.email}</span>
                      </span>
                      <span className="hidden sm:flex items-center space-x-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{app.mobile_number}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatIndianDateTime(app.created_at)}</span>
                  </span>
                  <button
                    onClick={() => setViewingApplicant(app)}
                    className="p-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition duration-200 cursor-pointer shadow-sm"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      {viewingApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(viewingApplicant.full_name)} text-white font-black text-sm flex items-center justify-center shadow-md flex-shrink-0`}>
                  {getInitials(viewingApplicant.full_name)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{viewingApplicant.full_name}</h3>
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Candidate #{viewingApplicant.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingApplicant(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</span>
                  <div className="flex items-center space-x-2 text-slate-800 font-semibold break-all">
                    <Mail className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span>{viewingApplicant.email}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mobile Number</span>
                  <div className="flex items-center space-x-2 text-slate-800 font-semibold">
                    <Phone className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{viewingApplicant.mobile_number}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                  {viewingApplicant.description || <span className="italic text-slate-400">No additional notes provided.</span>}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Submitted At (IST)</span>
                  <span className="font-semibold text-slate-800 text-xs sm:text-sm">{formatIndianDateTime(viewingApplicant.created_at)}</span>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-700">
                  Asia/Kolkata
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingApplicant(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
