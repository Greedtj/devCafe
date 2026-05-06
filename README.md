# DevCafe Mini Project

โปรเจกต์ตัวอย่างสำหรับสั่งเครื่องดื่มผ่าน LINE OA แบบฟรี 100% ด้วย LIFF + Google Apps Script + Google Sheets + Vercel

## What is included

- Customer ordering page
- Cart and checkout flow
- Admin page for menu / pricing / payment QR settings
- Google Apps Script backend for Google Sheets storage
- LINE Flex Message response payload builder

## Recommended stack

- Frontend: plain HTML + CSS + vanilla JS for the first version
- Hosting: Vercel
- Backend: Google Apps Script
- Database: Google Sheets

## Why this stack

- Free to deploy
- Very low operational overhead
- Enough for a mini cafe ordering project
- Easy to connect with LINE LIFF and Flex Message

## Local structure

- `frontend/` Vite + Vue + Tailwind app
- `apps-script/Code.gs` Google Apps Script backend
- `frontend/.env.example` runtime env template

## Next step

1. `cd frontend`
2. Run `npm install`
3. Run `npm run dev`
4. Create a Google Sheet and paste `apps-script/Code.gs` into Apps Script.
5. Deploy the Apps Script as a web app.
6. Copy the web app URL and LIFF ID into `frontend/.env`.
7. Import this repo into Vercel and set the root directory to `frontend`.
8. Register the Vercel production URL as the LIFF endpoint.

## Frontend env values

Create `frontend/.env` from `frontend/.env.example` and fill these values:

- `VITE_LIFF_ID`  
  Use the LIFF ID created in the LINE Developers console.
- `VITE_API_BASE_URL`  
  Use `/api/apps-script` in Vercel so the frontend talks to the same origin.
- `VITE_PAYMENT_QR_URL`  
  Use a public image URL for the shop QR payment code.
- `VITE_BASE_PATH`  
  Use `/` for Vercel root hosting.
- `APPS_SCRIPT_WEBAPP_URL`  
  Use the deployed Google Apps Script web app URL, ending with `/exec`. This is used by the Vercel proxy function.

If a value is empty, the app falls back to local demo mode for that part.

## LIFF setup

1. Open the LINE Developers console.
2. Create or open your Messaging API channel.
3. Add a LIFF app.
4. Set the LIFF endpoint to the deployed Vercel production URL.
5. Copy the LIFF ID into `frontend/.env`.
6. In LINE OA rich menu or chat menu, point the button to the LIFF URL.

## Apps Script setup

1. Open Google Sheets and create a new sheet for DevCafe.
2. Open `Extensions > Apps Script`.
3. Paste the contents of `apps-script/Code.gs`.
4. Deploy > New deployment > Web app.
5. Set access to the option that matches your use case.
6. Copy the `/exec` URL into `frontend/.env` as `VITE_API_BASE_URL`.

## Deploy checklist

- Frontend build passes with `npm run build`
- `.env` is filled
- `VITE_BASE_PATH=/`
- Apps Script web app is deployed
- LIFF endpoint points to the live frontend
- Rich menu button opens the LIFF app
- QR payment image URL is public

## Vercel setup

1. Create or sign in to Vercel.
2. Import this GitHub repository as a new project.
3. Set the root directory to `frontend`.
4. Keep the build command as `npm run build`.
5. Keep the output directory as `dist`.
6. Add these environment variables in Vercel:
   - `VITE_LIFF_ID`
   - `VITE_API_BASE_URL`
   - `VITE_PAYMENT_QR_URL`
   - `VITE_BASE_PATH=/`
   - `APPS_SCRIPT_WEBAPP_URL`
7. Deploy.

## Why Vercel

- Free Hobby plan available.
- Works well with private GitHub repositories.
- Produces a stable production URL for LIFF.
- Easier path than GitHub Pages when the repo is private.

## Legacy files

The root-level HTML/CSS/JS scaffold was removed. The active app is under `frontend/`.
