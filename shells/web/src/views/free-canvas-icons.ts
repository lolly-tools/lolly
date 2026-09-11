// SPDX-License-Identifier: MPL-2.0
// snap threshold in SCREEN px
export const SVG = {
  add: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  // Present - a play triangle (open the frames as a fullscreen deck, plan 112).
  present: '<path d="M8 5v14l11-7z"/>',
  // Code - angle brackets (open the Custom CSS editor, plan 112 M4).
  code: '<polyline points="8 6 3 11 8 16"/><polyline points="16 6 21 11 16 16"/>',
  // Templates - a 2×2 tile grid, echoing the Start chooser's tile layout (plans/142).
  templates:
    '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  // Rows - a ruled sheet (hand this template to /batch, plans/147 M1). The same
  // glyph lib/icons.ts registers as `table`, since it is the same idea in both homes.
  rows: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
  // Notes - a lined note card (open the speaker-notes panel, plan 112 M5).
  notes:
    '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  // Undo/redo - same glyphs as the sidebar header's history buttons (tool.js).
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/>',
  // Z-order family - a filled "object" square + a direction arrow; the front/back
  // pair add an edge bar (the top/bottom of the stack) to read as "all the way".
  // Object below the arrow = moving up (forward/front); above it = moving down.
  front:
    '<rect x="6" y="13" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M3 3h18"/><path d="M12 10V6"/><path d="m8.5 9.5 3.5-3.5 3.5 3.5"/>',
  align:
    '<line x1="3" y1="4" x2="3" y2="20"/><rect x="6" y="7" width="12" height="4" rx="1"/><rect x="6" y="14" width="7" height="4" rx="1"/>',
  // Line tool - a diagonal shaft ending in an arrowhead (draw a line or arrow).
  line: '<path d="M5 19 L19 5"/><path d="M12 5h7v7"/>',
  // Snap-to-grid toggle - a magnet in a box (snapping = magnetic pull to the grid).
  grid: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 15.5V11a3 3 0 0 1 6 0v4.5"/><path d="M7.5 15.5h3"/><path d="M13.5 15.5h3"/>',
  // Auto-arrange the connected cards into a tidy hierarchy.
  tidy: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v3"/><path d="M6 16v-2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2"/>',
  dup: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  // "+Keyframe" - the same diamond lib/icons.ts's `keyframe` draws, because it is the
  // same action wearing the same glyph in its other home (the timeline transport).
  // plans/104 section 8's M2.5 revision: TWO homes, ONE action.
  keyframe: '<path d="M12 3 21 12 12 21 3 12Z"/>',
  // The camera add-kind (plans/104 section 5.4) - the same body-and-lens the icon registry's
  // `camera` draws, so the rail, the timeline menu and the inspector group agree.
  camera:
    '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  size: '<path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/>',
  // Pages/carousel - a centre "page" card flanked by two peeking page edges.
  pages:
    '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 7v10"/><path d="M19.5 7v10"/>',
  // Frame add-kind + the Frames reorder rail button - the Figma artboard "#" (two
  // pairs of ruled lines running past the edges).
  frame: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
  // Drag handle in the Frames reorder list - the classic six-dot grip.
  grip: '<circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none"/>',
  chevUp: '<polyline points="6 15 12 9 18 15"/>',
  chevDown: '<polyline points="6 9 12 15 18 9"/>',
  chevLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevRight: '<polyline points="9 18 15 12 9 6"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  editText: '<path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/>',
  // Pencil - the "edit text" action (replaces the old 'T' glyph on the object bar).
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  // Type glyph - the Text add-kind + the "Aa" text panel.
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  boxKind: '<rect x="3" y="5" width="18" height="14" rx="2.5"/>',
  // Animation (Lottie) add-kind - a play triangle inside a rounded frame, echoing the picker's "▶ LOTTIE" badge.
  anim: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M10 9l5 3-5 3z"/>',
  // Video add-kind - a film clap/frame with a play triangle (a fatter play than `anim`).
  video:
    '<rect x="2" y="5" width="15" height="14" rx="2.5"/><path d="M17 9l5-3v12l-5-3z"/><path d="M7 9.5l4 2.5-4 2.5z"/>',
  // Timeline rail toggle - a plus feeding three forward chevrons: add a moment, then run
  // it forward over time (Andy's chosen metaphor, 2026-08-20). Replaced the staggered clip
  // bars, which read as a comb/toaster at rail size.
  timeline:
    '<path d="M4 9v6"/><path d="M1 12h6"/><path d="M9 6.5l5 5.5-5 5.5"/><path d="M13 6.5l5 5.5-5 5.5"/><path d="M17 6.5l5 5.5-5 5.5"/>',
  // Sequence add-kinds: a clip (film strip), a sound (level bars), a nested Lolly tool (spark).
  clipKind:
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M8 5v14"/><path d="M16 5v14"/>',
  audioKind:
    '<path d="M4 10v4"/><path d="M8 7v10"/><path d="M12 4v16"/><path d="M16 8v8"/><path d="M20 11v2"/>',
  toolKind:
    '<path d="M4 20 14 10"/><path d="m16.5 3.5 1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6L11.5 8.5l3.6-1.4z"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="11" y1="11.5" x2="12" y2="11.5"/><line x1="12" y1="11.5" x2="12" y2="16"/><circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none"/>',
  // Import a design file (Figma SVG / Penpot) - an arrow rising UP out of a tray
  // (upload/import, not download: the arrowhead apexes at the top, not the tray).
  importFile:
    '<path d="M12 3v10"/><polyline points="8 7 12 3 16 7"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  // Primary editor-rail action glyphs (Export / Save / Share; Copy reuses `dup`).
  exportUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 14 8"/>',
  // Generic share glyph (three linked nodes) - the action is broader than a link now:
  // a .lolly file or a private collab, not just a URL.
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  // Shape glyphs for the segmented shape control.
  shRect: '<rect x="4" y="6" width="16" height="12"/>',
  shRounded: '<rect x="4" y="6" width="16" height="12" rx="4.5"/>',
  shPill: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/>',
  shEllipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  shCircle: '<circle cx="12" cy="12" r="8"/>',
  // Image-fit glyphs.
  fitContain:
    '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><rect x="8" y="8.5" width="8" height="7" rx="1"/>',
  fitCover:
    '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M3 16l4.5-3.5L11 15l3-2.2L21 18"/><circle cx="8.5" cy="9" r="1.2"/>',
  fitFill:
    '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><polyline points="8 9 5.5 12 8 15"/><polyline points="16 9 18.5 12 16 15"/>',
  fitPos:
    '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><circle cx="8" cy="8.5" r="1"/><circle cx="12" cy="8.5" r="1"/><circle cx="16" cy="8.5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="15.5" r="1"/><circle cx="12" cy="15.5" r="1"/><circle cx="16" cy="15.5" r="1"/>',
  radius:
    '<path d="M5 19V9a4 4 0 0 1 4-4h10"/><line x1="5" y1="19" x2="5" y2="21"/><line x1="3" y1="19" x2="5" y2="19"/>',
  opacity:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M12 3.5v17"/><path d="M12 5.5h6.5M12 8.5h8M12 11.5h8M12 14.5h8M12 17.5h6.5"/>',
  blend: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6" opacity="0.5"/>',
  shadowIc:
    '<rect x="3.5" y="3.5" width="12" height="12" rx="2.5"/><path d="M8.5 20.5h10a2 2 0 0 0 2-2v-10" opacity="0.45"/>',
  // Position (4-way move) + rotate glyphs for the position & size panel.
  move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 8 16 8"/>',
  forward:
    '<rect x="6" y="13" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M12 10V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/>',
  backward:
    '<rect x="6" y="3" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M12 14v6"/><path d="m8.5 16.5 3.5 3.5 3.5-3.5"/>',
  back: '<rect x="6" y="3" width="12" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M3 21h18"/><path d="M12 14v4"/><path d="m8.5 14.5 3.5 3.5 3.5-3.5"/>',
  alignL:
    '<line x1="4" y1="3.5" x2="4" y2="20.5"/><rect x="7" y="5.5" width="13" height="4.5" rx="1"/><rect x="7" y="14" width="8" height="4.5" rx="1"/>',
  alignC:
    '<line x1="12" y1="3.5" x2="12" y2="20.5"/><rect x="5" y="5.5" width="14" height="4.5" rx="1"/><rect x="8" y="14" width="8" height="4.5" rx="1"/>',
  alignR:
    '<line x1="20" y1="3.5" x2="20" y2="20.5"/><rect x="4" y="5.5" width="13" height="4.5" rx="1"/><rect x="9" y="14" width="8" height="4.5" rx="1"/>',
  alignT:
    '<line x1="3.5" y1="4" x2="20.5" y2="4"/><rect x="5.5" y="7" width="4.5" height="13" rx="1"/><rect x="14" y="7" width="4.5" height="8" rx="1"/>',
  alignM:
    '<line x1="3.5" y1="12" x2="20.5" y2="12"/><rect x="5.5" y="5" width="4.5" height="14" rx="1"/><rect x="14" y="8" width="4.5" height="8" rx="1"/>',
  alignB:
    '<line x1="3.5" y1="20" x2="20.5" y2="20"/><rect x="5.5" y="4" width="4.5" height="13" rx="1"/><rect x="14" y="9" width="4.5" height="8" rx="1"/>',
  distH:
    '<line x1="4" y1="3.5" x2="4" y2="20.5"/><line x1="20" y1="3.5" x2="20" y2="20.5"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distV:
    '<line x1="3.5" y1="4" x2="20.5" y2="4"/><line x1="3.5" y1="20" x2="20.5" y2="20"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  // Flip (mirror) - two arrowheads facing across a dashed mirror axis: one side solid, the
  // other its outline reflection, so the glyph reads as "turn this over about the line". The
  // pair shares one axis line and one triangle, rotated 90deg between them, so they read as a set.
  flipH:
    '<line x1="12" y1="2.5" x2="12" y2="21.5" stroke-dasharray="3 2.5"/><path d="M9.2 5 3.8 12l5.4 7z" fill="currentColor" stroke="none"/><path d="M14.8 5 20.2 12l-5.4 7z"/>',
  flipV:
    '<line x1="2.5" y1="12" x2="21.5" y2="12" stroke-dasharray="3 2.5"/><path d="M5 9.2 12 3.8l7 5.4z" fill="currentColor" stroke="none"/><path d="M5 14.8 12 20.2l7-5.4z"/>',
  group:
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="6.5" y="6.5" width="5" height="5" rx="1"/><rect x="12.5" y="12.5" width="5" height="5" rx="1"/>',
  ungroup:
    '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  clip: '<rect x="3" y="3" width="12" height="12" rx="2"/><circle cx="15.5" cy="15.5" r="5.5"/>',
  unclip: '<rect x="3" y="3" width="9" height="9" rx="2"/><circle cx="16.5" cy="16.5" r="4.5"/>',
  // Boolean family - the Illustrator/Figma pictograms: two overlapping squares, A at
  // (4,4)-(14,14) and B at (10,10)-(20,20), with the SURVIVING region filled and the
  // discarded one left as a faint outline. Same two squares in all four, so the icons
  // read as one set and the difference between them is only ever what's solid.
  boolUnion: '<path d="M4 4h10v6h6v10H10v-6H4z" fill="currentColor" stroke="none"/>',
  boolSubtract:
    '<path d="M4 4h10v6h-4v4H4z" fill="currentColor" stroke="none"/><rect x="10" y="10" width="10" height="10" opacity="0.4"/>',
  boolIntersect:
    '<rect x="4" y="4" width="10" height="10" opacity="0.4"/><rect x="10" y="10" width="10" height="10" opacity="0.4"/><rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none"/>',
  boolExclude:
    '<path d="M4 4h10v6h6v10H10v-6H4zM10 10h4v4h-4z" fill="currentColor" stroke="none" fill-rule="evenodd"/>',
  // Outline stroke - a band between two concentric outlines (the stroke, now a shape).
  outlineStroke:
    '<path d="M3 5h18v14H3zM7 9h10v6H7z" fill="currentColor" stroke="none" fill-rule="evenodd"/>',
  // Offset path - the shape, plus a dashed larger copy of it standing off the edge.
  offsetPath:
    '<rect x="7" y="9" width="10" height="6" rx="1.5"/><rect x="3.5" y="5.5" width="17" height="13" rx="4" stroke-dasharray="3 2.5" opacity="0.75"/>',
  // Simplify - one smooth curve with only its two end nodes left on it.
  simplify:
    '<path d="M4 17c4-11 12-11 16 0"/><circle cx="4" cy="17" r="1.8" fill="currentColor" stroke="none"/><circle cx="20" cy="17" r="1.8" fill="currentColor" stroke="none"/>',
  outlineText:
    '<path d="M5 7V4h14v3M12 4v12"/><path d="M9 20h6"/><rect x="10.2" y="14.2" width="3.6" height="3.6" fill="none"/>',
  // Lift layers (plans/104 section 7) - the three-plate stack, with the top plate standing
  // OFF the other two: the glyph says "one drawing, several plates, one of them
  // raised", which is exactly what the action does. The plates are the same isometric
  // diamond the `group`/`ungroup` pair already uses, so the family reads as one set.
  liftLayers:
    '<path d="m12 2 8 4.5-8 4.5-8-4.5z"/><path d="m4 13 8 4.5 8-4.5"/><path d="m4 17 8 4.5 8-4.5"/>',
  // Choreograph (plans/104 P4) - the lifted stack, now MOVING: three plates stepping up
  // the frame with the arc they travel drawn over them. Deliberately the same rounded
  // plate `boxKind` draws, so "these layers" and "these layers, in motion" read as a pair.
  choreo:
    '<rect x="2.5" y="15" width="6" height="5.5" rx="1.3"/><rect x="9" y="12" width="6" height="5.5" rx="1.3"/><rect x="15.5" y="9" width="6" height="5.5" rx="1.3"/><path d="M3 11c3.5-6 10.5-8.5 17-6.5"/><polyline points="17.6 2.4 20.5 4.6 18.6 7.2"/>',
  // Pointer - the arrow cursor itself, outlined to sit with the rest of the line-art rail.
  // The one glyph in here that names a TOOL by drawing the cursor it gives you.
  pointer: '<path d="M5 2.8l10.9 10.9h-4.8l2.8 6-2.5 1.1-2.8-6L5 18.3z"/>',
  // Pen - the vector PEN TOOL: the wedge nib with its slit, the anchor point it drops,
  // and the blade trailing behind. Deliberately NOT the `pencil` glyph, which already
  // means "edit this box's text" on the object bar. The previous glyph was a fountain
  // pen, which reads as "write/draw freehand" - the one thing this mode does not do;
  // the anchor circle is what says "click to place points" at a glance.
  pen: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  // Edit points - a bezier-pen metaphor: three filled anchor squares on a straight path
  // run, with a curved handle joining two hollow control points below (Andy's chosen
  // metaphor, 2026-08-20).
  nodes:
    '<path d="M4 5h16"/><rect x="2" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none"/><rect x="10" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none"/><rect x="18" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none"/><path d="M5 18C5 11 19 11 19 18"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/>',
  // Continuity - the same node with the same two arms, changing only how they relate:
  // hinged (corner), collinear (smooth), collinear and equal (symmetric).
  contCorner:
    '<path d="M5 19 12 12l7 3"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>',
  contSmooth:
    '<path d="M4 15h8"/><path d="M12 15h8"/><circle cx="12" cy="15" r="2.4" fill="currentColor" stroke="none"/><circle cx="4" cy="15" r="1.4"/><circle cx="20" cy="15" r="1.4"/>',
  contSymmetric:
    '<path d="M6 15h12"/><circle cx="12" cy="15" r="2.4" fill="currentColor" stroke="none"/><circle cx="6" cy="15" r="1.4"/><circle cx="18" cy="15" r="1.4"/><path d="M6 19v2"/><path d="M18 19v2"/><path d="M6 20h12"/>',
  // Leave node-editing (the mode's explicit exit, mirroring how a text edit is committed).
  penDone: '<polyline points="4 13 9 18 20 6"/>',
  // Closed path - a loop whose ends have met, with the join node called out.
  penClose:
    '<path d="M12 5c5 0 7 3 7 7s-2 7-7 7-7-3-7-7 2-7 7-7z"/><circle cx="12" cy="5" r="2.2" fill="currentColor" stroke="none"/>',
  // Stroke - two rules of different weight, which is what the panel behind it sets.
  strokeIc: '<path d="M4 8h16" stroke-width="4.5"/><path d="M4 16h16" stroke-width="1.3"/>',
  // Gradient: a square whose fill ramps, plus the two stop dots the canvas handles are.
  // Drawn with a gradient def rather than hatching so the button reads as what it does
  // even at 16px (the `icon()` wrapper only sets stroke, so the fill is declared here).
  gradIc:
    '<defs><linearGradient id="fcGradIc" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" stop-color="currentColor" stop-opacity="0.85"/>' +
    '<stop offset="1" stop-color="currentColor" stop-opacity="0.08"/></linearGradient></defs>' +
    '<rect x="3.5" y="6" width="17" height="12" rx="2.5" fill="url(#fcGradIc)" stroke-width="1.4"/>' +
    '<circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none"/>' +
    '<circle cx="17" cy="12" r="1.6" fill="none" stroke-width="1.4"/>',
  // Stroke style: one rule, drawn in the style it names. The per-path dash/cap overrides
  // the wrapper's round cap, so each glyph IS a sample of the thing it selects.
  dashSolid: '<path d="M3 12h18" stroke-width="2.6"/>',
  dashDashed: '<path d="M3 12h18" stroke-width="2.6" stroke-dasharray="6 4"/>',
  dashDotted: '<path d="M3.5 12h17" stroke-width="3" stroke-dasharray="0 5"/>',
  // Line ends + corners: a fat stub / elbow drawn WITH the cap or join it selects, so
  // the difference between the three is visible rather than described.
  capButt:
    '<path d="M7 12h10" stroke-width="7" stroke-linecap="butt"/><path d="M7 5.5v13M17 5.5v13" stroke-width="1" opacity="0.5"/>',
  capRound:
    '<path d="M7 12h10" stroke-width="7" stroke-linecap="round"/><path d="M7 5.5v13M17 5.5v13" stroke-width="1" opacity="0.5"/>',
  capSquare:
    '<path d="M7 12h10" stroke-width="7" stroke-linecap="square"/><path d="M7 5.5v13M17 5.5v13" stroke-width="1" opacity="0.5"/>',
  joinMiter:
    '<path d="M6 19V9l7-6" stroke-width="5" stroke-linejoin="miter" stroke-linecap="butt"/>',
  joinRound:
    '<path d="M6 19V9l7-6" stroke-width="5" stroke-linejoin="round" stroke-linecap="butt"/>',
  joinBevel:
    '<path d="M6 19V9l7-6" stroke-width="5" stroke-linejoin="bevel" stroke-linecap="butt"/>',
  // Fill rule - the same two-contour shape, filled by each rule: non-zero fills the
  // inner ring too (same winding), even-odd leaves it as a hole.
  ruleNonzero: '<path d="M4 5h16v14H4zM9 9h6v6H9z" fill="currentColor" stroke="none"/>',
  ruleEvenOdd:
    '<path d="M4 5h16v14H4zM9 9h6v6H9z" fill="currentColor" stroke="none" fill-rule="evenodd"/>',
  // Text alignment (lines of ragged copy) - distinct from the object-align icons.
  textL:
    '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="17" y2="18"/>',
  textC:
    '<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5.5" y1="18" x2="18.5" y2="18"/>',
  textR:
    '<line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="7" y1="18" x2="20" y2="18"/>',
  textT:
    '<line x1="4" y1="4" x2="20" y2="4"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/>',
  textM:
    '<line x1="6" y1="8" x2="18" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/>',
  textB:
    '<line x1="4" y1="20" x2="20" y2="20"/><line x1="6" y1="15" x2="18" y2="15"/><line x1="8" y1="11" x2="16" y2="11"/>',
  // Reset text formatting - a capital T with a diagonal slash through it.
  resetColor:
    '<line x1="6" y1="6" x2="18" y2="6"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="4.5" y1="20" x2="19.5" y2="4"/>',
  // Bulleted list - three dotted rows (a list, not a lone bullet).
  bulletList:
    '<circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>',
  // Scissors - cut the subject out (host.matte "Remove background").
  scissors:
    '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  // A plain tick. Used ONLY as the decorative bullet of the Lift layers plan list,
  // which is why it is aria-hidden there: the list is a preview of what will happen,
  // not a set of controls, so the mark must not be announced as a checked state.
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  // The two rows the Design mark menu grows once the top bar owns the document actions
  // (plans/179 M1). Contrast for Theme, a speaker for Interface sounds: each row is a
  // proxy that clicks the toggle the tool view already built, so the glyph is the only
  // thing this file needs to know about them.
  theme:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
  sound:
    '<path d="M4 9.5h3L11 6v12l-4-3.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.7a7.5 7.5 0 0 1 0 10.6"/>',
};

export function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
