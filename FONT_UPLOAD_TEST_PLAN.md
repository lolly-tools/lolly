# Font Upload Test Plan & Verification

## Overview
This document details the comprehensive test for the font file upload feature in Lolly's web shell. Each verification point is mapped to the source code that implements it.

## Test Setup
- **Test Font File**: `/tmp/lolly-test-fonts/TestFont.ttf` (108 KB, Outfit variable font)
- **Dev Server**: http://localhost:5177
- **Target**: Brand Studio Fonts tab (/#/start → Fonts tab)

---

## Verification Checklist

### 1. File Storage in IndexedDB (user/fonts/<family>/<index>)

**Expected Result**: Font stored with ID `user/fonts/outfit/0`

**Source Code Location**: 
- `shells/web/src/lib/font-asset-handler.ts:50-57`
- Creates asset ID: `user/fonts/${familySlug}/${nextIndex}`

**Verification Steps**:
1. Open Chrome DevTools → Application tab
2. Navigate to IndexedDB → lolly (or similar DB) → user-assets
3. **Expected**: Entry with key `user/fonts/outfit/0`
4. Check the stored data structure:
```javascript
{
  id: "user/fonts/outfit/0",
  type: "font",
  version: "1.0.0",
  tier: "on-demand",
  blob: Blob,
  meta: {
    family: "Outfit",
    weight: 400-900,
    style: "normal",
    fileName: "TestFont.ttf",
    installedAt: <timestamp>
  }
}
```

**Code Reference**:
- Storage: `shells/web/src/lib/font-asset-handler.ts:85-91`
- The key is `font-asset:user/fonts/outfit/0`
- Data includes blob, metadata, format, and fileSize

---

### 2. Metadata Extraction (Family, Weight, Style)

**Expected Result**:
- Family: "Outfit" (from TTF name table, ID 16 or 1)
- Weight: 400-900 (variable; from OS/2 table)
- Style: "normal" (from name table ID 2)

**Source Code Location**: `shells/web/src/lib/font-utils.ts`

**Verification Steps**:
1. In DevTools Console, run:
```javascript
// Check IndexedDB state
const db = await indexedDB.databases()[0];
const store = db.getAll('user-assets');
const fontAsset = store.find(r => r.id === 'user/fonts/outfit/0');
console.log(fontAsset.meta);
// Expected output:
// {
//   family: "Outfit",
//   weight: 400 or "400 900" (variable range),
//   style: "normal",
//   fileName: "TestFont.ttf",
//   installedAt: <timestamp>
// }
```

**Parsing Logic**:
- `parseFontMetadata()` reads TTF structure:
  - Scaler type (4 bytes) + table count (2 bytes)
  - Finds 'name' table for family + style
  - Finds 'OS/2' table for weight
- Name ID 16 (Typographic Family) preferred; fallback to ID 1
- Style detected from name ID 2 (Subfamily) substring matching "italic"/"oblique"

**Code Reference**:
- `parseFontMetadata()`: shells/web/src/lib/font-utils.ts:40-78
- `extractFamilyName()`: lines 85-122
- `extractWeight()`: lines 124-132
- `extractStyle()`: lines 134-162

---

### 3. Appearance in Brand Fonts Tab

**Expected Result**: Font listed in the Fonts manager UI

**Source Code Location**: `shells/web/src/components/fonts-manager.ts`

**Verification Steps**:
1. Navigate to /#/start (Brand Studio)
2. Click "Fonts" tab
3. **Expected**: "Outfit" listed with:
   - Family name: "Outfit"
   - Weight: "400" (or "400-900" for variable)
   - Style: "normal"
   - File size: "108.0 KB"
   - Delete button (×)

**UI Rendering Logic**:
- `getInstalledFonts()` queries `host.state` for `font-asset:user/fonts/*` entries
- Maps metadata to `InstalledFont` interface
- `refreshFontList()` renders HTML with metadata display

**Code Reference**:
- Font listing: shells/web/src/components/fonts-manager.ts:123-162
- Query logic: shells/web/src/lib/font-asset-handler.ts:113-137

---

### 4. Appearance in Catalog Font List

**Expected Result**: Font available in catalog font selector (asset picker in tools)

**Source Code Location**: `shells/web/src/bridge/font-registry.ts`

**Verification Steps**:
1. Open any tool that accepts a font input (e.g., Layout Studio, Text Helper)
2. Click on the font selector/asset picker
3. **Expected**: "Outfit" appears in the list under "User Fonts" or similar section
4. Font is selectable for rendering

**Registry Logic**:
- `buildRegistry()` reads IndexedDB `user-assets` store
- Filters for `type: 'font'` and `id.startsWith('user/fonts/')`
- Adds to family map with computed family key (lowercase)
- Registry resolves font family → face chain for rendering

**Code Reference**:
- Registry build: shells/web/src/bridge/font-registry.ts:210-236
- Font resolution: lines 288-321

---

### 5. document.fonts Contains Font-Face

**Expected Result**: Font-face registered in browser's font loading API

**Source Code Location**: `shells/web/src/bridge/font-registry.ts` + shell initialization

**Verification Steps**:
1. In DevTools Console, after upload:
```javascript
// Check document.fonts
Array.from(document.fonts).forEach(f => {
  if (f.family.includes('Outfit')) {
    console.log({
      family: f.family,
      weight: f.weight,
      style: f.style,
      status: f.status // 'loaded' or 'loading' or 'error'
    });
  }
});

// Or check loaded fonts
document.fonts.ready.then(() => {
  console.log('All fonts loaded');
  document.fonts.forEach(f => console.log(f.family, f.weight, f.style));
});
```

**Registration Flow**:
1. `refreshFontRegistry()` called after install
2. Dispatches `lolly:fonts-refreshing` custom event
3. Calls `host.fonts?.refresh?.()` (shell's bridge implementation)
4. Shell's font bridge (`shells/web/src/bridge/`) registers font-faces via:
   - CSS @font-face rules injected dynamically
   - Or uses CSS Font Loading API (`document.fonts.add()`)
   - Points to stored blob URL

**Code Reference**:
- Registry refresh: shells/web/src/lib/font-asset-handler.ts:156-180
- Font registry for vector export: shells/web/src/bridge/font-registry.ts:70-72, 210-236

---

### 6. Format Detection

**Expected Result**: TTF detected correctly; size and format preserved

**Source Code Location**: `shells/web/src/lib/font-utils.ts:18-34`

**Verification Steps**:
1. In IndexedDB, check stored record for format field
2. **Expected**: `format: "ttf"` (magic bytes 0x00010000 or 'true')
3. File size preserved: ~108 KB
4. Blob type: `application/octet-stream` or `font/ttf`

**Format Detection Logic**:
```javascript
function detectFontFormat(buffer: ArrayBuffer): FontFormat {
  const view = new Uint8Array(buffer);
  const magic = (view[0] << 24) | (view[1] << 16) | (view[2] << 8) | view[3];
  
  // TTF: 0x00010000 or 'true' (0x74727565)
  if (magic === 0x00010000 || magic === 0x74727565) return 'ttf';
  // OTF: 'OTTO' (0x4f54544f)
  if (magic === 0x4f54544f) return 'otf';
  // WOFF: 'wOFF' (0x774f4646)
  if (magic === 0x774f4646) return 'woff';
  // WOFF2: 'wOF2' (0x774f4632)
  if (magic === 0x774f4632) return 'woff2';
  return 'unknown';
}
```

**Code Reference**: shells/web/src/lib/font-utils.ts:18-34

---

## Test Execution Checklist

- [ ] Dev server running on localhost:5177
- [ ] Test font file exists: `/tmp/lolly-test-fonts/TestFont.ttf`
- [ ] Navigate to http://localhost:5177/#/start
- [ ] Click "Fonts" tab in Brand Studio
- [ ] Drag/drop or click to upload TestFont.ttf
- [ ] Verify point 1: IndexedDB entry `user/fonts/outfit/0`
- [ ] Verify point 2: Metadata fields extracted correctly
- [ ] Verify point 3: Font appears in Fonts tab UI
- [ ] Verify point 4: Font selectable in tool font pickers
- [ ] Verify point 5: Run document.fonts check in console
- [ ] Verify point 6: Format detected as TTF, size preserved

---

## Expected Console Output

```javascript
// From fonts-manager.ts:96
"Installed font: Outfit (400)"

// From font-registry.ts custom events
Event {
  type: 'lolly:fonts-refreshed',
  detail: { timestamp: <number> }
}

// From document.fonts API
FontFace {
  family: "'Outfit'",
  weight: "400 900",
  style: "normal",
  status: "loaded"
}
```

---

## Error Cases to Check

If upload fails, check console for:
1. "Font file must be smaller than 5MB" → File validation error
2. "Could not extract metadata" → TTF parsing failed
3. "Font installation failed" → IDB write error
4. "Font registry refresh failed" → Bridge method unavailable

**Code Reference**: 
- Validation: shells/web/src/lib/font-utils.ts:190-203
- Error handling: shells/web/src/lib/font-asset-handler.ts:104-107

---

## Integration Points

1. **Host Bridge (`host.state`)**
   - Stores: `font-asset:user/fonts/outfit/0`
   - Queries: `host.assets?.query?({ namespace: 'user/fonts' })`

2. **Font Registry**
   - Reads from IndexedDB on every vector export
   - Resolves font family → sfnt URL for HarfBuzz shaping

3. **UI Components**
   - FontsManager component in Brand Studio
   - Font pickers in tool inputs

4. **Runtime**
   - Engine `host.fonts.refresh()` called after install
   - Engine v1.29+ with text-to-path support relies on this

---

## Files Modified During Upload

- **IndexedDB** (user-assets store): New entry with font data
- **Browser Session State**: Custom events dispatched
- **Memory**: sfntUrls cache populated on vector export
- **No disk writes** (PWA mode)

---

## Notes

- Font upload is **offline-first** via IndexedDB
- No server upload — all storage is client-side
- Fonts persist across browser sessions (IndexedDB persistence)
- Variable fonts (TTF with wght axis) supported
- WOFF2 automatically decompressed for vector export (HarfBuzz requirement)
