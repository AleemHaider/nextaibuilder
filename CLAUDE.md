# Product Builder Academy - Design System & Project Rules

## Project Overview

Product Builder Academy (PBA) is a web application built with React + TypeScript + Tailwind CSS v4.

### Figma Projects

| Purpose | File Key | URL |
|---------|----------|-----|
| **Main Design Project** | `1mCNAOnriEJpZTadMukeO5` | Figma Design file — all design collaterals, screens, and component specs go here |
| **Final Design page** | Node `313:2` in `1mCNAOnriEJpZTadMukeO5` | [Final Design](https://www.figma.com/design/1mCNAOnriEJpZTadMukeO5/Product-Builder-Academy---Design-System?node-id=313-2) — the single source of truth for all design references |
| Design Language Reference (Figma Make) | `LIhYhe6GqLPhjUvzZNLutt` | Source of truth for brand identity, tokens, and component patterns |

IMPORTANT: The **"Final Design"** page (node `313:2`) in the Main Design Project is the **ONLY** page to reference for designs. Ignore all other pages in the Figma file. When fetching designs via MCP, always scope queries to this page/node.

IMPORTANT: Use the **Main Design Project** (`1mCNAOnriEJpZTadMukeO5`) for all new design work, screen mockups, and component development. The Figma Make file is the read-only reference for the design language.

---

## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project and must be followed for every Figma-driven change.

### Required Flow (do not skip)

1. Run `get_design_context` first to fetch the structured representation for the exact node(s)
2. If the response is too large or truncated, run `get_metadata` to get the high-level node map, then re-fetch only the required node(s) with `get_design_context`
3. Run `get_screenshot` for a visual reference of the node variant being implemented
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation
5. Translate the output (React + Tailwind) into this project's conventions, styles, and framework
6. Validate against Figma for 1:1 look and behavior before marking complete

### Design Language Reference

The canonical design language lives in Figma Make file `LIhYhe6GqLPhjUvzZNLutt` (Product Builder Academy). When in doubt about visual decisions, consult this file.

---

## Brand Identity

### Logo

- The logo component supports variants: `full` (icon + wordmark) and `icon` (icon only)
- Sizes: `sm` (32px), `md` (48px), `lg` (64px), `xl` (96px)
- Logomark: Abstract flowing ribbon forms with gradient fills
- Wordmark: "Product Builder" in bold `#1a2744` + "ACADEMY" in uppercase `#4a9ad4` with `0.15em` letter-spacing

### Brand Gradients (Logomark)

| Name | Purpose | Colors |
|------|---------|--------|
| `deepBlue` | Foundation ribbon | `#1a2744` → `#4a90c4` |
| `skyBlue` | Progression ribbon | `#7bb8e0` → `#4a9ad4` |
| `paleBlue` | Aspiration ribbon | `#a8d4f0` → `#d4e8f7` |
| `warmOrange` | Dynamic accent | `#ff8c5a` → `#ff6347` → `#d73027` |

### Brand Colors (Primary Palette)

| Role | Light Mode | Usage |
|------|-----------|-------|
| Deep Navy | `#1a2744` | Primary brand color, headings, wordmark |
| Mid Blue | `#4a90c4` / `#4a9ad4` | Secondary brand, links, accents |
| Sky Blue | `#7bb8e0` | Tertiary, highlights |
| Pale Blue | `#a8d4f0` / `#d4e8f7` | Backgrounds, subtle fills |
| Warm Orange | `#ff8c5a` | CTAs, attention, energy |
| Red-Orange | `#ff6347` | Hover states, emphasis |
| Deep Red | `#d73027` | Destructive / strong emphasis |

---

## Design Tokens (CSS Custom Properties)

IMPORTANT: Never hardcode colors, spacing, or typography values. Always use the design token system below.

### Color Tokens (Light Mode)

```css
--background: #ffffff
--foreground: oklch(0.145 0 0)          /* near-black */
--card: #ffffff
--card-foreground: oklch(0.145 0 0)
--primary: #030213                       /* near-black, used for buttons/CTAs */
--primary-foreground: oklch(1 0 0)       /* white */
--secondary: oklch(0.95 0.0058 264.53)   /* light lavender-gray */
--secondary-foreground: #030213
--muted: #ececf0                         /* light gray */
--muted-foreground: #717182              /* medium gray for secondary text */
--accent: #e9ebef                        /* subtle gray for hover states */
--accent-foreground: #030213
--destructive: #d4183d                   /* red for errors/destructive actions */
--destructive-foreground: #ffffff
--border: rgba(0, 0, 0, 0.1)            /* subtle border */
--input: transparent
--input-background: #f3f3f5              /* input field background */
--switch-background: #cbced4
--ring: oklch(0.708 0 0)                 /* focus ring */
```

### Dark Mode Tokens

Dark mode is supported via the `.dark` class. All semantic color tokens are redefined for dark mode. The dark variant uses `@custom-variant dark (&:is(.dark *))`.

### Radius Scale

```
--radius: 0.625rem (10px base)
--radius-sm: calc(var(--radius) - 4px)   = 6px
--radius-md: calc(var(--radius) - 2px)   = 8px
--radius-lg: var(--radius)               = 10px
--radius-xl: calc(var(--radius) + 4px)   = 14px
```

### Typography

- Base font size: `16px` (`--font-size: 16px`)
- Font weight normal: `400` / medium: `500`
- Line height: `1.5` for all heading and body text
- Heading scale: `h1` = 2xl, `h2` = xl, `h3` = lg, `h4` = base
- All headings use `font-weight: 500` (medium)
- Inputs use `font-weight: 400` (normal)

### Sidebar Tokens

```css
--sidebar: oklch(0.985 0 0)
--sidebar-foreground: oklch(0.145 0 0)
--sidebar-primary: #030213
--sidebar-primary-foreground: oklch(0.985 0 0)
--sidebar-accent: oklch(0.97 0 0)
--sidebar-accent-foreground: oklch(0.205 0 0)
--sidebar-border: oklch(0.922 0 0)
--sidebar-width: 16rem
--sidebar-width-icon: 3rem
```

---

## Component Library

### UI Framework

- **Component primitives**: Radix UI (`@radix-ui/react-*`)
- **Styling**: Tailwind CSS v4 with `class-variance-authority` (CVA) for variants
- **Utility function**: `cn()` from `clsx` + `tailwind-merge` for class composition
- **Icons**: `lucide-react`
- **Animations**: `tw-animate-css` + `motion` (Framer Motion)
- **Toasts**: `sonner`
- **Charts**: `recharts`
- **Forms**: `react-hook-form`
- **Routing**: `react-router` v7

### Component Architecture

Components follow the shadcn/ui pattern:

1. **Radix UI primitive** as the headless base
2. **CVA** for variant definitions (variant, size, etc.)
3. **`cn()`** for merging Tailwind classes
4. **`data-slot`** attributes on every component for styling hooks
5. **Function components** (not arrow function exports) with destructured props

### Button Variants

| Variant | Appearance |
|---------|-----------|
| `default` | `bg-primary text-primary-foreground` (dark button, white text) |
| `destructive` | `bg-destructive text-white` |
| `outline` | Bordered, transparent background |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `ghost` | No background, hover shows accent |
| `link` | Text only with underline on hover |

Sizes: `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (9x9)

### Card Pattern

Cards use `rounded-xl border bg-card text-card-foreground` with sub-components:
- `CardHeader` (px-6 pt-6, supports grid layout with CardAction)
- `CardTitle` (renders as h4)
- `CardDescription` (muted-foreground)
- `CardContent` (px-6)
- `CardFooter` (px-6 pb-6)

### Input Pattern

Inputs use `bg-input-background` (light gray `#f3f3f5`), `rounded-md`, height `h-9`, with focus ring styling via `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`.

### Badge Variants

`default`, `secondary`, `destructive`, `outline` - all `rounded-md` with `text-xs font-medium`.

### Tabs Pattern

TabsList uses `bg-muted rounded-xl` with active triggers showing `bg-card rounded-xl`.

### Sidebar Pattern

Full-featured collapsible sidebar with:
- Keyboard shortcut: `Cmd/Ctrl + B`
- States: `expanded` / `collapsed`
- Variants: `sidebar`, `floating`, `inset`
- Mobile: renders as Sheet (drawer)
- Cookie persistence for state

---

## Styling Approach

### Tailwind CSS v4

- Config via CSS (`@theme inline` block in `theme.css`), not `tailwind.config.js`
- Source directive: `@source '../**/*.{js,ts,jsx,tsx}'`
- Dark mode: `@custom-variant dark (&:is(.dark *))`
- Base layer resets: border-color, outline-ring, body bg/text

### Styling Conventions

- IMPORTANT: Always use `cn()` for merging class names
- IMPORTANT: Use semantic color tokens (`bg-primary`, `text-muted-foreground`) not raw hex
- IMPORTANT: Use the radius scale (`rounded-md`, `rounded-lg`, `rounded-xl`) not arbitrary values
- Use Tailwind utilities for spacing, not custom CSS
- Responsive: use Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- Mobile detection: `useIsMobile()` hook (breakpoint at 768px)

---

## Asset Handling

- IMPORTANT: If the Figma MCP server returns a localhost source for an image or SVG, use that source directly
- IMPORTANT: DO NOT import/add new icon packages - use `lucide-react` for icons
- IMPORTANT: DO NOT use or create placeholders if a localhost source is provided
- SVG assets should be inline React components (like the Logo)
- Image assets: use standard `<img>` tags or the `ImageWithFallback` component

---

## Project Conventions

### File Structure (Target)

```
src/
  app/
    components/
      ui/           # Reusable UI primitives (shadcn/ui pattern)
      figma/         # Figma-specific helpers (ImageWithFallback, etc.)
      [Feature]/     # Feature-specific components
    pages/           # Route pages
  styles/
    index.css        # Entry point (imports fonts, tailwind, theme)
    tailwind.css     # Tailwind config + source directive
    theme.css        # Design tokens + base styles
    fonts.css        # Font face declarations
```

### Naming Conventions

- Components: `PascalCase` (e.g., `BrandAssets.tsx`, `Logo.tsx`)
- UI primitives: `lowercase` file, `PascalCase` export (e.g., `button.tsx` exports `Button`)
- CSS files: `kebab-case`
- All components accept a `className` prop for composition

### Import Patterns

- React imports first
- Third-party libraries second (Radix, lucide, etc.)
- Internal components third
- Utility imports last (`cn`, types)

### Component Export Pattern

```tsx
// Named function components, not arrow functions
function MyComponent({ className, ...props }: MyComponentProps) {
  return (
    <div data-slot="my-component" className={cn("base-classes", className)} {...props} />
  );
}

export { MyComponent };
```

---

## Jira Integration

- Project: **PBA** on `lifetimebusinessdashboard.atlassian.net`
- Issue types: Epic, Story, Task, Bug, Subtask
- Hierarchy: Epic > Story/Task/Bug > Subtask

## Confluence

- Space: **PBA** on `lifetimebusinessdashboard.atlassian.net`
- IMPORTANT: NEVER read, write, or modify any other Jira project or Confluence space
