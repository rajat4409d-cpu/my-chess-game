// ============================================================
// BACKRANK CHESS — Phase 1 Local Account System
// Frontend-only: no backend, no database, GitHub Pages friendly.
// Accounts, sessions, stats, and game history are stored in localStorage.
// ============================================================
(function() {
    'use strict';

    var ACCOUNTS_KEY = 'backrank-phase1-accounts';
    var CURRENT_USER_KEY = 'backrank-phase1-current-user';

    // Remove old backend token if you previously tested the server version.
    // This Phase 1 file does not use backend/JWT auth.
    try { localStorage.removeItem('backrank-auth-token'); } catch(e) {}

    var currentUser = readJson(localStorage.getItem(CURRENT_USER_KEY), null);
    var saveTimer = null;
    var lastGameSavedAt = 0;

    function readJson(raw, fallback) {
        try { return raw ? JSON.parse(raw) : fallback; } catch(e) { return fallback; }
    }

    function getAccounts() {
        return readJson(localStorage.getItem(ACCOUNTS_KEY), {});
    }

    function setAccounts(accounts) {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    function userKey(username) {
        return String(username || '').trim().toLowerCase();
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function defaultSessionStats() {
        return {
            played: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            streak: 0,
            bestStreak: 0,
            resignations: 0,
            checkmates: 0,
            analyzed: 0,
            gameHistory: []
        };
    }

    function defaultPuzzleStats() {
        return {
            attempted: 0,
            solved: 0,
            failed: 0,
            streak: 0,
            bestStreak: 0
        };
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj || {}));
    }

    function dateReviveGameHistory(stats) {
        if (!stats || !Array.isArray(stats.gameHistory)) return stats;
        stats.gameHistory.forEach(function(g) {
            if (g && g.timestamp && !(g.timestamp instanceof Date)) {
                g.timestamp = new Date(g.timestamp);
            }
        });
        return stats;
    }

    async function hashPassword(password) {
        // This is for a frontend-only demo account system. It is NOT real security.
        // Real public auth must use a backend with bcrypt/argon2.
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

    function notify(message, type) {
        var $toast = $('#accountToast');
        if (!$toast.length) {
            $('body').append('<div id="accountToast" class="account-toast"></div>');
            $toast = $('#accountToast');
        }
        $toast.removeClass('success error info').addClass(type || 'info').text(message).addClass('show');
        clearTimeout(notify._t);
        notify._t = setTimeout(function() { $toast.removeClass('show'); }, 2600);
    }

    function getCleanSessionStats() {
        if (typeof window.sessionStats === 'undefined') return defaultSessionStats();
        return clone(window.sessionStats);
    }

    function getCleanPuzzleStats() {
        if (typeof window.puzzleStats === 'undefined') return defaultPuzzleStats();
        return clone(window.puzzleStats);
    }

    function getCurrentAccountRecord() {
        if (!currentUser) return null;
        var accounts = getAccounts();
        return accounts[userKey(currentUser.username)] || null;
    }

    function saveCurrentAccountStats() {
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

    function saveStatsSoon() {
        if (!currentUser) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveCurrentAccountStats, 500);
    }

    function saveLatestGame(result, moveCount, opponent, by) {
        if (!currentUser) return;
        var now = Date.now();
        if (now - lastGameSavedAt < 900) return;
        lastGameSavedAt = now;

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

    function loadStatsFromCurrentAccount() {
        var account = getCurrentAccountRecord();
        if (!account) return;

        if (typeof window.sessionStats !== 'undefined') {
            var s = Object.assign(defaultSessionStats(), account.sessionStats || {});
            dateReviveGameHistory(s);
            Object.keys(window.sessionStats).forEach(function(k) { delete window.sessionStats[k]; });
            Object.assign(window.sessionStats, s);
        }

        if (typeof window.puzzleStats !== 'undefined') {
            var p = Object.assign(defaultPuzzleStats(), account.puzzleStats || {});
            Object.keys(window.puzzleStats).forEach(function(k) { delete window.puzzleStats[k]; });
            Object.assign(window.puzzleStats, p);
        }

        if (typeof window.refreshHomeUI === 'function') window.refreshHomeUI();
        if (typeof window.updatePuzzleStats === 'function') window.updatePuzzleStats();
    }

    function updateAccountUI() {
        var signedIn = !!currentUser;
        var username = signedIn ? currentUser.username : 'Player';

        $('.home-username').text(username);
        $('.account-user-name').text(signedIn ? username : 'Guest');
        $('.account-user-sub').text(signedIn ? 'Local account · saved on this browser' : 'Offline session · sign in locally');
        $('.account-open-btn .account-btn-text').text(signedIn ? username : 'Account');
        $('.account-open-btn').toggleClass('signed-in', signedIn);

        $('#authSignedOut').toggle(!signedIn);
        $('#authSignedIn').toggle(signedIn);
        $('#authModalUsername').text(username);
        $('#authModalEmail').text(signedIn && currentUser.email ? currentUser.email : 'Local-only account');
    }

    function injectAccountUI() {
        var navHtml = '' +
            '<div class="account-nav-card">' +
                '<button class="account-open-btn" type="button"><span class="account-avatar"><i class="ph ph-user"></i></span><span class="account-btn-text">Account</span></button>' +
                '<div class="account-user-meta"><div class="account-user-name">Guest</div><div class="account-user-sub">Offline session</div></div>' +
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
                        '<div class="auth-brand"><i class="ph ph-crown"></i><div><h2>Backrank Account</h2><p>Phase 1: local account saved in this browser.</p></div></div>' +
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
                            '<div class="auth-hint"><strong>Phase 1 note:</strong> this account is saved only in this browser using localStorage. It is perfect for GitHub Pages testing, but not real cloud sync yet.</div>' +
                        '</div>' +
                        '<div id="authSignedIn" style="display:none;">' +
                            '<div class="signed-card"><div class="signed-avatar"><i class="ph ph-user-circle"></i></div><div><h3 id="authModalUsername">Player</h3><p id="authModalEmail">Local-only account</p></div></div>' +
                            '<button id="saveLocalStatsBtn" class="btn-primary auth-submit" type="button"><i class="ph ph-floppy-disk"></i> Save Stats Now</button>' +
                            '<button id="logoutBtn" class="btn-outline auth-submit" type="button"><i class="ph ph-sign-out"></i> Logout</button>' +
                        '</div>' +
                    '</div>' +
                '</div>');
        }
        updateAccountUI();
    }

    function openAuthModal() { $('#authModal').addClass('open'); updateAccountUI(); }
    function closeAuthModal() { $('#authModal').removeClass('open'); }

    function setBusy(busy) {
        $('.auth-submit').prop('disabled', !!busy).toggleClass('loading', !!busy);
    }

    function finishLocalLogin(account) {
        currentUser = {
            username: account.username,
            email: account.email || '',
            createdAt: account.createdAt
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        loadStatsFromCurrentAccount();
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

                if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                    throw new Error('Username must be 3-20 characters and use only letters, numbers, or underscore.');
                }
                if (password.length < 6) throw new Error('Password must be at least 6 characters.');

                var accounts = getAccounts();
                var key = userKey(username);
                if (accounts[key]) throw new Error('That username already exists on this browser.');

                if (email) {
                    var emailTaken = Object.keys(accounts).some(function(k) {
                        return accounts[k].email && accounts[k].email.toLowerCase() === email;
                    });
                    if (emailTaken) throw new Error('That email already exists on this browser.');
                }

                var passwordHash = await hashPassword(password);
                var account = {
                    username: username,
                    email: email,
                    passwordHash: passwordHash,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                    sessionStats: getCleanSessionStats(),
                    puzzleStats: getCleanPuzzleStats(),
                    games: []
                };
                accounts[key] = account;
                setAccounts(accounts);
                finishLocalLogin(account);
                notify('Local account created. You can publish this on GitHub Pages now.', 'success');
            } catch(err) {
                notify(err.message || 'Could not create account.', 'error');
            } finally {
                setBusy(false);
            }
        });

        $(document).on('submit', '#loginForm', async function(e) {
            e.preventDefault();
            try {
                setBusy(true);
                var login = String($('#loginName').val() || '').trim();
                var password = String($('#loginPassword').val() || '');
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

                finishLocalLogin(account);
                notify('Welcome back, ' + account.username + '!', 'success');
            } catch(err) {
                notify(err.message || 'Login failed.', 'error');
            } finally {
                setBusy(false);
            }
        });

        $(document).on('click', '#saveLocalStatsBtn', function() {
            saveCurrentAccountStats();
            notify('Stats saved locally.', 'success');
        });

        $(document).on('click', '#logoutBtn', function() {
            saveCurrentAccountStats();
            currentUser = null;
            localStorage.removeItem(CURRENT_USER_KEY);
            updateAccountUI();
            notify('Logged out. Guest play still works.', 'info');
        });

        window.addEventListener('beforeunload', function() {
            try { saveCurrentAccountStats(); } catch(e) {}
        });
    }

    function patchStatsFunctions() {
        if (typeof window.recordGameResult === 'function' && !window.recordGameResult.__phase1Patched) {
            var originalRecordGameResult = window.recordGameResult;
            window.recordGameResult = function(result, moveCount, opponent, by) {
                var out = originalRecordGameResult.apply(this, arguments);
                saveStatsSoon();
                saveLatestGame(result, moveCount, opponent, by);
                return out;
            };
            window.recordGameResult.__phase1Patched = true;
        }

        if (typeof window.updatePuzzleStats === 'function' && !window.updatePuzzleStats.__phase1Patched) {
            var originalUpdatePuzzleStats = window.updatePuzzleStats;
            window.updatePuzzleStats = function() {
                var out = originalUpdatePuzzleStats.apply(this, arguments);
                saveStatsSoon();
                return out;
            };
            window.updatePuzzleStats.__phase1Patched = true;
        }
    }

    $(function() {
        injectAccountUI();
        installEvents();
        patchStatsFunctions();
        if (currentUser) loadStatsFromCurrentAccount();
        updateAccountUI();
    });

    window.BackrankLocalAuth = {
        getCurrentUser: function() { return currentUser; },
        saveStatsNow: saveCurrentAccountStats,
        openAuthModal: openAuthModal,
        logout: function() {
            saveCurrentAccountStats();
            currentUser = null;
            localStorage.removeItem(CURRENT_USER_KEY);
            updateAccountUI();
        }
    };
})();
