import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import sttRoutes from './routes/sttRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/', sttRoutes);
app.use('/api/meeting', videoRoutes);
app.use('/api/meeting', meetingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:5000`);
});
