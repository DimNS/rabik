## Why

Игра — статичный клиент без бэкенда, но сейчас требует сети при каждом запуске и не устанавливается на главный экран телефона. PWA (Web App Manifest + Service Worker) даст офлайн-запуск и поведение «как нативное приложение» на мобильных устройствах.

## What Changes

- Добавлен Web App Manifest (`manifest.webmanifest`): имя, иконки, `display: standalone`, `start_url`, `theme_color` / `background_color`.
- Добавлен Service Worker (`sw.js`): precache shell и ассетов, стратегия cache-first / stale-while-revalidate, офлайн-фолбэк.
- `index.html` подключает манифест, `theme-color`, `apple-touch-icon` и регистрацию Service Worker.
- Сборка (`scripts/build.sh`) копирует манифест, SW и иконки в `dist/` и подставляет правильные пути.
- Регистрация SW в `src/index.ts` (только в поддерживаемых браузерах, без влияния на игровой цикл).

## Capabilities

### New Capabilities

- `pwa-offline`: установка игры на главный экран (манифест, иконки, standalone-режим) и офлайн-работа (Service Worker, кэширование, обновление кэша).

### Modified Capabilities

—

## Impact

- Затронуты: `index.html`, `src/index.ts` (регистрация SW), `scripts/build.sh`, `public/` (новые `manifest.webmanifest`, иконки 192/512 maskable), корень `sw.js`.
- API/зависимости: новых npm-зависимостей нет, используются штатные Cache Storage + Service Worker API.
- Риски: устаревший кэш после деплоя — решается версионированием кэша SW; iOS-ограничения PWA принимаются как есть.
