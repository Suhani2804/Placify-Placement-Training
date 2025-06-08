document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("getJobsBtn").addEventListener("click", fetchJobs);
});

function fetchJobs() {
    let skills = document.getElementById("skills").value.trim();

    if (!skills) {
        alert("Please enter skills!");
        return;
    }

    fetch('http://127.0.0.1:5000/get_jobs?skills=' + encodeURIComponent(skills))
    .then(response => response.json())
    .then(data => {
        let jobResults = document.getElementById("job-results");
        jobResults.innerHTML = "<h3>Recommended Jobs:</h3>";

        if (!data.jobs || data.jobs.length === 0) {
            jobResults.innerHTML += "<p>No jobs found. Try different skills.</p>";
            return;
        }

        data.jobs.forEach(job => {
            jobResults.innerHTML += `
                <div class="job-card">
                    <h4 class="job-title">${job.title}</h4>
                    <p class="job-info"><strong>Company:</strong> ${job.company}</p>
                    <p class="job-info"><strong>Location:</strong> ${job.location}</p>
                    <a href="${job.url}" target="_blank" class="apply-link">Apply Here</a>
                </div>
            `;
        });
    })
    .catch(error => console.error('Error fetching jobs:', error));
}
