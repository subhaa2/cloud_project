const API_BASE_URL = 'http://localhost:5000';

const sessionUser = JSON.parse(localStorage.getItem('sessionUser') || 'null');
if (!sessionUser || sessionUser.role !== 'student') {
    window.location.href = 'index.html';
}

const schoolId = sessionUser.schoolId;
const preferredYearId = sessionUser.yearLevel || null;
const hasAssignedYear = Boolean(preferredYearId);
const personalStorageKey = sessionUser?.id ? `personalStorage:${sessionUser.id}` : 'personalStorage';

const dashboardState = {
    school: null,
    availableYears: [],
    currentYearId: preferredYearId || 'all',
    allSubjects: [],
    subjects: [],
    subjectWeeks: new Map(),
    weekDocuments: new Map(),
    currentSubjectId: null,
    currentWeekId: null
};

let personalStorage = loadPersonalStorage();
let currentPersonalSubject = null;
let currentEditingDocId = null;

function deriveStudentName(user) {
    if (!user) {
        return 'Student';
    }
    if (user.displayName && user.displayName.trim().length > 0) {
        return user.displayName;
    }
    if (user.email) {
        const [localPart] = user.email.split('@');
        return localPart || user.email;
    }
    return 'Student';
}

document.addEventListener('DOMContentLoaded', () => {
    initializeStudentDashboard().catch(error => {
        console.error('Failed to initialise student dashboard', error);
        showSubjectsMessage('Failed to load dashboard. Please try again later.');
    });
});

async function initializeStudentDashboard() {
    hydratePersonalDocs();
    setStudentProfile();
    updatePersonalDocCount();
    loadPersonalDocuments();

    await loadSchool();
    await loadAllSubjects();
    ensureAvailableYears();
    renderYearFilters();

    if (dashboardState.currentYearId && dashboardState.currentYearId !== 'all') {
        await onYearSelected(dashboardState.currentYearId);
    } else if (hasAssignedYear) {
        showSubjectsMessage('No subjects available for your year yet. Please check back later.');
    } else {
        showSubjectsMessage('Select a year from the navigation to view subjects.');
    }
}

function setStudentProfile() {
    const nameEl = document.querySelector('.header-profile .user-name');
    const metaEl = document.querySelector('.header-profile .user-meta');
    if (nameEl) {
        nameEl.textContent = deriveStudentName(sessionUser);
    }
    if (metaEl) {
        metaEl.textContent = 'Preparing your dashboard...';
    }
}

async function loadSchool() {
    const response = await fetchJson(`${API_BASE_URL}/api/schools/${schoolId}`);
    dashboardState.school = response.school;

    if (!preferredYearId && Array.isArray(dashboardState.school?.years) && dashboardState.school.years.length > 0) {
        dashboardState.currentYearId = dashboardState.school.years[0].id;
    }

    updateStudentMeta();
}

async function loadAllSubjects() {
    const params = new URLSearchParams({ schoolId });
    const response = await fetchJson(`${API_BASE_URL}/api/subjects?${params.toString()}`);
    dashboardState.allSubjects = sortSubjects(response.subjects || []);
}

function ensureAvailableYears() {
    const yearMap = new Map();

    if (Array.isArray(dashboardState.school?.years)) {
        dashboardState.school.years.forEach(year => {
            if (!year || !year.id) return;
            yearMap.set(year.id, {
                id: year.id,
                label: year.label || year.name || year.id,
                order: typeof year.order === 'number' ? year.order : Number.MAX_SAFE_INTEGER
            });
        });
    }

    dashboardState.allSubjects.forEach(subject => {
        if (!subject?.yearId) return;
        if (!yearMap.has(subject.yearId)) {
            yearMap.set(subject.yearId, {
                id: subject.yearId,
                label: getYearLabel(subject.yearId),
                order: Number.MAX_SAFE_INTEGER
            });
        }
    });

    const allYears = Array.from(yearMap.values());

    if (hasAssignedYear) {
        if (preferredYearId && yearMap.has(preferredYearId)) {
            dashboardState.availableYears = [yearMap.get(preferredYearId)];
        } else if (preferredYearId) {
            dashboardState.availableYears = [
                {
                    id: preferredYearId,
                    label: getYearLabel(preferredYearId),
                    order: Number.MAX_SAFE_INTEGER
                }
            ];
        } else {
            dashboardState.availableYears = allYears;
        }
        dashboardState.currentYearId = preferredYearId || dashboardState.currentYearId;
        updateStudentMeta();
        return;
    }

    dashboardState.availableYears = allYears;

    if ((!dashboardState.currentYearId || dashboardState.currentYearId === 'all') && dashboardState.availableYears.length > 0) {
        dashboardState.currentYearId = dashboardState.availableYears[0].id;
    }

    updateStudentMeta();
}

function filterSubjectsForCurrentYear() {
    if (!dashboardState.currentYearId || dashboardState.currentYearId === 'all') {
        if (hasAssignedYear && preferredYearId) {
            dashboardState.currentYearId = preferredYearId;
        } else {
            dashboardState.subjects = [];
            return;
        }
    }

    dashboardState.subjects = sortSubjects(
        dashboardState.allSubjects.filter(subject => subject.yearId === dashboardState.currentYearId)
    );

    dashboardState.subjectWeeks.clear();
    dashboardState.weekDocuments.clear();
    dashboardState.currentSubjectId = null;
    dashboardState.currentWeekId = null;
}

function renderYearFilters() {
    const filterChips = document.getElementById('studentYearFilters');
    const navContainer = document.getElementById('yearNavItems');
    const filterGroup = document.querySelector('#subjectsView .filter-group');
    const navSection = document.getElementById('yearNavSection');
    const subtitleEl = document.querySelector('#subjectsView .page-subtitle');
    const emptyState = document.getElementById('subjectsEmpty');

    if (hasAssignedYear) {
        if (filterGroup) filterGroup.style.display = 'none';
        if (navSection) navSection.style.display = 'none';
        if (subtitleEl) {
            const label = dashboardState.currentYearId ? getYearLabel(dashboardState.currentYearId) : 'your year';
            subtitleEl.textContent = `Browse documents for ${label}`;
        }
        if (emptyState) {
            emptyState.textContent = 'Your subjects will appear here once your teachers add them.';
        }
        return;
    }

    if (filterGroup) filterGroup.style.display = '';
    if (navSection) navSection.style.display = '';
    if (emptyState) {
        emptyState.textContent = 'Select a year from the navigation to view subjects.';
    }

    if (filterChips) filterChips.innerHTML = '';
    if (navContainer) navContainer.innerHTML = '';

    const options = computeStudentYearOptions();
    options.forEach(option => {
        if (filterChips) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `filter-chip${dashboardState.currentYearId === option.id ? ' active' : ''}`;
            chip.textContent = option.label;
            chip.addEventListener('click', () => onYearSelected(option.id));
            filterChips.appendChild(chip);
        }

        if (navContainer && option.id !== 'all') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `year-nav-btn${dashboardState.currentYearId === option.id ? ' active' : ''}`;
            btn.innerHTML = `
                <span>${option.label}</span>
                <span>${countDocsForYear(option.id)} docs</span>
            `;
            btn.dataset.yearId = option.id;
            btn.addEventListener('click', () => onYearSelected(option.id));
            navContainer.appendChild(btn);
        }
    });
}

function onYearSelected(yearId) {
    dashboardState.currentYearId = yearId;
    renderYearFilters();
    filterSubjectsForCurrentYear();
    renderSubjects();
    updateSchoolDocsCount();
}

function computeStudentYearOptions() {
    const mapped = dashboardState.availableYears.map(year => ({
        id: year.id,
        label: year.label || year.name || year.id,
        order: typeof year.order === 'number' ? year.order : Number.MAX_SAFE_INTEGER
    }));

    mapped.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

    return [{ id: 'all', label: 'All Years', order: -1 }, ...mapped];
}

function sortSubjects(subjects) {
    return [...subjects].sort((a, b) => {
        const orderA = findYearOrder(a.yearId);
        const orderB = findYearOrder(b.yearId);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });
}

function findYearOrder(yearId) {
    const fromSchool = dashboardState.school?.years || [];
    const available = dashboardState.availableYears || [];

    const source = fromSchool.length > 0 ? fromSchool : available;

    if (!yearId || !Array.isArray(source)) {
        return Number.MAX_SAFE_INTEGER;
    }

    const match = source.find(year => year.id === yearId);
    if (match && typeof match.order === 'number') {
        return match.order;
    }
    const index = source.findIndex(year => year.id === yearId);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function formatSubjectSummary({ weeksCount, documentsCount }) {
    return `${weeksCount} week${weeksCount === 1 ? '' : 's'} • ${documentsCount} document${documentsCount === 1 ? '' : 's'}`;
}

function getSubjectSummary(subjectId) {
    const weeks = dashboardState.subjectWeeks.get(subjectId) || [];
    const documentsCount = weeks.reduce((sum, week) => sum + (week.documentCount || 0), 0);
    return {
        weeksCount: weeks.length,
        documentsCount
    };
}

function updateSubjectCardSummary(subjectId) {
    const card = document.querySelector(`.subject-card[data-subject-id="${subjectId}"]`);
    if (!card) {
        return;
    }
    const summaryEl = card.querySelector('.subject-card-summary');
    if (!summaryEl) {
        return;
    }
    const summary = getSubjectSummary(subjectId);
    summaryEl.textContent = formatSubjectSummary(summary);
}

async function preloadSubjectSummary(subjectId) {
    if (!subjectId) {
        return;
    }

    if (dashboardState.subjectWeeks.has(subjectId)) {
        updateSubjectCardSummary(subjectId);
        return;
    }

    try {
        await ensureWeeksForSubject(subjectId);
        updateSubjectCardSummary(subjectId);
        updateSchoolDocsCount();
    } catch (error) {
        console.error(`Failed to load summary for subject ${subjectId}`, error);
    }
}

function renderSubjects() {
    const container = document.getElementById('subjectsList');
    const emptyState = document.getElementById('subjectsEmpty');
    if (!container) return;

    container.innerHTML = '';

    if (!dashboardState.currentYearId || dashboardState.currentYearId === 'all') {
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.textContent = 'Select a year from the navigation to view subjects.';
        }
        return;
    }

    if (emptyState) {
        emptyState.style.display = 'none';
    }

    if (dashboardState.subjects.length === 0) {
        const message = hasAssignedYear
            ? 'No subjects available for your year yet. Please check back later.'
            : 'No subjects available yet.';
        container.innerHTML = `<p class="empty-state">${message}</p>`;
        return;
    }

    dashboardState.subjects.forEach(subject => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.dataset.subjectId = subject.id;
        card.addEventListener('click', () => openSubject(subject.id));

        const yearLabel = getYearLabel(subject.yearId);
        const summary = formatSubjectSummary(getSubjectSummary(subject.id));

        card.innerHTML = `
            <div class="subject-card-header">
                <h3>${subject.name}</h3>
                <span class="subject-card-year">${yearLabel}</span>
            </div>
            <p class="subject-card-summary">${summary}</p>
        `;

        container.appendChild(card);

        if (!dashboardState.subjectWeeks.has(subject.id)) {
            preloadSubjectSummary(subject.id);
        }
    });
}

function getYearLabel(yearId) {
    if (!yearId) return 'General';
    const match = dashboardState.school?.years?.find(year => year.id === yearId);
    return match ? match.label || match.name || yearId : yearId;
}

async function openSubject(subjectId) {
    dashboardState.currentSubjectId = subjectId;
    await ensureWeeksForSubject(subjectId);

    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';

    const subject = getCurrentSubject();
    document.getElementById('currentSubjectTitle').textContent = subject ? subject.name : 'Subject';

    renderWeeks(subjectId);
}

function getCurrentSubject() {
    return dashboardState.subjects.find(subject => subject.id === dashboardState.currentSubjectId) || null;
}

async function ensureWeeksForSubject(subjectId) {
    if (dashboardState.subjectWeeks.has(subjectId)) {
        return dashboardState.subjectWeeks.get(subjectId);
    }

    const params = new URLSearchParams({ subjectId });
    const response = await fetchJson(`${API_BASE_URL}/api/weeks?${params.toString()}`);

    const weeks = sortWeeks(response.weeks || []);
    for (const week of weeks) {
        await ensureDocumentsForWeek(subjectId, week.id);
        const docs = dashboardState.weekDocuments.get(week.id) || [];
        week.documentCount = docs.length;
    }
    dashboardState.subjectWeeks.set(subjectId, weeks);
    updateSubjectCardSummary(subjectId);

    return weeks;
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

function renderWeeks(subjectId) {
    const container = document.getElementById('weeksList');
    if (!container) return;

    container.innerHTML = '';
    const weeks = dashboardState.subjectWeeks.get(subjectId) || [];

    if (weeks.length === 0) {
        container.innerHTML = '<p class="empty-state">No weeks available yet.</p>';
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
    dashboardState.currentWeekId = weekId;
    await ensureDocumentsForWeek(dashboardState.currentSubjectId, weekId);

    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'block';

    const week = getCurrentWeek();
    document.getElementById('currentWeekTitle').textContent = week ? week.name : 'Week Documents';

    renderDocuments();
    updateSchoolDocsCount();
}

function getCurrentWeek() {
    const weeks = dashboardState.subjectWeeks.get(dashboardState.currentSubjectId) || [];
    return weeks.find(week => week.id === dashboardState.currentWeekId) || null;
}

async function ensureDocumentsForWeek(subjectId, weekId, options = {}) {
    if (!subjectId || !weekId) {
        return [];
    }
    return fetchDocumentsForWeek(subjectId, weekId, { preferCache: true, ...options });
}

function renderDocuments() {
    const container = document.getElementById('documentsList');
    if (!container) return;

    container.innerHTML = '';
    const docs = dashboardState.weekDocuments.get(dashboardState.currentWeekId) || [];

    if (docs.length === 0) {
        container.innerHTML = '<p class="empty-state">No documents available.</p>';
        return;
    }

    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'document-card';

        const date = new Date(doc.uploadedAt);
        const dateStr = isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();

        card.innerHTML = `
            <div class="document-card-header">
                <h4>${doc.name}</h4>
                <button class="copy-btn" data-doc-id="${doc.id}">📋 Copy to Personal</button>
            </div>
            <div class="document-info">
                <p>Uploaded: ${dateStr}</p>
                <p>Size: ${doc.size || 'Unknown'}</p>
            </div>
        `;

        card.querySelector('.copy-btn').addEventListener('click', event => {
            event.stopPropagation();
            copyToPersonal(doc.id);
        });

        container.appendChild(card);
    });
}

async function copyToPersonal(docId) {
    const docs = dashboardState.weekDocuments.get(dashboardState.currentWeekId) || [];
    const doc = docs.find(item => item.id === docId);
    const subject = getCurrentSubject();
    const week = getCurrentWeek();

    if (!doc || !subject || !week) return;
    if (!sessionUser?.id) {
        alert('Unable to copy document: missing student session information.');
        return;
    }

    try {
        const response = await fetchJson(`${API_BASE_URL}/api/storage/copy-to-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                documentId: doc.id,
                studentId: sessionUser.id,
                studentName: deriveStudentName(sessionUser),
                subjectName: subject.name,
                weekName: week.name
            })
        });

        const copiedDoc = mapDocumentFromApi(response.document);
        const personalDoc = {
            ...copiedDoc,
            copiedAt: new Date().toISOString(),
            subjectId: subject.id,
            subjectName: subject.name,
            weekId: week.id,
            weekName: week.name,
            content: doc.content || '',
            visibility: 'personal'
        };

        personalStorage.documents.push(personalDoc);
        savePersonalStorage();
        updatePersonalDocCount();
        loadPersonalDocuments();
        alert('Document copied to personal storage!');
    } catch (error) {
        console.error('Failed to copy document to personal storage', error);
        alert(error.message || 'Failed to copy document. Please try again.');
    }
}

function switchTab(tab) {
    const navItems = Array.from(document.querySelectorAll('.sidebar .nav-item'));
    navItems.forEach(item => item.classList.remove('active'));

    if (tab === 'school') {
        const schoolNav = document.getElementById('schoolNavItem');
        if (schoolNav) {
            schoolNav.classList.add('active');
        }
        document.getElementById('schoolView').style.display = 'block';
        document.getElementById('personalView').style.display = 'none';
        showSubjectsView();
    } else {
        const personalNav = document.getElementById('personalNavItem');
        if (personalNav) {
            personalNav.classList.add('active');
        }
        document.getElementById('schoolView').style.display = 'none';
        document.getElementById('personalView').style.display = 'block';
        loadPersonalDocuments();
    }
}

function switchSubjectTab(tab) {
    document.querySelectorAll('.subject-tab').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('.subject-tab');
    buttons[tab === 'documents' ? 0 : 1].classList.add('active');

    document.getElementById('documentsTab').style.display = tab === 'documents' ? 'block' : 'none';
    document.getElementById('flashcardsTab').style.display = tab === 'flashcards' ? 'block' : 'none';
}

function showSubjectsView() {
    dashboardState.currentSubjectId = null;
    dashboardState.currentWeekId = null;

    document.getElementById('subjectsView').style.display = 'block';
    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'none';
}

function showWeeklyView() {
    dashboardState.currentWeekId = null;
    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';
}

function showSubjectsMessage(message) {
    const container = document.getElementById('subjectsList');
    if (!container) return;
    container.innerHTML = `<p class="empty-state">${message}</p>`;
}

function updateStudentMeta() {
    const metaEl = document.querySelector('.header-profile .user-meta');
    if (!metaEl) {
        return;
    }

    const details = [];

    if (dashboardState.school?.name) {
        details.push(dashboardState.school.name);
    }

    const yearLabel = preferredYearId ? getYearLabel(preferredYearId) : 'All years';
    if (yearLabel) {
        details.push(yearLabel);
    }

    if (sessionUser.email) {
        details.push(sessionUser.email);
    }

    metaEl.textContent = details.join(' • ');
}

function updateSchoolDocsCount() {
    const count = Array.from(dashboardState.weekDocuments.values()).reduce((sum, docs) => sum + docs.length, 0);
    const badge = document.getElementById('schoolDocsCount');
    if (badge) {
        badge.textContent = count;
    }

    const navContainer = document.getElementById('yearNavItems');
    if (navContainer) {
        Array.from(navContainer.children).forEach(btn => {
            const yearId = btn.dataset.yearId;
            if (!yearId) return;
            const docCount = countDocsForYear(yearId);
            const textSpans = btn.querySelectorAll('span');
            if (textSpans[1]) {
                textSpans[1].textContent = `${docCount} docs`;
            }
        });
    }
}

function loadPersonalDocuments() {
    const subjectsContainer = document.getElementById('personalSubjectsList');
    if (!subjectsContainer) return;

    subjectsContainer.innerHTML = '';
    updatePersonalDocCount();
    const subjectsMap = new Map();

    personalStorage.documents.forEach(doc => {
        if (!subjectsMap.has(doc.subjectName)) {
            subjectsMap.set(doc.subjectName, {
                name: doc.subjectName,
                id: doc.subjectId,
                docCount: 0
            });
        }
        subjectsMap.get(doc.subjectName).docCount += 1;
    });

    if (subjectsMap.size === 0) {
        subjectsContainer.innerHTML = '<p class="empty-state">No documents in personal storage yet. Copy documents from school storage to get started.</p>';
        return;
    }

    subjectsMap.forEach(subject => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.addEventListener('click', () => openPersonalSubject(subject.name));

        card.innerHTML = `
            <h3>${subject.name}</h3>
            <p>${subject.docCount} document${subject.docCount === 1 ? '' : 's'} saved</p>
        `;

        subjectsContainer.appendChild(card);
    });
}

function openPersonalSubject(subjectName) {
    currentPersonalSubject = subjectName;
    document.getElementById('personalSubjectsView').style.display = 'none';
    document.getElementById('personalSubjectView').style.display = 'block';

    document.getElementById('currentPersonalSubjectTitle').textContent = subjectName;
    document.getElementById('flashcardSubjectName').textContent = subjectName;

    switchPersonalTab('documents');
}

function showPersonalSubjectsView() {
    document.getElementById('personalSubjectsView').style.display = 'block';
    document.getElementById('personalSubjectView').style.display = 'none';
}

function switchPersonalTab(tab) {
    document.querySelectorAll('#personalSubjectView .subject-tab').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('#personalSubjectView .subject-tab');
    buttons[tab === 'documents' ? 0 : 1].classList.add('active');

    document.getElementById('personalDocumentsTab').style.display = tab === 'documents' ? 'block' : 'none';
    document.getElementById('personalFlashcardsTab').style.display = tab === 'flashcards' ? 'block' : 'none';

    if (tab === 'documents') {
        loadPersonalSubjectDocuments(currentPersonalSubject);
    } else if (typeof window.refreshPersonalFlashcardDeckList === 'function') {
        window.refreshPersonalFlashcardDeckList();
    }
}

function loadPersonalSubjectDocuments(subjectName) {
    const container = document.getElementById('personalDocumentsList');
    if (!container) return;

    container.innerHTML = '';
    updatePersonalDocCount();
    const docs = personalStorage.documents.filter(doc => doc.subjectName === subjectName);

    if (docs.length === 0) {
        container.innerHTML = '<p class="empty-state">No documents saved for this subject yet.</p>';
        return;
    }

    docs.forEach(doc => {
        const copiedDate = new Date(doc.copiedAt);
        const dateStr = isNaN(copiedDate.getTime()) ? 'Unknown date' : copiedDate.toLocaleDateString();

        const card = document.createElement('div');
        card.className = 'document-card';
        card.innerHTML = `
            <div class="document-card-main">
                <div class="document-details">
                    <h4>${doc.name}</h4>
                    <div class="document-meta">
                        <span class="meta-item">📅 Copied: ${dateStr}</span>
                        <span class="meta-item">📦 ${doc.size || 'Unknown'}</span>
                        <span class="meta-item">📚 From: ${doc.weekName}</span>
                    </div>
                    <p class="document-preview">${(doc.content || '').substring(0, 120) || 'No notes yet.'}</p>
                </div>
            </div>
            <div class="document-actions">
                <button class="whiteboard-btn" data-doc-id="${doc.id}">🎨 Whiteboard</button>
                <button class="btn-secondary" data-doc-id="${doc.id}">✏️ Edit</button>
                <button class="delete-btn" data-doc-id="${doc.id}">Delete</button>
            </div>
        `;

        const whiteboardBtn = card.querySelector('.whiteboard-btn');
        if (whiteboardBtn) {
            whiteboardBtn.addEventListener('click', event => {
                event.stopPropagation();
                openWhiteboard(doc.id);
            });
        }

        const editBtn = card.querySelector('.btn-secondary');
        if (editBtn) {
            editBtn.addEventListener('click', event => {
                event.stopPropagation();
                openDocumentEditor(doc.id);
            });
        }

        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', event => {
                event.stopPropagation();
                deletePersonalDoc(doc.id);
            });
        }

        container.appendChild(card);
    });
}

function deletePersonalDoc(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    const index = personalStorage.documents.findIndex(doc => doc.id === docId);
    if (index > -1) {
        personalStorage.documents.splice(index, 1);
        savePersonalStorage();
        loadPersonalDocuments();
        if (currentPersonalSubject) {
            loadPersonalSubjectDocuments(currentPersonalSubject);
        }
        updatePersonalDocCount();
    }
}

function openDocumentEditor(docId) {
    const doc = personalStorage.documents.find(item => item.id === docId);
    if (!doc) return;

    currentEditingDocId = docId;
    document.getElementById('documentEditorTitle').textContent = doc.name;
    document.getElementById('documentEditorTextarea').value = doc.content || '';
    document.getElementById('documentEditor').style.display = 'block';
}

function closeDocumentEditor() {
    currentEditingDocId = null;
    document.getElementById('documentEditor').style.display = 'none';
}

function saveDocumentEdits() {
    if (!currentEditingDocId) return;
    const doc = personalStorage.documents.find(item => item.id === currentEditingDocId);
    if (!doc) return;

    doc.content = document.getElementById('documentEditorTextarea').value.trim();
    savePersonalStorage();
    if (currentPersonalSubject) {
        loadPersonalSubjectDocuments(currentPersonalSubject);
    }
    closeDocumentEditor();
}

function openWhiteboard(docId) {
    const doc = personalStorage.documents.find(item => item.id === docId);
    if (!doc) return;

    localStorage.setItem('currentWhiteboardDoc', JSON.stringify(doc));
    window.location.href = `/whiteboard/index.html?room=${encodeURIComponent(docId)}`;
}

function updatePersonalDocCount() {
    const badge = document.getElementById('personalDocCount');
    if (badge) {
        badge.textContent = personalStorage.documents.length;
    }
    const headerBadge = document.querySelector('.stats-badge strong');
    if (headerBadge) {
        headerBadge.textContent = personalStorage.documents.length;
    }
}

function loadPersonalStorage() {
    try {
        if (sessionUser?.id) {
            const legacyKey = 'personalStorage';
            const legacyValue = localStorage.getItem(legacyKey);
            if (legacyValue && !localStorage.getItem(personalStorageKey)) {
                localStorage.setItem(personalStorageKey, legacyValue);
                localStorage.removeItem(legacyKey);
            }
        }
        const stored = localStorage.getItem(personalStorageKey);
        return stored ? JSON.parse(stored) : { documents: [] };
    } catch (error) {
        console.error('Failed to parse personal storage', error);
        return { documents: [] };
    }
}

function savePersonalStorage() {
    localStorage.setItem(personalStorageKey, JSON.stringify(personalStorage));
}

function hydratePersonalDocs() {
    let mutated = false;
    personalStorage.documents = personalStorage.documents.map(doc => {
        if (doc.content === undefined) {
            mutated = true;
            return { ...doc, content: '' };
        }
        return doc;
    });
    if (mutated) savePersonalStorage();
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

function countDocsForYear(yearId) {
    let total = 0;
    const subjects = dashboardState.allSubjects.filter(subject => subject.yearId === yearId);
    subjects.forEach(subject => {
        const weeks = dashboardState.subjectWeeks.get(subject.id) || [];
        weeks.forEach(week => {
            total += week.documentCount || 0;
        });
    });
    return total;
}

async function fetchDocumentsForWeek(subjectId, weekId, { preferCache = false } = {}) {
    if (preferCache && dashboardState.weekDocuments.has(weekId)) {
        return dashboardState.weekDocuments.get(weekId);
    }

    const params = new URLSearchParams({ weekId, visibility: 'school' });
    if (subjectId) {
        params.set('subjectId', subjectId);
    }
    if (schoolId) {
        params.set('schoolId', schoolId);
    }
    const response = await fetchJson(`${API_BASE_URL}/api/documents?${params.toString()}`);
    const documents = (response.documents || []).map(mapDocumentFromApi);
    dashboardState.weekDocuments.set(weekId, documents);

    const subjectWeeks = dashboardState.subjectWeeks.get(subjectId) || [];
    subjectWeeks.forEach(week => {
        if (week.id === weekId) {
            week.documentCount = documents.length;
        }
    });

    updateSubjectCardSummary(subjectId);
    updateSchoolDocsCount();

    return documents;
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