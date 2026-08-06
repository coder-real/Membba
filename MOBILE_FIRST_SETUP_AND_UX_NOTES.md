# Membba Mobile-First Setup + UX Notes

Last updated: 2026-08-05

## Product priority

Telegram and WhatsApp setup are the core of Membba. If creators cannot connect groups easily, payments, access control, automations, and AI support lose their value.

The next product milestone is:

```txt
Mobile-first community setup
```

## Design direction

Take inspiration from Apple and Samsung setup flows:

- Fewer choices per screen
- Large clear action buttons
- One primary action per step
- Plain language, no technical jargon unless hidden under “Advanced”
- Visual confirmation after each step
- Mobile-first layout before desktop optimization
- Auto-detect and autofill wherever possible
- Save progress continuously so switching apps does not lose work

## New community setup flow

### Telegram

Goal: remove manual Chat ID copy/paste.

Flow:

1. Creator chooses Telegram.
2. Membba generates a short group-link token.
3. Creator taps “Add Membba Bot to My Group”.
4. Telegram opens with `startgroup=token_xxx`.
5. Creator selects group and adds bot as admin.
6. Telegram update reaches Membba backend.
7. Backend binds group chat ID/title to token.
8. Membba UI polls token and auto-fills group.
9. Creator sees “Group connected”.

Keep manual Chat ID only under:

```txt
Advanced setup
```

### WhatsApp

Goal: stop showing QR-first on mobile.

Flow:

1. Detect device.
2. Mobile defaults to pairing code.
3. Desktop defaults to QR.
4. Creator enters bot phone number.
5. Membba generates pairing code.
6. Creator taps “Copy code & open WhatsApp”.
7. Creator links device in WhatsApp.
8. Membba shows connection status.
9. Creator pastes group invite link.
10. Membba resolves/joins group before save.

## Issues found during testing

### 1. Mobile menu views need redesign

Current mobile navigation is not good enough. Need a dedicated mobile nav pattern rather than simply sliding the desktop sidebar.

Target:

- bottom sheet or full-screen app menu
- larger tap targets
- clear current section
- no nested menus that feel cramped

### 2. Bot status should show channel status in navbar

Topbar should show:

- Membba bot status
- WhatsApp status icon
- Telegram status icon

Rules:

- Main bot icon green if at least one channel is online
- Main bot icon red or gray if both offline
- WhatsApp icon green if online, gray if offline
- Telegram icon blue if online, gray if offline
- Must stay in sync with Settings → Integrations

### 3. Dialog close buttons are too small

Across app, modal close buttons need larger hit areas.

Target:

```txt
minimum 36x36px tap target
visible X icon
consistent top-right position
```

### 4. Automations page is too cluttered

Current Automations page has too much information at once.

Target:

- Split into simple sections:
  - AI Replies
  - Broadcasts
  - Digest
  - Readiness
- Show one clear status per tool
- Hide advanced configuration until expanded
- Add test actions only when relevant

### 5. Automations and Conversations pages load slowly

Need to optimize:

- avoid loading too much data at once
- lazy-load secondary sections
- add skeleton states
- cache settings/readiness where possible

### 6. Members and Payments pages need table redesign

Current horizontal-scroll table is not ideal.

Target improvements:

- Full-width layout for these operational pages
- Search/action bar above table
- Filter dropdowns
- Better table wrapper
- Compact single-line rows
- Row checkboxes
- Bulk actions
- Footer pagination

Suggested layout:

```txt
Search input | Status filter | Platform filter | Bulk action
-------------------------------------------------------------
[ ] Member | Community | Platform ID | Status | Expires | Actions
...
Showing 1–10 of 12                         Previous | Next
```

Bulk actions:

- Bulk extend subscription
- Bulk revoke/cancel
- Bulk copy/export selected

## Implementation order

1. Telegram auto-detect group linking
2. Community form autosave draft
3. WhatsApp mobile-first pairing UI
4. WhatsApp group resolve during create flow
5. Navbar channel status icons
6. Mobile navigation redesign
7. Automations simplification
8. Members/Payments table redesign
9. Dialog close button standardization

## Current branch context

Design-system branch in progress:

```txt
design/sidebar-subnav
```

Main latest pushed feature branch:

```txt
design/sidebar-subnav
```
