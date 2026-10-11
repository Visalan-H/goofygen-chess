import { useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessground } from "chessground";
import type { Key } from "chessground/types";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";

export type BoardMove = { from: string; to: string; promotion?: string };

type BoardProps = {
  fen: string;
  color: "w" | "b" | "s";
  isMyTurn: boolean;
  // Resolves false when the server rejected the move, so the board can snap back.
  onMove: (move: BoardMove) => Promise<boolean> | boolean;
};

export function ChessgroundBoard({ fen, color, isMyTurn, onMove }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ReturnType<typeof Chessground> | null>(null);

  const fenRef = useRef(fen);
  const isMyTurnRef = useRef(isMyTurn);
  const colorRef = useRef(color);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    fenRef.current = fen;
    isMyTurnRef.current = isMyTurn;
    colorRef.current = color;
    onMoveRef.current = onMove;
  }, [fen, isMyTurn, color, onMove]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cg = Chessground(containerRef.current, {
      coordinates: true,
      animation: { enabled: true, duration: 120 },
      draggable: { enabled: true },
      movable: {
        free: false,
        events: {
          after: (from: string, to: string) => {
            if (!isMyTurnRef.current || colorRef.current === "s") return;
            void Promise.resolve(onMoveRef.current({ from, to, promotion: "q" })).then((ok) => {
              if (!ok) cgRef.current?.set({ fen: fenRef.current });
            });
          },
        },
      },
      premovable: { enabled: false },
    });
    cgRef.current = cg;

    const observer = new ResizeObserver(() => cg.redrawAll());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cg.destroy();
      cgRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chess = new Chess(fen);
    const dests = new Map<Key, Key[]>();
    for (const m of chess.moves({ verbose: true })) {
      const list = dests.get(m.from);
      if (list) list.push(m.to);
      else dests.set(m.from, [m.to]);
    }

    const side = color === "b" ? "black" : "white";
    cgRef.current?.set({
      fen,
      orientation: side,
      turnColor: chess.turn() === "w" ? "white" : "black",
      check: chess.isCheck(),
      movable: {
        free: false,
        dests,
        color: isMyTurn && color !== "s" ? side : undefined,
      },
    });
  }, [fen, color, isMyTurn]);

  return (
    <div
      ref={containerRef}
      className="game-board"
      style={{
        aspectRatio: "1 / 1",
        borderRadius: "0.5rem",
        overflow: "hidden",
        position: "relative",
        zIndex: 10,
      }}
    />
  );
}
