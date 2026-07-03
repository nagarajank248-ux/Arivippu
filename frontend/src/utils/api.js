const BASE_URL = 'https://arivippu.onrender.com/api';

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    // Clear storage and reload to force redirect to login screen
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    throw new Error(data.error || 'Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

export const api = {
  // Auth
  async login(username, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async register(username, password, email) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async getProfile() {
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async updateProfile(profileData) {
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(profileData)
    });
    return handleResponse(res);
  },

  // Settings
  async getSettings() {
    const res = await fetch(`${BASE_URL}/settings`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async saveSettings(settings) {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(settings)
    });
    return handleResponse(res);
  },

  // Campaigns
  async getCampaigns() {
    const res = await fetch(`${BASE_URL}/campaigns`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getCampaign(id) {
    const res = await fetch(`${BASE_URL}/campaigns/${id}`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createCampaign(formData) {
    const res = await fetch(`${BASE_URL}/campaigns`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
    return handleResponse(res);
  },

  async updateCampaign(id, formData) {
    const res = await fetch(`${BASE_URL}/campaigns/${id}`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: formData
    });
    return handleResponse(res);
  },

  async updateCampaignStatus(id, action) {
    const res = await fetch(`${BASE_URL}/campaigns/${id}/status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action })
    });
    return handleResponse(res);
  },

  async deleteCampaign(id) {
    const res = await fetch(`${BASE_URL}/campaigns/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Reports
  async getStats() {
    const res = await fetch(`${BASE_URL}/reports/stats`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getHistory() {
    const res = await fetch(`${BASE_URL}/reports/history`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // WhatsApp
  async getWhatsappStatus() {
    const res = await fetch(`${BASE_URL}/whatsapp/status`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async connectWhatsapp() {
    const res = await fetch(`${BASE_URL}/whatsapp/connect`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async disconnectWhatsapp() {
    const res = await fetch(`${BASE_URL}/whatsapp/disconnect`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(res);
  }
};
