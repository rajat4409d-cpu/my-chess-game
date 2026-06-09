#!/usr/bin/env python3
"""
Lichess Puzzle Converter for Backrank Chess
============================================

Downloads the Lichess open puzzle database and converts it to the
Backrank Chess puzzle format (JavaScript).

Usage:
    python convert_lichess_puzzles.py

Requirements:
    pip install python-chess requests zstandard

Output:
    puzzles_lichess.js  - Puzzle file ready to include in your game

The Lichess puzzle database has 6+ million puzzles under CC0 license.
This script downloads a sample, converts the format, and splits by difficulty.

Format conversion:
    - Lichess: FEN is position BEFORE opponent's setup move
    - Game:    FEN is the puzzle position (after setup move)
    
    We apply the first move (setup) to the FEN, and use remaining moves
    as the solution.
"""

import csv
import io
import os
import sys
import random
import chess
import requests
import zstandard

# =============================================================================
# CONFIGURATION
# =============================================================================

# Lichess puzzle database URL
LICHESS_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"

# How many puzzles to include per difficulty tier
# Increase these numbers to get more puzzles (recommended: 1000-2000 each)
TARGET_COUNTS = {
    'easy':   1500,   # rating < 1200
    'medium': 1500,   # rating 1200-1800
    'hard':   1000,   # rating > 1800
}

# Download limit in MB (compressed). The full file is ~400MB.
# - 20 MB  ~ 50,000 puzzles
# - 50 MB  ~ 150,000 puzzles  
# - 100 MB ~ 300,000 puzzles
# - 0 or None = download entire file (slow!)
DOWNLOAD_MB = 50

# Output file
OUTPUT_FILE = "puzzles_lichess.js"

# Random seed for reproducibility
random.seed(42)


def download_with_progress(url, limit_mb):
    """Stream-download with progress display."""
    limit_bytes = limit_mb * 1024 * 1024 if limit_mb else None
    
    print(f"Downloading from Lichess...")
    print(f"URL: {url}")
    if limit_bytes:
        print(f"Limit: first {limit_mb} MB (compressed)")
    print()
    
    data = bytearray()
    downloaded = 0
    
    with requests.get(url, stream=True, timeout=300) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get('content-length', 0))
        
        for chunk in resp.iter_content(chunk_size=256*1024):
            if not chunk:
                continue
            data.extend(chunk)
            downloaded += len(chunk)
            
            # Progress display
            if total:
                pct = downloaded / total * 100
                mb = downloaded / 1024 / 1024
                sys.stdout.write(f"\r  Downloaded: {mb:.1f} MB ({pct:.1f}%)")
            else:
                mb = downloaded / 1024 / 1024
                sys.stdout.write(f"\r  Downloaded: {mb:.1f} MB")
            sys.stdout.flush()
            
            if limit_bytes and downloaded >= limit_bytes:
                print(f"\n  Reached {limit_mb}MB limit.")
                break
    
    print()
    return bytes(data)


def convert_puzzles():
    # Download compressed data
    compressed = download_with_progress(LICHESS_URL, DOWNLOAD_MB)
    
    print(f"\nDecompressing...")
    dctx = zstandard.ZstdDecompressor()
    
    try:
        decompressed = dctx.decompress(compressed)
    except Exception as e:
        print(f"Full decompression failed (truncated file): {e}")
        print("Trying stream decompression...")
        try:
            stream = dctx.stream_reader(compressed)
            decompressed = stream.read()
        except Exception as e2:
            print(f"Stream decompression also failed: {e2}")
            return
    
    print(f"Decompressed: {len(decompressed)/1024/1024:.1f} MB")
    
    # Parse CSV
    print(f"\nConverting puzzles...")
    text_stream = io.StringIO(decompressed.decode('utf-8'))
    reader = csv.DictReader(text_stream)
    
    puzzles = {'easy': [], 'medium': [], 'hard': []}
    total = 0
    converted = 0
    errors = 0
    
    for row in reader:
        total += 1
        
        # Check if we have enough
        if all(len(puzzles[k]) >= TARGET_COUNTS[k] for k in TARGET_COUNTS):
            break
        
        try:
            fen = row['FEN']
            moves_str = row['Moves']
            rating = int(row['Rating'])
            themes = row.get('Themes', '')
            
            if not moves_str:
                continue
            
            moves = moves_str.split()
            if len(moves) < 2:
                continue
            
            # Lichess: first move is opponent's setup move
            setup_uci = moves[0]
            solution = moves[1:]
            
            # Apply setup move to get puzzle position
            board = chess.Board(fen)
            setup_move = chess.Move.from_uci(setup_uci)
            
            if setup_move not in board.legal_moves:
                continue
            
            board.push(setup_move)
            puzzle_fen = board.fen()
            
            # Classify by rating
            if rating < 1200:
                diff = 'easy'
            elif rating <= 1800:
                diff = 'medium'
            else:
                diff = 'hard'
            
            if len(puzzles[diff]) >= TARGET_COUNTS[diff]:
                continue
            
            # Format theme
            theme_display = themes.replace(' ', ' / ') if themes else 'Tactics'
            
            puzzles[diff].append({
                'fen': puzzle_fen,
                'moves': solution,
                'theme': theme_display,
                'rating': rating
            })
            converted += 1
            
        except Exception:
            errors += 1
            continue
        
        if total % 20000 == 0:
            print(f"  Processed {total:,} -> converted {converted:,} "
                  f"(E:{len(puzzles['easy'])}, M:{len(puzzles['medium'])}, H:{len(puzzles['hard'])})")
    
    print(f"\n{'='*50}")
    print(f"Done!")
    print(f"  Total processed: {total:,}")
    print(f"  Converted: {converted:,}")
    print(f"  Errors: {errors}")
    print(f"  Easy:   {len(puzzles['easy'])} (rating < 1200)")
    print(f"  Medium: {len(puzzles['medium'])} (rating 1200-1800)")
    print(f"  Hard:   {len(puzzles['hard'])} (rating > 1800)")
    
    # Write JavaScript file
    print(f"\nWriting {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("// Lichess Puzzles for Backrank Chess\n")
        f.write("// Converted from: https://database.lichess.org/\n")
        f.write("// License: CC0 (Public Domain)\n")
        f.write("// Generated by: convert_lichess_puzzles.py\n")
        f.write(f"// Total puzzles: {converted}\n\n")
        f.write("var LICHESS_PUZZLES = {\n")
        
        for diff in ['easy', 'medium', 'hard']:
            f.write(f"  {diff}: [\n")
            for p in puzzles[diff]:
                moves_str = ','.join(f'"{m}"' for m in p['moves'])
                f.write(f'    {{fen:"{p["fen"]}", moves:[{moves_str}], theme:"{p["theme"]}", rating:{p["rating"]}}},\n')
            f.write(f"  ],\n")
        
        f.write("};\n")
    
    file_size = os.path.getsize(OUTPUT_FILE) / 1024 / 1024
    print(f"  File size: {file_size:.1f} MB")
    print(f"\nNext step: Copy {OUTPUT_FILE} to your game folder and include it in index.html")


if __name__ == "__main__":
    # Check dependencies
    try:
        import chess
        import requests
        import zstandard
    except ImportError:
        print("ERROR: Missing dependencies.")
        print("Install with: pip install python-chess requests zstandard")
        sys.exit(1)
    
    convert_puzzles()
