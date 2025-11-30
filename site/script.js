document.addEventListener('DOMContentLoaded', () => {
    const cardContainer = document.querySelector('.main__card-container');
    const titleElement = document.querySelector('.movie-title');
    const descriptionElement = document.querySelector('.movie-description');
    let cardIsDragging = false;

    async function loadMovieData() {
        try {
            const response = await fetch('movies.json');
            const data = await response.json();
            
            // Берем первый фильм из массива
            // Take the first movie from the array
            if (data.movies && data.movies.length > 0) {
                const movie = data.movies[0];
                updateCard(movie);
            }
        } catch (error) {
            console.error('Error loading movie data:', error);
        }
    }

    function updateCard(movie) {
        // Обновляем заголовок и описание
        // Update title and description
        titleElement.textContent = movie.title;
        descriptionElement.textContent = movie.description;

        // Функция для обновления постера в зависимости от ширины экрана
        // Function to update poster depending on screen width
        const updatePoster = () => {
            // Используем 768px как точку перелома (стандарт для планшетов/мобильных)
            // Using 768px as a breakpoint
            const isMobile = window.innerWidth < 768;
            const posterUrl = isMobile ? movie.vertical_poster : movie.horizontal_poster;
            
            // Устанавливаем изображение как фон
            // Set image as background
            cardContainer.style.backgroundImage = `url('/images/card_bg.jpg')`;
        };

        // Устанавливаем постер сразу
        // Set poster immediately
        updatePoster();

        // Добавляем слушатель изменения размера окна
        // Add window resize listener
        window.addEventListener('resize', updatePoster);
    }

    loadMovieData();


    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    // Вспомогательная функция для получения координат X/Y (неважно, мышь это или тач)
    const getClientCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // 1. START (Начало)
    const onDragStart = (e) => {
        // Если это тач-событие, то e.target может быть не тем, если мышь - то e.button === 0 (левая кнопка)
        // Для простоты считаем любое начало валидным
        cardContainer.style.transition = 'none';
        isDragging = true;
        const coords = getClientCoords(e);
        startX = coords.x;
        startY = coords.y;

        initialLeft = cardContainer.offsetLeft;
        initialTop = cardContainer.offsetTop;
        
        cardContainer.style.cursor = 'grabbing';
    };


    let cardTitle = document.querySelector('.movie-title');
    let cardRatings = document.querySelector('.emotions-rating');
    let cardDescription = document.querySelector('.movie-description');
    let cardButtons = document.querySelectorAll('.movie-button-list-item');

    // 2. MOVE (Движение)
    const onDragMove = (e) => {
        if (!isDragging) return;

        // Предотвращаем скролл страницы при перетаскивании на телефоне
        // (важно, иначе браузер будет пытаться прокрутить страницу вместо движения элемента)
        if (e.cancelable) e.preventDefault(); 

        const coords = getClientCoords(e);
        const deltaX = coords.x - startX;
        const deltaY = coords.y - startY;
        let windowWidth = window.innerWidth;
        let windowHeight = window.innerHeight;

        cardContainer.style.left = `${initialLeft + deltaX}px`;
        cardContainer.style.top = `${initialTop + deltaY}px`;

        if (Math.abs(deltaX) >= (windowWidth * 0.1)) {
                cardContainer.style.opacity = 1*(1-(Math.abs(deltaX)/windowWidth))
        }
        
        if (deltaY > 0) {
            // увеличение карточки
            cardContainer.style.width = (80 + (deltaY * 100)/windowHeight) + '%';
            cardContainer.style.height = 100 + ((deltaY * 100)/windowHeight)*(windowWidth/windowHeight) + '%';

            if (initialLeft + deltaX - deltaY > windowWidth*2/-100) {
                cardContainer.style.left = `${initialLeft + deltaX - deltaY}px`;
            } else {
                cardContainer.style.left = `-1.5vw`
            };

            if (windowHeight*10/100 - deltaY/2.4 > windowHeight*2/-100) {
                cardContainer.style.top = `${initialTop - deltaY/2.4}px`;
            } else {
                cardContainer.style.top = `-10vh`;
            };

            // сокрытие информации
            cardRatings.style.opacity = 1 - ((deltaY * 100)/windowHeight)*0.05;
            cardDescription.style.opacity = 1 - ((deltaY * 100)/windowHeight)*0.05;

            function lower_opacity(val, index) {
                val.style.opacity = 1 - ((deltaY * 100)/windowHeight)*0.05;
            }
            cardButtons.forEach(lower_opacity)
        }
    };

    // 3. END (Конец)
    const onDragEnd = () => {
        if (isDragging) {
            isDragging = false;
            cardContainer.style.left = 'initial';
            cardContainer.style.top = 'initial';
            cardContainer.style.cursor = 'grab';
            cardContainer.style.opacity = 1;
            cardContainer.style.width = "80%";
            cardContainer.style.height = "100%";
            cardRatings.style.opacity = 1;
            cardDescription.style.opacity = 1;
            function rise_opacity(val, index) {
                val.style.opacity = 1;
            }
            cardButtons.forEach(rise_opacity);
        }
    };

    // Мышь (Desktop)
    cardContainer.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    // Сенсор (Mobile)
    // passive: false нужно, чтобы работал e.preventDefault() внутри обработчика (блокировка скролла)
    cardContainer.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
});

