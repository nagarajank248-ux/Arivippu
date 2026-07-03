import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  Calendar, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Info,
  X,
  Eye,
  Smartphone,
  HelpCircle,
  BarChart,
  ShieldAlert
} from 'lucide-react';

export default function CampaignsView({ campaignToEdit, setCampaignToEdit, setActiveTab, setSelectedCampaignId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewDetailsCamp, setViewDetailsCamp] = useState(null);

  // Form states
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [delayInterval, setDelayInterval] = useState('10-15 minutes');
  const [customInterval, setCustomInterval] = useState('12');
  const [contactsFile, setContactsFile] = useState(null);
  const [images, setImages] = useState([]);
  const [rawContacts, setRawContacts] = useState('');
  
  // Advanced Scheduling States
  const [dailyLimit, setDailyLimit] = useState(20);
  const [activeHoursStart, setActiveHoursStart] = useState('09:00');
  const [activeHoursEnd, setActiveHoursEnd] = useState('18:00');
  const [durationDays, setDurationDays] = useState(7);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (campaignToEdit) {
      handleEdit(campaignToEdit);
      setCampaignToEdit(null);
    }
  }, [campaignToEdit]);

  const openCreateModal = () => {
    setEditId(null);
    setName('');
    setCaption('');
    
    // Default to current date and time + 2 minutes
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    const tzoffset = now.getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    setScheduledTime(localISOTime);
    
    setDelayInterval('10-15 minutes');
    setCustomInterval('12');
    setContactsFile(null);
    setImages([]);
    setRawContacts('');
    
    // Reset Advanced fields
    setDailyLimit(20);
    setActiveHoursStart('09:00');
    setActiveHoursEnd('18:00');
    setDurationDays(7);
    
    setFormError('');
    setIsModalOpen(true);
  };

  const handleEdit = async (id) => {
    try {
      setLoading(true);
      const camp = await api.getCampaign(id);
      setEditId(camp.id);
      setName(camp.name);
      setCaption(camp.caption);
      
      if (camp.scheduledTime) {
        const dt = new Date(camp.scheduledTime);
        const tzoffset = dt.getTimezoneOffset() * 60000;
        const formatted = (new Date(dt - tzoffset)).toISOString().slice(0, 16);
        setScheduledTime(formatted);
      } else {
        setScheduledTime('');
      }

      if (['5 minutes', '10-15 minutes', '15 minutes'].includes(camp.delayInterval)) {
        setDelayInterval(camp.delayInterval);
      } else {
        setDelayInterval('custom');
        const val = parseInt(camp.delayInterval) || 12;
        setCustomInterval(val.toString());
      }
      
      setContactsFile(null);
      setImages([]);
      setRawContacts('');
      
      // Load Advanced parameters
      setDailyLimit(camp.dailyLimit || 20);
      setActiveHoursStart(camp.activeHoursStart || '09:00');
      setActiveHoursEnd(camp.activeHoursEnd || '18:00');
      setDurationDays(camp.durationDays || 7);

      setFormError('');
      setIsModalOpen(true);
    } catch (err) {
      alert('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusAction = async (id, action) => {
    try {
      await api.updateCampaignStatus(id, action);
      fetchCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to update campaign status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this campaign? All contacts and reports associated will be deleted.')) {
      return;
    }
    try {
      await api.deleteCampaign(id);
      fetchCampaigns();
    } catch (err) {
      alert('Failed to delete campaign');
    }
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!name) {
      setFormError('Campaign name is required');
      setSubmitting(false);
      return;
    }

    if (!editId && !contactsFile && !rawContacts) {
      setFormError('Please upload a CSV contacts file or paste manual contacts');
      setSubmitting(false);
      return;
    }

    const finalInterval = delayInterval === 'custom' ? `${customInterval} seconds` : delayInterval;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('caption', caption);
    
    const schedDate = scheduledTime ? new Date(scheduledTime) : new Date();
    formData.append('scheduledTime', isNaN(schedDate.getTime()) ? new Date().toISOString() : schedDate.toISOString());
    
    formData.append('delayInterval', finalInterval);
    formData.append('isDraft', isDraft);

    // Append advanced options
    formData.append('dailyLimit', dailyLimit);
    formData.append('activeHoursStart', activeHoursStart);
    formData.append('activeHoursEnd', activeHoursEnd);
    formData.append('durationDays', durationDays);

    if (contactsFile) {
      formData.append('contactsFile', contactsFile);
    } else if (rawContacts) {
      formData.append('rawContacts', rawContacts);
    }

    if (images.length > 0) {
      images.forEach(img => {
        formData.append('images', img);
      });
    }

    try {
      if (editId) {
        await api.updateCampaign(editId, formData);
      } else {
        await api.createCampaign(formData);
      }
      setIsModalOpen(false);
      fetchCampaigns();
    } catch (err) {
      setFormError(err.message || 'Error saving campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (id) => {
    try {
      const data = await api.getCampaign(id);
      setViewDetailsCamp(data);
    } catch (err) {
      alert('Failed to fetch details');
    }
  };

  return (
    <div className="campaigns-view">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Manage, schedule, and run WhatsApp ad blasts.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          <span>Create Campaign</span>
        </button>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state glass-panel">
          <ImageIcon size={48} className="empty-state-icon" />
          <h3>No campaigns yet</h3>
          <p>Get started by linking your WhatsApp account in Settings, creating a campaign, and uploading contacts.</p>
          <button className="btn btn-primary" onClick={openCreateModal}>
            Create Campaign Now
          </button>
        </div>
      ) : (
        <div className="campaigns-list-grid">
          {campaigns.map(camp => {
            const processed = camp.stats.sent + camp.stats.failed + camp.stats.invalid;
            const total = camp.stats.total;
            const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;
            const successRate = (camp.stats.sent + camp.stats.failed) > 0 
              ? Math.round((camp.stats.sent / (camp.stats.sent + camp.stats.failed)) * 100) 
              : 0;

            const isPausedByWa = camp.errorReason && camp.errorReason.includes('WhatsApp');

            return (
              <div key={camp.id} className="campaign-card glass-panel" style={{ border: isPausedByWa ? '1px dashed var(--color-danger)' : '1px solid var(--border-color)' }}>
                <div className="camp-card-header">
                  <div className="camp-header-left">
                    <h3 className="camp-card-title">{camp.name}</h3>
                    <span className="camp-card-subtitle">
                      Created: {new Date(camp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={`badge badge-${camp.status.toLowerCase()}`}>
                    {camp.status}
                  </span>
                </div>

                <div className="camp-card-body">
                  <p className="camp-caption-preview">
                    {camp.caption ? (camp.caption.length > 70 ? `${camp.caption.substring(0, 70)}...` : camp.caption) : <em>No caption set</em>}
                  </p>

                  {/* Limits and active hours indicators */}
                  <div className="camp-meta-list" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                    <div className="meta-item" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Delay Interval:</span>
                      <span style={{ fontWeight: 600 }}>{camp.delayInterval}</span>
                    </div>
                    <div className="meta-item" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Daily Quota:</span>
                      <span style={{ fontWeight: 600 }}>{camp.dailyLimit || 20} shares</span>
                    </div>
                    <div className="meta-item" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Active Hours:</span>
                      <span style={{ fontWeight: 600 }}>{camp.activeHoursStart || '09:00'} - {camp.activeHoursEnd || '18:00'}</span>
                    </div>
                    <div className="meta-item" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Duration Limit:</span>
                      <span style={{ fontWeight: 600 }}>{camp.durationDays || 7} Days</span>
                    </div>
                  </div>

                  {camp.errorReason && (
                    <div className="camp-card-alert" style={{ background: isPausedByWa ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.05)', borderColor: isPausedByWa ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.1)' }}>
                      {isPausedByWa ? <ShieldAlert size={16} className="text-danger" /> : <Info size={16} />}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '11px', color: isPausedByWa ? 'var(--color-danger)' : 'var(--text-primary)' }}>{camp.errorReason}</span>
                        {isPausedByWa && (
                          <button 
                            type="button" 
                            onClick={() => setActiveTab('settings')}
                            style={{ display: 'block', background: 'none', border: 'none', color: 'var(--color-primary-light)', fontSize: '10px', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', marginTop: '4px', padding: 0 }}
                          >
                            Go link WhatsApp device →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progress Section */}
                  <div className="camp-progress-area">
                    <div className="progress-labels">
                      <span className="lbl">Progress: {processed} / {total} contacts</span>
                      <span className="val">{progressPct}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${progressPct}%`,
                          background: camp.status === 'Running' ? 'linear-gradient(90deg, var(--color-success), var(--color-primary))' : 'var(--text-muted)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Stat Indicators */}
                  <div className="camp-mini-stats">
                    <div className="mini-stat-col">
                      <span className="num text-success">{camp.stats.sent}</span>
                      <span className="lbl">Sent</span>
                    </div>
                    <div className="mini-stat-col">
                      <span className="num text-danger">{camp.stats.failed}</span>
                      <span className="lbl">Failed</span>
                    </div>
                    <div className="mini-stat-col">
                      <span className="num text-warning">{camp.stats.invalid}</span>
                      <span className="lbl">Invalid</span>
                    </div>
                    <div className="mini-stat-col">
                      <span className="num">{successRate}%</span>
                      <span className="lbl">Success</span>
                    </div>
                  </div>
                </div>

                <div className="camp-card-actions">
                  <div className="action-left">
                    <button 
                      className="btn btn-secondary btn-sm icon-btn" 
                      onClick={() => openDetails(camp.id)}
                      title="View Details"
                    >
                      <Eye size={14} />
                    </button>
                    {camp.status === 'Draft' || camp.status === 'Paused' ? (
                      <button 
                        className="btn btn-secondary btn-sm icon-btn" 
                        onClick={() => handleEdit(camp.id)}
                        title="Edit Campaign"
                      >
                        <Edit size={14} />
                      </button>
                    ) : null}
                    <button 
                      className="btn btn-danger btn-sm icon-btn" 
                      onClick={() => handleDelete(camp.id)}
                      title="Delete Campaign"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="action-right">
                    {camp.status === 'Running' ? (
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleStatusAction(camp.id, 'pause')}
                      >
                        <Pause size={14} />
                        <span>Pause</span>
                      </button>
                    ) : camp.status === 'Paused' && total > 0 ? (
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => handleStatusAction(camp.id, 'resume')}
                      >
                        <Play size={14} />
                        <span>Resume</span>
                      </button>
                    ) : (camp.status === 'Draft' || camp.status === 'Paused') && total > 0 ? (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStatusAction(camp.id, 'start')}
                      >
                        <Play size={14} />
                        <span>Start</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- CREATE / EDIT CAMPAIGN MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Edit Campaign Parameters' : 'Create Message Campaign'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <div className="modal-body">
                {formError && (
                  <div className="auth-error mb-4" style={{ margin: '0 0 1.25rem 0' }}>
                    <Info size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Campaign Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="E.g., Summer Discount WhatsApp Ad"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">WhatsApp Caption / Message Text</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Enter the caption or message to accompany your media image..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>

                {/* Grid 2 Columns: Time & Delays */}
                <div className="grid-2-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Scheduled Start *</label>
                    <input 
                      type="datetime-local" 
                      className="form-control" 
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Interval Delay Range *</label>
                    <select 
                      className="form-control"
                      value={delayInterval}
                      onChange={(e) => setDelayInterval(e.target.value)}
                    >
                      <option value="5 minutes">5 minutes (Fast: 5s demo)</option>
                      <option value="10-15 minutes">10-15 minutes (Fast: 10-15s demo)</option>
                      <option value="15 minutes">15 minutes (Fast: 15s demo)</option>
                      <option value="custom">Custom interval (seconds)</option>
                    </select>
                  </div>
                </div>

                {delayInterval === 'custom' && (
                  <div className="form-group animate-slide-down" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Custom Delay (Seconds)</label>
                      <input 
                        type="number" 
                        min="1" 
                        className="form-control" 
                        placeholder="Seconds"
                        value={customInterval}
                        onChange={(e) => setCustomInterval(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* --- ADVANCED SCHEDULING CONTROLS --- */}
                <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <span className="form-label" style={{ display: 'block', fontSize: '0.875rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                    Scheduling & Throttling Rules
                  </span>

                  <div className="grid-2-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Daily Message Cap *</label>
                      <input 
                        type="number" 
                        min="1" 
                        className="form-control" 
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(parseInt(e.target.value) || 20)}
                        required
                      />
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Max messages sent per day</span>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Campaign Active Days *</label>
                      <input 
                        type="number" 
                        min="1" 
                        className="form-control" 
                        value={durationDays}
                        onChange={(e) => setDurationDays(parseInt(e.target.value) || 7)}
                        required
                      />
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Will automatically wrap up after N days</span>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Allowed Active Time Window (Daily)</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={activeHoursStart}
                        onChange={(e) => setActiveHoursStart(e.target.value)}
                        required
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>to</span>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={activeHoursEnd}
                        onChange={(e) => setActiveHoursEnd(e.target.value)}
                        required
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                      Campaign runner will sleep quietly outside this daily window.
                    </span>
                  </div>
                </div>

                {/* Media Ad Image Selection */}
                <div className="form-group">
                  <label className="form-label">Upload Advertisement Image</label>
                  <div className="file-input-wrapper">
                    <ImageIcon size={18} className="file-icon" />
                    <span className="file-lbl">
                      {images.length > 0 ? `${images.length} file selected` : 'Choose image for WhatsApp attachment...'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => e.target.files && setImages(Array.from(e.target.files))}
                    />
                  </div>
                </div>

                {!editId && (
                  <div className="form-group-contacts">
                    <span className="form-label">Contacts Import *</span>
                    
                    <div className="contacts-input-panel" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '12px' }}>A: Upload CSV File</label>
                        <div className="file-input-wrapper">
                          <FileText size={18} className="file-icon" />
                          <span className="file-lbl">
                            {contactsFile ? contactsFile.name : 'Choose contact list CSV file...'}
                          </span>
                          <input 
                            type="file" 
                            accept=".csv" 
                            onChange={(e) => e.target.files && setContactsFile(e.target.files[0])}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>B: Or Paste Contacts (Manual)</label>
                        <textarea 
                          className="form-control" 
                          rows="2" 
                          placeholder="John Doe, +919876543210&#10;Jane Smith, 9123456789"
                          value={rawContacts}
                          onChange={(e) => setRawContacts(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-secondary" onClick={(e) => handleSubmit(e, true)} disabled={submitting}>
                  Save Draft
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Processing...' : editId ? 'Save Changes' : 'Create & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAIL PREVIEW MODAL --- */}
      {viewDetailsCamp && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{viewDetailsCamp.name} Details</h2>
                <span className="badge badge-draft" style={{ marginTop: '4px' }}>
                  ID: {viewDetailsCamp.id}
                </span>
              </div>
              <button className="modal-close" onClick={() => setViewDetailsCamp(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Message Text Caption</h4>
                  <p style={{ fontSize: '13px', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '80px', whiteSpace: 'pre-wrap' }}>
                    {viewDetailsCamp.caption || <em>No text caption</em>}
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Uploaded Image</h4>
                  <div className="details-images-grid">
                    {viewDetailsCamp.images.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No images uploaded</span>
                    ) : (
                      <div className="details-img-wrap" style={{ width: '100px', height: '100px', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                        <img src={`http://localhost:5000${viewDetailsCamp.images[0]}`} alt="Campaign Ad" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sched summary grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Daily Limit</span>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{viewDetailsCamp.dailyLimit || 20} msg</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Active Window</span>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{viewDetailsCamp.activeHoursStart || '09:00'} - {viewDetailsCamp.activeHoursEnd || '18:00'}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Duration Limit</span>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{viewDetailsCamp.durationDays || 7} Days</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Interval Delay</span>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{viewDetailsCamp.delayInterval}</span>
                </div>
              </div>

              <div className="details-contacts-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Campaign Contacts ({viewDetailsCamp.contacts.length})
                  </h4>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => {
                      setSelectedCampaignId(viewDetailsCamp.id);
                      setActiveTab('contacts');
                      setViewDetailsCamp(null);
                    }}
                  >
                    Manage Contacts
                  </button>
                </div>

                <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Contact Name</th>
                        <th>Phone Number</th>
                        <th>Status</th>
                        <th>Processed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetailsCamp.contacts.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No contacts uploaded
                          </td>
                        </tr>
                      ) : (
                        viewDetailsCamp.contacts.map(c => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td>{c.phone}</td>
                            <td>
                              <span className={`badge badge-${c.status.toLowerCase()}`}>
                                {c.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {c.sentAt ? new Date(c.sentAt).toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setViewDetailsCamp(null)}>
                Close Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
