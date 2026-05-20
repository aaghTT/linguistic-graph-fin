# Лингвистический граф

Визуализация иерархических связей между словами в виде интерактивного графа.

## Возможности

- Интерактивная визуализация связей
- Поиск и раскрытие узлов графа
- Drag and drop для перемещения узлов
- Авто-центрирование на выбранном узле
- Тёмная тема
- Экспорт графа в JSON
- Автоматическое управление памятью (макс. 20 видимых узлов)
### Типы семантических связей
- `синоним` - синонимические отношения
- `антоним` - антонимические отношения
- `гипоним` - частное понятие
- `гипероним` - общее понятие
- `мероним` - часть от целого
- `голоним` - целое от части
- `ассоциация` - ассоциативные связи
- и другие лингвистические отношения
## Технологии

- **Frontend**: D3.js, HTML5, CSS3
- **Backend**: Django 4.2, Django REST Framework
- **Графовая БД**: Memgraph
- **Драйвер**: GQLAlchemy
- **Язык запросов**: Cypher

## Установка и запуск

Клонируйте репозиторий:
```bash
git clone https://github.com/arrayruru/linguistic-graph.git
cd linguistic-graph/frontend
```

### Frontend

Откройте index.html в браузере или используйте live-server:
```bash
npx live-server
```

### Backend

```bash
cd backend
docker-compose up -d
pip install -r requirements.txt
python manage.py runserver
```
Инициализации данных
```bash
python load_concept.py
```

## Использование

1. Введите слово в поле поиска
2. Нажмите "Загрузить узел" или Enter
3. Кликайте на узлы для раскрытия связей
4. Перетаскивайте узлы для удобного расположения
5. Используйте колёсико мыши для зума

## API Эндпоинты

Базовый URL: `http://localhost:8000/api/`

## API Эндпоинты

Базовый URL: `http://localhost:8000/api/`

| Метод | Эндпойнт | Описание |
|-------|----------|----------|
| GET | `/concept/<int:concept_id>` | Получить концепт |
| POST | `/concept` | Создать концепт |
| GET | `/concepts` | Все концепты |
| PUT/PATCH | `/concept/<int:concept_id>/update` | Обновить концепт |
| DELETE | `/concept/<int:concept_id>/delete` | Удалить концепт |
| GET | `/concept/<int:concept_id>/children` | Прямые потомки |
| GET | `/concept/<int:concept_id>/parent` | Родитель |
| POST | `/semantic-edge` | Создать семантическую связь |
| DELETE | `/semantic-edge/delete` | Удалить семантическую связь |
| GET | `/search/` | Поиск концептов |
| POST | `/load-concepts/` | Загрузка концептов |
| POST | `/load-test-data/` | Загрузка тестовых данных |

## Автор
- aaghTT frontend
- arrayryry backend

## Лицензия

MIT
