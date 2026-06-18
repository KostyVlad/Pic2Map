import 'dotenv/config';

const {
  MONGODB_URI,
  PORT,
  STORAGE_PATH,
  MAX_FILE_BYTES,
  MAX_FILES_PER_BATCH,
} = process.env;

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI is not set. ' +
    'Create a .env file from .env.example and supply a MongoDB connection string. ' +
    'Free M0 cluster: https://www.mongodb.com/atlas'
  );
}

const config = Object.freeze({
  MONGODB_URI,
  PORT: Number(PORT) || 3001,
  STORAGE_PATH: STORAGE_PATH || './uploads',
  MAX_FILE_BYTES: Number(MAX_FILE_BYTES) || 26214400,   // 25 MB
  MAX_FILES_PER_BATCH: Number(MAX_FILES_PER_BATCH) || 50,
});

export default config;
