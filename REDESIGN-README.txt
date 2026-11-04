LUWANG — REDESIGN FIRST FINAL PASS

What changed in this source:
- Added a responsive Quick access section on Home for Schedule, Study & Fitness, Progress, and Angee AI.
- Consolidated the mobile floating navigation to exactly five destinations: Home, Schedule, Progress, Angee, Settings.
- Added themed gradient scenery to the welcome card for all eight themes.
- Added subtle motion and a prefers-reduced-motion fallback.
- Added responsive quick-access tiles and mobile safe-area padding.

Preservation:
- Existing React app, Supabase client/auth/cloud sync, settings, data flows, and pages are retained.
- Existing project files and src-backup are included. The original ZIP was not overwritten.

Try locally (Windows):
1. Extract this ZIP.
2. Open the extracted project folder in VS Code.
3. In Terminal run: npm install
4. Then run: npm run dev
5. Open the localhost URL shown in the terminal.

Build verification:
- npm ci was attempted in the preparation environment but timed out while installing dependencies.
- Therefore production build and browser testing are NOT verified here. Run npm run build locally after npm install.

Deploy:
- Commit/push to your existing GitHub master branch, then check the Vercel deployment.
- Keep your original project/ZIP as backup until you confirm the app works.
