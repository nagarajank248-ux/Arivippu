import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readDb, writeDb } from './db.js';
import { campaignRunner } from './campaignRunner.js';
import { whatsappService } from './whatsappService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'arivippu_secret_key_12345';

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Config Multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = readDb();
    const userExists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());

    if (userExists) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: 'user_' + Date.now(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    
    // Set default settings for the user
    db.settings[newUser.id] = {
      delayInterval: '5 minutes',
      dailyLimit: 100
    };

    writeDb(db);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = readDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Profile GET
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  });
});

// Profile PUT
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const userIndex = db.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

  if (email) {
    db.users[userIndex].email = email;
  }
  
  if (password) {
    db.users[userIndex].password = await bcrypt.hash(password, 10);
  }

  writeDb(db);
  res.json({ message: 'Profile updated successfully' });
});


// --- SETTINGS ROUTES ---

app.get('/api/settings', authenticateToken, (req, res) => {
  const db = readDb();
  const settings = db.settings[req.user.id] || { delayInterval: '10-15 minutes', dailyLimit: 20, demoMode: true };
  res.json(settings);
});

app.post('/api/settings', authenticateToken, (req, res) => {
  const { delayInterval, dailyLimit, demoMode } = req.body;
  const db = readDb();
  
  db.settings[req.user.id] = {
    delayInterval: delayInterval || '10-15 minutes',
    dailyLimit: parseInt(dailyLimit) || 20,
    demoMode: demoMode === undefined ? true : demoMode
  };

  writeDb(db);
  res.json({ message: 'Settings saved successfully', settings: db.settings[req.user.id] });
});


// --- CAMPAIGN ROUTES ---

// Get all campaigns
app.get('/api/campaigns', authenticateToken, (req, res) => {
  const db = readDb();
  const userCampaigns = db.campaigns
    .filter(c => c.userId === req.user.id)
    .map(c => {
      // Return counts instead of full contact lists for the list view
      const total = c.contacts.length;
      const sent = c.contacts.filter(con => con.status === 'Sent').length;
      const failed = c.contacts.filter(con => con.status === 'Failed').length;
      const pending = c.contacts.filter(con => con.status === 'Pending').length;
      const invalid = c.contacts.filter(con => con.status === 'Invalid').length;
      
      return {
        id: c.id,
        name: c.name,
        caption: c.caption,
        images: c.images,
        status: c.status,
        scheduledTime: c.scheduledTime,
        delayInterval: c.delayInterval,
        createdAt: c.createdAt,
        errorReason: c.errorReason,
        stats: { total, sent, failed, pending, invalid }
      };
    });
  
  res.json(userCampaigns);
});

// Get campaign by ID (includes contact lists)
app.get('/api/campaigns/:id', authenticateToken, (req, res) => {
  const db = readDb();
  const campaign = db.campaigns.find(c => c.id === req.params.id && c.userId === req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

// CSV Parser Helper
const parseCsvContent = (fileContent) => {
  const lines = fileContent.split(/\r?\n/);
  const contacts = [];
  let nameIndex = 0;
  let phoneIndex = 1;
  
  if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) return [];
  
  // Try to parse headers
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('name') || firstLine.includes('phone') || firstLine.includes('number') || firstLine.includes('contact')) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nIdx = headers.findIndex(h => h.includes('name'));
    const pIdx = headers.findIndex(h => h.includes('phone') || h.includes('num') || h.includes('contact') || h.includes('cell'));
    if (nIdx !== -1) nameIndex = nIdx;
    if (pIdx !== -1) phoneIndex = pIdx;
    
    // remove headers line
    lines.shift();
  }
  
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length > Math.max(nameIndex, phoneIndex)) {
      const name = cols[nameIndex] || `Contact ${idx + 1}`;
      const phone = cols[phoneIndex] || '';
      if (phone) {
        contacts.push({
          id: 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name,
          phone,
          status: 'Pending',
          sentAt: null,
          errorReason: null
        });
      }
    } else if (cols[0]) {
      // fallback: if single column, assume it is phone number
      contacts.push({
        id: 'contact_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: `Contact ${idx + 1}`,
        phone: cols[0],
        status: 'Pending',
        sentAt: null,
        errorReason: null
      });
    }
  });
  return contacts;
};

// Create a Campaign
app.post('/api/campaigns', authenticateToken, upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'contactsFile', maxCount: 1 }
]), (req, res) => {
  try {
    const { name, caption, scheduledTime, delayInterval, isDraft, rawContacts, dailyLimit, activeHoursStart, activeHoursEnd, durationDays } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Campaign name is required' });

    let contacts = [];

    // Parse contacts file if present
    if (req.files && req.files['contactsFile']) {
      const filePath = req.files['contactsFile'][0].path;
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      contacts = parseCsvContent(fileContent);
      // delete temp file
      fs.unlinkSync(filePath);
    } else if (rawContacts) {
      // Parse manual contacts text
      try {
        contacts = JSON.parse(rawContacts);
        contacts = contacts.map((c, idx) => ({
          id: c.id || 'contact_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 9),
          name: c.name || `Contact ${idx + 1}`,
          phone: c.phone || '',
          status: c.status || 'Pending',
          sentAt: c.sentAt || null,
          errorReason: c.errorReason || null
        }));
      } catch (e) {
        contacts = parseCsvContent(rawContacts);
      }
    }

    // Get uploaded images URLs
    const images = [];
    if (req.files && req.files['images']) {
      req.files['images'].forEach(file => {
        images.push(`/uploads/${file.filename}`);
      });
    }

    const db = readDb();
    const newCampaign = {
      id: 'camp_' + Date.now(),
      userId: req.user.id,
      name,
      caption: caption || '',
      images,
      contacts,
      status: isDraft === 'true' || isDraft === true ? 'Draft' : 'Paused',
      scheduledTime: scheduledTime || new Date().toISOString(),
      delayInterval: delayInterval || '10-15 minutes',
      dailyLimit: parseInt(dailyLimit) || 20,
      activeHoursStart: activeHoursStart || '09:00',
      activeHoursEnd: activeHoursEnd || '18:00',
      durationDays: parseInt(durationDays) || 7,
      currentContactIndex: 0,
      createdAt: new Date().toISOString()
    };

    db.campaigns.push(newCampaign);
    writeDb(db);

    res.status(201).json({ message: 'Campaign created successfully', campaign: newCampaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Update a Draft Campaign (or update active settings)
app.put('/api/campaigns/:id', authenticateToken, upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'contactsFile', maxCount: 1 }
]), (req, res) => {
  try {
    const { name, caption, scheduledTime, delayInterval, isDraft, rawContacts, dailyLimit, activeHoursStart, activeHoursEnd, durationDays } = req.body;
    const db = readDb();
    const index = db.campaigns.findIndex(c => c.id === req.params.id && c.userId === req.user.id);
    
    if (index === -1) return res.status(404).json({ error: 'Campaign not found' });
    const camp = db.campaigns[index];

    if (camp.status === 'Running') {
      return res.status(400).json({ error: 'Cannot update a running campaign' });
    }

    if (name) camp.name = name;
    if (caption !== undefined) camp.caption = caption;
    if (scheduledTime) camp.scheduledTime = scheduledTime;
    if (delayInterval) camp.delayInterval = delayInterval;
    if (dailyLimit) camp.dailyLimit = parseInt(dailyLimit) || 20;
    if (activeHoursStart) camp.activeHoursStart = activeHoursStart;
    if (activeHoursEnd) camp.activeHoursEnd = activeHoursEnd;
    if (durationDays) camp.durationDays = parseInt(durationDays) || 7;
    if (isDraft !== undefined) {
      camp.status = isDraft === 'true' || isDraft === true ? 'Draft' : 'Paused';
    }

    // Append images
    if (req.files && req.files['images']) {
      req.files['images'].forEach(file => {
        camp.images.push(`/uploads/${file.filename}`);
      });
    }

    // Handle contacts update
    if (req.files && req.files['contactsFile']) {
      const filePath = req.files['contactsFile'][0].path;
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      camp.contacts = parseCsvContent(fileContent);
      camp.currentContactIndex = 0;
      fs.unlinkSync(filePath);
    } else if (rawContacts) {
      try {
        camp.contacts = JSON.parse(rawContacts);
        camp.contacts = camp.contacts.map((c, idx) => ({
          id: c.id || 'contact_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 9),
          name: c.name || `Contact ${idx + 1}`,
          phone: c.phone || '',
          status: c.status || 'Pending',
          sentAt: c.sentAt || null,
          errorReason: c.errorReason || null
        }));
      } catch (e) {
        camp.contacts = parseCsvContent(rawContacts);
      }
      camp.currentContactIndex = 0;
    }

    writeDb(db);
    res.json({ message: 'Campaign updated successfully', campaign: camp });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Update Campaign Status (Start, Pause, Resume, Stop)
app.post('/api/campaigns/:id/status', authenticateToken, (req, res) => {
  const { action } = req.body; // 'start', 'pause', 'resume', 'stop'
  const db = readDb();
  const campaign = db.campaigns.find(c => c.id === req.params.id && c.userId === req.user.id);

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  if (campaign.status === 'Completed' && action !== 'start') {
    return res.status(400).json({ error: 'Campaign is already completed' });
  }

  switch (action) {
    case 'start':
      // Reset progress
      campaign.contacts.forEach(c => {
        c.status = 'Pending';
        c.sentAt = null;
        c.errorReason = null;
      });
      campaign.currentContactIndex = 0;
      campaign.status = 'Running';
      writeDb(db);
      campaignRunner.start(campaign.id);
      break;

    case 'resume':
      campaign.status = 'Running';
      writeDb(db);
      campaignRunner.resume(campaign.id);
      break;

    case 'pause':
      campaign.status = 'Paused';
      writeDb(db);
      campaignRunner.pause(campaign.id);
      break;

    case 'stop':
      campaign.status = 'Paused'; // stop maps to paused
      writeDb(db);
      campaignRunner.stop(campaign.id);
      break;

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }

  // Reload campaign info to get correct updated status
  const updatedCampaign = readDb().campaigns.find(c => c.id === req.params.id);
  res.json({ message: `Campaign ${action}ed successfully`, campaign: updatedCampaign });
});

// Delete Campaign
app.delete('/api/campaigns/:id', authenticateToken, (req, res) => {
  campaignRunner.stop(req.params.id);
  
  const db = readDb();
  const initialLength = db.campaigns.length;
  db.campaigns = db.campaigns.filter(c => !(c.id === req.params.id && c.userId === req.user.id));
  
  if (db.campaigns.length === initialLength) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  writeDb(db);
  res.json({ message: 'Campaign deleted successfully' });
});


// --- REPORTS AND STATS ROUTES ---

// Stats for dashboard
app.get('/api/reports/stats', authenticateToken, (req, res) => {
  const db = readDb();
  const userCampaigns = db.campaigns.filter(c => c.userId === req.user.id);
  
  let totalCampaigns = userCampaigns.length;
  let activeCampaigns = userCampaigns.filter(c => c.status === 'Running').length;
  let completedCampaigns = userCampaigns.filter(c => c.status === 'Completed').length;
  let pausedCampaigns = userCampaigns.filter(c => c.status === 'Paused').length;
  let draftCampaigns = userCampaigns.filter(c => c.status === 'Draft').length;

  let totalContacts = 0;
  let sentContacts = 0;
  let failedContacts = 0;
  let pendingContacts = 0;
  let invalidNumbers = 0;

  userCampaigns.forEach(c => {
    c.contacts.forEach(contact => {
      totalContacts++;
      if (contact.status === 'Sent') sentContacts++;
      else if (contact.status === 'Failed') failedContacts++;
      else if (contact.status === 'Pending') pendingContacts++;
      else if (contact.status === 'Invalid') invalidNumbers++;
    });
  });

  // Calculate daily sending progress
  const settings = db.settings[req.user.id] || { dailyLimit: 100 };
  const dailyLimit = parseInt(settings.dailyLimit) || 100;
  
  const todayStr = new Date().toISOString().split('T')[0];
  let todaySent = 0;
  userCampaigns.forEach(c => {
    c.contacts.forEach(contact => {
      if ((contact.status === 'Sent' || contact.status === 'Failed') && contact.sentAt && contact.sentAt.startsWith(todayStr)) {
        todaySent++;
      }
    });
  });

  // Send history line chart data (grouped by date of sentAt)
  const historyByDate = {};
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    last7Days.push(dateStr);
    historyByDate[dateStr] = { sent: 0, failed: 0 };
  }

  userCampaigns.forEach(c => {
    c.contacts.forEach(contact => {
      if (contact.sentAt && (contact.status === 'Sent' || contact.status === 'Failed')) {
        const dateStr = contact.sentAt.split('T')[0];
        if (historyByDate[dateStr]) {
          if (contact.status === 'Sent') {
            historyByDate[dateStr].sent++;
          } else {
            historyByDate[dateStr].failed++;
          }
        }
      }
    });
  });

  const chartData = last7Days.map(date => ({
    date: date.substring(5), // MM-DD format
    sent: historyByDate[date].sent,
    failed: historyByDate[date].failed
  }));

  res.json({
    campaigns: {
      total: totalCampaigns,
      active: activeCampaigns,
      completed: completedCampaigns,
      paused: pausedCampaigns,
      draft: draftCampaigns
    },
    contacts: {
      total: totalContacts,
      sent: sentContacts,
      failed: failedContacts,
      pending: pendingContacts,
      invalid: invalidNumbers
    },
    limits: {
      sentToday: todaySent,
      dailyLimit: dailyLimit
    },
    chartData
  });
});

// Detailed history of processed messages
app.get('/api/reports/history', authenticateToken, (req, res) => {
  const db = readDb();
  const userCampaigns = db.campaigns.filter(c => c.userId === req.user.id);
  
  const history = [];
  userCampaigns.forEach(campaign => {
    campaign.contacts.forEach(contact => {
      if (contact.status !== 'Pending') {
        history.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          contactId: contact.id,
          contactName: contact.name,
          phone: contact.phone,
          status: contact.status,
          sentAt: contact.sentAt,
          errorReason: contact.errorReason
        });
      }
    });
  });

  // Sort by latest sent
  history.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  res.json(history);
});


// --- WHATSAPP API ROUTES ---

// Get Status of WhatsApp Web Connection
app.get('/api/whatsapp/status', authenticateToken, (req, res) => {
  res.json(whatsappService.getStatus());
});

// Initialize and Connect WhatsApp
app.post('/api/whatsapp/connect', authenticateToken, (req, res) => {
  whatsappService.initialize();
  res.json({ message: 'WhatsApp initialization started', ...whatsappService.getStatus() });
});

// Log out and disconnect WhatsApp
app.post('/api/whatsapp/disconnect', authenticateToken, async (req, res) => {
  await whatsappService.disconnect();
  res.json({ message: 'WhatsApp disconnected successfully', ...whatsappService.getStatus() });
});


// Start Campaign Runner background simulation
campaignRunner.init();

app.listen(PORT, () => {
  console.log(`Arivippu server running on http://localhost:${PORT}`);
});
