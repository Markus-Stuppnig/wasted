# Wasted

A screen time awareness app that helps you see how much time you spend mindlessly scrolling. No restrictions, no judgement — just honest data.

## Features

- **Swipe-to-track timer** — Swipe up to start tracking, swipe down to stop. Manual +5m/-5m adjustments available.
- **Calendar view** — Monthly overview with circular progress rings showing daily wasted time at a glance.
- **7-day average** — See your rolling average right on the home screen.
- **Bed time auto-stop** — Set a bed time so the timer doesn't run overnight.
- **Privacy-first** — All data stays on your device. No cloud sync, no accounts, no tracking.

## Tech Stack

- React Native + Expo
- TypeScript
- Expo Router (file-based navigation)
- Local JSON file storage

## Getting Started

### Prerequisites

- Node.js
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
npm ci
```

### Running

```bash
npm start         # Start Expo dev server
npm run ios       # Run on iOS
npm run android   # Run on Android
```

### Docker

A Docker setup is included for running the Expo dev server with tunnel access:

```bash
docker-compose up -d --build
```

## Project Structure

```
app/
├── _layout.tsx              # Root layout
├── storage.ts               # Session data persistence
├── settings-storage.ts      # Settings persistence
└── (tabs)/
    ├── _layout.tsx          # Tab navigation
    ├── index.tsx            # Home — timer interface
    ├── calendar.tsx         # Calendar — historical view
    └── menu.tsx             # Settings
```
