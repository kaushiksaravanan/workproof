package com.peggy.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary           = PeggyBlue,
    onPrimary         = PeggyInk,
    primaryContainer  = PeggyLavender,
    onPrimaryContainer= PeggyInk,
    secondary         = PeggyLavender,
    onSecondary       = PeggyInk,
    tertiary          = PeggyAmber,
    onTertiary        = PeggyInk,
    tertiaryContainer = PeggyYellow,
    onTertiaryContainer = PeggyInk,
    background        = PeggyPage,
    onBackground      = PeggyInk,
    surface           = PeggyWhite,
    onSurface         = PeggyInk,
    surfaceVariant    = PeggyLavender,
    onSurfaceVariant  = PeggyInk,
    error             = PeggyCoral,
    onError           = PeggyWhite,
    outline           = PeggyHairline,
    outlineVariant    = PeggyLavender,
    inverseSurface    = PeggyInk,
    inverseOnSurface  = PeggyWhite,
    inversePrimary    = PeggyBlue,
    scrim             = PeggyInk
)

private val DarkColorScheme = darkColorScheme(
    primary           = PeggyBlue,
    onPrimary         = PeggyInkDark,
    primaryContainer  = PeggySurfaceDark,
    onPrimaryContainer= PeggyInkDark,
    secondary         = PeggySurfaceDark,
    onSecondary       = PeggyInkDark,
    tertiary          = PeggyAmber,
    onTertiary        = PeggyInkDark,
    background        = PeggyPageDark,
    onBackground      = PeggyInkDark,
    surface           = PeggySurfaceDark,
    onSurface         = PeggyInkDark,
    surfaceVariant    = PeggySurfaceDark,
    onSurfaceVariant  = PeggyInkDark,
    error             = PeggyCoral,
    onError           = PeggyWhite,
    outline           = PeggyInk.copy(alpha = 0.3f),
    outlineVariant    = PeggySurfaceDark,
    inverseSurface    = PeggyWhite,
    inverseOnSurface  = PeggyInk,
    inversePrimary    = PeggyBlue,
    scrim             = PeggyInk
)

@Composable
fun PeggyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = PeggyTypography,
        shapes = PeggyShapes,
        content = content
    )
}
