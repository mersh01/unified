# Document Management System

A config-driven document replacement system for birth certificates and educational documents.

## Features

- Dynamic document types configured via JSON
- Automatic form generation based on configuration
- Workflow management for application processing
- Real-time status tracking
- Admin dashboard

## Local Development Setup

### Prerequisites

- Node.js and npm
- Python 3.8+
- Supabase CLI

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Initialize and Start Supabase Locally

```bash
supabase init
supabase start
```

Note the output values for `API URL` and `anon key`.

### 3. Configure Environment Variables

Update the `.env` file in the root directory:

```env
SUPABASE_URL=http://localhost:54321  # From supabase start output
SUPABASE_ANON_KEY=your-anon-key      # From supabase start output
```

### 4. Set up the Database

Run the SQL script to create the applications table:

```bash
supabase db reset  # Or manually run the SQL in supabase_init.sql
```

### 5. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 6. Run Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### 7. Run Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Docker Setup (Alternative)

```bash
docker-compose up --build
```