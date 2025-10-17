// --- Dummy Data (Replace with actual fetch from /api/decks) ---
const mockDeckData = [
    { id: '1', name: 'AWS Basics', subject: 'Cloud Computing', cardCount: 15 },
    { id: '2', name: 'Express Routes', subject: 'Cloud Computing', cardCount: 8 },
    { id: '3', name: 'HTML Structure', subject: 'Frontend Design', cardCount: 22 },
    { id: '4', name: 'JavaScript ES6', subject: 'Frontend Design', cardCount: 10 },
    { id: '5', name: 'REST Principles', subject: 'Cloud Computing', cardCount: 12 },
    { id: '6', name: 'CSS Flexbox', subject: 'Frontend Design', cardCount: 7 },
];
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const decksContainer = document.getElementById('decks-container');
    
    // Initial fetch function (mocked for now)
    fetchAndRenderDecks();

    async function fetchAndRenderDecks() {
        decksContainer.innerHTML = '<p id="loading-message">Loading decks...</p>';

        // NOTE: Replace this mock data and delay with an actual 'fetch' call
        // Example: const response = await fetch('/api/decks');
        // Example: const decks = await response.json();
        
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const decks = mockDeckData; // Use mock data

        decksContainer.innerHTML = ''; // Clear loading message

        if (!decks || decks.length === 0) {
            decksContainer.innerHTML = '<p>You have no decks yet. <a href="/newFlashcard">Start a new one!</a></p>';
            return;
        }

        // 1. Group decks by subject
        const decksBySubject = decks.reduce((acc, deck) => {
            const subject = deck.subject || 'Uncategorized';
            if (!acc[subject]) {
                acc[subject] = [];
            }
            acc[subject].push(deck);
            return acc;
        }, {});

        // 2. Render the grouped decks
        for (const [subject, deckList] of Object.entries(decksBySubject)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'deck-group';
            
            const subjectHeader = document.createElement('h2');
            subjectHeader.textContent = subject;
            groupDiv.appendChild(subjectHeader);

            const listWrapper = document.createElement('div');
            listWrapper.className = 'deck-list';
            
            deckList.forEach(deck => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'deck-card';
                // Link to the detailed view of the deck (you'll need to implement this route later)
                cardDiv.onclick = () => window.location.href = `/decks/${deck.id}`;
                
                const nameP = document.createElement('p');
                nameP.textContent = deck.name;
                cardDiv.appendChild(nameP);

                const countP = document.createElement('small');
                countP.textContent = `(${deck.cardCount} cards)`;
                cardDiv.appendChild(countP);
                
                listWrapper.appendChild(cardDiv);
            });
            
            groupDiv.appendChild(listWrapper);
            decksContainer.appendChild(groupDiv);
        }
    }
});
