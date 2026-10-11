import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
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

const PIECES = [
  { id: "q", glyph: "♕", name: "Queen" },
  { id: "r", glyph: "♖", name: "Rook" },
  { id: "b", glyph: "♗", name: "Bishop" },
  { id: "n", glyph: "♘", name: "Knight" },
] as const;

export function ChessgroundBoard({ fen, color, isMyTurn, onMove }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ReturnType<typeof Chessground> | null>(null);
  // A pawn move to the last rank waits here until the player picks a piece
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);

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

  function send(move: BoardMove) {
    void Promise.resolve(onMoveRef.current(move)).then((ok) => {
      if (!ok) cgRef.current?.set({ fen: fenRef.current });
    });
  }

  function pick(promotion: string) {
    if (pending) send({ ...pending, promotion });
    setPending(null);
  }

  function cancel() {
    cgRef.current?.set({ fen: fenRef.current });
    setPending(null);
  }

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
            const isPawn = new Chess(fenRef.current).get(from as Square)?.type === "p";
            if (isPawn && (to.endsWith("8") || to.endsWith("1"))) {
              setPending({ from, to });
              return;
            }
            send({ from, to });
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
    <div style={{ position: "relative" }}>
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
      {pending && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/60"
          onClick={cancel}
        >
          <div className="flex gap-2 rounded-lg bg-card p-3" onClick={(e) => e.stopPropagation()}>
            {PIECES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-label={p.name}
                onClick={() => pick(p.id)}
                className="h-14 w-14 rounded-md bg-muted text-4xl leading-none hover:bg-accent"
              >
                {p.glyph}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
