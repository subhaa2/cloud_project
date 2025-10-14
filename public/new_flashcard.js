// Global array to hold all the flashcard data
let flashcardDeck = []; 

// Get DOM elements
const qInput = document.getElementById('question-input');
const aInput = document.getElementById('answer-input');
const addCardBtn = document.getElementById('add-card-btn');
const saveDeckBtn = document.getElementById('save-deck-btn');
const deckList = document.getElementById('deck-list');
const cardCount = document.getElementById('card-count');
const messageArea = document.getElementById('message-area');

// --- Helper Functions ---

function renderDeckList() {
    deckList.innerHTML = ''; // Clear the current list
    flashcardDeck.forEach((card, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `Card ${index + 1}: Q - ${card.question} / A - ${card.answer}`;
        deckList.appendChild(listItem);
    });
    cardCount.textContent = flashcardDeck.length;
}

// --- Event Handlers ---

addCardBtn.addEventListener('click', () => {
    const question = qInput.value.trim();
    const answer = aInput.value.trim();

    if (!question || !answer) {
        alert("Please enter both a question and an answer.");
        return;
    }

    // Add the new card object to the global array
    flashcardDeck.push({
        question: question,
        answer: answer
    });

    // Update the UI
    qInput.value = ''; // Clear inputs
    aInput.value = '';
    renderDeckList();
    messageArea.textContent = '';
});

saveDeckBtn.addEventListener('click', async () => {
    if (flashcardDeck.length === 0) {
        messageArea.textContent = 'Please add at least one card before saving.';
        return;
    }

    messageArea.textContent = 'Saving deck...';
    
    try {
        // Send the complete flashcardDeck array as JSON to the Express server
        const response = await fetch('/api/decks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(flashcardDeck)
        });

        const result = await response.json();

        if (response.ok) {
            // Successful save to the backend
            messageArea.textContent = `Success! Deck saved with ID: ${result.deckId || 'N/A'}`;
            flashcardDeck = []; // Clear the local deck after saving
            renderDeckList();
        } else {
            // Error response from the Express server
            messageArea.textContent = `Error: ${result.message || 'Failed to save deck.'}`;
        }
    } catch (error) {
        // Network or fetch error
        console.error('Submission Error:', error);
        messageArea.textContent = 'Network error. Could not connect to the server.';
    }
});