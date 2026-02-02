import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import goofyGifs from "../static/gifs/goofygen.json";
// @ts-ignore
import { cn } from "../lib/utils";
import { FaSmile, FaPaperPlane } from "react-icons/fa";

export function Chat({ gameId, userToken }: { gameId: Id<"games">; userToken: string }) {
  const [text, setText] = useState("");
  const [showGifs, setShowGifs] = useState(false);
  const sendMessage = useMutation(api.messages.send);
  const messages = useQuery(api.messages.list, { gameId }) || [];

  const handleSend = async () => {
    if (!text.trim()) return;
    await sendMessage({ token: userToken, gameId, text: text.trim() });
    setText("");
  };

  const handleGif = async (url: string) => {
    await sendMessage({ token: userToken, gameId, gifUrl: url });
    setShowGifs(false);
  };

  return (
    <div className="flex flex-col h-[500px] border-l border-border w-full md:w-80 bg-zinc-950/50">
      <div className="p-4 border-b border-border font-medium text-sm text-muted-foreground uppercase tracking-wider">Chat</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m._id} className="text-sm">
            <span className={cn("font-bold", m.sender === "Unknown" ? "text-muted-foreground" : "text-zinc-300")}>{m.sender}: </span>
            {m.text && <span className="text-zinc-100">{m.text}</span>}
            {m.gifUrl && <img src={m.gifUrl} alt="gif" className="rounded-md mt-1 max-w-[150px] border border-border" />}
          </div>
        ))}
      </div>
      
      {showGifs && (
         <div className="h-40 overflow-y-scroll border-t border-border bg-zinc-900 p-2 grid grid-cols-3 gap-2">
            {goofyGifs.map(g => (
                <img key={g.id} src={g.url} className="w-full object-cover cursor-pointer hover:opacity-80 rounded border border-border" onClick={() => handleGif(g.url)} />
            ))}
         </div>
      )}

      <div className="p-3 border-t border-border flex gap-2 bg-zinc-900/50">
        <button onClick={() => setShowGifs(!showGifs)} className="text-zinc-400 hover:text-white transition"><FaSmile /></button>
        <input 
          className="flex-1 bg-transparent rounded px-2 py-1 outline-none text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-zinc-700"
          placeholder="Type a message..."
          value={text} 
          onChange={(e) => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend} className="text-white hover:opacity-70"><FaPaperPlane /></button>
      </div>
    </div>
  );
}
