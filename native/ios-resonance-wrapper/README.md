# Resonance Haptics iOS wrapper

This is a tiny native iOS shell for testing real iPhone haptics with the live
`/resonance` web experience.

It loads:

```text
https://crowdsource-mvp.vercel.app/resonance
```

and listens for the existing `crowdsourceChoirResonanceHaptics` WKWebView bridge.

## Run on an iPhone

1. Open `ResonanceHaptics.xcodeproj` in Xcode on a Mac.
2. Select the `ResonanceHaptics` target.
3. In **Signing & Capabilities**, choose your Apple developer team.
4. Connect your iPhone and choose it as the run destination.
5. Press **Run**.
6. In the app, hold the orb during the resonance flow.

## What this proves

- The web UI remains the source of truth.
- The app receives `preview`, `start`, `update`, and `stop` haptic messages.
- iPhone haptics are triggered natively with Core Haptics.

## Notes

- This is a quick device-test wrapper, not the final App Clip target.
- If the phone is in Low Power Mode or system haptics are disabled, iOS may reduce
  or suppress haptic output.
- This wrapper can become the basis for an App Clip once the haptic feel is right.
