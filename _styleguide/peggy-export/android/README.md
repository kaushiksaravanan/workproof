# Peggy Android Theme Integration

## Quick Setup

1. Copy `Color.kt`, `Shape.kt`, `Type.kt`, and `Theme.kt` into your app's `ui/theme/` package.
2. Copy `colors.xml` and `dimens.xml` into `res/values/`.
3. Download [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) from Google Fonts.
4. Place font files in `res/font/`:
   - `fraunces_variablefont_opsz_wght.ttf`
   - `plusjakartasans_regular.ttf`
   - `plusjakartasans_medium.ttf`
   - `plusjakartasans_semibold.ttf`
   - `plusjakartasans_bold.ttf`
   - `plusjakartasans_extrabold.ttf`
5. Wrap your app root in `PeggyTheme`:

```kotlin
setContent {
    PeggyTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            MyApp()
        }
    }
}
```

## UI Verification Checklist

Use this list after integrating the theme to confirm everything matches the style guide.

| # | Check | Expected |
|---|-------|----------|
| 1 | Page background | `#E3E3E3` (`PeggyPage`) |
| 2 | Card background | `#FFFFFF` |
| 3 | Primary button fill | `#7DA1FF` (`PeggyBlue`) |
| 4 | Primary button text | `#001A33` (`PeggyInk`) — NOT white |
| 5 | Headline font | Plus Jakarta Sans ExtraBold, 28sp |
| 6 | Italic emphasis | Fraunces Medium Italic |
| 7 | Body font | Plus Jakarta Sans Regular, 15sp |
| 8 | Card radius | 20dp (`PeggyShapes.medium`) |
| 9 | Chip radius | 12dp or pill (`PeggyShapes.small`) |
| 10 | Min tap target | 48dp (`peggy_min_tap`) |
| 11 | Doodle ink color | `#001A33` — never recolored |
| 12 | Paper plane opacity | 60–90% |

## File Mapping

| Export File | Destination |
|-------------|-------------|
| `colors.xml` | `res/values/colors.xml` |
| `dimens.xml` | `res/values/dimens.xml` |
| `Color.kt` | `ui/theme/Color.kt` |
| `Shape.kt` | `ui/theme/Shape.kt` |
| `Type.kt` | `ui/theme/Type.kt` |
| `Theme.kt` | `ui/theme/Theme.kt` |
