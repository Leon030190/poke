# Poke'Catch Offline for iOS

## Build on a Mac

1. Install Node.js 22+, Xcode, and CocoaPods.
2. In Terminal, enter this folder and run `npm install` then `npm run sync:ios`.
3. Open `ios/App/App.xcworkspace` in Xcode.
4. Select the `App` target, choose your Apple Developer Team, and keep bundle ID `com.pokecatch.offline` (or change it to an ID registered to your account).
5. Choose a connected iPhone for testing, or **Any iOS Device** then **Product → Archive** to export an IPA/TestFlight build.

Game data is embedded in the application and saves locally in WKWebView storage. No game server is required.
