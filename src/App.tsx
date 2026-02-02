import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Layout } from "./components/Layout";
import { Board } from "./components/Board";
import { Chat } from "./components/Chat";
import { generateUUID } from "./lib/utils";

function App() {
  const [token] = useState(() => {
    const saved = localStorage.getItem("chess_user_token");
    if (saved) return saved;
    const newId = generateUUID();
    localStorage.setItem("chess_user_token", newId);
    return newId;
  });

  const [name, setName] = useState(localStorage.getItem("chess_username") || "");
  const [isInGame, setIsInGame] = useState(false);
  const [currentGame, setCurrentGame] = useState<{ id: Id<"games">; roomId: string; color: 'w'|'b'|'s' } | null>(null);

  const register = useMutation(api.users.register);
  const createGame = useMutation(api.games.create);
  const joinGame = useMutation(api.games.join);
  const makeMove = useMutation(api.games.makeMove);
  
  const onlineCount = useQuery(api.users.getOnlineCount) || 0;
  
  // Game state polling
  const gameState = useQuery(api.games.getGame, currentGame ? { gameId: currentGame.id } : "skip");

  useEffect(() => {
    if (name) register({ name, token });
    // Keep alive interval
    const interval = setInterval(() => { if (name) register({ name, token }); }, 60000);
    return () => clearInterval(interval);
  }, [name, token]);

  const handleStart = async (action: 'create' | 'join', roomId?: string) => {
    if (!name.trim()) return alert("Enter name first");
    localStorage.setItem("chess_username", name);
    
    if (action === 'create') {
      const res = await createGame({ token });
      setCurrentGame({ id: res.gameId as any, roomId: res.roomId, color: 'w' }); // Creator is white
    } else {
      const res = await joinGame({ token, roomId });
      if (!res) return alert("Room not found or game unavailable");
      setCurrentGame({ id: res.gameId as any, roomId: res.roomId, color: res.color as any });
    }
    setIsInGame(true);
  };

  const onMove = (move: any) => {
    if (!currentGame) return;
    makeMove({ token, gameId: currentGame.id, move }).catch(err => console.error(err));
  };

  if (isInGame && gameState) {
    return (
      <Layout>
        <div className="flex flex-col md:flex-row h-full">
           <div className="flex-1 p-6 flex flex-col items-center gap-6 bg-zinc-950">
              <div className="w-full flex justify-between items-center px-4">
                 <div className="font-mono text-sm tracking-wider text-zinc-400">ROOM: <span className="text-white font-bold">{gameState.roomId}</span></div>
                 <div className="text-xs px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-300">
                    {gameState.status === 'in-progress' ? `TURN: ${gameState.pgn.split(" ").length % 2 === 0 ? "WHITE" : "BLACK"}` : gameState.status.toUpperCase()}
                 </div>
                 <button onClick={() => { setIsInGame(false); setCurrentGame(null); }} className="text-red-500 text-xs hover:text-red-400 font-medium">QUIT GAME</button>
              </div>
              
              <div className="flex justify-between w-full max-w-[500px] text-xs text-zinc-500 font-mono uppercase">
                <span>{gameState.blackName} (BLACK)</span>
              </div>
              
              <div className="w-full max-w-[500px] aspect-square border-[4px] border-zinc-800 rounded-sm shadow-2xl">
                <Board pgn={gameState.pgn} color={currentGame!.color} onMove={onMove} />
              </div>
              
              <div className="flex justify-between w-full max-w-[500px] text-xs text-zinc-500 font-mono uppercase">
                <span>{gameState.whiteName} (WHITE)</span>
              </div>
           </div>
           
           <Chat gameId={currentGame!.id} userToken={token} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-12 flex flex-col items-center gap-8 text-center">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">Shadcn Chess</h1>
            <p className="text-zinc-400">Realtime • Minimal • Fast</p>
        </div>
        
        <input 
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-64 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-md outline-none focus:ring-1 focus:ring-zinc-600 text-white placeholder:text-zinc-600"
        />

        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
           <button onClick={() => handleStart('create')} className="bg-white text-black py-2.5 rounded-md font-medium text-sm hover:bg-zinc-200 transition shadow-lg shadow-zinc-900/20">
              New Game
           </button>
           <button onClick={() => handleStart('join')} className="bg-zinc-900 border border-zinc-800 text-zinc-300 py-2.5 rounded-md font-medium text-sm hover:bg-zinc-800 transition hover:text-white">
              Find Match
           </button>
        </div>

        <div className="mt-8 flex flex-col gap-3 w-full max-w-sm">
           <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold flex items-center gap-2 justify-center">
             <span>Or join by code</span>
           </div>
           <div className="flex gap-2">
             <input id="roomCode" placeholder="ABC123" className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 text-white uppercase text-sm placeholder:text-zinc-700 outline-none focus:border-zinc-700" maxLength={6} />
             <button onClick={() => handleStart('join', (document.getElementById('roomCode') as HTMLInputElement).value)} className="bg-zinc-800 text-zinc-300 px-4 rounded-md text-sm font-medium hover:bg-zinc-700 hover:text-white transition">Join</button>
           </div>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-zinc-600">
           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
           {onlineCount} online
        </div>
      </div>
    </Layout>
  );
}

export default App;
