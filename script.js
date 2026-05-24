var board = null;
var game = new Chess();
var $status = $('#gameStatus');
var pendingPromotionMove = null;

// Variables for Timer
var timeControl = 600; 
var timeWhite = timeControl;
var timeBlack = timeControl;
var timerInterval = null;
var gameStarted = false;

// Timer Logic
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
}

// Move History Logic
function updateHistoryUI() {
    var history = game.history(); 
    var html = '';
    
    for (var i = 0; i < history.length; i += 2) {
        var moveNum = (i / 2) + 1;
        var whiteMove = history[i];
        var blackMove = history[i + 1] ? history[i + 1] : '';

        html += '<div class="history-row">' +
                    '<span class="move-num">' + moveNum + '.</span>' +
                    '<span class="move-w">' + whiteMove + '</span>' +
                    '<span class="move-b">' + blackMove + '</span>' +
                '</div>';
    }
    
    $('#moveHistory').html(html);
    var historyDiv = document.getElementById('moveHistory');
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

// Game Logic
function removeHighlights() {
    $('#myBoard .square-55d63').removeClass('possible-move');
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
    for (var i = 0; i < moves.length; i++) {
        $('#myBoard .square-' + moves[i].to).addClass('possible-move');
    }
}

function onDrop (source, target) {
    removeHighlights();

    var pieceToMove = game.get(source);
    var isPromotion = (pieceToMove !== null && pieceToMove.type === 'p' && 
                      (target.charAt(1) === '8' || target.charAt(1) === '1'));

    if (isPromotion) {
        pendingPromotionMove = { source: source, target: target };
        var colorStr = pieceToMove.color;
        $('.promo-piece').each(function() {
            var pieceLetter = $(this).data('piece');
            var imageUrl = 'https://chessboardjs.com/img/chesspieces/wikipedia/' + colorStr + pieceLetter.toUpperCase() + '.png';
            $(this).attr('src', imageUrl);
        });
        $('#promotionMenu').css('display', 'flex');
        return 'snapback'; 
    }

    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
    }
    updateTimerUI();
    updateHistoryUI();
    updateStatus();
}

function onSnapEnd () {
    if (pendingPromotionMove === null) board.position(game.fen());
}

$('.promo-piece').on('click', function() {
    var chosenPiece = $(this).data('piece');
    $('#promotionMenu').css('display', 'none');

    if (pendingPromotionMove) {
        game.move({
            from: pendingPromotionMove.source,
            to: pendingPromotionMove.target,
            promotion: chosenPiece
        });
        pendingPromotionMove = null;
        board.position(game.fen());
        
        if (!gameStarted) { gameStarted = true; startTimer(); }
        updateTimerUI();
        updateHistoryUI();
        updateStatus();
    }
});

$('#cancelPromoBtn').on('click', function() {
    $('#promotionMenu').css('display', 'none');
    pendingPromotionMove = null;
});

// Settings Modal Logic
$('#settingsBtn').on('click', function() { $('#settingsModal').css('display', 'flex'); });
$('#closeSettingsBtn').on('click', function() { $('#settingsModal').css('display', 'none'); });

$('#flipBoardBtn').on('click', function() {
    board.flip(); 
});

$('#saveSettingsBtn').on('click', function() {
    timeControl = parseInt($('#timeSelect').val());
    restartGame();
    $('#settingsModal').css('display', 'none');
});

// Restart Logic
function restartGame() {
    game.reset();
    board.start();
    
    clearInterval(timerInterval);
    timeWhite = timeControl;
    timeBlack = timeControl;
    gameStarted = false;
    updateTimerUI();
    
    $('#moveHistory').html('');
    
    updateStatus();
    $('#promotionMenu').css('display', 'none');
    pendingPromotionMove = null;
}

$('#resetBtn').on('click', restartGame);

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