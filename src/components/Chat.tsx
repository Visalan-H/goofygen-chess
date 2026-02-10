import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import goofyGifs from "../static/gifs/goofygen.json";

type ChatProps = {
  gameId: Id<"games">;
  userToken: string;
};

export function Chat({ gameId, userToken }: ChatProps) {
  const [text, setText] = useState("");
  const [showGifs, setShowGifs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = useMutation(api.messages.send);
  const messages = useQuery(api.messages.list, { gameId }) ?? [];

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg) return;
    setText("");
    await sendMessage({ token: userToken, gameId, text: msg });
  };

  const handleGif = async (url: string) => {
    setShowGifs(false);
    await sendMessage({ token: userToken, gameId, gifUrl: url });
  };

  return (
    <div className="flex flex-col flex-1 lg:flex-initial lg:flex-shrink-0 lg:h-auto lg:min-h-[600px] w-full lg:w-[340px] border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-900/30 min-h-0">
      <div className="p-4 border-b border-zinc-800 text-xs text-zinc-500 font-medium tracking-wider uppercase">
        Chat
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-8">No messages yet</p>
        )}
        {messages.map((m) => (
          <div key={m._id} className="text-sm">
            <span className="font-medium text-zinc-400">{m.sender}:</span>{" "}
            {m.text && <span className="text-zinc-200">{m.text}</span>}
            {m.gifUrl && (
              <img src={m.gifUrl} alt="" className="rounded-lg mt-1 max-w-[140px] border border-zinc-800" />
            )}
          </div>
        ))}
      </div>

      {showGifs && (
        <div className="h-36 overflow-y-auto border-t border-zinc-800 bg-zinc-900 p-2 grid grid-cols-3 gap-1">
          {goofyGifs.map((g) => (
            <img
              key={g.id}
              src={g.url}
              alt=""
              className="w-full h-14 object-cover cursor-pointer hover:opacity-70 rounded"
              onClick={() => handleGif(g.url)}
            />
          ))}
        </div>
      )}

      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <button
          onClick={() => setShowGifs(!showGifs)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition text-sm"
        >
          😊
        </button>
        <input
          className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition text-sm"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
