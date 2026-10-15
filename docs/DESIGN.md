# Design: Night Drive

The app is a car's instrument cluster at night. Near-black ground, charcoal surfaces edged with a hairline, and one cyan light reserved for the single action the owner should take next. Barlow for reading; Barlow Semi Condensed, heavy and tabular, for titles and numbers. Due state is the whole hierarchy. The light appearance mirrors every token on a cool off-white ground.

Every colour, radius, size and font lives in `src/constants/theme.ts`. This file holds only the rules the code can't tell you.

## Styling rules

### Do

- Spend the cyan accent on exactly one control per screen, plus the focused field. When a cyan primary is present, every other action is outlined or inverse.
- Render a selected segment, chip or tab as an `inverse` fill with `onInverse` text.
- Give every status its mark, text shade and tint together, always with words that say the state.
- Set every number in Barlow Semi Condensed with tabular figures, and keep the most urgent number the largest thing on the screen.
- Build surfaces as `surface` on `background` with a 1pt `border` hairline, and separate list rows with a hairline, not whitespace.
- Keep every control a pill at 44pt or taller: 52pt for fields and standard buttons, 56pt for the screen's one call to action.
- Read every colour, radius, spacing and font from `theme.ts`; add a token when a new role appears.
- Mirror every token in the light scheme and check both appearances. Light tints are opaque pastels, not alpha fills.
- Pad the bottom of any scrolling tab screen by the tab-bar inset so content never hides under the floating bar.

### Don't

- Fill a selected control, a status pill or a tab with the accent.
- Put a shadow on a card, field, button or chip. The floating tab bar is the only shadow in the system.
- Show state by colour alone; a bar or dot always has text beside it.
- Uppercase anything other than the `display`, `headline` and `label` text types.
- Set `fontWeight` in a style; pick the weight by family name (`Fonts.body`, `Fonts.bodySemiBold`, `Fonts.display`).
- Hard-code a hex, radius or font name in a screen.
- Use `textFaint` for text; it is a decorative stroke colour only.
- Add gradients, illustration or hard offset shadows. The vehicle card's glow and silhouette are the one sanctioned piece of art.
