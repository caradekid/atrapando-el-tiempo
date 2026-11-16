import AppKit
import WebKit

/// The editor: the same HTML panel as the browser version, wired to native actions.
@MainActor
final class SettingsWindowController: NSWindowController, WKScriptMessageHandler, NSWindowDelegate {
    var onConfig: ((String) -> Void)?
    var onAction: ((String) async -> String) = { _ in "" }
    private var webView: WKWebView!

    convenience init() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 760),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                              backing: .buffered, defer: false)
        window.title = "Atrapando el tiempo × CARADEKID"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.minSize = NSSize(width: 860, height: 560)
        window.isReleasedWhenClosed = false
        window.center()
        window.setFrameAutosaveName("AtrapandoElTiempoSettings")
        self.init(window: window)
        window.delegate = self

        webView = Web.makeView(mode: "settings", config: ConfigStore.shared.json, handler: self)
        webView.autoresizingMask = [.width, .height]
        window.contentView = webView
    }

    func show() {
        NSApp.setActivationPolicy(.regular)
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func windowWillClose(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "config":
            if let cfg = body["config"], let json = Web.jsonString(cfg) { onConfig?(json) }
        case "open":
            if let link = body["url"] as? String, let url = URL(string: link), url.scheme == "https" {
                NSWorkspace.shared.open(url)
            }
        case "action":
            guard let name = body["name"] as? String else { return }
            if let cfg = body["config"], let json = Web.jsonString(cfg) { onConfig?(json) }
            Task { @MainActor in
                let message = await onAction(name)
                let escaped = Web.jsonString([message]) ?? "[\"\"]"
                try? await webView.evaluateJavaScript("TBApp.actionDone('\(name)', \(escaped)[0])")
            }
        default:
            break
        }
    }
}
