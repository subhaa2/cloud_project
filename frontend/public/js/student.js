// State management
let currentView = 'subjects';
let currentTab = 'school';
let currentSubjectTab = 'documents';
let currentSubject = null;
let currentWeek = null;
let currentPersonalSubject = null; 
let currentEditingDocId = null;

// Data structure
let schoolStorage = JSON.parse(localStorage.getItem('schoolStorage')) || { subjects: [] };
let personalStorage = JSON.parse(localStorage.getItem('personalStorage')) || {
    documents: [],
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSubjects();
    loadPersonalDocuments();
    updateDocCount();
});

// Save data to localStorage
function saveData() {
    localStorage.setItem('schoolStorage', JSON.stringify(schoolStorage));
    localStorage.setItem('personalStorage', JSON.stringify(personalStorage));
}

// Switch between School and Personal tabs
function switchTab(tab) {
    currentTab = tab;

    // Update sidebar active states
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Get the clicked nav item and mark it active
    const navItems = document.querySelectorAll('.nav-item');
    if (tab === 'school') {
        navItems[0].classList.add('active'); // School Storage
    } else if (tab === 'personal') {
        navItems[1].classList.add('active'); // Personal Storage
    }

    // Hide all views first
    document.getElementById('schoolView').style.display = 'none';
    document.getElementById('personalView').style.display = 'none';

    // Show the appropriate view
    if (tab === 'school') {
        document.getElementById('schoolView').style.display = 'block';
        // Make sure we're showing the subjects view, not weekly or documents
        document.getElementById('subjectsView').style.display = 'block';
        document.getElementById('weeklyView').style.display = 'none';
        document.getElementById('documentsView').style.display = 'none';
        // Reset navigation state
        currentView = 'subjects';
    } else if (tab === 'personal') {
        document.getElementById('personalView').style.display = 'block';
        loadPersonalDocuments();
    }
}

// Switch between Documents and Flashcards tabs within a subject
function switchSubjectTab(tab) {
    currentSubjectTab = tab;

    document.querySelectorAll('.subject-tab').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('.subject-tab');
    buttons[tab === 'documents' ? 0 : 1].classList.add('active');

    document.getElementById('documentsTab').style.display = tab === 'documents' ? 'block' : 'none';
    document.getElementById('flashcardsTab').style.display = tab === 'flashcards' ? 'block' : 'none';

}

// Load and display weeks for current subject
function loadWeeks() {
    const weeksContainer = document.getElementById('weeksList');
    weeksContainer.innerHTML = '';

    if (currentSubject.weeks.length === 0) {
        weeksContainer.innerHTML = '<p class="empty-state">No weeks available yet.</p>';
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
function loadDocuments() {
    const documentsContainer = document.getElementById('documentsList');
    documentsContainer.innerHTML = '';

    if (currentWeek.documents.length === 0) {
        documentsContainer.innerHTML = '<p class="empty-state">No documents available.</p>';
        return;
    }

    currentWeek.documents.forEach(doc => {
        const docCard = document.createElement('div');
        docCard.className = 'document-card';

        const date = new Date(doc.uploadedAt);
        const dateStr = date.toLocaleDateString();

        docCard.innerHTML = `
            <div class="document-card-header">
                <h4>${doc.name}</h4>
                <button class="copy-btn" data-doc-id="${doc.id}">📋 Copy to Personal</button>
            </div>
            <div class="document-info">
                <p>Uploaded: ${dateStr}</p>
                <p>Size: ${doc.size || 'Unknown'}</p>
            </div>
        `;
        
        const copyBtn = docCard.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => copyToPersonal(doc.id));

        documentsContainer.appendChild(docCard);
    });
}

// Copy document to personal storage
function copyToPersonal(docId) {
    const doc = currentWeek.documents.find(d => d.id === docId);
    if (!doc) return;

    const personalDoc = {
        ...doc,
        id: Date.now(),
        copiedAt: new Date().toISOString(),
        subjectId: currentSubject.id,
        subjectName: currentSubject.name,
        weekId: currentWeek.id,
        weekName: currentWeek.name
    };

    personalStorage.documents.push(personalDoc);
    saveData();
    updateDocCount();

    alert('Document copied to personal storage!');
}

// Load personal storage subjects
function loadPersonalDocuments() {
    const subjectsContainer = document.getElementById('personalSubjectsList');
    subjectsContainer.innerHTML = '';

    // Get all unique subjects from personal documents
    const subjectsMap = new Map();

    personalStorage.documents.forEach(doc => {
        if (!subjectsMap.has(doc.subjectName)) {
            subjectsMap.set(doc.subjectName, {
                name: doc.subjectName,
                id: doc.subjectId,
                docCount: 0
            });
        }
        subjectsMap.get(doc.subjectName).docCount++;
    });

    if (subjectsMap.size === 0) {
        subjectsContainer.innerHTML = '<p class="empty-state">No documents in personal storage yet. Copy documents from school storage to get started.</p>';
        return;
    }

    // Display subjects
    subjectsMap.forEach((subject, subjectName) => {
        const subjectCard = document.createElement('div');
        subjectCard.className = 'subject-card';
        subjectCard.onclick = () => openPersonalSubject(subjectName);

        subjectCard.innerHTML = `
            <h3>${subject.name}</h3>
            <p>${subject.docCount} document${subject.docCount !== 1 ? 's' : ''} saved</p>
        `;

        subjectsContainer.appendChild(subjectCard);
    });

    // Also create wrapper for personalDocumentsList
    const existingContainer = document.getElementById('personalDocumentsList');
    if (!existingContainer) {
        const container = document.createElement('div');
        container.id = 'personalDocumentsList';
        container.className = 'document-cards';
    }
}

// Open a personal subject
function openPersonalSubject(subjectName) {
    currentPersonalSubject = subjectName;
    currentView = 'personal-subject';

    document.getElementById('personalSubjectsView').style.display = 'none';
    document.getElementById('personalSubjectView').style.display = 'block';

    document.getElementById('currentPersonalSubjectTitle').textContent = subjectName;
    document.getElementById('flashcardSubjectName').textContent = subjectName;

    // Show documents tab by default
    switchPersonalTab('documents');
}

// Show personal subjects view
function showPersonalSubjectsView() {
    document.getElementById('personalSubjectsView').style.display = 'block';
    document.getElementById('personalSubjectView').style.display = 'none';
}

// Switch between documents and flashcards in personal storage
function switchPersonalTab(tab) {
    document.querySelectorAll('#personalSubjectView .subject-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const buttons = document.querySelectorAll('#personalSubjectView .subject-tab');
    buttons[tab === 'documents' ? 0 : 1].classList.add('active');

    document.getElementById('personalDocumentsTab').style.display = tab === 'documents' ? 'block' : 'none';
    document.getElementById('personalFlashcardsTab').style.display = tab === 'flashcards' ? 'block' : 'none';

    if (tab === 'documents') {
        loadPersonalSubjectDocuments(currentPersonalSubject);
    }
}

// Load documents for a specific personal subject
function loadPersonalSubjectDocuments(subjectName) {
    const documentsContainer = document.getElementById('personalDocumentsList');
    documentsContainer.innerHTML = '';
    
    const subjectDocs = personalStorage.documents.filter(doc => doc.subjectName === subjectName);
    
    if (subjectDocs.length === 0) {
        documentsContainer.innerHTML = '<p class="empty-state">No documents saved for this subject yet.</p>';
        return;
    }
    
    subjectDocs.forEach(doc => {
        const docCard = document.createElement('div');
        docCard.className = 'document-card';
        
        const copiedDate = new Date(doc.copiedAt);
        const dateStr = copiedDate.toLocaleDateString();
        
        docCard.innerHTML = `
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
                <button class="whiteboard-btn" onclick="openWhiteboard(${doc.id})">
                    🎨 Whiteboard
                </button>
                <button class="btn-secondary" onclick="openDocumentEditor(${doc.id})">
                    ✏️ Edit
                </button>
                <button class="delete-btn" onclick="deletePersonalDoc(${doc.id})">
                    Delete
                </button>
            </div>
        `;
        
        documentsContainer.appendChild(docCard);
    });
}
// Delete personal document
function deletePersonalDoc(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    const index = personalStorage.documents.findIndex(d => d.id === docId);
    if (index > -1) {
        personalStorage.documents.splice(index, 1);
        saveData();
        loadPersonalDocuments();
        updateDocCount();
    }
}

// Navigation functions
function showSubjectsView() {
    currentView = 'subjects';
    document.getElementById('subjectsView').style.display = 'block';
    document.getElementById('weeklyView').style.display = 'none';
    document.getElementById('documentsView').style.display = 'none';
}

function showWeeklyView() {
    currentView = 'weekly';
    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';
}

function updateDocCount() {
    document.getElementById('personalDocCount').textContent = personalStorage.documents.length;
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
    if (mutated) saveData();
  }
  hydratePersonalDocs();

  // copy button now clones the teacher doc and makes it editable
function copyToPersonal(docId) {
    const doc = currentWeek.documents.find(d => d.id === docId);
    if (!doc) return;
  
    const personalDoc = {
      ...doc,
      id: Date.now(),
      copiedAt: new Date().toISOString(),
      subjectId: currentSubject.id,
      subjectName: currentSubject.name,
      weekId: currentWeek.id,
      weekName: currentWeek.name,
      content: doc.content || ''
    };
  
    personalStorage.documents.push(personalDoc);
    saveData();
    updateDocCount();
    alert('Document copied to personal storage!');
  }

// editor helpers
function openDocumentEditor(docId) {
const doc = personalStorage.documents.find(d => d.id === docId);
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
    const doc = personalStorage.documents.find(d => d.id === currentEditingDocId);
    if (!doc) return;
  
    doc.content = document.getElementById('documentEditorTextarea').value.trim();
    saveData();
    loadPersonalSubjectDocuments(currentPersonalSubject);
    closeDocumentEditor();
  }

// Open whiteboard
function openWhiteboard(docId) {
    const doc = personalStorage.documents.find(d => d.id === docId);
    if (!doc) return;

    // Navigate to whiteboard page with document info
    localStorage.setItem('currentWhiteboardDoc', JSON.stringify(doc));
    window.location.href = `/whiteboard/index.html?room=${encodeURIComponent(docId)}`;
}

// Load and display subjects (from school storage)
function loadSubjects() {
    const subjectsContainer = document.getElementById('subjectsList');
    subjectsContainer.innerHTML = '';

    // Add debugging
    console.log('School storage:', schoolStorage);
    console.log('Subjects:', schoolStorage.subjects);

    if (schoolStorage.subjects.length === 0) {
        subjectsContainer.innerHTML = '<p class="empty-state">No subjects available yet.</p>';
        return;
    }

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
    console.log('Opening subject with ID:', subjectId, 'Type:', typeof subjectId);
    currentSubject = schoolStorage.subjects.find(s => s.id === subjectId);
    console.log('Found subject:', currentSubject);

    if (!currentSubject) {
        console.error('Subject not found! Available subjects:', schoolStorage.subjects);
        return;
    }

    currentView = 'weekly';

    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';

    document.getElementById('currentSubjectTitle').textContent = currentSubject.name;

    document.getElementById('documentsTab').style.display = 'block';
    document.getElementById('flashcardsTab').style.display = 'none';
    loadWeeks();
}

// Check what's actually in localStorage
console.log('schoolStorage:', localStorage.getItem('schoolStorage'));