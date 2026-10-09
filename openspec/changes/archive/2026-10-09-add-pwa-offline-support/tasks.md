## 1. Иконки и манифест

- [x] 1.1 Создать `scripts/gen-icons.ts` на `atlas-codec.ts` (кроп `icon.png` → 512/192/180) и сгенерировать `icons/`; проверить: `bun scripts/gen-icons.ts` проходит и PNG имеют размеры 512x512, 192x192, 180x180
- [x] 1.2 Создать корневой `manifest.webmanifest` (имя, `start_url: ./index.html`, `display: standalone`, цвета, иконки any+maskable); проверить: `bun -e "JSON.parse(await Bun.file('manifest.webmanifest').text())"` валиден и иконки существуют

## 2. Service Worker

- [x] 2.1 Создать корневой `sw.js` (версионированный CACHE, precache shell, activate-чистка, fetch cache-first + навигационный фолбэк на `index.html`); проверить: список precache покрывает `index.html`, `index.js`, манифест, иконки, спрайты, UI и уровни, версия кэша одна строка
- [x] 2.2 Добавить ленивую охраняемую регистрацию SW в `src/index.ts` (`'serviceWorker' in navigator`, после `load`, ошибки в `console.warn`); проверить: `bun run typecheck` проходит, игровой цикл не изменён

## 3. Интеграция страницы и сборки

- [x] 3.1 Обновить корневой `index.html` (`<link rel="manifest">`, `theme-color`, `apple-touch-icon`); проверить: собранный `dist/index.html` содержит все три тега с относительными путями
- [x] 3.2 Расширить `scripts/build.sh` копированием `manifest.webmanifest`, `sw.js`, `icons/` в `dist/`; проверить: `bun run build` кладёт все три в `dist/` рядом с `index.html`

## 4. Проверка

- [x] 4.1 Прогнать `make ai-check` и ручную офлайн-проверку (раздать `dist/`, открыть раз онлайн, затем офлайн-перезагрузка доходит до стартового экрана); проверить: `ai-check` зелёный, офлайн-запуск работает
