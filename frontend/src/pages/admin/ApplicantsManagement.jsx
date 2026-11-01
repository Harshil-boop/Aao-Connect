import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Download,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatIndianDateTime, getAvatarGradient, getInitials } from '../../utils/adminHelpers';
import EmailComposerModal from './EmailComposerModal';
import EmailHistoryModal from './EmailHistoryModal';

export default function ApplicantsManagement() {
  const { token } = useAdminAuth();

  // Date and Month Input DOM Refs
  const dateInputRef = useRef(null);
  const monthInputRef = useRef(null);

  // Trigger native date/month picker dropdown anywhere inside the box
  const handleOpenDatePicker = () => {
    try {
      if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current?.focus();
      }
    } catch (e) {
      dateInputRef.current?.focus();
    }
  };

  const handleOpenMonthPicker = () => {
    try {
      if (monthInputRef.current && typeof monthInputRef.current.showPicker === 'function') {
        monthInputRef.current.showPicker();
      } else {
        monthInputRef.current?.focus();
      }
    } catch (e) {
      monthInputRef.current?.focus();
    }
  };

  // Applicants state
  const [applicants, setApplicants] = useState([]);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  // Filter / Query state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Modals state
  const [viewingApplicant, setViewingApplicant] = useState(null);
  const [editingApplicant, setEditingApplicant] = useState(null);
  const [deletingApplicant, setDeletingApplicant] = useState(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({ fullName: '', email: '', mobileNumber: '', description: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete action state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Database operation toast notification
  const [actionToast, setActionToast] = useState(null);

  // Email Campaigns & Selection state
  const [selectedApplicantsMap, setSelectedApplicantsMap] = useState(new Map());
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [isEmailHistoryOpen, setIsEmailHistoryOpen] = useState(false);

  // Toggle single applicant selection
  const handleToggleSelect = (applicant) => {
    setSelectedApplicantsMap((prev) => {
      const next = new Map(prev);
      if (next.has(applicant.id)) {
        next.delete(applicant.id);
      } else {
        next.set(applicant.id, applicant);
      }
      return next;
    });
  };

  const isAllCurrentPageSelected =
    applicants.length > 0 && applicants.every((a) => selectedApplicantsMap.has(a.id));
  const isSomeCurrentPageSelected =
    applicants.some((a) => selectedApplicantsMap.has(a.id)) && !isAllCurrentPageSelected;

  // Toggle select all visible on current page
  const handleToggleSelectAllCurrentPage = () => {
    setSelectedApplicantsMap((prev) => {
      const next = new Map(prev);
      if (isAllCurrentPageSelected) {
        applicants.forEach((a) => next.delete(a.id));
      } else {
        applicants.forEach((a) => next.set(a.id, a));
      }
      return next;
    });
  };

  // Select all matching database records
  const handleSelectAllInDatabase = async () => {
    try {
      const params = new URLSearchParams({
        search,
        dateFilter,
        monthFilter,
        sortBy,
        page: '1',
        limit: '10000',
      });
      const res = await fetch(`/api/admin/applicants?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.records) {
        const next = new Map();
        data.records.forEach((r) => next.set(r.id, r));
        setSelectedApplicantsMap(next);
      }
    } catch (err) {
      console.error('Error selecting all database records:', err);
    }
  };

  // Clear current selection
  const handleClearSelection = () => {
    setSelectedApplicantsMap(new Map());
  };

  // Callback when a campaign is queued or scheduled
  const handleCampaignCreated = (campaign, mode) => {
    setActionToast({
      type: 'success',
      text:
        mode === 'scheduled'
          ? `Campaign #${campaign.id} successfully scheduled for automated delivery!`
          : `Campaign #${campaign.id} queued for immediate delivery to ${
              campaign.total_recipients || campaign.recipientsCount
            } recipient(s)!`,
    });
    setTimeout(() => setActionToast(null), 6000);
    handleClearSelection();
  };

  // Fetch Applicants from Neon DB
  const fetchApplicants = useCallback(async () => {
    if (!token) return;
    setApplicantsLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        sortBy,
        dateFilter,
        monthFilter,
        page: String(page),
        limit: String(limit),
      });

      const res = await fetch(`/api/admin/applicants?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setApplicants(data.records);
        setTotalApplicants(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Error fetching applicants:', err);
    } finally {
      setApplicantsLoading(false);
    }
  }, [token, search, sortBy, dateFilter, monthFilter, page, limit]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  // Clear filters
  const handleClearFilters = () => {
    setSearch('');
    setDateFilter('');
    setMonthFilter('');
    setSortBy('newest');
    setPage(1);
  };

  // Export CSV
  const handleExportCsv = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ search, dateFilter, monthFilter, sortBy });
      const res = await fetch(`/api/admin/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applicants_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting CSV: ' + err.message);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingApplicant(item);
    setEditFormData({
      fullName: item.full_name,
      email: item.email,
      mobileNumber: item.mobile_number,
      description: item.description || '',
    });
    setEditError(null);
  };

  // Save Edit to PostgreSQL Database
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/admin/applicants/${editingApplicant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.errors) {
          const detail = Object.values(data.errors).join(', ');
          throw new Error(detail || data.message || 'Failed to update record in database');
        }
        throw new Error(data.message || 'Failed to update record in database');
      }

      const updatedId = editingApplicant.id;
      const updatedName = editFormData.fullName;
      setEditingApplicant(null);
      setActionToast({
        type: 'success',
        text: `Applicant #${updatedId} (${updatedName}) updated successfully in database!`,
      });
      setTimeout(() => setActionToast(null), 5000);
      fetchApplicants();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Confirm Delete from PostgreSQL Database
  const handleConfirmDelete = async () => {
    if (!deletingApplicant) return;
    setDeleteLoading(true);
    try {
      const targetId = deletingApplicant.id;
      const targetName = deletingApplicant.full_name;

      const res = await fetch(`/api/admin/applicants/${targetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete applicant from database');
      }

      setDeletingApplicant(null);
      setActionToast({
        type: 'success',
        text: `Applicant #${targetId} (${targetName}) permanently deleted from database!`,
      });
      setTimeout(() => setActionToast(null), 5000);
      fetchApplicants();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Applicants Management
            </h1>
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-sm">
              {totalApplicants} Candidates
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Search, filter, view, edit, delete, and export candidate records directly in Neon PostgreSQL
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Send Custom Email Action */}
          <button
            onClick={() => setIsEmailComposerOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 transition active:scale-95 cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Send Custom Email</span>
          </button>

          {/* Email Schedules & History */}
          <button
            onClick={() => setIsEmailHistoryOpen(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer"
            title="View scheduled emails, in-flight progress & audit logs"
          >
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Schedules &amp; History</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/25 transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          {/* Refresh Table */}
          <button
            onClick={fetchApplicants}
            disabled={applicantsLoading}
            className="p-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition cursor-pointer"
            title="Refresh table data"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${applicantsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Toast Feedback Banner */}
      {actionToast && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold transition shadow-sm animate-fadeIn ${
            actionToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {actionToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{actionToast.text}</span>
          </div>
          <button
            onClick={() => setActionToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>
          </div>

          {/* Filter by exact date - Fully clickable box */}
          <div
            onClick={handleOpenDatePicker}
            className="relative cursor-pointer group"
          >
            <input
              ref={dateInputRef}
              type="date"
              value={dateFilter}
              onClick={handleOpenDatePicker}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition cursor-pointer select-none"
              title="Click anywhere in this box to open date picker"
            />
          </div>

          {/* Filter by month - Fully clickable box */}
          <div className="flex items-center space-x-2">
            <div
              onClick={handleOpenMonthPicker}
              className="relative cursor-pointer group w-full"
            >
              <input
                ref={monthInputRef}
                type="month"
                value={monthFilter}
                onClick={handleOpenMonthPicker}
                onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition cursor-pointer select-none"
                title="Click anywhere in this box to open month picker"
              />
            </div>
            {(search || dateFilter || monthFilter || sortBy !== 'newest') && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex-shrink-0 cursor-pointer"
                title="Clear filters"
              >
                Clear
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Floating / Active Selection Banner */}
      {selectedApplicantsMap.size > 0 && (
        <div className="p-3.5 px-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-xs text-white shadow-md">
              {selectedApplicantsMap.size}
            </span>
            <div className="text-xs sm:text-sm">
              <span className="font-bold">
                {selectedApplicantsMap.size} candidate{selectedApplicantsMap.size > 1 ? 's' : ''} selected
              </span>
              {selectedApplicantsMap.size < totalApplicants && (
                <button
                  type="button"
                  onClick={handleSelectAllInDatabase}
                  className="ml-2.5 underline text-indigo-300 hover:text-white font-medium transition cursor-pointer"
                >
                  Select all {totalApplicants} candidates in database
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsEmailComposerOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center space-x-2"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Compose Custom Email ({selectedApplicantsMap.size})</span>
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Elevated Dynamic Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-700">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeCurrentPageSelected;
                    }}
                    onChange={handleToggleSelectAllCurrentPage}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    title="Select all visible applicants on this page"
                  />
                </th>
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Submitted At (IST)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applicantsLoading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span className="font-medium">Loading applicant records from Neon DB...</span>
                  </td>
                </tr>
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <p className="font-medium">No applicant records match your filter criteria.</p>
                  </td>
                </tr>
              ) : (
                applicants.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition duration-150 group ${
                      selectedApplicantsMap.has(item.id)
                        ? 'bg-indigo-50/60 hover:bg-indigo-50/80'
                        : 'hover:bg-indigo-50/30'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedApplicantsMap.has(item.id)}
                        onChange={() => handleToggleSelect(item)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    {/* ID */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                        #{item.id}
                      </span>
                    </td>

                    {/* Full Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${getAvatarGradient(item.full_name)} text-white font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0`}>
                          {getInitials(item.full_name)}
                        </div>
                        <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition">
                          {item.full_name}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4">
                      <a
                        href={`mailto:${item.email}`}
                        className="text-slate-600 hover:text-indigo-600 font-medium inline-flex items-center space-x-1"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-[180px]">{item.email}</span>
                      </a>
                    </td>

                    {/* Mobile */}
                    <td className="py-3.5 px-4">
                      <a
                        href={`tel:${item.mobile_number}`}
                        className="text-slate-600 hover:text-indigo-600 font-medium inline-flex items-center space-x-1"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{item.mobile_number}</span>
                      </a>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      {item.description ? (
                        <p className="truncate text-slate-600 text-xs" title={item.description}>
                          {item.description}
                        </p>
                      ) : (
                        <span className="text-slate-300 italic text-xs">None</span>
                      )}
                    </td>

                    {/* Submitted At (IST) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                        <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{formatIndianDateTime(item.created_at)}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* View */}
                        <button
                          onClick={() => setViewingApplicant(item)}
                          className="p-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition duration-200 shadow-sm cursor-pointer"
                          title="View candidate details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 rounded-xl text-amber-600 bg-amber-50 hover:bg-amber-600 hover:text-white transition duration-200 shadow-sm cursor-pointer"
                          title="Edit candidate record in DB"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeletingApplicant(item)}
                          className="p-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white transition duration-200 shadow-sm cursor-pointer"
                          title="Permanently delete from DB"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>records &bull; Total {totalApplicants} applicants</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODAL */}
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

      {/* EDIT MODAL */}
      {editingApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${getAvatarGradient(editFormData.fullName)} text-white font-black text-xs flex items-center justify-center shadow-md flex-shrink-0`}>
                  {getInitials(editFormData.fullName)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Edit Applicant #{editingApplicant.id}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Changes will save directly to Neon PostgreSQL database</p>
                </div>
              </div>
              <button
                onClick={() => setEditingApplicant(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 my-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center space-x-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span className="font-semibold">{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="py-4 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (10 digits)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile number"
                  required
                  value={editFormData.mobileNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition resize-y"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setEditingApplicant(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {editLoading ? 'Saving in Database...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deletingApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-md shadow-rose-500/10">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-slate-900">Delete Applicant Record?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{deletingApplicant.full_name}</strong> (#{deletingApplicant.id})? This will <strong className="text-rose-600">permanently erase</strong> the record from the Neon PostgreSQL database.
            </p>
            <div className="mt-6 flex items-center justify-center space-x-3">
              <button
                onClick={() => setDeletingApplicant(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete from DB'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM EMAIL COMPOSER MODAL */}
      <EmailComposerModal
        isOpen={isEmailComposerOpen}
        onClose={() => setIsEmailComposerOpen(false)}
        token={token}
        selectedApplicants={Array.from(selectedApplicantsMap.values())}
        totalApplicants={totalApplicants}
        filterCriteria={{ search, dateFilter, monthFilter }}
        onCampaignCreated={handleCampaignCreated}
      />

      {/* EMAIL HISTORY & SCHEDULES MODAL */}
      <EmailHistoryModal
        isOpen={isEmailHistoryOpen}
        onClose={() => setIsEmailHistoryOpen(false)}
        token={token}
      />

    </div>
  );
}

