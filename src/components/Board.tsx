import { useCallback } from "react";
import { ChessgroundBoard } from "./ChessgroundBoard";

type BoardProps = {
  fen: string;
  color: "w" | "b" | "s";
  isMyTurn: boolean;
  onMove: (move: { from: string; to: string; promotion?: string }) => void;
};

export function Board({ fen, color, isMyTurn, onMove }: BoardProps) {

  const handleMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      if (!isMyTurn || color === "s") return;
      onMove({ ...move, promotion: move.promotion ?? "q" });
    },
    [isMyTurn, color, onMove]
  );

  return <ChessgroundBoard fen={fen} color={color} isMyTurn={isMyTurn} onMove={handleMove} />;
}
