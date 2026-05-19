# Local Development Setup Guide

## Prerequisites
- **Python 3.11 or 3.12** (NOT 3.14 - compatibility issues)
- Node.js 18+ and npm 9+
- Supabase CLI

## Backend Setup (Python 3.11/3.12)

### Step 1: Switch to Python 3.11/3.12
Download from https://www.python.org/downloads/ and install Python 3.11 or 3.12

### Step 2: Create Virtual Environment
```bash
cd backend
python -m venv venv
```

**Windows:**
```bash
.\venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Start Backend Server
```bash
python -m uvicorn app.main:app --reload
```

Backend will be available at: **http://localhost:8000**

---

## Frontend Setup

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

Frontend will be available at: **http://localhost:3000** or **http://localhost:5173**

---

## Supabase Local Database

### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 2: Initialize and Start Supabase Locally
```bash
supabase init
supabase start
```

This will output:
- API URL (e.g., http://localhost:54321)
- Anon key
- Service role key

### Step 3: Update .env File
Update `.env` in the root directory with values from `supabase start`:
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
```

### Step 4: Set up Database Schema
```bash
supabase db reset
```

This creates the `applications` table.

---

## Running Everything

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
python -m uvicorn app.main:app --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

**Terminal 3 (Supabase - if needed):**
```bash
supabase start
```

---

## Common Issues

### uvicorn: No module named
- Make sure you're in the `backend` directory
- Make sure your venv is activated
- Reinstall: `pip install -r requirements.txt`

### Supabase connection errors
- Check `.env` has correct SUPABASE_URL and SUPABASE_ANON_KEY
- Run `supabase start` in project root
- Ensure Docker is running (Supabase local uses Docker)

### Port already in use
- Backend: Change `uvicorn app.main:app --reload --port 8001`
- Frontend: Change `npm run dev -- --port 3001`

