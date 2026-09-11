# Animating: keyframes, depth and a camera

**Design** puts a timeline under the free canvas - **Sequence** is its name when a video composition is on it. [Using Lolly](/info/using.html#timeline-sequence) describes the timeline itself - the magnetic sequence row, the overlay lanes, the Always on strip, transitions and rendering - and [The sequence editor](/info/sequence-editor.html) covers editing in time. This page is about the layer above that: posing a box at one instant, lifting it off the page and flying a camera over the result.

Everything here runs on your device. Nothing plays on its own: the preview moves when you press play or drag the playhead, and what you see at any instant is exactly what an export of that instant contains.

## A keyframe is a pose at a moment

A keyframe records a box's position, its size, how see-through, how blurred and how far it lifts off the page - all at one instant. Two keyframes make a move, and Lolly fills in everything between them.

**+Keyframe** has two homes and one behaviour:

- the diamond at the end of the timeline's tool cluster, after the keyboard button;
- the diamond on the selected object's bar on the canvas, beside Duplicate and Delete.

`K` does the same from the keyboard. Whichever you use, the pose is written at the playhead for everything keyframable in the selection, in one commit - so one undo takes the whole thing back, even across a multi-selection.

If the thing you selected has no timing yet, that same press adds it to the timeline **and** writes its first keyframe together. One press, one undo step.

Each keyframe appears as a **diamond** on the clip's bar. `Alt + ←` and `Alt + →` step the playhead from one diamond to the next.

Nothing else creates a keyframe. Dragging a box, typing in a field or scrubbing the playhead never quietly adds one, which is the rule the whole feature is built on: nobody keyframes by accident.

A box that has never been animated shows one control instead - **Animate**, in its Keyframes group. Press it and a rest pose is written at the start of the clip, with everything exactly where it already was. From then on the box has a track, and the rest of this page applies to it.

## The playhead is the arm

There is no record button and no stopwatch. The playhead's position decides what an edit writes.

- **Parked on a diamond**, the canvas and the pose fields edit *that keyframe*. Drag the box, rotate it, resize it or type a number, and only that pose changes. A box resized on a diamond tweens its size between keyframes, and text inside it reflows as it goes.
- **Parked off every diamond**, the same edits change the box itself, which moves the whole animation with it. This is how you reposition a finished move without re-keying it.

The Keyframes group says which one you are in: its first line reads **Scene pose** off a diamond and **Keyframe @ 0:01.8** on one. Off a diamond the pose fields show the values the box is passing through at that instant, and all but Depth are inactive, because there is no keyframe to write to.

Scrubbing **latches onto diamonds**: drag the playhead near one and it snaps to it, so "edit the pose I can see" is the easy thing to do. Hold **Alt** to park between them.

Closing the timeline turns all of this off. The playhead is the arm, so the arm has to be visible.

## The Keyframes popup

The clip inspector is a row of grouped segments - **Time**, **Animate**, **Keyframes**, a speaker toggle for mute and the timed or always-on switch. Each segment shows one glance-value summary; press it and its controls open as a panel above the transport, wide enough to read.

The **Keyframes** panel holds everything one track can be edited with:

- the latch line, saying which keyframe you are on;
- the pose fields - **Depth**, **Scale**, **Opacity** and **Blur** (position, rotation and size are authored on the canvas instead);
- one row per keyframe: its time in milliseconds, its curve, **Duplicate** and **Delete**;
- **Remove N keyframes**, which is how you un-animate a box - the track is the animation, so removing it removes the state;
- the curve editor, docked at the bottom of the same panel.

Curves are the shipped set: **Linear**, **Ease out**, **Ease in**, **Ease in and out**, **Overshoot**, **Anticipate**, **Smooth**, **Snappy** and **Hold**, which keeps a value until the next keyframe. Drag a handle on the docked plot and the row switches to **Custom** with the curve you drew, so the presets are a way to learn the shape rather than a limit. A curve shapes movement; a fade always ramps evenly, whichever curve the keyframe carries.

Clicking a diamond selects it and opens this panel on that keyframe in one gesture. Dragging one moves it in time, and Alt-dragging leaves the original in place and drops a copy where you let go. Right-clicking one offers **Keyframe curve**, **Duplicate keyframe** and **Delete keyframe** without opening anything.

The keyframe rows are the keyboard and screen-reader route to the diamonds. Everything a diamond can do by pointer is a labelled button in that list.

![The Keyframes popup on a choreographed swatch: its diamonds listed with their times, the curve between two of them, and the pose fields for the one the playhead is parked on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZjNj5pAFMD_Gi8mkjdvPjn0sKLuoWnT7qFJTwR1mpooNMAm6l_f-QBFdLMkLWQPiAwz7803v7w3j_XxUwETjNbZ0aQE4ZIic6nL2zvPXtOt3jqNFUUUMbK1wWrNf5OlZbJLTS7N8kOy99IJcjnfZPssDwp9SNJytwlKfSytfGH0TNmmOi11bjKH3Xa71ybDXa9FkhZ2iIBgNYsyf7XqX8m-0PUAke1iq_-Uv20l9-O8qu_WA80hbpuCm2561nlWlWjdymv09cHcnHx624vbm8azMXh934xYreK2-7te68qExzqLjzOCGHAen2aEsICq-GxeVFyQOIN4LaYlwVCYYgDITEExHh8hPkF89pVIvIY3RmnIGjpyV1tcF0ImclmQCzisOzgU5k9SjeAMAI704IBFBvGOF8orXmwhhP55wQsvsjsvyDhdrUZehjA0MnTAvGdomAAHDgmnJQKEvYNDWx7Kb8074KyWMqIjOEOAg_ziokJHQgsYTr2lIcICo_q3NKzlmToBs1zZawRmAGCosSq1a0J2x4sgofdMyvBChOqdF97yTJ14ISGCxJGXAXhhFCvP9NC-SEI9L9TwggJ750W0HJJQXRwSr3Zu5KVvXjhTtzHTGycZhQ1DQ2X_hka2HFMncJYcCV-O4AwAjmCsdkyPQqYQuefFnnyZZL3zolqOqRMvks6fkI-8DBFiGz6aIdNjO2OCJOK54VN7WIa-uQHyhayQ_fzx_WUBavXtmYoFRJ9fvj7b7U4OOk9an_uoj8XhgpTelFYpJh_pK1_1Ov4JpKvs42AEtdExTMxMdJ2bfH6CaUnNOq-wVOL_yMpf%26w%3D1100%26h%3D1040%26_sel%3Ds4%26_t%3D1.1&width=1440&height=1000&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A320px%21important%7D&drive=click%3A.tl-group%5Bdata-group%3D%22keyframes%22%5D%20.tl-group-head%3Bwait%3A600&cropSelector=.tl-group-pop-body&walker=1&format=svg&dark=1&filename=anim-keyframes-popup)

## Depth lifts a box off the page

**Depth** is the first pose field, and it is the one that stays live even when you are parked between keyframes. It says how far the box stands above the surface: `0` is flat on the page, the slider scrubs the useful band of 0 to 300 and the number beside it takes anything from `-300` (sunken) to `900`.

- Off a diamond, Depth writes the box's own depth, so the box is simply lifted for as long as it runs.
- On a diamond, Depth poses that keyframe, so a box can rise and settle again.

Depth on its own changes how the camera sees the box: lifted layers move further and faster than the page behind them. To make the lift readable when nothing is moving, give the box a shadow that follows its depth. The object bar's **More** panel has a **Shadow** section whose **Apply to** row offers **Depth** beside Box, Text and Content; it derives a soft shadow from the box's own height above the page, so the higher the box, the further it casts.

The first time you move Depth, a **Camera** appears in the Always on strip. Depth already works without it - the camera box is what makes the shot itself editable.

## Tilt a box

A box can hold a **perspective pose** of its own: pitch and yaw, up to 75 degrees each way, with the vanishing point at the box's centre. The object bar's **More** panel has a **Perspective tilt** section with the two sliders; the timeline's Keyframes popup carries the same pair as pose fields, so a tilt can be keyframed like depth - the keyed value replaces the authored one for its segment, and everything the arc grammar says about coming home applies.

A tilted box renders with real perspective everywhere - the canvas, a still, a frame of video - and one honest trade: because a tilted plane is beyond what the vector formats can say, an SVG or PDF export embeds that box as an image (the export says so), and a **video** export of a tilted scene runs on the slower capture path. Choreograph's **Tumble** option rides this feature and is off by default for exactly that reason.

## The camera

Select the **Camera** chip and the inspector swaps its Time and Animate groups for a **Camera** group.

Five moves write a complete track in one press, each one an ordinary set of keyframes you can then edit or delete:

| Move | What it does |
| --- | --- |
| **Push in** | Travels toward the artwork and stops. |
| **Pull back** | Starts close and settles at the resting frame. |
| **Pan across** | Slides sideways, so lifted layers part at different speeds. |
| **Rise** | Climbs over the composition, easing a little closer as it goes. |
| **Reveal** | Starts close and soft, then settles sharp at the resting frame. The depth-of-field demo. |

**Orbit** sits beside them, dimmed, and says why: it needs the angled camera that is still being built.

![The Camera group with the camera selected: the five moves as one-press buttons, and the pan, tilt, dolly, focus, aperture and FOV strength channels under them](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZhLi9swEMc_jS8Bm5mRRo9DD7vepKVQaLdQ6ElkE2-7kMTF9kKST19kOe8VCbROe0gedqL5z0hWfsxk_LR8V0NC-VO5TChHgu2RZHtsP_t3Vb4upsW0tfihXBDlXg3emlA-KRfN-GWRUL4oq_l4FkYTYn0_KWdlldXFfLxoXiZZUywbP_6QUC6Ndy0WTVEllM9fptNZkVDObdR6vKj9FBlSt4qmevXm5_Gs9ucfGGbxQabFr-anl7UP5s6jvSLYn2TjHF7QLnixLqqy-6Y2XsFS7E6yXVU4HkZpd2fvvDf55n0wY3cdh-FPom7EQrMrarcEtwK3BlejK9E9waBBIdgtUwSdMbtVigCZMG6NtK8S1gcozwulFuhqzIDkoGFgPp0zss69sT0bnqjVbisw0cMat_DJy-ETcH-nzQ2-q8AnRRw-GwBJEU5RAhGYi9m17VBTg4YR-0eNtqjpy1EjyWI0uqF2FdRY2Bhq0lq3PJe90PuX53XGcose2kHDhLZ39MRRiQ1bewa90VDn4obeddBTGM1yrNsSi7I1HaFEuKmsb9utDlkOfZYj23-Wk0cF9SLUhiP_vKF2HdSsiaGm2ISCSfKUNO9WxswMLEM5NYOGhTa9g8ZH5fQi0NASaLqBdhXQtKUYaJrJLSMpS3i3MmZmlCaAJgYNS029g6aOiqcylxRP7jb8Blr_oFmIZjSjzF7bGfk_xmAO29O3dUxqL8ex6T_H6aNiehF6Qybk4Q29q6CHADLGnlWyHX-r-1TerYyZWSgIpPkOQRnZO2nmqJpeRJoW93fEN9KuRJqBCGkEEnZdZyTJKe9enpOxFCqQx4OGtYK-yQP8hCMyj9--PXz5_FV-eC8_GkHfH63vWSfjeVGNj-4Mi3DfBLZQFpPGG1UX9F-yuCOx-zn_CMTd2P-D4SGD1RJctQL3DG7cllsI9lSAzmhz5y1F5aUpGVetkNyzZ87rhc9zXt_Jjcqkl1MrRy9PUe30W4h9EyJFRm6dhtAmLGMjVAAQWeVfxPc3%26w%3D1100%26h%3D1040%26_t%3D0.5&width=1440&height=1000&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A320px%21important%7D&drive=click%3A.tl-chip%3Bwait%3A500%3Bclick%3A.tl-group%5Bdata-group%3D%22camera%22%5D%20.tl-group-head%3Bwait%3A600&cropSelector=.tl-group-pop-body&walker=1&format=svg&dark=1&filename=anim-camera-moves)

Under the moves are the camera's own channels - **Pan X** and **Pan Y**, **Dolly**, **Focus**, **Aperture** and **FOV strength** - each with the gesture that drives it. With the camera selected and the playhead inside its window, dragging empty canvas pans the shot and a plain scroll dollies it. Cmd/Ctrl-scroll still zooms *your view*, and Space-drag still pans your view: moving the shot and moving your own window onto it stay separate gestures. Clicking any box hands both back.

Two things to know about the model:

- A camera holding a **single pose** is the scene default. Pan it, dolly it or change its focus and the whole shot changes, with no keyframes involved.
- **Cuts come from a second camera.** Park the playhead where you want the cut, choose **Camera** from the timeline's `+` menu and click the canvas to drop it (the same two steps every kind added from the timeline takes). It arrives as a clip starting at that instant, and from there the shot looks through it.

**Focus** is a distance and **Aperture** is how shallow the focus is; at `0` everything is sharp, and raising it softens whatever sits away from the focus distance. **FOV strength** changes the perspective, not the magnification - it is a dolly (the camera's own Depth) that makes things bigger.

> Today's camera moves stay square to the page: it travels, but it does not tilt. Angled, point-of-view glides low over the artwork are being built.

## Lift layers: one SVG into a stack

A flat SVG is one picture. **Lift layers** turns it into a stack of boxes, one per layer of the drawing, so each layer can carry its own depth, keyframes and blur.

Right-click a box holding an SVG and choose **Lift layers** (it is also in the **More** panel on the object bar). The dialog reads the artwork, then says what it found - **6 layers found**, with the number of shapes in each. Press **Lift layers** to accept, and the box is replaced by that many boxes, in the same place, sharing a group, with their depth staggered and the Depth shadow already set. It is one commit, so one undo puts the original picture back.

The list is a plan, not a promise. On a screenshot exported from a Lolly canvas the layers really are the objects the editor knows about. On anything else - a page you captured, a drawing from another app - the split is read off the artwork's own groups and geometry, so read the list before you accept it. Artwork that is genuinely one layer says so and offers nothing to do.

## Choreograph: one click, a whole motion arc

A lifted stack, a grouped selection or a grid of swatches is a set of boxes that want to move together. **Choreograph** writes that motion for you: every box gets its own keyframes, staggered a little after the box before it, and the camera gets a move of its own, all in one commit. Nothing is stored by name - what you get is ordinary keyframes, so you can retime, split or delete any of them afterwards, and one undo takes the whole arc back.

![Choreograph: nine swatches selected, and the picker offering the six showcases with Buildup checked, Length 3, Stagger 90, Order, Camera move and Float](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTNboQgEMefhquBUcQeelipvoertDVRaJBNTJ--AV3Xj0O5kqACZob5D8Mvmfv8PmEE_K5mBJwA3mbI3Oz-7dDqITvROY818RSA293YehHwVknT9BIBl0qPzbBYEVBWtmpQOpnE2EjTt4kRs7H2DwQ8K2yokEZoBHzsu24QCDh1qlMjJ5siIbCewuiHdX82w2TXL7JksSKd-DHfdpt7KF0jXEV4n-QZvHzYHVj-Cq0ONrLYxWvJ3JmW-ajh7ma37lI_x0F7reIof1E9RF5cO9vORy6785cGQayayEY786ed4vLGikg7ONqw0Wb-tCGjaV1H2sHRTk-dfKnnH9p1xXgaaYdHOzt1ci_aVW3fSDs42vTUyb1okzfADCLt4Gjnp06eFz6dnK51R9ph0WanTu5Fu6JAaBVpB0e7OHVyL9osLW9AI-2gaP8B%26w%3D1100%26h%3D1040%26_sel%3Ds0%2Cs1%2Cs2%2Cs3%2Cs4%2Cs5%2Cs6%2Cs7%2Cs8%26_panel%3Dchoreograph&width=1360&height=1240&dpi=192&waitMs=3500&css=.fc-flash%7Bdisplay%3Anone%21important%7D%23tool-stage%2C%23tool-canvas%2C.tool-canvas%7Bbackground-image%3Anone%21important%7D&format=png&dark=1&filename=anim-choreograph-picker)

Select two or more boxes, right-click and choose **Choreograph…** (it is also in the **More** panel). Pick a showcase:

| Showcase | The arc |
| --- | --- |
| **Buildup** | Assembles from nothing: each box fades in from a little way out and settles into place, in reading order. |
| **Deconstruct** | The reverse: everything rests, then flies apart, and stays apart. |
| **The Loop** | Assembles, holds, flies apart. It ends exactly where it began, so an exported GIF or APNG cycles without a jump. |
| **Hero arc** | Explodes outward while the camera flies through the stack at an angle, then everything comes home. |
| **Trench run** | A small lift, with the camera inside the stack drifting along it so the layers stream past above and below. |
| **Map-scan** | The boxes hardly rise; the camera starts far back, glides in at an angle, then pans across the page in a few thrown-map moves before settling. |

![Buildup at 1.1 s: the first swatches have settled into place, the middle of the grid is still fading in from its exploded offset, and the last are yet to appear](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZjNj5pAFMD_Gi8mkjdvPjn0sKLuoWnT7qFJTwR1mpooNMAm6l_f-QBFdLMkLWQPiAwz7803v7w3j_XxUwETjNbZ0aQE4ZIic6nL2zvPXtOt3jqNFUUUMbK1wWrNf5OlZbJLTS7N8kOy99IJcjnfZPssDwp9SNJytwlKfSytfGH0TNmmOi11bjKH3Xa71ybDXa9FkhZ2iIBgNYsyf7XqX8m-0PUAke1iq_-Uv20l9-O8qu_WA80hbpuCm2561nlWlWjdymv09cHcnHx624vbm8azMXh934xYreK2-7te68qExzqLjzOCGHAen2aEsICq-GxeVFyQOIN4LaYlwVCYYgDITEExHh8hPkF89pVIvIY3RmnIGjpyV1tcF0ImclmQCzisOzgU5k9SjeAMAI704IBFBvGOF8orXmwhhP55wQsvsjsvyDhdrUZehjA0MnTAvGdomAAHDgmnJQKEvYNDWx7Kb8074KyWMqIjOEOAg_ziokJHQgsYTr2lIcICo_q3NKzlmToBs1zZawRmAGCosSq1a0J2x4sgofdMyvBChOqdF97yTJ14ISGCxJGXAXhhFCvP9NC-SEI9L9TwggJ750W0HJJQXRwSr3Zu5KVvXjhTtzHTGycZhQ1DQ2X_hka2HFMncJYcCV-O4AwAjmCsdkyPQqYQuefFnnyZZL3zolqOqRMvks6fkI-8DBFiGz6aIdNjO2OCJOK54VN7WIa-uQHyhayQ_fzx_WUBavXtmYoFRJ9fvj7b7U4OOk9an_uoj8XhgpTelFYpJh_pK1_1Ov4JpKvs42AEtdExTMxMdJ2bfH6CaUnNOq-wVOL_yMpf%26w%3D1100%26h%3D1040%26_t%3D1.1&width=1360&height=1000&dpi=192&waitMs=4500&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=anim-buildup-mid)

![Hero arc at 2.4 s: the camera pushed in and tilted, inside the exploded stack, every swatch lifted and leaning as it passes](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZhLi9swEMc_jS8Bm5mRRo9DD7vepKVQaLdQ6ElkE2-7kMTF9kKST19kOe8VCbROe0gedqL5z0hWfsxk_LR8V0NC-VO5TChHgu2RZHtsP_t3Vb4upsW0tfihXBDlXg3emlA-KRfN-GWRUL4oq_l4FkYTYn0_KWdlldXFfLxoXiZZUywbP_6QUC6Ndy0WTVEllM9fptNZkVDObdR6vKj9FBlSt4qmevXm5_Gs9ucfGGbxQabFr-anl7UP5s6jvSLYn2TjHF7QLnixLqqy-6Y2XsFS7E6yXVU4HkZpd2fvvDf55n0wY3cdh-FPom7EQrMrarcEtwK3BlejK9E9waBBIdgtUwSdMbtVigCZMG6NtK8S1gcozwulFuhqzIDkoGFgPp0zss69sT0bnqjVbisw0cMat_DJy-ETcH-nzQ2-q8AnRRw-GwBJEU5RAhGYi9m17VBTg4YR-0eNtqjpy1EjyWI0uqF2FdRY2Bhq0lq3PJe90PuX53XGcose2kHDhLZ39MRRiQ1bewa90VDn4obeddBTGM1yrNsSi7I1HaFEuKmsb9utDlkOfZYj23-Wk0cF9SLUhiP_vKF2HdSsiaGm2ISCSfKUNO9WxswMLEM5NYOGhTa9g8ZH5fQi0NASaLqBdhXQtKUYaJrJLSMpS3i3MmZmlCaAJgYNS029g6aOiqcylxRP7jb8Blr_oFmIZjSjzF7bGfk_xmAO29O3dUxqL8ex6T_H6aNiehF6Qybk4Q29q6CHADLGnlWyHX-r-1TerYyZWSgIpPkOQRnZO2nmqJpeRJoW93fEN9KuRJqBCGkEEnZdZyTJKe9enpOxFCqQx4OGtYK-yQP8hCMyj9--PXz5_FV-eC8_GkHfH63vWSfjeVGNj-4Mi3DfBLZQFpPGG1UX9F-yuCOx-zn_CMTd2P-D4SGD1RJctQL3DG7cllsI9lSAzmhz5y1F5aUpGVetkNyzZ87rhc9zXt_Jjcqkl1MrRy9PUe30W4h9EyJFRm6dhtAmLGMjVAAQWeVfxPc3%26w%3D1100%26h%3D1040%26_t%3D2.4&width=1360&height=1000&dpi=192&waitMs=4500&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=anim-hero-pov)

Below the showcases: **Length** in seconds (each showcase has its own, and follows the one you pick until you type a length), **Stagger** in milliseconds between one box and the next, **Order** (reading order, reversed, from the centre, by depth or random), **Camera move** and **Float** - a breath of scale as each box settles, so a grid never ticks like a metronome.

Two rules the generated moves keep. Every showcase except Deconstruct ends at rest: each box back at its own depth, the camera home. And a showcase over boxes that already have a timeline runs on that timeline - it starts where the earliest of them starts, and a box that enters late joins the move at the pose it has reached rather than replaying the opening.

Boxes with no timeline yet are given one: each becomes a clip from the start of the sequence for the arc's length, which is what makes the motion play and export at all.

![The timeline after a Buildup: nine clips from 0 to 3 s, one lane each, every one carrying its own diamonds, and the playhead parked mid-arc](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZjNj5pAFMD_Gi8mkjdvPjn0sKLuoWnT7qFJTwR1mpooNMAm6l_f-QBFdLMkLWQPiAwz7803v7w3j_XxUwETjNbZ0aQE4ZIic6nL2zvPXtOt3jqNFUUUMbK1wWrNf5OlZbJLTS7N8kOy99IJcjnfZPssDwp9SNJytwlKfSytfGH0TNmmOi11bjKH3Xa71ybDXa9FkhZ2iIBgNYsyf7XqX8m-0PUAke1iq_-Uv20l9-O8qu_WA80hbpuCm2561nlWlWjdymv09cHcnHx624vbm8azMXh934xYreK2-7te68qExzqLjzOCGHAen2aEsICq-GxeVFyQOIN4LaYlwVCYYgDITEExHh8hPkF89pVIvIY3RmnIGjpyV1tcF0ImclmQCzisOzgU5k9SjeAMAI704IBFBvGOF8orXmwhhP55wQsvsjsvyDhdrUZehjA0MnTAvGdomAAHDgmnJQKEvYNDWx7Kb8074KyWMqIjOEOAg_ziokJHQgsYTr2lIcICo_q3NKzlmToBs1zZawRmAGCosSq1a0J2x4sgofdMyvBChOqdF97yTJ14ISGCxJGXAXhhFCvP9NC-SEI9L9TwggJ750W0HJJQXRwSr3Zu5KVvXjhTtzHTGycZhQ1DQ2X_hka2HFMncJYcCV-O4AwAjmCsdkyPQqYQuefFnnyZZL3zolqOqRMvks6fkI-8DBFiGz6aIdNjO2OCJOK54VN7WIa-uQHyhayQ_fzx_WUBavXtmYoFRJ9fvj7b7U4OOk9an_uoj8XhgpTelFYpJh_pK1_1Ov4JpKvs42AEtdExTMxMdJ2bfH6CaUnNOq-wVOL_yMpf%26w%3D1100%26h%3D1040%26_t%3D1.1&width=1440&height=1000&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A420px%21important%7D&cropSelector=.tl-panel&format=png&dark=1&filename=anim-timeline-choreographed)

## Text that arrives in pieces

A text box can enter and leave as a whole, or a piece at a time. In the timeline's **Animate** section, **Text** chooses the tier - **Whole text**, **Letter**, **Word** or **Line** - and every piece then plays the box's own **Enter** and **Exit** with its curve. **Offset starts by** is the gap between one piece starting and the next, in milliseconds, so a heading can drop in letter by letter or a list can fade in line by line. **Text order** decides who goes first: **First to last**, **Last to first**, **From the centre** or **Random**.

![The timeline with a text clip selected: its strip carries Time, Speed and the Motion group, where Text chooses the split tier and Offset starts by, Text order and While on screen follow](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26_sel%3Dfeat1&width=1440&height=900&dpi=192&waitMs=4500&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-split-text)

Pieces are shaped glyphs, not a span per character, so a letter that kerns into its neighbour keeps that kerning while it moves, and the exported video, animated SVG and PowerPoint deck all play the same split. In PowerPoint the split becomes native per-letter, per-word or per-paragraph animation, so a deck stays editable in PowerPoint and still moves.

## While on screen

Between its entrance and its exit a box usually sits still. **While on screen** gives it something to do in the meantime: **Pulse**, **Bob**, **Sway** or **Flicker**, at a **Hold speed** in cycles per second. It is the same feature whether the box is a heading or a call-to-action sticker, and it plays in every motion export.

## Exporting a move

The preview and the file are the same arithmetic, so what you see is what you get.

- **Video** - MP4 or WebM, rendered frame by frame at exact times rather than recorded off the screen. See [Exporting & Formats](/info/exporting.html).
- **A still** is the frame at the playhead. Park the playhead where the shot looks best and export.
- **A contact sheet** comes from the **Frames** field beside the output size: raise it and you get that many stills sampled across the sequence - see [stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition).
- **SVG stays vector.** A posed frame exports as real transforms with real blur and shadow filters, not a picture of a moment.
- **PDF is partly vector.** Box and text shadows stay vector; the Depth shadow and the content shadow follow the shape of the artwork itself, so a box using either exports as an image embedded in the PDF, as does a blurred one.

A keyframe track is an ordinary part of the design, so it travels in the link like everything else: share the URL and the recipient opens the same move. (A long one packs itself into the short form - see [URL Mode](/info/url-mode.html).)
