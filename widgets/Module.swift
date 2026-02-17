import ExpoModulesCore
import ActivityKit
import WidgetKit

private let appGroupID = "group.com.markusstuppnig.wasted"

public class ReactNativeWidgetExtensionModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ReactNativeWidgetExtension")

        // ── Live Activity functions ──

        Function("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            } else {
                return false
            }
        }

        Function("startActivity") { (minutesWasted: Int) -> Void in
            if #available(iOS 16.2, *) {
                let attributes = WastedLiveActivityAttributes(startDate: Date.now)
                let contentState = WastedLiveActivityAttributes.ContentState(minutesWasted: minutesWasted)
                let activityContent = ActivityContent(
                    state: contentState,
                    staleDate: Calendar.current.date(byAdding: .minute, value: 60, to: Date())!
                )
                do {
                    let _ = try Activity.request(attributes: attributes, content: activityContent)
                } catch {
                    // handle error
                }
            }
        }

        Function("updateActivity") { (minutesWasted: Int) -> Void in
            if #available(iOS 16.2, *) {
                let contentState = WastedLiveActivityAttributes.ContentState(minutesWasted: minutesWasted)
                let updatedContent = ActivityContent(state: contentState, staleDate: nil)
                Task {
                    for activity in Activity<WastedLiveActivityAttributes>.activities {
                        await activity.update(updatedContent)
                    }
                }
            }
        }

        Function("endActivity") { (minutesWasted: Int) -> Void in
            if #available(iOS 16.2, *) {
                let contentState = WastedLiveActivityAttributes.ContentState(minutesWasted: minutesWasted)
                let finalContent = ActivityContent(state: contentState, staleDate: nil)
                Task {
                    for activity in Activity<WastedLiveActivityAttributes>.activities {
                        await activity.end(finalContent, dismissalPolicy: .default)
                    }
                }
            }
        }

        // ── Widget data bridge functions ──

        Function("setWidgetData") { (todayMinutes: Int, isWasting: Bool, sessionStartMs: Double, sevenDayAverageMinutes: Int) -> Void in
            guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
            defaults.set(todayMinutes, forKey: "todayMinutes")
            defaults.set(isWasting, forKey: "isWasting")
            defaults.set(sessionStartMs, forKey: "sessionStartMs")
            defaults.set(sevenDayAverageMinutes, forKey: "sevenDayAverageMinutes")
            defaults.set(Date().timeIntervalSince1970, forKey: "lastUpdated")
        }

        Function("reloadWidgets") { () -> Void in
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }

        Function("getPendingWidgetAction") { () -> String? in
            guard let defaults = UserDefaults(suiteName: appGroupID) else { return nil }
            defaults.synchronize()
            return defaults.string(forKey: "pendingWidgetAction")
        }

        Function("getPendingActionSessionStartMs") { () -> Double in
            guard let defaults = UserDefaults(suiteName: appGroupID) else { return 0 }
            defaults.synchronize()
            return defaults.double(forKey: "pendingActionSessionStartMs")
        }

        Function("getPendingActionSessionStopMs") { () -> Double in
            guard let defaults = UserDefaults(suiteName: appGroupID) else { return 0 }
            defaults.synchronize()
            return defaults.double(forKey: "pendingActionSessionStopMs")
        }

        Function("clearPendingWidgetAction") { () -> Void in
            guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
            defaults.removeObject(forKey: "pendingWidgetAction")
            defaults.removeObject(forKey: "pendingActionSessionStartMs")
            defaults.removeObject(forKey: "pendingActionSessionStopMs")
        }
    }
}
