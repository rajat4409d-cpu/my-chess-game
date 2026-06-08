var board = null;
var game = new Chess();
var $status = $('#gameStatus');
var pendingPromotionMove = null;

var currentSoundTheme = 'standard';
var moveSound, captureSound, checkSound, endSound;

function loadSoundTheme(theme) {
    currentSoundTheme = theme;
    var t = SOUND_THEMES[theme] || SOUND_THEMES['standard'];
    moveSound    = t.move    ? new Audio(t.move)    : null;
    captureSound = t.capture ? new Audio(t.capture) : null;
    checkSound   = t.check   ? new Audio(t.check)   : null;
    endSound     = t.end     ? new Audio(t.end)     : null;
    [moveSound, captureSound, checkSound, endSound].forEach(function(a) {
        if (a) { a.volume = 1; try { a.load(); } catch(e) {} }
    });
    try { localStorage.setItem('chess-sound-theme', theme); } catch(e) {}
}

(function() {
    var saved = 'standard';
    try { saved = localStorage.getItem('chess-sound-theme') || 'standard'; } catch(e) {}
    loadSoundTheme(saved);
})();

var timeControl = 600;
var timeWhite = timeControl;
var timeBlack = timeControl;
var timerInterval = null;
var gameStarted = false;
var aiColor = 'b';
var gameMode = 'pve';
var pieceThemeStyle = 'wikipedia';


function getPieceTheme(style) {
    return PIECE_THEME_URLS[style] || PIECE_THEME_URLS['wikipedia'];
}

function getPieceImage(style, pieceCode) {
    var url = getPieceTheme(style);
    return url.replace('{piece}', pieceCode);
}

// --- ENGINE LOGIC ---
var workerBlob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"], { type: "application/javascript" });
var engine = new Worker(window.URL.createObjectURL(workerBlob));
var engineSkill = 10;

engine.onmessage = function(event) {
    var line = event.data;
    
    if (line.indexOf('info') > -1 && line.indexOf('score') > -1) {
        var scoreMatch = line.match(/score cp (-?\d+)/);
        var mateMatch  = line.match(/score mate (-?\d+)/);
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
        if (fillPercentage < 0)   fillPercentage = 0;
        $('#evalFill').css('height', fillPercentage + '%');
    }

    if (line.indexOf('bestmove') > -1) {
        $('#aiThinkingLoader').hide();
        var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        if (match) {
            var from = match[1], to = match[2], promo = match[3] ? match[3] : 'q';
            var move = game.move({ from: from, to: to, promotion: promo });
            if (move) {
                board.move(from + '-' + to);
                setTimeout(function() {
                    board.position(game.fen(), false);
                    highlightLastMove(from, to);
                }, 220);
                playMoveSound(move);
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
        $('#aiThinkingLoader').css('display', 'inline-flex');
        $('#gameStatus').text('Stockfish is thinking...');
        var actualSkill = (engineSkill === 1) ? 0 : engineSkill;
        engine.postMessage('setoption name Skill Level value ' + actualSkill);
        engine.postMessage('position fen ' + game.fen());
        var maxTime = (engineSkill === 20) ? 2000 : (engineSkill === 10 ? 800 : 250);
        engine.postMessage('go depth ' + engineSkill + ' movetime ' + maxTime);
    }
}

// --- OPENING TRACKER LOGIC ---
function checkOpening() {
    var historyStr = game.history().join(',');
    var currentOpening = null;
    var currentKey = '';
    var openingKeys = Object.keys(openingBook).sort(function(a, b) { return b.length - a.length; });
    for (var i = 0; i < openingKeys.length; i++) {
        if (historyStr.startsWith(openingKeys[i])) {
            currentKey = openingKeys[i];
            currentOpening = openingBook[openingKeys[i]];
            break;
        }
    }
    if (currentOpening) {
        $('#openingTracker')
            .text(currentOpening.eco + ' · ' + currentOpening.name)
            .attr('data-opening-key', currentKey)
            .fadeIn(300);
    } else if (game.history().length > 12) {
        $('#openingTracker').fadeOut(300);
        $('#openingPopup').fadeOut(150);
    }
}

$(document).on('click', '#openingTracker', function(e) {
    e.stopPropagation();
    var popup = $('#openingPopup');
    if (popup.is(':visible')) { popup.fadeOut(150); return; }
    var key = $(this).attr('data-opening-key');
    var opening = key ? openingBook[key] : null;
    if (!opening) return;
    var moves = key.split(',').slice(0, 8);
    var movesStr = '';
    for (var i = 0; i < moves.length; i++) {
        if (i % 2 === 0) movesStr += (i / 2 + 1) + '. ';
        movesStr += moves[i] + ' ';
    }
    if (key.split(',').length > 8) movesStr += '…';
    popup.find('.op-name').text(opening.name);
    popup.find('.op-eco').text(opening.eco);
    popup.find('.op-desc').text(opening.desc);
    popup.find('.op-moves').text(movesStr.trim());
    popup.fadeIn(180);
});
$(document).on('click', '#openingPopup', function(e) { e.stopPropagation(); });
$(document).on('click', function() { $('#openingPopup').fadeOut(150); });

// --- CORE UI LOGIC ---
function formatTime(seconds) { var m = Math.floor(seconds/60); var s = seconds%60; return m+':'+(s<10?'0':'')+s; }

function updateHistoryUI() {
    var history = game.history(); var html = '';
    for (var i = 0; i < history.length; i += 2) {
        html += '<div class="history-row"><span class="move-num">' + ((i/2)+1) + '.</span><span class="move-w">' + history[i] + '</span><span class="move-b">' + (history[i+1] ? history[i+1] : '') + '</span></div>';
    }
    $('#moveHistory').html(html);
    var histDiv = document.getElementById('moveHistory');
    histDiv.scrollTop = histDiv.scrollHeight;
}

function updateCapturedPieces() {
    var starts = { 'w': { 'q':1,'r':2,'b':2,'n':2,'p':8 }, 'b': { 'q':1,'r':2,'b':2,'n':2,'p':8 } };
    var counts  = { 'w': { 'q':0,'r':0,'b':0,'n':0,'p':0 }, 'b': { 'q':0,'r':0,'b':0,'n':0,'p':0 } };
    var sW=0, sB=0, vals={'q':9,'r':5,'b':3,'n':3,'p':1};
    var boardState = game.board();
    for (var i=0;i<8;i++) for (var j=0;j<8;j++) if (boardState[i][j]) { counts[boardState[i][j].color][boardState[i][j].type]++; if(boardState[i][j].color==='w') sW+=vals[boardState[i][j].type]; else sB+=vals[boardState[i][j].type]; }
    var wHTML='', bHTML='', order=['q','r','b','n','p'];
    order.forEach(function(t) {
        for(var i=0;i<starts['b'][t]-counts['b'][t];i++) wHTML+='<img src="'+getPieceImage(pieceThemeStyle, 'b'+t.toUpperCase())+'">';
        for(var i=0;i<starts['w'][t]-counts['w'][t];i++) bHTML+='<img src="'+getPieceImage(pieceThemeStyle, 'w'+t.toUpperCase())+'">';
    });
    if (sW>sB) wHTML+='<span class="advantage">+'+(sW-sB)+'</span>'; else if(sB>sW) bHTML+='<span class="advantage">+'+(sB-sW)+'</span>';
    $('#capturedByWhite').html(wHTML); $('#capturedByBlack').html(bHTML);
}

// --- SOUND TOGGLE ---
var isSoundMuted = false;

function applySoundState(muted) {
    isSoundMuted = muted;
    var icon = muted ? 'ph-speaker-slash' : 'ph-speaker-high';
    var tip  = muted ? 'Unmute Sound' : 'Mute Sound';
    $('#soundToggleBtn').html('<i class="ph '+icon+'"></i>').attr('title', tip);
    $('#mobileSoundToggle').html('<i class="ph '+icon+'"></i>').attr('title', tip);
    $('#puzzleSoundBtn').html('<i class="ph '+icon+'"></i>').attr('title', tip);
    $('#analysisSoundBtn').html('<i class="ph '+icon+'"></i>').attr('title', tip);
    if (muted) { $('#soundToggleBtn, #mobileSoundToggle, #puzzleSoundBtn, #analysisSoundBtn').addClass('sound-muted'); }
    else       { $('#soundToggleBtn, #mobileSoundToggle, #puzzleSoundBtn, #analysisSoundBtn').removeClass('sound-muted'); }
    try { localStorage.setItem('chess-sound-muted', muted ? '1' : '0'); } catch(e) {}
}

$(document).on('click', '#soundToggleBtn, #mobileSoundToggle, #puzzleSoundBtn, #analysisSoundBtn', function() { applySoundState(!isSoundMuted); });

(function() {
    var saved = null;
    try { saved = localStorage.getItem('chess-sound-muted'); } catch(e) {}
    if (saved === '1') applySoundState(true);
})();

function playMoveSound(move) {
    if (isSoundMuted) return;
    function play(snd) { if (snd) { try { snd.currentTime=0; snd.play(); } catch(e) {} } }
    if (game.in_checkmate() || game.in_draw()) play(endSound);
    else if (game.in_check()) play(checkSound);
    else if (move.captured) play(captureSound);
    else play(moveSound);
}

function removeHighlights() { $('#myBoard .square-55d63').removeClass('possible-move possible-capture'); }
function highlightLastMove(from, to) { $('#myBoard .square-55d63').removeClass('highlight-move'); if(from&&to){$('#myBoard .square-'+from).addClass('highlight-move');$('#myBoard .square-'+to).addClass('highlight-move');} }

function highlightKingInCheck() {
    $('#myBoard .square-55d63').removeClass('king-in-check');
    if (!game.in_check()) return;
    var color = game.turn();
    var bd = game.board();
    for (var r=0;r<8;r++) {
        for (var c=0;c<8;c++) {
            var piece = bd[r][c];
            if (piece && piece.type==='k' && piece.color===color) {
                var file = String.fromCharCode(97+c);
                var rank = String(8-r);
                $('#myBoard .square-'+file+rank).addClass('king-in-check');
                return;
            }
        }
    }
}

function updateStatus() {
    if (game.turn() !== aiColor || gameMode !== 'pve') {
        $('#aiThinkingLoader').hide();
    }

    if (game.in_checkmate()) {
        clearInterval(timerInterval);
        var winner = game.turn()==='w' ? 'Black' : 'White';
        $status.text('Checkmate! '+winner+' wins!');
        var playerColor = aiColor==='b' ? 'w' : 'b';
        var opp = gameMode==='pvp' ? 'Player 2' : 'Stockfish ('+(engineSkill===20?'GM':engineSkill===10?'Adv':'Beg')+')';
        var playerWon = (game.turn()!==playerColor);
        if (typeof recordGameResult!=='undefined') recordGameResult(playerWon?'win':'loss', game.history().length, opp, 'checkmate');
        var moves = Math.ceil(game.history().length/2);
        if (playerWon) { showGameResultModal('win','Victory!','Checkmate! You won in '+moves+' moves.'); }
        else           { showGameResultModal('loss','Defeat!','Checkmate! Stockfish AI won in '+moves+' moves.'); }
    } else if (game.in_draw()) {
        clearInterval(timerInterval);
        $status.text("Game Over. It's a Draw!");
        var opp2 = gameMode==='pvp' ? 'Player 2' : 'Stockfish';
        if (typeof recordGameResult!=='undefined') recordGameResult('draw', game.history().length, opp2, 'draw');
        var moves2 = Math.ceil(game.history().length/2);
        showGameResultModal('draw','Draw Game','The match ended in a draw after '+moves2+' moves.');
    } else {
        $status.text((game.turn()==='w'?'White':'Black')+' to move'+(game.in_check()?' (Check!)':''));
    }
    checkOpening();
    highlightKingInCheck();
}

function onDragStart(source, piece) {
    if (game.game_over()) return false;
    if (gameMode==='pve' && game.turn()===aiColor) return false;
    if ((game.turn()==='w' && piece.search(/^b/)!==-1) || (game.turn()==='b' && piece.search(/^w/)!==-1)) return false;
    var moves = game.moves({ square: source, verbose: true });
    if (moves.length===0) return false;
    for (var i=0;i<moves.length;i++) {
        if (moves[i].flags.indexOf('c')!==-1||moves[i].flags.indexOf('e')!==-1) { $('#myBoard .square-'+moves[i].to).addClass('possible-capture'); }
        else { $('#myBoard .square-'+moves[i].to).addClass('possible-move'); }
    }
}

function onDrop(source, target) {
    removeHighlights();
    var piece = game.get(source);
    if (piece && piece.type==='p' && (target.charAt(1)==='8'||target.charAt(1)==='1')) {
        pendingPromotionMove = { source: source, target: target };
        $('.promo-piece').each(function() { $(this).attr('src', getPieceImage(pieceThemeStyle, piece.color+$(this).data('piece').toUpperCase() ) ); });
        $('#promotionMenu').css('display','flex'); return 'snapback';
    }
    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move===null) return 'snapback';
    highlightLastMove(move.from, move.to); playMoveSound(move);
    (function(sq) {
        setTimeout(function() {
            var $piece = $('#myBoard .square-'+sq+' .piece-417db');
            $piece.addClass('piece-land');
            setTimeout(function() { $piece.removeClass('piece-land'); }, 200);
        }, 50);
    })(move.to);
    if (!gameStarted) { gameStarted=true; }
    updateHistoryUI(); updateCapturedPieces(); updateStatus();
    if (gameMode==='pve') window.setTimeout(makeComputerMove, 250);
}

function onSnapEnd() { if (pendingPromotionMove===null) board.position(game.fen()); }

// ── CLICK-TO-MOVE ────────────────────────────────────────────
var isTouchDevice = (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
var clickSelected = null;

function isPlayerTurn() {
    if (game.game_over()) return false;
    if (gameMode==='pvp') return true;
    return game.turn()!==aiColor;
}

function highlightSelected(square) {
    $('#myBoard .square-55d63').removeClass('selected-square');
    if (square) $('#myBoard .square-'+square).addClass('selected-square');
}

function showClickMoves(square) {
    removeHighlights();
    var moves = game.moves({ square: square, verbose: true });
    for (var i=0;i<moves.length;i++) {
        if (moves[i].flags.indexOf('c')!==-1||moves[i].flags.indexOf('e')!==-1) { $('#myBoard .square-'+moves[i].to).addClass('possible-capture'); }
        else { $('#myBoard .square-'+moves[i].to).addClass('possible-move'); }
    }
    return moves.length>0;
}

function executeClickMove(from, to) {
    var piece = game.get(from);
    if (piece && piece.type==='p' && (to.charAt(1)==='8'||to.charAt(1)==='1')) {
        pendingPromotionMove = { source: from, target: to };
        $('.promo-piece').each(function() { $(this).attr('src', getPieceImage(pieceThemeStyle, piece.color+$(this).data('piece').toUpperCase() ) ); });
        $('#promotionMenu').css('display','flex');
        return;
    }
    var move = game.move({ from: from, to: to, promotion: 'q' });
    if (!move) return;
    board.position(game.fen());
    highlightLastMove(move.from, move.to);
    playMoveSound(move);
    if (!gameStarted) { gameStarted=true; }
    updateHistoryUI(); updateCapturedPieces(); updateStatus();
    if (gameMode==='pve') window.setTimeout(makeComputerMove, 250);
}


// ── TAP-TO-MOVE: capture phase, fires before chessboard.js ────
var _touchStartX=0, _touchStartY=0, _touchMoved=false;
document.addEventListener('touchstart', function(e) {
    var el = document.getElementById('myBoard');
    if (el && el.contains(e.target)) {
        _touchStartX = e.touches[0].clientX;
        _touchStartY = e.touches[0].clientY;
        _touchMoved  = false;
    }
}, { passive: true, capture: true });
document.addEventListener('touchmove', function(e) {
    if (Math.abs(e.touches[0].clientX - _touchStartX) > 8 ||
        Math.abs(e.touches[0].clientY - _touchStartY) > 8) _touchMoved = true;
}, { passive: true, capture: true });
document.addEventListener('touchend', function(e) {
    var el = document.getElementById('myBoard');
    if (!el || !el.contains(e.target)) return;
    if (_touchMoved) return;
    e.stopPropagation();
    e.preventDefault();
    handleBoardInteraction(e.changedTouches[0].target);
}, { passive: false, capture: true });
$(document).on('click', '#myBoard', function(e) {
    if (isTouchDevice) return;
    handleBoardInteraction(e.target);
});

function handleBoardInteraction(target) {
    if (!isPlayerTurn()) return;
    if ($('#promotionMenu').css('display')!=='none') return;
    var $sq = $(target).closest('.square-55d63');
    if (!$sq.length) return;
    var cls = $sq.attr('class') || '';
    var m = cls.match(/square-([a-h][1-8])/);
    if (!m) return;
    var square = m[1];
    var piece = game.get(square);
    if (!clickSelected) {
        if (!piece) return;
        if (piece.color!==game.turn()) return;
        if (gameMode==='pve' && piece.color===aiColor) return;
        var hasMoves = showClickMoves(square);
        if (!hasMoves) return;
        clickSelected=square; highlightSelected(square); return;
    }
    if (square===clickSelected) { clickSelected=null; highlightSelected(null); removeHighlights(); return; }
    if (piece && piece.color===game.turn() && !(gameMode==='pve'&&piece.color===aiColor)) {
        clickSelected=null; highlightSelected(null); removeHighlights();
        var hasMoves2 = showClickMoves(square);
        if (hasMoves2) { clickSelected=square; highlightSelected(square); }
        return;
    }
    var legalMoves = game.moves({ square: clickSelected, verbose: true });
    var isLegal = legalMoves.some(function(mv) { return mv.to===square; });
    if (!isLegal) { clickSelected=null; highlightSelected(null); removeHighlights(); return; }
    var from = clickSelected;
    clickSelected=null; highlightSelected(null); removeHighlights();
    executeClickMove(from, square);
}

document.getElementById('myBoard').addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });

var _origOnDragStart = onDragStart;
onDragStart = function(source, piece) {
    clickSelected=null; highlightSelected(null);
    return _origOnDragStart(source, piece);
};

$('.promo-piece').on('click', function() {
    $('#promotionMenu').css('display','none');
    if (pendingPromotionMove) {
        var move = game.move({ from: pendingPromotionMove.source, to: pendingPromotionMove.target, promotion: $(this).data('piece') });
        pendingPromotionMove=null; board.position(game.fen()); highlightLastMove(move.from,move.to); playMoveSound(move);
        if (!gameStarted) { gameStarted=true; }
        updateHistoryUI(); updateCapturedPieces(); updateStatus();
        if (gameMode==='pve') window.setTimeout(makeComputerMove, 250);
    }
});

$('#cancelPromoBtn').on('click', function() { $('#promotionMenu').css('display','none'); pendingPromotionMove=null; });

// --- BUTTONS & SETTINGS ---
// Helper: sync all settings-modal dropdowns to the current in-memory values
// so the modal always opens reflecting the user's actual settings.
function syncSettingsModal() {
    if (typeof gameMode !== 'undefined')        $('#modeSelect').val(gameMode);
    if (typeof timeControl !== 'undefined')     $('#timeSelect').val(String(timeControl));
    if (typeof engineSkill !== 'undefined')     $('#difficultySelect').val(String(engineSkill));
    if (typeof pieceThemeStyle !== 'undefined') $('#pieceSelect').val(pieceThemeStyle);
    if (typeof currentSoundTheme !== 'undefined') $('#soundThemeSelect').val(currentSoundTheme);
    // Detect the active board-theme class so the Board Theme dropdown is correct
    var themeClasses = ['classic','green','blue','monochrome','coral','purple','wood','ocean','tournament','walnut','maple','marble','icysea','slate','olive','sandcastle','bismuth','rosewood','charcoal'];
    for (var i=0; i<themeClasses.length; i++) {
        if ($('#myBoard').hasClass('theme-'+themeClasses[i])) {
            $('#themeSelect').val(themeClasses[i]); break;
        }
    }
}

$(document).on('click', '#puzzleSettingsBtn, #analysisSettingsBtn', function() {
    syncSettingsModal();
    $('#settingsModal').css('display','flex');
});
$('#settingsBtn').on('click', function() {
    syncSettingsModal();
    $('#settingsModal').css('display','flex');
});
$('#closeSettingsBtn').on('click', function() { $('#settingsModal').css('display','none'); });
$('#flipBoardBtn').on('click', function() { board.flip(); });

$('#saveSettingsBtn').on('click', function() {
    gameMode = $('#modeSelect').val() || 'pve';
    timeControl = parseInt($('#timeSelect').val());
    engineSkill = parseInt($('#difficultySelect').val());
    pieceThemeStyle = $('#pieceSelect').val();
    loadSoundTheme($('#soundThemeSelect').val());

    // Apply board theme to ALL boards (play, puzzle, analyze)
    var themeClass = 'theme-' + $('#themeSelect').val();
    var themeReset = 'theme-classic theme-green theme-blue theme-monochrome theme-coral theme-purple theme-wood theme-ocean theme-tournament theme-walnut theme-maple theme-marble theme-icysea theme-slate theme-olive theme-sandcastle theme-bismuth theme-rosewood theme-charcoal';
    $('#myBoard, #puzzleBoard, #analysisBoard').removeClass(themeReset).addClass(themeClass);

    var newPieceURL = getPieceTheme(pieceThemeStyle);

    // Detect which overlay is currently active so we know what to restart
    var puzzleOpen = $('#puzzleOverlay').hasClass('open');
    var analysisOpen = $('#analysisOverlay').hasClass('open');

    // --- Rebuild the main play board (always — it's the underlying screen) ---
    config.pieceTheme = newPieceURL;
    board = Chessboard('myBoard', config);
    $(window).resize(board.resize);

    // --- Rebuild the PUZZLE board if the puzzle overlay is open ---
    if (puzzleOpen && typeof puzzleBoard !== 'undefined') {
        if (puzzleBoard) { puzzleBoard.destroy(); }
        puzzleBoard = Chessboard('puzzleBoard', {
            pieceTheme: newPieceURL,
            draggable: true,
            position: 'start',
            onDragStart: onPuzzleDragStart,
            onDrop: onPuzzleDrop,
            onSnapEnd: onPuzzleSnapEnd
        });
        $(window).resize(puzzleBoard.resize);
        // Re-apply the theme class to the freshly created board
        $('#puzzleBoard').removeClass(themeReset).addClass(themeClass);
        // Restore the current puzzle position (if any) instead of starting fresh
        if (typeof currentPuzzle !== 'undefined' && currentPuzzle) {
            puzzleBoard.orientation(puzzlePlayerColor === 'w' ? 'white' : 'black');
            puzzleBoard.position(puzzleGame.fen(), false);
        } else if (typeof loadNewPuzzle === 'function') {
            loadNewPuzzle();
        }
    }

    // --- Rebuild the ANALYSIS board if the analysis overlay is open ---
    if (analysisOpen && typeof analysisBoard !== 'undefined') {
        analysisPieceTheme = pieceThemeStyle;
        if (analysisBoard) { analysisBoard.destroy(); }
        analysisBoard = Chessboard('analysisBoard', {
            pieceTheme: newPieceURL,
            draggable: false,
            position: 'start'
        });
        $(window).resize(analysisBoard.resize);
        // Re-apply the theme class to the freshly created board
        $('#analysisBoard').removeClass(themeReset).addClass(themeClass);
        // Restore current analysis position
        if (typeof renderAnalysisPosition === 'function' &&
            typeof analysisHistory !== 'undefined' && analysisHistory && analysisHistory.length) {
            renderAnalysisPosition();
        }
    }

    // Only restart the play game when we're actually on the play page —
    // restarting while the user is in puzzles/analysis would needlessly clear
    // the hidden game and surprise the user when they return to it.
    if (!puzzleOpen && !analysisOpen) {
        restartGame();
    }

    $('#settingsModal').css('display','none');
});

$('#undoBtn').on('click', function() {
    if (game.history().length===0) return;
    game.undo();
    if (gameMode==='pve' && game.turn()===aiColor) game.undo();
    board.position(game.fen()); highlightLastMove(null,null); updateHistoryUI(); updateCapturedPieces(); updateStatus();
});

$('#resignBtn').on('click', function() {
    if (game.game_over() || !gameStarted) return;
    clearInterval(timerInterval); gameStarted=false;
    $status.text((game.turn()==='w'?'White':'Black')+' Resigned. '+(game.turn()==='w'?'Black':'White')+' wins!');
    if (!isSoundMuted && endSound) { try { endSound.currentTime=0; endSound.play(); } catch(e) {} }
    var opp = gameMode==='pvp' ? 'Player 2' : 'Stockfish';
    if (typeof recordGameResult!=='undefined') recordGameResult('resign', game.history().length, opp, 'resignation');
    var moves = Math.ceil(game.history().length/2);
    showGameResultModal('loss','Defeat','You resigned after '+moves+' moves.');
});

$('#drawBtn').on('click', function() {
    if (game.game_over() || !gameStarted) return;
    clearInterval(timerInterval); gameStarted=false;
    $status.text('Draw agreed.');
    if (!isSoundMuted && endSound) { try { endSound.currentTime=0; endSound.play(); } catch(e) {} }
    var opp = gameMode==='pvp' ? 'Player 2' : 'Stockfish';
    if (typeof recordGameResult!=='undefined') recordGameResult('draw', game.history().length, opp, 'agreement');
    var moves = Math.ceil(game.history().length/2);
    showGameResultModal('draw','Draw Agreed','Draw agreed after '+moves+' moves.');
});

$('#resetBtn').on('click', restartGame);

// ── SHARE BUTTON DROPDOWN ─────────────────────────────────────
$('#shareBtn').on('click', function(e) {
    e.stopPropagation();
    $('#shareDropdown').toggleClass('open');
});

$(document).on('click', function(e) {
    if (!$(e.target).closest('#shareBtnWrapper').length) {
        $('#shareDropdown').removeClass('open');
    }
});

$('#downloadPgnBtn').on('click', function() {
    $('#shareDropdown').removeClass('open');
    if (game.history().length===0) return;
    var pgnData = game.pgn();
    var blob = new Blob([pgnData], { type: 'text/plain' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'ChessEngine_Match.pgn';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); window.URL.revokeObjectURL(url);
});

$('#copyPgnBtn').on('click', function() {
    $('#shareDropdown').removeClass('open');
    if (game.history().length===0) return;
    var pgnData = game.pgn();
    navigator.clipboard.writeText(pgnData).then(function() {
        var $btn = $('#copyPgnBtn');
        var originalHTML = $btn.html();
        $btn.html('<i class="ph ph-check"></i> Copied!').addClass('copy-success');
        setTimeout(function() { $btn.html(originalHTML).removeClass('copy-success'); }, 1800);
    }).catch(function(err) { console.error('Could not copy PGN: ', err); });
});

function restartGame() {
    game.reset(); board.start(); clearInterval(timerInterval);
    timeWhite=timeControl; timeBlack=timeControl; gameStarted=false;
    aiColor = (board.orientation()==='white') ? 'b' : 'w';

    $('#aiThinkingLoader').hide();
    engine.postMessage('ucinewgame');
    engine.postMessage('setoption name Clear Hash');

    if (gameMode==='pvp') {
        var p2color = aiColor==='w'?'White':'Black';
        var p1color = aiColor==='w'?'Black':'White';
        $('#opponentLabelText').text('Player 2 ('+p2color+')');
        $('#playerLabelText').text('You ('+p1color+')');
        $('.opponent-label .label-avatar').text('P2');
        $('.player-label .label-avatar').text('P1');
    } else {
        var diffText = (engineSkill===20)?'Grandmaster':(engineSkill===10?'Advanced':'Beginner');
        $('#opponentLabelText').text('Stockfish AI ('+diffText+')');
        $('#playerLabelText').text('You ('+(aiColor==='w'?'Black':'White')+')');
        $('.opponent-label .label-avatar').text('AI');
        $('.player-label .label-avatar').text('YOU');
    }

    $('#moveHistory').html(''); updateCapturedPieces(); highlightLastMove(null,null);
    $('#myBoard .square-55d63').removeClass('king-in-check');
    updateStatus(); $('#openingTracker').hide(); $('#evalFill').css('height','50%');

    if (gameMode==='pve' && aiColor==='w') window.setTimeout(makeComputerMove, 250);

    // Re-apply dynamic sizing after restart
    setTimeout(function() { if (typeof resizeBoard === 'function') resizeBoard(); }, 50);
}

var config = {
    pieceTheme: getPieceTheme(pieceThemeStyle),
    draggable: !isTouchDevice, position: 'start',
    onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
    moveSpeed: 200, snapbackSpeed: 100, snapSpeed: 80,
};

board = Chessboard('myBoard', config);
restartGame();

// ── Dynamic board sizing — fill available height ──────────────
function resizeBoard() {
    if (window.innerWidth <= 900) {
        ['myBoard','analysisBoard','puzzleBoard'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.style.width=''; el.style.maxWidth=''; el.style.height=''; }
        });
        ['boardContainer','analysisBoardContainer','puzzleBoardContainer'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.style.width=''; el.style.maxWidth=''; }
        });
        document.querySelectorAll('.board-player-label').forEach(function(el) {
            el.style.width=''; el.style.maxWidth='';
        });
        setTimeout(function() {
            if (typeof board !== 'undefined' && board) board.resize();
            if (typeof analysisBoard !== 'undefined' && analysisBoard) analysisBoard.resize();
            if (typeof puzzleBoard !== 'undefined' && puzzleBoard) puzzleBoard.resize();
        }, 50);
        return;
    }
    var $ba = $('.board-area');
    if (!$ba.length) return;
    var aH = $ba.height(), aW = $ba.width();
    var chromeH = 33 + 34*2 + 24;
    var sideW = 14 + 10 + 36 + 10;
    var size = Math.max(280, Math.min(aH - chromeH, aW - sideW - 40));
    $('#myBoard').css('width', size+'px');
    $('#boardContainer').css('width', (size+sideW)+'px');
    $('.board-player-label').css('width', (size+sideW)+'px');
    if (board) board.resize();
    if (typeof analysisBoard !== 'undefined' && analysisBoard) analysisBoard.resize();
    if (typeof puzzleBoard !== 'undefined' && puzzleBoard) puzzleBoard.resize();
}

$(window).resize(resizeBoard);
// Trigger after paint on load
setTimeout(resizeBoard, 50);
setTimeout(resizeBoard, 300); // second pass after fonts/images settle

// ============================================================
// HOME / PROFILE PAGE
// ============================================================
var sessionStats = {
    played:0, wins:0, losses:0, draws:0,
    streak:0, bestStreak:0, resignations:0,
    checkmates:0, analyzed:0, gameHistory:[]
};


function recordGameResult(result, moveCount, opponent, by) {
    sessionStats.played++;
    if (result==='win')       { sessionStats.wins++;     sessionStats.streak++; }
    else if (result==='loss') { sessionStats.losses++;   sessionStats.streak=0; }
    else if (result==='draw') { sessionStats.draws++;    sessionStats.streak=0; }
    else if (result==='resign'){ sessionStats.losses++;  sessionStats.resignations++; sessionStats.streak=0; }
    if (result==='win'&&by==='checkmate') sessionStats.checkmates++;
    if (sessionStats.streak>sessionStats.bestStreak) sessionStats.bestStreak=sessionStats.streak;
    sessionStats.gameHistory.unshift({ result:result, by:by||'', moveCount:moveCount, opponent:opponent, timestamp:new Date() });
}

function openHome() {
    refreshHomeUI(); $('#homeOverlay').addClass('open');
    $('#playNavBtn, #analyzeNavBtn, #puzzleNavBtn').removeClass('active');
    $('#homeNavBtn').addClass('active');
}
function closeHome() { $('#homeOverlay').removeClass('open'); $('#homeNavBtn').removeClass('active'); }

function refreshHomeUI() {
    var s=sessionStats;
    $('#statGamesPlayed').text(s.played); $('#statWins').text(s.wins); $('#statLosses').text(s.losses);
    $('#statDraws').text(s.draws); $('#statStreak').text(s.streak);
    var total=s.played||1;
    var wPct=Math.round(s.wins/total*100), dPct=Math.round(s.draws/total*100), lPct=Math.round(s.losses/total*100);
    $('#winRatePct').text(s.played===0?'—':wPct+'%');
    $('#wrFillWin').css('width',s.played?wPct+'%':'0%');
    $('#wrFillDraw').css('width',s.played?dPct+'%':'0%');
    $('#wrFillLoss').css('width',s.played?lPct+'%':'0%');
    if (s.gameHistory.length===0) {
        $('#homeHistoryList').html('<div class="home-history-empty">No games played yet this session.<br>Start a game to see your history here.</div>');
    } else {
        var histHtml='';
        s.gameHistory.slice(0,15).forEach(function(g) {
            var badge=(g.result==='win')?'win':(g.result==='draw')?'draw':(g.result==='resign')?'resign':'loss';
            var label=badge.charAt(0).toUpperCase()+badge.slice(1);
            var byText=g.by?' · '+g.by:'';
            histHtml+='<div class="history-game-row"><span class="hg-result-badge '+badge+'">'+label+'</span><div class="hg-details"><div>vs '+g.opponent+byText+'</div><div class="hg-meta">'+formatTimeAgo(g.timestamp)+'</div></div><span class="hg-moves">'+g.moveCount+' moves</span></div>';
        });
        $('#homeHistoryList').html(histHtml);
    }
    var achHtml='';
    ACHIEVEMENTS.forEach(function(a) {
        var unlocked=a.check(s);
        achHtml+='<div class="achievement-card '+(unlocked?'unlocked':'locked')+'"><div class="ach-icon">'+a.icon+'</div><div class="ach-info"><div class="ach-name">'+a.name+'</div><div class="ach-desc">'+a.desc+'</div></div>'+(unlocked?'<span class="ach-unlocked-tag">✓</span>':'')+'</div>';
    });
    $('#homeAchievements').html(achHtml);
}

function formatTimeAgo(date) {
    var diff=Math.floor((Date.now()-date.getTime())/1000);
    if (diff<60)   return 'just now';
    if (diff<3600) return Math.floor(diff/60)+'m ago';
    return Math.floor(diff/3600)+'h ago';
}

$('#homeNavBtn').on('click', openHome);
$('#homeNavBtnFromAnalysis').on('click', function() { closeAnalysis(); openHome(); });
$('#homeToPlayBtn').on('click', function() { closeHome(); $('#playNavBtn').addClass('active'); });
$('#homeToAnalyzeBtn').on('click', function() { closeHome(); openAnalysis(); });
$('#homePlayNowBtn').on('click', function() { closeHome(); $('#playNavBtn').addClass('active'); });

// ============================================================
// MOBILE / RESPONSIVE NAVIGATION
// ============================================================
$('#hamburgerBtn').on('click', function() { $('#mobileNav').addClass('open'); $('#mobileNavBackdrop').addClass('open'); });
function closeMobileNav() { $('#mobileNav').removeClass('open'); $('#mobileNavBackdrop').removeClass('open'); }
$('#mobileNavClose').on('click', closeMobileNav);
$('#mobileNavBackdrop').on('click', closeMobileNav);

$(document).on('click', '.mobile-nav-item', function() {
    var target=$(this).data('target');
    $('.mobile-nav-item').removeClass('active'); $(this).addClass('active');
    closeMobileNav(); closeHome(); closePuzzles(); closeAnalysis();
    switch(target) {
        case 'home':    openHome(); break;
        case 'play':    $('#playNavBtn').addClass('active'); break;
        case 'puzzles': openPuzzles(); break;
        case 'analyze': openAnalysis(); break;
    }
});

$('#showPanelBtn').on('click', function() { $('#rightPanel').addClass('open'); });
$('#closePanelBtn').on('click', function() { $('#rightPanel').removeClass('open'); });

function syncMobileNavState(active) {
    $('.mobile-nav-item').removeClass('active');
    $('.mobile-nav-item[data-target="'+active+'"]').addClass('active');
}

var _origOpenHome=openHome;
openHome=function(){_origOpenHome();syncMobileNavState('home');};
var _origOpenPuzzles=openPuzzles;
openPuzzles=function(){_origOpenPuzzles();syncMobileNavState('puzzles');};
var _origOpenAnalysis=openAnalysis;
openAnalysis=function(){_origOpenAnalysis();syncMobileNavState('analyze');};
var _origCloseHome=closeHome;
closeHome=function(){_origCloseHome();syncMobileNavState('play');};
var _origClosePuzzles=closePuzzles;
closePuzzles=function(){_origClosePuzzles();syncMobileNavState('play');};
var _origCloseAnalysis=closeAnalysis;
closeAnalysis=function(){_origCloseAnalysis();syncMobileNavState('play');};

$(window).on('orientationchange', function() {
    setTimeout(function() { if(board)board.resize(); if(puzzleBoard)puzzleBoard.resize(); if(analysisBoard)analysisBoard.resize(); }, 300);
});

$(document).on('click touchstart', function(e) {
    if ($(window).width()>900) return;
    var $panel=$('#rightPanel');
    if ($panel.hasClass('open')&&!$panel.is(e.target)&&$panel.has(e.target).length===0&&!$(e.target).is('#showPanelBtn')) { $panel.removeClass('open'); }
});

// ============================================================
// DARK / LIGHT THEME TOGGLE  (dark is DEFAULT)
// ============================================================
var isDarkMode = true;  // default dark

function applyTheme(dark) {
    isDarkMode = dark;
    if (dark) {
        $('body').removeClass('light');
        $('.theme-toggle-btn').html('<i class="ph ph-sun"></i>');
    } else {
        $('body').addClass('light');
        $('.theme-toggle-btn').html('<i class="ph ph-moon"></i>');
    }
    try { localStorage.setItem('chess-dark-mode', dark ? '1' : '0'); } catch(e) {}
}

(function() {
    var saved = null;
    try { saved = localStorage.getItem('chess-dark-mode'); } catch(e) {}
    if (saved === '0') {
        applyTheme(false);   // user chose light
    } else if (saved === '1' || saved === null) {
        applyTheme(true);    // default = dark
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }
})();

$(document).on('click', '.theme-toggle-btn', function() { applyTheme(!isDarkMode); });

if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        var saved=null; try{saved=localStorage.getItem('chess-dark-mode');}catch(err){}
        if (saved===null) { applyTheme(e.matches); }
    });
}

// --- GAME RESULT MODAL ---
function showGameResultModal(outcome, title, detail) {
    $('#resultTitle').text(title); $('#resultDetail').text(detail);
    $('#resultIcon').removeClass('win loss draw').addClass(outcome);
    var iconHTML='';
    if (outcome==='win') { iconHTML='<i class="ph ph-trophy"></i>'; confetti({particleCount:150,spread:80,origin:{y:0.6}}); }
    else if (outcome==='loss') { iconHTML='<i class="ph ph-skull"></i>'; }
    else { iconHTML='<i class="ph ph-handshake"></i>'; }
    $('#resultIcon').html(iconHTML);
    $('#resultModal').addClass('open');
}

$('#resultAnalyzeBtn').on('click', function() { $('#resultModal').removeClass('open'); openAnalysis(); });
$('#resultRestartBtn').on('click', function() { $('#resultModal').removeClass('open'); restartGame(); });
$('#resultCloseBtn').on('click', function() { $('#resultModal').removeClass('open'); });