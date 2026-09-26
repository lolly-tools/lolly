# The sequence editor

**Sequence**, Design's timeline, puts time under the free canvas: every box can start at a moment, run for a length and animate in and out. [Using Lolly](/info/using.html#timeline-sequence) covers the layout of the timeline - the magnetic sequence row, the free overlay lanes, the Always on strip, transitions and rendering. This page covers selection, ghosts, trimming, project timing, markers and exporting a chosen range.

Everything here happens on your device. Timeline edits change the composition; viewing aids do not. The chrome described below - ghosts, badges, banners, outlines - lives outside the exported node, so a file exported with onion skin on is byte-identical to the same file exported with it off.

![The timeline, tool bar first: add, record, the split blade with its resolved label, snap, onion skin, zoom, fit and the keyboard shortcuts sheet, over the ruler, the overlay lane, the magnetic sequence row and the Always on strip](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Long sequences scroll horizontally and vertically inside the tracks panel. Use a trackpad or wheel, drag an empty track area on touch, or focus the tracks and use the arrow and Page keys. Editing a track keeps both scroll positions.

## The one rule

A timed canvas is a window onto **one instant**. One sentence governs everything you can touch, and it is written into the editor's own source at `shells/web/src/views/free-canvas.ts` so the code and this page cannot say different things:

> "The canvas edits exactly what the canvas shows at the playhead. Moving the playhead never changes the selection; selecting in the timeline moves the playhead so the selection stays live; when a selection is nevertheless off-playhead, the canvas says so and offers to reconcile. The timeline inspector and the sidebar are the precision fallbacks and are never gated by time."

Read the three clauses as three promises.

**Moving the playhead never changes what is selected.** Scrubbing is looking, not choosing. This is the direction that goes wrong in other editors: when time drives selection, you type a value into a panel and it hits whichever clip happened to be under the playhead rather than the one you picked.

**Selecting in the timeline moves the playhead.** Click a clip's bar and the playhead steps inside it, so the thing you just selected is the thing on screen. It only moves when it has to: never while playing, never for an Always on box (which has no time of its own) and never when the playhead is already inside the clip.

**An off-playhead selection says so.** Selection can still end up pointing at something the canvas is not showing - you selected a clip, then scrubbed away. Rather than leave editing furniture floating over nothing, the canvas takes the outline, the eight resize handles, the rotate handle and the contextual bar down, and raises a small banner with a **Go to it** button that seeks to the clip's start. The banner is suppressed during playback, where scenes coming and going is the point.

While a selection is off-playhead the keyboard refuses every key that would change the model - the arrows, Delete, duplicate, group, z-order and starting a text edit. Escape, Tab and Select all keep working. Nothing is silently dropped: either the edit applies to what you can see, or it does not happen.

**The fallbacks are never gated.** The timeline's own inspector (Length, Trim in, Speed, the two transitions, Mute) and the tool sidebar edit the selected clip whatever the playhead is doing. They are the precision route, and the accessible one.

![A clip selected in the sequence row: the playhead has stepped inside it, the canvas shows that scene with its selection outline and handles, and the timeline inspector fills with the clip’s Length, Trim in, Speed and transitions](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D%23tool-stage%7Bbackground-image%3Anone%21important%7D&drive=click%3A.tool-canvas%7Cat%3D0.5%2C0.5%3Bclick%3A.tl-ruler%7Cat%3D0.62%2C0.5&walker=1&format=svg&dark=1&filename=seq-rule-selection)

### What a click on the canvas hits

Clips that are not live at the playhead are not painted, and a click **falls through** them to the topmost visible box underneath - the same resolution a click already uses for a stack of overlapping boxes, so it needs no explanation in the moment and produces no interruption. Ghosted onion-skin frames are drawn in a layer that ignores the pointer entirely, so they can never be clicked either.

The one state that does get words is the stuck one: a selection that is off-playhead, which is exactly the case you cannot reason your way out of by clicking somewhere else.

![The canvas at one instant: only the clip live at the playhead is painted, so a click hits it or falls through to whatever is underneath](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D%23tool-stage%7Bbackground-image%3Anone%21important%7D&drive=wait%3A600&cropBottom=0.35&walker=1&format=svg&dark=1&filename=seq-click-live-scene)

## Onion skin

Animators want to see the frame before and the frame after. **Onion skin** shows the neighbouring clips as ghosts over the live one.

It is **off by default and stays off until you turn it on**, and the preference is remembered on this device. That is not caution for its own sake. No mainstream video editor ghosts adjacent clips, and the reason is visible the moment you try it: a Lolly scene is usually an opaque, full-frame, brand-coloured composition that entirely replaces its neighbour, so laying two of them over each other at a third opacity produces colour mud and hides the one thing you are judging.

- The **Onion skin** button in the timeline's tool bar toggles it. `Shift+O` does the same from the keyboard.
- **Long-press** the button, right-click it or press `Alt+Shift+O` for its options: the mode, how many clips to ghost before and after (up to two each, independently) and the strength.

![The onion skin options popover: the mode, how many scenes to ghost before and after and the strength](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D.fc-toolbar-dock%7Bdisplay%3Anone%21important%7D&drive=click%3A.tl-mobile-tools%3Bclick%3A.tl-onion%3Bpress%3AAlt%2BShift%2BO&cropSelector=.tl-onion-pop&format=svg&walker=1&dark=1&filename=seq-onion-options)
- **Outlines** is the default mode - each neighbour as a plain rectangle where its boxes sit. It stays readable *over* an opaque scene, which a filled ghost cannot. **Filled** adds each ghost's own colour and picture, for the animation-style work that wants it.
- Past clips are drawn warm, future clips cool blue. Colour is never the only signal: each ghost carries a small `-1` / `+2` chip in its corner saying how far away in the sequence it is, so the direction survives any kind of colour vision. With **Hide colourful previews** on (see [Inclusive Design](/info/inclusive-design.html)) filled mode falls back to outlines.

![Onion skin on: the neighbouring scenes drawn as ghosts over the live one, each carrying a small -1 or +1 chip saying how far away in the sequence it is](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D%23tool-stage%7Bbackground-image%3Anone%21important%7D.fc-toolbar-dock%7Bdisplay%3Anone%21important%7D&drive=click%3A.tl-mobile-tools%3Bclick%3A.tl-onion%3Bhover%3A.tl-ruler%7Cat%3D0.01%2C0.5&cropBottom=0.35&format=svg&walker=1&chrome=1&dark=1&filename=seq-onion-ghosts)

**Onion skin cannot reach a file.** The ghosts are drawn in the editor's overlay layer, which is a sibling of the exported canvas rather than a part of it, and they are additionally tagged so the export path strips them before any format is written. They never set a class or a style on a real box. An export taken with ghosts on screen is the same bytes as one taken without.

## Splitting a clip

**Split at playhead** cuts one clip into two at the current instant. The blade is in the tool bar, `S` does it from the keyboard and it is in a clip's right-click menu.

**The button says what it will cut before you press it.** It reads *Split clip* when the playhead is inside one, *Split 3 clips* when a selection spans it and *Split at playhead* - greyed out - when there is nothing to cut. A refusal you can see beforehand beats a refusal announced afterwards.

![The split blade naming its own scope before it is pressed: with the playhead inside a clip the tooltip reads Split clip](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1100&height=760&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D%5Bdata-tip%5D%3A%3Aafter%7Bbottom%3Aauto%21important%3Btop%3Acalc%28100%25%20%2B%208px%29%21important%7D%5Bdata-tip%5D%3A%3Abefore%7Bbottom%3Aauto%21important%3Btop%3Acalc%28100%25%20%2B%203px%29%21important%3Bborder-top-color%3Atransparent%21important%3Bborder-bottom-color%3Ahsl%28var%28--foreground%29%29%21important%7D&drive=click%3A.tl-ruler%7Cat%3D0.42%2C0.5%3Bhover%3A.tl-split&cropSelector=.tl-panel&format=svg&walker=1&dark=1&filename=seq-split-blade)

The scope resolves in one order, everywhere:

1. every **selected** clip the playhead is inside, so a deliberate multi-selection cuts through all of it in one press;
2. failing that, the **sequence clip under the playhead** - the "just cut here" case, which should not need selecting anything first;
3. failing that, nothing is written and the panel says why.

`Shift+S` (or Shift-clicking the blade) is the wider variant: every timed clip the playhead is inside, on every lane, ignoring the selection. Whichever route you take, the whole cut is a **single undo step**.

The cut snaps to clip edges and whole seconds like every other timeline gesture, so pressing it twice at the same spot snaps exactly onto the existing cut and does nothing at all - no write, no undo entry.

### Through edits, and Join

A cut you have not acted on yet is a **through edit**: the two halves still run continuously, and the sequence plays as if the cut were not there. Those seams are marked with a hairline rather than left to look like every other edit, so at a glance you can tell which cuts are decisions and which are just "I cut here and then changed my mind".

![A through edit: the two halves of a fresh cut still run continuously, and the seam is marked with a hairline rather than looking like every other edit](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1100&height=760&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D.fc-toolbar-dock%7Bdisplay%3Anone!important%7D&drive=click%3A.tl-ruler%7Cat%3D0.42%2C0.5%3Bclick%3A.tl-split%3Bhover%3A.tl-ruler%7Cat%3D0.01%2C0.5&cropSelector=.tl-panel&format=svg&walker=1&dark=1&filename=seq-through-edit)

Click the seam and the transition dialog offers **Join clips** alongside Cut and Crossfade. Join is also in a clip's right-click menu, and it works from either side - select one half, join and the two become one clip again with the second half's ending restored. It is only offered where it is real: a seam whose sides have been trimmed apart, sped up differently or given a transition is a decision, and it gets no Join.

![The transition dialog opened from a seam: Cut, Crossfade, a length and Join clips - offered only where the two sides are still continuous](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D.fc-toolbar-dock%7Bdisplay%3Anone!important%7D&drive=click%3A.tl-ruler%7Cat%3D0.42%2C0.5%3Bclick%3A.tl-split%3Bclick%3A.tl-seam.is-through&cropSelector=.tl-junction-modal&format=svg&walker=1&dark=1&filename=seq-junction-dialog)

## Crossfades you can see and drag

A crossfade is drawn on the timeline where it happens: a band that starts at the cut and lies over the head of the next clip, as wide as the crossfade is long. For that stretch both pictures are on screen. The first clip stays at rest right up to the cut, then fades out across the band while the next clip fades in under it, and the two sounds cross at equal power so the level does not sag. The preview and the exported file use the same rule, so what you see at the seam is what you get.

Drag the grip at the band's right end to change the length. It moves in steps of one project frame, it stops at the length of the clip it hands over to, and a badge reads the length as you go. Drag it back to the cut and the crossfade becomes a cut. To make a crossfade out of a plain cut, pull the seam to the right. Escape cancels a drag, and each drag is one undo step. A click on the seam still opens the dialog, where the same length is a number you can type.

If the first clip runs out of footage before the crossfade ends, that part of the band is hatched. The export holds the clip's last frame there and never invents picture, so trim the clip shorter or shorten the crossfade if a frozen frame is not what you want.

A clip that animates in or out on its own carries a wedge at its head or its tail, as wide as that animation is long, so you can see which clips move without selecting each one. Hover the clip and a grip shows on the wedge's inner end: drag it to make the animation longer or shorter, up to half the clip. A wedge too narrow to grab shows no grip, so zoom in to reach it. A seam between a clip that fades out and a clip that rises in is not a crossfade, and the dialog says so: choosing Cut or Crossfade there replaces the two clips' own transitions.

Undo follows what you did, not the clock. One drag is one step however long you take over it, and adding, deleting, pasting or splitting a clip is always a step of its own, so two quick edits never undo together.

Copy and paste work on clips. A pasted main-row clip goes in after the clip under the playhead and the row closes up around it. A pasted overlay starts at the playhead.

## Detaching a clip's audio

**Detach audio** pulls a video clip's sound onto its own overlay lane, where it can be trimmed, moved and mixed on its own. It is in the clip's right-click menu and on `Shift+D`.

The two halves stay **linked**, and the link is written on both of them:

- the picture is muted and carries a chain mark saying where its sound went;
- the sound carries the same mark back;
- selecting either selects both, so they move together by default. Alt-click selects just the one you clicked.
- **Re-attach audio** puts it back, from either side, un-muting the picture and removing the detached sound.

This is deliberately not the one-way detach some editors ship, where the only way to resync is Undo. A link that survives being split - split the muted picture and both halves still name the sound - is what makes detaching a safe thing to try.

Detach is only offered where it means something: the tool has to declare the field that stores the link and have an audio clip kind to create, and the clip has to be a video that is not already linked.

A video clip's menu carries a second video-only entry, **Remove background…**, which makes a transparent alternative of the clip on your device - an animated cut-out with real alpha - so a track can shed its backdrop without leaving the timeline. It offers the same on-device model and colour-key methods documented for [Assets](/info/using.html#assets-your-library), and the cut-out is saved as its own asset.

![A clip’s right-click menu. This clip is a card, so it offers Split at playhead, Make always on and Delete - Detach audio is absent because there is no sound to detach](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D.fc-toolbar-dock%7Bdisplay%3Anone!important%7D&drive=click%3A.tl-clip-seq%7Cright%7Cat%3D0.5%2C0.15&cropSelector=.tl-ctx-menu&format=svg&walker=1&dark=1&filename=seq-clip-menu)

## Sound

Select any clip with audio - an audio box, or a video's soundtrack - and the inspector grows a sound strip. Every control is an icon with its name on hover, and the two level controls open a **tall fader over the timeline** when pressed, where there is room to be precise; the number beside each takes typed values.

- **Volume** (0-200%). Above 100% boosts the exported file; the preview plays at 100% and the control says so. The diamond beside it **keys the level at the playhead** - volume automation that rides the same keyframe grammar as motion, so splitting or trimming a clip carries its volume curve with it. The bolt **normalizes**: one press measures the clip and sets its level so it plays at -16 LUFS.
- **Pan** (-100..100). Equal-power, the same law in preview and file.
- **Under other audio.** A music bed asked to sit under speech drops wherever the *other* clips actually make sound - measured from their audio, not just their length - and comes back up in the gaps.
- **Effect.** Fourteen presets, from **Voice cleanup** (an on-device model that removes background noise; nothing is uploaded) through tone shapes, reverb spaces and a telephone. A preset writes its full settings into the clip, so a later re-tune of a preset never changes what a link you already shared sounds like. The sliders button beside it opens the **EQ** - Low, Mid and High as dB faders, editing the same chain directly.
- **Pitch** (semitones, an octave each way, voices kept natural) - and on a speed-changed clip, a **Preserve pitch** toggle. It is on by default: slow motion stays in key. Off plays it tape-style.

![The sound strip on a selected audio clip: icon-labelled Volume with its keying diamond and Normalize, Pan, the ducking select, the Effect rack with its EQ door and Pitch - and the waveform tinted where it will play hot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1800&height=720&dpi=180&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D.fc-toolbar-dock%7Bdisplay%3Anone!important%7D&cropSelector=.tl-panel&format=png&dark=1&filename=seq-sound-strip)

![The EQ door open over the timeline: Low, Mid and High as vertical dB faders with live readouts, editing the effect chain directly](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=760&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D.fc-toolbar-dock%7Bdisplay%3Anone%21important%7D&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29%3Bclick%3A.tl-eq-btn%3Bwait%3A600&cropSelector=.tl-eq-popover&format=svg&walker=1&dark=1&filename=seq-sound-eq)

Two things back the strip that you never have to operate:

- **What plays is what renders.** One envelope drives the preview and the export mix, so the file sounds like the timeline did. The waveform bars are part of the same promise: a stretch that will play within 1 dB of full scale is tinted amber, and over it, red - level feedback across the whole timeline with no meter to watch.
- **A true-peak limiter guards every export** at -1 dBTP, always on and transparent until needed - so a boosted, stretched, effected mix cannot clip at the encoder. The export bar's **Loudness** select adds a platform target on top: Off by default, or -14 LUFS (streaming), -16 (podcast), -23 (broadcast), stated in the correct unit because almost nobody shipping does.

### Subtitles and the transcript

A clip with speech carries two doors in its right-click menu, both on-device:

- **Generate subtitles** listens to the clip and writes timed caption boxes. The first run downloads the speech model once (it says so, with the size); after that it is instant to start and runs in the background.
- **Edit transcript** opens the transcript as flowing text - click a word to jump the playhead there, select a sentence to cut it. On a clip with no transcript yet it offers the same background transcription first, and opens the editor when it finishes.

## Trimming

Drag either end of a clip to trim it. The grip is a narrow bar, but the **area that responds is wider than it looks** - and wider again for a finger or a pen, where it is at least the 24px that the accessibility guidelines ask of any target. A clip too narrow to carry two grips without swallowing its own middle offers neither, and says so in its tooltip: zoom in, or use the inspector.

While you drag:

- the edge lights up, and a **readout** at the dragged end shows the clip's new length and the signed change (`4.2s  +0.6s`);
- a **ghost extent** shows how much source is still reachable past the edge;
- the edge turns to a **limit** state the moment you ask for more than the file has. Before this, dragging past the end of the media simply stopped with no explanation;
- on the sequence row the clips downstream **move as you drag**, not when you release, so you can see the ripple you are causing;
- hold **Alt** to override snapping mid-drag.

Nothing is written until you let go: one drag is one undo step.

![A trim in flight: the dragged edge lit, a readout showing the clip’s new length and the signed change and a ghost extent showing how much source is still reachable past the edge](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1100&height=760&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&drive=drag%3A.tl-clip-seq%7Cdx%3D90%7Cat%3D0.99%2C0.15%7Chold&cropSelector=.tl-panel&format=svg&walker=1&dark=1&filename=seq-trim-drag)

### Trimming from the keyboard

Every trim is reachable without a pointer, which is also the fastest route once you know it.

| Key | What it does |
| --- | --- |
| `[` / `]` | Aim at the in edge or the out edge of the selected clip |
| `,` / `.` | Nudge that edge one frame earlier or later (hold Shift for ten) |
| `E` | Pull that edge to the playhead |
| `Esc` | Let the edge go (then a live recording, then close the panel) |

Each press is one write and one undo step.

![Trimming from the keyboard: the in edge of the selected clip is aimed and has been nudged two frames earlier](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1100&height=760&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&drive=click%3A.tl-clip-seq%7Cat%3D0.5%2C0.15%3Bpress%3ABracketLeft%3Bpress%3AComma%3Bpress%3AComma&cropSelector=.tl-panel&format=svg&walker=1&dark=1&filename=seq-trim-keyboard)

## The shortcut sheet

Every shortcut the timeline binds is a bare letter or a punctuation key. That is not a style choice: the familiar editor chords (`Ctrl/Cmd+B`, `Ctrl/Cmd+K`) collide with browser bindings that a web page cannot reliably take over, and a shortcut that silently does nothing is worse than one you have to learn.

So the list is printed in the app. Press `?` with the timeline focused, or click the keyboard button at the end of the tool bar, and every key the panel handles is listed with what it does. The sheet is generated from the same list the key handler is written against, so it cannot fall out of date. Escape closes it and puts focus back where you were.

![The shortcut sheet, printed in the app: every key the timeline binds with what it does, generated from the same list the key handler is written against](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D.fc-toolbar-dock%7Bdisplay%3Anone!important%7D&drive=click%3A.tl-panel%7Cat%3D0.5%2C0.02%3Bpress%3A%3F&cropSelector=.tl-keys-modal&format=svg&walker=1&dark=1&filename=seq-shortcut-sheet)


## Project timing, markers and ranges

**Project frame rate** in Design sets the editing grid and the default movie export rate: 24, 25, 30, 50 or 60 fps. Existing documents use 30 fps. Frame steps, split positions, trim deltas and transition handles follow that grid. An explicit export Frame rate or `fps` URL parameter overrides the rate of the file. Changing the project rate leaves existing clip times in place; edits use the new grid. A video clip’s Timing controls show its sampled source rate; VFR means the source uses variable frame spacing.

Press **M** to add a marker at the playhead, or **Shift+M** to label it. Click a marker on the ruler to edit its label, colour and type: Marker, Chapter, Range or Note. **Ctrl+Left/Right** visits the previous or next marker. Markers and in/out points are snap targets. They are saved with the document and share link, and never extend its duration. The **Markers** menu can export chapters as a WebVTT sidecar, with times relative to the whole sequence.

**I** sets the in point and **O** sets the out point. The ruler highlights the chosen range and the export bar shows its times. Movie and audio exports contain that interval, preserving the original motion and sound positions. Points past the end are clamped when rendering; an empty or reversed range falls back to the whole sequence. **Markers > Clear range** restores the whole sequence.

**Markers > Preview mix** renders the range through the movie exporter, then plays the result with picture and sound. It includes effects the live preview cannot reproduce. The preview is at most 960 pixels wide; the final export uses the chosen output size. Closing the preview cancels an unfinished render and releases the temporary movie.

**J**, **K** and **L** shuttle backward, stop and shuttle forward. Repeating J or L cycles through 1x, 2x and 4x; changing direction returns to 1x. Shuttle scrubs silently. Space plays with sound. **Shift+K** adds a keyframe; **Shift+O** toggles onion skin.

When a main-row clip is moved or resized, overlays that started within it follow its start. Deleting that clip moves those overlays to the start of the removed interval. Joining two pieces preserves overlays inside the joined material. An overlay you move explicitly keeps its chosen position.

Audio preview decodes the source spans the clips use and keeps a bounded temporary cache on the device. Gain and pan changes reuse that audio. The cache is released when the timeline closes; abandoned caches expire after a day. A browser without the streaming decoder uses the existing bounded audio decoder.

### Marker link format

Design appends `projectFps` and `sequenceMarks` to its inputs. `fps` remains an export parameter. The versioned marker value is `v1|m,1000,,888888,Intro|c,2000,,ffcc00,Chapter%201|i,1000|o,4000`. Marker entries contain kind (`m`, `c`, `r` or `n`), absolute milliseconds, optional range end, six-digit RGB colour and a URI-encoded label. In/out entries use `i` and `o`. Readers ignore malformed entries and unknown versions. Limits are 256 markers, 160 characters per label, one hour and 65,536 characters for the wire value.

## Lottie animations

Drop a `.lottie` package or Lottie `.json` file onto the gallery and choose **Edit animation in Sequence**. If the package contains several animations, choose the one to insert. The new artboard uses its dimensions and the clip uses its duration. You can also add an animation from the timeline's media picker.

Each instance keeps its own animation choice. Trim, split, duplicate, change its speed and animate its position, scale, rotation or opacity with the existing timeline controls. The original package remains intact in your library. Save a `.lolly` document to carry the source and editing choices to another device.

Choose **dotLottie** in Export to download the edited sequence as one animation. Export supports imported shape animations, nested compositions, embedded still images, solid native shapes and paths, and outer transform keys. The project frame rate and in/out range apply. Sources retain their original timing, including fractional frame rates; a new document uses a 30 fps editing grid when the source rate is outside the five project choices.

Expand a clip with **+**, or choose **Animation layers**, to edit its internal layers. Select a layer and property to change names, visibility, source in/out frames, transform values and keys, easing, or static fill/stroke colors. The timeline playhead previews the result. Internal edits apply only to this clip; duplicated clips can diverge. **Reset internal edits** restores the original view and supports undo. A nested composition reused within one clip remains shared within that clip.

Source keys retain their own frame times and easing. Existing spatial position keys can be edited, but inserting a key inside a curved spatial path is unavailable. Animated fill/stroke properties remain preserved. For nested time-remapped compositions, selecting a source key does not guess a timeline position; scrub the timeline to preview it.

Position axes can use different curves in dotLottie export. Anchor and scale axes must use matching curves for that export; otherwise use movie export. Your internal edits and original upload remain saved.

Font-dependent text, expressions, 3D, masks, mattes, effects and themed appearance are not supported. An unsupported import or export reports the feature; it is never silently replaced by a still. Use movie export for supported editor content that cannot be represented in dotLottie, such as native text and video.

Packages must be at most 64 MiB, and clips must last at least 0.1 seconds. Required credits travel inside the exported package as readable files. dotLottie exports do not carry signed Content Credentials.

## Wide colour and HDR

Sequence uses the document's Editing range setting. Wide colour / HDR retains original float image pixels and decoded 10-bit video planes through supported flat composition. Enable HDR output for a 10-bit PQ movie, or export an SDR copy from the same document. See [Wide colour and HDR editing](/info/hdr-editing.html) for codec requirements and unsupported effects.
