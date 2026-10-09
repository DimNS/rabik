## Context

Entry-экран в `src/view/ui.ts` (`createUi`): `entry` div сейчас `background:#111`, внутри logo + play. `UI_ASSETS` не содержит credits, общей credits-модалки нет. Ассет `public/assets/ui/button/credits.png` уже в репо. См. proposal.md Why и specs/entry-screen/spec.md.

## Goals / Non-Goals

**Goals:**
- Светлый градиент входа средствами CSS без новых зависимостей.
- Credits-кнопка и модалка в существующем стиле `ui.ts`.

**Non-Goals:**
- Не менять экраны levels/game, палитру canvas, PWA.
- Не делать i18n текста credits.

## Decisions

- Фон: `linear-gradient(to top, #FFFFFF 0%, #BFE3FF 100%)` на `entry` div (внизу белый, вверху голубой). Альтернатива — картинка-фон: отклонена, лишний ассет и вес.
- Ассет: добавить `credits: 'public/assets/ui/button/credits.png'` в `UI_ASSETS`, прелоад уже покрыт циклом по `Object.values`.
- Модалка credits: лёгкий `div` внутри `entry` (карточка white + текст + close-кнопка), а не через общий `renderModal('menu'|'win'|'fail')` с `MODAL_ZONES` — те зоны заточены под цельные PNG, текстовая модалка проще отдельным блоком. Закрытие по кресту, клику по бэкдропу и Escape. Фокус опционально.
- Кнопка credits: `button` с `img` под play, `aria-label="credits"`.

## Risks / Trade-offs

- [Градиент спорит с тёмным логотипом] → проверить контраст logo/play/credits на светлом фоне вручную.
- [Текст credits захардкожен] → приемлемо, состав меняется редко; вынести в константу `CREDITS` для правки в одном месте.
