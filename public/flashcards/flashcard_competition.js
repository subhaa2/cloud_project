// --- Global State ---
let competitionId = null;
let currentUserId = null;
let competitionData = null; // Stores Player A/B details, scores, etc.
let myPlayerKey = null; // 'playerA' or 'playerB'
let opponentPlayerKey = null; // 'playerB' or 'playerA'

let cardsToStudy = []; // The opponent's deck
let currentIndex = 0;
let isFlipped = false;
let socket = null;

// --- DOM Elements ---
const deckSelectionView = document.getElementById('deck-selection-view');
const competitionView = document.getElementById('competition-view');
const challengerNameEl = document.getElementById('challenger-name');
const availableDecksList = document.getElementById('available-decks-list');
const acceptChallengeBtn = document.getElementById('accept-challenge-btn');
const statusMessageEl = document.getElementById('status-message');
const competitionTitleEl = document.getElementById('competition-title');

// Flashcard elements
const flashcardWrapperEl = document.getElementById('flashcard-wrapper');
const flashcardEl = document.getElementById('flashcard');
const cardFrontEl = document.getElementById('card-front');
const cardBackEl = document.getElementById('card-back');
const correctBtn = document.getElementById('correct-btn');
const wrongBtn = document.getElementById('wrong-btn');
const skipBtn = document.getElementById('skip-btn');
const studyActionsEl = document.getElementById('study-actions');
const resultsViewEl = document.getElementById('results-view');
const messageAreaEl = document.getElementById('message-area');
const backToDecksBtn = document.getElementById('back-to-decks-btn');

// Progress elements
const playerDeckNameEl = document.getElementById('player-deck-name');
const playerScoreEl = document.getElementById('player-score');
const playerProgressBarEl = document.getElementById('player-progress-bar');
const opponentDeckNameEl = document.getElementById('opponent-deck-name');
const opponentScoreEl = document.getElementById('opponent-score');
const opponentProgressBarEl = document.getElementById('opponent-progress-bar');
const finalResultTitleEl = document.getElementById('final-result-title');
const finalResultMessageEl = document.getElementById('final-result-message');


// --- Utility Functions ---

/**
 * Retrieves the user ID from localStorage and prepares the necessary headers.
 * @param {boolean} isJson - Set to true if a 'Content-Type: application/json' header is also needed (for POST/PUT).
 * @returns {Object} An object containing the required HTTP headers.
 */
function getAuthHeaders(isJson = false) {
    // Falls back to the server's default ID if nothing is found (as per server design)
    const userId = localStorage.getItem('username') || 'default-user-server-side';
    const headers = {
        'x-user-id': userId
    };

    if (isJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

/**
 * Shows a message in the generic modal (instead of alert).
 */
function showModalMessage(title, message, type = 'info') {
    let modal = document.getElementById('generic-message-modal');
    if (!modal) return; // Guard clause

    document.getElementById('generic-modal-title').textContent = title;
    document.getElementById('generic-modal-body').textContent = message;

    const titleEl = document.getElementById('generic-modal-title');
    titleEl.classList.remove('text-indigo-600', 'text-red-600');
    if (type === 'error') {
        titleEl.classList.add('text-red-600');
    } else {
        titleEl.classList.add('text-indigo-600');
    }

    modal.style.display = 'flex';
}

/**
 * Loads the current competition state from the server/firestore.
 */
async function loadCompetitionState(competitionId) {
    statusMessageEl.textContent = 'Fetching competition state...';
    try {
        const { headers, userId } = getAuthHeaders(true);
        currentUserId = localStorage.getItem('username') || 'default-user-server-side';

        const response = await fetch(`/api/decks/competition/${competitionId}`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error('Failed to load competition state.');
        }

        competitionData = await response.json();

        if (competitionData.status === 'FINISHED') {
            // Handle finished game scenario
            competitionView.classList.add('hidden');
            deckSelectionView.classList.add('hidden');
            statusMessageEl.classList.add('hidden');
            showResultsView(competitionData.winnerId === currentUserId, competitionData.winnerUsername);
            return;
        }

        // Determine if current user is Player A or B (or pending B)
        const isPlayerA = competitionData.playerA.userId === currentUserId;
        const isPlayerB = competitionData.playerB && competitionData.playerB.userId === currentUserId;
        const isPendingB = !competitionData.playerB && !isPlayerA;

        if (isPlayerA) {
            myPlayerKey = 'playerA';
            opponentPlayerKey = 'playerB';
            competitionTitleEl.textContent = `Duel: ${competitionData.playerA.userId} (You) vs. ${competitionData.playerB ? competitionData.playerB.userId : 'Opponent'}`;
        } else if (isPlayerB) {
            myPlayerKey = 'playerB';
            opponentPlayerKey = 'playerA';
            competitionTitleEl.textContent = `Duel: ${competitionData.playerB.userId} (You) vs. ${competitionData.playerA.userId}`;
        } else if (isPendingB) {
            // I am player B, and the spot is open
            await setupAcceptanceView(competitionData);
            return;
        } else {
            // Spectator or error
            statusMessageEl.textContent = 'You are not a participant in this competition.';
            return;
        }

        // If we reach here, I am an active player (A or B)
        if (competitionData.status === 'ACTIVE') {
            await initializeCompetitionGame();
        } else if (competitionData.status === 'PENDING') {
            statusMessageEl.textContent = 'Waiting for your opponent to join and select a deck...';
        }


    } catch (error) {
        console.error("Error loading competition:", error);
        statusMessageEl.textContent = 'An error occurred loading the competition. Go back and try again.';
    }
}

/**
 * Sets up the UI for Player B to select their deck and accept.
 */
async function setupAcceptanceView(comp) {
    statusMessageEl.classList.add('hidden');
    deckSelectionView.classList.remove('hidden');

    // Display challenger's name
    // Use URL param for initial display if state hasn't loaded properly
    const params = new URLSearchParams(window.location.search);
    const challengerUsername = params.get('challengerUsername') || comp.playerA.username;
    challengerNameEl.textContent = challengerUsername;

    // Load Player B's decks
    availableDecksList.innerHTML = '<p class="text-center text-gray-500">Loading your decks...</p>';
    const headers = getAuthHeaders(false);

    const username = localStorage.getItem('username');

    try {
        const response = await fetch('/api/decks', { method: 'GET', headers: headers });
        const decks = await response.json();

        availableDecksList.innerHTML = '';
        let selectedDeck = null;
        const usableDecks = decks.filter(d => d.cardCount > 0);

        if (usableDecks.length === 0) {
            availableDecksList.innerHTML = '<p class="text-center text-red-500 font-semibold">You must create a deck with cards to accept a duel!</p>';
        } else {
            // Group decks by subject (Simple grouping for display)
            const decksBySubject = decks.reduce((acc, deck) => {
                const subject = deck.subject || 'Uncategorized';
                if (!acc[subject]) {
                    acc[subject] = [];
                }
                acc[subject].push(deck);
                return acc;
            }, {});

            Object.keys(decksBySubject).forEach(subject => {
                const subjectHeader = document.createElement('h2');
                subjectHeader.className = 'subject-header';
                subjectHeader.textContent = subject;
                availableDecksList.appendChild(subjectHeader);

                const listWrapper = document.createElement('div');
                listWrapper.className = 'subject-row'; // Use grid for layout

                decksBySubject[subject].forEach(deck => {
                    const deckItem = document.createElement('button');
                    deckItem.className = 'deck-item';
                    deckItem.innerHTML = `<h4 class="font-semibold text-gray-800">${deck.name}</h4><p class="text-sm text-gray-500">${deck.cardCount} cards</p>`;
                    deckItem.dataset.id = deck.id;
                    deckItem.dataset.name = deck.name;
                    deckItem.dataset.size = deck.cardCount;

                    deckItem.addEventListener('click', () => {
                        document.querySelectorAll('.deck-item').forEach(item => item.classList.remove('bg-indigo-200', 'border-indigo-500'));
                        deckItem.classList.add('bg-indigo-200', 'border-indigo-500');
                        selectedDeck = deck;
                        acceptChallengeBtn.disabled = false;
                    });
                    listWrapper.appendChild(deckItem);
                });
                availableDecksList.appendChild(listWrapper);
            });
        }

        // Acceptance Button Handler
        acceptChallengeBtn.onclick = async () => {
            if (!selectedDeck) return;
            acceptChallengeBtn.disabled = true;
            acceptChallengeBtn.textContent = 'Accepting...';

            try {
                const acceptHeaders = getAuthHeaders(true);

                const response = await fetch(`/api/decks/accept/${competitionId}`, {
                    method: 'POST',
                    headers: acceptHeaders,
                    body: JSON.stringify({
                        deckId: selectedDeck.id,
                        deckName: selectedDeck.name,
                        deckSize: selectedDeck.cardCount,
                        username: username
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Acceptance failed.');
                }

                // Success: Competition is now active, redirect to self to re-initialize game
                window.location.reload();

            } catch (error) {
                console.error('Error during challenge acceptance:', error);
                showModalMessage('Acceptance Failed', error.message || 'Could not accept the challenge. Please try again.', 'error');
                acceptChallengeBtn.textContent = 'Accept Duel';
                acceptChallengeBtn.disabled = false;
            }
        };

    } catch (error) {
        console.error("Error loading user decks:", error);
        availableDecksList.innerHTML = '<p class="text-center text-red-500">Error loading your decks.</p>';
    }
}

/**
 * Initializes the full competition game view.
 */
async function initializeCompetitionGame() {
    deckSelectionView.classList.add('hidden');
    statusMessageEl.classList.add('hidden');
    competitionView.classList.remove('hidden');

    // The deck to study is the *opponent's* deck
    const deckIdToStudy = competitionData[opponentPlayerKey].deckId;
    const userIdToStudy = competitionData[opponentPlayerKey].userId;
    const opponentData = competitionData[opponentPlayerKey];

    console.log(deckIdToStudy);
    console.log(userIdToStudy);

    // Load the opponent's deck
    statusMessageEl.textContent = 'Loading opponent\'s deck...';
    try {
        const { headers } = getAuthHeaders(false);
        const response = await fetch(`/api/decks/${userIdToStudy}/${deckIdToStudy}`, { method: 'GET', headers: headers });
        if (!response.ok) throw new Error('Failed to fetch deck for study.');
        const deck = await response.json();

        cardsToStudy = deck.cards || [];
        if (cardsToStudy.length === 0) {
            showModalMessage('Deck Empty', `The deck selected by ${opponentData.username} has no cards. This competition cannot start.`, 'error');
            studyActionsEl.classList.add('hidden');
            return;
        }

        // Set up the UI labels
        playerDeckNameEl.textContent = competitionData[opponentPlayerKey].deckName;
        opponentDeckNameEl.textContent = competitionData[myPlayerKey].deckName;

        // Initialize Socket.IO connection
        socket = io();
        setupSocketListeners();
        socket.emit('joinCompetition', competitionId);

        // Start card flow and update initial progress (which may have been missed)
        showCard(0);
        updateProgressUI(competitionData);

    } catch (error) {
        console.error('Error during game initialization:', error);
        showModalMessage('Game Error', 'Could not initialize the flashcard duel. Check console for details.', 'error');
    }
}

/**
 * Sets up Socket.IO event listeners.
 */
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to WebSocket server.');
    });

    // Phase 2: Receive progress update
    socket.on('progressUpdate', (data) => {
        console.log('Progress Update Received:', data);
        competitionData = data; // Update local state
        updateProgressUI(data);
    });

    // Phase 3: Receive game finished
    socket.on('gameFinished', (data) => {
        console.log('Game Finished:', data);
        showResultsView(data.winnerId === currentUserId, data.winnerId);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server.');
    });
}

/**
 * Updates the progress bars and scores.
 */
function updateProgressUI(data) {
    if (!data.playerA || !data.playerB) return; // Guard against incomplete data

    // Current user's progress: score in opponent's deck
    const myData = data[myPlayerKey];
    const myDeckSize = myData.deckSize; // This is the opponent's deck size
    const myScore = myData.score;
    const myPercent = myData.percent;

    // Opponent's progress: score in my deck
    const opponentData = data[opponentPlayerKey];
    const opponentDeckSize = opponentData.deckSize; // This is my deck size
    const opponentScore = opponentData.score;
    const opponentPercent = opponentData.percent;

    // Update Your Progress
    playerScoreEl.textContent = `${myScore} / ${myDeckSize}`;
    playerProgressBarEl.style.width = `${Math.min(myPercent, 100)}%`;

    // Update Opponent's Progress
    opponentScoreEl.textContent = `${opponentScore} / ${opponentDeckSize}`;
    opponentProgressBarEl.style.width = `${Math.min(opponentPercent, 100)}%`;
}

/**
 * Displays the current card.
 */
function showCard(index) {
    // Check if player finished studying *their* deck first
    if (index >= cardsToStudy.length) {
        showModalMessage('Deck Finished', 'You have studied all cards in the opponent\'s deck! Waiting for the final duel result...', 'info');
        studyActionsEl.classList.add('hidden');
        flashcardWrapperEl.classList.add('hidden');
        return;
    }

    currentIndex = index;
    isFlipped = false;
    flashcardEl.classList.remove('flipped');
    console.log(cardsToStudy[currentIndex].question);
    cardFrontEl.textContent = cardsToStudy[currentIndex].question;
    cardBackEl.textContent = cardsToStudy[currentIndex].answer;
}

/**
 * Flips the flashcard.
 */
function flipCard() {
    isFlipped = !isFlipped;
    flashcardEl.classList.toggle('flipped', isFlipped);
}

/**
 * Handles the answer action (Correct/Wrong).
 * @param {boolean} isCorrect - True if the answer was correct.
 */
function handleAnswer(isCorrect) {
    if (!isFlipped) {
        // If the card is not flipped (showing question), prompt user to flip first.
        messageAreaEl.textContent = "Please flip the card to see the answer before marking Correct/Wrong.";
        setTimeout(() => messageAreaEl.textContent = "", 3000);
        return;
    }

    // 1. Send WebSocket event to update score
    if (socket && competitionId && currentUserId) {
        socket.emit('cardAnswered', {
            competitionId: competitionId,
            userId: currentUserId,
            result: isCorrect ? 'correct' : 'wrong'
        });
    }

    if (isCorrect) {
        // Correct Answer: Card is done. Remove it from the local study deck permanently.
        // Splice removes 1 element at currentIndex. The next card shifts into its place.
        cardsToStudy.splice(currentIndex, 1);
        
        // CRITICAL: currentIndex does NOT increment. It now points to the new card that shifted in.
        
    } else {
        // Wrong Answer: Card needs repetition. Move it to the end of the deck.
        const wrongCard = cardsToStudy.splice(currentIndex, 1)[0]; // Remove card at current index
        cardsToStudy.push(wrongCard); // Add it to the end
        
        // CRITICAL: currentIndex does NOT increment. It now points to the new card that shifted in.
        messageAreaEl.textContent = `Card marked wrong. It will be shown again later.`;
        setTimeout(() => messageAreaEl.textContent = "", 3000);
    }

    // 2. Check the next card index and show the card.
    if (cardsToStudy.length === 0) {
        // The deck is truly finished (all cards were marked correct and removed)
        showCard(currentIndex); // This will trigger the "Deck Finished" modal in showCard.
    } else if (currentIndex >= cardsToStudy.length) {
        // If the card removed was the *last* one, wrap around to the beginning (index 0).
        currentIndex = 0; 
        showCard(currentIndex);
    } else {
        // Show the card that is now at the current index position.
        showCard(currentIndex);
    }
}

/**
 * Displays the final results view.
 */
function showResultsView(isWinner, winnerUsername) {
    competitionView.classList.add('hidden');
    studyActionsEl.classList.add('hidden');
    flashcardWrapperEl.classList.add('hidden');

    finalResultTitleEl.classList.remove('text-red-600', 'text-green-600');

    if (isWinner) {
        finalResultTitleEl.classList.add('text-green-600');
        finalResultTitleEl.textContent = 'VICTORY! 🏆';
        finalResultMessageEl.textContent = `You finished the duel first and defeated your opponent, ${winnerUsername}!`;
    } else {
        finalResultTitleEl.classList.add('text-red-600');
        finalResultTitleEl.textContent = 'DEFEAT... 😔';
        finalResultMessageEl.textContent = `${winnerUsername} finished the duel first. Better luck next time!`;
        
    }
    resultsViewEl.classList.remove('hidden');
    // resultsViewEl.style.display = 'block';
}

/**
 * Renders the current card's content to the DOM.
 */
function renderCard() {
    if (cardsToStudy.length === 0) {
        playerScoreEl.textContent = 'No cards in deck.';
        flashcardEl.style.display = 'none';
        studyActionsEl.style.display = 'none';
        return;
    }

    const card = cardsToStudy[currentIndex];

    // Reset flip state visually, but keep isFlipped true/false depending on how renderCard is called.
    // When called from handleAnswer/skipCard/loadStudyDeck, currentIndex changes, so we reset everything.
    isFlipped = true;
    flashcardEl.classList.remove('flipped');

    cardFrontEl.textContent = card.question;
    cardBackEl.textContent = card.answer;
    playerScoreEl.textContent = `Card ${currentIndex + 1} of ${cardsToStudy.length}`;
}

/**
 * Skips the current card by moving it to the end of the array.
 */
function skipCard() {
    // 1. Check for the single card edge case
    if (cardsToStudy.length <= 1) {
        messageAreaEl.textContent = "Only one card in the deck. Skipping is not possible.";
        setTimeout(() => messageAreaEl.textContent = "", 3000);
        return; // Do not proceed
    }

    // 2. Get the current card object and remove it from its position
    const skippedCard = cardsToStudy.splice(currentIndex, 1)[0];

    // 3. Add the skipped card to the end of the array
    cardsToStudy.push(skippedCard);

    // 4. Update index: If we were at the end of the array, wrap around to 0
    if (currentIndex >= cardsToStudy.length) {
        currentIndex = 0; // Wrap around to the start
    }

    // 5. Provide user feedback
    messageAreaEl.textContent = `Card skipped. It has been moved to the back of the deck.`;
    setTimeout(() => messageAreaEl.textContent = "", 3000);

    // 6. Render the card at the (now) currentIndex, which is the next card in line.
    renderCard();
}


// --- Initialization and Event Handlers ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Get competitionId from URL
    const params = new URLSearchParams(window.location.search);
    competitionId = params.get('deckId');

    if (!competitionId) {
        statusMessageEl.textContent = 'Error: No competition ID provided.';
        return;
    }

    // 2. Load competition state
    loadCompetitionState(competitionId);

    // 3. Attach card/action handlers (only relevant when in competition-view)
    if (flashcardWrapperEl) {
        flashcardWrapperEl.addEventListener('click', (e) => {
            // Only flip if the click target is NOT one of the buttons
            if (e.target.closest('#correct-btn') || e.target.closest('#wrong-btn')) {
                return;
            }
            flipCard();
        });
    }

    if (correctBtn) correctBtn.addEventListener('click', () => handleAnswer(true));
    if (wrongBtn) wrongBtn.addEventListener('click', () => handleAnswer(false));
    if (skipBtn) skipBtn.addEventListener('click', skipCard);

    // 4. Back button handler
    if (backToDecksBtn) {
        backToDecksBtn.addEventListener('click', () => {
            window.location.href = '/allDecks';
        });
    }
});