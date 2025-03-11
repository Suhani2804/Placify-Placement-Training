const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const landmarkCanvas = document.getElementById("landmarkCanvas");
const ctx = canvas.getContext("2d");
const landmarkCtx = landmarkCanvas.getContext("2d");
const postureStatus = document.getElementById("posture-status");
const sentimentText = document.getElementById("sentimentText");

// Initialize Camera
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        return new Promise((resolve) => (video.onloadedmetadata = resolve));
    } catch (error) {
        console.error("❌ Camera access denied:", error);
    }
}

// Initialize MediaPipe FaceMesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
faceMesh.onResults(processFaceData);

// Real-Time Detection Loop
async function detectLoop() {
    if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        landmarkCanvas.width = video.videoWidth;
        landmarkCanvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        await faceMesh.send({ image: video });
    }
    requestAnimationFrame(detectLoop);
}

// Draw Face Landmarks
function drawLandmarks(landmarks) {
    landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
    landmarkCtx.fillStyle = "red";
    landmarks.forEach(({ x, y }) => {
        landmarkCtx.beginPath();
        landmarkCtx.arc(x * landmarkCanvas.width, y * landmarkCanvas.height, 3, 0, 2 * Math.PI);
        landmarkCtx.fill();
    });
}

// Analyze Posture & Sentiment
function processFaceData(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
    const landmarks = results.multiFaceLandmarks[0];

    // Draw Landmarks
    drawLandmarks(landmarks);

    // Posture Analysis
    analyzePosture(landmarks);

    // Sentiment Analysis
    analyzeSentiment(landmarks);
}

// **Enhanced Posture Analysis**
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

// **Improved Sentiment Analysis**
function analyzeSentiment(landmarks) {
    if (!sentimentText) return;

    // Extract Key Facial Features
    const leftEyebrow = landmarks[70].y;
    const rightEyebrow = landmarks[300].y;
    const leftEye = landmarks[159].y;
    const rightEye = landmarks[386].y;
    const mouthTop = landmarks[13].y;
    const mouthBottom = landmarks[14].y;
    const mouthLeft = landmarks[61].x;
    const mouthRight = landmarks[291].x;

    // Normalize with Face Size
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

// Get Sentiment Color
function getSentimentColor(sentiment) {
    return sentiment === "Happy" ? "green" : sentiment === "Neutral" ? "blue" : "red";
}

// Start Camera & Real-Time Detection
setupCamera().then(() => {
    video.play();
    detectLoop();
});
