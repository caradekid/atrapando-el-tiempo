import Foundation

/// Persists the watch configuration as JSON. The web engine owns the schema;
/// Swift only stores and forwards it.
final class ConfigStore {
    static let shared = ConfigStore()

    let supportDirectory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Atrapando el Tiempo", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // carry the design over from the project's earlier name
        let legacy = base.appendingPathComponent("Tourbillon/config.json")
        let current = dir.appendingPathComponent("config.json")
        if !FileManager.default.fileExists(atPath: current.path),
           let data = try? Data(contentsOf: legacy),
           var object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            object["wordmark"] = "ATRAPANDO EL TIEMPO"
            object["subline"] = "x Caradekid"
            object["emblem"] = "medallion"
            if let out = try? JSONSerialization.data(withJSONObject: object) { try? out.write(to: current) }
        }
        return dir
    }()

    private var fileURL: URL { supportDirectory.appendingPathComponent("config.json") }

    private(set) var json: String

    private init() {
        if let data = try? Data(contentsOf: supportDirectory.appendingPathComponent("config.json")),
           let text = String(data: data, encoding: .utf8),
           (try? JSONSerialization.jsonObject(with: data)) != nil {
            json = text
        } else {
            json = "{}"
        }
    }

    var object: [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] ?? [:]
    }

    func save(_ newJSON: String) {
        json = newJSON
        try? Data(newJSON.utf8).write(to: fileURL, options: .atomic)
        ScreenSaverInstaller.syncConfig(newJSON)
    }
}
