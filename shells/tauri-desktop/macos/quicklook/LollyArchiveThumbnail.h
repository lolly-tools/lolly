// SPDX-License-Identifier: MPL-2.0
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Reads the embedded PNG session thumbnail from a .lolly archive.
///
/// The reader is deliberately narrow: it accepts the two ZIP methods Lolly
/// writes, bounds every allocation, verifies the manifest entry's CRC, and
/// never follows a path or contacts the network. A brand pack, an old file
/// without a thumbnail, or a malformed archive returns nil so Finder can use
/// the branded document icon.
FOUNDATION_EXPORT NSData *_Nullable LollyPNGThumbnailAtURL(
    NSURL *url, NSError *_Nullable *_Nullable error);

NS_ASSUME_NONNULL_END
