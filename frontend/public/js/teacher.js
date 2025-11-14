const API_BASE_URL = 'http://localhost:5000';

const sessionUser = JSON.parse(localStorage.getItem('sessionUser') || 'null');
if (!sessionUser || sessionUser.role !== 'teacher') {
    window.location.href = 'index.html';
}

const teacherId = sessionUser.id;
const schoolId = sessionUser.schoolId;
const teacherYears = Array.isArray(sessionUser.teachingYears) ? sessionUser.teachingYears : [];

const teacherState = {
    school: null,
    subjects: [],
    currentYearId: 'all',
    currentSubjectId: null,
    currentWeekId: null,
    subjectWeeks: new Map(),
    weekDocuments: new Map()
};

document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard().catch(error => {
        console.error('Failed to initialise teacher dashboard', error);
        showGlobalError('Failed to load dashboard. Please try again later.');
    });
});

async function initializeDashboard() {
    setTeacherProfile();
    showSubjectsLoading('Loading your subjects…');

    await loadSchool();
    updateTeacherSchoolLabel();
    await loadSubjects();

    renderYearFilters();
    renderSubjects();
    await preloadWeeksForStats();
    updateStats();
}

function setTeacherProfile() {
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.querySelector('.user-role');

    if (nameEl) {
        nameEl.textContent = sessionUser.displayName || sessionUser.email || 'Teacher';
    }
    if (roleEl) {
        roleEl.textContent = 'Instructor';
    }
}

function updateTeacherSchoolLabel() {
    const roleEl = document.querySelector('.user-role');
    if (!roleEl) {
        return;
    }

    const schoolName = teacherState.school?.name || sessionUser.schoolId || '';
    roleEl.textContent = schoolName ? `Instructor · ${schoolName}` : 'Instructor';
}

async function loadSchool() {
    const response = await fetchJson(`${API_BASE_URL}/api/schools/${schoolId}`);
    teacherState.school = response.school;
}

async function loadSubjects() {
    const params = new URLSearchParams({
        schoolId,
        teacherId
    });
    const response = await fetchJson(`${API_BASE_URL}/api/subjects?${params.toString()}`);

    teacherState.subjects = sortSubjects(response.subjects || []);

    if (teacherState.currentYearId !== 'all') {
        return;
    }

    const firstSubjectYear = teacherState.subjects[0]?.yearId;
    if (firstSubjectYear && (!teacherState.currentYearId || teacherState.currentYearId === 'all')) {
        teacherState.currentYearId = firstSubjectYear;
    }
}

async function preloadWeeksForStats() {
    await Promise.all(
        teacherState.subjects.map(subject => ensureWeeksForSubject(subject.id).catch(() => []))
    );
}

function getYearLabel(yearId) {
    if (!yearId) {
        return 'General';
    }
    const match = teacherState.school?.years?.find(year => year.id === yearId);
    return match ? match.label || match.name || yearId : yearId;
}

function findYearOrder(yearId) {
    if (!yearId || !Array.isArray(teacherState.school?.years)) {
        return Number.MAX_SAFE_INTEGER;
    }
    const match = teacherState.school.years.find(year => year.id === yearId);
    return typeof match?.order === 'number' ? match.order : teacherState.school.years.indexOf(match);
}

function sortSubjects(subjects) {
    return [...subjects].sort((a, b) => {
        const yearDiff = findYearOrder(a.yearId) - findYearOrder(b.yearId);
        if (yearDiff !== 0) return yearDiff;
        return a.name.localeCompare(b.name);
    });
}

function renderYearFilters() {
    const container = document.getElementById('yearFilters');
    if (!container) return;

    container.innerHTML = '';

    const yearOptions = computeYearOptions();

    yearOptions.forEach(option => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `filter-chip${option.id === teacherState.currentYearId ? ' active' : ''}`;
        chip.textContent = option.label;
        chip.addEventListener('click', () => {
            teacherState.currentYearId = option.id;
            renderYearFilters();
            renderSubjects();
        });
        container.appendChild(chip);
    });
}

function computeYearOptions() {
    const schoolYears = Array.isArray(teacherState.school?.years) ? teacherState.school.years : [];
    const mapped = schoolYears
        .filter(year => teacherYears.length === 0 || teacherYears.includes(year.id))
        .map(year => ({
            id: year.id,
            label: year.label || year.name || year.id,
            order: typeof year.order === 'number' ? year.order : Number.MAX_SAFE_INTEGER
        }));

    if (mapped.length === 0 && teacherYears.length > 0) {
        return teacherYears.map((id, index) => ({
            id,
            label: id,
            order: index
        }));
    }

    mapped.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

    return [
        { id: 'all', label: 'All Years', order: -1 },
        ...mapped
    ];
}

function renderSubjects() {
    const container = document.getElementById('subjectsList');
    if (!container) return;

    container.innerHTML = '';

    const filtered = teacherState.subjects.filter(subject => {
        if (teacherState.currentYearId === 'all') return true;
        return subject.yearId === teacherState.currentYearId;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No subjects found for this year yet.</p>';
        return;
    }

    filtered.forEach(subject => {
        const card = createSubjectCard(subject);
        container.appendChild(card);
    });
}

function createSubjectCard(subject) {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.addEventListener('click', () => openSubject(subject.id));

    const weeks = teacherState.subjectWeeks.get(subject.id) || [];
    const documentCount = weeks.reduce((total, week) => total + (week.documentCount || 0), 0);

    card.innerHTML = `
        <div class="subject-card-header">
            <h3>${subject.name}</h3>
            <span class="subject-card-year">${getYearLabel(subject.yearId)}</span>
        </div>
        <p>${weeks.length} week${weeks.length === 1 ? '' : 's'} • ${documentCount} document${documentCount === 1 ? '' : 's'}</p>
    `;

    return card;
}

async function openSubject(subjectId) {
    teacherState.currentSubjectId = subjectId;
    try {
        await ensureWeeksForSubject(subjectId);
    } catch (error) {
        console.error('Failed to load weeks for subject', error);
        alert(error.message || 'Failed to load weeks for this subject.');
        teacherState.currentSubjectId = null;
        return;
    }

    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';

    const subject = getCurrentSubject();
    document.getElementById('currentSubjectTitle').textContent = subject ? subject.name : 'Subject';

    renderWeeks(subjectId);
}

function getCurrentSubject() {
    return teacherState.subjects.find(subject => subject.id === teacherState.currentSubjectId) || null;
}

async function ensureWeeksForSubject(subjectId) {
    if (teacherState.subjectWeeks.has(subjectId)) {
        return teacherState.subjectWeeks.get(subjectId);
    }

    const params = new URLSearchParams({ subjectId });
    let response;
    try {
        response = await fetchJson(`${API_BASE_URL}/api/weeks?${params.toString()}`);
    } catch (error) {
        throw new Error(error.message || 'Failed to fetch weeks');
    }

    // : Filter to ensure all weeks belong to this subject and create new array
    // This prevents weeks from other subjects from appearing in the wrong subject's list
    const weeks = (response.weeks || []).filter(week => {
        // Double-check that each week belongs to this subject
        if (week.subjectId !== subjectId) {
            console.warn(`Week ${week.id} has subjectId ${week.subjectId} but was returned for subject ${subjectId}`);
            return false;
        }
        return true;
    });

    // : Create a new sorted array (don't mutate the filtered array)
    // This prevents reference sharing issues between subjects
    const sortedWeeks = [...weeks].sort((a, b) => {
        if (typeof a.order === 'number' && typeof b.order === 'number') {
            return a.order - b.order;
        }
        if (typeof a.order === 'number') return -1;
        if (typeof b.order === 'number') return 1;
        return a.name.localeCompare(b.name);
    });

    // : Create new week objects with document counts to avoid mutating the original
    // This prevents reference sharing where modifying one subject's week objects affects another
    const weeksWithCounts = [];
    for (const week of sortedWeeks) {
        if (!week || !week.id) continue;

        const weekWithCount = { ...week }; // Create a copy to avoid mutating the original response data

        if (teacherState.weekDocuments.has(week.id)) {
            weekWithCount.documentCount = teacherState.weekDocuments.get(week.id).length;
        } else {
            try {
                const docs = await fetchDocumentsForWeek(subjectId, week.id, { preferCache: false });
                weekWithCount.documentCount = docs.length;
            } catch (error) {
                console.warn(`Failed to preload documents for week ${week.id}:`, error.message);
                weekWithCount.documentCount = week.documentCount || 0;
            }
        }

        weeksWithCounts.push(weekWithCount);
    }

    // Store a new array, not a reference to the response array
    teacherState.subjectWeeks.set(subjectId, weeksWithCounts);
    return weeksWithCounts;
}

function renderWeeks(subjectId) {
    const container = document.getElementById('weeksList');
    if (!container) return;

    container.innerHTML = '';
    const weeks = teacherState.subjectWeeks.get(subjectId) || [];

    if (weeks.length === 0) {
        container.innerHTML = '<p class="empty-state">No weeks added yet. Click "+ New Week" to get started.</p>';
        return;
    }

    weeks.forEach(week => {
        const card = document.createElement('div');
        card.className = 'week-card';
        card.addEventListener('click', () => openWeek(week.id));
        const docCount = week.documentCount || 0;
        card.innerHTML = `
            <div>
                <h3>${week.name}</h3>
                <span>${docCount} document${docCount === 1 ? '' : 's'}</span>
            </div>
            <span>→</span>
        `;

        container.appendChild(card);
    });
}

async function openWeek(weekId) {
    teacherState.currentWeekId = weekId;
    await ensureDocumentsForWeek(weekId);

    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'block';

    const week = getCurrentWeek();
    document.getElementById('currentWeekTitle').textContent = week ? week.name : 'Week';

    renderDocuments();
}

function getCurrentWeek() {
    const subjectWeeks = teacherState.subjectWeeks.get(teacherState.currentSubjectId) || [];
    return subjectWeeks.find(week => week.id === teacherState.currentWeekId) || null;
}

async function ensureDocumentsForWeek(weekId) {
    return fetchDocumentsForWeek(teacherState.currentSubjectId, weekId, { preferCache: true });
}

function renderDocuments() {
    const container = document.getElementById('documentsList');
    if (!container) return;

    container.innerHTML = '';
    const docs = teacherState.weekDocuments.get(teacherState.currentWeekId) || [];

    if (docs.length === 0) {
        container.innerHTML = '<p class="empty-state">No documents uploaded yet. Click "+ Upload Document" to add documents.</p>';
        return;
    }

    docs.forEach(doc => {
        const card = createDocumentCard(doc);
        container.appendChild(card);
    });
}

function showSubjectsView() {
    teacherState.currentSubjectId = null;
    teacherState.currentWeekId = null;

    document.getElementById('subjectsView').style.display = 'block';
    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'none';
}

function showWeeklyView() {
    teacherState.currentWeekId = null;

    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';
}

function showAddSubjectModal() {
    const modal = document.getElementById('addSubjectModal');
    if (!modal) return;

    document.getElementById('subjectNameInput').value = '';
    populateSubjectYearSelect();

    modal.classList.add('active');
}

function populateSubjectYearSelect() {
    const select = document.getElementById('subjectYearSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select year</option>';

    const options = computeYearOptions().filter(option => option.id !== 'all');
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        select.appendChild(opt);
    });
}

async function addSubject() {
    const nameInput = document.getElementById('subjectNameInput');
    const yearSelect = document.getElementById('subjectYearSelect');
    const subjectName = nameInput.value.trim();
    const yearId = yearSelect.value;

    if (!subjectName) {
        alert('Please enter a subject name');
        return;
    }
    if (!yearId) {
        alert('Please select a year for this subject');
        return;
    }

    try {
        const response = await fetchJson(`${API_BASE_URL}/api/subjects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schoolId,
                yearId,
                name: subjectName,
                teacherId
            })
        });

        const subject = response.subject;
        teacherState.subjects.push(subject);
        teacherState.subjects = sortSubjects(teacherState.subjects);
        teacherState.subjectWeeks.set(subject.id, []);

        if (teacherState.currentYearId !== 'all' && teacherState.currentYearId !== subject.yearId) {
            teacherState.currentYearId = subject.yearId;
        }

        renderYearFilters();
        renderSubjects();
        updateStats();
        closeModal();
    } catch (error) {
        console.error('Failed to create subject:', error);
        alert(error.message || 'Failed to create subject');
    }
}

function showAddWeekModal() {
    if (!teacherState.currentSubjectId) {
        alert('Please select a subject first.');
        return;
    }

    document.getElementById('weekNameInput').value = '';
    document.getElementById('weekOrderInput').value = '';
    document.getElementById('addWeekModal').classList.add('active');
}

async function addWeek() {
    const nameInput = document.getElementById('weekNameInput');
    const orderInput = document.getElementById('weekOrderInput');
    const weekName = nameInput.value.trim();
    const order = orderInput.value ? Number(orderInput.value) : null;

    if (!weekName) {
        alert('Please enter a week name');
        return;
    }

    const subject = getCurrentSubject();
    if (!subject) {
        alert('No subject selected.');
        return;
    }

    try {
        const response = await fetchJson(`${API_BASE_URL}/api/weeks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schoolId,
                subjectId: subject.id,
                yearId: subject.yearId,
                name: weekName,
                order,
                teacherId
            })
        });

        // : Verify the week belongs to the correct subject
        // This prevents weeks from being associated with the wrong subject
        const newWeek = response.week;
        if (newWeek.subjectId !== subject.id) {
            console.error('Week subjectId mismatch!', {
                expected: subject.id,
                received: newWeek.subjectId,
                week: newWeek
            });
            alert('Error: Week was created but subject ID mismatch detected.');
            return;
        }

        // : Create a new array instead of mutating the existing one
        // This prevents reference sharing where modifying one subject's weeks affects another
        // Previously: weeks.push(newWeek) would mutate the array, causing cross-subject contamination
        const existingWeeks = teacherState.subjectWeeks.get(subject.id) || [];
        const updatedWeeks = [...existingWeeks, newWeek]; // Create new array with spread operator
        teacherState.subjectWeeks.set(subject.id, sortWeeks(updatedWeeks));

        renderWeeks(subject.id);
        // Re-render subjects to update the week count on subject cards
        renderSubjects();
        updateStats();
        closeModal();
    } catch (error) {
        console.error('Failed to create week:', error);
        alert(error.message || 'Failed to create week');
    }
}

function sortWeeks(weeks) {
    return [...weeks].sort((a, b) => {
        if (typeof a.order === 'number' && typeof b.order === 'number') {
            return a.order - b.order;
        }
        if (typeof a.order === 'number') return -1;
        if (typeof b.order === 'number') return 1;
        return a.name.localeCompare(b.name);
    });
}

async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    const subject = getCurrentSubject();
    const week = getCurrentWeek();

    if (files.length === 0 || !subject || !week) {
        return;
    }

    try {
        for (const file of files) {
            const storageInfo = await requestUploadUrl(file);
            await uploadFileToStorage(storageInfo.uploadUrl, file);

            const metadata = await createDocumentMetadata({
                title: file.name,
                type: file.type || 'application/octet-stream',
                storagePath: storageInfo.storagePath,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                ownerId: teacherId,
                schoolId,
                subjectId: subject.id,
                yearId: subject.yearId,
                weekId: week.id,
                visibility: 'school'
            });

            const formatted = mapDocumentFromApi(metadata.document);
            const docs = teacherState.weekDocuments.get(week.id) || [];
            docs.push(formatted);
            teacherState.weekDocuments.set(week.id, docs);

            week.documentCount = docs.length;
        }

        renderDocuments();
        renderWeeks(subject.id);
        updateStats();
    } catch (error) {
        console.error('Failed to upload documents:', error);
        alert(error.message || 'Failed to upload documents');
    } finally {
        event.target.value = '';
    }
}

async function deleteDocument(docId) {
    if (!teacherState.currentWeekId) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        await fetchJson(`${API_BASE_URL}/api/documents/${docId}`, {
            method: 'DELETE'
        });

        const docs = teacherState.weekDocuments.get(teacherState.currentWeekId) || [];
        const index = docs.findIndex(doc => doc.id === docId);
        if (index > -1) {
            docs.splice(index, 1);
            teacherState.weekDocuments.set(teacherState.currentWeekId, docs);
        }

        const week = getCurrentWeek();
        if (week) {
            week.documentCount = docs.length;
        }

        renderDocuments();
        const subject = getCurrentSubject();
        if (subject) {
            renderWeeks(subject.id);
        }
        updateStats();
    } catch (error) {
        console.error('Error deleting document:', error);
        alert(error.message || 'Failed to delete document');
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
}

function updateStats() {
    const subjectKeys = new Set();
    teacherState.subjects.forEach(subject => {
        if (!subject || !subject.name) {
            return;
        }
        const normalized = subject.name.trim().toLowerCase();
        subjectKeys.add(normalized);
    });

    const subjectCount = subjectKeys.size || teacherState.subjects.length;
    const totalWeeks = Array.from(teacherState.subjectWeeks.values()).reduce((sum, weeks) => sum + weeks.length, 0);
    const totalDocs = Array.from(teacherState.weekDocuments.values()).reduce((sum, docs) => sum + docs.length, 0);

    const subjectsCountEl = document.getElementById('subjectsCount');
    const subjectsCountNavEl = document.getElementById('subjectsCountNav');
    const totalWeeksEl = document.getElementById('totalWeeks');
    const totalDocsEl = document.getElementById('totalDocs');

    if (subjectsCountEl) subjectsCountEl.textContent = subjectCount;
    if (subjectsCountNavEl) subjectsCountNavEl.textContent = subjectCount;
    if (totalWeeksEl) totalWeeksEl.textContent = totalWeeks;
    if (totalDocsEl) totalDocsEl.textContent = totalDocs;
}

function showSubjectsLoading(message) {
    const container = document.getElementById('subjectsList');
    if (!container) return;
    container.innerHTML = `<p class="empty-state">${message}</p>`;
}

function showGlobalError(message) {
    showSubjectsLoading(message);
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);

    let data;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { success: response.ok, error: text };
    }

    if (!response.ok || data.success === false) {
        const error = new Error(data.error || `Request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return data;
}

function mapDocumentFromApi(doc) {
    const uploadedAt = doc.uploadedAt || doc.createdAt || new Date().toISOString();
    return {
        id: doc.id,
        name: doc.title,
        size: formatFileSize(doc.size),
        uploadedAt,
        storagePath: doc.storagePath,
        type: doc.type || 'unknown',
        ownerId: doc.ownerId,
        schoolId: doc.schoolId,
        subjectId: doc.subjectId,
        weekId: doc.weekId,
        yearId: doc.yearId || null,
        visibility: doc.visibility || 'school'
    };
}

function createDocumentCard(doc) {
    const card = document.createElement('div');
    card.className = 'document-card';

    const date = new Date(doc.uploadedAt);
    const dateStr = isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();

    card.innerHTML = `
        <div class="document-card-main">
            <div class="document-icon">📄</div>
            <div class="document-details">
                <h4>${doc.name}</h4>
                <div class="document-meta">
                    <span class="meta-item">📅 ${dateStr}</span>
                    <span class="meta-item">📦 ${doc.size || 'Unknown'}</span>
                </div>
            </div>
        </div>
        <button class="delete-btn" data-doc-id="${doc.id}">Delete</button>
    `;

    card.querySelector('.delete-btn').addEventListener('click', event => {
        event.stopPropagation();
        deleteDocument(doc.id);
    });

    return card;
}

async function fetchDocumentsForWeek(subjectId, weekId, { preferCache = false } = {}) {
    if (preferCache && teacherState.weekDocuments.has(weekId)) {
        return teacherState.weekDocuments.get(weekId);
    }

    const params = new URLSearchParams({
        schoolId,
        subjectId,
        weekId,
        ownerId: teacherId
    });

    const response = await fetchJson(`${API_BASE_URL}/api/documents?${params.toString()}`);
    const documents = (response.documents || []).map(mapDocumentFromApi);
    teacherState.weekDocuments.set(weekId, documents);

    const week = getCurrentWeek();
    if (week && week.id === weekId) {
        week.documentCount = documents.length;
    }

    return documents;
}

async function requestUploadUrl(file) {
    const subject = getCurrentSubject();
    const week = getCurrentWeek();
    const ownerName =
        sessionUser.displayName && sessionUser.displayName.trim().length > 0
            ? sessionUser.displayName.trim()
            : sessionUser.email || teacherId;

    return fetchJson(`${API_BASE_URL}/api/storage/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            ownerId: teacherId,
            schoolId,
            ownerName,
            subjectId: subject?.id || null,
            subjectName: subject?.name || null,
            yearId: subject?.yearId || null,
            yearLabel: subject ? getYearLabel(subject.yearId) : null,
            weekId: week?.id || null,
            weekName: week?.name || null
        })
    });
}

async function uploadFileToStorage(uploadUrl, file) {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
    });

    if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
    }
}

async function createDocumentMetadata(payload) {
    const response = await fetchJson(`${API_BASE_URL}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return response;
}

function formatFileSize(bytes) {
    if (typeof bytes !== 'number' || Number.isNaN(bytes)) {
        return 'Unknown';
    }

    const units = ['bytes', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const formatted = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
    return `${formatted} ${units[unitIndex]}`;
}