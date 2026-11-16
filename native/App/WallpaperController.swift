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
    private var pointerTimer: Timer?
    private var lastPointer = CGPoint(x: CGFloat.nan, y: CGFloat.nan)

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
        startPointerTracking()
    }

    /// The wallpaper ignores the mouse, so sample the cursor and hand it to the page for the
    /// tilt (parallax) effect. Only sends when it moves, and only while a wallpaper is visible.
    private func startPointerTracking() {
        pointerTimer?.invalidate()
        pointerTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.samplePointer() }
        }
    }

    private func samplePointer() {
        let p = NSEvent.mouseLocation
        if abs(p.x - lastPointer.x) < 0.5 && abs(p.y - lastPointer.y) < 0.5 { return }
        lastPointer = p
        guard !screensAsleep else { return }
        for (window, web) in zip(windows, webViews) where window.occlusionState.contains(.visible) {
            let f = window.frame
            let x = (p.x - f.midX) / (f.width / 2)
            let y = -(p.y - f.midY) / (f.height / 2)
            web.evaluateJavaScript(String(format: "TBApp.pointer(%.4f,%.4f)", x, y))
        }
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        pointerTimer?.invalidate()
        pointerTimer = nil
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
