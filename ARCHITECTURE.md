# DevCafe Architecture

This repo is being shaped for a two-stage path:

1. Mini project phase: lightweight and fast to ship.
2. Scale-up phase: PostgreSQL-backed API ready to evolve into a full production app.

## Recommended stack for the scalable path

- Frontend: Vue 3 + Vite
- UI system: Tailwind CSS first, custom CSS only for tokens and rare edge cases
- State: Pinia
- Routing: Vue Router
- Forms and validation: native + Zod
- Data fetching: fetch first, TanStack Query later if the app grows
- Backend now: Vercel Functions under `/api/dev-cafe`
- ORM now: Prisma
- Database now: PostgreSQL database `dev_cafe`
- Backend later: split into a dedicated API service if usage grows beyond serverless limits

## Why Tailwind first

- Mobile ordering UX benefits from fast iteration
- Most screens here are repetitive utility layouts: cards, chips, sheets, dialogs, lists
- Tailwind reduces custom CSS drift as the app grows
- Keeps the design language consistent while the menu, admin, and checkout pages expand

## Env strategy

Use `.env` from day one with Vite-prefixed variables:

- `VITE_API_BASE_URL`
- `VITE_LIFF_ID`
- `VITE_PAYMENT_QR_URL`

Keep secrets out of frontend env files:

- `DATABASE_URL`
- `LINE_CHANNEL_ACCESS_TOKEN`
- Any future service keys

## Suggested repo layout

```text
devCafe/
  api/
    dev-cafe.js
    _dev-cafe-handler.cjs
  frontend/
    index.html
    admin.html
    src/
      app/
      admin/
      components/
      composables/
      services/
      stores/
      styles/
      utils/
    public/
  prisma/
    schema.prisma
  .env.example
  package.json
  vercel.json
```

## Phase 1 screen rules

- Build almost everything with Tailwind utilities.
- Keep custom CSS only for:
- brand tokens
- shadows/gradients that Tailwind cannot express cleanly
- third-party embed quirks
- Avoid custom component libraries at the start.
- Prefer simple, mobile-first sections:
- sticky cart
- bottom-sheet style dialogs
- compact cards
- large tap targets

## Phase 2 growth path

- Split shared menu/order schemas into a shared module.
- Move menu options into backend-driven config tables.
- Add admin role control, order status pipeline, and payment reconciliation.
- Add analytics and audit trail later.

## Practical rule

If a UI element can be expressed with Tailwind utilities, do that first.  
If it is repeated often or needs tokens, extract a component.  
If it is business logic, move it into `services/` or `stores/`.
