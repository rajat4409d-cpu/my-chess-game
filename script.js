var board = null;
var game = new Chess();
var $status = $('#gameStatus');
var pendingPromotionMove = null;

// Premium "Classy" Audio Objects
var moveSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.ogg');
var captureSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Capture.ogg');
var checkSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.ogg');
var endSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg');

// Variables for Timer
var timeControl = 600; 
var timeWhite = timeControl;
var timeBlack = timeControl;
var timerInterval = null;
var gameStarted = false;

// --- STOCKFISH AI ENGINE ---
var workerBlob = new Blob([
    "importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"
], { type: "application/javascript" });
var engine = new Worker(window.URL.createObjectURL(workerBlob));

var engineSkill = 10; 

engine.onmessage = function(event) {
    var line = event.data;
    
    if (line.indexOf('bestmove') > -1) {
        var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            var move = game.move({
                from: match[1],
                to: match[2],
                promotion: match[3] ? match[3] : 'q'
            });
            
            board.position(game.fen());
            
            // Trigger visual features
            highlightLastMove(match[1], match[2]);
            playMoveSound(move);
            updateTimerUI();
            updateHistoryUI();
            updateCapturedPieces();
            updateStatus();
        }
    }
};

engine.postMessage('uci');

function makeComputerMove() {
    if (!game.game_over() && game.turn() === 'b') {
        
        if (engineSkill === 1 && Math.random() < 0.25) {
            var possibleMoves = game.moves();
            var randomIdx = Math.floor(Math.random() * possibleMoves.length);
            var move = game.move(possibleMoves[randomIdx]); 
            
            board.position(game.fen());
            highlightLastMove(move.from, move.to);
            playMoveSound(move);
            updateTimerUI();
            updateHistoryUI();
            updateCapturedPieces();
            updateStatus();
            return; 
        }

        var safeDepth = 5; 
        var actualSkill = 20;

        if (engineSkill === 1) { actualSkill = 0; safeDepth = 5; }    
        if (engineSkill === 5) { actualSkill = 5; safeDepth = 5; }    
        if (engineSkill === 10) { actualSkill = 10; safeDepth = 8; }  
        if (engineSkill === 15) { actualSkill = 15; safeDepth = 10; } 
        if (engineSkill === 20) { actualSkill = 20; safeDepth = 14; } 

        engine.postMessage('setoption name Skill Level value ' + actualSkill);
        engine.postMessage('position fen ' + game.fen());
        engine.postMessage('go depth ' + safeDepth);
    }
}

// --- TIMER LOGIC ---
function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function updateTimerUI() {
    $('#timerWhite').text(formatTime(timeWhite));
    $('#timerBlack').text(formatTime(timeBlack));

    if (game.turn() === 'w') {
        $('#timerWhite').addClass('active');
        $('#timerBlack').removeClass('active');
    } else {
        $('#timerBlack').addClass('active');
        $('#timerWhite').removeClass('active');
    }

    if (timeWhite <= 30) $('#timerWhite').addClass('danger');
    if (timeBlack <= 30) $('#timerBlack').addClass('danger');
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function() {
        if (game.game_over()) {
            clearInterval(timerInterval);
            return;
        }
        
        if (game.turn() === 'w') {
            timeWhite--;
            if (timeWhite <= 0) { timeWhite = 0; timeOutWin('Black'); }
        } else {
            timeBlack--;
            if (timeBlack <= 0) { timeBlack = 0; timeOutWin('White'); }
        }
        updateTimerUI();
    }, 1000);
}

function timeOutWin(winner) {
    clearInterval(timerInterval);
    $status.text('Time out! ' + winner + ' wins!');
    endSound.play();
}

// --- HISTORY & GRAVEYARD LOGIC ---
function updateHistoryUI() {
    var history = game.history(); 
    var html = '';
    for (var i = 0; i < history.length; i += 2) {
        var moveNum = (i / 2) + 1;
        var whiteMove = history[i];
        var blackMove = history[i + 1] ? history[i + 1] : '';
        html += '<div class="history-row"><span class="move-num">' + moveNum + '.</span><span class="move-w">' + whiteMove + '</span><span class="move-b">' + blackMove + '</span></div>';
    }
    $('#moveHistory').html(html);
    var historyDiv = document.getElementById('moveHistory');
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

function updateCapturedPieces() {
    var startCounts = { 'w': { 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 }, 'b': { 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 } };
    var currentCounts = { 'w': { 'q': 0, 'r': 0, 'b': 0, 'n': 0, 'p': 0 }, 'b': { 'q': 0, 'r': 0, 'b': 0, 'n': 0, 'p': 0 } };
    var scoreWhite = 0; var scoreBlack = 0;
    var pieceValues = { 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1 };

    var boardState = game.board();
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                currentCounts[piece.color][piece.type]++;
                if (piece.color === 'w') scoreWhite += pieceValues[piece.type];
                if (piece.color === 'b') scoreBlack += pieceValues[piece.type];
            }
        }
    }

    var whiteCapturedHTML = ''; var blackCapturedHTML = ''; 
    var pieceOrder = ['q', 'r', 'b', 'n', 'p'];

    pieceOrder.forEach(function(type) {
        var capturedByWhite = startCounts['b'][type] - currentCounts['b'][type];
        for(var i=0; i<capturedByWhite; i++) whiteCapturedHTML += `<img src="https://chessboardjs.com/img/chesspieces/wikipedia/b${type.toUpperCase()}.png">`;
        var capturedByBlack = startCounts['w'][type] - currentCounts['w'][type];
        for(var i=0; i<capturedByBlack; i++) blackCapturedHTML += `<img src="https://chessboardjs.com/img/chesspieces/wikipedia/w${type.toUpperCase()}.png">`;
    });

    if (scoreWhite > scoreBlack) whiteCapturedHTML += `<span class="advantage">+${scoreWhite - scoreBlack}</span>`;
    else if (scoreBlack > scoreWhite) blackCapturedHTML += `<span class="advantage">+${scoreBlack - scoreWhite}</span>`;

    $('#capturedByWhite').html(whiteCapturedHTML);
    $('#capturedByBlack').html(blackCapturedHTML);
}

// --- SOUND LOGIC ---
function playMoveSound(move) {
    moveSound.currentTime = 0; captureSound.currentTime = 0; checkSound.currentTime = 0;
    if (game.in_checkmate() || game.in_draw()) endSound.play();
    else if (game.in_check()) checkSound.play();
    else if (move.captured) captureSound.play();
    else moveSound.play();
}

// --- GAME LOGIC ---
function removeHighlights() { $('#myBoard .square-55d63').removeClass('possible-move'); }

function highlightLastMove(from, to) {
    $('#myBoard .square-55d63').removeClass('highlight-move');
    if (from && to) {
        $('#myBoard .square-' + from).addClass('highlight-move');
        $('#myBoard .square-' + to).addClass('highlight-move');
    }
}

function updateStatus() {
    var statusHTML = '';
    var moveColor = (game.turn() === 'w') ? 'White' : 'Black';

    if (game.in_checkmate()) {
        clearInterval(timerInterval);
        var winner = (game.turn() === 'w') ? 'Black' : 'White';
        statusHTML = 'Checkmate! ' + winner + ' wins! 🎉';
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    } else if (game.in_draw()) {
        clearInterval(timerInterval);
        statusHTML = 'Game Over. It\'s a Draw!';
    } else {
        statusHTML = moveColor + ' to move';
        if (game.in_check()) statusHTML += ' (In Check!)';
    }
    $status.text(statusHTML);
}

function onDragStart (source, piece, position, orientation) {
    if (game.game_over() || timeWhite <= 0 || timeBlack <= 0) return false;
    
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }

    var moves = game.moves({ square: source, verbose: true });
    if (moves.length === 0) return false;
    for (var i = 0; i < moves.length; i++) $('#myBoard .square-' + moves[i].to).addClass('possible-move');
}

function onDrop (source, target) {
    removeHighlights();
    var pieceToMove = game.get(source);
    var isPromotion = (pieceToMove !== null && pieceToMove.type === 'p' && (target.charAt(1) === '8' || target.charAt(1) === '1'));

    if (isPromotion) {
        pendingPromotionMove = { source: source, target: target };
        var colorStr = pieceToMove.color;
        $('.promo-piece').each(function() {
            $(this).attr('src', 'https://chessboardjs.com/img/chesspieces/wikipedia/' + colorStr + $(this).data('piece').toUpperCase() + '.png');
        });
        $('#promotionMenu').css('display', 'flex');
        return 'snapback'; 
    }

    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    
    highlightLastMove(move.from, move.to);
    playMoveSound(move);
    if (!gameStarted) { gameStarted = true; startTimer(); }
    
    updateTimerUI();
    updateHistoryUI();
    updateCapturedPieces(); 
    updateStatus();

    window.setTimeout(makeComputerMove, 250);
}

function onSnapEnd () {
    if (pendingPromotionMove === null) board.position(game.fen());
}

$('.promo-piece').on('click', function() {
    var chosenPiece = $(this).data('piece');
    $('#promotionMenu').css('display', 'none');

    if (pendingPromotionMove) {
        var move = game.move({ from: pendingPromotionMove.source, to: pendingPromotionMove.target, promotion: chosenPiece });
        pendingPromotionMove = null;
        board.position(game.fen());
        
        highlightLastMove(move.from, move.to);
        playMoveSound(move);
        if (!gameStarted) { gameStarted = true; startTimer(); }
        
        updateTimerUI();
        updateHistoryUI();
        updateCapturedPieces();
        updateStatus();
        window.setTimeout(makeComputerMove, 250);
    }
});

$('#cancelPromoBtn').on('click', function() {
    $('#promotionMenu').css('display', 'none');
    pendingPromotionMove = null;
});

// --- UI EVENT LISTENERS ---
$('#settingsBtn').on('click', function() { $('#settingsModal').css('display', 'flex'); });
$('#closeSettingsBtn').on('click', function() { $('#settingsModal').css('display', 'none'); });
$('#flipBoardBtn').on('click', function() { board.flip(); });

$('#saveSettingsBtn').on('click', function() {
    timeControl = parseInt($('#timeSelect').val());
    engineSkill = parseInt($('#difficultySelect').val()); 
    
    var selectedTheme = $('#themeSelect').val();
    $('#myBoard').removeClass('theme-blue theme-green theme-monochrome').addClass('theme-' + selectedTheme);
    
    restartGame();
    $('#settingsModal').css('display', 'none');
});

// --- ACTION BUTTONS (UNDO, DRAW, RESIGN) ---

$('#undoBtn').on('click', function() {
    if (game.history().length === 0) return; 

    game.undo(); 
    if (game.turn() === 'b') { game.undo(); }
    
    board.position(game.fen());
    highlightLastMove(null, null); 
    
    updateHistoryUI();
    updateCapturedPieces();
    updateStatus();
});

$('#resignBtn').on('click', function() {
    if (game.game_over() || !gameStarted) return;
    
    clearInterval(timerInterval); 
    gameStarted = false; 
    
    var loser = (game.turn() === 'w') ? 'White' : 'Black';
    var winner = (game.turn() === 'w') ? 'Black' : 'White';
    
    $status.text(loser + ' Resigned. ' + winner + ' wins!');
    endSound.play();
});

$('#drawBtn').on('click', function() {
    if (game.game_over() || !gameStarted) return;
    
    clearInterval(timerInterval); 
    gameStarted = false; 
    
    $status.text('Draw agreed by players. 🤝');
    endSound.play();
});

function restartGame() {
    game.reset();
    board.start();
    clearInterval(timerInterval);
    timeWhite = timeControl; timeBlack = timeControl; gameStarted = false;
    
    updateTimerUI();
    $('#moveHistory').html('');
    updateCapturedPieces(); 
    highlightLastMove(null, null);
    updateStatus();
    $('#promotionMenu').css('display', 'none');
    pendingPromotionMove = null;
}

$('#resetBtn').on('click', restartGame);

// --- INITIALIZATION ---
var config = {
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

board = Chessboard('myBoard', config);
updateStatus();
updateTimerUI();
updateCapturedPieces();