# Duudl app version 0.1

This is a responsive webapp to help a specific group of close friends find dates when they are all available to meet.

## Infrastructure

No work has been done on the app yet, so we're starting from scratch. Read AGENTS.md for the environmental invariants we will build with. Create whatever you need within those constraints.

Domain: duudl.twerkules.com
Server logon: ssh bergenomap (keys are present on development machine)

You may use the ensure_schema() pattern for building the required SQL database schema.

## The app users (keep them in an SQL table)

- Huez-Helge
- Andreas Aubisque
- Deux Alpes-Daniel
- Croix-de-fer-Christer
- Galibier-Geir (that's me by the way; the programmer)

All users log in with the same password, which sets a session cookie. After this login page, they can select *which* user of the above that they will represent. This selection action sets a second session cookie. There is a top-level status bar visible on all pages which says which user you are, with a logout button on the right.

Security for this app is mostly symbolic. Egalitarian rights.

## The term 'Duudl'

A 'Duudl' is a poll to determine which dates the various users are available. App users can create Duudls, or view the status/results from other Duudls.

## App structure

- Login page
    - Has an appropriate description and a password prompt (no username)
    - The text above the password prompt reads "Hva kalles hjelperytter-rollen som Galibier-Geir hadde i 2022 og 2025? Inspirert av Mummitrollet." The password is "wattifnatt", and is tested non-case-sensitively. Leads to the User selection page.

- User selection page
    - This is where the user selects which username to represent
    - Names are represented by large buttons
    - Leads to the Overview page.

- Overview page.
    - Shows the list of historical Duudls, latest-first, in tabular form: Who created it, creation date, title, # responses. Click each to show details.
    - Also has a button to create a new Duudl

- Create Duudl
    - To create the Duudl, the user must select a title and a range of dates that are available for consideration
    - The date picker should be a calendar, showing a month at a time. Present month & year is the default, left & right arrows allows changing the month. A Duudl can span multiple months, so make sure you keep the state in memory when switching months.
    - Dates are selected by simply clicking them, which will light them up. Show a textual summary of which dates are selected below.
    - "Create" button create the Duudl, "Clear" button to reset it.

- Show Duudl
    - This is the page where users will respond to a specific Duudl
    - They will be presented with a table of names (y axis) and dates (x axis), and can make a mark (yes / no / inconvenient) in each cell
    - The row of their own name will be highlighted, and they will only be able to edit their own row. Update on click.
    - Also has a small button to *edit* the Duudl
    - The page must have a *permalink* that always leads to this specific Duudl; it's for sharing with other users
    - A "Copy Duudl URL to clipboard" button, for sharing the permalink
    - If a web visitor accesses a permalink without being logged in or having selected a user (check cookies), the link visitor must be guided through both those steps before being taken directly to the permalink.

- Edit Duudl
    - The user may edit the title or the available dates
    - If the user tries to remove a date which was already selected in the Duudl we are editing, warn them with a modal (OK/cancel) dialog that deleting an existing date will remove all previously recorded answers for that date

