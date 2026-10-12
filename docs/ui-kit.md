# UI kit (for the frontend redesign)

The current UI is deliberately plain. Everything is built from a small custom kit so a redesign mostly means restyling **two places**: design tokens and the kit components. Live preview of every component: `/en/ui` (and `/ar/ui` for RTL).

## Tokens

`apps/web/src/app/globals.css`:

- `:root` (light) and `:root[data-theme="dark"]` define semantic CSS variables: `--bg`, `--surface`, `--surface-2/3`, `--border(-strong)`, `--text`, `--muted`, `--primary(-hover/-fg/-soft)`, `--accent(-soft)`, `--danger/success/warning(-soft)`, `--ring`, `--shadow(-lg)`, `--radius`, scrollbar colors.
- `@theme inline` maps them to Tailwind utilities: `bg-surface`, `text-muted`, `bg-primary`, `border-border`, `rounded-md`, `shadow-card`, `shadow-pop`, `font-sans`, `font-quran`, `animate-pop-in`...
- Components use **only** these semantic names, never raw colors. Change the palette here and the whole app follows.
- Fonts: Rubik (Latin + Arabic + Turkish) and Noto Naskh Arabic (Quran text, class `quran`), loaded in `src/app/[locale]/layout.tsx` via `next/font`.
- Theme: `data-theme` on `<html>`, resolved before paint by an inline script (saved preference light/dark/system in `localStorage.theme`). Toggle: `ThemeToggle` in `src/components/shell/switchers.tsx`.
- Branding constants (name, logo, mascot, WhatsApp): `packages/config/src/brand.ts`.

## Components (`apps/web/src/components/ui/`)

| File | Exports | Notes |
| --- | --- | --- |
| `button.tsx` | `Button` | variants primary/secondary/outline/ghost/danger/link, sizes sm/md/lg/icon, `loading`, `asChild` |
| `input.tsx` | `Input`, `Textarea`, `Label`, `Field` | `Field` = label + control + hint/error |
| `select.tsx` | `Select` | Fully custom (Radix Popover + cmdk). Single, searchable, grouped, multi, clearable, hidden input for forms. No native `<select>` anywhere. |
| `date-picker.tsx` | `DatePicker` | Custom calendar, localized (date-fns), optional custom time picker (`withTime`) |
| `dropdown-menu.tsx` | `DropdownMenu*` | Radix, restyled |
| `dialog.tsx` | `Dialog*`, `SheetContent` | Modal + side drawer (RTL-aware `side`) |
| `controls.tsx` | `Checkbox`, `Switch`, `RadioGroup`, `Tabs*`, `Tooltip` | Custom-styled Radix primitives |
| `scroll-area.tsx` | `ScrollArea` | Overlay scrollbar (identical on every OS); global scrollbars are styled in `globals.css` |
| `file-dropzone.tsx` | `FileDropzone` | Drag and drop, size check |
| `table.tsx` | `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` | |
| `card.tsx` | `Card`, `CardHeader`, `CardBody`, `Stat` | |
| `badge.tsx` | `Badge` | tones neutral/primary/success/warning/danger/accent |
| `misc.tsx` | `Spinner`, `Skeleton`, `Progress`, `EmptyState`, `Avatar`, `PageHeader` | |
| `toast.tsx` | `Toaster`, `toast` | sonner, mounted once in the root layout |

Panel chrome: `src/components/shell/` (`PanelShell` sidebar + topbar, `PanelGate` server guard, `nav.tsx` sidebar items per role, `switchers.tsx`). Public site sections: `src/components/site/`.

## Rules to keep while redesigning

- RTL: logical utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start/border-s`). Directional icons get `rtl:rotate-180`. ESLint warns on physical ones.
- All text comes from `apps/web/messages/*.ts` (en first, then ar and tr). No hardcoded strings.
- Zero em dashes in any copy (`pnpm check:dashes`).
- Quran text always uses the `quran` class and is never restyled into another script/font that breaks diacritics.
- Keep the Tanzil attribution where Quran text is shown (`docs/quran-text.md`).
