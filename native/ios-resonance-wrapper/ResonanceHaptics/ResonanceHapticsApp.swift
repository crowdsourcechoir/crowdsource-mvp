import SwiftUI

@main
struct ResonanceHapticsApp: App {
    var body: some Scene {
        WindowGroup {
            ResonanceWebView()
                .ignoresSafeArea()
        }
    }
}
