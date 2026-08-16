import 'dotenv/config';
import { createServerApp } from './src/server/app.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const DB_PATH = process.env.DB_PATH ?? './apotek.db';

const { app, db } = createServerApp({ dbPath: DB_PATH });

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on :${PORT} | DB: ${DB_PATH} | Tables ready`);
});

export { app, db };
