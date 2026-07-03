import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Megaphone, 
  Users, 
  Send, 
  AlertTriangle, 
  Play, 
  Pause, 
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function DashboardView({ setActiveTab, setCampaignToEdit }) {
  const [stats, setStats] = useState(null);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);

      const campaigns = await api.getCampaigns();
      // Show top 3 latest campaigns
      setRecentCampaigns(campaigns.slice(0, 3));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Live update stats while campaigns run
    const interval = setInterval(fetchDashboardData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCampaignAction = async (id, action) => {
    try {
      await api.updateCampaignStatus(id, action);
      fetchDashboardData();
    } catch (err) {
      alert(err.message || 'Failed to update campaign status');
    }
  };

  if (loading && !stats) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // Calculate stats values
  const totalCamps = stats?.campaigns.total || 0;
  const runningCamps = stats?.campaigns.active || 0;
  const completedCamps = stats?.campaigns.completed || 0;
  const pausedCamps = stats?.campaigns.paused || 0;

  const totalContacts = stats?.contacts.total || 0;
  const sentContacts = stats?.contacts.sent || 0;
  const failedContacts = stats?.contacts.failed || 0;
  const pendingContacts = stats?.contacts.pending || 0;
  const invalidContacts = stats?.contacts.invalid || 0;

  const sentToday = stats?.limits.sentToday || 0;
  const dailyLimit = stats?.limits.dailyLimit || 100;
  const limitPercentage = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  // Render SVG Chart helper
  const renderSVGChart = () => {
    const data = stats?.chartData || [];
    if (data.length === 0) {
      return (
        <div className="empty-chart">No sending history recorded in the last 7 days.</div>
      );
    }

    const width = 600;
    const height = 220;
    const padding = 35;
    
    // Find max value in chart
    const maxVal = Math.max(...data.map(d => Math.max(d.sent, d.failed)), 10);

    // Grid columns
    const pointsCount = data.length;
    const stepX = (width - padding * 2) / (pointsCount - 1);

    // Compute coordinate points
    const sentPoints = [];
    const failedPoints = [];
    
    data.forEach((d, idx) => {
      const x = padding + idx * stepX;
      // standard chart logic: 0 is at bottom
      const ySent = height - padding - (d.sent / maxVal) * (height - padding * 2);
      const yFailed = height - padding - (d.failed / maxVal) * (height - padding * 2);
      
      sentPoints.push({ x, y: ySent, label: d.sent, date: d.date });
      failedPoints.push({ x, y: yFailed, label: d.failed, date: d.date });
    });

    const getLinePath = (pts) => {
      if (pts.length === 0) return '';
      return pts.reduce((acc, p, idx) => {
        return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
      }, '');
    };

    const getAreaPath = (pts) => {
      if (pts.length === 0) return '';
      const line = getLinePath(pts);
      const firstX = pts[0].x;
      const lastX = pts[pts.length - 1].x;
      const bottomY = height - padding;
      return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    };

    return (
      <div className="svg-chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="analytics-svg">
          <defs>
            <linearGradient id="gradientSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradientFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-danger)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-danger)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = padding + ratio * (height - padding * 2);
            const val = Math.round(maxVal * (1 - ratio));
            return (
              <g key={index}>
                <line 
                  x1={padding} 
                  y1={y} 
                  x2={width - padding} 
                  y2={y} 
                  stroke="var(--border-color)" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={padding - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  fill="var(--text-muted)" 
                  fontSize="10px"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Fill Areas */}
          <path d={getAreaPath(sentPoints)} fill="url(#gradientSent)" />
          <path d={getAreaPath(failedPoints)} fill="url(#gradientFailed)" />

          {/* Lines */}
          <path d={getLinePath(sentPoints)} fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={getLinePath(failedPoints)} fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 1" />

          {/* Horizontal X Axis line */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-color)" strokeWidth="1" />

          {/* Data Points and Axis Labels */}
          {sentPoints.map((pt, idx) => (
            <g key={idx}>
              <circle cx={pt.x} cy={pt.y} r="4" fill="var(--color-success)" stroke="var(--bg-secondary)" strokeWidth="2" />
              <text x={pt.x} y={height - padding + 18} textAnchor="middle" fill="var(--text-secondary)" fontSize="10px">
                {pt.date}
              </text>
            </g>
          ))}
          {failedPoints.map((pt, idx) => (
            <circle key={idx} cx={pt.x} cy={pt.y} r="3" fill="var(--color-danger)" stroke="var(--bg-secondary)" strokeWidth="1.5" />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="dashboard-view">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">Welcome to Arivippu</h1>
          <p className="page-subtitle">Real-time advertising campaign engine overview.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('campaigns')}>
          <Megaphone size={16} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Stats Panel */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-card-header">
            <span className="stat-card-title">Active Campaigns</span>
            <div className="stat-card-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
              <Play size={18} />
            </div>
          </div>
          <div className="stat-card-value">{runningCamps}</div>
          <div className="stat-card-footer">
            <span>Running out of {totalCamps} total</span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-card-header">
            <span className="stat-card-title">Completed Campaigns</span>
            <div className="stat-card-icon-wrapper" style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--color-info)' }}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="stat-card-value">{completedCamps}</div>
          <div className="stat-card-footer">
            <span>Successfully sent campaigns</span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-card-header">
            <span className="stat-card-title">Success Rate</span>
            <div className="stat-card-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-secondary)' }}>
              <Send size={18} />
            </div>
          </div>
          <div className="stat-card-value">
            {sentContacts + failedContacts > 0 
              ? `${Math.round((sentContacts / (sentContacts + failedContacts)) * 100)}%` 
              : '100%'}
          </div>
          <div className="stat-card-footer">
            <span>{sentContacts} sent / {failedContacts} failed</span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-card-header">
            <span className="stat-card-title">Daily Messages Limit</span>
            <div className="stat-card-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-card-value">{sentToday} / {dailyLimit}</div>
          <div className="stat-card-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
            <div className="progress-bar-bg" style={{ height: '6px', borderRadius: '3px' }}>
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${limitPercentage}%`, 
                  height: '100%', 
                  background: 'var(--color-warning)',
                  borderRadius: '3px',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
            <span>{limitPercentage}% used today</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Section */}
      <div className="dashboard-layout-main">
        {/* Left Side: Analytics & Delivery Status */}
        <div className="dashboard-left">
          <div className="card-panel glass-panel">
            <h3 className="card-panel-title">Message Delivery Performance</h3>
            <p className="card-panel-desc">Last 7 days of campaign delivery activity trends.</p>
            
            {renderSVGChart()}

            <div className="chart-legend-row">
              <div className="legend-item">
                <span className="legend-dot success"></span>
                <span>Sent Messages</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot danger"></span>
                <span>Failed Messages</span>
              </div>
            </div>

            {/* Sub Contact Breakdown Box */}
            <div className="contacts-status-breakdown">
              <div className="breakdown-box">
                <span className="breakdown-label">Sent</span>
                <span className="breakdown-val text-success">{sentContacts}</span>
              </div>
              <div className="breakdown-box">
                <span className="breakdown-label">Failed</span>
                <span className="breakdown-val text-danger">{failedContacts}</span>
              </div>
              <div className="breakdown-box">
                <span className="breakdown-label">Invalid</span>
                <span className="breakdown-val text-warning">{invalidContacts}</span>
              </div>
              <div className="breakdown-box">
                <span className="breakdown-label">Pending</span>
                <span className="breakdown-val text-muted">{pendingContacts}</span>
              </div>
              <div className="breakdown-box header-totals">
                <span className="breakdown-label">Total Contacts</span>
                <span className="breakdown-val">{totalContacts}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Recent Campaigns */}
        <div className="dashboard-right">
          <div className="card-panel glass-panel h-100">
            <div className="panel-header-with-action">
              <h3 className="card-panel-title">Recent Campaigns</h3>
              <button className="text-action-btn" onClick={() => setActiveTab('campaigns')}>
                View All <ArrowRight size={14} />
              </button>
            </div>
            <p className="card-panel-desc">Status and quick actions for your latest campaigns.</p>

            <div className="recent-campaigns-list">
              {recentCampaigns.length === 0 ? (
                <div className="empty-panel-state">
                  <Megaphone size={32} className="empty-icon" />
                  <p>No campaigns found</p>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('campaigns')}>
                    Create Campaign
                  </button>
                </div>
              ) : (
                recentCampaigns.map(camp => {
                  const processed = camp.stats.sent + camp.stats.failed + camp.stats.invalid;
                  const total = camp.stats.total;
                  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;
                  
                  return (
                    <div key={camp.id} className="recent-camp-row">
                      <div className="recent-camp-header">
                        <div className="recent-camp-title-grp">
                          <span className="recent-camp-name">{camp.name}</span>
                          <span className="recent-camp-date">{new Date(camp.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className={`badge badge-${camp.status.toLowerCase()}`}>
                          {camp.status}
                        </span>
                      </div>

                      <div className="recent-camp-progress-section">
                        <div className="progress-header">
                          <span className="progress-lbl">Progress ({processed}/{total})</span>
                          <span className="progress-val">{progressPct}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: `${progressPct}%`, 
                              background: camp.status === 'Running' ? 'var(--color-primary)' : 'var(--text-muted)' 
                            }}
                          />
                        </div>
                      </div>

                      <div className="recent-camp-actions">
                        {camp.status === 'Running' ? (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCampaignAction(camp.id, 'pause')}
                          >
                            <Pause size={12} /> Pause
                          </button>
                        ) : camp.status === 'Paused' && total > 0 ? (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleCampaignAction(camp.id, 'resume')}
                          >
                            <Play size={12} /> Resume
                          </button>
                        ) : camp.status === 'Draft' ? (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setCampaignToEdit(camp.id);
                              setActiveTab('campaigns');
                            }}
                          >
                            Edit Draft
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
