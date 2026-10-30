# WhatsApp Accounts — Frontend Contract

WhatsApp is now a **standalone connected account**, exactly like a Facebook Page.
It is owned by the logged-in user and has **no link to any Instagram account**.

- `:accountId` in every route below = **WhatsApp `phone_number_id`**.
- One account row per phone number. A WABA with 3 numbers → 3 accounts.
- All routes require the normal JWT auth header. Access tokens are never returned.

> **Breaking change:** the old Instagram-linked routes (`/instagram/:accountId/whatsapp/connection`,
> `/instagram/whatsapp/:accountId/templates`, …) and the `platformName: "whatsapp"`
> branch of `POST /exchange-code` have been **removed**. Use only the routes below.
> Anyone previously connected must re-connect through `POST /whatsapp/accounts/connect`.

---

## 1. Connect

`POST /whatsapp/accounts/connect`

Intent: finish Meta Embedded Signup. Send the popup's `code` (plus `waba_id` /
`phone_number_id` if Meta gave them). Backend exchanges the code, gets a
long-lived token, discovers every phone number on the WABA, saves them, and
subscribes to webhooks. For coexistence numbers (Embedded Signup run with
`featureType: "whatsapp_business_app_onboarding"`) it also starts the contacts +
chat-history sync from the WhatsApp Business app.

```jsonc
// request
{ "code": "AQD...", "waba_id": "10987...", "phone_number_id": "12345..." }  // waba_id + phone_number_id optional

// response 200
{
  "success": true,
  "count": 1,
  "accounts": [
    { "id": "1234567890", "waba_id": "10987654321",
      "display_phone_number": "+91 98765 43210",
      "verified_name": "Repaly", "business_name": "Repaly Business",
      "is_coexistence": false }
  ]
}
```

Errors: `400` expired/invalid code or no WABA selected · `502` Meta unreachable.

---

## 2. List accounts — via the shared accounts API

`GET /account`  ← **no dedicated WhatsApp listing endpoint**

Intent: WhatsApp accounts come back in the same unified list as Instagram
accounts. Switch on `platformName` to render each row.

```jsonc
// response 200 — mixed array
[
  { "platformName": "instagram", "id": "17841400000", "username": "repaly.app",
    "name": "Repaly", "profile_picture_url": "https://...", "media_count": 42, "...": "..." },

  { "platformName": "whatsapp",
    "id": "1234567890",                    // phone_number_id — use as :accountId
    "name": "Repaly Business",             // WABA / business name
    "username": "+91 98765 43210",         // display phone number
    "profile_picture_url": null,           // WhatsApp has none — render an icon
    "user_id": "influex-user-id",
    "created_time": "2026-08-07T10:00:00.000Z",
    "updated_time": "2026-08-07T10:00:00.000Z",
    "waba_id": "10987654321",
    "display_phone_number": "+91 98765 43210",
    "verified_name": "Repaly",
    "business_name": "Repaly Business",
    "quality_rating": "GREEN",
    "code_verification_status": "VERIFIED",
    "is_registered": false,                // false => run /register before sending
    "is_coexistence": false,               // true => also in the WhatsApp Business app: hide /register,
                                           //         re-connect with the coexistence signup flow
    "token_status": "active",
    "needs_reconnect": false,              // true => prompt re-connect
    "connected_at": "2026-08-07T10:00:00.000Z" }
]
```

`name` / `username` / `profile_picture_url` / timestamps are mirrored onto the
WhatsApp entries deliberately, so a generic account-row component works for both
platforms without special-casing.

---

## 3. Single account

`GET /whatsapp/:accountId` — same object shape as one list item. `400` if not connected.

---

## 4. Disconnect

`DELETE /whatsapp/:accountId/disconnect`

Intent: remove one number. Webhooks are unsubscribed from the WABA only when its
**last** number is disconnected.

```jsonc
{ "success": true, "connected": false, "message": "WhatsApp disconnected successfully" }
```

---

## 5. Register number for sending

`POST /whatsapp/:accountId/register`

Intent: one-time Cloud API registration (2-step PIN). Required before sending if
`is_registered` is `false`.

```jsonc
// request
{ "pin": "123456" }
// response
{ "success": true }
```

Errors: `400` for coexistence numbers (already registered by Meta — never offer
this) · `502` with Meta's message (e.g. already registered / wrong PIN).

---

## 5a. Saved contacts

`GET /whatsapp/:accountId/contacts`

Intent: the "Contacts" button. Returns every contact saved in the number's
WhatsApp Business app address book, in one response (no pagination), sorted by
name. Only saved contacts — people who merely messaged the number are not
included. Read from our DB, which the webhook pipeline keeps up to date as
contacts are added/removed in the app, so calling it again always gives the
latest list.

```jsonc
// response 200
{
  "success": true,
  "count": 2,
  "is_coexistence": true,
  "contacts": [
    { "phone": "918888822222", "full_name": "Priya", "first_name": "Priya" },
    { "phone": "919999911111", "full_name": "Rahul Sharma", "first_name": "Rahul" }
  ]
}
```

- `phone` is digits only with country code — use it as-is for `to` when sending.
- Display name: `full_name` → `first_name` → `phone` (names can be `null`).
- Empty `contacts`:
  - `is_coexistence: false` → number is not on the WhatsApp Business app, so
    saved contacts are not available for it.
  - `is_coexistence: true` → Meta is still syncing (takes a few minutes after
    connect); show "syncing, try again shortly".

Errors: `400` not connected · `401/403` not your account · `500` unexpected.

---

## 6. Templates

All template data is read **live from Meta** — nothing is cached backend-side.

| Route | Intent |
|---|---|
| `GET /whatsapp/:accountId/templates` | list all templates on the WABA |
| `GET /whatsapp/:accountId/templates/:templateId` | one template's full detail |
| `POST /whatsapp/:accountId/templates` | submit a new template for Meta approval |
| `DELETE /whatsapp/:accountId/templates/:templateId?name=<template_name>` | delete (`name` query param is **required**) |

```jsonc
// GET list → 200
{ "success": true, "templates": [
  { "id": "...", "name": "order_update", "language": "en_US", "status": "APPROVED",
    "category": "UTILITY", "components": [...], "rejected_reason": null }
]}

// POST body (passed straight to Meta)
{ "name": "order_update", "language": "en_US", "category": "UTILITY",
  "components": [{ "type": "BODY", "text": "Hi {{1}}, your order shipped." }] }
// → { "success": true, "template": { "id": "...", "status": "PENDING", "category": "UTILITY" } }
```

---

## 7. Send a template

`POST /whatsapp/:accountId/templates/send`

Intent: send an approved template. The backend verifies with Meta that the
template exists, matches the language, and is `APPROVED` before sending.

```jsonc
// request
{
  "to": "919876543210",           // E.164, no '+' needed
  "templateName": "order_update",
  "language": "en_US",
  "components": [                  // optional, only if the template has variables
    { "type": "body", "parameters": [{ "type": "text", "text": "Akshat" }] }
  ]
}

// response 200
{ "success": true, "message_id": "wamid.HBg...", "to": "919876543210" }
```

Errors: `400` template not found / not approved / missing `to` · `502` Meta rejected the send (message + `details` included).

---

## Error shape

| Status | Meaning |
|---|---|
| `400` | not connected, bad input, template not found/unapproved |
| `401/403` | not your account |
| `502` | Meta API error — `{ "message": "...", "details": {...} }` |
| `500` | unexpected |
