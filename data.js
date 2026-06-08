// Static configuration data and large dictionaries extracted from script.js

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
    },
    'sfx': {
        label: 'SFX',
        move:    'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/sfx/Move.ogg',
        capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/sfx/Capture.ogg',
        check:   'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/sfx/Check.ogg',
        end:     'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
    },
    'robot': {
        label: 'Robot',
        move:    'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/robot/Move.ogg',
        capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/robot/Capture.ogg',
        check:   'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/robot/Check.ogg',
        end:     'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
    }
};

// ── PIECE THEMES ─────────────────────────────────────────────
var PIECE_THEME_URLS = {
    'wikipedia': 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    'alpha': 'https://chessboardjs.com/img/chesspieces/alpha/{piece}.png',
    'uscf': 'https://chessboardjs.com/img/chesspieces/uscf/{piece}.png',
    'merida': 'https://lichess1.org/assets/piece/merida/{piece}.svg',
    'staunty': 'https://lichess1.org/assets/piece/staunty/{piece}.svg'
};

// --- OPENING TRACKER DATA ---
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

// --- PUZZLE DATABASE ---
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

// --- ACHIEVEMENT DEFINITIONS ---
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
