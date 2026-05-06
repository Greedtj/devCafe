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

- `index.html` customer app
- `admin.html` admin app
- `src/` frontend modules
- `apps-script/Code.gs` Google Apps Script backend
- `src/config.js` API URL and LIFF ID placeholders

## Next step

1. Create a Google Sheet and paste `apps-script/Code.gs` into Apps Script.
2. Deploy the Apps Script as a web app.
3. Set the web app URL and LIFF ID in `src/config.js`.
4. Upload this repo to GitHub Pages.
5. Register the GitHub Pages URL as the LIFF endpoint.

## Deployment note

This repo is a demo-first scaffold. For a production-like setup, the cleanest free path is usually to host the customer UI where it can call the same Apps Script origin or use an Apps Script HTML Service wrapper. If you keep GitHub Pages for the UI, you may need a small proxy layer because browser CORS with Apps Script can be restrictive.
