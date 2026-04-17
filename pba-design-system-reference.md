# Product Builder Academy (PBA) — Design System Reference

> **Purpose**: This document is a self-contained styling reference for anyone building pages or components for PBA without access to the Figma source files. It covers brand identity, color palette, typography, spacing, component patterns, and all design tokens.

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Sizing](#4-spacing--sizing)
5. [Border Radius](#5-border-radius)
6. [Shadows](#6-shadows)
7. [Design Tokens (CSS Custom Properties)](#7-design-tokens-css-custom-properties)
8. [Component Patterns](#8-component-patterns)
9. [Layout Patterns](#9-layout-patterns)
10. [Iconography](#10-iconography)
11. [Animation](#11-animation)
12. [Technical Stack](#12-technical-stack)

---

## 1. Brand Identity

### Brand Name

**Product Builder Academy** — abbreviated as **PBA**.

### Logo

The logo consists of two elements:

1. **Logomark** — An abstract flowing ribbon form made of 4 overlapping gradient ribbons, suggesting progression, building, and aspiration.
2. **Wordmark** — "Product Builder" in bold Deep Navy (`#1a2744`) + "ACADEMY" in uppercase Mid Blue (`#4a9ad4`) with wide letter-spacing (`0.15em`).

#### Logo Variants

| Variant | Description |
|---------|-------------|
| `full` | Logomark + Wordmark side by side |
| `icon` | Logomark only |

#### Logo Sizes

| Size | Height | Icon Dimensions | Wordmark "Product Builder" | Wordmark "ACADEMY" |
|------|--------|-----------------|---------------------------|---------------------|
| `sm` | 32px | 32 x 32 | 14px bold | 10px uppercase |
| `md` | 48px | 48 x 48 | 18px bold | 12px uppercase |
| `lg` | 64px | 64 x 64 | 24px bold | 16px uppercase |
| `xl` | 96px | 96 x 96 | 32px bold | 20px uppercase |

#### Logo Usage Contexts

- **28px**: Minimal icon use
- **36px**: Auth cards (icon or full lockup)
- **40px**: Page headers (icon or full lockup)
- **48px**: Prototype/marketing cards
- **On dark backgrounds**: Wordmark "Product Builder" switches to white; "ACADEMY" stays `#4a9ad4`

#### Logomark SVG Code

The logomark uses a `100 x 100` viewBox with four gradient-filled SVG paths:

```svg
<svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Deep Navy to Mid Blue Gradient -->
    <linearGradient id="deepBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a2744" />
      <stop offset="100%" stop-color="#4a90c4" />
    </linearGradient>

    <!-- Sky Blue Gradient -->
    <linearGradient id="skyBlue" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#7bb8e0" />
      <stop offset="100%" stop-color="#4a9ad4" />
    </linearGradient>

    <!-- Light Blue to Pale Gradient -->
    <linearGradient id="paleBlue" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a8d4f0" />
      <stop offset="100%" stop-color="#d4e8f7" />
    </linearGradient>

    <!-- Warm Orange to Deep Red Gradient -->
    <linearGradient id="warmOrange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff8c5a" />
      <stop offset="50%" stop-color="#ff6347" />
      <stop offset="100%" stop-color="#d73027" />
    </linearGradient>
  </defs>

  <!-- Bottom flowing ribbon - foundation -->
  <path
    d="M 15 65 C 15 65, 25 55, 40 58 C 55 61, 65 70, 75 65 C 80 62, 82 58, 82 55 L 82 75 C 82 75, 80 79, 75 82 C 65 87, 55 78, 40 75 C 25 72, 15 82, 15 82 Z"
    fill="url(#deepBlue)"
    opacity="0.9"
  />

  <!-- Middle flowing ribbon - progression -->
  <path
    d="M 20 45 C 20 45, 30 35, 45 40 C 60 45, 70 52, 80 48 C 85 46, 88 42, 88 38 L 88 58 C 88 58, 85 62, 80 65 C 70 70, 60 62, 45 57 C 30 52, 20 60, 20 60 Z"
    fill="url(#skyBlue)"
    opacity="0.95"
  />

  <!-- Upper flowing ribbon - aspiration -->
  <path
    d="M 25 28 C 25 28, 35 18, 50 22 C 65 26, 75 35, 85 30 C 88 28, 90 25, 90 22 L 90 42 C 90 42, 88 46, 85 48 C 75 53, 65 45, 50 40 C 35 35, 25 44, 25 44 Z"
    fill="url(#paleBlue)"
  />

  <!-- Accent element - dynamic peak -->
  <path
    d="M 70 12 C 70 12, 78 8, 85 12 C 88 14, 90 18, 90 22 L 90 30 C 90 30, 88 26, 85 24 C 78 20, 70 24, 70 24 Z"
    fill="url(#warmOrange)"
  />

  <!-- Secondary accent - energy burst -->
  <ellipse
    cx="82"
    cy="18"
    rx="4"
    ry="5"
    fill="url(#warmOrange)"
    opacity="0.8"
  />
</svg>
```

#### Full Logo Lockup (HTML/CSS)

```html
<div style="display: flex; align-items: center; gap: 12px;">
  <!-- Insert SVG logomark here -->
  <div style="display: flex; flex-direction: column;">
    <span style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px; color: #1a2744; line-height: 1.1;">
      Product Builder
    </span>
    <span style="font-family: 'Inter', sans-serif; font-size: 12px; color: #4a9ad4; line-height: 1.2; letter-spacing: 0.15em; text-transform: uppercase;">
      ACADEMY
    </span>
  </div>
</div>
```

### Brand Gradients (Logomark)

These four gradients define the logomark's flowing ribbons and are core to the brand identity:

| Name | Purpose | Direction | Colors |
|------|---------|-----------|--------|
| `deepBlue` | Foundation ribbon (bottom) | Top-left to bottom-right | `#1a2744` → `#4a90c4` |
| `skyBlue` | Progression ribbon (middle) | Top-right to bottom-left | `#7bb8e0` → `#4a9ad4` |
| `paleBlue` | Aspiration ribbon (upper) | Bottom-left to top-right | `#a8d4f0` → `#d4e8f7` |
| `warmOrange` | Dynamic accent (peak) | Top-left to bottom-right | `#ff8c5a` → `#ff6347` → `#d73027` |

---

## 2. Color System

### Brand Colors (Primary Palette)

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Deep Navy | `#1a2744` | 26, 39, 68 | Primary brand color, headings, wordmark text, dark backgrounds |
| Mid Blue | `#4a9ad4` | 74, 154, 212 | Secondary brand, links, accents, "ACADEMY" wordmark |
| Mid Blue (alt) | `#4a90c4` | 74, 144, 196 | Gradient endpoint variant |
| Sky Blue | `#7bb8e0` | 123, 184, 224 | Tertiary, highlights, hover accents |
| Pale Blue | `#a8d4f0` | 168, 212, 240 | Backgrounds, subtle fills |
| Pale Blue Light | `#d4e8f7` | 212, 232, 247 | Very light backgrounds, gradient endpoints |
| Warm Orange | `#ff8c5a` | 255, 140, 90 | CTAs, attention, energy, primary accent |
| Red-Orange | `#ff6347` | 255, 99, 71 | Hover states, emphasis |
| Deep Red | `#d73027` | 215, 48, 39 | Destructive actions, strong emphasis |

### Semantic UI Colors — Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#ffffff` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | Primary text (near-black) |
| `--card` | `#ffffff` | Card backgrounds |
| `--card-foreground` | `oklch(0.145 0 0)` | Card text |
| `--popover` | `oklch(1 0 0)` | Popover/dropdown background (white) |
| `--popover-foreground` | `oklch(0.145 0 0)` | Popover text |
| `--primary` | `#030213` | Primary UI element fill (near-black) |
| `--primary-foreground` | `oklch(1 0 0)` | Text on primary (white) |
| `--secondary` | `oklch(0.95 0.0058 264.53)` | Secondary fill (light lavender-gray) |
| `--secondary-foreground` | `#030213` | Text on secondary |
| `--muted` | `#ececf0` | Muted/disabled background (light gray) |
| `--muted-foreground` | `#717182` | Secondary text, placeholders (medium gray) |
| `--accent` | `#e9ebef` | Subtle hover states (light gray) |
| `--accent-foreground` | `#030213` | Text on accent |
| `--destructive` | `#d4183d` | Error/destructive actions (red) |
| `--destructive-foreground` | `#ffffff` | Text on destructive |
| `--border` | `rgba(0, 0, 0, 0.1)` | Default border color |
| `--input` | `transparent` | Input border default |
| `--input-background` | `#f3f3f5` | Input field background (light gray) |
| `--switch-background` | `#cbced4` | Unchecked switch track |
| `--ring` | `oklch(0.708 0 0)` | Focus ring color (gray) |

### Semantic UI Colors — Dark Mode

| Token | Value |
|-------|-------|
| `--background` | `oklch(0.145 0 0)` |
| `--foreground` | `oklch(0.985 0 0)` |
| `--card` | `oklch(0.205 0 0)` |
| `--card-foreground` | `oklch(0.985 0 0)` |
| `--popover` | `oklch(0.145 0 0)` |
| `--popover-foreground` | `oklch(0.985 0 0)` |
| `--primary` | `oklch(0.985 0 0)` |
| `--primary-foreground` | `oklch(0.205 0 0)` |
| `--secondary` | `oklch(0.269 0 0)` |
| `--secondary-foreground` | `oklch(0.985 0 0)` |
| `--muted` | `oklch(0.269 0 0)` |
| `--muted-foreground` | `oklch(0.708 0 0)` |
| `--accent` | `oklch(0.269 0 0)` |
| `--accent-foreground` | `oklch(0.985 0 0)` |
| `--destructive` | `oklch(0.396 0.141 25.723)` |
| `--destructive-foreground` | `#ffffff` |
| `--border` | `rgba(255, 255, 255, 0.1)` |
| `--input` | `transparent` |
| `--input-background` | `oklch(0.269 0 0)` |
| `--switch-background` | `oklch(0.371 0 0)` |
| `--ring` | `oklch(0.556 0 0)` |

### Chart Colors

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--chart-1` | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` |
| `--chart-2` | `oklch(0.6 0.118 184.704)` | `oklch(0.696 0.17 162.48)` |
| `--chart-3` | `oklch(0.398 0.07 227.392)` | `oklch(0.769 0.188 70.08)` |
| `--chart-4` | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)` |
| `--chart-5` | `oklch(0.769 0.188 70.08)` | `oklch(0.645 0.246 16.439)` |

### Sidebar Colors

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--sidebar-primary` | `#030213` | `#4a9ad4` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| `--sidebar-border` | `oklch(0.922 0 0)` | `rgba(255, 255, 255, 0.08)` |

---

## 3. Typography

### Font Family

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

Load via Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Normal | `400` | Body text, input values |
| Medium | `500` | Headings (h1-h4), labels, buttons |
| Semi-bold | `600` | Dialog titles, emphasis |
| Bold | `700` | Logo wordmark "Product Builder" |

### Type Scale

| Level | Size (Tailwind) | Approx px | Weight | Line Height |
|-------|----------------|-----------|--------|-------------|
| `h1` | `text-2xl` | ~24px | 500 (medium) | `1.5` (leading-tight in base) |
| `h2` | `text-xl` | ~20px | 500 (medium) | `1.5` |
| `h3` | `text-lg` | ~18px | 500 (medium) | `1.5` |
| `h4` | `text-base` | 16px | 500 (medium) | `1.5` |
| Body | `text-base` | 16px | 400 (normal) | `1.5` |
| Small | `text-sm` | 14px | 400 | `1.5` |
| Caption/Badge | `text-xs` | 12px | 500 (medium) | — |

### Base Font Size

```css
html { font-size: 16px; }
```

### Font Smoothing

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 4. Spacing & Sizing

PBA uses Tailwind CSS default spacing scale (based on 4px increments):

| Class | Value |
|-------|-------|
| `gap-1` | 4px |
| `gap-1.5` | 6px |
| `gap-2` | 8px |
| `gap-3` | 12px |
| `gap-4` | 16px |
| `gap-6` | 24px |
| `gap-8` | 32px |

### Common Component Spacing

| Component | Property | Value |
|-----------|----------|-------|
| Card gap (between children) | `gap` | 24px (`gap-6`) |
| Card padding (header) | `padding` | 24px left/right, 24px top (`px-6 pt-6`) |
| Card padding (content) | `padding` | 24px left/right (`px-6`) |
| Card padding (footer) | `padding` | 24px left/right, 24px bottom (`px-6 pb-6`) |
| Button padding (default) | `padding` | 8px top/bottom, 16px left/right (`px-4 py-2`) |
| Button padding (sm) | `padding` | 12px left/right (`px-3`) |
| Button padding (lg) | `padding` | 24px left/right (`px-6`) |
| Input padding | `padding` | 4px top/bottom, 12px left/right (`px-3 py-1`) |
| Badge padding | `padding` | 2px top/bottom, 8px left/right (`px-2 py-0.5`) |
| Dialog padding | `padding` | 24px (`p-6`) |
| Tabs list padding | `padding` | 3px (`p-[3px]`) |

### Element Heights

| Element | Height |
|---------|--------|
| Button (default) | 36px (`h-9`) |
| Button (sm) | 32px (`h-8`) |
| Button (lg) | 40px (`h-10`) |
| Button (icon) | 36x36px (`size-9`) |
| Input | 36px (`h-9`) |
| Select trigger (default) | 36px (`h-9`) |
| Select trigger (sm) | 32px (`h-8`) |
| Tabs list | 36px (`h-9`) |
| Avatar | 40x40px (`size-10`) |
| Checkbox | 16x16px (`size-4`) |
| Switch | 18.4px h x 32px w (`h-[1.15rem] w-8`) |
| Progress bar | 8px (`h-2`) |

### Layout Dimensions

| Element | Width |
|---------|-------|
| Sidebar (expanded) | 256px (`16rem`) |
| Sidebar (collapsed/icon) | 48px (`3rem`) |
| Student top header | 56px height |
| Admin top bar | 64px height |
| Admin sidebar (expanded) | 256px |
| Admin sidebar (collapsed) | 56px |
| Dialog max-width (sm screen) | `calc(100% - 2rem)` |
| Dialog max-width (sm+ breakpoint) | 512px (`max-w-lg`) |

---

## 5. Border Radius

### Radius Scale

| Token | Value | Tailwind Class |
|-------|-------|----------------|
| `--radius` (base) | `0.625rem` (10px) | — |
| `--radius-sm` | `calc(var(--radius) - 4px)` = 6px | `rounded-sm` |
| `--radius-md` | `calc(var(--radius) - 2px)` = 8px | `rounded-md` |
| `--radius-lg` | `var(--radius)` = 10px | `rounded-lg` |
| `--radius-xl` | `calc(var(--radius) + 4px)` = 14px | `rounded-xl` |
| Full (pill) | `9999px` | `rounded-full` |

### Component Radius Usage

| Component | Radius |
|-----------|--------|
| Card | `rounded-xl` (14px) |
| Button (default) | `rounded-md` (8px) |
| Button (sm, lg, icon) | `rounded-md` (8px) |
| Input | `rounded-md` (8px) |
| Textarea | `rounded-md` (8px) |
| Select trigger | `rounded-md` (8px) |
| Badge | `rounded-md` (8px) |
| Dialog | `rounded-lg` (10px) |
| Tabs list | `rounded-xl` (14px) |
| Tab trigger (active) | `rounded-xl` (14px) |
| Avatar | `rounded-full` |
| Progress bar | `rounded-full` |
| Switch | `rounded-full` |
| Checkbox | `4px` (`rounded-[4px]`) |
| Tooltip | `rounded-md` (8px) |
| Select dropdown | `rounded-md` (8px) |

---

## 6. Shadows

PBA uses minimal shadows. Most elevation is conveyed through borders rather than box shadows.

| Context | Shadow |
|---------|--------|
| Checkbox | `shadow-xs` (very subtle) |
| Dialog content | `shadow-lg` (dialog overlay already provides `bg-black/50`) |
| Select dropdown | `shadow-md` |
| Most components | No shadow (border-based elevation) |

### Dialog Overlay

```css
/* Semi-transparent black overlay behind modals */
background: rgba(0, 0, 0, 0.5); /* bg-black/50 */
```

---

## 7. Design Tokens (CSS Custom Properties)

### Complete CSS Token Definition

```css
/* ============================================================
   Light Mode (default)
   ============================================================ */
:root {
  --radius: 0.625rem;
  --font-size: 16px;

  /* Semantic colors */
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --card: #ffffff;
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: #030213;
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.95 0.0058 264.53);
  --secondary-foreground: #030213;
  --muted: #ececf0;
  --muted-foreground: #717182;
  --accent: #e9ebef;
  --accent-foreground: #030213;
  --destructive: #d4183d;
  --destructive-foreground: #ffffff;
  --border: rgba(0, 0, 0, 0.1);
  --input: transparent;
  --input-background: #f3f3f5;
  --switch-background: #cbced4;
  --ring: oklch(0.708 0 0);

  /* Font weights */
  --font-weight-medium: 500;
  --font-weight-normal: 400;

  /* Chart colors */
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);

  /* Sidebar */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: #030213;
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
}

/* ============================================================
   Dark Mode
   ============================================================ */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: #ffffff;
  --border: rgba(255, 255, 255, 0.1);
  --input: transparent;
  --input-background: oklch(0.269 0 0);
  --switch-background: oklch(0.371 0 0);
  --ring: oklch(0.556 0 0);

  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: #4a9ad4;
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: rgba(255, 255, 255, 0.08);
}
```

### Tailwind CSS v4 Theme Mapping

The project uses `@theme inline` in Tailwind CSS v4 to map tokens to utility classes:

```css
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-switch-background: var(--switch-background);
  --color-ring: var(--ring);

  /* Brand color utilities (e.g. bg-brand-navy, text-brand-blue) */
  --color-brand-navy: #1a2744;
  --color-brand-blue: #4a9ad4;
  --color-brand-blue-mid: #4a90c4;
  --color-brand-sky: #7bb8e0;
  --color-brand-pale: #a8d4f0;
  --color-brand-pale-light: #d4e8f7;
  --color-brand-orange: #ff8c5a;
  --color-brand-red-orange: #ff6347;
  --color-brand-deep-red: #d73027;

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --sidebar-width: 16rem;
  --sidebar-width-icon: 3rem;
}
```

---

## 8. Component Patterns

All components follow the **shadcn/ui** pattern using **Radix UI** primitives, **class-variance-authority (CVA)** for variants, and the `cn()` utility for Tailwind class merging.

### Button

Six visual variants and four sizes.

**Variants:**

| Variant | Light Mode Appearance |
|---------|----------------------|
| `default` | Near-black background (`bg-primary`), white text. Hover: 90% opacity. |
| `destructive` | Red background (`bg-destructive`), white text. Hover: 90% opacity. |
| `outline` | Transparent background with border. Hover: light gray fill (`bg-accent`). |
| `secondary` | Light lavender-gray fill (`bg-secondary`). Hover: 80% opacity. |
| `ghost` | No background. Hover: light gray fill (`bg-accent`). |
| `link` | Text only, underline on hover. |

**Sizes:**

| Size | Height | Padding |
|------|--------|---------|
| `default` | 36px | `px-4 py-2` |
| `sm` | 32px | `px-3` |
| `lg` | 40px | `px-6` |
| `icon` | 36x36px | centered |

**Shared styles**: `rounded-md`, `text-sm`, `font-medium`, `gap-2`, inline-flex, centered content, disabled at 50% opacity.

**Focus state**: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`

### Card

A container with rounded corners and a border.

```
Container:  bg-card text-card-foreground rounded-xl border
            flex flex-col gap-6
Header:     px-6 pt-6, grid layout (supports card-action in second column)
Title:      Renders as <h4>, inherits heading styles
Description: text-muted-foreground
Content:    px-6, last-child gets pb-6
Footer:     px-6 pb-6, flex items-center
```

### Input

```
Height:      h-9 (36px)
Background:  bg-input-background (#f3f3f5)
Border:      border-input (transparent by default)
Radius:      rounded-md (8px)
Padding:     px-3 py-1
Font:        text-base (16px) on mobile, text-sm (14px) on md+
Placeholder: text-muted-foreground (#717182)
Focus:       border-ring + ring-ring/50 + ring-[3px]
Invalid:     ring-destructive/20 + border-destructive
```

### Textarea

Same styling as Input but with:
- `min-h-16` (64px minimum height)
- `resize-none` (no user resize)
- `field-sizing-content` (auto-grows with content)

### Select

Trigger styled like Input with a chevron-down icon. Dropdown content has:
- `bg-popover` background
- `rounded-md` corners
- `shadow-md`
- Animated entrance (fade-in, zoom-in-95, slide from edge)
- Items: hover with `bg-accent`, checkmark indicator

### Badge

Inline pill-like labels.

| Variant | Appearance |
|---------|-----------|
| `default` | `bg-primary text-primary-foreground` (dark) |
| `secondary` | `bg-secondary text-secondary-foreground` (light gray) |
| `destructive` | `bg-destructive text-white` (red) |
| `outline` | Border only, `text-foreground` |

**Shared**: `rounded-md`, `text-xs`, `font-medium`, `px-2 py-0.5`, `border`.

### Tabs

```
TabsList:    bg-muted rounded-xl, h-9, p-[3px], inline-flex
TabsTrigger: rounded-xl, text-sm font-medium
  Active:    bg-card (white card background pops out)
  Inactive:  text-foreground (light) / text-muted-foreground (dark)
TabsContent: flex-1, no outline
```

### Dialog / Modal

```
Overlay:  fixed inset-0 bg-black/50, z-50, fade in/out animation
Content:  bg-background, rounded-lg, border, shadow-lg, p-6
          max-w-lg on sm+, centered (translate -50%/-50%)
          zoom-in-95 / zoom-out-95 animation
Header:   flex-col gap-2, left-aligned (sm+)
Title:    text-lg font-semibold
Description: text-muted-foreground text-sm
Footer:   flex-col-reverse (mobile) → flex-row justify-end (sm+)
Close:    absolute top-4 right-4, X icon, opacity-70 → hover 100%
```

### Avatar

```
Container: size-10 (40px), rounded-full, overflow-hidden
Image:     aspect-square, fills container
Fallback:  bg-muted, rounded-full, centered content
```

### Progress Bar

```
Track:     bg-primary/20, h-2, rounded-full, overflow-hidden
Indicator: bg-primary, h-full, translateX-based animation
```

### Switch

```
Track:   w-8 h-[1.15rem], rounded-full
  Checked:   bg-primary
  Unchecked: bg-switch-background (#cbced4)
Thumb:   size-4, rounded-full, bg-card (white)
  Checked:   translate-x to right
  Unchecked: translate-x-0
```

### Checkbox

```
Size:    size-4 (16px), rounded-[4px]
Default: border, bg-input-background, shadow-xs
Checked: bg-primary, text-primary-foreground, border-primary
         CheckIcon (lucide) inside
Focus:   border-ring + ring-ring/50 + ring-[3px]
```

### Tooltip

```
Content: bg-primary text-primary-foreground
         rounded-md, px-3 py-1.5, text-xs
         z-50, animated (fade-in, zoom-in-95, slide from edge)
Arrow:   bg-primary, size-2.5, rotated square
```

### Separator

```
Horizontal: h-px w-full bg-border
Vertical:   w-px h-full bg-border
```

---

## 9. Layout Patterns

### Desktop-First Responsive Strategy

- **Full support**: 1024px and above
- **Graceful degradation**: down to 375px
- **Mobile detection breakpoint**: 768px (`useIsMobile()` hook)
- **Responsive prefix**: Use Tailwind breakpoints (`sm:`, `md:`, `lg:`)

### Student Layout

- **Top header**: 56px height, full width
- **Step list panel**: IS the navigation (master-detail pattern)
- **Master panel**: 280px fixed width (left)
- **Detail panel**: Fluid width (right)

### Admin Layout

- **Collapsible sidebar**: 256px expanded / 56px collapsed
- **Top bar**: 64px height
- **Keyboard shortcut**: `Cmd/Ctrl + B` to toggle sidebar
- **Mobile**: Sidebar renders as bottom Sheet (drawer)

---

## 10. Iconography

- **Icon library**: `lucide-react` (ONLY this library — do not add others)
- **Default icon size**: 16x16px (`size-4`) within components
- **Icon in buttons**: Icons in buttons are `size-4`, `pointer-events-none`, `shrink-0`
- **Icon color**: Inherits `currentColor` by default; muted variants use `text-muted-foreground`

---

## 11. Animation

### Libraries

- **tw-animate-css**: Tailwind-native animations
- **motion** (Framer Motion): Complex/interactive animations

### Standard Animations

| Animation | Usage | Classes |
|-----------|-------|---------|
| Fade in | Dialog overlay, tooltips, popovers | `animate-in fade-in-0` |
| Fade out | Closing overlays | `animate-out fade-out-0` |
| Zoom in | Dialog content, select dropdown | `zoom-in-95` |
| Zoom out | Closing dialogs | `zoom-out-95` |
| Slide from edge | Tooltips, popovers | `slide-in-from-top-2`, etc. |

### Transitions

Most interactive components use:

```css
transition-all          /* buttons, switches */
transition-[color,box-shadow]  /* inputs, selects, badges */
```

Duration: Default Tailwind transition duration (150ms).

---

## 12. Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19+ with TypeScript |
| Styling | Tailwind CSS v4 (CSS-based config, not JS) |
| CSS Processing | PostCSS with `@tailwindcss/postcss` |
| Component Primitives | Radix UI (`@radix-ui/react-*`) |
| Variant Management | `class-variance-authority` (CVA) |
| Class Merging | `clsx` + `tailwind-merge` via `cn()` utility |
| Icons | `lucide-react` |
| Animations | `tw-animate-css` + `motion` (Framer Motion) |
| Toasts | `sonner` |
| Charts | `recharts` |
| Forms | `react-hook-form` |
| Routing | `react-router` v7 |
| Build Tool | Vite |

### Utility Function: `cn()`

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Component Convention

```tsx
function ComponentName({ className, ...props }: ComponentNameProps) {
  return (
    <element
      data-slot="component-name"
      className={cn("base-tailwind-classes", className)}
      {...props}
    />
  );
}

export { ComponentName };
```

Key conventions:
- Named function declarations (not arrow functions)
- `data-slot` attribute on every component root
- `className` prop always accepted and merged via `cn()`
- Destructured props with rest spread

### Dark Mode

Dark mode is activated by adding the `.dark` class to an ancestor element. The custom variant is:

```css
@custom-variant dark (&:is(.dark *));
```

All semantic tokens are redefined under `.dark` — components automatically adapt without any code changes.

---

## Quick Reference: Key Visual Decisions

| Decision | Choice |
|----------|--------|
| Primary button color | Near-black (`#030213`) with white text |
| Input background | Light gray (`#f3f3f5`), not white |
| Card background | White with subtle border (`rgba(0,0,0,0.1)`) |
| Card radius | 14px (`rounded-xl`) |
| Button/Input radius | 8px (`rounded-md`) |
| Focus indicator | 3px ring in gray, border highlight |
| Destructive color | Red `#d4183d` |
| Secondary text | Gray `#717182` |
| Default border | `rgba(0, 0, 0, 0.1)` — very subtle |
| Elevation strategy | Borders, not box-shadows (except dialogs/selects) |
| Font | Inter, 16px base, antialiased |
| Heading weight | 500 (medium), not bold |
| Brand accent for CTAs | Warm Orange `#ff8c5a` (for marketing/landing pages) |

---

## 13. Landing Page CTA

All primary call-to-action buttons on the landing page must use the following:

| Property | Value |
|----------|-------|
| **Label** | `Join waitlist` |
| **URL** | `https://test.productbuilderacademy.com` |
| **Style** | Warm Orange background (`#ff8c5a`), white text, `font-weight: 600`, `rounded-lg` |
| **Hover** | Red-Orange (`#ff6347`) background |
| **Size** | `h-12 px-8 text-base` (large, prominent) |

### HTML Example

```html
<a href="https://test.productbuilderacademy.com"
   style="display: inline-flex; align-items: center; justify-content: center;
          height: 48px; padding: 0 32px; background: #ff8c5a; color: #ffffff;
          font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600;
          border-radius: 10px; text-decoration: none; transition: background 0.2s;">
  Join waitlist
</a>
```

### React/Tailwind Example

```tsx
<a
  href="https://test.productbuilderacademy.com"
  className="inline-flex items-center justify-center h-12 px-8 bg-[#ff8c5a] hover:bg-[#ff6347] text-white font-semibold rounded-lg text-base transition-colors"
>
  Join waitlist
</a>
```

> **Note:** Every CTA on the landing page — hero section, mid-page, footer — should use the text "Join waitlist" and link to `https://test.productbuilderacademy.com`.
