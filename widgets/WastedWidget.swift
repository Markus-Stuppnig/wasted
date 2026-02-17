import WidgetKit
import SwiftUI
import AppIntents

private let appGroupID = "group.com.markusstuppnig.wasted"

// MARK: - Theme Colors

struct ThemeColors {
    let backgroundColors: [Color]
    let primaryText: Color
    let secondaryText: Color
    let pillFill: Color
    let pillBorder: Color
    let isTransparent: Bool
}

enum WastedTheme: String, CaseIterable {
    case blue, dark, light, transparent

    var colors: ThemeColors {
        switch self {
        case .blue:
            return ThemeColors(
                backgroundColors: [
                    Color(red: 0.808, green: 0.871, blue: 0.949),   // #cedef2
                    Color(red: 0.267, green: 0.431, blue: 0.651),   // #446ea6
                    Color(red: 0.043, green: 0.098, blue: 0.149),   // #0b1926
                ],
                primaryText: .white,
                secondaryText: Color.white.opacity(0.6),
                pillFill: Color(red: 0.05, green: 0.09, blue: 0.16).opacity(0.8),
                pillBorder: Color.white.opacity(0.22),
                isTransparent: false
            )
        case .dark:
            return ThemeColors(
                backgroundColors: [
                    Color(red: 0.11, green: 0.11, blue: 0.12),
                    .black,
                ],
                primaryText: .white,
                secondaryText: Color.white.opacity(0.55),
                pillFill: Color.white.opacity(0.08),
                pillBorder: Color.white.opacity(0.18),
                isTransparent: false
            )
        case .light:
            return ThemeColors(
                backgroundColors: [
                    Color(red: 0.96, green: 0.96, blue: 0.97),
                    Color(red: 0.92, green: 0.92, blue: 0.93),
                ],
                primaryText: Color(red: 0.77, green: 0.29, blue: 0.09),
                secondaryText: Color(red: 0.4, green: 0.4, blue: 0.42),
                pillFill: Color.black.opacity(0.06),
                pillBorder: Color.black.opacity(0.08),
                isTransparent: false
            )
        case .transparent:
            return ThemeColors(
                backgroundColors: [.clear],
                primaryText: Color(red: 0.77, green: 0.29, blue: 0.09),
                secondaryText: Color(red: 0.4, green: 0.4, blue: 0.42),
                pillFill: Color.white.opacity(0.15),
                pillBorder: Color.white.opacity(0.12),
                isTransparent: true
            )
        }
    }
}

// MARK: - Background Helper

@ViewBuilder
private func themeBackground(_ colors: ThemeColors) -> some View {
    if colors.isTransparent {
        Color.clear
    } else {
        LinearGradient(
            colors: colors.backgroundColors,
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Widget Data

struct WastedWidgetData {
    let todayMinutes: Int
    let isWasting: Bool
    let sessionStartMs: Double
    let sevenDayAverageMinutes: Int
    let lastUpdated: Double

    var liveTodayMinutes: Int {
        guard isWasting, sessionStartMs > 0 else { return todayMinutes }
        let nowMs = Date().timeIntervalSince1970 * 1000
        let elapsed = Int((nowMs - sessionStartMs) / 60_000)
        return todayMinutes + elapsed
    }

    static let empty = WastedWidgetData(todayMinutes: 0, isWasting: false, sessionStartMs: 0, sevenDayAverageMinutes: 0, lastUpdated: 0)

    static func load() -> WastedWidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return .empty }
        return WastedWidgetData(
            todayMinutes: defaults.integer(forKey: "todayMinutes"),
            isWasting: defaults.bool(forKey: "isWasting"),
            sessionStartMs: defaults.double(forKey: "sessionStartMs"),
            sevenDayAverageMinutes: defaults.integer(forKey: "sevenDayAverageMinutes"),
            lastUpdated: defaults.double(forKey: "lastUpdated")
        )
    }
}

// MARK: - Timeline Entry

struct WastedEntry: TimelineEntry {
    let date: Date
    let data: WastedWidgetData
    let theme: WastedTheme
}

// MARK: - Static Provider (iOS 16)

struct WastedProvider: TimelineProvider {
    func placeholder(in context: Context) -> WastedEntry {
        WastedEntry(date: Date(), data: .empty, theme: .blue)
    }

    func getSnapshot(in context: Context, completion: @escaping (WastedEntry) -> Void) {
        completion(WastedEntry(date: Date(), data: WastedWidgetData.load(), theme: .blue))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WastedEntry>) -> Void) {
        let data = WastedWidgetData.load()
        let entries = generateEntries(data: data, theme: .blue)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: entries, policy: .after(nextUpdate)))
    }
}

// MARK: - AppIntent Provider (iOS 17+)

@available(iOS 17.0, *)
struct AppIntentWastedProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WastedEntry {
        WastedEntry(date: Date(), data: .empty, theme: .blue)
    }

    func snapshot(for configuration: WastedWidgetConfigurationIntent, in context: Context) async -> WastedEntry {
        let theme = WastedTheme(rawValue: configuration.theme.rawValue) ?? .blue
        return WastedEntry(date: Date(), data: WastedWidgetData.load(), theme: theme)
    }

    func timeline(for configuration: WastedWidgetConfigurationIntent, in context: Context) async -> Timeline<WastedEntry> {
        let data = WastedWidgetData.load()
        let theme = WastedTheme(rawValue: configuration.theme.rawValue) ?? .blue
        let entries = generateEntries(data: data, theme: theme)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

// MARK: - Entry Generation

private func generateEntries(data: WastedWidgetData, theme: WastedTheme) -> [WastedEntry] {
    guard data.isWasting else {
        return [WastedEntry(date: Date(), data: data, theme: theme)]
    }
    var entries: [WastedEntry] = []
    let now = Date()
    for i in 0..<15 {
        guard let entryDate = Calendar.current.date(byAdding: .minute, value: i, to: now) else { continue }
        entries.append(WastedEntry(date: entryDate, data: data, theme: theme))
    }
    return entries
}

// MARK: - Format Time

private func formatMinutes(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    if h >= 1 {
        return "\(h)h \(String(format: "%02d", m))m"
    }
    return "\(m)m"
}

private func formatHours(_ minutes: Int) -> String {
    let h = minutes / 60
    return h >= 1 ? "\(h)h" : ""
}

private func formatMins(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    if h >= 1 {
        return "\(String(format: "%02d", m))m"
    }
    return "\(m)m"
}

// MARK: - Toggle Card View

struct ToggleCardView: View {
    let isWasting: Bool
    let theme: ThemeColors

    var body: some View {
        if #available(iOS 17.0, *) {
            toggleContent_iOS17
        } else {
            toggleContent_legacy
        }
    }

    @available(iOS 17.0, *)
    private var toggleContent_iOS17: some View {
        VStack(spacing: 0) {
            // Living (top) — pill when selected, tappable when not
            if isWasting {
                Button(intent: StopWastingIntent()) {
                    stateLabel("Living", selected: false)
                }
                .buttonStyle(.plain)
            } else {
                stateLabel("Living", selected: true)
            }

            Spacer(minLength: 4)

            // Arrow
            Image(systemName: isWasting ? "arrow.down" : "arrow.up")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(theme.primaryText.opacity(0.35))

            Spacer(minLength: 4)

            // Wasting (bottom) — pill when selected, tappable when not
            if !isWasting {
                Button(intent: StartWastingIntent()) {
                    stateLabel("Wasting", selected: false)
                }
                .buttonStyle(.plain)
            } else {
                stateLabel("Wasting", selected: true)
            }
        }
        .padding(10)
    }

    private var toggleContent_legacy: some View {
        VStack(spacing: 0) {
            if isWasting {
                Link(destination: URL(string: "wasted://stop")!) {
                    stateLabel("Living", selected: false)
                }
            } else {
                stateLabel("Living", selected: true)
            }

            Spacer(minLength: 4)

            Image(systemName: isWasting ? "arrow.down" : "arrow.up")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(theme.primaryText.opacity(0.35))

            Spacer(minLength: 4)

            if !isWasting {
                Link(destination: URL(string: "wasted://start")!) {
                    stateLabel("Wasting", selected: false)
                }
            } else {
                stateLabel("Wasting", selected: true)
            }
        }
        .padding(10)
    }

    /// Selected = pill background (current state). Unselected = plain text (tappable action).
    private func stateLabel(_ text: String, selected: Bool) -> some View {
        Text(text)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundColor(selected ? theme.primaryText : theme.primaryText.opacity(0.55))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(
                Group {
                    if selected {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(theme.pillFill)
                            .overlay(
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .strokeBorder(theme.pillBorder, lineWidth: 0.5)
                            )
                    }
                }
            )
    }
}

// MARK: - Small Widget View (toggle only, no stats)

struct SmallWidgetEntryView: View {
    let entry: WastedEntry

    var body: some View {
        ToggleCardView(isWasting: entry.data.isWasting, theme: entry.theme.colors)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Medium Widget View

struct MediumWidgetEntryView: View {
    let entry: WastedEntry

    var body: some View {
        let colors = entry.theme.colors
        let minutes = entry.data.liveTodayMinutes
        let avgMinutes = entry.data.sevenDayAverageMinutes
        let h = formatHours(minutes)
        let m = formatMins(minutes)

        HStack(spacing: 0) {
            // Left: Stats
            VStack(alignment: .leading, spacing: 0) {
                Text("Time Wasted")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(colors.secondaryText)

                if !h.isEmpty {
                    Text(h)
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(colors.primaryText)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
                Text(m)
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundColor(colors.primaryText)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)

                Spacer(minLength: 2)

                Text("7d average")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(colors.secondaryText)

                Text(avgMinutes > 0 ? formatMinutes(avgMinutes) : "---")
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                    .foregroundColor(colors.primaryText.opacity(0.85))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Right: Toggle card in bordered container
            ToggleCardView(isWasting: entry.data.isWasting, theme: colors)
                .frame(width: 130)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(colors.pillFill.opacity(0.2))
                        .overlay(
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .strokeBorder(colors.pillBorder, lineWidth: 1)
                        )
                        .shadow(color: .black.opacity(0.15), radius: 6, x: 0, y: 2)
                )
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Widget Configurations

struct WastedSmallWidget: Widget {
    let kind = "WastedSmallWidget"

    var body: some WidgetConfiguration {
        if #available(iOS 17.0, *) {
            return AppIntentConfiguration(kind: kind, intent: WastedWidgetConfigurationIntent.self, provider: AppIntentWastedProvider()) { entry in
                SmallWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        themeBackground(entry.theme.colors)
                    }
            }
            .configurationDisplayName("Wasted")
            .description("Track your wasted screen time.")
            .supportedFamilies([.systemSmall])
        } else {
            return StaticConfiguration(kind: kind, provider: WastedProvider()) { entry in
                SmallWidgetEntryView(entry: entry)
                    .background(themeBackground(entry.theme.colors))
            }
            .configurationDisplayName("Wasted")
            .description("Track your wasted screen time.")
            .supportedFamilies([.systemSmall])
        }
    }
}

struct WastedMediumWidget: Widget {
    let kind = "WastedMediumWidget"

    var body: some WidgetConfiguration {
        if #available(iOS 17.0, *) {
            return AppIntentConfiguration(kind: kind, intent: WastedWidgetConfigurationIntent.self, provider: AppIntentWastedProvider()) { entry in
                MediumWidgetEntryView(entry: entry)
                    .padding(14)
                    .containerBackground(for: .widget) {
                        themeBackground(entry.theme.colors)
                    }
            }
            .configurationDisplayName("Wasted")
            .description("Track your wasted screen time with stats.")
            .supportedFamilies([.systemMedium])
        } else {
            return StaticConfiguration(kind: kind, provider: WastedProvider()) { entry in
                MediumWidgetEntryView(entry: entry)
                    .padding(14)
                    .background(themeBackground(entry.theme.colors))
            }
            .configurationDisplayName("Wasted")
            .description("Track your wasted screen time with stats.")
            .supportedFamilies([.systemMedium])
        }
    }
}
