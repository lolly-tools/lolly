// SPDX-License-Identifier: MPL-2.0
//! Put the page back when the web view has left it pulled down.
//!
//! On an iPhone the web view's scroll view can be left resting below its top
//! edge after a navigation, as though a pull-down never sprang back. The page
//! still reports scroll position 0, so nothing in the page can see the fault or
//! correct it. The view then draws half a screen low, and in Dark appearance the
//! system background shows above it as a black band. A drag by hand clears it,
//! which is what this command does on the page's behalf: when the scroll view is
//! at rest and sits outside its own limits, the offset is clamped back.
//!
//! The reading is returned either way, so a fault found in the field can be
//! reported with its numbers.

#[derive(serde::Serialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PageScroll {
    /// False on every platform but iOS, where there is nothing to read.
    pub read: bool,
    pub offset_y: f64,
    pub inset_top: f64,
    pub adjusted_top: f64,
    pub content_height: f64,
    pub bounds_height: f64,
    pub frame_y: f64,
    /// A finger is down or the view is still coasting: left alone.
    pub busy: bool,
    pub fixed: bool,
}

#[tauri::command]
pub async fn page_scroll_settle<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    fix: bool,
) -> Result<PageScroll, String> {
    #[cfg(target_os = "ios")]
    {
        let (tx, rx) = tokio::sync::oneshot::channel();
        window
            .with_webview(move |webview| {
                let _ = tx.send(unsafe { ios::settle(webview.inner(), fix) });
            })
            .map_err(|error| error.to_string())?;
        tokio::time::timeout(std::time::Duration::from_millis(1500), rx)
            .await
            .map_err(|_| "the web view did not answer".to_string())?
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (window, fix);
        Ok(PageScroll::default())
    }
}

#[cfg(target_os = "ios")]
mod ios {
    use super::PageScroll;
    use objc2::encode::{Encode, Encoding};
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    // UIKit's geometry, declared here so the command needs no UIKit bindings.
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Point {
        x: f64,
        y: f64,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Size {
        width: f64,
        height: f64,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Rect {
        origin: Point,
        size: Size,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Insets {
        top: f64,
        left: f64,
        bottom: f64,
        right: f64,
    }
    unsafe impl Encode for Point {
        const ENCODING: Encoding = Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
    }
    unsafe impl Encode for Size {
        const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
    }
    unsafe impl Encode for Rect {
        const ENCODING: Encoding = Encoding::Struct("CGRect", &[Point::ENCODING, Size::ENCODING]);
    }
    unsafe impl Encode for Insets {
        const ENCODING: Encoding = Encoding::Struct(
            "UIEdgeInsets",
            &[f64::ENCODING, f64::ENCODING, f64::ENCODING, f64::ENCODING],
        );
    }

    /// Half a point of slack, so a fractional resting offset is not a fault.
    const SLACK: f64 = 0.5;

    pub unsafe fn settle(webview: *mut std::ffi::c_void, fix: bool) -> PageScroll {
        let webview = webview.cast::<AnyObject>();
        if webview.is_null() {
            return PageScroll::default();
        }
        let scroll: *mut AnyObject = msg_send![webview, scrollView];
        if scroll.is_null() {
            return PageScroll::default();
        }
        let tracking: bool = msg_send![scroll, isTracking];
        let dragging: bool = msg_send![scroll, isDragging];
        let decelerating: bool = msg_send![scroll, isDecelerating];
        let busy = tracking || dragging || decelerating;
        let frame: Rect = msg_send![webview, frame];
        let mut offset: Point = msg_send![scroll, contentOffset];
        let mut inset: Insets = msg_send![scroll, contentInset];
        let mut adjusted: Insets = msg_send![scroll, adjustedContentInset];
        let content: Size = msg_send![scroll, contentSize];
        let bounds: Rect = msg_send![scroll, bounds];
        let reading = |offset: Point, inset: Insets, adjusted: Insets, fixed: bool| PageScroll {
            read: true,
            offset_y: offset.y,
            inset_top: inset.top,
            adjusted_top: adjusted.top,
            content_height: content.height,
            bounds_height: bounds.size.height,
            frame_y: frame.origin.y,
            busy,
            fixed,
        };
        let before = reading(offset, inset, adjusted, false);
        if !fix || busy {
            return before;
        }
        let mut fixed = false;
        // Nothing in this app gives the page a top inset; one that appears is
        // the same fault under another name.
        if inset.top > SLACK {
            inset.top = 0.0;
            let _: () = msg_send![scroll, setContentInset: inset];
            adjusted = msg_send![scroll, adjustedContentInset];
            offset = msg_send![scroll, contentOffset];
            fixed = true;
        }
        if offset.y < -adjusted.top - SLACK {
            offset.y = -adjusted.top;
            let _: () = msg_send![scroll, setContentOffset: offset, animated: false];
            fixed = true;
        }
        // Report what was found, with the outcome, so the fault can be seen.
        PageScroll { fixed, ..before }
    }
}
