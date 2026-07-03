import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Users, 
  Search, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Filter,
  Plus,
  X
} from 'lucide-react';

export default function ContactsView({ selectedCampaignId, setSelectedCampaignId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Single Contact Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchInitData = async () => {
    try {
      const camps = await api.getCampaigns();
      setCampaigns(camps);
      
      // If we don't have a selection, and there are campaigns, default to first campaign
      if (!selectedCampaignId && camps.length > 0) {
        setSelectedCampaignId(camps[0].id);
      }
    } catch (err) {
      console.error('Error loading contacts page init data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    if (!selectedCampaignId) return;
    try {
      const camp = await api.getCampaign(selectedCampaignId);
      setContacts(camp.contacts || []);
    } catch (err) {
      console.error('Error fetching campaign contacts:', err);
    }
  };

  useEffect(() => {
    fetchInitData();
  }, []);

  useEffect(() => {
    fetchContacts();
    // Refresh lists dynamically to show live progress
    const interval = setInterval(fetchContacts, 3000);
    return () => clearInterval(interval);
  }, [selectedCampaignId]);

  // Compute counts for selected campaign
  const stats = {
    total: contacts.length,
    sent: contacts.filter(c => c.status === 'Sent').length,
    failed: contacts.filter(c => c.status === 'Failed').length,
    pending: contacts.filter(c => c.status === 'Pending').length,
    invalid: contacts.filter(c => c.status === 'Invalid').length,
  };

  // Add individual contact manually
  const handleAddContact = async (e) => {
    e.preventDefault();
    setAddError('');
    setAdding(true);

    if (!newContactName || !newContactPhone) {
      setAddError('All fields are required');
      setAdding(false);
      return;
    }

    if (!selectedCampaignId) {
      setAddError('Please select a campaign first');
      setAdding(false);
      return;
    }

    try {
      // Fetch current campaign details
      const camp = await api.getCampaign(selectedCampaignId);
      
      // Create new contact entry
      const newContact = {
        id: 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: newContactName,
        phone: newContactPhone,
        status: 'Pending',
        sentAt: null,
        errorReason: null
      };

      const updatedContacts = [...camp.contacts, newContact];

      const formData = new FormData();
      formData.append('name', camp.name);
      formData.append('rawContacts', JSON.stringify(updatedContacts));

      await api.updateCampaign(selectedCampaignId, formData);
      
      // Reset & Refresh
      setNewContactName('');
      setNewContactPhone('');
      setIsAddModalOpen(false);
      fetchContacts();
    } catch (err) {
      setAddError(err.message || 'Failed to add contact');
    } finally {
      setAdding(false);
    }
  };

  // Filter & Search Contacts
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="contacts-view">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage phone lists, view validation states, and inject new recipients.</p>
        </div>
        {selectedCampaignId && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus size={16} />
            <span>Add Contact</span>
          </button>
        )}
      </div>

      {/* Select Campaign Filter Bar */}
      <div className="contacts-selector-row glass-panel mb-4" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Active Campaign:</span>
        </div>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <select 
            className="form-control"
            value={selectedCampaignId || ''}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            disabled={campaigns.length === 0}
          >
            {campaigns.length === 0 ? (
              <option value="">No campaigns available</option>
            ) : (
              campaigns.map(camp => (
                <option key={camp.id} value={camp.id}>
                  {camp.name} ({camp.status})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state glass-panel">
          <Users size={48} className="empty-state-icon" />
          <h3>No campaign contacts</h3>
          <p>Please create a campaign and upload contacts first to explore this section.</p>
        </div>
      ) : !selectedCampaignId ? (
        <p>Please select a campaign above.</p>
      ) : (
        <>
          {/* Sub Contacts Stats row */}
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="stat-card-header" style={{ marginBottom: '4px' }}>
                <span className="stat-card-title">Total Contacts</span>
                <Users size={16} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>{stats.total}</div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="stat-card-header" style={{ marginBottom: '4px' }}>
                <span className="stat-card-title">Sent</span>
                <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-success)' }}>{stats.sent}</div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="stat-card-header" style={{ marginBottom: '4px' }}>
                <span className="stat-card-title">Failed</span>
                <XCircle size={16} style={{ color: 'var(--color-danger)' }} />
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-danger)' }}>{stats.failed}</div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="stat-card-header" style={{ marginBottom: '4px' }}>
                <span className="stat-card-title">Pending</span>
                <Clock size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>{stats.pending}</div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="stat-card-header" style={{ marginBottom: '4px' }}>
                <span className="stat-card-title">Invalid Numbers</span>
                <AlertCircle size={16} style={{ color: 'var(--color-warning)' }} />
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-warning)' }}>{stats.invalid}</div>
            </div>
          </div>

          {/* Search, Status Filter & Table controls */}
          <div className="table-controls glass-panel mb-4" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none', marginBottom: 0 }}>
            {/* Search */}
            <div className="input-with-icon" style={{ flex: '1', minWidth: '250px' }}>
              <Search size={16} className="input-icon" />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search by name or number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Tabs */}
            <div className="status-filter-tabs" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {['All', 'Pending', 'Sent', 'Failed', 'Invalid'].map(tab => (
                <button
                  key={tab}
                  className={`btn btn-sm ${statusFilter === tab ? 'btn-primary' : ''}`}
                  style={{ 
                    background: statusFilter === tab ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' : 'transparent',
                    border: 'none',
                    boxShadow: statusFilter === tab ? '0 2px 6px rgba(99, 102, 241, 0.2)' : 'none'
                  }}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="table-container" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Contact Details</th>
                  <th>Phone Number</th>
                  <th>Delivery Status</th>
                  <th>Dispatched At</th>
                  <th>Error / Failure Logs</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                      No contacts match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map(contact => (
                    <tr key={contact.id}>
                      <td style={{ fontWeight: 600 }}>{contact.name}</td>
                      <td>{contact.phone}</td>
                      <td>
                        <span className={`badge badge-${contact.status.toLowerCase()}`}>
                          {contact.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {contact.sentAt ? new Date(contact.sentAt).toLocaleString() : '-'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                        {contact.errorReason || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- ADD CONTACT MODAL --- */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Add Contact Entry</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddContact}>
              <div className="modal-body">
                {addError && (
                  <div className="auth-error mb-4" style={{ margin: '0 0 1rem 0' }}>
                    <AlertCircle size={16} />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Recipient Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="E.g., Michael Scott"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="E.g., +12025550143"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Please include country prefix code (e.g. +1).
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Recipient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
