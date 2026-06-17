package com.peggy.android.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.peggy.android.R

// Download from Google Fonts and place in res/font/
// Fraunces: fraunces_variablefont_opsz_wght.ttf
// Plus Jakarta Sans:
//   plusjakartasans_regular.ttf, medium, semibold, bold, extrabold

val Fraunces = FontFamily(
    Font(R.font.fraunces_variable, weight = FontWeight.Medium, style = FontStyle.Italic),
    Font(R.font.fraunces_variable, weight = FontWeight.Bold,  style = FontStyle.Italic)
)

val PlusJakartaSans = FontFamily(
    Font(R.font.plusjakartasans_regular,  weight = FontWeight.Normal),
    Font(R.font.plusjakartasans_medium,   weight = FontWeight.Medium),
    Font(R.font.plusjakartasans_semibold, weight = FontWeight.SemiBold),
    Font(R.font.plusjakartasans_bold,     weight = FontWeight.Bold),
    Font(R.font.plusjakartasans_extrabold, weight = FontWeight.ExtraBold)
)

val PeggyTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 34.sp,
        lineHeight = 38.sp,
        letterSpacing = (-0.02).sp
    ),
    headlineLarge = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 28.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.02).sp
    ),
    headlineMedium = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 26.sp,
        letterSpacing = (-0.01).sp
    ),
    titleLarge = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 22.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 20.sp
    ),
    labelLarge = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 18.sp
    ),
    labelSmall = TextStyle(
        fontFamily = PlusJakartaSans,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.6.sp
    )
)

// Convenience style for Fraunces italic headlines
val PeggyItalic = TextStyle(
    fontFamily = Fraunces,
    fontWeight = FontWeight.Medium,
    fontStyle = FontStyle.Italic,
    fontSize = 22.sp,
    lineHeight = 26.sp,
    letterSpacing = (-0.01).sp
)
