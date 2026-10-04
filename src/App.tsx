import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Layout } from "./components/Layout";
import { Board } from "./components/Board";
import { Chat } from "./components/Chat";
import { generateUUID, errorMessage } from "./lib/utils";
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

  const stats = useQuery(api.users.getStats);
  const onlineCount = stats?.browsing ?? 0;
  const playersCount = stats?.playing ?? 0;
  const activeGame = useQuery(api.games.getActiveGame, { token });
  const gameState = useQuery(
    api.games.getGame,
    currentGame ? { gameId: currentGame.id } : "skip"
  );

  // Auto-rejoin active game on load
  useEffect(() => {
    if (activeGame && !currentGame) {
      setCurrentGame({ id: activeGame.gameId, roomId: activeGame.roomId, color: activeGame.color });
    }
  }, [activeGame, currentGame]);

  const displayName = name.trim() || "Guest";
  const displayNameRef = useRef(displayName);
  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  // Register on load and after the user stops typing, not on every keystroke
  useEffect(() => {
    if (name.trim()) localStorage.setItem("chess_name", name);
    const timer = setTimeout(() => {
      register({ name: displayName, token }).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [name, displayName, token, register]);

  // Heartbeat keeps the user marked online
  useEffect(() => {
    const interval = setInterval(() => {
      register({ name: displayNameRef.current, token }).catch(() => {});
    }, 60000);
    const handleUnload = () => void setOffline({ token });
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [token, register, setOffline]);

  const gameStateRef = useRef(gameState);
  const currentGameRef = useRef(currentGame);
  useEffect(() => {
    gameStateRef.current = gameState;
    currentGameRef.current = currentGame;
  }, [gameState, currentGame]);

  // Announce the result once per game, then return to the lobby after 5 seconds
  const finishedGameId = gameState?.status === "finished" ? currentGame?.id : undefined;
  useEffect(() => {
    const state = gameStateRef.current;
    const game = currentGameRef.current;
    if (!finishedGameId || !state || !game) return;

    let message: string;
    let type: "info" | "success" | "error" = "info";
    if (state.winner === "draw") {
      message = "Draw! The game ended in a draw.";
    } else if (state.winner === "abandoned") {
      message = "Game abandoned.";
      type = "error";
    } else if (game.color === "s") {
      message = `Game over. ${state.winner === "white" ? state.whiteName : state.blackName} won!`;
    } else {
      const iWon = (game.color === "w" ? "white" : "black") === state.winner;
      message = iWon ? "You won! Great game!" : "You lost. Better luck next time.";
      type = iWon ? "success" : "error";
    }
    toast(message, type);

    const timer = setTimeout(() => {
      leaveGame({ token, gameId: finishedGameId }).catch(() => {});
      setCurrentGame(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [finishedGameId, toast, leaveGame, token]);

  const handleCreate = async () => {
    if (!name.trim()) return toast("Enter your name first", "error");
    try {
      const result = await createGame({ token });
      setCurrentGame({ id: result.gameId, roomId: result.roomId, color: "w" });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const handleJoin = async (code?: string) => {
    if (!name.trim()) return toast("Enter your name first", "error");
    try {
      const result = await joinGame({ token, roomId: code || undefined });
      if (!result) return toast("No games available", "info");
      setCurrentGame({ id: result.gameId, roomId: result.roomId, color: result.color });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const handleMove = useCallback(
    async (move: { from: string; to: string; promotion?: string }) => {
      if (!currentGame) return false;
      try {
        await makeMove({ token, gameId: currentGame.id, move });
        return true;
      } catch (err) {
        toast(errorMessage(err), "error");
        return false;
      }
    },
    [currentGame, token, makeMove, toast]
  );

  const handleLeave = async () => {
    const isInProgress = gameState?.status === "in-progress";
    const isSpectating = currentGame?.color === "s";
    const isResign = isInProgress && !isSpectating;

    const ok = await confirm({
      title: isResign ? "Resign?" : "Leave Game?",
      message: isResign
        ? "You will forfeit the game."
        : "Are you sure you want to leave?",
      confirmText: isResign ? "Resign" : "Leave",
      cancelText: "Stay",
      variant: "destructive",
    });
    if (!ok) return;
    if (currentGame) await leaveGame({ token, gameId: currentGame.id }).catch(() => {});
    setCurrentGame(null);
  };

  // GAME VIEW
  if (currentGame && gameState) {
    const isSpectator = currentGame.color === "s";
    const bottomIsWhite = currentGame.color !== "b";
    const topName = bottomIsWhite ? gameState.blackName : gameState.whiteName;
    const bottomName = bottomIsWhite ? gameState.whiteName : gameState.blackName;
    const topColor = bottomIsWhite ? "b" : "w";
    const bottomColor = bottomIsWhite ? "w" : "b";
    const isMyTurn = !isSpectator && gameState.turn === currentGame.color && gameState.status === "in-progress";
    const isTopActive = gameState.turn === topColor && gameState.status === "in-progress";
    const isBottomActive = gameState.turn === bottomColor && gameState.status === "in-progress";
    const isInProgress = gameState.status === "in-progress";
    const leaveButtonText = isInProgress && !isSpectator ? "Resign" : "Leave";

    let status = "";
    if (gameState.status === "waiting") {
      status = "Waiting for opponent...";
    } else if (gameState.status === "in-progress") {
      if (isSpectator) {
        status = `${gameState.turn === "w" ? gameState.whiteName : gameState.blackName}'s turn`;
      } else {
        status = isMyTurn ? "Your turn" : "Opponent's turn";
      }
    } else if (gameState.status === "finished") {
      if (gameState.winner === "draw") {
        status = "Draw!";
      } else if (gameState.winner === "abandoned") {
        status = "Game abandoned";
      } else if (isSpectator) {
        status = `${gameState.winner === "white" ? gameState.whiteName : gameState.blackName} won!`;
      } else {
        const myWinnerKey = currentGame.color === "w" ? "white" : "black";
        status = myWinnerKey === gameState.winner ? "You won!" : "You lost";
      }
    }

    return (
      <Layout>
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 p-3 md:p-6 lg:p-8 flex flex-col items-center gap-2 md:gap-4 justify-center relative">
             {/* Board Glow */}
             <div className="absolute inset-0 bg-radial-gradient from-white/5 to-transparent opacity-50 pointer-events-none" />

            {/* Game header — room code + status + resign/leave */}
            <div className="w-full max-w-[560px] flex items-center justify-between relative z-10 p-2 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-zinc-500/80">#</span>
                <span className="font-mono text-sm text-zinc-300 font-bold tracking-wider">
                  {gameState.roomId}
                </span>
              </div>
              <span className={`text-sm font-medium ${gameState.status === "in-progress" ? "bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent" : "text-zinc-400"}`}>
                {status}
              </span>
              <button onClick={handleLeave} className="text-xs font-medium text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-wide">
                {leaveButtonText}
              </button>
            </div>

            {/* Top player info */}
            <div className="w-full max-w-[560px] flex items-center gap-3 px-4 py-3 glass rounded-xl relative z-10 transition-colors">
              <div className={`w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-zinc-900 ${isTopActive ? "bg-amber-500 ring-amber-500/50" : "bg-zinc-700 ring-transparent"}`} />
              <span className={`text-sm font-medium transition-colors ${isTopActive ? "text-white" : "text-zinc-500"}`}>
                {topName || "Waiting..."}
              </span>
              {gameState.isCheck && isTopActive && <span className="text-xs font-bold text-red-400 ml-auto tracking-wider">CHECK</span>}
            </div>

            {/* Board */}
            <Board fen={gameState.fen} color={currentGame.color} isMyTurn={isMyTurn} onMove={handleMove} />

            {/* Bottom player info */}
            <div className="w-full max-w-[560px] flex items-center gap-3 px-4 py-3 glass rounded-xl relative z-10">
              <div className={`w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-zinc-900 ${isBottomActive ? "bg-green-500 ring-green-500/50" : "bg-zinc-700 ring-transparent"}`} />
              <span className={`text-sm font-medium transition-colors ${isBottomActive ? "text-white" : "text-zinc-500"}`}>
                {bottomName}{!isSpectator && " (You)"}
              </span>
              {gameState.isCheck && isBottomActive && <span className="text-xs font-bold text-red-400 ml-auto tracking-wider">CHECK</span>}
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
      <div className="p-6 md:p-16 flex flex-col items-center justify-center h-full gap-8 md:gap-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
            Chess
          </h1>
          <p className="text-zinc-500 text-sm md:text-base">Real-time multiplayer chess</p>
        </div>

        {/* Name input */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={24}
          className="input w-full max-w-sm text-center"
        />

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {activeGame ? (
            <button
              onClick={() => setCurrentGame({ id: activeGame.gameId, roomId: activeGame.roomId, color: activeGame.color })}
              className="btn btn-primary w-full shadow-lg shadow-white/10 hover:shadow-white/20 transition-all font-semibold"
            >
              Rejoin Game
            </button>
          ) : (
            <button onClick={handleCreate} className="btn btn-primary w-full shadow-lg shadow-white/10 hover:shadow-white/20 transition-all font-semibold">
              Create Game
            </button>
          )}
          <button onClick={() => handleJoin()} disabled={!!activeGame} className="btn btn-secondary w-full hover:bg-white/5 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
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
            disabled={!!activeGame}
            className="btn btn-secondary px-6 disabled:opacity-40 disabled:cursor-not-allowed"
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
