import AppKit
import WebKit

/// One borderless window per display, pinned at desktop level (below Finder icons),
/// showing the live dial. Animation pauses when the desktop is hidden or the display sleeps.
@MainActor
final class WallpaperController {
    private var windows: [NSWindow] = []
    private var webViews: [WKWebView] = []
    private var observers: [NSObjectProtocol] = []
    private(set) var isRunning = false
    private var screensAsleep = false

    func start() {
        guard !isRunning else { return }
        isRunning = true
        buildWindows()
        let center = NotificationCenter.default
        let ws = NSWorkspace.shared.notificationCenter
        observers = [
            center.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.rebuild() }
            },
            ws.addObserver(forName: NSWorkspace.screensDidSleepNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.screensAsleep = true; self?.updatePause() }
            },
            ws.addObserver(forName: NSWorkspace.screensDidWakeNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.screensAsleep = false; self?.updatePause() }
            },
            ws.addObserver(forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.updatePause() }
            },
            center.addObserver(forName: NSWindow.didChangeOcclusionStateNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.updatePause() }
            },
        ]
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        observers.forEach { NotificationCenter.default.removeObserver($0); NSWorkspace.shared.notificationCenter.removeObserver($0) }
        observers = []
        teardown()
    }

    func broadcast(config json: String) {
        webViews.forEach { $0.evaluateJavaScript("TBApp.applyConfig(\(json))") }
    }

    private func rebuild() {
        teardown()
        buildWindows()
    }

    private func teardown() {
        windows.forEach { $0.orderOut(nil) }
        windows = []
        webViews = []
    }

    private func buildWindows() {
        for screen in NSScreen.screens {
            let window = NSWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
            window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]
            window.ignoresMouseEvents = true
            window.hasShadow = false
            window.isOpaque = true
            window.backgroundColor = .black
            window.isReleasedWhenClosed = false

            let web = Web.makeView(mode: "wallpaper", config: ConfigStore.shared.json)
            web.frame = NSRect(origin: .zero, size: screen.frame.size)
            web.autoresizingMask = [.width, .height]
            window.contentView = web
            window.setFrame(screen.frame, display: true)
            window.orderBack(nil)
            windows.append(window)
            webViews.append(web)
        }
    }

    private func updatePause() {
        for (window, web) in zip(windows, webViews) {
            let visible = window.occlusionState.contains(.visible) && !screensAsleep
            web.evaluateJavaScript(visible ? "TBApp.resume()" : "TBApp.pause()")
        }
    }
}
