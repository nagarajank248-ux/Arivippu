import React, { useState, useEffect, useRef } from 'react';
import AuthView from './components/AuthView';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import CampaignsView from './components/CampaignsView';
import ContactsView from './components/ContactsView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import { Menu, X, Send } from 'lucide-react';
import { api } from './utils/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cross-page navigation links state
  const [campaignToEdit, setCampaignToEdit] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  const previousCampaigns = useRef([]);

  // Validate cached credentials on startup
  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
    }
  }, [token]);

  // Background campaign progress & notification monitor
  useEffect(() => {
    if (!token) return;

    // Ask browser permission for push notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkCampaignProgress = async () => {
      try {
        const campaigns = await api.getCampaigns();
        
        if (previousCampaigns.current.length > 0) {
          campaigns.forEach(camp => {
            const prev = previousCampaigns.current.find(p => p.id === camp.id);
            // If the status was Running and now changed to Completed
            if (prev && prev.status === 'Running' && camp.status === 'Completed') {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Campaign Completed! 🎉', {
                  body: `Your campaign "${camp.name}" has finished sending all messages.`,
                  tag: camp.id
                });
              } else {
                alert(`Campaign Completed! 🎉\n\nYour campaign "${camp.name}" has finished sending all messages.`);
              }
            }
          });
        }
        previousCampaigns.current = campaigns;
      } catch (err) {
        console.error('Error tracking campaigns in background:', err);
      }
    };

    // Run check immediately and poll every 5 seconds
    checkCampaignProgress();
    const interval = setInterval(checkCampaignProgress, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAuthSuccess = (u, t) => {
    setToken(t);
    setUser(u);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setMobileMenuOpen(false);
  };

  if (!token) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  // View router switch statement
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView 
            setActiveTab={setActiveTab} 
            setCampaignToEdit={setCampaignToEdit} 
          />
        );
      case 'campaigns':
        return (
          <CampaignsView 
            campaignToEdit={campaignToEdit} 
            setCampaignToEdit={setCampaignToEdit}
            setActiveTab={setActiveTab}
            setSelectedCampaignId={setSelectedCampaignId}
          />
        );
      case 'contacts':
        return (
          <ContactsView 
            selectedCampaignId={selectedCampaignId}
            setSelectedCampaignId={setSelectedCampaignId}
          />
        );
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView user={user} setUser={setUser} />;
      default:
        return <DashboardView setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Top Navigation Header */}
      <header className="mobile-header glass-panel">
        <div className="mobile-header-logo">
          <Send size={18} className="logo-icon text-primary" />
          <span className="logo-name">Arivippu</span>
        </div>
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Drawer"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Navigation Sidebar (Desktop & Mobile Drawer states) */}
      <div className={`sidebar-wrapper ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false); // Auto close drawer on select
          }}
          onLogout={handleLogout}
          user={user}
        />
        {/* Backdrop for closing mobile menu by clicking outside */}
        {mobileMenuOpen && (
          <div 
            className="sidebar-backdrop" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>

      {/* Main content area */}
      <main className="main-content">
        {renderActiveView()}
      </main>
    </div>
  );
}
