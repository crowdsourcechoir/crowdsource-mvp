# Resonance native haptics bridge

The `/resonance` web experience is the source of truth for the visual/touch loop.
Native shells, including a future iOS App Clip, should attach haptics through this
small bridge instead of forking the interaction UI.

## Message shape

```ts
type NativeHapticMessage = {
  channel: "resonance-haptics";
  type: "preview" | "start" | "update" | "stop";
  intensity: number; // 0..1
  timestamp: number; // Date.now()
};
```

## Preferred JavaScript bridge

Expose this object before `/resonance` hydrates:

```js
window.CrowdsourceChoirResonanceHaptics = {
  preview(message) {},
  start(message) {},
  update(message) {},
  stop(message) {},
};
```

## iOS WKWebView bridge

Alternatively, register a script message handler named:

```text
crowdsourceChoirResonanceHaptics
```

The page will call:

```js
window.webkit.messageHandlers.crowdsourceChoirResonanceHaptics.postMessage(message)
```

## Intended native behavior

- `preview`: brief confirmation when native haptics are enabled.
- `start`: begin a continuous haptic texture.
- `update`: continuously adjust intensity during a hold.
- `stop`: end haptics immediately on release, cancel, blur, or completion.

If no native bridge exists, the web app falls back to Android web vibration or the
opt-in iPhone sound pulse.
