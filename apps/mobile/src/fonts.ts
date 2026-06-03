/**
 * Shared font family constants.
 *
 * Body / paragraph text stays in Poppins (loaded via the expo-font
 * config plugin in app.json). Titles and headings use Tenor Sans —
 * an elegant serif-inspired display font with a refined, luxury feel
 * that suits the premium dark + gold brand.
 *
 * The font string matches the key exported by @expo-google-fonts/tenor-sans
 * and loaded via useFonts() in App.tsx.
 */

// Body text — Poppins (existing, loaded natively via app.json plugin)
export const FONT_LIGHT = 'Poppins-Light';
export const FONT_REGULAR = 'Poppins-Regular';
export const FONT_BOLD = 'Poppins-Bold';

// Display / titles — Tenor Sans (loaded at runtime via useFonts)
export const FONT_DISPLAY = 'TenorSans_400Regular';

/** Default title font — use for screen titles and big headings. */
export const FONT_TITLE = FONT_DISPLAY;
/** Same weight (Tenor Sans has one weight) — use for section headers / sub-titles. */
export const FONT_TITLE_SOFT = FONT_DISPLAY;
