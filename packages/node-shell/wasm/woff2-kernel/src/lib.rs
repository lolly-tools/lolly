// SPDX-License-Identifier: MPL-2.0
//! WOFF2 to sfnt bytes for Lolly's browser and Node shells, in Rust with no unsafe decoding code.
//!
//! `wuff` (a hand port of Google's woff2 C++ library) rebuilds the font tables. The Brotli
//! stream is read by `brotli-decompressor`, Dropbox's pure-Rust decoder: a separate code
//! base from Google's C decoder, built here without its `unsafe` feature, so the crate's
//! own `forbid(unsafe_code)` holds. The adapter adds three things on top:
//!
//! - it refuses a Brotli target over `MAX_OUTPUT` before allocating the buffer for it;
//! - it reads the stream in RFC 7932 mode, refusing the large-window extension, as
//!   Google's decoder does by default (the extension would allow a 1 GiB window);
//! - an allocation the module cannot make is a refusal with a message, not a trap.
//!
//! One module instance decodes one font: the shells start a fresh instance per decode.
//! The raw ABI is `woff2_alloc`, `woff2_free`, `woff2_run(ptr, len, op)`,
//! `woff2_result_ptr` and `woff2_result_len`. Operation 1 decodes a WOFF2 file; status 0
//! returns the sfnt (or collection) bytes, status 1 a plain-text reason. The module
//! imports nothing from the host.
#![deny(unsafe_code)]

use std::cell::RefCell;
use std::collections::BTreeMap;

pub use decode::{MAX_INPUT, MAX_OUTPUT, decode_woff2};

const OP_DECODE: u32 = 1;

#[forbid(unsafe_code)]
mod decode {
    use brotli_decompressor::{
        Allocator, BrotliDecompressStream, BrotliResult, BrotliState, SliceWrapper,
        SliceWrapperMut,
    };
    use std::cell::Cell;

    /// The largest WOFF2 file read: the font upload limit.
    pub const MAX_INPUT: usize = 32 * 1024 * 1024;
    /// The largest Brotli target and the largest sfnt returned (google/woff2's own ceiling
    /// in the build this module replaces).
    pub const MAX_OUTPUT: usize = 30 * 1024 * 1024;

    /// A buffer the Brotli decoder owns, allocated through the global allocator.
    #[derive(Default)]
    pub struct Cells<T>(Box<[T]>);

    impl<T> SliceWrapper<T> for Cells<T> {
        fn slice(&self) -> &[T] {
            &self.0
        }
    }
    impl<T> SliceWrapperMut<T> for Cells<T> {
        fn slice_mut(&mut self) -> &mut [T] {
            &mut self.0
        }
    }

    /// Hands out zeroed cells. A failed allocation returns an empty cell, which the
    /// decoder reports as an allocation error instead of the module stopping.
    pub struct Heap;

    impl<T: Clone + Default> Allocator<T> for Heap {
        type AllocatedMemory = Cells<T>;
        fn alloc_cell(&mut self, len: usize) -> Cells<T> {
            let mut cells = Vec::new();
            if cells.try_reserve_exact(len).is_err() {
                return Cells(Box::default());
            }
            cells.resize(len, T::default());
            Cells(cells.into_boxed_slice())
        }
        fn free_cell(&mut self, _cells: Cells<T>) {}
    }

    /// Exactly `size` bytes from one Brotli stream, or a reason. RFC 7932 only.
    fn brotli_exact(stream: &[u8], size: usize) -> Result<Vec<u8>, &'static str> {
        if size > MAX_OUTPUT {
            return Err("The WOFF2 tables expand past 30 MB.");
        }
        let mut output = Vec::new();
        if output.try_reserve_exact(size).is_err() {
            return Err("There is not enough memory to decode this WOFF2 font.");
        }
        output.resize(size, 0u8);
        let mut state = BrotliState::new_strict(Heap, Heap, Heap);
        let (mut available_in, mut input_offset) = (stream.len(), 0usize);
        let (mut available_out, mut output_offset, mut total_out) = (size, 0usize, 0usize);
        let result = BrotliDecompressStream(
            &mut available_in,
            &mut input_offset,
            stream,
            &mut available_out,
            &mut output_offset,
            &mut output,
            &mut total_out,
            &mut state,
        );
        // google/woff2 asks for a complete stream whose output fills the tables exactly.
        match result {
            BrotliResult::ResultSuccess if output_offset == size => Ok(output),
            BrotliResult::ResultSuccess => Err("The WOFF2 compressed data is shorter than its tables."),
            BrotliResult::NeedsMoreOutput => Err("The WOFF2 compressed data is longer than its tables."),
            BrotliResult::NeedsMoreInput => Err("The WOFF2 compressed data ends early."),
            BrotliResult::ResultFailure => Err("The WOFF2 compressed data is damaged."),
        }
    }

    /// One WOFF2 file to sfnt (or TrueType collection) bytes, or a reason it was refused.
    pub fn decode_woff2(woff2: &[u8]) -> Result<Vec<u8>, &'static str> {
        if woff2.len() > MAX_INPUT {
            return Err("The WOFF2 file is larger than 32 MB.");
        }
        // wuff turns any error from the Brotli step into its one generic error, so the
        // reason is kept here.
        let brotli_error: Cell<Option<&'static str>> = Cell::new(None);
        let mut brotli = |stream: &[u8], size: usize| -> Result<Vec<u8>, Box<dyn std::error::Error>> {
            brotli_exact(stream, size).map_err(|reason| {
                brotli_error.set(Some(reason));
                reason.into()
            })
        };
        let out = wuff::decompress_woff2_with_custom_brotli(woff2, &mut brotli)
            .map_err(|_| brotli_error.get().unwrap_or("The WOFF2 header, sizes or tables are not valid."))?;
        if out.len() > MAX_OUTPUT {
            return Err("The decoded font is larger than 30 MB.");
        }
        Ok(out)
    }
}

#[derive(Default)]
struct State {
    inputs: BTreeMap<usize, Vec<u8>>,
    output: Vec<u8>,
    allocated: usize,
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, &'static str> {
    match op {
        OP_DECODE => decode_woff2(bytes),
        _ => Err("Unknown operation."),
    }
}

/// A zeroed input buffer of `length` bytes, or 0 when it would pass the input limit.
#[allow(unsafe_code)] // Exported symbol name only; the body owns its buffers.
#[unsafe(no_mangle)]
pub extern "C" fn woff2_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) {
            return 0;
        }
        let mut bytes = Vec::new();
        if bytes.try_reserve_exact(length).is_err() {
            return 0;
        }
        bytes.resize(length, 0);
        let ptr = bytes.as_ptr() as usize;
        s.inputs.insert(ptr, bytes);
        s.allocated += length;
        ptr
    })
}

#[allow(unsafe_code)] // Exported symbol name only.
#[unsafe(no_mangle)]
pub extern "C" fn woff2_free(ptr: usize) {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if let Some(b) = s.inputs.remove(&ptr) {
            s.allocated -= b.len();
        }
    });
}

/// Run `op` on the buffer at `ptr`. 0: the result holds the answer; 1: it holds a reason.
#[allow(unsafe_code)] // Exported symbol name only.
#[unsafe(no_mangle)]
pub extern "C" fn woff2_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s
            .inputs
            .get(&ptr)
            .filter(|b| b.len() == length)
            .ok_or("Invalid request buffer.")
            .and_then(|b| dispatch(b, op));
        match result {
            Ok(out) => {
                s.output = out;
                0
            }
            Err(reason) => {
                s.output = reason.as_bytes().to_vec();
                1
            }
        }
    })
}

#[allow(unsafe_code)] // Exported symbol name only.
#[unsafe(no_mangle)]
pub extern "C" fn woff2_result_ptr() -> usize {
    STATE.with(|s| s.borrow().output.as_ptr() as usize)
}

#[allow(unsafe_code)] // Exported symbol name only.
#[unsafe(no_mangle)]
pub extern "C" fn woff2_result_len() -> usize {
    STATE.with(|s| s.borrow().output.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_what_is_not_woff2() {
        assert!(decode_woff2(b"wOFF0000").is_err());
        assert!(decode_woff2(&[]).is_err());
        assert_eq!(decode_woff2(&vec![0u8; MAX_INPUT + 1]), Err("The WOFF2 file is larger than 32 MB."));
    }

    #[test]
    fn the_abi_round_trips_a_refusal() {
        let ptr = woff2_alloc(4);
        assert_ne!(ptr, 0);
        assert_eq!(woff2_run(ptr, 4, OP_DECODE), 1);
        assert!(woff2_result_len() > 0);
        assert_eq!(woff2_run(ptr, 4, 9), 1);
        assert_eq!(woff2_run(ptr + 1, 4, OP_DECODE), 1);
        woff2_free(ptr);
        assert_eq!(woff2_alloc(0), 0);
        assert_eq!(woff2_alloc(MAX_INPUT + 1), 0);
    }
}
