## 1. Переход статики на JPG

- [x] 1.1 Добавить `encodeJpg` в `scripts/atlas-codec.ts` (прокси `jpeg-js.encode`, quality параметром) с unit-тестом round-trip decode(encode(x)) и проверить `bun test`
- [x] 1.2 Переключить `scripts/gen-atlas.ts` на выход `tiles.jpg` + `meta.image="tiles.jpg"` (+ флаг `--jpg-quality`, дефолт 85; удаление устаревшего `tiles.png` при успехе) и проверить `bun scripts/gen-atlas.ts` — создан `tiles.jpg`, `tiles.png` удалён

## 2. Финальная проверка

- [x] 2.1 Прогнать `make ai-check` и убедиться, что typecheck + lint + тесты зелёные
