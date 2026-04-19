const params = new URLSearchParams(window.location.search);
const id = parseInt(params.get("id"));

const meeting = meetings.find(m => m.id === id);

const container = document.getElementById("meetingDetails");

if (meeting) {
    container.innerHTML = `
        <h2>${meeting.title}</h2>
        <p>${meeting.summary}</p>

        <h3>Tasks</h3>
        <ul>
            ${meeting.tasks.map(t => `<li>${t}</li>`).join("")}
        </ul>

        <h3>Key Notes</h3>
        <ul>
            ${meeting.notes.map(n => `<li>${n}</li>`).join("")}
        </ul>

        <button onclick="download()">Download Detailed Report</button>
    `;
}

function download() {
    alert("Downloading report...");
}