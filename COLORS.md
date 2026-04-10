# Color Token System

All colors in the Gita Learning PWA are centralized as CSS variables in `src/app/globals.css`. This document explains the color system and how to use it.

## CSS Variables Reference

Color variables are defined in `:root` and `.dark` sections and are available app-wide via `var(--gita-*)`.

### Light Colors & Accents

| Token | Hex | Usage |
|-------|-----|-------|
| `--gita-light-lightest` | #fffaf0 | Lightest backgrounds |
| `--gita-light-white` | #fffcf5 | Off-white backgrounds |
| `--gita-light-cream` | #f9f1e1 | Cream backgrounds |
| `--gita-light-off-white` | #f2e8d0 | Pale backgrounds |
| `--gita-light-pale` | #fcebc4 | Light pale accents |
| `--gita-light-pale-alt` | #fcf5e3 | Pale alternate |
| `--gita-light-subtle` | #f4e9cb | Subtle backgrounds |
| `--gita-light-sand` | #ebd6ab | Sand/border color |
| `--gita-light-gold` | #f0d498 | Gold accents |
| `--gita-light-text` | #f0e3ce | Light text (dark mode) |
| `--gita-light-border` | #ccb385 | Dialog borders |
| `--gita-light-divider` | #dbba84 | Divider lines |

### Brown Tones & Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--gita-brown-dark` | #8f6422 | Dark brown, button backgrounds |
| `--gita-brown-warm` | #a88d63 | Warm brown, secondary text |
| `--gita-brown-muted` | #b0976e | Muted brown, tertiary text |
| `--gita-brown-text` | #8a6b3d | Body text color |
| `--gita-brown-title` | #4a3615 | Headings & titles |
| `--gita-brown-dark-text` | #5c431b | Dark text (dark mode) |
| `--gita-brown-subtle` | #6b5532 | Subtle text |
| `--gita-brown-medium` | #6b512c | Medium brown |
| `--gita-brown-accent` | #5f4a2b | Accent brown |
| `--gita-brown-rare` | #3d2c10 | Rare/deep brown |
| `--gita-brown-darker` | #5c482a | Darker brown |
| `--gita-brown-pale` | #c4a062 | Pale brown |
| `--gita-brown-light` | #c0a986 | Light brown |
| `--gita-brown-lightest` | #bda27e | Lightest brown (most used) |
| `--gita-brown-gold` | #d4aa61 | Gold-brown accent |

### Dark Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--gita-dark-darkest` | #15100a | Darkest background |
| `--gita-dark-bg` | #1e1710 | Main dark background |
| `--gita-dark-darker` | #2d2218 | Darker variant |

### Success & Progress Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--gita-success-light` | #e8f5df | Success background |
| `--gita-success-border` | #c1e0b0 | Success border |
| `--gita-success-text` | #88c775 | Success text |
| `--gita-success-dark` | #2c5d1f | Dark success |
| `--gita-success-darker` | #142610 | Darkest success |

## Usage

### In CSS/Global Styles

```css
.custom-element {
  color: var(--gita-brown-text);
  background-color: var(--gita-light-off-white);
  border-color: var(--gita-light-sand);
}
```

### In Tailwind Classes

Use arbitrary values with CSS variables:

```tsx
<div className="bg-[var(--gita-light-off-white)] text-[var(--gita-brown-text)]">
  Content
</div>
```

### In Inline Styles

```tsx
<div style={{ color: 'var(--gita-brown-lightest)' }}>
  Content
</div>
```

## Color Families

### Light Mode (default)
- **Backgrounds**: Light, off-white, cream, pale colors from `--gita-light-*`
- **Text**: Dark browns from `--gita-brown-*`
- **Accents**: Gold and warm tones from `--gita-brown-gold`, `--gita-light-gold`

### Dark Mode
- **Backgrounds**: Dark grays/browns from `--gita-dark-*`
- **Text**: Light colors from `--gita-light-text` and `--gita-light-lightest`
- **Accents**: Gold and warm tones (same as light mode)

## Most Used Colors

1. `--gita-brown-lightest` (#bda27e) — 34 uses
2. `--gita-dark-bg` (#1e1710) — 22 uses
3. `--gita-light-text` (#f0e3ce) — 17 uses
4. `--gita-brown-gold` (#d4aa61) — 17 uses
5. `--gita-light-gold` (#f0d498) — 16 uses

## Adding New Colors

1. Add the CSS variable to both `:root` and `.dark` in `globals.css`
2. Optionally add a Tailwind utility class in the `@layer components` section
3. Update this document with the new color reference

## Benefits

- **Centralized management**: All colors in one place (`src/app/globals.css`)
- **Dark mode support**: Variables work seamlessly across light and dark modes
- **Consistency**: Developers reference semantic color names instead of hex codes
- **Maintainability**: Updating a color once updates it everywhere
- **Accessibility**: Color values can be adjusted for WCAG compliance
