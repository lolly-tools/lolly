// SPDX-License-Identifier: MPL-2.0
#import <AppKit/AppKit.h>
#import <QuickLookThumbnailing/QuickLookThumbnailing.h>

#import "LollyArchiveThumbnail.h"

@interface LollyThumbnailProvider : QLThumbnailProvider
@end

@implementation LollyThumbnailProvider

- (void)provideThumbnailForFileRequest:(QLFileThumbnailRequest *)request
                     completionHandler:(void (^)(QLThumbnailReply *_Nullable,
                                                 NSError *_Nullable))handler {
  NSError *error = nil;
  NSData *png = LollyPNGThumbnailAtURL(request.fileURL, &error);
  NSImage *image = png == nil ? nil : [[NSImage alloc] initWithData:png];
  if (image == nil || image.size.width <= 0 || image.size.height <= 0) {
    handler(nil, error);
    return;
  }

  CGSize maximum = request.maximumSize;
  CGFloat scale =
      MIN(maximum.width / image.size.width, maximum.height / image.size.height);
  scale = MIN(scale, 1.0);
  CGSize size = CGSizeMake(MAX(1, floor(image.size.width * scale)),
                           MAX(1, floor(image.size.height * scale)));
  QLThumbnailReply *reply = [QLThumbnailReply
            replyWithContextSize:size
      currentContextDrawingBlock:^BOOL {
        [image drawInRect:NSMakeRect(0, 0, size.width, size.height)
                  fromRect:NSZeroRect
                 operation:NSCompositingOperationSourceOver
                  fraction:1.0
            respectFlipped:YES
                     hints:@{
                       NSImageHintInterpolation : @(NSImageInterpolationHigh)
                     }];
        return YES;
      }];
  handler(reply, nil);
}

@end
