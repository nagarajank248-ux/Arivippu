# Arivippu 🚀
> **Tagline:** *Your Message, Delivered at the Right Time.*

**Arivippu** is a modern, high-performance campaign management and message scheduling platform. It allows businesses and individuals to import contact sheets, manage user profiles, compose advertisement messages with accompanying media, configure custom delivery throttle intervals, and run background sending dispatch jobs with live status updates.

---

## 🌟 Key Features

1. **Modern Responsive Dashboard:** Sleek dark-mode interface powered by glassmorphism, responsive navigation grids, custom SVG analytics charts mapping transmission success rates, and live progress trackers.
2. **Secure Account Management:** Local JSON password encryption using `bcryptjs` and session tokens powered by `jsonwebtoken` (JWT).
3. **Advanced Campaign Creator:** Supports rich media attachments (images upload), scheduling future calendar launches, and text layouts.
4. **Flexible Contact Imports:** Import CSV lists using a robust POSIX-aligned parser or paste raw numbers directly.
5. **Real-time Campaign Orchestrator:** Active memory queue execution on Node.js supporting `Start`, `Pause`, `Resume`, and `Stop` actions. Delays can be custom configured and are simulated in seconds for interactive testing.
6. **Delivery Reports:** Interactive logs showing Sent vs. Failed counts, status filters, phone validations, error reason tracking, and automated Blob-based exports to CSV files.
7. **System Limits & Preferences:** Change account details and throttle message throughput via daily sending caps.

---

## 🏗️ Architecture Stack

- **Frontend:** React SPA scaffolded with Vite (Vanilla CSS layout styling for maximum flex and animations).
- **Backend:** Node.js, Express REST API, Multer multipart file uploader.
- **Database:** Pure JavaScript JSON storage engine writing to `backend/data.json` (100% portable out-of-the-box, requires no external databases or compiler tools).

---

## ⚙️ Quick Start Installation

Ensure you have [Node.js](https://nodejs.org/) installed (LTS recommended).

### 1. Install All Dependencies
Run this in the project root directory to fetch all Node packages for both client and server:
```bash
npm run install:all
```

### 2. Start Services
Run the Startup Orchestrator to boot both the Vite dev client and the Node Express server concurrently:
```bash
npm start
```

- **Vite Web Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Express Backend API:** [http://localhost:5000](http://localhost:5000)

---

## 🧪 Testing and Walkthrough Guide

To verify all components of the platform:

1. **Sign Up:** Create a new account in the login portal. It will register you and automatically save default system profiles and preferences.
2. **Sample Contact Sheet:** A helper file called `sample_contacts.csv` has been created in your root workspace. It includes correct phone numbers (which will simulate standard deliveries), a too-short number `12345` (which will fail formatting check and flag as `Invalid`), and some numbers pre-programmed to simulate network exceptions (5% to 10% rate) to demonstrate statistics maps.
3. **Create Campaign:** 
   - Enter a campaign name.
   - Upload the `sample_contacts.csv` file.
   - Select some image ads.
   - Set start times and delays (e.g. 5 seconds for fast updates).
   - Click **Create & Schedule** or **Save as Draft**.
4. **Trigger Actions:** Click **Start** or **Resume** on your campaign. The background runner will begin parsing lists and dispatching messages one-by-one.
5. **Watch Live Feed:** Head back to the **Dashboard**. You will see statistics cards update, success rates compute, and daily limits bars fill up in real time!
6. **Export Reports:** Navigate to the **Reports** tab, filter by status, and click **Export to CSV** to download the delivery details.
