var board = null;
var game = new Chess();
var $status = $('#gameStatus');
var pendingPromotionMove = null;
// ── SOUND THEMES ─────────────────────────────────────────────
var SOUND_THEMES = {
    'standard': {
        label: 'Standard (Lichess)',
        move:    'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.ogg',
        capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Capture.ogg',
        check:   'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.ogg',
        end:     'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
    },
    'piano': {
        label: 'Piano',
        move:    'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/piano/Move.ogg',
        capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/piano/Capture.ogg',
        check:   'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/piano/Check.ogg',
        end:     'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
    },
    'nes': {
        label: 'NES (8-bit)',
        move:    'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/nes/Move.ogg',
        capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/nes/Capture.ogg',
        check:   'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/nes/Check.ogg',
        end:     'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
    },
    'futuristic': {
        label: 'Futuristic',
        move:    'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/futuristic/Move.ogg',
        capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/futuristic/Capture.ogg',
        check:   'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/futuristic/Check.ogg',
        end:     'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
    },
    'silent': {
        label: 'Silent',
        move: null, capture: null, check: null, end: null,
    }
};

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
    try {
        var unified = JSON.parse(localStorage.getItem('chessengine-settings-v1') || 'null');
        if (unified && unified.soundTheme) saved = unified.soundTheme;
        else saved = localStorage.getItem('chess-sound-theme') || 'standard';
    } catch(e) {}
    loadSoundTheme(saved);
})();

// ── RESTORE ALL PERSISTED SETTINGS ───────────────────────────
var _savedSettings = (function() {
    try { return JSON.parse(localStorage.getItem('chessengine-settings-v1') || 'null') || {}; }
    catch(e) { return {}; }
})();

var timeControl     = _savedSettings.timeControl || 600;
var timeWhite = timeControl;
var timeBlack = timeControl;
var timerInterval = null;
var gameStarted = false;
var aiColor = 'b';
var gameMode        = _savedSettings.gameMode    || 'pve';
var pieceThemeStyle = _savedSettings.pieceTheme  || 'wikipedia';

// --- ENGINE LOGIC ---
var workerBlob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"], { type: "application/javascript" });
var engine = new Worker(window.URL.createObjectURL(workerBlob));
var engineSkill = _savedSettings.engineSkill || 10;

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
var openingBook = {
    "e4,e5,Nf3,Nc6,Bc4":          { name: "Italian Game",            eco: "C50", desc: "White targets f7 with the bishop on c4. One of the oldest openings, leading to rich tactical play." },
    "e4,e5,Nf3,Nc6,Bc4,Bc5":      { name: "Giuoco Piano",            eco: "C54", desc: "The 'Quiet Game'. Both sides develop naturally before the tension breaks in the centre." },
    "e4,e5,Nf3,Nc6,Bc4,Nf6":      { name: "Two Knights Defense",     eco: "C55", desc: "Black immediately counter-attacks with Nf6, inviting sharp tactical complications." },
    "e4,e5,Nf3,Nc6,Bb5":          { name: "Ruy Lopez",               eco: "C60", desc: "One of the most popular openings. White pressures the knight that defends e5, seeking long-term positional advantage." },
    "e4,e5,Nf3,Nc6,Bb5,a6":       { name: "Ruy Lopez (Morphy)",      eco: "C65", desc: "The Morphy Defense. Black chases the bishop immediately, the most popular response to the Ruy Lopez." },
    "e4,e5,Nf3,Nf6":              { name: "Petrov's Defense",         eco: "C42", desc: "The Russian Defense. Black mirrors White's knight move, leading to a solid but passive structure." },
    "e4,e5,f4":                   { name: "King's Gambit",            eco: "C30", desc: "An aggressive romantic-era gambit. White sacrifices a pawn for rapid development and a strong centre." },
    "e4,e5,Nc3":                  { name: "Vienna Game",              eco: "C25", desc: "A flexible alternative to 2.Nf3. White supports a future f4 advance and keeps options open." },
    "e4,c5":                      { name: "Sicilian Defense",         eco: "B20", desc: "The most popular response to 1.e4. Black fights for the centre asymmetrically, leading to unbalanced, fighting positions." },
    "e4,c5,Nf3,d6,d4,cxd4,Nxd4,Nf6,Nc3,g6": { name: "Sicilian Dragon", eco: "B70", desc: "One of the sharpest openings. Black fianchettoes the bishop on g7 while both sides launch ferocious attacks." },
    "e4,c5,Nf3,e6,d4,cxd4,Nxd4,Nc6": { name: "Sicilian Taimanov", eco: "B46", desc: "A flexible Sicilian where Black keeps options open for the bishop before committing it." },
    "e4,e6":                      { name: "French Defense",           eco: "C00", desc: "A solid, strategic defense. Black accepts a cramped position in exchange for a solid pawn structure." },
    "e4,c6":                      { name: "Caro-Kann Defense",        eco: "B10", desc: "A solid alternative to the Sicilian. Black plays c6 to support d5, aiming for a sound pawn structure." },
    "e4,d5":                      { name: "Scandinavian Defense",     eco: "B01", desc: "Black immediately challenges the centre with d5. After exd5, Black recaptures or plays Nf6." },
    "e4,g6":                      { name: "Modern Defense",           eco: "B06", desc: "A hypermodern approach. Black allows White to build a broad centre and then undermines it." },
    "e4,d6":                      { name: "Pirc Defense",             eco: "B07", desc: "Similar to the Modern. Black develops flexibly and counterattacks White's centre later." },
    "d4,d5,c4":                   { name: "Queen's Gambit",           eco: "D06", desc: "One of the oldest and most respected openings. White offers a pawn to gain centre control." },
    "d4,d5,c4,e6":                { name: "Queen's Gambit Declined",  eco: "D30", desc: "Black declines the gambit and stakes out a solid position in the centre." },
    "d4,d5,c4,dxc4":              { name: "Queen's Gambit Accepted",  eco: "D20", desc: "Black accepts the pawn, allowing White a strong centre. Black aims to equalise with timely pawn breaks." },
    "d4,d5,c4,c6":                { name: "Slav Defense",             eco: "D10", desc: "Black supports d5 with c6, keeping the c8 bishop's diagonal open. Very solid and popular." },
    "d4,d5,c4,Bf5":               { name: "Baltic Defense",           eco: "D02", desc: "An unusual but tricky sideline. Black develops the bishop before it gets locked in." },
    "d4,Nf6,c4,g6":               { name: "King's Indian Defense",    eco: "E60", desc: "A dynamic and aggressive defense. Black allows White a large centre and then counterattacks fiercely." },
    "d4,Nf6,c4,e6,Nc3,Bb4":       { name: "Nimzo-Indian Defense",    eco: "E20", desc: "Black pins White's knight and fights for central control. One of the most respected defenses." },
    "d4,Nf6,c4,b6":               { name: "Queen's Indian Defense",   eco: "E12", desc: "Black fianchettoes the queen's bishop to control the long diagonal and fight for e4." },
    "d4,Nf6,c4,c5,d5":            { name: "Benoni Defense",           eco: "A60", desc: "Black accepts a positional weakness for dynamic counterplay and active piece play on the kingside." },
    "d4,f5":                      { name: "Dutch Defense",            eco: "A80", desc: "Black plays f5 to control e4 and build an aggressive kingside setup." },
    "Nf3,d5,d4":                  { name: "London System",            eco: "D02", desc: "A solid, low-theory system for White. The bishop develops to f4, creating a sturdy setup." },
    "e4,e5,Nf3,Nc6,d4":           { name: "Scotch Game",              eco: "C44", desc: "White opens the centre immediately on move 3. Leads to open, dynamic positions." },
    "e4,e5,Nf3,Nc6,d4,exd4,Nxd4,Nf6,Nxc6": { name: "Scotch Four Knights", eco: "C47", desc: "A branch of the Scotch leading to roughly symmetrical but tactically rich positions." }
};

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
        for(var i=0;i<starts['b'][t]-counts['b'][t];i++) wHTML+='<img src="https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/b'+t.toUpperCase()+'.png">';
        for(var i=0;i<starts['w'][t]-counts['w'][t];i++) bHTML+='<img src="https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/w'+t.toUpperCase()+'.png">';
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
        $('.promo-piece').each(function() { $(this).attr('src','https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/'+piece.color+$(this).data('piece').toUpperCase()+'.png'); });
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
        $('.promo-piece').each(function() { $(this).attr('src','https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/'+piece.color+$(this).data('piece').toUpperCase()+'.png'); });
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

var _touchMoved = false;
document.getElementById('myBoard').addEventListener('touchstart', function(e) { _touchMoved=false; }, { passive: true });
document.getElementById('myBoard').addEventListener('touchmove',  function(e) { _touchMoved=true;  }, { passive: true });
document.getElementById('myBoard').addEventListener('touchend',   function(e) {
    if (_touchMoved) return;
    e.preventDefault();
    handleBoardInteraction(e.changedTouches[0].target);
}, { passive: false });
$(document).on('click', '#myBoard', function(e) { handleBoardInteraction(e.target); });

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
    var themeClasses = ['classic','green','blue','monochrome','coral'];
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
    var themeReset = 'theme-classic theme-green theme-blue theme-monochrome theme-coral';
    $('#myBoard, #puzzleBoard, #analysisBoard').removeClass(themeReset).addClass(themeClass);

    var newPieceURL = 'https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/{piece}.png';

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

    // ── PERSIST ALL SETTINGS ──────────────────────────────────
    try {
        localStorage.setItem('chessengine-settings-v1', JSON.stringify({
            gameMode:    gameMode,
            timeControl: timeControl,
            engineSkill: engineSkill,
            pieceTheme:  pieceThemeStyle,
            boardTheme:  $('#themeSelect').val(),
            soundTheme:  currentSoundTheme
        }));
    } catch(e) {}

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
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/{piece}.png',
    draggable: true, position: 'start',
    onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
    moveSpeed: 200, snapbackSpeed: 100, snapSpeed: 80,
};

board = Chessboard('myBoard', config);
restartGame();

// Apply saved board theme AFTER board is created
(function() {
    var bt = _savedSettings.boardTheme;
    if (bt) {
        var _tr = 'theme-classic theme-green theme-blue theme-monochrome theme-coral';
        $('#myBoard').removeClass(_tr).addClass('theme-' + bt);
    }
})();

// ── Dynamic board sizing — fill available height ──────────────
function resizeBoard() {
    var $boardArea = $('.board-area');
    if (!$boardArea.length) return;

    var areaH = $boardArea.height();
    var areaW = $boardArea.width();

    // Chrome heights:
    // - #gameStatus: ~30px + 3px margin-bottom
    // - #openingTracker: hidden (0) when no opening
    // - .board-player-label x2: each ~34px (28px avatar + 4px padding top + 4px padding bottom)
    // - board-area vertical padding: 12px top + 12px bottom = 24px
    var labelH = 34; // each label row
    var statusH = 33; // gameStatus + margin
    var paddingH = 24; // board-area top+bottom padding
    var chromeH = statusH + (labelH * 2) + paddingH;

    var available = areaH - chromeH;

    // Side elements: evalBar(14px) + gap(10px) + controls(36px) + gap(10px) = 70px
    var sideW = 14 + 10 + 36 + 10;
    // Board area horizontal padding accounted for in areaW already
    var maxFromWidth = areaW - sideW - 40;

    var size = Math.min(available, maxFromWidth);
    size = Math.max(size, 280); // minimum 280px

    var totalW = size + sideW;

    // Size the board
    $('#myBoard').css('width', size + 'px');
    // Size the container (board + side elements)
    $('#boardContainer').css('width', totalW + 'px');
    // Size labels to match board width
    $('.board-player-label').css('width', totalW + 'px');

    if (board) board.resize();
    if (typeof analysisBoard !== 'undefined' && analysisBoard) analysisBoard.resize();
    if (typeof puzzleBoard !== 'undefined' && puzzleBoard) puzzleBoard.resize();
}

$(window).resize(resizeBoard);
// Trigger after paint on load
setTimeout(resizeBoard, 50);
setTimeout(resizeBoard, 300); // second pass after fonts/images settle

// ============================================================
// ANALYSIS MODE
// ============================================================
var analysisBoard = null;
var analysisGame  = new Chess();
var analysisMoveIndex  = 0;
var analysisHistory    = [];
var analysisEvals      = [];
var analysisBestUCI    = [];
var analysisBestSAN    = [];
var analysisAnnotations= [];
var analysisWorker     = null;
var analysisPerspective = 'both';
var _pendingAnalysisCallback = null;

function createAnalysisWorker() {
    var blob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"], { type:'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
}

function drawBestMoveArrow(uci) {
    $('#analysisArrow').remove();
    if (!uci || uci.length<4) return;
    var fromSq = uci.slice(0,2), toSq = uci.slice(2,4);
    var $board = $('#analysisBoard');
    var boardOffset = $board.offset();
    var boardW = $board.width(), sqSize = boardW/8;
    var isFlipped = (analysisBoard.orientation()==='black');
    function sqToXY(sq) {
        var file=sq.charCodeAt(0)-97, rank=parseInt(sq[1])-1;
        var col=isFlipped?(7-file):file, row=isFlipped?rank:(7-rank);
        return { x: col*sqSize+sqSize/2, y: row*sqSize+sqSize/2 };
    }
    var from=sqToXY(fromSq), to=sqToXY(toSq);
    var svgNS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(svgNS,'svg');
    svg.id='analysisArrow'; svg.setAttribute('width',boardW); svg.setAttribute('height',boardW);
    svg.style.position='absolute'; svg.style.top='0'; svg.style.left='0'; svg.style.pointerEvents='none'; svg.style.zIndex='10';
    var defs=document.createElementNS(svgNS,'defs');
    var marker=document.createElementNS(svgNS,'marker');
    marker.setAttribute('id','arrowhead'); marker.setAttribute('markerWidth','4'); marker.setAttribute('markerHeight','4');
    marker.setAttribute('refX','2'); marker.setAttribute('refY','2'); marker.setAttribute('orient','auto');
    var poly=document.createElementNS(svgNS,'polygon'); poly.setAttribute('points','0 0, 4 2, 0 4'); poly.setAttribute('fill','rgba(0,200,120,0.9)');
    marker.appendChild(poly); defs.appendChild(marker); svg.appendChild(defs);
    var dx=to.x-from.x, dy=to.y-from.y, len=Math.sqrt(dx*dx+dy*dy), shorten=sqSize*0.38;
    var ex=to.x-dx/len*shorten, ey=to.y-dy/len*shorten;
    var line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',from.x); line.setAttribute('y1',from.y); line.setAttribute('x2',ex); line.setAttribute('y2',ey);
    line.setAttribute('stroke','rgba(0,200,120,0.85)'); line.setAttribute('stroke-width',sqSize*0.18);
    line.setAttribute('stroke-linecap','round'); line.setAttribute('marker-end','url(#arrowhead)');
    svg.appendChild(line);
    var $container=$('#analysisBoardContainer'); $container.css('position','relative');
    var contOffset=$container.offset();
    svg.style.left=(boardOffset.left-contOffset.left)+'px'; svg.style.top=(boardOffset.top-contOffset.top)+'px';
    $container.append(svg);
}

function drawAnnotationBadge(annotation, toSquare, annKey) {
    $('#analysisBadge').remove();
    if (!annotation||!toSquare) return;
    var $board=$('#analysisBoard'), boardW=$board.width(), sqSize=boardW/8;
    var isFlipped=(analysisBoard.orientation()==='black');
    var file=toSquare.charCodeAt(0)-97, rank=parseInt(toSquare[1])-1;
    var col=isFlipped?(7-file):file, row=isFlipped?rank:(7-rank);
    var x=col*sqSize+sqSize*0.62, y=row*sqSize+sqSize*0.05;
    var colorMap={'brilliant':'#0ea5e9','best':'#10b981','excellent':'#10b981','good':'#22c55e','book':'#8b5cf6','inaccuracy':'#f59e0b','mistake':'#f97316','blunder':'#ef4444'};
    var color=colorMap[annKey]||'#888';
    var svgNS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(svgNS,'svg');
    svg.id='analysisBadge'; svg.setAttribute('width',boardW); svg.setAttribute('height',boardW);
    svg.style.position='absolute'; svg.style.top='0'; svg.style.left='0'; svg.style.pointerEvents='none'; svg.style.zIndex='11';
    var r=sqSize*0.22, cx=x+r, cy=y+r;
    var circle=document.createElementNS(svgNS,'circle');
    circle.setAttribute('cx',cx); circle.setAttribute('cy',cy); circle.setAttribute('r',r);
    circle.setAttribute('fill',color); circle.setAttribute('stroke','#fff'); circle.setAttribute('stroke-width','1.5');
    svg.appendChild(circle);
    var text=document.createElementNS(svgNS,'text');
    text.setAttribute('x',cx); text.setAttribute('y',cy); text.setAttribute('text-anchor','middle');
    text.setAttribute('dominant-baseline','central'); text.setAttribute('font-size',r*(annotation.length>1?0.85:1.1));
    text.setAttribute('font-weight','800'); text.setAttribute('fill','#fff'); text.setAttribute('font-family','sans-serif');
    text.textContent=annotation; svg.appendChild(text);
    var $container=$('#analysisBoardContainer'), contOffset=$container.offset(), boardOffset=$board.offset();
    svg.style.left=(boardOffset.left-contOffset.left)+'px'; svg.style.top=(boardOffset.top-contOffset.top)+'px';
    $container.append(svg);
}

function openAnalysis() {
    if (game.history().length===0) {
        $('#analysisOverlay').addClass('open');
        $('#analyzeNavBtn').addClass('active');
        if (typeof sessionStats!=='undefined') sessionStats.analyzed=(sessionStats.analyzed||0)+1;
        openPgnModal(); return;
    }
    $('#analyzeNavBtn').addClass('active');
    if (typeof sessionStats!=='undefined') sessionStats.analyzed=(sessionStats.analyzed||0)+1;
    var whiteLabel=$('.player-label').find('#playerLabelText').text()||'White';
    var blackLabel=$('.opponent-label').find('#opponentLabelText').text()||'Black';
    showPerspectivePicker(whiteLabel, blackLabel, function() { _buildAndRunAnalysis(null); });
}

function _buildAndRunAnalysis(prebuiltHistory) {
    if (!prebuiltHistory) {
        analysisHistory=[];
        var tempGame=new Chess();
        var moves=game.history({ verbose: true });
        analysisHistory.push({ fen: tempGame.fen(), san: null, from: null, to: null, uci: null });
        moves.forEach(function(m) {
            tempGame.move(m);
            analysisHistory.push({ fen: tempGame.fen(), san: m.san, from: m.from, to: m.to, uci: m.from+m.to+(m.promotion||'') });
        });
    } else { analysisHistory=prebuiltHistory; }
    analysisEvals=new Array(analysisHistory.length).fill(null);
    analysisBestUCI=new Array(analysisHistory.length).fill(null);
    analysisBestSAN=new Array(analysisHistory.length).fill(null);
    analysisAnnotations=new Array(analysisHistory.length).fill('');
    analysisPieceTheme=pieceThemeStyle;
    var aCfg={ pieceTheme:'https://chessboardjs.com/img/chesspieces/'+analysisPieceTheme+'/{piece}.png', draggable:false, position:'start' };
    if (analysisBoard) { analysisBoard.destroy(); }
    analysisBoard=Chessboard('analysisBoard', aCfg);
    $(window).resize(analysisBoard.resize);
    analysisMoveIndex=analysisHistory.length-1;
    renderAnalysisPosition();
    $('#analysisOverlay').addClass('open');
    startFullAnalysis();
}

function closeAnalysis() {
    $('#analysisOverlay').removeClass('open');
    $('#analyzeNavBtn').removeClass('active');
    if (analysisWorker) { analysisWorker.terminate(); analysisWorker=null; }
    $('#analysisLoadingBanner').hide();
    $('#analysisArrow').remove();
    $('#analysisBadge').remove();
}

function renderAnalysisPosition() {
    var pos=analysisHistory[analysisMoveIndex];
    analysisGame.load(pos.fen); analysisBoard.position(pos.fen,false);
    $('#analysisBoard .square-55d63').removeClass('highlight-move');
    if (pos.from&&pos.to) { $('#analysisBoard .square-'+pos.from).addClass('highlight-move'); $('#analysisBoard .square-'+pos.to).addClass('highlight-move'); }
    if (analysisMoveIndex===0) { $('#analysisStatus').text('Starting Position'); $('#analysisMoveLabel').text('\u2014'); }
    else {
        var moveNum=Math.ceil(analysisMoveIndex/2), isWhite=(analysisMoveIndex%2===1);
        $('#analysisMoveLabel').text('Move '+moveNum+(isWhite?'. White':'... Black'));
        $('#analysisStatus').text('After: '+(isWhite?moveNum+'.':moveNum+'...')+' '+pos.san);
    }
    var ev=analysisEvals[analysisMoveIndex];
    if (ev!==null) {
        var fill=Math.max(0,Math.min(100,50+ev/12));
        $('#analysisEvalFill').css('height',fill+'%');
        var disp=Math.abs(ev)>=9000?(ev>0?'+M':'-M'):(ev>=0?'+':'')+(ev/100).toFixed(1);
        $('#evalScoreBox').text(disp); $('#evalDepth').text('Depth 18');
    } else { $('#evalScoreBox').text('\u2014'); $('#evalDepth').text('Analyzing...'); }
    var bestUCI=analysisBestUCI[analysisMoveIndex];
    $('#evalBestMove').text(analysisBestSAN[analysisMoveIndex]?'Best: '+analysisBestSAN[analysisMoveIndex]:'Best: \u2014');
    setTimeout(function() { drawBestMoveArrow(bestUCI); }, 30);
    var ann=moveIsForPerspective(analysisMoveIndex)?analysisAnnotations[analysisMoveIndex]:'';
    var annSym=ann?getAnnSym(ann):'';
    var toSq=pos.to;
    setTimeout(function() { drawAnnotationBadge(annSym,toSq,ann); }, 35);
    if (analysisMoveIndex>0) {
        var histStr=analysisHistory.slice(1,analysisMoveIndex+1).map(function(h){return h.san;}).join(',');
        var found='';
        var keys=Object.keys(openingBook).sort(function(a,b){return b.length-a.length;});
        for (var i=0;i<keys.length;i++) { if (histStr.startsWith(keys[i])) { found=openingBook[keys[i]]; break; } }
        $('#analysisOpening').text(found ? (found.eco + ' · ' + found.name) : '');
    } else { $('#analysisOpening').text(''); }
    renderAnalysisMoveList();
}

function moveIsForPerspective(moveIdx) {
    if (analysisPerspective==='both') return true;
    var isWhiteMove=(moveIdx%2===1);
    return analysisPerspective==='white'?isWhiteMove:!isWhiteMove;
}

function renderAnalysisMoveList() {
    var counts={brilliant:0,best:0,excellent:0,good:0,book:0,inaccuracy:0,mistake:0,blunder:0};
    for (var i=1;i<analysisHistory.length;i++) {
        if (!moveIsForPerspective(i)) continue;
        var a=analysisAnnotations[i];
        if (counts.hasOwnProperty(a)) counts[a]++;
    }
    $('#cntBrilliant').text(counts.brilliant); $('#cntBest').text(counts.best);
    $('#cntExcellent').text(counts.excellent); $('#cntGood').text(counts.good);
    $('#cntBook').text(counts.book); $('#cntInaccuracy').text(counts.inaccuracy);
    $('#cntMistake').text(counts.mistake); $('#cntBlunder').text(counts.blunder);
    var perspLabel=analysisPerspective==='white'?' (White)':analysisPerspective==='black'?' (Black)':'';
    $('#analysisAccuracyRow').attr('title','Move ratings'+perspLabel);
    var html='';
    for (var i=1;i<analysisHistory.length;i+=2) {
        var wMove=analysisHistory[i], bMove=analysisHistory[i+1]||null, mn=Math.ceil(i/2);
        var wAnn=moveIsForPerspective(i)?(analysisAnnotations[i]||''):'';
        var bAnn=(bMove&&moveIsForPerspective(i+1))?(analysisAnnotations[i+1]||''):'';
        var wCls='ana-move-cell'+(analysisMoveIndex===i?' active-cell':'')+(moveIsForPerspective(i)?'':' out-of-perspective');
        var bCls='ana-move-cell'+(bMove&&analysisMoveIndex===i+1?' active-cell':'')+(bMove&&moveIsForPerspective(i+1)?'':' out-of-perspective');
        var wBadge=wAnn?'<span class="move-annotation '+getAnnClass(wAnn)+'">'+getAnnSym(wAnn)+'</span>':'';
        var bBadge=bAnn?'<span class="move-annotation '+getAnnClass(bAnn)+'">'+getAnnSym(bAnn)+'</span>':'';
        html+='<div class="ana-history-row">';
        html+='<span class="ana-move-num">'+mn+'.</span>';
        html+='<span class="'+wCls+'" data-idx="'+i+'">'+wMove.san+wBadge+'</span>';
        if (bMove) html+='<span class="'+bCls+'" data-idx="'+(i+1)+'">'+bMove.san+bBadge+'</span>';
        else       html+='<span class="ana-move-cell" style="flex:1"></span>';
        html+='</div>';
    }
    $('#analysisMoveList').html(html);
    var $active=$('#analysisMoveList .active-cell');
    if ($active.length) { var list=document.getElementById('analysisMoveList'); list.scrollTop=$active[0].offsetTop-list.clientHeight/2; }
}

var ANN_META = {
    'brilliant':  { cls:'ann-brilliant',  sym:'\u2605', label:'Brilliant'  },
    'best':       { cls:'ann-best',       sym:'\u2713', label:'Best'       },
    'excellent':  { cls:'ann-excellent',  sym:'!',      label:'Excellent'  },
    'good':       { cls:'ann-good',       sym:'\u25a1', label:'Good'       },
    'book':       { cls:'ann-book',       sym:'\u2656', label:'Book'       },
    'inaccuracy': { cls:'ann-inaccuracy', sym:'?!',     label:'Inaccuracy' },
    'mistake':    { cls:'ann-mistake',    sym:'?',      label:'Mistake'    },
    'blunder':    { cls:'ann-blunder',    sym:'??',     label:'Blunder'    },
};
function getAnnMeta(ann) { return ANN_META[ann]||{cls:'',sym:ann,label:''}; }
function getAnnClass(ann) { return getAnnMeta(ann).cls; }
function getAnnSym(ann)   { return getAnnMeta(ann).sym; }

function capEval(v) { if(v>=9000)return 1000; if(v<=-9000)return-1000; return Math.max(-1000,Math.min(1000,v)); }

var BOOK_POSITIONS=(function(){
    var book={};
    var lines=[['e2e4','e7e5'],['e2e4','c7c5'],['e2e4','e7e6'],['e2e4','c7c6'],['d2d4','d7d5'],['d2d4','g8f6'],['g1f3','d7d5'],['c2c4','e7e5'],['g1f3','g8f6'],['c2c4','c7c5']];
    var Chess2=typeof Chess!=='undefined'?Chess:null;
    if (Chess2) {
        lines.forEach(function(line) {
            var g=new Chess2();
            line.forEach(function(uci) { g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined}); book[g.fen().split(' ').slice(0,4).join(' ')]=true; });
        });
    }
    return book;
})();

function isBookMove(fenBefore, uci) {
    try {
        var g=new Chess(); g.load(fenBefore);
        g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined});
        return !!BOOK_POSITIONS[g.fen().split(' ').slice(0,4).join(' ')];
    } catch(e) { return false; }
}

function computeAnnotations() {
    for (var i=1;i<analysisHistory.length;i++) {
        var eb=analysisEvals[i-1], ea=analysisEvals[i];
        if (eb===null||ea===null) continue;
        var ebC=capEval(eb), eaC=capEval(ea);
        var isWhiteMove=(i%2===1);
        var evalDrop=isWhiteMove?(ebC-eaC):(eaC-ebC);
        var playedUCI=analysisHistory[i].uci, bestUCI=analysisBestUCI[i-1];
        var playedBest=!!(bestUCI&&playedUCI&&playedUCI===bestUCI);
        if (playedBest) {
            var positionIsDecided=(Math.abs(ebC)>700);
            var legalMoveCount=(function(idx){ try{var tmp=new Chess();tmp.load(analysisHistory[idx].fen);return tmp.moves().length;}catch(e){return 99;} })(i-1);
            if (!positionIsDecided&&legalMoveCount>1&&evalDrop<=0) { analysisAnnotations[i]='brilliant'; }
            else { analysisAnnotations[i]='best'; }
            continue;
        }
        if (i<=10&&isBookMove(analysisHistory[i-1].fen,playedUCI)) { analysisAnnotations[i]='book'; continue; }
        if      (evalDrop<=0)   { analysisAnnotations[i]='best'; }
        else if (evalDrop<=10)  { analysisAnnotations[i]='excellent'; }
        else if (evalDrop<=25)  { analysisAnnotations[i]='good'; }
        else if (evalDrop<=60)  { analysisAnnotations[i]='inaccuracy'; }
        else if (evalDrop<=150) { analysisAnnotations[i]='mistake'; }
        else                    { analysisAnnotations[i]='blunder'; }
    }
}

function startFullAnalysis() {
    if (analysisWorker) { analysisWorker.terminate(); }
    analysisWorker=createAnalysisWorker();
    var total=analysisHistory.length, queue=[];
    for (var i=0;i<total;i++) queue.push(i);
    var pendingIdx=null, lastCp=0, lastDepth=0, uciReady=false;
    $('#analysisLoadingBanner').css('display','flex'); $('#analysisLoadingText').text('Initializing engine...');
    function evaluateNext() {
        if (queue.length===0) { $('#analysisLoadingBanner').hide(); computeAnnotations(); renderAnalysisPosition(); return; }
        pendingIdx=queue.shift();
        var posNum=total-queue.length;
        $('#analysisLoadingText').text('Analyzing position '+posNum+' of '+total+'...');
        lastCp=0; lastDepth=0;
        analysisWorker.postMessage('position fen '+analysisHistory[pendingIdx].fen);
        analysisWorker.postMessage('go depth 20 movetime 1500');
    }
    analysisWorker.onmessage=function(e) {
        var line=e.data;
        if (!uciReady) { if (line.indexOf('uciok')>-1) { uciReady=true; analysisWorker.postMessage('setoption name Skill Level value 20'); analysisWorker.postMessage('setoption name UCI_LimitStrength value false'); analysisWorker.postMessage('isready'); } return; }
        if (pendingIdx===null&&line.indexOf('readyok')>-1) { evaluateNext(); return; }
        if (pendingIdx!==null&&line.indexOf('info')>-1&&line.indexOf('score')>-1) {
            var depthMatch=line.match(/depth (\d+)/); var d=depthMatch?parseInt(depthMatch[1]):0;
            if (d>=lastDepth) {
                var isBlackToMove=(analysisHistory[pendingIdx].fen.indexOf(' b ')>-1);
                var scMatch=line.match(/score cp (-?\d+)/); var mtMatch=line.match(/score mate (-?\d+)/);
                if (scMatch) { var cp=parseInt(scMatch[1]); lastCp=isBlackToMove?-cp:cp; lastDepth=d; }
                else if (mtMatch) { var mt=parseInt(mtMatch[1]); if (isBlackToMove) mt=-mt; lastCp=mt>0?9999:-9999; lastDepth=d; }
            }
        }
        if (pendingIdx!==null&&line.indexOf('bestmove')>-1) {
            var bm=line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (bm) {
                var uci=bm[1]; analysisBestUCI[pendingIdx]=uci;
                var tmpG3=new Chess(); tmpG3.load(analysisHistory[pendingIdx].fen);
                var mv=tmpG3.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined});
                analysisBestSAN[pendingIdx]=mv?mv.san:uci;
            }
            analysisEvals[pendingIdx]=lastCp;
            if (pendingIdx===analysisMoveIndex) { renderAnalysisPosition(); }
            pendingIdx=null;
            computeAnnotations(); renderAnalysisMoveList(); evaluateNext();
        }
    };
    analysisWorker.postMessage('uci');
}

$('#analyzeNavBtn').on('click', openAnalysis);
$('#backToPlayBtn').on('click', closeAnalysis);
$('#anaFirstBtn').on('click', function() { analysisMoveIndex=0; renderAnalysisPosition(); });
$('#anaPrevBtn').on('click',  function() { if(analysisMoveIndex>0){analysisMoveIndex--;renderAnalysisPosition();} });
$('#anaNextBtn').on('click',  function() { if(analysisMoveIndex<analysisHistory.length-1){analysisMoveIndex++;renderAnalysisPosition();} });
$('#anaLastBtn').on('click',  function() { analysisMoveIndex=analysisHistory.length-1; renderAnalysisPosition(); });

$(document).on('click', '.ana-move-cell[data-idx]', function() {
    var idx=parseInt($(this).data('idx'));
    if (!isNaN(idx)) { analysisMoveIndex=idx; renderAnalysisPosition(); }
});

$(document).on('keydown', function(e) {
    if ($('#puzzleOverlay').hasClass('open')) return;
    if (!$('#analysisOverlay').hasClass('open')) return;
    if (e.key==='ArrowLeft'&&analysisMoveIndex>0) { analysisMoveIndex--; renderAnalysisPosition(); }
    if (e.key==='ArrowRight'&&analysisMoveIndex<analysisHistory.length-1) { analysisMoveIndex++; renderAnalysisPosition(); }
    if (e.key==='Home') { analysisMoveIndex=0; renderAnalysisPosition(); }
    if (e.key==='End')  { analysisMoveIndex=analysisHistory.length-1; renderAnalysisPosition(); }
});

$('#analysisFlipBtn').on('click', function() {
    if (analysisBoard) {
        analysisBoard.flip();
        setTimeout(function() { drawBestMoveArrow(analysisBestUCI[analysisMoveIndex]); drawAnnotationBadge(analysisAnnotations[analysisMoveIndex],analysisHistory[analysisMoveIndex].to); }, 100);
    }
});

// ============================================================
// HOME / PROFILE PAGE
// ============================================================
var sessionStats = {
    played:0, wins:0, losses:0, draws:0,
    streak:0, bestStreak:0, resignations:0,
    checkmates:0, analyzed:0, gameHistory:[]
};

var ACHIEVEMENTS = [
    { id:'first_blood',    icon:'<i class="ph ph-star"></i>',          name:'First Move',     desc:'Play your first game',       check:function(s){return s.played>=1;} },
    { id:'winner',         icon:'<i class="ph ph-trophy"></i>',         name:'Winner!',        desc:'Win your first game',        check:function(s){return s.wins>=1;} },
    { id:'hat_trick',      icon:'<i class="ph ph-crown"></i>',          name:'Hat Trick',      desc:'Win 3 games in a row',       check:function(s){return s.bestStreak>=3;} },
    { id:'veteran',        icon:'<i class="ph ph-shield"></i>',         name:'Veteran',        desc:'Play 5 games',               check:function(s){return s.played>=5;} },
    { id:'checkmate_king', icon:'<i class="ph ph-crown"></i>',          name:'Checkmate King', desc:'Win by checkmate',           check:function(s){return s.checkmates>=1;} },
    { id:'comeback',       icon:'<i class="ph ph-trend-up"></i>',       name:'Never Give Up',  desc:'Win after losing a game',    check:function(s){
        var hadLoss=false;
        for (var i=0;i<s.gameHistory.length;i++) {
            if (s.gameHistory[i].result==='loss'||s.gameHistory[i].result==='resign') hadLoss=true;
            else if (hadLoss&&s.gameHistory[i].result==='win') return true;
        }
        return false;
    }},
    { id:'dominator',      icon:'<i class="ph ph-fire"></i>',           name:'Dominator',      desc:'Win 5 games',                check:function(s){return s.wins>=5;} },
    { id:'analyst',        icon:'<i class="ph ph-chart-line-up"></i>',  name:'Analyst',        desc:'Analyze a completed game',   check:function(s){return s.analyzed>=1;} },
    { id:'puzzle_starter', icon:'<i class="ph ph-puzzle-piece"></i>',   name:'Puzzle Starter', desc:'Solve your first puzzle',    check:function(s){return (puzzleStats.solved||0)>=1;} },
    { id:'puzzle_master',  icon:'<i class="ph ph-graduation-cap"></i>', name:'Puzzle Master',  desc:'Solve 10 puzzles',           check:function(s){return (puzzleStats.solved||0)>=10;} },
    { id:'puzzle_streak',  icon:'<i class="ph ph-lightning"></i>',      name:'On Fire',        desc:'5 puzzles in a row',         check:function(s){return (puzzleStats.bestStreak||0)>=5;} },
];

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
// PGN IMPORT & ANALYSIS
// ============================================================
var pgnActiveTab='paste', pgnFileContent=null;

function openPgnModal() {
    pgnFileContent=null; $('#pgnTextarea').val(''); $('#pgnFilename').text('');
    $('#pgnErrorPaste').text(''); $('#pgnErrorUpload').text(''); $('#pgnDropzone').removeClass('dragover');
    switchPgnTab('paste'); $('#pgnModal').addClass('open');
}
function closePgnModal() { $('#pgnModal').removeClass('open'); }

function switchPgnTab(tab) {
    pgnActiveTab=tab;
    $('.pgn-tab').removeClass('active'); $('.pgn-tab[data-tab="'+tab+'"]').addClass('active');
    $('.pgn-tab-content').removeClass('active'); $('#pgnTab'+tab.charAt(0).toUpperCase()+tab.slice(1)).addClass('active');
}

$(document).on('click', '.pgn-tab', function() { switchPgnTab($(this).data('tab')); });
$('#loadPgnBtn').on('click', openPgnModal);
$('#closePgnBtn, #closePgnBtn2').on('click', closePgnModal);
$('#pgnModal').on('click', function(e) { if ($(e.target).is('#pgnModal')) closePgnModal(); });

$('#pgnFileInput').on('change', function() { var file=this.files[0]; if (file) readPgnFile(file); });
$('#pgnDropzone').on('dragover dragenter', function(e) { e.preventDefault(); e.stopPropagation(); $(this).addClass('dragover'); })
    .on('dragleave drop', function(e) { e.preventDefault(); e.stopPropagation(); $(this).removeClass('dragover'); if (e.type==='drop') { var file=e.originalEvent.dataTransfer.files[0]; if (file) readPgnFile(file); } });

function readPgnFile(file) {
    if (!file.name.match(/\.(pgn|txt)$/i)) { $('#pgnErrorUpload').text('Please upload a .pgn or .txt file.'); return; }
    $('#pgnErrorUpload').text('');
    var reader=new FileReader();
    reader.onload=function(e) { pgnFileContent=e.target.result; $('#pgnFilename').text('\u2713 '+file.name+' ('+pgnFileContent.length+' chars)'); };
    reader.readAsText(file);
}

function parsePgn(pgnText) {
    var clean=pgnText.replace(/\{[^}]*\}/g,'').replace(/\([^)]*\)/g,'').replace(/;[^\n]*/g,'').replace(/\$\d+/g,'').replace(/\d+\.\.\.\s*/g,'').trim();
    var moveText=clean.replace(/\[[^\]]*\]/g,'').trim();
    var tokens=moveText.split(/\s+/).filter(function(t){return t&&!t.match(/^\d+\.+$/)&&!t.match(/^(1-0|0-1|1\/2-1\/2|\*)$/);});
    var tempGame=new Chess(), validMoves=[];
    for (var i=0;i<tokens.length;i++) { var mv=tempGame.move(tokens[i],{sloppy:true}); if(!mv){return{error:'Invalid move "'+tokens[i]+'" at move '+Math.ceil((i+1)/2)+'.'}; } validMoves.push(mv); }
    if (validMoves.length===0) { return{error:'No moves found in PGN.'}; }
    var headers={};
    var headerMatches=pgnText.match(/\[([A-Za-z]+)\s+"([^"]*)"\]/g)||[];
    headerMatches.forEach(function(h){var m=h.match(/\[([A-Za-z]+)\s+"([^"]*)"\]/);if(m)headers[m[1]]=m[2];});
    return{moves:validMoves,headers:headers};
}

$('#analyzePgnBtn').on('click', function() {
    var pgnText='', $err;
    if (pgnActiveTab==='paste') { pgnText=$('#pgnTextarea').val().trim(); $err=$('#pgnErrorPaste'); }
    else { pgnText=pgnFileContent||''; $err=$('#pgnErrorUpload'); }
    $err.text('');
    if (!pgnText) { $err.text(pgnActiveTab==='paste'?'Please paste a PGN first.':'Please upload a file first.'); return; }
    var result=parsePgn(pgnText);
    if (result.error) { $err.text(result.error); return; }
    closePgnModal();
    analysisHistory=[];
    var replayGame=new Chess();
    analysisHistory.push({fen:replayGame.fen(),san:null,from:null,to:null,uci:null});
    result.moves.forEach(function(m){replayGame.move({from:m.from,to:m.to,promotion:m.promotion||'q'});analysisHistory.push({fen:replayGame.fen(),san:m.san,from:m.from,to:m.to,uci:m.from+m.to+(m.promotion||'')});});
    analysisEvals=new Array(analysisHistory.length).fill(null);
    analysisBestUCI=new Array(analysisHistory.length).fill(null);
    analysisBestSAN=new Array(analysisHistory.length).fill(null);
    analysisAnnotations=new Array(analysisHistory.length).fill('');
    var white=result.headers.White||'White', black=result.headers.Black||'Black';
    $('#analysisWhiteLabel').text(white); $('#analysisBlackLabel').text(black);
    $('#analysisStatus').text((result.headers.Event?result.headers.Event+' ':'')+(result.headers.Date||'')||'PGN Game');
    analysisPieceTheme=pieceThemeStyle;
    if (analysisBoard) { analysisBoard.destroy(); }
    analysisBoard=Chessboard('analysisBoard',{pieceTheme:'https://chessboardjs.com/img/chesspieces/'+analysisPieceTheme+'/{piece}.png',draggable:false,position:'start'});
    $(window).resize(analysisBoard.resize);
    analysisMoveIndex=analysisHistory.length-1;
    showPerspectivePicker(white, black, function() {
        if (!$('#analysisOverlay').hasClass('open')) { $('#analysisOverlay').addClass('open'); $('#analyzeNavBtn').addClass('active'); if(typeof sessionStats!=='undefined')sessionStats.analyzed=(sessionStats.analyzed||0)+1; }
        renderAnalysisPosition(); startFullAnalysis();
    });
});

// ============================================================
// PERSPECTIVE PICKER
// ============================================================
function showPerspectivePicker(whiteLabel, blackLabel, callback) {
    var btns=document.querySelectorAll('.perspective-btn');
    btns[0].querySelector('.persp-label').textContent=whiteLabel||'White';
    btns[1].querySelector('.persp-label').textContent=blackLabel||'Black';
    $('.perspective-btn').removeClass('selected');
    _pendingAnalysisCallback=callback;
    $('#perspectiveModal').addClass('open');
}

$('.perspective-btn').on('click', function() {
    analysisPerspective=$(this).data('perspective');
    $('#perspectiveModal').removeClass('open');
    if (_pendingAnalysisCallback) { _pendingAnalysisCallback(); _pendingAnalysisCallback=null; }
});
$('#cancelPerspectiveBtn').on('click', function() { $('#perspectiveModal').removeClass('open'); _pendingAnalysisCallback=null; });

// ============================================================
// PUZZLE / TACTICS TRAINER
// ============================================================
var puzzleBoard=null, puzzleGame=new Chess();
var puzzleStats={ attempted:0, solved:0, failed:0, streak:0, bestStreak:0 };
var currentPuzzle=null, puzzleMoveIndex=0, puzzleState='idle';
var puzzleDifficulty='medium', puzzlePlayerColor='w', puzzleHintUsed=false;

var PUZZLE_DB = {
easy: [
  { fen:"r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", moves:["h5f7"], theme:"Scholar's Mate", rating:600 },
  { fen:"rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq d6 0 3",    moves:["f3e5"], theme:"Capture Center Pawn", rating:500 },
  { fen:"r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",        moves:["d2d4"], theme:"Center Control", rating:500 },
  { fen:"rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",        moves:["e4e5"], theme:"Pawn Push", rating:550 },
  { fen:"rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",      moves:["g8f6"], theme:"Development", rating:500 },
  { fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",    moves:["f1b5"], theme:"Ruy Lopez Opening", rating:550 },
  { fen:"rnb1kbnr/ppppqppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3",    moves:["f3f7"], theme:"Back Rank Threat", rating:600 },
  { fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",moves:["c2c3"], theme:"Preparing d4", rating:550 },
  { fen:"rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",        moves:["d2d4"], theme:"French Defense Center", rating:500 },
  { fen:"rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",        moves:["d2d4"], theme:"Caro-Kann Center", rating:500 },
  { fen:"r1bqk2r/ppp2ppp/2n2n2/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq d3 0 4",moves:["e5d4"], theme:"Capture in Center", rating:600 },
  { fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",          moves:["e7e5"], theme:"Mirror Center", rating:450 },
],
medium: [
  { fen:"r2qk2r/ppp2ppp/2n1bn2/2bpp3/4P3/1BN2N2/PPPP1PPP/R1BQK2R w KQkq - 4 6",   moves:["e4d5"], theme:"Central Exchange", rating:1200 },
  { fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",    moves:["f3g5"], theme:"Fried Liver Attack", rating:1300 },
  { fen:"r1b1kb1r/pppp1ppp/5n2/4p1q1/2B1n3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 6",  moves:["f3e5"], theme:"Fork Threat", rating:1200 },
  { fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",         moves:["e2e3"], theme:"Nimzo-Indian", rating:1100 },
  { fen:"r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq c6 0 3",       moves:["d2d4"], theme:"Open Sicilian", rating:1100 },
  { fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",           moves:["e2e4"], theme:"King's Indian Classical", rating:1200 },
  { fen:"r1bqkb1r/pppppppp/2n2n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 2 3",           moves:["b1c3"], theme:"Scotch Four Knights", rating:1100 },
  { fen:"rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5",       moves:["c1g5"], theme:"Pin the Knight", rating:1300 },
  { fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3",        moves:["f1c4"], theme:"Vienna Game", rating:1100 },
  { fen:"rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",       moves:["d2d3"], theme:"Italian Giuoco Piano", rating:1050 },
  { fen:"r1bqkbnr/pppppppp/2n5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d3 0 2",             moves:["d7d5"], theme:"Counter Center", rating:1150 },
  { fen:"rnbqkb1r/pp2pppp/5n2/2pp4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 4",         moves:["e4e5"], theme:"Advance Variation", rating:1200 },
],
hard: [
  { fen:"r2q1rk1/ppp1bppp/2n1bn2/3pp3/8/1BN1PN2/PPPP1PPP/R1BQ1RK1 w - - 0 8",         moves:["d2d4"], theme:"Center Break", rating:1800 },
  { fen:"r1bq1rk1/ppp2ppp/2nb1n2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7",       moves:["c4b3"], theme:"Retreat & Prepare", rating:1700 },
  { fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 4",     moves:["c5b4"], theme:"Evans Gambit Accept", rating:1600 },
  { fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5",           moves:["f2f3"], theme:"Saemisch KID", rating:1800 },
  { fen:"r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 4 8",          moves:["c4c5"], theme:"Space Advantage", rating:1900 },
  { fen:"r2qkb1r/pp1bpppp/2np1n2/1B2P3/3P4/5N2/PPP2PPP/RNBQK2R b KQkq - 0 6",        moves:["f6d5"], theme:"Knight Retreat", rating:1700 },
  { fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 2 6",         moves:["e1g1"], theme:"Castle & Prepare", rating:1600 },
  { fen:"r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1NP1/PP3PBP/R1BQ1RK1 w - - 0 8",      moves:["d3d4"], theme:"Center Explosion", rating:1850 },
  { fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 2 6",         moves:["f1e1"], theme:"Ruy Lopez Marshall", rating:1750 },
  { fen:"rnbqk2r/pp2ppbp/3p1np1/2pP4/4P3/2N5/PPP2PPP/R1BQKBNR w KQkq - 1 5",         moves:["c1e3"], theme:"Benoni Structure", rating:1800 },
  { fen:"r2q1rk1/pp2ppbp/2npbnp1/2p5/4PP2/2NP1NP1/PPP3BP/R1BQ1RK1 w - - 0 8",        moves:["f4f5"], theme:"Kingside Attack", rating:1900 },
  { fen:"r1bqk2r/ppppnppp/2n5/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5",        moves:["d7d5"], theme:"Central Counter", rating:1700 },
]
};

function getRandomPuzzle(difficulty) { var pool=PUZZLE_DB[difficulty]||PUZZLE_DB.medium; return pool[Math.floor(Math.random()*pool.length)]; }

function openPuzzles() {
    closePuzzleCleanup(); $('#puzzleOverlay').addClass('open'); $('#puzzleNavBtn').addClass('active');
    $('#playNavBtn, #analyzeNavBtn, #homeNavBtn').removeClass('active');
    initPuzzleBoard(); loadNewPuzzle();
}
function closePuzzles() { closePuzzleCleanup(); $('#puzzleOverlay').removeClass('open'); $('#puzzleNavBtn').removeClass('active'); }
function closePuzzleCleanup() { $('#puzzleHintArrow').remove(); puzzleState='idle'; }

function initPuzzleBoard() {
    if (puzzleBoard) { puzzleBoard.destroy(); }
    puzzleBoard=Chessboard('puzzleBoard',{
        pieceTheme:'https://chessboardjs.com/img/chesspieces/'+pieceThemeStyle+'/{piece}.png',
        draggable:true, position:'start',
        onDragStart:onPuzzleDragStart, onDrop:onPuzzleDrop, onSnapEnd:onPuzzleSnapEnd
    });
    $(window).resize(puzzleBoard.resize);
}

function loadNewPuzzle() {
    var pz=getRandomPuzzle(puzzleDifficulty);
    currentPuzzle=pz; puzzleMoveIndex=0; puzzleState='playing'; puzzleHintUsed=false;
    puzzleGame.load(pz.fen); puzzlePlayerColor=puzzleGame.turn();
    puzzleBoard.orientation(puzzlePlayerColor==='w'?'white':'black');
    puzzleBoard.position(pz.fen,false);
    var youLabel=puzzlePlayerColor==='w'?'You (White)':'You (Black)';
    var oppLabel=puzzlePlayerColor==='w'?'Opponent (Black)':'Opponent (White)';
    $('#puzzleWhiteLabel').text(youLabel); $('#puzzleBlackLabel').text(oppLabel);
    var fill=puzzlePlayerColor==='w'?65:35; $('#puzzleEvalFill').css('height',fill+'%');
    $('#puzzleStatus').text('Find the best move!'); $('#puzzleThemeBadge').text(pz.theme);
    $('#pzInfoTheme').text(pz.theme); $('#pzInfoMoves').text(pz.moves.length+(pz.moves.length===1?' move':' moves')); $('#pzInfoRating').text(pz.rating);
    $('#puzzleSolutionSection').hide(); $('#puzzleSolutionList').html('');
    $('#puzzleBoard .square-55d63').removeClass('highlight-move puzzle-correct puzzle-wrong');
    $('#puzzleHintArrow').remove(); updatePuzzleStats();
}

function onPuzzleDragStart(source, piece) {
    if (puzzleState!=='playing'||puzzleGame.game_over()) return false;
    if (puzzlePlayerColor==='w'&&piece.search(/^b/)!==-1) return false;
    if (puzzlePlayerColor==='b'&&piece.search(/^w/)!==-1) return false;
    if (puzzleGame.turn()!==puzzlePlayerColor) return false;
    var moves=puzzleGame.moves({square:source,verbose:true});
    if (moves.length===0) return false;
    for (var i=0;i<moves.length;i++) {
        if (moves[i].flags.indexOf('c')!==-1||moves[i].flags.indexOf('e')!==-1) { $('#puzzleBoard .square-'+moves[i].to).addClass('possible-capture'); }
        else { $('#puzzleBoard .square-'+moves[i].to).addClass('possible-move'); }
    }
}

function onPuzzleDrop(source, target) {
    $('#puzzleBoard .square-55d63').removeClass('possible-move possible-capture');
    var move=puzzleGame.move({from:source,to:target,promotion:'q'});
    if (move===null) return 'snapback';
    var playerUCI=source+target+(move.promotion||'');
    var expectedUCI=currentPuzzle.moves[puzzleMoveIndex];
    if (playerUCI===expectedUCI) {
        playMoveSound(move); puzzleBoard.position(puzzleGame.fen());
        highlightPuzzleSquare(source,target,'correct'); puzzleMoveIndex++;
        if (puzzleMoveIndex>=currentPuzzle.moves.length) { puzzleSolved(); }
        else { $('#puzzleStatus').text('Correct! Find the next move...'); setTimeout(function(){makeOpponentPuzzleMove();},600); }
    } else {
        puzzleGame.undo(); puzzleBoard.position(puzzleGame.fen());
        highlightPuzzleSquare(source,target,'wrong');
        if (!isSoundMuted&&captureSound) { captureSound.currentTime=0; captureSound.play(); }
        puzzleFailed(); return 'snapback';
    }
}
function onPuzzleSnapEnd() { puzzleBoard.position(puzzleGame.fen()); }

function makeOpponentPuzzleMove() {
    if (puzzleMoveIndex>=currentPuzzle.moves.length) return;
    var uci=currentPuzzle.moves[puzzleMoveIndex], from=uci.slice(0,2), to=uci.slice(2,4), promo=uci[4]||undefined;
    var move=puzzleGame.move({from:from,to:to,promotion:promo});
    if (move) { puzzleBoard.position(puzzleGame.fen()); if(!isSoundMuted&&moveSound){moveSound.currentTime=0;moveSound.play();} highlightPuzzleSquare(from,to,null); puzzleMoveIndex++; $('#puzzleStatus').text('Your turn! Find the best move...'); }
}

function highlightPuzzleSquare(from, to, type) {
    $('#puzzleBoard .square-55d63').removeClass('puzzle-correct puzzle-wrong highlight-move');
    if (from&&to) {
        $('#puzzleBoard .square-'+from).addClass('highlight-move');
        $('#puzzleBoard .square-'+to).addClass('highlight-move');
        if (type==='correct') { $('#puzzleBoard .square-'+to).addClass('puzzle-correct'); }
        else if (type==='wrong') { $('#puzzleBoard .square-'+to).addClass('puzzle-wrong'); }
    }
}

function puzzleSolved() {
    puzzleState='solved'; puzzleStats.attempted++; puzzleStats.solved++; puzzleStats.streak++;
    if (puzzleStats.streak>puzzleStats.bestStreak) puzzleStats.bestStreak=puzzleStats.streak;
    $('#puzzleStatus').text('Puzzle Solved! Excellent!');
    $('#puzzleEvalFill').css('height',puzzlePlayerColor==='w'?'85%':'15%');
    if (!isSoundMuted&&endSound) { endSound.currentTime=0; endSound.play(); }
    confetti({particleCount:100,spread:70,origin:{y:0.6}});
    showPuzzleSolution(); updatePuzzleStats();
}

function puzzleFailed() {
    puzzleState='failed'; puzzleStats.attempted++; puzzleStats.failed++; puzzleStats.streak=0;
    $('#puzzleStatus').text('Incorrect. The solution is shown below.');
    showPuzzleSolution(); updatePuzzleStats();
}

function showPuzzleSolution() {
    var html='', tempG=new Chess(); tempG.load(currentPuzzle.fen);
    for (var i=0;i<currentPuzzle.moves.length;i++) {
        var uci=currentPuzzle.moves[i], from=uci.slice(0,2), to=uci.slice(2,4), promo=uci[4]||undefined;
        var mv=tempG.move({from:from,to:to,promotion:promo}), san=mv?mv.san:uci;
        var isPlayer=(i%2===0);
        html+='<div class="puzzle-solution-move '+(isPlayer?'player-move':'opponent-move')+'">';
        html+='<span class="sol-num">'+(i+1)+'.</span><span class="sol-san">'+san+'</span>';
        html+='<span class="sol-who">'+(isPlayer?'You':'Opp')+'</span></div>';
    }
    $('#puzzleSolutionList').html(html); $('#puzzleSolutionSection').slideDown(200);
}

$('#puzzleHintBtn').on('click', function() {
    if (puzzleState!=='playing'||!currentPuzzle) return;
    puzzleHintUsed=true;
    var uci=currentPuzzle.moves[puzzleMoveIndex];
    if (!uci||uci.length<4) return;
    var fromSq=uci.slice(0,2);
    $('#puzzleBoard .square-55d63').removeClass('puzzle-hint');
    $('#puzzleBoard .square-'+fromSq).addClass('puzzle-hint');
    $('#puzzleStatus').text('Hint: Try moving the highlighted piece!');
    drawPuzzleHintArrow(uci);
});

function drawPuzzleHintArrow(uci) {
    $('#puzzleHintArrow').remove();
    if (!uci||uci.length<4) return;
    var fromSq=uci.slice(0,2), toSq=uci.slice(2,4);
    var $board=$('#puzzleBoard'), boardOffset=$board.offset(), boardW=$board.width(), sqSize=boardW/8;
    var isFlipped=(puzzleBoard.orientation()==='black');
    function sqToXY(sq){var file=sq.charCodeAt(0)-97,rank=parseInt(sq[1])-1;var col=isFlipped?(7-file):file,row=isFlipped?rank:(7-rank);return{x:col*sqSize+sqSize/2,y:row*sqSize+sqSize/2};}
    var from=sqToXY(fromSq),to=sqToXY(toSq);
    var svgNS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(svgNS,'svg');
    svg.id='puzzleHintArrow'; svg.setAttribute('width',boardW); svg.setAttribute('height',boardW);
    svg.style.position='absolute'; svg.style.top='0'; svg.style.left='0'; svg.style.pointerEvents='none'; svg.style.zIndex='10';
    var defs=document.createElementNS(svgNS,'defs');
    var marker=document.createElementNS(svgNS,'marker');
    marker.setAttribute('id','puzzleArrowhead'); marker.setAttribute('markerWidth','4'); marker.setAttribute('markerHeight','4');
    marker.setAttribute('refX','2'); marker.setAttribute('refY','2'); marker.setAttribute('orient','auto');
    var poly=document.createElementNS(svgNS,'polygon'); poly.setAttribute('points','0 0, 4 2, 0 4'); poly.setAttribute('fill','rgba(245,158,11,0.9)');
    marker.appendChild(poly); defs.appendChild(marker); svg.appendChild(defs);
    var dx=to.x-from.x,dy=to.y-from.y,len=Math.sqrt(dx*dx+dy*dy),shorten=sqSize*0.38;
    var ex=to.x-dx/len*shorten,ey=to.y-dy/len*shorten;
    var line=document.createElementNS(svgNS,'line');
    line.setAttribute('x1',from.x); line.setAttribute('y1',from.y); line.setAttribute('x2',ex); line.setAttribute('y2',ey);
    line.setAttribute('stroke','rgba(245,158,11,0.85)'); line.setAttribute('stroke-width',sqSize*0.16);
    line.setAttribute('stroke-linecap','round'); line.setAttribute('marker-end','url(#puzzleArrowhead)');
    svg.appendChild(line);
    var $container=$('#puzzleBoardContainer'); $container.css('position','relative');
    var contOffset=$container.offset();
    svg.style.left=(boardOffset.left-contOffset.left)+'px'; svg.style.top=(boardOffset.top-contOffset.top)+'px';
    $container.append(svg);
}

function updatePuzzleStats() {
    $('#pzStatAttempted').text(puzzleStats.attempted); $('#pzStatSolved').text(puzzleStats.solved);
    $('#pzStatFailed').text(puzzleStats.failed); $('#pzStatStreak').text(puzzleStats.streak);
    var total=puzzleStats.attempted||1, pct=Math.round(puzzleStats.solved/total*100);
    $('#pzAccuracyPct').text(puzzleStats.attempted===0?'—':pct+'%');
    $('#pzAccuracyFill').css('width',puzzleStats.attempted?pct+'%':'0%');
}

$('#puzzleNavBtn').on('click', openPuzzles);
$('#homeToPuzzleBtn').on('click', function() { closeHome(); openPuzzles(); });
$('#puzzleToHomeBtn').on('click', function() { closePuzzles(); openHome(); });
$('#puzzleToPlayBtn').on('click', function() { closePuzzles(); $('#playNavBtn').addClass('active'); });
$('#puzzleToAnalyzeBtn').on('click', function() { closePuzzles(); openAnalysis(); });
$('#analysisToPuzzleBtn').on('click', function() { closeAnalysis(); openPuzzles(); });
$('#puzzleNextBtn').on('click', function() { loadNewPuzzle(); });
$('#puzzleRetryBtn').on('click', function() {
    if (!currentPuzzle) return;
    puzzleMoveIndex=0; puzzleState='playing'; puzzleHintUsed=false;
    puzzleGame.load(currentPuzzle.fen); puzzleBoard.position(currentPuzzle.fen,false);
    $('#puzzleBoard .square-55d63').removeClass('highlight-move puzzle-correct puzzle-wrong puzzle-hint');
    $('#puzzleHintArrow').remove(); $('#puzzleSolutionSection').hide(); $('#puzzleStatus').text('Find the best move!');
});
$('#puzzleFlipBtn').on('click', function() { if (puzzleBoard) puzzleBoard.flip(); });
$(document).on('click', '.puzzle-diff-btn', function() {
    $('.puzzle-diff-btn').removeClass('active'); $(this).addClass('active');
    puzzleDifficulty=$(this).data('diff'); loadNewPuzzle();
});

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