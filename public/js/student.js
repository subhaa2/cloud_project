// State management
let currentView = 'subjects';
let currentTab = 'school';
let currentSubjectTab = 'documents';
let currentSubject = null;
let currentWeek = null;
let currentDeck = null;

// Data structure
let schoolStorage = JSON.parse(localStorage.getItem('schoolStorage')) || { subjects: [] };
let personalStorage = JSON.parse(localStorage.getItem('personalStorage')) || { 
    documents: [], 
    flashcards: {}  // Structure: { subjectId: { deckId: [{ id, question, answer }] } }
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
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn:nth-child(${tab === 'school' ? '1' : '2'})`).classList.add('active');
    
    document.getElementById('schoolView').style.display = tab === 'school' ? 'block' : 'none';
    document.getElementById('personalView').style.display = tab === 'personal' ? 'block' : 'none';
    
    if (tab === 'personal') {
        loadPersonalDocuments();
    }
}

// Load and display subjects (from school storage)
function loadSubjects() {
    const subjectsContainer = document.getElementById('subjectsList');
    subjectsContainer.innerHTML = '';
    
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
    currentSubject = schoolStorage.subjects.find(s => s.id === subjectId);
    currentView = 'weekly';
    
    document.getElementById('subjectsView').style.display = 'none';
    document.getElementById('weeklyView').style.display = 'block';
    document.getElementById('documentsView').style.display = 'none';
    
    document.getElementById('currentSubjectTitle').textContent = currentSubject.name;
    document.getElementById('flashcardSubjectTitle').textContent = currentSubject.name;
    
    document.getElementById('documentsTab').style.display = 'block';
    document.getElementById('flashcardsTab').style.display = 'none';
    loadWeeks();
}

// Switch between Documents and Flashcards tabs within a subject
function switchSubjectTab(tab) {
    currentSubjectTab = tab;
    
    document.querySelectorAll('.subject-tab').forEach(btn => btn.classList.remove('active'));
    const buttons = document.querySelectorAll('.subject-tab');
    buttons[tab === 'documents' ? 0 : 1].classList.add('active');
    
    document.getElementById('documentsTab').style.display = tab === 'documents' ? 'block' : 'none';
    document.getElementById('flashcardsTab').style.display = tab === 'flashcards' ? 'block' : 'none';
    
    if (tab === 'flashcards') {
        showDecksView();
    }
}

// Show decks view
function showDecksView() {
    currentDeck = null;
    document.getElementById('flashcardDecksView').style.display = 'block';
    document.getElementById('flashcardDeckDetailView').style.display = 'none';
    loadDecks();
}

// Show deck detail view
function showDeckDetail(deckId) {
    currentDeck = deckId;
    document.getElementById('flashcardDecksView').style.display = 'none';
    document.getElementById('flashcardDeckDetailView').style.display = 'block';
    loadFlashcards();
}

// Load and display decks for current subject
function loadDecks() {
    const decksContainer = document.getElementById('decksList');
    decksContainer.innerHTML = '';
    
    const subjectFlashcards = personalStorage.flashcards[currentSubject.id] || {};
    const decks = Object.keys(subjectFlashcards);
    
    if (decks.length === 0) {
        decksContainer.innerHTML = '<p class="empty-state">No flashcard decks created yet. Click "+ Create Deck" to get started.</p>';
        return;
    }
    
    decks.forEach(deckId => {
        const cards = subjectFlashcards[deckId];
        const deckCard = document.createElement('div');
        deckCard.className = 'deck-card';
        deckCard.onclick = () => showDeckDetail(deckId);
        
        deckCard.innerHTML = `
            <h3>Deck ${parseInt(deckId) + 1}</h3>
            <p>${cards.length} card(s)</p>
        `;
        
        decksContainer.appendChild(deckCard);
    });
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
                <button class="copy-btn" onclick="copyToPersonal(${doc.id})">📋 Copy to Personal</button>
            </div>
            <div class="document-info">
                <p>Uploaded: ${dateStr}</p>
                <p>Size: ${doc.size || 'Unknown'}</p>
            </div>
        `;
        
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

// Load personal documents
function loadPersonalDocuments() {
    const documentsContainer = document.getElementById('personalDocumentsList');
    documentsContainer.innerHTML = '';
    
    if (personalStorage.documents.length === 0) {
        documentsContainer.innerHTML = '<p class="empty-state">No documents in personal storage yet. Copy documents from school storage to get started.</p>';
        return;
    }
    
    personalStorage.documents.forEach(doc => {
        const docCard = document.createElement('div');
        docCard.className = 'personal-doc-card';
        
        const copiedDate = new Date(doc.copiedAt);
        const dateStr = copiedDate.toLocaleDateString();
        
        docCard.innerHTML = `
            <div class="personal-doc-info">
                <h4>${doc.name}</h4>
                <p>From: ${doc.subjectName} • ${doc.weekName}</p>
                <p>Copied: ${dateStr}</p>
            </div>
            <div class="personal-doc-actions">
                <button class="whiteboard-btn" onclick="openWhiteboard(${doc.id})">🖊️ Open Whiteboard</button>
                <button class="delete-btn" onclick="deletePersonalDoc(${doc.id})">Delete</button>
            </div>
        `;
        
        documentsContainer.appendChild(docCard);
    });
}

// Open whiteboard (placeholder)
function openWhiteboard(docId) {
    const doc = personalStorage.documents.find(d => d.id === docId);
    if (!doc) return;
    
    alert(`Opening whiteboard for: ${doc.name}\n\nThis would open a canvas tool for annotating the document.`);
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

// Load and display flashcards for current deck
function loadFlashcards() {
    const flashcardsContainer = document.getElementById('flashcardsList');
    flashcardsContainer.innerHTML = '';
    
    if (!currentSubject || currentDeck === null) return;
    
    const subjectFlashcards = personalStorage.flashcards[currentSubject.id] || {};
    const deckFlashcards = subjectFlashcards[currentDeck] || [];
    
    if (deckFlashcards.length === 0) {
        flashcardsContainer.innerHTML = '<p class="empty-state">No flashcards in this deck yet. Click "+ Add Card" to create some.</p>';
        return;
    }
    
    deckFlashcards.forEach((flashcard, index) => {
        const card = document.createElement('div');
        card.className = 'flashcard-card';
        
        card.innerHTML = `
            <div class="flashcard-question">❓ ${flashcard.question}</div>
            <div class="flashcard-answer">💡 ${flashcard.answer}</div>
            <button class="flashcard-delete" onclick="deleteFlashcard(${flashcard.id})">Delete</button>
        `;
        
        flashcardsContainer.appendChild(card);
    });
    
    // Update deck title
    document.getElementById('deckTitle').textContent = `Deck ${parseInt(currentDeck) + 1}`;
}

// Show add flashcard modal
function showAddFlashcardModal() {
    document.getElementById('addFlashcardModal').classList.add('active');
    document.getElementById('flashcardQuestion').value = '';
    document.getElementById('flashcardAnswer').value = '';
}

// Add deck
function addDeck(name) {
    if (!personalStorage.flashcards[currentSubject.id]) {
        personalStorage.flashcards[currentSubject.id] = {};
    }
    
    const newDeckId = Object.keys(personalStorage.flashcards[currentSubject.id]).length;
    personalStorage.flashcards[currentSubject.id][newDeckId] = [];
    
    saveData();
    loadDecks();
    
    // Auto-open the new deck
    showDeckDetail(newDeckId);
}

// Show add deck modal
function showAddDeckModal() {
    addDeck();
}

// Add flashcard
function addFlashcard() {
    const question = document.getElementById('flashcardQuestion').value.trim();
    const answer = document.getElementById('flashcardAnswer').value.trim();
    
    if (!question || !answer) {
        alert('Please fill in both question and answer');
        return;
    }
    
    // If no deck exists, create one
    if (!personalStorage.flashcards[currentSubject.id]) {
        personalStorage.flashcards[currentSubject.id] = {};
    }
    
    const subjectFlashcards = personalStorage.flashcards[currentSubject.id];
    
    // If no deck selected or deck doesn't exist, create a new one
    if (currentDeck === null || !subjectFlashcards[currentDeck]) {
        currentDeck = Object.keys(subjectFlashcards).length;
        subjectFlashcards[currentDeck] = [];
    }
    
    const newFlashcard = {
        id: Date.now(),
        question: question,
        answer: answer,
        createdAt: new Date().toISOString()
    };
    
    subjectFlashcards[currentDeck].push(newFlashcard);
    saveData();
    loadFlashcards();
    closeModal();
}

// Delete flashcard
function deleteFlashcard(flashcardId) {
    if (!confirm('Are you sure you want to delete this flashcard?')) return;
    
    const subjectFlashcards = personalStorage.flashcards[currentSubject.id];
    if (!subjectFlashcards || !subjectFlashcards[currentDeck]) return;
    
    const index = subjectFlashcards[currentDeck].findIndex(f => f.id === flashcardId);
    if (index > -1) {
        subjectFlashcards[currentDeck].splice(index, 1);
        saveData();
        loadFlashcards();
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

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

console.log('Student dashboard loaded');