# Wasted

A privacy-first screen time awareness app for iOS and Android. Users manually track time spent mindlessly scrolling — no restrictions, no judgement, just honest data.

## Tech Stack

- **React Native 0.81** + **Expo SDK 54** (New Architecture enabled)
- **TypeScript** (strict mode)
- **Expo Router v6** — file-based navigation
- **Local JSON file storage** via `expo-file-system` — no backend, no cloud sync, no accounts

## Project Structure

```
app/
├── _layout.tsx              # Root layout — wraps everything in GestureHandlerRootView, sets StatusBar light
├── storage.ts               # Session data persistence (wasted-data.json)
├── settings-storage.ts      # Settings persistence (wasted-settings.json)
└── (tabs)/
    ├── _layout.tsx          # Tab navigation — uses NativeTabs on iOS, Tabs with Ionicons on Android
    ├── index.tsx            # Home screen — timer with swipe-to-track pill
    ├── calendar.tsx         # Calendar screen — monthly grid with circular progress rings
    └── menu.tsx             # Settings screen — bed time slider, analytics toggle, info modal
```

## Screens

### Home (`app/(tabs)/index.tsx`)
The main timer interface. Displays total wasted minutes for today and the 7-day rolling average. The core interaction is a **swipe pill** inside a frosted-glass card:
- **Swipe up** to start tracking ("Living" → "Wasting")
- **Swipe down** to stop tracking ("Wasting" → "Living")
- **+5m / -5m buttons** for manual adjustment
- Breathing scale animation on the time display while actively wasting
- Animated glow border on the card while wasting
- Refreshes from disk on app foreground and every 15 seconds while active

### Calendar (`app/(tabs)/calendar.tsx`)
Monthly calendar view with **circular progress rings** for each day. 8 hours of wasted time fills a full ring (color: `#e8602c`). Features:
- Month-by-month navigation (bounded by first log date and current month)
- Tap a day to see its wasted time in the header
- Monday-start week layout
- Out-of-month days shown as faint dots, future days as empty rings, zero-minute past days as white filled circles

### Settings (`app/(tabs)/menu.tsx`)
Settings and info screen. Cards for:
- **"What's Wasted?"** — opens an info modal explaining the app
- **Bed Time** — slider from 7 PM to 3 AM (15-min increments) for auto-stop
- **Analytics** — toggle for anonymous usage data
- **Widgets** — placeholder card for home screen widgets

## Data Layer

### Session Storage (`app/storage.ts`)
Stores data in `Paths.document/wasted-data.json`. Schema:

```typescript
interface StorageData {
  days: DayEntry[];
}
interface DayEntry {
  date: string;           // "YYYY-MM-DD"
  sessions: WasteSession[];
  adjustments?: Adjustment[];
}
interface WasteSession {
  start: number;          // ms since epoch
  end: number | null;     // null = still running
}
interface Adjustment {
  timestamp: number;      // ms since epoch
  delta: number;          // minutes (positive or negative)
}
```

Key behaviors:
- **Midnight splitting**: If an open session spans past midnight, it closes at midnight and opens a new one on the new day
- **Safety close**: Starting a new session closes any lingering open sessions across all days
- **Clamped to 0–1440 minutes** per day
- Public API: `loadToday()`, `startWasting()`, `stopWasting()`, `adjustMinutes()`, `getDayMinutes()`, `get7dAverage()`, `getAllDays()`, `getFirstLogDate()`

### Settings Storage (`app/settings-storage.ts`)
Stores data in `Paths.document/wasted-settings.json`. Schema:

```typescript
interface Settings {
  bedTimeMinutes: number;    // minutes from midnight (default: 1380 = 11 PM)
  analyticsEnabled: boolean; // default: true
}
```

Provides `loadSettings()`, `saveSettings()`, `formatBedTime()`.

## UI Design

- **Dark theme** throughout with a blue gradient background: `#c0cfe0` → `#7a92b5` → `#3a5278` → `#152238` → `#0a1628`
- Frosted glass / blur effects via `expo-blur` (`BlurView`)
- Tab bar uses native SF Symbols on iOS, Ionicons on Android
- Portrait-only orientation
- App background color: `#0a1628`

## Running

```bash
npm ci                     # Install dependencies
npm start                  # Start Expo dev server
npm run ios                # Run on iOS simulator
npm run android            # Run on Android emulator
```

### Docker (tunnel mode for physical devices)

```bash
docker-compose up -d --build   # Expo dev server with ngrok tunnel on port 8081
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-router` | File-based navigation |
| `expo-file-system` | Local JSON persistence |
| `expo-blur` | Frosted glass card effects |
| `expo-linear-gradient` | Background gradients |
| `react-native-gesture-handler` | Pan gesture for swipe pill |
| `react-native-svg` | Calendar progress rings |
| `@react-native-community/slider` | Bed time slider |
| `@expo/vector-icons` (Ionicons) | Icons throughout |
| `react-native-safe-area-context` | Safe area insets |

## Conventions

- All storage reads/writes are synchronous via `expo-file-system`'s `File` API (`textSync()`, `write()`)
- Time values stored as milliseconds since epoch; displayed as minutes
- Date keys use `"YYYY-MM-DD"` format everywhere
- No state management library — local `useState` + direct storage reads
- Components refresh on `AppState` change to "active" to stay in sync with disk
- No tests, no linting config, no CI — early-stage project