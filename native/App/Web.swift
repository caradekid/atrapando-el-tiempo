import AppKit
import WebKit

/// Builds web views that load the bundled, offline watch engine.
enum Web {
    static var directory: URL {
        Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
    }

    static func makeView(mode: String,
                         config: String,
                         forceDark: Bool? = nil,
                         handler: WKScriptMessageHandler? = nil,
                         navigationDelegate: WKNavigationDelegate? = nil) -> WKWebView {
        let content = WKUserContentController()
        let dark = forceDark.map { $0 ? "true" : "false" } ?? "null"
        let boot = "window.TB_BOOT = { mode: '\(mode)', native: true, config: \(config), forceDark: \(dark) };"
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if let handler { content.add(WeakHandler(handler), name: "tourbillon") }

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        configuration.suppressesIncrementalRendering = true

        let view = WKWebView(frame: .zero, configuration: configuration)
        view.setValue(false, forKey: "drawsBackground")
        view.navigationDelegate = navigationDelegate
        view.loadFileURL(directory.appendingPathComponent("index.html"), allowingReadAccessTo: directory)
        return view
    }

    static func jsonString(_ object: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

/// WKUserContentController retains its handlers; this breaks the cycle.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
