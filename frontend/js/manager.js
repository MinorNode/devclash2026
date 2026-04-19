// Manager Oversight Dashboard — manager.js
// Fetches all meetings from display.json and renders team-wide analytics.

// Auth + Role guard — only managers can access this page
const sessionData = localStorage.getItem("meettrack_user");
if (!sessionData) {
    window.location.href = "login.html";
}
const loggedInUser = sessionData ? JSON.parse(sessionData) : null;
if (!loggedInUser || loggedInUser.role !== "manager") {
    alert("Access Denied: Manager access only.");
    window.location.href = "index.html";
}

const API_URL = "http://localhost:5000/api/meeting/display";

const managerStatsGrid = document.getElementById("managerStatsGrid");
const teamTasksTableBody = document.getElementById("teamTasksTableBody");
const priorityDeadlinesList = document.getElementById("priorityDeadlinesList");
const managerUrgentBadge = document.getElementById("managerUrgentBadge");
const employeeFilter = document.getElementById("employeeFilter");
const priorityFilter = document.getElementById("priorityFilter");

let allMeetings = [];
let teamTasks = [];

// ─── Data Loading ───────────────────────────────────────────
async function loadManagerData() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        allMeetings = Array.isArray(data) ? data : [];

        // Collect ALL tasks from ALL meetings (team-wide)
        teamTasks = allMeetings.flatMap(meeting => {
            const tasks = Array.isArray(meeting.tasks) ? meeting.tasks : [];
            return tasks.map(task => ({
                text: task.task || task.text || "",
                owner: task.person || task.owner || "Unassigned",
                deadline: task.deadline || "TBD",
                status: task.status || "Pending",
                meetingTitle: meeting.title || "Untitled Meeting",
                meetingId: meeting.id,
                priority: calculatePriority(task)
            }));
        });

        renderManagerStats();
        populateEmployeeFilter();
        renderTeamTasks();
        renderPriorityDeadlines();
        drawWeeklyTargetChart();
    } catch (err) {
        console.error("Failed to load manager data:", err);
    }
}

// ─── Priority Calculation ───────────────────────────────────
function calculatePriority(task) {
    const text = (task.task || task.text || "").toLowerCase();
    if (text.includes("urgent") || text.includes("critical") || text.includes("finalize") || text.includes("end-to-end")) return "High";
    if (text.includes("fix") || text.includes("review") || text.includes("update") || text.includes("implement") || text.includes("research")) return "Medium";
    return "Low";
}

// ─── Stats ──────────────────────────────────────────────────
function renderManagerStats() {
    if (!managerStatsGrid) return;

    const total = teamTasks.length;
    const done = teamTasks.filter(t => isTaskDone(t)).length;
    const pending = total - done;
    const efficiency = total > 0 ? Math.round((done / total) * 100) : 0;

    const stats = [
        { title: "Team Total Tasks", value: total },
        { title: "Pending Actions", value: pending },
        { title: "Team Completed", value: done },
        { title: "Efficiency Rate", value: `${efficiency}%` }
    ];

    managerStatsGrid.innerHTML = stats.map(s => `
        <div class="glass-card stat-card">
            <p class="stat-title">${s.title}</p>
            <h3 class="stat-value">${s.value}</h3>
        </div>
    `).join("");
}

// ─── Employee Filter Dropdown ───────────────────────────────
function populateEmployeeFilter() {
    if (!employeeFilter) return;
    const employees = [...new Set(teamTasks.map(t => t.owner))].filter(Boolean);
    const current = employeeFilter.value;
    employeeFilter.innerHTML = '<option value="all">All Employees</option>' +
        employees.map(emp => `<option value="${emp}" ${emp === current ? "selected" : ""}>${emp}</option>`).join("");
}

// ─── Team Tasks Table ───────────────────────────────────────
function renderTeamTasks() {
    if (!teamTasksTableBody) return;

    let filtered = [...teamTasks];

    // Employee filter
    if (employeeFilter && employeeFilter.value !== "all") {
        filtered = filtered.filter(t => t.owner === employeeFilter.value);
    }

    // Priority filter
    if (priorityFilter && priorityFilter.value !== "all") {
        if (priorityFilter.value === "High") {
            const order = { "High": 3, "Medium": 2, "Low": 1 };
            filtered.sort((a, b) => (order[b.priority] || 0) - (order[a.priority] || 0));
        } else {
            filtered = filtered.filter(t => t.priority === priorityFilter.value);
        }
    }

    if (!filtered.length) {
        teamTasksTableBody.innerHTML = `<tr><td colspan="5" class="empty-table-cell">No tasks match these filters.</td></tr>`;
        return;
    }

    teamTasksTableBody.innerHTML = filtered.map(task => {
        const isDone = isTaskDone(task);
        const safeTaskText = task.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const btnHtml = isDone ? "" : `<button class="secondary-btn" style="padding: 4px 10px; font-size: 12px; margin-left: auto;" onclick="window.markTaskDone('${task.meetingId}', '${safeTaskText}')">Mark Done</button>`;

        return `
        <tr>
            <td><strong>${task.owner}</strong></td>
            <td>${task.text}</td>
            <td><span class="deadline-pill">${task.deadline}</span></td>
            <td><span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span></td>
            <td style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span class="status-pill ${isDone ? 'status-done' : 'status-pending'}">
                    ${task.status}
                </span>
                ${btnHtml}
            </td>
        </tr>
    `}).join("");
}

window.markTaskDone = async function(meetingId, taskText) {
    try {
        const actualText = taskText.replace(/&quot;/g, '"');
        const res = await fetch('http://localhost:5000/api/meeting/task/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId, taskText: actualText, status: "Done" })
        });
        
        if (res.ok) {
            // Instantly reload local data
            await loadManagerData();
        } else {
            console.error("Failed to mark task as done.");
        }
    } catch (err) {
         console.error("Error calling mark task done API:", err);
    }
}

// ─── Priority Deadlines ─────────────────────────────────────
function renderPriorityDeadlines() {
    if (!priorityDeadlinesList || !managerUrgentBadge) return;

    const critical = teamTasks.filter(t => t.priority === "High" && !isTaskDone(t));
    managerUrgentBadge.textContent = `${critical.length} Critical`;

    if (!critical.length) {
        priorityDeadlinesList.innerHTML = `<p class="empty-state">No critical deadlines pending for the team.</p>`;
        return;
    }

    priorityDeadlinesList.innerHTML = critical.map(task => `
        <div class="deadline-item critical-item">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <h4>${task.text}</h4>
                <span class="priority-pill priority-high">HIGH</span>
            </div>
            <p>Assigned to: <strong>${task.owner}</strong></p>
            <p style="font-size: 13px; opacity: 0.7;">Meeting: ${task.meetingTitle}</p>
        </div>
    `).join("");
}

// ─── Donut Chart ────────────────────────────────────────────
function drawWeeklyTargetChart() {
    const canvas = document.getElementById("weeklyTargetChart");
    const legend = document.getElementById("chartLegend");
    if (!canvas || !legend) return;

    const ctx = canvas.getContext("2d");
    const completed = teamTasks.filter(isTaskDone).length;
    const pending = teamTasks.length - completed;

    const data = teamTasks.length > 0 ? [completed, pending] : [0, 1];
    const total = data.reduce((a, b) => a + b, 0);
    const colors = ["#C9A84C", "rgba(201, 168, 76, 0.15)"];
    const labels = ["Completed", "Pending"];

    let startAngle = -Math.PI / 2; // Start from top
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const outerR = 100;
    const innerR = 70;

    data.forEach((val, i) => {
        const slice = (val / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
        ctx.arc(cx, cy, innerR, startAngle + slice, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
        startAngle += slice;
    });

    // Center text
    const pct = Math.round((completed / (teamTasks.length || 1)) * 100);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 28px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${pct}%`, cx, cy);

    legend.innerHTML = labels.map((label, i) => `
        <div class="legend-item">
            <span class="legend-dot" style="background: ${colors[i]};"></span>
            <span>${label}: ${data[i]}</span>
        </div>
    `).join("");
}

// ─── Helpers ────────────────────────────────────────────────
function isTaskDone(task) {
    const s = String(task.status || "").toLowerCase();
    return s === "done" || s === "completed";
}

// ─── Event Listeners ────────────────────────────────────────
if (employeeFilter) employeeFilter.addEventListener("change", renderTeamTasks);
if (priorityFilter) priorityFilter.addEventListener("change", renderTeamTasks);

// ─── Init ───────────────────────────────────────────────────
loadManagerData();
