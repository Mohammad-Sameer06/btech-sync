<div align="center">

# 📚 BtechSync

**The smart attendance tracker built for B.Tech students**

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## ✨ Features

- 👤 **Multi-Profile System** — Multiple students can use the same device, each with a secure 4-digit PIN and completely isolated data
- 📊 **Attendance Tracker** — Log Present / Absent / Cancelled for each subject with live percentage calculations
- 📅 **Weekly Timetable** — Build your full week schedule with room numbers, times, and subject types
- 🏠 **Today's View** — See only today's classes at a glance, powered by your timetable
- 🔔 **Smart Alerts** — Local notifications remind you 30 minutes before class starts
- 📈 **Dashboard Stats** — Separate Theory and Lab attendance percentages always visible
- 🔧 **Manual Sync** — Fine-tune your attendance counts with a stepper control
- 🗑️ **Profile Management** — Delete profiles or wipe your own data independently

---

## 📱 Screenshots

> Coming soon

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **React Native + Expo** | Cross-platform mobile framework |
| **TypeScript** | Type-safe development |
| **AsyncStorage** | Local persistent storage |
| **React Navigation** | Tab + Stack navigation |
| **expo-notifications** | Local scheduled class alerts |
| **react-native-safe-area-context** | Notch & gesture bar support |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- [Expo Go](https://expo.dev/go) app on your Android/iOS device

### Installation

```bash
# Clone the repository
git clone https://github.com/Mohammad-Sameer06/btech-sync.git
cd btech-sync

# Install dependencies
npm install

# Start the development server
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

---

## 📂 Project Structure

```
btech-sync/
├── src/
│   ├── screens/
│   │   ├── ProfileSelectScreen.tsx   # "Who's studying today?" login screen
│   │   ├── CreateProfileScreen.tsx   # New profile setup with PIN
│   │   ├── PINScreen.tsx             # PIN keypad with shake animation
│   │   ├── HomeScreen.tsx            # Attendance dashboard
│   │   ├── TimetableScreen.tsx       # Weekly schedule builder
│   │   └── SettingsScreen.tsx        # Profile info, notifications, sync
│   ├── navigation/
│   │   ├── RootNavigator.tsx         # Auth gating (profile vs main app)
│   │   └── BottomTabNavigator.tsx    # Main 3-tab navigation
│   └── utils/
│       ├── profileService.ts         # Profile CRUD, PIN hashing, scoped keys
│       └── notifications.ts          # Local alarm scheduling engine
├── App.tsx
└── eas.json                          # EAS Build configuration
```

---

## 🏗️ Build APK

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) to generate Android APKs.

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to your Expo account
eas login

# Build a preview APK
eas build -p android --profile preview
```

Download the `.apk` from your [Expo dashboard](https://expo.dev) and install it directly on your device.

---

## 🔐 How the Login System Works

- Each user creates a **profile** with their name, branch, year, and a 4-digit PIN
- PINs are **hashed** before being stored locally — never stored as plain text
- All data (attendance, timetable, settings) is **scoped to the profile ID** in AsyncStorage, so profiles can never access each other's data
- Works **100% offline** — no internet, no accounts, no servers

---

## 👨‍💻 Author

**Mohammad Sameer**
B.Tech Student · GIET University

---

<div align="center">

Made with ❤️ to never miss 75% attendance again

</div>
