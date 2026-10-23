# Presenting with camera

You are giving a talk on a video call and want your audience to see your slides with your face, your logo and a name caption, not a cluttered screen share. **Present with camera** puts your camera, a logo and a lower third over a Design deck or the Countdown tool. The audience gets one clean 16:9 picture, and a separate private window holds your controls and speaker notes.

Presentation media stays on your device until you share it in a call or choose to record. No Lolly Work server is needed.

::: figure presenting-two-windows
The audience window is what you share in the call; the private window stays on your side.
:::

## Start a presentation

::: timeline
- <!--i:monitor--> Open your Design deck, open **Present options** and choose **Present with camera**. In Countdown, choose **Present with camera** above the tool.
- <!--i:layers--> Allow the private controls window to open. The original window becomes the audience output. Keep both windows open.
- <!--i:clock--> In **Camera**, choose a **Camera device**, then **Start camera**, and allow camera access if asked. The camera stays off until you choose Start camera.
- <!--i:sliders--> Set up the layout and graphics below, then choose **Apply scene**.
- <!--i:link--> In your call, share the audience tab or window and check the share preview. Sharing a whole display can include your private controls.
:::

Keep your microphone selected in the call application; starting the presentation camera does not start a microphone. Lolly cannot tell whether the call is receiving your picture, so check the picture from another participant's view before relying on it in a talk.

The audience picture is 1280 × 720 at 30 fps. Browser or system borders can remain around a shared window, so a tab share or a carefully framed capture gives the cleanest result.

::: note Changes wait for Apply scene
Layout, framing, logo and caption edits stay private until you choose **Apply scene**, and so does **Remove logo**. Advancing a slide, starting or stopping the camera and showing or hiding the lower third happen at once. Applying a saved layout does not restart a stopped camera.
:::

## Set up the picture

**Prepared scene** chooses one of five layouts:

::: figure presenting-layouts
The five prepared layouts, as the audience sees them.
:::

| Layout | Audience picture |
|---|---|
| Content only | Your slides or tool fill the picture. |
| Camera inset | Your camera sits over the content, wherever you place the inset. |
| Side by side | Content on the left, a tall camera area on the right. |
| Camera full screen | Your camera fills the picture. |
| Holding screen | A black picture; applying it stops the camera and pauses the live tool. |

### Frame your camera

Open **Camera → Framing**. In the small layout preview, drag the camera area to move the inset and drag its corner to resize the inset. These controls work with **Camera inset**; Side by side and Camera full screen use fixed camera areas.

You can also type **Camera left**, **Camera top**, **Camera width** and **Camera height** in output pixels. Focus the preview's camera area and use the arrow keys to move it one pixel at a time, or ten with Shift; focus its corner to resize the same way.

- **Camera crop zoom** moves closer without moving the area.
- **Camera crop horizontal** and **Camera crop vertical** choose the crop's focus: 0 is the left or top edge, 0.5 the centre and 1 the right or bottom edge.
- **Fit whole camera image** shows the whole source at zoom 1, with space around it when the shapes differ. Off, the image fills its area and the edges may be cropped.
- **Camera corner radius** rounds the frame (full-screen camera output stays square), and **Camera border width** adds a white border.
- **Mirror camera in output** flips the camera the audience sees, leaving slide text, the logo and captions alone. **Mirror my private preview** flips only your small self-view.

Change **Camera device** while the camera runs to switch sources; Lolly releases the old one first. If a device disappears, choose an available camera and start it again. Device choices last for this run only and are not saved with the presentation.

### Add your logo and name

Open **Logo** and choose a PNG, JPEG, WebP or SVG image, then adjust **Logo width**. The logo sits top right by default; tick **Logo at top left** to move it to the other corner. Choose **Apply scene** once the image has loaded.

In **Lower third**, enter a name and a detail such as a role or topic, apply it, then choose **Show lower third**. The same button hides it; hide and show again to replay the short entrance. Reduced-motion preferences remove the movement.

### Keep reusable scenes

Open **Saved scenes**, enter a **Scene name** and choose **Save scene**. A document holds up to eight scenes, such as an opening slide, a speaker close-up and a closing layout.

Choose **New scene** before saving another arrangement. To update one, select it, change its settings and save again. Selecting a saved scene loads it privately; **Apply scene** sends it to the audience. **Delete scene** removes the entry and leaves the audience picture as it is.

Scenes store the layout, camera framing, logo reference and caption text, but not a slide number or a Countdown duration. Save the document as usual afterwards. Reopening it restores the applied arrangement and saved scenes with the camera off and the lower third hidden.

## During the talk

The private window shows the current slide, the next slide and speaker notes when the deck has them. Countdown shows its duration, start, pause and reset controls instead.

| Action | Control |
|---|---|
| Advance or go back in a deck | Arrow keys or Page Down / Page Up, outside an input field. |
| Show black and stop the camera | Press B, O or Escape in the audience window. |
| Open or focus the private controls | Press S in the audience window. An open controls window keeps its camera state. |
| Resume after a hold | Prepare the layout, choose Apply scene, then start the camera and restart the tool if needed. |
| Finish | Stop sharing in the call, then choose End presentation. |

Closing the private window, or pressing Escape or S there outside an input, puts the audience on black, stops the camera, pauses Countdown and finishes any recording. Reopening the controls never starts the camera by itself. If the browser uses Escape to leave full screen, it may take that key first.

## Record what the audience sees

Recording needs a browser that can capture a region of its own tab, and the control tells you when that is unavailable. The macOS desktop app cannot record this way, though its audience window can still be shared.

1. Open **Recording** in the private controls. Leave **Record microphone** off for silent video, or tick it to include your microphone in the file. This is separate from your call microphone.
2. Choose **Record output**, then press **R** in the audience window.
3. In the browser's picker, choose that same audience tab, and allow the microphone if you chose to record one. Another tab or a window cannot produce this cropped recording.
4. Present as normal. The recording follows the applied scene, including camera crop, logo and lower-third cues.
5. Press **R** again in the audience window, or choose **Stop recording**, and let the file finish saving.

A take stops at 30 minutes or 512 MiB, whichever comes first. Lolly uses temporary local storage where it can and reports a failure if it cannot finish. Tool audio, call audio and virtual microphones are not mixed in. If saving fails, keep the presentation open and choose **Save recording** to try again; closing or reloading can lose the take.

::: details Use OBS Studio as a virtual camera (experimental)
Lolly does not install a virtual camera of its own, and a trial from OBS Studio into a call has not been completed for Lolly yet.

Create a separate OBS Studio scene for the Lolly audience window and frame just its 16:9 picture. On macOS, the **macOS Screen Capture** source offers a **Window Capture** method; select the audience window and check that the private controls and window borders are left out. See [OBS's macOS capture guide](https://obsproject.com/kb/macos-screen-capture-source).

Select that scene in OBS's virtual-camera settings and choose **Start Virtual Camera**. Choose the OBS camera in the call application, keep its microphone selected separately, and check the received picture, including text, crop and mirroring, before you present. OBS describes its output choices in the [Virtual Camera guide](https://obsproject.com/kb/virtual-camera-guide).
:::

::: details Troubleshooting
| What you see | What to do |
|---|---|
| Private controls did not open | Allow pop-ups for Lolly, then start the presentation again. Private notes never fall back into the audience picture. |
| Camera access denied | Allow camera access in the browser and system settings, then choose Start camera. |
| Camera busy or unavailable | Close another app using it, check the connection or choose another Camera device. |
| Black output after closing controls | Press S in the audience window, apply the layout and start the camera. |
| A saved logo is unavailable | Choose the image again and apply. A scene refers to the saved asset, so keep that asset with the document. |
| Record output is unavailable | Use a browser with tab region capture, or record the shared window in another application. |
| Recording did not start | Choose the audience tab itself and check the browser's capture and microphone permissions. |
| The call shows small or cropped slide text | Check the receiver's view and try the call's screen-sharing route; its camera layout may crop or shrink the picture. |
:::

::: note What has been tested
Browser composition and recording have automated tests, and the macOS desktop controls have been tried in an installed development build. Trials on receiving devices in Meet, Zoom, Teams and OBS Studio are still pending, as is checking background, minimised and sleeping-device behaviour on physical devices. Leave the audience window open and visible while you rehearse.
:::

Saved presentation settings follow the document's normal save and share behaviour; camera frames, device IDs, microphone permissions and live cues are not saved. For working on a document with others, see [Working together](/info/collaborate.html).
