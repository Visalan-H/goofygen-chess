import { Chessboard } from "react-chessboard";
import { useCallback } from "react";

type BoardProps = {
  fen: string;
  color: "w" | "b" | "s";
  isMyTurn: boolean;
  onMove: (move: { from: string; to: string; promotion?: string }) => void;
};

export function Board({ fen, color, isMyTurn, onMove }: BoardProps) {
  const handleDrop = useCallback(
    (source: string, target: string) => {
      if (!isMyTurn || color === "s") return false;
      onMove({ from: source, to: target, promotion: "q" });
      return true;
    },
    [isMyTurn, color, onMove]
  );

  return (
    <div className="w-full max-w-[480px] aspect-square rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
      <Chessboard
        position={fen}
        boardOrientation={color === "b" ? "black" : "white"}
        arePiecesDraggable={isMyTurn && color !== "s"}
        onPieceDrop={handleDrop}
        customDarkSquareStyle={{ backgroundColor: "#3f3f46" }}
        customLightSquareStyle={{ backgroundColor: "#e4e4e7" }}
      />
    </div>
  );
}
