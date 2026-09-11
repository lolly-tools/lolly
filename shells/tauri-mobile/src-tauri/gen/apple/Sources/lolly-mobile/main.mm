#include "bindings/bindings.h"
#import <AVFoundation/AVFoundation.h>

int main(int argc, char * argv[]) {
	// Background audio (plans/146): the Neurospicy player is a plain <audio> element in
	// the WKWebView. iOS only keeps a web <audio> element sounding while the app is
	// backgrounded/locked if the app's shared audio session is the .playback category
	// (WKWebView's default category is silenced on background) AND Info.plist declares
	// the `audio` UIBackgroundMode. Set the CATEGORY here at launch; it persists for the
	// element WKWebView plays through. Deliberately NOT setActive:YES - activating at
	// launch would duck other apps' audio (Spotify etc.) before the user plays anything;
	// WKWebView activates the session itself when its media starts. See plans/146 for the
	// explicit-activate upgrade path if a device ever needs it.
	NSError *audioErr = nil;
	[[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:&audioErr];
	ffi::start_app();
	return 0;
}
