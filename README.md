# DevCafe

LINE LIFF ordering app for a cafe, backed by Vercel Functions, Prisma, and PostgreSQL.

## Stack

- Frontend: Vite + Vue + Pinia + Tailwind CSS
- Backend: Vercel Functions under `/api/dev-cafe`
- ORM: Prisma
- Database: PostgreSQL database `dev_cafe`
- LINE: LIFF profile + Messaging API push Flex Message

## Project Structure

- `frontend/` customer and admin UI
- `api/dev-cafe.js` production API endpoint
- `api/_dev-cafe-handler.cjs` shared API handler
- `prisma/schema.prisma` PostgreSQL schema

## Environment Variables

Create root `.env` for local API and Prisma:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/dev_cafe?schema=public"
LINE_CHANNEL_ACCESS_TOKEN="YOUR_LINE_MESSAGING_API_TOKEN"
```

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_APP_NAME=DevCafe
VITE_LIFF_ID=YOUR_LIFF_ID
VITE_API_BASE_URL=/api/dev-cafe
VITE_PAYMENT_QR_URL=
VITE_BASE_PATH=/
```

## Local Setup

Make sure PostgreSQL is running locally and listening on `localhost:5432`.

Create the database once if it does not exist:

```sql
CREATE DATABASE dev_cafe;
```

Then run:

```bash
npm install
npm install --prefix frontend
npm run db:push
npm run dev
```

Open:

```txt
http://localhost:5173/
http://localhost:5173/admin.html
```

## Database Tables

Prisma creates these PostgreSQL tables:

- `dev_cafe_menu`
- `dev_cafe_options`
- `dev_cafe_orders`
- `dev_cafe_order_items`
- `dev_cafe_customers`
- `dev_cafe_settings`

## API Contract

Frontend calls `VITE_API_BASE_URL` with the same action contract as before:

- `GET /api/dev-cafe?action=health`
- `GET /api/dev-cafe?action=menu`
- `GET /api/dev-cafe?action=orders&userId=...`
- `GET /api/dev-cafe?action=bootstrap&userId=...`
- `POST /api/dev-cafe` with `{ "action": "createOrder", "payload": ... }`
- `POST /api/dev-cafe` with `{ "action": "saveAdminState", "payload": ... }`

## Vercel Setup

Set these environment variables in Vercel:

```txt
DATABASE_URL
LINE_CHANNEL_ACCESS_TOKEN
VITE_LIFF_ID
VITE_API_BASE_URL=/api/dev-cafe
VITE_BASE_PATH=/
VITE_PAYMENT_QR_URL=
```

Build settings are configured in `vercel.json`.

## Notes

- `localhost` inside Vercel means Vercel itself, not your local machine. For production, PostgreSQL must be reachable from Vercel.
- The only active backend endpoint is `/api/dev-cafe`.
