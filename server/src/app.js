import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import photosRouter from './routes/photos.js';
import countriesRouter from './routes/countries.js';

const app = express();

// CORS for Vite dev server origin — credentials:true required for httpOnly cookies (Pitfall 4)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Parse cookies (required for httpOnly auth_token cookie)
app.use(cookieParser());

// JSON body parsing
app.use(express.json());

// API routes — auth routes are public (no requireAuth); mounted before other routes
app.use('/api/auth', authRouter);
app.use('/api/photos', photosRouter);
app.use('/api/countries', countriesRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error-handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export default app;
