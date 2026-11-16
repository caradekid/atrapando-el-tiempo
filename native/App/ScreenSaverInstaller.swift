import AppKit

/// Copies the bundled Tourbillon.saver into ~/Library/Screen Savers and keeps its
/// config.json in step with the app, so the screen saver shows the same design.
enum ScreenSaverInstaller {
    static var installedURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Screen Savers/Tourbillon.saver", isDirectory: true)
    }

    static var bundledURL: URL? {
        Bundle.main.resourceURL?.appendingPathComponent("Tourbillon.saver", isDirectory: true)
    }

    static var isInstalled: Bool { FileManager.default.fileExists(atPath: installedURL.path) }

    static func install() throws {
        guard let source = bundledURL, FileManager.default.fileExists(atPath: source.path) else {
            throw CocoaError(.fileNoSuchFile)
        }
        let fm = FileManager.default
        try fm.createDirectory(at: installedURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if fm.fileExists(atPath: installedURL.path) { try fm.removeItem(at: installedURL) }
        try fm.copyItem(at: source, to: installedURL)
        syncConfig(ConfigStore.shared.json)
    }

    static func syncConfig(_ json: String) {
        guard isInstalled else { return }
        let file = installedURL.appendingPathComponent("Contents/Resources/config.json")
        try? Data(json.utf8).write(to: file, options: .atomic)
    }

    static func openSettings() {
        let urls = [
            "x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension",
            "x-apple.systempreferences:com.apple.preference.desktopscreeneffect",
        ]
        for string in urls {
            if let url = URL(string: string), NSWorkspace.shared.open(url) { return }
        }
    }
}
