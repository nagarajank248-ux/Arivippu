import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, LocalAuth, MessageMedia } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to locate local Chrome or Edge on Windows/Linux
function getChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', // Fallback to Edge
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser'
  ];
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'));
  }
  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log(`Found Chromium browser at: ${p}`);
      return p;
    }
  }
  return null;
}

class WhatsAppService {
  constructor() {
    this.client = null;
    this.status = 'Disconnected'; // 'Disconnected' | 'Connecting' | 'QR_Code' | 'Connected'
    this.qrCodeData = null; // Base64 data URL
    this.phoneNumber = null;
  }

  initialize() {
    if (this.client) {
      console.log('WhatsApp client already initialized.');
      return;
    }

    console.log('Initializing WhatsApp client...');
    this.status = 'Connecting';
    this.qrCodeData = null;

    const chromePath = getChromePath();
    const puppeteerOptions = {
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      ],
      headless: true
    };

    if (chromePath) {
      puppeteerOptions.executablePath = chromePath;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'arivippu-session'
      }),
      puppeteer: puppeteerOptions
    });

    this.client.on('qr', async (qr) => {
      console.log('WhatsApp QR Code generated.');
      this.status = 'QR_Code';
      try {
        this.qrCodeData = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('Error generating QR Data URL:', err);
      }
    });

    this.client.on('ready', () => {
      console.log('WhatsApp Client is READY!');
      this.status = 'Connected';
      this.qrCodeData = null;
      this.phoneNumber = this.client.info.wid.user;
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client authenticated.');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp Auth failure:', msg);
      this.status = 'Disconnected';
      this.qrCodeData = null;
      this.client = null;
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp Client disconnected:', reason);
      this.status = 'Disconnected';
      this.qrCodeData = null;
      this.phoneNumber = null;
      this.client = null;
    });

    // Catch crashes or uncaught exceptions from headless chrome
    this.client.initialize().catch(err => {
      console.error('Failed to initialize WhatsApp Web client:', err);
      this.status = 'Disconnected';
      this.client = null;
    });
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.destroy();
      } catch (err) {
        console.error('Error logging out from WhatsApp:', err);
      }
      this.client = null;
    }

    // Always clear session folder to ensure clean state on next run
    try {
      const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session-arivippu-session');
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log('Cleared local session directory.');
      }
    } catch (e) {
      console.error('Failed to clear session folder:', e);
    }

    this.status = 'Disconnected';
    this.qrCodeData = null;
    this.phoneNumber = null;
    console.log('WhatsApp client disconnected successfully.');
  }

  getStatus() {
    return {
      status: this.status,
      qrCodeData: this.qrCodeData,
      phoneNumber: this.phoneNumber
    };
  }

  async sendWhatsAppMessage(toPhone, text, imagePath = null) {
    if (this.status !== 'Connected' || !this.client) {
      throw new Error('WhatsApp client is not connected. Please scan the QR code first.');
    }

    // Clean phone number (leave digits only)
    let cleanPhone = toPhone.replace(/[^0-9]/g, '');
    
    // WhatsApp expects format like: 919876543210@c.us
    // Check if it already has country code, if not, it should be added.
    // For India, users might enter 10 digits, we can default append '91' if length is 10 digits and starts with 6-9 (common mobile starts).
    if (cleanPhone.length === 10 && /^[6789]/.test(cleanPhone)) {
      cleanPhone = '91' + cleanPhone;
    }

    const chatId = `${cleanPhone}@c.us`;

    // Check if number is registered on WhatsApp (optional but recommended to prevent block)
    try {
      const isRegistered = await this.client.isRegisteredUser(chatId);
      if (!isRegistered) {
        throw new Error('This number is not registered on WhatsApp.');
      }
    } catch (e) {
      console.warn('Could not verify if user is registered, attempting to send anyway.', e);
    }

    if (imagePath) {
      // Find absolute path of the uploaded image
      // On Windows, a path starting with "/" is considered absolute (root relative to current drive),
      // but it is actually relative to the backend folder (e.g. "/uploads/...").
      const cleanImgPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
      const absoluteImagePath = path.join(__dirname, cleanImgPath);

      if (fs.existsSync(absoluteImagePath)) {
        console.log(`Sending image ${absoluteImagePath} to ${chatId}`);
        const media = MessageMedia.fromFilePath(absoluteImagePath);
        return await this.client.sendMessage(chatId, media, { caption: text });
      } else {
        console.warn(`Image file not found at ${absoluteImagePath}, sending text only.`);
      }
    }

    // Send text only
    console.log(`Sending text message to ${chatId}`);
    return await this.client.sendMessage(chatId, text);
  }
}

export const whatsappService = new WhatsAppService();
