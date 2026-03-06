// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// Данные игры
let player = {
    name: tg.initDataUnsafe?.user?.first_name || 'Игрок',
    chips: 1000,
    cards: []
};

let bot = {
    chips: 1000,
    cards: []
};

let communityCards = [];
let deck = [];
let pot = 0;
let gameStage = 'waiting';
let playerBet = 0;
let botBet = 0;
let playerActionTaken = false; // Флаг, сделал ли игрок действие

// Элементы DOM
const playerNameEl = document.getElementById('player-name');
const playerChipsEl = document.getElementById('player-chips');
const botChipsEl = document.getElementById('bot-chips');
const potAmountEl = document.getElementById('pot-amount');
const gameStatusEl = document.getElementById('game-status');
const telegramNoteEl = document.getElementById('telegram-note');

// Кнопки
const dealBtn = document.getElementById('deal-btn');
const checkBtn = document.getElementById('check-btn');
const callBtn = document.getElementById('call-btn');
const raiseBtn = document.getElementById('raise-btn');
const foldBtn = document.getElementById('fold-btn');
const nextRoundBtn = document.getElementById('next-round-btn');

// Карты
const playerCard1 = document.getElementById('player-card1');
const playerCard2 = document.getElementById('player-card2');
const botCard1 = document.getElementById('bot-card1');
const botCard2 = document.getElementById('bot-card2');
const communityEls = [
    document.getElementById('community1'),
    document.getElementById('community2'),
    document.getElementById('community3'),
    document.getElementById('community4'),
    document.getElementById('community5')
];

// Показываем имя пользователя
playerNameEl.textContent = player.name;
playerChipsEl.textContent = player.chips;
botChipsEl.textContent = bot.chips;

if (tg.initDataUnsafe?.user) {
    telegramNoteEl.textContent = `✅ Игра открыта в Telegram как ${player.name}`;
}

// -------------------------------
// ФУНКЦИИ ИГРЫ
// -------------------------------

// Создание колоды (52 карты, без дубликатов)
function createDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    
    for (let suit of suits) {
        for (let value of values) {
            deck.push({
                value: value,
                suit: suit,
                display: `${value}${suit}`
            });
        }
    }
    return shuffle(deck);
}

// Перемешивание
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Отображение карты
function displayCard(element, card) {
    if (!card) {
        element.className = 'card';
        element.style.backgroundImage = '';
        element.textContent = '';
        return;
    }
    
    element.className = 'card';
    // Здесь можно оставить упрощённое отображение или подключить нормальные картинки
    element.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><rect width="100" height="140" fill="white" stroke="%23333" stroke-width="2"/><text x="10" y="30" font-size="24" fill="black" font-family="Arial">${card.value}</text><text x="90" y="120" font-size="24" fill="black" transform="rotate(180, 90, 120)" font-family="Arial" text-anchor="end">${card.value}</text><text x="50" y="80" font-size="40" text-anchor="middle" fill="black" font-family="Arial">${card.suit}</text></svg>')`;
}

// Начать новый раунд
function startNewRound() {
    deck = createDeck();
    
    // Раздача карт
    player.cards = [deck.pop(), deck.pop()];
    bot.cards = [deck.pop(), deck.pop()];
    communityCards = [];
    
    // Отображение карт игрока
    displayCard(playerCard1, player.cards[0]);
    displayCard(playerCard2, player.cards[1]);
    
    // Карты бота скрыты
    botCard1.className = 'card back';
    botCard2.className = 'card back';
    
    // Очищаем общие карты
    communityEls.forEach(el => displayCard(el, null));
    
    // Сбрасываем ставки
    pot = 20;
    player.chips -= 10;
    bot.chips -= 10;
    playerBet = 10;
    botBet = 10;
    playerActionTaken = false;
    
    updateChips();
    
    gameStage = 'preflop';
    gameStatusEl.textContent = 'Ваш ход. Префлоп.';
    
    // Активируем кнопки для игрока
    enablePlayerButtons(true);
    dealBtn.disabled = true;
    nextRoundBtn.disabled = true;
}

// Включение/выключение кнопок игрока
function enablePlayerButtons(enable) {
    checkBtn.disabled = !enable;
    callBtn.disabled = !enable;
    raiseBtn.disabled = !enable;
    foldBtn.disabled = !enable;
}

// Ход бота
function botTurn() {
    gameStatusEl.textContent = 'Бот думает...';
    enablePlayerButtons(false);
    
    setTimeout(() => {
        // Простая логика бота
        const random = Math.random();
        
        if (random < 0.3) {
            // Бот пасует
            gameStatusEl.textContent = 'Бот сбросил карты! Вы выиграли!';
            player.chips += pot;
            endRound('player');
            return;
        } 
        else if (random < 0.7) {
            // Бот коллирует
            if (bot.chips >= playerBet) {
                bot.chips -= playerBet;
                pot += playerBet;
                gameStatusEl.textContent = 'Бот коллирует. Следующий раунд.';
                updateChips();
                setTimeout(() => {
                    nextStage();
                    // После перехода на следующий этап даём игроку ход
                    if (gameStage !== 'showdown' && player.chips > 0) {
                        enablePlayerButtons(true);
                    }
                }, 1000);
            } else {
                bot.chips = 0;
                pot += playerBet;
                gameStatusEl.textContent = 'У бота кончились фишки! Вы выиграли!';
                endRound('player');
            }
        } 
        else {
            // Бот повышает
            let raiseAmount = Math.min(50, bot.chips);
            if (raiseAmount > 0) {
                bot.chips -= raiseAmount;
                pot += raiseAmount;
                botBet = raiseAmount;
                gameStatusEl.textContent = `Бот повышает до ${raiseAmount}. Ваш ход.`;
                updateChips();
                // Даём игроку ответить на повышение
                enablePlayerButtons(true);
            } else {
                nextStage();
            }
        }
    }, 1500);
}

// Переход к следующей стадии
function nextStage() {
    if (gameStage === 'preflop') {
        gameStage = 'flop';
        // Выкладываем флоп (3 карты)
        for (let i = 0; i < 3; i++) {
            communityCards.push(deck.pop());
            displayCard(communityEls[i], communityCards[i]);
        }
        gameStatusEl.textContent = 'Флоп. Ваш ход.';
        playerBet = 0;
        botBet = 0;
    } 
    else if (gameStage === 'flop') {
        gameStage = 'turn';
        communityCards.push(deck.pop());
        displayCard(communityEls[3], communityCards[3]);
        gameStatusEl.textContent = 'Тёрн. Ваш ход.';
        playerBet = 0;
        botBet = 0;
    } 
    else if (gameStage === 'turn') {
        gameStage = 'river';
        communityCards.push(deck.pop());
        displayCard(communityEls[4], communityCards[4]);
        gameStatusEl.textContent = 'Ривер. Ваш ход.';
        playerBet = 0;
        botBet = 0;
    } 
    else if (gameStage === 'river') {
        gameStage = 'showdown';
        showCards();
        return;
    }
    
    // Даём игроку ход
    enablePlayerButtons(true);
}

// Вскрытие карт
function showCards() {
    // Показываем карты бота
    displayCard(botCard1, bot.cards[0]);
    displayCard(botCard2, bot.cards[1]);
    
    gameStatusEl.textContent = 'Вскрытие...';
    
    setTimeout(() => {
        // Упрощённое определение победителя (случайно)
        const winner = Math.random() > 0.5 ? 'player' : 'bot';
        
        if (winner === 'player') {
            gameStatusEl.textContent = '🎉 Вы выиграли раунд!';
            player.chips += pot;
        } else {
            gameStatusEl.textContent = '😢 Бот выиграл раунд.';
            bot.chips += pot;
        }
        
        updateChips();
        endRound(winner);
    }, 1500);
}

// Завершение раунда
function endRound(winner) {
    enablePlayerButtons(false);
    nextRoundBtn.disabled = false;
    
    if (player.chips <= 0) {
        gameStatusEl.textContent = '💔 У вас закончились фишки! Игра окончена.';
        nextRoundBtn.disabled = true;
    } else if (bot.chips <= 0) {
        gameStatusEl.textContent = '🏆 ПОБЕДА! У бота закончились фишки!';
        nextRoundBtn.disabled = true;
    }
}

// Обновление отображения фишек
function updateChips() {
    playerChipsEl.textContent = player.chips;
    botChipsEl.textContent = bot.chips;
    potAmountEl.textContent = pot;
}

// -------------------------------
// ОБРАБОТЧИКИ КНОПОК
// -------------------------------

dealBtn.addEventListener('click', () => {
    startNewRound();
});

checkBtn.addEventListener('click', () => {
    gameStatusEl.textContent = 'Вы сделали чек. Ход бота.';
    enablePlayerButtons(false);
    playerBet = 0;
    botTurn();
});

callBtn.addEventListener('click', () => {
    let callAmount = Math.max(0, botBet - playerBet);
    
    if (callAmount > player.chips) {
        gameStatusEl.textContent = 'Недостаточно фишек для колла!';
        return;
    }
    
    if (callAmount > 0) {
        player.chips -= callAmount;
        pot += callAmount;
        playerBet = botBet;
        gameStatusEl.textContent = `Вы коллируете ${callAmount}. Ход бота.`;
    } else {
        gameStatusEl.textContent = 'Вы чек. Ход бота.';
    }
    
    updateChips();
    enablePlayerButtons(false);
    botTurn();
});

raiseBtn.addEventListener('click', () => {
    let raiseAmount = prompt('Введите сумму повышения (мин. 20, макс. ' + player.chips + '):', '20');
    raiseAmount = parseInt(raiseAmount);
    
    if (isNaN(raiseAmount) || raiseAmount < 20) {
        alert('Минимальная сумма рейза - 20');
        return;
    }
    
    if (raiseAmount > player.chips) {
        alert('Недостаточно фишек!');
        return;
    }
    
    player.chips -= raiseAmount;
    pot += raiseAmount;
    playerBet = raiseAmount;
    
    gameStatusEl.textContent = `Вы повышаете до ${raiseAmount}. Ход бота.`;
    updateChips();
    
    enablePlayerButtons(false);
    botTurn();
});

foldBtn.addEventListener('click', () => {
    gameStatusEl.textContent = 'Вы сбросили карты. Бот выиграл раунд.';
    bot.chips += pot;
    endRound('bot');
    updateChips();
});

nextRoundBtn.addEventListener('click', () => {
    gameStage = 'waiting';
    dealBtn.disabled = false;
    nextRoundBtn.disabled = true;
    
    // Очищаем карты
    displayCard(playerCard1, null);
    displayCard(playerCard2, null);
    botCard1.className = 'card';
    botCard2.className = 'card';
    communityEls.forEach(el => displayCard(el, null));
    
    gameStatusEl.textContent = 'Нажмите "Сдать карты" для нового раунда';
});

console.log('Покер против бота загружен!');