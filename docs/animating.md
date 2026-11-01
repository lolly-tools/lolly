# Animating: keyframes, depth and a camera

Make a headline drift in, lift a card off the page or fly a camera across a poster, without a keyframe animation package. This page covers posing a box at one moment, lifting it off the page and shooting the result with a camera. For cutting clips in time, see [The sequence editor](/info/sequence-editor.html).

Everything here runs on your device. Nothing plays on its own: the preview moves when you press play or drag the playhead.

::: timeline
- <!--i:pentool--> Select a box on Design's canvas.
- <!--i:clock--> Open the timeline, park the playhead at 0 s and choose **+Keyframe** under **More tools**, or press `Shift+K`.
- <!--i:clock--> Move the playhead to 2 s.
- <!--i:layers--> Drag the box to its new place and press **+Keyframe** again. Press play: the box moves between the two poses.
:::

## A keyframe is a pose at a moment

A keyframe records a box's position, its size, how see-through and how blurred it is, and how far it lifts off the page, all at one instant. It can also hold how the box is painted: its **fill colour**, its **stroke colour** and **stroke width**, its **corner radius** and how much of its stroke is drawn (**path trim**, for lines that draw themselves on). Two keyframes make a move, and Lolly fills in everything between them.

Colours change through OKLab, a colour space built to match how people see, so a blend from orange to blue passes through the colours the eye expects instead of a muddy grey band.

**+Keyframe** has two homes and one behaviour:

- **+Keyframe** in the timeline's **More tools** menu, under **Edit clips**;
- the diamond on the selected object's bar on the canvas, beside Duplicate and Delete.

`Shift+K` does the same from the keyboard while the timeline has focus (a bare `K` on the canvas turns Scale mode on or off). Whichever you use, the pose is written at the playhead for everything keyframable in the selection in one commit, so one undo takes it all back, even across a multi-selection.

If the thing you selected has no timing yet, that same press adds it to the timeline **and** writes its first keyframe together. One press, one undo step.

Each keyframe appears as a **diamond** on the clip's bar. `Alt + ←` and `Alt + →` step the playhead from one diamond to the next.

Apart from **+Keyframe** and the diamond beside a field (see [Key one property at a time](#key-one-property-at-a-time)), nothing creates a keyframe. Dragging a box, typing in a field or scrubbing the playhead never quietly adds one, so nobody keyframes by accident.

A box that has never been animated shows one control instead: **Animate**, in its Keyframes group. Press it and a rest pose is written at the start of the clip, with everything exactly where it already was. From then on the box has a track, and the rest of this page applies to it.

## The playhead is the arm

There is no record button and no stopwatch. The playhead's position decides what an edit writes.

- **Parked on a diamond**, the canvas and the pose fields edit *that keyframe*. Drag the box, rotate it, resize it or type a number, and only that pose changes. A box resized on a diamond tweens its size between keyframes, and text inside it reflows as it goes.
- **Parked off every diamond**, the same edits change the box itself, which moves the whole animation with it. This is how you reposition a finished move without re-keying it.

The Keyframes group says which one you are in: its first line reads **No keyframe here** off a diamond and **Keyframe @ 0:01.8** on one. Off a diamond the pose fields show the values the box is passing through at that instant, and all but Depth, Tilt X and Tilt Y are inactive, because there is no keyframe to write to.

Scrubbing **latches onto diamonds**: drag the playhead near one and it snaps to it, so "edit the pose I can see" is the easy thing to do. Hold **Alt** to park between them.

Closing the timeline turns all of this off. The playhead is the arm, so the arm has to be visible.

## The Keyframes popup

The clip inspector is a row of grouped segments: **Time**, **Motion** (**Fades** on a sound clip), **Keyframes**, a speaker toggle for mute and the timed or always-on switch. Each segment shows one glance-value summary; press it and its controls open as a panel above the transport, wide enough to read.

The **Keyframes** panel holds everything one track can be edited with:

- the latch line, saying which keyframe you are on;
- the pose fields: **Depth**, **Tilt X**, **Tilt Y**, **Scale**, **Opacity** and **Blur** (position, rotation and size are set on the canvas instead);
- the appearance fields the box has: **Fill**, **Stroke**, **Stroke width**, **Corner radius**, **Trim start** and **Trim end**;
- a diamond at the end of every field, which keys that one property (see below);
- one row per keyframe: its time, its curve, **Duplicate** and **Delete**. A keyframe that holds only some of the box's properties lists them, such as **Fill · Corner radius**. A keyframe that sets a position also has **X** and **Y** fields and **Curve the path** (see [Edit the motion path](#edit-the-motion-path));
- **Remove N keyframes**, which is how you un-animate a box: the track is the animation;
- the curve editor, docked at the bottom of the same panel.

Each keyframe's curve list has up to three groups:

- **Design system**: the curves and springs your design system defines, when it has any (see [Follow the design system](#follow-the-design-system)).
- **Curves**: **Linear**, **Ease out**, **Ease in**, **Ease in and out**, **Overshoot**, **Anticipate**, **Smooth**, **Snappy** and **Hold**, which keeps a value until the next keyframe.
- **Springs**: **Gentle**, **Quick**, **Bouncy** and **Slow**.

Drag a handle on the docked plot and the row switches to **Custom** with the curve you drew, so the presets are a way to learn the shape rather than a limit. A curve shapes movement; a fade always ramps evenly, whichever curve the keyframe carries.

### Springs

A spring moves like a weight on a spring: it can overshoot, bounce back and come to rest. Pick one and the docked plot shows the spring as it plays between this keyframe and the next, with three settings under it:

- **Stiffness**: how strongly the spring pulls towards the next pose. Stiffer is faster.
- **Damping**: how quickly the bounce dies away. With little damping the box bounces several times; with a lot it glides in without passing its target.
- **Mass**: how heavy the moving thing feels. Heavier is slower and swings further.

Change any of them and the row reads **Custom spring**. The line under the plot says how long the spring takes to settle, and a thin upright line on the plot marks where it comes to rest.

A spring runs in real time: Bouncy settles in under a second whether the keyframes are half a second or five seconds apart, and then the box rests until the next keyframe. When the next keyframe comes before the spring has settled, the spring still arrives on that keyframe exactly: the distance it has not covered yet is spread evenly across the segment, and the dock tells you when this happens. A spring never pushes a value out of its range, so a trim, a colour or a scale overshoots only as far as that property allows.

### Follow the design system

A design system can define motion: durations, curves and springs (see [Motion tokens](/info/design-tokens.html#motion-tokens)). Its curves and springs are listed first, under **Design system**. Pick one and the keyframe follows the design system by name, so when the design system's curve or spring changes, every keyframe that follows it moves the new way. The dock says which curve or spring the keyframe follows; editing the curve there gives the keyframe a curve of its own and stops the link.

The link remembers the curve the design system had at the moment you picked the token. Opened where that design system is not loaded, or after the curve or spring was removed from it, the keyframe plays that remembered curve, and the list shows the name with **(not in this design system)**.

Cutting a clip inside a segment that follows the design system writes out the curve that segment plays, on both halves, because half of a design-system curve is not that curve.

The design system's durations appear as suggestions in the Motion group's **Enter (ms)** and **Exit (ms)** fields, and in Choreograph's **Length** when one is long enough. Choosing one writes the number, as typing it would.

Clicking a diamond selects it and opens this panel on that keyframe in one gesture. Dragging one moves it in time, and Alt-dragging leaves the original in place and drops a copy where you let go. Right-clicking one offers **Keyframe curve**, **Duplicate keyframe** and **Delete keyframe** without opening anything.

The keyframe rows are the keyboard and screen-reader route to the diamonds. Everything a diamond can do by pointer is a labelled button in that list.

![The Keyframes popup on a choreographed swatch: its diamonds listed with their times, the curve between two of them, and the pose fields for the one the playhead is parked on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZjNj5pAFMD_Gi8mkjdvPjn0sKLuoWnT7qFJTwR1mpooNMAm6l_f-QBFdLMkLWQPiAwz7803v7w3j_XxUwETjNbZ0aQE4ZIic6nL2zvPXtOt3jqNFUUUMbK1wWrNf5OlZbJLTS7N8kOy99IJcjnfZPssDwp9SNJytwlKfSytfGH0TNmmOi11bjKH3Xa71ybDXa9FkhZ2iIBgNYsyf7XqX8m-0PUAke1iq_-Uv20l9-O8qu_WA80hbpuCm2561nlWlWjdymv09cHcnHx624vbm8azMXh934xYreK2-7te68qExzqLjzOCGHAen2aEsICq-GxeVFyQOIN4LaYlwVCYYgDITEExHh8hPkF89pVIvIY3RmnIGjpyV1tcF0ImclmQCzisOzgU5k9SjeAMAI704IBFBvGOF8orXmwhhP55wQsvsjsvyDhdrUZehjA0MnTAvGdomAAHDgmnJQKEvYNDWx7Kb8074KyWMqIjOEOAg_ziokJHQgsYTr2lIcICo_q3NKzlmToBs1zZawRmAGCosSq1a0J2x4sgofdMyvBChOqdF97yTJ14ISGCxJGXAXhhFCvP9NC-SEI9L9TwggJ750W0HJJQXRwSr3Zu5KVvXjhTtzHTGycZhQ1DQ2X_hka2HFMncJYcCV-O4AwAjmCsdkyPQqYQuefFnnyZZL3zolqOqRMvks6fkI-8DBFiGz6aIdNjO2OCJOK54VN7WIa-uQHyhayQ_fzx_WUBavXtmYoFRJ9fvj7b7U4OOk9an_uoj8XhgpTelFYpJh_pK1_1Ov4JpKvs42AEtdExTMxMdJ2bfH6CaUnNOq-wVOL_yMpf%26w%3D1100%26h%3D1040%26_sel%3Ds4%26_t%3D1.1&width=1440&height=1000&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A320px%21important%7D&drive=click%3A.tl-group%5Bdata-group%3D%22keyframes%22%5D%20.tl-group-head%3Bwait%3A600&cropSelector=.tl-group-pop-body&walker=1&format=svg&dark=1&filename=anim-keyframes-popup)

## Edit the motion path

With the timeline open, a selected box that moves draws its travel on the canvas: an amber line with a diamond at every keyframe. The export follows this same route, camera and all, so a camera move bends the drawn route the way the finished video will.

- **Drag a diamond** to move that keyframe's position. One drag is one undo step. The line between the diamonds does not respond to the pointer, so nothing on the path creates a keyframe. While you drag, a label beside the diamond shows the keyframe's time.
- A dragged diamond snaps to the grid, the smart guides and the path's other diamonds, as a pen node does. Hold **Shift** to step the travel in 15 degree steps from the previous keyframe, or **Alt** to put the diamond exactly under the pointer.
- **Click a diamond** to select the keyframe. Its handles appear, with a small bar showing the time and **Curve the path**, or **Straighten** once the travel through the keyframe curves.
- **Curve the path** gives the keyframe smooth handles from its neighbours, so the box sweeps through the point instead of turning a corner. On the first or the last keyframe, the one segment bows to one side.
- **Drag a handle** to shape the curve. The opposite handle stays in line and keeps its own length; hold **Alt** to move one handle alone, or **Shift** to step its angle.
- **Backspace** puts the selected handle back onto its point, or both handles when the point itself is selected, and **Escape** drops the selection. Neither one removes the keyframe or the box.

A keyframe that sets no position, such as a fade, sits on the line as a smaller hollow diamond. It marks a moment on the travel and cannot be dragged.

A curve changes the route, not the timing. The keyframe's curve (**Ease out**, **Overshoot** and the rest) still decides how fast the box travels, measured along the path, so a **Linear** segment moves at an even speed however much the route bends. An overshoot carries on past the keyframe in the direction the box was heading.

Under a camera, a diamond and its handles sit where the camera shows them at that keyframe's time, and a drag writes the position that puts the box under the pointer, whether the camera pans, dollies or tilts. A camera's own move has no path on the canvas: its move shows as the parallax on every other path.

Splitting, trimming or joining a clip, and adding a keyframe partway along a curve, keep the travel on the same curve.

The Keyframes popup carries the same edits for the keyboard and screen readers. Each keyframe that sets a position has **X** and **Y** fields under its time, giving where the box's left and top edges are at that keyframe, and **Curve the path** or **Straighten** beside **Duplicate** and **Delete**.

## Key one property at a time

Every field in the Keyframes popup ends in a small diamond, and so do **Fill**, **Stroke**, **Stroke width** and **Corner radius** in the Design inspector while the timeline is open. The diamond keys that property alone, at the playhead:

- **Hollow and grey**: the property is not animated.
- **Hollow and coloured**: the property is animated, but not at this instant.
- **Filled**: the playhead is on a keyframe that holds the property.

Press a hollow diamond and the property's current value is written into the keyframe at the playhead, or into a new keyframe that holds only that property. Press a filled one and the property comes off that keyframe; a keyframe left holding nothing goes. Each press is one undo step, and each diamond is a labelled button, so the keyboard and screen readers reach the same action.

Because each property interpolates only between the keyframes that hold it, a colour can change over the first second while a position moves over three, each with its own curve.

In the Design inspector, a property with no keyframes is an ordinary field: change the fill and the box changes. Once the property is animated, the playhead decides. Parked on a keyframe, an edit writes that keyframe; anywhere else the field shows the value the keyframes give at that moment and refuses an edit, because no keyframe there would hold the change.

### Which strokes can be animated

Stroke width and path trim work on a pen path and on a box whose stroke sits inside its outline, the default. A box stroke placed on or outside the outline keeps its width, and a trimmed box draws one stroke width all round, so a box with a different width on each side, a box showing a picture and a line with arrowheads keep their whole stroke; the diamond says why. A trimmed stroke is drawn solid, even when the stroke style is dashed.

## See one property's keyframes

The **All keyframes** control above the tracks narrows every clip's diamonds to one group: **Position**, **Size**, **Scale**, **Rotation**, **Opacity**, **Depth**, **Tilt**, **Blur**, **Fill**, **Stroke**, **Corner radius**, **Path trim** or **Volume**. While a group is picked, the control shows its name, and the Keyframes popup lists only those keyframes.

Dragging, Alt-dragging, duplicating or deleting a diamond then acts on that group alone. Moving a fill key out of a keyframe that also holds a position leaves the position where it was; dropping it onto another keyframe adds it to that one, which keeps its own curve.

## Times in milliseconds, seconds or frames

The keyframe times in the Keyframes popup and the **Time** fields read in the unit you pick from the **ms**, **s** and **fr** switch in either popup. Frames count at the project frame rate. The choice is kept on this device and changes nothing in the document: the link still stores milliseconds.

## Depth lifts a box off the page

**Depth** is the first pose field, and with Tilt X and Tilt Y it stays live even when you are parked between keyframes. It says how far the box stands above the surface: `0` is flat on the page, the slider scrubs the useful band of 0 to 300 and the number beside it takes anything from `-300` (sunken) to `900`.

- Off a diamond, Depth writes the box's own depth, so the box is simply lifted for as long as it runs.
- On a diamond, Depth poses that keyframe, so a box can rise and settle again.

Depth on its own changes how the camera sees the box: lifted layers move further and faster than the page behind them. To make the lift readable when nothing is moving, give the box a shadow that follows its depth. The object bar's **More** panel has a **Shadow** section whose **Apply to** row offers **Depth** beside Box, Text and Content; it derives a soft shadow from the box's own height above the page, so the higher the box, the further it casts.

The first time you move Depth, a **Camera** appears in the Always on strip. Depth already works without it; the camera box is what makes the shot itself editable.

## Tilt a box

A box can hold a **perspective pose** of its own: pitch and yaw, up to 75 degrees each way, with the vanishing point at the box's centre. The object bar's **More** panel has a **Perspective tilt** section with the two sliders. The Keyframes popup carries the same pair as pose fields, so a tilt can be keyframed like depth; the keyed value replaces the set one for its segment.

A tilted box renders with real perspective on the canvas, in a still and in every frame of video, with two costs. The vector formats cannot describe a tilted plane, so an SVG or PDF export embeds that box as an image and tells you. A **video** export of a tilted scene runs on the slower capture path, which is why Choreograph's **Tumble** option is off by default.

## The camera

Select the **Camera** chip and the inspector swaps its Time and Motion groups for a **Camera** group.

Seven moves write a complete track in one press, each one an ordinary set of keyframes you can then edit or delete:

| Move | What it does |
| --- | --- |
| **Push in** | Travels toward the artwork and stops. |
| **Pull back** | Starts close and settles at the resting frame. |
| **Pan across** | Slides sideways, so lifted layers part at different speeds. |
| **Rise** | Climbs over the composition, easing a little closer as it goes. |
| **Reveal** | Starts close and soft, then settles sharp at the resting frame. The depth-of-field demo. |
| **Surface glide** | Pitches down over the artwork with the focus on the lifted layers, drifts across, then settles square. |
| **Orbit** | Swings round the artwork and settles square. |

![The Camera group with the camera selected: the seven moves as one-press buttons, and the pan, tilt, dolly, focus, aperture and FOV strength channels under them](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZhLi9swEMc_jS8Bm5mRRo9DD7vepKVQaLdQ6ElkE2-7kMTF9kKST19kOe8VCbROe0gedqL5z0hWfsxk_LR8V0NC-VO5TChHgu2RZHtsP_t3Vb4upsW0tfihXBDlXg3emlA-KRfN-GWRUL4oq_l4FkYTYn0_KWdlldXFfLxoXiZZUywbP_6QUC6Ndy0WTVEllM9fptNZkVDObdR6vKj9FBlSt4qmevXm5_Gs9ucfGGbxQabFr-anl7UP5s6jvSLYn2TjHF7QLnixLqqy-6Y2XsFS7E6yXVU4HkZpd2fvvDf55n0wY3cdh-FPom7EQrMrarcEtwK3BlejK9E9waBBIdgtUwSdMbtVigCZMG6NtK8S1gcozwulFuhqzIDkoGFgPp0zss69sT0bnqjVbisw0cMat_DJy-ETcH-nzQ2-q8AnRRw-GwBJEU5RAhGYi9m17VBTg4YR-0eNtqjpy1EjyWI0uqF2FdRY2Bhq0lq3PJe90PuX53XGcose2kHDhLZ39MRRiQ1bewa90VDn4obeddBTGM1yrNsSi7I1HaFEuKmsb9utDlkOfZYj23-Wk0cF9SLUhiP_vKF2HdSsiaGm2ISCSfKUNO9WxswMLEM5NYOGhTa9g8ZH5fQi0NASaLqBdhXQtKUYaJrJLSMpS3i3MmZmlCaAJgYNS029g6aOiqcylxRP7jb8Blr_oFmIZjSjzF7bGfk_xmAO29O3dUxqL8ex6T_H6aNiehF6Qybk4Q29q6CHADLGnlWyHX-r-1TerYyZWSgIpPkOQRnZO2nmqJpeRJoW93fEN9KuRJqBCGkEEnZdZyTJKe9enpOxFCqQx4OGtYK-yQP8hCMyj9--PXz5_FV-eC8_GkHfH63vWSfjeVGNj-4Mi3DfBLZQFpPGG1UX9F-yuCOx-zn_CMTd2P-D4SGD1RJctQL3DG7cllsI9lSAzmhz5y1F5aUpGVetkNyzZ87rhc9zXt_Jjcqkl1MrRy9PUe30W4h9EyJFRm6dhtAmLGMjVAAQWeVfxPc3%26w%3D1100%26h%3D1040%26_t%3D0.5&width=1440&height=1000&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A320px%21important%7D&drive=click%3A.tl-always-on%3Bwait%3A400%3Bclick%3A.tl-chip%3Bwait%3A500%3Bclick%3A.tl-group%5Bdata-group%3D%22camera%22%5D%20.tl-group-head%3Bwait%3A600&cropSelector=.tl-group-pop-body&walker=1&format=svg&dark=1&filename=anim-camera-moves)

Under the moves are the camera's own channels, each with the gesture that drives it: **Pan X** and **Pan Y**, **Tilt X** and **Tilt Y**, **Dolly**, **Focus**, **Aperture** and **FOV strength**. With the camera selected and the playhead inside its window, dragging empty canvas pans the shot, Shift-dragging tilts it and a plain scroll dollies it. Cmd/Ctrl-scroll still zooms *your view*, and Space-drag still pans your view: moving the shot and moving your own window onto it stay separate gestures. Clicking any box hands both back.

- A camera holding a **single pose** is the scene default. Pan it, dolly it or change its focus and the whole shot changes, with no keyframes involved.
- **Cuts come from a second camera.** Park the playhead where you want the cut, open the timeline's **Add** menu, choose **Add to the timeline**, then **Scene camera**, and click the canvas to drop it (the same two steps every kind added from the timeline takes). It arrives as a clip starting at that instant, and from there the shot looks through the new camera.

**Focus** is a distance and **Aperture** is how shallow the focus is; at `0` everything is sharp, and raising it softens whatever sits away from the focus distance. **FOV strength** changes the perspective, not the magnification; a dolly (the camera's own Depth) makes things bigger.

## Lift layers: one SVG into a stack

A flat SVG is one picture. **Lift layers** turns it into a stack of boxes, one per layer of the drawing, so each layer can carry its own depth, keyframes and blur.

Right-click a box holding an SVG and choose **Lift layers** (it is also in the **More** panel on the object bar). The dialog reads the artwork and reports what it found, such as **6 layers found**, with the number of shapes in each. Press **Lift layers** to accept, and the box is replaced by that many boxes, in the same place, sharing a group, with their depth staggered and the Depth shadow already set. It is one commit, so one undo puts the original picture back.

Read the list before you accept. On a screenshot exported from a Lolly canvas the layers are the objects the editor knows about. On anything else, such as a page you captured or a drawing from another app, the split is read from the artwork's own groups and geometry. Artwork that is genuinely one layer says so and offers nothing to do.

## Choreograph: one click, a whole motion arc

A lifted stack, a grouped selection or a grid of swatches is a set of boxes that want to move together. **Choreograph** writes that motion for you: every box gets its own keyframes, staggered a little after the box before it, and the camera gets a move of its own, all in one commit. What you get is ordinary keyframes, so you can retime, split or delete any of them, and one undo takes the whole arc back.

![Choreograph: nine swatches selected, and the picker offering the six showcases and five Launch recipes, with Buildup checked, Length 3, Stagger 90, Order, Camera move, Float and Tumble](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTNboQgEMefhquBUcQeelipvoertDVRaJBNTJ--AV3Xj0O5kqACZob5D8Mvmfv8PmEE_K5mBJwA3mbI3Oz-7dDqITvROY818RSA293YehHwVknT9BIBl0qPzbBYEVBWtmpQOpnE2EjTt4kRs7H2DwQ8K2yokEZoBHzsu24QCDh1qlMjJ5siIbCewuiHdX82w2TXL7JksSKd-DHfdpt7KF0jXEV4n-QZvHzYHVj-Cq0ONrLYxWvJ3JmW-ajh7ma37lI_x0F7reIof1E9RF5cO9vORy6785cGQayayEY786ed4vLGikg7ONqw0Wb-tCGjaV1H2sHRTk-dfKnnH9p1xXgaaYdHOzt1ci_aVW3fSDs42vTUyb1okzfADCLt4Gjnp06eFz6dnK51R9ph0WanTu5Fu6JAaBVpB0e7OHVyL9osLW9AI-2gaP8B%26w%3D1100%26h%3D1040%26_sel%3Ds0%2Cs1%2Cs2%2Cs3%2Cs4%2Cs5%2Cs6%2Cs7%2Cs8%26_panel%3Dchoreograph&width=1360&height=1240&dpi=192&waitMs=3500&css=.fc-flash%7Bdisplay%3Anone%21important%7D%23tool-stage%2C%23tool-canvas%2C.tool-canvas%7Bbackground-image%3Anone%21important%7D&format=svg&walker=1&chrome=1&dark=1&filename=anim-choreograph-picker)

Select two or more boxes, right-click and choose **Choreograph…** (it is also in the **More** panel). Pick a showcase:

| Showcase | The arc |
| --- | --- |
| **Buildup** | Assembles from nothing: each box fades in from a little way out and settles into place, in reading order. |
| **Deconstruct** | The reverse: everything rests, then flies apart, and stays apart. |
| **The Loop** | Assembles, holds, flies apart. It ends exactly where it began, so an exported GIF or APNG cycles without a jump. |
| **Hero arc** | Explodes outward while the camera flies through the stack at an angle, then everything comes home. |
| **Trench run** | A small lift, with the camera inside the stack drifting along it so the layers stream past above and below. |
| **Map-scan** | The boxes hardly rise; the camera starts far back, glides in at an angle, then pans across the page in a few thrown-map moves before settling. |

Five **Launch recipes** follow the showcases. They move the selected members of a group together, and each has an **Apply** button that writes the recipe in one press, without a camera move:

| Launch recipe | The arc |
| --- | --- |
| **Editorial reveal** | Lift, settle and leave room to read. |
| **Type snap** | Anticipate, snap, settle. |
| **Feature cascade** | Deals the layers in a measured sequence. |
| **Assemble loop** | Arrive, hold, unwind, repeat. |
| **Soft drift loop** | Keeps the layout readable while gently moving, with the artwork visible throughout. |

![Buildup at 1.1 s: the first swatches have settled into place, the middle of the grid is still fading in from its exploded offset, and the last are yet to appear](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZjNj5pAFMD_Gi8mkjdvPjn0sKLuoWnT7qFJTwR1mpooNMAm6l_f-QBFdLMkLWQPiAwz7803v7w3j_XxUwETjNbZ0aQE4ZIic6nL2zvPXtOt3jqNFUUUMbK1wWrNf5OlZbJLTS7N8kOy99IJcjnfZPssDwp9SNJytwlKfSytfGH0TNmmOi11bjKH3Xa71ybDXa9FkhZ2iIBgNYsyf7XqX8m-0PUAke1iq_-Uv20l9-O8qu_WA80hbpuCm2561nlWlWjdymv09cHcnHx624vbm8azMXh934xYreK2-7te68qExzqLjzOCGHAen2aEsICq-GxeVFyQOIN4LaYlwVCYYgDITEExHh8hPkF89pVIvIY3RmnIGjpyV1tcF0ImclmQCzisOzgU5k9SjeAMAI704IBFBvGOF8orXmwhhP55wQsvsjsvyDhdrUZehjA0MnTAvGdomAAHDgmnJQKEvYNDWx7Kb8074KyWMqIjOEOAg_ziokJHQgsYTr2lIcICo_q3NKzlmToBs1zZawRmAGCosSq1a0J2x4sgofdMyvBChOqdF97yTJ14ISGCxJGXAXhhFCvP9NC-SEI9L9TwggJ750W0HJJQXRwSr3Zu5KVvXjhTtzHTGycZhQ1DQ2X_hka2HFMncJYcCV-O4AwAjmCsdkyPQqYQuefFnnyZZL3zolqOqRMvks6fkI-8DBFiGz6aIdNjO2OCJOK54VN7WIa-uQHyhayQ_fzx_WUBavXtmYoFRJ9fvj7b7U4OOk9an_uoj8XhgpTelFYpJh_pK1_1Ov4JpKvs42AEtdExTMxMdJ2bfH6CaUnNOq-wVOL_yMpf%26w%3D1100%26h%3D1040%26_t%3D1.1&width=1360&height=1000&dpi=192&waitMs=4500&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=anim-buildup-mid)

![Hero arc at 2.4 s: the camera pushed in and tilted, inside the exploded stack, every swatch lifted and leaning as it passes](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZhLi9swEMc_jS8Bm5mRRo9DD7vepKVQaLdQ6ElkE2-7kMTF9kKST19kOe8VCbROe0gedqL5z0hWfsxk_LR8V0NC-VO5TChHgu2RZHtsP_t3Vb4upsW0tfihXBDlXg3emlA-KRfN-GWRUL4oq_l4FkYTYn0_KWdlldXFfLxoXiZZUywbP_6QUC6Ndy0WTVEllM9fptNZkVDObdR6vKj9FBlSt4qmevXm5_Gs9ucfGGbxQabFr-anl7UP5s6jvSLYn2TjHF7QLnixLqqy-6Y2XsFS7E6yXVU4HkZpd2fvvDf55n0wY3cdh-FPom7EQrMrarcEtwK3BlejK9E9waBBIdgtUwSdMbtVigCZMG6NtK8S1gcozwulFuhqzIDkoGFgPp0zss69sT0bnqjVbisw0cMat_DJy-ETcH-nzQ2-q8AnRRw-GwBJEU5RAhGYi9m17VBTg4YR-0eNtqjpy1EjyWI0uqF2FdRY2Bhq0lq3PJe90PuX53XGcose2kHDhLZ39MRRiQ1bewa90VDn4obeddBTGM1yrNsSi7I1HaFEuKmsb9utDlkOfZYj23-Wk0cF9SLUhiP_vKF2HdSsiaGm2ISCSfKUNO9WxswMLEM5NYOGhTa9g8ZH5fQi0NASaLqBdhXQtKUYaJrJLSMpS3i3MmZmlCaAJgYNS029g6aOiqcylxRP7jb8Blr_oFmIZjSjzF7bGfk_xmAO29O3dUxqL8ex6T_H6aNiehF6Qybk4Q29q6CHADLGnlWyHX-r-1TerYyZWSgIpPkOQRnZO2nmqJpeRJoW93fEN9KuRJqBCGkEEnZdZyTJKe9enpOxFCqQx4OGtYK-yQP8hCMyj9--PXz5_FV-eC8_GkHfH63vWSfjeVGNj-4Mi3DfBLZQFpPGG1UX9F-yuCOx-zn_CMTd2P-D4SGD1RJctQL3DG7cllsI9lSAzmhz5y1F5aUpGVetkNyzZ87rhc9zXt_Jjcqkl1MrRy9PUe30W4h9EyJFRm6dhtAmLGMjVAAQWeVfxPc3%26w%3D1100%26h%3D1040%26_t%3D2.4&width=1360&height=1000&dpi=192&waitMs=4500&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=anim-hero-pov)

Below the recipes: **Length** in seconds (each showcase has its own, and follows the one you pick until you type a length), **Stagger** in milliseconds between one box and the next, **Order** (**First to last**, **Last to first**, **From the centre**, **By depth** or **Random**), **Camera move** and **Float**, a breath of scale as each box settles, so a grid never ticks like a metronome. Float and **Tumble** switch off for a Launch recipe. **Preview motion** plays the arc inside the dialog, with a slider to scrub through, and leaves your document unchanged until you choose **Choreograph**.

Two rules the generated moves keep. Every showcase except Deconstruct ends at rest: each box back at its own depth, the camera home. And a showcase over boxes that already have a timeline runs on that timeline: it starts where the earliest of them starts, and a box that enters late joins the move at the pose it has reached rather than replaying the opening.

Boxes with no timeline yet are given one: each becomes a clip from the start of the sequence for the arc's length, so the motion plays and exports.

Choreograph works on imported layers as well as native ones. Selected members of a group share their movement and timing, so a card's lettering stays with its surface; select the whole group when every member should move. The recipes leave each layer's text, colours, typography, resting position and opacity as they were. Choreograph works on one editable board, so import the page you want onto **Replace the board**, or use timed scenes to play whole pages in sequence. Select every loop layer for a complete export. IDML and Premiere XML exports do not carry these generated animations.

![The timeline after a Buildup: nine clips from 0 to 3 s, one lane each, every one carrying its own diamonds, and the playhead parked mid-arc](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZjNj5pAFMD_Gi8mkjdvPjn0sKLuoWnT7qFJTwR1mpooNMAm6l_f-QBFdLMkLWQPiAwz7803v7w3j_XxUwETjNbZ0aQE4ZIic6nL2zvPXtOt3jqNFUUUMbK1wWrNf5OlZbJLTS7N8kOy99IJcjnfZPssDwp9SNJytwlKfSytfGH0TNmmOi11bjKH3Xa71ybDXa9FkhZ2iIBgNYsyf7XqX8m-0PUAke1iq_-Uv20l9-O8qu_WA80hbpuCm2561nlWlWjdymv09cHcnHx624vbm8azMXh934xYreK2-7te68qExzqLjzOCGHAen2aEsICq-GxeVFyQOIN4LaYlwVCYYgDITEExHh8hPkF89pVIvIY3RmnIGjpyV1tcF0ImclmQCzisOzgU5k9SjeAMAI704IBFBvGOF8orXmwhhP55wQsvsjsvyDhdrUZehjA0MnTAvGdomAAHDgmnJQKEvYNDWx7Kb8074KyWMqIjOEOAg_ziokJHQgsYTr2lIcICo_q3NKzlmToBs1zZawRmAGCosSq1a0J2x4sgofdMyvBChOqdF97yTJ14ISGCxJGXAXhhFCvP9NC-SEI9L9TwggJ750W0HJJQXRwSr3Zu5KVvXjhTtzHTGycZhQ1DQ2X_hka2HFMncJYcCV-O4AwAjmCsdkyPQqYQuefFnnyZZL3zolqOqRMvks6fkI-8DBFiGz6aIdNjO2OCJOK54VN7WIa-uQHyhayQ_fzx_WUBavXtmYoFRJ9fvj7b7U4OOk9an_uoj8XhgpTelFYpJh_pK1_1Ov4JpKvs42AEtdExTMxMdJ2bfH6CaUnNOq-wVOL_yMpf%26w%3D1100%26h%3D1040%26_t%3D1.1&width=1440&height=1000&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A420px%21important%7D&cropSelector=.tl-panel&format=png&dark=1&filename=anim-timeline-choreographed)

## Text that arrives in pieces

A text box can enter and leave as a whole, or a piece at a time. In the timeline's **Motion** group, **Text** chooses the tier (**Whole text**, **Letter**, **Word** or **Line**), and every piece then plays the box's own **Enter** and **Exit** with its curve. **Offset starts by** is the gap between one piece starting and the next, in milliseconds, so a heading can drop in letter by letter or a list can fade in line by line. **Text order** decides who goes first: **First to last**, **Last to first**, **From the centre** or **Random**.

![The timeline with a text clip selected, and its strip showing Time, Motion and Keyframes](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26_sel%3Dfeat1&width=1440&height=900&dpi=192&waitMs=4500&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&drive=click%3A.dtb-intent%3Bwait%3A300%3Bclick%3A.dtb-menu-item%3Ahas-text%28%22Video%22%29%3Bwait%3A800&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-split-text)

Pieces are shaped glyphs, not a span per character, so a letter that kerns into its neighbour keeps that kerning while it moves, and the exported video, the animated image formats and the PowerPoint deck all play the same split. In PowerPoint the split becomes native per-letter, per-word or per-paragraph animation, so a deck stays editable in PowerPoint and still moves.

## While on screen

Between its entrance and its exit a box usually sits still. **While on screen** gives it something to do in the meantime: **Pulse**, **Bob**, **Sway** or **Flicker**, at a **Hold speed** in cycles per second. It is the same feature whether the box is a heading or a call-to-action sticker, and it plays in every motion export except dotLottie.

## Start from a motion starter

Design's template picker has a **Motion** collection of finished loops to adapt: **Editorial loop** (readable type and a geometric mark with gentle movement), **Feature cards** (three grouped cards assemble, hold and return) and **Photo title** (a graded [Darkroom](/info/darkroom.html) image beside editable type). Each is a 6 second loop with 4 and 8 second variants. Replace the artwork, or the photo with your own upload or an edited Darkroom share link, and keep the timing.

## Exporting a move

The preview and the file are the same arithmetic, so what you see is what you get.

- **Video**: MP4 or WebM, rendered frame by frame at exact times rather than recorded off the screen, so a curved motion path is followed exactly. See [Export a file](/info/exporting.html#video).
- **Animated images**: GIF, APNG and animated WebP come from the same frame-by-frame render. Springs play exactly as in the preview, on every device.
- **dotLottie** writes a spring as one value per frame, because Lottie has no springs, and a keyframe that follows the design system as the curve or spring the design system has at export time.
- **dotLottie** keeps position, scale, rotation and opacity keys on shapes, paths and still images, and fill colour, stroke colour, stroke width, corner radius and path trim on shapes and paths, as native Lottie animation. A curved motion path becomes native Lottie path tangents, which players walk at the same speed Lolly does; a curved stretch whose curve overshoots is written as one key per frame, because players stop at the end of a curve. It refuses depth, tilt, blur, a camera, text and Motion entrances, exits and While on screen, and says which layer; export video for those. See [Lottie animations](/info/sequence-editor.html#lottie-animations).
- **PowerPoint** places each object as it is drawn with no keyframes applied, and the export notes that an animation was left out.
- **A still** is the frame at the playhead. Park the playhead where the shot looks best and export.
- **A contact sheet** comes from the **Frames** field beside the output size: raise it and you get that many stills sampled across the sequence; see [stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition).
- **SVG stays vector.** A posed frame exports as real transforms with real blur and shadow filters, not a picture of a moment. Keyed colours, stroke widths, corner radii and trims export as their values at the playhead.
- **PDF is partly vector.** Box and text shadows stay vector; the Depth shadow and the content shadow follow the shape of the artwork itself, so a box using either exports as an image embedded in the PDF, as does a blurred one.

A keyframe track is an ordinary part of the design, so it travels in the link: share the URL and the recipient opens the same move. A long one packs itself into the short form (see [URL Mode](/info/url-mode.html)).
