# SPDX-License-Identifier: MPL-2.0
# Merged into the app's R8 configuration. Tauri finds the plugin class by name
# over JNI and calls its commands by reflection.
-keep class tools.lolly.fold.LollyFoldPlugin { *; }
