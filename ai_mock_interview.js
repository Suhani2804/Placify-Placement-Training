let recognition;
let isRecording = false;
let videoStream;
let questions = { easy: [], medium: [], hard: [] };
let currentQuestion = "";
let currentKeywords = [];

// Fetch Questions from Backend
function fetchQuestions() {
    const difficulty = document.getElementById('difficultySelect').value;
    if (!difficulty) {
        alert("Please select a difficulty level.");
        return;
    }

    // Changed port from 5001 to 5000
    fetch(`http://localhost:5000/api/questions?difficulty=${difficulty}`)
        .then(response => response.json())
        .then(data => {
            if (data.questions) {
                questions[difficulty] = data.questions;
                displayQuestionByDifficulty(difficulty);
            } else {
                console.error("No questions received from the backend.");
            }
        })
        .catch(error => {
            console.error("❌ Error fetching questions: ", error);
            alert("Failed to load questions. Please try again later.");
        });
}

// Display Questions by Difficulty
function displayQuestionByDifficulty(difficulty) {
    const questionList = questions[difficulty];
    if (questionList.length > 0) {
        const randomIndex = Math.floor(Math.random() * questionList.length);
        const question = questionList[randomIndex];
        currentQuestion = question.question_text;
        document.getElementById('question').innerText = currentQuestion;
        fetchKeywords(question.id);
    } else {
        document.getElementById('question').innerText = `No ${difficulty} questions available.`;
    }
}

// Start the Interview
function startInterview() {
    if (isRecording) {
        alert("Interview is already in progress.");
        return;
    }

    // 🎥 Access Webcam and Microphone
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            videoStream = stream;
            document.getElementById('videoPreview').srcObject = stream;

            // 🎙️ Start Speech Recognition
            if ('webkitSpeechRecognition' in window) {
                recognition = new webkitSpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    // Display interim transcript immediately
                    document.getElementById('transcription').innerText = interimTranscript;

                    // Append final transcript
                    if (finalTranscript) {
                        document.getElementById('transcription').innerText += finalTranscript;
                        evaluateAnswer(finalTranscript);
                    }
                };

                recognition.onerror = (event) => {
                    console.error("Speech recognition error: ", event.error);
                    alert("Speech recognition error occurred. Please try again.");
                };

                recognition.onend = () => {
                    console.log("Speech recognition ended.");
                    isRecording = false;
                    document.getElementById('startInterview').disabled = false;
                    document.getElementById('stopInterview').disabled = true;
                };

                recognition.start();
                isRecording = true;
                document.getElementById('startInterview').disabled = true;
                document.getElementById('stopInterview').disabled = false;
            } else {
                alert("Speech Recognition is not supported in this browser. Please use Google Chrome.");
            }
        })
        .catch(error => {
            console.error("Error accessing webcam: ", error);
            alert("Failed to access the webcam. Please check your browser settings.");
        });
}

// Stop the Interview
function stopInterview() {
    if (isRecording && recognition) {
        recognition.stop();
        isRecording = false;
    }
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('startInterview').disabled = false;
    document.getElementById('stopInterview').disabled = true;
}

// Fetch Keywords for the Current Question
function fetchKeywords(questionId) {
    // Changed port from 5001 to 5000
    fetch('http://localhost:5000/api/keywords', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question_id: questionId }),
    })
    .then(response => response.json())
    .then(data => {
        currentKeywords = data.keywords || [];
        console.log("Keywords: ", currentKeywords);
    })
    .catch(error => {
        console.error("❌ Error fetching keywords: ", error);
    });
}

// Evaluate Answer with Keyword Matching
function evaluateAnswer(answer) {
    const matchedKeywords = currentKeywords.filter(keyword => answer.toLowerCase().includes(keyword.toLowerCase()));
    const missedKeywords = currentKeywords.filter(keyword => !matchedKeywords.includes(keyword));
    document.getElementById('feedback').innerHTML = `
        <strong>Matched Keywords:</strong> ${matchedKeywords.join(', ') || 'None'}<br>
        <strong>Consider Including:</strong> ${missedKeywords.join(', ') || 'None'}
    `;
}
