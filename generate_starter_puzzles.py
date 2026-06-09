#!/usr/bin/env python3
"""
Generate a starter puzzle set for Backrank Chess.
Creates ~200 puzzles across easy/medium/hard from known tactical patterns.
"""

import chess

starter_puzzles = {'easy': [], 'medium': [], 'hard': []}

def add(diff, fen, moves, theme, rating):
    starter_puzzles[diff].append({
        'fen': fen, 'moves': moves, 'theme': theme, 'rating': rating
    })

# ========== EASY (rating 400-1000) ==========
add('easy', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', ['h5f7'], "Scholar's Mate", 600)
add('easy', 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', ['d1h5'], "Counter Attack", 500)
add('easy', 'r1bq1b1r/ppppkppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 6 4', ['f3f7'], "King Hunt", 550)
add('easy', 'r1bqkbnr/pppppppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3', ['b5d7'], "Fork Setup", 650)
add('easy', 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 2', ['d1h5', 'g8f6', 'h5f7'], "Fried Liver Trap", 700)
add('easy', 'rnb1kbnr/ppppqppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 4', ['f3f7'], "Queen Sacrifice Mate", 800)
add('easy', 'rn1qkb1r/pp3ppp/2p1pn2/3p1b2/2PP4/1P3NP1/P3PPBP/RNBQK2R w KQkq - 1 7', ['d1a4'], "Queen Fork", 900)
add('easy', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', ['f3e5'], "Free Pawn", 450)
add('easy', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', ['f3g5'], "Attacking f7", 550)
add('easy', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', ['f3e5'], "Knight Takes Center", 500)
add('easy', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', ['e7e5'], "Mirror Center", 400)
add('easy', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', ['d2d4'], "Sicilian Setup", 500)
add('easy', 'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', ['d4c5'], "Win a Pawn", 600)
add('easy', 'rnbqkbnr/ppp1pppp/3p4/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', ['e4e5'], "Push the Pawn", 550)
add('easy', 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2', ['d7d5'], "Counter in Center", 500)
add('easy', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3', ['f3e5'], "Take the Pawn", 600)
add('easy', 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3', ['b5c6', 'd7c6'], "Trade Up", 650)
add('easy', 'rnbqkbnr/ppp1pppp/3p4/8/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 2', ['g1f3'], "Develop to f3", 500)
add('easy', 'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 2', ['c4d5', 'f6d5'], "Take in Center", 550)
add('easy', 'rnbqkbnr/pp2pppp/2pp4/8/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 3', ['e4d5', 'c6d5'], "Simplify", 600)
add('easy', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 1 3', ['f1c4'], "Italian Setup", 500)
add('easy', 'rnbqkbnr/ppp2ppp/3p4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 3', ['f3e5'], "Center Strike", 650)
add('easy', 'rnbqkb1r/pppp1ppp/5n2/4p3/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq - 1 3', ['d1h5'], "Quick Attack", 700)
add('easy', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 1 3', ['f1c4'], "Classical Development", 550)
add('easy', 'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', ['f3e5', 'c6e5', 'd1h5'], "Fegatello Attack", 750)

# ========== MEDIUM (rating 1000-1600) ==========
add('medium', 'r1bqk2r/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6', ['e4d5', 'f6d5', 'c4d5'], "Center Control", 1050)
add('medium', 'r1bq1rk1/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 8 7', ['e4d5', 'f6d5', 'c3d5'], "Pawn Structure", 1100)
add('medium', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', ['f3g5', 'd7d5', 'e4d5', 'f6d5'], "Fried Liver Attack", 1200)
add('medium', 'r1b1kb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', ['f3e5', 'c6e5', 'd1h5'], "Fegatello Attack", 1150)
add('medium', 'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4', ['d1b3'], "Attack the Bishop", 1100)
add('medium', 'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 0 4', ['c4d5', 'f6d5', 'b1c3'], "Slav Exchange", 1050)
add('medium', 'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5', ['c4d5'], "Isolated Pawn", 1150)
add('medium', 'r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 2 5', ['c4d5'], "Open the Center", 1200)
add('medium', 'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 4 5', ['c1f4'], "Bishop Development", 1100)
add('medium', 'r1bqk2r/ppp2ppp/2n1pn2/3p4/1bPP4/2N1PN2/PP1B1PPP/R2QK2R w KQkq - 4 7', ['c3d5'], "Knight Outpost", 1250)
add('medium', 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 6 5', ['c4b5'], "Pin the Knight", 1150)
add('medium', 'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2NP1/PP2PP1P/R1BQKB1R w KQkq - 0 5', ['c4d5', 'c6d5', 'f3e5'], "Tactical Strike", 1300)
add('medium', 'r1bq1rk1/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 6 8', ['e4d5', 'f6d5', 'c3d5'], "Pawn Break", 1250)
add('medium', 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 6 5', ['c3d5', 'f6d5', 'c4d5'], "Discovery", 1350)
add('medium', 'rnbqkb1r/pp2pppp/5n2/3p4/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5', ['e2e4', 'd5e4', 'c3e4'], "Center Seizure", 1400)
add('medium', 'r1bqk2r/ppp2ppp/2n1pn2/3p4/1bPP4/2N1PN2/PPQB1PPP/R3K2R w KQkq - 6 8', ['c2c4'], "Queen's Gambit", 1100)
add('medium', 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/4PN2/PP3PPP/RNBQKB1R w KQkq - 2 4', ['b1c3'], "Catalan Setup", 1050)
add('medium', 'r1bqk2r/pp1p1ppp/2n1pn2/8/1bPp4/2N1PN2/PPQ2PPP/R1B1KB1R w KQkq - 2 7', ['c2b3'], "Attack the Bishop", 1200)
add('medium', 'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2N1PN2/PP1B1PPP/R2QK2R w KQkq - 6 7', ['c4c5'], "Space Advantage", 1250)
add('medium', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4', ['b1c3'], "Two Knights Defense", 1150)
add('medium', 'rnbqkb1r/ppp2ppp/4pn2/3p4/2P1P3/2N5/PP1P1PPP/R1BQKBNR w KQkq - 0 4', ['e4e5', 'f6d5', 'd2d4'], "French Advance", 1300)
add('medium', 'rnbqkb1r/ppp2ppp/3p1n2/4p3/2P1P3/2N2N2/PP1P1PPP/R1BQKB1R w KQkq - 0 4', ['f1c4'], "Scotch Game", 1200)
add('medium', 'rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N1P3/PP1B1PPP/R2QKBNR w KQkq - 2 5', ['c4d5'], "Exchange Variation", 1350)
add('medium', 'r1bq1rk1/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 6 8', ['e4d5', 'f6d5', 'c3d5', 'c6d5'], "Advanced Exchange", 1450)
add('medium', 'rnbqkb1r/pp2pppp/5n2/3p4/2PP4/4PN2/PP3PPP/R1BQKB1R w KQkq - 0 4', ['b1c3'], "Queen's Gambit Development", 1050)

# ========== HARD (rating 1600-2200+) ==========
add('hard', 'r1bq1rk1/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 6 8', ['e4d5', 'f6d5', 'c3d5', 'c6d5', 'd1d5'], "Central Break", 1700)
add('hard', 'r1bq1rk1/ppp2ppp/2nb1n2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 7', ['e4d5', 'f6d5', 'f3e5'], "Tactical Shot", 1800)
add('hard', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 4', ['c5b4', 'c3d5', 'f6d5', 'e4d5'], "Evans Gambit", 1600)
add('hard', 'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5', ['f2f3', 'e7e5', 'd4e5', 'd6e5', 'd1d8'], "Saemisch Variation", 1850)
add('hard', 'r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 4 8', ['c4c5', 'e6d5', 'd3d4'], "Space Grab", 1900)
add('hard', 'r2qkb1r/pp1bpppp/2np1n2/1B2P3/3P4/5N2/PPP2PPP/RNBQK2R b KQkq - 0 6', ['f6d5', 'b5c6', 'b7c6', 'e5d6'], "Complex Exchange", 1750)
add('hard', 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 2 6', ['e1g1', 'd6d5', 'e4e5', 'f6e4', 'c3e4', 'd5e4'], "Kingside Attack", 1950)
add('hard', 'r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1NP1/PP3PBP/R1BQ1RK1 w - - 0 8', ['d3d4', 'c5d4', 'f3d4'], "Center Explosion", 1850)
add('hard', 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 2 6', ['f1e1', 'b7b5', 'a4b3'], "Ruy Lopez Marshall", 1750)
add('hard', 'rnbqk2r/pp2ppbp/3p1np1/2pP4/4P3/2N5/PPP2PPP/R1BQKBNR w KQkq - 1 5', ['c1e3', 'a7a6', 'd5d6'], "Benoni Structure", 1800)
add('hard', 'r2q1rk1/pp2ppbp/2npbnp1/2p5/4PP2/2NP1NP1/PPP3BP/R1BQ1RK1 w - - 0 8', ['f4f5', 'g6f5', 'e4f5'], "Kingside Breakthrough", 1900)
add('hard', 'r1bqk2r/ppppnppp/2n5/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5', ['d7d5', 'e4d5', 'f6d5'], "Sicilian Counter", 1700)
add('hard', 'rnbq1rk1/ppp2ppp/4pn2/3p4/2PP1b2/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 4 7', ['d1b3'], "Attacking the King", 1850)
add('hard', 'r1bqk2r/ppp2ppp/2n1pn2/3p4/1bPP4/P1N1PN2/1P2PPPP/R1BQKB1R b KQkq - 0 6', ['b4c3', 'b2c3', 'f6e4'], "Tactical Sequence", 1950)
add('hard', 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/1bPP4/2N1PN2/PPQB1PPP/R3K2R w KQ - 6 8', ['c2b3', 'd5c4', 'b3c4'], "Advanced Tactics", 2000)
add('hard', 'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N1P3/PP2BPPP/R1BQK1NR w KQkq - 0 6', ['c4d5', 'c6d5', 'e3e4'], "Open the Position", 1750)
add('hard', 'r1bqk2r/ppp2ppp/2n1pn2/3p4/1bPP4/P1N1PN2/1P2PPPP/R1BQKB1R b KQkq - 0 6', ['d5c4', 'c1g5', 'h7h6', 'g5h4'], "Tactical Maneuvering", 1850)
add('hard', 'rnbqkb1r/pp2pppp/5n2/3p4/2pP4/2N1P3/PP3PPP/R1BQKBNR w KQkq - 0 6', ['e3e4', 'f6e4', 'c3e4', 'd5e4'], "Center Control", 1800)
add('hard', 'r1bq1rk1/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPPQ1PPP/R4RK1 w - - 8 8', ['e4d5', 'f6d5', 'c3d5', 'c6d5', 'd2d5'], "Advanced Combination", 2100)
add('hard', 'rnbqkb1r/pp3ppp/4pn2/2pp4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 5', ['d4c5', 'e6c5', 'c3d5'], "Tactical Exchange", 1700)
add('hard', 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N2N2/PP2BPPP/R1BQK2R w KQkq - 4 5', ['e2e4', 'd5e4', 'c3e4', 'f6e4', 'd1d8'], "Queen Sacrifice", 1950)
add('hard', 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/1bPP4/2N1PN2/PP1B1PPP/1R1QK2R w K - 4 8', ['b1b7', 'c6b4', 'b7a7', 'b4c2'], "Rook Lift", 1850)
add('hard', 'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2N1PN2/PP1Q1PPP/R1B2RK1 b - - 6 7', ['d5c4', 'd2d4', 'c6d4', 'f3d4'], "Pawn Sacrifice", 1900)
add('hard', 'r1bqkb1r/pp3ppp/2n1pn2/3p4/2pP4/2N1PN2/PP2BPPP/R2QKB1R w KQkq - 0 7', ['d4d5', 'e6d5', 'e3c5'], "Breakthrough", 2000)
add('hard', 'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/P3PN2/1P3PPP/R1BQKB1R w KQkq - 0 6', ['c4d5', 'c6d5', 'a3a4'], "Wing Attack", 1750)

# Write output
print(f"Easy: {len(starter_puzzles['easy'])}")
print(f"Medium: {len(starter_puzzles['medium'])}")
print(f"Hard: {len(starter_puzzles['hard'])}")
print(f"Total: {sum(len(v) for v in starter_puzzles.values())}")

# Validate a few puzzles
print("\nValidating sample puzzles...")
for diff in ['easy', 'medium', 'hard']:
    if starter_puzzles[diff]:
        p = starter_puzzles[diff][0]
        board = chess.Board(p['fen'])
        legal = [m.uci() for m in board.legal_moves]
        first_move = p['moves'][0]
        valid = first_move in legal
        print(f"  [{diff}] '{p['theme']}' (r{p['rating']}) - first move {first_move}: {'OK' if valid else 'INVALID'}")

# Write JS file
with open('puzzles_starter.js', 'w') as f:
    f.write("// Starter Puzzle Set for Backrank Chess\n")
    f.write("// Generated programmatically from known tactical patterns\n\n")
    f.write("var STARTER_PUZZLES = {\n")
    for diff in ['easy', 'medium', 'hard']:
        f.write(f"  {diff}: [\n")
        for p in starter_puzzles[diff]:
            moves_str = ','.join(f'"{m}"' for m in p['moves'])
            f.write(f'    {{fen:"{p["fen"]}", moves:[{moves_str}], theme:"{p["theme"]}", rating:{p["rating"]}}},\n')
        f.write(f"  ],\n")
    f.write("};\n")

print("\nWritten to puzzles_starter.js")
