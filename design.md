# Membba Design System (`design.md`)

Welcome to the **Membba Design System**. This document outlines the design principles, visual standards, color tokens, typography rules, component patterns, and mobile UX guidelines that power the Membba platform interface.

---

## 1. Design Philosophy & Core Aesthetics

Membba delivers a **high-density, professional dark-mode experience** inspired by modern developer tools (such as Supabase, Vercel, and Linear).

### Core Principles
1. **Sharp/Square Corners Global Standard**:
   - **Default Corner Radius**: Square / sharp corners (`rounded-none` or `border-radius: 4px` max) across all cards, containers, buttons, inputs, tables, dropdown menus, and popovers.
   - **Rounded-Full Exception**: `rounded-full` is strictly reserved for functional UI elements:
     - User avatars
     - Status indicator dots & pill badges
     - Toggle switch knobs
     - Mobile grab handle bars
2. **Subtle & Obvious Status Indicators**:
   - Indicators must be visually distinct and clear without creating loud color noise or visual distraction.
   - Low-saturation muted fills (10% opacity), soft border accents (20% opacity), and refined typography (`font-medium` / `font-semibold`) maintain balance.
3. **Bold Inter Data Typography**:
   - High-contrast numerical data and metrics across the Dashboard and Payments pages use the **Inter** font family in heavy, bold weights (`font-sans font-black tracking-tight`).
4. **Mobile-First UX Efficiency**:
   - Bottom sheet drawers for mobile detail views (`h-[70vh] rounded-t-2xl` with `bg-black/60 backdrop-blur-sm` backdrop).
   - Supabase-style full-screen navigation drawer to eliminate clutter and excessive page scrolling.

---

## 2. Color Palette & Token System

### Theme Palette
Membba uses an ultra-dark background hierarchy combined with an Electric Lime primary brand accent.

| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| **App Background** | `#0a0a0a` | Main viewport background |
| **Sidebar Background** | `#0d0d0d` | Desktop sidebar & header background |
| **Surface Background** | `#111111` / `#141414` | Cards, panels, dropdown menus |
| **Elevated Surface** | `#1a1a1a` | Active item highlight, hover states |
| **Brand Primary** | `#c8f135` | Primary buttons, active highlights, key CTAs |
| **Brand Hover** | `#d4f849` | Primary button hover state |
| **Brand Muted Fill** | `rgba(200, 241, 53, 0.10)` | Active state soft backgrounds |
| **Border Subtle** | `rgba(255, 255, 255, 0.06)` | Table dividers, subtle separators |
| **Border Default** | `rgba(255, 255, 255, 0.10)` | Card borders, input outlines |
| **Border Strong** | `rgba(255, 255, 255, 0.18)` | Hovered card borders, active focus state |

---

## 3. Subtle Indicator & Pill Badge System

Pills and badges communicate status clearly using subtle opacity overlays and soft text colors instead of loud solid fills.

| Status / Badge | Background Fill | Border Accent | Text Accent | Dot Accent |
| :--- | :--- | :--- | :--- | :--- |
| **Active / Paid / Connected** | `bg-emerald-500/10` | `border-emerald-500/20` | `text-emerald-400` | `#34d399` |
| **Pending / Expired / Beta** | `bg-amber-500/10` | `border-amber-500/20` | `text-amber-300` | `#fbbf24` |
| **Failed / Offline / Danger** | `bg-rose-500/10` | `border-rose-500/20` | `text-rose-400` | `#f87171` |
| **Basic Access / Info** | `bg-blue-500/10` | `border-blue-500/20` | `text-blue-300` | `#60a5fa` |
| **Cancelled / Neutral** | `bg-white/5` | `border-white/10` | `text-white/50` | `rgba(255,255,255,0.4)` |

```jsx
// Standard Subtle Status Indicator Pattern
<span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-emerald-400">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
  Active
</span>
```

---

## 4. Typography Scale

Membba uses **Inter** (`font-sans`) as its primary font family across titles, content, metrics, and navigation, with **JetBrains Mono** (`font-mono`) reserved for references, IDs, and code.

| Element | Font Family | Size | Weight | Tracking / Leading |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Data Metrics** | `Inter (font-sans)` | `34px - 48px` | `900 (black)` | `tracking-tight leading-none` |
| **Page Title** | `Inter (font-sans)` | `28px` | `800 (extrabold)` | `tracking-tight` |
| **Section Title** | `Inter (font-sans)` | `18px` | `800 (extrabold)` | `-` |
| **Navigation Items** | `Inter (font-sans)` | `15px - 17px` | `600 - 700` | `-` |
| **Body Text** | `Inter (font-sans)` | `14px` | `400 (normal)` | `leading-relaxed` |
| **Table Header / Labels** | `Inter / Mono` | `11px - 12px` | `800 (extrabold)` | `uppercase tracking-wider` |
| **Payment Ref / Mono ID** | `JetBrains Mono` | `12px - 13px` | `500 (medium)` | `tabular-nums` |

---

## 5. Layout Architecture & Mobile UX

### Top Navigation Header (`56px` Height)
- Breadcrumb navigation (`membba / [Page Name]`).
- Quick channel status bar (`Telegram`, `WhatsApp`, `API`) with subtle color-coded online dots.
- Bot status pill (`Bot Active` / `Offline`).
- User profile avatar & menu dropdown.

### Mobile Navigation Drawer
- Triggered via header hamburger icon.
- Full height drawer with categorized navigation (`MAIN MENU`, `AUTOMATIONS & AI`, `SETTINGS & CONFIG`).
- Scaled touch targets (`text-[17px] font-bold py-3.5`).

### Mobile Detail Drawers (Bottom Sheet Pattern)
- On screens `< 1024px`, item detail views (e.g. member details) open as bottom sheet drawers (`h-[70vh] rounded-t-2xl`).
- Displays a visual grab handle (`w-12 h-1.5 rounded-full bg-white/20`) at top.
- Backdrop is dimmed with `bg-black/60 backdrop-blur-sm` overlay to focus attention.

---

## 6. Component Specs

### Buttons
- **Primary**: Electric Lime `#c8f135`, black text `font-bold`, sharp corners `rounded-none`.
- **Secondary**: Dark surface `#1a1a1a`, border `border-white/10`, white text `font-semibold`.
- **Danger**: Soft red fill `bg-rose-500/10`, red text `text-rose-400`, border `border-rose-500/20`.

### Form Controls & Inputs
- Dark input background `#161616`, sharp corners `rounded-none`, border `border-white/10`.
- Focus state highlights border with Electric Lime `#c8f135`.

### Data Tables
- High-density layout with subtle dark row dividers (`divide-white/[0.05]`).
- Row hover states feature subtle highlight (`hover:bg-white/[0.015]`).
- Monospace references feature copy-to-clipboard actions.

---

*Document version: 1.2 — Maintained by Membba Core Team.*
