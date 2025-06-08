from flask import Flask, jsonify, request, session
import mysql.connector
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import os
import re
import nltk
from werkzeug.utils import secure_filename
import random
import smtplib
from email.mime.text import MIMEText
from flask import render_template
from sentence_transformers import SentenceTransformer, util
from nltk.stem import PorterStemmer  # For better keyword matching
from mailconnect import mailconnect_bp
import requests
import spacy
import re
# nltk.download('stopwords')
# from nltk.corpus import stopwords

app = Flask(__name__)
app.secret_key ="suhani_super_secret_key_2804"  # Change this to a secure key

# Models and Tools
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
stemmer = PorterStemmer()
nlp = spacy.load("en_core_web_sm")

FILLER_WORDS = ["um", "uh", "like", "you know", "actually", "basically", "literally", "so", "right"]

# Initialize stemmer for improved keyword matching
stemmer = PorterStemmer()

bcrypt = Bcrypt(app)
CORS(app, resources={r"/*": {"origins": "*"}})
otp_storage = {}
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Function to send OTP via email
def send_otp_email(email, otp):
    sender_email = "ethanhunt2804@gmail.com"  # Replace with your email
    sender_password = "coql vpyl vamv vybl"  # Replace with your app password
    subject = "Your OTP for Login"
    body = f"Your OTP for login is: {otp}"

    msg = MIMEText(body)
    msg["From"] = sender_email
    msg["To"] = email
    msg["Subject"] = subject

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print("Error sending email:", e)
        return False

# API to request OTP
@app.route("/api/request-otp", methods=["POST"])
def request_otp():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    otp = str(random.randint(100000, 999999))  # Generate 6-digit OTP
    otp_storage[email] = otp  # Store OTP temporarily

    if send_otp_email(email, otp):
        return jsonify({"message": "OTP sent successfully"})
    else:
        return jsonify({"error": "Failed to send OTP"}), 500

# API to verify OTP
@app.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400  # Return 400 if input is missing

    if otp_storage.get(email) == otp:
        del otp_storage[email]  # Remove OTP after successful verification
        return jsonify({"message": "OTP verified successfully"}), 200  # Success response

    return jsonify({"error": "Invalid OTP. Please try again."}), 400  # Ensure failure response is 400
    
# 🔹 Database Connection
def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='root',
            password='Suhani@2804',  # Change if needed
            database='minortable1'
        )
        print("✅ Connected to MySQL successfully!")
        return connection
    except mysql.connector.Error as err:
        print(f"❌ Database Connection Error: {err}")
        return None


@app.route('/')
def home():
    return render_template("mailconnect.html")


# 🔹 User Signup Route (With Duplicate Email Check)
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json  
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    course = data.get("course", "")
    batch = data.get("batch", "")
    branch = data.get("branch", "")
    user_type = "student"
    skills = data.get("skills", "")
    phone = data.get("phone", "")

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)

    # Check if email already exists
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"error": "Email already exists!"}), 400

    try:
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, course, batch, branch, user_type, skills, phone, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())",
            (name, email, hashed_password, course, batch, branch, user_type, skills, phone)
        )
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


# 🔹 User Login Route
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json  
    email = data.get("email")
    password = data.get("password")

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)  
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user and bcrypt.check_password_hash(user["password_hash"], password):
        session["user_id"] = user["user_id"]  
        return jsonify({
            "message": "Login successful",
            "user": {
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user["email"],
                "course": user["course"],
                "batch": user["batch"],
                "branch": user["branch"],
                "skills": user["skills"],
                "phone": user["phone"],
            }
        })
    else:
        return jsonify({"error": "Invalid email or password"}), 401


# 🔹 Get Mock Interview Questions
@app.route('/api/mock_questions', methods=['GET'])
def get_mock_questions():
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM mock_questions")
    questions = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(questions)


@app.route("/upload", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video = request.files["video"]
    video_path = os.path.join(UPLOAD_FOLDER, video.filename)
    video.save(video_path)

    return jsonify({"message": "Video uploaded successfully", "path": video_path})


# Fetch Keywords for a Given Question
@app.route('/api/keywords', methods=['POST'])
def get_keywords():
    data = request.get_json()
    question_id = data.get('question_id')

    if not question_id:
        return jsonify({"error": "Question ID is required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT keywords FROM answer_keywords WHERE question_id = %s", (question_id,))
        result = cursor.fetchone()

        keywords = result['keywords'].split(", ") if result and result['keywords'] else []
        return jsonify({"keywords": keywords})
    except mysql.connector.Error as err:
        print(f"❌ Database Query Error: {err}")
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        conn.close()

# ✅ Named Entity Extraction
def extract_named_entities(text):
    doc = nlp(text)
    return list(set(ent.text for ent in doc.ents if ent.label_ in ['ORG', 'PRODUCT', 'GPE', 'PERSON', 'TECH']))

# ✅ Filler Word Count
def count_fillers(text):
    words = re.findall(r'\b\w+\b', text.lower())
    return sum(words.count(fw) for fw in FILLER_WORDS)

# ✅ Bloom’s Taxonomy Estimation
def estimate_blooms_level(text):
    text = text.lower()
    if any(w in text for w in ["define", "list", "recall"]):
        return "Remember"
    elif any(w in text for w in ["explain", "describe", "summarize"]):
        return "Understand"
    elif any(w in text for w in ["apply", "use", "implement"]):
        return "Apply"
    elif any(w in text for w in ["analyze", "compare", "distinguish"]):
        return "Analyze"
    elif any(w in text for w in ["evaluate", "justify", "critique"]):
        return "Evaluate"
    elif any(w in text for w in ["create", "design", "construct"]):
        return "Create"
    return "Unclear"

# ✅ Fetch Questions Endpoint
@app.route('/api/questions', methods=['GET'])
def get_questions():
    difficulty = request.args.get('difficulty')
    if not difficulty:
        return jsonify({"error": "Difficulty level is required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, question_text FROM questions WHERE difficulty = %s", (difficulty,))
        questions = cursor.fetchall()
        return jsonify({"questions": questions})
    except mysql.connector.Error as err:
        print(f"❌ Database Query Error: {err}")
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        conn.close()

# ✅ Evaluate Answer Endpoint
@app.route('/api/evaluate', methods=['POST'])
def evaluate_answer():
    data = request.get_json()
    question_id = data.get('question_id')
    user_answer = data.get('user_answer')
    total_words = data.get('total_words', None)
    pause_durations = data.get('pause_durations', [])

    if not question_id or not user_answer:
        return jsonify({"error": "Question ID and user answer are required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT ideal_answer FROM ideal_answers WHERE question_id = %s", (question_id,))
        result = cursor.fetchone()
        if not result or not result['ideal_answer']:
            return jsonify({"error": "No ideal answer found."}), 404

        ideal_answer = result['ideal_answer']

        # ✅ Similarity Score (BERT)
        user_embedding = model.encode(user_answer, convert_to_tensor=True)
        ideal_embedding = model.encode(ideal_answer, convert_to_tensor=True)
        similarity_score = util.pytorch_cos_sim(user_embedding, ideal_embedding).item()
        similarity_percentage = round(((similarity_score + 1) / 2) * 100, 2)

        # ✅ Keyword Matching
        cursor.execute("SELECT keywords FROM answer_keywords WHERE question_id = %s", (question_id,))
        keyword_result = cursor.fetchone()
        keywords = keyword_result['keywords'].split(", ") if keyword_result and keyword_result['keywords'] else []

        user_answer_lower = user_answer.lower()
        stemmed_keywords = [stemmer.stem(kw.lower()) for kw in keywords]
        matched_keywords = [kw for kw in keywords if stemmer.stem(kw.lower()) in user_answer_lower]
        missing_keywords = [kw for kw in keywords if kw not in matched_keywords]

        keyword_coverage = len(matched_keywords) / len(keywords) if keywords else 0
        weight_similarity = 0.7
        weight_keywords = 0.3 if keywords else 0

        meaningful_words = sum(1 for word in user_answer.split() if len(word) > 2)
        contains_keywords = any(kw in user_answer_lower for kw in keywords)

        final_score = (weight_similarity * similarity_percentage) + (weight_keywords * keyword_coverage * 100)
        if meaningful_words < 3 or not contains_keywords:
            final_score *= 0.2
        final_score = max(0, min(100, final_score))

        if final_score > 85:
            bert_feedback = "✅ Excellent! Your response closely matches the ideal answer."
        elif final_score > 65:
            bert_feedback = f"🔍 Good, but you could improve by elaborating on: {', '.join(missing_keywords)}"
        elif final_score > 40:
            bert_feedback = f"⚠️ Needs improvement. Try including more details about: {', '.join(missing_keywords)}"
        else:
            bert_feedback = f"❌ Your answer lacks key concepts. Study: {', '.join(missing_keywords) if missing_keywords else 'core concepts'}"

        # ✅ New Feature: NER, Filler, Bloom's, Speech Rate
        named_entities = extract_named_entities(user_answer)
        filler_count = count_fillers(user_answer)
        blooms_level = estimate_blooms_level(user_answer)
        avg_pause = round(sum(pause_durations) / len(pause_durations), 2) if pause_durations else 0
        speech_rate = round((total_words * 60) / (sum(pause_durations)/1000), 2) if total_words and pause_durations else None

        return jsonify({
            "similarity_score": round(final_score, 2),
            "ideal_answer": ideal_answer,
            "matched_keywords": matched_keywords,
            "missing_keywords": missing_keywords,
            "bert_feedback": bert_feedback,
            "named_entities": named_entities,
            "filler_count": filler_count,
            "blooms_level": blooms_level,
            "average_pause_ms": avg_pause,
            "speech_rate_wpm": speech_rate
        })

    except mysql.connector.Error as err:
        print(f"❌ Database Query Error: {err}")
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/bodyposture')
def body_posture():
    return render_template('bodyposture.html')

# Fetch Courses Based on Skill & Platform
@app.route("/api/get_courses", methods=["GET"])
def get_courses():
    skill = request.args.get("skill")
    platform = request.args.get("platform")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = "SELECT title, course_link FROM Courses WHERE "
    params = []

    if skill != "all":
        query += "search_query LIKE %s "
        params.append(f"%{skill}%")
    else:
        query += "1=1 "

    if platform != "all":
        query += "AND platform = %s"
        params.append(platform)

    cursor.execute(query, params)
    courses = cursor.fetchall()
    conn.close()

    for course in courses:
        if not course["course_link"]:
            course["course_link"] = get_search_url(platform, skill)

    return jsonify({"courses": courses})


def get_search_url(platform, skill):
    search_links = {
        "Coursera": f"https://www.coursera.org/search?query={skill}",
        "Udemy": f"https://www.udemy.com/courses/search/?q={skill}",
        "Unstop": f"https://unstop.com/courses?search={skill}",
        "edX": f"https://www.edx.org/search?q={skill}",
        "FutureLearn": f"https://www.futurelearn.com/search?q={skill}",
        "Skillshare": f"https://www.skillshare.com/search?query={skill}",
        "LinkedIn Learning": f"https://www.linkedin.com/learning/search?keywords={skill}",
        "Pluralsight": f"https://www.pluralsight.com/search?q={skill}",
        "Khan Academy": f"https://www.khanacademy.org/search?page_search_query={skill}"
    }
    return search_links.get(platform, "https://google.com")

#job recommendation 

# Adzuna API credentials
API_ID = "e7cb61bd"
API_KEY = "c1d38395e6949b0b120d80fc6c6a14af"

@app.route('/get_jobs', methods=['GET'])
def get_jobs():
    skills = request.args.get('skills', '').replace(',', '+').strip()

    if not skills:
        return jsonify({"error": "No skills provided"}), 400

    url = f"https://api.adzuna.com/v1/api/jobs/in/search/1?app_id={API_ID}&app_key={API_KEY}&results_per_page=5&what={skills}"
    response = requests.get(url)

    if response.status_code != 200:
        return jsonify({"error": "Failed to fetch jobs"}), 500

    job_data = response.json()
    jobs = []

    for job in job_data.get('results', []):
        jobs.append({
            "title": job.get("title", "N/A"),
            "company": job.get("company", {}).get("display_name", "N/A"),
            "location": job.get("location", {}).get("display_name", "N/A"),
            "url": job.get("redirect_url", "#")
        })

    return jsonify({"jobs": jobs})



app.register_blueprint(mailconnect_bp)

if __name__ == '__main__':
    print("🚀 Starting Flask Server on port 5000...")
    app.run(debug=True, port=5000)