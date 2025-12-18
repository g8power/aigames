import { ChessLogic } from './ChessLogic.js';
import { VisualBoard } from './VisualBoard.js';

export class Game {
    constructor() {
        this.logic = new ChessLogic();
        this.selectedIdx = -1;
        this.validMoves = [];
        
        // 綁定 UI
        this.uiStatus = document.getElementById('status');
        this.uiLoading = document.getElementById('loading');
        
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
	// --- 新增：綁定校正按鈕 ---
        document.getElementById('syncBtn').addEventListener('click', () => {
            // 這裡不重置邏輯，只重繪畫面
            this.visual.spawnPieces(this.logic.board);
            this.visual.updateHighlights(-1, []);
            this.selectedIdx = -1;
            this.validMoves = [];
            console.log('棋盤已校正');
        });
    }

    init() {
        // 初始化視覺板，並傳入點擊回調
        this.visual = new VisualBoard('game-container', (idx) => this.handleInput(idx));
        this.visual.spawnPieces(this.logic.board);
    }

    reset() {
        this.logic.reset();
        this.selectedIdx = -1;
        this.validMoves = [];
        this.visual.spawnPieces(this.logic.board);
        this.visual.updateHighlights(-1, []);
        this.updateStatus("白方走棋");
    }

    async handleInput(idx) {
        if (this.logic.gameOver || this.logic.turn === 'b') return;

        // --- 修正 1: 如果點擊了「自己已經選取的位置」 -> 取消選取 ---
        // 這能防止「原地移動」的邏輯觸發
        if (idx === this.selectedIdx) {
            this.selectedIdx = -1;
            this.validMoves = [];
            this.visual.updateHighlights(-1, []);
            return;
        }

        // 2. 如果點擊了合法移動的位置 -> 移動
        if (this.selectedIdx !== -1 && this.validMoves.includes(idx)) {
            await this.executeMove(this.selectedIdx, idx);
            return;
        }

        // 3. 點擊自己的棋子 -> 選取
        const char = this.logic.board[idx];
        if (char !== '.' && this.logic.getColor(char) === this.logic.turn) {
            this.selectedIdx = idx;
            this.validMoves = this.logic.getLegalMoves(idx);
            this.visual.updateHighlights(idx, this.validMoves);
        } else {
            // 4. 點空地 -> 取消
            this.selectedIdx = -1;
            this.validMoves = [];
            this.visual.updateHighlights(-1, []);
        }
    }

    async executeMove(from, to) {
        // 邏輯移動
        const result = this.logic.makeMove(from, to);
        
        // 視覺動畫 (等待動畫完成)
        this.visual.updateHighlights(-1, []);
        await this.visual.performMove(from, to, this.logic.board, result.captured);

        // 檢查勝負
        if (this.logic.checkWin()) {
            this.updateStatus(this.logic.turn === 'w' ? "黑方獲勝!" : "白方獲勝!");
            alert("遊戲結束");
            return;
        }

        this.updateStatus(this.logic.turn === 'w' ? "白方思考中" : "AI 思考中...");

        // AI 回合
        if (this.logic.turn === 'b') {
            this.uiLoading.style.display = 'block';
            // 延遲一點以免動畫還沒跑完就卡住
            setTimeout(() => this.aiTurn(), 100);
        }
    }

    async aiTurn() {
        const depth = parseInt(document.getElementById('difficulty').value) || 2;
        const bestMove = this.logic.getBestMove(depth);
        
        this.uiLoading.style.display = 'none';

        if (bestMove) {
            const result = this.logic.makeMove(bestMove.from, bestMove.to);
            await this.visual.performMove(bestMove.from, bestMove.to, this.logic.board, result.captured);
            
            if (this.logic.checkWin()) {
                this.updateStatus("黑方獲勝!");
                alert("你輸了！");
            } else {
                this.updateStatus("白方走棋");
            }
        } else {
            this.updateStatus("白方獲勝! (AI 無路可走)");
            alert("你贏了！");
        }
    }

    updateStatus(msg) {
        this.uiStatus.innerText = msg;
    }
}