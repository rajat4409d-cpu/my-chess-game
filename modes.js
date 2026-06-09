// Modes and secondary features extracted from script.js

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
var analysisDepths     = [];
var analysisWinLoss    = [];
var analysisMoveAccuracy = [];
var analysisWorker     = null;
var analysisPerspective = 'both';
var _pendingAnalysisCallback = null;

function createAnalysisWorker() {
    var blob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"], { type:'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
}

function resetAnalysisComputedData() {
    analysisEvals=new Array(analysisHistory.length).fill(null);
    analysisBestUCI=new Array(analysisHistory.length).fill(null);
    analysisBestSAN=new Array(analysisHistory.length).fill(null);
    analysisAnnotations=new Array(analysisHistory.length).fill('');
    analysisDepths=new Array(analysisHistory.length).fill(null);
    analysisWinLoss=new Array(analysisHistory.length).fill(null);
    analysisMoveAccuracy=new Array(analysisHistory.length).fill(null);
}

function ensureAnalysisInfoPanel() {
    if ($('#analysisAccuracySummary').length) return;
    var html=''+
        '<div id="analysisAccuracySummary" style="margin:10px 18px 4px;padding:10px 12px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.18);font-size:12px;color:#94a3b8;">'+
        '  <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;">'+
        '    <span>White accuracy: <strong id="analysisWhiteAccuracy" style="color:#f8fafc;">—</strong></span>'+
        '    <span>Black accuracy: <strong id="analysisBlackAccuracy" style="color:#f8fafc;">—</strong></span>'+
        '  </div>'+ 
        '  <div style="font-size:11px;color:#64748b;">Local Stockfish review — labels are approximate.</div>'+ 
        '</div>';
    $('#analysisEvalSummary').after(html);
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
    resetAnalysisComputedData();
    analysisPieceTheme=pieceThemeStyle;
    var aCfg={ pieceTheme: getPieceTheme(analysisPieceTheme), draggable:false, position:'start' };
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
    ensureAnalysisInfoPanel();
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
        $('#evalScoreBox').text(disp); $('#evalDepth').text(analysisDepths[analysisMoveIndex] ? 'Depth ' + analysisDepths[analysisMoveIndex] : 'Depth —');
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
    updateAnalysisAccuracySummary();
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

// Keep mate scores finite for the review maths.  All engine scores in
// analysisEvals are stored from White's point of view.
function capEval(v) {
    if (v === null || typeof v === 'undefined' || isNaN(v)) return 0;
    if (v >= 9000) return 1000;
    if (v <= -9000) return -1000;
    return Math.max(-1000, Math.min(1000, v));
}

// Convert a centipawn score (White POV) to White's winning chances.
// This is much closer to how Chess.com / Lichess style reviews judge move
// quality than raw centipawn loss, especially when one side is already winning.
function winChanceFromCp(cp) {
    cp = capEval(cp);
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function stripSanForBook(san) {
    return (san || '')
        .replace(/[+#]+$/g, '')      // check / mate marks
        .replace(/[!?]+$/g, '')      // annotations that may be present in PGNs
        .trim();
}

var BOOK_POSITIONS=(function(){
    var book={};
    // Fallback mini opening book by UCI positions.  The main book check below
    // uses the larger openingBook table from data.js, but these common replies
    // make early book detection work even if the SAN table is unavailable.
    var lines=[
        ['e2e4','e7e5','g1f3','b8c6'], ['e2e4','c7c5'], ['e2e4','e7e6'],
        ['e2e4','c7c6'], ['e2e4','d7d6'], ['d2d4','d7d5'], ['d2d4','g8f6'],
        ['g1f3','d7d5'], ['g1f3','g8f6'], ['c2c4','e7e5'], ['c2c4','c7c5']
    ];
    var Chess2=typeof Chess!=='undefined'?Chess:null;
    if (Chess2) {
        lines.forEach(function(line) {
            var g=new Chess2();
            line.forEach(function(uci) {
                g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined});
                book[g.fen().split(' ').slice(0,4).join(' ')]=true;
            });
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

function isBookMoveAtIndex(moveIdx) {
    if (moveIdx <= 0 || moveIdx > 24) return false; // don't call late middlegame moves book

    // Prefer the SAN opening table in data.js.  A played line is book while it
    // is a prefix of any known opening line (e.g. 1.e4 is book even before ...e5).
    try {
        if (typeof openingBook !== 'undefined' && openingBook) {
            var played = analysisHistory.slice(1, moveIdx + 1)
                .map(function(h){ return stripSanForBook(h.san); })
                .join(',');
            var keys = Object.keys(openingBook);
            for (var k=0; k<keys.length; k++) {
                var bookLine = keys[k].split(',').map(stripSanForBook).join(',');
                if (bookLine === played || bookLine.indexOf(played + ',') === 0) return true;
            }
        }
    } catch(e) {}

    // Fallback to UCI/FEN book.
    return isBookMove(analysisHistory[moveIdx-1].fen, analysisHistory[moveIdx].uci);
}

function materialScoreForSide(fen, side) {
    var values={p:100,n:320,b:330,r:500,q:900,k:0};
    try {
        var g=new Chess(); g.load(fen);
        var board=g.board(), score=0;
        for (var r=0;r<8;r++) {
            for (var c=0;c<8;c++) {
                var pc=board[r][c];
                if (!pc) continue;
                var val=values[pc.type]||0;
                score += (pc.color===side ? val : -val);
            }
        }
        return score;
    } catch(e) { return 0; }
}

function isPotentialBrilliant(moveIdx, winLoss, evalDropCp, playedBest) {
    // Do not award brilliancies for normal opening/book or routine best moves.
    if (!playedBest || isBookMoveAtIndex(moveIdx)) return false;
    if (winLoss > 0.5 || evalDropCp > 0) return false;

    var beforeFen=analysisHistory[moveIdx-1].fen, afterFen=analysisHistory[moveIdx].fen;
    var side=(moveIdx%2===1)?'w':'b';
    var materialBefore=materialScoreForSide(beforeFen, side);
    var materialAfter=materialScoreForSide(afterFen, side);
    var sacrificed = (materialAfter - materialBefore) <= -250; // at least a minor exchange/piece sac

    var ebC=capEval(analysisEvals[moveIdx-1]);
    var notAlreadyWinning=Math.abs(ebC) < 700;
    return sacrificed && notAlreadyWinning;
}

function moveAccuracyFromWinLoss(loss) {
    loss = Math.max(0, loss || 0);
    return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

function calculatePlayerAccuracy(color) {
    var total=0, count=0;
    for (var i=1;i<analysisHistory.length;i++) {
        var isWhiteMove=(i%2===1);
        if ((color==='white'&&!isWhiteMove) || (color==='black'&&isWhiteMove)) continue;
        var acc=analysisMoveAccuracy[i];
        if (acc===null || typeof acc==='undefined' || isNaN(acc)) continue;
        total+=acc; count++;
    }
    return count ? total/count : null;
}

function updateAnalysisAccuracySummary() {
    ensureAnalysisInfoPanel();
    var w=calculatePlayerAccuracy('white'), b=calculatePlayerAccuracy('black');
    $('#analysisWhiteAccuracy').text(w===null?'—':Math.round(w)+'%');
    $('#analysisBlackAccuracy').text(b===null?'—':Math.round(b)+'%');
}

function computeAnnotations() {
    for (var i=1;i<analysisHistory.length;i++) {
        var eb=analysisEvals[i-1], ea=analysisEvals[i];
        if (eb===null||ea===null) continue;

        var isWhiteMove=(i%2===1);
        var ebC=capEval(eb), eaC=capEval(ea);
        var evalDropCp=isWhiteMove?(ebC-eaC):(eaC-ebC);

        // Book must be checked before best-move matching.  Previously 1.e4 was
        // marked as "Best" because Stockfish liked it, while Chess.com/Chessvia
        // correctly mark it as "Book".
        var beforeWin=winChanceFromCp(ebC), afterWin=winChanceFromCp(eaC);
        var winLoss=isWhiteMove ? (beforeWin-afterWin) : (afterWin-beforeWin);
        winLoss=Math.max(0, winLoss);
        analysisWinLoss[i]=winLoss;
        analysisMoveAccuracy[i]=moveAccuracyFromWinLoss(winLoss);

        if (isBookMoveAtIndex(i)) {
            analysisAnnotations[i]='book';
            analysisMoveAccuracy[i]=100;
            continue;
        }

        var playedUCI=analysisHistory[i].uci, bestUCI=analysisBestUCI[i-1];
        var playedBest=!!(bestUCI&&playedUCI&&playedUCI===bestUCI);

        if (isPotentialBrilliant(i, winLoss, evalDropCp, playedBest)) { analysisAnnotations[i]='brilliant'; analysisMoveAccuracy[i]=100; continue; }
        if (playedBest || winLoss <= 0.5) { analysisAnnotations[i]='best'; continue; }

        // Win-probability-loss thresholds.  These avoid the old bug where a
        // harmless centipawn swing in an already won/lost position became a
        // false blunder, producing review counts far away from real sites.
        if      (winLoss <= 2.0)  { analysisAnnotations[i]='excellent'; }
        else if (winLoss <= 5.0)  { analysisAnnotations[i]='good'; }
        else if (winLoss <= 10.0) { analysisAnnotations[i]='inaccuracy'; }
        else if (winLoss <= 20.0) { analysisAnnotations[i]='mistake'; }
        else                      { analysisAnnotations[i]='blunder'; }
    }
    updateAnalysisAccuracySummary();
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
        analysisWorker.postMessage('go depth 18 movetime 1500');
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
            analysisDepths[pendingIdx]=lastDepth || null;
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
    resetAnalysisComputedData();
    var white=result.headers.White||'White', black=result.headers.Black||'Black';
    $('#analysisWhiteLabel').text(white); $('#analysisBlackLabel').text(black);
    $('#analysisStatus').text((result.headers.Event?result.headers.Event+' ':'')+(result.headers.Date||'')||'PGN Game');
    analysisPieceTheme=pieceThemeStyle;
    if (analysisBoard) { analysisBoard.destroy(); }
    analysisBoard=Chessboard('analysisBoard',{pieceTheme: getPieceTheme(analysisPieceTheme),draggable:false,position:'start'});
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
var puzzleStartTime=0;
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
        pieceTheme: getPieceTheme(pieceThemeStyle),
        draggable:true, position:'start',
        onDragStart:onPuzzleDragStart, onDrop:onPuzzleDrop, onSnapEnd:onPuzzleSnapEnd
    });
    $(window).resize(puzzleBoard.resize);
}

function loadNewPuzzle() {
    var pz=getRandomPuzzle(puzzleDifficulty);
    currentPuzzle=pz; puzzleMoveIndex=0; puzzleState='playing'; puzzleHintUsed=false;
    puzzleStartTime=Date.now();
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