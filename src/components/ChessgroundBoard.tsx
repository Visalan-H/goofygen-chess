import { useEffect, useRef } from "react";
import { Chess, type Square } from "chess.js";
import { Chessground } from "chessground";
import type { Key } from "chessground/types";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.cburnett.css";

type BoardProps = {
  fen: string;
  color: "w" | "b" | "s";
  isMyTurn: boolean;
  onMove: (move: { from: string; to: string; promotion?: string }) => void;
};

export function ChessgroundBoard({ fen, color, isMyTurn, onMove }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<ReturnType<typeof Chessground> | null>(null);

  const isMyTurnRef = useRef(isMyTurn);
  const colorRef = useRef(color);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    isMyTurnRef.current = isMyTurn;
    colorRef.current = color;
    onMoveRef.current = onMove;
  }, [isMyTurn, color, onMove]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cg = Chessground(containerRef.current, {
      orientation: color === "b" ? "black" : "white",
      coordinates: true,
      animation: { enabled: true, duration: 120 },
      draggable: { enabled: true },
      movable: {
        free: false,
        dests: new Map<Key, Key[]>(),
        color: isMyTurn && color !== "s" ? (color === "b" ? "black" : "white") : undefined,
        events: {
          after: (from: string, to: string) => {
            if (!isMyTurnRef.current || colorRef.current === "s") return;
            onMoveRef.current({ from, to, promotion: "q" });
          },
        },
      },
      premovable: {
        enabled: false,
      },
    });

    cgRef.current = cg;

    const observer = new ResizeObserver(() => {
      cg.redrawAll();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cgRef.current?.destroy();
      cgRef.current = null;
    };
  }, []);

  useEffect(() => {
    cgRef.current?.set({ fen });

    const chess = new Chess();
    chess.load(fen);
    const dests = new Map<Key, Key[]>();
    const files = ["a","b","c","d","e","f","g","h"] as const;
    const ranks = ["1","2","3","4","5","6","7","8"] as const;
    for (const f of files) {
      for (const r of ranks) {
        const s = `${f}${r}` as Square;
        const moves = chess.moves({ square: s, verbose: true }) as Array<{ from: Square; to: Square }>;
        if (moves.length) {
          dests.set(s as unknown as Key, moves.map((m) => m.to as unknown as Key));
        }
      }
    }

    const turnColor = chess.turn() === "w" ? "white" : "black";

    cgRef.current?.set({
      fen,
      orientation: color === "b" ? "black" : "white",
      turnColor,
      movable: {
        free: false,
        dests,
        color: isMyTurn && color !== "s" ? (color === "b" ? "black" : "white") : undefined,
      },
    });
  }, [fen, color, isMyTurn]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: 560,
        aspectRatio: "1 / 1",
        borderRadius: 12,
        border: "1px solid #27272a",
        boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
    />
  );
}

