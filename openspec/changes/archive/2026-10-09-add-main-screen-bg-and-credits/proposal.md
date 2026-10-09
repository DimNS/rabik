## Why

Главный экран сейчас тёмный (`#111`) и не показывает авторов. Нужен светлый фон-градиент и доступные credits команды.

## What Changes

- Фон entry-экрана: градиент снизу-вверх от белого к голубому вместо `#111`.
- Кнопка credits на главном экране из `public/assets/ui/button/credits.png`.
- Модалка credits с текстом Team: Programmer Dmitriy Shcherbakov, Designer Aleksandr Kalinin, Illustrator Alena Maltseva. Закрытие по кресту/бэкдропу, игра не запускается.

## Capabilities

### New Capabilities

- Нет новых capability — поведение относится к существующему входу.

### Modified Capabilities

- `entry-screen`: фон-градиент, кнопка credits и модалка credits на окне входа.

## Impact

- `src/view/ui.ts` (`createUi`, `UI_ASSETS`, entry-блок, модалка), `src/index.ts` (колбэки — без изменений логики).
- Ассет уже есть: `public/assets/ui/button/credits.png`. Новых зависимостей нет.
