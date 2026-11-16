// Renders dials through WebKit exactly like the app does, without touching the desktop.
//
//   swift scripts/render.swift <out.png> <width> <height> <light|dark> [model] [extra-json]
//   swift scripts/render.swift --heic <out.heic> <width> <height> [model]
//   swift scripts/render.swift --page <out.png> <page.html> <js expression returning base64 PNG>
//
// Used to produce README images and the screen saver thumbnail, and as a smoke test
// for the snapshot and light/dark HEIC pipeline.
import AppKit
import ImageIO
import UniformTypeIdentifiers
import WebKit

let args = CommandLine.arguments
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let web = root.appendingPathComponent("web", isDirectory: true)

final class Loader: NSObject, WKNavigationDelegate {
    var done: (() -> Void)?
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { done?() }
}

func writeAppearanceHEIC(light: CGImage, dark: CGImage, to url: URL) -> Bool {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.heic.identifier as CFString, 2, nil),
          let plist = try? PropertyListSerialization.data(fromPropertyList: ["l": 0, "d": 1], format: .binary, options: 0)
    else { return false }
    let metadata = CGImageMetadataCreateMutable()
    let ns = "http://ns.apple.com/namespace/1.0/" as CFString
    let prefix = "apple_desktop" as CFString
    guard CGImageMetadataRegisterNamespaceForPrefix(metadata, ns, prefix, nil),
          let tag = CGImageMetadataTagCreate(ns, prefix, "apr" as CFString, .string, plist.base64EncodedString() as CFString),
          CGImageMetadataSetTagWithPath(metadata, nil, "apple_desktop:apr" as CFString, tag) else { return false }
    let options = [kCGImageDestinationLossyCompressionQuality: 0.92] as CFDictionary
    CGImageDestinationAddImageAndMetadata(dest, light, metadata, options)
    CGImageDestinationAddImage(dest, dark, options)
    return CGImageDestinationFinalize(dest)
}

@MainActor
func renderPage(_ out: URL, page: String, expression: String) async -> Int32 {
    let window = NSWindow(contentRect: NSRect(x: -10_000, y: -10_000, width: 320, height: 200),
                          styleMask: .borderless, backing: .buffered, defer: false)
    window.alphaValue = 0
    let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 320, height: 200))
    window.contentView = view
    window.orderBack(nil)
    let loader = Loader()
    view.navigationDelegate = loader
    await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
        loader.done = { c.resume() }
        view.loadFileURL(root.appendingPathComponent(page), allowingReadAccessTo: root)
    }
    do {
        let any = try await view.callAsyncJavaScript("return await (\(expression))", arguments: [:], contentWorld: .page)
        guard let b64 = any as? String, let data = Data(base64Encoded: b64) else { print("no image returned"); return 1 }
        try data.write(to: out)
        print("wrote \(out.path)")
        return 0
    } catch {
        print("page error: \(error)")
        return 1
    }
}

@MainActor
func run() async -> Int32 {
    if args.count > 4 && args[1] == "--page" {
        return await renderPage(URL(fileURLWithPath: args[2]), page: args[3], expression: args[4])
    }
    let heic = args.count > 1 && args[1] == "--heic"
    let a = heic ? Array(args.dropFirst(1)) : args
    guard a.count >= 4 else {
        print("usage: render.swift <out.png> <w> <h> <light|dark> [model] [extra-json] | --heic <out.heic> <w> <h> [model]")
        return 2
    }
    let out = URL(fileURLWithPath: a[1])
    let w = Int(a[2]) ?? 1920, h = Int(a[3]) ?? 1080
    let modelIndex = heic ? 4 : 5
    let model = a.count > modelIndex ? a[modelIndex] : "snowfield"
    let extra = (!heic && a.count > 6) ? a[6] : "{}"

    let window = NSWindow(contentRect: NSRect(x: -10_000, y: -10_000, width: 320, height: 200),
                          styleMask: .borderless, backing: .buffered, defer: false)
    window.alphaValue = 0
    let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 320, height: 200))
    window.contentView = view
    window.orderBack(nil)
    let loader = Loader()
    view.navigationDelegate = loader
    await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
        loader.done = { c.resume() }
        view.loadFileURL(web.appendingPathComponent("index.html"), allowingReadAccessTo: web)
    }

    func shot(_ dark: Bool) async -> CGImage? {
        let js = """
        const E = TourbillonEngine;
        const cfg = Object.assign({}, E.DEFAULTS, E.MODELS[model].defaults, { model }, JSON.parse(extra));
        return TBApp.snapshot(w, h, dark, cfg);
        """
        guard let any = try? await view.callAsyncJavaScript(js, arguments: ["w": w, "h": h, "dark": dark, "model": model, "extra": extra], contentWorld: .page),
              let b64 = any as? String, let data = Data(base64Encoded: b64),
              let src = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(src, 0, nil)
    }

    if heic {
        guard let light = await shot(false), let dark = await shot(true) else { print("render failed"); return 1 }
        guard writeAppearanceHEIC(light: light, dark: dark, to: out) else { print("heic failed"); return 1 }
    } else {
        guard let img = await shot(a[4] == "dark"),
              let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            print("render failed"); return 1
        }
        CGImageDestinationAddImage(dest, img, nil)
        CGImageDestinationFinalize(dest)
    }
    print("wrote \(out.path)")
    return 0
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
Task { @MainActor in exit(await run()) }
app.run()
