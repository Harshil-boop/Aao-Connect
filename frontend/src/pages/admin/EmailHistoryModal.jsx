import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  History,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Ban,
  Eye,
  Search,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  Edit,
  Trash2,
} from 'lucide-react';
import { formatIndianDateTime } from '../../utils/adminHelpers';
import { getApiUrl } from '../../utils/api';

export default function EmailHistoryModal({ isOpen, onClose, token }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'scheduled' | 'processing'
  const [campaigns, setCampaigns] = useState([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Recipient audit log state
  const [auditingCampaign, setAuditingCampaign] = useState(null);
  const [recipientLogs, setRecipientLogs] = useState([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientLoading, setRecipientLoading] = useState(false);

  // Edit Scheduled Campaign State
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editScheduleDate, setEditScheduleDate] = useState('');
  const [editScheduleTime, setEditScheduleTime] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const statusParam = activeTab === 'all' ? '' : activeTab;
      const res = await fetch(getApiUrl(`/api/admin/emails/campaigns?page=${page}&limit=10&status=${statusParam}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.campaigns || []);
        setTotalCampaigns(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [token, page, activeTab]);

  useEffect(() => {
    fetchCampaigns();
    // Auto refresh while modal is open every 10 seconds to show live progress
    const timer = setInterval(fetchCampaigns, 10000);
    return () => clearInterval(timer);
  }, [fetchCampaigns]);

  // Fetch Recipient Audit Logs
  const fetchRecipientLogs = useCallback(async () => {
    if (!auditingCampaign || !token) return;
    setRecipientLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(recipientPage),
        limit: '25',
        status: recipientStatusFilter,
        search: recipientSearch,
      });

      const res = await fetch(getApiUrl(`/api/admin/emails/campaigns/${auditingCampaign.id}/recipients?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRecipientLogs(data.recipients || []);
        setRecipientTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading recipient audit logs:', err);
    } finally {
      setRecipientLoading(false);
    }
  }, [auditingCampaign, token, recipientPage, recipientStatusFilter, recipientSearch]);

  useEffect(() => {
    if (auditingCampaign) {
      fetchRecipientLogs();
    }
  }, [auditingCampaign, fetchRecipientLogs]);

  // Stop / Cancel Active or Scheduled Campaign
  const handleStopCampaign = async (campaignId) => {
    if (!window.confirm(`Are you sure you want to stop/cancel Campaign #${campaignId}? Future dispatches will be halted.`)) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/emails/campaigns/${campaignId}/cancel`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Campaign #${campaignId} stopped successfully.`);
        fetchCampaigns();
      } else {
        showToast('error', data.message || 'Failed to stop campaign');
      }
    } catch (err) {
      showToast('error', err.message);
    }
  };

  // Permanently Delete Campaign
  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm(`Are you sure you want to permanently delete Campaign #${campaignId} and all associated delivery logs?`)) return;
    try {
      const res = await fetch(getApiUrl(`/api/admin/emails/campaigns/${campaignId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Campaign #${campaignId} and delivery records deleted permanently.`);
        fetchCampaigns();
      } else {
        showToast('error', data.message || 'Failed to delete campaign');
      }
    } catch (err) {
      showToast('error', err.message);
    }
  };

  // Retry Failed Recipients
  const handleRetryFailed = async (campaignId) => {
    try {
      const res = await fetch(getApiUrl(`/api/admin/emails/campaigns/${campaignId}/retry`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', `Retrying delivery for ${data.retryingCount} failed recipient(s)...`);
        fetchCampaigns();
      } else {
        showToast('error', data.message || 'Failed to retry recipients');
      }
    } catch (err) {
      showToast('error', err.message);
    }
  };

  // Open Edit Scheduled Campaign
  const handleOpenEdit = (c) => {
    setEditingCampaign(c);
    setEditSubject(c.subject);
    setEditBody(c.body_html);
    if (c.scheduled_at) {
      const d = new Date(c.scheduled_at);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      setEditScheduleDate(`${yyyy}-${mm}-${dd}`);
      setEditScheduleTime(`${hh}:${min}`);
    }
  };

  // Save Edit Scheduled Campaign
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCampaign) return;
    setIsUpdating(true);
    try {
      const targetTime = `${editScheduleDate}T${editScheduleTime}:00`;
      const res = await fetch(getApiUrl(`/api/admin/emails/campaigns/${editingCampaign.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: editSubject,
          bodyHtml: editBody,
          scheduledAt: new Date(targetTime).toISOString(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', 'Scheduled campaign updated successfully.');
        setEditingCampaign(null);
        fetchCampaigns();
      } else {
        showToast('error', data.message || 'Failed to update campaign');
      }
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Completed</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-600" />
            <span>Scheduled</span>
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Queued</span>
          </span>
        );
      case 'partially_failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span>Partial Failures</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Ban className="w-3 h-3 text-slate-500" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Email Campaigns & History</h2>
              <p className="text-xs text-slate-300">
                Track live dispatch, scheduled automated broadcasts & delivery logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close history modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toast Feedback */}
        {toast && (
          <div
            className={`m-4 p-3 rounded-2xl flex items-center space-x-2 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Sub-header Tabs & Filters */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setActiveTab('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Campaigns ({totalCampaigns})
            </button>
            <button
              onClick={() => { setActiveTab('scheduled'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Scheduled Only
            </button>
            <button
              onClick={() => { setActiveTab('processing'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'processing'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Active / In-Flight
            </button>
          </div>

          <button
            onClick={fetchCampaigns}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer shadow-xs"
            title="Refresh campaign data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && campaigns.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
              <span>Loading campaign records...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">No campaigns found in this view.</p>
              <p className="text-xs text-slate-400 mt-1">Use the "Send Custom Email" button to dispatch or schedule candidate communications.</p>
            </div>
          ) : (
            campaigns.map((c) => {
              const total = c.total_recipients || 0;
              const sent = parseInt(c.actual_sent || c.sent_count || 0, 10);
              const failed = parseInt(c.actual_failed || c.failed_count || 0, 10);
              const pending = parseInt(c.actual_pending || Math.max(0, total - sent - failed), 10);
              const percent = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

              return (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-200 bg-white hover:shadow-md transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                          #{c.id}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                          {c.subject}
                        </h3>
                        {getStatusBadge(c.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                        <span>
                          Target: <strong className="text-slate-700 capitalize">{c.recipient_type}</strong> ({total} recipients)
                        </span>
                        <span>
                          Created: <strong className="text-slate-700">{formatIndianDateTime(c.created_at)}</strong>
                        </span>
                        {c.scheduled_at && (
                          <span className="text-purple-700 font-semibold flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Scheduled for: {formatIndianDateTime(c.scheduled_at)} IST</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Audit Logs */}
                      <button
                        onClick={() => { setAuditingCampaign(c); setRecipientPage(1); }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                        title="Audit delivery status per recipient"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Audit Logs</span>
                      </button>

                      {/* Edit Scheduled Campaign */}
                      {c.status === 'scheduled' && (
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-bold transition cursor-pointer"
                          title="Edit scheduled time/subject"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Stop Scheduled / Queued / Active Campaign */}
                      {(c.status === 'scheduled' || c.status === 'queued' || c.status === 'processing') && (
                        <button
                          onClick={() => handleStopCampaign(c.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                          title="Stop email dispatch immediately"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Stop</span>
                        </button>
                      )}

                      {/* Retry Failed */}
                      {failed > 0 && c.status !== 'processing' && (
                        <button
                          onClick={() => handleRetryFailed(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1 cursor-pointer"
                          title="Retry delivery for failed recipients only"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry ({failed})</span>
                        </button>
                      )}

                      {/* Delete Campaign */}
                      <button
                        onClick={() => handleDeleteCampaign(c.id)}
                        className="p-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
                        title="Permanently delete campaign & delivery logs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Breakdown */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <div className="flex items-center space-x-3">
                        <span className="text-emerald-700 font-bold">Sent: {sent}</span>
                        {failed > 0 && <span className="text-rose-600 font-bold">Failed: {failed}</span>}
                        {pending > 0 && <span className="text-slate-400">Pending: {pending}</span>}
                      </div>
                      <span>{percent}% Completed</span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      {sent > 0 && (
                        <div
                          style={{ width: `${(sent / total) * 100}%` }}
                          className="bg-emerald-500 h-full transition-all duration-300"
                        />
                      )}
                      {failed > 0 && (
                        <div
                          style={{ width: `${(failed / total) * 100}%` }}
                          className="bg-rose-500 h-full transition-all duration-300"
                        />
                      )}
                      {pending > 0 && (
                        <div
                          style={{ width: `${(pending / total) * 100}%` }}
                          className="bg-slate-200 h-full transition-all duration-300"
                        />
                      )}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* SUB-MODAL: Recipient Audit Logs */}
      {auditingCampaign && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold">
                  Campaign #{auditingCampaign.id} Recipient Delivery Audit
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-lg">
                  Subject: {auditingCampaign.subject}
                </p>
              </div>
              <button
                onClick={() => setAuditingCampaign(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter toolbar inside audit modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Filter name or email..."
                  value={recipientSearch}
                  onChange={(e) => { setRecipientSearch(e.target.value); setRecipientPage(1); }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
                <select
                  value={recipientStatusFilter}
                  onChange={(e) => { setRecipientStatusFilter(e.target.value); setRecipientPage(1); }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-indigo-600"
                >
                  <option value="">All Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="text-xs font-semibold text-slate-500">
                Total: {recipientTotal} recipient(s)
              </div>
            </div>

            {/* Recipients Table */}
            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Mobile</th>
                    <th className="py-2.5 px-3">Delivery Status</th>
                    <th className="py-2.5 px-3">Dispatched (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipientLoading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-1 text-indigo-600" />
                        <span>Loading recipient records...</span>
                      </td>
                    </tr>
                  ) : recipientLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No recipient logs match criteria.
                      </td>
                    </tr>
                  ) : (
                    recipientLogs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {r.recipient_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {r.recipient_email}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.recipient_mobile || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.status === 'sent' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Sent
                            </span>
                          ) : r.status === 'failed' ? (
                            <div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Failed
                              </span>
                              {r.error_message && (
                                <p className="text-[10px] text-rose-600 mt-0.5 truncate max-w-[200px]" title={r.error_message}>
                                  {r.error_message}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {r.sent_at ? formatIndianDateTime(r.sent_at) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setAuditingCampaign(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUB-MODAL: Edit Scheduled Campaign */}
      {editingCampaign && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit Scheduled Campaign #{editingCampaign.id}</h3>
              <button onClick={() => setEditingCampaign(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Message Body</label>
                <textarea
                  rows={5}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Date (IST)</label>
                  <input
                    type="date"
                    value={editScheduleDate}
                    onChange={(e) => setEditScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Time (IST)</label>
                  <input
                    type="time"
                    value={editScheduleTime}
                    onChange={(e) => setEditScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                >
                  {isUpdating ? 'Saving...' : 'Update Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

