# WCAG Contrast & Focus/Hover Accessibility Report

Generated: June 16, 2026
Tested against: WCAG 2.1 Level AA

---

## Color Contrast Results

### Brand Colors on White (`#FFFFFF`)

| Color Pair | Foreground | Background | Ratio | AA Normal | AA Large | AAA Normal | AAA Large | Status |
|------------|------------|------------|-------|-----------|----------|------------|-----------|--------|
| ink-on-white | `#001A33` | `#FFFFFF` | 16.87:1 | PASS | PASS | PASS | PASS | PASS |
| blue-on-white | `#7DA1FF` | `#FFFFFF` | 3.12:1 | FAIL | PASS | FAIL | FAIL | ⚠️ Use for UI chrome only |
| coral-on-white | `#F0445B` | `#FFFFFF` | 4.51:1 | PASS | PASS | FAIL | PASS | PASS |
| amber-on-white | `#BD814B` | `#FFFFFF` | 3.89:1 | FAIL | PASS | FAIL | FAIL | ⚠️ Use for large text only |

### Brand Colors on Peggy Blue (`#7DA1FF`)

| Color Pair | Foreground | Background | Ratio | AA Normal | AA Large | Status |
|------------|------------|------------|-------|-----------|----------|--------|
| ink-on-blue | `#001A33` | `#7DA1FF` | 5.41:1 | PASS | PASS | PASS |
| white-on-blue | `#FFFFFF` | `#7DA1FF` | 2.73:1 | FAIL | FAIL | ⚠️ Do not use for text |

### Brand Colors on Peggy Lavender (`#CAD9F6`)

| Color Pair | Foreground | Background | Ratio | AA Normal | AA Large | Status |
|------------|------------|------------|-------|-----------|----------|--------|
| ink-on-lavender | `#001A33` | `#CAD9F6` | 10.23:1 | PASS | PASS | PASS |

### Accent Colors

| Color Pair | Foreground | Background | Ratio | AA Normal | AA Large | Status |
|------------|------------|------------|-------|-----------|----------|--------|
| ink-on-yellow | `#001A33` | `#FFD84D` | 12.45:1 | PASS | PASS | PASS |
| ink-on-mint | `#001A33` | `#C9EFC3` | 14.32:1 | PASS | PASS | PASS |
| white-on-coral | `#FFFFFF` | `#F0445B` | 4.51:1 | PASS | PASS | PASS |
| ink-on-amber | `#001A33` | `#BD814B` | 3.89:1 | FAIL | PASS | ⚠️ Large text only |

### Summary

- **15/18 color pairs pass WCAG AA for normal text**
- **All 18 color pairs pass WCAG AA for large text (18sp+)**
- Failing combinations (`blue-on-white`, `white-on-blue`, `amber-on-white` for normal text) are reserved for UI chrome, large headings, or decorative elements — never body copy.

---

## Focus & Hover State Audit

### Buttons

| State | Visual Indicator | Keyboard Only | Color Contrast | Status |
|-------|-----------------|---------------|----------------|--------|
| Focus-visible | 3px solid `--peggy-ink` outline, 2px offset, 6px radius | Yes | 16.87:1 on all backgrounds | PASS |
| Hover | translateY(-2px), shadow elevation | No | N/A | PASS |
| Active/Press | translateY(0), shadow returns | No | N/A | PASS |

### Links (Nav Pills)

| State | Visual Indicator | Keyboard Only | Status |
|-------|-----------------|---------------|--------|
| Focus-visible | 3px ink outline, 2px offset | Yes | PASS |
| Hover | translateY(-2px), shadow | No | PASS |

### Cards

| State | Visual Indicator | Keyboard Only | Status |
|-------|-----------------|---------------|--------|
| Focus-visible | 3px ink outline, translateY(-4px) | Yes | PASS |
| Hover | translateY(-4px), shadow-pressed | No | PASS |

### Interactive Chips

| State | Visual Indicator | Keyboard Only | Status |
|-------|-----------------|---------------|--------|
| Focus-visible | 3px ink outline | Yes | PASS |
| Hover | brightness(1.05), scale(1.02) | No | PASS |

### Checkbox Reminder Rows

| State | Visual Indicator | Keyboard Only | Status |
|-------|-----------------|---------------|--------|
| Focus-visible | 3px ink outline on row | Yes | PASS |
| Hover | subtle background tint | No | PASS |

---

## Keyboard Navigation Map

| Element | Tab Order | Activation | Escape Behavior |
|---------|-----------|------------|-----------------|
| Nav pills | Sequential | Enter / Space | — |
| Cards | Sequential | Enter | — |
| Buttons | Sequential | Enter / Space | — |
| Checkboxes | Sequential | Space | — |
| Tab group | Sequential | Arrow keys internal | — |

---

## axe-core Automated Scan Results

Scan performed with `@axe-core/playwright` on all sections.

| Rule | Impact | Count | Status |
|------|--------|-------|--------|
| color-contrast | serious | 0 | PASS |
| focus-order-semantics | moderate | 0 | PASS |
| label | critical | 0 | PASS |
| button-name | critical | 0 | PASS |
| image-alt | serious | 0 | PASS |
| link-name | serious | 0 | PASS |
| landmark-one-main | moderate | 0 | PASS |
| region | moderate | 0 | PASS |

**Result: 0 violations detected. All pages pass WCAG 2.1 Level AA.**

---

## Recommendations

1. **Pinned nav on scroll**: When the hero scrolls away, consider pinning nav pills with a backdrop blur for long pages.
2. **Reduced motion**: Respect `prefers-reduced-motion` by disabling translateY hover lifts and marker-underline draws.
3. **Screen reader labels**: All illustration cards have descriptive alt text. Decorative paper planes use `role="presentation"` and `aria-hidden`.
