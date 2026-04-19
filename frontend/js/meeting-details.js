const params = new URLSearchParams(window.location.search);
const meetingId = params.get("id"); // Keep as string to match display.json

const detailsTitle = document.getElementById("detailsTitle");
const detailsMeta = document.getElementById("detailsMeta");
const heroMetaRow = document.getElementById("heroMetaRow");
const meetingDetailsContainer = document.getElementById("meetingDetailsContainer");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

async function loadMeetingDetails() {
    let meetings = [];
    try {
        const res = await fetch('http://localhost:5000/api/meeting/display');
        meetings = await res.json();
    } catch (err) {
        console.error("Failed to fetch meeting data:", err);
    }

    const selectedMeeting = meetings.find(meeting => String(meeting.id) === String(meetingId));

    if (!selectedMeeting) {
        detailsTitle.textContent = "Meeting Not Found";
        detailsMeta.textContent = "The meeting you are trying to open does not exist.";
        heroMetaRow.innerHTML = "";
        meetingDetailsContainer.innerHTML = `
            <div class="glass-card content-card">
                <p class="empty-state">No meeting details found for the selected item.</p>
            </div>
        `;
        downloadPdfBtn.style.display = "none";
        return;
    }
    detailsTitle.textContent = selectedMeeting.title;
    detailsMeta.textContent = "Complete meeting intelligence view with summary, tasks, notes, and downloadable report.";

    heroMetaRow.innerHTML = `
        <span class="meta-pill">${selectedMeeting.date}</span>
        <span class="meta-pill">${selectedMeeting.time}</span>
        <span class="meta-pill">${selectedMeeting.tasks.length} Tasks Assigned</span>
        <span class="meta-pill">${selectedMeeting.keyNotes.length} Key Notes</span>
    `;

    meetingDetailsContainer.innerHTML = `
        <section class="details-main-grid">
            <div class="glass-card content-card full-height-card">
                <h3>Brief Summary</h3>
                <p>${selectedMeeting.briefSummary}</p>

                <div class="summary-highlight">
                    <h4>Detailed Summary</h4>
                    <p>${selectedMeeting.detailedSummary}</p>
                </div>
            </div>

            <div class="glass-card content-card full-height-card">
                <h3>Meeting Information</h3>

                <span class="info-card-label">Meeting Title</span>
                <p class="info-card-value">${selectedMeeting.title}</p>

                <span class="info-card-label">Date</span>
                <p class="info-card-value">${selectedMeeting.date}</p>

                <span class="info-card-label">Time</span>
                <p class="info-card-value">${selectedMeeting.time}</p>

                <span class="info-card-label">Total Tasks</span>
                <p class="info-card-value">${selectedMeeting.tasks.length}</p>
            </div>
        </section>

        <section class="details-section-grid">
            <div class="glass-card content-card">
                <h3>Tasks Assigned</h3>
                <div class="table-wrapper">
                    <table class="task-table">
                        <thead>
                            <tr>
                                <th>Person</th>
                                <th>Task</th>
                                <th>Deadline</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedMeeting.tasks.map(task => `
                                <tr>
                                    <td>${task.person}</td>
                                    <td>${task.task}</td>
                                    <td><span class="deadline-pill">${task.deadline}</span></td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="glass-card content-card">
                <h3>Key Notes</h3>
                <ul class="notes-list compact">
                    ${selectedMeeting.keyNotes.map(note => `<li>${note}</li>`).join("")}
                </ul>
            </div>
        </section>
    `;

    downloadPdfBtn.addEventListener("click", function () {
        downloadMeetingPdf(selectedMeeting);
    });
}

function downloadMeetingPdf(meeting) {
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

    doc.save(`${meeting.title.toLowerCase().replace(/\s+/g, "-")}-report.pdf`);
}

loadMeetingDetails();