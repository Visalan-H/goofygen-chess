import { ChessgroundBoard, type BoardMove } from "./ChessgroundBoard";

type BoardProps = {
  fen: string;
  color: "w" | "b" | "s";
  isMyTurn: boolean;
  onMove: (move: BoardMove) => Promise<boolean>;
};

export function Board({ fen, color, isMyTurn, onMove }: BoardProps) {
  return <ChessgroundBoard fen={fen} color={color} isMyTurn={isMyTurn} onMove={onMove} />;
}
