from flask import Flask, jsonify, request, session
import mysql.connector
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import os
import PyPDF2
import docx
import re
import string
import nltk
from werkzeug.utils import secure_filename
import random
import smtplib
from email.mime.text import MIMEText

nltk.download('stopwords')
from nltk.corpus import stopwords

app = Flask(__name__)
app.secret_key = "your_secret_key_here"  # Change this to a secure key

bcrypt = Bcrypt(app)
CORS(app)  # Allow frontend requests
otp_storage = {}
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

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

    if otp_storage.get(email) == otp:
        del otp_storage[email]  # Remove OTP after successful login
        return jsonify({"message": "OTP verified successfully"})
    else:
        return jsonify({"error": "Invalid OTP"}), 400
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
    return "Welcome to the Placement Portal API!"


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


# Fetch Questions with Difficulty and Keywords
@app.route('/api/questions', methods=['GET'])
def get_questions():
    difficulty = request.args.get('difficulty')
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, question_text FROM questions WHERE difficulty = %s", (difficulty,))
    questions = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({"questions": questions})


# Fetch Keywords for the Current Question
@app.route('/api/keywords', methods=['POST'])
def get_keywords():
    data = request.get_json()
    question_id = data['question_id']
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT keywords FROM answer_keywords WHERE question_id = %s", (question_id,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    keywords = result['keywords'].split(", ") if result else []
    return jsonify({"keywords": keywords})


if __name__ == '__main__':
    print("🚀 Starting Flask Server on port 5000...")
    app.run(debug=True, port=5000)