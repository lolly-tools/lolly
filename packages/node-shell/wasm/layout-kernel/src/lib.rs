// SPDX-License-Identifier: MPL-2.0
#![allow(dead_code)]
mod scalar;
mod math;
mod shapes;
mod request;
mod work;
pub mod uuid { pub type Uuid=u32; }
pub mod state { pub type ShapesPoolRef<'a>=&'a std::collections::HashMap<crate::uuid::Uuid,crate::shapes::Shape>; }
pub mod error {
    #[derive(Debug)] pub enum Error { CriticalError(String) }
    pub type Result<T>=std::result::Result<T,Error>;
}
pub use request::solve;

const MAX_BYTES: usize = 8 * 1024 * 1024;
// Admission ceilings apply before shape, cell and result materialization.
pub(crate) const MAX_ITEMS: usize = 20_000; // Child records per container.
pub(crate) const MAX_TRACKS_PER_AXIS: usize = 1_024; // Tracks and cell indices per axis.
pub(crate) const MAX_GRID_CELLS: usize = 65_536; // Row and column product per container.
pub(crate) const MAX_GRID_SPAN_WORK: usize = 262_144; // Aggregate active row and column spans.
pub(crate) const MAX_ALLOCATION_WORK: usize = 262_144; // Redistribution visits per request.
pub(crate) const MAX_SCALAR: f32 = 1e7; // Finite coordinate, spacing and track magnitude.
thread_local! {
    // Raw calls can only read and release buffers allocated by this instance.
    static INPUT: std::cell::RefCell<Option<Box<[u8]>>> = const { std::cell::RefCell::new(None) };
    static OUTPUT: std::cell::RefCell<Vec<u8>> = const { std::cell::RefCell::new(Vec::new()) };
}
#[no_mangle]
pub extern "C" fn layout_alloc(len: usize) -> *mut u8 {
    if len == 0 || len > MAX_BYTES { return std::ptr::null_mut(); }
    INPUT.with(|input| {
        let mut input = input.borrow_mut();
        if input.is_some() { return std::ptr::null_mut(); }
        let mut bytes = Vec::new();
        if bytes.try_reserve_exact(len).is_err() { return std::ptr::null_mut(); }
        bytes.resize(len, 0);
        let mut bytes = bytes.into_boxed_slice();
        let pointer = bytes.as_mut_ptr();
        *input = Some(bytes);
        pointer
    })
}
#[no_mangle]
pub extern "C" fn layout_free(ptr: *mut u8, len: usize) {
    INPUT.with(|input| {
        let mut input = input.borrow_mut();
        if input.as_ref().is_some_and(|b| b.as_ptr() == ptr && b.len() == len) { *input = None; }
    });
}
#[no_mangle]
pub extern "C" fn layout_solve(ptr: *const u8, len: usize) -> *const u8 {
    let answer = INPUT.with(|input| {
        let input = input.borrow();
        match input.as_ref() {
            Some(bytes) if bytes.as_ptr() == ptr && bytes.len() == len => solve(bytes),
            _ => Err("Layout request is not an owned buffer.".into()),
        }
    });
    OUTPUT.with(|output| {
        let mut output = output.borrow_mut();
        *output = match answer {
            Ok(value) if value.len() <= MAX_BYTES => value,
            Ok(_) => b"{\"error\":\"Layout response exceeds the byte limit.\"}".to_vec(),
            Err(message) => serde_json::to_vec(&serde_json::json!({"error":message})).unwrap(),
        };
        output.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn layout_output_len() -> usize { OUTPUT.with(|output| output.borrow().len()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_modern_reference_matches_recorded_cases() {
        let corpus:serde_json::Value=serde_json::from_str(include_str!("../fixtures/modern-layout.json")).unwrap();
        for case in corpus["cases"].as_array().unwrap() {
            let input=serde_json::to_vec(&case["request"]).unwrap();
            let actual=match solve(&input) {
                Ok(bytes)=>serde_json::from_slice::<serde_json::Value>(&bytes).unwrap(),
                Err(message)=>serde_json::json!({"error":message}),
            };
            assert_eq!(actual,case["expected"],"{}",case["name"]);
            if case["expected"]["error"].is_string() {
                let valid=serde_json::to_vec(&corpus["cases"][0]["request"]).unwrap();
                let recovered=serde_json::from_slice::<serde_json::Value>(&solve(&valid).unwrap()).unwrap();
                assert_eq!(recovered,corpus["cases"][0]["expected"],"{}: refusal recovers",case["name"]);
            }
        }
    }
    #[test]
    fn raw_abi_owns_input_pointer_and_exact_length() {
        assert!(layout_alloc(0).is_null());
        assert!(layout_alloc(MAX_BYTES+1).is_null());
        let pointer=layout_alloc(2); assert!(!pointer.is_null());
        assert!(layout_alloc(2).is_null());
        // Wrong lengths and pointers cannot release or read someone else's allocation.
        layout_free(pointer,1); assert!(layout_alloc(2).is_null());
        let output=layout_solve(std::ptr::null(),2);
        let message=unsafe {std::slice::from_raw_parts(output,layout_output_len())};
        assert!(std::str::from_utf8(message).unwrap().contains("owned buffer"));
        layout_free(pointer,2); layout_free(pointer,2);
        let next=layout_alloc(2); assert!(!next.is_null()); layout_free(next,2);
    }
    #[test]
    fn refusal_state_is_operation_local() {
        work::reset(); assert!(!work::checkpoint(1.,1.,1,false)); assert!(work::check().is_err());
        work::reset(); assert!(work::checkpoint(1.,0.,1,false)); assert!(work::check().is_ok());
        work::reset(); assert!(!work::checkpoint(1.,0.,262_145,false)); assert!(work::check().is_err());
    }
}
