from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

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

if __name__ == '__main__':
    app.run(debug=True)