document.addEventListener("DOMContentLoaded", () => {
    const skillDropdown = document.getElementById("skill-dropdown");
    const user = JSON.parse(localStorage.getItem("user"));

    skillDropdown.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Skills";
    skillDropdown.appendChild(allOption);

    if (user && user.skills) {
        const skillsArray = user.skills.split(',').map(skill => skill.trim());
        skillsArray.forEach(skill => {
            const option = document.createElement("option");
            option.value = skill;
            option.textContent = skill;
            skillDropdown.appendChild(option);
        });
    } else {
        skillDropdown.innerHTML += "<option value=''>No skills found</option>";
    }
});

function fetchCourses() {
    const skill = document.getElementById("skill-dropdown").value;
    const platform = document.getElementById("platform").value;
    const courseContainer = document.getElementById("course-list");

    if (!skill) {
        alert("Please select a skill.");
        return;
    }

    document.getElementById("loading").style.display = "block";
    courseContainer.innerHTML = "";

    fetch(`http://127.0.0.1:5000/api/get_courses?skill=${encodeURIComponent(skill)}&platform=${encodeURIComponent(platform)}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById("loading").style.display = "none";
            courseContainer.innerHTML = "";

            if (!data.courses || data.courses.length === 0) {
                let noCourseMsg = document.createElement("p");
                noCourseMsg.textContent = "No courses found. Click below to explore more.";
                courseContainer.appendChild(noCourseMsg);
            } else {
                let courseTitles = new Set();

                data.courses.forEach(course => {
                    if (!courseTitles.has(course.title)) {
                        courseTitles.add(course.title);

                        const card = document.createElement("div");
                        card.className = "course-card";

                        const courseLink = course.course_link || getSearchUrl(platform, skill);

                        card.innerHTML = `
                            <h3>${course.title}</h3>
                            <p><strong>Platform:</strong> ${platform}</p>
                            <a href="${courseLink}" target="_blank">View Course</a>
                        `;

                        courseContainer.appendChild(card);
                    }
                });
            }

            const moreCoursesBtn = document.createElement("button");
            moreCoursesBtn.textContent = "Look for More Courses";
            moreCoursesBtn.classList.add("more-courses-btn");
            moreCoursesBtn.onclick = () => {
                window.open(getSearchUrl(platform, skill), "_blank");
            };
            courseContainer.appendChild(moreCoursesBtn);
        })
        .catch(error => {
            console.error("Error fetching courses:", error);
            document.getElementById("loading").style.display = "none";
            courseContainer.innerHTML = "<p>Error fetching courses. Please try again later.</p>";
        });
}

function getSearchUrl(platform, skill) {
    if (platform === "all") {
        return `https://www.google.com/search?q=${encodeURIComponent(skill + ' online courses')}`;
    }

    const searchLinks = {
        "Coursera": `https://www.coursera.org/search?query=${encodeURIComponent(skill)}`,
        "Udemy": `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`,
        "Unstop": `https://unstop.com/courses?search=${encodeURIComponent(skill)}`,
        "edX": `https://www.edx.org/search?q=${encodeURIComponent(skill)}`,
        "FutureLearn": `https://www.futurelearn.com/search?q=${encodeURIComponent(skill)}`,
        "Skillshare": `https://www.skillshare.com/search?query=${encodeURIComponent(skill)}`,
        "LinkedIn Learning": `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(skill)}`,
        "Pluralsight": `https://www.pluralsight.com/search?q=${encodeURIComponent(skill)}`,
        "Khan Academy": `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(skill)}`
    };

    return searchLinks[platform] || "https://www.google.com";
}
