import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import marketRoutes from './routes/markets';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware. Cap JSON bodies so a giant payload can't OOM the parser; this
// app's biggest legitimate body is ~30 bytes (`{"suspended":false}`).
app.use(cors());
app.use(express.json({ limit: '16kb' }));

// Routes
app.use('/api/markets', marketRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// JSON 404 for any unknown path so clients always get a parseable response,
// instead of Express's default `Cannot GET /...` HTML.
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler — catches anything that escaped a route's try/catch,
// including JSON parse errors raised by `express.json()` for malformed
// bodies. Keeps the API contract uniform: always `{success, error}`.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[unhandled] ${req.method} ${req.path}`, err);
  // express.json() raises a SyntaxError for bad JSON and tags the error
  // object with `type: 'entity.parse.failed'`. Surface that as a 400 so
  // the client knows the issue was their input, not server health.
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed JSON body' });
  }
  if (e?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large' });
  }
  const status = typeof e?.status === 'number' ? e.status : 500;
  res.status(status).json({ success: false, error: 'Internal server error' });
});

// Start server (skip when running under Jest — the test harness imports
// `app` and supertest provisions its own ephemeral port).
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API base URL: http://localhost:${PORT}/api`);
  });
}

export default app;
