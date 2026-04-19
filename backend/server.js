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

app.post('/api/meeting/process', (req, res) => {
  console.log("[API] Meeting process endpoint hit");
  console.log(req.body);

  res.json({
    success: true,
    meeting: {
      id: "test-id",
      title: "Test Meeting",
      date: "18 Apr 2026",
      time: "12:00",
      briefSummary: "This is a test summary",
      detailedSummary: "Detailed summary placeholder",
      topics: ["Testing"],
      tasks: [],
      keyNotes: ["Backend connected successfully"]
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:5000`);
});
