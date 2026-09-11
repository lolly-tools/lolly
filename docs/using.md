# Using Lolly

A practical guide to actually *using* the app - opening a tool, working the canvas, exporting, saving and sharing. Everything here runs **on your device**: no account, no upload, no internet required after the first load.

> New here? The [Quickstart](/info/quickstart.html) gets you making things in minutes, and [Lolly for Operators](/info/operators.html) covers installing/deploying the app; this page is about driving it once it's open.

## Opening a tool

The home screen is the **gallery** - every tool, grouped by category. Click a card to open the tool; if you've worked on it before, a **Continue** button resumes your most recent session. Use the search box to filter by name - or [Search](/info/search.html) from the bar at the foot of the six listing screens (the gallery, Utilities, Projects, the Catalogue, the Dashboard and Profile), which reaches your saved work, the catalogue and your settings as well as the tools. Inside a tool the bar steps aside for the tool's own chrome.

![The tool gallery - every tool as a card, grouped by category](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Each tool is a split view: **controls** on one side, a live **preview** (the canvas) on the other. Change any control and the preview updates instantly.

![A tool's split view - the control stack on the left, and the live grouped bar chart it draws on the right](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> A few tools (like **Design**) instead open as a **free canvas** - a chromeless, direct-manipulation surface where you drag, resize, rotate and snap boxes of text, shapes and images and double-click to edit text in place. It exports through the same render path as every other tool, so the canvas *is* the file. See [The free canvas](#the-free-canvas-design) below.

Two ways to shape the grid itself into the one you want:

- <!--i:star--> **Star what you use.** ★ a card and it gets a big tile of its own in a strip above the grid - see [Your favourites](/info/favourites.html).
- <!--i:eyeoff--> **Hide a tool you never use.** Right-click a card (or select several and use the selection bar) → **Hide tool**. It drops out of the grid, and out of what typing in the grid finds; a grey **Show hidden tools (N)** tile at the very end reveals them again, dimmed, each with **Unhide tool** in its own menu. Hiding is only about your grid - the tool still opens from a saved link or a bookmark, and it stays exactly where it was for everyone else.

![The end of the Tools grid with hidden tools revealed: the dimmed QR Code Generator card, and beside it the grey tile that toggled it back into view, now reading Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

When you'd rather ask than hunt, **Ask Lolly** (`#/ask`) takes a typed question and hands back the matching section of this documentation **verbatim** - the guides' own words, not a summary and not a generation - with the page it came from cited and an **Open in docs** link beside it. Under the answer sit the places in the app the same question matches: a tool, a setting, a saved project, each as a button that simply navigates there.

The transcript is session memory: ask a follow-up and the thread builds up as you go, then reload and it starts fresh. Search results carry an **Ask Lolly: *your query*** row at the bottom - under whatever concrete hits the other groups found - which hands the question straight over, so you can start in the bar and finish here.

## The canvas (preview)

The preview always shows exactly what will export.

**Desktop**

- **Zoom:** Cmd/Ctrl-scroll, or pinch on a trackpad - zoom centres on your pointer.
- **Pan:** hold **Space** and drag, or drag with the **middle mouse button**. (Plain clicks stay free for clicking parts of the design.)
- **Keyboard:** `0` = fit to window · `1` = 100% · `+` / `−` = zoom.
- **Zoom HUD:** the small `−  NN%  +  Fit` control in the corner. Click the percentage to toggle Fit ↔ 100%.

![The zoom HUD in the corner of the canvas - minus, the live percentage, plus, Fit, then the theme and sound toggles](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Touch**

- **Pinch** to zoom, **drag** to pan, **double-tap** to reset to fit.

**Click to jump to a control:** click any element in the design and the matching sidebar input gets focus and scrolls into view - for a repeating row group it folds open the exact row you clicked, so editing what you see is one tap away.

A dimension change always snaps the view back to a clean fit.

### The free canvas (Design)

Free-canvas tools add a working surface *around* the artboard, like a designer's pasteboard:

- **Off-canvas staging.** Drag a box past the frame edge and it stays fully **visible and selectable** - park elements off to the side while you arrange the composition, then drag them back in. Everything outside the frame is **gently faded** so the export area always reads at a glance, and the frame keeps its shadow to mark exactly where the file begins.
- **Only the frame exports.** The exported file is bounded by the artboard - anything left outside (or the part of a box hanging over the edge) is simply cropped out of the output, in raster and vector formats alike.
- **Zoom out past Fit** (down to 20%) to see the whole pasteboard when you've staged things far outside the frame.
- **Resizable artboard.** Changing the export dimensions resizes the frame in place; boxes keep their positions, so you can reframe a layout around existing content.
- **Before you export.** The inspector's Document section checks the saved layer structure, then reads the settled canvas for clipped text and flat-colour contrast. It also asks the same font registry used by SVG/PDF outlining whether each text run has embeddable font bytes; image and gradient backgrounds are named as visual checks instead of being given a made-up contrast score.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Flip a selection.** Right-click any box and choose **Flip horizontal** or **Flip vertical** to mirror it in place, or press `Shift+H` / `Shift+V` from the keyboard - Shift, because a bare `V` is the Pointer tool. Each selected box mirrors on its own axis in one undo step, and the mirror is a real transform, so it holds in the exported SVG, PDF and PNG rather than only on the canvas.

### Drawing your own shapes (the pen)

Boxes, circles and rounded frames cover most layouts. When you need a shape that isn't in that list, draw it: the rail's **Pen** button (or the `P` key) puts you in drawing mode. Three single keys move between the modes - **`V`** back to the Pointer, **`P`** for the Pen, **`N`** for the node tool (**Edit points**) - and the Pointer is always the way out of whatever you're in.

![The free-canvas tool rail: a drag grip, the Lolly menu, then Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards and Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Click** to place a point. On the default curve type, **click and drag** pulls that point's handles out, which is how you draw a curve rather than a corner - hold **Alt** as you click for a hard corner instead. (On the other curve types every placed point is a corner and the drag does nothing; see **Spline type** below.)
- Points snap to the artboard and to your other boxes as you place them, drawing the same guides a normal drag does. Alt suppresses the grid while you draw, and both the grid and the edges while you drag a point afterwards.
- **Click your first point** to close the loop and finish in one move. Otherwise press **Enter**, double-click or just switch tools - the drawing is kept, not thrown away.
- **Escape** works one rung at a time: the first press abandons the drawing and writes nothing, and a second leaves the pen.
- **Delete** while drawing drops the last point you placed.

The result is an ordinary box on the canvas. Move it, resize it, rotate it, group it, align it, restack it, give it a fill, a gradient, a shadow or an opacity - a path behaves like every other box, and none of those controls treat it differently.

It arrives painted, too. The first path you draw takes the fill and stroke your brand gives a path, and after that each new path takes **whatever you last used** - set a fill once and keep drawing, rather than recolouring every shape. (In a tool whose brand says nothing about paths, a drawn path is stroked in the colour you watched it being drawn in, so it's never invisible.)

**Editing the points again.** Double-click the shape (or use **Edit points** on the object bar) and the points come back. Drag a point to move it, drag a handle to re-aim it, click anywhere on the curve to insert a point, rubber-band a group of points and press Delete to remove the selected ones. A path always keeps at least two points, so you can't accidentally delete it out of existence.

**Spline type** decides what kind of curve runs through your points, and it's the choice worth understanding:

| Type | What it does |
|---|---|
| **Smooth (auto)** | The default. Works its own handle lengths out, so plain click-click-click gives a genuinely smooth curve with no handle-wrangling. If you do set a handle, it pins the *direction* and the curve keeps ownership of the length. |
| **Bezier handles** | The classic pen. Handles are the control points, and inserting a point never moves the curve. |
| **Through the points** | Passes exactly through every point you placed, no handles. |
| **B-spline** | Flows near the points rather than through them, for a softer shape. |
| **Straight lines** | A polyline. |

Switching an existing path to a type that works out its own handles asks first, because the handle lengths you set can't be recovered - switching to **Bezier handles** is always lossless. Mid-drawing there's no prompt: the switch applies straight to the draft, and any handles you'd already pulled go with it. On the types that own their handles, inserting a point reshapes the curve very slightly; on **Bezier handles** it doesn't.

Each point also carries a continuity rule, shown by its shape on canvas - square for **Corner** (handles move independently), round for **Smooth** (handles stay in line), round-with-a-ring for **Symmetric** (in line and equal length). Set it for any selected points and the curve re-satisfies it immediately.

![Two pen paths rendered straight from a link: a stroked S-curve and a closed filled blob](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

A drawn path travels in the link like everything else, so a shape you draw reopens from a share link and renders identically from the CLI. Nothing about it depends on the editor.

### Combining shapes (path operations)

Select two or more shapes, **right-click** the canvas (two-finger tap on touch) and the menu offers the operations you'd expect from a drawing app:

- **Union** merges them into one shape, keeping the topmost one's paint.
- **Subtract** cuts everything above away from the bottom shape.
- **Intersect** keeps only the overlap.
- **Exclude** keeps everything except the overlap.

Three more work on a single shape: **Outline stroke…** turns a stroke into a filled shape of the same outline (useful when you want to keep a weight exactly as drawn), **Offset path…** grows the silhouette outwards or, with a negative number, shrinks it inwards and **Simplify** rebuilds a path with fewer segments at the same shape.

![A crescent and a ring with a real hole, both produced by Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

The result is a new path you can keep editing with the pen. Holes are real holes - a **Fill rule** control on the stroke panel decides whether overlapping contours fill (*non-zero*) or punch through (*even-odd*).

Two things these operations deliberately don't do. They **refuse rather than destroy**: ask to intersect two shapes that don't overlap and you're told there's nothing to keep, and nothing changes. And text and image boxes have no outline to work with, so they're left alone rather than approximated by their frame. A combined result is stored as plain Bezier curves, which is what a drawing app does too - the original spline type doesn't survive the operation.

## Timeline (Sequence)

**Sequence** is Design's timeline: it adds *time* to the free canvas. Every box can start at a moment, run for a length and animate in and out, and a timeline docked under the artboard is where you arrange them. Open it and there's already a sequence playing - a title card, a clip, an end card, a lower-third and a music bed - so the model is visible before you change anything.

![The Sequence timeline: the transport, the ruler, an overlay lane, the magnetic sequence row with its clips and seam chips and the Always on strip](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

There are two kinds of row, and the difference is the whole idea:

- The **sequence row** is *magnetic*. Clips sit gapless, one after another, and dragging one reorders the run rather than leaving a hole. Delete a clip and the rest close up. This is your spine.
- **Overlay lanes** are free. A lower-third, a logo, a caption - anything that floats over the spine at its own time - gets its own lane and its own start.
- Below those, **Always on** collects the boxes with no timing at all: scenery that's simply present the whole way through. The `+` on a chip promotes one onto a lane; **Make always on** sends it back.

![The editing stage: the artboard front and centre, the tool rail on the left and the zoom HUD in the corner](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Opening the timeline gives it the keyboard, so Space and the arrow keys drive the playhead rather than the page - and because it opens by itself on a composition that already has timing, that's true the moment Sequence loads.

> **[The sequence editor](/info/sequence-editor.html)** goes deeper on the four things that decide whether editing in time feels predictable: which clip a canvas click edits, onion-skin ghosts of the neighbouring clips, split scope and the Join that undoes a cut and trimming (including the keyboard set). Press `?` with the timeline focused for the shortcut sheet.

**Editing.** Drag a clip's middle to move or reorder it, drag within a few pixels of either end to trim it and press **Split at playhead** (or `S`) to cut one clip into two. Split needs a clip with a real **Length** and the playhead a little way inside it, so an open-ended clip (the music bed, for one) can't be split. **Snap to edges** is on by default and snaps to clip edges, the playhead and whole seconds, with Alt to override. Every drag is a single undo step, and the drag preview runs the same arithmetic as the commit, so what you see while dragging is what you get.

Select a clip and the inspector gives you the same edits as numbers: **Length**, **Trim in** (how far into the source it starts), **Speed** as a set of fixed multipliers from ×0.25 to ×4, **Animate in** / **Animate out** with their lengths and **Mute clip**. A clip on the magnetic row has no **Start** field on purpose - the row owns the order, so you drag to move it.

**Transitions** are presets, not keyframes: Fade, Pop, Grow, Rise, Drop, the four Slides, Zoom in and out, Tilt, Swoop, Spin, Drift or **Cut (no animation)**. Distances scale with the object, so the same preset reads correctly on a full-frame card and a small badge. Between two adjacent clips on the sequence row there's a **seam chip**: click it and choose **Cut** or **Crossfade**, which applies at once and closes. Open the same chip again to change the **Length (ms)** and press **Done**. A crossfade is stored as a fade out of one and a fade into the next, and the export derives the actual dissolve from that pair - which is why a crossfade looks like two fades in the preview and a true handover in the file.

**Sound.** Add an **Audio** clip and it lives on the timeline like any other clip: waveform, trim, mute. (The generated bed the default session ships with is the one exception - it's synthesised at export time, so its bar stays plain and silent until you render.) Press the mic to **record a voiceover** straight onto the timeline, with a count-in and a level meter, and the take is saved as your own asset at the point you started. Press the camera beside it to **record a video** the same way: the take is cropped to the artboard's export size as it records, so the small self-view shows exactly what goes onto the sequence at the playhead, full frame - the way to gather a colleague's clip from a shared link. Music, dialogue and a clip's own soundtrack all reach the exported mix. (The export panel's **Audio track** is a different thing: one bed laid under the whole clip, with fade and ducking. The two coexist.)

**The audio strip.** Select any clip that carries sound and a compact strip opens under the timeline: a **Volume** fader, **Pan** for stereo position, a three-band **EQ** (**Low**, **Mid**, **High**), a **Pitch** control that transposes in semitones while the voice keeps its character, and **Normalize volume**, which brings the clip to broadcast loudness (BS.1770) so a quiet voice note and a loud track sit level. Where two clips meet, **Crossfade** blends the junction instead of cutting. An **Effect** slot runs on-device processing on the clip - **Voice cleanup** takes the room and the hiss out of a recording. Speed changes keep pitch too: a clip slowed or hurried is time-stretched, not chipmunked. At every mix the export ducks music under speech as the speech comes and goes and holds the whole programme under a true-peak limiter, so nothing clips on the way out; a waveform that would have clipped is drawn with a warning where it happens.

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Rendering it.** A motion export is a **deterministic composite**, not a screen recording - each frame is decoded, drawn and encoded at an exact time, so the file doesn't depend on your machine keeping up, and there's no practical frame ceiling on MP4 or WebM. The timeline's own length sets the duration unless you type one. Content Credentials are stamped as on any other export. A still export gives you the frame at the playhead, or a whole contact sheet from the **Frames** field beside the output size - see [Exporting](/info/exporting.html#stills-from-a-timed-composition).

A few limits to keep in mind: a sequence is capped at one hour, GIF and animated PNG buffer their frames so they stay short, a clip played faster or slower keeps its pitch (the audio strip time-stretches it, and a **Pitch** control transposes in semitones with the voice's character kept) and **Record live** is hidden here because the compositor is the better path.

**Beyond presets: keyframes, depth and a camera.** A transition animates a clip as it arrives and leaves. To pose a box *within* a clip - drift it, fade it, blur it, lift it off the page and settle it back - add keyframes: select the clip, press **+Keyframe** (the diamond in the timeline's tool cluster, the diamond on the canvas object bar or `K`) and the playhead's position decides which pose your next edit writes. The same keyframe system gives every timed composition a **camera** that pushes in, pans across and pulls focus and turns one flat SVG into a stack of layers you can fly between. **[Animating](/info/animating.html)** is the full guide.

The Design tool has the same timeline, so you can time a layout without moving to another tool, and it exports motion too.

## Presenting

A Design document made of **artboards** is already a deck. Open the **Lolly menu** on the tool rail and choose **Present** - the last row - and each artboard becomes a full-screen slide, in the order the artboards sit on the canvas. The deck runs on a copy of the rendered artboards, so the editor underneath is never touched and leaving puts you back exactly where you were.

- **Advance** with **Space**, `→`, **Page Down** or a click on the strip at the right edge of the screen; go back with `←`, **Page Up** or the strip at the left edge. **Home** and **End** jump to the first and last slide. A small bar of controls fades in whenever you move the pointer and hides itself again once you stop.
- **Overview** (`O` or the grid button) lays every artboard out at once in the arrangement you gave them on the canvas; click one to open it.
- **Reveal steps.** Right-click a box and choose **Reveal at step 1**, **2** or **3** instead of the default **Always visible**. That box then waits until you advance onto its step, so a slide can arrive in pieces; boxes sharing a number arrive together.
- **Speaker view** (`S`) opens a second window with the current slide, the one coming next, your notes for that slide and a running clock. If the browser blocks the pop-up it falls back to a panel over the deck. Notes are set per artboard and never appear on the slide itself.
- `B` holds a black screen (any key brings the slide back), `F` returns to fullscreen and **Escape** peels one layer at a time: overview back to the deck, deck back to the editor.
- **Kiosk.** Give an artboard a **Length** and the deck holds there for that long, then advances itself behind a thin progress bar; `K` (or the pause button, which appears only once something has a length) stops and restarts that. Add `kiosk` to the link and the deck wraps at the end, which is what makes it signage.

- **Sub-slide stacks.** Right-click an artboard and choose **Stack under the previous slide** and it becomes a step of that slide rather than a slide of its own: the overview shows one card, the deck walks through the stack in order, and the inspector's **Stack** row says which slide it belongs to.
- **Morph.** When two consecutive slides both carry a box with the same **Morph match** name (right-click a box, or the inspector's **Morph match** row - `hero`, say), the transition moves that box from where it was to where it is, resizing and recolouring on the way, instead of cutting. A deck-wide **Morph** transition does the same for every matched pair.
- **Narration.** Each artboard's **Speaker notes** can be read aloud. In the inspector's **Document** section pick a **Voice**, optionally a second voice to **Blend with**, the reading **Speed**, and a **Lead-in** and **Tail** in milliseconds around each slide; turn on **Show captions when presenting** and the words appear as they are spoken. The voice runs on your device. The same notes become the film in a video export, real slide audio in a PowerPoint export, and the narrated film inside a [SCORM package](/info/create/exporting.html#scorm-course-packages).

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

The deck is a link as well. `?present` opens straight into it, `s=` names the slide - a position, an artboard id or `id.step` for a build step - and the address updates as you move, so what you send is the slide you're on. Tool authors: those parameters are documented on the [URL Mode](/info/url-mode.html#reserved-parameters) page.

## On a phone

On narrow screens the layout reflows to one column:

- The **controls become a sheet** at the top with a **drag grip** on its lower edge. Drag the grip to resize it - it snaps to **peek / half / full** - or **tap** the grip to toggle collapsed ↔ expanded. The preview fills the space below and stays visible while you edit.
- A floating **Export** button opens the export sheet - all the format, size, copy, save and download controls in one place. Dismiss it by tapping the backdrop.

![A tool on a phone-width screen - controls as a sheet up top, the generated palette filling the preview below and the render pill floating bottom-centre](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Controls (inputs)

Tools expose only the inputs that are meant to vary - everything else (colours, layout, typography, logic) is locked in by the tool author, so whatever you make meets the rules the author set. Inputs include text, sliders, colour pickers, dropdowns, dates, image pickers and repeating row groups. Some are grouped under collapsible sections.

![A tool's control stack - a text field, colour triggers and a slider and nothing else the author chose to lock down](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** *Clear changes* returns every input to its defaults.

### Undo and redo

**Cmd/Ctrl-Z** steps back and **Cmd/Ctrl-Shift-Z** (or **Cmd/Ctrl-Y**) steps forward again. The same pair sits as **Undo** and **Redo** buttons in the row above the controls - on the free canvas they're on the tool rail instead - and each greys out while there's nothing left to take back. Every step says what it was: undo a colour and a small message names the input it just restored, with a **Redo** button in it for the way back.

- **A drag is one step.** Repeated changes to the same control within half a second merge together, so pulling a slider across its range is a single undo rather than two hundred.
- **The last 100 steps are kept** - older ones drop off the end. Making a fresh edit after undoing clears the forward stack, as it does everywhere else.
- **While your caret is in a text box**, Cmd/Ctrl-Z belongs to the field itself, character by character. Lolly takes over for the controls with no useful undo of their own: sliders, dropdowns, colours and switches.
- **Choosing a file** in a **file** input isn't a step - those bytes are held for the session only, so there would be nothing to put back.

In a live [collaboration](/info/collaborate.html) the history stays yours alone. A change arriving from the other device never goes onto your stack, so undo can only ever take back something you did.

## Your details & headshot

**Profile** (top-right of the gallery) holds your name, contact details and an optional **headshot**. Tools that ask for those fields pre-fill them automatically - set them once and your email signature, lockups and badges fill themselves in. You can still override any field per session. Opt in with **Use my details to create** so your details ride along as the author on what you export.

Your headshot and details live **only on this device**. A profile can be more than just you - a team or a role you step into now and then. See **[Profiles](/info/profile.html)** for the full picture, including keeping more than one.

## Saving & continuing

Click **Save** to store the current inputs as a session for that tool. You can keep multiple named sessions per tool; each tool's **Continue** button reopens your most recent, and the **history button** (top-right, beside your profile) lists every saved session across all tools. Sessions are device-local. To organise them, open **Projects** (below).

![The two-half render pill - an up arrow that opens the export panel, and a tick that saves the session in place](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects** - open it from the **Projects** tab beside **Tools**, or from **Profile → Storage → Organise in Projects** - is a home for everything you've saved, and it works like a file manager:

![Projects - saved sessions organised into nestable folders](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Folders that nest.** Group saved sessions into folders, and folders inside folders, as deep as you like. Create a folder, rename it or drag a tile onto another folder to move it; a breadcrumb walks you back up. An always-present **Uncategorised** folder holds anything not yet filed.
- <!--i:clock--> **Sort your own way.** **View & sort** offers **Name**, **Date added**, **Last modified** (the default) and, inside a folder, **By tool**. Folders always come first regardless of which sort is active - the sort only orders the sessions and folders within their own group.
- <!--i:document--> **File new work straight in.** **New asset** ("Start a fresh creation" at the root, "Add to *folder*" inside one) opens a tool and files its first save into that folder automatically.
- <!--i:checklist--> **Multi-select (desktop).** Tick a tile's checkbox, drag a selection box across empty space or **Shift/Cmd-click**; **right-click** a tile for its context menu. Then act on the whole selection at once - the same gesture and the same floating action bar work on the Tools gallery, Utilities, the Catalogue and Projects, not just here.
- <!--i:download--> **Render a whole folder or selection.** **Render folder** exports every saved session in a folder - including its sub-folders - as one nested `.zip`. **Render selection** does the same for any multi-selection, and a single session renders straight to its own file. No Batch/Pro needed.
- <!--i:link--> **Jump straight to a tool's saved work.** Tick one or more tools on the Tools gallery and choose **View sessions** from the selection bar - Projects opens showing only the sessions made with those tools, with a **Clear** to get back to the full view.
- <!--i:link--> **Share a saved session.** Right-click a session → **Share link** to copy a link that reopens it with the exact same inputs (the full Share dialog - see below).

![The View and sort popover in Projects open, with a theme row, a View choice of Preview or List and Name, Date added and Last modified under Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**What the selection bar offers** differs a little by view, since not every action makes sense everywhere:

- **Tools / Utilities:** Favourite (or Unfavourite), Hide (or Unhide), Available offline (or Remove from offline), **View sessions** (the jump described above) and Copy link when exactly one card is selected.
- **Catalogue:** Favourite and Hide apply to any selection; Duplicate, Download and Delete only appear once every selected item is one of your own uploads - a shared design-system asset is a permanent contract, so those three stay off it even in bulk.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together** when the selection is between two and eight single-tool sessions (it opens them side by side under one combined sidebar) and **Edit as sheet**, which opens the whole selection as rows in the batch grid instead. That one has **no size limit** and doesn't care whether the sessions came from the same tool, so it's the escape hatch when a selection is bigger or more mixed than Edit together's two-to-eight.

> One label trap: **View sessions** only exists once something is *selected*. Right-clicking a single unselected card instead offers **N saved sessions**, which opens that tool's own history dialog rather than navigating to Projects.

![Two tool cards ticked in the Tools gallery, with the floating selection bar reading 2 selected and offering Available offline, View sessions, Favourite and Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Sharing your work

A design goes out one of two ways: as a link or as a file. The Share dialog offers both. Open it with **Share** in the export controls; **Share link** on a saved session in Projects opens the same dialog for that session.

### The link

Every input is captured in the page URL, so a link *is* the design. At the top of the dialog sits the ready-to-copy link, with two collapsed sections under it.

- **Link options** holds **Open in the installed app** (switches the field to a `lolly://` URI for Shortcuts, launchers and automation, with every parameter unchanged), **Shortest link** (a big design makes a long URL, so this packs the whole state into a compact token and shows you the saving in characters; the readable form is always there too), **Password-protect this link** (AES-256 over the whole link, the password never in it) and **Pin this tool version** - the `_v` flag, which nails the link to the tool version you're looking at so a later update can't change what it renders.
- **Link behaviour** is what happens when the recipient opens it: fullscreen, the export panel already expanded, download-on-open with `&export` or copy-to-clipboard with `&copy`.

Paste the link to a colleague, bookmark it or commit it. (Full details: [URL Mode](/info/url-mode.html).)

**Some tools make the link the whole product.** Jump Page gathers your links into one page to hand out - a bio link, a conference talk, a shop front. There is nothing to host and no account behind it: the page is the link, so it opens as fast as the URL travels. In the editor you see the finished page beside the fields; a visitor who opens the link gets it full width, one link per scene as they scroll.

![Jump Page in the editor - the heading, three link scenes each with its own wash and a Made with Lolly footer, laid out as one page in the canvas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**The dialog says what a link cannot carry.** Three things don't fit in a URL: an image or file you added from this device, a very long text value or a very large list. Each one is counted as the link is built. If anything had to be dropped the dialog names it and points you at the file below, instead of handing you a link that opens with the picture missing. A link that is merely *long* gets a milder note with its character count, since packing can still rescue length.

### The .lolly file

`.lolly` is Lolly's portable-bundle extension, not a promise that every file contains the same thing. The `format` in `manifest.json` is the authority. The app reads that tiny manifest first and shows the size, contents and action before it writes anything:

- A **shared design** (`lolly-share`) contains one saved tool session, its embedded files and a receipt for anything that still resolves by reference. It may also carry the tool and the design system used to make it. Opening adds a new Project; it never overwrites an existing session.
- A **design-system pack** (`lolly-brand`) contains tokens and may contain fonts, logos, published versions and retained resources. Opening adds it as a separate named design system, then switches to it; systems already on the device remain.
- A **brand workspace / instance pack** is a `lolly-brand` with declared tools, catalogue assets and optionally an instance address. The preflight names those device-wide effects because loading it replaces the single previously loaded workspace overlay.

A full **device/profile backup is not a `.lolly`**. It remains a `LollyTools-….zip` with format `lolly-backup`, and restores only through **Profile → Storage**. A plain zipped tool folder also remains `.zip`. In other words, session and design-system bundles own `.lolly`; backup and loose archive workflows do not.

**Download .lolly**, in the Share dialog of the tool you're working in, writes the current design as a shared-design bundle. It carries the saved session together with the images and files available on this device. Ordinary catalogue art rides along too. Licensed art is held back unless you explicitly include it, and a stale or unavailable file remains an external reference rather than disappearing. The prepared receipt shows the actual `.lolly` size, embedded-file count, external-reference count and whether the tool is included. Where your device has a share sheet, **Send to…** hands that file straight to it (AirDrop, an Android share) rather than saving it to disk.

A `.lolly` is an ordinary zip. Rename it `.zip` and open it: your own images are under `assets/uploads/` and catalogue art under `assets/catalog/`, each with its real name and extension, `manifest.json` lists every one and a README at the top says what the file is.

Three things are yours to decide before it goes:

- **Whether your name goes in.** Your name, email and organisation are written into the file only when **Use my details to create** is on in your profile. With it off, the file records that it was made with Lolly and when - nothing about you.
- **Whether licensed art goes in.** Licensed and brand-locked assets are held back by default. If the design uses any, the dialog says how many and offers two buttons - *Download without them* or *Include and download* - because including them hands the actual files to whoever opens the `.lolly`.
- **Whether the tool goes in.** **Include the tool** packs the tool's own files alongside the design, so it opens on a device that doesn't have that tool. It arrives ticked for a custom tool - a fork or a private brand tool your recipient is unlikely to have - and unticked for a tool the signed catalogue lists, since their copy comes from the same source. (On a build with no signed catalogue, every tool counts as custom and the box starts ticked.)

**Opening one.** On an installed desktop or mobile app, double-click or tap a `.lolly`, choose **Open with Lolly**, or send it to Lolly from the system share sheet. macOS, Windows, Linux, iOS and Android all register the format; desktop file managers show it as a Lolly document (and GNOME Files can show a saved session's own thumbnail). In the web app, use **Open** or drop the file onto Lolly. Every door uses the same manifest-first preflight. Opening from Brand Studio recommends the design-system action when a shared design carries one, but it never re-labels the file or hides **Open shared design**.

An iOS or Android document handed in from another app is capped at 48 MB because the native hand-off has to copy its bytes across the app boundary. The mobile app says so instead of silently ignoring an oversized file. **Open** inside Lolly does not use that hand-off; it is the route to try for a larger bundle.

After confirmation the selected reader inflates and verifies the bundle once. A shared design's assets go to your library, its session goes to Projects and its tool opens when available. An asset already on the device is matched by checksum and reused. A design-system pack is stored in its own namespace before the app switches to it. Files over 100 MB are called out as large, and the preflight warns when browser storage reports less free space than the declared payload needs. Every integrity-covered part is checked before the operation commits; a damaged copy is refused and the newly-created destination is rolled back.

If the file carries a tool you don't have, Lolly asks before that tool can run: **Trust this tool?** names it and its author and says plainly that opening it runs the tool's own code on your device, with **Trust & install** as the way through. Decline and the shared work is still saved to your projects, waiting there for the day you add the tool. (One kind of tool can't be sideloaded yet - one whose code ships as a module - and it's turned away the same way.)

A link and a file both hand over a snapshot. To work on the same session *at the same time* as someone else - two devices, no server, no internet needed if you're on one network - see [Working together](/info/collaborate.html).

## Live camera (motion-reactive tools)

Every photo **Filter** - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch and Imperfections - shows a **Go live** button where a camera is available. Turn it on and the effect tracks your webcam frame by frame, so it reacts to movement; you can record the result to GIF, WebM or MP4. Frames are read and processed **on your device** and never leave it, and the camera is released the moment you stop or leave the tool. (Any image picker also has **Take a photo** to grab a single frame as an on-device image.)

## My images

When a tool lets you add an image from your device, it's kept exactly as it arrived - so a Content Credential on it still verifies - and saved to your personal **My images** library (under **Profile → Storage**). Only a genuinely huge file asks whether to keep or resize it. Reuse it across any tool. To scrub EXIF/GPS as images come in, turn on **Strip metadata from uploads** in your profile. There's no cap: the library is entirely local and limited only by your device's storage - manage or delete images there.

## The Catalogue - your asset library

The **Catalogue** (`#/c`, or the **Catalog** segment of the Projects · Tools · Utilities · Catalog switch at the top of every listing view) gathers everything your tools can draw on - brand logos, images, audio and motion, grouped by kind - and it's where your **own creative files** live too. No server, no admin console, no pull request: it's all on your device.

![The Catalogue - brand assets, swatches and fonts, plus your own uploads](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Bring your files in.** Drag any image, SVG, audio clip, video, Lottie, PDF or PowerPoint deck onto the upload area - or click to choose - and it arrives in your catalogue instantly, ready in every tool's asset picker. A multi-page PDF or a `.pptx` asks which pages or slides to keep - each becomes an SVG asset. Ingest as much as you like; it never leaves your device.
- <!--i:star--> **Favourite what you reach for.** ★ an asset (or a brand swatch) and it pins to the top of every picker, so your go-to logo or colour is one click away.
- <!--i:folder--> **Tidy up.** Recategorise an asset into a different group, hide a shared brand asset you don't use (with **Show hidden** to bring it back) or delete your own uploads outright. The same multi-select gesture and floating action bar as Projects work here too, so any of that can be done to a whole selection at once.
- <!--i:layers--> **Lift a video off its background.** Open a video's detail or right-click its card in any asset picker and choose **Remove background…** to save a transparent alternative - an animated WebP or PNG with real alpha. Pick a **Method**: an **On-device model** cuts a subject out of a busy scene, or a **Colour key** keys out an evenly lit, flat backdrop like a green screen or a plain wall, with **Tolerance**, **Softness** and **Spill removal** to tune the edge. The colour key needs no model download and no network, so **Remove background** is offered on any video and is often cleaner on tidy footage. A **Resolution** control (360, 480, 720 or 1080p, never past the source) trades detail for a smaller, faster file. It runs as a background job on your device. The finished cut-out is saved beside the original as its own asset and the source video's Content Credential rides along as an ingredient. (See [Generated once, rendered the same](/info/ai-features.html) for why removing a background stays a plain edit.)

### Take your palette and fonts anywhere

The Catalogue's **Swatches** panel does more than display - click a colour to copy it, or **download the whole brand palette** in the format your other tool speaks:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** or **CSS classes** - drop the brand straight into a stylesheet or a build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - load it into Illustrator or Photoshop;
- <!--i:pentool--> **GIMP palette (.gpl)** - for GIMP or Inkscape.

![The Swatches panel - the five palette download buttons across the top, then every brand colour as a copyable chip](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

The **Fonts** panel lists your brand faces with a **download** beside each, to install locally or hand to a print shop. (The [Brand Studio](/info/brand-studio.html)'s Colours room offers the same palette download.)

Assets are one half of the open, do-it-yourself path; the other is **making your own tools** - the free canvas (Design, described above) lets you build one visually, no code required.

## Sound & accessibility

Lolly aims to be comfortable to use for everyone. The interface is keyboard-navigable, custom controls carry proper labels for screen readers and every tool's live preview is exposed as a single labelled image describing what it's making.

A gentle layer of **assistive sounds** confirms what you do - arriving in the gallery, a valid vs. invalid Content Credentials check, closing a panel, switching a filter. It's **off by default**: turn **Sound** on anywhere the switch appears (each view's options popover, or **Profile**), and the choice is remembered.

Four opt-in comfort settings live under **Profile → Accessibility**: **Reduce motion** (drops the app's transitions and flourishes), **Hide colourful previews** (calm icon-and-text gallery cards, and quieter project thumbnails), **High contrast** (stronger borders, text and focus rings) and **Large text** (bigger app type - labels, menus, button text). All four settle the app *around* your work: they never reach inside a tool canvas or change a pixel of what you export, and each is off until you turn it on. Full detail in [Your profile → Accessibility](/info/profile.html#accessibility).

Beside the Sound switch is **Neurospicy Mode** - an optional, calming background focus track that plays quietly while you work. Turning it on opens a small **player dock** in the bottom corner that follows you across the app; from it you can search and pick a track, skip forward and back, set the volume and minimise or close it. The track list spans a few categories - procedural *Lolly Sings* tunes, ambient loops and beats, your own uploaded audio and a handful of live internet **radio** stations (these need a connection; everything else plays offline). It's **off by default** and, like Sound, is remembered across sessions and devices. Turning Sound off mutes the focus track too.

## Storage & privacy

Everything is stored in your browser's local database (IndexedDB): your profile, saved sessions, uploaded images and a cache of downloaded catalog content. **Profile → Storage** shows usage and lets you:

- <!--i:box--> **Clear cache** - drop downloaded catalog content (re-syncs next load).
- <!--i:trash--> **Clear all my data** - wipe profile, sessions and images. *Cannot be undone.*

![The storage card on a phone-width screen: every category of on-device data named, with the Clear all my data button at the bottom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

None of this local data is transmitted anywhere - no telemetry, no cloud rendering. The complete list of what the app ever fetches or sends is in the [Privacy Policy](/info/privacy.html), and [Server Surface](/info/server-surface.html) inventories the optional server components.

## Moving to another device

Because everything lives on your device, **Profile → Storage → Move to another device** lets you carry it all to a second install - no account, no cloud:

- <!--i:download--> **Export my data** downloads a single `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (the name parts come from your profile and are dropped if unset; `<n>` is a per-day counter so same-day exports don't collide) containing your profile, every saved session (with its thumbnail), your uploaded images and your preferences (theme, sidebar width, local activity stats).
- <!--i:upload--> **Import data…** on the other install reads that file back in. It **merges**: anything with the same name (your profile, a session slot, an image) is replaced by the imported copy; everything else on that device is kept. Saved sessions re-link to your imported images automatically.

The catalog cache isn't included - it re-downloads itself on the new device. The bundle is a plain zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, format id `lolly-backup`), so it survives email, USB or AirDrop intact and is the same format every shell reads. Each part is checksummed, so a file damaged in transit is caught on import rather than restored half-broken. (Full format spec: [Data Transfer](/info/data-transfer.html).)

## Importing a design (Figma, Penpot, Illustrator, InDesign)

You can bring an existing design into Lolly and keep working on it: open **Design**, click **Import a design** in the canvas toolbar, and choose a Figma **.fig** or SVG, a Penpot **.penpot**, an Illustrator **.ai** / **.pdf** or an InDesign **.idml**. Layers become editable boxes on the free canvas - text stays retypable, images land in **My images** and type and colours conform to the brand globals - then the result saves, shares and renders like any other session. The parse happens entirely on your device. Full detail: **[Import a design](/info/design-import.html)**.

## Exporting

See **[Exporting & Formats](/info/exporting.html)** for the full story - choosing a format, output size and print units, transparency, video and copy/share. In short: pick a format, set the size if you need to and **Download** (or **Copy** to the clipboard).

## Batch (Pro) mode

For power users, **Batch** (linked from the gallery, gated behind the Pro feature flag, which defaults on) renders many variations at once - a grid where each row is a set of inputs, exported together. Ideal for localising a card into a dozen languages or generating every size variant in one pass. Fill rows by typing, pasting straight from a spreadsheet or importing a CSV (you can export one back too), and set per-row format, size and output filename. Save a whole grid as a named **batch session** that reopens from the gallery, and download every row as a single `.zip`.

![The batch toolbar - zip name, units, DPI and the format every row inherits, with Sessions and Render on the right](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch is for generating **many variants of one template** at once. To re-render sessions you've **already saved**, use **Projects → Render folder / Render selection** (above) - no Pro needed.

## Editing side by side (Multi-edit)

Batch is many variants of *one* design. **Multi-edit** is the other half of the job: several **different** saved designs open at once, so one change applies to all of them. Tick between **two and eight** saved sessions in **Projects** and pick **Edit together** from the selection bar; they open as live cards side by side at `#/multi?s=<slot>,<slot>…`. Each card is a real render of that session, not a stored thumbnail, so what you see is what it will export.

One sidebar drives the lot:

- <!--i:sliders--> **Shared** leads it - every input that two or more of the selected sessions declare the *same way* (same id, same type, same constraints - the same merge rule the batch grid uses on its columns). Edit a shared control once and the value fans out to every session that declares it, live on every card. Two sessions of the same tool share everything; two different tools share whatever they happen to have in common, and nothing else.
- <!--i:document--> Under it, **one collapsed card per session** with all of that session's own inputs, at the same fidelity as the tool's own sidebar - asset pickers, repeating row groups, colour fields - plus a compact export block: **Format**, **W** / **H**, **Unit**, **DPI** and its own **Download**. That Download saves the session first and then renders it through the ordinary session-export path, so the file carries the same filename, format and Content Credentials it would straight from the tool.
- <!--i:search--> **Filter inputs…** at the top narrows the controls across *every* card at once - which is how you get to "the headline" in eight sessions without scrolling for it.

Click any canvas (or press Enter on it) and that session's sidebar card opens and scrolls into view. **Save all** writes every session back to its own slot. **Download all** saves first, then renders the whole set through the same pipeline as Projects' **Render selection** - one zip, with the optional password lock offered on the way.

Two honest limits. The two-to-eight cap is real: every card mounts its own live runtime, and that's the number that stays responsive - a link asking for more (or for a session that no longer exists) says so rather than half-loading. And the link names *your* saved slots, so it reopens that set on this device; it is not a share link.

When the selection is bigger than eight, mixes tools or includes images as well as sessions, the escape hatch is **Edit as sheet** in the same selection bar: it opens the whole selection as **rows in the batch grid** (`#/pro?s=…`), with no size limit and no same-tool rule. Folders stay out of both - they have their own open-in-grid path. ([Search](/info/search.html) is the one thing that doesn't reach in here yet: Multi-edit is the single view the search bar doesn't know about.)

## Offline & install

Lolly is a PWA. After the first load it works **offline** - install it from your browser's address bar (or *Add to Home Screen* on mobile) for an app-like, full-screen experience. It updates itself when you're back online.

About updates: if a view ever fails to load right after one (a blank panel, a "failed to fetch" in the corner), reload the page once - the app picks up the new version cleanly and your work, sessions and brand are untouched. It stores everything on your device, not in the page.
