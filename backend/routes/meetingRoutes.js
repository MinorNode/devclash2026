import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

const router = express.Router();
const RAW_FILE = path.join(process.cwd(), 'data', 'meeting.json');

// POST /api/meeting/save
// Purpose: Persist meeting data to raw storage (meeting.json)
// Processing is now handled separately by the LLM pipeline
router.post('/save', async (req, res) => {
  try {
    const { title, micSst, webSst } = req.body;

    const id = Date.now().toString();
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const fullTitle = title || `Meeting - ${now.toLocaleDateString()}`;

    // Prepare RAW entry (meeting.json)
    const rawEntry = {
      id: id,
      title: fullTitle,
      date: dateFormatted,
      time: timeFormatted,
      "mic sst": micSst || "",
      "web sst": webSst || ""
    };

    // Utility to append to a JSON file
    const appendToFile = async (filePath, entry) => {
      let items = [];
      try {
        const data = await fs.readFile(filePath, 'utf8');
        items = JSON.parse(data);
      } catch (err) {
        // File doesn't exist yet, start fresh
      }
      items.push(entry);
      await fs.writeFile(filePath, JSON.stringify(items, null, 2));
    };

    // Save to raw storage only
    await appendToFile(RAW_FILE, rawEntry);

    console.log(`[API] Meeting persisted to raw storage: ${fullTitle}`);
    
    // Auto-trigger LLM Pipeline
    console.log(`[API] Triggering LLM pipeline for ID: ${id}`);
    exec('python llm.py', (error, stdout, stderr) => {
        if (error) {
            console.error(`[LLM TRIGGER ERROR]: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`[LLM WARNING/INFO]: ${stderr}`);
        }
        console.log(`[LLM SUCCESS]: ${stdout}`);

        // Chain: After LLM completes, send task notification emails
        console.log(`[API] Triggering mailer for new task notifications...`);
        exec('node mailer.js', (mailErr, mailOut, mailStderr) => {
            if (mailErr) {
                console.error(`[MAILER TRIGGER ERROR]: ${mailErr.message}`);
                return;
            }
            if (mailStderr) {
                console.warn(`[MAILER WARNING]: ${mailStderr}`);
            }
            console.log(`[MAILER OUTPUT]: ${mailOut}`);
        });
    });

    res.json({
      success: true,
      id: id
    });
  } catch (err) {
    console.error("[API] Error in raw storage save:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/meeting/display
// Purpose: Serve processed meeting data from display.json to the frontend
router.get('/display', async (req, res) => {
  const DISPLAY_FILE = path.join(process.cwd(), 'data', 'display.json');
  try {
    const data = await fs.readFile(DISPLAY_FILE, 'utf8');
    const items = JSON.parse(data);
    res.json(items);
  } catch (err) {
    // File doesn't exist or is empty — return empty array
    res.json([]);
  }
});

// PUT /api/meeting/task/status
// Purpose: Update the status of a specific task in display.json
router.put('/task/status', async (req, res) => {
  const { meetingId, taskText, status } = req.body;
  const DISPLAY_FILE = path.join(process.cwd(), 'data', 'display.json');
  
  try {
    const data = await fs.readFile(DISPLAY_FILE, 'utf8');
    const items = JSON.parse(data);

    let updated = false;

    for (let meeting of items) {
      if (meeting.id === meetingId) {
        if (meeting.tasks && meeting.tasks.length > 0) {
          for (let task of meeting.tasks) {
            // Task text matching
            if ((task.task === taskText) || (task.text === taskText)) {
              task.status = status;
              updated = true;
              break; // Found the task, stop searching in this meeting
            }
          }
        }
        if (updated) break; // Found the meeting & task, stop searching
      }
    }

    if (updated) {
      await fs.writeFile(DISPLAY_FILE, JSON.stringify(items, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Meeting or Task not found.' });
    }
  } catch (err) {
    console.error("[API] Error updating task status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/meeting/employees
// Purpose: Serve employee data for frontend authentication
router.get('/employees', async (req, res) => {
  const EMPLOYEE_FILE = path.join(process.cwd(), 'data', 'employee.json');
  try {
    const data = await fs.readFile(EMPLOYEE_FILE, 'utf8');
    const employees = JSON.parse(data);
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employee data.' });
  }
});

export default router;
