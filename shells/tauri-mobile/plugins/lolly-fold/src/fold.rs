// SPDX-License-Identifier: MPL-2.0

//! The fold payload and the pure conversion from what the Android plugin
//! reports (physical pixels in window coordinates) to what the page receives
//! (CSS pixels relative to the web view's own content area).

// Only the Android listener calls the conversion; the tests cover it everywhere.
#![cfg_attr(not(target_os = "android"), allow(dead_code))]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum FoldState {
    Flat,
    HalfOpened,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FoldOrientation {
    Vertical,
    Horizontal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FoldOcclusion {
    None,
    Full,
}

/// A rectangle in CSS pixels, relative to the web view's top-left corner.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct FoldBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// The `lolly://fold` payload. `null` (no payload) means no folding feature.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoldPayload {
    pub state: FoldState,
    pub orientation: FoldOrientation,
    pub bounds: FoldBounds,
    pub is_separating: bool,
    pub occlusion: FoldOcclusion,
}

/// One report from `LollyFoldPlugin.kt`. The enum fields are the
/// `toString()` names of the androidx.window classes (`FLAT`, `HALF_OPENED`,
/// `VERTICAL`, `HORIZONTAL`, `NONE`, `FULL`); the rectangle is in window
/// pixels; `view_x` and `view_y` are the web view's position in the window in
/// pixels; `density` is the display density (pixels per CSS pixel).
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawFeature {
    pub state: String,
    pub orientation: String,
    pub occlusion: String,
    pub is_separating: bool,
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub view_x: f64,
    pub view_y: f64,
    pub density: f64,
}

/// The message the Android plugin sends on every change: the feature, or null.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct RawReport {
    pub feature: Option<RawFeature>,
}

/// Converts a report into the page payload. Anything that is not a plain
/// fold, such as an unknown state name, a non-finite number or a density that
/// is not positive, becomes `None`: a page that is told there is no fold falls
/// back to window size and shape, which is safe, while a guessed rectangle is
/// not.
pub fn to_payload(raw: &RawReport) -> Option<FoldPayload> {
    let feature = raw.feature.as_ref()?;
    let numbers = [
        feature.left,
        feature.top,
        feature.right,
        feature.bottom,
        feature.view_x,
        feature.view_y,
        feature.density,
    ];
    if !numbers.iter().all(|n| n.is_finite()) || feature.density <= 0.0 {
        return None;
    }
    let state = match feature.state.as_str() {
        "FLAT" => FoldState::Flat,
        "HALF_OPENED" => FoldState::HalfOpened,
        _ => return None,
    };
    let orientation = match feature.orientation.as_str() {
        "VERTICAL" => FoldOrientation::Vertical,
        "HORIZONTAL" => FoldOrientation::Horizontal,
        _ => return None,
    };
    let occlusion = match feature.occlusion.as_str() {
        "NONE" => FoldOcclusion::None,
        "FULL" => FoldOcclusion::Full,
        _ => return None,
    };
    if feature.right < feature.left || feature.bottom < feature.top {
        return None;
    }
    let css = |pixels: f64| round_hundredth(pixels / feature.density);
    Some(FoldPayload {
        state,
        orientation,
        bounds: FoldBounds {
            x: css(feature.left - feature.view_x),
            y: css(feature.top - feature.view_y),
            width: css(feature.right - feature.left),
            height: css(feature.bottom - feature.top),
        },
        is_separating: feature.is_separating,
        occlusion,
    })
}

/// Two decimals are far finer than a screen pixel, and they keep the
/// same fold from looking different after a floating point wobble.
fn round_hundredth(value: f64) -> f64 {
    let rounded = (value * 100.0).round() / 100.0;
    // Avoid emitting negative zero.
    if rounded == 0.0 {
        0.0
    } else {
        rounded
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn feature() -> RawFeature {
        RawFeature {
            state: "HALF_OPENED".into(),
            orientation: "VERTICAL".into(),
            occlusion: "NONE".into(),
            is_separating: true,
            left: 1000.0,
            top: 0.0,
            right: 1000.0,
            bottom: 2000.0,
            view_x: 0.0,
            view_y: 0.0,
            density: 2.5,
        }
    }

    fn report(feature: RawFeature) -> RawReport {
        RawReport {
            feature: Some(feature),
        }
    }

    #[test]
    fn null_when_there_is_no_feature() {
        assert_eq!(to_payload(&RawReport { feature: None }), None);
    }

    #[test]
    fn divides_by_density() {
        let payload = to_payload(&report(feature())).unwrap();
        assert_eq!(
            payload.bounds,
            FoldBounds {
                x: 400.0,
                y: 0.0,
                width: 0.0,
                height: 800.0
            }
        );
        assert_eq!(payload.state, FoldState::HalfOpened);
        assert_eq!(payload.orientation, FoldOrientation::Vertical);
        assert!(payload.is_separating);
    }

    #[test]
    fn subtracts_the_web_view_offset_before_dividing() {
        // A web view 100 px from the left edge and 120 px below the top of the
        // window, for example under a system bar or beside a navigation rail.
        let mut f = feature();
        f.orientation = "HORIZONTAL".into();
        f.left = 0.0;
        f.right = 2000.0;
        f.top = 1100.0;
        f.bottom = 1180.0;
        f.view_x = 100.0;
        f.view_y = 120.0;
        let payload = to_payload(&report(f)).unwrap();
        assert_eq!(payload.orientation, FoldOrientation::Horizontal);
        assert_eq!(
            payload.bounds,
            FoldBounds {
                x: -40.0,
                y: 392.0,
                width: 800.0,
                height: 32.0
            }
        );
    }

    #[test]
    fn keeps_a_fractional_density() {
        let mut f = feature();
        f.density = 2.625;
        f.left = 1050.0;
        f.right = 1050.0;
        let payload = to_payload(&report(f)).unwrap();
        assert_eq!(payload.bounds.x, 400.0);
        assert_eq!(payload.bounds.height, 761.9);
    }

    #[test]
    fn maps_flat_and_occluding() {
        let mut f = feature();
        f.state = "FLAT".into();
        f.occlusion = "FULL".into();
        f.is_separating = false;
        let payload = to_payload(&report(f)).unwrap();
        assert_eq!(payload.state, FoldState::Flat);
        assert_eq!(payload.occlusion, FoldOcclusion::Full);
        assert!(!payload.is_separating);
    }

    #[test]
    fn refuses_what_it_cannot_describe() {
        let mut f = feature();
        f.state = "FUTURE_STATE".into();
        assert_eq!(to_payload(&report(f)), None);
        let mut f = feature();
        f.orientation = "DIAGONAL".into();
        assert_eq!(to_payload(&report(f)), None);
        let mut f = feature();
        f.occlusion = "".into();
        assert_eq!(to_payload(&report(f)), None);
        let mut f = feature();
        f.density = 0.0;
        assert_eq!(to_payload(&report(f)), None);
        let mut f = feature();
        f.density = f64::NAN;
        assert_eq!(to_payload(&report(f)), None);
        let mut f = feature();
        f.right = f.left - 1.0;
        assert_eq!(to_payload(&report(f)), None);
    }

    #[test]
    fn serialises_to_the_documented_json() {
        let payload = to_payload(&report(feature())).unwrap();
        assert_eq!(
            serde_json::to_value(payload).unwrap(),
            json!({
                "state": "half-opened",
                "orientation": "vertical",
                "bounds": { "x": 400.0, "y": 0.0, "width": 0.0, "height": 800.0 },
                "isSeparating": true,
                "occlusion": "none"
            })
        );
        let mut f = feature();
        f.state = "FLAT".into();
        f.occlusion = "FULL".into();
        assert_eq!(
            serde_json::to_value(to_payload(&report(f)).unwrap()).unwrap()["state"],
            "flat"
        );
    }

    #[test]
    fn parses_the_android_report() {
        let raw: RawReport = serde_json::from_value(json!({
            "feature": {
                "state": "FLAT", "orientation": "VERTICAL", "occlusion": "NONE",
                "isSeparating": false,
                "left": 10.0, "top": 0.0, "right": 20, "bottom": 30,
                "viewX": 0, "viewY": 0, "density": 1.0
            }
        }))
        .unwrap();
        assert!(to_payload(&raw).is_some());
        let none: RawReport = serde_json::from_value(json!({ "feature": null })).unwrap();
        assert_eq!(to_payload(&none), None);
    }
}
