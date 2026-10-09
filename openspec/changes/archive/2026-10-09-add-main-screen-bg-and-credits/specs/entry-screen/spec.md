## MODIFIED Requirements

### Requirement: Показ окна входа при запуске
Система SHALL при запуске показывать окно входа поверх игры с логотипом из `public/assets/ui/logo.png`, кнопкой play из `public/assets/ui/button/play.png` и кнопкой credits из `public/assets/ui/button/credits.png` на фоне-градиенте снизу-вверх от белого к голубому. Игровое поле SHALL NOT запускаться до нажатия play.

#### Scenario: Первый запуск показывает вход с градиентом и credits
- **WHEN** пользователь открывает игру
- **THEN** видно окно входа с градиентом от белого внизу к голубому вверху, логотипом, кнопкой play и кнопкой credits, уровень не запущен

## ADDED Requirements

### Requirement: Кнопка credits на главном экране
Система SHALL показывать на окне входа кнопку credits из `public/assets/ui/button/credits.png` и по нажатию SHALL открывать модалку credits поверх входа без запуска игры.

#### Scenario: Нажатие credits открывает модалку
- **WHEN** пользователь нажимает кнопку credits на окне входа
- **THEN** поверх входа показана модалка credits, выбор уровней не открыт и игра не запущена

### Requirement: Модалка credits с составом команды
Система SHALL в модалке credits показывать текст Team: Programmer Dmitriy Shcherbakov, Designer Aleksandr Kalinin, Illustrator Alena Maltseva и SHALL закрывать модалку по закрывающему действию (крест/бэкдроп/Escape) с возвратом к окну входа.

#### Scenario: Просмотр и закрытие credits
- **WHEN** открыта модалка credits
- **THEN** виден текст команды из трёх строк
- **WHEN** пользователь закрывает модалку
- **THEN** модалка скрыта и снова видно окно входа с кнопками play и credits
