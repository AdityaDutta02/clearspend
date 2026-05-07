# ClearSpend — Linear-tier UI Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign ClearSpend's dashboard to match Linear's precision light-mode aesthetic, with a persistent right-rail AI chat panel and a feature flag to revert to the current design.

**Architecture:** Two-column layout (65% content / 35% AI rail) behind a `NEXT_PUBLIC_DESIGN_VARIANT` env var (`v2` = new, `v1` = legacy). Existing components are untouched; the new shell (`DashboardShellV2`) and rail (`ChatRail`) are additive. CSS token overrides live under a `.design-v2` class on `<main>`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Framer Motion, Plus Jakarta Sans, existing component library.

---

## Feature Flag

`NEXT_PUBLIC_DESIGN_VARIANT` env var:
- `"v2"` → render new Linear-tier layout (default once shipped)
- `"v1"` or unset → render existing `DashboardShell` unchanged

Read once in `app/home-client.tsx`:
```ts
const variant = process.env.NEXT_PUBLIC_DESIGN_VARIANT === 'v1' ? 'v1' : 'v2'
```
Pass as `designVariant` prop to a thin wrapper that renders the right shell.

To flip: set env var on Terminal AI deploy panel → redeploy (30s).

---

## Design Tokens (v2 overrides)

Applied only when `<main data-design="v2">` is present. Existing `:root` tokens stay for v1.

```css
[data-design="v2"] {
  --bg:              #F7F7F7;
  --surface:         #FFFFFF;
  --border:          rgba(0, 0, 0, 0.08);
  --border-medium:   rgba(0, 0, 0, 0.13);
  --text:            #1A1A1A;
  --muted:           #8A8A8A;
  --primary:         #5E6AD2;
  --primary-light:   #7B84DC;
  --primary-subtle:  rgba(94, 106, 210, 0.07);
  --primary-border:  rgba(94, 106, 210, 0.2);
}

/* Card radius: 8px, no shadows, no inset highlight */
[data-design="v2"] .card {
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid var(--border);
}
[data-design="v2"] .card::after { display: none; }
[data-design="v2"] .kpi-card { border-radius: 8px; box-shadow: none; }
[data-design="v2"] .kpi-card::after { display: none; }
[data-design="v2"] .kpi-card:hover { box-shadow: none; transform: none; }
[data-design="v2"] .kpi-card-hero {
  background: none;
  border-left: none;
  border: 1px solid var(--border);
}
```

---

## Layout: DashboardShellV2

### Header Toolbar (48px fixed)

```
┌──────────────────────────────────────────────────────────────┐
│ ● ClearSpend  │  [Jan 2026 ▾] [HDFC ▾] [Credit ▾]  │ [+ Add] [⋯] │
└──────────────────────────────────────────────────────────────┘
```

- `height: 48px`, `border-bottom: 1px solid var(--border)`, `background: var(--surface)`
- Logo pill left: 6px dot + "ClearSpend" in 0.82rem 700
- FilterBar pills center (overflow scroll, no scrollbar)
- Actions right: "Add Statement" pill + "···" for Manage Statements

### Two-Column Body

```
┌──────────────────────────────────────────────────────────────┐
│  CONTENT (65%)                    │  AI RAIL (35%)           │
│  overflow-y: auto                 │  position: sticky        │
│  padding: 24px                    │  top: 48px               │
│                                   │  height: calc(100dvh-48px│
│  KPI row                          │  overflow: hidden        │
│  Charts bento                     │                          │
│  Transactions                     │  "Ask ClearSpend" header │
│  Insights                         │  ─────────────────────── │
│                                   │  conversation (scrollable│
│                                   │  ─────────────────────── │
│                                   │  input (pinned bottom)   │
└───────────────────────────────────┴──────────────────────────┘
```

- Outer: `display: grid; grid-template-columns: 1fr; min-height: calc(100dvh - 48px)`
- At `≥ 1024px`: `grid-template-columns: 65fr 35fr`
- Content column: `overflow-y: auto; padding: 24px; display: flex; flex-col; gap: 20px`
- Rail column: `position: sticky; top: 48px; height: calc(100dvh - 48px); display: flex; flex-col; border-left: 1px solid var(--border)`

### Mobile (< 768px)

- Rail column hidden (`display: none`)
- Floating `✦ Ask` button: `position: fixed; bottom: 20px; right: 20px; z-index: 40`
- Tapping opens bottom sheet: `position: fixed; inset-x: 0; bottom: 0; height: 70dvh; border-radius: 16px 16px 0 0; z-index: 50`
- Bottom sheet has full ChatRail content; close via swipe-down or ✕ button

---

## Component: ChatRail

File: `components/chat/chat-rail.tsx`

Reuses all fetch/SSE/streaming logic from `chat-panel.tsx`. Different layout only:

```
┌────────────────────────────────────┐
│ Ask ClearSpend          [model tag] │  ← header: 44px, border-bottom
├────────────────────────────────────┤
│                                    │
│  [conversation — flex-col, gap-3,  │  ← flex: 1, overflow-y: auto, p: 16px
│   auto-scrolls to bottom]          │
│                                    │
│  User msg: right-aligned, purple bg│
│  AI msg:   left-aligned, surface bg│
│                                    │
├────────────────────────────────────┤
│ [suggestion pills — horizontal     │  ← shown when no messages
│  scroll, 0.72rem]                  │
│ ┌──────────────────────────────┐   │  ← input area: border-top, p: 12px
│ │ Ask anything…          [→]   │   │
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

Props: `token: string; className?: string`
No toggle state — rail is always visible when rendered; show/hide controlled by parent.

Message bubbles:
- User: `background: var(--primary); color: white; border-radius: 12px 12px 2px 12px; padding: 8px 12px; max-width: 85%; align-self: flex-end`
- AI: `background: var(--surface-raised); border-radius: 12px 12px 12px 2px; padding: 8px 12px; max-width: 85%; align-self: flex-start`
- Loading: 3-dot pulse, left-aligned, same bubble style as AI

Markdown rendering: same `renderMarkdown()` logic as `chat-panel.tsx` (extract to shared util `lib/render-markdown.tsx`).

---

## Component: MobileAskButton + BottomSheet

File: `components/chat/mobile-ask-sheet.tsx`

- Floating button: `position: fixed`, bottom-right, 44×44px, `background: var(--primary)`, `border-radius: 999px`, `box-shadow: 0 4px 16px rgba(94,106,210,0.35)`
- Label: `✦ Ask` (0.75rem, white)
- Sheet: slides up from bottom via framer-motion `y: "100%" → y: 0`
- Sheet height: `70dvh`
- Drag-to-dismiss: not required (just ✕ button top-right)
- Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 49`

---

## Files Changed

| File | Action |
|---|---|
| `app/home-client.tsx` | Read `NEXT_PUBLIC_DESIGN_VARIANT`, render v1 or v2 shell |
| `app/globals.css` | Add `[data-design="v2"]` token overrides + card/kpi overrides |
| `components/dashboard/dashboard-shell-v2.tsx` | New — full two-column shell |
| `components/chat/chat-rail.tsx` | New — right rail + bottom sheet variant |
| `components/chat/mobile-ask-sheet.tsx` | New — floating button + bottom sheet for mobile |
| `lib/render-markdown.ts` | New — extract renderMarkdown from chat-panel.tsx |
| `components/chat/chat-panel.tsx` | Minor — import renderMarkdown from shared util |

**Untouched:** `dashboard-shell.tsx`, all existing KPI/chart/table/filter components.

---

## Error Handling

- Feature flag: any value other than `"v1"` renders v2. No runtime error possible.
- Mobile sheet: same SSE error handling as ChatRail (identical logic).
- Rail out-of-view scroll: `useEffect` scrolls conversation div to bottom on new message.

---

## Testing

- Feature flag: unit test `getDesignVariant()` with `v1`, `v2`, undefined env values
- ChatRail: same test suite as `chat-panel.test.tsx` — SSE success, error, loading, multi-turn
- MobileAskSheet: renders floating button; click opens sheet; ✕ closes sheet
- DashboardShellV2: renders with `data-design="v2"` attribute on `<main>`
