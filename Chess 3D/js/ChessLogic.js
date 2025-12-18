export class ChessLogic {
    constructor() {
        this.reset();
    }

    reset() {
        const FEN = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
        this.board = FEN.split('');
        this.turn = 'w'; // 'w' or 'b'
        this.gameOver = false;
    }

    isWhite(p) { return p >= 'A' && p <= 'Z'; }
    isBlack(p) { return p >= 'a' && p <= 'z'; }
    getColor(p) { if(p === '.') return null; return this.isWhite(p) ? 'w' : 'b'; }

    getLegalMoves(idx, boardState = this.board) {
        let moves = [];
        let p = boardState[idx];
        if (p === '.') return [];
        let color = this.getColor(p);
        let r = Math.floor(idx / 8), c = idx % 8;

        const add = (tr, tc) => {
            if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
            let tidx = tr * 8 + tc;
            let target = boardState[tidx];
            if (this.getColor(target) === color) return false;
            moves.push(tidx);
            return target === '.';
        };

        let type = p.toLowerCase();
        if (type === 'p') {
            let dir = color === 'w' ? -1 : 1;
            let start = color === 'w' ? 6 : 1;
            if (r + dir >= 0 && r + dir <= 7 && boardState[(r + dir) * 8 + c] === '.') {
                moves.push((r + dir) * 8 + c);
                if (r === start && boardState[(r + dir * 2) * 8 + c] === '.') moves.push((r + dir * 2) * 8 + c);
            }
            [[dir, -1], [dir, 1]].forEach(([dr, dc]) => {
                let tr = r + dr, tc = c + dc;
                if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
                    let t = boardState[tr * 8 + tc];
                    if (t !== '.' && this.getColor(t) !== color) moves.push(tr * 8 + tc);
                }
            });
        } else if (type === 'n') {
            [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(([dr, dc]) => add(r + dr, c + dc));
        } else if (type === 'k') {
            [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => add(r + dr, c + dc));
        } else {
            let dirs = [];
            if (type !== 'r') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            if (type !== 'b') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
            dirs.forEach(([dr, dc]) => {
                let tr = r + dr, tc = c + dc;
                while (add(tr, tc)) { tr += dr; tc += dc; }
            });
        }
        return moves;
    }

    makeMove(from, to) {
        let captured = this.board[to] !== '.';
        this.board[to] = this.board[from];
        this.board[from] = '.';
        
        // Promotion (Auto Queen)
        if (this.board[to] === 'P' && to < 8) this.board[to] = 'Q';
        if (this.board[to] === 'p' && to >= 56) this.board[to] = 'q';

        this.turn = this.turn === 'w' ? 'b' : 'w';
        return { captured };
    }

    checkWin() {
        // Simplified check: if current player has no moves (stalemate/checkmate simplified)
        for(let i=0; i<64; i++) {
            if(this.getColor(this.board[i]) === this.turn) {
                if(this.getLegalMoves(i).length > 0) return false; 
            }
        }
        return true; // Game Over
    }

    // Minimax AI
    getBestMove(depth) {
        let bestScore = -Infinity;
        let bestMove = null;
        let moves = [];
        
        for(let i=0; i<64; i++) {
            if(this.getColor(this.board[i]) === 'b') {
                let legals = this.getLegalMoves(i);
                legals.forEach(to => moves.push({from: i, to}));
            }
        }
        moves.sort(() => Math.random() - 0.5);

        for(let move of moves) {
            let saved = this.board[move.to];
            this.board[move.to] = this.board[move.from]; this.board[move.from] = '.';
            
            // King capture immediate win check
            if (saved === 'K') { 
                this.board[move.from] = this.board[move.to]; this.board[move.to] = saved;
                return move; 
            }

            let score = this.minimax(depth - 1, -Infinity, Infinity, false);
            this.board[move.from] = this.board[move.to]; this.board[move.to] = saved;

            if(score > bestScore) { bestScore = score; bestMove = move; }
        }
        return bestMove;
    }

    minimax(depth, alpha, beta, isMax) {
        if(depth === 0) return this.evaluate();
        
        let side = isMax ? 'b' : 'w';
        let movesExists = false;
        let bestVal = isMax ? -Infinity : Infinity;

        for(let i=0; i<64; i++) {
            if(this.getColor(this.board[i]) === side) {
                let legals = this.getLegalMoves(i);
                for(let to of legals) {
                    movesExists = true;
                    let saved = this.board[to];
                    this.board[to] = this.board[i]; this.board[i] = '.';
                    
                    if(saved === (isMax ? 'K' : 'k')) { 
                        this.board[i] = this.board[to]; this.board[to] = saved;
                        return isMax ? 10000 : -10000; 
                    }

                    let val = this.minimax(depth - 1, alpha, beta, !isMax);
                    this.board[i] = this.board[to]; this.board[to] = saved;

                    if(isMax) {
                        bestVal = Math.max(bestVal, val); alpha = Math.max(alpha, bestVal);
                    } else {
                        bestVal = Math.min(bestVal, val); beta = Math.min(beta, bestVal);
                    }
                    if(beta <= alpha) return bestVal;
                }
            }
        }
        if(!movesExists) return isMax ? -5000 : 5000;
        return bestVal;
    }

    evaluate() {
        const vals = { p:10, n:30, b:30, r:50, q:90, k:900 };
        let score = 0;
        for(let i=0; i<64; i++) {
            let p = this.board[i];
            if(p === '.') continue;
            let v = vals[p.toLowerCase()] || 0;
            if(this.isBlack(p)) score += v; else score -= v;
        }
        return score;
    }
}