
let questions = [];
let currentIndex = -1;
let answeredCount = 0;
let mediaRecorder;
let recordedChunks = [];
let videoBlob;
let liveVideo = document.getElementById("liveVideo");
let timerElement = document.getElementById("timer");
let timerInterval;
let stream;
let postureStatus = document.getElementById("posture-status");
let sentimentText = document.getElementById("sentimentText");
let faceCanvas = document.getElementById("faceCanvas");
let faceCtx = faceCanvas.getContext("2d");
faceCanvas.width = 240;
faceCanvas.height = 240;

// ✅ Initialize Camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        liveVideo.srcObject = stream;
    } catch (error) {
        console.error("❌ Camera access denied:", error);
    }
}

// ✅ Initialize MediaPipe FaceMesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
faceMesh.onResults(processFaceData);

// ✅ Start FaceMesh Detection Loop
async function detectLoop() {
    if (liveVideo.readyState >= 2) {
        await faceMesh.send({ image: liveVideo });
    }
    requestAnimationFrame(detectLoop);
}

// ✅ Process Face Data (Posture & Sentiment)
function processFaceData(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
     // Clear previous drawings
     faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);

     const landmarks = results.multiFaceLandmarks[0];
     drawFaceLandmarks(landmarks);  // 🎯 Draw the dotted face UI
    analyzePosture(landmarks);
    analyzeSentiment(landmarks);
}
function drawFaceLandmarks(landmarks) {
    faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    faceCtx.fillStyle = "red";

    landmarks.forEach(({ x, y }) => {
        faceCtx.beginPath();
        faceCtx.arc(x * faceCanvas.width * 1.1, y * faceCanvas.height * 1.1, 1.5, 0, 2 * Math.PI);
        faceCtx.fill();
    });
}


// ✅ Posture Analysis
function analyzePosture(landmarks) {
    const leftEarY = landmarks[234].y;
    const rightEarY = landmarks[454].y;
    const headTilt = Math.abs(leftEarY - rightEarY);

    if (headTilt > 0.04) {
        postureStatus.innerHTML = `Posture: <span style="color:red;">Incorrect (Head Tilted)</span>`;
    } else {
        postureStatus.innerHTML = `Posture: <span style="color:green;">Correct</span>`;
    }
}

function generateAIStyleFeedback(posture, sentiment, questionText) {
    let feedback = "";

    // Base
    feedback += `For the question: "${questionText}", `;

    // Posture feedback
    if (posture.includes("Correct")) {
        feedback += "your posture looked confident. ";
    } else {
        feedback += "your posture could be improved — try keeping your head level. ";
    }

    // Sentiment feedback
    if (sentiment.includes("Happy")) {
        feedback += "You appeared positive, which is great! ";
    } else if (sentiment.includes("Neutral")) {
        feedback += "Your expression was neutral — a little more enthusiasm could help! ";
    } else if (sentiment.includes("Sad") || sentiment.includes("Angry")) {
        feedback += "Your expression seemed tense — try to stay relaxed and smile more. ";
    }

    // Bonus tip
    feedback += "Make sure to structure your answers clearly — intro, body, and conclusion.";

    return feedback;
}
function generateSmartFeedback(postureText, sentimentText, questionText) {
    function parseFeedbackTraits(postureText, sentimentText) {
        const posture = postureText.toLowerCase().includes("correct") ? "good" : "poor";
        const sentiment = sentimentText.toLowerCase().match(/happy|neutral|sad|angry|surprised/i)?.[0] || "neutral";
        return { posture, sentiment };
    }

    const { posture, sentiment } = parseFeedbackTraits(postureText, sentimentText);

    const opening = [
        `🧠 For the question: "${questionText}", here's how you came across:`,
        `📋 Evaluating your response to: "${questionText}"...`,
        `🎤 Feedback on: "${questionText}":`,
    ];

    const postureFeedback = {
        good: [
            "✅ Your posture was composed and steady — very professional.",
            "💪 You held yourself with confidence — strong physical presence.",
            "🎯 Your body language reinforced credibility. Great job!"
        ],
        poor: [
            "⚠️ Your posture suggested some discomfort — try to square your shoulders.",
            "🧍‍♂️ A slight tilt can hint at hesitation. Try maintaining alignment with the camera.",
            "📉 Your physical presence lacked stability — posture affects perception!"
        ]
    };

    const sentimentFeedback = {
        happy: [
            "😊 You smiled — that added charm and warmth to your response.",
            "🌟 Your enthusiasm was contagious — great energy!",
            "😄 Positivity was clearly visible, and it worked in your favor."
        ],
        neutral: [
            "😐 Neutral tone — safe, but you could add a bit more personality.",
            "🧊 You stayed composed, but injecting a smile might create better engagement.",
            "😶 Controlled expression, though a dash of warmth would go a long way."
        ],
        sad: [
            "😔 You looked a bit down — try to appear more open and upbeat.",
            "📉 Your facial cues suggested low confidence. Remember, energy matters!",
            "🫥 You seemed distant — maybe nerves? Practice can help you open up."
        ],
        angry: [
            "😠 A tense expression can be misread — try to soften your facial tone.",
            "⚡ Intensity was high — balance assertiveness with calm.",
            "🔥 Confidence is good, but don't let it tip into defensiveness."
        ],
        surprised: [
            "😲 You seemed caught off-guard — prep for unexpected questions.",
            "❗ Sudden expressions can break flow — breathe and take your time.",
            "🤯 Looks like that one surprised you — stay composed, even under pressure."
        ]
    };

    const closingTips = [
        "🧠 Tip: Use the STAR method to structure your answers — it adds clarity.",
        "🎓 Pro tip: Pause before responding — it shows thoughtfulness.",
        "🔁 Practice transitions between thoughts — it makes your delivery smoother."
    ];

    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

    return `${random(opening)}\n\n${random(postureFeedback[posture])}\n${random(sentimentFeedback[sentiment])}\n\n${random(closingTips)}`;
}


// ✅ Sentiment Analysis
function analyzeSentiment(landmarks) {
    if (!sentimentText) return;

    const leftEyebrow = landmarks[70].y;
    const rightEyebrow = landmarks[300].y;
    const leftEye = landmarks[159].y;
    const rightEye = landmarks[386].y;
    const mouthTop = landmarks[13].y;
    const mouthBottom = landmarks[14].y;
    const mouthLeft = landmarks[61].x;
    const mouthRight = landmarks[291].x;

    const faceHeight = Math.abs(landmarks[10].y - landmarks[152].y);
    const faceWidth = Math.abs(landmarks[234].x - landmarks[454].x);

    const eyebrowRaise = Math.abs(leftEyebrow - rightEyebrow) / faceHeight;
    const eyeOpen = Math.abs(leftEye - rightEye) / faceHeight;
    const mouthOpen = Math.abs(mouthBottom - mouthTop) / faceHeight;
    const smileWidth = Math.abs(mouthRight - mouthLeft) / faceWidth;

    let sentiment = "Neutral";

    if (mouthOpen > 0.06 && eyebrowRaise > 0.02 && eyeOpen > 0.04) {
        sentiment = "Surprised";
    } else if (eyebrowRaise < 0.015 && mouthOpen < 0.02 && eyeOpen < 0.02) {
        sentiment = "Angry";
    } else if (smileWidth > 0.3 && mouthOpen > 0.02) {
        sentiment = "Happy";
    } else if (mouthOpen < 0.02 && eyeOpen < 0.015 && eyebrowRaise < 0.01) {
        sentiment = "Sad";
    }

    sentimentText.innerHTML = `Sentiment: <span style="color:${getSentimentColor(sentiment)};">${sentiment}</span>`;
    
}

// ✅ Get Sentiment Color
function getSentimentColor(sentiment) {
    return sentiment === "Happy" ? "green" : sentiment === "Neutral" ? "blue" : "red";
}

// ✅ Fetch Questions
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

// ✅ Start Interview
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
        
    } else {
        console.error("No questions available even after fetching.");
    }
    await startCamera();
    detectLoop();
});
document.getElementById("skip").addEventListener("click", () => {
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        loadQuestion();
    } else {
        endInterview();
    }
});

// ✅ Start Recording
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
      

        liveVideo.hidden = true;
        document.getElementById("saveVideo").hidden = false;
        document.getElementById("submit").disabled = false; // ✅ Re-enable submit here
    };

    mediaRecorder.start();
    startTimer();
    document.getElementById("stopRecording").disabled = false;
    document.getElementById("startRecording").disabled = true;
});


// ✅ Stop Recording
document.getElementById("stopRecording").addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        clearInterval(timerInterval);
        timerElement.textContent = "";
    }
    document.getElementById("startRecording").disabled = false;
    document.getElementById("stopRecording").disabled = true;
});

// save video 
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



// ✅ Submit Answer
document.getElementById("submit").addEventListener("click", () => {
    if (!videoBlob) {
        alert("No recorded video found!");
        return;
    }

    const formData = new FormData();
    formData.append("video", videoBlob, `mock_interview_${Date.now()}.webm`);
    formData.append("posture_data", postureStatus.textContent);
    formData.append("sentiment_score", sentimentText.textContent);

    answeredCount++;
    document.getElementById("progress").textContent = `Questions Answered: ${answeredCount}/10`;
    document.getElementById("progressBar").style.width = `${(answeredCount / 10) * 100}%`;

   

// ✅ Show feedback to the user
const postureFeedback = postureStatus.textContent.replace("Posture: ", "");
const sentimentFeedback = sentimentText.textContent.replace("Sentiment: ", "");
const aiFeedback = generateSmartFeedback(postureFeedback, sentimentFeedback, questions[currentIndex].question);
document.getElementById("feedback").textContent = `💬 ${aiFeedback}`;

// ✅ Wait a moment before moving to next question
setTimeout(() => {
    resetForNextQuestion();
    document.getElementById("feedback").textContent = ""; // Clear feedback after transition
}, 3000);


    fetch("http://127.0.0.1:5000/api/upload_video", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("Upload success:", data);

        // ✅ Allow user to download video
        let downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(videoBlob);
        downloadLink.download = `mock_interview_${Date.now()}.webm`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setTimeout(() => {
            resetForNextQuestion();
            document.getElementById("feedback").textContent = ""; // Clear feedback
        }, 3000);
    
        // ✅ Reset for next question
        resetForNextQuestion();
    })
    .catch(error => console.error("Upload error:", error));
});


// ✅ Reset for Next Question
function resetForNextQuestion() {
   
    recordedChunks = [];
    videoBlob = null;
    document.getElementById("videoPlayback").hidden = true;
    document.getElementById("liveVideo").hidden = false;
    document.getElementById("startRecording").disabled = false;
    document.getElementById("stopRecording").disabled = true;
    document.getElementById("submit").disabled = true; // ✅ Disable Submit Button

    // Move to the next question
    currentIndex++;
    if (currentIndex < questions.length) {
        loadQuestion();
    } else {
        document.getElementById("question").textContent = "Interview Completed!";
    }
}


// ✅ Load Questions
function loadQuestion() {
    if (currentIndex >= 0 && currentIndex < questions.length) {
        document.getElementById("question").textContent = questions[currentIndex].question;
    }
}

// ✅ Timer Function
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

// ✅ Initialize Everything
fetchQuestions();