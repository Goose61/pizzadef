document.addEventListener('DOMContentLoaded', () => {
    console.log('Leaderboard page loaded');
    setupLeaderboardControls();
    fetchLeaderboardData();
    
    // Debug - Log all elements on the page
    console.log('All elements on page:', document.querySelectorAll('*').length);
    console.log('LeaderboardContainer:', document.getElementById('leaderboardContainer'));
    console.log('BackButton element:', document.getElementById('backButton'));
    
    // Setup back button with a small delay to ensure DOM is fully loaded
    setTimeout(() => {
        console.log('Setting up back button with delay');
        setupBackButton();
    }, 100);
    
    // Add debug button
    setupDebugButton();
});

// Add a debug button function
function setupDebugButton() {
    // Check if it already exists
    if (document.getElementById('debug-db-button')) return;
    
    // Create debug container
    const debugResultsContainer = document.createElement('div');
    debugResultsContainer.id = 'debug-results';
    debugResultsContainer.style.display = 'none';
    debugResultsContainer.style.position = 'fixed';
    debugResultsContainer.style.top = '50%';
    debugResultsContainer.style.left = '50%';
    debugResultsContainer.style.transform = 'translate(-50%, -50%)';
    debugResultsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    debugResultsContainer.style.color = '#0f0';
    debugResultsContainer.style.padding = '20px';
    debugResultsContainer.style.borderRadius = '10px';
    debugResultsContainer.style.maxWidth = '90%';
    debugResultsContainer.style.maxHeight = '80%';
    debugResultsContainer.style.overflow = 'auto';
    debugResultsContainer.style.zIndex = '10000';
    debugResultsContainer.style.fontFamily = 'monospace';
    debugResultsContainer.style.fontSize = '14px';
    debugResultsContainer.innerHTML = '<h3>Database Diagnostics</h3><p>Loading...</p>';
    
    // Close button for debug results
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#f00';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
        debugResultsContainer.style.display = 'none';
    });
    debugResultsContainer.appendChild(closeButton);
    
    // Create debug button
    const debugButton = document.createElement('button');
    debugButton.id = 'debug-db-button';
    debugButton.textContent = 'Debug DB';
    debugButton.style.position = 'fixed';
    debugButton.style.bottom = '50px';
    debugButton.style.right = '10px';
    debugButton.style.padding = '8px 15px';
    debugButton.style.backgroundColor = '#333';
    debugButton.style.color = '#0f0';
    debugButton.style.border = '1px solid #0f0';
    debugButton.style.borderRadius = '5px';
    debugButton.style.cursor = 'pointer';
    debugButton.style.zIndex = '9999';
    debugButton.style.opacity = '0.8';
    debugButton.style.fontSize = '12px';
    
    debugButton.addEventListener('click', async () => {
        debugResultsContainer.style.display = 'block';
        debugResultsContainer.innerHTML = '<h3>Database Diagnostics</h3><p>Loading...</p>';
        
        try {
            const response = await fetch('/api/simple-debug?secret=pizza');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Format the results
            let html = `
                <h3>Database Diagnostics</h3>
                <p><strong>Connection Status:</strong> ${data.databaseConnection}</p>
                
                <h4>Database Stats:</h4>
                <ul>
                    <li>Leaderboard Entries: ${data.databaseStats.leaderboardCount || 0}</li>
                    <li>Username Entries: ${data.databaseStats.usernamesCount || 0}</li>
                    <li>Games Played Entries: ${data.databaseStats.gamesPlayedCount || 0}</li>
                    <li>Highest Wave Entries: ${data.databaseStats.highestWaveCount || 0}</li>
                    <li>Last Played Entries: ${data.databaseStats.lastPlayedCount || 0}</li>
                </ul>
                
                <h4>Test Write:</h4>
                <p>${data.testWrite.status}: ${data.testWrite.message}</p>
            `;
            
            if (data.errors && data.errors.length > 0) {
                html += `
                    <h4>Errors:</h4>
                    <ul>
                        ${data.errors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                `;
            }
            
            // Show some sample data if available
            if (data.leaderboardEntries && data.leaderboardEntries.length > 0) {
                html += `
                    <h4>Top Leaderboard Entries:</h4>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #0f0">
                            <th style="text-align: left; padding: 5px">User ID</th>
                            <th style="text-align: right; padding: 5px">Score</th>
                        </tr>
                        ${data.leaderboardEntries.map(entry => `
                            <tr style="border-bottom: 1px solid #444">
                                <td style="padding: 5px">${entry.userId}</td>
                                <td style="text-align: right; padding: 5px">${entry.score}</td>
                            </tr>
                        `).join('')}
                    </table>
                `;
            }
            
            if (data.usernameEntries && data.usernameEntries.length > 0) {
                html += `
                    <h4>Username Mappings:</h4>
                    <table style="width:100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #0f0">
                            <th style="text-align: left; padding: 5px">User ID</th>
                            <th style="text-align: left; padding: 5px">Username</th>
                        </tr>
                        ${data.usernameEntries.map(entry => `
                            <tr style="border-bottom: 1px solid #444">
                                <td style="padding: 5px">${entry.userId}</td>
                                <td style="padding: 5px">${entry.username}</td>
                            </tr>
                        `).join('')}
                    </table>
                `;
            }
            
            debugResultsContainer.innerHTML = html;
            
        } catch (error) {
            debugResultsContainer.innerHTML = `
                <h3>Database Diagnostics Error</h3>
                <p style="color: red">Error fetching diagnostics: ${error.message}</p>
            `;
        }
    });
    
    // Add to document
    document.body.appendChild(debugButton);
    document.body.appendChild(debugResultsContainer);
}

function setupLeaderboardControls() {
    // Create filter controls if they don't exist
    if (!document.getElementById('leaderboard-filters')) {
        const leaderboardContainer = document.getElementById('leaderboardContainer');
        const heading = leaderboardContainer.querySelector('h1');
        
        const filtersDiv = document.createElement('div');
        filtersDiv.id = 'leaderboard-filters';
        filtersDiv.className = 'leaderboard-filters';
        
        // Time period filter
        const periodSelect = document.createElement('select');
        periodSelect.id = 'period-filter';
        periodSelect.innerHTML = `
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
            <option value="day">Today</option>
        `;
        
        // Show inactive players toggle
        const inactiveDiv = document.createElement('div');
        inactiveDiv.className = 'toggle-container';
        inactiveDiv.innerHTML = `
            <label for="show-inactive">Show Inactive</label>
            <input type="checkbox" id="show-inactive">
        `;
        
        filtersDiv.appendChild(periodSelect);
        filtersDiv.appendChild(inactiveDiv);
        
        // Insert after heading
        heading.insertAdjacentElement('afterend', filtersDiv);
        
        // Add event listeners
        document.getElementById('period-filter').addEventListener('change', fetchLeaderboardData);
        document.getElementById('show-inactive').addEventListener('change', fetchLeaderboardData);
    }
}

// Setup back button functionality for both regular web and Telegram WebApp
function setupBackButton() {
    console.log('Setting up back button');
    const backButton = document.getElementById('backButton');
    
    if (backButton) {
        console.log('Back button found in DOM');
        
        // Create a completely new button to replace the existing one
        const newBackButton = document.createElement('button');
        newBackButton.id = 'backButton';
        newBackButton.textContent = 'Back to Menu';
        newBackButton.style.backgroundColor = '#ff6600';
        newBackButton.style.padding = '10px 20px';
        newBackButton.style.margin = '20px';
        newBackButton.style.border = 'none';
        newBackButton.style.borderRadius = '5px';
        newBackButton.style.color = 'white';
        newBackButton.style.fontSize = '1em';
        newBackButton.style.cursor = 'pointer';
        newBackButton.style.zIndex = '100';
        
        // Add event listeners to the new button
        newBackButton.addEventListener('click', function(e) {
            console.log('NEW Back button clicked!', e);
            e.preventDefault(); // Prevent any default behavior
            e.stopPropagation(); // Stop event propagation
            
            try {
                // Try both navigation methods
                console.log('Attempting navigation...');
                
                // Check if we're in Telegram WebApp environment
                if (window.Telegram && window.Telegram.WebApp) {
                    console.log('Detected Telegram WebApp, closing...');
                    window.Telegram.WebApp.close();
                } else {
                    console.log('Not in Telegram WebApp, navigating to index.html...');
                    
                    // Force navigation with a delay and multiple methods
                    setTimeout(function() {
                        try {
                            console.log('Forcing navigation to index.html');
                            window.location.href = 'index.html';
                            
                            // Fallback in case the above doesn't work
                            setTimeout(function() {
                                window.location.replace('index.html');
                            }, 100);
                        } catch (navError) {
                            console.error('Navigation error:', navError);
                            alert('Could not navigate back. Please try again.');
                        }
                    }, 50);
                }
            } catch (error) {
                console.error('Error in back button click handler:', error);
            }
            
            return false; // Again, prevent default
        });
        
        // Replace the existing button with our new one
        backButton.parentNode.replaceChild(newBackButton, backButton);
        console.log('Back button replaced with new implementation');
        
        // Double check event attachment
        setTimeout(() => {
            const checkButton = document.getElementById('backButton');
            checkButton.addEventListener('click', function() {
                console.log('ADDITIONAL click handler firing');
            });
            console.log('Additional click handler attached');
            
            // Dispatch a test click event
            console.log('Testing click simulation on back button');
            checkButton.click();
        }, 200);
    } else {
        console.error('Back button not found in DOM!');
        
        // Try to create one if it doesn't exist
        const container = document.getElementById('leaderboardContainer');
        if (container) {
            console.log('Creating back button since it was not found');
            const newButton = document.createElement('button');
            newButton.id = 'backButton';
            newButton.textContent = 'Back to Menu';
            newButton.style.backgroundColor = '#ff6600';
            newButton.style.padding = '10px 20px';
            newButton.style.margin = '20px';
            newButton.style.border = 'none';
            newButton.style.borderRadius = '5px';
            newButton.style.color = 'white';
            newButton.style.fontSize = '1em';
            newButton.style.cursor = 'pointer';
            
            newButton.addEventListener('click', function() {
                console.log('Created back button clicked');
                window.location.href = 'index.html';
            });
            
            container.appendChild(newButton);
            console.log('Back button created and appended');
        }
    }
}

async function fetchLeaderboardData() {
    const leaderboardList = document.getElementById('leaderboardList');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (!leaderboardList) {
        console.error('Leaderboard list not found!');
        return;
    }

    // Clear previous entries and show loading
    leaderboardList.innerHTML = '';
    if (loadingMessage) loadingMessage.style.display = 'block';

    try {
        // Get filter values
        const periodFilter = document.getElementById('period-filter')?.value || 'all';
        const showInactive = document.getElementById('show-inactive')?.checked || false;
        
        // Fetch filtered leaderboard data
        const response = await fetch(`/api/simple-leaderboard?count=100&period=${periodFilter}&inactive=${showInactive}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch leaderboard.' }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
        }

        const leaderboardData = await response.json();

        if (loadingMessage) loadingMessage.style.display = 'none';

        if (leaderboardData.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'empty-leaderboard';
            emptyItem.textContent = 'No scores yet. Be the first to play!';
            leaderboardList.appendChild(emptyItem);
            return;
        }

        // Create header for the leaderboard
        const headerItem = document.createElement('li');
        headerItem.className = 'header-row';
        headerItem.innerHTML = `
            <span class="rank">#</span>
            <span class="name">Player</span>
            <span class="score">Score</span>
            <span class="stats">
                <span class="wave" title="Highest Wave Reached">Wave</span>
                <span class="games" title="Games Played">Games</span>
            </span>
        `;
        leaderboardList.appendChild(headerItem);

        // Create entry for each player
        leaderboardData.forEach(entry => {
            const listItem = document.createElement('li');
            
            // Add special class for top 3 players
            if (entry.rank <= 3) {
                listItem.className = `top-${entry.rank}`;
            }
            
            // Format last played date if available
            let lastPlayedText = '';
            if (entry.lastPlayed) {
                const lastPlayed = new Date(entry.lastPlayed);
                const now = new Date();
                const diffTime = Math.abs(now - lastPlayed);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    lastPlayedText = 'Today';
                } else if (diffDays === 1) {
                    lastPlayedText = 'Yesterday';
                } else if (diffDays < 7) {
                    lastPlayedText = `${diffDays} days ago`;
                } else {
                    lastPlayedText = lastPlayed.toLocaleDateString();
                }
            }
            
            // Create HTML structure for the entry
            listItem.innerHTML = `
                <span class="rank">${entry.rank}</span>
                <span class="name" title="Last played: ${lastPlayedText || 'Unknown'}">${entry.username}</span>
                <span class="score">${entry.score.toLocaleString()}</span>
                <span class="stats">
                    <span class="wave" title="Highest Wave Reached">${entry.highestWave || 0}</span>
                    <span class="games" title="Games Played">${entry.gamesPlayed || 0}</span>
                </span>
            `;
            
            leaderboardList.appendChild(listItem);
        });

    } catch (error) {
        console.error('Error fetching or displaying leaderboard:', error);
        if (loadingMessage) loadingMessage.style.display = 'none';
        
        const errorItem = document.createElement('li');
        errorItem.className = 'error-message';
        errorItem.textContent = `Could not load leaderboard data: ${error.message}`;
        leaderboardList.appendChild(errorItem);
    }
}

// Initialize Telegram Web App (if applicable)
if (window.Telegram && window.Telegram.WebApp) {
    console.log('Telegram WebApp detected, initializing...');
    window.Telegram.WebApp.ready();
    
    // Enable back button in Telegram's UI if available
    if (window.Telegram.WebApp.BackButton) {
        console.log('Enabling Telegram native back button');
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(function() {
            console.log('Telegram native back button clicked');
            window.location.href = 'index.html';
        });
    }
} else {
    console.log('Telegram WebApp not detected');
}

// Add a global click handler for debugging
document.addEventListener('click', (e) => {
    console.log('Document clicked at:', e.clientX, e.clientY);
    console.log('Target:', e.target);
    
    // If the click was near the back button area but missed it
    const backButton = document.getElementById('backButton');
    if (backButton) {
        const rect = backButton.getBoundingClientRect();
        console.log('Back button rect:', rect);
        
        // Check if click was in the general vicinity of the button
        // but outside its actual bounds (expanded area check)
        const expandedArea = {
            left: rect.left - 20,
            right: rect.right + 20,
            top: rect.top - 20, 
            bottom: rect.bottom + 20
        };
        
        if (e.clientX >= expandedArea.left && e.clientX <= expandedArea.right &&
            e.clientY >= expandedArea.top && e.clientY <= expandedArea.bottom) {
                
            console.log('Click was near the back button - forcing button click');
            backButton.click();
        }
    }
});

// Add direct keyboard shortcut for testing
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
        console.log('Keyboard shortcut used to go back');
        window.location.href = 'index.html';
    }
}); 