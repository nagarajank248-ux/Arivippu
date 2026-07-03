import React from 'react';
import { 
  LayoutDashboard, 
  Megaphone, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Send
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onLogout, user }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar-container glass-panel">
      <div className="sidebar-logo-area">
        <div className="logo-icon-box">
          <Send size={18} className="logo-icon" />
        </div>
        <div className="logo-text-box">
          <span className="logo-name">Arivippu</span>
          <span className="logo-tagline">Campaign Engine</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={20} className="nav-item-icon" />
              <span className="nav-item-label">{item.label}</span>
              {isActive && <div className="nav-item-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <div className="user-avatar">
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'UR'}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.username || 'User'}</span>
            <span className="user-role">Administrator</span>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout} title="Log Out">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
