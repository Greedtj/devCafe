# Product

## Register

product

## Users

Primary users are cafe customers ordering through LINE and cafe owners managing the menu, options, and order history. Customers are usually on mobile, deciding quickly and expecting a familiar checkout flow. Owners need a clear admin surface that lets them update products and options without feeling like they are operating a heavy POS system.

## Product Purpose

DevCafe lets a cafe accept drink orders through a LINE-first web app, store normalized order data in PostgreSQL, and send order confirmations through LINE Messaging API. Success means customers can place an order quickly, owners can keep the catalog accurate, and the system feels reliable enough for daily shop operations.

## Brand Personality

Premium, fast, affordable. The product should feel polished and confident without slowing the user down or making everyday edits feel expensive.

## Anti-references

Do not make the interface feel like a dull POS back office. Avoid gray, generic admin layouts, heavy dashboard chrome, and UX that requires users to understand database concepts before completing a task. Avoid confusing controls, hidden save behavior, and decorative flourishes that make ordering slower.

## Design Principles

- Make ordering feel immediate: customers should always know what to tap next.
- Keep admin work readable: owners should see the relationship between menu, category, and option groups without mental translation.
- Earn the premium tone through crisp hierarchy, strong color discipline, and consistent controls.
- Stay affordable in mood: polished should not feel intimidating or overbuilt.
- Preserve LINE-first trust: confirmations, profiles, and order states should feel clear and dependable.

## Accessibility & Inclusion

Target WCAG AA contrast for text and interactive controls. Preserve reduced-motion compatibility, avoid relying on color alone for state, keep touch targets comfortable for mobile ordering, and ensure Thai text remains readable without clipping or overflow.
