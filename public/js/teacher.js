// State management
let currentView = 'subjects';
let currentSubject = null;
let currentWeek = null;

// Data structure
let schoolStorage = JSON.parse(localStorage.getItem('schoolStorage')) || {
  subjects: [
    { id: 1, name: 'Science', weeks: [] },
    { id: 2, name: 'Mathematics', weeks: [] },
    { id: 3, name: 'English', weeks: [] }
  ]
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSubjects();
});

// Save data to localStorage
function saveData() {
  localStorage.setItem('schoolStorage', JSON.stringify(schoolStorage));
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
function loadDocuments() {
  const documentsContainer = document.getElementById('documentsList');
  documentsContainer.innerHTML = '';
  
  if (currentWeek.documents.length === 0) {
    documentsContainer.innerHTML = '<p class="empty-state">No documents uploaded yet. Click "+ Upload Document" to add documents.</p>';
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
        <button class="delete-btn" onclick="deleteDocument(${doc.id})">Delete</button>
      </div>
      <div class="document-info">
        <p>Uploaded: ${dateStr}</p>
        <p>Size: ${doc.size || 'Unknown'}</p>
      </div>
    `;
    
    documentsContainer.appendChild(docCard);
  });
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
    id: Date.now(),
    name: name,
    documents: []
  };
  
  currentSubject.weeks.push(newWeek);
  saveData();
  loadWeeks();
  closeModal();
}

// Handle file upload
function handleFileUpload(event) {
  const files = event.target.files;
  
  if (files.length === 0 || !currentWeek) return;
  
  for (let file of files) {
    const document = {
      id: Date.now() + Math.random(),
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB',
      uploadedAt: new Date().toISOString(),
      file: file  // For now, we'll just store reference
    };
    
    currentWeek.documents.push(document);
  }
  
  saveData();
  loadDocuments();
  
  // Reset input
  event.target.value = '';
}

// Delete document
function deleteDocument(docId) {
  if (!confirm('Are you sure you want to delete this document?')) return;
  
  const index = currentWeek.documents.findIndex(d => d.id === docId);
  if (index > -1) {
    currentWeek.documents.splice(index, 1);
    saveData();
    loadDocuments();
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