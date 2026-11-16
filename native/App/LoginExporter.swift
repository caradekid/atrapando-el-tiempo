import AppKit
import ImageIO
import UniformTypeIdentifiers
import WebKit

/// Renders a light and a dark still of the current design and writes them as one
/// appearance-aware HEIC (the same format Apple uses for its light/dark wallpapers).
/// Setting it as the desktop picture also puts it on the login window and lock screen.
@MainActor
final class LoginExporter: NSObject, WKNavigationDelegate {
    enum ExportError: LocalizedError {
        case render, encode
        var errorDescription: String? {
            switch self {
            case .render: return "The dial could not be rendered."
            case .encode: return "The wallpaper image could not be written."
            }
        }
    }

    private var host: NSWindow?
    private var webView: WKWebView?
    private var loaded: CheckedContinuation<Void, Never>?

    var outputDirectory: URL {
        let dir = ConfigStore.shared.supportDirectory.appendingPathComponent("Wallpapers", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Renders for every connected display and applies the result. Returns the files written.
    @discardableResult
    func applyToAllScreens() async throws -> [URL] {
        let renderer = try await prepare()
        defer { tearDown() }
        let stamp = Int(Date().timeIntervalSince1970)
        var cache: [String: URL] = [:]
        var written: [URL] = []
        let old = (try? FileManager.default.contentsOfDirectory(at: outputDirectory, includingPropertiesForKeys: nil)) ?? []

        for screen in NSScreen.screens {
            let scale = screen.backingScaleFactor
            let width = Int(screen.frame.width * scale), height = Int(screen.frame.height * scale)
            let key = "\(width)x\(height)"
            let url: URL
            if let cached = cache[key] {
                url = cached
            } else {
                let light = try await snapshot(renderer, width: width, height: height, dark: false)
                let dark = try await snapshot(renderer, width: width, height: height, dark: true)
                url = outputDirectory.appendingPathComponent("tourbillon-\(key)-\(stamp).heic")
                try Self.writeAppearanceHEIC(light: light, dark: dark, to: url)
                cache[key] = url
                written.append(url)
            }
            try NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: [
                .imageScaling: NSImageScaling.scaleProportionallyUpOrDown.rawValue,
                .allowClipping: true,
            ])
        }
        // keep the folder tidy: drop files from earlier exports
        for file in old where !written.contains(file) { try? FileManager.default.removeItem(at: file) }
        return written
    }

    private func prepare() async throws -> WKWebView {
        let web = Web.makeView(mode: "wallpaper", config: ConfigStore.shared.json, navigationDelegate: self)
        // An invisible host window keeps WebKit fully active while rendering.
        let window = NSWindow(contentRect: NSRect(x: -10_000, y: -10_000, width: 320, height: 200),
                              styleMask: .borderless, backing: .buffered, defer: false)
        window.alphaValue = 0
        window.ignoresMouseEvents = true
        window.isReleasedWhenClosed = false
        web.frame = NSRect(x: 0, y: 0, width: 320, height: 200)
        window.contentView = web
        window.orderBack(nil)
        host = window
        webView = web
        await withCheckedContinuation { loaded = $0 }
        return web
    }

    private func tearDown() {
        host?.orderOut(nil)
        host = nil
        webView = nil
    }

    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        MainActor.assumeIsolated {
            loaded?.resume()
            loaded = nil
        }
    }

    private func snapshot(_ web: WKWebView, width: Int, height: Int, dark: Bool) async throws -> CGImage {
        let result = try await web.callAsyncJavaScript(
            "return TBApp.snapshot(w, h, dark, cfg)",
            arguments: ["w": width, "h": height, "dark": dark, "cfg": ConfigStore.shared.object],
            contentWorld: .page)
        guard let base64 = result as? String,
              let data = Data(base64Encoded: base64),
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw ExportError.render }
        return image
    }

    /// Two images in one HEIC plus the `apple_desktop:apr` XMP tag that tells macOS
    /// which one is for Light (index 0) and which for Dark (index 1).
    static func writeAppearanceHEIC(light: CGImage, dark: CGImage, to url: URL) throws {
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.heic.identifier as CFString, 2, nil) else {
            throw ExportError.encode
        }
        let plist = try PropertyListSerialization.data(fromPropertyList: ["l": 0, "d": 1], format: .binary, options: 0)
        let metadata = CGImageMetadataCreateMutable()
        let ns = "http://ns.apple.com/namespace/1.0/" as CFString
        let prefix = "apple_desktop" as CFString
        guard CGImageMetadataRegisterNamespaceForPrefix(metadata, ns, prefix, nil),
              let tag = CGImageMetadataTagCreate(ns, prefix, "apr" as CFString, .string, plist.base64EncodedString() as CFString),
              CGImageMetadataSetTagWithPath(metadata, nil, "apple_desktop:apr" as CFString, tag) else {
            throw ExportError.encode
        }
        let options = [kCGImageDestinationLossyCompressionQuality: 0.92] as CFDictionary
        CGImageDestinationAddImageAndMetadata(dest, light, metadata, options)
        CGImageDestinationAddImage(dest, dark, options)
        guard CGImageDestinationFinalize(dest) else { throw ExportError.encode }
    }
}
