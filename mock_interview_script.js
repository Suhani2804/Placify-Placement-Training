let questions = [];
let currentIndex = -1;
let answeredCount = 0;
let mediaRecorder;
let recordedChunks = [];
let videoBlob;
let videoPlayback = document.getElementById("videoPlayback");
let liveVideo = document.getElementById("liveVideo");
let timerElement = document.getElementById("timer");
let timerInterval;
let stream;

async function fetchQuestions() {
    try {
        console.log("Fetching questions...");
        const response = await fetch("http://127.0.0.1:5000/api/mock_questions");
        questions = await response.json();

        console.log("Fetched questions:", questions);

        if (questions.length > 0) {
            document.getElementById("start").disabled = false;
        } else {
            document.getElementById("question").textContent = "No questions available.";
        }
    } catch (error) {
        console.error("Error fetching questions:", error);
        document.getElementById("question").textContent = "Failed to load questions.";
    }
}

document.getElementById("start").addEventListener("click", async () => {
    console.log("Start button clicked.");

    if (questions.length === 0) {
        console.log("Fetching questions again...");
        await fetchQuestions();
    }

    if (questions.length > 0) {
        currentIndex = 0;
        loadQuestion();
        document.getElementById("start").disabled = true;
        document.getElementById("skip").disabled = false;
        document.getElementById("submit").disabled = false;
        document.getElementById("startRecording").disabled = false;

        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        liveVideo.srcObject = stream;
        liveVideo.muted = true;
        liveVideo.hidden = false;
        videoPlayback.hidden = true;
    } else {
        console.error("No questions available even after fetching.");
    }
});

document.getElementById("skip").addEventListener("click", () => {
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        loadQuestion();
    } else {
        endInterview();
    }
});

document.getElementById("submit").addEventListener("click", () => {
    answeredCount++;
    updateProgress();

    if (answeredCount >= 10 || currentIndex >= questions.length - 1) {
        endInterview();
    } else {
        currentIndex++;
        loadQuestion();
    }
});

function loadQuestion() {
    if (currentIndex >= 0 && currentIndex < questions.length) {
        console.log(`Loading question ${currentIndex + 1}:`, questions[currentIndex]);
        document.getElementById("question").textContent = questions[currentIndex].question;
    } else {
        console.error("Invalid question index.");
    }
}

function updateProgress() {
    document.getElementById("progress").textContent = `Questions Answered: ${answeredCount}/10`;
}

function endInterview() {
    document.getElementById("feedback").innerHTML = `<strong>Interview Completed!</strong> <br> Review your recorded videos for feedback.`;
    document.getElementById("skip").disabled = true;
    document.getElementById("submit").disabled = true;
}

document.getElementById("startRecording").addEventListener("click", async () => {
    if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        liveVideo.srcObject = stream;
        liveVideo.muted = true;
    }

    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
        videoBlob = new Blob(recordedChunks, { type: "video/webm" });
        const videoURL = URL.createObjectURL(videoBlob);
        videoPlayback.src = videoURL;

        liveVideo.hidden = true;
        videoPlayback.hidden = false;
        document.getElementById("saveVideo").hidden = false;
    };

    mediaRecorder.start();
    startTimer();
    document.getElementById("stopRecording").disabled = false;
    document.getElementById("startRecording").disabled = true;
});

document.getElementById("stopRecording").addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        clearInterval(timerInterval);
        timerElement.textContent = "";
    }
    document.getElementById("startRecording").disabled = false;
    document.getElementById("stopRecording").disabled = true;
});

document.getElementById("saveVideo").addEventListener("click", () => {
    if (videoBlob) {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, "_");
        const filename = `mock_interview_${timestamp}.webm`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(videoBlob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

function startTimer() {
    let timeLeft = 60;
    timerElement.textContent = `Recording... ${timeLeft}s`;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = `Recording... ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            mediaRecorder.stop();
            document.getElementById("stopRecording").disabled = true;
        }
    }, 1000);
}

fetchQuestions();
