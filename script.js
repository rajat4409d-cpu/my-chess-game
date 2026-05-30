var board = null;
var game = new Chess();
var $status = $('#gameStatus');
var pendingPromotionMove = null;

var moveSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.ogg');
var captureSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Capture.ogg');
var checkSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.ogg');
var endSound = new Audio('https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg');

var timeControl = 600; 
var timeWhite = timeControl;
var timeBlack = timeControl;
var timerInterval = null;
var gameStarted = false;
var aiColor = 'b'; 

var gameMode = 'pve'; 
var pieceThemeStyle = 'wikipedia'; // NEW: Track the current piece aesthetic

// --- ENGINE LOGIC ---
var workerBlob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"], { type: "application/javascript" });
var engine = new Worker(window.URL.createObjectURL(workerBlob));
var engineSkill = 10; 

engine.onmessage = function(event) {
    var line = event.data;
    
    if (line.indexOf('info') > -1 && line.indexOf('score') > -1) {
        var scoreMatch = line.match(/score cp (-?\d+)/);
        var mateMatch = line.match(/score mate (-?\d+)/);
        var fillPercentage = 50; 

        if (scoreMatch) {
            var cp = parseInt(scoreMatch[1]);
            if (game.turn() === 'b') cp = -cp; 
            fillPercentage = 50 + (cp / 12); 
        } else if (mateMatch) {
            var mate = parseInt(mateMatch[1]);
            if (game.turn() === 'b') mate = -mate;
            fillPercentage = mate > 0 ? 100 : 0; 
        }
        if (fillPercentage > 100) fillPercentage = 100;
        if (fillPercentage < 0) fillPercentage = 0;
        $('#evalFill').css('height', fillPercentage + '%');
    }

    if (line.indexOf('bestmove') > -1) {
        var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            var move = game.move({ from: match[1], to: match[2], promotion: match[3] ? match[3] : 'q' });
            if (move) {
                board.position(game.fen());
                highlightLastMove(match[1], match[2]);
                playMoveSound(move);
                updateTimerUI();
                updateHistoryUI();
                updateCapturedPieces();
                updateStatus();
            }
        }
    }
};

engine.postMessage('uci');

function makeComputerMove() {
    if (!game.game_over() && game.turn() === aiColor) {
        var actualSkill = (engineSkill === 1) ? 0 : engineSkill;
        engine.postMessage('setoption name Skill Level value ' + actualSkill);
        engine.postMessage('position fen ' + game.fen());
        var maxTime = (engineSkill === 20) ? 2000 : (engineSkill === 10 ? 800 : 250);
        engine.postMessage('go depth ' + engineSkill + ' movetime ' + maxTime);
    }
}

// --- OPENING TRACKER LOGIC ---
var openingBook = {
    "e4,e5,Nf3,Nc6,Bc4": "Italian Game", "d4,d5,c4,Bf5": "Baltic Defense", "e4,c5": "Sicilian Defense",
    "e4,e6": "French Defense", "e4,c6": "Caro-Kann Defense", "d4,d5,c4,e6": "Queen's Gambit Declined",
    "d4,d5,c4,dxc4": "Queen's Gambit Accepted", "e4,e5,Nf3,Nc6,Bb5": "Ruy Lopez",
    "d4,Nf6,c4,g6": "King's Indian Defense", "e4,e5,Nf3,Nf6": "Petrov's Defense"
};

function checkOpening() {
    var historyStr = game.history().join(',');
    var currentOpening = "";
    var openingKeys = Object.keys(openingBook).sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < openingKeys.length; i++) {
        if (historyStr.startsWith(openingKeys[i])) { currentOpening = openingBook[openingKeys[i]]; break; }
    }
    if (currentOpening !== "") {
        $('#openingTracker').text(currentOpening).fadeIn(300);
    } else if (game.history().length > 10) {
        $('#openingTracker').fadeOut(300);
    }
}

// --- CORE UI LOGIC ---
function formatTime(seconds) { var m = Math.floor(seconds / 60); var s = seconds % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
function updateTimerUI() {
    $('#timerWhite').text(formatTime(timeWhite)); $('#timerBlack').text(formatTime(timeBlack));
    if (game.turn() === 'w') { $('#timerWhite').addClass('active'); $('#timerBlack').removeClass('active'); } 
    else { $('#timerBlack').addClass('active'); $('#timerWhite').removeClass('active'); }
}
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function() {
        if (game.game_over()) return clearInterval(timerInterval);
        if (game.turn() === 'w') { timeWhite--; if (timeWhite <= 0) { timeWhite = 0; timeOutWin('Black'); } } 
        else { timeBlack--; if (timeBlack <= 0) { timeBlack = 0; timeOutWin('White'); } }
        updateTimerUI();
    }, 1000);
}
function timeOutWin(winner) { clearInterval(timerInterval); $status.text('Time out! ' + winner + ' wins!'); endSound.play(); }

function updateHistoryUI() {
    var history = game.history(); var html = '';
    for (var i = 0; i < history.length; i += 2) {
        html += '<div class="history-row"><span class="move-num">' + ((i / 2) + 1) + '.</span><span class="move-w">' + history[i] + '</span><span class="move-b">' + (history[i + 1] ? history[i + 1] : '') + '</span></div>';
    }
    $('#moveHistory').html(html);
    var histDiv = document.getElementById('moveHistory');
    histDiv.scrollTop = histDiv.scrollHeight;
}

function updateCapturedPieces() {
    var starts = { 'w': { 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 }, 'b': { 'q': 1, 'r': 2, 'b': 2, 'n': 2, 'p': 8 } };
    var counts = { 'w': { 'q': 0, 'r': 0, 'b': 0, 'n': 0, 'p': 0 }, 'b': { 'q': 0, 'r': 0, 'b': 0, 'n': 0, 'p': 0 } };
    var sW = 0; var sB = 0; var vals = { 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1 };
    var boardState = game.board();
    for (var i=0; i<8; i++) for (var j=0; j<8; j++) if (boardState[i][j]) { counts[boardState[i][j].color][boardState[i][j].type]++; if (boardState[i][j].color === 'w') sW += vals[boardState[i][j].type]; else sB += vals[boardState[i][j].type]; }
    var wHTML = ''; var bHTML = ''; var order = ['q', 'r', 'b', 'n', 'p'];
    
    // UPDATED: Dynamically loads the selected piece style for the graveyard
    order.forEach(function(t) {
        for(var i=0; i<starts['b'][t]-counts['b'][t]; i++) wHTML += `<img src="https://chessboardjs.com/img/chesspieces/${pieceThemeStyle}/b${t.toUpperCase()}.png">`;
        for(var i=0; i<starts['w'][t]-counts['w'][t]; i++) bHTML += `<img src="https://chessboardjs.com/img/chesspieces/${pieceThemeStyle}/w${t.toUpperCase()}.png">`;
    });
    
    if (sW > sB) wHTML += `<span class="advantage">+${sW - sB}</span>`; else if (sB > sW) bHTML += `<span class="advantage">+${sB - sW}</span>`;
    $('#capturedByWhite').html(wHTML); $('#capturedByBlack').html(bHTML);
}

function playMoveSound(move) { moveSound.currentTime=0; captureSound.currentTime=0; checkSound.currentTime=0; if (game.in_checkmate() || game.in_draw()) endSound.play(); else if (game.in_check()) checkSound.play(); else if (move.captured) captureSound.play(); else moveSound.play(); }

function removeHighlights() { $('#myBoard .square-55d63').removeClass('possible-move possible-capture'); }
function highlightLastMove(from, to) { $('#myBoard .square-55d63').removeClass('highlight-move'); if (from && to) { $('#myBoard .square-' + from).addClass('highlight-move'); $('#myBoard .square-' + to).addClass('highlight-move'); } }

function updateStatus() { 
    if (game.in_checkmate()) { 
        clearInterval(timerInterval); 
        $status.text('Checkmate! ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins! 🎉'); 
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } }); 
    } else if (game.in_draw()) { 
        clearInterval(timerInterval); 
        $status.text('Game Over. It\'s a Draw!'); 
    } else { 
        $status.text((game.turn() === 'w' ? 'White' : 'Black') + ' to move' + (game.in_check() ? ' (Check!)' : '')); 
    } 
    checkOpening(); 
}

function onDragStart(source, piece) {
    if (game.game_over()) return false;
    if (gameMode === 'pvp' && (timeWhite <= 0 || timeBlack <= 0)) return false;
    if (gameMode === 'pve' && game.turn() === aiColor) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
    
    var moves = game.moves({ square: source, verbose: true }); 
    if (moves.length === 0) return false;
    for (var i = 0; i < moves.length; i++) {
        if (moves[i].flags.indexOf('c') !== -1 || moves[i].flags.indexOf('e') !== -1) {
            $('#myBoard .square-' + moves[i].to).addClass('possible-capture');
        } else {
            $('#myBoard .square-' + moves[i].to).addClass('possible-move');
        }
    }
}

function onDrop(source, target) {
    removeHighlights();
    var piece = game.get(source);
    if (piece && piece.type === 'p' && (target.charAt(1) === '8' || target.charAt(1) === '1')) {
        pendingPromotionMove = { source: source, target: target };
        
        // UPDATED: Dynamically loads the selected piece style for the promotion menu
        $('.promo-piece').each(function() { $(this).attr('src', `https://chessboardjs.com/img/chesspieces/${pieceThemeStyle}/` + piece.color + $(this).data('piece').toUpperCase() + '.png'); });
        
        $('#promotionMenu').css('display', 'flex'); return 'snapback'; 
    }
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    highlightLastMove(move.from, move.to); playMoveSound(move);
    if (!gameStarted) { gameStarted = true; if (gameMode === 'pvp') startTimer(); }
    updateTimerUI(); updateHistoryUI(); updateCapturedPieces(); updateStatus();
    if (gameMode === 'pve') window.setTimeout(makeComputerMove, 250);
}
function onSnapEnd() { if (pendingPromotionMove === null) board.position(game.fen()); }

$('.promo-piece').on('click', function() {
    $('#promotionMenu').css('display', 'none');
    if (pendingPromotionMove) {
        var move = game.move({ from: pendingPromotionMove.source, to: pendingPromotionMove.target, promotion: $(this).data('piece') });
        pendingPromotionMove = null; board.position(game.fen()); highlightLastMove(move.from, move.to); playMoveSound(move);
        if (!gameStarted) { gameStarted = true; if (gameMode === 'pvp') startTimer(); }
        updateTimerUI(); updateHistoryUI(); updateCapturedPieces(); updateStatus(); 
        if (gameMode === 'pve') window.setTimeout(makeComputerMove, 250);
    }
});
$('#cancelPromoBtn').on('click', function() { $('#promotionMenu').css('display', 'none'); pendingPromotionMove = null; });

// --- BUTTONS & SETTINGS ---
$('#settingsBtn').on('click', function() { $('#settingsModal').css('display', 'flex'); });
$('#closeSettingsBtn').on('click', function() { $('#settingsModal').css('display', 'none'); });
$('#flipBoardBtn').on('click', function() { board.flip(); });

$('#saveSettingsBtn').on('click', function() {
    gameMode = $('#modeSelect').val() || 'pve'; 
    timeControl = parseInt($('#timeSelect').val()); 
    engineSkill = parseInt($('#difficultySelect').val()); 
    
    // UPDATED: Save the new piece theme and apply the board theme classes
    pieceThemeStyle = $('#pieceSelect').val(); 
    $('#myBoard').removeClass('theme-classic theme-green theme-blue theme-monochrome theme-coral').addClass('theme-' + $('#themeSelect').val());
    
    // Re-initialize the chessboard library entirely so it pulls the new image assets
    config.pieceTheme = `https://chessboardjs.com/img/chesspieces/${pieceThemeStyle}/{piece}.png`;
    board = Chessboard('myBoard', config);
    $(window).resize(board.resize);
    
    restartGame(); 
    $('#settingsModal').css('display', 'none');
});

$('#undoBtn').on('click', function() { 
    if (game.history().length === 0) return; 
    game.undo(); 
    if (gameMode === 'pve' && game.turn() === aiColor) game.undo(); 
    board.position(game.fen()); highlightLastMove(null, null); updateHistoryUI(); updateCapturedPieces(); updateStatus(); 
});
$('#resignBtn').on('click', function() { if (game.game_over() || !gameStarted) return; clearInterval(timerInterval); gameStarted = false; $status.text((game.turn() === 'w' ? 'White' : 'Black') + ' Resigned. ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins!'); endSound.play(); });
$('#drawBtn').on('click', function() { 
    if (game.game_over() || !gameStarted) return; 
    clearInterval(timerInterval); 
    gameStarted = false; 
    $status.text('Draw agreed. 🤝'); 
    endSound.play(); 
});
$('#resetBtn').on('click', restartGame);

$('#downloadPgnBtn').on('click', function() {
    if (game.history().length === 0) return; 
    var pgnData = game.pgn();
    var blob = new Blob([pgnData], { type: 'text/plain' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ChessEngine_Match.pgn';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); window.URL.revokeObjectURL(url);
});

function restartGame() { 
    game.reset(); board.start(); clearInterval(timerInterval); timeWhite = timeControl; timeBlack = timeControl; gameStarted = false; 
    aiColor = (board.orientation() === 'white') ? 'b' : 'w'; 
    
    // NEW: Wipe Stockfish's memory cache so it actually respects the new difficulty setting!
    engine.postMessage('ucinewgame');
    engine.postMessage('setoption name Clear Hash');
    
    // Update Player Profiles based on Game Mode 
    if (gameMode === 'pvp') { 
        $('.opponent-profile .player-info span').text('Player 2 (' + (aiColor === 'w' ? 'White' : 'Black') + ')'); 
        $('.opponent-profile .avatar').text('👤'); // Human avatar 
        $('.player-profile .player-info span').text('Player 1 (' + (aiColor === 'w' ? 'Black' : 'White') + ')'); 
        $('.timer').show();
    } else { 
        var diffText = (engineSkill === 20) ? 'Grandmaster' : (engineSkill === 10 ? 'Advanced' : 'Beginner');
        $('.opponent-profile .player-info span').text('Stockfish AI (' + diffText + ')'); 
        $('.opponent-profile .avatar').text('🤖'); // Robot avatar 
        $('.player-profile .player-info span').text('You (' + (aiColor === 'w' ? 'Black' : 'White') + ')'); 
        $('.timer').hide();
    }

    updateTimerUI(); $('#moveHistory').html(''); updateCapturedPieces(); highlightLastMove(null, null); updateStatus(); $('#openingTracker').hide(); $('#evalFill').css('height', '50%'); 
        
    if (gameMode === 'pve' && aiColor === 'w') window.setTimeout(makeComputerMove, 250); 
}

// Initial configuration uses the dynamic pieceThemeStyle variable
var config = { 
    pieceTheme: `https://chessboardjs.com/img/chesspieces/${pieceThemeStyle}/{piece}.png`, 
    draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd 
};
board = Chessboard('myBoard', config);
restartGame(); 
$(window).resize(board.resize);