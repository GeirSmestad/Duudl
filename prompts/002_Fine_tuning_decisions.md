# Decisions made after implementing `001_Duudl_app_version_0_1.md`

### Permalinks + interaction model
- **Permalink format**: Use a short random token permalink: `/d/<token>`.
- **Cell editing UX**: Single-click cycles: blank → yes → no → inconvenient → blank.

### UI/wording tweaks
- **Show Duudl instruction text**: Use “ikke favorittdagen min” wording for the third state (instead of “upraktisk”).
- **Show Duudl nav**: Overview link label changed to “Tilbake til alle Duudlene våre”.
- **Edit button emphasis**: Edit action on “Show Duudl” is intentionally de-emphasized (rare action).
- **Edit button label**: “Rediger denne Duudlen”.
- **Create/Edit placeholders**:
  - Title placeholder: “F. eks: Bytting av kjede”.
  - Description placeholder: “Denne gangen skal vi bytte sykkelkjede!”.

### Visual design choices
- **Background**: Keep the gradient background, but ensure it does not “tile/repeat” with discontinuities on long pages.
- **Grid header**: Sticky header should sit at the top of the scroll container (not float mid-table).
- **Response colors**:
  - Make yes/no/inconvenient colors more saturated.
  - Ensure the colors also show on the “Show Duudl” page (not only Edit).
- **Symbols**:
  - “Inconvenient” symbol should be `( ✓ )` (instead of a triangle).
- **Date picker selection**:
  - Increase contrast/saturation of selected dates when creating a Duudl (subtle, not jarring).
- **Highlight color usage**:
  - Use `rgba(255, 242, 40, 0.7)` for the “inconvenient” cell background.

### Data/UX behavior
- **Create Duudl validation**: If title is missing (or other validation error), preserve the selected dates instead of clearing them.
- **Overview timestamps**: Display only the date portion (no time-of-day) in the Overview “Dato” column.
- **Delete placement**: On Edit Duudl, place the “Slett Duudl” section below the answers grid.

### Deployment & server setup
- **Deploy transport**: Prefer `scp` over `rsync` for portability.
- **Deploy packaging**: Use a tarball upload/extract workflow and handle server write permissions via `sudo` on the server.
- **HTTPS**: Use Let’s Encrypt in `bootstrap.sh` in an isolated way:
  - Do not let certbot rewrite global nginx config or other vhosts.
  - Use webroot HTTP-01 and only manage Duudl’s own vhost config.

### Repository hygiene
- **Ignore local DB**: `data/duudl.db` should be gitignored.
- **Ignore deploy archives**: ignore `duudl-deploy.tgz` / `.duudl-deploy.tgz` (even if the current deploy uses `/tmp`).

