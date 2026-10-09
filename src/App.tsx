import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Presence } from "./components/Presence";
import { Layout } from "./components/Layout";
import { Board } from "./components/Board";
import { Chat } from "./components/Chat";
import { generateUUID, errorMessage } from "./lib/utils";
import { useToast } from "./components/Toast";
import { useConfirm } from "./components/Confirm";
import { Chair } from "./components/Chair";

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

  // Heartbeat keeps the user marked online, faster during a game so the opponent sees drops quickly
  const inGame = currentGame !== null;
  useEffect(() => {
    const interval = setInterval(() => {
      register({ name: displayNameRef.current, token }).catch(() => {});
    }, inGame ? 20000 : 60000);
    const handleUnload = () => void setOffline({ token });
    // Phones throttle timers in background tabs, so check in the moment the player is back
    const checkIn = () => {
      if (document.visibilityState === "visible") {
        register({ name: displayNameRef.current, token }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", checkIn);
    window.addEventListener("online", checkIn);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", checkIn);
      window.removeEventListener("online", checkIn);
    };
  }, [token, register, setOffline, inGame]);

  const gameStateRef = useRef(gameState);
  const currentGameRef = useRef(currentGame);
  useEffect(() => {
    gameStateRef.current = gameState;
    currentGameRef.current = currentGame;
  }, [gameState, currentGame]);

  // The game was deleted while we were viewing it, for example by the lobby expiry cron
  useEffect(() => {
    if (currentGame && gameState === null) {
      toast("That game no longer exists.", "info");
      setCurrentGame(null);
    }
  }, [currentGame, gameState, toast]);

  // Announce the result once per game, then return to the lobby after 5 seconds
  const finishedGameId = gameState?.status === "finished" ? currentGame?.id : undefined;
  useEffect(() => {
    const state = gameStateRef.current;
    const game = currentGameRef.current;
    if (!finishedGameId || !state || !game) return;

    let message: string;
    let type: "info" | "success" | "error" = "info";
    if (state.winner === "draw") {
      message = "Draw. Nobody dances.";
    } else if (state.winner === "abandoned") {
      message = "Game abandoned.";
      type = "error";
    } else if (game.color === "s") {
      message = `${state.winner === "white" ? state.whiteName : state.blackName} won. Loser dances.`;
    } else {
      const iWon = (game.color === "w" ? "white" : "black") === state.winner;
      message = iWon ? "You won. Loser dances." : "You lost. Time to dance.";
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
    if (!name.trim()) return toast("Enter your name first.", "error");
    try {
      const result = await createGame({ token });
      setCurrentGame({ id: result.gameId, roomId: result.roomId, color: "w" });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const handleJoin = async (code?: string) => {
    if (!name.trim()) return toast("Enter your name first.", "error");
    try {
      const result = await joinGame({ token, roomId: code || undefined });
      if (!result) return toast("No challengers yet. Start a game.", "info");
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
      title: isResign ? "Resign?" : "Leave?",
      message: isResign
        ? "You lose, and the dance starts."
        : "Are you sure you want to leave?",
      confirmText: isResign ? "Resign" : "Leave",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    if (isResign) toast("You resigned. Start warming up.", "info");
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
    // Presence only matters while a game is on and the other seat is filled
    const showPresence = isInProgress;
    const topSeen = topColor === "w" ? gameState.whiteSeen : gameState.blackSeen;
    const topOnline = topColor === "w" ? gameState.whiteOnline : gameState.blackOnline;
    const bottomSeen = bottomColor === "w" ? gameState.whiteSeen : gameState.blackSeen;
    const bottomOnline = bottomColor === "w" ? gameState.whiteOnline : gameState.blackOnline;
    const leaveButtonText = isInProgress && !isSpectator ? "Resign" : "Leave";

    let status = "";
    if (gameState.status === "waiting") {
      status = "Waiting for a challenger";
    } else if (gameState.status === "in-progress") {
      if (isSpectator) {
        status = `${gameState.turn === "w" ? gameState.whiteName : gameState.blackName}'s move`;
      } else {
        status = isMyTurn ? "Your move" : "Their move";
      }
    } else if (gameState.status === "finished") {
      if (gameState.winner === "draw") {
        status = "Draw";
      } else if (gameState.winner === "abandoned") {
        status = "Game abandoned";
      } else if (isSpectator) {
        status = `${gameState.winner === "white" ? gameState.whiteName : gameState.blackName} won`;
      } else {
        const myWinnerKey = currentGame.color === "w" ? "white" : "black";
        status = myWinnerKey === gameState.winner ? "You won" : "You lost";
      }
    }

    return (
      <Layout>
        <div className="game-view">
          <div className="board-col">
            <div className="game-stack">
              {/* Room code, status, resign or leave */}
              <div className="game-head flex items-center justify-between gap-3 px-1">
                <span className="game-status min-w-0 truncate text-lg font-semibold tracking-tight">{status}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-xs text-zinc-500 tracking-wider">{gameState.roomId}</span>
                  <button onClick={handleLeave} className="-mr-1 -my-2 px-3 h-10 text-sm font-medium text-zinc-400 hover:text-foreground transition-colors">
                    {leaveButtonText}
                  </button>
                </div>
              </div>

              {/* Top player */}
              <div className="player-bar">
                <div className={`w-2 h-2 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-zinc-900 ${isTopActive ? "bg-foreground ring-foreground/40" : "bg-zinc-700 ring-transparent"}`} />
                <span className={`min-w-0 truncate text-sm font-medium transition-colors ${isTopActive ? "text-foreground" : "text-zinc-500"}`}>
                  {topName || "Empty seat"}
                </span>
                {gameState.isCheck && isTopActive && <span className="text-sm font-medium text-destructive ml-auto">In check</span>}
                {showPresence && topSeen !== undefined && (
                  <Presence lastSeen={topSeen} online={topOnline} serverNow={gameState.serverNow} canResign={!isSpectator} />
                )}
              </div>

              <Board fen={gameState.fen} color={currentGame.color} isMyTurn={isMyTurn} onMove={handleMove} />

              {/* Bottom player */}
              <div className="player-bar">
                <div className={`w-2 h-2 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-zinc-900 ${isBottomActive ? "bg-foreground ring-foreground/40" : "bg-zinc-700 ring-transparent"}`} />
                <span className={`min-w-0 truncate text-sm font-medium transition-colors ${isBottomActive ? "text-foreground" : "text-zinc-500"}`}>
                  {bottomName}{!isSpectator && " (you)"}
                </span>
                {gameState.isCheck && isBottomActive && <span className="text-sm font-medium text-destructive ml-auto">In check</span>}
                {showPresence && isSpectator && bottomSeen !== undefined && (
                  <Presence lastSeen={bottomSeen} online={bottomOnline} serverNow={gameState.serverNow} canResign={false} />
                )}
              </div>
            </div>
          </div>

          <Chat gameId={currentGame.id} userToken={token} />
        </div>
      </Layout>
    );
  }

  // LOADING
  // Wait for the active-game lookup so a returning player never sees a flash of the lobby
  if ((currentGame && !gameState) || (!currentGame && activeGame === undefined)) {
    return (
      <Layout>
        <div className="flex-1 p-8 md:p-16 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-foreground rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Pulling up a chair...</p>
        </div>
      </Layout>
    );
  }

  // HOME VIEW
  return (
    <Layout>
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="home-inner">
        {/* Hero */}
        <div className="home-hero space-y-3">
          <Chair />
          <h1 className="hero-word">Pull up a chair.</h1>
          <p className="home-line">Loser dances. Nobody sits for free.</p>
        </div>

        {/* Name input */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="input"
        />

        {/* Actions */}
        <div className="home-actions">
          {activeGame ? (
            <button
              onClick={() => setCurrentGame({ id: activeGame.gameId, roomId: activeGame.roomId, color: activeGame.color })}
              className="btn btn-primary w-full"
            >
              Resume game
            </button>
          ) : (
            <button onClick={handleCreate} className="btn btn-primary w-full">
              New game
            </button>
          )}
          <button onClick={() => handleJoin()} disabled={!!activeGame} className="btn btn-secondary w-full">
            Find a victim
          </button>
        </div>

        {/* Join by code */}
        <div className="home-join">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={6}
            onKeyDown={(e) => {
              if (e.key === "Enter" && roomCode.trim()) void handleJoin(roomCode);
            }}
            className="input flex-1 min-w-0 uppercase tracking-widest"
          />
          <button 
            onClick={() => roomCode.trim() && handleJoin(roomCode)} 
            disabled={!!activeGame}
            className="btn btn-secondary shrink-0 px-5 sm:px-6"
          >
            Join
          </button>
        </div>

        {/* Stats */}
        <p className="home-stats">
          {onlineCount} watching, {playersCount} at a board
        </p>
      </div>
      </div>
    </Layout>
  );
}

export default App;
