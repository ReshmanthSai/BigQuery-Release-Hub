// State Management
let state = {
    notes: [],
    filteredNotes: [],
    activeFilter: 'all',
    searchQuery: '',
    isLoading: false
};

// DOM Elements
const notesGrid = document.getElementById('notes-grid');
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorCard = document.getElementById('error-card');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const retryBtn = document.getElementById('retry-btn');
const spinner = document.getElementById('spinner');
const btnText = refreshBtn.querySelector('.btn-text');
const noteCountBadge = document.getElementById('note-count-badge');
const searchInput = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.chip');

// Modal Elements
const detailsModal = document.getElementById('details-modal');
const modalClose = document.getElementById('modal-close');
const modalBadge = document.getElementById('modal-badge');
const modalDate = document.getElementById('modal-date');
const modalTitle = document.getElementById('modal-title');
const modalHtmlContent = document.getElementById('modal-html-content');
const modalSourceLink = document.getElementById('modal-source-link');
const modalTweetBtn = document.getElementById('modal-tweet-btn');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchNotes(false);
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh & Retry Buttons
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    retryBtn.addEventListener('click', () => fetchNotes(true));
    
    // Search Input (Debounced search logic)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        state.searchQuery = e.target.value.trim().toLowerCase();
        searchTimeout = setTimeout(() => {
            applyFiltersAndSearch();
        }, 150);
    });

    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Update UI active state
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            // Update state and apply
            state.activeFilter = chip.getAttribute('data-filter');
            applyFiltersAndSearch();
        });
    });

    // Modal Close Events
    modalClose.addEventListener('click', closeModal);
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) closeModal();
    });
    
    // Listen to Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !detailsModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // Persistent modal tweet click handler using active state route
    modalTweetBtn.addEventListener('click', () => {
        if (state.currentModalNote) {
            shareOnX(state.currentModalNote);
        }
    });
}

// Fetch Notes from Flask Backend
async function fetchNotes(isRefresh = false) {
    if (state.isLoading) return;
    
    // Set UI to loading state
    state.isLoading = true;
    toggleLoadingUI(true, isRefresh);
    
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Server returned an unsuccessful response');
        }
        
        state.notes = data.notes;
        
        // Hide error container
        errorCard.classList.add('hidden');
        
        // Process UI
        applyFiltersAndSearch();
        
    } catch (error) {
        console.error('Fetch error:', error);
        errorMessage.textContent = `Error: ${error.message || 'Could not reach the BigQuery release feed.'}`;
        
        // Hide notes grid & skeletons, show error
        notesGrid.classList.add('hidden');
        loadingSkeleton.classList.add('hidden');
        emptyState.classList.add('hidden');
        errorCard.classList.remove('hidden');
        noteCountBadge.textContent = 'Error loading';
    } finally {
        state.isLoading = false;
        // Clean up loading UI state
        toggleLoadingUI(false, isRefresh);
    }
}

// Helper to show/hide skeletons and animate spinner
function toggleLoadingUI(isLoading, isRefresh) {
    if (isLoading) {
        if (isRefresh) {
            spinner.classList.remove('hidden');
            refreshBtn.disabled = true;
            btnText.textContent = 'Updating...';
        } else {
            loadingSkeleton.classList.remove('hidden');
            notesGrid.classList.add('hidden');
        }
        emptyState.classList.add('hidden');
    } else {
        // Stop button spin state
        spinner.classList.add('hidden');
        refreshBtn.disabled = false;
        btnText.textContent = 'Refresh';
        
        // Hide skeletons
        loadingSkeleton.classList.add('hidden');
    }
}

// Apply Filters & Search query on current state
function applyFiltersAndSearch() {
    const { notes, activeFilter, searchQuery } = state;
    
    // 1. Filter by category
    let result = notes;
    if (activeFilter !== 'all') {
        result = notes.filter(note => note.type.toLowerCase() === activeFilter.toLowerCase());
    }
    
    // 2. Filter by search query
    if (searchQuery) {
        result = result.filter(note => {
            return note.title.toLowerCase().includes(searchQuery) ||
                   note.summary.toLowerCase().includes(searchQuery) ||
                   note.type.toLowerCase().includes(searchQuery);
        });
    }
    
    state.filteredNotes = result;
    
    // Update Badge Count
    if (notes.length === 0) {
        noteCountBadge.textContent = '0 updates';
    } else if (searchQuery || activeFilter !== 'all') {
        noteCountBadge.textContent = `Showing ${result.length} of ${notes.length}`;
    } else {
        noteCountBadge.textContent = `${notes.length} updates`;
    }
    
    // Render Results
    renderNotesGrid();
}

// Render the grid of cards
function renderNotesGrid() {
    const { filteredNotes } = state;
    
    // Clear previous cards
    notesGrid.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        notesGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    // Show grid, hide empty state
    emptyState.classList.add('hidden');
    notesGrid.classList.remove('hidden');
    
    // Append cards dynamically
    filteredNotes.forEach((note, index) => {
        const card = document.createElement('article');
        
        // Match card CSS classes
        const cleanType = note.type.replace(/\s+/g, '');
        card.className = `note-card ${cleanType}`;
        
        // Cascade animation delay for staggered entrance effect
        card.style.animation = `window-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1) both`;
        card.style.animationDelay = `${Math.min(index * 0.05, 0.6)}s`;
        
        card.innerHTML = `
            <div class="card-header">
                <span class="badge ${cleanType}">${note.type}</span>
                <time class="card-date" datetime="${note.published}">${note.date}</time>
            </div>
            <div class="card-body">
                <h3 class="card-title">${note.title}</h3>
                <p class="card-summary">${note.summary}</p>
            </div>
            <div class="card-footer">
                <span class="read-more-link">
                    Read Details
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </span>
                <button class="tweet-btn" aria-label="Share on X">
                    <svg viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Add card click event (for detail view modal)
        card.addEventListener('click', (e) => {
            // Check if tweet button itself was clicked, prevent triggering card modal
            if (e.target.closest('.tweet-btn')) {
                e.stopPropagation();
                shareOnX(note);
                return;
            }
            openModal(note);
        });
        
        notesGrid.appendChild(card);
    });
}

// Generate Twitter Web Intent draft and open it in a centered popup window
function shareOnX(note) {
    // Construct tweet text. 
    // Title is like "Feature - June 15, 2026". We can clean it up.
    // Format: "Google BigQuery [Type] Update: [Brief Text] -> [Link]"
    const cleanSummary = note.summary.replace(/\s+/g, ' ').trim();
    // Truncate summary to keep character count under Twitter's 280-char limit
    // Allow around 140 chars for the summary, + title, + link
    const summaryLimit = 130;
    let truncatedSummary = cleanSummary;
    if (cleanSummary.length > summaryLimit) {
        truncatedSummary = cleanSummary.substring(0, summaryLimit).trim() + '...';
    }
    
    const tweetText = `BigQuery ${note.type} Update (${note.date}):\n"${truncatedSummary}"\n\nRead more details:`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(note.link)}&hashtags=GoogleCloud,BigQuery,DataEngineering`;
    
    // Center popup screen coordinates
    const width = 550;
    const height = 450;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(
        tweetUrl, 
        'ShareUpdateX', 
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
}

// Open Detail Modal
function openModal(note) {
    // Map badges
    const cleanType = note.type.replace(/\s+/g, '');
    modalBadge.textContent = note.type;
    modalBadge.className = `badge ${cleanType}`;
    
    modalDate.textContent = note.date;
    modalTitle.textContent = note.title;
    
    // Load parsed HTML content
    modalHtmlContent.innerHTML = note.content;
    
    // Set Footer Links
    modalSourceLink.href = note.link;
    
    // Cache the reference for the persistent tweet listener
    state.currentModalNote = note;
    
    // Show modal overlay with transition
    detailsModal.classList.remove('hidden');
    // Force browser reflow to register the display: flex before adding active
    void detailsModal.offsetWidth;
    detailsModal.classList.add('active');
    
    // Add class on body to prevent background scrolling when modal is active
    document.body.style.overflow = 'hidden';
}

// Close Detail Modal
function closeModal() {
    detailsModal.classList.remove('active');
    // Wait for the 300ms transition to finish before display: none
    setTimeout(() => {
        if (!detailsModal.classList.contains('active')) {
            detailsModal.classList.add('hidden');
        }
    }, 300);
    // Restore scrolling
    document.body.style.overflow = '';
}
