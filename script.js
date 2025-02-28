document.addEventListener("DOMContentLoaded", function () {
    //  Get form containers
    const loginContainer = document.getElementById("login-container");
    const signupContainer = document.getElementById("signup-container");

    // Switch to SignUp form
    document.getElementById("signup-link").addEventListener("click", function (event) {
        event.preventDefault();
        loginContainer.style.display = "none";
        signupContainer.style.display = "block";
    });

    // Switch back to Login form
    document.getElementById("login-link").addEventListener("click", function (event) {
        event.preventDefault();
        signupContainer.style.display = "none";
        loginContainer.style.display = "block";
    });

    //  Handle Signup Form Submission
    document.getElementById("account-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const userData = {
            name: document.getElementById("full-name").value,
            email: document.getElementById("email").value,
            password: document.getElementById("signup-password").value,
            course: document.getElementById("course").value,
            batch: document.getElementById("batch").value,
            branch: document.getElementById("branch").value,
            skills: document.getElementById("skills").value,
            phone: document.getElementById("phone").value
        };

        try {
            const response = await fetch("http://127.0.0.1:5000/api/signup", {  // Correct API URL
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            if (response.ok) {
                alert(" Signup successful! You can now log in.");
                document.getElementById("account-form").reset();
                signupContainer.style.display = "none";  // Hide Signup form
                loginContainer.style.display = "block";  // Show Login form
            } else {
                alert(" Error: " + data.error);
            }
        } catch (error) {
            alert(" Error connecting to server. Please check your network.");
            console.error("Signup Error:", error);
        }
    });

    //  Handle Login Form Submission
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const loginData = {
            email: document.getElementById("username").value,
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch("http://127.0.0.1:5000/api/login", {  // Correct API URL
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();
            if (response.ok) {
                alert(" Login successful! Redirecting to dashboard...");
                localStorage.setItem("user", JSON.stringify(data.user));  // Store user info
                window.location.href = "details.html";  // Redirect to Dashboard
            } else {
                alert(" Login Failed: " + data.error);
            }
        } catch (error) {
            alert(" Error connecting to server. Please check your network.");
            console.error("Login Error:", error);
        }
    });
});
document.addEventListener("DOMContentLoaded", function () {
    const requestOtpBtn = document.getElementById("request-otp");
    const loginForm = document.getElementById("login-form");
    const otpInput = document.getElementById("otp");
    const loginBtn = document.getElementById("login-btn");

    if (requestOtpBtn) {
        requestOtpBtn.addEventListener("click", async () => {
            const email = document.getElementById("username").value;

            if (!email) {
                alert("Please enter your email.");
                return;
            }

            try {
                const response = await fetch("http://127.0.0.1:5000/api/request-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok) {
                    alert(data.message);
                    otpInput.style.display = "block"; // Show OTP input field
                    loginBtn.style.display = "block"; // Show login button
                } else {
                    alert("Error: " + data.error);
                }
            } catch (error) {
                alert("Network error. Check console for details.");
                console.error("OTP Request Error:", error);
            }
        });
    } else {
        console.error("Error: 'request-otp' button not found.");
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.getElementById("username").value;
            const otp = otpInput.value;

            if (!otp) {
                alert("Please enter the OTP.");
                return;
            }

            try {
                const response = await fetch("http://127.0.0.1:5000/api/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, otp })
                });

                const data = await response.json();

                if (response.ok) {
                    alert(data.message);
                    window.location.href = "details.html"; // Redirect after login
                } else {
                    alert("Error: " + data.error);
                }
            } catch (error) {
                alert("Network error. Check console for details.");
                console.error("OTP Verification Error:", error);
            }
        });
    }
});