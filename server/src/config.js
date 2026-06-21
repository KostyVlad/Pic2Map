import 'dotenv/config';

const {
  MONGODB_URI,
  PORT,
  STORAGE_PATH,
  STORAGE_BACKEND,
  MAX_FILE_BYTES,
  MAX_FILES_PER_BATCH,
  JWT_SECRET,
  NODE_ENV,
  RESEND_API_KEY,
  MAIL_FROM,
  APP_URL,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI is not set. ' +
    'Create a .env file from .env.example and supply a MongoDB connection string. ' +
    'Free M0 cluster: https://www.mongodb.com/atlas'
  );
}

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. ' +
    'Add a random secret (32+ chars) to server/.env — e.g. openssl rand -hex 32'
  );
}

// Storage backend: 'local' (disk, default) or 'cloudinary'.
// Credentials are read from the environment only — NEVER hardcode them in source
// (this repo is public; a committed secret leaks permanently). Set them in server/.env.
const storageBackend = (STORAGE_BACKEND || 'local').toLowerCase();

if (storageBackend === 'cloudinary') {
  const missing = [
    !CLOUDINARY_CLOUD_NAME && 'CLOUDINARY_CLOUD_NAME',
    !CLOUDINARY_API_KEY && 'CLOUDINARY_API_KEY',
    !CLOUDINARY_API_SECRET && 'CLOUDINARY_API_SECRET',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `STORAGE_BACKEND=cloudinary but missing: ${missing.join(', ')}. ` +
      'Add them to server/.env (get values from https://console.cloudinary.com/app/settings/api-keys).'
    );
  }
}

const config = Object.freeze({
  MONGODB_URI,
  PORT: Number(PORT) || 3001,
  STORAGE_PATH: STORAGE_PATH || './uploads',
  STORAGE_BACKEND: storageBackend,
  MAX_FILE_BYTES: Number(MAX_FILE_BYTES) || 26214400,   // 25 MB
  MAX_FILES_PER_BATCH: Number(MAX_FILES_PER_BATCH) || 50,
  JWT_SECRET,
  NODE_ENV: NODE_ENV || 'development',
  COOKIE_SECURE: NODE_ENV === 'production',  // Pitfall 3: false on localhost
  RESEND_API_KEY: RESEND_API_KEY || '',
  MAIL_FROM: MAIL_FROM || 'onboarding@resend.dev',
  APP_URL: APP_URL || 'http://localhost:5173',
  CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: CLOUDINARY_API_SECRET || '',
});

export default config;
