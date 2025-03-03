from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)

# Database connection
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Suhani@2804",
    database="minortable1"
)
cursor = db.cursor(dictionary=True)

# Fetch Questions with Difficulty and Keywords
@app.route('/api/questions', methods=['GET'])
def get_questions():
    difficulty = request.args.get('difficulty')
    cursor.execute("SELECT id, question_text FROM questions WHERE difficulty = %s", (difficulty,))
    questions = cursor.fetchall()
    return jsonify({"questions": questions})

# Fetch Keywords for the Current Question
@app.route('/api/keywords', methods=['POST'])
def get_keywords():
    data = request.get_json()
    question_id = data['question_id']
    cursor.execute("SELECT keywords FROM answer_keywords WHERE question_id = %s", (question_id,))
    result = cursor.fetchone()
    keywords = result['keywords'].split(", ") if result else []
    return jsonify({"keywords": keywords})

if __name__ == '__main__':
    app.run(port=5001, debug=True)
