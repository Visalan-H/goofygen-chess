import { ChessgroundBoard, type BoardMove } from "./ChessgroundBoard";

type BoardProps = {
  fen: string;
  pgn: string;
  color: "w" | "b" | "s";
  isMyTurn: boolean;
  onMove: (move: BoardMove) => Promise<boolean>;
};

export function Board({ fen, pgn, color, isMyTurn, onMove }: BoardProps) {
  return <ChessgroundBoard fen={fen} pgn={pgn} color={color} isMyTurn={isMyTurn} onMove={onMove} />;
}
