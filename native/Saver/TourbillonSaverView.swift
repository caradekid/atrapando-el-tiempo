import ScreenSaver
import WebKit

/// Screen saver: shows the same live dial as the wallpaper.
/// The app writes the current design to Contents/Resources/config.json inside the installed bundle.
@objc(TourbillonSaverView)
final class TourbillonSaverView: ScreenSaverView {
    private var webView: WKWebView?
    private var stopObserver: NSObjectProtocol?

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        animationTimeInterval = 1.0
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    deinit {
        if let stopObserver { DistributedNotificationCenter.default().removeObserver(stopObserver) }
    }

    private var resources: URL? { Bundle(for: TourbillonSaverView.self).resourceURL }

    private func configJSON() -> String {
        guard let url = resources?.appendingPathComponent("config.json"),
              let data = try? Data(contentsOf: url),
              (try? JSONSerialization.jsonObject(with: data)) != nil,
              let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }

    private func setUp() {
        guard webView == nil, let web = resources?.appendingPathComponent("web", isDirectory: true) else { return }
        let content = WKUserContentController()
        let boot = "window.TB_BOOT = { mode: 'saver', native: true, config: \(configJSON()), forceDark: null };"
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content

        let view = WKWebView(frame: bounds, configuration: configuration)
        view.autoresizingMask = [.width, .height]
        view.setValue(false, forKey: "drawsBackground")
        view.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
        addSubview(view)
        webView = view

        // macOS keeps legacy savers alive after they are dismissed; stop animating when that happens.
        stopObserver = DistributedNotificationCenter.default().addObserver(
            forName: Notification.Name("com.apple.screensaver.willstop"), object: nil, queue: .main
        ) { [weak self] _ in
            self?.webView?.evaluateJavaScript("TBApp.pause()")
        }
    }

    override func startAnimation() {
        super.startAnimation()
        webView?.evaluateJavaScript("TBApp.resume()")
    }

    override func stopAnimation() {
        super.stopAnimation()
        webView?.evaluateJavaScript("TBApp.pause()")
    }

    override func animateOneFrame() {}

    override var hasConfigureSheet: Bool { false }
    override var configureSheet: NSWindow? { nil }
}
