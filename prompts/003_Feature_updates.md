# Additional feature updates

This is a summary of the feature updates prompted in the chat after implementing the 002 Markdown prompt file.

## Response defaults (creator convenience)

- **Default responses only for the creator**: when a Duudl is created, pre-fill *only the creating/selected user’s* responses as **“yes”** for all selected days. All other users remain blank.
- **Same behavior when adding dates later**: when editing an existing Duudl and adding new dates, pre-fill “yes” only for the original creator (or the selected user who is the creator), and only for the *newly added* days.

## Date formatting (Norwegian-friendly, no leading zeros)

- **Grid header on Show/Edit**: show dates as **weekday + day.month** with Norwegian weekday abbreviations (e.g. `Man 3.2`), *no leading zero* for day/month < 10.
- **Overview page creation date**: show as **`D. monthname YYYY`** with Norwegian month name in lowercase (e.g. `3. februar 2026`), *no leading zero*.
- **Detailed per-date UI**: show full weekday names (Mandag, Tirsdag, …) with the same no-leading-zero style.

## Per-date responding with optional comments (+ “+1”)

The intent was to keep the table (“overview grid”) as the main at-a-glance display, while adding a
mobile-friendly, per-date detail editor below it.

- **Per-date editor section**:
  - Add a heading **“Detaljerte valg”** with clear separation/margin above the per-date controls.
  - For each date:
    - A segmented control with **Ja / Nei / Muligens**.
      - “Muligens” is language sugar mapped to the existing **`inconvenient`** value.
      - No explicit “Blank” choice; clicking the currently-selected segment *toggles back to blank*.
    - Allow an **optional comment** per date.
      - Comments are allowed even when the value is blank.
      - Comment saving should be **debounced** (avoid spam), but **must not steal focus** from the input while the user is typing.
    - A “Min +1 kan komme” control should be a **true toggle** with a green “on” state, and hover styling should not visually overwrite the toggled-on state.

- **Table grid content rules**:
  - **No symbols** in grid cells (symbols became confusing once comments exist).
  - If a comment exists for a cell, the grid shows the **comment text** (with the cell’s status background color).
  - If no comment exists, the cell is visually blank (status color may still apply).

## Comment display constraints (don’t let comments break the table)

- **Fixed column widths**: long comments must not expand date column widths; date columns are fixed width.
- **Names and date headers must remain readable**: unlike comments, the name column text and header dates should not be aggressively truncated by “comment rules”.
- **Fixed-ish cell height**: cells should be approximately **3 lines tall**, and not grow unbounded due to long comments; text should be vertically centered. (Exact “3 lines” was guidance, not a hard spec.)
- **Cropping + ellipsis**: overflowed comment text in the grid is cropped with `...`.

## Tooltip behavior (desktop hover + mobile tap)

- **Hover tooltip (desktop)**: when a comment is cropped in the table, hovering the cell shows a floating tooltip with the full comment that follows the cursor.
  - Tooltip should only appear when text is **actually truncated**, not for short fully-visible comments.
  - Tooltip positioning must avoid the right screen edge so it doesn’t collapse into an extremely narrow/tall layout.

- **Tap-to-toggle tooltip (mobile/readability)**:
  - Tapping a **non-own** cell toggles a pinned tooltip showing the full comment.
  - Tapping anywhere else dismisses the pinned tooltip.
  - This is specifically to make “read full comments” possible on mobile where hover isn’t available.

## Sticky table UX on mobile (spreadsheet-like behavior)

- **Sticky header row**: the date header row sticks to the top of the scroll container.
- **Sticky first column**: the name column stays visible when horizontally scrolling on narrow screens.
- **Correct layering/opacity**:
  - When scrolling horizontally, content behind the sticky name column must not “shine through”.
  - The intersection (top-left) sticky header cell must stack correctly above other cells.
- **WebKit/iOS compatibility**: sticky behavior should work in mobile Safari/Chrome, not only desktop.

## Layout constraints & general styling

- **Remove page width cap**: `.page` should not be capped by `max-width: 1100px`.
- **Background gradient**: remain non-repeating (no visible tiling seams on long pages).

## Minor cleanup / UI nits

- **Remove “Svar” pill label** inside `card stack` blocks (the per-date control UI should not render an extra “Svar” pill).

