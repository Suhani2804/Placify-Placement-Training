from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app)

# Database Connection
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Suhani@2804",
        database="minortable1"
    )

# Fetch Courses Based on Skill & Platform
@app.route("/api/get_courses", methods=["GET"])
def get_courses():
    skill = request.args.get("skill")
    platform = request.args.get("platform")

    if not skill or not platform:
        return jsonify({"error": "Skill and Platform are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Modify the SQL query to use LIKE for partial matching
    cursor.execute("SELECT title, course_link FROM Courses WHERE search_query LIKE %s AND platform = %s", (f"%{skill}%", platform))
    
    courses = cursor.fetchall()
    conn.close()

    # Ensure every course has a proper link, fallback to platform search URL if missing
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

if __name__ == "__main__":
    app.run(port=5000, debug=True)
