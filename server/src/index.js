require('dotenv').config();

const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const measurementRoutes = require('./routes/measurements');
const followupRoutes = require('./routes/followups');
const publicDashboardRoutes = require('./routes/publicDashboard');
const brandRoutes = require('./routes/brands');
const { scheduleRecommendationMeasurementJob } = require('./services/recommendationMeasurementService');
const { isAuroraConfigured } = require('./aws/auroraClient');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (process.env.WRITE_FREEZE !== 'true') {
    return next();
  }

  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isWriteMethod) {
    return next();
  }

  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  return res.status(503).json({
    error: 'WRITE_FREEZE activo. Escrituras temporalmente bloqueadas.'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    aiProvider: process.env.AI_PROVIDER || 'bedrock',
    writeFreeze: process.env.WRITE_FREEZE === 'true',
    auroraConfigured: isAuroraConfigured()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aiProvider: process.env.AI_PROVIDER || 'bedrock',
    writeFreeze: process.env.WRITE_FREEZE === 'true',
    auroraConfigured: isAuroraConfigured()
  });
});

app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/public-dashboard', publicDashboardRoutes);
app.use('/api/brands', brandRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  scheduleRecommendationMeasurementJob();
});
