document.addEventListener("DOMContentLoaded", function () {
    const chatbotToggle = document.getElementById("chatbot-toggle");
    const chatbotWindow = document.getElementById("chatbot-window");
    const chatAvatarContainer = document.getElementById("chat-avatar");
    const chatbotBody = document.getElementById("chat-body");
    const userInputField = document.getElementById("user-input");

    // Clickable floating avatar toggle
    function toggleChatbot() {
        
        if (chatbotWindow.classList.contains("hidden")) {
          chatbotWindow.classList.remove("hidden");
          chatbotWindow.style.display = "block";
        } else {
          chatbotWindow.classList.add("hidden");
          chatbotWindow.style.display = "none";
        }
      }
    chatbotToggle.addEventListener("click", toggleChatbot);
// ✅ Make the function accessible globally
window.toggleChatbot = toggleChatbot;
    // Load the animated talking avatar inside the chat window
    var chatAvatar = lottie.loadAnimation({
        container: chatAvatarContainer,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "avatar.json"
    });

    // Handle Enter keypress
    userInputField.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });
    

    function sendMessage() {
        let userMessage = userInputField.value.trim();
        if (userMessage === "") return;

        addMessage("You", userMessage);
        userInputField.value = "";
         
        // Show "Typing..." before getting a response
    let typingIndicator = document.createElement("div");
    typingIndicator.classList.add("message");
    typingIndicator.id = "typing";  // Unique ID for removing later
    typingIndicator.innerHTML = `<strong>Chatbot:</strong> Typing...`;
    chatbotBody.appendChild(typingIndicator);
    scrollToBottom(); // Ensure it's vi sible

    console.log("Sending request to AI API...");

    console.log("User Input:", userMessage);
    if (!userMessage || userMessage.trim() === "") {
        console.log("Empty input detected!");
        return;
    }
    
    fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "phi",
            prompt: userMessage,
            temperature: 0.3,
            max_tokens: 100,
            stream: false
        })
    })
    .then(response => {
        console.log("Fetch status:", response.status);
        return response.text(); // <--- get raw text to debug
    })
    .then(text => {
        console.log("Raw Response Text:", text);
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("JSON parse error:", e);
            addMessage("Chatbot", "Invalid response from server.");
            return;
        }
        console.log("Parsed Ollama Response:", data);
    
        let botResponse = data?.response?.trim() || "Hmm, I didn't get a response.";
        addMessage("Chatbot", botResponse);
        speak(botResponse);
    })
    .catch(error => {
        console.error("Fetch error:", error);
        addMessage("Chatbot", "Oops! Something went wrong.");
    });
    
        document.getElementById("chat-body").scrollTop = document.getElementById("chat-body").scrollHeight;

    }

    function addMessage(sender, text) {
        let messageDiv = document.createElement("div");
        messageDiv.classList.add("message");
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
        chatbotBody.appendChild(messageDiv);

        setTimeout(() => {
            chatbotBody.scrollTop = chatbotBody.scrollHeight;
        }, 100);
    }


    function speak(text) {
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
    
        // Start the talking animation
        chatAvatar.play();
    
        // Detect when speech ends
        utterance.onend = function () {
            chatAvatar.stop(); // Stop animation when speaking ends
        };
    
        speechSynthesis.speak(utterance);
        chatAvatar.setSpeed(1.5); // Adjust speed if needed

    }
    
// Scroll to the bottom after adding a new message
function scrollToBottom() {
    var chatBody = document.getElementById("chat-body");
    chatBody.scrollTop = chatBody.scrollHeight;
}
    window.sendMessage = sendMessage;
});
