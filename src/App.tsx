import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Layout } from "./components/Layout";
import { Board } from "./components/Board";
import { Chat } from "./components/Chat";
import { generateUUID } from "./lib/utils";
import { useToast } from "./components/Toast";
import { useConfirm } from "./components/Confirm";

type GameInfo = {
  id: Id<"games">;
  roomId: string;
  color: "w" | "b" | "s";
};

function App() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [roomCode, setRoomCode] = useState("");

  const [token] = useState(() => {
    const saved = localStorage.getItem("chess_token");
    if (saved) return saved;
    const newToken = generateUUID();
    localStorage.setItem("chess_token", newToken);
    return newToken;
  });

  const [name, setName] = useState(() => localStorage.getItem("chess_name") || "");
  const [currentGame, setCurrentGame] = useState<GameInfo | null>(null);

  const register = useMutation(api.users.register);
  const setOffline = useMutation(api.users.setOffline);
  const createGame = useMutation(api.games.create);
  const joinGame = useMutation(api.games.join);
  const makeMove = useMutation(api.games.makeMove);
  const leaveGame = useMutation(api.games.leaveGame);

  const onlineCount = useQuery(api.users.getOnlineCount) ?? 0;
  const playersCount = useQuery(api.users.getActivePlayersCount) ?? 0;
  const gameState = useQuery(
    api.games.getGame,
    currentGame ? { gameId: currentGame.id } : "skip"
  );

  useEffect(() => {
    const displayName = name.trim() || "Guest";
    if (name.trim()) localStorage.setItem("chess_name", name);
    register({ name: displayName, token });

    const interval = setInterval(() => register({ name: displayName, token }), 30000);
    const handleUnload = () => setOffline({ token });
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [name, token, register, setOffline]);

  const handleCreate = async () => {
    if (!name.trim()) return toast("Enter your name first", "error");
    const result = await createGame({ token });
    setCurrentGame({ id: result.gameId, roomId: result.roomId, color: "w" });
  };

  const handleJoin = async (code?: string) => {
    if (!name.trim()) return toast("Enter your name first", "error");
    const result = await joinGame({ token, roomId: code || undefined });
    if (!result) return toast("No games available", "info");
    setCurrentGame({ id: result.gameId, roomId: result.roomId, color: result.color as "w" | "b" | "s" });
  };

  const handleMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      if (!currentGame) return;
      makeMove({ token, gameId: currentGame.id, move }).catch(() => {});
    },
    [currentGame, token, makeMove]
  );

  const handleLeave = async () => {
    const ok = await confirm({
      title: "Leave Game?",
      message: "You will forfeit if the game is still in progress.",
      confirmText: "Leave",
      cancelText: "Stay",
      variant: "destructive",
    });
    if (!ok) return;
    if (currentGame) await leaveGame({ token, gameId: currentGame.id }).catch(() => {});
    setCurrentGame(null);
  };

  // GAME VIEW
  if (currentGame && gameState) {
    const isWhite = currentGame.color === "w";
    const myName = isWhite ? gameState.whiteName : gameState.blackName;
    const oppName = isWhite ? gameState.blackName : gameState.whiteName;
    const isMyTurn = gameState.turn === currentGame.color && gameState.status === "in-progress";
    
    let status = "";
    if (gameState.status === "waiting") status = "Waiting for opponent...";
    else if (gameState.status === "in-progress") status = isMyTurn ? "Your turn" : "Opponent's turn";
    else if (gameState.status === "finished") {
      status = gameState.winner === "draw" ? "Draw!" : 
        gameState.winner === currentGame.color.charAt(0) ? "You won!" : "You lost";
    }

    return (
      <Layout>
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-3 md:p-8 flex flex-col items-center gap-4 md:gap-6">
            {/* Game header */}
            <div className="w-full max-w-[480px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-mono text-sm text-zinc-400">
                  #{gameState.roomId}
                </span>
              </div>
              <button onClick={handleLeave} className="text-xs text-zinc-500 hover:text-red-400 transition">
                Leave
              </button>
            </div>

            {/* Opponent info */}
            <div className="w-full max-w-[480px] flex items-center gap-3 px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className={`w-3 h-3 rounded-full ${!isMyTurn && gameState.status === "in-progress" ? "bg-amber-500" : "bg-zinc-700"}`} />
              <span className="text-sm text-zinc-300 font-medium">{oppName || "Waiting..."}</span>
              {gameState.isCheck && !isMyTurn && <span className="text-xs text-red-400 ml-auto">CHECK</span>}
            </div>

            {/* Board */}
            <Board fen={gameState.fen} color={currentGame.color} isMyTurn={isMyTurn} onMove={handleMove} />

            {/* Player info */}
            <div className="w-full max-w-[480px] flex items-center gap-3 px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className={`w-3 h-3 rounded-full ${isMyTurn ? "bg-green-500" : "bg-zinc-700"}`} />
              <span className="text-sm text-white font-medium">{myName} (You)</span>
              {gameState.isCheck && isMyTurn && <span className="text-xs text-red-400 ml-auto">CHECK</span>}
            </div>

            {/* Status */}
            <div className="text-center py-2 px-4 bg-zinc-900 rounded-full border border-zinc-800">
              <span className="text-sm text-zinc-300">{status}</span>
            </div>
          </div>

          <Chat gameId={currentGame.id} userToken={token} />
        </div>
      </Layout>
    );
  }

  // LOADING
  if (currentGame && !gameState) {
    return (
      <Layout>
        <div className="p-8 md:p-16 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading game...</p>
        </div>
      </Layout>
    );
  }

  // HOME VIEW
  return (
    <Layout>
      <div className="p-6 md:p-16 flex flex-col items-center gap-8 md:gap-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Chess
          </h1>
          <p className="text-zinc-500 text-sm md:text-base">Real-time multiplayer chess</p>
        </div>

        {/* Name input */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="input w-full max-w-sm text-center"
        />

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button onClick={handleCreate} className="btn btn-primary w-full shadow-lg shadow-white/10">
            Create Game
          </button>
          <button onClick={() => handleJoin()} className="btn btn-secondary w-full">
            Quick Match
          </button>
        </div>

        {/* Join by code */}
        <div className="flex gap-2 w-full max-w-sm">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={6}
            className="input flex-1 text-center uppercase tracking-widest bg-zinc-900/50"
          />
          <button 
            onClick={() => roomCode.trim() && handleJoin(roomCode)} 
            className="btn btn-secondary px-6"
          >
            Join
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-8 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {onlineCount} browsing
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {playersCount} playing
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;
