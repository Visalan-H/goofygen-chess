import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessground } from "chessground";
import type { Key } from "chessground/types";
import { moveFeedback, preloadSounds, type MoveKind } from "../lib/feedback";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";

export type BoardMove = { from: string; to: string; promotion?: string };

type BoardProps = {
  fen: string;
  pgn: string;
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

function moveHistory(pgn: string) {
  if (!pgn) return [];
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    return chess.history({ verbose: true });
  } catch {
    return [];
  }
}

// SAN already marks every case: # mate, + check, O-O castle, x capture
function moveKind(san: string): MoveKind {
  if (san.endsWith("#")) return "mate";
  if (san.endsWith("+")) return "check";
  if (san.startsWith("O-O")) return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}

export function ChessgroundBoard({ fen, pgn, color, isMyTurn, onMove }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ReturnType<typeof Chessground> | null>(null);
  // A pawn move to the last rank waits here until the player picks a piece
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  // The position or turn changed under the picker, for example the opponent resigned
  const positionKey = `${fen}|${isMyTurn}`;
  const [pendingKey, setPendingKey] = useState(positionKey);
  if (pendingKey !== positionKey) {
    setPendingKey(positionKey);
    setPending(null);
  }

  const fenRef = useRef(fen);
  const isMyTurnRef = useRef(isMyTurn);
  const colorRef = useRef(color);
  const onMoveRef = useRef(onMove);
  const moveCountRef = useRef<number | null>(null);
  const lastMoveRef = useRef<[Key, Key] | undefined>(undefined);

  useEffect(() => {
    fenRef.current = fen;
    isMyTurnRef.current = isMyTurn;
    colorRef.current = color;
    onMoveRef.current = onMove;
  }, [fen, isMyTurn, color, onMove]);

  // Chessground clears its dests and flips the turn on every drop, so push the full state again
  function sync() {
    const chess = new Chess(fenRef.current);
    const dests = new Map<Key, Key[]>();
    for (const m of chess.moves({ verbose: true })) {
      const list = dests.get(m.from);
      if (list) list.push(m.to);
      else dests.set(m.from, [m.to]);
    }

    const side = colorRef.current === "b" ? "black" : "white";
    cgRef.current?.set({
      fen: fenRef.current,
      orientation: side,
      turnColor: chess.turn() === "w" ? "white" : "black",
      check: chess.isCheck(),
      lastMove: lastMoveRef.current,
      movable: {
        free: false,
        dests,
        color: isMyTurnRef.current && colorRef.current !== "s" ? side : undefined,
      },
    });
  }

  function send(move: BoardMove) {
    void Promise.resolve(onMoveRef.current(move)).then((ok) => {
      if (!ok) sync();
    });
  }

  function pick(promotion: string) {
    if (pending) send({ ...pending, promotion });
    setPending(null);
  }

  function cancel() {
    sync();
    setPending(null);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    preloadSounds();

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
    // send and sync read only refs, so the mount-once effect never sees stale state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The PGN keeps the highlight across reloads. Sound only a single new move, so a
  // reload or rejoin stays silent.
  useEffect(() => {
    const moves = moveHistory(pgn);
    const last = moves[moves.length - 1];
    lastMoveRef.current = last ? [last.from, last.to] : undefined;
    if (last && moveCountRef.current === moves.length - 1) moveFeedback(moveKind(last.san));
    moveCountRef.current = moves.length;
  }, [pgn]);

  useEffect(() => {
    sync();
  }, [fen, color, isMyTurn]);

  return (
    <div className="board-wrap" style={{ position: "relative" }}>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a promotion piece"
            className="flex gap-2 rounded-lg bg-card p-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && cancel()}
          >
            {PIECES.map((p, i) => (
              <button
                key={p.id}
                autoFocus={i === 0}
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
