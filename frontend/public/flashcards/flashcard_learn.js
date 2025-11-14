// --- Global State ---
let currentDeck = null;
let cards = [];
let currentIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let isFlipped = false;

// --- DOM Elements (Assigned when DOM is ready) ---
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
 * Retrieves the user ID from localStorage and prepares the necessary headers.
 * @param {boolean} isJson - Set to true if a 'Content-Type: application/json' header is also needed (for POST/PUT).
 * @returns {Object} An object containing the required HTTP headers.
 */
function getAuthHeaders(isJson = false) {
    // Falls back to the server's default ID if nothing is found (as per server design)
    const userId = localStorage.getItem('userEmail') || 'default-user-server-side';
    const headers = {
        'x-user-id': userId // <-- The critical header the server requires
    };

    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

/**
 * Retrieves the currently selected subject ID from the UI.
 * @returns {string} The subject ID, defaulting to 'uncategorized' if not found.
 */
function getCurrentSubjectId() {

    const subjectSpan = document.getElementById('flashcardSubjectName');

    const subjectName = subjectSpan ? subjectSpan.textContent.trim() : '';

    return (subjectName && subjectName !== 'null') ? subjectName : 'uncategorized';
}


/**
 * Parses the URL to get the deckId.
 * @returns {string | null} The deck ID or null.
 */
function getDeckIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('deckId');
}

/**
 * Renders the current card's content to the DOM.
 */
function renderCard() {
    if (cards.length === 0) {
        cardStatusEl.textContent = 'No cards in deck.';
        flashcardEl.style.display = 'none';
        studyActionsEl.style.display = 'none';
        return;
    }

    const card = cards[currentIndex];

    // Reset flip state visually, but keep isFlipped true/false depending on how renderCard is called.
    // When called from handleAnswer/skipCard/loadStudyDeck, currentIndex changes, so we reset everything.
    isFlipped = false;
    flashcardEl.classList.remove('flipped');

    cardFrontEl.textContent = card.question;
    cardBackEl.textContent = card.answer;
    cardStatusEl.textContent = `Card ${currentIndex + 1} of ${cards.length}`;
}

/**
 * Toggles the card's visibility between question (front) and answer (back).
 * This function now allows flipping back and forth.
 */
function flipCard() {
    isFlipped = !isFlipped; // Toggle the state

    if (isFlipped) {
        flashcardEl.classList.add('flipped');
    } else {
        flashcardEl.classList.remove('flipped');
    }
}

/**
 * Handles the user's response (Correct or Wrong).
 * @param {boolean} isCorrect - True if the user answered correctly.
 */
function handleAnswer(isCorrect) {
    if (!isFlipped) {
        // If the card is not flipped (showing question), prompt user to flip first.
        messageAreaEl.textContent = "Please flip the card to see the answer before marking Correct/Wrong.";
        setTimeout(() => messageAreaEl.textContent = "", 3000);
        return;
    }

    if (isCorrect) {
        correctCount++;
    } else {
        wrongCount++;
    }

    // Move to the next card
    currentIndex++;

    if (currentIndex < cards.length) {
        renderCard();
    } else {
        endSession();
    }
}

/**
 * Skips the current card by moving it to the end of the array.
 */
function skipCard() {
    // Check for the single card edge case
    if (cards.length <= 1) {
        messageAreaEl.textContent = "Only one card in the deck. Skipping is not possible.";
        setTimeout(() => messageAreaEl.textContent = "", 3000);
        return; // Do not proceed
    }

    // Get the current card object and remove it from its position
    const skippedCard = cards.splice(currentIndex, 1)[0];

    // Add the skipped card to the end of the array
    cards.push(skippedCard);

    // Update index: If we were at the end of the array, wrap around to 0
    if (currentIndex >= cards.length) {
        currentIndex = 0; // Wrap around to the start
    }

    // Provide user feedback
    messageAreaEl.textContent = `Card skipped. It has been moved to the back of the deck.`;
    setTimeout(() => messageAreaEl.textContent = "", 3000);

    // Render the card at the (now) currentIndex, which is the next card in line.
    renderCard();
}

/**
 * Ends the study session and displays the results.
 */
function endSession() {
    const totalCards = cards.length;
    const percentage = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;

    // Hide all study elements
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
    backToDecksBtn.style.display = 'block'; // Show back button after session ends
}


// --- API/Initialization ---

/**
 * Loads a single deck and its cards by calling the server API.
 * This is the refactored function using fetch.
 * @param {string} id - The Deck ID.
 * @returns {Promise<Object | null>} The deck object or null if not found.
 */
async function loadDeckFromApi(id) {
    if (!id) return null;

    const urlParams = new URLSearchParams(window.location.search);
    const subjectId = urlParams.get('subjectId') || 'uncategorized';
    // Implement exponential backoff for retries (omitted here for brevity, assume simple fetch)
    try {
        // Get the headers without Content-Type
        const headers = getAuthHeaders(false);

        const url = `${flashcardApiUrl}/api/decks/${id}?subjectId=${encodeURIComponent(subjectId)}`;

        // Fetch deck from the server API endpoint
        const response = await fetch(url, { headers });
        if (response.status === 404) {
            messageAreaEl.textContent = 'Deck not found.';
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch deck: ${response.statusText}`);
        }

        const deck = await response.json();

        // The deck object returned by the server already contains the card array
        return {
            id: deck.id,
            name: deck.name,
            subject: deck.subject,
            cards: deck.cards || [],
        };

    } catch (e) {
        console.error("Error loading deck from API:", e);
        messageAreaEl.textContent = 'Error loading deck data.';
        return null;
    }
}

/**
 * Loads the deck specified in the URL and initializes the study session.
 */
async function loadStudyDeck() {
    const deckId = getDeckIdFromUrl();
    if (!deckId) {
        deckTitleEl.textContent = "Error: No Deck ID provided";
        return;
    }

    const deck = await loadDeckFromApi(deckId);

    if (deck) {
        currentDeck = deck;
        cards = deck.cards || [];
        deckTitleEl.textContent = currentDeck.name || 'Untitled Deck';
        messageAreaEl.textContent = ''; // Clear message after successful load

        if (cards.length > 0) {
            // Sort cards if they have an 'order' field (optional, for consistency)
            cards.sort((a, b) => a.order - b.order);

            // --- Make the card and actions visible ---
            flashcardWrapperEl.style.display = 'block';
            studyActionsEl.style.display = 'flex';
            backToDecksBtn.style.display = 'none'; // Hide back button while studying
            // --- --------------------------------- ---

            // Start the session by rendering the first card
            renderCard();
        } else {
            cardStatusEl.textContent = 'Deck is empty.';
            flashcardWrapperEl.style.display = 'none';
            studyActionsEl.style.display = 'none';
            backToDecksBtn.style.display = 'block'; // Show back button if deck is empty
        }
    } else {
        deckTitleEl.textContent = "Failed to Load Deck";
    }
}


// --- Initialization and Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    // Check for a study element to ensure we are on the correct page.
    if (!flashcardWrapperEl) {
        console.warn("Flashcard wrapper not found. Skipping study initialization.");
        return;
    }

    // Load the deck and start the session
    loadStudyDeck();

    // Attach flip handler to the card wrapper
    flashcardWrapperEl.addEventListener('click', (e) => {
        // Only flip if the click target is NOT one of the buttons inside the wrapper
        if (e.target.closest('#skip-btn') || e.target.closest('#correct-btn') || e.target.closest('#wrong-btn')) {
            return;
        }
        flipCard();
    });

    // Attach action handlers
    correctBtn.addEventListener('click', () => handleAnswer(true));
    wrongBtn.addEventListener('click', () => handleAnswer(false));
    skipBtn.addEventListener('click', skipCard);

    // Back button handler
    backToDecksBtn.addEventListener('click', () => {
        const userId = localStorage.getItem('userEmail') || 'default-user-server-side';
        window.location.href = `student-dashboard.html`;
    });
});