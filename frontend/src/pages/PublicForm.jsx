import React, { useState } from 'react';
import {
  Mail,
  User,
  Phone,
  FileText,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react';

export default function PublicForm() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [lastSubmittedHash, setLastSubmittedHash] = useState(null);

  // Field validation
  const validateField = (name, value) => {
    switch (name) {
      case 'fullName':
        if (!value || !value.trim()) {
          return 'Full name is required';
        }
        if (value.trim().length < 2) {
          return 'Full name must be at least 2 characters';
        }
        if (value.trim().length > 100) {
          return 'Full name cannot exceed 100 characters';
        }
        if (!/^[a-zA-Z\s.'-]+$/.test(value)) {
          return 'Only letters, spaces, hyphens, and periods allowed';
        }
        return null;

      case 'email':
        if (!value || !value.trim()) {
          return 'Email address is required';
        }
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
        if (!emailRegex.test(value.trim())) {
          return 'Please enter a valid email address';
        }
        return null;

      case 'mobileNumber':
        if (!value || !value.trim()) {
          return 'Mobile number is required';
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 10) {
          return 'Mobile number must be exactly 10 digits';
        }
        return null;

      case 'description':
        if (value && value.length > 1000) {
          return 'Description cannot exceed 1000 characters';
        }
        return null;

      default:
        return null;
    }
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;

    // Allow strictly digits and cap at exactly 10 digits
    if (name === 'mobileNumber') {
      finalValue = value.replace(/\D/g, '').slice(0, 10);
    }

    setFormData((prev) => ({ ...prev, [name]: finalValue }));

    if (touched[name]) {
      const error = validateField(name, finalValue);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      email: '',
      mobileNumber: '',
      description: '',
    });
    setErrors({});
    setTouched({});
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setTouched({
      fullName: true,
      email: true,
      mobileNumber: true,
      description: true,
    });

    const isValid = validateAll();
    if (!isValid) {
      setSubmitError('Please correct the highlighted fields before submitting.');
      return;
    }

    const currentHash = `${formData.email.trim().toLowerCase()}_${formData.mobileNumber.replace(/\D/g, '')}_${formData.fullName.trim()}`;
    if (currentHash === lastSubmittedHash) {
      setSubmitError('You have already submitted this application. Please wait before submitting again.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          description: formData.description.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) setErrors(data.errors);
        throw new Error(data.message || 'Submission failed.');
      }

      setSubmitSuccess({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        notification: data.notification,
      });

      setLastSubmittedHash(currentHash);
    } catch (err) {
      setSubmitError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-100 to-slate-100 text-slate-800 flex flex-col justify-between overflow-x-hidden box-border">
      
      {/* Background subtle soft ambient light */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-100/50 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-1/4 w-[600px] h-[600px] bg-purple-100/40 rounded-full blur-3xl"></div>
      </div>

      {/* ========================================================= */}
      {/* TOP HEADER: DYNAMIC & COLORFUL Aao Seekhe BRANDING          */}
      {/* ========================================================= */}
      <header className="w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/90 py-4 px-4 sm:px-8 lg:px-12 shadow-sm">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            {/* Colorful Dynamic Multi-Gradient Logo Emblem */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 ring-4 ring-purple-100 flex-shrink-0 transform hover:scale-105 transition duration-200">
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm" />
            </div>

            {/* Dynamic Multi-Color Typography */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-amber-500 via-rose-500 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Aao Seekhe
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 tracking-wide">
                Candidate Registration Portal
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN SECTION: FULL-SCREEN RESPONSIVE SUBMISSION FORM      */}
      {/* ========================================================= */}
      <main className="flex-1 w-full max-w-full px-2 sm:px-6 lg:px-8 py-3 sm:py-6 flex flex-col justify-center items-center box-border">
        
        {submitSuccess ? (
          /* Success Screen */
          <div className="w-full max-w-3xl bg-white/95 border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-12 text-center animate-fadeIn box-border">
            <div className="w-20 h-20 bg-gradient-to-tr from-emerald-400 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25">
              <CheckCircle className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              Application Submitted Successfully!
            </h2>
            
            <p className="text-slate-600 text-sm sm:text-base mt-3 max-w-md mx-auto leading-relaxed">
              Thank you, <strong className="text-slate-900">{submitSuccess.fullName}</strong>. Your information has been securely stored with Aao Seekhe.
            </p>

            <div className="mt-8 p-5 rounded-2xl bg-slate-50/90 border border-slate-200 text-xs sm:text-sm text-slate-600 max-w-lg mx-auto text-left space-y-2">
              <p className="font-bold text-slate-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Next Steps</span>
              </p>
              <p className="pl-6">&bull; A confirmation email has been dispatched to <strong className="text-slate-900">{submitSuccess.email}</strong>.</p>
              <p className="pl-6">&bull; Our admissions team will review your application and reach out if necessary.</p>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="mt-8 inline-flex items-center space-x-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-purple-600/25 transition duration-200 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Submit Another Application</span>
            </button>
          </div>
        ) : (
          /* Light-Mode Form Container matching page background */
          <div className="w-full max-w-5xl bg-white/95 border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/60 backdrop-blur-xl overflow-hidden box-border">
            
            {/* Form Title Banner */}
            <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-purple-50/40 px-4 sm:px-8 py-5 sm:py-7 border-b border-slate-200/80">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800">
                Submit Your Information
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Please complete the form below. Required fields are marked with an asterisk (<span className="text-rose-500 font-bold">*</span>).
              </p>
            </div>

            {/* Form Fields */}
            <div className="p-4 sm:p-7 lg:p-9 bg-white">
              
              {submitError && (
                <div className="p-4 rounded-2xl mb-6 bg-rose-50 border border-rose-200 text-rose-700 flex items-start space-x-3 text-xs sm:text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="font-medium break-words">{submitError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                
                {/* Row 1: Full Name & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                  
                  {/* Full Name */}
                  <div className="w-full min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="fullName" className="text-xs sm:text-sm font-bold text-slate-700">
                        Full Name <span className="text-rose-500 font-bold">*</span>
                      </label>
                      {touched.fullName && !errors.fullName && (
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Valid</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isSubmitting}
                        className={`w-full pl-10 sm:pl-11 pr-4 py-3 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50/70 border transition outline-none ${
                          errors.fullName && touched.fullName
                            ? 'border-rose-400 bg-rose-50/40 text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                            : touched.fullName && !errors.fullName
                            ? 'border-emerald-400 bg-emerald-50/30 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                            : 'border-slate-200/90 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                        }`}
                      />
                    </div>
                    {errors.fullName && touched.fullName && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="w-full min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="email" className="text-xs sm:text-sm font-bold text-slate-700">
                        Email Address <span className="text-rose-500 font-bold">*</span>
                      </label>
                      {touched.email && !errors.email && (
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Valid</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isSubmitting}
                        className={`w-full pl-10 sm:pl-11 pr-4 py-3 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50/70 border transition outline-none ${
                          errors.email && touched.email
                            ? 'border-rose-400 bg-rose-50/40 text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                            : touched.email && !errors.email
                            ? 'border-emerald-400 bg-emerald-50/30 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                            : 'border-slate-200/90 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                        }`}
                      />
                    </div>
                    {errors.email && touched.email && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                </div>

                {/* Row 2: Mobile Number */}
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="mobileNumber" className="text-xs sm:text-sm font-bold text-slate-700">
                      Mobile Number <span className="text-rose-500 font-bold">*</span>
                    </label>
                    {touched.mobileNumber && !errors.mobileNumber && (
                      <span className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Valid</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <input
                      id="mobileNumber"
                      name="mobileNumber"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="10-digit mobile number"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                      className={`w-full pl-10 sm:pl-11 pr-4 py-3 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50/70 border transition outline-none ${
                        errors.mobileNumber && touched.mobileNumber
                          ? 'border-rose-400 bg-rose-50/40 text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                          : touched.mobileNumber && !errors.mobileNumber
                          ? 'border-emerald-400 bg-emerald-50/30 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                          : 'border-slate-200/90 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>
                  {errors.mobileNumber && touched.mobileNumber && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{errors.mobileNumber}</span>
                    </p>
                  )}
                </div>

                {/* Row 3: Description (Optional) */}
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="description" className="text-xs sm:text-sm font-bold text-slate-700 flex items-center space-x-1.5">
                      <span>Description</span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        Optional
                      </span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-400">
                      {formData.description.length}/1000
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute top-3.5 left-3.5 pointer-events-none text-slate-400">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <textarea
                      id="description"
                      name="description"
                      rows={4}
                      maxLength={1000}
                      placeholder="Tell us more about your background or requirements..."
                      value={formData.description}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={isSubmitting}
                      className="w-full pl-10 sm:pl-11 pr-4 py-3 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-slate-50/70 border border-slate-200/90 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition outline-none resize-y min-h-[110px]"
                    />
                  </div>
                </div>

                {/* ========================================================= */}
                {/* ACTION BUTTONS: ALWAYS ONE SINGLE ROW IN MOBILE & DESKTOP  */}
                {/* ========================================================= */}
                <div className="pt-4 flex flex-row items-center gap-2.5 sm:gap-4 w-full border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSubmitting}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 py-3 sm:py-3.5 px-3 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs sm:text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap font-medium">Clear</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 py-3 sm:py-3.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition duration-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span className="whitespace-nowrap font-bold">Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 flex-shrink-0" />
                        <span className="whitespace-nowrap font-bold">Submit</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>

          </div>
        )}

      </main>

      {/* Clean Footer */}
      <footer className="w-full border-t border-slate-200/90 py-4 px-4 text-center text-xs text-slate-500 max-w-4xl mx-auto">
        <p>&copy; {new Date().getFullYear()} Aao Seekhe. All rights reserved.</p>
      </footer>

    </div>
  );
}
