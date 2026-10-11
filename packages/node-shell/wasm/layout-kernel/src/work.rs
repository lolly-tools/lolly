// SPDX-License-Identifier: MPL-2.0
use std::cell::Cell;
thread_local! {
    static LEFT: Cell<usize> = const { Cell::new(crate::MAX_ALLOCATION_WORK) };
    static FAILED: Cell<Option<&'static str>> = const { Cell::new(None) };
}
pub fn reset() { LEFT.with(|v|v.set(crate::MAX_ALLOCATION_WORK)); FAILED.with(|v|v.set(None)); }
pub fn checkpoint(before:f32, after:f32, visits:usize, removed:bool) -> bool {
    let failure=if !before.is_finite() || !after.is_finite() {
        Some("Layout allocation became nonfinite.")
    } else if after>=before && !removed {
        Some("Layout allocation made no progress at f32 precision.")
    } else if !LEFT.with(|left| {
        let available=left.get();
        if visits>available {false} else {left.set(available-visits);true}
    }) {
        Some("Layout exceeded its allocation work limit.")
    } else {None};
    if let Some(message)=failure {FAILED.with(|v|v.set(Some(message)));false} else {true}
}
pub fn check() -> Result<(),String> { FAILED.with(|v|v.get()).map_or(Ok(()),|message|Err(message.into())) }
