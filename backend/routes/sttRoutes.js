import express from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/sttService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const buffer = req.file.buffer;
    const text = await transcribeAudio(buffer, 'mic');

    res.json({ text });
  } catch (err) {
    console.error("[sttRoutes] Error:", err);
    res.status(500).json({ error: "Internal server error during transcription" });
  }
});

export default router;
