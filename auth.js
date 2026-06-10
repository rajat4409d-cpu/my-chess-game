// ============================================================
// BACKRANK CHESS — Phase 2 Hybrid Account System
// Uses real backend + MongoDB when API is available.
// Falls back to Phase 1 localStorage accounts when API is unavailable.
// ============================================================
(function() {
    'use strict';

    // Public deployed backend.
    // If you temporarily set a custom API URL in localStorage, we use it.
    // But on GitHub Pages, ignore old localhost overrides because visitors cannot access your computer.
    var savedApiBase = localStorage.getItem('backrank-api-base') || '';
    if (location.hostname.indexOf('github.io') !== -1 && /^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(savedApiBase)) {
        localStorage.removeItem('backrank-api-base');
        savedApiBase = '';
    }
    var API_BASE = (savedApiBase || 'https://backrank-chess-api.onrender.com').replace(/\/$/, '');

    var ACCOUNTS_KEY = 'backrank-phase1-accounts';
    var CURRENT_LOCAL_USER_KEY = 'backrank-phase1-current-user';
    var TOKEN_KEY = 'backrank-auth-token';
    var BACKEND_USER_KEY = 'backrank-auth-user';

    var authMode = 'checking'; // checking | backend | local
    var token = localStorage.getItem(TOKEN_KEY) || '';
    var currentUser = readJson(localStorage.getItem(BACKEND_USER_KEY), null) || readJson(localStorage.getItem(CURRENT_LOCAL_USER_KEY), null);
    var saveTimer = null;
    var lastGameSavedAt = 0;

    function readJson(raw, fallback) {
        try { return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; }
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj || {}));
    }

    function defaultSessionStats() {
        return {
            played: 0, wins: 0, losses: 0, draws: 0,
            streak: 0, bestStreak: 0, resignations: 0,
            checkmates: 0, analyzed: 0, gameHistory: []
        };
    }

    function defaultPuzzleStats() {
        return { attempted: 0, solved: 0, failed: 0, streak: 0, bestStreak: 0 };
    }

    function dateReviveGameHistory(stats) {
        if (!stats || !Array.isArray(stats.gameHistory)) return stats;
        stats.gameHistory.forEach(function(g) {
            if (g && g.timestamp && !(g.timestamp instanceof Date)) g.timestamp = new Date(g.timestamp);
        });
        return stats;
    }

    function getCleanSessionStats() {
        if (typeof window.sessionStats === 'undefined') return defaultSessionStats();
        return clone(window.sessionStats);
    }

    function getCleanPuzzleStats() {
        if (typeof window.puzzleStats === 'undefined') return defaultPuzzleStats();
        return clone(window.puzzleStats);
    }

    function notify(message, type) {
        var $toast = $('#accountToast');
        if (!$toast.length) {
            $('body').append('<div id="accountToast" class="account-toast"></div>');
            $toast = $('#accountToast');
        }
        $toast.removeClass('success error info').addClass(type || 'info').text(message).addClass('show');
        clearTimeout(notify._t);
        notify._t = setTimeout(function() { $toast.removeClass('show'); }, 2800);
    }

    async function api(path, options) {
        options = options || {};
        var headers = options.headers || {};
        headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = 'Bearer ' + token;

        var res = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
        var data = {};
        try { data = await res.json(); } catch(e) {}
        if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
        return data;
    }

    async function detectBackend() {
        try {
            var controller = new AbortController();
            var t = setTimeout(function() { controller.abort(); }, 30000);
            var res = await fetch(API_BASE + '/api/health', { signal: controller.signal });
            clearTimeout(t);
            if (res.ok) {
                authMode = 'backend';
                return true;
            }
        } catch(e) {}
        authMode = 'local';
        token = '';
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(BACKEND_USER_KEY);
        return false;
    }

    // ---------- Phase 1 local fallback helpers ----------
    function getAccounts() { return readJson(localStorage.getItem(ACCOUNTS_KEY), {}); }
    function setAccounts(accounts) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); }
    function userKey(username) { return String(username || '').trim().toLowerCase(); }
    function nowIso() { return new Date().toISOString(); }

    async function hashPassword(password) {
        // Local fallback only. Not real security. Backend uses bcrypt.
        try {
            if (window.crypto && crypto.subtle && window.TextEncoder) {
                var data = new TextEncoder().encode(password);
                var hash = await crypto.subtle.digest('SHA-256', data);
                return Array.from(new Uint8Array(hash)).map(function(b) {
                    return b.toString(16).padStart(2, '0');
                }).join('');
            }
        } catch(e) {}
        return btoa(unescape(encodeURIComponent(password)));
    }

    function getCurrentLocalAccountRecord() {
        if (!currentUser) return null;
        var accounts = getAccounts();
        return accounts[userKey(currentUser.username)] || null;
    }

    function saveLocalStatsNow() {
        if (!currentUser) return;
        var accounts = getAccounts();
        var key = userKey(currentUser.username);
        var account = accounts[key];
        if (!account) return;
        account.sessionStats = getCleanSessionStats();
        account.puzzleStats = getCleanPuzzleStats();
        account.updatedAt = nowIso();
        accounts[key] = account;
        setAccounts(accounts);
    }

    function loadLocalProfile() {
        var account = getCurrentLocalAccountRecord();
        if (!account) return;
        applyStatsToWindow(account.sessionStats || {}, account.puzzleStats || {});
    }

    // ---------- Shared profile/stat helpers ----------
    function applyStatsToWindow(sessionStats, puzzleStats) {
        if (typeof window.sessionStats !== 'undefined') {
            var s = Object.assign(defaultSessionStats(), sessionStats || {});
            dateReviveGameHistory(s);
            Object.keys(window.sessionStats).forEach(function(k) { delete window.sessionStats[k]; });
            Object.assign(window.sessionStats, s);
        }

        if (typeof window.puzzleStats !== 'undefined') {
            var p = Object.assign(defaultPuzzleStats(), puzzleStats || {});
            Object.keys(window.puzzleStats).forEach(function(k) { delete window.puzzleStats[k]; });
            Object.assign(window.puzzleStats, p);
        }

        if (typeof window.refreshHomeUI === 'function') window.refreshHomeUI();
        if (typeof window.updatePuzzleStats === 'function') window.updatePuzzleStats();
    }

    async function loadBackendProfile() {
        if (!token) return;
        var profile = await api('/api/profile');
        currentUser = profile.user;
        localStorage.setItem(BACKEND_USER_KEY, JSON.stringify(currentUser));
        applyStatsToWindow(profile.sessionStats || {}, profile.puzzleStats || {});
        updateAccountUI();
    }

    async function syncStatsNow(silent) {
        try {
            if (authMode === 'backend' && token) {
                await api('/api/profile/stats', {
                    method: 'PUT',
                    body: JSON.stringify({
                        sessionStats: getCleanSessionStats(),
                        puzzleStats: getCleanPuzzleStats()
                    })
                });
                if (!silent) notify('Stats synced to MongoDB.', 'success');
            } else {
                saveLocalStatsNow();
                if (!silent) notify('Stats saved locally.', 'success');
            }
        } catch(err) {
            console.warn('[Auth] sync failed:', err.message);
            saveLocalStatsNow();
            if (!silent) notify('Backend sync failed, saved locally instead.', 'error');
        }
    }

    function syncStatsSoon() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function() { syncStatsNow(true); }, 700);
    }

    async function saveLatestGame(result, moveCount, opponent, by) {
        var now = Date.now();
        if (now - lastGameSavedAt < 900) return;
        lastGameSavedAt = now;

        if (authMode === 'backend' && token) {
            try {
                await api('/api/games', {
                    method: 'POST',
                    body: JSON.stringify({
                        result: result,
                        moveCount: moveCount,
                        opponent: opponent || '',
                        endedBy: by || '',
                        pgn: (window.game && typeof window.game.pgn === 'function') ? window.game.pgn() : ''
                    })
                });
                return;
            } catch(err) {
                console.warn('[Auth] backend game save failed:', err.message);
            }
        }

        if (!currentUser) return;
        var accounts = getAccounts();
        var key = userKey(currentUser.username);
        var account = accounts[key];
        if (!account) return;
        if (!Array.isArray(account.games)) account.games = [];
        account.games.unshift({
            result: result,
            moveCount: moveCount,
            opponent: opponent || '',
            endedBy: by || '',
            pgn: (window.game && typeof window.game.pgn === 'function') ? window.game.pgn() : '',
            createdAt: nowIso()
        });
        account.games = account.games.slice(0, 50);
        account.updatedAt = nowIso();
        accounts[key] = account;
        setAccounts(accounts);
    }

    // ---------- UI ----------
    function updateAccountUI() {
        var signedIn = !!currentUser;
        var username = signedIn ? currentUser.username : 'Player';
        var modeText = authMode === 'backend'
            ? 'Cloud account · MongoDB sync'
            : authMode === 'checking'
                ? 'Checking account server...'
                : 'Local account · saved on this browser';

        $('.home-username').text(username);
        $('.account-user-name').text(signedIn ? username : 'Guest');
        $('.account-user-sub').text(signedIn ? modeText : (authMode === 'backend' ? 'Account server online' : 'Offline/local mode'));
        $('.account-open-btn .account-btn-text').text(signedIn ? username : 'Account');
        $('.account-open-btn').toggleClass('signed-in', signedIn);

        $('#authSignedOut').toggle(!signedIn);
        $('#authSignedIn').toggle(signedIn);
        $('#authModalUsername').text(username);
        $('#authModalEmail').text(signedIn && currentUser.email ? currentUser.email : (authMode === 'backend' ? 'Cloud account' : 'Local-only account'));
        $('#authModeBadge').text(authMode === 'backend' ? 'Backend: MongoDB' : authMode === 'checking' ? 'Checking backend...' : 'Local fallback');
        $('#saveLocalStatsBtn').html(authMode === 'backend' ? '<i class="ph ph-cloud-arrow-up"></i> Sync Stats Now' : '<i class="ph ph-floppy-disk"></i> Save Stats Now');
    }

    function injectAccountUI() {
        var navHtml = '' +
            '<div class="account-nav-card">' +
                '<button class="account-open-btn" type="button"><span class="account-avatar"><i class="ph ph-user"></i></span><span class="account-btn-text">Account</span></button>' +
                '<div class="account-user-meta"><div class="account-user-name">Guest</div><div class="account-user-sub">Checking...</div></div>' +
            '</div>';

        $('.left-nav .sidebar-bottom, .home-left-nav .sidebar-bottom, .puzzle-left-nav .sidebar-bottom, .analysis-left-nav .sidebar-bottom').each(function() {
            if (!$(this).find('.account-nav-card').length) $(this).prepend(navHtml);
        });

        if (!$('#mobileAccountBtn').length) {
            $('.mobile-topbar-spacer').after('<button class="account-mobile-btn" id="mobileAccountBtn" title="Account"><i class="ph ph-user-circle"></i></button>');
        }

        if (!$('#authModal').length) {
            $('body').append('' +
                '<div id="authModal" class="auth-modal">' +
                    '<div class="auth-content">' +
                        '<button class="auth-close" id="authCloseBtn" type="button">&times;</button>' +
                        '<div class="auth-brand"><i class="ph ph-crown"></i><div><h2>Backrank Account</h2><p><span id="authModeBadge">Checking backend...</span></p></div></div>' +
                        '<div id="authSignedOut">' +
                            '<div class="auth-tabs"><button class="auth-tab active" data-auth-tab="login">Login</button><button class="auth-tab" data-auth-tab="register">Create Account</button></div>' +
                            '<form id="loginForm" class="auth-form active">' +
                                '<label>Username or email<input id="loginName" autocomplete="username" required></label>' +
                                '<label>Password<input id="loginPassword" type="password" autocomplete="current-password" required></label>' +
                                '<button class="btn-primary auth-submit" type="submit"><i class="ph ph-sign-in"></i> Login</button>' +
                            '</form>' +
                            '<form id="registerForm" class="auth-form">' +
                                '<label>Username<input id="registerUsername" autocomplete="username" minlength="3" maxlength="20" required placeholder="letters, numbers, underscore"></label>' +
                                '<label>Email <span class="optional">optional</span><input id="registerEmail" type="email" autocomplete="email"></label>' +
                                '<label>Password<input id="registerPassword" type="password" autocomplete="new-password" minlength="6" required></label>' +
                                '<button class="btn-primary auth-submit" type="submit"><i class="ph ph-user-plus"></i> Create Account</button>' +
                            '</form>' +
                            '<div class="auth-hint">If the backend is running, this creates a real MongoDB account. If not, it falls back to a local browser account.</div>' +
                        '</div>' +
                        '<div id="authSignedIn" style="display:none;">' +
                            '<div class="signed-card"><div class="signed-avatar"><i class="ph ph-user-circle"></i></div><div><h3 id="authModalUsername">Player</h3><p id="authModalEmail">Account</p></div></div>' +
                            '<button id="saveLocalStatsBtn" class="btn-primary auth-submit" type="button"><i class="ph ph-cloud-arrow-up"></i> Sync Stats Now</button>' +
                            '<button id="logoutBtn" class="btn-outline auth-submit" type="button"><i class="ph ph-sign-out"></i> Logout</button>' +
                        '</div>' +
                    '</div>' +
                '</div>');
        }
        updateAccountUI();
    }

    function openAuthModal() { $('#authModal').addClass('open'); updateAccountUI(); }
    function closeAuthModal() { $('#authModal').removeClass('open'); }
    function setBusy(busy) { $('.auth-submit').prop('disabled', !!busy).toggleClass('loading', !!busy); }

    async function registerBackend(username, email, password) {
        var data = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: username,
                email: email,
                password: password,
                sessionStats: getCleanSessionStats(),
                puzzleStats: getCleanPuzzleStats()
            })
        });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(BACKEND_USER_KEY, JSON.stringify(currentUser));
        localStorage.removeItem(CURRENT_LOCAL_USER_KEY);
        updateAccountUI();
        closeAuthModal();
    }

    async function loginBackend(login, password) {
        var data = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ login: login, password: password })
        });
        token = data.token;
        currentUser = data.user;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(BACKEND_USER_KEY, JSON.stringify(currentUser));
        localStorage.removeItem(CURRENT_LOCAL_USER_KEY);
        await loadBackendProfile();
        updateAccountUI();
        closeAuthModal();
    }

    async function registerLocal(username, email, password) {
        var accounts = getAccounts();
        var key = userKey(username);
        if (accounts[key]) throw new Error('That username already exists on this browser.');
        if (email) {
            var emailTaken = Object.keys(accounts).some(function(k) {
                return accounts[k].email && accounts[k].email.toLowerCase() === email.toLowerCase();
            });
            if (emailTaken) throw new Error('That email already exists on this browser.');
        }
        var account = {
            username: username,
            email: email,
            passwordHash: await hashPassword(password),
            createdAt: nowIso(),
            updatedAt: nowIso(),
            sessionStats: getCleanSessionStats(),
            puzzleStats: getCleanPuzzleStats(),
            games: []
        };
        accounts[key] = account;
        setAccounts(accounts);
        currentUser = { username: account.username, email: account.email, createdAt: account.createdAt };
        localStorage.setItem(CURRENT_LOCAL_USER_KEY, JSON.stringify(currentUser));
        updateAccountUI();
        closeAuthModal();
    }

    async function loginLocal(login, password) {
        var accounts = getAccounts();
        var account = accounts[userKey(login)] || null;
        if (!account) {
            Object.keys(accounts).some(function(k) {
                if (accounts[k].email && accounts[k].email.toLowerCase() === login.toLowerCase()) {
                    account = accounts[k];
                    return true;
                }
                return false;
            });
        }
        if (!account) throw new Error('No local account found with that username/email.');
        var passwordHash = await hashPassword(password);
        if (passwordHash !== account.passwordHash) throw new Error('Incorrect password.');
        currentUser = { username: account.username, email: account.email, createdAt: account.createdAt };
        localStorage.setItem(CURRENT_LOCAL_USER_KEY, JSON.stringify(currentUser));
        loadLocalProfile();
        updateAccountUI();
        closeAuthModal();
    }

    function installEvents() {
        $(document).on('click', '.account-open-btn, #mobileAccountBtn', openAuthModal);
        $(document).on('click', '#authCloseBtn', closeAuthModal);
        $(document).on('click', '#authModal', function(e) { if (e.target === this) closeAuthModal(); });

        $(document).on('click', '.auth-tab', function() {
            var tab = $(this).data('auth-tab');
            $('.auth-tab').removeClass('active');
            $(this).addClass('active');
            $('.auth-form').removeClass('active');
            $('#' + (tab === 'register' ? 'registerForm' : 'loginForm')).addClass('active');
        });

        $(document).on('submit', '#registerForm', async function(e) {
            e.preventDefault();
            try {
                setBusy(true);
                var username = String($('#registerUsername').val() || '').trim();
                var email = String($('#registerEmail').val() || '').trim().toLowerCase();
                var password = String($('#registerPassword').val() || '');

                if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3-20 characters and use only letters, numbers, or underscore.');
                if (password.length < 6) throw new Error('Password must be at least 6 characters.');

                if (authMode === 'backend') {
                    await registerBackend(username, email, password);
                    notify('Cloud account created. MongoDB sync is on.', 'success');
                } else {
                    await registerLocal(username, email, password);
                    notify('Local account created.', 'success');
                }
            } catch(err) {
                notify(err.message || 'Could not create account.', 'error');
            } finally { setBusy(false); }
        });

        $(document).on('submit', '#loginForm', async function(e) {
            e.preventDefault();
            try {
                setBusy(true);
                var login = String($('#loginName').val() || '').trim();
                var password = String($('#loginPassword').val() || '');

                if (authMode === 'backend') {
                    await loginBackend(login, password);
                    notify('Logged in with backend account.', 'success');
                } else {
                    await loginLocal(login, password);
                    notify('Logged in locally.', 'success');
                }
            } catch(err) {
                notify(err.message || 'Login failed.', 'error');
            } finally { setBusy(false); }
        });

        $(document).on('click', '#saveLocalStatsBtn', function() { syncStatsNow(false); });

        $(document).on('click', '#logoutBtn', function() {
            syncStatsNow(true);
            currentUser = null;
            token = '';
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(BACKEND_USER_KEY);
            localStorage.removeItem(CURRENT_LOCAL_USER_KEY);
            updateAccountUI();
            notify('Logged out.', 'info');
        });

        window.addEventListener('beforeunload', function() { try { syncStatsNow(true); } catch(e) {} });
    }

    function patchStatsFunctions() {
        if (typeof window.recordGameResult === 'function' && !window.recordGameResult.__hybridPatched) {
            var originalRecordGameResult = window.recordGameResult;
            window.recordGameResult = function(result, moveCount, opponent, by) {
                var out = originalRecordGameResult.apply(this, arguments);
                syncStatsSoon();
                saveLatestGame(result, moveCount, opponent, by);
                return out;
            };
            window.recordGameResult.__hybridPatched = true;
        }

        if (typeof window.updatePuzzleStats === 'function' && !window.updatePuzzleStats.__hybridPatched) {
            var originalUpdatePuzzleStats = window.updatePuzzleStats;
            window.updatePuzzleStats = function() {
                var out = originalUpdatePuzzleStats.apply(this, arguments);
                syncStatsSoon();
                return out;
            };
            window.updatePuzzleStats.__hybridPatched = true;
        }
    }

    $(async function() {
        injectAccountUI();
        installEvents();
        patchStatsFunctions();
        updateAccountUI();

        var backendOnline = await detectBackend();
        updateAccountUI();

        if (backendOnline && token) {
            try { await loadBackendProfile(); }
            catch(err) {
                console.warn('[Auth] saved backend session invalid:', err.message);
                token = '';
                currentUser = null;
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(BACKEND_USER_KEY);
                updateAccountUI();
            }
        } else if (!backendOnline && currentUser) {
            loadLocalProfile();
            updateAccountUI();
        }
    });

    window.BackrankAuth = {
        getMode: function() { return authMode; },
        getCurrentUser: function() { return currentUser; },
        syncStatsNow: syncStatsNow,
        openAuthModal: openAuthModal,
        setApiBase: function(url) {
            API_BASE = String(url || '').replace(/\/$/, '');
            localStorage.setItem('backrank-api-base', API_BASE);
        }
    };
})();
