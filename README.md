# Notification System - Full-Stack Web Application

A clean, modern, responsive, and production-ready full-stack web application designed for collecting and securely storing user registration and notification details.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React (modern responsive UI, micro-interactions, real-time validation, responsive layout)
- **Backend**: Node.js (v24), Express, Zod (schema validation), CORS, Express Rate Limit
- **Database Client**: `pg` (node-postgres) with automatic SSL connection handling for **Neon Serverless PostgreSQL**

---

## 📁 Project Structure

```
Notification System/
├── package.json               # Root scripts (concurrently runner)
├── backend/
│   ├── .env                   # Environment variables (DATABASE_URL, PORT)
│   ├── .env.example           # Example configuration template
│   ├── server.js              # Express server setup, middleware & static serving
│   ├── db.js                  # PostgreSQL / Neon connection pool & schema migration
│   ├── routes/
│   │   └── submissions.js     # GET & POST /api/submissions endpoints
│   ├── validation/
│   │   └── submissionSchema.js# Zod schema validation rules
│   └── package.json
└── frontend/
    ├── index.html             # HTML entry point with Plus Jakarta Sans typography
    ├── vite.config.js         # Vite configuration with API proxy to port 5001
    ├── tailwind.config.js     # Tailwind CSS theme configuration
    ├── postcss.config.js
    ├── src/
    │   ├── main.jsx           # React DOM root
    │   ├── App.jsx            # Main app shell with dynamic view switcher
    │   ├── index.css          # Tailwind CSS directives and custom styling
    │   └── components/
    │       ├── Header.jsx           # Header with real-time status indicators
    │       ├── StatusBanner.jsx     # Database connection guidance & indicator
    │       ├── NotificationForm.jsx # Responsive form with live validation
    │       └── SubmissionsList.jsx  # Live submissions inspector & search
    └── package.json
```

---

## 📋 Form Fields & Validation

| Field Name | Type | Required | Validation Rules |
| :--- | :--- | :--- | :--- |
| **Full Name** | Text | **Yes** | Min 2 characters, max 100 characters. Letters, spaces, hyphens, and periods only. |
| **Email Address** | Email | **Yes** | Valid RFC email address format (e.g. `user@example.com`). Automatically trimmed and lowercased. |
| **Mobile Number** | Tel | **Yes** | Valid phone number format with 7 to 15 digits (e.g. `+91 9876543210` or `+1 555-0123`). |
| **Description** | Textarea | *Optional* | Up to 1000 characters. Live character counter included. |

### Key Features
- **Real-Time Client-Side Validation**: Instant green checkmarks for valid fields and descriptive inline error messages.
- **Server-Side Validation**: Robust schema validation powered by Zod to prevent incomplete or malformed requests.
- **Duplicate Prevention**:
  - Client-side submit lock preventing rapid accidental clicks.
  - Server-side sliding window check preventing duplicate submissions with the same contact info within 60 seconds.
- **Loading Indicators**: Submit button displays an animated spinner during processing and disables duplicate clicks.
- **Responsive Design**: Optimized for mobile phones, tablets, laptops, and ultra-wide desktops.
- **Submissions Inspector**: Built-in tab to view stored records in real time with quick search and filter.

---

## 🚀 Getting Started

### 1. Running the Application

You can run both backend and frontend concurrently with a single command from the root directory:

```bash
npm run dev
```

Or run them individually:

**Backend:**
```bash
npm run dev:backend
# Backend runs on http://localhost:5001
```

**Frontend:**
```bash
npm run dev:frontend
# Vite development server runs on http://localhost:5173
```

---

## 🗄️ Neon Database Integration

The application is completely configured and ready for Neon Database integration.

When you have your Neon Database connection URL:
1. Open `backend/.env`
2. Set your Neon connection string:
   ```env
   DATABASE_URL=postgresql://[user]:[password]@[neon-hostname]/[database]?sslmode=require
   ```
3. Save the file. The backend will automatically connect to Neon and create the `submissions` table and indexes if they do not exist.
4. All submissions will immediately be saved directly into your Neon PostgreSQL database!

