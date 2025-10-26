// Re-using loadDecks and STORAGE_KEY from all_decks.js (must be included in HTML first)

// --- Global State ---
let currentDeck = null;
let cards = [];
let currentIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let isFlipped = false;

// --- DOM Elements ---
const deckTitleEl = document.getElementById('deck-title');
const cardStatusEl = document.getElementById('card-status');
const flashcardWrapperEl = document.getElementById('flashcard-wrapper');
const flashcardEl = document.getElementById('flashcard');
const cardFrontEl = document.getElementById('card-front');
const cardBackEl = document.getElementById('card-back');
const studyActionsEl = document.getElementById('study-actions');
const correctBtn = document.getElementById('correct-btn');
const wrongBtn = document.getElementById('wrong-btn');
const resultsViewEl = document.getElementById('results-view');
const messageAreaEl = document.getElementById('message-area');
const backToDecksBtn = document.getElementById('back-to-decks-btn');
const skipBtn = document.getElementById('skip-btn');


// --- Utility Functions ---

/**
 * Parses the URL to get the deckId.
 * @returns {string | null} The deck ID or null.
 */
function getDeckIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('deckId');
}

/**
 * Loads the deck based on the ID from the URL.
 */
function loadStudyDeck() {
    const deckId = getDeckIdFromUrl();
    if (!deckId) {
        deckTitleEl.textContent = "Error: No deck selected.";
        messageAreaEl.textContent = "Please return to the library and select a deck to start.";
        backToDecksBtn.style.display = 'inline-block';
        return false;
    }
    
    // Use the loadDecks function available from all_decks.js
    const allDecks = loadDecks(); 
    const deck = allDecks.find(d => d.id === deckId);

    if (!deck || !deck.cards || deck.cards.length === 0) {
        deckTitleEl.textContent = "Deck Not Found or Empty";
        messageAreaEl.textContent = "This deck is empty. Please add cards in the editor.";
        backToDecksBtn.style.display = 'inline-block';
        return false;
    }

    currentDeck = deck;
    // Filter out cards without content just in case
    cards = deck.cards.filter(c => c.question.trim() !== '' && c.answer.trim() !== '');
    
    if (cards.length === 0) {
        deckTitleEl.textContent = currentDeck.name || "Untitled Deck";
        messageAreaEl.textContent = "This deck contains no valid cards. Please add cards in the editor.";
        backToDecksBtn.style.display = 'inline-block';
        return false;
    }
    
    // Initialize UI and start session
    deckTitleEl.textContent = currentDeck.name || "Untitled Deck";
    flashcardWrapperEl.style.display = 'block';
    studyActionsEl.style.display = 'flex';
    backToDecksBtn.style.display = 'inline-block';
    
    renderCard();
    return true;
}

/**
 * Renders the current card's content and updates status.
 */
function renderCard() {
    if (currentIndex >= cards.length) {
        showResults();
        return;
    }
    
    // Reset flip state
    isFlipped = false;
    flashcardEl.classList.remove('flipped');
    
    const currentCard = cards[currentIndex];
    
    // Set card content
    cardFrontEl.textContent = currentCard.question || 'No Question';
    cardBackEl.textContent = currentCard.answer || 'No Answer';
    
    // Update status
    cardStatusEl.textContent = `Card ${currentIndex + 1} of ${cards.length}`;
}

/**
 * Flips the card to reveal the answer.
 */
function flipCard() {
    // 1. Toggle the state variable
    isFlipped = !isFlipped;
    
    // 2. Toggle the 'flipped' CSS class to control the 3D rotation
    flashcardEl.classList.toggle('flipped'); 
}

/**
 * Handles skipping the current card.
 */
function handleSkip() {
    // 1. Check for the single card edge case
    if (cards.length <= 1) {
        messageAreaEl.textContent = "Only one card in the deck. Skipping is not possible as there is no 'back' of the deck!";
        setTimeout(() => messageAreaEl.textContent = "", 3000);
        return; // Do not proceed
    }
    
    // 2. Get the current card object
    const skippedCard = cards[currentIndex];
    
    // 3. Array Manipulation: Remove the current card from its position
    // We use .splice(index, count) to remove the element at currentIndex
    cards.splice(currentIndex, 1);
    
    // 4. Array Manipulation: Add the skipped card to the end of the array
    cards.push(skippedCard);
    
    // 6. If the index we are on is now the last position, wrap around to 0
    if (currentIndex >= cards.length) {
        currentIndex = 0;
    }
    
    // 6. Provide user feedback
    messageAreaEl.textContent = `Card skipped. It has been moved to the back of the deck.`;
    setTimeout(() => messageAreaEl.textContent = "", 3000);

    // 7. Render the card at the (now) currentIndex
    renderCard();
}

/**
 * Handles action taken by the user (Correct/Wrong).
 * @param {boolean} isCorrect - True if the user answered correctly.
 */
function handleAnswer(isCorrect) {
    // Only proceed if the card has been flipped (user has seen the answer)
    if (!isFlipped) {
        messageAreaEl.textContent = "Please flip the card to see the answer first!";
        setTimeout(() => messageAreaEl.textContent = "", 2000);
        return;
    }
    
    if (isCorrect) {
        correctCount++;
    } else {
        wrongCount++;
    }
    
    // Move to the next card
    currentIndex++;
    renderCard();
}

/**
 * Displays the final results of the study session.
 */
function showResults() {
    const totalCards = cards.length;
    const percentage = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
    
    flashcardWrapperEl.style.display = 'none';
    studyActionsEl.style.display = 'none';
    cardStatusEl.textContent = 'Session Complete!';
    
    resultsViewEl.innerHTML = `
        <h2>Session Complete!</h2>
        <p style="font-size: 1.8rem; font-weight: 700; color: var(--color-primary); margin: 20px 0;">${percentage}% Correct</p>
        <p>You went through ${totalCards} card(s).</p>
        <p style="color: var(--color-success); font-weight: 600;">Correct: ${correctCount}</p>
        <p style="color: var(--color-danger); font-weight: 600;">Wrong: ${wrongCount}</p>
    `;
    resultsViewEl.style.display = 'block';
}


// --- Initialization and Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load the deck and start the session
    loadStudyDeck();
    
    // 2. Attach flip handler to the card wrapper
    flashcardWrapperEl.addEventListener('click', flipCard);
    
    // 3. Attach button handlers
    correctBtn.addEventListener('click', () => handleAnswer(true));
    wrongBtn.addEventListener('click', () => handleAnswer(false));

    // 4. Skip handler
    skipBtn.addEventListener('click', (e) => { 
        e.stopPropagation();
        handleSkip();
    });
});