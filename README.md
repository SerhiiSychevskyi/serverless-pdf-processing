# Serverless PDF Processing Monitor

Веб-додаток для моніторингу обробки PDF файлів в AWS середовищі в реальному часі 

### Особливості

-  **Real-time WebSocket підключення** - миттєве отримання подій з AWS
-  **Timeline візуалізація** - горизонтальні бари для відображення подій у часі
-  **Метрики** - тривалість OCR, Thumbnail генерації та загальний час
-  **Pause/Continue режим** - зупинка оновлень для аналізу результатів
    - На паузі: події накопичуються в буфері, UI не оновлюється
    - Continue: всі накопичені події застосовуються одразу
-  **Floating Event Log** - перегляд сирих WebSocket подій та даних

### Структура проекту

```
serverless-pdf-processing/
├── lambdas/                              # AWS Lambda функції
│   ├── document-jobs-stream-notifier.mjs # WebSocket notifier
│   └── ws-connection-handler.mjs         # WebSocket connection handler
├── pdf-monitor/                          # React веб-монітор
│   ├── src/
│   │   ├── components/
│   │   │   ├── Timeline.tsx              # Головний layout з Pause/Event Log
│   │   │   └── JobTimeline.tsx           # Timeline візуалізація джоб
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts           # WebSocket підключення з pause режимом
│   │   ├── types.ts                      # TypeScript типи
│   │   └── App.tsx                       # Root компонент
│   ├── tailwind.config.js
│   └── package.json
├── .gitignore
└── README.md
```

### Швидкий старт

#### 1. Встановлення залежностей

```bash
cd pdf-monitor
npm install
```

#### 2. Налаштування environment variables

Створіть `.env` файл на основі `.env.example`:

```bash
cp .env.example .env
```

Відредагуйте `.env` та вкажіть ваш WebSocket URL:

```env
VITE_WS_URL=wss://your-api-id.execute-api.region.amazonaws.com/production
```

#### 3. Запуск dev сервера

```bash
npm run dev
```

Додаток буде доступний за адресою: http://localhost:5173

### Як працює Timeline

1. **WebSocket підключення** - автоматично підключається до AWS API Gateway WebSocket
2. **Отримання подій** - події надходять у реальному часі при обробці PDF
3. **Timeline візуалізація**:
   - Кожна джоба = один рядок
   - Три рівні барів: Total, OCR, Thumbnail
   - Event markers: Start → OCR Start → Thumb Start → OCR Done → Thumb Done → Job Done
   - Автоматичне масштабування timeline по всіх джобах

### Формат WebSocket подій

```json
{
  "type": "DOCUMENT_UPDATED",
  "eventName": "MODIFY",
  "jobId": "a693da2f-af17-4916-827f-ec8aac9af960",
  "status": "IN_PROGRESS",
  "ocrStatus": "IN_PROGRESS",
  "thumbnailStatus": "DONE",
  "updatedAt": "1765710361034",
  "startedAt": "1765710350000",
  "finishedAt": "1765710405000",
  "ocrStartedAt": "1765710350500",
  "ocrFinishedAt": "1765710400000",
  "thumbnailStartedAt": "1765710351000",
  "thumbnailFinishedAt": "1765710361034"
}
```

**Ключові поля:**
- `startedAt` / `finishedAt` - повний час обробки джоби
- `ocrStartedAt` / `ocrFinishedAt` - час OCR процесу
- `thumbnailStartedAt` / `thumbnailFinishedAt` - час генерації thumbnail
- Всі timestamps в мілісекундах

**Статуси:**
- `PENDING` - очікує початку
- `IN_PROGRESS` - виконується
- `DONE` - завершено успішно
- `FAILED` - помилка

### Технології

- React + TypeScript
- Vite (dev server + bundler)
- Tailwind CSS
- WebSocket API
- ESLint + TypeScript ESLint
