import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer();

// POST /api/meeting/video
// Purpose: Receive multimodal chunks (screen video + tab audio)
// Currently a placeholder: logs chunk size only
router.post('/video', upload.single('video'), (req, res) => {
  const label = req.body.label || 'unknown';
  const size = req.file ? req.file.size : 0;

  console.log(`[API][MULTIMODAL] Received chunk [${label}]: ${size} bytes`);

  res.json({
    success: true,
    size: size,
    label: label
  });
});

export default router;
