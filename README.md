# Punch — Time In / Time Out & Work Schedule App

A mobile-first personal attendance and schedule tracker: calendar view, time
in/out, automatic hours & overtime calculation, payroll cutoff summaries, and
end-of-day work logs.

## Data storage

All data (schedule, attendance, work logs) is stored **locally in the
browser's IndexedDB database** — see `src/storage.js`. It persists across
closing the tab, closing the browser, and restarting the device. Nothing is
sent to a server. It is tied to one browser on one device; there's no
cross-device sync built in.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (defaults to `http://localhost:5173`).

## Deploy to Render.com

This builds to a static site, so use a Render **Static Site**:

1. Push this project to a GitHub (or GitLab) repository.
2. In Render, click **New +** → **Static Site**, and connect that repo.
3. Set:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Deploy. Render will give you a URL like `https://your-app.onrender.com`.

Optional but recommended for a phone-like experience:
- On your phone, open the deployed URL in the browser, then use
  "Add to Home Screen" (Safari) or "Install app" (Chrome) so it opens
  full-screen like a native app.

## Notes

- Requires a JS-enabled browser with IndexedDB support (all modern mobile
  and desktop browsers).
- Clearing browsing data/history for the site in the browser will clear the
  app's data, same as it would for any website. Normal restarts, force-closing
  the app, or turning the device off will not.
