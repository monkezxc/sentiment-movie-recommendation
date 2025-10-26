let closeButton = document.querySelector('.close-button');
let openButton = document.querySelector('.show-button');
let mainContainer = document.querySelector('.main-container');
let movieList = document.querySelector('.movie-list');
let loader = document.getElementById('loader');

// Movies data and state
let movies = [];
let currentPage = 0;
const moviesPerPage = 20;

// Load movies from JSON file
async function loadMovies() {
    try {
        loader.classList.remove('hidden');
        const response = await fetch('./movies.json');
        movies = await response.json();
        loader.classList.add('hidden');
        renderMovies(0);
        setupInfiniteScroll();
    } catch (error) {
        loader.textContent = 'Error loading movies. Please refresh the page.';
        console.error('Error loading movies:', error);
    }
}

// Render movies based on page
function renderMovies(startIndex) {
    const endIndex = startIndex + moviesPerPage;
    const moviesToShow = movies.slice(startIndex, endIndex);
    
    moviesToShow.forEach(movie => {
        const movieCard = createMovieCard(movie);
        movieList.appendChild(movieCard);
    });
}

// Create a movie card element
function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    // Poster
    const poster = document.createElement('img');
    poster.className = 'movie-poster';
    poster.src = movie.poster;
    poster.alt = movie.name;
    poster.onerror = function() {
        this.src = 'https://via.placeholder.com/150x225?text=No+Image';
    };
    
    // Info section
    const infoSection = document.createElement('div');
    infoSection.className = 'movie-info';
    
    const title = document.createElement('div');
    title.className = 'movie-title';
    title.textContent = `${movie.name} (${movie.year}).dcp`;
    
    const description = document.createElement('div');
    description.className = 'movie-description';
    description.textContent = movie.description;
    
    infoSection.appendChild(title);
    infoSection.appendChild(description);
    
    // Emotions section
    const emotionsSection = document.createElement('div');
    emotionsSection.className = 'movie-emotions';
    
    movie.emotions.forEach(emotion => {
        const emotionDiv = document.createElement('div');
        emotionDiv.className = 'emotion-rating';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'emotion-name';
        nameSpan.textContent = emotion.name + ': ';
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'emotion-score';
        scoreSpan.textContent = `${emotion.score}/10`;
        
        emotionDiv.appendChild(nameSpan);
        emotionDiv.appendChild(scoreSpan);
        emotionsSection.appendChild(emotionDiv);
    });
    
    card.appendChild(poster);
    card.appendChild(infoSection);
    card.appendChild(emotionsSection);
    
    return card;
}

// Setup infinite scroll
function setupInfiniteScroll() {
    movieList.addEventListener('scroll', function() {
        // Check if scrolled near the bottom (within 100px)
        const scrollPosition = movieList.scrollTop + movieList.clientHeight;
        const totalHeight = movieList.scrollHeight;
        
        if (scrollPosition >= totalHeight - 100) {
            // Load next page if there are more movies
            const nextPageStart = (currentPage + 1) * moviesPerPage;
            if (nextPageStart < movies.length) {
                currentPage++;
                renderMovies(nextPageStart);
            }
        }
    });
}

// Button handlers
closeButton.addEventListener('click', function () {
    mainContainer.hidden = true;
});

openButton.addEventListener('click', function () {
    mainContainer.hidden = false;
});

// Initialize
loadMovies();