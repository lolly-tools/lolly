// SPDX-License-Identifier: MPL-2.0
//! Shared feature-only qualification broker; ordinary builds do not include this module.
#[path = "../../../tauri-shared/webgpu-product-broker.rs"]
mod shared;
pub use shared::{prepare, route, setup};
