---
name: Car Maintenance
description: Night Drive. A car's dashboard at night, where due state is the whole hierarchy.
colors:
  background: "#0A0C0F"
  surface: "#14181D"
  surface-raised: "#1C2128"
  border: "#262C34"
  border-strong: "#2E353E"
  text: "#F2F4F5"
  text-secondary: "#9AA3AD"
  text-faint: "#5C6670"
  accent: "#3DD9EB"
  on-accent: "#061317"
  inverse: "#F2F4F5"
  on-inverse: "#0A0C0F"
  danger: "#FF5A4E"
  danger-text: "#FF7A70"
  danger-tint: "rgba(255,90,78,0.14)"
  warning: "#FFB020"
  warning-text: "#FFB020"
  warning-tint: "rgba(255,176,32,0.14)"
  success: "#5BD48A"
  success-text: "#5BD48A"
  success-tint: "rgba(91,212,138,0.14)"
  nav: "#1C2128"
  shadow: "rgba(0,0,0,0.5)"
typography:
  display:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: "36px"
    letterSpacing: "0.6px"
  headline:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "24px"
    letterSpacing: "0.8px"
  numeral:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "30px"
    fontFeature: "tabular-nums"
  numeral-large:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: "76px"
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Barlow"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "1.4px"
  body:
    fontFamily: "Barlow"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  body-strong:
    fontFamily: "Barlow"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  small:
    fontFamily: "Barlow"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  small-strong:
    fontFamily: "Barlow"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  caption:
    fontFamily: "Barlow"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  input:
    fontFamily: "Barlow"
    fontSize: "17px"
    fontWeight: 500
  input-large:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "24px"
    fontWeight: 700
    fontFeature: "tabular-nums"
rounded:
  field: "14px"
  card: "18px"
  hero: "24px"
  pill: "999px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
  six: "64px"
  gutter: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-primary-large:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "56px"
  button-primary-small:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-destructive:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-text}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  icon-button-outlined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    size: "44px"
  icon-button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    size: "44px"
  icon-button-inverse:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    rounded: "{rounded.pill}"
    size: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-hero:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.hero}"
    padding: "20px"
  card-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-strong}"
    padding: "12px 12px 12px 16px"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.input}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "52px"
  text-field-large:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.input-large}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "60px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  segment-track:
    backgroundColor: "{colors.surface-raised}"
    rounded: "16px"
    padding: "4px"
  segment:
    textColor: "{colors.text}"
    typography: "{typography.small}"
    rounded: "12px"
    padding: "0 8px"
    height: "44px"
  segment-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    typography: "{typography.small-strong}"
    rounded: "12px"
    padding: "0 8px"
    height: "44px"
  status-pill-overdue:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-text}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  status-pill-due-soon:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning-text}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  status-pill-ok:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success-text}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  status-pill-unknown:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  section-label:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
  tab-bar:
    backgroundColor: "{colors.nav}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
    height: "64px"
  tab-item:
    textColor: "{colors.text-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    width: "76px"
    height: "52px"
  tab-item-active:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    width: "76px"
    height: "52px"
---

# Design System: Car Maintenance

## Overview

**Creative North Star: "The Night Dashboard"**

The app is the instrument cluster of a car at night. The ground is near-black, surfaces are raised charcoal panels edged with a hairline, and the one light that matters is a cyan indicator reserved for the single action the owner should take next. Everything the owner reads is set in Barlow; everything the owner glances at (screen titles, vehicle names, odometer readings, costs, the hero figure) is set heavy and condensed in Barlow Semi Condensed with tabular figures, the way a gauge sets its numbers. Due state is the entire hierarchy: the most urgent item sits at instrument scale inside a 270-degree arc, and everything else is a quiet list beneath it.

Density is calm, not sparse. Screens stack full-width cards on a 20pt gutter with a 16pt rhythm; rows inside a card are separated by a hairline, never by whitespace alone. Depth is tonal, a step from ground to surface to raised surface, and the only shadow in the system is the one under the floating pill tab bar. Selection is inverted (a solid fill of the text colour), so the cyan never has to compete with a selected segment, chip or tab. Status is never colour alone: each state has a solid mark, a text shade, a translucent tint and words.

The system refuses the category default of a white list of equal rows with coloured badges. It also refuses decoration: no gradients, no illustration, no hard offset shadows, no accent fills on selected controls. Trust comes from precision, real units and the number being the biggest thing on the screen. A light appearance mirrors every token on a cool off-white ground; the dark appearance is the brand's primary face and the values in the frontmatter above are its values. All sizes are density-independent points; "px" in the tokens means pt on device.

**Key Characteristics:**
- Near-black ground, charcoal surfaces, 1px hairline borders, no shadows except under the tab bar.
- One cyan accent, spent on at most one control per screen plus the focused field.
- Selected state is an inverse fill (text colour), never the accent.
- Three status colours (red, amber, green), each as a mark, a text shade and a 14% tint, always accompanied by words.
- Barlow for reading; Barlow Semi Condensed, heavy, uppercase and tabular, for titles and numbers.
- Pills for every control, 14pt fields, 18pt cards, 24pt vehicle cards.

## Colors

A near-black cockpit with one cyan indicator and three instrument lights, mirrored onto a cool off-white in the light appearance.

### Primary
- **Instrument Cyan** (`accent`): the one accent. The primary button on a screen ("Done today", "Add your first car"), the focused field's border, the text cursor and selection. It appears on at most one control per screen besides the focused field, and it is the same value in both appearances.
- **Ink on Cyan** (`on-accent`): the only colour allowed on top of the accent: label and icon of the primary button.

### Secondary
- **Headlight Inverse** (`inverse` / `on-inverse`): the selected state. A segment, chip or tab that is on fills solid with the text colour and sets its label in the ground colour. The vehicle card's chevron badge uses the same pair. Light appearance: `#0E1116` on `#FFFFFF`.

### Tertiary (status)
Each state has three shades: a solid **mark** for bars, dots and the gauge arc; a **text** shade for the words beside it; a **tint** for pill fills. Light appearance tints are opaque pastels rather than alpha fills so they stay clean on white.
- **Warning Red** (`danger`, `danger-text`, `danger-tint`): overdue items, the destructive button's tinted fill and label, a field in error. Light: `#D92D20`, `#B42318`, `#FDECEA`.
- **Instrument Amber** (`warning`, `warning-text`, `warning-tint`): due soon, tire changeover deadlines. Light: `#E89400`, `#8A5A00`, `#FFF4DB`.
- **Clear Green** (`success`, `success-text`, `success-tint`): all clear, items in good standing. Light: `#2E9E5B`, `#1F7A44`, `#E3F4EA`.
- **Not logged** has no colour of its own: it uses `text-secondary` as its mark and text and `surface-raised` as its tint, with a dashed bar instead of a solid one.

### Neutral
- **Asphalt** (`background`): the screen ground and the form footer behind the primary action. Light: `#F4F5F7`.
- **Charcoal Panel** (`surface`): cards, list groups, text fields, outlined buttons and chips at rest. Light: `#FFFFFF`.
- **Raised Charcoal** (`surface-raised`): the segmented control's track, the gauge's unfilled arc, the empty-garage icon disc, the unlogged status pill. Light: `#ECEEF1`.
- **Hairline** (`border`): card edges, row separators, section rules in the guide, the form footer's top edge. Light: `#DDE1E6`.
- **Control Hairline** (`border-strong`): the slightly brighter edge on anything tappable at rest: fields, outlined buttons, chips, the tab bar. Light: `#D3D8DE`.
- **Headlight White** (`text`): primary text, the selected fill, the difficulty meter's filled bars. Light: `#0E1116`.
- **Dashboard Grey** (`text-secondary`): labels, descriptions, hints, placeholders, inactive tab labels. Light: `#59616B`.
- **Faint Stroke** (`text-faint`): decorative strokes only, never text. Light: `#9AA3AD`.
- **Nav Panel** (`nav`): the floating tab bar's opaque fill; it must not let content ghost through. Light: `#FFFFFF`.
- **Tab Bar Shadow** (`shadow`): the only shadow colour. Light: `rgba(14,17,22,0.14)`.

### Named Rules
**The One Cyan Rule.** The accent appears on at most one control per screen, plus the border of the field that currently has focus. When a screen already carries a cyan primary action, every other action on it is outlined or inverse; a due row on such a screen gets an outlined check, not a cyan "Done today" pill.

**The Inverse Selection Rule.** Selected is a solid fill of the text colour with the ground colour on top. Segments, chips and tabs never fill with the accent or with a status colour.

**The Mark, Text, Tint Rule.** A status colour never travels alone. Every state ships a solid mark, a text shade and a 14% tint, and the words ("1 overdue", "Due soon", "All clear") are always present beside it.

## Typography

**Display Font:** Barlow Semi Condensed, ExtraBold 800 and Bold 700, bundled (no fallback: the app waits for the fonts before it renders)
**Body Font:** Barlow, Regular 400, Medium 500 and SemiBold 600, bundled
**Label/Mono Font:** none; numbers get their alignment from tabular figures in Barlow Semi Condensed

**Character:** A condensed, heavy, uppercase display face against a quiet humanist-grotesque body. The display face is for the things an owner glances at from arm's length (titles, car names, the odometer, costs, the hero figure); Barlow is for everything they actually read. Weight in React Native is chosen by family name, never by `fontWeight`.

### Hierarchy
- **Display** (ExtraBold 800, 32/36, +0.6 tracking, uppercase): tab screen titles ("Garage", "Shops", "Settings") and the guide's item title, and vehicle names on garage cards.
- **Headline** (ExtraBold 800, 20/24, +0.8 tracking, uppercase): inline section headings on pushed and modal screens ("Why it matters", "Do it yourself"), the empty-garage title, the all-clear message inside the gauge.
- **Numeral Large** (ExtraBold 800, 72/76, tabular): the one hero figure inside the gauge, how far overdue or how far to go. Capped at 1.5x dynamic type and shrinks to fit a single line.
- **Numeral** (Bold 700, 26/30, tabular): odometer readings and the vehicle's big figures.
- **Numeral Compact** (Bold 700, 20/24, tabular): costs in history rows and cost cards, the guide's stat values.
- **Label** (Barlow SemiBold 600, 12/16, +1.4 tracking, uppercase): section labels above card groups, field labels above inputs, stat labels above numbers, the item name and unit around the hero figure. Always in `text-secondary` unless it carries a status colour.
- **Body** (Regular 400, 16/24) and **Body Strong** (SemiBold 600, 16/24): reading text and the name line of a list row. Button labels are Body Strong.
- **Small** (Regular 400, 14/20) and **Small Strong** (SemiBold 600, 14/20): a row's second line, card descriptions, chip and segment labels, small-button labels, status-pill text.
- **Caption** (Regular 400, 13/18): hints, errors, disclaimers, history metadata, tab labels (shrunk to 11/14 inside the tab bar).
- **Input** (Medium 500, 17) and **Input Large** (Semi Condensed Bold 700, 24, tabular): the text inside a field; the large size is for the one number a screen is about, such as the odometer.

### Named Rules
**The Condensed Numbers Rule.** Every number an owner reads (odometer, cost, kilometres remaining, the hero figure) is set in Barlow Semi Condensed with tabular figures. Numbers never appear in Barlow.

**The Uppercase Is Display Rule.** Only Display, Headline and Label are uppercase. Body, Small and Caption are never transformed, and uppercase text never runs longer than a title or a label.

**The Display Scale Cap Rule.** Display, Headline and both Numeral styles stop scaling at 1.5x dynamic type so a hero number never pushes its controls off screen; reading styles scale freely.

## Layout

One column, portrait, phone only. Content sits inside a 20pt horizontal gutter and stacks with a 16pt gap between blocks; a `SectionLabel` pulls 8pt closer to the card beneath it so the label reads as that card's title. Cards run full width of the column. On wide screens the column is capped at 800pt and centred.

Tab screens (`Screen`) put an uppercase Display title top-left with an optional round action top-right in a 44pt-tall header, then scroll; the content pads its bottom by the safe area plus the floating tab bar (12pt margin, 64pt bar) plus 16pt so nothing hides under the bar. Pushed and modal screens (`FormScreen`) use the native header, start their content 16pt below it, and pin the screen's one primary action in a footer above the home indicator, separated from the scroll by a hairline on the ground colour.

Inside cards, rows are 12pt tall-padded with 16pt on the left and 12pt on the right, so a trailing round button sits visually flush with the card edge. Two-up stat grids inside a card use 50% cells with a 16pt row gap. Side-by-side actions (primary button plus outlined icon button, or two large buttons in a footer) sit in a row with a 10pt gap.

The spacing scale is 2, 4, 8, 16, 24, 32, 64 plus the 20pt gutter; in-between values (6, 10, 12, 14) are composed from two steps and are used for the tight internal gaps of pills, rows and fields.

## Elevation & Depth

Flat with tonal steps. Depth comes from three greys (ground, surface, raised surface) and a 1px hairline on every card, field and control; nothing at rest casts a shadow. Pressing any control dims it to 70% opacity instantly, with no translation or scale. The single exception is the floating tab bar, which floats 12pt above the safe area on a soft, deep shadow because it sits over scrolling content and must read as a separate layer.

### Shadow Vocabulary
- **Tab bar float** (`box-shadow: 0 12px 24px rgba(0,0,0,0.5)`; light appearance `0 12px 24px rgba(14,17,22,0.14)`; Android elevation 12): the floating pill tab bar only.

### Named Rules
**The Hairline Rule.** Surfaces are flat and edged with a 1px border: `border` for containers and separators, `border-strong` for anything tappable. No card, field, button or chip casts a shadow.

**The One Float Rule.** The only shadow in the system is under the floating tab bar. A new surface that wants a shadow is a new layer the system does not have; use a tonal step instead.

## Shapes

Round where you touch, softly squared where you read. Every control (button, icon button, chip, status pill, tab bar, tab item, the vehicle card's chevron badge) is a full pill (999pt). Text fields and segments are 14pt; the segmented control's track is 16pt and its segments 12pt so the inner radius nests inside the outer. Cards and list groups are 18pt; vehicle (hero) cards are 24pt. Cards clip their children so row separators and pressed states stay inside the radius.

Status marks are a 4pt-wide, 36pt-tall bar with 2pt corners (dashed and hollow when nothing is logged); status dots are 7pt circles; the difficulty meter is three 4pt bars with 2pt corners. The gauge is a 270-degree arc with round caps, open at the bottom like a speedometer, 14pt thick at 270pt (12pt at 230pt for the all-clear state).

## Components

### Buttons
A pill with a 1px border, a Body Strong label, 8pt icon gap, dimmed to 70% when pressed, loading or disabled. Loading swaps the icon for a spinner in the label colour.
- **Shape:** full pill (999pt), 1px border in the fill colour (or `border-strong` for secondary).
- **Primary:** `accent` fill, `on-accent` label and icon; 52pt tall with 24pt side padding. `large` is 56pt for the screen's one call to action; `small` is 44pt with 16pt padding and a Small Strong label for use inside rows.
- **Pressed / Disabled:** opacity 0.7; no colour change, no movement.
- **Secondary:** `surface` fill, `border-strong` edge, `text` label. The outlined alternative beside a primary ("Find a shop", "Update").
- **Destructive:** `danger-tint` fill and edge, `danger-text` label. Deletes only, centred at the bottom of a screen.
- **Icon buttons:** 44pt round (56pt beside a large primary), always labelled for the screen reader. `plain` is borderless for headers and row affordances; `outlined` is `surface` with a `border-strong` edge (the garage's add button, the quiet "done" check); `accent` and `inverse` are filled.

### Chips
- **Style:** pill, 44pt tall, 16pt side padding, `surface` fill with a `border-strong` edge, Small label in `text`.
- **State:** selected inverts to an `inverse` fill with an `on-inverse` Small Strong label and a 14pt bold check mark leading the label. Checkbox or radio semantics, set by the group.

### Segmented Control
- **Style:** a Label above a 16pt-radius `surface-raised` track with 4pt padding and 4pt gaps; each segment is a 12pt-radius, 44pt-tall equal-width cell.
- **State:** the selected segment fills `inverse` with an `on-inverse` Small Strong label; unselected segments are transparent with a `text` Small label and dim to 70% when pressed.

### Cards / Containers
- **Corner Style:** 18pt for `padded` and `list` cards; 24pt for `hero` vehicle cards.
- **Background:** `surface` with a 1px `border` edge, children clipped to the radius.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** `padded` is 16pt all round with a 16pt gap between children; `hero` is 20pt; `list` cards have no padding and hold `CardRow`s edge to edge, each row padded 12pt vertically, 16pt left, 12pt right, with a 12pt gap between its parts and a hairline below it except the last.
- **Vehicle card:** nickname at Display with the year, make, model and powertrain in Small `text-secondary` under it; a status pill top-right; a 190pt line silhouette of a car in `text-faint` in the middle (the placeholder until vehicles have photos); an "Odometer" Label over a Numeral bottom-left; a 44pt `inverse` chevron badge bottom-right. Behind it all, the glow (below). The whole card is the tap target; a long press opens edit and delete.
- **Glow:** the one atmospheric device. An `accent` radial wash anchored at the card's bottom edge, 120% wide and 70% tall, peaking at the `glow` opacity (0.22 dark, 0.28 light) and gone by 60% of its radius. The vehicle hero uses the same wash from the top edge in the urgent item's mark colour. Never on list cards or forms.

### Inputs / Fields
- **Style:** a Label in `text-secondary` above a 52pt, 14pt-radius `surface` frame with a 1px `border-strong` edge and 14pt side padding; the text is Input (Barlow Medium 17) in `text`, with placeholders in `text-secondary`. Optional prefix ("$") and suffix ("km") sit inside the frame in `text-secondary`. The `large` size is 60pt tall with Input Large text for the one number a screen is about.
- **Focus:** the border becomes 2px `accent`; the cursor and selection are `accent`. No glow, no fill change.
- **Error / Disabled:** the border becomes 2px `danger` and a Caption in `danger-text` replaces the hint below, announced politely. Hints are Caption in `text-secondary`.

### Status Pill
- **Style:** a pill with 6pt vertical and 10pt horizontal padding, filled with the state's tint, a 7pt dot in the state's mark and a Small Strong label in the state's text shade: "1 overdue", "Due soon", "All clear", "Not logged".

### Navigation
- **Tab bar:** a floating 64pt pill in `nav` with a 1px `border-strong` edge and the tab-bar shadow, centred 12pt above the bottom safe area with 6pt inner padding. Each tab is a 76pt by 52pt pill holding a 22pt symbol over an 11/14 caption. The current tab fills `inverse` with `on-inverse` icon and label; the others are `text-secondary` and dim when pressed. Content scrolls beneath it, which is why the fill is opaque.
- **Headers:** tab screens draw their own uppercase Display title; pushed and modal screens use the native header with a plain icon button on the right.

### Due Status Row
One maintenance item: the icon and text are one tap target that opens the log form for that item, with the action buttons as siblings beside it so each is reachable by a screen reader; its icon (one per item, from the shared `ITEM_ICONS` map) in a 36pt round tile filled with the state's tint and drawn in the state's text shade (a dashed `text-secondary` outline on `surface` when not logged), the item name in Body Strong, the distance or time remaining in Small coloured by the state's text shade (or `text-secondary` when OK), then the single most useful action: a plain info icon button, and either a small cyan "Done today" button, an outlined check (when the screen already has a cyan primary, or the item is in good standing) or, when never logged, a plain chevron.

### Gauge (signature)
The instrument. A 270-degree arc open at the bottom, `surface-raised` track with the filled portion in the state's mark, round caps, 14pt stroke at 270pt. Inside: the item name as a Label in the state's text shade, the hero figure in Numeral Large, and the unit as a Label in `text-secondary`. When nothing is due, the arc is green at the next item's progress, and the dial reads "All clear" over a Headline "Nothing due".

## Do's and Don'ts

### Do:
- **Do** spend the cyan on exactly one control per screen; when a cyan primary is present, demote every other action to outlined or inverse (The One Cyan Rule).
- **Do** render a selected segment, chip or tab as an `inverse` fill with `on-inverse` text (The Inverse Selection Rule).
- **Do** give every status its mark, text shade and tint together with words that say the state (The Mark, Text, Tint Rule).
- **Do** set every number in Barlow Semi Condensed with tabular figures, and keep the most urgent number the largest thing on the screen.
- **Do** build surfaces as `surface` on `background` with a 1px `border` hairline, and separate list rows with a hairline, not whitespace.
- **Do** keep every control a 999pt pill at 44pt or taller, with 52pt for fields and standard buttons and 56pt for the screen's one call to action.
- **Do** read every colour, radius, spacing and font from `src/constants/theme.ts`; add a token when a new role appears.
- **Do** mirror every token in the light scheme and check both appearances; light tints are opaque pastels, not alpha fills.

### Don't:
- **Don't** fill a selected control, a status pill or a tab with the accent.
- **Don't** put a shadow on a card, field, button or chip; the floating tab bar is the only shadow in the system.
- **Don't** show state by colour alone; a bar or dot always has text beside it.
- **Don't** uppercase anything other than Display, Headline and Label.
- **Don't** set `fontWeight` in a style; pick the weight by family name (`Fonts.body`, `Fonts.bodySemiBold`, `Fonts.display`).
- **Don't** hard-code a hex, radius or font name in a screen, and don't make a tab screen scroll content under the floating tab bar without padding its bottom by the tab-bar inset.
- **Don't** use `text-faint` for text; it is a decorative stroke colour only.
