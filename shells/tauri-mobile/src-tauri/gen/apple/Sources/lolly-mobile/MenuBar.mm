// SPDX-License-Identifier: MPL-2.0
//
// iPadOS menu bar (and hold-Cmd shortcut HUD on older iPadOS).
//
// Wry owns the UIApplication delegate, so this file installs the UIKit menu
// hooks from the OUTSIDE: a constructor observes didFinishLaunching, then
// class_addMethod()s buildMenuWithBuilder: (and one action selector) onto the
// delegate's class - the delegate does not implement either, so this never
// collides with wry. All content/behaviour lives in the web shell's tiny
// window.__lollyMenu surface (shells/web/src/lib/app-menu.ts): dynamic data
// (tool names, utilities, project folders, current theme) is pulled with
// callAsyncJavaScript, and every action evaluates back into it, so this file
// stays a dumb projection of the web app.
//
// Graceful degradation, deliberately: iPadOS 26+ shows the system menu bar;
// older iPadOS surfaces the keyed commands in the hold-Cmd HUD when a
// hardware keyboard is attached; no keyboard, no menu, no behaviour change.
// Every API used here is iOS 14/15-era (deployment target is 15.0).

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

static NSDictionary *gMenuData = nil;   // last payload from __lollyMenu.data()
static __weak WKWebView *gWebView = nil;

// ── WKWebView plumbing ───────────────────────────────────────────────────────

static WKWebView *findWebView(UIView *view) {
  if ([view isKindOfClass:[WKWebView class]]) return (WKWebView *)view;
  for (UIView *sub in view.subviews) {
    WKWebView *found = findWebView(sub);
    if (found) return found;
  }
  return nil;
}

static WKWebView *webView(void) {
  if (gWebView) return gWebView;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      WKWebView *wv = findWebView(window);
      if (wv) { gWebView = wv; return wv; }
    }
  }
  return nil;
}

static void runMenuJS(NSString *js) {
  [webView() evaluateJavaScript:js completionHandler:nil];
}

static void openRoute(NSString *hash) {
  NSData *json = [NSJSONSerialization dataWithJSONObject:@[hash] options:0 error:nil];
  NSString *arg = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
  runMenuJS([NSString stringWithFormat:@"window.__lollyMenu&&window.__lollyMenu.open(%@[0])", arg]);
}

static void pullMenuData(void) {
  WKWebView *wv = webView();
  if (!wv) return;
  [wv callAsyncJavaScript:@"return window.__lollyMenu ? await window.__lollyMenu.data() : null;"
                arguments:@{}
                  inFrame:nil
           inContentWorld:WKContentWorld.pageWorld
        completionHandler:^(id result, NSError *error) {
          if (error || ![result isKindOfClass:[NSDictionary class]]) return;
          gMenuData = result;
          dispatch_async(dispatch_get_main_queue(), ^{
            [UIMenuSystem.mainSystem setNeedsRebuild];
          });
        }];
}

// ── Menu construction ────────────────────────────────────────────────────────

// UIKeyCommands dispatch through the responder chain, so the shared action
// (installed on the app delegate below) reads the route from propertyList.
static const SEL kInvokeSel = @selector(lollyMenuInvoke:);

static UIKeyCommand *keyed(NSString *title, NSString *input, UIKeyModifierFlags mods, NSString *hash) {
  UIKeyCommand *cmd = [UIKeyCommand commandWithTitle:title
                                               image:nil
                                              action:kInvokeSel
                                               input:input
                                       modifierFlags:mods
                                        propertyList:hash];
  return cmd;
}

static UIAction *routeAction(NSString *title, NSString *hash) {
  return [UIAction actionWithTitle:title image:nil identifier:nil
                           handler:^(UIAction *a) { openRoute(hash); }];
}

static NSArray<UIMenuElement *> *entryActions(NSArray *entries, NSString *hashPrefix) {
  NSMutableArray<UIMenuElement *> *items = [NSMutableArray array];
  for (NSDictionary *e in entries) {
    if (![e isKindOfClass:[NSDictionary class]]) continue;
    NSString *eid = e[@"id"], *name = e[@"name"];
    if (![eid isKindOfClass:[NSString class]] || ![name isKindOfClass:[NSString class]]) continue;
    [items addObject:routeAction(name, [hashPrefix stringByAppendingString:eid])];
  }
  return items;
}

static UIMenu *inlineMenu(NSArray<UIMenuElement *> *children) {
  return [UIMenu menuWithTitle:@"" image:nil identifier:nil
                       options:UIMenuOptionsDisplayInline children:children];
}

static void buildLollyMenus(id<UIMenuBuilder> builder) {
  if (builder.system != UIMenuSystem.mainSystem) return;

  NSArray *utilities = gMenuData[@"utilities"] ?: @[];
  NSArray *folders = gMenuData[@"folders"] ?: @[];
  NSArray *tools = gMenuData[@"tools"] ?: @[];
  NSString *theme = [gMenuData[@"theme"] isKindOfClass:[NSString class]] ? gMenuData[@"theme"] : @"light";

  // Go - the navigation hub. Keyed items stay reachable pre-26 via the Cmd HUD.
  NSMutableArray<UIMenuElement *> *go = [NSMutableArray array];
  [go addObject:keyed(@"Home", @"h", UIKeyModifierCommand | UIKeyModifierShift, @"#/")];

  NSMutableArray<UIMenuElement *> *projects = [NSMutableArray array];
  [projects addObject:keyed(@"All Projects", @"p", UIKeyModifierCommand | UIKeyModifierShift, @"#/p")];
  NSArray *folderItems = entryActions(folders, @"#/p/");
  if (folderItems.count) [projects addObject:inlineMenu(folderItems)];
  [go addObject:[UIMenu menuWithTitle:@"Projects" children:projects]];

  NSMutableArray<UIMenuElement *> *utils = [NSMutableArray array];
  [utils addObject:keyed(@"All Utilities", @"u", UIKeyModifierCommand | UIKeyModifierShift, @"#/u")];
  NSArray *utilItems = entryActions(utilities, @"#/tool/");
  if (utilItems.count) [utils addObject:inlineMenu(utilItems)];
  [go addObject:[UIMenu menuWithTitle:@"Utilities" children:utils]];

  [go addObject:inlineMenu(@[
    routeAction(@"Catalog", @"#/c"),
    routeAction(@"Dashboard", @"#/d"),
    routeAction(@"Batch", @"#/batch"),
    routeAction(@"Colour Lab", @"#/lab"),
    routeAction(@"Verify a File", @"#/valid"),
    routeAction(@"Unpack a PDF", @"#/unpack")
  ])];
  [go addObject:inlineMenu(@[
    keyed(@"Set Up Your Brand", @"b", UIKeyModifierCommand | UIKeyModifierShift, @"#/start"),
    keyed(@"Profile & Settings", @",", UIKeyModifierCommand, @"#/profile")
  ])];
  UIMenu *goMenu = [UIMenu menuWithTitle:@"Go" children:go];

  // Tools - the same six leads the gallery greets a new user with.
  NSMutableArray<UIMenuElement *> *toolItems = [NSMutableArray array];
  BOOL first = YES;
  for (NSDictionary *e in tools) {
    if (![e isKindOfClass:[NSDictionary class]]) continue;
    NSString *eid = e[@"id"], *name = e[@"name"];
    if (![eid isKindOfClass:[NSString class]] || ![name isKindOfClass:[NSString class]]) continue;
    NSString *hash = [@"#/tool/" stringByAppendingString:eid];
    [toolItems addObject:first ? keyed(name, @"n", UIKeyModifierCommand, hash) : routeAction(name, hash)];
    first = NO;
  }
  UIMenu *toolsMenu = toolItems.count ? [UIMenu menuWithTitle:@"Tools" children:toolItems] : nil;

  // Appearance - radio over the three themes, state from the last data pull.
  NSMutableArray<UIMenuElement *> *themeItems = [NSMutableArray array];
  for (NSArray *pair in @[@[@"Light", @"light"], @[@"Dark", @"dark"], @[@"Brand", @"brand"]]) {
    NSString *label = pair[0], *value = pair[1];
    UIAction *item = [UIAction actionWithTitle:label image:nil identifier:nil
                                       handler:^(UIAction *a) {
      runMenuJS([NSString stringWithFormat:@"window.__lollyMenu&&window.__lollyMenu.setTheme('%@')", value]);
      // Re-pull shortly so the checkmark follows the change.
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.6 * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{ pullMenuData(); });
    }];
    item.state = [theme isEqualToString:value] ? UIMenuElementStateOn : UIMenuElementStateOff;
    [themeItems addObject:item];
  }
  UIMenu *appearance = [UIMenu menuWithTitle:@"Appearance" children:themeItems];

  // Help - the first-timer path.
  NSArray<UIMenuElement *> *helpItems = @[
    routeAction(@"Quickstart", @"#/docs/quickstart"),
    routeAction(@"Documentation", @"#/docs/index"),
    routeAction(@"Ask Lolly", @"#/ask")
  ];

  // Place: Go/Tools after File; Appearance inside the system View menu (or as
  // a sibling when absent); Help items into the system Help menu likewise.
  [builder insertSiblingMenu:goMenu afterMenuForIdentifier:UIMenuFile];
  if (toolsMenu) [builder insertSiblingMenu:toolsMenu afterMenuForIdentifier:goMenu.identifier];
  if ([builder menuForIdentifier:UIMenuView]) {
    [builder insertChildMenu:[UIMenu menuWithTitle:@"" image:nil identifier:nil
                                           options:UIMenuOptionsDisplayInline children:@[appearance]]
               atEndOfMenuForIdentifier:UIMenuView];
  } else {
    [builder insertSiblingMenu:[UIMenu menuWithTitle:@"View" children:@[appearance]]
                     afterMenuForIdentifier:(toolsMenu ?: goMenu).identifier];
  }
  if ([builder menuForIdentifier:UIMenuHelp]) {
    [builder insertChildMenu:inlineMenu(helpItems) atEndOfMenuForIdentifier:UIMenuHelp];
  } else {
    [builder insertSiblingMenu:[UIMenu menuWithTitle:@"Help" children:helpItems]
                     afterMenuForIdentifier:(toolsMenu ?: goMenu).identifier];
  }
}

// ── Installation onto wry's app delegate ─────────────────────────────────────

static void lollyBuildMenu(id self, SEL _cmd, id builderObj) {
  buildLollyMenus((id<UIMenuBuilder>)builderObj);
}

static void lollyInvoke(id self, SEL _cmd, id sender) {
  if ([sender isKindOfClass:[UIKeyCommand class]]) {
    id hash = ((UIKeyCommand *)sender).propertyList;
    if ([hash isKindOfClass:[NSString class]]) openRoute(hash);
  }
}

__attribute__((constructor))
static void lollyMenuBarInit(void) {
  [NSNotificationCenter.defaultCenter
      addObserverForName:UIApplicationDidFinishLaunchingNotification
                  object:nil
                   queue:NSOperationQueue.mainQueue
              usingBlock:^(NSNotification *note) {
    Class delegateClass = [UIApplication.sharedApplication.delegate class];
    if (!delegateClass) return;
    // Both adds fail harmlessly if wry ever implements them itself.
    class_addMethod(delegateClass, @selector(buildMenuWithBuilder:),
                    (IMP)lollyBuildMenu, "v@:@");
    class_addMethod(delegateClass, kInvokeSel, (IMP)lollyInvoke, "v@:@");
    // The webview exists a beat after launch; retry the first data pull.
    for (int delay = 1; delay <= 9; delay += 4) {
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{ pullMenuData(); });
    }
  }];
  // Folders/theme can change while running; refresh whenever we come back.
  [NSNotificationCenter.defaultCenter
      addObserverForName:UIApplicationDidBecomeActiveNotification
                  object:nil
                   queue:NSOperationQueue.mainQueue
              usingBlock:^(NSNotification *note) { pullMenuData(); }];
}
