# Peggy Component Specification

Version 1.0 | Last updated: June 16, 2026

---

## Buttons

### Variants

| Variant | Background | Text | Border | Radius | Height | Tap target |
|---------|------------|------|--------|--------|--------|------------|
| Primary | `--peggy-blue` | `--peggy-ink` | none | 14dp / 20px | 48dp | 48dp min |
| Secondary | `--card` (white) | `--peggy-ink` | 2dp `--peggy-ink` | 14dp | 48dp | 48dp min |
| CTA Pill | `--peggy-amber` or `--peggy-coral` | `--peggy-ink` | none | pill | 32dp | 44dp min |

### Interaction Rules

- **Hover**: translateY(-2dp), shadow elevates from `shadow-soft` to `shadow-card`
- **Focus-visible**: 3px solid `--peggy-ink` outline, 2dp offset, 6px border-radius
- **Active / Press**: translateY(0), shadow drops to `shadow-soft`
- **Disabled**: opacity 0.5, no hover lift, cursor not-allowed
- **Keyboard**: Enter/Space activates; Tab moves focus; focus ring always visible

### Usage Example

```kotlin
@Composable
fun PeggyPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .height(48.dp)
            .fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = PeggyBlue,
            contentColor = PeggyInk
        ),
        elevation = ButtonDefaults.buttonElevation(
            defaultElevation = 4.dp,
            pressedElevation = 0.dp
        )
    ) {
        Text(text, style = PeggyType.labelLarge)
    }
}
```

---

## Chips & Tags

### Variants

| Type | Background | Text | Radius | Use case |
|------|------------|------|--------|----------|
| Event | `--peggy-mint` | `--peggy-ink` | pill | Schedule item |
| Category | `--peggy-lavender` | `--peggy-ink` | pill | Filter tag |
| Highlight | `--peggy-yellow` | `--peggy-ink` | pill | Special callout |
| Badge "NEW" | `--peggy-coral` | white | pill | Status indicator |

### Interaction Rules

- **Hover**: brightness(1.05), slight scale(1.02)
- **Focus-visible**: same 3px ink ring as buttons
- **Active**: scale(0.98), returns to 1.0 on release
- **Selection state**: add 2dp `--peggy-ink` border when selected

---

## Cards

### Variants

| Type | Background | Radius | Shadow | Padding |
|------|------------|--------|--------|---------|
| Standard | white | 20dp | `shadow-card` | 16dp |
| Event | `--peggy-lavender` | 20dp | `shadow-soft` | 16dp |
| Hero Panel | `--peggy-blue` | 0 (full-bleed) | none | 20dp horizontal |
| Notebook | white + rule lines | 20dp | `shadow-card` | 16dp + 24dp left margin |

### Interaction Rules

- **Hover**: translateY(-4dp), shadow elevates to `shadow-pressed`
- **Focus-visible**: 3px ink outline, 2dp offset
- **Press**: translateY(0), shadow drops; haptic feedback on mobile
- **Keyboard**: Enter to activate primary action; Tab into card, then arrow keys for internal navigation

### Accessibility

- Cards with actions must have `tabIndex={0}` and `role="button"` or contain a visible `<button>`
- Never nest interactive elements inside clickable cards without clear focus order

---

## Forms

### Text Fields

- Background: `--card` (white)
- Border: 1dp `--peggy-hairline`, radius 12dp
- Focus: border transitions to `--peggy-blue`, 2dp ring
- Error: border `--peggy-coral`, helper text `--peggy-coral`
- Label: 12sp uppercase, tracking +0.6, `--muted-foreground`
- Placeholder: `--muted-foreground` at 60% opacity

### Checkboxes

- Size: 20dp × 20dp, radius 6dp
- Unchecked: 2dp border `--peggy-ink/40`, transparent fill
- Checked: fill `--peggy-ink`, white checkmark
- Focus: 3dp ink ring with 2dp offset

### Keyboard Navigation

- Tab: moves between fields
- Shift+Tab: reverse
- Enter: submits form or advances to next field
- Escape: clears field or dismisses dropdown

---

## Tabs (Segmented Control)

- Container: `--peggy-lavender` background, pill shape
- Active tab: white card, `--shadow-soft`, `--peggy-ink` text
- Inactive tab: transparent, `--peggy-ink/80` text
- Transition: 150ms ease on background and shadow

---

## Motion Spec

| Animation | Duration | Easing | Use case |
|-----------|----------|--------|----------|
| Hover lift | 150ms | ease-out | Buttons, cards |
| Focus ring | 0ms (instant) | — | All interactive elements |
| Press settle | 80ms | ease-in-out | Tap feedback |
| Marker underline draw | 250ms | ease-out | Headline entrance |
| Card enter | 200ms | spring (stiffness 220, damping 26) | List items |
| Paper plane swoosh | 400ms | ease-in-out | Success states |

---

## Illustration Placement Rules

### Do
- Anchor doodles to a corner (bottom-right preferred)
- Keep 24dp+ clear space around figures
- Use paper planes at 12–32dp, 60–90% opacity
- Place family portraits in white cards on colored surfaces
- Caption portraits in Fraunces italic, 14sp

### Don't
- Center doodles in body copy or wrap text around them
- Use more than 3 paper planes per surface
- Scale planes above 48dp (they become content, not accent)
- Recolor ink strokes to brand accents (coral, yellow, mint)
- Use doodles as decorative filler — every illustration needs purpose
