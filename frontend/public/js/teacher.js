// State management
let currentView = 'subjects';
let currentSubject = null;
let currentWeek = null;

const API_BASE_URL = 'http://localhost:5000';
const TEACHER_ID_KEY = 'teacherId';
const DEFAULT_TEACHER_ID = 'teacher-demo';
const DEFAULT_SCHOOL_ID = 'school-demo';

const teacherId = localStorage.getItem(TEACHER_ID_KEY) || DEFAULT_TEACHER_ID;

// Data structure
let schoolStorage = JSON.parse(localStorage.getItem('schoolStorage')) || {
    subjects: [
        { id: 'science', name: 'Science', weeks: [] },
        { id: 'mathematics', name: 'Mathematics', weeks: [] },
        { id: 'english', name: 'English', weeks: [] }
    ]
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSubjects();
    updateStats();
});

// Save data to localStorage
function saveData() {
    localStorage.setItem('schoolStorage', JSON.stringify(schoolStorage));
    localStorage.setItem(TEACHER_ID_KEY, teacherId);
}

function updateStats() {
    // Count subjects
    const subjectCount = schoolStorage.subjects.length;
    document.getElementById('subjectsCount').textContent = subjectCount;
    document.getElementById('subjectsCountNav').textContent = subjectCount;

    // Count total weeks across all subjects
    const totalWeeks = schoolStorage.subjects.reduce((count, subject) => {
        return count + subject.weeks.length;
    }, 0);
    document.getElementById('totalWeeks').textContent = totalWeeks;

    // Count total documents across all subjects and weeks
    const totalDocs = schoolStorage.subjects.reduce((count, subject) => {
        const docsInSubject = subject.weeks.reduce((weekCount, week) => {
            return weekCount + week.documents.length;
        }, 0);
        return count + docsInSubject;
    }, 0);
    document.getElementById('totalDocs').textContent = totalDocs;
}

// Load and display subjects
function loadSubjects() {
    const subjectsContainer = document.getElementById('subjectsList');
    subjectsContainer.innerHTML = '';

    schoolStorage.subjects.forEach(subject => {
        const subjectCard = document.createElement('div');
        subjectCard.className = 'subject-card';
        subjectCard.onclick = () => openSubject(subject.id);

        const docCount = subject.weeks.reduce((count, week) => count + week.documents.length, 0);

        subjectCard.innerHTML = `
      <h3>${subject.name}</h3>
      <p>${subject.weeks.length} weeks • ${docCount} documents</p>
    `;

        subjectsContainer.appendChild(subjectCard);
    });
}

// Open a subject to view its weeks
function openSubject(subjectId) {
    currentSubject = schoolStorage.subjects.find(s => s.id === subjectId);
    currentView = 'weekly';

    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';

    document.getElementById('currentSubjectTitle').textContent = currentSubject.name;
    loadWeeks();
}

// Load and display weeks for current subject
function loadWeeks() {
    const weeksContainer = document.getElementById('weeksList');
    weeksContainer.innerHTML = '';

    if (currentSubject.weeks.length === 0) {
        weeksContainer.innerHTML = '<p class="empty-state">No weeks added yet. Click "+ Add Week" to get started.</p>';
        return;
    }

    currentSubject.weeks.forEach(week => {
        const weekCard = document.createElement('div');
        weekCard.className = 'week-card';
        weekCard.onclick = () => openWeek(week.id);

        weekCard.innerHTML = `
      <div>
        <h3>${week.name}</h3>
        <span>${week.documents.length} document(s)</span>
      </div>
      <span>→</span>
    `;

        weeksContainer.appendChild(weekCard);
    });
}

// Open a week to view its documents
function openWeek(weekId) {
    currentWeek = currentSubject.weeks.find(w => w.id === weekId);
    currentView = 'documents';

    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'block';

    document.getElementById('currentWeekTitle').textContent = currentWeek.name;
    loadDocuments();
}

// Load and display documents for current week
async function loadDocuments() {
    const documentsContainer = document.getElementById('documentsList');
    documentsContainer.innerHTML = '<p class="empty-state">Loading documents...</p>';

    if (!currentWeek) {
        return;
    }

    try {
        const params = new URLSearchParams({
            ownerId: teacherId,
            weekId: currentWeek.id
        });

        const response = await fetch(`${API_BASE_URL}/api/documents?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Failed to load documents (${response.status})`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to load documents');
        }

        const documents = data.documents.map(mapDocumentFromApi);
        currentWeek.documents = documents;
        saveData();

        if (documents.length === 0) {
            documentsContainer.innerHTML = '<p class="empty-state">No documents uploaded yet. Click "+ Upload Document" to add documents.</p>';
            updateStats();
            return;
        }

        documentsContainer.innerHTML = '';
        documents.forEach(doc => {
            const docCard = createDocumentCard(doc);
            documentsContainer.appendChild(docCard);
        });

        updateStats();
    } catch (error) {
        console.error('Error loading documents:', error);
        documentsContainer.innerHTML = `<p class="empty-state">Failed to load documents. ${error.message}</p>`;
    }
}

// Show subjects view
function showSubjectsView() {
    currentView = 'subjects';
    document.getElementById('subjectsView').style.display = 'block';
    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'none';
}

// Show weekly view
function showWeeklyView() {
    currentView = 'weekly';
    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';
}

// Subject modal functions
function showAddSubjectModal() {
    document.getElementById('addSubjectModal').classList.add('active');
    document.getElementById('subjectNameInput').value = '';
}

function addSubject() {
    const name = document.getElementById('subjectNameInput').value.trim();
    if (!name) {
        alert('Please enter a subject name');
        return;
    }

    const newSubject = {
        id: Date.now(),
        name: name,
        weeks: []
    };

    schoolStorage.subjects.push(newSubject);
    saveData();
    loadSubjects();
    updateStats();
    closeModal();
}

// Week modal functions
function showAddWeekModal() {
    if (!currentSubject) return;

    document.getElementById('addWeekModal').classList.add('active');
    document.getElementById('weekNameInput').value = '';
}

function addWeek() {
    const name = document.getElementById('weekNameInput').value.trim();
    if (!name) {
        alert('Please enter a week name');
        return;
    }

    const newWeek = {
        id: `week-${Date.now()}`,
        name: name,
        documents: []
    };

    currentSubject.weeks.push(newWeek);
    saveData();
    loadWeeks();
    updateStats();
    closeModal();
}

// Handle file upload   
async function handleFileUpload(event) {
    const files = event.target.files;

    if (files.length === 0 || !currentWeek || !currentSubject) return;

    for (const file of files) {
        try {
            const storageInfo = await requestUploadUrl(file);
            await uploadFileToStorage(storageInfo.uploadUrl, file);

            const metadata = await createDocumentMetadata({
                title: file.name,
                type: file.type || 'application/octet-stream',
                storagePath: storageInfo.storagePath,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                ownerId: teacherId,
                schoolId: DEFAULT_SCHOOL_ID,
                subjectId: currentSubject.id,
                weekId: currentWeek.id
            });

            const formattedDoc = mapDocumentFromApi(metadata.document);
            currentWeek.documents.push(formattedDoc);
        } catch (error) {
            console.error('Failed to upload document:', error);
            alert(`Failed to upload ${file.name}: ${error.message}`);
        }
    }

    saveData();
    await loadDocuments();
    // Reset input
    event.target.value = '';
}

// Delete document
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Failed to delete document (${response.status})`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete document');
        }

        const index = currentWeek.documents.findIndex(d => d.id === docId);
        if (index > -1) {
            currentWeek.documents.splice(index, 1);
        }
        saveData();
        await loadDocuments();
    } catch (error) {
        console.error('Error deleting document:', error);
        alert(`Failed to delete document: ${error.message}`);
    }
}

// Close modal
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Add empty state styling
if (!document.querySelector('style[data-empty-state]')) {
    const style = document.createElement('style');
    style.setAttribute('data-empty-state', 'true');
    style.textContent = `
    .empty-state {
      text-align: center;
      padding: 48px;
      color: #718096;
      font-size: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  `;
    document.head.appendChild(style);
}

console.log('Teacher dashboard loaded');

function mapDocumentFromApi(doc) {
    const uploadedAt = doc.uploadedAt || doc.createdAt || Date.now();
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
        weekId: doc.weekId
    };
}

function createDocumentCard(doc) {
    const docCard = document.createElement('div');
    docCard.className = 'document-card';

    const date = new Date(doc.uploadedAt);
    const dateStr = date.toLocaleDateString();

    docCard.innerHTML = `
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
        <button class="delete-btn" data-doc-id="${doc.id}">
          Delete
        </button>
      `;

    const deleteBtn = docCard.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => deleteDocument(doc.id));

    return docCard;
}

async function requestUploadUrl(file) {
    const response = await fetch(`${API_BASE_URL}/api/storage/upload-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            ownerId: teacherId,
            schoolId: DEFAULT_SCHOOL_ID
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to get upload URL (${response.status})`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to get upload URL');
    }

    return data;
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
    const response = await fetch(`${API_BASE_URL}/api/documents`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Failed to create document metadata (${response.status})`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Failed to create document metadata');
    }

    return data;
}

function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) {
        return 'Unknown';
    }

    const units = ['bytes', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}