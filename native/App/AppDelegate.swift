import AppKit
import ServiceManagement

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem!
    private let wallpaper = WallpaperController()
    private let exporter = LoginExporter()
    private lazy var settings: SettingsWindowController = {
        let controller = SettingsWindowController()
        controller.onConfig = { [weak self] json in
            ConfigStore.shared.save(json)
            self?.wallpaper.broadcast(config: json)
        }
        controller.onAction = { [weak self] name in await self?.perform(name) ?? "" }
        return controller
    }()

    private let defaults = UserDefaults.standard
    private var liveEnabled: Bool {
        get { defaults.object(forKey: "liveWallpaper") as? Bool ?? true }
        set { defaults.set(newValue, forKey: "liveWallpaper") }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        let symbol = NSImage(systemSymbolName: "watch.analog", accessibilityDescription: "Tourbillon")
            ?? NSImage(systemSymbolName: "clock", accessibilityDescription: "Tourbillon")
        statusItem.button?.image = symbol
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu

        if liveEnabled { wallpaper.start() }
        if !defaults.bool(forKey: "launchedBefore") {
            defaults.set(true, forKey: "launchedBefore")
            settings.show()
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        settings.show()
        return true
    }

    // MARK: menu

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        let live = item("Live Wallpaper", #selector(toggleLive))
        live.state = wallpaper.isRunning ? .on : .off
        menu.addItem(live)
        menu.addItem(item("Settings…", #selector(openSettings), key: ","))
        menu.addItem(.separator())
        menu.addItem(item("Apply to Login & Lock Screen", #selector(applyLogin)))
        menu.addItem(item(ScreenSaverInstaller.isInstalled ? "Update Screen Saver" : "Install Screen Saver…", #selector(installSaver)))
        menu.addItem(.separator())
        let login = item("Open at Login", #selector(toggleLaunchAtLogin))
        login.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(login)
        menu.addItem(.separator())
        menu.addItem(item("Quit Tourbillon", #selector(quit), key: "q"))
    }

    private func item(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func toggleLive() {
        liveEnabled.toggle()
        liveEnabled ? wallpaper.start() : wallpaper.stop()
    }

    @objc private func openSettings() { settings.show() }

    @objc private func applyLogin() {
        Task { notify(await perform("applyLogin")) }
    }

    @objc private func installSaver() {
        Task { notify(await perform("installSaver")) }
    }

    @objc private func toggleLaunchAtLogin() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            notify("Could not change Open at Login: \(error.localizedDescription)")
        }
    }

    @objc private func quit() { NSApp.terminate(nil) }

    // MARK: actions shared by the menu and the settings panel

    func perform(_ name: String) async -> String {
        switch name {
        case "applyLogin":
            do {
                try await exporter.applyToAllScreens()
                return "Login and lock screen updated (light and dark)."
            } catch {
                return "Could not update the login screen: \(error.localizedDescription)"
            }
        case "installSaver":
            do {
                try ScreenSaverInstaller.install()
                ScreenSaverInstaller.openSettings()
                return "Screen saver installed. Choose “Tourbillon” in System Settings."
            } catch {
                return "Could not install the screen saver: \(error.localizedDescription)"
            }
        case "toggleWallpaper":
            toggleLive()
            return wallpaper.isRunning ? "Live wallpaper on." : "Live wallpaper paused."
        default:
            return ""
        }
    }

    private func notify(_ text: String) {
        guard !text.isEmpty else { return }
        let alert = NSAlert()
        alert.messageText = "Tourbillon"
        alert.informativeText = text
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }
}
