document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboardData();
});

async function fetchLeaderboardData() {
    const leaderboardBody = document.getElementById('leaderboard-body');
    const loadingIndicator = document.getElementById('loading-indicator'); // Optional: add a loading indicator
    const errorDisplay = document.getElementById('error-display'); // Optional: add an error display area

    if (!leaderboardBody) {
        console.error('Leaderboard table body not found!');
        if (errorDisplay) errorDisplay.textContent = 'Error: Could not find leaderboard display area.';
        return;
    }

    // Clear previous entries and show loading
    leaderboardBody.innerHTML = '';
    if (errorDisplay) errorDisplay.textContent = '';
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
        const response = await fetch('/api/leaderboard?count=100'); // Fetch top 100
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch leaderboard.' }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
        }

        const leaderboardData = await response.json();

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        if (leaderboardData.length === 0) {
            leaderboardBody.innerHTML = '<tr><td colspan="3">Be the first to set a score!</td></tr>';
            return;
        }

        leaderboardData.forEach(entry => {
            const row = leaderboardBody.insertRow();

            const rankCell = row.insertCell();
            rankCell.textContent = entry.rank;

            const nameCell = row.insertCell();
            nameCell.textContent = entry.username; // Display username

            const scoreCell = row.insertCell();
            scoreCell.textContent = entry.score; // Display score
        });

    } catch (error) {
        console.error('Error fetching or displaying leaderboard:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (errorDisplay) errorDisplay.textContent = `Failed to load leaderboard: ${error.message}`;
        leaderboardBody.innerHTML = '<tr><td colspan="3">Could not load leaderboard data.</td></tr>'; // Show error in table
    }
}

// Add event listener for a back button if you have one
document.getElementById('backButton')?.addEventListener('click', () => {
    window.history.back(); // Or navigate to index.html
});

// Initialize Telegram Web App (optional for leaderboard, but good practice)
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
} 