# Project Setup Instructions

We have successfully migrated your project to a modern stack:
- **Frontend:** Next.js + Tone.js (for the DAW)
- **Backend:** Python FastAPI (for AI separation)
- **Database:** Supabase

## Step 1: Database Setup (Supabase)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/pboaikyugnocboathubn/editor).
2. Open the **SQL Editor**.
3. Copy and paste the contents of `backend/setup.sql` and run it.
   - This will create the `projects` table and the `stems` storage bucket.
   - It also sets up the security policies so users can only see their own projects.

## Step 2: Start the Backend

1. Open a terminal in the project root.
2. Run the following commands:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
   *Note: You need `ffmpeg` installed on your system (`brew install ffmpeg`).*

## Step 3: Start the Frontend

1. Open a second terminal.
2. Run the following commands:
   ```bash
   cd frontend
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Sign In:** Use your email to sign in (Magic Link).
2. **Add Song:** Click "Add Song" and paste a YouTube URL.
   - The backend will download and separate the tracks.
   - Progress will be saved to the database.
3. **Edit:** Once complete, the stems will appear in the workspace.
   - Use the **Volume** sliders to mix.
   - Use **Pitch** and **Speed** to remix the stems.
   - **Solo/Mute** tracks to isolate instruments.

## Next Steps

- Add **Virtual Instruments** (Piano, Drums) in the frontend.
- Add **Waveform Visualization** (using Wavesurfer.js or Tone.js analysis).
- Implement **Export/Download** mix functionality.

