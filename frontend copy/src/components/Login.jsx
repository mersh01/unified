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

  // Determine which login form to show
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
    <div className="login-container">
      {/* Left side abstract background */}
      <div className="login-image-side">
        <div className="login-image-overlay">
          <h1 className="login-hero-title">
            {translate(translations, 'app_title', 'Document Management System')}
          </h1>
          <p className="login-hero-subtitle">
            {translate(translations, 'hero_subtitle', 'Secure, efficient, and transparent document processing.')}
          </p>
        </div>
      </div>

      {/* Right side login panel */}
      <div className="login-form-side">
        <div className="language-selector-wrapper">
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value)}
            className="language-select"
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

        <div className="login-glass-card">
          <div className="login-header">
            <h2>{translate(translations, 'welcome_back', 'Welcome Back')}</h2>
            <p>
              {isCitizenLogin 
                ? translate(translations, 'citizen_login_desc', 'Login to manage your applications.') 
                : translate(translations, 'admin_login_desc', 'Employee portal access.')}
            </p>
          </div>

          {error && (
            <div className="login-error-message">
              {error}
            </div>
          )}

          {isCitizenLogin ? (
            <div className="login-form">
              {!otpSent ? (
                <>
                  <div className="input-group">
                    <label>{translate(translations, 'phone_number', 'Phone Number')}</label>
                    <input
                      type="tel"
                      placeholder={translate(translations, 'phone_placeholder', 'Enter 10-digit mobile number')}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="login-input"
                    />
                  </div>
                  <button 
                    onClick={sendOTP} 
                    disabled={loading} 
                    className="login-primary-btn"
                  >
                    {loading ? translate(translations, 'sending', 'Sending...') : translate(translations, 'send_otp', 'Send OTP')}
                  </button>
                </>
              ) : (
                <>
                  <div className="input-group">
                    <label>{translate(translations, 'enter_otp_label', 'Enter OTP')}</label>
                    <input
                      type="text"
                      placeholder={translate(translations, 'otp_placeholder', 'Enter 4-digit OTP')}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength="4"
                      className="login-input"
                    />
                  </div>
                  {isNewUser && (
                    <div className="input-group" style={{marginTop: '15px'}}>
                      <label>{translate(translations, 'full_name', 'Full Name')}</label>
                      <input
                        type="text"
                        placeholder={translate(translations, 'full_name_placeholder', 'Enter your full name')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="login-input"
                      />
                    </div>
                  )}
                  <button 
                    onClick={verifyOTP} 
                    disabled={loading} 
                    className="login-primary-btn"
                  >
                    {loading ? translate(translations, 'verifying', 'Verifying...') : translate(translations, 'verify_login', 'Verify & Login')}
                  </button>
                  <button 
                    onClick={() => setOtpSent(false)} 
                    className="login-secondary-btn"
                  >
                    ← {translate(translations, 'change_phone', 'Change Phone Number')}
                  </button>
                </>
              )}
              <p className="demo-hint">
                {translate(translations, 'demo_otp_hint', 'Demo OTP: 1234')}
              </p>
            </div>
          ) : (
            <div className="login-form">
              <div className="input-group">
                <label>{translate(translations, 'username', 'Username')}</label>
                <input
                  type="text"
                  placeholder={translate(translations, 'username_placeholder', 'Enter username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-input"
                />
              </div>
              <div className="input-group">
                <label>{translate(translations, 'password', 'Password')}</label>
                <input
                  type="password"
                  placeholder={translate(translations, 'password_placeholder', 'Enter password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                />
              </div>
              <button 
                onClick={handleAdminLogin} 
                disabled={loading} 
                className="login-primary-btn"
              >
                {loading ? translate(translations, 'logging_in', 'Logging in...') : translate(translations, 'login', 'Login')}
              </button>
              
              <div className="demo-accounts">
                <p><strong>{translate(translations, 'demo_admin_accounts', 'Demo Admin Accounts:')}</strong></p>
                <p>• Super Admin: admin / admin123</p>
                <p>• Verifier: verification_officer / verify123</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;