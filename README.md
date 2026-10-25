# MediMate — A Personal Health Assistant
Your Health, Your Reminder, Your Trusted Companion.

## How to Run
1. Unzip
2. Double-click index.html OR run a simple server:
   - Python: python -m http.server 8000
   - Node: npx serve .
3. Open http://localhost:8000

## Features Implemented
- Secure Auth (mock Supabase, localStorage RLS)
- Medicine Management (CRUD, multiple times/day)
- Smart Voice Reminders (TTS + Notification API, Confirm/Snooze)
- Favourite-Person Voice Recording (MediaRecorder API)
- Caregiver Access (invite + granular permissions inside unified dashboard)
- Medical Records Vault (upload, preview, search, download)
- Prescription & Report Scanner (OCR simulation with verification gate)
- AI Medicine Assistant (uses only verified meds)
- Medicine Price Comparison (Truemeds, PharmEasy, Apollo 24|7 - demo sample data)
- Health Summary + Settings Privacy Security

## Design
Soft blue, teal, white, green. Rounded cards, large buttons for elderly, responsive, accessible.

## Note
This is frontend-only prototype using localStorage to simulate Supabase tables:
profiles, medications, reminder_history, voice_recordings, caregiver_invites, medical_documents, ocr_results, reminder_prefs
For production, connect to Supabase as per master prompt.

Built as B.Tech CSE project — professional healthcare product look.
