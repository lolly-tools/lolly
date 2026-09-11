// SPDX-License-Identifier: MPL-2.0
#import "LollyArchiveThumbnail.h"

#import <zlib.h>

static const uint32_t kEndSignature = 0x06054b50;
static const uint32_t kCentralSignature = 0x02014b50;
static const uint32_t kLocalSignature = 0x04034b50;
static const NSUInteger kEndRecordBytes = 22;
static const NSUInteger kMaximumCommentBytes = 65535;
static const NSUInteger kMaximumCentralDirectoryBytes = 8 * 1024 * 1024;
static const NSUInteger kMaximumManifestBytes = 32 * 1024 * 1024;
static const NSUInteger kMaximumThumbnailBytes = 16 * 1024 * 1024;

static NSString *const LollyQuickLookErrorDomain =
    @"tools.lolly.Desktop.QuickLook";

typedef NS_ENUM(NSInteger, LollyQuickLookError) {
  LollyQuickLookInvalidArchive = 1,
  LollyQuickLookMissingThumbnail = 2,
};

static void SetError(NSError **error, LollyQuickLookError code,
                     NSString *description) {
  if (error == NULL)
    return;
  *error = [NSError errorWithDomain:LollyQuickLookErrorDomain
                               code:code
                           userInfo:@{NSLocalizedDescriptionKey : description}];
}

static uint16_t Read16(const uint8_t *bytes) {
  return (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8);
}

static uint32_t Read32(const uint8_t *bytes) {
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) |
         ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static NSData *_Nullable ReadRange(NSFileHandle *file, uint64_t offset,
                                   NSUInteger length, uint64_t fileSize,
                                   NSError **error) {
  if (offset > fileSize || length > fileSize - offset) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"A ZIP range is outside the file.");
    return nil;
  }
  @try {
    [file seekToFileOffset:offset];
    NSData *data = [file readDataOfLength:length];
    if (data.length != length) {
      SetError(error, LollyQuickLookInvalidArchive,
               @"The archive ended unexpectedly.");
      return nil;
    }
    return data;
  } @catch (NSException *exception) {
    SetError(error, LollyQuickLookInvalidArchive,
             exception.reason ?: @"The archive could not be read.");
    return nil;
  }
}

static NSData *_Nullable InflateRaw(NSData *compressed, NSUInteger outputLength,
                                    NSError **error) {
  if (outputLength == 0)
    return [NSData data];
  NSMutableData *output = [NSMutableData dataWithLength:outputLength];
  z_stream stream = {0};
  stream.next_in = (Bytef *)compressed.bytes;
  stream.avail_in = (uInt)compressed.length;
  stream.next_out = output.mutableBytes;
  stream.avail_out = (uInt)output.length;

  if (inflateInit2(&stream, -MAX_WBITS) != Z_OK) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"The ZIP inflater could not start.");
    return nil;
  }
  int status = inflate(&stream, Z_FINISH);
  inflateEnd(&stream);
  if (status != Z_STREAM_END || stream.total_out != outputLength) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"The manifest could not be decompressed.");
    return nil;
  }
  return output;
}

static NSData *_Nullable ManifestData(NSFileHandle *file, uint64_t fileSize,
                                      NSError **error) {
  if (fileSize < kEndRecordBytes) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"The file is too short to be a ZIP archive.");
    return nil;
  }

  NSUInteger tailLength =
      (NSUInteger)MIN(fileSize, kEndRecordBytes + kMaximumCommentBytes);
  NSData *tail =
      ReadRange(file, fileSize - tailLength, tailLength, fileSize, error);
  if (tail == nil)
    return nil;
  const uint8_t *tailBytes = tail.bytes;
  NSInteger endOffset = -1;
  for (NSInteger i = (NSInteger)tailLength - (NSInteger)kEndRecordBytes; i >= 0;
       i--) {
    if (Read32(tailBytes + i) == kEndSignature &&
        (NSUInteger)i + kEndRecordBytes + Read16(tailBytes + i + 20) ==
            tailLength) {
      endOffset = i;
      break;
    }
  }
  if (endOffset < 0) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"The ZIP end record is missing.");
    return nil;
  }

  const uint8_t *end = tailBytes + endOffset;
  if (Read16(end + 4) != 0 || Read16(end + 6) != 0) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"Multi-disk ZIP archives are not supported.");
    return nil;
  }
  uint32_t centralLength = Read32(end + 12);
  uint32_t centralOffset = Read32(end + 16);
  if (centralLength > kMaximumCentralDirectoryBytes) {
    SetError(error, LollyQuickLookInvalidArchive,
             @"The ZIP directory is too large for a preview.");
    return nil;
  }

  NSData *central =
      ReadRange(file, centralOffset, centralLength, fileSize, error);
  if (central == nil)
    return nil;
  const uint8_t *bytes = central.bytes;
  NSUInteger offset = 0;
  while (offset + 46 <= central.length) {
    const uint8_t *entry = bytes + offset;
    if (Read32(entry) != kCentralSignature) {
      SetError(error, LollyQuickLookInvalidArchive,
               @"The ZIP directory is malformed.");
      return nil;
    }
    uint16_t method = Read16(entry + 10);
    uint32_t expectedCRC = Read32(entry + 16);
    uint32_t compressedLength = Read32(entry + 20);
    uint32_t outputLength = Read32(entry + 24);
    uint16_t nameLength = Read16(entry + 28);
    uint16_t extraLength = Read16(entry + 30);
    uint16_t commentLength = Read16(entry + 32);
    uint32_t localOffset = Read32(entry + 42);
    NSUInteger next = offset + 46u + nameLength + extraLength + commentLength;
    if (next > central.length) {
      SetError(error, LollyQuickLookInvalidArchive,
               @"A ZIP directory entry is truncated.");
      return nil;
    }

    NSData *name =
        [central subdataWithRange:NSMakeRange(offset + 46, nameLength)];
    static const char manifestName[] = "manifest.json";
    BOOL isManifest =
        name.length == sizeof(manifestName) - 1 &&
        memcmp(name.bytes, manifestName, sizeof(manifestName) - 1) == 0;
    if (isManifest) {
      if ((method != 0 && method != 8) ||
          outputLength > kMaximumManifestBytes ||
          compressedLength > kMaximumManifestBytes) {
        SetError(error, LollyQuickLookInvalidArchive,
                 @"The manifest uses an unsupported ZIP shape.");
        return nil;
      }
      NSData *localHeader = ReadRange(file, localOffset, 30, fileSize, error);
      if (localHeader == nil)
        return nil;
      const uint8_t *local = localHeader.bytes;
      if (Read32(local) != kLocalSignature) {
        SetError(error, LollyQuickLookInvalidArchive,
                 @"The manifest ZIP header is invalid.");
        return nil;
      }
      uint64_t dataOffset =
          (uint64_t)localOffset + 30u + Read16(local + 26) + Read16(local + 28);
      NSData *compressed =
          ReadRange(file, dataOffset, compressedLength, fileSize, error);
      if (compressed == nil)
        return nil;
      NSData *manifest = method == 0
                             ? compressed
                             : InflateRaw(compressed, outputLength, error);
      if (manifest == nil || manifest.length != outputLength)
        return nil;
      uLong actualCRC = crc32(0L, Z_NULL, 0);
      actualCRC = crc32(actualCRC, manifest.bytes, (uInt)manifest.length);
      if ((uint32_t)actualCRC != expectedCRC) {
        SetError(error, LollyQuickLookInvalidArchive,
                 @"The manifest failed its integrity check.");
        return nil;
      }
      return manifest;
    }
    offset = next;
  }

  SetError(error, LollyQuickLookInvalidArchive,
           @"The archive has no manifest.json.");
  return nil;
}

NSData *_Nullable LollyPNGThumbnailAtURL(NSURL *url, NSError **error) {
  NSNumber *sizeValue = nil;
  if (![url getResourceValue:&sizeValue forKey:NSURLFileSizeKey error:error] ||
      sizeValue == nil) {
    return nil;
  }
  uint64_t fileSize = sizeValue.unsignedLongLongValue;
  NSFileHandle *file = [NSFileHandle fileHandleForReadingFromURL:url
                                                           error:error];
  if (file == nil)
    return nil;
  NSData *manifestData = ManifestData(file, fileSize, error);
  [file closeFile];
  if (manifestData == nil)
    return nil;

  id parsed = [NSJSONSerialization JSONObjectWithData:manifestData
                                              options:0
                                                error:error];
  if (![parsed isKindOfClass:NSDictionary.class])
    return nil;
  NSDictionary *manifest = parsed;
  if (![manifest[@"format"] isEqual:@"lolly-share"]) {
    SetError(error, LollyQuickLookMissingThumbnail,
             @"This Lolly file is not a saved session.");
    return nil;
  }
  NSString *thumb = manifest[@"thumb"];
  if (![thumb isKindOfClass:NSString.class]) {
    SetError(error, LollyQuickLookMissingThumbnail,
             @"This Lolly file has no embedded thumbnail.");
    return nil;
  }
  static NSString *const prefix = @"data:image/png;base64,";
  if (![thumb hasPrefix:prefix] ||
      thumb.length - prefix.length > kMaximumThumbnailBytes * 2) {
    SetError(error, LollyQuickLookMissingThumbnail,
             @"The embedded thumbnail is not a bounded PNG.");
    return nil;
  }
  NSString *encoded = [thumb substringFromIndex:prefix.length];
  NSData *png = [[NSData alloc] initWithBase64EncodedString:encoded options:0];
  static const uint8_t pngMagic[] = {0x89, 'P',  'N',  'G',
                                     '\r', '\n', 0x1a, '\n'};
  if (png == nil || png.length > kMaximumThumbnailBytes ||
      png.length < sizeof(pngMagic) ||
      memcmp(png.bytes, pngMagic, sizeof(pngMagic)) != 0) {
    SetError(error, LollyQuickLookMissingThumbnail,
             @"The embedded thumbnail is not a valid PNG.");
    return nil;
  }
  return png;
}
