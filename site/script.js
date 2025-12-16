document.addEventListener('DOMContentLoaded', () => {
    // Управление состоянием приложения
    const params = new
    URLSearchParams(window.location.search);
    const USER_ID = params.get('user')
    // Update API port to 8000 (standard for FastAPI)
    const API_URL = 'http://127.0.0.1:5001'; 

    const state = {
        movies: [],
        searchQuery: '', // Храним текущий поисковый запрос
        currentIndex: 0,
        offset: 0,        // Tracks how many movies fetched from DB total
        isLoading: false, // Prevents duplicate requests
        endCardAdded: false, // <--- Добавлено: флаг, что финальная карта уже добавлена
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

    // Функция для загрузки отзывов фильма
    async function loadMovieReviews(card, movieId) {
        try {
            const response = await fetch(`${API_URL}/movies/${movieId}/reviews`);
            if (response.ok) {
                const reviews = await response.json();
                displayReviews(card, reviews);
            }
        } catch (error) {
            console.error('Ошибка загрузки отзывов:', error);
        }
    }

    // Функция для отображения отзывов
    function displayReviews(card, reviews) {
        const reviewsList = card.querySelector('.reviews-section__list');
        if (!reviewsList) return;

        reviewsList.innerHTML = ''; // Очищаем список

        if (reviews && reviews.length > 0) {
            reviews.forEach(review => {
                const reviewItem = document.createElement('li');
                reviewItem.className = 'reviews-section__item';

                // Собираем эмоции с ненулевыми значениями
                const emotions = [];
                const emotionLabels = {
                    sadness_rating: 'грусть',
                    optimism_rating: 'оптимизм',
                    fear_rating: 'страх',
                    anger_rating: 'гнев',
                    neutral_rating: 'нейтральность',
                    worry_rating: 'беспокойство',
                    love_rating: 'любовь',
                    fun_rating: 'веселье',
                    boredom_rating: 'скука'
                };

                Object.entries(emotionLabels).forEach(([key, label]) => {
                    const rating = review[key];
                    if (rating && rating > 0) {
                        emotions.push(`${label} ${rating}`);
                    }
                });

                const emotionsHtml = emotions.length > 0
                    ? emotions.map(emotion => `<span class="review-emotion">${emotion}</span>`).join('')
                    : '<span class="review-emotion">Без эмоций</span>';

                reviewItem.innerHTML = `
                    <div class="review-user-info">
                        <span class="review-username">Пользователь ${review.user_id || 'Anonymous'}</span>
                    </div>
                    <div class="review-emotions">
                        ${emotionsHtml}
                    </div>
                    <p class="review-text">${review.text || 'Нет текста отзыва'}</p>
                `;

                reviewsList.appendChild(reviewItem);
            });
        } else {
            // Если отзывов нет, показываем сообщение
            const noReviewsItem = document.createElement('li');
            noReviewsItem.className = 'reviews-section__item';
            noReviewsItem.innerHTML = `
                <p class="review-text">Пока нет отзывов. Будьте первым!</p>
            `;
            reviewsList.appendChild(noReviewsItem);
        }
    }

    // Функция для отправки отзыва
    async function submitReview(card, reviewText) {
        const movieId = state.currentMovieId;
        if (!movieId) return;

        // Собираем данные из интерфейса эмоций
        const emotionData = collectEmotionData(card);

        try {
            const reviewData = {
                user_id: USER_ID || 1, // Используем ID из URL или дефолтный
                text: reviewText,
                ...emotionData // Добавляем оценки эмоций
            };

            const response = await fetch(`${API_URL}/movies/${movieId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData)
            });

            if (response.ok) {
                const updatedReviews = await response.json();
                displayReviews(card, updatedReviews);
            } else {
                console.error('Ошибка отправки отзыва:', response.status);
            }
        } catch (error) {
            console.error('Ошибка отправки отзыва:', error);
        }
    }

    // Функция сбора данных из интерфейса эмоций
    function collectEmotionData(card) {
        const emotionGroups = card.querySelectorAll('.emotion-input-group');
        const emotionData = {
            sadness_rating: 0,
            optimism_rating: 0,
            fear_rating: 0,
            anger_rating: 0,
            neutral_rating: 0,
            worry_rating: 0,
            love_rating: 0,
            fun_rating: 0,
            boredom_rating: 0
        };

        emotionGroups.forEach(group => {
            const emotionSelect = group.querySelector('.emotion-select');
            const ratingSelect = group.querySelector('.rating-select');

            if (emotionSelect.value && ratingSelect.value) {
                const emotionKey = emotionSelect.value;
                const ratingValue = parseInt(ratingSelect.value);
                emotionData[emotionKey] = ratingValue;
            }
        });

        return emotionData;
    }

    // Функция инициализации интерфейса эмоций
    function initializeEmotionInterface(card) {
        const emotionInputsContainer = card.querySelector('#emotion-inputs');
        const addEmotionBtn = card.querySelector('#add-emotion-btn');

        if (!emotionInputsContainer || !addEmotionBtn) return;

        // Обработчик изменения селекта эмоций
        emotionInputsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('emotion-select')) {
                const group = e.target.closest('.emotion-input-group');
                const ratingSelect = group.querySelector('.rating-select');
                const removeBtn = group.querySelector('.emotion-remove-btn');

                if (e.target.value) {
                    ratingSelect.disabled = false;
                    removeBtn.disabled = false;
                } else {
                    ratingSelect.disabled = true;
                    ratingSelect.value = '';
                    removeBtn.disabled = true;
                }

                updateAddButtonState(card);
            }
        });

        // Обработчик кнопки добавления эмоции
        addEmotionBtn.addEventListener('click', () => {
            addEmotionGroup(card);
        });

        // Обработчик кнопок удаления эмоций
        emotionInputsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('emotion-remove-btn') && !e.target.disabled) {
                removeEmotionGroup(e.target.closest('.emotion-input-group'));
                updateAddButtonState(card);
            }
        });

        // Инициализируем первую группу эмоций
        updateAddButtonState(card);
    }

    // Функция добавления группы эмоций
    function addEmotionGroup(card) {
        const emotionInputsContainer = card.querySelector('#emotion-inputs');
        const existingGroups = emotionInputsContainer.querySelectorAll('.emotion-input-group');

        if (existingGroups.length >= 3) return; // Максимум 3 эмоции

        const emotionGroup = document.createElement('div');
        emotionGroup.className = 'emotion-input-group';
        emotionGroup.innerHTML = `
            <select class="emotion-select">
                <option value="">Выберите эмоцию</option>
                <option value="sadness_rating">Грусть</option>
                <option value="optimism_rating">Оптимизм</option>
                <option value="fear_rating">Страх</option>
                <option value="anger_rating">Гнев</option>
                <option value="neutral_rating">Нейтральность</option>
                <option value="worry_rating">Беспокойство</option>
                <option value="love_rating">Любовь</option>
                <option value="fun_rating">Веселье</option>
                <option value="boredom_rating">Скука</option>
            </select>
            <select class="rating-select" disabled>
                <option value="">Оценка</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
            </select>
            <button type="button" class="emotion-remove-btn" disabled>×</button>
        `;

        emotionInputsContainer.appendChild(emotionGroup);
        updateAddButtonState(card);
    }

    // Функция удаления группы эмоций
    function removeEmotionGroup(groupElement) {
        const container = groupElement.parentElement;
        const groups = container.querySelectorAll('.emotion-input-group');

        if (groups.length > 1) { // Всегда должна быть хотя бы одна группа
            groupElement.remove();
        }
    }

    // Функция обновления состояния кнопки добавления
    function updateAddButtonState(card) {
        const addEmotionBtn = card.querySelector('#add-emotion-btn');
        const emotionInputsContainer = card.querySelector('#emotion-inputs');
        const existingGroups = emotionInputsContainer.querySelectorAll('.emotion-input-group');

        // Проверяем, все ли группы имеют выбранные эмоции
        const allGroupsHaveEmotions = Array.from(existingGroups).every(group => {
            const emotionSelect = group.querySelector('.emotion-select');
            return emotionSelect && emotionSelect.value;
        });

        // Кнопка активна, если меньше 3 групп и все текущие группы имеют эмоции
        addEmotionBtn.disabled = existingGroups.length >= 3 || !allGroupsHaveEmotions;
    }

    // Функция сброса интерфейса эмоций
    function resetEmotionInterface(card) {
        const emotionInputsContainer = card.querySelector('#emotion-inputs');
        const addEmotionBtn = card.querySelector('#add-emotion-btn');

        if (!emotionInputsContainer) return;

        // Оставляем только первую группу и очищаем её
        const firstGroup = emotionInputsContainer.querySelector('.emotion-input-group');
        if (firstGroup) {
            const emotionSelect = firstGroup.querySelector('.emotion-select');
            const ratingSelect = firstGroup.querySelector('.rating-select');
            const removeBtn = firstGroup.querySelector('.emotion-remove-btn');

            emotionSelect.value = '';
            ratingSelect.value = '';
            ratingSelect.disabled = true;
            removeBtn.disabled = true;
        }

        // Удаляем все дополнительные группы
        const extraGroups = emotionInputsContainer.querySelectorAll('.emotion-input-group:nth-child(n+2)');
        extraGroups.forEach(group => group.remove());

        // Обновляем состояние кнопки
        if (addEmotionBtn) {
            addEmotionBtn.disabled = true;
        }
    }

    // DOM элементы
    const wrapper = document.querySelector('.cards-wrapper');
    const root = document.documentElement;
    const searchInput = document.querySelector('.header__search');
    const searchButton = document.querySelector('.header__search-button');

    // Обработчик поиска
    async function handleSearch() {
        const query = searchInput.value.trim();
        
        // Сброс состояния для нового поиска
        state.searchQuery = query;
        state.offset = 0;
        state.movies = [];
        state.currentIndex = 0;
        state.endCardAdded = false; // Сбрасываем флаг при новом поиске
        
        // Очистка текущих карточек
        wrapper.innerHTML = ''; // Удаляем все существующие карточки
        
        // Загрузка новых данных
        await loadMovies(20);
        
        // Если ничего не найдено, можно показать уведомление (опционально)
        if (state.movies.length === 0) {
            // Можно добавить логику отображения "Ничего не найдено"
            console.log('Ничего не найдено');
        } else {
            renderInitialStack();
        }
    }

    // Слушатели событий для поиска
    if (searchButton) {
        searchButton.addEventListener('click', handleSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
                searchInput.blur(); // Убираем фокус с инпута после нажатия Enter
            }
        });
    }

    // Вспомогательная функция линейной интерполяции (для анимации)
    const lerp = (start, end, t) => start * (1 - t) + end * t;
    
    init();

    // Инициализация: загрузка данных фильмов
    async function init() {
        await loadMovies(20);
        renderInitialStack();
    }

    // Function to load movies with pagination
    async function loadMovies(limit = 10) {
        // Prevent multiple simultaneous requests

        if (state.isLoading) return false;
        state.isLoading = true;

        try {
            // Request to your new backend endpoint
            const userId = USER_ID || 1;
            let url;
            
            if (state.searchQuery) {
                // Если есть поисковый запрос, используем эндпоинт поиска
                url = `${API_URL}/movies/search?search=${encodeURIComponent(state.searchQuery)}&skip=${state.offset}&user_id=${userId}&limit=${limit}`;
            } else {
                // Иначе стандартная лента
                url = `${API_URL}/movies/?skip=${state.offset}&user_id=${userId}&limit=${limit}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');

            const newMovies = await response.json();

            // Если фильмов меньше лимита (конец списка) и финальная карта еще не добавлена
            if (newMovies.length < limit && !state.endCardAdded) {
                // Добавляем специальный объект-маркер для финальной карточки
                newMovies.push({
                    id: 'end-card',
                    isEndCard: true, // Наш флаг
                    title: '',
                    description: '',
                    rating: '',
                    director: '',
                    actors: '',
                    genre: '',
                    horizontal_poster_url: '',
                    vertical_poster_url: ''
                });
                state.endCardAdded = true;
            }

            if (newMovies.length > 0) {
                // Append new movies to the end of the array
                state.movies.push(...newMovies);
                // Update global offset
                state.offset += newMovies.length - (state.endCardAdded && newMovies[newMovies.length-1].isEndCard ? 1 : 0);
                return true;
            }
        } catch (error) {
            console.error('Failed to load movies:', error);
        } finally {
            state.isLoading = false;
        }
        return false;
    }

    // Отрисовка начального стека карт (активная и следующая)
    function renderInitialStack() {
        if (state.movies[0]) {
            createAndAppendCard(0, 'active');
            // Загружаем отзывы для первой активной карточки
            const activeCard = wrapper.querySelector('.card.active');
            if (activeCard) {
                const movieId = activeCard.dataset.movieId;
                if (movieId) {
                    loadMovieReviews(activeCard, parseInt(movieId));
                }
            }
        }
        if (state.movies[1]) {
            createAndAppendCard(1, 'next');
        }
    }

    // Создание и добавление DOM-элемента карты
    function createAndAppendCard(index, type) {
        if (index >= state.movies.length) return;
        
        const movie = state.movies[index];
        const template = document.getElementById('movie-card-template');
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.card');
        
        card.classList.add(type);
        card.dataset.index = index;

        const isMobile = state.width <= 456;

        // --- БЛОК ДЛЯ ФИНАЛЬНОЙ КАРТОЧКИ ---
        if (movie.isEndCard) {
            card.classList.add('end-card'); // <--- Добавляем класс
            // Задайте здесь путь к вашему фону
            card.style.backgroundImage = isMobile ? 'url("/site/images/not_found_vertical.png")' : 'url("/site/images/not_found_horizontal.png")'; 
            card.style.backgroundSize = 'cover';
            
            // Скрываем стандартные элементы интерфейса
            const elementsToHide = [
                '.movie-info', 
                '.movie-description-wrapper', 
                '.movie-button-list', 
                '.additional_info',
                '.overlay'
            ];
            
            elementsToHide.forEach(selector => {
                const el = card.querySelector(selector);
                if (el) el.style.display = 'none';
            });

            wrapper.appendChild(card);
               
            return; 
        }
        // -----------------------------------
        
        const id = movie.id;
        card.dataset.movieId = id;

        // Update field names to match Python model (_url suffix)
        const bgImage = isMobile ? movie.vertical_poster_url : movie.horizontal_poster_url;
        card.style.backgroundImage = `url(${bgImage})`;

        state.currentMovieId = movie.id;

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

    async function postLike(movieId) {
        // Prevent multiple simultaneous requests
        try {
            const response = await fetch(`${API_URL}/favorite/like/${USER_ID}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    movie_id: movieId
                })
            });
        
            if (!response.ok) {
                throw new Error(`Ошибка сети: ${response.status}`);
            }

            const result = await response.json();
            console.log('Лайк успешно отправлен:', result);
        } catch (error) {
            console.error('Ошибка при отправке лайка:', error);
        }

    }

    async function postDislike(movieId) {
        const userId = USER_ID || 1;

        try {
            const response = await fetch(`${API_URL}/favorite/dislike/${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    movie_id: movieId
                })
            });

            if (!response.ok) {
                throw new Error(`Ошибка сети: ${response.status}`);
            }

            const result = await response.json();
            console.log('Дизлайк успешно отправлен:', result);
        } catch (error) {
            console.error('Ошибка при отправке дизлайка:', error);
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

        // обработка кнопки отправки отзыва
        const submitReviewBtn = card.querySelector('#submit-review-btn');
        if (submitReviewBtn) {
            submitReviewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const reviewInput = card.querySelector('.reviews-section__input');
                if (reviewInput && reviewInput.value.trim()) {
                    submitReview(card, reviewInput.value.trim());
                    reviewInput.value = '';
                    // Очищаем интерфейс эмоций
                    resetEmotionInterface(card);
                }
            });
        }

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

        const movieId = parseInt(activeCard.dataset.movieId);

        if (decision == 'yes') {
            postLike(movieId)
        } else {
            postDislike(movieId)
        }

        const exitClass = decision === 'yes' ? 'exit-right' : 'exit-left';
        activeCard.classList.add(exitClass);
        activeCard.classList.remove('active');

        const nextCard = wrapper.querySelector('.card.next');
        if (nextCard) {
            nextCard.classList.remove('next');
            nextCard.classList.add('active');
            nextCard.style.transform = '';

            // Загружаем отзывы для новой активной карточки
            const nextMovieId = nextCard.dataset.movieId;
            if (nextMovieId) {
                loadMovieReviews(nextCard, parseInt(nextMovieId));
            }
        }

        state.currentIndex++;

        if (state.currentIndex >= 10) {
            // Load next 10 movies in background
            loadMovies(10).then((loaded) => {
                if (loaded) {
                    // Remove the first 10 movies to free memory
                    state.movies.splice(0, 10);
                    
                    // Adjust currentIndex because the array shifted by 10 positions
                    // The active card logic remains consistent
                    state.currentIndex -= 10;
                }
            });
        }

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
        
        // Добавляем проверку: если карточка финальная - выходим
        if (card.classList.contains('end-card')) return; 

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
    console.log(state.movies)

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

        // Загружаем отзывы для фильма сразу при открытии карточки
        const movieId = card.dataset.movieId;
        if (movieId) {
            loadMovieReviews(card, parseInt(movieId));
        }

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

        // Инициализируем интерфейс эмоций
        initializeEmotionInterface(card);
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
