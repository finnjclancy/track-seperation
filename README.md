# AI Music Studio

A web-based Digital Audio Workstation (DAW) that lets you import songs from YouTube, separate them into stems using AI, and remix them with virtual instruments.

## Tech Stack

- **Frontend:** Next.js (React), Tone.js, Tailwind CSS
- **AI Engine:** Python (FastAPI), Demucs, yt-dlp
- **Backend/Storage:** Supabase

## Setup

### Prerequisites
- Node.js
- Python 3.9+
- FFmpeg

### Environment Variables

Create the following files before running any services:

- `backend/.env` – copy from `backend/.env.example` and provide your Supabase project URL plus the **service role** key (never commit the real key).
- `frontend/.env.local` – copy from `frontend/.env.example` and fill in the Supabase URL plus the **anon/public** key.

These values are required because both the FastAPI backend and the Next.js frontend read directly from environment variables at runtime.

### Installation

1. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. **Backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
