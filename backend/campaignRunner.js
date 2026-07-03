import { readDb, writeDb } from './db.js';
import { whatsappService } from './whatsappService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to check if current time is inside the active hours window
function isInsideActiveHours(startStr = '09:00', endStr = '18:00') {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startStr.split(':').map(Number);
  const startMinutes = startH * 60 + (isNaN(startM) ? 0 : startM);

  const [endH, endM] = endStr.split(':').map(Number);
  const endMinutes = endH * 60 + (isNaN(endM) ? 0 : endM);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight window (e.g. 22:00 to 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

// Helper to get seconds until a specific target time (e.g. next morning 09:00)
function getSecondsUntilTime(timeStr = '09:00') {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, isNaN(m) ? 0 : m, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1); // target is tomorrow
  }
  return Math.max(5, Math.round((target.getTime() - now.getTime()) / 1000));
}

class CampaignRunnerManager {
  constructor() {
    this.activeIntervals = new Map(); // campaignId -> Timeout ID
  }

  init() {
    const db = readDb();
    db.campaigns.forEach(campaign => {
      if (campaign.status === 'Running') {
        this.start(campaign.id);
      }
    });
  }

  start(campaignId) {
    if (this.activeIntervals.has(campaignId)) {
      return; // Already running
    }

    const runNext = async () => {
      const db = readDb();
      const campaignIndex = db.campaigns.findIndex(c => c.id === campaignId);

      if (campaignIndex === -1) {
        this.stop(campaignId);
        return;
      }

      const campaign = db.campaigns[campaignIndex];

      // If campaign was paused or stopped, clear timer
      if (campaign.status !== 'Running') {
        this.stop(campaignId);
        return;
      }

      // --- RULE 1: WhatsApp Connection Check ---
      if (whatsappService.status !== 'Connected') {
        campaign.status = 'Paused';
        campaign.errorReason = 'WhatsApp Web not connected. Please pair your WhatsApp device in Settings first.';
        writeDb(db);
        this.stop(campaignId);
        console.log(`Campaign ${campaignId} paused: WhatsApp client is disconnected.`);
        return;
      }

      // --- RULE 2: Active Hours Check (e.g. 09:00 to 18:00) ---
      const activeStart = campaign.activeHoursStart || '09:00';
      const activeEnd = campaign.activeHoursEnd || '18:00';
      if (!isInsideActiveHours(activeStart, activeEnd)) {
        const sleepSec = getSecondsUntilTime(activeStart);
        campaign.errorReason = `Outside active hours (${activeStart} - ${activeEnd}). Pausing queue until ${activeStart}.`;
        writeDb(db);
        
        console.log(`Campaign ${campaignId} sleeping for ${sleepSec} seconds until active window opens at ${activeStart}.`);
        const timerId = setTimeout(runNext, sleepSec * 1000);
        this.activeIntervals.set(campaignId, timerId);
        return;
      }

      // --- RULE 3: Campaign Duration Days Check ---
      const createdAt = new Date(campaign.createdAt);
      const durationDays = parseInt(campaign.durationDays) || 7;
      const durationMs = durationDays * 24 * 60 * 60 * 1000;
      if (new Date() - createdAt > durationMs) {
        campaign.status = 'Completed';
        campaign.errorReason = `Campaign duration threshold reached (${durationDays} days limit).`;
        writeDb(db);
        this.stop(campaignId);
        console.log(`Campaign ${campaignId} expired after ${durationDays} days duration.`);
        return;
      }

      // --- RULE 4: Daily Sending Limits Check (e.g. 20 shares per day) ---
      const settings = db.settings[campaign.userId] || { dailyLimit: 20, demoMode: true };
      const limitQuota = parseInt(campaign.dailyLimit) || parseInt(settings.dailyLimit) || 20;

      // Count messages sent today by this campaign
      const todayStr = new Date().toISOString().split('T')[0];
      let todaySentCount = 0;
      campaign.contacts.forEach(contact => {
        if ((contact.status === 'Sent' || contact.status === 'Failed') && contact.sentAt && contact.sentAt.startsWith(todayStr)) {
          todaySentCount++;
        }
      });

      if (todaySentCount >= limitQuota) {
        // Daily limit reached: wait until tomorrow's active hours start
        const sleepSec = getSecondsUntilTime(activeStart);
        campaign.errorReason = `Daily sending quota of ${limitQuota} messages reached. Resuming tomorrow at ${activeStart}.`;
        writeDb(db);
        
        console.log(`Campaign ${campaignId} reached daily limit (${limitQuota}). Sleeping until tomorrow at ${activeStart}.`);
        const timerId = setTimeout(runNext, sleepSec * 1000);
        this.activeIntervals.set(campaignId, timerId);
        return;
      }

      // Find next pending contact
      const pendingContact = campaign.contacts.find(c => c.status === 'Pending');

      if (!pendingContact) {
        campaign.status = 'Completed';
        campaign.errorReason = null;
        writeDb(db);
        this.stop(campaignId);
        console.log(`Campaign ${campaignId} completed: no pending contacts.`);
        return;
      }

      // Process this contact
      const contactIndex = campaign.contacts.indexOf(pendingContact);
      
      // Clean phone number format
      const phoneClean = pendingContact.phone.replace(/[^0-9+]/g, '');
      if (!phoneClean || phoneClean.length < 8) {
        campaign.contacts[contactIndex].status = 'Invalid';
        campaign.contacts[contactIndex].sentAt = new Date().toISOString();
        campaign.contacts[contactIndex].errorReason = 'Invalid phone number format';
        campaign.currentContactIndex = contactIndex + 1;
        
        // Save & continue immediately on invalid format
        writeDb(db);
        scheduleNextTick(0.5); // Check next immediately
        return;
      }

      // Attempt actual WhatsApp message delivery
      try {
        campaign.errorReason = 'Dispatching message...';
        writeDb(db);

        // Retrieve first image if uploaded
        let relativeImgPath = null;
        if (campaign.images && campaign.images.length > 0) {
          relativeImgPath = campaign.images[0]; // Take first image
        }

        // Send via WhatsApp Web automation
        await whatsappService.sendWhatsAppMessage(
          pendingContact.phone,
          campaign.caption,
          relativeImgPath
        );

        // Success
        campaign.contacts[contactIndex].status = 'Sent';
        campaign.contacts[contactIndex].sentAt = new Date().toISOString();
        campaign.contacts[contactIndex].errorReason = null;
      } catch (err) {
        // Failed sending
        console.error(`WhatsApp Dispatch failed to ${pendingContact.phone}:`, err);
        campaign.contacts[contactIndex].status = 'Failed';
        campaign.contacts[contactIndex].sentAt = new Date().toISOString();
        campaign.contacts[contactIndex].errorReason = err.message || 'Unknown network error';
      }

      // Update index counter
      campaign.currentContactIndex = contactIndex + 1;
      campaign.errorReason = null;

      // Check if that was the last contact
      const hasMorePending = campaign.contacts.some(c => c.status === 'Pending');
      if (!hasMorePending) {
        campaign.status = 'Completed';
      }

      writeDb(db);

      // Trigger next schedule block if still running
      if (campaign.status === 'Running') {
        scheduleNext();
      } else {
        this.stop(campaignId);
      }
    };

    const scheduleNextTick = (sec) => {
      const timerId = setTimeout(runNext, sec * 1000);
      this.activeIntervals.set(campaignId, timerId);
    };

    const scheduleNext = () => {
      const db = readDb();
      const campaign = db.campaigns.find(c => c.id === campaignId);
      if (!campaign || campaign.status !== 'Running') return;

      const settings = db.settings[campaign.userId] || { demoMode: true };
      const isDemoMode = settings.demoMode === undefined ? true : settings.demoMode;

      // Get delay range (e.g. '10-15 minutes')
      let minDelay = 10;
      let maxDelay = 15;
      const interval = campaign.delayInterval || '10-15 minutes';

      if (interval.includes('-')) {
        const parts = interval.split('-').map(p => parseInt(p));
        minDelay = isNaN(parts[0]) ? 10 : parts[0];
        maxDelay = isNaN(parts[1]) ? 15 : parts[1];
      } else {
        const parsed = parseInt(interval);
        minDelay = isNaN(parsed) ? 10 : parsed;
        maxDelay = minDelay + 2;
      }

      // Generate random delay in the range
      const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
      
      // Calculate delay in seconds. If Demo Mode is active, minutes become seconds for fast testing
      const multiplier = isDemoMode ? 1 : 60;
      const finalDelaySec = Math.max(1, Math.round(randomDelay * multiplier));

      console.log(`Campaign ${campaignId} scheduling next message in ${finalDelaySec} seconds (isDemoMode: ${isDemoMode})`);

      const timerId = setTimeout(runNext, finalDelaySec * 1000);
      this.activeIntervals.set(campaignId, timerId);
    };

    // Update campaign status to active
    const db = readDb();
    const campaign = db.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.status = 'Running';
      campaign.errorReason = null;
      writeDb(db);
    }

    // Trigger first contact send immediately
    runNext();
  }

  pause(campaignId) {
    this.stop(campaignId);
    const db = readDb();
    const campaign = db.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.status = 'Paused';
      writeDb(db);
    }
  }

  resume(campaignId) {
    this.start(campaignId);
  }

  stop(campaignId) {
    const timerId = this.activeIntervals.get(campaignId);
    if (timerId) {
      clearTimeout(timerId);
      this.activeIntervals.delete(campaignId);
    }
    
    const db = readDb();
    const campaign = db.campaigns.find(c => c.id === campaignId);
    if (campaign && campaign.status === 'Running') {
      campaign.status = 'Paused';
      writeDb(db);
    }
  }
}

export const campaignRunner = new CampaignRunnerManager();
