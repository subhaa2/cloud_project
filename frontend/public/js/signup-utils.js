// API_BASE_URL is set by config.js - ensure it's loaded before this script
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000';

async function fetchSchools() {
    const response = await fetch(`${API_BASE_URL}/api/schools`);
    if (!response.ok) {
        throw new Error(`Failed to fetch schools (${response.status})`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to fetch schools');
    }

    return data.schools || [];
}

async function createSchool(name) {
    const response = await fetch(`${API_BASE_URL}/api/schools`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create school');
    }

    return data.school;
}

function normalizeSchools(schools) {
    const unique = new Map();

    (schools || []).forEach((school) => {
        if (!school || !school.id) {
            return;
        }
        const name = typeof school.name === 'string' && school.name.trim() ? school.name.trim() : null;
        const displayName = name || 'Unnamed school';

        unique.set(school.id, {
            id: school.id,
            name: name,
            displayName
        });
    });

    return Array.from(unique.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function populateSchoolSelect(selectEl, schools, selectedId) {
    const options = normalizeSchools(schools);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = options.length > 0 ? 'Select a school' : 'No schools available';
    placeholder.disabled = true;
    placeholder.selected = !selectedId;

    selectEl.innerHTML = '';
    selectEl.appendChild(placeholder);

    options.forEach((school) => {
        const option = document.createElement('option');
        option.value = school.id;
        option.textContent = school.displayName;
        if (selectedId && school.id === selectedId) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    });
}

async function refreshSchoolOptions(selectEl, selectedId) {
    const schools = await fetchSchools();
    populateSchoolSelect(selectEl, schools, selectedId);
    return schools;
}

function showStatus(messageEl, message, type = 'success') {
    messageEl.textContent = message;
    messageEl.className = `status-message ${type}`;
}

function clearStatus(messageEl) {
    messageEl.textContent = '';
    messageEl.className = 'status-message';
}

function promptForSchoolName() {
    const name = window.prompt('Enter the name of the school:');
    if (!name || !name.trim()) {
        return null;
    }
    return name.trim();
}

function attachAddSchoolHandler(buttonEl, selectEl, statusMessageEl, onSchoolCreated) {
    if (!buttonEl) {
        return;
    }

    buttonEl.addEventListener('click', async () => {
        const name = promptForSchoolName();
        if (!name) {
            return;
        }

        try {
            showStatus(statusMessageEl, 'Creating school...', 'info');
            const school = await createSchool(name);
            const schools = await refreshSchoolOptions(selectEl, school.id);
            selectEl.value = school.id;
            showStatus(
                statusMessageEl,
                `${school.name} added. Continue filling in the rest of the form.`,
                'success'
            );
            if (typeof onSchoolCreated === 'function') {
                onSchoolCreated(school, schools);
            }
        } catch (error) {
            showStatus(statusMessageEl, error.message, 'error');
        }
    });
}

