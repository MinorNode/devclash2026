window.onerror = function(msg, url, line, col, error) {
  console.error("[GLOBAL ERROR]", msg, error);
};

import MicPipeline from './pipelines/micPipeline.js'
import TabPipeline from './pipelines/tabPipeline.js'
import { appendText, getTranscript, resetTranscript, showPanel, hidePanel } from './pipelines/liveTranscript.js'

let micPipeline = null;
let tabPipeline = null;
let previousTranscript = "";

// Global references for UI elements
let startMeetingBtn, stopMeetingBtn, meetingTimerContainer, meetingTimerDisplay;
let dashboardUserTitle, dashboardSubtitle, statsGrid, allTasksTableBody, urgentTasksList, urgentCountBadge, recentMeetingsOverview;
let openDashboardPastMeetingsModal, closeDashboardPastMeetingsModal, dashboardPastMeetingsModal, dashboardPastMeetingsList;

// Auth guard — read logged-in user from localStorage
const sessionData = localStorage.getItem("meettrack_user");
if (!sessionData) {
    window.location.href = "login.html";
}
const currentUser = sessionData ? JSON.parse(sessionData) : { name: "", aliases: [] };
let meetings = [];
let userTasks = [];

// Fetch display.json from backend and populate dashboard
async function loadDashboardData() {
    try {
        const res = await fetch('http://localhost:5000/api/meeting/display');
        const data = await res.json();
        if (data && data.length > 0) {
            meetings = data;
            // Flatten tasks from all meetings, filter to current user only
            userTasks = [];
            data.forEach(meeting => {
                if (meeting.tasks && meeting.tasks.length) {
                    meeting.tasks.forEach(task => {
                        const taskPerson = (task.person || "").toLowerCase();
                        const userName = currentUser.name.toLowerCase();
                        const userAliases = (currentUser.aliases || []).map(a => a.toLowerCase());
                        const allNames = [userName, ...userAliases];
                        
                        if (taskPerson && allNames.includes(taskPerson)) {
                            userTasks.push({
                                ...task,
                                meetingTitle: meeting.title,
                                meetingId: meeting.id,
                                status: task.status || "Pending"
                            });
                        }
                    });
                }
            });
        }
    } catch (err) {
        console.error("Failed to load dashboard data:", err);
    }
    renderStats();
    renderAllTasks();
    renderUrgentTasks();
    renderMeetingOverview();
    renderPastMeetingsModalList();
}

let timerInterval = null;
let videoFrameInterval = null;
let secondsElapsed = 0;

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getPendingTasks(tasks) {
    return tasks.filter(task => (task.status || "Pending").toLowerCase() !== "done");
}

function getDoneTasks(tasks) {
    return tasks.filter(task => (task.status || "Pending").toLowerCase() === "done");
}

function getUrgentTasks(tasks) {
    // Dynamic: today and tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const urgentDates = [today, tomorrow].map(d =>
        d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    );
    return tasks.filter(task => urgentDates.includes(task.deadline) && (task.status || "Pending").toLowerCase() !== "done");
}

function renderStats() {
    const totalMeetings = meetings.length;
    const totalTasks = userTasks.length;
    const pendingTasks = getPendingTasks(userTasks).length;
    const completedTasks = getDoneTasks(userTasks).length;

    const stats = [
        { title: "Total Meetings", value: totalMeetings },
        { title: "Your Total Tasks", value: totalTasks },
        { title: "Pending Tasks", value: pendingTasks },
        { title: "Completed Tasks", value: completedTasks }
    ];

    if (statsGrid) {
        statsGrid.innerHTML = stats.map(stat => `
            <div class="glass-card stat-card">
                <p class="stat-title">${stat.title}</p>
                <h3 class="stat-value">${stat.value}</h3>
            </div>
        `).join("");
    }
}

function renderAllTasks() {
    if (!allTasksTableBody) return;
    if (!userTasks.length) {
        allTasksTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-table-cell">No tasks assigned yet.</td>
            </tr>
        `;
        return;
    }

    allTasksTableBody.innerHTML = userTasks.map(task => {
        const isDone = task.status.toLowerCase() === "done";
        const safeTaskText = task.task.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const btnHtml = isDone ? "" : `<button class="secondary-btn" style="padding: 4px 10px; font-size: 12px;" onclick="window.markTaskDone('${task.meetingId}', '${safeTaskText}')">Mark Done</button>`;

        return `
        <tr>
            <td>${task.meetingTitle}</td>
            <td>${task.task}</td>
            <td><span class="deadline-pill">${task.deadline}</span></td>
            <td style="display: flex; align-items: center; gap: 10px;">
                <span class="${isDone ? "status-pill status-done" : "status-pill status-pending"}">
                    ${task.status}
                </span>
                ${btnHtml}
            </td>
        </tr>
    `}).join("");
}

window.markTaskDone = async function(meetingId, taskText) {
    try {
        // Un-escape the text we originally escaped for HTML
        const actualText = taskText.replace(/&quot;/g, '"');
        const res = await fetch('http://localhost:5000/api/meeting/task/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId, taskText: actualText, status: "Done" })
        });
        
        if (res.ok) {
            // Instantly reload all local tables
            await loadDashboardData();
        } else {
            console.error("Failed to mark task as done.");
        }
    } catch (err) {
         console.error("Error calling mark task done API:", err);
    }
}

function renderUrgentTasks() {
    if (!urgentTasksList || !urgentCountBadge) return;
    const urgentTasks = getUrgentTasks(userTasks);
    urgentCountBadge.textContent = `${urgentTasks.length} Urgent`;

    if (!urgentTasks.length) {
        urgentTasksList.innerHTML = `<p class="empty-state">No urgent deadlines right now.</p>`;
        return;
    }

    urgentTasksList.innerHTML = urgentTasks.map(task => `
        <div class="deadline-item">
            <h4>${task.task}</h4>
            <p>${task.meetingTitle}</p>
            <span class="deadline-pill">${task.deadline}</span>
        </div>
    `).join("");
}

function renderMeetingOverview() {
    if (!recentMeetingsOverview) return;
    recentMeetingsOverview.innerHTML = meetings.map(meeting => `
        <div class="glass-card overview-card" onclick="openMeetingPage(${meeting.id})">
            <div class="card-heading-row">
                <h3>${meeting.title}</h3>
            </div>
            <div class="meeting-list-meta">
                <span>${meeting.date}</span>
                <span>${meeting.time}</span>
            </div>
            <p class="overview-text">${meeting.briefSummary}</p>
        </div>
    `).join("");
}

function renderPastMeetingsModalList() {
    if (!dashboardPastMeetingsList) return;
    dashboardPastMeetingsList.innerHTML = meetings.map(meeting => `
        <div class="meeting-list-item" onclick="openMeetingPage(${meeting.id})">
            <h4>${meeting.title}</h4>
            <div class="meeting-list-meta">
                <span>${meeting.date}</span>
                <span>${meeting.time}</span>
            </div>
        </div>
    `).join("");
}

// Make globally accessible for HTML onclick attributes
window.openMeetingPage = function(id) {
    window.location.href = `meeting-details.html?id=${id}`;
}

function openModal() {
    if (dashboardPastMeetingsModal) {
        dashboardPastMeetingsModal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }
}

function closeModal() {
    if (dashboardPastMeetingsModal) {
        dashboardPastMeetingsModal.classList.add("hidden");
        document.body.style.overflow = "auto";
    }
}

async function startMeetingAssistant() {
    if (!startMeetingBtn || !stopMeetingBtn || !meetingTimerContainer) {
        console.error("[ERROR] UI elements not found for meeting assistant");
        return;
    }

    console.log("[DEBUG] Start button clicked");

    try {
        console.log("[DEBUG] entering startMeetingAssistant");
        resetTranscript();
        previousTranscript = "";
        micPipeline = new MicPipeline();

        micPipeline.setChunkCallback(async (blob) => {
            const liveBlob = micPipeline.getLiveBlob()
            const formData = new FormData()
            formData.append('audio', liveBlob)

            try {
                const res = await fetch('http://localhost:5000/api/stt', {
                    method: 'POST',
                    body: formData
                })

                const data = await res.json()
                const newText = data.text || ""

                console.log("------ STT RESPONSE ------")
                console.log("Previous:", previousTranscript)
                console.log("New:", newText)

                // find overlap
                let overlap = ""
                for (let i = 0; i < previousTranscript.length; i++) {
                    const substr = previousTranscript.slice(i)
                    if (newText.startsWith(substr)) {
                        overlap = substr
                        break
                    }
                }

                const newPart = newText.slice(overlap.length)
                console.log("Overlap:", overlap)
                console.log("New Part:", newPart)

                previousTranscript = newText

                if (data.text) {
                    appendText(data.text)
                }
            } catch (err) {
                console.error("Live STT capture error:", err);
            }
        });

        await micPipeline.start();
        console.log("[DEBUG] Mic started");
        showPanel();

        // Start Tab Capture
        tabPipeline = new TabPipeline();
        tabPipeline.setChunkCallback(async (blob) => {
            const formData = new FormData();
            formData.append('video', blob);
            formData.append('label', 'tab_chunk');

            try {
                await fetch('http://localhost:5000/api/meeting/video', {
                    method: 'POST',
                    body: formData
                });
            } catch (err) {
                console.error("Tab chunk transfer error:", err);
            }
        });

        await tabPipeline.start();
        console.log("[DEBUG] Tab capture started");

        // UI Updates
        startMeetingBtn.classList.add("hidden");
        stopMeetingBtn.classList.remove("hidden");
        meetingTimerContainer.classList.remove("hidden");

        secondsElapsed = 0;
        meetingTimerDisplay.textContent = "00:00";

        timerInterval = setInterval(() => {
            secondsElapsed++;
            meetingTimerDisplay.textContent = formatTime(secondsElapsed);
        }, 1000);

        console.log("Meeting capture started successfully");

    } catch (err) {
        console.error("Failed to start meeting assistant:", err);
        alert(err || "Permissions required to start the assistant.");
        stopMeetingAssistant();
    }
}

async function stopMeetingAssistant() {
    if (micPipeline) {
        micPipeline.stop();
        
        if (tabPipeline) tabPipeline.stop();
        
        // Show processing status
        resetTranscript();
        appendText("Processing final transcript...");

        try {
            const fullMicBlob = micPipeline.getFullAudioBlob();
            const fullWebBlob = tabPipeline ? tabPipeline.getFullVideoBlob() : null;

            console.log("[DEBUG] Starting dual STT processing...");
            
            // 1. Mic STT
            const micFormData = new FormData();
            micFormData.append('audio', fullMicBlob);
            const micRes = await fetch('http://localhost:5000/api/stt', {
                method: 'POST',
                body: micFormData
            });
            const micData = await micRes.json();
            const micTranscript = micData.text || "";

            // 2. Web STT (Optional)
            let webTranscript = "";
            if (fullWebBlob) {
                console.log("[DEBUG] Processing Web STT...");
                const webFormData = new FormData();
                webFormData.append('audio', fullWebBlob);
                const webRes = await fetch('http://localhost:5000/api/stt', {
                    method: 'POST',
                    body: webFormData
                });
                const webData = await webRes.json();
                webTranscript = webData.text || "";
            }

            resetTranscript();
            if (micTranscript || webTranscript) {
                const combinedTranscript = `[MIC]: ${micTranscript}\n\n[WEB]: ${webTranscript}`;
                appendText(combinedTranscript);
                
                // --- Save Meeting Data (New Schema) ---
                console.log("[DEBUG] Saving meeting data to local storage (Dual Schema)...");
                await fetch('http://localhost:5000/api/meeting/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: `Meeting - ${new Date().toLocaleDateString()}`,
                        micSst: micTranscript,
                        webSst: webTranscript
                    })
                });
                console.log("[DEBUG] Meeting saved successfully");

                // Clear Intervals & Reset UI before navigating
                if (timerInterval) clearInterval(timerInterval);
                if (startMeetingBtn) startMeetingBtn.classList.remove("hidden");
                if (stopMeetingBtn) stopMeetingBtn.classList.add("hidden");
                if (meetingTimerContainer) meetingTimerContainer.classList.add("hidden");

                // Hide transcript panel and navigate to summary page AFTER save completes
                hidePanel();
                window.location.href = "meeting-summary.html";
                return;

            } else {
                appendText("[No transcription returned]");
            }

        } catch (err) {
            console.error("Final STT error:", err);
            appendText("Error: Transcription failed.");
        }
    }

    // Clear Intervals (fallback for error/no-transcript cases)
    if (timerInterval) clearInterval(timerInterval);

    // Reset UI
    if (startMeetingBtn) startMeetingBtn.classList.remove("hidden");
    if (stopMeetingBtn) stopMeetingBtn.classList.add("hidden");
    if (meetingTimerContainer) meetingTimerContainer.classList.add("hidden");
}

// Initialization and Event Binding
document.addEventListener("DOMContentLoaded", () => {
    dashboardUserTitle = document.getElementById("dashboardUserTitle");
    dashboardSubtitle = document.getElementById("dashboardSubtitle");
    statsGrid = document.getElementById("statsGrid");
    allTasksTableBody = document.getElementById("allTasksTableBody");
    urgentTasksList = document.getElementById("urgentTasksList");
    urgentCountBadge = document.getElementById("urgentCountBadge");
    recentMeetingsOverview = document.getElementById("recentMeetingsOverview");

    openDashboardPastMeetingsModal = document.getElementById("openDashboardPastMeetingsModal");
    closeDashboardPastMeetingsModal = document.getElementById("closeDashboardPastMeetingsModal");
    dashboardPastMeetingsModal = document.getElementById("dashboardPastMeetingsModal");
    dashboardPastMeetingsList = document.getElementById("dashboardPastMeetingsList");

    startMeetingBtn = document.getElementById("startMeetingBtn");
    stopMeetingBtn = document.getElementById("stopMeetingBtn");
    meetingTimerContainer = document.getElementById("meetingTimerContainer");
    meetingTimerDisplay = document.getElementById("meetingTimer");

    if (dashboardUserTitle) dashboardUserTitle.textContent = `Welcome, ${currentUser.name}`;
    if (dashboardSubtitle) dashboardSubtitle.textContent = `Your personal meeting workspace with tasks, deadlines, and meeting history.`;

    // Hide Manager View button for non-managers
    const managerViewBtn = document.getElementById("managerViewBtn");
    if (managerViewBtn && currentUser.role !== "manager") {
        managerViewBtn.style.display = "none";
    }

    // Logout handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("meettrack_user");
            window.location.href = "login.html";
        });
    }

    if (openDashboardPastMeetingsModal) openDashboardPastMeetingsModal.addEventListener("click", openModal);
    if (closeDashboardPastMeetingsModal) closeDashboardPastMeetingsModal.addEventListener("click", closeModal);

    if (dashboardPastMeetingsModal) {
        dashboardPastMeetingsModal.addEventListener("click", function (event) {
            if (event.target === dashboardPastMeetingsModal) {
                closeModal();
            }
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && dashboardPastMeetingsModal && !dashboardPastMeetingsModal.classList.contains("hidden")) {
            closeModal();
        }
    });

    if (startMeetingBtn) startMeetingBtn.addEventListener("click", startMeetingAssistant);
    if (stopMeetingBtn) stopMeetingBtn.addEventListener("click", stopMeetingAssistant);

    loadDashboardData();
});