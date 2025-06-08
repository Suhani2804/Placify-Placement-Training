from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from sentence_transformers import SentenceTransformer, util
from nltk.stem import PorterStemmer
import spacy
import re

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Models and Tools
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
stemmer = PorterStemmer()
nlp = spacy.load("en_core_web_sm")

FILLER_WORDS = ["um", "uh", "like", "you know", "actually", "basically", "literally", "so", "right", "i think"]

# ✅ Database connection
def get_db_connection():
    try:
        return mysql.connector.connect(
            host="localhost",
            user="root",
            password="Suhani@2804",
            database="minortable1"
        )
    except mysql.connector.Error as err:
        print(f"❌ Database Connection Error: {err}")
        return None

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

if __name__ == '__main__':
    app.run(port=5000, debug=True)
