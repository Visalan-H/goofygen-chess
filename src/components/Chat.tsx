import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import goofyGifs from "../static/gifs/goofygen.json";
import { useToast } from "./Toast";
import { errorMessage } from "../lib/utils";

type ChatProps = {
  gameId: Id<"games">;
  userToken: string;
};

export function Chat({ gameId, userToken }: ChatProps) {
  const { toast } = useToast();
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
    try {
      await sendMessage({ token: userToken, gameId, text: msg });
    } catch (err) {
      setText(msg);
      toast(errorMessage(err), "error");
    }
  };

  const handleGif = async (url: string) => {
    setShowGifs(false);
    try {
      await sendMessage({ token: userToken, gameId, gifUrl: url });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:flex-initial lg:flex-shrink-0 lg:h-auto lg:min-h-[600px] w-full lg:w-[340px] glass border-t lg:border-t-0 lg:border-l border-white/5 min-h-0">
      <div className="p-4 border-b border-white/5 text-xs text-zinc-400 font-medium tracking-wider uppercase">
        Chat
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-8">No messages yet</p>
        )}
        {messages.map((m) => (
          <div key={m._id} className="text-sm">
            <span className="font-medium text-zinc-400">{m.sender}:</span>{" "}
            {m.text && <span className="text-zinc-200 break-words">{m.text}</span>}
            {m.gifUrl && (
              <img src={m.gifUrl} alt="GIF" loading="lazy" className="rounded-lg mt-1 max-w-[140px] border border-white/10" />
            )}
          </div>
        ))}
      </div>

      {showGifs && (
        <div className="h-36 overflow-y-auto border-t border-white/5 bg-zinc-900/80 p-2 grid grid-cols-3 gap-1">
          {goofyGifs.map((g) => (
            <button key={g.id} type="button" onClick={() => handleGif(g.url)} className="p-0 border-0 bg-transparent">
              <img
                src={g.url}
                alt={g.keywords.join(", ")}
                loading="lazy"
                className="w-full h-14 object-cover cursor-pointer hover:opacity-70 rounded"
              />
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-white/5 flex gap-2">
        <button
          type="button"
          aria-label="Toggle GIF picker"
          onClick={() => setShowGifs(!showGifs)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition text-sm"
        >
          😊
        </button>
        <input
          className="flex-1 min-w-0 bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-white/20 transition-all"
          placeholder="Message..."
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void handleSend();
          }}
        />
        <button
          type="button"
          aria-label="Send message"
          onClick={() => void handleSend()}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition text-sm"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
