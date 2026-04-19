// mailer.js — Task Notification Emails via Google SMTP
// Sends email notifications to employees when they are assigned new tasks.
// Called after the LLM pipeline finishes processing a meeting.

import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const EMPLOYEE_FILE = path.join(process.cwd(), 'data', 'employee.json');
const DISPLAY_FILE = path.join(process.cwd(), 'data', 'display.json');

// Google SMTP Config
const GMAIL_USER = process.env.GMAIL_USER;
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

/**
 * Resolve an employee's email from their name/alias.
 * Case-insensitive matching against aliases and full name.
 */
function resolveEmail(personName, employees) {
    const lower = personName.trim().toLowerCase();
    for (const emp of employees) {
        // Check full name
        if (emp.name.toLowerCase() === lower) return emp;
        // Check aliases
        if (emp.aliases && emp.aliases.some(a => a.toLowerCase() === lower)) return emp;
    }
    return null;
}

/**
 * Build a professional HTML email body for task notification.
 */
function buildEmailHTML(employeeName, meetingTitle, tasks) {
    const taskRows = tasks.map(t => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; color: #333; font-size: 14px;">${t.task || t.text || ''}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; color: #C9A84C; font-weight: 600; font-size: 14px;">${t.deadline || 'TBD'}</td>
        </tr>
    `).join('');

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e8e8;">
        <div style="background: #111111; padding: 28px 32px;">
            <h1 style="color: #C9A84C; margin: 0; font-size: 22px; font-weight: 700;">New Task Assignment</h1>
            <p style="color: #999; margin: 8px 0 0; font-size: 14px;">AI Meeting Intelligence System</p>
        </div>
        <div style="padding: 28px 32px;">
            <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hi <strong>${employeeName}</strong>,</p>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                You have been assigned new task(s) from the meeting: <strong>${meetingTitle}</strong>.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background: #fafafa;">
                        <th style="text-align: left; padding: 10px 16px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f0f0f0;">Task</th>
                        <th style="text-align: left; padding: 10px 16px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f0f0f0;">Deadline</th>
                    </tr>
                </thead>
                <tbody>
                    ${taskRows}
                </tbody>
            </table>
            <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0; border-top: 1px solid #f0f0f0; padding-top: 16px;">
                This is an automated notification from MeetTrack AI. Please check your dashboard for full details.
            </p>
        </div>
    </div>
    `;
}

/**
 * Main function: Send task notification emails for the latest meeting.
 * Reads display.json (last entry), matches task persons to employees, and sends emails.
 */
export async function sendTaskNotifications() {
    try {
        // Load employee data
        const empRaw = await fs.readFile(EMPLOYEE_FILE, 'utf8');
        const employees = JSON.parse(empRaw);

        // Load display data (processed meetings)
        const dispRaw = await fs.readFile(DISPLAY_FILE, 'utf8');
        const meetings = JSON.parse(dispRaw);

        if (!meetings.length) {
            console.log('[MAILER] No meetings in display.json, skipping.');
            return;
        }

        // Get the latest meeting (last entry)
        const latestMeeting = meetings[meetings.length - 1];
        const tasks = latestMeeting.tasks || [];

        if (!tasks.length) {
            console.log(`[MAILER] No tasks in latest meeting "${latestMeeting.title}", skipping.`);
            return;
        }

        console.log(`[MAILER] Processing ${tasks.length} task(s) from: "${latestMeeting.title}"`);

        // Group tasks by person
        const tasksByPerson = {};
        for (const task of tasks) {
            const person = task.person || task.owner || '';
            if (!person) continue;
            if (!tasksByPerson[person]) tasksByPerson[person] = [];
            tasksByPerson[person].push(task);
        }

        // Send emails
        for (const [personName, personTasks] of Object.entries(tasksByPerson)) {
            const employee = resolveEmail(personName, employees);

            if (!employee) {
                console.log(`[MAILER] No employee match for "${personName}", skipping.`);
                continue;
            }

            const html = buildEmailHTML(employee.name, latestMeeting.title, personTasks);
            const taskCount = personTasks.length;

            try {
                await transporter.sendMail({
                    from: `"MeetTrack AI" <${GMAIL_USER}>`,
                    to: employee.email,
                    subject: `📋 ${taskCount} New Task${taskCount > 1 ? 's' : ''} Assigned — ${latestMeeting.title}`,
                    html: html
                });
                console.log(`[MAILER] ✅ Email sent to ${employee.name} (${employee.email}) — ${taskCount} task(s)`);
            } catch (mailErr) {
                console.error(`[MAILER] ❌ Failed to email ${employee.name}: ${mailErr.message}`);
            }
        }

        console.log('[MAILER] Task notification pipeline complete.');
    } catch (err) {
        console.error('[MAILER] Pipeline error:', err.message);
    }
}

// Allow running standalone: `node mailer.js`
if (process.argv[1] && process.argv[1].endsWith('mailer.js')) {
    sendTaskNotifications();
}
