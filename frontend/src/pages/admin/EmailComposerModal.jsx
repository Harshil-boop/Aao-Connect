import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Send,
  Calendar,
  Eye,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Info,
  Check,
} from 'lucide-react';

export default function EmailComposerModal({
  isOpen,
  onClose,
  token,
  selectedApplicants = [],
  totalApplicants = 0,
  filterCriteria = {},
  onCampaignCreated,
}) {
  if (!isOpen) return null;

  // Recipient Target: Always all registered applicants
  const recipientType = 'all';
  const [exactRecipientCount, setExactRecipientCount] = useState(0);
  const [countingRecipients, setCountingRecipients] = useState(false);

  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'preview'

  // Preview State
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState('html'); // 'html' | 'text'

  // Sending & Scheduling Dialogs
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const bodyTextareaRef = useRef(null);
  const subjectInputRef = useRef(null);
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

  const handleOpenDatePicker = () => {
    try {
      if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current?.focus();
      }
    } catch {
      dateInputRef.current?.focus();
    }
  };

  const handleOpenTimePicker = () => {
    try {
      if (timeInputRef.current && typeof timeInputRef.current.showPicker === 'function') {
        timeInputRef.current.showPicker();
      } else {
        timeInputRef.current?.focus();
      }
    } catch {
      timeInputRef.current?.focus();
    }
  };

  // Fetch Templates
  // Resolve total applicant recipient count from Neon DB
  useEffect(() => {
    const resolveCount = async () => {
      setCountingRecipients(true);
      try {
        const res = await fetch('/api/admin/emails/resolve-count', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientType: 'all',
            selectedIds: [],
            filterCriteria: {},
          }),
        });
        const data = await res.json();
        if (data.success) {
          setExactRecipientCount(data.count);
        }
      } catch (err) {
        console.error('Error resolving recipient count:', err);
      } finally {
        setCountingRecipients(false);
      }
    };

    resolveCount();
  }, [token]);

  // Insert Dynamic Tag at cursor position
  const handleInsertTag = (tag) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      setBodyHtml((prev) => prev + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prevText = bodyHtml;
    const updated = prevText.substring(0, start) + tag + prevText.substring(end);
    setBodyHtml(updated);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Fetch Live Preview
  const handleGeneratePreview = async () => {
    if (!subject && !bodyHtml) return;
    setPreviewLoading(true);
    try {
      const sampleId = selectedApplicants[0]?.id || null;
      const res = await fetch('/api/admin/emails/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject,
          bodyHtml,
          applicantId: sampleId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.preview);
      }
    } catch (err) {
      console.error('Error fetching preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'preview') {
      handleGeneratePreview();
    }
  }, [activeTab]);

  // Immediate Send Execution
  const handleConfirmImmediateSend = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
          recipientType: 'all',
          selectedIds: [],
          filterCriteria: null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch email campaign');
      }

      setShowConfirmSend(false);
      onClose();
      if (onCampaignCreated) {
        onCampaignCreated(data.campaign, 'sent');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Schedule Send Execution
  const handleConfirmSchedule = async (e) => {
    e.preventDefault();
    if (!scheduledDate || !scheduledTime) {
      setErrorMessage('Please select both scheduled date and time.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const combinedDateTime = `${scheduledDate}T${scheduledTime}:00+05:30`;
      const targetTime = new Date(combinedDateTime);

      if (isNaN(targetTime.getTime())) {
        throw new Error('Invalid date/time format.');
      }

      const res = await fetch('/api/admin/emails/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
          recipientType: 'all',
          selectedIds: [],
          filterCriteria: null,
          scheduledAt: targetTime.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to schedule email campaign');
      }

      setShowScheduleModal(false);
      onClose();
      if (onCampaignCreated) {
        onCampaignCreated(data.campaign, 'scheduled');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset default schedule date/time to 1 hour from now in IST
  useEffect(() => {
    if (showScheduleModal && !scheduledDate) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 60);
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');

      setScheduledDate(`${yyyy}-${mm}-${dd}`);
      setScheduledTime(`${hh}:${min}`);
    }
  }, [showScheduleModal]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Compose Custom Email</h2>
              <p className="text-xs text-slate-300">
                Send personalized candidate notifications &bull; Gmail SMTP verified
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close composer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 1. Recipient Target Banner (Send to All Candidates) */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-slate-50 p-4 rounded-2xl border border-indigo-100/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                  <span>Target Recipients:</span>
                  <span className="text-indigo-600 font-extrabold">All Registered Candidates</span>
                </div>
                <div className="text-xs text-slate-500">
                  Broadcasts personalized notification to every applicant stored in Neon Database
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <span className="text-xs font-medium text-slate-500">Total Recipients:</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{countingRecipients ? 'Calculating...' : `${exactRecipientCount} Candidate(s)`}</span>
              </span>
            </div>
          </div>

          {/* Email Subject Line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <label>Email Subject *</label>
              <span className="text-slate-400 font-normal">{subject.length}/500</span>
            </div>
            <input
              ref={subjectInputRef}
              type="text"
              placeholder="e.g. Congratulations {{name}}! You Have Been Selected - Aao Seekhe"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
              maxLength={500}
            />
          </div>

          {/* 4. Dynamic Placeholders Toolbar */}
          <div className="p-3 bg-gradient-to-r from-indigo-50/70 via-purple-50/60 to-pink-50/70 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-indigo-900 font-bold">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Insert Dynamic Placeholder:</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleInsertTag('{{name}}')}
                className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 text-xs font-mono font-bold shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer"
                title="Inserts Candidate Full Name"
              >
                + &#123;&#123;name&#125;&#125;
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{email}}')}
                className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 text-xs font-mono font-bold shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer"
                title="Inserts Candidate Email Address"
              >
                + &#123;&#123;email&#125;&#125;
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{mobile}}')}
                className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 text-xs font-mono font-bold shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer"
                title="Inserts Candidate Mobile Number"
              >
                + &#123;&#123;mobile&#125;&#125;
              </button>
            </div>
          </div>

          {/* 5. Tabs: Compose vs Live Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('compose')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'compose'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Compose Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Preview (IST / Personalized)</span>
                </button>
              </div>

              {activeTab === 'preview' && (
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('html')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      previewMode === 'html' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('text')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      previewMode === 'text' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Plain Text
                  </button>
                </div>
              )}
            </div>

            {/* Compose View */}
            {activeTab === 'compose' && (
              <div className="space-y-2">
                <textarea
                  ref={bodyTextareaRef}
                  rows={10}
                  placeholder="Dear {{name}},

Congratulations! We are delighted to inform you that your application has been selected.

Best Regards,
Aao Seekhe Team"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 font-mono leading-relaxed focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
                />
                <p className="text-[11px] text-slate-400">
                  Tip: Supports standard HTML tags (<code className="text-slate-600">&lt;p&gt;</code>, <code className="text-slate-600">&lt;strong&gt;</code>, <code className="text-slate-600">&lt;ul&gt;</code>, <code className="text-slate-600">&lt;blockquote&gt;</code>, <code className="text-slate-600">&lt;a&gt;</code>). Tags are safely sanitized before sending.
                </p>
              </div>
            )}

            {/* Live Preview View */}
            {activeTab === 'preview' && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100/60 p-4 min-h-[300px]">
                {previewLoading ? (
                  <div className="py-20 text-center text-slate-400">
                    <Eye className="w-8 h-8 animate-pulse mx-auto mb-2 text-indigo-600" />
                    <span>Rendering personalized preview...</span>
                  </div>
                ) : previewData ? (
                  previewMode === 'html' ? (
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-500">Subject: </span>
                        <span className="font-bold text-slate-900">{previewData.subject}</span>
                      </div>
                      <div
                        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: previewData.html }}
                      />
                    </div>
                  ) : (
                    <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                      {previewData.text}
                    </pre>
                  )
                ) : (
                  <div className="py-20 text-center text-slate-400 text-xs">
                    Please provide Subject and Message to generate preview.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            {/* Schedule Button */}
            <button
              type="button"
              onClick={() => {
                if (!subject.trim() || !bodyHtml.trim()) {
                  setErrorMessage('Please fill in both Subject and Message before scheduling.');
                  return;
                }
                setShowScheduleModal(true);
              }}
              disabled={exactRecipientCount === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-700 hover:bg-indigo-50 text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule Email</span>
            </button>

            {/* Send Immediately Button */}
            <button
              type="button"
              onClick={() => {
                if (!subject.trim() || !bodyHtml.trim()) {
                  setErrorMessage('Please fill in both Subject and Message before sending.');
                  return;
                }
                setShowConfirmSend(true);
              }}
              disabled={exactRecipientCount === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>Send to All ({exactRecipientCount})</span>
            </button>
          </div>
        </div>

      </div>

      {/* SUB-MODAL: Confirm Immediate Send */}
      {showConfirmSend && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <Send className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Confirm Immediate Dispatch</h3>
                <p className="text-xs text-slate-500">Live Gmail SMTP delivery</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 space-y-2">
              <p>
                You are about to dispatch this personalized email to{' '}
                <strong className="text-indigo-600 font-bold">all {exactRecipientCount} registered candidate(s)</strong>.
              </p>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 truncate">
                <strong>Subject:</strong> {subject}
              </div>
              <p className="text-[11px] text-slate-500">
                Each applicant will receive an individual personalized email with rate-limit pacing (1 msg/sec) for safe delivery.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSend(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmImmediateSend}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Queuing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Send Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Schedule Email for Future Date/Time */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl p-6 border border-slate-200 space-y-5">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Schedule Email Campaign</h3>
                <p className="text-xs text-slate-500">Timezone: Asia/Kolkata (IST)</p>
              </div>
            </div>

            <form onSubmit={handleConfirmSchedule} className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs text-slate-700 space-y-1.5">
                <p>
                  Target: <strong className="text-indigo-600 font-bold">All {exactRecipientCount} registered candidate(s)</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  The persistent background scheduler in Neon DB will trigger this campaign automatically at the specified Indian Standard Time.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Clickable Date Picker */}
                <div>
                  <label 
                    onClick={handleOpenDatePicker}
                    className="text-xs font-bold text-slate-700 block mb-1 cursor-pointer flex items-center space-x-1"
                  >
                    <span>Scheduled Date (IST) *</span>
                  </label>
                  <div
                    onClick={handleOpenDatePicker}
                    className="flex items-center space-x-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-xs text-slate-800 font-medium transition cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600"
                  >
                    <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0 pointer-events-none" />
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          if (typeof e.target.showPicker === 'function') e.target.showPicker();
                        } catch {}
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      required
                      className="w-full bg-transparent outline-none cursor-pointer text-slate-800 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Clickable Time Picker */}
                <div>
                  <label 
                    onClick={handleOpenTimePicker}
                    className="text-xs font-bold text-slate-700 block mb-1 cursor-pointer flex items-center space-x-1"
                  >
                    <span>Scheduled Time (IST) *</span>
                  </label>
                  <div
                    onClick={handleOpenTimePicker}
                    className="flex items-center space-x-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-xs text-slate-800 font-medium transition cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600"
                  >
                    <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0 pointer-events-none" />
                    <input
                      ref={timeInputRef}
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          if (typeof e.target.showPicker === 'function') e.target.showPicker();
                        } catch {}
                      }}
                      required
                      className="w-full bg-transparent outline-none cursor-pointer text-slate-800 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Confirm & Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

