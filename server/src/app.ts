import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rateLimit.middleware';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
    maxAge: 86400, // 24 hours
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
app.use(rateLimiter);

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'EchoEnglish API Server',
    version: '1.0.0',
  });
});

// 404 handler
app.use(notFoundMiddleware);

// Error handler
app.use(errorMiddleware);

export default app;
