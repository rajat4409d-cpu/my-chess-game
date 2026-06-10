// ============================================================
// Backrank Chess — Analyzer upgrades
// ------------------------------------------------------------
// Adds, as low-risk add-ons that do NOT touch existing analyzer
// flow on disk:
//   1. Analysis cache (IndexedDB w/ localStorage fallback)
//   2. Evaluation graph (HTML canvas)
//   3. Retry mistakes mode (overlay + small board)
//   4. Optional backend Stockfish helper (disabled by default)
//   5. Optional Lichess tablebase helper (disabled by default)
//
// The module is loaded AFTER modes.js (see index.html) and hooks
// into the existing functions/variables exposed there:
//   - analysisHistory, analysisEvals, analysisBestUCI,
//     analysisBestSAN, analysisDepths, analysisTopMoves,
//     analysisAnnotations, analysisExplanations,
//     analysisMoveIndex
//   - renderAnalysisPosition, renderAnalysisMoveList,
//     computeAnnotations, startFullAnalysis,
//     ensureAnalysisInfoPanel, getPieceTheme, pieceThemeStyle
//
// All hooks are wrapped in try/catch so a single broken upgrade
// never breaks the rest of the analyzer.
// ============================================================
(function() {
    'use strict';

    // ============================================================
    // Shared constants / config
    // ============================================================
    window.ANALYSIS_CACHE_DB       = 'backrank-analysis-cache';
    window.ANALYSIS_CACHE_STORE    = 'positions';
    window.ANALYSIS_CACHE_VERSION  = 'analysis-v2';
    window.ANALYSIS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

    window.USE_BACKEND_ANALYSIS = false;
    window.BACKEND_ANALYSIS_URL = 'http://localhost:3000/api/analyze-position';
    window.BACKEND_ANALYSIS_TIMEOUT_MS = 8000;

    window.USE_TABLEBASE   = false;
    window.TABLEBASE_API_URL = 'https://tablebase.lichess.ovh/standard';

    // tablebase results, parallel to analysisHistory
    window.analysisTablebase = window.analysisTablebase || [];

    // ============================================================
    // PART 1 — ANALYSIS CACHE
    // ============================================================
    window.getAnalysisFenKey = function getAnalysisFenKey(fen) {
        if (!fen) return '';
        // include board, side to move, castling, en passant
        return fen.split(' ').slice(0, 4).join(' ');
    };

    var _cacheDbPromise = null;
    var _cacheDisabled  = false;
    var _cacheUsingLs   = false;
    var LS_CACHE_PREFIX = 'backrank-ac:';

    function _lsKey(key) { return LS_CACHE_PREFIX + key; }

    function _openIndexedDb() {
        return new Promise(function(resolve, reject) {
            try {
                if (typeof indexedDB === 'undefined' || !indexedDB) {
                    reject(new Error('IndexedDB unavailable'));
                    return;
                }
                var req = indexedDB.open(ANALYSIS_CACHE_DB, 1);
                req.onupgradeneeded = function(e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(ANALYSIS_CACHE_STORE)) {
                        db.createObjectStore(ANALYSIS_CACHE_STORE, { keyPath: 'fenKey' });
                    }
                };
                req.onsuccess = function(e) { resolve(e.target.result); };
                req.onerror   = function(e) { reject(e.target.error || new Error('IDB open error')); };
                req.onblocked = function() { reject(new Error('IDB blocked')); };
            } catch (err) { reject(err); }
        });
    }

    window.openAnalysisCacheDb = function openAnalysisCacheDb() {
        if (_cacheDisabled) return Promise.resolve(null);
        if (_cacheUsingLs)  return Promise.resolve(null);
        if (_cacheDbPromise) return _cacheDbPromise;
        _cacheDbPromise = _openIndexedDb().catch(function(err) {
            console.warn('[AnalysisCache] IndexedDB unavailable, falling back to localStorage:', err && err.message);
            _cacheDbPromise = null;
            // probe localStorage
            try {
                localStorage.setItem('__br_probe__', '1');
                localStorage.removeItem('__br_probe__');
                _cacheUsingLs = true;
            } catch (e) {
                console.warn('[AnalysisCache] localStorage unavailable too, cache disabled');
                _cacheDisabled = true;
            }
            return null;
        });
        return _cacheDbPromise;
    };

    function _isValidCacheEntry(entry, requestedDepth) {
        if (!entry || typeof entry !== 'object') return false;
        if (entry.version !== ANALYSIS_CACHE_VERSION) return false;
        if (typeof entry.createdAt === 'number' &&
            (Date.now() - entry.createdAt) > ANALYSIS_CACHE_MAX_AGE_MS) return false;
        var depth = entry.depth || 0;
        var reqD  = requestedDepth || 0;
        if (depth < reqD) return false;
        return true;
    }

    window.getCachedAnalysis = function getCachedAnalysis(fen, requestedDepth) {
        var key = getAnalysisFenKey(fen);
        if (!key) return Promise.resolve(null);
        return openAnalysisCacheDb().then(function(db) {
            if (_cacheUsingLs) {
                try {
                    var raw = localStorage.getItem(_lsKey(key));
                    if (!raw) return null;
                    var entry = JSON.parse(raw);
                    return _isValidCacheEntry(entry, requestedDepth) ? entry : null;
                } catch (e) { return null; }
            }
            if (!db) return null;
            return new Promise(function(resolve) {
                try {
                    var tx = db.transaction(ANALYSIS_CACHE_STORE, 'readonly');
                    var st = tx.objectStore(ANALYSIS_CACHE_STORE);
                    var req = st.get(key);
                    req.onsuccess = function() {
                        var entry = req.result;
                        resolve(_isValidCacheEntry(entry, requestedDepth) ? entry : null);
                    };
                    req.onerror = function() { resolve(null); };
                } catch (e) { resolve(null); }
            });
        }).catch(function() { return null; });
    };

    window.saveCachedAnalysis = function saveCachedAnalysis(fen, data) {
        var key = getAnalysisFenKey(fen);
        if (!key || !data) return Promise.resolve(false);
        var entry = {
            fenKey:    key,
            fen:       fen,
            eval:      (typeof data.eval === 'number') ? data.eval : null,
            depth:     data.depth || 0,
            bestUCI:   data.bestUCI || null,
            bestSAN:   data.bestSAN || null,
            topMoves:  Array.isArray(data.topMoves) ? data.topMoves : [],
            source:    data.source || 'browser-stockfish',
            createdAt: Date.now(),
            version:   ANALYSIS_CACHE_VERSION
        };
        return openAnalysisCacheDb().then(function(db) {
            if (_cacheUsingLs) {
                try { localStorage.setItem(_lsKey(key), JSON.stringify(entry)); } catch (e) {}
                return true;
            }
            if (!db) return false;
            return new Promise(function(resolve) {
                try {
                    var tx = db.transaction(ANALYSIS_CACHE_STORE, 'readwrite');
                    var st = tx.objectStore(ANALYSIS_CACHE_STORE);
                    var req = st.put(entry);
                    req.onsuccess = function() { resolve(true); };
                    req.onerror   = function() { resolve(false); };
                } catch (e) { resolve(false); }
            });
        }).catch(function() { return false; });
    };

    window.clearAnalysisCache = function clearAnalysisCache() {
        return openAnalysisCacheDb().then(function(db) {
            if (_cacheUsingLs) {
                try {
                    var rm = [];
                    for (var i = 0; i < localStorage.length; i++) {
                        var k = localStorage.key(i);
                        if (k && k.indexOf(LS_CACHE_PREFIX) === 0) rm.push(k);
                    }
                    rm.forEach(function(k) { try { localStorage.removeItem(k); } catch(e) {} });
                    return true;
                } catch (e) { return false; }
            }
            if (!db) return false;
            return new Promise(function(resolve) {
                try {
                    var tx = db.transaction(ANALYSIS_CACHE_STORE, 'readwrite');
                    var st = tx.objectStore(ANALYSIS_CACHE_STORE);
                    var req = st.clear();
                    req.onsuccess = function() { resolve(true); };
                    req.onerror   = function() { resolve(false); };
                } catch (e) { resolve(false); }
            });
        }).catch(function() { return false; });
    };

    // ============================================================
    // PART 4 — OPTIONAL BACKEND STOCKFISH HELPER
    // ============================================================
    window.analyzePositionWithBackend = async function analyzePositionWithBackend(fen) {
        if (!window.USE_BACKEND_ANALYSIS) return null;
        if (typeof fetch === 'undefined') return null;
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = null;
        if (controller) {
            timer = setTimeout(function() {
                try { controller.abort(); } catch(e) {}
            }, window.BACKEND_ANALYSIS_TIMEOUT_MS || 8000);
        }
        try {
            var resp = await fetch(window.BACKEND_ANALYSIS_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    fen:     fen,
                    depth:   (typeof ANALYSIS_DEPTH   !== 'undefined') ? ANALYSIS_DEPTH   : 16,
                    multipv: (typeof ANALYSIS_MULTIPV !== 'undefined') ? ANALYSIS_MULTIPV : 3
                }),
                signal: controller ? controller.signal : undefined
            });
            if (timer) clearTimeout(timer);
            if (!resp.ok) { console.warn('[Backend] HTTP', resp.status); return null; }
            var data = await resp.json();
            if (!data || typeof data.eval !== 'number' || !data.bestUCI) {
                console.warn('[Backend] invalid payload');
                return null;
            }
            data.source = data.source || 'backend-stockfish';
            return data;
        } catch (err) {
            if (timer) clearTimeout(timer);
            console.warn('[Backend] analyze failed:', err && err.message);
            return null;
        }
    };

    // ============================================================
    // PART 5 — OPTIONAL TABLEBASE HELPER
    // ============================================================
    window.countPiecesInFen = function countPiecesInFen(fen) {
        if (!fen) return 0;
        var board = fen.split(' ')[0];
        var count = 0;
        for (var i = 0; i < board.length; i++) {
            if ('pnbrqkPNBRQK'.indexOf(board[i]) >= 0) count++;
        }
        return count;
    };

    window.lookupTablebase = async function lookupTablebase(fen) {
        if (!window.USE_TABLEBASE) return null;
        if (typeof fetch === 'undefined') return null;
        if (!fen || countPiecesInFen(fen) > 7) return null;
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = null;
        if (controller) timer = setTimeout(function() { try{controller.abort();}catch(e){} }, 6000);
        try {
            var url = window.TABLEBASE_API_URL + '?fen=' + encodeURIComponent(fen);
            var resp = await fetch(url, { signal: controller ? controller.signal : undefined });
            if (timer) clearTimeout(timer);
            if (!resp.ok) return null;
            var data = await resp.json();
            return data || null;
        } catch (err) {
            if (timer) clearTimeout(timer);
            console.warn('[Tablebase] lookup failed:', err && err.message);
            return null;
        }
    };

    // ============================================================
    // Hooking the cache, backend and tablebase into startFullAnalysis
    //
    // We patch startFullAnalysis to:
    //   1. before kicking off engine, pre-fill cached positions
    //      so the engine simply doesn't have to look at them
    //   2. after engine produces a bestmove, save to cache
    //   3. before engine, try backend (if enabled) for whatever
    //      is still missing
    //   4. if USE_TABLEBASE, also try tablebase first for <=7 pieces
    //
    // We also keep MultiPV info ingestion (topMoves) opportunistic
    // so the engine output is recorded into analysisTopMoves.
    // ============================================================
    function _ensureTopMovesArray() {
        if (!window.analysisTopMoves || analysisTopMoves.length !== analysisHistory.length) {
            window.analysisTopMoves = new Array(analysisHistory.length).fill(null);
        }
    }

    function _ensureTablebaseArray() {
        if (!window.analysisTablebase || analysisTablebase.length !== analysisHistory.length) {
            window.analysisTablebase = new Array(analysisHistory.length).fill(null);
        }
    }

    function _applyCacheEntryToIndex(idx, entry) {
        try {
            if (typeof entry.eval === 'number') analysisEvals[idx] = entry.eval;
            if (entry.depth)   analysisDepths[idx]   = entry.depth;
            if (entry.bestUCI) analysisBestUCI[idx]  = entry.bestUCI;
            if (entry.bestSAN) analysisBestSAN[idx]  = entry.bestSAN;
            _ensureTopMovesArray();
            if (Array.isArray(entry.topMoves) && entry.topMoves.length) {
                analysisTopMoves[idx] = entry.topMoves;
            }
        } catch (e) {}
    }

    // Wrap the original startFullAnalysis once modes.js has defined it.
    function _patchStartFullAnalysis() {
        if (typeof startFullAnalysis !== 'function') return false;
        if (startFullAnalysis.__brWrapped) return true;

        var original = startFullAnalysis;

        window.startFullAnalysis = function patchedStartFullAnalysis() {
            try {
                _savedKeys = Object.create(null);
                _ensureTopMovesArray();
                _ensureTablebaseArray();

                // Async pre-pass: fill from cache (and optionally tablebase / backend).
                // After the pre-pass, the engine will run but it will skip any
                // position we already filled (see _patchEngineSkipCached below).
                _preFillFromCacheAndStartEngine(original);
            } catch (err) {
                console.warn('[Analyzer] patched startFullAnalysis failed, using original:', err);
                try { original(); } catch (e) {}
            }
        };
        window.startFullAnalysis.__brWrapped = true;
        return true;
    }

    function _preFillFromCacheAndStartEngine(originalStart) {
        var total = analysisHistory.length;
        if (!total) { try { originalStart(); } catch(e){} return; }

        var cacheLoaded = 0;
        $('#analysisLoadingBanner').css('display','flex');
        $('#analysisLoadingText').text('Loading cached analysis...');

        // First pass: cache (always-on, fast).
        var promises = [];
        for (var i = 0; i < total; i++) {
            (function(idx) {
                promises.push(
                    getCachedAnalysis(analysisHistory[idx].fen, ANALYSIS_DEPTH).then(function(entry) {
                        if (entry) {
                            _applyCacheEntryToIndex(idx, entry);
                            cacheLoaded++;
                            $('#analysisLoadingText').text('Loaded cached analysis ' + cacheLoaded + ' of ' + total);
                        }
                    }).catch(function(){})
                );
            })(i);
        }

        Promise.all(promises).then(function() {
            try {
                if (cacheLoaded > 0) {
                    // Refresh UI with anything we got from the cache.
                    if (typeof computeAnnotations === 'function') computeAnnotations();
                    if (typeof renderAnalysisPosition === 'function') renderAnalysisPosition();
                    if (typeof renderEvaluationGraph === 'function') renderEvaluationGraph();
                }
            } catch (e) {}

            // Second pass (optional): backend + tablebase for what's still missing.
            _optionalRemotePass(0, function() {
                try {
                    if (typeof computeAnnotations === 'function') computeAnnotations();
                    if (typeof renderAnalysisPosition === 'function') renderAnalysisPosition();
                    if (typeof renderEvaluationGraph === 'function') renderEvaluationGraph();
                } catch (e) {}

                // If everything is already filled from cache/backend/tablebase,
                // skip the engine entirely.
                if (_allPositionsHaveEvals()) {
                    $('#analysisLoadingText').text('Loaded from cache.');
                    setTimeout(function(){ $('#analysisLoadingBanner').hide(); }, 400);
                    try { if (typeof computeAnnotations === 'function') computeAnnotations(); } catch (e) {}
                    try { if (typeof renderAnalysisPosition === 'function') renderAnalysisPosition(); } catch (e) {}
                    try { if (typeof renderEvaluationGraph === 'function') renderEvaluationGraph(); } catch (e) {}
                    try { _updateRetryMistakesBtn(); } catch (e) {}
                    return;
                }

                // Run the engine, then wrap analysisWorker.postMessage so any
                // position we ALREADY have a cached eval for is skipped by
                // synthesising a fake "bestmove" reply (no engine time wasted).
                try { originalStart(); } catch (e) { console.warn('[Analyzer] original start failed', e); }
                _installEngineSkip();
            });
        }).catch(function() {
            try { originalStart(); } catch (e) {}
            _installEngineSkip();
        });
    }

    function _allPositionsHaveEvals() {
        if (!analysisEvals || !analysisHistory) return false;
        for (var i = 0; i < analysisHistory.length; i++) {
            var v = analysisEvals[i];
            if (v === null || typeof v === 'undefined') return false;
        }
        return true;
    }

    // After originalStart has assigned the new worker to window.analysisWorker,
    // we wrap its postMessage so that for any position where analysisEvals[i]
    // is already filled, we never tell the engine to "go" — instead we
    // immediately fire a synthetic "bestmove" message so the engine loop
    // advances to the next position. This is what gives the cache its real
    // speed win on a re-analysis.
    function _installEngineSkip() {
        var worker = window.analysisWorker;
        if (!worker || worker.__brSkipInstalled) return;
        worker.__brSkipInstalled = true;

        var origPost = worker.postMessage.bind(worker);
        var lastFenSent = null;

        worker.postMessage = function(msg) {
            try {
                if (typeof msg === 'string') {
                    if (msg.indexOf('position fen ') === 0) {
                        lastFenSent = msg.slice('position fen '.length);
                    } else if (msg.indexOf('go ') === 0 && lastFenSent) {
                        // Find which history index this FEN corresponds to.
                        var idx = -1;
                        for (var i = 0; i < analysisHistory.length; i++) {
                            if (analysisHistory[i].fen === lastFenSent) { idx = i; break; }
                        }
                        if (idx >= 0 &&
                            analysisEvals[idx] !== null &&
                            typeof analysisEvals[idx] !== 'undefined' &&
                            (analysisDepths[idx] || 0) >= ANALYSIS_DEPTH) {
                            // Skip: synthesise bestmove directly.
                            var uci = analysisBestUCI[idx] || '0000';
                            var fakeLine = 'bestmove ' + uci;
                            // Defer to the next tick so the engine handler sees it.
                            setTimeout(function() {
                                try {
                                    if (typeof worker.onmessage === 'function') {
                                        worker.onmessage({ data: fakeLine });
                                    }
                                } catch (e) { console.warn('[EngineSkip] dispatch failed', e); }
                            }, 0);
                            lastFenSent = null;
                            return; // Do not actually send "go" to the engine.
                        }
                    }
                }
            } catch (e) {
                console.warn('[EngineSkip] passthrough on error', e);
            }
            return origPost(msg);
        };
    }

    async function _optionalRemotePass(startIdx, done) {
        if (!window.USE_BACKEND_ANALYSIS && !window.USE_TABLEBASE) { done(); return; }
        var total = analysisHistory.length;
        for (var i = startIdx; i < total; i++) {
            // Skip if cache already filled it.
            if (analysisEvals[i] !== null && typeof analysisEvals[i] !== 'undefined') continue;
            var fen = analysisHistory[i].fen;

            // Tablebase first for tiny endgames.
            if (window.USE_TABLEBASE && countPiecesInFen(fen) <= 7) {
                try {
                    var tb = await lookupTablebase(fen);
                    if (tb) {
                        _ensureTablebaseArray();
                        analysisTablebase[i] = tb;
                        if (Array.isArray(tb.moves) && tb.moves.length) {
                            var bm = tb.moves[0];
                            analysisBestUCI[i] = bm.uci || analysisBestUCI[i];
                            analysisBestSAN[i] = bm.san || analysisBestSAN[i];
                        }
                        // Synthesize a coarse eval from category for the graph.
                        var sideToMoveBlack = (fen.indexOf(' b ') > -1);
                        var sign = sideToMoveBlack ? -1 : 1;
                        var cp = null;
                        if (tb.category === 'win')  cp = sign * 9000;
                        else if (tb.category === 'loss') cp = -sign * 9000;
                        else if (tb.category === 'draw') cp = 0;
                        if (cp !== null) {
                            analysisEvals[i]  = cp;
                            analysisDepths[i] = analysisDepths[i] || 99;
                        }
                        saveCachedAnalysis(fen, {
                            eval: analysisEvals[i], depth: 99,
                            bestUCI: analysisBestUCI[i], bestSAN: analysisBestSAN[i],
                            topMoves: [], source: 'tablebase'
                        });
                        $('#analysisLoadingText').text('Tablebase ' + (i + 1) + ' of ' + total);
                        continue;
                    }
                } catch (e) {}
            }

            // Backend Stockfish.
            if (window.USE_BACKEND_ANALYSIS) {
                try {
                    var be = await analyzePositionWithBackend(fen);
                    if (be) {
                        analysisEvals[i]    = be.eval;
                        analysisDepths[i]   = be.depth || analysisDepths[i];
                        analysisBestUCI[i]  = be.bestUCI || analysisBestUCI[i];
                        analysisBestSAN[i]  = be.bestSAN || analysisBestSAN[i];
                        _ensureTopMovesArray();
                        if (Array.isArray(be.topMoves)) analysisTopMoves[i] = be.topMoves;
                        saveCachedAnalysis(fen, {
                            eval: be.eval, depth: be.depth,
                            bestUCI: be.bestUCI, bestSAN: be.bestSAN,
                            topMoves: be.topMoves, source: 'backend-stockfish'
                        });
                        $('#analysisLoadingText').text('Backend ' + (i + 1) + ' of ' + total);
                    }
                } catch (e) {}
            }
        }
        done();
    }

    // ------------------------------------------------------------
    // Hook into the engine's "bestmove" handling to save results to
    // the cache, capture MultiPV info, refresh the eval graph, and
    // show the "Retry Mistakes" button when analysis is finished.
    // We do that by patching the closely-related rendering hooks
    // that the original startFullAnalysis already calls.
    // ------------------------------------------------------------
    function _patchRenderHooks() {
        // Wrap renderAnalysisPosition
        if (typeof renderAnalysisPosition === 'function' && !renderAnalysisPosition.__brWrapped) {
            var origRP = renderAnalysisPosition;
            window.renderAnalysisPosition = function() {
                var r = origRP.apply(this, arguments);
                try { renderEvaluationGraph(); } catch (e) {}
                return r;
            };
            window.renderAnalysisPosition.__brWrapped = true;
        }
        // Wrap renderAnalysisMoveList
        if (typeof renderAnalysisMoveList === 'function' && !renderAnalysisMoveList.__brWrapped) {
            var origRM = renderAnalysisMoveList;
            window.renderAnalysisMoveList = function() {
                var r = origRM.apply(this, arguments);
                try { renderEvaluationGraph(); } catch (e) {}
                try { _updateRetryMistakesBtn(); } catch (e) {}
                try { _maybeHideLoadingBanner(); } catch (e) {}
                return r;
            };
            window.renderAnalysisMoveList.__brWrapped = true;
        }
        // Wrap computeAnnotations
        if (typeof computeAnnotations === 'function' && !computeAnnotations.__brWrapped) {
            var origCA = computeAnnotations;
            window.computeAnnotations = function() {
                var r = origCA.apply(this, arguments);
                try { _saveLatestToCache(); } catch (e) {}
                try { renderEvaluationGraph(); } catch (e) {}
                try { _updateRetryMistakesBtn(); } catch (e) {}
                try { _maybeHideLoadingBanner(); } catch (e) {}
                return r;
            };
            window.computeAnnotations.__brWrapped = true;
        }
    }

    // Safety net: if every position now has an eval, force-hide the loading
    // banner. Belt-and-suspenders for cases where the original evaluateNext()
    // path doesn't fire its own hide() (e.g. when we've cache-skipped the last
    // position via the synthesised bestmove path).
    function _maybeHideLoadingBanner() {
        if (!analysisHistory || !analysisHistory.length) return;
        if (_allPositionsHaveEvals()) {
            $('#analysisLoadingBanner').hide();
        }
    }

    // After each computeAnnotations call we persist any newly-evaluated
    // positions to the cache (we track which ones we've already saved
    // this session so we don't replay 80 saves on every bestmove).
    var _savedKeys = Object.create(null);
    function _saveLatestToCache() {
        if (!analysisHistory) return;
        _ensureTopMovesArray();
        for (var i = 0; i < analysisHistory.length; i++) {
            var ev = analysisEvals[i];
            if (ev === null || typeof ev === 'undefined') continue;
            var fen = analysisHistory[i].fen;
            var key = getAnalysisFenKey(fen) + '@' + (analysisDepths[i] || 0);
            if (_savedKeys[key]) continue;
            _savedKeys[key] = true;
            saveCachedAnalysis(fen, {
                eval:     ev,
                depth:    analysisDepths[i] || 0,
                bestUCI:  analysisBestUCI[i] || null,
                bestSAN:  analysisBestSAN[i] || null,
                topMoves: analysisTopMoves ? (analysisTopMoves[i] || []) : [],
                source:   'browser-stockfish'
            });
        }
    }

    // ============================================================
    // PART 2 — EVALUATION GRAPH
    // ============================================================
    var _evalGraphClickBound = false;
    function _ensureEvalGraphContainer() {
        if (!$('#analysisOverlay').length) return null;

        if (!$('#analysisEvalGraphContainer').length) {
            var html =
                '<div id="analysisEvalGraphContainer" class="analysis-eval-graph-container">' +
                    '<div class="eval-graph-title">Evaluation Graph</div>' +
                    '<canvas id="analysisEvalGraph" width="360" height="120"></canvas>' +
                '</div>';
            var $list = $('#analysisMoveList');
            if ($list.length) $list.after(html);
            else              $('.analysis-right-panel').append(html);
        }

        if (!_evalGraphClickBound) {
            $(document).on('click', '#analysisEvalGraph', _onEvalGraphClick);
            _evalGraphClickBound = true;
        }
        return $('#analysisEvalGraphContainer');
    }

    function _onEvalGraphClick(e) {
        if (!analysisHistory || analysisHistory.length < 2) return;
        var canvas = e.currentTarget;
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left) * (canvas.width / rect.width);
        var n = analysisHistory.length;
        var idx = Math.round((x / canvas.width) * (n - 1));
        if (idx < 0) idx = 0;
        if (idx > n - 1) idx = n - 1;
        window.analysisMoveIndex = idx;
        try { renderAnalysisPosition(); } catch (err) {}
    }

    window.renderEvaluationGraph = function renderEvaluationGraph() {
        try {
            var $cont = _ensureEvalGraphContainer();
            if (!$cont) return;
            var canvas = document.getElementById('analysisEvalGraph');
            if (!canvas || !canvas.getContext) return;

            // Match canvas internal resolution to displayed size for crispness.
            var displayedW = canvas.clientWidth  || 360;
            var displayedH = canvas.clientHeight || 120;
            if (canvas.width !== displayedW)  canvas.width  = displayedW;
            if (canvas.height !== displayedH) canvas.height = displayedH;

            var ctx = canvas.getContext('2d');
            var W = canvas.width, H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            // Theme-aware colors.
            var isLight = $('body').hasClass('light');
            var bgTop    = isLight ? 'rgba(220, 240, 230, 0.65)' : 'rgba(34, 197, 94, 0.18)';
            var bgBot    = isLight ? 'rgba(255, 222, 222, 0.65)' : 'rgba(239, 68, 68, 0.18)';
            var midLine  = isLight ? 'rgba(0, 0, 0, 0.25)'       : 'rgba(255, 255, 255, 0.25)';
            var lineCol  = isLight ? 'rgba(15, 23, 42, 0.85)'    : 'rgba(248, 250, 252, 0.9)';
            var fillCol  = isLight ? 'rgba(15, 23, 42, 0.10)'    : 'rgba(248, 250, 252, 0.10)';

            // Background bands (white-good top, black-good bottom)
            ctx.fillStyle = bgTop;
            ctx.fillRect(0, 0, W, H / 2);
            ctx.fillStyle = bgBot;
            ctx.fillRect(0, H / 2, W, H / 2);

            // Center line
            ctx.strokeStyle = midLine;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, H / 2);
            ctx.lineTo(W, H / 2);
            ctx.stroke();

            if (!analysisHistory || analysisHistory.length < 2) return;

            var n = analysisHistory.length;
            function xAt(i) { return (n === 1) ? 0 : (i / (n - 1)) * (W - 2) + 1; }
            function yAt(cp) {
                var c = (typeof capEval === 'function') ? capEval(cp) : Math.max(-1000, Math.min(1000, cp || 0));
                // +1000 = top, -1000 = bottom
                var t = (c + 1000) / 2000; // 0..1
                t = 1 - t;                  // invert so +1000 is top
                return t * (H - 4) + 2;
            }

            // Build interpolated points: skip null evals.
            var pts = [];
            for (var i = 0; i < n; i++) {
                var ev = analysisEvals[i];
                if (ev === null || typeof ev === 'undefined' || isNaN(ev)) continue;
                pts.push({ i: i, x: xAt(i), y: yAt(ev), cp: ev });
            }
            if (pts.length === 0) return;

            // Filled area
            ctx.beginPath();
            ctx.moveTo(pts[0].x, H / 2);
            for (var p = 0; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
            ctx.lineTo(pts[pts.length - 1].x, H / 2);
            ctx.closePath();
            ctx.fillStyle = fillCol;
            ctx.fill();

            // Line
            ctx.beginPath();
            ctx.strokeStyle = lineCol;
            ctx.lineWidth = 1.6;
            for (var q = 0; q < pts.length; q++) {
                if (q === 0) ctx.moveTo(pts[q].x, pts[q].y);
                else         ctx.lineTo(pts[q].x, pts[q].y);
            }
            ctx.stroke();

            // Annotation markers
            var markerColor = {
                'brilliant':  '#0ea5e9',
                'mistake':    '#f97316',
                'blunder':    '#ef4444',
                'inaccuracy': '#f59e0b'
            };
            for (var k = 0; k < n; k++) {
                var ann = analysisAnnotations && analysisAnnotations[k];
                if (!ann || !markerColor[ann]) continue;
                var ev2 = analysisEvals[k];
                if (ev2 === null || typeof ev2 === 'undefined') continue;
                var cx = xAt(k), cy = yAt(ev2);
                ctx.beginPath();
                if (ann === 'brilliant') {
                    // small star-ish: draw two triangles
                    _drawStar(ctx, cx, cy, 4.5, 2);
                    ctx.fillStyle = markerColor[ann];
                    ctx.fill();
                } else {
                    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = markerColor[ann];
                    ctx.fill();
                }
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }

            // Current-move highlight
            var ci = analysisMoveIndex;
            if (ci >= 0 && ci < n) {
                var cev = analysisEvals[ci];
                if (cev !== null && typeof cev !== 'undefined') {
                    var ccx = xAt(ci), ccy = yAt(cev);
                    ctx.beginPath();
                    ctx.arc(ccx, ccy, 5, 0, Math.PI * 2);
                    ctx.strokeStyle = isLight ? '#0f172a' : '#f8fafc';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    // vertical guide
                    ctx.beginPath();
                    ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.35)' : 'rgba(248,250,252,0.35)';
                    ctx.setLineDash([3, 3]);
                    ctx.moveTo(ccx, 0);
                    ctx.lineTo(ccx, H);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        } catch (err) {
            // Never break analysis
            console.warn('[EvalGraph] render failed:', err);
        }
    };

    function _drawStar(ctx, cx, cy, outerR, innerR) {
        var spikes = 5;
        var rot = Math.PI / 2 * 3;
        var x = cx, y = cy;
        var step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerR);
        for (var i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerR;
            y = cy + Math.sin(rot) * outerR;
            ctx.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerR;
            y = cy + Math.sin(rot) * innerR;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerR);
        ctx.closePath();
    }

    // ============================================================
    // PART 3 — RETRY MISTAKES MODE
    // ============================================================
    window.retryMistakes = [];
    window.retryIndex    = 0;
    window.retryGame     = new Chess();
    window.retryBoard    = null;
    window.retryState    = 'idle';

    function _hasRetryableMistakes() {
        if (!analysisAnnotations) return false;
        for (var i = 1; i < analysisAnnotations.length; i++) {
            var a = analysisAnnotations[i];
            if (a === 'mistake' || a === 'blunder' || a === 'inaccuracy') return true;
        }
        return false;
    }

    var _retryBtnBound = false;
    function _updateRetryMistakesBtn() {
        // Insert button into right panel if missing.
        if (!$('#retryMistakesBtn').length) {
            var btn = '<button id="retryMistakesBtn" class="btn-primary" style="margin:10px 12px;display:none;">' +
                      '<i class="ph ph-arrow-counter-clockwise"></i> Retry Mistakes</button>';
            var $row = $('.analysis-nav-buttons');
            if ($row.length) $row.before(btn);
            else $('.analysis-right-panel').append(btn);
        }
        if (!_retryBtnBound) {
            $(document).on('click', '#retryMistakesBtn', function() { window.openRetryMistakes(); });
            _retryBtnBound = true;
        }
        if (_hasRetryableMistakes()) $('#retryMistakesBtn').show();
        else                          $('#retryMistakesBtn').hide();
    }

    window.buildRetryMistakes = function buildRetryMistakes() {
        window.retryMistakes = [];
        if (!analysisAnnotations || !analysisHistory) return;
        for (var i = 1; i < analysisHistory.length; i++) {
            var a = analysisAnnotations[i];
            if (a !== 'mistake' && a !== 'blunder' && a !== 'inaccuracy') continue;

            // Respect the analysis perspective so a "White perspective"
            // session only retries White's mistakes (and vice-versa).
            if (typeof moveIsForPerspective === 'function' && !moveIsForPerspective(i)) continue;

            window.retryMistakes.push({
                moveIdx:     i,
                fenBefore:   analysisHistory[i - 1].fen,
                playedSAN:   analysisHistory[i].san,
                bestUCI:     analysisBestUCI[i - 1],
                bestSAN:     analysisBestSAN[i - 1],
                annotation:  a,
                pv:          (analysisTopMoves && analysisTopMoves[i - 1] && analysisTopMoves[i - 1][0] && analysisTopMoves[i - 1][0].pv) || [],
                explanation: (analysisExplanations && analysisExplanations[i]) || ''
            });
        }
    };

    // Pick the most useful starting mistake when the user opens Retry from a
    // specific move: jump to the mistake nearest the current move index,
    // preferring one at or after the current position so the user can keep
    // their flow.
    function _pickStartingRetryIndex() {
        if (!window.retryMistakes.length) return 0;
        var cur = (typeof analysisMoveIndex === 'number') ? analysisMoveIndex : 0;
        // First try: exact match.
        for (var i = 0; i < window.retryMistakes.length; i++) {
            if (window.retryMistakes[i].moveIdx === cur) return i;
        }
        // Then: first mistake at or after the current move.
        for (var j = 0; j < window.retryMistakes.length; j++) {
            if (window.retryMistakes[j].moveIdx >= cur) return j;
        }
        // Otherwise: nearest mistake before the current move (last one).
        return window.retryMistakes.length - 1;
    }

    function _ensureRetryOverlay() {
        if ($('#retryOverlay').length) return;
        var html =
            '<div id="retryOverlay" class="retry-overlay">' +
                '<div class="retry-content">' +
                    '<div class="retry-header">' +
                        '<h2><i class="ph ph-target"></i> Retry Mistakes</h2>' +
                        '<button id="closeRetryBtn" title="Close">&times;</button>' +
                    '</div>' +
                    '<div class="retry-progress" id="retryProgress">Mistake 0 of 0</div>' +
                    '<div id="retryStatus">Find the best move</div>' +
                    '<div id="retryBoardWrap"><div id="retryBoard"></div></div>' +
                    '<div id="retryExplanation"></div>' +
                    '<div class="retry-actions">' +
                        '<button id="retryHintBtn" class="btn-outline"><i class="ph ph-lightbulb"></i> Hint</button>' +
                        '<button id="retryShowSolutionBtn" class="btn-outline"><i class="ph ph-eye"></i> Show Solution</button>' +
                        '<button id="retryNextBtn" class="btn-primary">Next <i class="ph ph-arrow-right"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        $('body').append(html);
        $('#closeRetryBtn').on('click', window.closeRetryMistakes);
        $('#retryHintBtn').on('click', _retryHint);
        $('#retryShowSolutionBtn').on('click', _retryShowSolution);
        $('#retryNextBtn').on('click', _retryNext);
        $('#retryOverlay').on('click', function(e) {
            if ($(e.target).is('#retryOverlay')) window.closeRetryMistakes();
        });
    }

    window.openRetryMistakes = function openRetryMistakes() {
        try {
            buildRetryMistakes();
            if (!window.retryMistakes.length) {
                alert('No mistakes to retry! Great game.');
                return;
            }
            _ensureRetryOverlay();
            window.retryIndex = _pickStartingRetryIndex();
            $('#retryOverlay').addClass('open');
            // Defer init for layout
            setTimeout(function() {
                if (window.retryBoard) {
                    try { window.retryBoard.destroy(); } catch (e) {}
                    window.retryBoard = null;
                }
                window.retryBoard = Chessboard('retryBoard', {
                    pieceTheme: getPieceTheme(pieceThemeStyle),
                    draggable:  true,
                    position:   'start',
                    onDragStart:_onRetryDragStart,
                    onDrop:     window.onRetryDrop,
                    onSnapEnd:  _onRetrySnapEnd
                });
                $(window).on('resize.retry', function() {
                    if (window.retryBoard) window.retryBoard.resize();
                });
                window.loadRetryPosition();
            }, 50);
        } catch (err) {
            console.warn('[Retry] open failed:', err);
        }
    };

    window.closeRetryMistakes = function closeRetryMistakes() {
        $('#retryOverlay').removeClass('open');
        $(window).off('resize.retry');
        $('#retryArrow').remove();
        if (window.retryBoard) {
            try { window.retryBoard.destroy(); } catch (e) {}
            window.retryBoard = null;
        }
        window.retryState = 'idle';
    };

    window.loadRetryPosition = function loadRetryPosition() {
        var item = window.retryMistakes[window.retryIndex];
        if (!item) {
            $('#retryStatus').text('All mistakes reviewed!');
            $('#retryExplanation').text('Nice work. Close to return to analysis.');
            $('#retryProgress').text('Done');
            return;
        }
        try { window.retryGame.load(item.fenBefore); } catch (e) {}
        var turnIsWhite = (item.fenBefore.indexOf(' w ') > -1);
        window.retryBoard.orientation(turnIsWhite ? 'white' : 'black');
        window.retryBoard.position(item.fenBefore, false);
        window.retryState = 'playing';
        $('#retryArrow').remove();
        var moveNumber = Math.ceil(item.moveIdx / 2);
        var sideLabel  = (item.moveIdx % 2 === 1) ? 'White' : 'Black';
        $('#retryProgress').text('Mistake ' + (window.retryIndex + 1) + ' of ' + window.retryMistakes.length +
            ' · Move ' + moveNumber + ' (' + sideLabel + ')');
        var annLabel = item.annotation ? item.annotation.charAt(0).toUpperCase() + item.annotation.slice(1) : 'Mistake';
        $('#retryStatus').html('You played <strong>' + (item.playedSAN || '?') + '</strong> (' + annLabel + '). Find the better move for ' + sideLabel + '.');
        $('#retryExplanation').text(item.explanation || '');
    };

    function _onRetryDragStart(source, piece) {
        if (window.retryState !== 'playing' || window.retryGame.game_over()) return false;
        var turn = window.retryGame.turn();
        if (turn === 'w' && piece.search(/^b/) !== -1) return false;
        if (turn === 'b' && piece.search(/^w/) !== -1) return false;
    }

    function _onRetrySnapEnd() {
        if (window.retryBoard) window.retryBoard.position(window.retryGame.fen());
    }

    window.onRetryDrop = function onRetryDrop(source, target) {
        var item = window.retryMistakes[window.retryIndex];
        if (!item) return 'snapback';
        var move = window.retryGame.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';
        var playedUCI = source + target + (move.promotion || '');

        if (item.bestUCI && playedUCI === item.bestUCI) {
            // Correct
            window.retryState = 'solved';
            $('#retryStatus').html('<span style="color:#10b981;font-weight:700;">✓ Correct!</span> ' +
                '<strong>' + (item.bestSAN || item.bestUCI) + '</strong> is the best move.');
            if (item.explanation) $('#retryExplanation').text(item.explanation);
            window.retryBoard.position(window.retryGame.fen());
            // Optional opponent reply from PV
            if (Array.isArray(item.pv) && item.pv.length > 1) {
                setTimeout(function() {
                    try {
                        var oppUci = item.pv[1];
                        if (!oppUci) return;
                        var mv = window.retryGame.move({
                            from: oppUci.slice(0, 2),
                            to:   oppUci.slice(2, 4),
                            promotion: oppUci[4] || undefined
                        });
                        if (mv) window.retryBoard.position(window.retryGame.fen());
                    } catch (e) {}
                }, 500);
            }
            return;
        }

        // Wrong: undo and tell the user
        window.retryGame.undo();
        window.retryBoard.position(window.retryGame.fen());
        $('#retryStatus').html('<span style="color:#ef4444;font-weight:700;">Not best.</span> Try again.');
        return 'snapback';
    };

    function _retryHint() {
        var item = window.retryMistakes[window.retryIndex];
        if (!item || !item.bestUCI) return;
        var fromSq = item.bestUCI.slice(0, 2);
        $('#retryBoard .square-55d63').removeClass('puzzle-hint');
        $('#retryBoard .square-' + fromSq).addClass('puzzle-hint');
        $('#retryStatus').text('Hint: move the highlighted piece.');
    }

    function _retryShowSolution() {
        var item = window.retryMistakes[window.retryIndex];
        if (!item || !item.bestUCI) return;
        window.retryState = 'shown';
        $('#retryStatus').html('Solution: <strong>' + (item.bestSAN || item.bestUCI) + '</strong>');
        _drawRetryArrow(item.bestUCI);
    }

    function _retryNext() {
        if (window.retryIndex < window.retryMistakes.length - 1) {
            window.retryIndex++;
            window.loadRetryPosition();
        } else {
            $('#retryStatus').text('All mistakes reviewed! Nice work.');
            $('#retryExplanation').text('');
            $('#retryProgress').text('Done');
        }
    }

    function _drawRetryArrow(uci) {
        $('#retryArrow').remove();
        if (!uci || uci.length < 4 || !window.retryBoard) return;
        var fromSq = uci.slice(0, 2), toSq = uci.slice(2, 4);
        var $board = $('#retryBoard');
        var boardW = $board.width(), sqSize = boardW / 8;
        var isFlipped = (window.retryBoard.orientation() === 'black');
        function sqToXY(sq) {
            var file = sq.charCodeAt(0) - 97, rank = parseInt(sq[1]) - 1;
            var col = isFlipped ? (7 - file) : file;
            var row = isFlipped ? rank : (7 - rank);
            return { x: col * sqSize + sqSize / 2, y: row * sqSize + sqSize / 2 };
        }
        var from = sqToXY(fromSq), to = sqToXY(toSq);
        var svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.id = 'retryArrow';
        svg.setAttribute('width',  boardW);
        svg.setAttribute('height', boardW);
        svg.style.position = 'absolute';
        svg.style.top = '0'; svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '10';
        var line = document.createElementNS(svgNS, 'line');
        var dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx*dx + dy*dy);
        var shorten = sqSize * 0.38;
        var ex = to.x - dx / len * shorten, ey = to.y - dy / len * shorten;
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
        line.setAttribute('x2', ex);     line.setAttribute('y2', ey);
        line.setAttribute('stroke', 'rgba(14,165,233,0.9)');
        line.setAttribute('stroke-width', sqSize * 0.16);
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
        var $wrap = $('#retryBoardWrap'); $wrap.css('position', 'relative');
        var wrapOff = $wrap.offset(), boardOff = $board.offset();
        svg.style.left = (boardOff.left - wrapOff.left) + 'px';
        svg.style.top  = (boardOff.top  - wrapOff.top)  + 'px';
        $wrap.append(svg);
    }

    // ============================================================
    // Clear cache button (added near the Load PGN button)
    // ============================================================
    function _ensureClearCacheBtn() {
        if ($('#clearAnalysisCacheBtn').length) return;
        var $loadBtn = $('#loadPgnBtn');
        if (!$loadBtn.length) return;
        var btn = $('<button id="clearAnalysisCacheBtn" class="btn-outline" title="Clear analysis cache" ' +
                    'style="padding:4px 10px;font-size:11px;font-weight:700;margin-left:6px;">' +
                    '<i class="ph ph-trash"></i> Clear Cache</button>');
        $loadBtn.after(btn);
        btn.on('click', function() {
            clearAnalysisCache().then(function(ok) {
                _toast(ok ? 'Analysis cache cleared.' : 'Cache clear failed.');
            });
        });
    }

    function _toast(msg) {
        var $t = $('#brToast');
        if (!$t.length) {
            $t = $('<div id="brToast" class="br-toast"></div>');
            $('body').append($t);
        }
        $t.text(msg).addClass('show');
        clearTimeout(window.__brToastT);
        window.__brToastT = setTimeout(function() { $t.removeClass('show'); }, 2000);
    }

    // ============================================================
    // Boot — patch existing functions when DOM is ready.
    // ============================================================
    function _boot() {
        try {
            _patchStartFullAnalysis();
            _patchRenderHooks();
            _ensureClearCacheBtn();
            _ensureEvalGraphContainer();
            _updateRetryMistakesBtn();
            // Warm up the IDB connection lazily so first cache hit is fast.
            openAnalysisCacheDb();
        } catch (err) {
            console.warn('[AnalyzerUpgrades] boot failed:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        // Run after the current tick so modes.js is fully evaluated.
        setTimeout(_boot, 0);
    }
})();
