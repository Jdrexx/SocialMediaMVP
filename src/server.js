import { createApp } from './app.js';
import { createDatabase } from './db.js';

const port = Number(process.env.PORT || 3000);
const dbFile = process.env.DB_FILE || 'social.sqlite';
const db = createDatabase(dbFile);
const app = createApp({ db });

app.listen(port, () => {
  console.log(`Social media MVP running at http://localhost:${port}`);
});
