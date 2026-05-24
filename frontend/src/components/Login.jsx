import React, { useState } from 'react';
import { translate } from '../utils/i18n';

const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';

function Login({ loginType = 'citizen', onLogin, onAdminLogin, translations, locale, availableLocales, onLocaleChange }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [fullName, setFullName] = useState('');

  const isCitizenLogin = loginType === 'citizen';

  const sendOTP = async () => {
    if (!phoneNumber.match(/^[0-9]{10}$/)) {
      setError(translate(translations, 'invalid_phone', 'Please enter a valid 10-digit phone number'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber })
      });
      
      if (response.ok) {
        const data = await response.json();
        setOtpSent(true);
        if (data.is_new_user) {
          setIsNewUser(true);
        } else {
          setIsNewUser(false);
        }
        alert(`OTP sent to ${phoneNumber}\nDemo OTP: 1234`);
      } else {
        const data = await response.json();
        setError(data.detail || translate(translations, 'send_otp_failed', 'Failed to send OTP'));
      }
    } catch (error) {
      setError(translate(translations, 'connection_error', 'Error connecting to server'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp) {
      setError(translate(translations, 'enter_otp', 'Please enter OTP'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone_number: phoneNumber, 
          otp: otp,
          ...(isNewUser && { full_name: fullName })
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userType', 'citizen');
        onLogin(data.user);
      } else {
        setError(data.detail || translate(translations, 'invalid_otp', 'Invalid OTP'));
      }
    } catch (error) {
      setError(translate(translations, 'verify_otp_error', 'Error verifying OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!username || !password) {
      setError(translate(translations, 'enter_credentials', 'Please enter username and password'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userType', 'admin');
        onAdminLogin(data.user);
      } else {
        setError(data.detail || translate(translations, 'invalid_credentials', 'Invalid credentials'));
      }
    } catch (error) {
      setError(translate(translations, 'login_error', 'Error logging in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-2">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0b4f8a] to-[#0f4e88] items-center justify-center p-12">
        <div className="text-white max-w-lg">
          <div className="mb-8">
            <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold mb-6">
              D
            </div>
            <h1 className="text-4xl font-bold mb-4">
              {translate(translations, 'app_title', 'Document Management System')}
            </h1>
            <p className="text-lg text-white/80">
              {translate(translations, 'hero_subtitle', 'Secure, efficient, and transparent document processing.')}
            </p>
          </div>
          <div className="space-y-4 text-white/70">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">✓</div>
              <span>Secure authentication</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">✓</div>
              <span>Real-time tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">✓</div>
              <span>Multi-language support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Language Selector */}
          <div className="flex justify-end mb-6">
            <select
              value={locale}
              onChange={(e) => onLocaleChange(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0b4f8a]"
            >
              {availableLocales && availableLocales.length > 0 ? (
                availableLocales.map((localeEntry) => (
                  <option key={localeEntry.locale} value={localeEntry.locale}>
                    {localeEntry.display_name || localeEntry.locale}
                  </option>
                ))
              ) : (
                <option value="en">English</option>
              )}
            </select>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-950 mb-2">
                {translate(translations, 'welcome_back', 'Welcome Back')}
              </h2>
              <p className="text-sm text-slate-600">
                {isCitizenLogin 
                  ? translate(translations, 'citizen_login_desc', 'Login to manage your applications.') 
                  : translate(translations, 'admin_login_desc', 'Employee portal access.')}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {isCitizenLogin ? (
              <div className="space-y-4">
                {!otpSent ? (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {translate(translations, 'phone_number', 'Phone Number')}
                      </label>
                      <input
                        type="tel"
                        placeholder={translate(translations, 'phone_placeholder', 'Enter 10-digit mobile number')}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#0b4f8a] focus:ring-2 focus:ring-[#0b4f8a] focus:outline-none"
                      />
                    </div>
                    <button 
                      onClick={sendOTP} 
                      disabled={loading} 
                      className="w-full rounded-2xl bg-[#0b4f8a] px-4 py-3 text-white font-medium transition hover:bg-[#0f4e88] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? translate(translations, 'sending', 'Sending...') : translate(translations, 'send_otp', 'Send OTP')}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        {translate(translations, 'enter_otp_label', 'Enter OTP')}
                      </label>
                      <input
                        type="text"
                        placeholder={translate(translations, 'otp_placeholder', 'Enter 4-digit OTP')}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength="4"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#0b4f8a] focus:ring-2 focus:ring-[#0b4f8a] focus:outline-none"
                      />
                    </div>
                    {isNewUser && (
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          {translate(translations, 'full_name', 'Full Name')}
                        </label>
                        <input
                          type="text"
                          placeholder={translate(translations, 'full_name_placeholder', 'Enter your full name')}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#0b4f8a] focus:ring-2 focus:ring-[#0b4f8a] focus:outline-none"
                        />
                      </div>
                    )}
                    <button 
                      onClick={verifyOTP} 
                      disabled={loading} 
                      className="w-full rounded-2xl bg-[#0b4f8a] px-4 py-3 text-white font-medium transition hover:bg-[#0f4e88] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? translate(translations, 'verifying', 'Verifying...') : translate(translations, 'verify_login', 'Verify & Login')}
                    </button>
                    <button 
                      onClick={() => setOtpSent(false)} 
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium transition hover:bg-slate-50"
                    >
                      ← {translate(translations, 'change_phone', 'Change Phone Number')}
                    </button>
                  </>
                )}
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                  {translate(translations, 'demo_otp_hint', 'Demo OTP: 1234')}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {translate(translations, 'username', 'Username')}
                  </label>
                  <input
                    type="text"
                    placeholder={translate(translations, 'username_placeholder', 'Enter username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#0b4f8a] focus:ring-2 focus:ring-[#0b4f8a] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {translate(translations, 'password', 'Password')}
                  </label>
                  <input
                    type="password"
                    placeholder={translate(translations, 'password_placeholder', 'Enter password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-[#0b4f8a] focus:ring-2 focus:ring-[#0b4f8a] focus:outline-none"
                  />
                </div>
                <button 
                  onClick={handleAdminLogin} 
                  disabled={loading} 
                  className="w-full rounded-2xl bg-[#0b4f8a] px-4 py-3 text-white font-medium transition hover:bg-[#0f4e88] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? translate(translations, 'logging_in', 'Logging in...') : translate(translations, 'login', 'Login')}
                </button>
                
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900 mb-2">
                    {translate(translations, 'demo_admin_accounts', 'Demo Admin Accounts:')}
                  </p>
                  <p>• Super Admin: admin / admin123</p>
                  <p>• Verifier: verification_officer / verify123</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;