// SPDX-License-Identifier: MPL-2.0
#import <Foundation/Foundation.h>

#import "LollyArchiveThumbnail.h"

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 2)
      return 64;
    NSError *error = nil;
    NSData *png =
        LollyPNGThumbnailAtURL([NSURL fileURLWithPath:@(argv[1])], &error);
    if (png == nil) {
      fprintf(stderr, "%s\n",
              error.localizedDescription.UTF8String ?: "No thumbnail");
      return 1;
    }
    printf("%lu\n", (unsigned long)png.length);
    return 0;
  }
}
