// SPDX-License-Identifier: MPL-2.0
// Native extraction reference. One JSON request per line, no rendering dependency.
use std::io::{self, BufRead};
fn main() {
    for line in io::stdin().lock().lines() {
        let line = line.expect("read reference request");
        let result = lolly_layout_kernel::solve(line.as_bytes());
        match result {
            Ok(bytes) => println!("{}", String::from_utf8(bytes).unwrap()),
            Err(message) => println!("{}", serde_json::json!({"error": message})),
        }
    }
}
