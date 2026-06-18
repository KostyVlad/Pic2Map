---
phase: 01-country-map-photos
plan: 02
type: execute
wave: 2
depends_on:
  - 01-01
files_modified:
  - client/src/components/CountryLayer.jsx
  - client/src/components/WorldMap.jsx
  - client/src/components/PhotoCountBadge.jsx
  - client/src/components/PhotoUploadForm.jsx
  - client/src/components/CountrySidebar.jsx
  - client/src/components/PhotoGallery.jsx
  - client/src/utils/isoCode.js
  - client/src/utils/countryCentroid.js
autonomous: false
requirements:
  - CMAP-02
  - CMAP-04
  - PHOTO-01
  - PHOTO-04

user_setup: []

must_haves:
  truths:
    - "Hovering a country highlights it; moving away restores its prior state without disturbing the selected country (D-02)"
    - "Countries that contain photos are filled blue and show a photo-count pill badge at their centroid (D-03)"
    - "After an upload, the country's has-photos marking and badge update without a page refresh"
    - "Uploading multiple files at once succeeds; per-file failures are reported without failing the whole batch"
    - "Invalid type / oversized / server-error uploads show the exact UI-SPEC error copy"
  artifacts:
    - path: "client/src/components/PhotoCountBadge.jsx"
      provides: "Leaflet DivIcon pill badge showing per-country photo count"
      contains: "DivIcon"
    - path: "client/src/utils/countryCentroid.js"
      provides: "Centroid computation for placing the count badge"
    - path: "client/src/utils/isoCode.js"
      provides: "Client-side ISO extraction matching the server fallback chain"
      contains: "extractIso"
  key_links:
    - from: "client/src/components/CountryLayer.jsx"
      to: "photoCounts map (TanStack Query)"
      via: "styleCountry reads counts to mark has-photos countries"
      pattern: "photoCounts"
    - from: "client/src/components/WorldMap.jsx"
      to: "client/src/components/PhotoCountBadge.jsx"
      via: "badges rendered for countries with count >= 1"
      pattern: "PhotoCountBadge"
    - from: "client/src/components/PhotoUploadForm.jsx"
      to: "upload mutation error/success states"
      via: "render UI-SPEC error + success copy"
      pattern: "Uploading"
---

## Phase Goal

**As a** single local user, **I want to** see at a glance which countries already hold photos and get clear feedback while uploading, **so that** my travel map is readable and uploads feel reliable.

## Acceptance Criteria

- [ ] Hovering any country raises its fill opacity and darkens its border per the UI-SPEC Map layer color table; mouseout restores the correct prior state and never overrides the currently selected country.
- [ ] Countries with >=1 photo are filled accent-blue and display a count pill badge ("12", "99+") at their centroid; zero-photo countries show neither.
- [ ] Uploading a photo updates the source country's fill + badge without a page refresh (GeoJSON re-mount on count change).
- [ ] Selecting multiple files uploads them in one batch; a single bad file is reported individually and does not abort the others.
- [ ] Invalid-type, too-large, and server-failure uploads each render their exact UI-SPEC copy in destructive color; success renders the "{N} photo(s) added to {Country}" message.

<objective>
Refine the Walking Skeleton's map and upload slices to their full UI-SPEC contract: country hover highlight (CMAP-02), has-photos visual marking + count badges driven by the photo-counts aggregation (CMAP-04), and the complete bulk-upload + validation-error UX (PHOTO-01 bulk, PHOTO-04 messaging). This plan does not add new subsystems — it deepens existing slices delivered in Plan 01.

Purpose: Make the country map legible (you can see where you have photos) and make uploads trustworthy (clear bulk + error feedback) per the design contract.
Output: Polished CountryLayer/WorldMap with hover + badges, and a complete PhotoUploadForm with bulk + error/success states.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-country-map-photos/01-UI-SPEC.md
@.planning/phases/01-country-map-photos/01-RESEARCH.md
@.planning/phases/01-country-map-photos/01-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Country hover highlight + has-photos marking + count badges (CMAP-02, CMAP-04)</name>
  <files>client/src/components/CountryLayer.jsx, client/src/components/WorldMap.jsx, client/src/components/PhotoCountBadge.jsx, client/src/utils/isoCode.js, client/src/utils/countryCentroid.js</files>
  <read_first>
    - .planning/phases/01-country-map-photos/01-01-SUMMARY.md — how CountryLayer/WorldMap and the photo-counts query were wired in Plan 01
    - .planning/phases/01-country-map-photos/01-RESEARCH.md — Pattern 1, Pattern 7, Pitfalls 1/3/5
    - .planning/phases/01-country-map-photos/01-UI-SPEC.md — Map layer color table (all five states), Photo count badge spec, Map Interaction Contract (states table)
  </read_first>
  <action>
    `client/src/utils/isoCode.js`: extract the inline client ISO logic from Plan 01 into a shared `extractIso(feature)` that mirrors the server fallback chain (ISO_A2 → ISO_A2_EH → ISO_A3 slice → NAME slug; `-99` treated as absent — CMAP-04 keys must match server countryCodes; Pitfall 1). Update CountryLayer to import it.
    `client/src/utils/countryCentroid.js`: compute a usable centroid for a GeoJSON feature (average of the largest ring's coordinates is sufficient at 110m resolution) for badge placement.
    `client/src/components/CountryLayer.jsx`: implement the full five-state styling from the UI-SPEC Map layer color table — default/no-photos, default/has-photos, hover, selected, selected/no-photos. `styleCountry(feature)` reads the `photoCounts` map to decide has-photos fill (`#3b82f6` @ 0.45) vs no-photos (`#e5e7eb` @ 0.2). `onEachFeature` mouseover applies hover style (fillOpacity 0.65, border `#374151` weight 2) via `layer.setStyle()`; mouseout restores `styleCountry(feature)` UNLESS the layer is the selected one (useRef guard, Pitfall 5). Selected click style: fill 0.75, border `#1d4ed8` weight 3 (CMAP-02). Keep the keyboard tabIndex/Enter behavior from Plan 01.
    `client/src/components/PhotoCountBadge.jsx`: a Leaflet `DivIcon`-based marker (count >= 1 only) rendered at the country centroid — pill shape, `accent-subtle` bg, `accent` border + text, `text-label` semibold, "99+" cap (UI-SPEC Photo count badge). Use the DivIcon's HTML/className with Tailwind classes via the marker's icon.
    `client/src/components/WorldMap.jsx`: continue forcing `<CountryLayer>` re-mount via a `key` derived from the photoCounts map so fills update after uploads (Pitfall 3). For each country with count >= 1, render a `<PhotoCountBadge>` marker; recompute when counts change. Ensure the `useCountryPhotoCounts`/`['photo-counts']` query is invalidated by the upload mutation (wired in Plan 01) so marking + badges refresh without a page refresh (CMAP-04).
  </action>
  <verify>
    <automated>cd client && npx vite build</automated>
    <human-check>`npm run dev` (client+server, MONGODB_URI set): hovering a country highlights it and mouseout restores it; a country with uploads is filled blue with a count pill at its centroid; uploading another photo updates the count badge without refresh; the selected country keeps its selected style while hovering others.</human-check>
  </verify>
  <done>Build passes; hover highlight, has-photos blue fill, and centroid count badges all match the UI-SPEC color table and update reactively after uploads; selected state is never clobbered by hover.</done>
</task>

<task type="auto">
  <name>Task 2: Bulk upload + drag-active + full validation-error/success UX (PHOTO-01 bulk, PHOTO-04)</name>
  <files>client/src/components/PhotoUploadForm.jsx, client/src/components/CountrySidebar.jsx, client/src/components/PhotoGallery.jsx</files>
  <read_first>
    - .planning/phases/01-country-map-photos/01-01-SUMMARY.md — PhotoUploadForm + upload mutation shape from Plan 01
    - .planning/phases/01-country-map-photos/01-UI-SPEC.md — Upload Zone (idle/drag-active states), Upload button spec, Copywriting Contract (all upload messages), Gallery empty state, Photo Gallery Grid
  </read_first>
  <action>
    `client/src/components/PhotoUploadForm.jsx`: complete the upload UX per UI-SPEC.
      - Bulk: accept and submit multiple files in one FormData batch (PHOTO-01 bulk); the mutation already posts an array — ensure the input + handler pass all selected files.
      - Drag-and-drop: dropzone with idle state (dashed `border` 2px, `bg-surface`) and drag-active state (dashed `accent` border, `bg-accent-subtle`, label "Drop to Add"); wire dragenter/dragover/dragleave/drop handlers.
      - Button states: "Add Photos" idle → disabled "Uploading..." during the mutation (UI-SPEC Upload button + Copywriting).
      - Result handling: read the `results` array from `POST /api/photos` (per-file outcomes from Plan 01). On all-success show the inline success message "{N} photo(s) added to {Country Name}" (auto-dismiss ~4s). For per-file failures, map server errors to UI-SPEC copy in `destructive` color: invalid type → "File not accepted. Use JPEG, PNG, WebP, or HEIC."; client-side size precheck (>25 MB) → "File exceeds 25 MB limit. Please reduce the file size."; mutation/network error → "Upload failed. Check your connection and try again." (PHOTO-04 clear rejection messaging).
      - Accepted-formats hint text "JPEG, PNG, WebP, HEIC — up to 25 MB each" (`text-label`, `text-muted`).
      - Keep `aria-label="Upload photos for {country}"` and the 44px touch target.
    `client/src/components/CountrySidebar.jsx`: ensure the success/error message region sits below the upload zone and above the gallery per the panel internal layout; verify mobile (55dvh, scrollable) vs desktop (360px) layout from UI-SPEC and the `truncate` country-name header.
    `client/src/components/PhotoGallery.jsx`: confirm the empty state ("No photos yet" heading + "Click \"Add Photos\" to start your {Country} collection." body) and grid/lightbox match UI-SPEC; adjust only if Plan 01 left placeholders.
  </action>
  <verify>
    <automated>cd client && npx vite build</automated>
    <human-check>`npm run dev`: select 3 valid photos at once → all upload and appear; drag files onto the zone → it highlights and accepts the drop; rename a .txt to .jpg and upload → the invalid-type error copy shows in red and other files still succeed; button shows "Uploading..." during the request; success message appears then auto-dismisses.</human-check>
  </verify>
  <done>Bulk upload works; drag-active state renders; per-file failures show exact UI-SPEC copy without aborting the batch; success + uploading states match the copywriting contract; empty state correct.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Visual + interaction sign-off against UI-SPEC</name>
  <what-built>
    Full country hover highlight, has-photos blue fill + centroid count badges that update after uploads, and the complete bulk-upload UX with drag-active state and all UI-SPEC error/success copy.
  </what-built>
  <how-to-verify>
    1. `npm run dev` (client + server, MONGODB_URI set), open http://localhost:5173.
    2. Hover several countries — each highlights and restores correctly; the selected country keeps its selected style while you hover others.
    3. Upload to two countries — both turn blue with count pills; counts read correctly and "99+" caps if you exceed 99.
    4. Bulk-upload 3+ files at once; drag-drop a file; upload a renamed .txt → red invalid-type message, others still succeed.
    5. Check desktop (panel right, 360px) and a narrow window (panel bottom, ~55dvh) layouts; country name truncates if long.
    6. Confirm colors/typography/spacing match 01-UI-SPEC.md (accent #3b82f6 fills/CTA, text tokens, gallery grid).
  </how-to-verify>
  <resume-signal>Type "approved" to complete Phase 1, or describe visual/interaction issues to fix.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Express API | Client-side upload UX; the authoritative validation still lives in the API (Plan 01) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-CV | Tampering | client-side size precheck | accept | The >25MB client precheck is a UX convenience only; the server multer `limits.fileSize` (Plan 01 T-01-DOS) remains the authoritative control — client checks are never trusted |
| T-02-XSS | Tampering | count badge / country name rendering | mitigate | Country names come from the bundled static GeoJSON (not user input); badge content is numeric only; DivIcon HTML uses fixed markup, no user-supplied strings interpolated |
| T-02-SC | Tampering | npm installs | accept | No new packages introduced in this plan; legitimacy already covered by Plan 01 Task 6 |
</threat_model>

<verification>
- `cd client && npx vite build` succeeds.
- Manual: hover highlight, has-photos marking + badges, reactive update after upload, bulk upload, drag-active, all error/success copy, responsive layout — all match 01-UI-SPEC.md.
</verification>

<success_criteria>
- CMAP-02 (hover/selected highlight) and CMAP-04 (has-photos marking + count badges, updating reactively) are satisfied to the UI-SPEC contract.
- PHOTO-01 bulk upload and PHOTO-04 clear rejection messaging are fully realized in the UI.
- The Phase 1 map is legible and uploads give trustworthy feedback.
</success_criteria>

<output>
Create `.planning/phases/01-country-map-photos/01-02-SUMMARY.md` when done.
</output>
