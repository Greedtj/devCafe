# DevCafe Mini Project

โปรเจกต์ตัวอย่างสำหรับสั่งเครื่องดื่มผ่าน LINE OA แบบฟรี 100% ด้วย LIFF + Google Apps Script + Google Sheets + GitHub Pages

## What is included

- Customer ordering page
- Cart and checkout flow
- Admin page for menu / pricing / payment QR settings
- Google Apps Script backend for Google Sheets storage
- LINE Flex Message response payload builder

## Recommended stack

- Frontend: plain HTML + CSS + vanilla JS for the first version
- Hosting: GitHub Pages
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
7. Deploy the frontend folder to your preferred static host.
8. Register the deployed frontend URL as the LIFF endpoint.

## Frontend env values

Create `frontend/.env` from `frontend/.env.example` and fill these values:

- `VITE_LIFF_ID`  
  Use the LIFF ID created in the LINE Developers console.
- `VITE_API_BASE_URL`  
  Use the deployed Google Apps Script web app URL, ending with `/exec`.
- `VITE_PAYMENT_QR_URL`  
  Use a public image URL for the shop QR payment code.
- `VITE_BASE_PATH`  
  Use `/` for root hosting. If you deploy under a subpath, set that path here.

If a value is empty, the app falls back to local demo mode for that part.

## LIFF setup

1. Open the LINE Developers console.
2. Create or open your Messaging API channel.
3. Add a LIFF app.
4. Set the LIFF endpoint to the deployed frontend URL.
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
- `VITE_BASE_PATH` matches your hosting path
- Apps Script web app is deployed
- LIFF endpoint points to the live frontend
- Rich menu button opens the LIFF app
- QR payment image URL is public

## Deployment note

This repo is a demo-first scaffold. For a production-like setup, the cleanest free path is usually to host the customer UI where it can call the same Apps Script origin or use an Apps Script HTML Service wrapper. If you keep GitHub Pages for the UI, you may need a small proxy layer because browser CORS with Apps Script can be restrictive.

## Scale-up recommendation

If you want this to become a real long-term project, the next clean move is:

1. Keep the frontend in `frontend/` with Vite + Vue 3 + Tailwind.
2. Read runtime values from `.env` using `VITE_` variables.
3. Keep Apps Script only as the first backend, so the frontend stays portable.
4. Move to Supabase or another API later only when the Sheets-based flow becomes limiting.

## Legacy files

The root-level HTML/CSS/JS scaffold still exists from the first prototype. You can ignore it now; the `frontend/` directory is the active path for the scalable build.
The root-level `.env.example` is also legacy; use `frontend/.env.example` for the Vite app.
