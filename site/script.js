/**
 * VibeMovie - Main Script
 * Refactored for modularity and performance
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const CONFIG = {
        selectors: {
            cardContainer: '.main__card-container',
            title: '.movie-title',
            description: '.movie-description',
            ratings: '.emotions-rating',
            buttons: '.movie-button-list-item',
            closeBtn: '.close-card-button',
            moreBtn: '.button-container__more-button',
            overlay: '.overlay',
            // Additional Info
            addInfo: '.additional_info',
            addInfoTitle: '.additional_info__title',
            addInfoDirector: '.additional_info__director',
            addInfoDesc: '.additional_info__description',
            addInfoCast: '.additional_info__cast',
            addInfoGenres: '.additional_info__genres',
            addInfoRating: '.additional_info__rating',
        },
        breakpoints: {
            mobile: 768
        }
    };

    const state = {
        cardOpen: false,
        isDragging: false,
        startX: 0,
        startY: 0,
        initialLeft: 0,
        initialTop: 0,
        startWidth: 0,
        startHeight: 0,
        movieData: null
    };

    // --- DOM Elements Cache ---
    const elements = {};
    for (const [key, selector] of Object.entries(CONFIG.selectors)) {
        // Handle NodeList for multiple elements
        if (['overlay', 'buttons'].includes(key)) {
             elements[key] = document.querySelectorAll(selector);
        } else {
             elements[key] = document.querySelector(selector);
        }
    }
    const body = document.body;
    const root = document.documentElement;

    // --- Helpers ---
    const lerp = (start, end, t) => start * (1 - t) + end * t;
    
    const getClientCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // --- Logic ---

    async function init() {
        await loadMovieData();
        setupEventListeners();
    }

    async function loadMovieData() {
        try {
            const response = await fetch('movies.json');
            const data = await response.json();
            if (data.movies?.length > 0) {
                state.movieData = data.movies[0];
                updateCardUI(state.movieData);
            }
        } catch (error) {
            console.error('Failed to load movie data:', error);
        }
    }

    function updateCardUI(movie) {
        // Main Card Info
        elements.title.textContent = movie.title;
        elements.description.textContent = movie.description;

        // Additional Info
        elements.addInfoTitle.innerHTML = `${movie.title} <span class="movie-year">(${movie.release_year})</span>`;
        elements.addInfoDirector.textContent = movie.director;
        elements.addInfoDesc.textContent = movie.description;
        elements.addInfoCast.textContent = movie.actors;
        elements.addInfoGenres.textContent = movie.genre;
        elements.addInfoRating.textContent = movie.rating;

        updatePoster();
    }

    async function updatePoster() {
        if (!state.movieData) return;
        
        // const isMobile = window.innerWidth < CONFIG.breakpoints.mobile;
        // Logic preserved from original: always use card_bg.jpg for background
        // (Original code had unused posterUrl logic unless strictly for bg image which was hardcoded)
        
        const imgPath = '/site/images/card_bg.jpg';
        elements.cardContainer.style.backgroundImage = `url(${imgPath})`;

        // Color extraction
        const analyze = window.rgbaster || window.RGBaster;
        if (analyze) {
            try {
                const result = await analyze(imgPath, { ignore: ['rgb(255,255,255)'] });
                if (result?.[0]?.color) {
                    const match = result[0].color.match(/\d+,\s*\d+,\s*\d+/);
                    if (match) {
                        root.style.setProperty('--theme-color-rgb', match[0]);
                    }
                }
            } catch (e) {
                console.error('RGBaster error:', e);
            }
        } else {
            console.warn('RGBaster not defined');
        }
    }

    // --- Drag & Animation Logic ---

    function openCard(animated = false) {
        state.cardOpen = true;
        elements.cardContainer.classList.add('is-open');

        const { cardContainer, ratings, description, title, buttons, addInfo, overlay } = elements;
        const transitionMain = 'opacity 0.5s ease-in-out';

        if (animated) {
            // Capture current state for smooth transition
            const rect = cardContainer.getBoundingClientRect();
            
            // Fix position momentarily
            Object.assign(cardContainer.style, {
                transition: 'none',
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                borderRadius: getComputedStyle(cardContainer).borderRadius
            });

            // Force reflow
            cardContainer.offsetHeight;

            // Enable transition
            cardContainer.style.transition = 'all .5s ease-in-out';
            
            [ratings, description, title].forEach(el => el.style.transition = transitionMain);
            buttons.forEach(btn => btn.style.transition = transitionMain);
        }

        // Apply Final State
        Object.assign(cardContainer.style, {
            position: 'fixed',
            borderRadius: '0',
            width: '100%',
            height: '100%',
            top: '0',
            left: '0',
            opacity: '1',
            transform: 'none',
            cursor: 'default'
        });

        // Scroll handling
        const enableScroll = () => {
            cardContainer.style.overflowY = 'auto';
            body.style.overflow = 'hidden';
        };
        
        if (animated) setTimeout(enableScroll, 500);
        else enableScroll();

        // Hide Main Content
        [ratings, description, title].forEach(el => el.style.opacity = '0');
        buttons.forEach(btn => btn.style.opacity = '0');

        // Show Additional Info
        const showAdditional = () => {
            addInfo.style.opacity = '0';
            addInfo.style.display = 'grid';
            
            requestAnimationFrame(() => {
                addInfo.style.opacity = '1';
                overlay.forEach(el => el.style.opacity = '1');
            });
        };

        if (animated) setTimeout(showAdditional, 500);
        else showAdditional();
    }

    function closeCard() {
        state.cardOpen = false;
        elements.cardContainer.classList.remove('is-open');
        const { cardContainer, ratings, description, title, buttons, addInfo, overlay } = elements;

        // Reset Container Styles
        Object.assign(cardContainer.style, {
            transition: 'all 0.5s ease-in-out',
            position: '', left: '', top: '', width: '', height: '',
            borderRadius: '', transform: '', cursor: 'grab', opacity: '1',
            overflowY: ''
        });
        
        body.style.overflow = '';

        // Transition Timings
        const mainTransition = 'opacity 0.8s ease-in-out 0.3s';
        const infoTransition = 'opacity 0.2s ease-in-out';

        // Apply transitions
        [ratings, description, title].forEach(el => el.style.transition = mainTransition);
        buttons.forEach(btn => btn.style.transition = mainTransition);
        
        addInfo.style.transition = infoTransition;
        overlay.forEach(el => el.style.transition = infoTransition);

        // Restore Visibility
        [ratings, description, title].forEach(el => el.style.opacity = '1');
        buttons.forEach(btn => btn.style.opacity = '1');

        // Hide Info
        addInfo.style.opacity = '0';
        overlay.forEach(el => el.style.opacity = '0');

        setTimeout(() => {
            if (!state.cardOpen) addInfo.style.display = 'none';
        }, 500);
    }

    // --- Drag Handlers ---

    function handleDragStart(e) {
        if (state.cardOpen) return;
        
        state.isDragging = true;
        elements.cardContainer.style.transition = 'none';
        elements.cardContainer.style.cursor = 'grabbing';

        const coords = getClientCoords(e);
        state.startX = coords.x;
        state.startY = coords.y;
        state.initialLeft = elements.cardContainer.offsetLeft;
        state.initialTop = elements.cardContainer.offsetTop;
        state.startWidth = elements.cardContainer.offsetWidth;
        state.startHeight = elements.cardContainer.offsetHeight;
    }

    function handleDragMove(e) {
        if (!state.isDragging) return;
        if (e.cancelable) e.preventDefault();

        const coords = getClientCoords(e);
        const deltaX = coords.x - state.startX;
        const deltaY = coords.y - state.startY;
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Horizontal Move (Fade out)
        if (!state.cardOpen) {
            elements.cardContainer.style.left = `${state.initialLeft + deltaX}px`;
            elements.cardContainer.style.top = `${state.initialTop + deltaY}px`;
            
            if (Math.abs(deltaX) >= (winW * 0.1)) {
                elements.cardContainer.style.opacity = (1.1 - (Math.abs(deltaX) / winW));
            }
        }

        // Vertical Move (Expand)
        if (deltaY > 0) {
            const triggerHeight = winH / 5;
            if (deltaY > triggerHeight) {
                openCard(false);
                state.isDragging = false; // Stop custom dragging, switch to open state
                return;
            }

            if (!state.cardOpen) {
                const progress = Math.min(deltaY / triggerHeight, 1);
                
                // Interpolate Dimensions
                const currentW = lerp(state.startWidth, winW, progress);
                const currentH = lerp(state.startHeight, winH, progress);
                
                elements.cardContainer.style.width = `${currentW}px`;
                elements.cardContainer.style.height = `${currentH}px`;

                // Interpolate Position
                const dragLeft = state.initialLeft + deltaX;
                const dragTop = state.initialTop; 
                
                const currentLeft = lerp(dragLeft, 0, progress);
                const currentTop = lerp(dragTop, 0, progress); 
                
                elements.cardContainer.style.left = `${currentLeft}px`;
                elements.cardContainer.style.top = `${currentTop - deltaY/1.8}px`;

                // Interpolate Radius
                elements.cardContainer.style.borderRadius = `${lerp(20, 0, progress)}px`;

                // Interpolate Opacity of Content
                const opacity = 1 - progress;
                [elements.ratings, elements.description, elements.title].forEach(el => el.style.opacity = opacity);
                elements.buttons.forEach(btn => btn.style.opacity = opacity);
            }
        }
    }

    function handleDragEnd() {
        if (!state.isDragging) return;

        if (!state.cardOpen) {
            state.isDragging = false;
            elements.cardContainer.classList.remove('is-open');
            
            // Reset all inline styles modified during drag
            Object.assign(elements.cardContainer.style, {
                transition: 'all 0.5s',
                minHeight: 'initial',
                left: 'initial',
                top: 'initial',
                width: '80%',
                height: '100%',
                borderRadius: '20px', 
                overflowX: 'initial',
                overflowY: 'initial',
                cursor: 'grab',
                opacity: '1'
            });

            // Restore content opacity
            [elements.ratings, elements.description, elements.title].forEach(el => el.style.opacity = '1');
            elements.buttons.forEach(btn => btn.style.opacity = '1');
        } else {
            state.isDragging = false;
            elements.cardContainer.style.cursor = 'default';
        }
    }

    function setupEventListeners() {
        window.addEventListener('resize', updatePoster);

        if (elements.closeBtn) {
            elements.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeCard();
            });
        }

        if (elements.moreBtn) {
            elements.moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCard(true);
            });
        }

        // Mouse Events
        elements.cardContainer.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);

        // Touch Events
        elements.cardContainer.addEventListener('touchstart', handleDragStart, { passive: false });
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);
    }

    // Start
    init();
});
