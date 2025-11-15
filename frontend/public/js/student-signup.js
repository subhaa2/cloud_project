const YEAR_OPTIONS = [
    { id: '', label: 'Select your year' },
    { id: 'sec1', label: 'Sec 1' },
    { id: 'sec2', label: 'Sec 2' },
    { id: 'sec3', label: 'Sec 3' },
    { id: 'sec4', label: 'Sec 4' },
    { id: 'sec5', label: 'Sec 5' }
];

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('studentSignupForm');
    const schoolSelect = document.getElementById('studentSchool');
    const yearSelect = document.getElementById('yearLevel');
    const statusMessage = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');

    YEAR_OPTIONS.forEach(({ id, label }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        yearSelect.appendChild(option);
    });

    try {
        await refreshSchoolOptions(schoolSelect);
    } catch (error) {
        showStatus(statusMessage, error.message, 'error');
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearStatus(statusMessage);

        const email = form.email.value.trim();
        const schoolId = schoolSelect.value;
        const yearLevel = yearSelect.value;

        if (!email || !schoolId) {
            showStatus(statusMessage, 'Email and school are required', 'error');
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
                    role: 'student',
                    email,
                    schoolId,
                    yearLevel: yearLevel || undefined
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to create student account');
            }

            showStatus(statusMessage, 'Student account created! You can now log in.', 'success');
            form.reset();
            yearSelect.value = '';
            await refreshSchoolOptions(schoolSelect);
        } catch (error) {
            showStatus(statusMessage, error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Student Account';
        }
    });
});

