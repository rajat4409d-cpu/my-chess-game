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
function timeOutWin(winner) {
    clearInterval(timerInterval);
    $status.text('Time out! ' + winner + ' wins!');
    endSound.play();
    var playerColor = aiColor === 'b' ? 'White' : 'Black';
    var opp = gameMode === 'pvp' ? 'Player 2' : 'Stockfish';
    if (typeof recordGameResult !== 'undefined') recordGameResult(winner === playerColor ? 'win' : 'loss', game.history().length, opp, 'timeout');
}

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
        var winner = game.turn() === 'w' ? 'Black' : 'White';
        $status.text('Checkmate! ' + winner + ' wins! 🎉');
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        var playerColor = aiColor === 'b' ? 'w' : 'b';
        var opp = gameMode === 'pvp' ? 'Player 2' : 'Stockfish (' + (engineSkill===20?'GM':engineSkill===10?'Adv':'Beg') + ')';
        var playerWon = (game.turn() !== playerColor);
        if (typeof recordGameResult !== 'undefined') recordGameResult(playerWon ? 'win' : 'loss', game.history().length, opp, 'checkmate');
    } else if (game.in_draw()) {
        clearInterval(timerInterval);
        $status.text('Game Over. It\'s a Draw!');
        var opp2 = gameMode === 'pvp' ? 'Player 2' : 'Stockfish';
        if (typeof recordGameResult !== 'undefined') recordGameResult('draw', game.history().length, opp2, 'draw');
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
$('#resignBtn').on('click', function() {
    if (game.game_over() || !gameStarted) return;
    clearInterval(timerInterval); gameStarted = false;
    $status.text((game.turn() === 'w' ? 'White' : 'Black') + ' Resigned. ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins!');
    endSound.play();
    var opp = gameMode === 'pvp' ? 'Player 2' : 'Stockfish';
    if (typeof recordGameResult !== 'undefined') recordGameResult('resign', game.history().length, opp, 'resignation');
});
$('#drawBtn').on('click', function() {
    if (game.game_over() || !gameStarted) return;
    clearInterval(timerInterval); gameStarted = false;
    $status.text('Draw agreed. 🤝');
    endSound.play();
    var opp = gameMode === 'pvp' ? 'Player 2' : 'Stockfish';
    if (typeof recordGameResult !== 'undefined') recordGameResult('draw', game.history().length, opp, 'agreement');
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
// ============================================================
// ANALYSIS MODE
// ============================================================

var analysisBoard = null;
var analysisGame  = new Chess();
var analysisMoveIndex  = 0;
var analysisHistory    = [];   // [{fen, san, from, to, uci}]
var analysisEvals      = [];   // centipawn (white-perspective) per position
var analysisBestUCI    = [];   // UCI string of best move per position
var analysisBestSAN    = [];   // SAN string of best move per position
var analysisAnnotations= [];   // annotation symbol per move
var analysisWorker     = null;
var analysisPieceTheme = pieceThemeStyle;
var analysisPerspective = 'both';  // 'white' | 'black' | 'both'
var _pendingAnalysisCallback = null; // called after perspective is chosen

function createAnalysisWorker() {
    var blob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"], { type:'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
}

// ---------- SVG ARROW OVERLAY ----------
function drawBestMoveArrow(uci) {
    // Remove old arrow
    $('#analysisArrow').remove();
    if (!uci || uci.length < 4) return;

    var fromSq = uci.slice(0, 2);
    var toSq   = uci.slice(2, 4);

    // Get board DOM positions
    var $board = $('#analysisBoard');
    var boardOffset = $board.offset();
    var boardW = $board.width();
    var sqSize = boardW / 8;

    var isFlipped = (analysisBoard.orientation() === 'black');

    function sqToXY(sq) {
        var file = sq.charCodeAt(0) - 97; // a=0 .. h=7
        var rank = parseInt(sq[1]) - 1;   // 1=0 .. 8=7
        var col = isFlipped ? (7 - file) : file;
        var row = isFlipped ? rank       : (7 - rank);
        return {
            x: col * sqSize + sqSize / 2,
            y: row * sqSize + sqSize / 2
        };
    }

    var from = sqToXY(fromSq);
    var to   = sqToXY(toSq);

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'analysisArrow';
    svg.setAttribute('width',  boardW);
    svg.setAttribute('height', boardW);
    svg.style.position = 'absolute';
    svg.style.top  = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '10';

    // Arrow marker
    var defs   = document.createElementNS(svgNS, 'defs');
    var marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id',          'arrowhead');
    marker.setAttribute('markerWidth',  '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('refX',         '2');
    marker.setAttribute('refY',         '2');
    marker.setAttribute('orient',       'auto');
    var poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', '0 0, 4 2, 0 4');
    poly.setAttribute('fill', 'rgba(0,200,120,0.9)');
    marker.appendChild(poly);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Shorten line so arrowhead doesn't overlap piece
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var len = Math.sqrt(dx*dx + dy*dy);
    var shorten = sqSize * 0.38;
    var ex = to.x - dx/len * shorten;
    var ey = to.y - dy/len * shorten;

    var line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', ex);
    line.setAttribute('y2', ey);
    line.setAttribute('stroke',       'rgba(0,200,120,0.85)');
    line.setAttribute('stroke-width', sqSize * 0.18);
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('marker-end',   'url(#arrowhead)');
    svg.appendChild(line);

    // Attach inside boardContainer (relative positioned)
    var $container = $('#analysisBoardContainer');
    $container.css('position', 'relative');
    // Position svg over the board div
    var contOffset  = $container.offset();
    var boardLeft   = boardOffset.left - contOffset.left;
    var boardTop    = boardOffset.top  - contOffset.top;
    svg.style.left  = boardLeft + 'px';
    svg.style.top   = boardTop  + 'px';
    $container.append(svg);
}

// ---------- ANNOTATION BADGE ON BOARD ----------
function drawAnnotationBadge(annotation, toSquare) {
    $('#analysisBadge').remove();
    if (!annotation || !toSquare) return;

    var $board    = $('#analysisBoard');
    var boardW    = $board.width();
    var sqSize    = boardW / 8;
    var isFlipped = (analysisBoard.orientation() === 'black');

    var file = toSquare.charCodeAt(0) - 97;
    var rank = parseInt(toSquare[1]) - 1;
    var col  = isFlipped ? (7 - file) : file;
    var row  = isFlipped ? rank       : (7 - rank);

    var x = col * sqSize + sqSize * 0.62;
    var y = row * sqSize + sqSize * 0.05;

    var colors = {
        '\u2605': '#0ea5e9', '\u2713': '#10b981',
        '?!': '#f59e0b', '?': '#f97316', '??': '#ef4444'
    };
    var color = colors[annotation] || '#888';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'analysisBadge';
    svg.setAttribute('width',  boardW);
    svg.setAttribute('height', boardW);
    svg.style.position    = 'absolute';
    svg.style.top         = '0';
    svg.style.left        = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex      = '11';

    var r = sqSize * 0.22;
    var cx = x + r;
    var cy = y + r;

    var circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r',  r);
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '1.5');
    svg.appendChild(circle);

    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', r * (annotation.length > 1 ? 0.85 : 1.1));
    text.setAttribute('font-weight', '800');
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-family', 'sans-serif');
    text.textContent = annotation;
    svg.appendChild(text);

    var $container = $('#analysisBoardContainer');
    var contOffset = $container.offset();
    var boardOffset= $board.offset();
    svg.style.left = (boardOffset.left - contOffset.left) + 'px';
    svg.style.top  = (boardOffset.top  - contOffset.top)  + 'px';
    $container.append(svg);
}

// ---------- OPEN / CLOSE ----------
function openAnalysis() {
    // If no game moves yet, open straight to PGN modal instead
    if (game.history().length === 0) {
        $('#analysisOverlay').addClass('open');
        $('#analyzeNavBtn').addClass('active');
        if (typeof sessionStats !== 'undefined') sessionStats.analyzed = (sessionStats.analyzed || 0) + 1;
        openPgnModal();
        return;
    }

    $('#analyzeNavBtn').addClass('active');
    if (typeof sessionStats !== 'undefined') sessionStats.analyzed = (sessionStats.analyzed || 0) + 1;

    // Ask whose perspective before running
    var whiteLabel = $('.player-profile .player-info span').text() || 'White';
    var blackLabel = $('.opponent-profile .player-info span').text() || 'Black';
    showPerspectivePicker(whiteLabel, blackLabel, function() {
        _buildAndRunAnalysis(null);
    });
}

function _buildAndRunAnalysis(prebuiltHistory) {
    // prebuiltHistory: pass already-built history array (for PGN), or null to build from live game
    if (!prebuiltHistory) {
        analysisHistory = [];
        var tempGame = new Chess();
        var moves = game.history({ verbose: true });
        analysisHistory.push({ fen: tempGame.fen(), san: null, from: null, to: null, uci: null });
        moves.forEach(function(m) {
            tempGame.move(m);
            analysisHistory.push({ fen: tempGame.fen(), san: m.san, from: m.from, to: m.to, uci: m.from + m.to + (m.promotion || '') });
        });
    } else {
        analysisHistory = prebuiltHistory;
    }

    analysisEvals       = new Array(analysisHistory.length).fill(null);
    analysisBestUCI     = new Array(analysisHistory.length).fill(null);
    analysisBestSAN     = new Array(analysisHistory.length).fill(null);
    analysisAnnotations = new Array(analysisHistory.length).fill('');

    analysisPieceTheme = pieceThemeStyle;
    var aCfg = {
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/' + analysisPieceTheme + '/{piece}.png',
        draggable: false,
        position: 'start'
    };
    if (analysisBoard) { analysisBoard.destroy(); }
    analysisBoard = Chessboard('analysisBoard', aCfg);
    $(window).resize(analysisBoard.resize);

    analysisMoveIndex = analysisHistory.length - 1;
    renderAnalysisPosition();
    $('#analysisOverlay').addClass('open');
    startFullAnalysis();
}

function closeAnalysis() {
    $('#analysisOverlay').removeClass('open');
    $('#analyzeNavBtn').removeClass('active');
    if (analysisWorker) { analysisWorker.terminate(); analysisWorker = null; }
    $('#analysisLoadingBanner').hide();
    $('#analysisArrow').remove();
    $('#analysisBadge').remove();
}

// ---------- RENDER POSITION ----------
function renderAnalysisPosition() {
    var pos = analysisHistory[analysisMoveIndex];
    analysisGame.load(pos.fen);
    analysisBoard.position(pos.fen, false);

    // Highlight last move squares
    $('#analysisBoard .square-55d63').removeClass('highlight-move');
    if (pos.from && pos.to) {
        $('#analysisBoard .square-' + pos.from).addClass('highlight-move');
        $('#analysisBoard .square-' + pos.to).addClass('highlight-move');
    }

    // Status text
    if (analysisMoveIndex === 0) {
        $('#analysisStatus').text('Starting Position');
        $('#analysisMoveLabel').text('\u2014');
    } else {
        var moveNum   = Math.ceil(analysisMoveIndex / 2);
        var isWhite   = (analysisMoveIndex % 2 === 1);
        $('#analysisMoveLabel').text('Move ' + moveNum + (isWhite ? '. White' : '... Black'));
        $('#analysisStatus').text('After: ' + (isWhite ? moveNum + '.' : moveNum + '...') + ' ' + pos.san);
    }

    // Eval score + bar
    var ev = analysisEvals[analysisMoveIndex];
    if (ev !== null) {
        var fill = Math.max(0, Math.min(100, 50 + ev / 12));
        $('#analysisEvalFill').css('height', fill + '%');
        var disp = Math.abs(ev) >= 9000
            ? (ev > 0 ? '+M' : '-M')
            : (ev >= 0 ? '+' : '') + (ev / 100).toFixed(1);
        $('#evalScoreBox').text(disp);
        $('#evalDepth').text('Depth 18');
    } else {
        $('#evalScoreBox').text('\u2014');
        $('#evalDepth').text('Analyzing...');
    }

    // Best move arrow
    var bestUCI = analysisBestUCI[analysisMoveIndex];
    $('#evalBestMove').text(analysisBestSAN[analysisMoveIndex] ? 'Best: ' + analysisBestSAN[analysisMoveIndex] : 'Best: \u2014');
    // Small delay so board DOM is painted first
    setTimeout(function() { drawBestMoveArrow(bestUCI); }, 30);

    // Annotation badge — only show for moves in the chosen perspective
    var ann   = moveIsForPerspective(analysisMoveIndex) ? analysisAnnotations[analysisMoveIndex] : '';
    var toSq  = pos.to;
    setTimeout(function() { drawAnnotationBadge(ann, toSq); }, 35);

    // Opening name
    if (analysisMoveIndex > 0) {
        var histStr = analysisHistory.slice(1, analysisMoveIndex + 1).map(function(h) { return h.san; }).join(',');
        var found = '';
        var keys = Object.keys(openingBook).sort(function(a, b) { return b.length - a.length; });
        for (var i = 0; i < keys.length; i++) {
            if (histStr.startsWith(keys[i])) { found = openingBook[keys[i]]; break; }
        }
        $('#analysisOpening').text(found);
    } else {
        $('#analysisOpening').text('');
    }

    renderAnalysisMoveList();
}

// ---------- MOVE LIST ----------
function moveIsForPerspective(moveIdx) {
    // moveIdx 1,3,5... = White moves; 2,4,6... = Black moves
    if (analysisPerspective === 'both') return true;
    var isWhiteMove = (moveIdx % 2 === 1);
    return analysisPerspective === 'white' ? isWhiteMove : !isWhiteMove;
}

function renderAnalysisMoveList() {
    // Only count annotations for the chosen perspective
    var counts = { brilliant:0, best:0, inaccuracy:0, mistake:0, blunder:0 };
    for (var i = 1; i < analysisHistory.length; i++) {
        if (!moveIsForPerspective(i)) continue;
        var a = analysisAnnotations[i];
        if      (a === '\u2605') counts.brilliant++;
        else if (a === '\u2713') counts.best++;
        else if (a === '?!')    counts.inaccuracy++;
        else if (a === '?')     counts.mistake++;
        else if (a === '??')    counts.blunder++;
    }
    $('#cntBrilliant').text(counts.brilliant);
    $('#cntBest').text(counts.best);
    $('#cntInaccuracy').text(counts.inaccuracy);
    $('#cntMistake').text(counts.mistake);
    $('#cntBlunder').text(counts.blunder);

    // Update perspective label in accuracy row
    var perspLabel = analysisPerspective === 'white' ? ' (White)' : analysisPerspective === 'black' ? ' (Black)' : '';
    $('#analysisAccuracyRow').attr('title', 'Move ratings' + perspLabel);

    var html = '';
    for (var i = 1; i < analysisHistory.length; i += 2) {
        var wMove = analysisHistory[i];
        var bMove = analysisHistory[i + 1] || null;
        var mn    = Math.ceil(i / 2);

        // Show annotation only if this move is in perspective
        var wAnn  = moveIsForPerspective(i)     ? (analysisAnnotations[i]   || '') : '';
        var bAnn  = (bMove && moveIsForPerspective(i+1)) ? (analysisAnnotations[i+1] || '') : '';

        var wCls  = 'ana-move-cell' + (analysisMoveIndex === i ? ' active-cell' : '') + (moveIsForPerspective(i) ? '' : ' out-of-perspective');
        var bCls  = 'ana-move-cell' + (bMove && analysisMoveIndex === i+1 ? ' active-cell' : '') + (bMove && moveIsForPerspective(i+1) ? '' : ' out-of-perspective');

        var wBadge = wAnn ? '<span class="move-annotation ' + getAnnClass(wAnn) + '">' + wAnn + '</span>' : '';
        var bBadge = bAnn ? '<span class="move-annotation ' + getAnnClass(bAnn) + '">' + bAnn + '</span>' : '';

        html += '<div class="ana-history-row">';
        html += '<span class="ana-move-num">' + mn + '.</span>';
        html += '<span class="' + wCls + '" data-idx="' + i + '">' + wMove.san + wBadge + '</span>';
        if (bMove) html += '<span class="' + bCls + '" data-idx="' + (i+1) + '">' + bMove.san + bBadge + '</span>';
        else       html += '<span class="ana-move-cell" style="flex:1"></span>';
        html += '</div>';
    }
    $('#analysisMoveList').html(html);

    var $active = $('#analysisMoveList .active-cell');
    if ($active.length) {
        var list = document.getElementById('analysisMoveList');
        list.scrollTop = $active[0].offsetTop - list.clientHeight / 2;
    }
}

function getAnnClass(ann) {
    if (ann === '\u2605') return 'ann-brilliant';
    if (ann === '\u2713') return 'ann-best';
    if (ann === '?!')     return 'ann-inaccuracy';
    if (ann === '?')      return 'ann-mistake';
    if (ann === '??')     return 'ann-blunder';
    return '';
}

// ---------- ANNOTATIONS ----------
function computeAnnotations() {
    for (var i = 1; i < analysisHistory.length; i++) {
        var eb = analysisEvals[i - 1];  // eval of position BEFORE this move
        var ea = analysisEvals[i];      // eval of position AFTER this move
        if (eb === null || ea === null) continue;

        var isWhiteMove = (i % 2 === 1);

        // Convert mate scores to large-but-finite centipawn values.
        // Use 3000 as the cap but KEEP THE SIGN so swings near mate are real.
        // If both sides are in a mating sequence, cap both equally so the
        // "drop" doesn't blow up from 9999 vs 3000.
        function capEval(v) {
            if (v >= 9000)  return 900;   // winning forced mate
            if (v <= -9000) return -900;  // losing forced mate
            return Math.max(-900, Math.min(900, v));
        }
        var ebC = capEval(eb);
        var eaC = capEval(ea);

        // evalDrop: centipawns lost by the mover. Positive = bad move.
        // White wants eval high, Black wants eval low.
        var evalDrop = isWhiteMove ? (ebC - eaC) : (eaC - ebC);

        var playedUCI  = analysisHistory[i].uci;
        var bestUCI    = analysisBestUCI[i - 1];
        var playedBest = (bestUCI && playedUCI && playedUCI === bestUCI);

        // Lichess-calibrated thresholds (centipawns):
        // Brilliant: played the engine's top move AND it wasn't the only legal move
        //            AND the position wasn't already completely winning/losing
        var legalMoveCount = (function() {
            try {
                var tmp = new Chess();
                tmp.load(analysisHistory[i-1].fen);
                return tmp.moves().length;
            } catch(e) { return 99; }
        })();
        var positionIsDecided = (Math.abs(ebC) > 600); // already won/lost

        if (playedBest && evalDrop <= 5 && legalMoveCount > 1 && !positionIsDecided) {
            analysisAnnotations[i] = '\u2605';   // Brilliant ★
        } else if (evalDrop <= 20) {
            analysisAnnotations[i] = '\u2713';   // Best / Excellent ✓
        } else if (evalDrop <= 60) {
            analysisAnnotations[i] = '?!';        // Inaccuracy
        } else if (evalDrop <= 200) {
            analysisAnnotations[i] = '?';         // Mistake
        } else {
            analysisAnnotations[i] = '??';        // Blunder
        }
    }
}

// ---------- STOCKFISH ANALYSIS ENGINE ----------
function startFullAnalysis() {
    if (analysisWorker) { analysisWorker.terminate(); }
    analysisWorker = createAnalysisWorker();

    var total      = analysisHistory.length;
    var queue      = [];
    for (var i = 0; i < total; i++) queue.push(i);

    var pendingIdx     = null;
    var lastCp         = 0;
    var uciReady       = false;   // wait for uciok before sending positions
    var pendingQueue   = [];      // positions to evaluate, populated after uciok

    $('#analysisLoadingBanner').css('display', 'flex');
    $('#analysisLoadingText').text('Initializing engine...');

    function evaluateNext() {
        if (queue.length === 0) {
            // All done
            $('#analysisLoadingBanner').hide();
            computeAnnotations();
            renderAnalysisPosition();
            return;
        }
        pendingIdx = queue.shift();
        var posNum = total - queue.length;
        $('#analysisLoadingText').text('Analyzing position ' + posNum + ' of ' + total + '...');
        lastCp = 0;
        analysisWorker.postMessage('position fen ' + analysisHistory[pendingIdx].fen);
        analysisWorker.postMessage('go depth 18 movetime 400');
    }

    analysisWorker.onmessage = function(e) {
        var line = e.data;

        // Wait for uciok before starting evaluation
        if (!uciReady) {
            if (line.indexOf('uciok') > -1) {
                uciReady = true;
                analysisWorker.postMessage('setoption name Skill Level value 20');
                analysisWorker.postMessage('isready');
            }
            return;  // ignore everything else until ready
        }

        // Wait for readyok before first position
        if (pendingIdx === null && line.indexOf('readyok') > -1) {
            evaluateNext();
            return;
        }

        // Collect score from info lines — only use deepest depth result
        if (pendingIdx !== null && line.indexOf('info') > -1 && line.indexOf('score') > -1) {
            // Only take scores at depth >= 10 to avoid shallow noise
            var depthMatch = line.match(/depth (\d+)/);
            var depth = depthMatch ? parseInt(depthMatch[1]) : 0;
            if (depth >= 8) {
                var scMatch = line.match(/score cp (-?\d+)/);
                var mtMatch = line.match(/score mate (-?\d+)/);
                // Stockfish reports from side-to-move; flip to White perspective
                var isBlackToMove = (analysisHistory[pendingIdx].fen.indexOf(' b ') > -1);
                if (scMatch) {
                    var cp = parseInt(scMatch[1]);
                    lastCp = isBlackToMove ? -cp : cp;
                } else if (mtMatch) {
                    var mt = parseInt(mtMatch[1]);
                    // mate +N means side to move mates in N: good for them
                    if (isBlackToMove) mt = -mt;
                    lastCp = mt > 0 ? 9999 : -9999;
                }
            }
        }

        // bestmove = position done
        if (pendingIdx !== null && line.indexOf('bestmove') > -1) {
            var bm = line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (bm) {
                var uci = bm[1];
                analysisBestUCI[pendingIdx] = uci;
                // Convert to SAN
                var tmpG3 = new Chess();
                tmpG3.load(analysisHistory[pendingIdx].fen);
                var mv = tmpG3.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || undefined });
                analysisBestSAN[pendingIdx] = mv ? mv.san : uci;
            }
            analysisEvals[pendingIdx] = lastCp;

            // Live update if user is watching this position
            if (pendingIdx === analysisMoveIndex) {
                renderAnalysisPosition();
            }

            pendingIdx = null;
            // Recompute annotations on each position finished so move list updates live
            computeAnnotations();
            renderAnalysisMoveList();
            evaluateNext();
        }
    };

    // Kick off UCI handshake
    analysisWorker.postMessage('uci');
}

// ---------- NAV CONTROLS ----------
$('#analyzeNavBtn').on('click', openAnalysis);
$('#backToPlayBtn').on('click', closeAnalysis);

$('#anaFirstBtn').on('click', function() { analysisMoveIndex = 0; renderAnalysisPosition(); });
$('#anaPrevBtn').on('click',  function() { if (analysisMoveIndex > 0) { analysisMoveIndex--; renderAnalysisPosition(); } });
$('#anaNextBtn').on('click',  function() { if (analysisMoveIndex < analysisHistory.length - 1) { analysisMoveIndex++; renderAnalysisPosition(); } });
$('#anaLastBtn').on('click',  function() { analysisMoveIndex = analysisHistory.length - 1; renderAnalysisPosition(); });

$(document).on('click', '.ana-move-cell[data-idx]', function() {
    var idx = parseInt($(this).data('idx'));
    if (!isNaN(idx)) { analysisMoveIndex = idx; renderAnalysisPosition(); }
});

$(document).on('keydown', function(e) {
    if (!$('#analysisOverlay').hasClass('open')) return;
    if (e.key === 'ArrowLeft' && analysisMoveIndex > 0)                              { analysisMoveIndex--; renderAnalysisPosition(); }
    if (e.key === 'ArrowRight' && analysisMoveIndex < analysisHistory.length - 1)   { analysisMoveIndex++; renderAnalysisPosition(); }
    if (e.key === 'Home')  { analysisMoveIndex = 0; renderAnalysisPosition(); }
    if (e.key === 'End')   { analysisMoveIndex = analysisHistory.length - 1; renderAnalysisPosition(); }
});

$('#analysisFlipBtn').on('click', function() {
    if (analysisBoard) {
        analysisBoard.flip();
        // Redraw arrow and badge after flip
        setTimeout(function() {
            drawBestMoveArrow(analysisBestUCI[analysisMoveIndex]);
            drawAnnotationBadge(analysisAnnotations[analysisMoveIndex], analysisHistory[analysisMoveIndex].to);
        }, 100);
    }
});

// ============================================================
// HOME / PROFILE PAGE
// ============================================================

var sessionStats = {
    played: 0, wins: 0, losses: 0, draws: 0,
    streak: 0, bestStreak: 0, resignations: 0,
    checkmates: 0, analyzed: 0,
    gameHistory: []
};

var ACHIEVEMENTS = [
    { id: 'first_blood',    icon: '⚔️',  name: 'First Move',      desc: 'Play your first game',        check: function(s){ return s.played >= 1; } },
    { id: 'winner',         icon: '🏆',  name: 'Winner!',         desc: 'Win your first game',         check: function(s){ return s.wins >= 1; } },
    { id: 'hat_trick',      icon: '🎩',  name: 'Hat Trick',       desc: 'Win 3 games in a row',        check: function(s){ return s.bestStreak >= 3; } },
    { id: 'veteran',        icon: '🛡️', name: 'Veteran',    desc: 'Play 5 games',                check: function(s){ return s.played >= 5; } },
    { id: 'checkmate_king', icon: '👑',  name: 'Checkmate King',  desc: 'Win by checkmate',            check: function(s){ return s.checkmates >= 1; } },
    { id: 'comeback',       icon: '💪',  name: 'Never Give Up',   desc: 'Win after losing a game',     check: function(s){
        var hadLoss = false;
        for (var i = 0; i < s.gameHistory.length; i++) {
            if (s.gameHistory[i].result === 'loss' || s.gameHistory[i].result === 'resign') hadLoss = true;
            else if (hadLoss && s.gameHistory[i].result === 'win') return true;
        }
        return false;
    }},
    { id: 'dominator',      icon: '🔥',  name: 'Dominator',       desc: 'Win 5 games',                 check: function(s){ return s.wins >= 5; } },
    { id: 'analyst',        icon: '📊',  name: 'Analyst',         desc: 'Analyze a completed game',    check: function(s){ return s.analyzed >= 1; } },
];

function recordGameResult(result, moveCount, opponent, by) {
    sessionStats.played++;
    if (result === 'win')         { sessionStats.wins++;     sessionStats.streak++; }
    else if (result === 'loss')   { sessionStats.losses++;   sessionStats.streak = 0; }
    else if (result === 'draw')   { sessionStats.draws++;    sessionStats.streak = 0; }
    else if (result === 'resign') { sessionStats.losses++;   sessionStats.resignations++; sessionStats.streak = 0; }
    if (result === 'win' && by === 'checkmate') sessionStats.checkmates++;
    if (sessionStats.streak > sessionStats.bestStreak) sessionStats.bestStreak = sessionStats.streak;
    sessionStats.gameHistory.unshift({ result: result, by: by || '', moveCount: moveCount, opponent: opponent, timestamp: new Date() });
}

function openHome() {
    refreshHomeUI();
    $('#homeOverlay').addClass('open');
    $('#playNavBtn, #analyzeNavBtn').removeClass('active');
    $('#homeNavBtn').addClass('active');
}

function closeHome() {
    $('#homeOverlay').removeClass('open');
    $('#homeNavBtn').removeClass('active');
}

function refreshHomeUI() {
    var s = sessionStats;
    $('#statGamesPlayed').text(s.played);
    $('#statWins').text(s.wins);
    $('#statLosses').text(s.losses);
    $('#statDraws').text(s.draws);
    $('#statStreak').text(s.streak);

    var total = s.played || 1;
    var wPct = Math.round(s.wins   / total * 100);
    var dPct = Math.round(s.draws  / total * 100);
    var lPct = Math.round(s.losses / total * 100);
    $('#winRatePct').text(s.played === 0 ? '—' : wPct + '%');
    $('#wrFillWin').css('width',   s.played ? wPct + '%' : '0%');
    $('#wrFillDraw').css('width',  s.played ? dPct + '%' : '0%');
    $('#wrFillLoss').css('width',  s.played ? lPct + '%' : '0%');

    // Game history
    if (s.gameHistory.length === 0) {
        $('#homeHistoryList').html('<div class="home-history-empty">No games played yet this session.<br>Start a game to see your history here.</div>');
    } else {
        var histHtml = '';
        s.gameHistory.slice(0, 15).forEach(function(g) {
            var badge = (g.result === 'win') ? 'win' : (g.result === 'draw') ? 'draw' : (g.result === 'resign') ? 'resign' : 'loss';
            var label = badge.charAt(0).toUpperCase() + badge.slice(1);
            var byText = g.by ? ' · ' + g.by : '';
            histHtml += '<div class="history-game-row">';
            histHtml += '<span class="hg-result-badge ' + badge + '">' + label + '</span>';
            histHtml += '<div class="hg-details"><div>vs ' + g.opponent + byText + '</div>';
            histHtml += '<div class="hg-meta">' + formatTimeAgo(g.timestamp) + '</div></div>';
            histHtml += '<span class="hg-moves">' + g.moveCount + ' moves</span></div>';
        });
        $('#homeHistoryList').html(histHtml);
    }

    // Achievements
    var achHtml = '';
    ACHIEVEMENTS.forEach(function(a) {
        var unlocked = a.check(s);
        achHtml += '<div class="achievement-card ' + (unlocked ? 'unlocked' : 'locked') + '">';
        achHtml += '<div class="ach-icon">' + a.icon + '</div>';
        achHtml += '<div class="ach-info"><div class="ach-name">' + a.name + '</div>';
        achHtml += '<div class="ach-desc">' + a.desc + '</div></div>';
        if (unlocked) achHtml += '<span class="ach-unlocked-tag">✓</span>';
        achHtml += '</div>';
    });
    $('#homeAchievements').html(achHtml);
}

function formatTimeAgo(date) {
    var diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    return Math.floor(diff / 3600) + 'h ago';
}

// NAV WIRING
$('#homeNavBtn').on('click', openHome);
$('#homeNavBtnFromAnalysis').on('click', function() { closeAnalysis(); openHome(); });
$('#homeToPlayBtn').on('click', function() { closeHome(); $('#playNavBtn').addClass('active'); });
$('#homeToAnalyzeBtn').on('click', function() { closeHome(); openAnalysis(); });
$('#homePlayNowBtn').on('click', function() { closeHome(); $('#playNavBtn').addClass('active'); });

// Track analysis usage
// analyzed tracking moved into openAnalysis directly

// ============================================================
// PGN IMPORT & ANALYSIS
// ============================================================

var pgnActiveTab = 'paste';
var pgnFileContent = null;

function openPgnModal() {
    pgnFileContent = null;
    $('#pgnTextarea').val('');
    $('#pgnFilename').text('');
    $('#pgnErrorPaste').text('');
    $('#pgnErrorUpload').text('');
    $('#pgnDropzone').removeClass('dragover');
    switchPgnTab('paste');
    $('#pgnModal').addClass('open');
}

function closePgnModal() {
    $('#pgnModal').removeClass('open');
}

function switchPgnTab(tab) {
    pgnActiveTab = tab;
    $('.pgn-tab').removeClass('active');
    $('.pgn-tab[data-tab="' + tab + '"]').addClass('active');
    $('.pgn-tab-content').removeClass('active');
    $('#pgnTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).addClass('active');
}

// Tab clicks
$(document).on('click', '.pgn-tab', function() {
    switchPgnTab($(this).data('tab'));
});

// Open / close
$('#loadPgnBtn').on('click', openPgnModal);
$('#closePgnBtn, #closePgnBtn2').on('click', closePgnModal);
$('#pgnModal').on('click', function(e) {
    if ($(e.target).is('#pgnModal')) closePgnModal();
});

// File upload via click
// File input sits over the dropzone — handled via label in HTML
// Fallback JS click for non-label environments
$('#pgnDropzone').on('click', function(e) {
    if (!$(e.target).is('#pgnFileInput')) {
        $('#pgnFileInput').trigger('click');
    }
});

$('#pgnFileInput').on('change', function() {
    var file = this.files[0];
    if (file) readPgnFile(file);
});

// Drag and drop
$('#pgnDropzone').on('dragover dragenter', function(e) {
    e.preventDefault(); e.stopPropagation();
    $(this).addClass('dragover');
}).on('dragleave drop', function(e) {
    e.preventDefault(); e.stopPropagation();
    $(this).removeClass('dragover');
    if (e.type === 'drop') {
        var file = e.originalEvent.dataTransfer.files[0];
        if (file) readPgnFile(file);
    }
});

function readPgnFile(file) {
    if (!file.name.match(/\.(pgn|txt)$/i)) {
        $('#pgnErrorUpload').text('Please upload a .pgn or .txt file.');
        return;
    }
    $('#pgnErrorUpload').text('');
    var reader = new FileReader();
    reader.onload = function(e) {
        pgnFileContent = e.target.result;
        $('#pgnFilename').text('\u2713 ' + file.name + ' (' + (pgnFileContent.length) + ' chars)');
    };
    reader.readAsText(file);
}

// ── PARSE PGN ────────────────────────────────────────────────
function parsePgn(pgnText) {
    // Strip comments { ... } and variations ( ... ) recursively
    var clean = pgnText
        .replace(/\{[^}]*\}/g, '')          // remove { comments }
        .replace(/\([^)]*\)/g, '')           // remove ( variations )
        .replace(/;[^\n]*/g, '')              // remove ; end-of-line comments
        .replace(/\$\d+/g, '')               // remove NAG annotations like $1
        .replace(/\d+\.\.\.\s*/g, '')     // remove black move numbers like "3..."
        .trim();

    // Extract move text (after headers)
    var moveText = clean.replace(/\[[^\]]*\]/g, '').trim();

    // Tokenize: grab move tokens, skip move numbers and result
    var tokens = moveText.split(/\s+/).filter(function(t) {
        return t &&
            !t.match(/^\d+\.+$/) &&          // move numbers
            !t.match(/^(1-0|0-1|1\/2-1\/2|\*)$/); // results
    });

    // Replay moves through chess.js
    var tempGame = new Chess();
    var validMoves = [];
    for (var i = 0; i < tokens.length; i++) {
        var mv = tempGame.move(tokens[i], { sloppy: true });
        if (!mv) {
            return { error: 'Invalid move "' + tokens[i] + '" at move ' + Math.ceil((i+1)/2) + '.' };
        }
        validMoves.push(mv);
    }

    if (validMoves.length === 0) {
        return { error: 'No moves found in PGN.' };
    }

    // Extract headers for display
    var headers = {};
    var headerMatches = pgnText.match(/\[([A-Za-z]+)\s+"([^"]*)"\]/g) || [];
    headerMatches.forEach(function(h) {
        var m = h.match(/\[([A-Za-z]+)\s+"([^"]*)"\]/);
        if (m) headers[m[1]] = m[2];
    });

    return { moves: validMoves, headers: headers };
}

// ── LOAD PGN INTO ANALYSIS ───────────────────────────────────
$('#analyzePgnBtn').on('click', function() {
    var pgnText = '';
    var $err;

    if (pgnActiveTab === 'paste') {
        pgnText = $('#pgnTextarea').val().trim();
        $err = $('#pgnErrorPaste');
    } else {
        pgnText = pgnFileContent || '';
        $err = $('#pgnErrorUpload');
    }

    $err.text('');

    if (!pgnText) {
        $err.text(pgnActiveTab === 'paste' ? 'Please paste a PGN first.' : 'Please upload a file first.');
        return;
    }

    var result = parsePgn(pgnText);
    if (result.error) {
        $err.text(result.error);
        return;
    }

    closePgnModal();

    // Build analysisHistory from parsed PGN (same format as openAnalysis)
    analysisHistory = [];
    var tempGame = new Chess();
    analysisHistory.push({ fen: tempGame.fen(), san: null, from: null, to: null, uci: null });
    result.moves.forEach(function(m) {
        analysisHistory.push({
            fen: tempGame.fen(),
            san: m.san,
            from: m.from,
            to: m.to,
            uci: m.from + m.to + (m.promotion || '')
        });
        // NOTE: tempGame already advanced by chess.js during parse, rebuild
    });

    // Rebuild properly — chess.js moves were already applied to tempGame during parse
    // Re-parse cleanly to get FENs right
    analysisHistory = [];
    var replayGame = new Chess();
    analysisHistory.push({ fen: replayGame.fen(), san: null, from: null, to: null, uci: null });
    result.moves.forEach(function(m) {
        replayGame.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        analysisHistory.push({
            fen: replayGame.fen(),
            san: m.san,
            from: m.from,
            to: m.to,
            uci: m.from + m.to + (m.promotion || '')
        });
    });

    analysisEvals        = new Array(analysisHistory.length).fill(null);
    analysisBestUCI      = new Array(analysisHistory.length).fill(null);
    analysisBestSAN      = new Array(analysisHistory.length).fill(null);
    analysisAnnotations  = new Array(analysisHistory.length).fill('');

    // Update player labels from PGN headers
    var white = result.headers.White || 'White';
    var black = result.headers.Black || 'Black';
    var event = result.headers.Event ? result.headers.Event + ' ' : '';
    var date  = result.headers.Date  ? result.headers.Date : '';
    $('#analysisWhiteLabel').text(white);
    $('#analysisBlackLabel').text(black);
    $('#analysisStatus').text(event + date || 'PGN Game');

    // Init board if needed
    analysisPieceTheme = pieceThemeStyle;
    if (analysisBoard) { analysisBoard.destroy(); }
    analysisBoard = Chessboard('analysisBoard', {
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/' + analysisPieceTheme + '/{piece}.png',
        draggable: false,
        position: 'start'
    });
    $(window).resize(analysisBoard.resize);

    analysisMoveIndex = analysisHistory.length - 1;

    // Show perspective picker, then run
    var wLabel = result.headers.White || 'White';
    var bLabel = result.headers.Black || 'Black';
    showPerspectivePicker(wLabel, bLabel, function() {
        if (!$('#analysisOverlay').hasClass('open')) {
            $('#analysisOverlay').addClass('open');
            $('#analyzeNavBtn').addClass('active');
            if (typeof sessionStats !== 'undefined') sessionStats.analyzed = (sessionStats.analyzed || 0) + 1;
        }
        renderAnalysisPosition();
        startFullAnalysis();
    });
});

// ============================================================
// PERSPECTIVE PICKER
// ============================================================

function showPerspectivePicker(whiteLabel, blackLabel, callback) {
    // Update button labels with actual player names
    var btns = document.querySelectorAll('.perspective-btn');
    btns[0].querySelector('.persp-label').textContent = whiteLabel || 'White';
    btns[1].querySelector('.persp-label').textContent = blackLabel || 'Black';

    // Reset selection highlight
    $('.perspective-btn').removeClass('selected');

    _pendingAnalysisCallback = callback;
    $('#perspectiveModal').addClass('open');
}

$('.perspective-btn').on('click', function() {
    analysisPerspective = $(this).data('perspective');
    $('#perspectiveModal').removeClass('open');
    if (_pendingAnalysisCallback) {
        _pendingAnalysisCallback();
        _pendingAnalysisCallback = null;
    }
});

$('#cancelPerspectiveBtn').on('click', function() {
    $('#perspectiveModal').removeClass('open');
    _pendingAnalysisCallback = null;
});