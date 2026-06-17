package com.peggy.android.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

val PeggyShapes = Shapes(
    small  = RoundedCornerShape(12.dp),   // chips, checkboxes, text fields
    medium = RoundedCornerShape(20.dp),   // cards, dialogs
    large  = RoundedCornerShape(28.dp),   // bottom sheets, hero panels
    extraLarge = RoundedCornerShape(32.dp) // modals
)
