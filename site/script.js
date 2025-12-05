document.addEventListener('DOMContentLoaded', () => {
    // Управление состоянием приложения
    const state = {
        movies: [],
        currentIndex: 0,
        isAnimating: false,
        isDragging: false,
        startX: 0,
        startY: 0,
        currentCard: null,
        cardOpen: false,
        initialLeft: 0,
        initialTop: 0,
        startWidth: 0,
        startHeight: 0,
        width: window.innerWidth,
    };

    // DOM элементы
    const wrapper = document.querySelector('.cards-wrapper');
    const root = document.documentElement;

    // Вспомогательная функция линейной интерполяции (для анимации)
    const lerp = (start, end, t) => start * (1 - t) + end * t;
    
    init();

    // Инициализация: загрузка данных фильмов
    async function init() {
        await loadMovieData();
    }

    // Загрузка списка фильмов из JSON файла
    async function loadMovieData() {
        try {
            const response = await fetch('movies.json');
            const data = await response.json();
            if (data.movies && data.movies.length > 0) {
                state.movies = data.movies;
                renderInitialStack();
            }
        } catch (error) {
            console.error('Failed to load movie data:', error);
        }
    }

    // Отрисовка начального стека карт (активная и следующая)
    function renderInitialStack() {
        if (state.movies[0]) {
            createAndAppendCard(0, 'active');
        }
        if (state.movies[1]) {
            createAndAppendCard(1, 'next');
        }
    }

    // Создание и добавление DOM-элемента карты
    function createAndAppendCard(index, type) {
        if (index >= state.movies.length) return;
        // проверка на ширину экрана для выбора постера
        const isMobile = state.width <= 456;
        
        const movie = state.movies[index];
        
        const template = document.getElementById('movie-card-template');
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.card');
        
        card.classList.add(type);
        card.dataset.index = index;

        const bgImage = isMobile ? movie.vertical_poster : movie.horizontal_poster;
        card.style.backgroundImage = `url(${bgImage})`;

        const id = movie.id;

        card.querySelector('.movie-title').textContent = movie.title;
        card.querySelector('.movie-description').textContent = movie.description;
        
        card.querySelector('.additional_info__title').innerHTML = `${movie.title} <span class="movie-year">(${movie.release_year})</span>`;
        card.querySelector('.additional_info__director').textContent = movie.director;
        
        card.querySelector('.additional_info__description').textContent = movie.description;
        card.querySelector('.additional_info__cast').textContent = movie.actors;
        card.querySelector('.additional_info__genres').textContent = movie.genre;
        card.querySelector('.additional_info__rating').textContent = movie.rating;

        wrapper.appendChild(card);

        extractColors(bgImage, card);

        setupCardEvents(card);
    }

    // Извлечение доминантного цвета из изображения
    async function extractColors(imagePath, cardElement) {
        const analyze = window.rgbaster || window.RGBaster;
        if (!analyze) return;

        try {
            const result = await analyze(imagePath, { ignore: ['rgb(255,255,255)'] });
            if (result?.[0]?.color) {
                const match = result[0].color.match(/\d+,\s*\d+,\s*\d+/);
                if (match) {
                    cardElement.style.setProperty('--theme-color-rgb', match[0]);
                }
            }
        } catch (e) {
        }
    }

    // Настройка обработчиков событий для карты
    function setupCardEvents(card) {
        const yesBtn = card.querySelector('[data-action="yes"]');
        const noBtn = card.querySelector('[data-action="no"]');
        const moreBtn = card.querySelector('[data-action="more"]');
        const closeBtn = card.querySelector('.close-card-button');

        // обработка кнопок 'Да' и 'Нет'
        if (yesBtn) yesBtn.addEventListener('click', (e) => { e.stopPropagation(); handleVoteLogic('yes'); });
        if (noBtn) noBtn.addEventListener('click', (e) => { e.stopPropagation(); handleVoteLogic('no'); });
        
        if (moreBtn) moreBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            openCard(card, true); 
        });

        if (closeBtn) closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCard(card);
        });

        // обработка касаний для свайпов
        card.addEventListener('mousedown', handleDragStart);
        card.addEventListener('touchstart', handleDragStart, { passive: false });
    }

    // Логика голосования (лайк/дизлайк)
    function handleVoteLogic(decision) {
        if (state.isAnimating) return;
        
        const activeCard = wrapper.querySelector('.card.active');
        if (!activeCard) return;

        state.isAnimating = true;

        const exitClass = decision === 'yes' ? 'exit-right' : 'exit-left';
        activeCard.classList.add(exitClass);
        activeCard.classList.remove('active');

        const nextCard = wrapper.querySelector('.card.next');
        if (nextCard) {
            nextCard.classList.remove('next');
            nextCard.classList.add('active');
            nextCard.style.transform = ''; 
        }

        state.currentIndex++; 
        const nextNextIndex = state.currentIndex + 1;
        
        createAndAppendCard(nextNextIndex, 'next');

        setTimeout(() => {
            activeCard.remove();
            state.isAnimating = false;
        }, 500);
    }

    // Начало перетаскивания карты
    function handleDragStart(e) {
        const card = e.currentTarget;
        if (!card.classList.contains('active') || state.cardOpen) return;

        state.isDragging = true;
        state.currentCard = card;
        state.startX = getClientX(e);
        state.startY = getClientY(e);
        
        state.initialLeft = card.offsetLeft;
        state.initialTop = card.offsetTop;
        state.startWidth = card.offsetWidth;
        state.startHeight = card.offsetHeight;

        card.style.transition = 'none';
    }

    // Обработка перемещения карты
    function handleDragMove(e) {
        if (!state.isDragging || !state.currentCard) return;
        
        const currentX = getClientX(e);
        const currentY = getClientY(e);
        
        const deltaX = currentX - state.startX;
        const deltaY = currentY - state.startY;
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // плавное увеличение прозрачности в зависимости от расстояния от центра
        if (!state.cardOpen) {
             state.currentCard.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

             if (Math.abs(deltaX) >= (winW * 0.1)) {
                state.currentCard.style.opacity = (1.1 - (Math.abs(deltaX) / winW));
             }
        }

        // логика открытия карточки свайпом вниз
        if (deltaY > 0) {
            const triggerHeight = winH / 5;
            
            // если достигаем определенной точки, открываем карточку
            if (deltaY > triggerHeight) {
                openCard(state.currentCard, false);
                state.isDragging = false;
                return;
            }

            if (!state.cardOpen) {
                // считаем прогресс перемещения вниз
                const progress = Math.min(deltaY / triggerHeight, 1);
                
                const currentW = lerp(state.startWidth, winW, progress);
                const currentH = lerp(state.startHeight, winH, progress);
                
                state.currentCard.style.width = `${currentW}px`;
                state.currentCard.style.height = `${currentH}px`;

                state.currentCard.style.transform = 'none'; 
                
                const dragLeft = state.initialLeft + deltaX;
                
                const currentLeft = lerp(dragLeft, 0, progress);
                
                // плавное открытие карточки
                state.currentCard.style.left = `${currentLeft}px`;
                state.currentCard.style.top = `${state.initialTop - deltaY/1.8}px`;

                state.currentCard.style.borderRadius = `${lerp(20, 0, progress)}px`;

                const opacity = 1 - progress;
                const ratings = state.currentCard.querySelector('.emotions-rating');
                const description = state.currentCard.querySelector('.movie-description');
                const title = state.currentCard.querySelector('.movie-title');
                const buttons = state.currentCard.querySelectorAll('.movie-button-list-item');

                if(ratings) ratings.style.opacity = opacity;
                if(description) description.style.opacity = opacity;
                if(title) title.style.opacity = opacity;
                buttons.forEach(btn => btn.style.opacity = opacity);
            }
        } else {
            // если движение вниз не происходит, размеры карточки фиксированные
            state.currentCard.style.width = '80%';
            state.currentCard.style.height = '100%';
            state.currentCard.style.borderRadius = '20px';
        }
    }

    // Завершение перетаскивания
    function handleDragEnd(e) {
        if (!state.isDragging || !state.currentCard) return;

        const card = state.currentCard;
        const deltaX = getClientX(e) - state.startX;

        // возврат к стандартным значениям в css файле
        if (!state.cardOpen) {
            state.isDragging = false;
            
            card.style.transition = 'all 0.5s ease-in-out';
            card.style.transform = '';
            card.style.width = '';
            card.style.height = '';
            card.style.left = '';
            card.style.top = '';
            card.style.borderRadius = '';
            card.style.opacity = '1';
            
            const elementsToRestore = card.querySelectorAll('.emotions-rating, .movie-description, .movie-title, .movie-button-list-item');
            elementsToRestore.forEach(el => el.style.opacity = '1');

            const threshold = window.innerWidth * 0.25;
            if (Math.abs(deltaX) > threshold) {
                handleVoteLogic(deltaX > 0 ? 'yes' : 'no');
            }
        } else {
            state.isDragging = false;
        }
    }

    // Глобальные обработчики событий ввода
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    // Получение координаты X из события мыши или касания
    function getClientX(e) {
        if (e.changedTouches && e.changedTouches.length > 0) {
            return e.changedTouches[0].clientX;
        }
        if (e.touches && e.touches.length > 0) {
            return e.touches[0].clientX;
        }
        return e.clientX;
    }

    // Получение координаты Y из события мыши или касания
    function getClientY(e) {
        if (e.changedTouches && e.changedTouches.length > 0) {
            return e.changedTouches[0].clientY;
        }
        if (e.touches && e.touches.length > 0) {
            return e.touches[0].clientY;
        }
        return e.clientY;
    }

    // Открытие карты на весь экран
    function openCard(card, animated = false) {
        state.cardOpen = true;
        card.classList.add('is-open');

        const ratings = card.querySelector('.emotions-rating');
        const description = card.querySelector('.movie-description');
        const title = card.querySelector('.movie-title');
        const buttons = card.querySelectorAll('.movie-button-list-item'); 
        const addInfo = card.querySelector('.additional_info');
        const overlay = card.querySelectorAll('.overlay'); 

        const transitionMain = 'opacity 0.5s ease-in-out';

        if (animated) {
            const rect = card.getBoundingClientRect();
            
            Object.assign(card.style, {
                transition: 'none',
                position: 'fixed',
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                borderRadius: getComputedStyle(card).borderRadius,
                transform: 'none',
                zIndex: '1000' 
            });

            card.offsetHeight;

            card.style.transition = 'all .5s ease-in-out';
            
            if(ratings) ratings.style.transition = transitionMain;
            if(description) description.style.transition = transitionMain;
            if(title) title.style.transition = transitionMain;
            buttons.forEach(btn => btn.style.transition = transitionMain);
        }

        Object.assign(card.style, {
            position: 'fixed',
            borderRadius: '0',
            width: '100%',
            height: '100%',
            top: '0',
            left: '0',
            opacity: '1',
            transform: 'none',
            cursor: 'default',
            zIndex: '1000'
        });

        const enableScroll = () => {
            card.style.overflowY = 'auto';
            document.body.style.overflow = 'hidden';
        };
        
        if (animated) setTimeout(enableScroll, 500);
        else enableScroll();

        // скрываем данные, указанные на закрытой карточке
        if(ratings) ratings.style.opacity = '0';
        if(description) description.style.opacity = '0';
        if(title) title.style.opacity = '0';
        buttons.forEach(btn => btn.style.opacity = '0');

        const showAdditional = () => {
            if (addInfo) {
                addInfo.style.opacity = '0';
                addInfo.style.display = 'grid';
                
                requestAnimationFrame(() => {
                    addInfo.style.opacity = '1';
                    overlay.forEach(el => el.style.opacity = '1');
                });
            }
        };

        if (animated) setTimeout(showAdditional, 500);
        else showAdditional();
    }

    // Закрытие карты и возврат в стек
    function closeCard(card) {
        state.cardOpen = false;
        card.classList.remove('is-open');

        const ratings = card.querySelector('.emotions-rating');
        const description = card.querySelector('.movie-description');
        const title = card.querySelector('.movie-title');
        const buttons = card.querySelectorAll('.movie-button-list-item');
        const addInfo = card.querySelector('.additional_info');
        const overlay = card.querySelectorAll('.overlay');

        Object.assign(card.style, {
            transition: 'all 0.5s ease-in-out',
            position: '', left: '', top: '', width: '', height: '',
            borderRadius: '', transform: '', cursor: 'grab', opacity: '1',
            overflowY: '', zIndex: ''
        });
        
        document.body.style.overflow = '';

        const mainTransition = 'opacity 0.8s ease-in-out 0.3s';
        const infoTransition = 'opacity 0.2s ease-in-out';

        if(ratings) ratings.style.transition = mainTransition;
        if(description) description.style.transition = mainTransition;
        if(title) title.style.transition = mainTransition;
        buttons.forEach(btn => btn.style.transition = mainTransition);
        
        if(addInfo) addInfo.style.transition = infoTransition;
        overlay.forEach(el => el.style.transition = infoTransition);

        if(ratings) ratings.style.opacity = '1';
        if(description) description.style.opacity = '1';
        if(title) title.style.opacity = '1';
        buttons.forEach(btn => btn.style.opacity = '1');

        if(addInfo) addInfo.style.opacity = '0';
        overlay.forEach(el => el.style.opacity = '0');

        setTimeout(() => {
            if (!state.cardOpen && addInfo) addInfo.style.display = 'none';
        }, 500);
    }
});
