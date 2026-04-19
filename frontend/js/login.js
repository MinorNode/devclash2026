// login.js — Client-side authentication using employee.json data

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

// If already logged in, skip to dashboard
const existingUser = localStorage.getItem("meettrack_user");
if (existingUser) {
    window.location.href = "index.html";
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    loginError.textContent = "";

    const email = loginEmail.value.trim().toLowerCase();
    const password = loginPassword.value;

    if (!email || !password) {
        showError("Please fill in both fields.");
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/meeting/employees");
        if (!res.ok) {
            showError("Unable to reach the server. Please try again.");
            return;
        }

        const employees = await res.json();

        // Find employee by email (case-insensitive)
        const employee = employees.find(emp => emp.email.toLowerCase() === email);

        if (!employee) {
            showError("No account found with this email.");
            return;
        }

        // Compare password as-is (plain text)
        if (employee.password !== password) {
            showError("Incorrect password. Please try again.");
            return;
        }

        // Auth success — store session
        const session = {
            name: employee.name,
            email: employee.email,
            role: employee.role,
            aliases: employee.aliases || []
        };

        localStorage.setItem("meettrack_user", JSON.stringify(session));

        // Redirect to dashboard
        window.location.href = "index.html";

    } catch (err) {
        console.error("Login error:", err);
        showError("Connection failed. Is the backend running?");
    }
});

function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
}
