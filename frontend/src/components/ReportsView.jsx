import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  BarChart3, 
  Download, 
  Search, 
  CheckCircle, 
  XCircle, 
  Filter, 
  Info,
  Calendar
} from 'lucide-react';

export default function ReportsView() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all', 'sent', 'failed'
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);

  const fetchData = async () => {
    try {
      const histData = await api.getHistory();
      setHistory(histData);
      
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching reports history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll history updates every 5s while jobs execute
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter logs
  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.campaignName.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (activeSubTab === 'sent') matchesStatus = item.status === 'Sent';
    else if (activeSubTab === 'failed') matchesStatus = item.status === 'Failed' || item.status === 'Invalid';

    return matchesSearch && matchesStatus;
  });

  // Export to CSV Function
  const exportToCSV = () => {
    if (filteredHistory.length === 0) {
      alert('No record history available to export.');
      return;
    }

    const headers = ['Campaign Name', 'Recipient Name', 'Phone Number', 'Delivery Status', 'Dispatched At', 'Error Reason'];
    const rows = filteredHistory.map(item => [
      item.campaignName,
      item.contactName,
      item.phone,
      item.status,
      item.sentAt ? new Date(item.sentAt).toLocaleString() : '-',
      item.errorReason || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `arivippu_campaign_report_${activeSubTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && history.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading analytics reports...</p>
      </div>
    );
  }

  // Calculate quick values
  const totalSent = stats?.contacts.sent || 0;
  const totalFailed = stats?.contacts.failed || 0;
  const totalInvalid = stats?.contacts.invalid || 0;
  const totalProcessed = totalSent + totalFailed + totalInvalid;
  const successRate = totalProcessed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 100;

  return (
    <div className="reports-view">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Track logs, export records, and analyze campaign message delivery.</p>
        </div>
        <button className="btn btn-secondary" onClick={exportToCSV} disabled={filteredHistory.length === 0}>
          <Download size={16} />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Grid of Report Aggregates */}
      <div className="stats-grid mb-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card glass-panel" style={{ padding: '1.25rem' }}>
          <div className="stat-card-header" style={{ marginBottom: '4px' }}>
            <span className="stat-card-title">Processed Messages</span>
            <BarChart3 size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>{totalProcessed}</div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '1.25rem' }}>
          <div className="stat-card-header" style={{ marginBottom: '4px' }}>
            <span className="stat-card-title">Successfully Sent</span>
            <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-success)' }}>{totalSent}</div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '1.25rem' }}>
          <div className="stat-card-header" style={{ marginBottom: '4px' }}>
            <span className="stat-card-title">Failed Dispatches</span>
            <XCircle size={16} style={{ color: 'var(--color-danger)' }} />
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-danger)' }}>{totalFailed + totalInvalid}</div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '1.25rem' }}>
          <div className="stat-card-header" style={{ marginBottom: '4px' }}>
            <span className="stat-card-title">Overall success</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary)' }}>{successRate}%</span>
          </div>
          <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
            {totalProcessed > 0 ? `${successRate}%` : '100%'}
          </div>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="reports-table-panel glass-panel">
        <div className="reports-panel-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 className="card-panel-title" style={{ marginBottom: 0 }}>Transmission History Logs</h3>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div className="input-with-icon" style={{ minWidth: '220px' }}>
              <Search size={14} className="input-icon" />
              <input 
                type="text" 
                className="form-control btn-sm" 
                placeholder="Search logs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2rem' }}
              />
            </div>

            {/* Filter Sub-Tabs */}
            <div className="status-filter-tabs" style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              {[
                { id: 'all', label: 'All Logs' },
                { id: 'sent', label: 'Sent' },
                { id: 'failed', label: 'Failed' }
              ].map(sub => (
                <button
                  key={sub.id}
                  className={`btn btn-sm ${activeSubTab === sub.id ? 'btn-primary' : ''}`}
                  style={{
                    padding: '0.25rem 0.625rem',
                    fontSize: '11px',
                    borderRadius: '4px',
                    background: activeSubTab === sub.id ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' : 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                  onClick={() => setActiveSubTab(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Recipient</th>
                <th>Phone Number</th>
                <th>Status</th>
                <th>Sent Timestamp</th>
                <th>Remarks / Failure Logs</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                    No transmission logs matched the filter details.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => (
                  <tr key={`${item.contactId}_${idx}`}>
                    <td style={{ fontWeight: 500 }}>{item.campaignName}</td>
                    <td>{item.contactName}</td>
                    <td>{item.phone}</td>
                    <td>
                      <span className={`badge badge-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {item.sentAt ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={10} />
                          {new Date(item.sentAt).toLocaleString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: '12px', color: item.status === 'Sent' ? 'var(--text-muted)' : 'var(--color-danger)' }}>
                      {item.errorReason || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
