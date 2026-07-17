---
"@canvas-tile-engine/react-native": minor
---

Touch input now runs through react-native-gesture-handler

The React Native binding replaces the JS responder system with a Manual react-native-gesture-handler gesture used as a raw touch transport into the engine's existing gesture pipeline. Because RNGH participates in native gesture arbitration, interactive maps now work inside `ScrollView`s on the New Architecture: the map claims the touch stream while interactions are enabled, and yields to the page scroll when they are not. Tap detection, pinch handling, and the iOS touch-drop defenses are unchanged.

**Migration:** install the new peer dependency `react-native-gesture-handler` (>=2.14) in your app and wrap the app root in `GestureHandlerRootView`. Without the root view the map receives no touch input.
