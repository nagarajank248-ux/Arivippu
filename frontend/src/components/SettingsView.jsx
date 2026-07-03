import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Settings, 
  User, 
  Lock, 
  Sliders, 
  Clock, 
  AlertCircle,
  Save,
  CheckCircle2,
  QrCode,
  Smartphone,
  LogOut,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

export default function SettingsView({ user, setUser }) {
  // Config state
  const [delayInterval, setDelayInterval] = useState('10-15 minutes');
  const [dailyLimit, setDailyLimit] = useState(20);
  const [demoMode, setDemoMode] = useState(true);
  
  // Profile state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // WhatsApp State
  const [whatsappStatus, setWhatsappStatus] = useState('Disconnected'); // 'Disconnected' | 'Connecting' | 'QR_Code' | 'Connected'
  const [qrCodeData, setQrCodeData] = useState(null);
  const [whatsappPhone, setWhatsappPhone] = useState(null);
  const [waLoading, setWaLoading] = useState(false);

  // Feedback state
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSettingsAndProfile = async () => {
    try {
      const config = await api.getSettings();
      setDelayInterval(config.delayInterval || '10-15 minutes');
      setDailyLimit(config.dailyLimit || 20);
      setDemoMode(config.demoMode === undefined ? true : config.demoMode);

      const profile = await api.getProfile();
      setEmail(profile.email || '');
    } catch (err) {
      console.error('Error loading settings view details:', err);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      const wa = await api.getWhatsappStatus();
      setWhatsappStatus(wa.status);
      setQrCodeData(wa.qrCodeData);
      setWhatsappPhone(wa.phoneNumber);
    } catch (err) {
      console.error('Error checking WhatsApp connection status:', err);
    }
  };

  useEffect(() => {
    loadSettingsAndProfile();
    checkWhatsAppStatus();
  }, []);

  // Poll WhatsApp status while connecting or scanning QR code
  useEffect(() => {
    let interval = null;
    if (whatsappStatus === 'Connecting' || whatsappStatus === 'QR_Code') {
      interval = setInterval(checkWhatsAppStatus, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [whatsappStatus]);

  const handleConnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      const wa = await api.connectWhatsapp();
      setWhatsappStatus(wa.status);
      setQrCodeData(wa.qrCodeData);
    } catch (err) {
      alert(err.message || 'Failed to initialize WhatsApp pairing');
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp device? Campaigns in progress will pause.')) {
      return;
    }
    setWaLoading(true);
    try {
      const wa = await api.disconnectWhatsapp();
      setWhatsappStatus(wa.status);
      setQrCodeData(null);
      setWhatsappPhone(null);
    } catch (err) {
      alert(err.message || 'Failed to disconnect WhatsApp');
    } finally {
      setWaLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSuccess(false);
    setErrorMsg('');
    setLoading(true);

    try {
      await api.saveSettings({ delayInterval, dailyLimit, demoMode });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess(false);
    setErrorMsg('');
    setLoading(true);

    if (password && password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const payload = { email };
      if (password) payload.password = password;

      await api.updateProfile(payload);
      
      const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
      cachedUser.email = email;
      localStorage.setItem('user', JSON.stringify(cachedUser));
      setUser(cachedUser);

      setPassword('');
      setConfirmPassword('');
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-view">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure WhatsApp devices, campaign schedules, and profile controls.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="auth-error mb-4" style={{ margin: '0 0 1.5rem 0' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- WHATSAPP CONNECTION BLOCK --- */}
      <div className="whatsapp-conn-panel glass-panel mb-4" style={{ padding: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem', border: '1px solid var(--border-glow)', boxShadow: 'var(--shadow-glow)' }}>
        
        {/* Left Side: Status Info */}
        <div style={{ flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone size={24} style={{ color: 'var(--color-success)' }} />
            <h3 className="card-panel-title" style={{ margin: 0, fontSize: '1.25rem' }}>WhatsApp Device Connection</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            To automate message and advertisement delivery, link your phone's WhatsApp account by scanning the generated QR code. The platform acts as a companion device, dispatching text and attachments directly.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Status:</span>
            <span className={`badge badge-${whatsappStatus.toLowerCase().replace('_', '')}`}>
              {whatsappStatus.replace('_', ' ')}
            </span>
          </div>

          {whatsappStatus === 'Connected' && (
            <div className="animate-slide-down" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
              Linked Phone: <strong style={{ color: 'white' }}>+{whatsappPhone}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '1rem' }}>
            {whatsappStatus === 'Disconnected' && (
              <button 
                className="btn btn-primary" 
                onClick={handleConnectWhatsApp}
                disabled={waLoading}
              >
                {waLoading ? 'Starting Client...' : 'Link WhatsApp Device'}
              </button>
            )}

            {whatsappStatus === 'Connected' && (
              <button 
                className="btn btn-danger" 
                onClick={handleDisconnectWhatsApp}
                disabled={waLoading}
              >
                <LogOut size={16} />
                <span>Disconnect Account</span>
              </button>
            )}

            {(whatsappStatus === 'Connecting' || whatsappStatus === 'QR_Code') && (
              <button 
                className="btn btn-secondary" 
                onClick={handleDisconnectWhatsApp}
                disabled={waLoading}
                title="Cancel Connection Attempt"
              >
                Cancel Setup
              </button>
            )}

            <button 
              className="btn btn-secondary icon-btn" 
              onClick={checkWhatsAppStatus}
              disabled={waLoading}
              title="Refresh Connection Status"
            >
              <RefreshCw size={14} className={waLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Right Side: QR Code Area */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '220px', width: '220px', height: '220px', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-color)', borderRadius: '12px', margin: '0 auto', overflow: 'hidden', position: 'relative' }}>
          {whatsappStatus === 'QR_Code' && qrCodeData ? (
            <div style={{ textAlign: 'center', padding: '10px' }}>
              <img src={qrCodeData} alt="Scan QR Code" style={{ width: '170px', height: '170px', display: 'block', margin: '0 auto', borderRadius: '6px' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>Scan from WhatsApp app settings</span>
            </div>
          ) : whatsappStatus === 'Connecting' ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="spinner" style={{ margin: '0 auto 12px auto', width: '30px', height: '30px' }}></div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Launching server browser...</span>
            </div>
          ) : whatsappStatus === 'Connected' ? (
            <div style={{ textAlign: 'center', color: 'var(--color-success)' }}>
              <Smartphone size={48} style={{ marginBottom: '10px' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>WhatsApp Linked!</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <QrCode size={48} style={{ opacity: 0.15, marginBottom: '10px' }} />
              <span style={{ fontSize: '12px', display: 'block' }}>QR Code Offline</span>
            </div>
          )}
        </div>

      </div>

      {/* --- ACCOUNT & SYSTEM LIMITS CONFIG --- */}
      <div className="settings-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Left Side: System Dispatch Parameters */}
        <div className="settings-card glass-panel" style={{ padding: '2rem' }}>
          <div className="card-header-icon-lbl" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Sliders size={20} style={{ color: 'var(--color-primary)' }} />
            <h3 className="card-panel-title" style={{ margin: 0 }}>Campaign & Delivery Defaults</h3>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label className="form-label">
                Default Delay Between Action Blasts
              </label>
              <div className="select-with-icon" style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                <select 
                  className="form-control" 
                  value={delayInterval}
                  onChange={(e) => setDelayInterval(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                >
                  <option value="5 minutes">5 minutes (Fast: 5s demo)</option>
                  <option value="10-15 minutes">10-15 minutes (Fast: 10-15s demo)</option>
                  <option value="15 minutes">15 minutes (Fast: 15s demo)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Daily Campaign Limit Threshold</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{dailyLimit} messages</span>
              </label>
              <input 
                type="range" 
                min="5" 
                max="100" 
                step="5"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Limits total messages processed per calendar day across all active runner tasks.
              </span>
            </div>

            {/* DEMO MODE TOGGLE */}
            <div className="form-group" style={{ marginTop: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="demoMode" 
                checked={demoMode} 
                onChange={(e) => setDemoMode(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
              />
              <div style={{ flex: 1 }}>
                <label htmlFor="demoMode" style={{ fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', display: 'block' }}>
                  Enable Fast Demo Mode (Recommended)
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                  Converts minutes into seconds (e.g. 10-15 minutes delay executes in 10-15 seconds) so you can verify WhatsApp delivery immediately without waiting.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
              {settingsSuccess ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '13px', fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> Saved Successfully
                </div>
              ) : <div />}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Save size={16} />
                <span>Save Config</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Account and Profile Updates */}
        <div className="settings-card glass-panel" style={{ padding: '2rem' }}>
          <div className="card-header-icon-lbl" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <User size={20} style={{ color: 'var(--color-secondary)' }} />
            <h3 className="card-panel-title" style={{ margin: 0 }}>Account Settings</h3>
          </div>

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Username (Read-only)</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input 
                  type="text" 
                  className="form-control" 
                  value={user?.username || ''} 
                  disabled 
                  style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input 
                  type="email" 
                  className="form-control" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Change Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
              {profileSuccess ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '13px', fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> Profile Updated
                </div>
              ) : <div />}
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)' }}>
                <Save size={16} />
                <span>Update Account</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
