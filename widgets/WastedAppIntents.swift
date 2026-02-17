import AppIntents
import WidgetKit

private let appGroupID = "group.com.markusstuppnig.wasted"

// MARK: - Theme

@available(iOS 16.0, *)
enum WastedThemeOption: String, AppEnum {
    case blue = "blue"
    case dark = "dark"
    case light = "light"
    case transparent = "transparent"

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Theme"

    static var caseDisplayRepresentations: [WastedThemeOption: DisplayRepresentation] = [
        .blue: "Blue Gradient",
        .dark: "Dark",
        .light: "Light",
        .transparent: "Transparent",
    ]
}

// MARK: - Configuration Intent (iOS 17+)

@available(iOS 17.0, *)
struct WastedWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Wasted Widget"
    static var description: IntentDescription = "Configure your Wasted widget theme."

    @Parameter(title: "Theme", default: .blue)
    var theme: WastedThemeOption
}

// MARK: - Start Wasting Intent

@available(iOS 17.0, *)
struct StartWastingIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Wasting"
    static var description: IntentDescription = "Start tracking wasted time."

    func perform() async throws -> some IntentResult {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return .result()
        }

        let now = Date().timeIntervalSince1970 * 1000
        defaults.set(true, forKey: "isWasting")
        defaults.set(now, forKey: "sessionStartMs")
        defaults.set("start", forKey: "pendingWidgetAction")
        defaults.set(now, forKey: "pendingActionSessionStartMs")
        defaults.synchronize()

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Stop Wasting Intent

@available(iOS 17.0, *)
struct StopWastingIntent: AppIntent {
    static var title: LocalizedStringResource = "Stop Wasting"
    static var description: IntentDescription = "Stop tracking wasted time."

    func perform() async throws -> some IntentResult {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return .result()
        }

        let sessionStartMs = defaults.double(forKey: "sessionStartMs")
        let nowMs = Date().timeIntervalSince1970 * 1000

        if sessionStartMs > 0 {
            let elapsedMinutes = Int((nowMs - sessionStartMs) / 60_000)
            let currentMinutes = defaults.integer(forKey: "todayMinutes")
            defaults.set(currentMinutes + elapsedMinutes, forKey: "todayMinutes")
        }

        defaults.set(false, forKey: "isWasting")
        defaults.set(Double(0), forKey: "sessionStartMs")
        defaults.set("stop", forKey: "pendingWidgetAction")
        defaults.set(sessionStartMs, forKey: "pendingActionSessionStartMs")
        defaults.set(nowMs, forKey: "pendingActionSessionStopMs")
        defaults.synchronize()

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
