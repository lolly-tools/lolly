# 3D Studio

Turn a flat logo into a lit, bevelled object for a launch slide, or loop a product model on a turntable for a social post, without learning 3D software. **3D Studio** takes SVG artwork, 3D models and words in your design system's font and renders them as stills and loops. Start with **Guided** controls, then choose **Expert** to edit the same scene in more detail.

## Make a first image

1. Open **3D Studio** and try the two-colour sample badge.
2. Under **Start**, choose **SVG artwork**, **A 3D model** or **Words in the brand font**. Use the asset picker to select or upload an SVG, GLB, STL or 3MF; uploads stay on this device for reuse.
3. Under **Look**, choose a lighting studio. Keep the source materials, or apply a colour pair and choose a finish for each colour.
4. Choose **Fit object**, drag the preview to orbit, or use the arrow keys while it has focus (Shift for larger steps). **Reset camera** restores the starting view, and undo and redo recover each action.
5. For SVG artwork, adjust **Depth** and **Bevel** under **Shape**. Small details need a smaller bevel.
6. Choose the image contents under **Output**, then export.

![The two-colour badge in 3D Studio, with guided controls and a shaded preview of its depth and bevel.](/t/url-shot?url=%2F3d-studio%3Fsource%3Dprimitive%26primitive%3Dbadge%26colorA%3D%2523238d75%26colorB%3D%2523ffc36a%26background%3D%2523f2eee5%26studio%3Dsoft%26motion%3Dstill%26outputMode%3Dscene%26backdrop%3Dsolid&width=960&height=700&dpi=96&waitMs=6000&format=svg&filename=3d-studio-guided&try=1&waitSelector=.studio-frame%5Bdata-studio-state%3D%22ready%22%5D&walker=1&rasterDpi=96)

Colour A, colour B, the background and the lights start from your design system's colours, so switching design system or colourway recolours the scene.

## What goes in front of the camera

**SVG artwork** is extruded and bevelled. Each visible solid colour becomes its own material slot, with paint order resolved before extrusion so overlapping paths do not flicker. The studio keeps the outline at the sidewall and shrinks a bevel only where a narrow or sharp detail would fold; **Source notes** reports every reduction with the requested and applied sizes, and the saved requested size stays, so changing the source or depth checks it again.

::: details How the bevel is checked
The faces are contracted for an inward bevel. Before building it, the studio follows the contracted outline and holes through every bevel step and checks three things: no edge reverses, no outline or hole collapses and no two edges touch or cross, including a hole growing past its outline. A size that fails is halved until it passes, and bevel thickness is limited to half the extrusion depth. Rings, letter counters and other shapes with curved holes keep their full bevel wherever the geometry allows.
:::

**A 3D model** can be a GLB, STL or 3MF file. A GLB in **Keep source materials** mode keeps its own materials and textures, and a 3MF keeps its base and vertex colours. An STL without usable normals gets flat normals computed per facet, and Source notes records the fix.

**Words in the brand font** sets up to eight lines in your design system's sans, display or mono face, or any font added under Brand fonts. **Weight** picks the instance, and Expert mode adds letter spacing, line height and alignment. Words face the camera by default; **Pose** applies the object rotation instead. The letters are shaped by the same engine that outlines text in exports, so ligatures and kerning are the font's own. Words take colour A, and a colour A edit reaches words and STL models straight away. In an arrangement, a **Words** row sets its own text and shares the scene's font settings. A role the design system does not define falls back to its main face, and a font missing on this device is reported rather than replaced.

**Several objects together** and **A collection** put more than one thing in the picture; see [Groups and sets](#groups-and-sets).

## Light the scene

The lighting studios include soft, dramatic, cool and warm starting points. **Contrast** balances key and fill light, **Shadow softness** changes the apparent size of the source and **Exposure** sets the final brightness.

![A chrome ring uses the photo-studio environment and dramatic lighting to reveal its curved surface.](/t/url-shot?url=%2F3d-studio%3Fsource%3Dprimitive%26primitive%3Dtorus%26finishA%3Dchrome%26colorA%3D%2523238d75%26background%3D%2523142126%26studio%3Ddramatic%26environment%3Dstudio%26motion%3Dstill%26outputMode%3Dscene%26backdrop%3Dsolid&width=960&height=700&dpi=96&waitMs=6000&format=svg&filename=3d-studio-lighting&try=1&waitSelector=.studio-frame%5Bdata-studio-state%3D%22ready%22%5D&walker=1&rasterDpi=96&drive=click%3Asummary%3Ahas-text%28%22Start%22%29%3Bclick%3Asummary%3Ahas-text%28%22Studio%22%29%3Bclick%3Asummary%3Ahas-text%28%22Lighting%22%29%3Bwait%3A500)

Choose **Move lights** on the preview to see each studio light as a coloured handle. Drag a handle to orbit that light around the subject. With the preview focused, the arrow keys turn the selected light, plus and minus move it closer or further, and the square brackets select the previous or next light. Shift makes larger turns, each step is one undo entry and Escape returns to camera orbiting. A preset studio keeps moved lights as **Key light position**, **Fill light position** and **Rim light position** under Lighting in Expert mode, and the key reflection card follows the key light. Handles never appear in an export.

Under **Lighting**, the **Lighting environment** adds soft illumination and reflections. The generated environments are built on this device and need no file:

- **Studio room**, **Photo studio**, **White gallery**, **Soft box** and **Window light** for product work;
- **Warehouse**, a daylit industrial space with a brand-tinted accent wall;
- **Main stage**, coloured spotlights in colour A and colour B with an accent-coloured screen;
- **Desert chrome**, a blue sky and sand reflection;
- **Synthwave chrome**, a neon grid in colour A under a striped sun in colour B.

The coloured environments rebuild when the colours change. **Environment brightness** scales illumination and reflections together, and **Environment rotation** places the highlights. **Show the environment behind the scene** works for every environment, and a painted one shows crisp at zero **Background blur**.

**Imported radiance map** lights the scene with your own equirectangular panorama, a Radiance `.hdr` or OpenEXR `.exr` file. The file is checked by its bytes, and a PNG or JPEG is refused, because a display image cannot light a scene. The map is decoded as linear radiance and filtered once for reflections, and exposure is applied only at delivery. **Show the map behind the scene** draws it, softened by **Background blur**, behind a scene image; transparent outputs use the map for light only. An editable `.lolly` file carries the uploaded map to another device. Image-based light casts no shadows of its own; the studio's lights stay the shadow sources.

Under **Stage**, choose a background colour, gradient or image, such as a PNG made with Backdrop. A background image does not light the scene.

## Finishes and materials

Beyond matte, satin, enamel and metal:

- **Chrome** is a mirror, and **Clay** a soft dead matte.
- **Velvet** adds the fuzz of fabric at grazing angles.
- **Glow** and **Neon** light a region in its own colour, Neon more strongly; **Glow halo** under Look sets the soft spill around them.
- **Glass** and **Frosted glass** let light through, so they belong in a complete scene; a transparent output shows them as solid crystal and adds a note.
- **Pearl** and **Iridescent** shift colour with the viewing angle.

The two finish controls alternate across an SVG's colour slots. Turn on **Separate face, bevel and side finishes** to give each region a matte face, a polished bevel or a metallic side. These assignments apply to SVG artwork and the sample badge; imported meshes keep their own surface layout.

Colour A and colour B are material colours, not output pixels: light, finish and exposure change how they render. The stage background passes through the same tone mapping, so it does not export as its exact swatch: at the default exposure of 1.1, a solid `#30ba78` background renders as `#61c992`. It also tints a soft fill light from below while colour A lights from above, so changing the background changes the subject's shading slightly.

## Depth of field and depth forms

Turn on **Depth of field** to soften objects away from the camera's focus. Choose **Pick focus** and click the subject; **Auto focus** follows the camera target again, and Expert mode takes a focus distance as a number. Higher render sample counts make the blur and shadows smoother.

**Foreground and background forms** adds forms in front of and behind the subject. **Depth forms** chooses copies of the subject, at other sizes and angles, or soft spheres in the brand colours. **Depth spread** keeps them close at 0 and pushes them far out at 1, and Expert mode sets how many there are. The arrangement follows the saved seed, so it reproduces exactly, and the forms appear in scene images only.

## Make it move

**Motion** chooses what the subject does over the loop. **Loop seconds** sets how long one loop takes and the starting clip length; the export panel can record more or less. **Still image**, the default, holds the subject in place.

| Loop | What the subject does |
|---|---|
| **Turntable** | Turns through the turn angle. |
| **Hover** | Floats up and back down with a small sway. |
| **Pulse** | Breathes in and out by a few percent. |
| **Wobble** | Rocks side to side three times and settles. |
| **Pop** | Winds up, collapses away, comes back past its size and settles. |
| **Coin flip** | Throws up through one flip and squashes a little on landing. |
| **Jump** | Crouches, stretches through the arc, squashes and settles. |
| **Spin and land** | Lifts, drops turning once, bounces to a stop and holds. |
| **Burst** | Breaks into its own triangles, flies them out and brings them back whole. |

**Motion amount** scales how far a loop travels (Turntable uses **Turn angle** instead). **Rest between loops** sets how long Pop, Coin flip, Jump, Spin and land and Burst pause before going again. Every loop starts and ends where you placed the subject, its lowest point stays on the floor, and at the largest amount it stays inside the studio's shadow. An arrangement moves as one group about the middle of its footprint. Burst is deterministic, shatters the cast shadow with the object and shrinks pieces rather than fading them, so it works in cut-out outputs too. Pieces fly about 2 studio units at a motion amount of 1, and Burst handles up to 250,000 triangles per object; a heavier model keeps its shape and Source notes gives the count.

### Camera keys and moves

Orbit to a first view and choose **Add camera key** on the preview, then orbit to the next view and add another. Two keys make a move; up to twelve make a path, spaced evenly as you add them. **Play path** plays it, the export panel offers it as video or GIF at the loop length, and **Hold the current view** keeps the picture still while you compose the next key. Under **Motion**, each key lists when it is reached, its angle, field of view, zoom, target and focus distance, all editable. Each key can take a name of up to 40 characters. **Go to key** shows the next saved key and moves only the camera, so turn **Play path** off to hold that view. **Camera easing** slows into each key, flows through them or keeps a constant speed, and **Return to the first key** closes the loop for a GIF.

**Camera** also offers five moves built from the view you composed:

- **Orbit sweep** turns a little each way and comes back.
- **Push in** comes closer over the loop; with **Return to the first key** off, it holds the close view.
- **Dolly zoom** narrows the lens from 60 to 24 degrees while the camera pulls back, so the subject stays the same size while the background slides. An orthographic camera has no lens to change.
- **Reveal turn** swings in from one side, a little further back and 30 degrees up, and settles on your view once.
- **Crane** comes down from above while the framing closes in.

**Camera amount** scales a move, and the key list hides while a move is chosen. **Convert to keys** on the preview turns any move into ordinary keys, in one undo step.

### Light motion

**Orbit the studio** sweeps the light rig around the object and back, and **Gently breathe** varies its intensity, with **Light motion amount** for the range. Brand light colours stay as they are, and the lights return to their start at each loop boundary.

An object loop, a camera move and animated lights run over the same loop seconds. A turntable closes its pose only when its turn angle is a whole number of rotations.

### Start from a template

Templates open on a finished loop. **Wordmark backdrop** sets your words in the brand font and **Icon backdrop** starts from the sample badge; both combine the dramatic studio, copies of the subject drifting in depth, orbiting lights and a slow camera move. **Logo drop** drops a badge in turning and bounces it to a stop, **Bouncing icon** jumps the sample badge under a soft studio, and **Shatter reveal** breaks the subject into triangles while the camera swings round. Swap in your own words or icon under Start, then export. A brand pack can add models and templates of its own, shown only where that pack is installed.

## Get the file you need

**Output** chooses what the image contains, and the format decides how transparency is kept:

| Format | Complete scene | Object with transparent shadow, or Object only |
|---|---|---|
| PNG, WebP, AVIF | Kept | Transparency kept |
| APNG, animated WebP | Kept | Transparency kept, frame by frame |
| GIF | Kept | Hard edge: a pixel less than half opaque becomes a hole |
| JPEG | Kept | Flattened (no alpha) |
| TIFF | Kept | Flattened onto white |
| MP4, WebM | Kept | Every frame flattened onto white |

Use **Object with transparent shadow** and PNG to place the object over another background, and **Object only** to drop the cast shadow too. For a soft edge in motion, use APNG or animated WebP.

The export panel's size and DPI render the scene again at that pixel size, up to 4096 pixels per side and 12 million pixels, so a large export carries real detail. Every still format takes that route. A video or GIF frame uses **Clip samples** (16 by default) rather than the still's render samples; raise it for smoother depth of field at the cost of export time.

**Fit object** centres the subject with a margin at the current aspect ratio, keeping the viewing angle and field of view. Fit again after changing the output proportions or the object's pose. Camera gestures, fit, reset and focus picking all use the normal undo history and are saved with the session.

::: details Curve detail
**Curve detail** chooses how a curve becomes straight pieces. **Fixed count** uses the **Curve count**, 8 to 64 (24 by default), at every size. **Follow the output size** reads the count from the image being made, keeping the error inside a quarter of a pixel at the **Fit object** framing, up to 64 pieces or the one-million-triangle budget: a 4096-pixel image of a curved ring takes 47 pieces per curve where a 64-pixel thumbnail takes 8. The preview is built at preview size; an export is built at the size it renders, including a link's own size, a batch row's size and each page of a paged set.
:::

## Groups and sets

### Arrange several objects

Choose **Several objects together** under **Start with** for an icon cluster, a product line-up or a hero object with supporting pieces. **Add objects** on the preview opens the library and keeps it open: every icon, logo or model you choose becomes an object, and **Done** frames the group. Dropping SVG, GLB, STL or 3MF files on the **Objects** list does the same with your own files. Each row is one SVG, GLB, STL, 3MF or sample shape, named after its file and placed in the next free spot, with its own position, rotation, scale, **Rest on the stage** and **Visible** switches. Objects that name the same file share its loaded geometry. **Add object** adds one row of a chosen kind and waits for its file without disturbing the scene; lighting, colours, finishes, extrusion, stage and camera are shared, so the group reads as one photograph.

On the preview, **Orbit**, **Move objects** and **Move lights** choose what a drag does, and **Frame all**, **Fit selected** and **Reset camera** frame the picture. A click selects an object in any mode. In **Move objects**, drag or use the arrow keys to move the selection, comma and full stop to turn it, and the square brackets to select the previous or next object. Every step is one undo entry with a number in the row. On a phone, or at a small render size, the toolbar shows short labels.

Objects rest on the stage by default; turn **Rest on the stage** off to let one float or sink, and use **Lift Y** either way. **Source notes** reports the object count, the triangle total, the selected object's material slots and any pair of objects that overlap by more than a small margin. A turntable turns the whole group about the centre of its footprint, focus picking and the transparent shadow work across every object, and a broken file says which object it belongs to. In Expert mode each row can bind its own material slots and carry a **Stable id** for automation; object transforms under **Camera** apply to single-object scenes only.

### Build and review a collection

Choose **A collection** under **Start with** for a consistent set, such as twelve icons rendered the same way. Drop several SVG or model files onto **Collection items**, or use **Add item**; an item can also be **Words**. Lighting, colours, finishes, background and camera are shared. **Preview item** picks the object on the main canvas, and dragging it records a framing override for that item alone, as does **Pick focus** (turn off **Own focus distance** to use the shared focus again). **Use shared framing** removes the override. Each row's **Item size**, **Nudge X** and **Nudge Y** bring icons drawn at different weights to the same apparent size: the size multiplies the shared scale and the nudges add to the shared position. In Expert mode a row's **Stable id** addresses its overrides, so reordering cannot move one item's framing onto another; delivered file names follow the saved order.

**Review collection** opens a contact sheet with fifteen of the shared controls, so one edit refreshes every tile; a **Studio** control applies a saved studio to the whole set. Each tile renders at the saved image size reduced to 512 pixels on the long side, and the footer states both sizes. Failed sources are listed by item and must be fixed before exporting. **Download sheet** saves the sheet as one PNG, with each name under its tile. **Export PNG set** renders every item at **Collection image size** from a snapshot of the current settings, numbering repeated names, with progress, cancellation and download recovery. The sheet and the PNG set show the start of the loop; export the selected item as video for motion.

## Reuse a look

Save the scene as a session to reopen it, or use **Save as a template** for a starting point. A share link carries settings and asset references; use an editable `.lolly` file when another device also needs your uploads.

**Save studio** keeps the look of the current document as a reusable studio: the lights and their animation, the environment, materials, finishes and colours, stage, extrusion, depth of field and forms, exposure, render quality, projection, field of view and the motion. It leaves out the subject, the framing, the collection and the output, so one studio photographs many things. **Apply a studio** writes that look into the current document and keeps its subject, orbit, zoom, pan and focus. These actions sit in the sidebar's **Studio** section, and a collection or arrangement takes a studio the same way, keeping each item's own framing, focus and material roles.

Each document remembers its studio and the controls you changed afterwards. Editing a saved studio changes nothing until a document chooses **Update from studio**, which refreshes every control you did not change; **Detach** stops following the studio. A studio lives on your profile and backs up with your other work. A link or `.lolly` file carries the resolved values, so the other side sees the look without having the studio.

For many variants, use Lolly's batch workflow with rows that keep the same lighting, material and camera values and vary `artwork` or `modelAsset`, saving a framing override where a shape needs one. **Make variants** edits several sessions side by side: its shared controls change them together, and the active cell orbits while the others stay still. Later edits to a template do not change sessions already made from that template.

### Place a scene in Design

Choose **3D scene** from the add menu on Design's tool rail and drag out a frame; 3D Studio opens on the new box. Otherwise a scene box is an ordinary box: move it, resize it, give it a shadow, put it on a slide or the timeline.

- **It keeps the recipe, not a picture.** The box stores the scene as 3D Studio's own link settings, so it re-renders at whatever size and moment the document asks for. Uploaded pictures travel by id, and a `.lolly` file carries their bytes.
- **Edit it in the studio.** Select the box, then choose **Edit in 3D Studio** in the Inspector's **3D scene** section. Apply writes the edit back as one undo step; closing without applying changes nothing.
- **One live scene, posters elsewhere.** Every scene box shows a still poster, drawn off screen at the box's size. The selected box is the one live scene, for looking at rather than orbiting, so a document with twenty scenes still runs one live renderer, and a document with no scene box loads no 3D code at all. A device that cannot open a floating-point graphics context keeps the poster and explains why in the box.
- **On the timeline**, a scene box follows the playhead like a video clip: its start, clip-in and speed move through the scene's own loop, which comes from 3D Studio rather than Design's keyframes. Trimming the box shows less of the scene rather than speeding it up.
- **In an export**, each scene is drawn fresh at the size the file needs, one frame per moment in a video. A scene that cannot be drawn fails the export with the studio's reason.
- **Sharing.** A share link carries a scene's device-local upload id as it stands, so on someone else's device that picture falls back to the studio default; send a `.lolly` file to include the upload.

A studio link placed in another document, or embedded as a tool image, arrives as a picture rendered at export quality.

## Expert controls

Expert mode exposes object transforms, perspective or orthographic projection, the camera target and focus distance, individual light strengths and colours, reflection settings and the export sample count. Switching back to Guided keeps those values.

- **Custom lights** builds a rig of up to eight directional, point, spot or rectangular area lights aimed at the centre of the studio, up to four casting shadows. Rectangular area lights give illumination and reflections; the other kinds give cast shadows. A moved light in a custom rig writes its own row.
- **Override selected slots** sets colour, roughness, metalness and clear coat for individual materials, found under **Material slots and source notes** on the preview. A colour override replaces that slot's colour texture, and unselected GLB materials stay intact. In an arrangement or collection every object needs the named slot, or the scene stops with an error that says which object; two overrides on one slot are an error too.
- **Material A slot** and **Material B slot** bind the colour pair to exact source names or numbers; leave both empty to alternate the pair across slots. With explicit bindings, other slots keep their original materials.
- Orthographic projection keeps parallel edges parallel and does not use photographic depth of field. For a consistent icon set, keep the camera, scale, lighting and materials together as one saved starting point.

::: details Limits
- **SVG**: up to 1 MB, 128 paths and 16 solid colours. Convert text, linked content, filters, masks, gradients and transformed or dashed strokes to plain filled paths first. A shape that would pass one million triangles once bevelled is extruded without a bevel.
- **GLB and STL**: up to 32 MB and one million triangles. Export GLB without Draco, Meshopt or KTX2 compression; embedded textures can be up to 8192 pixels per side. Model animation clips are not played.
- **3MF**: up to 128 MB and one million triangles. Core meshes, base and vertex colours, units, build transforms and multipart projects such as Bambu Studio's come in; slicer settings, painted filament assignments and texture properties do not.
- **Model size**: the longest side is always scaled to 3.25 studio units. **Source notes** gives the file's own size, such as `Model spans 120 by 48 by 9 units in its file; shown at 3.25 studio units.`, in millimetres for a 3MF. STL gives a visual mesh; the studio does not infer print units or certify a printable object, and native CAD documents must be exported as a supported mesh first.
- **Arrangements**: up to 16 objects and one million visible triangles, sharing one extrusion depth and bevel. **Collections**: up to 24 items. Separate render passes and editable mesh export are not available.
- **Radiance maps**: `.hdr` and `.exr` up to 64 MB and 8192 by 4096 pixels; maps narrower than 512 pixels are replicated before filtering.
- **Output**: SDR rendering, up to 4096 pixels per side and 12 million pixels. The preview uses fewer samples than an export. The renderer needs WebGL2 with float render targets, on top of the browser support Lolly itself needs ([Supported environments](/info/supported-environments.html)).
- Lighting is rasterised with sampled shadows and a reflection environment, not full path tracing. Transparent shadows keep the saved camera and ground plane; they do not relight another image after export. A frame that renders empty fails the export rather than saving a blank file.
:::
