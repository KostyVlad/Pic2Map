import app from './app.js';
import { connectDb } from './db.js';
import config from './config.js';

await connectDb();

app.listen(config.PORT, () => {
  console.log(`PhotoMap server listening on http://localhost:${config.PORT}`);
});
