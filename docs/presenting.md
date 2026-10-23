# Presenting with camera

Put your camera, a logo and a name caption over a Lolly presentation. The audience gets one clean picture; a separate window holds your controls and speaker notes. Start with a Design deck or the Countdown tool.

This first version is for preparing and trying presentations. Browser composition and recording have automated coverage, and the macOS desktop controls have been exercised in an installed development build. Receiving-device trials in Meet, Zoom, Teams and OBS Studio are still pending. Lolly does not yet install a virtual camera.

## Start a presentation

1. Open your Design deck. Open **Present options**, then choose **Present with camera**. In Countdown, choose **Present with camera** above the tool.
2. Allow the private controls window to open. The original window becomes the audience output. Keep both windows open.
3. In **Camera**, choose a **Camera device**, then **Start camera**. Allow camera access if prompted. Lolly leaves the camera off until you start it.
4. Prepare the layout and graphics below, then choose **Apply scene**.
5. In your call, share the audience tab or window. Check the share preview before continuing. Sharing an entire display can include your private controls.

Keep your microphone selected in the call application. Starting the presentation camera does not start a microphone. Lolly cannot tell whether the call is receiving your output, so check it from another participant's view before relying on it.

The audience picture is 16:9 at 1280 × 720. Browser or operating-system borders can remain around a shared window; a tab share or a carefully framed capture is useful for a clean result. Leave the audience window open and visible during the trial. Background, minimized and sleeping-device behaviour still needs physical-device validation.

## Prepare a layout

**Prepared scene** chooses one of five layouts:

| Layout | Audience picture |
|---|---|
| Content only | Your slides or tool fill the picture. |
| Camera inset | Your camera sits over the content at the position you choose. |
| Side by side | Content on the left, a tall camera area on the right. |
| Camera full screen | Your camera fills the picture. |
| Holding screen | A black picture; applying it stops the camera and pauses the live tool. |

Layout, framing, logo and text edits stay private until **Apply scene**. Advancing a slide, starting or stopping the camera, and showing or hiding the lower third happen immediately. Applying a saved layout does not start a stopped camera.

### Frame your camera

Open **Camera → Framing**. In the small layout preview, drag the camera area to move it; drag its corner to resize it. These placement controls work with **Camera inset**. Side-by-side and full-screen layouts use fixed camera areas.

You can also enter **Camera left**, **Camera top**, **Camera width** and **Camera height** in output pixels. Positions and sizes stay within the picture. Focus the preview's camera area and use arrow keys to move it by one pixel, or hold Shift for ten pixels. Focus its corner control to resize with the same keys.

- **Camera crop zoom** moves closer without changing the area's position.
- **Camera crop horizontal** and **Camera crop vertical** choose the crop's focus: 0 is the left or top edge, 0.5 is the centre, and 1 is the right or bottom edge.
- **Fit whole camera image** keeps the whole source visible at zoom 1, with space around it when the shapes differ. With this off, the image fills its area and the edges may be cropped.
- **Camera corner radius** rounds the frame. Full-screen camera output has square corners. **Camera border width** adds a white border.
- **Mirror camera in output** changes the camera shown to the audience. It leaves slide text, the logo and captions alone.
- **Mirror my private preview** affects only the small self-view. The framing diagram follows the output mirror setting.

Change **Camera device** while the camera is running to switch sources. Lolly releases the old source before opening the next. If the chosen device disappears, select an available camera and start it again. Device choices stay on this local run and are not saved with the presentation.

### Add your logo and name

Open **Logo** and choose a PNG, JPEG, WebP or SVG image. Adjust **Logo width**. The logo sits top right by default; select **Logo at top left** to move the logo. Choose **Apply scene** when the image finishes loading. **Remove logo** also needs Apply.

In **Lower third**, enter a name and detail, such as a role or topic. Apply the text, then choose **Show lower third**. The same button hides it. Hide and show again to replay the short entrance. Reduced-motion preferences remove the movement.

### Keep reusable scenes

Open **Saved scenes**, enter a **Scene name**, then choose **Save scene**. You can keep eight scenes in the document, for example an opening slide, a speaker close-up and a closing slide layout.

Choose **New scene** before saving another arrangement. To update one, select it, edit the prepared settings and choose **Save scene** again. Selecting a saved scene loads its settings privately; **Apply scene** sends them to the audience. **Delete scene** removes the saved entry while leaving the audience picture as it is.

Scenes store layout, camera framing, logo references and caption text. They do not store a slide number or Countdown duration. Save your work using Lolly's usual document controls after the presentation. Reopening restores the applied arrangement and saved scenes with the camera off and the lower third hidden.

## During the presentation

The private window shows the current slide, the next slide and speaker notes when the deck supplies them. Countdown instead has private duration, start/pause and reset controls.

| Action | Control |
|---|---|
| Advance or go back in a deck | Arrow keys or Page Down / Page Up, outside an input field. |
| Show black output and stop camera exposure | Press B, O or Escape in the audience window. |
| Open or focus private controls | Press S in the audience window. An already-open controls window keeps its current camera state. |
| Resume after a hold | Prepare the desired layout, choose Apply scene, then explicitly Start camera and restart the tool if needed. |
| Finish | Stop sharing in the call, then choose End presentation. |

Closing the private window, or pressing Escape or S there outside an input, puts the audience on black, stops the camera, pauses Countdown and finishes any recording. Reopening the controls never starts the camera by itself. If the browser uses Escape to leave full screen, it may consume that key first.

## Record the audience picture

Recording requires a browser that supports capturing a region of its own tab. The control explains when this is unavailable. The current macOS desktop webview does not support this recording route; its audience window can still be a share target.

1. Open **Recording** in the private controls. Leave **Record microphone** off for silent video, or select it to include your microphone in the local file. This choice is separate from your call microphone.
2. Choose **Record output**. In the audience window, press **R**.
3. In the browser's picker, choose that same audience tab. Allow microphone access if you requested it. Choosing another tab or a window cannot produce this cropped recording.
4. Present normally. The recording follows the applied composition, including camera crop, logo and lower-third cues.
5. Press **R** again in the audience window, or choose **Stop recording** in the private controls. Let the file finish saving.

Takes stop at 30 minutes or 512 MiB, whichever comes first. Lolly uses temporary local storage where available and reports a failure if it cannot finish. It does not mix tool audio, call audio or a virtual microphone into this recording.

If saving fails, keep the presentation open and choose **Save recording** to retry. Closing or reloading can lose the unsaved take. Check the downloaded file before discarding the presentation.

## Try an OBS Studio video feed

This is an experimental setup path; an OBS Studio to call receiver trial has not yet been completed for Lolly.

Create a separate OBS Studio scene for the Lolly audience window and frame just its 16:9 picture. On macOS, OBS's **macOS Screen Capture** source offers a **Window Capture** method. Select the audience window, and check that the private controls and window borders are excluded. See [OBS's macOS capture guide](https://obsproject.com/kb/macos-screen-capture-source).

Select that dedicated scene in OBS's virtual-camera settings, then choose **Start Virtual Camera**. Select the OBS camera in the receiving application and keep its microphone selected separately. Check the actual received picture, including text, crop and mirror behaviour, before presenting. OBS documents its output choices in the [Virtual Camera guide](https://obsproject.com/kb/virtual-camera-guide).

## Troubleshooting

| What you see | What to do |
|---|---|
| Private controls did not open | Allow popups for Lolly, then start the presentation again. Private notes never fall back into the audience picture. |
| Camera access denied | Allow camera access in browser and system settings, then choose Start camera. |
| Camera busy or unavailable | Close another app using it, check the connection, or choose another Camera device. |
| Black output after closing controls | Press S in the audience window. Apply the intended layout and start the camera explicitly. |
| A saved logo is unavailable | Choose the image again and Apply. A scene references the saved asset, so keep that asset with the document. |
| Record output is unavailable | Use a browser with tab region capture, or record the shared window in a separate application. |
| Recording did not start | Choose the audience tab itself and check the browser's capture and microphone permissions. |
| The call receives small or cropped slide text | Check the receiver's view and try the call's screen-sharing route. Its camera layout may crop or shrink the picture. |

Presentation media stays on your device until you choose a sharing or recording destination. No Lolly Work server is required. Saved presentation settings follow the document's normal save/share behaviour; camera frames, device IDs, microphone permissions and live cues are not document state. For document collaboration and its separate transport, see [Working together](/info/collaborate.html).
