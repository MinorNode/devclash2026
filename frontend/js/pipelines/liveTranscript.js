let transcript = "";

// Target the pre-built panel elements in index.html
const panelEl = document.getElementById("transcriptPanel");
const bodyEl = document.getElementById("transcriptPanelBody");

export function showPanel() {
  if (panelEl) {
    panelEl.classList.remove("hidden");
    document.body.classList.add("transcript-open");
  }
}

export function hidePanel() {
  if (panelEl) {
    panelEl.classList.add("hidden");
    document.body.classList.remove("transcript-open");
  }
}

export function appendText(text) {
  transcript += text + "\n";
  if (!bodyEl) return;

  // Show panel on first text
  showPanel();

  const line = document.createElement("div");
  line.className = "transcript-line";
  line.textContent = text;
  bodyEl.appendChild(line);

  // Auto-scroll to bottom
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

export function getTranscript() {
  return transcript;
}

export function resetTranscript() {
  transcript = "";
  if (bodyEl) {
    bodyEl.innerHTML = "";
  }
}
