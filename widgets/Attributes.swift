import ActivityKit
import WidgetKit
import SwiftUI

struct WastedLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var minutesWasted: Int
    }

    var startDate: Date
}
