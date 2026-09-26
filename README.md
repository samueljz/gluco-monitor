# Gluco Monitor (GDM)

A mobile-first blood glucose tracking web app for Gestational Diabetes Management (GDM), built with **Vue 3**, **TypeScript**, and **Vite**.

Track your daily glucose readings and meals against a smart, time-aware schedule — with optional Google Drive backup for seamless cross-device sync.

## Features

- **Daily Schedule**
- **History Tab**
- **Dark Mode**
- **Google Drive Sync** 
  - Backup and restore all data to a private JSON file in your Google Drive, with local/remote merging

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Vue 3 (Composition API + `<script setup>`) |
| Language | TypeScript |
| Build Tool | Vite |
| UI Components | Naive UI |
| Styling | Tailwind CSS v4 |
| Charts | Chart.js + vue-chartjs |
| Confetti | canvas-confetti |
| Drive Sync | Google Identity Services + GAPI Drive v3 |

## Getting Started

### Prerequisites

- Node.js `^22.18.0` or `>=24.12.0`

### Install dependencies

```sh
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
```

> [!NOTE]
> The app works fully offline without a Google Client ID — Drive sync features will simply be unavailable.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Preview Production Build

```sh
npm run preview
```

### Deploy to GitHub Pages

```sh
npm run deploy
```

## Google Drive Sync

When a `VITE_GOOGLE_CLIENT_ID` is configured:

1. Tap the **⋮ menu** → **Connect Google Drive** to authenticate
2. All app data (`gdm_*` localStorage keys) is synced to a file named `GlucoMonitorBackup.json` in your Drive
3. On first login, you'll be prompted whether to overwrite local data with the Drive backup or merge
4. Subsequent syncs automatically merge (local data takes priority)
5. The OAuth token is silently renewed in the background; you'll only see a consent screen when re-authorization is explicitly needed

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (disable Vetur).

### Browser DevTools Extensions

- **Chrome/Edge/Brave**: [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) · [Enable Custom Object Formatters](http://bit.ly/object-formatters)
- **Firefox**: [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/) · [Enable Custom Object Formatters](https://fxdx.dev/firefox-devtools-custom-object-formatters/)
