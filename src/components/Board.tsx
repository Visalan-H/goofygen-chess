import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useMemo } from "react";

export function Board({ pgn, color, onMove }: { pgn: string; color: 'w' | 'b' | 's'; onMove: (move: any) => void }) {
  const game = useMemo(() => {
     const c = new Chess();
     if(pgn) c.loadPgn(pgn);
     return c;
  }, [pgn]);

  const isMyTurn = game.turn() === color;

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (color === 's' || !isMyTurn) return false;
    
    // Optimistic check
    try {
        const temp = new Chess();
        if(pgn) temp.loadPgn(pgn);
        const move = temp.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if(!move) return false; // Invalid move logic
    } catch { return false; }

    onMove({ from: sourceSquare, to: targetSquare, promotion: "q" });
    return true; 
  }

  return (
    <div className="w-full max-w-[500px] aspect-square">
      <Chessboard 
        position={game.fen()} 
        boardOrientation={color === 'b' ? 'black' : 'white'}
        arePiecesDraggable={isMyTurn}
        onPieceDrop={onDrop}
        customDarkSquareStyle={{ backgroundColor: "#3f3f46" }} // Zinc-700
        customLightSquareStyle={{ backgroundColor: "#a1a1aa" }} // Zinc-400
      />
    </div>
  );
}
