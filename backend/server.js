import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import itemRoutes from './routes/itemRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend folder or root
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const frontendDir = path.resolve(__dirname, '../frontend');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// 1. Serve Frontend Static Files directly from Express
app.use(express.static(frontendDir));

// 2. Item CRUD API Routes (supports both /items and /api/items)
app.use('/items', itemRoutes);
app.use('/api/items', itemRoutes);

// 3. Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 4. Root route: serve frontend index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// 5. 404 Handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message,
  });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(` Item CRUD Server running on: http://localhost:${PORT}`);
  console.log(` Frontend Accessible at:      http://localhost:${PORT}/`);
  console.log(` Backend API Endpoint:        http://localhost:${PORT}/items`);
  console.log(`=============================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Error] Port ${PORT} is already in use.`);
    console.error(`To free port ${PORT}, run: npx kill-port ${PORT}`);
    console.error(`Or specify another port: PORT=5002 npm start\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
