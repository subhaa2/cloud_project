const YEAR_OPTIONS = [
    { id: 'sec1', label: 'Sec 1' },
    { id: 'sec2', label: 'Sec 2' },
    { id: 'sec3', label: 'Sec 3' },
    { id: 'sec4', label: 'Sec 4' },
    { id: 'sec5', label: 'Sec 5' }
];

let selectedSubjects = [];

function renderYearOptions(container) {
    YEAR_OPTIONS.forEach(({ id, label }) => {
        const option = document.createElement('label');
        option.className = 'checkbox-item';
        option.innerHTML = `
            <input type="checkbox" name="teachingYears" value="${id}">
            <span>${label}</span>
        `;
        container.appendChild(option);
    });
}

function updateSubjectPills(pillContainer) {
    pillContainer.innerHTML = '';
    selectedSubjects.forEach((subject) => {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.innerHTML = `
            <span>${subject}</span>
            <button type="button" aria-label="Remove ${subject}">&times;</button>
        `;
        pill.querySelector('button').addEventListener('click', () => {
            selectedSubjects = selectedSubjects.filter((item) => item !== subject);
            updateSubjectPills(pillContainer);
        });
        pillContainer.appendChild(pill);
    });
}

function handleSubjectInput(event, pillContainer) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const value = event.target.value.trim();
        if (value && !selectedSubjects.includes(value)) {
            selectedSubjects.push(value);
            updateSubjectPills(pillContainer);
        }
        event.target.value = '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const schoolSelect = document.getElementById('teacherSchool');
    const addSchoolBtn = document.getElementById('teacherAddSchoolBtn');
    const yearsContainer = document.getElementById('yearsContainer');
    const subjectInput = document.getElementById('subjectInput');
    const subjectPills = document.getElementById('subjectPills');
    const statusMessage = document.getElementById('statusMessage');
    const form = document.getElementById('teacherSignupForm');
    const submitBtn = document.getElementById('submitBtn');

    renderYearOptions(yearsContainer);

    try {
        await refreshSchoolOptions(schoolSelect);
    } catch (error) {
        showStatus(statusMessage, error.message, 'error');
    }

    attachAddSchoolHandler(addSchoolBtn, schoolSelect, statusMessage);
    subjectInput.addEventListener('keydown', (event) => handleSubjectInput(event, subjectPills));

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearStatus(statusMessage);

        const email = form.email.value.trim();
        const schoolId = schoolSelect.value;
        const years = Array.from(form.querySelectorAll('input[name="teachingYears"]:checked')).map(
            (input) => input.value
        );

        if (!email || !schoolId) {
            showStatus(statusMessage, 'Email and school are required', 'error');
            return;
        }

        if (years.length === 0) {
            showStatus(statusMessage, 'Select at least one year you are teaching', 'error');
            return;
        }

        if (selectedSubjects.length === 0) {
            showStatus(statusMessage, 'Add at least one subject you teach', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'teacher',
                    email,
                    schoolId,
                    teachingYears: years,
                    teachingSubjects: selectedSubjects
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to create teacher account');
            }

            showStatus(statusMessage, 'Teacher account created! You can now log in.', 'success');
            form.reset();
            selectedSubjects = [];
            updateSubjectPills(subjectPills);
            await refreshSchoolOptions(schoolSelect);
        } catch (error) {
            showStatus(statusMessage, error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Teacher Account';
        }
    });
});

