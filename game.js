// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// -------------------------------
// ДАННЫЕ ИГРОКА
// -------------------------------
let player = {
    name: tg.initDataUnsafe?.user?.first_name || 'Игрок',
    chips: 1000,
    cards: [],
    bet: 0,
    folded: false
};

let bot = {
    chips: 1000,
    cards: [],
    bet: 0,
    folded: false
};

let communityCards = [];
let deck = [];
let pot = 0;
let gameStage = 'waiting';
let currentBet = 0;
let playerActionTaken = false;

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

// Инициализация интерфейса
playerNameEl.textContent = player.name;
playerChipsEl.textContent = player.chips;
botChipsEl.textContent = bot.chips;

if (tg.initDataUnsafe?.user) {
    telegramNoteEl.textContent = `✅ Игра открыта в Telegram как ${player.name}`;
}

// -------------------------------
// 1. СОЗДАНИЕ КОЛОДЫ
// -------------------------------
function createDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    
    const suitColors = {
        '♥': 'red',
        '♦': 'red',
        '♣': 'black',
        '♠': 'black'
    };
    
    const rankValues = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    
    for (let suit of suits) {
        for (let value of values) {
            deck.push({
                value: value,
                suit: suit,
                color: suitColors[suit],
                rank: rankValues[value],
                display: `${value}${suit}`
            });
        }
    }
    return shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function displayCard(element, card) {
    if (!card) {
        element.className = 'card';
        element.style.backgroundImage = '';
        element.textContent = '';
        return;
    }
    
    element.className = 'card';
    const color = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black';
    
    element.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140"><rect width="100" height="140" fill="white" stroke="%23333" stroke-width="2"/><text x="10" y="30" font-size="24" fill="${color}" font-family="Arial">${card.value}</text><text x="90" y="120" font-size="24" fill="${color}" transform="rotate(180, 90, 120)" font-family="Arial" text-anchor="end">${card.value}</text><text x="50" y="80" font-size="40" text-anchor="middle" fill="${color}" font-family="Arial">${card.suit}</text></svg>')`;
}

// -------------------------------
// 2. ОПРЕДЕЛЕНИЕ КОМБИНАЦИЙ
// -------------------------------
function evaluateHand(cards) {
    const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
    const suits = cards.map(c => c.suit);
    const rankCounts = {};
    
    ranks.forEach(rank => {
        rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    const values = Object.keys(rankCounts).map(Number);
    
    const flushSuit = suits.find(s => suits.filter(s2 => s2 === s).length >= 5);
    const flush = flushSuit ? cards.filter(c => c.suit === flushSuit).map(c => c.rank).sort((a, b) => b - a) : null;
    
    let straight = null;
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    
    if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && 
        uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
        straight = [5, 4, 3, 2, 1];
    } else {
        for (let i = uniqueRanks.length - 1; i >= 4; i--) {
            if (uniqueRanks[i] - uniqueRanks[i-4] === 4) {
                straight = uniqueRanks.slice(i-4, i+1).reverse();
                break;
            }
        }
    }
    
    if (flush && straight) {
        const flushRanks = cards.filter(c => c.suit === flushSuit).map(c => c.rank).sort((a, b) => a - b);
        const uniqueFlushRanks = [...new Set(flushRanks)];
        
        if (uniqueFlushRanks.includes(14) && uniqueFlushRanks.includes(2) && 
            uniqueFlushRanks.includes(3) && uniqueFlushRanks.includes(4) && uniqueFlushRanks.includes(5)) {
            return { type: 'стрит-флеш', rank: 9, value: [5], kickers: [] };
        }
        
        for (let i = uniqueFlushRanks.length - 1; i >= 4; i--) {
            if (uniqueFlushRanks[i] - uniqueFlushRanks[i-4] === 4) {
                return { 
                    type: 'стрит-флеш', 
                    rank: 9, 
                    value: [uniqueFlushRanks[i]], 
                    kickers: [] 
                };
            }
        }
    }
    
    const four = values.find(v => rankCounts[v] === 4);
    if (four) {
        const kicker = Math.max(...values.filter(v => v !== four));
        return { type: 'каре', rank: 8, value: [four], kickers: [kicker] };
    }
    
    const three = values.find(v => rankCounts[v] === 3);
    const pair = values.find(v => rankCounts[v] === 2);
    if (three && pair) {
        return { type: 'фулл-хаус', rank: 7, value: [three, pair], kickers: [] };
    }
    
    if (flush) {
        const topFive = flush.slice(0, 5);
        return { type: 'флеш', rank: 6, value: topFive, kickers: [] };
    }
    
    if (straight) {
        return { type: 'стрит', rank: 5, value: [straight[0]], kickers: [] };
    }
    
    const three2 = values.find(v => rankCounts[v] === 3);
    if (three2) {
        const kickers = values.filter(v => v !== three2).sort((a, b) => b - a).slice(0, 2);
        return { type: 'сет', rank: 4, value: [three2], kickers: kickers };
    }
    
    const pairs = values.filter(v => rankCounts[v] === 2).sort((a, b) => b - a);
    if (pairs.length >= 2) {
        const topTwo = pairs.slice(0, 2);
        const kicker = Math.max(...values.filter(v => !topTwo.includes(v)));
        return { type: 'две пары', rank: 3, value: topTwo, kickers: [kicker] };
    }
    
    if (pairs.length === 1) {
        const pairRank = pairs[0];
        const kickers = values.filter(v => v !== pairRank).sort((a, b) => b - a).slice(0, 3);
        return { type: 'пара', rank: 2, value: [pairRank], kickers: kickers };
    }
    
    const highCards = values.sort((a, b) => b - a).slice(0, 5);
    return { type: 'старшая карта', rank: 1, value: highCards, kickers: [] };
}

function compareHands(hand1, hand2) {
    if (hand1.rank > hand2.rank) return 1;
    if (hand1.rank < hand2.rank) return -1;
    
    for (let i = 0; i < hand1.value.length; i++) {
        if (hand1.value[i] > hand2.value[i]) return 1;
        if (hand1.value[i] < hand2.value[i]) return -1;
    }
    
    for (let i = 0; i < Math.min(hand1.kickers.length, hand2.kickers.length); i++) {
        if (hand1.kickers[i] > hand2.kickers[i]) return 1;
        if (hand1.kickers[i] < hand2.kickers[i]) return -1;
    }
    
    return 0;
}

// -------------------------------
// 3. ЛОГИКА БОТА (ИСПРАВЛЕННАЯ)
// -------------------------------
function botDecision() {
    const allBotCards = [...bot.cards, ...communityCards];
    const handStrength = evaluateHand(allBotCards);
    const strength = handStrength.rank;
    
    gameStatusEl.textContent = 'Бот думает...';
    enablePlayerButtons(false);
    
    setTimeout(() => {
        let action = '';
        let raiseAmount = 0;
        
        let callAmount = Math.max(0, currentBet - bot.bet);
        const canCall = callAmount <= bot.chips;
        
        if (strength >= 5) {
            if (bot.chips > callAmount) {
                action = 'raise';
                raiseAmount = Math.min(callAmount + 40, bot.chips);
                gameStatusEl.textContent = `Бот: хорошая рука, поднимаю до ${raiseAmount + bot.bet}`;
            } else {
                action = 'call';
                gameStatusEl.textContent = 'Бот: колл';
            }
        }
        else if (strength >= 2) {
            if (canCall) {
                if (Math.random() < 0.7) {
                    action = 'call';
                    gameStatusEl.textContent = 'Бот: колл';
                } else {
                    if (bot.chips > callAmount + 20) {
                        action = 'raise';
                        raiseAmount = Math.min(callAmount + 20, bot.chips);
                        gameStatusEl.textContent = `Бот: небольшой рейз до ${raiseAmount + bot.bet}`;
                    } else {
                        action = 'call';
                        gameStatusEl.textContent = 'Бот: колл';
                    }
                }
            } else {
                if (Math.random() < 0.3 && bot.chips > 0) {
                    action = 'raise';
                    raiseAmount = bot.chips;
                    gameStatusEl.textContent = `Бот: all-in ${bot.chips + bot.bet}!`;
                } else {
                    action = 'fold';
                    gameStatusEl.textContent = 'Бот: пас (не хватает фишек)';
                }
            }
        }
        else {
            if (canCall) {
                if (Math.random() < 0.3) {
                    action = 'call';
                    gameStatusEl.textContent = 'Бот: блефую, колл';
                } else {
                    action = 'fold';
                    gameStatusEl.textContent = 'Бот: пас';
                }
            } else {
                action = 'fold';
                gameStatusEl.textContent = 'Бот: пас (не хватает фишек)';
            }
        }
        
        if (action === 'fold') {
            bot.folded = true;
            gameStatusEl.textContent = 'Бот сбросил карты! Вы выиграли!';
            player.chips += pot;
            endRound('player');
            updateChips();
            return;
        }
        
        if (action === 'call') {
            let finalCall = Math.min(callAmount, bot.chips);
            
            if (finalCall > 0) {
                bot.chips -= finalCall;
                bot.bet += finalCall;
                pot += finalCall;
                gameStatusEl.textContent = `Бот коллирует ${finalCall}`;
            } else {
                gameStatusEl.textContent = 'Бот чек';
            }
            
            updateChips();
            
            // ВАЖНО: Если игрок уже походил и бот просто коллирует,
            // переходим к следующей стадии
            if (playerActionTaken && currentBet === bot.bet) {
                setTimeout(() => {
                    nextStage();
                }, 1000);
            } 
            // Если игрок ещё не походил (например, бот открывал торговлю)
            else if (!playerActionTaken) {
                enablePlayerButtons(true);
                gameStatusEl.textContent = 'Ваш ход';
            }
        }
        
        if (action === 'raise') {
            let finalRaise = Math.min(raiseAmount, bot.chips);
            bot.chips -= finalRaise;
            bot.bet += finalRaise;
            pot += finalRaise;
            currentBet = bot.bet;
            
            gameStatusEl.textContent = `Бот повышает до ${bot.bet}. Ваш ход.`;
            updateChips();
            
            playerActionTaken = false;
            enablePlayerButtons(true);
        }
        
        updateChips();
    }, 1500);
}

// -------------------------------
// 4. УПРАВЛЕНИЕ ИГРОЙ
// -------------------------------
function startNewRound() {
    deck = createDeck();
    
    player.cards = [];
    bot.cards = [];
    communityCards = [];
    player.folded = false;
    bot.folded = false;
    player.bet = 0;
    bot.bet = 0;
    currentBet = 10;
    pot = 20;
    playerActionTaken = false;
    
    player.cards = [deck.pop(), deck.pop()];
    bot.cards = [deck.pop(), deck.pop()];
    
    player.chips -= 10;
    bot.chips -= 10;
    player.bet = 10;
    bot.bet = 10;
    
    displayCard(playerCard1, player.cards[0]);
    displayCard(playerCard2, player.cards[1]);
    
    botCard1.className = 'card back';
    botCard2.className = 'card back';
    
    communityEls.forEach(el => displayCard(el, null));
    
    updateChips();
    
    gameStage = 'preflop';
    gameStatusEl.textContent = 'Префлоп. Ваш ход.';
    
    dealBtn.disabled = true;
    enablePlayerButtons(true);
    nextRoundBtn.disabled = true;
}

function enablePlayerButtons(enable) {
    checkBtn.disabled = !enable || (currentBet > player.bet);
    callBtn.disabled = !enable;
    raiseBtn.disabled = !enable;
    foldBtn.disabled = !enable;
}

function nextStage() {
    // Сбрасываем ставки для нового раунда
    player.bet = 0;
    bot.bet = 0;
    currentBet = 0;
    playerActionTaken = false;
    
    if (gameStage === 'preflop') {
        gameStage = 'flop';
        for (let i = 0; i < 3; i++) {
            communityCards.push(deck.pop());
            displayCard(communityEls[i], communityCards[i]);
        }
        gameStatusEl.textContent = 'Флоп. Ваш ход.';
    } 
    else if (gameStage === 'flop') {
        gameStage = 'turn';
        communityCards.push(deck.pop());
        displayCard(communityEls[3], communityCards[3]);
        gameStatusEl.textContent = 'Тёрн. Ваш ход.';
    } 
    else if (gameStage === 'turn') {
        gameStage = 'river';
        communityCards.push(deck.pop());
        displayCard(communityEls[4], communityCards[4]);
        gameStatusEl.textContent = 'Ривер. Ваш ход.';
    } 
    else if (gameStage === 'river') {
        gameStage = 'showdown';
        showCards();
        return;
    }
    
    // Разблокируем кнопки для игрока
    enablePlayerButtons(true);
}

function showCards() {
    displayCard(botCard1, bot.cards[0]);
    displayCard(botCard2, bot.cards[1]);
    
    gameStatusEl.textContent = 'Вскрытие карт...';
    
    setTimeout(() => {
        const allPlayerCards = [...player.cards, ...communityCards];
        const allBotCards = [...bot.cards, ...communityCards];
        
        const playerHand = evaluateHand(allPlayerCards);
        const botHand = evaluateHand(allBotCards);
        
        const result = compareHands(playerHand, botHand);
        
        if (result > 0) {
            gameStatusEl.textContent = `🎉 Вы выиграли! (${playerHand.type})`;
            player.chips += pot;
        } else if (result < 0) {
            gameStatusEl.textContent = `😢 Бот выиграл (${botHand.type})`;
            bot.chips += pot;
        } else {
            gameStatusEl.textContent = `🤝 Ничья! Банк делится`;
            player.chips += Math.floor(pot / 2);
            bot.chips += Math.floor(pot / 2);
        }
        
        updateChips();
        endRound();
    }, 1500);
}

function endRound() {
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

function updateChips() {
    playerChipsEl.textContent = player.chips;
    botChipsEl.textContent = bot.chips;
    potAmountEl.textContent = pot;
}

// -------------------------------
// 5. ОБРАБОТЧИКИ КНОПОК
// -------------------------------
dealBtn.addEventListener('click', startNewRound);

checkBtn.addEventListener('click', () => {
    if (currentBet <= player.bet) {
        gameStatusEl.textContent = 'Вы чек. Ход бота.';
        playerActionTaken = true;
        enablePlayerButtons(false);
        botDecision();
    } else {
        gameStatusEl.textContent = 'Нельзя чек, нужно отвечать на ставку';
    }
});

callBtn.addEventListener('click', () => {
    let callAmount = Math.max(0, currentBet - player.bet);
    
    if (callAmount > player.chips) {
        // All-in
        callAmount = player.chips;
        player.chips = 0;
        player.bet += callAmount;
        pot += callAmount;
        gameStatusEl.textContent = `Вы идёте all-in ${player.bet}!`;
    } else if (callAmount > 0) {
        player.chips -= callAmount;
        player.bet += callAmount;
        pot += callAmount;
        gameStatusEl.textContent = `Вы коллируете ${callAmount}.`;
    } else {
        gameStatusEl.textContent = 'Вы чек.';
    }
    
    updateChips();
    playerActionTaken = true;
    enablePlayerButtons(false);
    botDecision();
});

raiseBtn.addEventListener('click', () => {
    let minRaise = Math.max(20, currentBet + 20);
    let maxRaise = player.chips + player.bet;
    
    let raiseAmount = prompt(`Введите сумму рейза (мин: ${minRaise}, макс: ${maxRaise}):`, minRaise);
    raiseAmount = parseInt(raiseAmount);
    
    if (isNaN(raiseAmount) || raiseAmount < minRaise) {
        alert(`Минимальная сумма рейза: ${minRaise}`);
        return;
    }
    
    if (raiseAmount > maxRaise) {
        alert('Недостаточно фишек!');
        return;
    }
    
    let additionalBet = raiseAmount - player.bet;
    
    player.chips -= additionalBet;
    player.bet = raiseAmount;
    pot += additionalBet;
    currentBet = player.bet;
    
    gameStatusEl.textContent = `Вы повышаете до ${player.bet}. Ход бота.`;
    updateChips();
    
    playerActionTaken = true;
    enablePlayerButtons(false);
    botDecision();
});

foldBtn.addEventListener('click', () => {
    player.folded = true;
    gameStatusEl.textContent = 'Вы сбросили карты. Бот выиграл раунд.';
    bot.chips += pot;
    endRound();
    updateChips();
});

nextRoundBtn.addEventListener('click', () => {
    gameStage = 'waiting';
    dealBtn.disabled = false;
    nextRoundBtn.disabled = true;
    
    displayCard(playerCard1, null);
    displayCard(playerCard2, null);
    botCard1.className = 'card';
    botCard2.className = 'card';
    communityEls.forEach(el => displayCard(el, null));
    
    gameStatusEl.textContent = 'Нажмите "Сдать карты" для нового раунда';
});

console.log('Покер с правильными правилами загружен!');
