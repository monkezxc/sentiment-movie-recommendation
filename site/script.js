document.addEventListener('DOMContentLoaded', () => {
    const cardContainer = document.querySelector('.main__card-container');
    const titleElement = document.querySelector('.movie-title');
    const overlayElement = document.querySelectorAll('.overlay');
    const descriptionElement = document.querySelector('.movie-description');
    const body = document.querySelector('body');
    const root = document.querySelector(':root');

    // доп инфа
    let additionalInfoElement = document.querySelector('.additional_info') 
    let additionalInfoTitleElement = document.querySelector('.additional_info__title') 
    let additionalInfoDirectorElement = document.querySelector('.additional_info__director') 
    let additionalInfoDescriptionElement = document.querySelector('.additional_info__description') 
    let additionalInfoCastElement = document.querySelector('.additional_info__cast') 
    let additionalInfoGenresElement = document.querySelector('.additional_info__genres') 
    let additionalInfoRatingElement = document.querySelector('.additional_info__rating') 

    const isMobile = window.innerWidth < 768;
    let cardOpen = false;

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

        additionalInfoTitleElement.textContent =  movie.title
        additionalInfoDirectorElement.textContent = movie.director
        additionalInfoDescriptionElement.textContent = movie.description
        additionalInfoCastElement.textContent = movie.actors
        additionalInfoGenresElement.textContent = movie.genre
        additionalInfoRatingElement.textContent = movie.rating
        
        // Функция для обновления постера в зависимости от ширины экрана
        // Function to update poster depending on screen width
        const updatePoster = async () => {
            // Используем 768px как точку перелома (стандарт для планшетов/мобильных)
            // Using 768px as a breakpoint
            const posterUrl = isMobile ? movie.vertical_poster : movie.horizontal_poster;
            
            // Устанавливаем изображение как фон
            // Set image as background
            const img = '/images/card_bg.jpg'
            cardContainer.style.backgroundImage = `url(${img})`;

            // Проверяем наличие библиотеки (имя может быть rgbaster или RGBaster)
            // Check for library existence (name might be rgbaster or RGBaster)
            const analyze = window.rgbaster || window.RGBaster;
            
            if (analyze) {
                try {
                    const result = await analyze(img, { ignore: ['rgb(255,255,255)'] });
                    if (result && result.length > 0) {
                        const dominant = result[0].color;
                        const match = dominant.match(/\d+,\s*\d+,\s*\d+/);
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
    let startWidth, startHeight; // Start dimensions

    // Вспомогательная функция для получения координат X/Y (неважно, мышь это или тач)
    const getClientCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // 1. START (Начало)
    const onDragStart = (e) => {
        // Если карточка открыта, не начинаем перетаскивание, чтобы работал скролл
        // If the card is open, do not start dragging to allow scrolling
        if (cardOpen) return;

        // Если это тач-событие, то e.target может быть не тем, если мышь - то e.button === 0 (левая кнопка)
        // Для простоты считаем любое начало валидным
        cardContainer.style.transition = 'none';
        isDragging = true;
        const coords = getClientCoords(e);
        startX = coords.x;
        startY = coords.y;

        initialLeft = cardContainer.offsetLeft;
        initialTop = cardContainer.offsetTop;
        
        // Запоминаем начальные размеры
        startWidth = cardContainer.offsetWidth;
        startHeight = cardContainer.offsetHeight;

        cardContainer.style.cursor = 'grabbing';
    };


    let cardTitle = document.querySelector('.movie-title');
    let cardRatings = document.querySelector('.emotions-rating');
    let cardDescription = document.querySelector('.movie-description');
    let cardButtons = document.querySelectorAll('.movie-button-list-item');

    function openCard(animated = false) {
        cardOpen = true;


        if (animated) {
            // Smooth transition setup
            const rect = cardContainer.getBoundingClientRect();
            
            // 1. Set explicit start values in fixed positioning
            cardContainer.style.transition = 'none';
            cardContainer.style.position = 'fixed';
            cardContainer.style.left = `${rect.left}px`;
            cardContainer.style.top = `${rect.top}px`;
            cardContainer.style.width = `${rect.width}px`;
            cardContainer.style.height = `${rect.height}px`;
            cardContainer.style.borderRadius = getComputedStyle(cardContainer).borderRadius; // Keep current radius

            // Force reflow
            cardContainer.offsetHeight; 

            // 2. Enable transition
            cardContainer.style.transition = 'all .5s ease-in-out';
            const transition = 'opacity .5s ease-in-out';
            cardRatings.style.transition = transition;
            cardDescription.style.transition = transition;
            cardTitle.style.transition = transition;
            cardButtons.forEach(btn => btn.style.transition = transition);
        }

        // Final State
        cardContainer.style.position = 'fixed';
        cardContainer.style.borderRadius = '0';
        cardContainer.style.width = '100%';
        cardContainer.style.height = '100%';
        cardContainer.style.top = '0';
        cardContainer.style.left = '0';
        cardContainer.style.opacity = '1';
        cardContainer.style.transform = 'none';
        cardContainer.style.cursor = 'default';
        
        // Enable scroll on container, disable on body
        if (animated) {
            setTimeout(() => {
                cardContainer.style.overflowY = 'auto';
                body.style.overflow = 'hidden';
            }, 500)
        } else {
            cardContainer.style.overflowY = 'auto';
            body.style.overflow = 'hidden';
        }
        // Hide elements
        cardRatings.style.opacity = '0';
        cardDescription.style.opacity = '0';
        cardTitle.style.opacity = '0';
        cardButtons.forEach(btn => btn.style.opacity = '0');

        if (animated) {
            setTimeout(() => {
                additionalInfoElement.style.opacity = '0'; // Гарантируем начальное состояние
                additionalInfoElement.style.display = 'grid';
                
                // Небольшая задержка, чтобы браузер успел отрисовать блок
                requestAnimationFrame(() => {
                    additionalInfoElement.style.opacity = '1';
                    overlayElement.forEach(overlay => overlay.style.opacity = '1');
                });
            }, 500);
        } else {
                // Immediate
                additionalInfoElement.style.opacity = '0';
                additionalInfoElement.style.display = 'grid';
                
                requestAnimationFrame(() => {
                    additionalInfoElement.style.opacity = '1';
                    overlayElement.forEach(overlay => overlay.style.opacity = '1');
                });
        }
    };

    const moreButton = document.querySelector('.button-container__more-button');
    if (moreButton) {
        moreButton.addEventListener('click', (e) => {
            e.stopPropagation();
            openCard(true);
        });
    }

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

        if (!cardOpen) {
            cardContainer.style.left = `${initialLeft + deltaX}px`;
            cardContainer.style.top = `${initialTop + deltaY}px`;
        }

        if (Math.abs(deltaX) >= (windowWidth * 0.1) && !cardOpen) {
                cardContainer.style.opacity = (1.1-(Math.abs(deltaX)/windowWidth))
        }
        
        if (deltaY > 0) {
            // Порог для открытия (20% от высоты экрана)
            const triggerHeight = windowHeight / 5;

            if (deltaY > triggerHeight) {
                openCard(false);
            }

            if (!cardOpen) {
                // Логика плавного увеличения (Interpolation)
                // progress идет от 0 до 1 по мере приближения к порогу открытия
                const progress = Math.min(deltaY / triggerHeight, 1);
                
                // Функция линейной интерполяции (lerp)
                const lerp = (start, end, t) => start * (1 - t) + end * t;

                // 1. Плавно меняем размеры от текущих до размеров экрана
                const currentWidth = lerp(startWidth, windowWidth, progress);
                // Высоту увеличиваем чуть быстрее или так же, цель - 100vh
                const currentHeight = lerp(startHeight, windowHeight, progress);

                cardContainer.style.width = `${currentWidth}px`;
                cardContainer.style.height = `${currentHeight}px`;

                // 2. Плавно меняем позицию
                // Идея: Интерполируем между "точкой перетаскивания" и "нулевыми координатами (0,0)"
                // Если мы просто тащим (progress 0), мы используем (initialLeft + deltaX)
                // Если мы полностью открыли (progress 1), координаты должны стать (0, 0)
                
                const dragLeft = initialLeft + deltaX;
                const dragTop = initialTop;
                
                const currentLeft = lerp(dragLeft, 0, progress);
                const currentTop = lerp(dragTop, 0, progress);

                cardContainer.style.left = `${currentLeft}px`;
                cardContainer.style.top = `${currentTop - deltaY/1.8}px`;

                // 3. Убираем скругление углов
                cardContainer.style.borderRadius = `${lerp(20, 0, progress)}px`;

                // 4. Сокрытие информации (прозрачность)
                const opacity = 1 - progress;
                cardRatings.style.opacity = opacity;
                cardDescription.style.opacity = opacity;
                cardTitle.style.opacity = opacity;

                cardButtons.forEach(btn => {
                    btn.style.opacity = opacity;
                });
            };

        }
    };

    // 3. END (Конец)
    const onDragEnd = () => {
        if (isDragging) {
            if (!cardOpen) {
                isDragging = false;
                cardContainer.style.transition = 'all 0.5s'; // Возвращаем анимацию
                cardContainer.style.minHeight = 'initial';
                cardContainer.style.left = 'initial'; // Сброс к CSS значениям (по центру)
                cardContainer.style.top = 'initial';
                cardContainer.style.width = "80%";
                cardContainer.style.height = "100%";
                cardContainer.style.borderRadius = "20px"; // Возвращаем скругление
                
                cardContainer.style.cursor = 'grab';
                cardContainer.style.opacity = 1;
                
                cardRatings.style.opacity = 1;
                cardDescription.style.opacity = 1;
                cardTitle.style.opacity = 1;
                
                cardButtons.forEach(btn => {
                    btn.style.opacity = 1;
                });
            } else {
                // Если карточка открылась, завершаем перетаскивание, но оставляем состояние Open
                isDragging = false;
                cardContainer.style.cursor = 'default';
            }
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

