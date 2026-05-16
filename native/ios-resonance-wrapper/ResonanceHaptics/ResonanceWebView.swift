import CoreHaptics
import SwiftUI
import UIKit
import WebKit

private let resonanceURL = URL(string: "https://crowdsource-mvp.vercel.app/resonance")!
private let bridgeName = "crowdsourceChoirResonanceHaptics"

struct ResonanceWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let userContentController = WKUserContentController()
        userContentController.add(context.coordinator, name: bridgeName)

        let nativeMarkerScript = WKUserScript(
            source: "window.CrowdsourceChoirNativeShell = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(nativeMarkerScript)

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController
        configuration.allowsInlineMediaPlayback = true
        if #available(iOS 10.0, *) {
            configuration.mediaTypesRequiringUserActionForPlayback = []
        }

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.load(URLRequest(url: resonanceURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let haptics = ResonanceHapticConductor()

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard
                message.name == bridgeName,
                let body = message.body as? [String: Any],
                body["channel"] as? String == "resonance-haptics",
                let type = body["type"] as? String
            else {
                return
            }

            let intensity = max(0, min(body["intensity"] as? Double ?? 0, 1))

            DispatchQueue.main.async {
                switch type {
                case "preview":
                    self.haptics.preview(intensity: intensity)
                case "start":
                    self.haptics.start(intensity: intensity)
                case "update":
                    self.haptics.update(intensity: intensity)
                case "stop":
                    self.haptics.stop()
                default:
                    break
                }
            }
        }
    }
}

final class ResonanceHapticConductor {
    private var engine: CHHapticEngine?
    private var player: CHHapticAdvancedPatternPlayer?
    private let fallbackImpact = UIImpactFeedbackGenerator(style: .medium)

    private var supportsCoreHaptics: Bool {
        CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    init() {
        fallbackImpact.prepare()
    }

    func preview(intensity: Double) {
        guard supportsCoreHaptics else {
            fallbackImpact.impactOccurred(intensity: CGFloat(max(0.35, intensity)))
            fallbackImpact.prepare()
            return
        }

        do {
            try prepareEngine()
            let event = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(max(0.35, intensity))),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.45),
                ],
                relativeTime: 0
            )
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let previewPlayer = try engine?.makePlayer(with: pattern)
            try previewPlayer?.start(atTime: 0)
        } catch {
            fallbackImpact.impactOccurred(intensity: CGFloat(max(0.35, intensity)))
            fallbackImpact.prepare()
        }
    }

    func start(intensity: Double) {
        guard supportsCoreHaptics else {
            fallbackImpact.impactOccurred(intensity: CGFloat(max(0.35, intensity)))
            fallbackImpact.prepare()
            return
        }

        do {
            stop()
            try prepareEngine()

            let event = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(0.25 + intensity * 0.55)),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.32),
                ],
                relativeTime: 0,
                duration: 30
            )

            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine?.makeAdvancedPlayer(with: pattern)
            self.player = player
            try player?.start(atTime: 0)
        } catch {
            fallbackImpact.impactOccurred(intensity: CGFloat(max(0.35, intensity)))
            fallbackImpact.prepare()
        }
    }

    func update(intensity: Double) {
        guard supportsCoreHaptics, let player else {
            return
        }

        let clamped = max(0, min(intensity, 1))
        do {
            try player.sendParameters(
                [
                    CHHapticDynamicParameter(
                        parameterID: .hapticIntensityControl,
                        value: Float(0.28 + clamped * 0.72),
                        relativeTime: 0
                    ),
                    CHHapticDynamicParameter(
                        parameterID: .hapticSharpnessControl,
                        value: Float(0.25 + clamped * 0.38),
                        relativeTime: 0
                    ),
                ],
                atTime: 0
            )
        } catch {
            stop()
        }
    }

    func stop() {
        try? player?.stop(atTime: 0)
        player = nil
    }

    private func prepareEngine() throws {
        if engine == nil {
            let engine = try CHHapticEngine()
            engine.stoppedHandler = { [weak self] _ in
                self?.player = nil
                self?.engine = nil
            }
            engine.resetHandler = { [weak self] in
                self?.player = nil
                try? self?.engine?.start()
            }
            self.engine = engine
        }

        try engine?.start()
    }
}
