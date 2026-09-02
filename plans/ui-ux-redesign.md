# DiagramKit UI/UX redesign

Working notes for the visual and interaction overhaul. Part 1 is the direction and what shipped in this pass. Part 2 is the backlog of ideas, roughly ordered by how much they would improve daily use.

## 1. Direction

### Who and where

A single engineer mapping their own systems and knowledge on a spatial canvas. Long, quiet sessions, often late, sometimes on a laptop in daylight. Both themes matter. The interface should recede so the user's node titles are the loudest thing on screen.

Register: product UI. Familiarity is a feature. The bar is "would someone fluent in Linear, Figma, or Craft trust this without pausing at a control?"

### Palette: paper and ink

The existing warm sand hue was the right instinct, but three things made it read muddy:

1. The ochre accent was used as *text* for links, active items, and breadcrumbs. Brown text on cream looks dull.
2. The primary button was filled with the same accent, so "Save" looked like a shipping label.
3. Neutrals were close in lightness with hard 1px borders, so panels felt flat and boxy.

Changes:

- **Neutrals** stay warm (hue 60 to 85) but every neutral is tinted; nothing is pure gray. Dark canvas lifted from L 0.09 to 0.135 so cards can sit *above* it with a real shadow instead of only a border.
- **Borders** are alpha (`oklch(... / 0.085)`) so they read as hairlines on any surface.
- **Accent** is saffron, brighter and cleaner than before (`oklch(0.80 0.12 78)` dark, `oklch(0.58 0.13 62)` light). It is now reserved for state: selection ring, focus ring, active workspace, the board-link chip, the connection line. It is never body text.
- **Ink** is a new role: the text color used as the primary button fill (light text on dark button in light mode, inverted in dark). Classic, quiet, unmistakably the primary action.
- **Field** is a new surface for inputs: near-white in light mode, recessed darker than the panel in dark mode, so inputs read as wells rather than boxes.
- **Edge** color is its own token, separate from text, so connectors can be tuned without touching typography.

Color strategy: Restrained. Tinted neutrals plus one accent under 10% of the surface.

### Typography

- **Instrument Sans** replaces IBM Plex Sans. It is a humanist grotesk with a bit of warmth in the letterforms, which suits the paper palette better than Plex's institutional feel. Variable 400 to 700.
- **Geist Mono** for paths, URLs, code spans, and the zoom readout.
- Base 13px, line height 1.45. Card titles 15px/600 with -0.011em tracking; card body 12px muted. The old 18px/11px ratio was too steep, and 11px body was hard to read.
- Field labels are sentence case 12px medium in `muted`. The uppercase tracked style is kept only for section eyebrows (`PRIMARY ACTION`, `REFERENCES`), so it carries hierarchy instead of being everywhere.
- Font features `ss01` and `cv11` for the single-storey a and cleaner numerals where the font supports them.

### Motion

150 to 220ms, ease-out-quint (`cubic-bezier(0.22, 1, 0.36, 1)`). Panels slide in 16px, menus pop from 0.96 scale. Only transform and opacity are animated. `prefers-reduced-motion` turns it all off, and placement never depends on an animation's end state.

### Radii and elevation

- Controls 6px, panels and cards 10px, menus 10px.
- Cards: hairline border plus a two-layer shadow (1px contact + soft ambient). Hover lifts the shadow; selection swaps the border to accent and adds a 3px soft ring.
- Chrome (toolbar, breadcrumbs, menu button) uses a translucent surface with 10px blur so the canvas grid reads through faintly.

## 2. What shipped

### Tokens and foundations

- `src/index.css`: full token rewrite in OKLCH for both themes, new roles (`--ink`, `--field`, `--overlay`, `--edge`, `--accent-soft`, `--danger-soft`), shadow set, focus-visible style, thin scrollbars, selection color.
- `tailwind.config.cjs`: tokens exposed as utilities, a 7-step type scale, radius scale, shadow set, `ease-out` timing.
- React Flow overrides moved out of `@layer components`. Tailwind tree-shakes layered rules whose selectors never appear in source, which is why the previous handle and control overrides were silently dropped.
- `src/components/ui/icons.tsx`: one 16px stroke icon set (1.5px) replacing the emoji and unicode glyphs (`📂`, `⌨`, `▾`, `×`, `☰`).

### Shared controls (`ui/controls.tsx`)

- `Button` variants: `primary` (ink), `accent`, `secondary`, `ghost`, `danger` (text only, tinted hover), `icon`. Two sizes.
- `TextInput`, `TextArea` forward refs; `Select` has a custom chevron.
- New: `SectionLabel`, `Kbd`, `MenuItem`, `menuClass`.

### Node card

- Title wraps up to three lines instead of truncating to one.
- Handles hidden until hover, selection, or an in-progress connection. Handles were the biggest source of visual noise on a busy board.
- The action button distinguishes a nested board (saffron chip with layers icon) from an external action (outlined arrow).
- Reference links use type icons and read as `muted`, turning `text` on hover with the icon turning accent. Markdown gets proper spacing, code spans, blockquotes, and list markers in `faint`.

### Sidebar

- Workspace management collapsed into a single chip (name + path) that opens a popover with search, the list, and attach. It closes on outside click and Escape. Switching is rare; it should not take a third of the panel.
- "New board" is a `+` next to the Boards heading that reveals an inline input (Enter creates and navigates, Esc cancels).
- Tree rows: 28px, chevron icon buttons that rotate, active row is `elevated` with medium weight, inactive rows are `muted` until hover.
- Footer with board count and the theme toggle.
- Sidebar open state is lifted to `BoardCanvas` so the breadcrumb chip moves aside when the sidebar is open instead of hiding behind it.

### Node editor

- **Autosave.** Edits are written 500ms after the last keystroke, with a quiet "Saving / Saved" status in the header. Pending edits flush on close or when switching nodes. ⌘↵ and Done both close; Esc closes too. The old flow lost work if you clicked another node before pressing Save.
- Sections with eyebrows: Primary action, References, Board.
- References render as a compact list (icon, name, mono target) with a remove button that appears on hover. Adding is a small inline form revealed by `+ Add`, with Cancel.
- The Board section shows a clear "Opens a nested board" row (clickable, navigates) or a "Link to a new board" action with a one-line explanation.
- Delete moved to a footer, text-only in `danger`, away from Save.
- Panel narrowed from 480px to 400px; the extra width was empty.

### Canvas chrome

- `CanvasToolbar` replaces the default React Flow controls and the hover-to-reveal mode toggle: a segmented Edit / Pan control, a divider, then zoom out, a clickable zoom percentage (resets to 100%), zoom in, and fit. Keyboard: `V` edit, `H` pan, `Shift+1` fit.
- Breadcrumb chip is always visible, so the root board shows "Home" instead of nothing.
- Edge context menu uses the shared menu style, clamps to the viewport, closes on Esc, and says "Add arrowhead / Remove arrowhead" instead of "Make connector / Make arrow".
- Create-node popover has a placeholder, `↵ create` / `esc cancel` hints, and stays on screen near edges.
- Empty board state: "This board is empty. Double-click anywhere to add the first node." with the V/H hints.
- Toast ("Path copied to clipboard") for Cursor and path actions, which previously copied silently.
- Minimap nodes use `faint` with a surface stroke; the hide button only appears when hovering the canvas.
- Error states are a small card with a message and (in `App`) a Retry button.

### Bugs fixed along the way

- Theme toggle left the canvas painted in the previous theme. Child effects run before the provider's effect, so `useThemeColors` read stale variables. The attribute is now written synchronously in the setter.
- Backspace/Delete removed nodes and edges from the view but never from the document; they reappeared on reload. `onNodesDelete` / `onEdgesDelete` now persist.
- Edge arrowheads were colored with `--muted` (a text token); they use `--edge` now.

## 3. Ideas not yet built

Ordered by expected impact on daily use. Each is small enough to ship on its own.

### High impact

1. **Undo / redo (⌘Z, ⇧⌘Z).** The board is a single JSON document, so a history stack of documents is cheap. This is the single biggest trust feature missing; autosave makes it more important, not less.
2. **Command palette (⌘K).** Jump to any board or node across the workspace, create a board, toggle theme, switch mode. Fuzzy match on titles. Fits the keyboard-first audience and removes the need to open the sidebar for navigation.
3. **Inline title editing.** Double-click a card title to edit in place; Enter commits, Esc cancels. Most edits are title tweaks and should not open the side panel.
4. **Connected-node creation.** With a node selected, `Tab` creates a child node to the right, already connected, and focuses its title. Drag from a handle into empty canvas should also create a node at the drop point. This turns the canvas into an outliner.
5. **Right-click context menus** on nodes (edit, link to board, duplicate, delete) and on the canvas (add node here, paste, fit view).
6. **Highlight on hover.** Hovering a node brightens its edges and dims unrelated ones slightly (opacity 0.4). Cheap to implement with a CSS class on the flow container and makes dense boards legible.
7. **Board management in the sidebar.** Rename on double-click, delete with a confirm that lists child boards, drag to reparent. Currently boards can only be created.

### Medium impact

8. **Node width persistence** (feedback ticket exists). A drag handle on the right edge writes `width` to the node; the card's `max-w` becomes that value. Show a faint ruler while dragging.
9. **Node kinds.** A small set of restrained presets (service, data store, doc, person, external) that add a 12px glyph before the title and nothing else. No colored backgrounds; the palette should stay paper.
10. **Edge labels.** Short text on an edge, editable from the edge menu. Rendered in a chrome pill at the midpoint.
11. **Auto-layout.** A "Tidy" action (dagre, left-to-right) with a one-click undo. Useful after importing or dumping many nodes.
12. **Multi-select tools.** Rubber-band select already works in React Flow; add align left/center/right, distribute, and group-drag persistence. Show a small floating bar above the selection.
13. **Markdown preview toggle** in the editor with support for `- [ ]` checklists that can be toggled from the card.
14. **Search within the board** (`/`). Matches get a saffron ring; non-matches dim.
15. **Save failure surfacing.** `useBoard` swallows write errors into a state that only shows if the whole board fails to load. Surface write failures as a persistent toast with Retry, and show an "Offline / unsaved" pill in the header.
16. **Sidebar shortcuts and sizing.** `⌘B` or `[` toggles; drag the edge to resize between 240 and 400px; remember width.
17. **Breadcrumb sibling menu.** Clicking the current crumb lists sibling boards; `⌥←` goes up one level.
18. **Link previews.** For URL references, fetch and cache the favicon (server-side, cached in the workspace folder) and show it instead of the globe icon.

### Polish and delight

19. **Serif title variant.** Instrument Serif for card titles as an optional "editorial" typography setting. It pairs by design with Instrument Sans and would give boards a printed-map feel. Kept out of the default because display serifs in product UI are a known reflex.
20. **System theme follow.** Add "System" to the toggle (cycle light / dark / system) and update on `prefers-color-scheme` changes.
21. **Density setting.** Compact (11/13px, 24px rows) for large boards; Comfortable is today's default.
22. **First-run workspace.** When a workspace is created, seed a small sample board that teaches double-click, drag-to-connect, nesting, and references, with a "Delete sample" action.
23. **Export.** PNG or SVG of the current viewport or the whole board; print stylesheet that hides chrome.
24. **Handle affordance.** On node hover, show a faint `+` on the right handle; clicking it creates a connected node (see 4).
25. **Zoom-aware detail.** Below 50% zoom, hide descriptions and references and enlarge titles slightly so the board reads as a map.
26. **Micro-interactions.** Card lift on drag start (shadow deepens, 1.01 scale), edge draw-in when connecting, toast for "Board created".

### Accessibility and hardening

27. **Focus trap** in the editor and popovers; return focus to the invoking element on close.
28. **Roving tabindex** in the board tree with arrow-key navigation and type-ahead.
29. **Touch and trackpad.** Two-finger pan already works; add pinch zoom sensitivity and a long-press equivalent for right-click.
30. **Contrast audit.** `faint` on `canvas` in light mode is around 3:1; acceptable for hints, but anything actionable should be at least `muted`. Worth a pass with an OKLCH contrast checker once the palette settles.
31. **i18n readiness.** Strings are inline. Not urgent for a personal tool, but the editor copy would benefit from a single strings file so tone can be tuned in one place.

## 4. Decisions and trade-offs

- **Autosave over explicit Save.** Whole-board writes are cheap (temp file then rename). Debounce is 500ms. If this ever feels too eager, add a 2s idle threshold for the description field only.
- **Ink primary over accent primary.** The accent is reserved for state, so the eye finds selection and focus instantly. Primary actions are still unmistakable because they are the only filled-dark (or filled-light) element.
- **Hidden handles.** Trade: new users may not discover connection dragging. Mitigated by showing handles on hover and by the empty-state copy. Idea 24 would close the gap fully.
- **Sentence-case labels.** Uppercase micro-labels everywhere read as noise. Eyebrows keep the uppercase style so hierarchy still exists.
- **No new dependencies.** Icons are hand-drawn SVG, animations are CSS, the toast is a hook. Fonts load from Google Fonts as before; self-hosting them would remove the network dependency and the flash of fallback text on first load.
