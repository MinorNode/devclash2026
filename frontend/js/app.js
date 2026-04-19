const recentSummaryCard = document.getElementById("recentSummaryCard");
const recentTasksBody = document.getElementById("recentTasksBody");
const recentNotesList = document.getElementById("recentNotesList");
const taskCountBadge = document.getElementById("taskCountBadge");
const notesCountBadge = document.getElementById("notesCountBadge");

const openPastMeetingsModal = document.getElementById("openPastMeetingsModal");
const closePastMeetingsModal = document.getElementById("closePastMeetingsModal");
const pastMeetingsModal = document.getElementById("pastMeetingsModal");
const pastMeetingsList = document.getElementById("pastMeetingsList");

let latestMeeting = null;
let meetings = [];
let recentMeeting = null;
let pastMeetings = [];

// Fetch live data from backend
async function loadMeetingData() {
    try {
        const res = await fetch('http://localhost:5000/api/meeting/display');
        const data = await res.json();
        if (data && data.length > 0) {
            meetings = data;
            recentMeeting = data[data.length - 1]; // latest meeting
            pastMeetings = data;
        }
    } catch (err) {
        console.error("Failed to fetch meeting data:", err);
    }
    renderRecentMeeting();
    renderPastMeetings();
}

function renderRecentMeeting() {
    if (!recentSummaryCard || !recentTasksBody || !recentNotesList || !taskCountBadge || !notesCountBadge) {
        console.error("Required elements for index page are missing.");
        return;
    }

    if (!recentMeeting) {
        recentSummaryCard.innerHTML = `
            <div class="summary-top">
                <h3>No Recent Meeting</h3>
                <div class="summary-block">
                    <h4>Brief Summary</h4>
                    <p>No recent meeting data available right now.</p>
                </div>
            </div>
        `;

        recentTasksBody.innerHTML = `
            <tr>
                <td colspan="3">No tasks available.</td>
            </tr>
        `;

        recentNotesList.innerHTML = `<li>No notes available.</li>`;
        taskCountBadge.textContent = "0 Tasks";
        notesCountBadge.textContent = "0 Notes";
        return;
    }

    recentSummaryCard.innerHTML = `
        <div class="summary-top">
            <div>
                <h3>${recentMeeting.title}</h3>

                <div class="meeting-meta">
                    <span class="meta-pill">${recentMeeting.date}</span>
                    <span class="meta-pill">${recentMeeting.time}</span>
                </div>
            </div>

            <div class="summary-block">
                <h4>Brief Summary</h4>
                <p>${recentMeeting.briefSummary}</p>
            </div>
        </div>

        <div class="summary-actions">
            <button class="primary-btn" type="button" onclick="downloadSummary(${recentMeeting.id})">
                Download Detailed Summary
            </button>
            <button class="secondary-btn" type="button" onclick="openMeetingPage(${recentMeeting.id})">
                Open Full Meeting Details
            </button>
        </div>
    `;

    taskCountBadge.textContent = `${recentMeeting.tasks.length} Tasks`;
    notesCountBadge.textContent = `${recentMeeting.keyNotes.length} Notes`;

    recentTasksBody.innerHTML = recentMeeting.tasks.map(task => `
        <tr>
            <td>${task.person}</td>
            <td>${task.task}</td>
            <td><span class="deadline-pill">${task.deadline}</span></td>
        </tr>
    `).join("");

    recentNotesList.innerHTML = recentMeeting.keyNotes.map(note => `
        <li>${note}</li>
    `).join("");
}

function renderPastMeetings() {
    if (!pastMeetingsList) {
        console.error("Past meetings modal list element is missing.");
        return;
    }

    if (!pastMeetings.length) {
        pastMeetingsList.innerHTML = `<p class="empty-state">No past meetings available right now.</p>`;
        return;
    }

    pastMeetingsList.innerHTML = pastMeetings.map(meeting => `
        <div class="meeting-list-item" onclick="openMeetingPage(${meeting.id})">
            <h4>${meeting.title}</h4>
            <div class="meeting-list-meta">
                <span>${meeting.date}</span>
                <span>${meeting.time}</span>
            </div>
        </div>
    `).join("");
}

function openMeetingPage(id) {
    window.location.href = `meeting-details.html?id=${id}`;
}

function downloadSummary(id) {
    const meeting = typeof meetings !== "undefined"
        ? meetings.find(item => item.id === id)
        : null;

    if (!meeting) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 16;
    let y = 20;

    function ensurePageSpace(requiredSpace = 12) {
        if (y + requiredSpace > pageHeight - 20) {
            doc.addPage();
            y = 20;
        }
    }

    function addLine(text, size = 12, gap = 8) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(text, pageWidth - left * 2);

        lines.forEach(line => {
            ensurePageSpace(8);
            doc.text(line, left, y);
            y += 7;
        });

        y += gap;
    }

    function addHeading(text) {
        ensurePageSpace(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(text, left, y);
        y += 10;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(meeting.title, left, y);
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Date: ${meeting.date}`, left, y);
    y += 7;
    doc.text(`Time: ${meeting.time}`, left, y);
    y += 12;

    addHeading("Brief Summary");
    addLine(meeting.briefSummary);

    addHeading("Detailed Summary");
    addLine(meeting.detailedSummary);

    addHeading("Tasks Assigned");
    meeting.tasks.forEach((task, index) => {
        addLine(`${index + 1}. ${task.person} - ${task.task} - Deadline: ${task.deadline}`, 11, 4);
    });

    addHeading("Key Notes");
    meeting.keyNotes.forEach((note, index) => {
        addLine(`${index + 1}. ${note}`, 11, 4);
    });

    const fileName = `${meeting.title.toLowerCase().replace(/\s+/g, "-")}-summary.pdf`;
    doc.save(fileName);
}

function openModal() {
    if (!pastMeetingsModal) return;
    pastMeetingsModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    if (!pastMeetingsModal) return;
    pastMeetingsModal.classList.add("hidden");
    document.body.style.overflow = "auto";
}

if (openPastMeetingsModal) {
    openPastMeetingsModal.addEventListener("click", openModal);
}

if (closePastMeetingsModal) {
    closePastMeetingsModal.addEventListener("click", closeModal);
}

if (pastMeetingsModal) {
    pastMeetingsModal.addEventListener("click", function (event) {
        if (event.target === pastMeetingsModal) {
            closeModal();
        }
    });
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && pastMeetingsModal && !pastMeetingsModal.classList.contains("hidden")) {
        closeModal();
    }
});

loadMeetingData();