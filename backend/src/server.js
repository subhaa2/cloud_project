const express = require('express');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

const defaultCorsOrigins = [
  'http://localhost:8080',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  'https://liquid-fulcrum-476414-v6.web.app',
  'https://liquid-fulcrum-476414-v6.firebaseapp.com'
];

const allowedOrigins = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : defaultCorsOrigins).map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS origin: ${origin}`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.send('Hello World from Express.js!');
});

// Storage routes
const storageRoutes = require('./routes/storageRoutes');
app.use('/api/storage', storageRoutes);

// Document metadata routes
const documentRoutes = require('./routes/documentRoutes');
app.use('/api/documents', documentRoutes);

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// School routes
const schoolRoutes = require('./routes/schoolRoutes');
app.use('/api/schools', schoolRoutes);

// Subject routes
const subjectRoutes = require('./routes/subjectRoutes');
app.use('/api/subjects', subjectRoutes);

// Week routes
const weekRoutes = require('./routes/weekRoutes');
app.use('/api/weeks', weekRoutes);

// User routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});