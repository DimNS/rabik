## Why

Тайлы карты лежат на самом нижнем слое и не имеют прозрачности, а весят как PNG. JPG при том же визуале заметно легче — экономим вес спрайтов и время загрузки. PNG остаётся только там, где прозрачность обязательна: спрайт кролика.

## What Changes

- `gen-atlas.ts` пишет атлас статики как `tiles.jpg` (энкодер `jpeg-js`, уже в dev-зависимостях) вместо `tiles.png`; `tiles.json: meta.image` → `tiles.jpg`, `meta.size` — реальный размер JPG.
- Выход кролика (`rabbit.png`) не меняется — там нужен альфа-канал.
- Загрузчик игры (`loadAtlas` через `HTMLImageElement`) формат-агностичен — код игры не меняется, только данные.
- Старый `tiles.png` удаляется из `public/assets/sprites/`; выполняется ДО `tile-variants` (первая очередь).

## Capabilities

### New Capabilities

Нет — только изменение формата выхода существующей способности.

### Modified Capabilities

- `atlas-generator`: выход статики — JPG вместо PNG; требование прозрачности сужается до атласа анимации.

## Impact

- Затронуты: `scripts/gen-atlas.ts` (encode через `jpeg-js`), `scripts/atlas-codec.ts` (прокси `encodeJpg`), собранные `public/assets/sprites/tiles.png|json` (удаление PNG, перезапись JSON).
- Не затронуты: `src/**` (загрузчик формат-агностичен), `rabbit.*`, `core/`.
- Зависимости: ноль новых (`jpeg-js@~0.4.4` уже есть).
- Порядок: выполняется первой очередью, до `tile-variants`; мульти-вариантный атлас из `tile-variants` сразу строится поверх JPG-выхода.
