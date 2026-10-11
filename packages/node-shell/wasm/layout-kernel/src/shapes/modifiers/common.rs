// SPDX-License-Identifier: MPL-2.0
// Copyright (c) KALEIDOS SUBSIDIARY SL
// Adapted from Penpot 10955f17e27943429a10e90360d0404e3f56e27c.
use std::collections::HashMap;

use crate::math::Bounds;
use crate::shapes::Shape;
use crate::uuid::Uuid;

pub trait GetBounds {
    fn find(&self, shape: &Shape) -> Bounds;
}

impl GetBounds for HashMap<Uuid, Bounds> {
    fn find(&self, shape: &Shape) -> Bounds {
        self.get(&shape.id).copied().unwrap_or(shape.bounds())
    }
}
