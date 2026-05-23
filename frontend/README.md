# TalentMatch — Frontend (`talentmatch-ui`)

React single-page app for the **Intelligent Talent Matching Platform** (CSIT314 coursework). Talks to the Flask backend over a JWT-authenticated REST API; auth state persists in `localStorage`.

## Stack

- **React** 19 + **Vite** 8
- **React Router** 7 (`BrowserRouter`)
- Plain `fetch` (no axios) wrapped in `src/lib/api.js`
- **ESLint** (see `eslint.config.js`)

## Prerequisites

- **Node.js** 20+ recommended
- **npm** (comes with Node)
- **The Flask backend must be running** at `http://127.0.0.1:5000`. See the backend README for setup.

## Setup

```powershell
npm install
copy .env.example .env   # only needed if you want to point at a non-default backend
npm run dev              # default: http://localhost:5173
```

Scripts:

```
npm run dev      # start dev server
npm run build    # production build → dist/
npm run preview  # serve the production build locally
npm run lint     # run ESLint
```

## How to run the full app (both servers)

You need **two terminals**, both left open:

```powershell
# Terminal 1 — backend
cd ..\backend
.\venv\Scripts\Activate.ps1
py app.py

# Terminal 2 — frontend
cd ..\frontend
npm run dev
```

Open `http://localhost:5173` in the browser.

## Demo accounts

```
admin@test.com / 123456    (admin)
abz0@test.com  / 123456    (employer — University of Wollongong)
sk12@test.com  / 123456    (candidate — Sujal Kumar)
```

All three start as Non-Member. Click "Upgrade to Membership" in the candidate or employer dashboard to trigger the simulated payment flow.

For the payment form use:
- Card: `4242 4242 4242 4242`
- Expiry: any future date (e.g. `12/29`)
- CVV: any 3 digits (e.g. `123`)
- Name and email: anything

## Configuration

`.env` (optional):

```
VITE_API_URL=http://127.0.0.1:5000
```

All `VITE_*` vars are bundled into the client at build time. If you change the backend host or port, update this and restart `npm run dev`.

## Architecture

The app is a pure client; all data lives on the backend / in Supabase. The only thing kept in browser `localStorage` is the JWT and a cached copy of the user object — both managed exclusively by `src/lib/auth.js`.

API calls go through `src/lib/api.js`, which:
- Reads `VITE_API_URL` for the base URL
- Adds the `Authorization: Bearer <token>` header automatically when a token exists
- Throws a clear error if the backend can't be reached
- Clears the token on `401` so the next render redirects to `/login`

Page components fetch on mount via `useEffect` and call the API directly. There's no global state library; we don't need one at this scale.

## Routes

```
/                            Landing page
/login                       Login form
/candidate-signup            Role picker (candidate or employer)
/candidate-signup/candidate  Candidate signup + profile form (also "Edit Profile")
/candidate/dashboard         Candidate dashboard (recommendations)
/candidate/job-search        Job search with filters + fuzzy keyword
/candidate/job-details       Single job view + Apply modal
/candidate/my-applications   Candidate's application history
/employer-signup             Employer signup form
/employer/dashboard          Employer dashboard (posted jobs + applications)
/employer/create-job         Job posting form
/employer/find-candidates    Candidate search (or recommended for a given job)
```

## Project layout

```
talentmatch-ui/
├── public/
├── src/
│   ├── App.jsx               # route table
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── UpgradeModal.jsx  # paid-upgrade flow modal
│   │   └── UpgradeModal.css
│   ├── pages/                # one .jsx + .css per page (12 pages)
│   ├── lib/
│   │   ├── api.js            # fetch wrapper with JWT
│   │   ├── auth.js           # token + user storage, login/register/logout
│   │   └── talentmatchStorage.js  # legacy localStorage helpers (unused)
│   └── assets/
├── data/                     # legacy JSON fixtures from earlier prototype (unused)
├── index.html
├── vite.config.js
├── .env.example
├── eslint.config.js
└── package.json
```

`data/` and `src/data/` contain JSON fixtures from when the app was localStorage-only. The current build doesn't reference them, but they're kept for reference and could be removed.

## Backend dependency

This frontend is non-functional without the Flask backend running. If you see "Could not reach the backend" anywhere in the UI, the backend isn't up.

Things to check:
1. Is the backend running? Open `http://127.0.0.1:5000/` — should return a JSON message.
2. Is `VITE_API_URL` set correctly in `.env`?
3. Has the backend's `CORS_ORIGINS` env var been set to include `http://localhost:5173`? The backend defaults to that, but a deployment may need to change it.

## Repository note

This folder is the frontend package. The GitHub remote may be a monorepo root with the Flask backend as a sibling folder; if so, link or document where this app lives inside that repo for teammates.

Developed by Alyan Alam as part of CSIT314 — Systems Development Methodologies, University of Wollongong.
