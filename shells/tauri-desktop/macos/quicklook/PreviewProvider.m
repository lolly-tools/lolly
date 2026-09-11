// SPDX-License-Identifier: MPL-2.0
#import <AppKit/AppKit.h>
#import <QuickLookUI/QuickLookUI.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#import "LollyArchiveThumbnail.h"

@interface LollyPreviewProvider : QLPreviewProvider <QLPreviewingController>
@end

@implementation LollyPreviewProvider

- (void)providePreviewForFileRequest:(QLFilePreviewRequest *)request
                   completionHandler:(void (^)(QLPreviewReply *_Nullable,
                                               NSError *_Nullable))handler {
  NSError *error = nil;
  NSData *png = LollyPNGThumbnailAtURL(request.fileURL, &error);
  NSImage *image = png == nil ? nil : [[NSImage alloc] initWithData:png];
  if (image == nil || image.size.width <= 0 || image.size.height <= 0) {
    handler(nil, error);
    return;
  }

  QLPreviewReply *reply = [[QLPreviewReply alloc]
      initWithDataOfContentType:UTTypePNG
                    contentSize:image.size
              dataCreationBlock:^NSData *_Nullable(
                  QLPreviewReply *replyToUpdate, NSError **creationError) {
                (void)replyToUpdate;
                (void)creationError;
                return png;
              }];
  reply.title = request.fileURL.lastPathComponent;
  handler(reply, nil);
}

@end
