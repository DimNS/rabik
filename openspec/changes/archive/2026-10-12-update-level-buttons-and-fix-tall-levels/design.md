## Context

См. `proposal.md` (Why) и дельты `specs/game-modals/spec.md`, `specs/game-rendering/spec.md` — требования уже зафиксированы, здесь только способ реализации.

Текущее состояние:
- `src/view/ui.ts`: одна HUD-кнопка `hud` (`UI_ASSETS.backBtn` = `back.png`, 48×48, `top:12px;left:12px`) с `aria-label="menu"` → `cb.onMenu`. Колбэк `onRestart` уже есть и используется из модалок (`index.ts`: `startLevel(currentId)`). Ассеты `public/assets/ui/button/menu.png` и `restart.png` уже лежат в репозитории, в коде не используются.
- `src/view/layout.ts`: `computeLayout` считает `tileSize = min(130, floor(min(cssW/gridW, cssH/gridH)))`, offsets — `floor((css - tile*grid)/2)`. Чистая математика сходится: поле обязано помещаться.
- `src/view/renderer.ts` + `src/view/canvas.ts` + `src/index.ts`: offscreen-слой размером `grid*tileSize`, рисуется на canvas через `drawImage(layer, offsetX, offsetY)` под dpr-трансформом (`setTransform(dpr,...)` из `applyCanvasSize`); замеры — `canvas.clientWidth/clientHeight` в `startLevel` и на `resize`. Canvas CSS — `100dvw/100dvh`.
- Ограничения: cap 130 и центрирование сохранить; чёткость (`imageSmoothingEnabled=false`, `image-rendering: pixelated`) не ломать; без новых зависимостей.

## Goals / Non-Goals

**Goals:**
- Две угловые кнопки экрана уровня: меню (`menu.png`) и быстрый рестарт (`restart.png`) с видимостью, синхронной с текущим HUD.
- Полное помещение высоких полей (7×14: 014, 039) в окно без вылезания вверх и обрезки снизу.

**Non-Goals:**
- Не меняем модалки `win`/`fail`/`menu`, навигацию между уровнями, правила ходов, генерацию и формат уровней.
- Не добавляем новые ассеты, зависимости и изменения сборки.

## Decisions

### 1. Вторая HUD-кнопка рядом с меню
- В `UI_ASSETS` добавить `menuBtn` (`button/menu.png`) и `restartBtn` (`button/restart.png`); существующий `hud` переключить на `menuBtn`, рядом создать `hudRestart` (те же 48×48, отступ `left:68px`, `top:12px`, собственные `aria-label`: `menu` и `restart level`).
- `hudRestart` напрямую вызывает `cb.onRestart` (тот же путь, что restart из меню) — без открытия модалки, без изменения `modal`-состояния. Видимость обеих кнопок переключать в одних местах: `showGame`/`showModal` — показать, `showEntry`/`showLevels` — скрыть.
- Альтернатива — одна составная кнопка или рестарт только через меню: отклонено, противоречит требованию быстрого рестарта.

### 2. Диагностика и фикс вылезания высоких уровней
- Ведущая гипотеза (проверяется замером, а не переписыванием вслепую): рассинхрон систем координат в `renderer.ts` — слой собирается в CSS-пикселях (`layer.width = width*tileSize`), а рисуется `drawImage(layer, offsetX, offsetY)` под активным dpr-трансформом, то есть увеличивается в `dpr` раз; на телефонах с `dpr` 2–3 поле переполняется, на высоких уровнях это заметнее всего. Второй кандидат — момент замера `clientWidth/clientHeight` (до стабилизации `100dvh` на мобильных).
- Решение: первым шагом воспроизвести на 014/039 с логом (`clientWidth`, `clientHeight`, `tileSize`, `offsetY`, `dpr`, `layer.width/height`, `canvas.width/height`) и подтвердить источник; затем привести слой и отрисовку к одной системе координат (dpr-aware слой либо рисование в device-px с пересчётом offsets), сохранив cap 130, `floor`-центрирование и `imageSmoothingEnabled=false`. `computeLayout` менять только если замер покажет ошибку в нём, а не в renderer.
- Альтернатива — CSS-масштаб/скролл поля: отклонено, ломает требование «всё поле видно» и чёткость.

### 3. Проверки
- Unit: `layout.test.ts` — кейс 7×14 (например вьюпорт 390×844: `tileSize`, инвариант `offset*2 + grid*tile <= viewport` по обеим осям, `tileSize <= 130`).
- Ручная: уровни 014 и 039 на десктопе и в мобильной эмуляции — всё поле видно целиком; кнопки: меню открывает `menu.png`, рестарт перезапускает без меню; модалки победы/поражения без изменений.

## Risks / Trade-offs

- [Риск] Гипотеза про DPR неверна, корень в другом (замер вьюпорта, `dvh`) → смягчение: первая задача — замер-репродукция на 014, решение корректируется по факту, спеки при этом не меняются.
- [Риск] Вторая кнопка перекроет поле или seed-бейдж справа на узких экранах → смягчение: компактные 48px со стандартными отступами, `pointer-events` только на кнопках, проверка на 360px ширины.
- [Риск] dpr-aware слой даст размытие/регресс чёткости → смягчение: сохранить `imageSmoothingEnabled=false` и `pixelated`, сравнить визуально до/после на `dpr` 1 и 2.
