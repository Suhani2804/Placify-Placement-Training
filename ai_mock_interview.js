let recognition;
let isRecording = false;
let videoStream;
let questions = { easy: [], medium: [], hard: [] };
let currentQuestion = "";
let currentQuestionId = null;
let finalTranscript = "";
let pauseDurations = [];
let lastFinalTimestamp = null;
let totalFinalWords = 0;

function fetchQuestions() {
    const difficulty = document.getElementById('difficultySelect').value;
    if (!difficulty) {
        alert("Please select a difficulty level.");
        return;
    }

    console.log("Fetching questions for difficulty:", difficulty);

    fetch(`http://localhost:5000/api/questions?difficulty=${difficulty}`)
        .then(response => response.ok ? response.json() : Promise.reject("Failed to fetch questions."))
        .then(data => {
            if (data.questions && data.questions.length > 0) {
                // Ensure old questions are replaced correctly
                questions[difficulty] = [...data.questions];  // Assign new questions
                console.log("Questions loaded:", questions[difficulty]);

                // Display only **one** question
                if (currentQuestionId === null) {  // Only display if no question is currently active
                    displayQuestionByDifficulty(difficulty);
                }
            } else {
                document.getElementById('question').innerText = `No ${difficulty} questions available.`;
            }
        })
        .catch(error => {
            console.error("❌ Error fetching questions: ", error);
            alert("Failed to load questions. Please try again later.");
        });
}

// Display a Random Question
function displayQuestionByDifficulty(difficulty) {
    const questionList = questions[difficulty];
    if (questionList.length > 0) {
        const randomIndex = Math.floor(Math.random() * questionList.length);
        const question = questionList[randomIndex];
        currentQuestion = question.question_text;
        currentQuestionId = question.id;
        document.getElementById('question').innerText = currentQuestion;
    } else {
        document.getElementById('question').innerText = `No ${difficulty} questions available.`;
    }
}

function startInterview() {
    if (isRecording) {
        alert("Interview is already in progress.");
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            videoStream = stream;
            const videoElement = document.getElementById('videoPreview');
            videoElement.srcObject = stream;
            videoElement.muted = true;

            // Reset recognition safely
            if (recognition) {
                recognition.stop();
                recognition = null;
            }

            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = "";

            recognition.onresult = (event) => {
                let interimTranscript = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;
            
                    if (result.isFinal) {
                        finalTranscript += transcript + " ";
                        totalFinalWords += transcript.trim().split(/\s+/).length;
            
                        const now = Date.now();
                        if (lastFinalTimestamp) {
                            const pause = now - lastFinalTimestamp;
                            if (pause > 800) pauseDurations.push(pause); // Only count >800ms as pauses
                        }
                        lastFinalTimestamp = now;
                    } else {
                        interimTranscript += transcript;
                    }
                }
            
                document.getElementById('transcription').innerText = finalTranscript + " " + interimTranscript;
            };
            

            recognition.start();
            isRecording = true;
            document.getElementById('startInterview').disabled = true;
            document.getElementById('stopInterview').disabled = false;
        })
        .catch(error => {
            console.error("❌ Error accessing webcam:", error);
            alert("Failed to access the webcam. Please check your browser settings.");
        });
}



// Stop the Interview and Get Feedback
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

    const userAnswer = document.getElementById('transcription').innerText.trim();
    if (userAnswer) {
        evaluateAnswer(userAnswer, totalFinalWords, pauseDurations);
    } else {
        alert("No answer detected. Please try again.");
    }
}


// Submit Answer
function submitAnswer() {
    // Check if elements exist before modifying them
    const elementsToClear = ["idealAnswer", "similarityScore", "matchedKeywords", "missingKeywords", "bertFeedback"];
    elementsToClear.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.innerText = "";
    });

    // Show "Answer Submitted" message
    const submissionMessage = document.getElementById('submissionMessage');
    if (submissionMessage) {
        submissionMessage.style.display = "block";
        setTimeout(() => {
            submissionMessage.style.display = "none";
            location.reload();
        }, 1500);
    }
}

// Evaluate Answer with BERT Matching
function evaluateAnswer(answer, wordCount = 0, pauses = []) {
    if (!currentQuestionId) {
        alert("No question selected. Please choose a difficulty level first.");
        return;
    }

    const junkPatterns = [
        /^hi\b/i, /^hello\b/i, /^hey\b/i,
        /\bi don't know\b/i, /\bno idea\b/i, /\bidk\b/i,
        /^um+$/i, /^uh+$/i, /^ok+$/i,
        /^\s*$/,
    ];

    const isJunk = junkPatterns.some(pattern => pattern.test(answer.trim()));
    if (isJunk || wordCount < 3) {
        const updates = {
            idealAnswer: "N/A",
            similarityScore: `0%`,
            matchedKeywords: "None",
            missingKeywords: "All",
            bertFeedback: "Your response was too vague or irrelevant. Please try to answer the question meaningfully."
        };
        Object.keys(updates).forEach(id => {
            const element = document.getElementById(id);
            if (element) element.innerText = updates[id];
        });
        return;
    }

    fetch('http://localhost:5000/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question_id: currentQuestionId,
            user_answer: answer,
            total_words: wordCount,
            pause_durations: pauses
        }),
    })
    .then(response => response.ok ? response.json() : Promise.reject("Failed to evaluate answer."))
    .then(data => {
        if (data.error) {
            document.getElementById('bertFeedback').innerText = "No ideal answer found.";
            return;
        }

        const updates = {
            idealAnswer: data.ideal_answer || "Ideal answer not available.",
            similarityScore: `${data.similarity_score}%`,
            matchedKeywords: data.matched_keywords?.join(", ") || "None",
            missingKeywords: data.missing_keywords?.join(", ") || "None",
            bertFeedback: getHumanizedBertFeedback(data.similarity_score, data.missing_keywords),
            namedEntities: data.named_entities?.length
                ? `🗂️ Good job mentioning things like ${data.named_entities.join(", ")}.`
                : "🗂️ Try including relevant names or tools next time.",
            fillerFeedback: data.filler_count > 5
                ? `⚠️ You used ${data.filler_count} filler words — try to speak more confidently.`
                : `✅ Only ${data.filler_count} filler words — confident delivery!`,
            bloomsLevel: data.blooms_level 
                ? `🎓 Thought level: ${data.blooms_level}.` 
                : `🎓 Couldn't assess your thought level — try being clearer or more structured.`,
            speechRate: interpretSpeechRate(data.speech_rate_wpm),
            pauseFeedback: interpretPauses(data.average_pause_ms)
        };
        

        // Update frontend (IDs must exist in HTML for these)
        for (const [id, text] of Object.entries(updates)) {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        }
    })
    .catch(error => {
        console.error("❌ Error evaluating answer: ", error);
        document.getElementById('bertFeedback').innerText = "Error fetching BERT-based feedback.";
    });
}

function getHumanizedBertFeedback(score, missingKeywords) {
    if (score > 85) {
        return "✅ Excellent — you explained the main idea clearly with relevant terms.";
    } else if (score > 65) {
        return `👍 Decent try — but you could add details like ${missingKeywords.slice(0, 3).join(", ")}.`;
    } else if (score > 40) {
        return `⚠️ Your answer was somewhat off-track. Try including points like ${missingKeywords.slice(0, 2).join(", ")}.`;
    } else {
        return `❌ You missed key concepts like ${missingKeywords.slice(0, 2).join(", ")}. Revisit the core idea.`;
    }
}

function interpretSpeechRate(rate) {
    if (!rate) return "🚀 Speech rate unavailable.";

    if (rate < 90) return `🐢 You're speaking a bit slow (${rate} WPM) — try to be more natural.`;
    if (rate > 160) return `⚡ You're speaking fast (${rate} WPM) — slow down slightly to stay clear.`;
    return `✅ Good pace! You're speaking at a clear and steady ${rate} WPM.`;
}

function interpretPauses(avgPause) {
    if (!avgPause) return "⏸️ Pause info not available.";

    if (avgPause > 1200) return `⏸️ Long pauses detected (${avgPause} ms) — try to stay more fluent.`;
    if (avgPause < 400) return `⚡ You barely paused (${avgPause} ms) — make sure to breathe and emphasize.`;
    return `✅ Pauses are well-balanced (~${avgPause} ms) — keep it up!`;
}



// Attach event listeners to buttons
document.getElementById("loadQuestions").addEventListener("click", fetchQuestions);
document.getElementById("startInterview").addEventListener("click", startInterview);
document.getElementById("stopInterview").addEventListener("click", stopInterview);
document.getElementById("submitAnswer").addEventListener("click", submitAnswer);
