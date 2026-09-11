#!/usr/bin/env -S node --import tsx
// SPDX-License-Identifier: MPL-2.0
// Thin launcher so `lolly-tui` runs via the tsx loader (JSX + TS). The primary dev
// entry is `npm run tui`, which runs `tsx src/main.tsx` directly.
import '../src/main.tsx';
